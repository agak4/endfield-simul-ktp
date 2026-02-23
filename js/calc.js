/**
 * calc.js — 데미지 계산 엔진
 *
 * [역할]
 * - calculateDamage(state)를 진입점으로 하여 최종 데미지를 계산한다.
 * - 계산 흐름:
 *   1. collectAllEffects: 장비/무기/오퍼레이터/세트의 모든 효과를 allEffects 배열에 수집
 *   2. applyFixedStats: 절댓값 스탯(스탯 타입) 적용
 *   3. applyPercentStats: 퍼센트 스탯(스탯% 타입) 적용 (포지에 복리 적용)
 *   4. computeFinalDamageOutput: 공격력·크리·피해 증가 등을 종합하여 최종 데미지 산출
 *
 * [의존]
 * - state.js  : state, STAT_NAME_MAP, GEAR_SLOT_KEYS 등 구조
 * - data_*.js : DATA_OPERATORS, DATA_WEAPONS, DATA_GEAR, DATA_SETS
 *
 * [내부 규칙]
 * - 효과 UID : `${name}_${type}_v${index}` 형태로 생성한다.
 *   클릭으로 비활성화할 때 이 UID를 state.disabledEffects에 저장한다.
 * - nonStack 효과: sourceId(무기) 또는 setId(세트) + type을 키로 중복 차단한다.
 * - 서브 오퍼레이터 효과: target이 '팀' | '팀_외' | '적'인 효과만 적용한다.
 * - 디버프 직접 적용 규칙 (부식/감전 등 state.debuffState 기반 효과):
 *   ① uid를 'debuff_XXXX' 형태로 고정한다.
 *   ② 로그는 항상 추가한다 (state.disabledEffects와 무관하게).
 *   ③ 수치 누산은 `!state.disabledEffects.includes('디버프_uid')` 조건에서만 수행한다.
 */

// ============================================================
// 공유 상수
// ============================================================

/** 스킬 타입 → 내부 카테고리 키 매핑 (여러 함수에서 공통 사용) */
const SKILL_TYPE_MAP = {
    '일반 공격': 'normal',
    '배틀 스킬': 'battle',
    '연계 스킬': 'combo',
    '궁극기': 'ult',
};

/** 속성(element) 키 → 한글 저항 키 매핑 */
const ELEMENT_RES_KEY_MAP = {
    heat: '열기',
    elec: '전기',
    cryo: '냉기',
    nature: '자연',
};

/** 스킬 배율(skillMults)이 적용되는 스킬 타입 집합 */
const SKILL_MULT_TYPES = new Set(['일반 공격', '배틀 스킬', '연계 스킬', '궁극기']);

/** 갑옷 파괴 단계별 받는 물리 피해 증가량 */
const ARMOR_BREAK_BONUS = [0, 12, 16, 20, 24];

/** 부식/감전 단계별 저항 감소 / 받는 피해 증가량 */
const DEBUFF_STACKS_BONUS = [0, 12, 16, 20, 24];

// ============================================================
// 공유 유틸리티
// ============================================================

/**
 * 퍼센트 문자열에서 소수 배율을 추출한다. ("150%" → 1.5, 미매칭 → 0)
 * calcSingleSkillDamage 내부의 parseDmgPct 및 calculateCycleDamage 내부의 parsePct와 동일한 역할.
 * @param {number|string} v
 * @returns {number}
 */
function parseDmgPct(v) {
    if (!v || v === 0) return 0;
    const m = String(v).match(/([\d.]+)%/);
    return m ? parseFloat(m[1]) / 100 : 0;
}

/**
 * 효과 이름에서 UI 표시용 접미사(_t0, _s1 등)를 제거한다.
 * @param {string} name
 * @returns {string}
 */
function getDisplayName(name) {
    return (name || '').replace(/(_t|_s)\d+$/g, '');
}

/**
 * 수치를 "+N" 형태의 표시 문자열로 변환한다.
 * @param {number|string} val
 * @returns {string}
 */
function formatValDisplay(val) {
    if (val === undefined || val === null) return '';
    if (typeof val === 'number' && val > 0) return `+${val}`;
    if (typeof val === 'string' && !val.startsWith('-') && !val.startsWith('+')) return `+${val}`;
    return String(val);
}

/**
 * 오퍼레이터 타입·속성에서 한글 저항 키를 반환한다.
 * @param {object} opData
 * @returns {string|null}
 */
function getOpResKey(opData) {
    return opData.type === 'phys' ? '물리' : (ELEMENT_RES_KEY_MAP[opData.element] || null);
}

// ============================================================
// 데미지 계산 진입점
// ============================================================

/**
 * 주어진 state를 기반으로 최종 데미지를 계산한다.
 * @param {object} currentState
 * @param {boolean} forceMaxStack - 모든 스택을 최대치로 강제할지 여부
 * @returns {object|null} 계산 결과 또는 null
 */
function calculateDamage(currentState, forceMaxStack = false) {
    const originalOpData = DATA_OPERATORS.find(o => o.id === currentState.mainOp.id);
    const wepData = DATA_WEAPONS.find(w => w.id === currentState.mainOp.wepId);
    if (!originalOpData || !wepData) return null;

    const opData = { ...originalOpData };

    // 스킬 속성 오버라이드 처리
    if (currentState.overrideSkillElement) {
        if (currentState.overrideSkillElement === 'phys') {
            opData.type = 'phys';
            opData.element = null;
        } else {
            opData.type = 'arts';
            opData.element = currentState.overrideSkillElement;
        }
    }

    const stats = { ...opData.stats };
    const allEffects = [];

    collectAllEffects(currentState, opData, wepData, stats, allEffects, forceMaxStack);

    const activeEffects = allEffects.filter(e => {
        if (e._triggerFailed) return false;
        if (currentState.disabledEffects.includes(e.uid)) return false;
        // 스탯의 경우 UI에서 #common 가상 UID로 토글되므로 이를 확인
        if ((e.type === '스탯' || e.type === '스탯%') && currentState.disabledEffects.includes(`${e.uid}#common`)) return false;
        return true;
    });

    applyFixedStats(activeEffects, stats);
    applyPercentStats(activeEffects, stats);

    return computeFinalDamageOutput(currentState, opData, wepData, stats, allEffects, activeEffects);
}

// ============================================================
// 스탯 키 정규화
// ============================================================

/**
 * 효과의 target 문자열을 stats 객체의 실제 키로 변환한다.
 * 한글 이름(역방향 조회)도 지원한다.
 * @param {string} target
 * @param {object} container
 * @returns {string}
 */
function resolveStatKey(target, container) {
    if (container[target] !== undefined) return target;
    const mapped = STAT_NAME_MAP[target];
    if (mapped && container[mapped] !== undefined) return mapped;
    const reverseKey = Object.keys(STAT_NAME_MAP).find(k => STAT_NAME_MAP[k] === target);
    if (reverseKey && container[reverseKey] !== undefined) return reverseKey;
    return target;
}

// ============================================================
// 스택 수치 계산
// ============================================================

/**
 * 트리거 이름에 대응하는 현재 스택 수를 반환한다.
 * 방어 불능의 경우 잠재/재능에서 '방어 불능 보정' 효과를 반영한다.
 * @param {string} triggerName
 * @param {object} state
 * @param {object} opData
 * @param {string[]} skillTypes
 * @returns {number}
 */
function getAdjustedStackCount(triggerName, state, opData, skillTypes) {
    if (triggerName === '방어 불능') {
        let count = state.debuffState?.physDebuff?.defenseless || 0;
        const op = opData || DATA_OPERATORS.find(o => o.id === state.mainOp.id);
        if (op) {
            const pools = [
                ...(op.talents || []).flat(),
                ...((op.potential || []).slice(0, Number(state.mainOp.pot) || 0)).flat(),
            ];
            pools.forEach(pEff => {
                const pTypes = Array.isArray(pEff.type) ? pEff.type : [pEff.type];
                if (pTypes.includes('방어 불능 보정')) {
                    const matchSkill = !pEff.skillType || (skillTypes && skillTypes.some(st => pEff.skillType.includes(st)));
                    if (matchSkill) count += (pEff.val || 0);
                }
            });
        }
        return Math.min(4, count);
    }

    // 스페셜 스택
    const op = opData || DATA_OPERATORS.find(o => o.id === (state.mainOp?.id));
    const specialStackVal = state.getSpecialStack ? state.getSpecialStack() : (state.mainOp?.specialStack || {});
    if (op && op.specialStack) {
        const stacks = Array.isArray(op.specialStack) ? op.specialStack : [op.specialStack];
        const matchingStack = stacks.find(s => s.triggers && s.triggers.includes(triggerName));
        if (matchingStack) {
            const stackId = matchingStack.id || 'default';
            return typeof specialStackVal === 'object' ? (specialStackVal[stackId] || 0) : specialStackVal;
        }
    }

    // 기타 디버프 스택
    if (triggerName === '갑옷 파괴') return state.debuffState?.physDebuff?.armorBreak || 0;
    if (['열기 부착', '전기 부착', '냉기 부착', '자연 부착'].includes(triggerName)) {
        if (state.debuffState?.artsAttach?.type === triggerName) return state.debuffState.artsAttach.stacks || 0;
    }
    if (['연소', '감전', '동결', '부식'].includes(triggerName)) return state.debuffState?.artsAbnormal?.[triggerName] || 0;

    return 0;
}

// ============================================================
// 효과 수집
// ============================================================

/**
 * 장비 / 무기 / 오퍼레이터 / 서브 오퍼레이터 / 세트의 모든 효과를 allEffects에 수집한다.
 * @param {object} state
 * @param {object} opData
 * @param {object} wepData
 * @param {object} stats - 기본 스탯 (장비 기본 스탯이 직접 누산됨)
 * @param {Array} allEffects - 수집된 효과를 담을 배열
 * @param {boolean} forceMaxStack
 */
function collectAllEffects(state, opData, wepData, stats, allEffects, forceMaxStack = false) {
    const activeNonStackTypes = new Set();

    // 두 수치를 합산한다. 퍼센트 여부는 문자열 포함 여부로 판정한다.
    const combineValues = (v1, v2) => {
        if (v1 === undefined) return v2;
        if (v2 === undefined) return v1;
        const isPct = (typeof v1 === 'string' && v1.includes('%')) || (typeof v2 === 'string' && v2.includes('%'));
        const sum = parseFloat((parseFloat(v1) + parseFloat(v2)).toPrecision(12));
        return isPct ? sum + '%' : sum;
    };

    // 동일한 type/trigger/target/skillType/cond를 가진 효과들을 병합한다.
    const mergeEffects = (effs) => {
        if (!effs || effs.length === 0) return [];
        const groups = {};
        effs.forEach(eff => {
            if (!eff) return;
            const key = [
                JSON.stringify(eff.type),
                JSON.stringify(eff.trigger),
                eff.target,
                JSON.stringify(eff.skillType),
                eff.cond,
            ].join('|');

            if (!groups[key]) {
                groups[key] = JSON.parse(JSON.stringify(eff));
            } else {
                const g = groups[key];
                if (eff.val !== undefined) g.val = combineValues(g.val, eff.val);
                if (eff.dmg !== undefined) g.dmg = combineValues(g.dmg, eff.dmg);
                if (eff.bonus) {
                    if (!g.bonus) g.bonus = [];
                    eff.bonus.forEach(eb => {
                        const existing = g.bonus.find(gb =>
                            JSON.stringify(gb.type) === JSON.stringify(eb.type) &&
                            JSON.stringify(gb.trigger) === JSON.stringify(eb.trigger) &&
                            gb.target === eb.target
                        );
                        if (existing) {
                            if (eb.val !== undefined) existing.val = combineValues(existing.val, eb.val);
                        } else {
                            g.bonus.push(JSON.parse(JSON.stringify(eb)));
                        }
                    });
                }
            }
        });
        return Object.values(groups);
    };

    /**
     * 단일 소스 배열(source)의 효과들을 평가해 allEffects에 추가한다.
     * @param {Array} source - 효과 배열
     * @param {string} name - 표시 이름
     * @param {number} forgeMult - 단조 배율
     * @param {boolean} isSub - 서브 오퍼레이터 효과 여부
     * @param {boolean} isSkillSource - 스킬 소스 여부
     * @param {boolean} forceMaxStack
     * @param {object} effectiveOpData - 효과 평가 기준 오퍼레이터
     * @param {string|null} uidPrefix - UID 접두사 오버라이드
     */
    const addEffect = (source, name, forgeMult = 1.0, isSub = false, isSkillSource = false, forceMaxStack = false, effectiveOpData = opData, uidPrefix = null) => {
        if (!source || !Array.isArray(source)) return;

        source.forEach((eff, i) => {
            if (!eff) return;

            // 기본 트리거 평가
            let baseTriggerMet = true;
            if (eff.trigger) baseTriggerMet = baseTriggerMet && evaluateTrigger(eff.trigger, state, effectiveOpData, eff.triggerType, false, eff.target);
            if (eff.triggerTarget) baseTriggerMet = baseTriggerMet && evaluateTrigger(eff.triggerTarget, state, effectiveOpData, null, true, eff.target);
            if (eff.targetFilter === '다른 속성') {
                if ((effectiveOpData.element || effectiveOpData.type) === (opData.element || opData.type)) baseTriggerMet = false;
            }

            const typeArr = eff.type
                ? (Array.isArray(eff.type) ? eff.type : [eff.type]).map(item => typeof item === 'string' ? { type: item } : item)
                : [];
            const bonuses = eff.bonus || [];
            const activeBonuses = bonuses.filter(b => !b.trigger || evaluateTrigger(b.trigger, state, effectiveOpData, null, false, b.target || eff.target));

            // 트리거 미충족이더라도 오퍼레이터 속성과 일치하는 무기 효과는 표시용으로 포함
            const isMatchOpType = typeArr.some(ta => {
                const t = ta.type;
                const opTypeK = effectiveOpData.type === 'phys' ? '물리' : '아츠';
                const opElK = ELEMENT_RES_KEY_MAP[effectiveOpData.element];
                return t && (t.includes(opTypeK) || (opElK && t.includes(opElK)) || t.includes('취약') || t.includes('증폭'));
            });
            const showEvenIfFailed = !baseTriggerMet && (!!eff.sourceId || isMatchOpType);

            if (!baseTriggerMet && !showEvenIfFailed) return;

            const triggerFailed = !baseTriggerMet;

            typeArr.forEach((typeItem, j) => {
                if (!typeItem?.type) return;

                let currentVal = typeItem.val !== undefined ? typeItem.val : eff.val;

                // perStack 처리: 트리거 스택 수에 비례하여 수치를 계산한다.
                const ps = typeItem.perStack || eff.perStack;
                const tr = typeItem.trigger || eff.trigger;
                if (ps && tr) {
                    const triggers = Array.isArray(tr) ? tr : [tr];
                    const maxStack = triggers.reduce((acc, t) => Math.max(acc, getAdjustedStackCount(t, state, effectiveOpData, eff.skillType)), 0);
                    const base = typeItem.base !== undefined ? typeItem.base : (eff.base !== undefined ? eff.base : currentVal);
                    const total = parseFloat((parseFloat(ps) * maxStack + parseFloat(base || 0)).toPrecision(12));
                    currentVal = (String(ps).includes('%') || (base && String(base).includes('%'))) ? total + '%' : total;
                }

                // stack(중첩) 처리: 중첩 수에 비례하여 수치를 보정한다.
                const effUid = `${uidPrefix || name}_${typeItem.type}_v${i}_${j}`;
                let stackCount = state.effectStacks?.[effUid] ?? 1;
                if (forceMaxStack && eff.stack) stackCount = eff.stack;

                if (eff.stack) {
                    const n = parseFloat(currentVal) || 0;
                    const multiplied = parseFloat((n * stackCount).toPrecision(12));
                    currentVal = (typeof currentVal === 'string' && currentVal.includes('%')) ? multiplied + '%' : multiplied;
                    typeItem._stackCount = stackCount;
                    typeItem._uid = effUid;
                }

                // activeBonuses 중 이 typeItem에 해당하는 것을 수치에 합산
                activeBonuses.forEach(b => {
                    if (b.type === typeItem.type || (!b.type && typeArr.length === 1)) {
                        if (b.val !== undefined) {
                            let bVal = b.val;
                            if (eff.stack) {
                                const bn = parseFloat(bVal) || 0;
                                const bMult = parseFloat((bn * stackCount).toPrecision(12));
                                bVal = (typeof bVal === 'string' && bVal.includes('%')) ? bMult + '%' : bMult;
                            }
                            currentVal = combineValues(currentVal, bVal);
                        }
                        if (b.perStack && b.trigger) {
                            const bTriggers = Array.isArray(b.trigger) ? b.trigger : [b.trigger];
                            const maxStack = bTriggers.reduce((acc, t) => Math.max(acc, getAdjustedStackCount(t, state, effectiveOpData, eff.skillType)), 0);
                            const bnPer = parseFloat(b.perStack) || 0;
                            const bnBase = b.base !== undefined ? parseFloat(b.base) : (b.val !== undefined ? parseFloat(b.val) : 0);
                            const bonusTotal = parseFloat((bnPer * maxStack + bnBase).toPrecision(12));
                            const bisPct = String(b.perStack).includes('%') || (b.base && String(b.base).includes('%')) || (b.val && String(b.val).includes('%'));
                            currentVal = combineValues(currentVal, bisPct ? bonusTotal + '%' : bonusTotal);
                        }
                        b._applied = true;
                    }
                });

                const expanded = {
                    ...eff,
                    type: typeItem.type,
                    val: currentVal,
                    target: typeItem.target || eff.target,
                    skillType: typeItem.skillType || eff.skillType || eff.skilltype,
                    _stackCount: typeItem._stackCount,
                    _isExternal: !isSkillSource || !!(typeItem.skillType),
                    _triggerFailed: triggerFailed,
                };

                if (isSub && !isSubOpTargetValid(expanded)) return;

                if (expanded.nonStack) {
                    const key = `${expanded.sourceId || name}_${expanded.type}`;
                    if (activeNonStackTypes.has(key)) return;
                    activeNonStackTypes.add(key);
                }

                const finalUid = typeItem._uid || `${uidPrefix || name}_${typeItem.type.toString()}_v${i}_${j}`;
                allEffects.push({ ...expanded, name, forgeMult, uid: finalUid });
            });

            // 병합되지 않은 standalone bonus 처리
            activeBonuses.forEach((b, j) => {
                if (b._applied) return;
                const bonusTypes = b.type
                    ? (Array.isArray(b.type) ? b.type : [b.type])
                    : (typeArr.length === 1 ? [typeArr[0].type] : []);
                bonusTypes.forEach((bt, bj) => {
                    const bonusEff = { target: b.target || eff.target, ...b, type: bt };
                    if (!isSub || isSubOpTargetValid(bonusEff)) {
                        allEffects.push({
                            ...bonusEff,
                            name,
                            forgeMult,
                            uid: `${uidPrefix || name}_bonus_${bt.toString()}_v${i}_${j}_${bj}`,
                            _triggerFailed: !baseTriggerMet,
                        });
                    }
                });
            });
        });
    };

    // 1. 장비 기본 스탯 및 특성 효과 수집
    state.mainOp.gears.forEach((gId, i) => {
        if (!gId) return;
        const gear = DATA_GEAR.find(g => g.id === gId);
        if (!gear) return;
        const isForged = state.mainOp.gearForged[i];

        [1, 2].forEach(num => {
            const statKey = gear[`stat${num}`];
            if (!statKey) return;
            const val = isForged && gear[`val${num}_f`] !== undefined ? gear[`val${num}_f`] : gear[`val${num}`];
            const key = resolveStatKey(statKey, stats);
            if (stats[key] !== undefined) stats[key] += val;
        });

        if (gear.trait) {
            const traits = gear.trait.map(t => {
                const val = isForged && t.val_f !== undefined ? t.val_f : t.val;
                const isPercent = typeof val === 'string' && val.includes('%');
                const types = Array.isArray(t.type) ? t.type : [t.type];
                if (types.includes('스탯')) {
                    const stat = t.stat === '주스탯' ? opData.mainStat
                        : t.stat === '부스탯' ? opData.subStat
                            : t.stat;
                    return { ...t, type: isPercent ? '스탯%' : '스탯', stat, val };
                }
                return { ...t, val };
            });
            addEffect(traits, `${gear.name}_s${i}`, 1.0, false, false, forceMaxStack, opData);
        }
    });

    // 2. 무기 특성 효과 수집 (메인 + 서브 오퍼레이터)
    const weaponsToProcess = [
        { data: wepData, state: state.mainOp.wepState, pot: state.mainOp.wepPot, name: opData.name, isMain: true, ownerOp: opData },
        ...state.subOps.map((sub, idx) => {
            const sOpData = DATA_OPERATORS.find(o => o.id === sub.id);
            const sWep = DATA_WEAPONS.find(w => w.id === sub.wepId);
            return { data: sWep, state: sub.wepState, pot: sub.wepPot, name: sOpData ? sOpData.name : `서브${idx + 1}`, isMain: false, ownerOp: sOpData };
        }),
    ];

    weaponsToProcess.forEach((entry) => {
        if (!entry.data) return;
        entry.data.traits.forEach((trait, idx) => {
            if (!trait) return;
            const finalLv = calculateWeaponTraitLevel(idx, entry.state, entry.pot);
            const val = calculateWeaponTraitValue(trait, finalLv);
            const eff = { ...trait, val, sourceId: entry.data.id };

            const label = entry.isMain
                ? `${entry.data.name} 특성${idx + 1}(Lv${finalLv})`
                : `${entry.name} ${entry.data.name} 특성${idx + 1}`;
            const uidPrefix = entry.isMain
                ? `${entry.data.name}_trait${idx + 1}`
                : `${entry.name}_${entry.data.id}_trait${idx + 1}`;
            const uniqueLabel = `${label}_t${idx}`;

            const types = Array.isArray(trait.type) ? trait.type : [trait.type];
            if (types.includes('스탯')) {
                const targetStat = trait.stat === '주스탯' ? opData.mainStat
                    : trait.stat === '부스탯' ? opData.subStat
                        : trait.stat;
                const isPercent = typeof val === 'string' && val.includes('%');
                addEffect([{ ...eff, type: isPercent ? '스탯%' : '스탯', stat: targetStat }], uniqueLabel, 1.0, !entry.isMain, false, forceMaxStack, entry.ownerOp, uidPrefix);
            } else {
                addEffect([eff], uniqueLabel, 1.0, !entry.isMain, false, forceMaxStack, entry.ownerOp, uidPrefix);
            }
        });
    });

    // 3. 메인 오퍼레이터 스킬 / 재능 / 잠재 효과 수집
    opData.skill?.forEach((s, i) => {
        const skName = Array.isArray(s.skillType) ? s.skillType.join('/') : `스킬${i + 1}`;
        addEffect([s], `${opData.name} ${skName}`, 1.0, false, true, forceMaxStack, opData);
    });

    opData.talents?.forEach((t, i) => {
        if (!t || t.length === 0) return;
        addEffect(mergeEffects(t), `${opData.name} 재능${i + 1}`, 1.0, false, false, forceMaxStack, opData, `${opData.id}_talent${i}`);
    });

    const mainPot = Number(state.mainOp.pot) || 0;
    for (let p = 0; p < mainPot; p++) {
        const pot = opData.potential?.[p];
        if (!pot || pot.length === 0) continue;
        addEffect(mergeEffects(pot), `${opData.name} 잠재${p + 1}`, 1.0, false, false, forceMaxStack, opData, `${opData.id}_pot${p}`);
    }

    // 4. 서브 오퍼레이터 스킬 / 재능 / 잠재 시너지 수집
    state.subOps.forEach((sub) => {
        if (!sub.id) return;
        const subOpData = DATA_OPERATORS.find(o => o.id === sub.id);
        if (!subOpData) return;
        const prefix = subOpData.name;

        subOpData.skill?.forEach((s, i) => {
            const skName = Array.isArray(s.skillType) ? s.skillType.join('/') : `스킬${i + 1}`;
            addEffect([s], `${prefix} ${skName}`, 1.0, true, true, forceMaxStack, subOpData);
        });

        subOpData.talents?.forEach((t, ti) => {
            if (!t || t.length === 0) return;
            addEffect(mergeEffects(t), `${prefix} 재능${ti + 1}`, 1.0, true, false, forceMaxStack, subOpData, `${subOpData.id}_talent${ti}`);
        });

        const subPot = Number(sub.pot) || 0;
        for (let sp = 0; sp < subPot; sp++) {
            const pot = subOpData.potential?.[sp];
            if (!pot || pot.length === 0) continue;
            addEffect(mergeEffects(pot), `${prefix} 잠재${sp + 1}`, 1.0, true, false, forceMaxStack, subOpData, `${subOpData.id}_pot${sp}`);
        }
    });

    // 5. 세트 효과 수집
    const opsForSet = [
        { opData, setId: getActiveSetID(state.mainOp.gears), name: opData.name },
        ...state.subOps.map((sub, idx) => {
            const sData = DATA_OPERATORS.find(o => o.id === sub.id);
            return { opData: sData, setId: sub.equipSet, name: sData ? sData.name : `서브${idx + 1}` };
        }),
    ];

    state.activeSetId = opsForSet[0].setId;

    opsForSet.forEach((entry, idx) => {
        if (!entry.setId || !entry.opData) return;
        const isSelf = (idx === 0);
        const setEffects = getSetEffects(entry.setId, entry.opData, isSelf);
        const setName = DATA_SETS.find(s => s.id === entry.setId)?.name || entry.setId;

        setEffects.forEach(eff => {
            if (eff.nonStack) {
                const key = `${entry.setId}_${eff.type}`;
                if (activeNonStackTypes.has(key)) return;
                activeNonStackTypes.add(key);
            }
            if (idx > 0 && !isSubOpTargetValid(eff)) return;
            allEffects.push({
                ...eff,
                name: `${entry.name} ${setName} 세트효과`,
                uid: `set_${entry.setId}_${eff.type}_${idx}`,
                _opData: entry.opData,
            });
        });
    });
}

// ============================================================
// 스탯 적용
// ============================================================

/**
 * 절댓값 스탯(타입 '스탯') 효과를 stats에 합산한다.
 * @param {Array} effects - activeEffects
 * @param {object} stats
 */
function applyFixedStats(effects, stats) {
    effects.forEach(eff => {
        if (eff.type !== '스탯') return;
        const val = parseFloat(eff.val || 0) * (eff.forgeMult || 1.0);
        const target = eff.stat || eff.stats;
        if (target === '모든 능력치') {
            ['str', 'agi', 'int', 'wil'].forEach(k => stats[k] += val);
        } else {
            const key = resolveStatKey(target, stats);
            if (stats[key] !== undefined) stats[key] += val;
        }
    });
}

/**
 * 퍼센트 스탯(타입 '스탯%') 효과를 stats에 복리로 적용한다.
 * @param {Array} effects - activeEffects
 * @param {object} stats
 */
function applyPercentStats(effects, stats) {
    const statPct = { str: 0, agi: 0, int: 0, wil: 0 };
    effects.forEach(eff => {
        if (eff.type !== '스탯%') return;
        const val = parseFloat(eff.val || 0) * (eff.forgeMult || 1.0);
        const target = eff.stat || eff.stats;
        if (target === '모든 능력치') {
            ['str', 'agi', 'int', 'wil'].forEach(k => statPct[k] += val);
        } else {
            const key = resolveStatKey(target, statPct);
            if (statPct[key] !== undefined) statPct[key] += val;
        }
    });
    ['str', 'agi', 'int', 'wil'].forEach(k => {
        if (statPct[k] > 0) stats[k] *= (1 + statPct[k] / 100);
    });
}

// ============================================================
// 최종 데미지 산출
// ============================================================

/**
 * 수집된 효과를 바탕으로 최종 데미지와 상세 스탯/로그를 산출한다.
 *
 * 최종 데미지 공식:
 *   finalAtk × critExp × (1+dmgInc) × (1+amp) × (1+takenDmg) × (1+vuln)
 *   × multiHit × (1+unbal) × resMult × defMult
 *   resMult = 1 − resistance/100
 *   defMult  = 1 / (0.01 × defense + 1)
 *
 * @param {object} state
 * @param {object} opData
 * @param {object} wepData
 * @param {object} stats
 * @param {Array} allEffects
 * @param {Array} activeEffects
 * @returns {object}
 */
function computeFinalDamageOutput(state, opData, wepData, stats, allEffects, activeEffects) {
    const baseAtk = opData.baseAtk + wepData.baseAtk;

    // 누산 변수 초기화
    let atkInc = 0, critRate = 5, critDmg = 50, dmgInc = 0, amp = 0;
    let vuln = 0, takenDmg = 0, multiHit = 1.0, originiumArts = 0;
    let ultRecharge = 0, ultCostReduction = 0, resIgnore = 0;

    const dmgIncMap = { all: 0, skill: 0, normal: 0, battle: 0, combo: 0, ult: 0, phys: 0, heat: 0, elec: 0, cryo: 0, nature: 0 };
    const vulnMap = { '물리 취약': 0, '아츠 취약': 0, '열기 취약': 0, '전기 취약': 0, '냉기 취약': 0, '자연 취약': 0, '취약': 0 };
    const skillMults = { all: { mult: 0, add: 0 } };
    const skillCritData = { rate: { all: 0 }, dmg: { all: 0 } };
    const skillAtkIncData = { all: 0 };
    const vulnAmpEffects = [];

    const logs = {
        atk: [], atkBuffs: [], dmgInc: [], amp: [], vuln: [],
        taken: [], unbal: [], multihit: [], crit: [], arts: [], res: [], ultRecharge: [],
    };

    // 저항 초기화 (속성별, 값이 낮을수록 받는 피해 증가)
    const ALL_RES_KEYS = ['물리', '열기', '전기', '냉기', '자연'];
    const baseRes = state.enemyResistance || 0;
    const resistance = Object.fromEntries(ALL_RES_KEYS.map(k => [k, baseRes]));

    // ---- 디버프 직접 적용 ----

    // 갑옷 파괴: 물리 받는 피해 증가
    const abStacks = state.debuffState.physDebuff?.armorBreak || 0;
    const abVal = ARMOR_BREAK_BONUS[abStacks];
    const abDisabled = state.disabledEffects.includes('debuff_armorBreak');
    if (abVal > 0 && opData.type === 'phys') {
        if (!abDisabled) takenDmg += abVal;
        logs.taken.push({ txt: `[갑옷 파괴 ${abStacks}단계] 받는 물리 피해 +${abVal}%`, uid: 'debuff_armorBreak' });
    }

    // 부식: 모든 저항 감소
    const busikStacks = state.debuffState.artsAbnormal['부식'] || 0;
    const busikVal = DEBUFF_STACKS_BONUS[busikStacks];
    const busikDisabled = state.disabledEffects.includes('debuff_busik');
    if (busikVal > 0) {
        if (!busikDisabled) ALL_RES_KEYS.forEach(k => resistance[k] -= busikVal);
        logs.res.push({ txt: `[부식 ${busikStacks}단계] 모든 저항 -${busikVal}`, uid: 'debuff_busik' });
    }

    // 감전: 받는 아츠 피해 증가 (로그만 사전 등록, 수치 반영은 forEach 이후)
    const gamsunStacks = state.debuffState.artsAbnormal['감전'] || 0;
    const gamsunVal = DEBUFF_STACKS_BONUS[gamsunStacks];

    // ---- 효과 순회 ----
    const statLogs = [];

    allEffects.forEach(eff => {
        const displayName = getDisplayName(eff.name);
        const valDisplay = formatValDisplay(eff.val !== undefined ? eff.val : eff.dmg);
        const t = (eff.type || '').toString();
        const stackSuffix = eff.stack ? ` (${eff._stackCount}중첩)` : '';

        // 이 효과가 비활성화/카테고리 비활성화 상태인지 확인하는 클로저
        const checkDisabled = (cat) => {
            if (state.disabledEffects.includes(eff.uid) || !!eff._triggerFailed) return true;
            if (cat && state.disabledEffects.includes(`${eff.uid}#${cat}`)) return true;
            if (state.calculationTag && state.disabledEffects.includes(`${eff.uid}#${state.calculationTag}`)) return true;
            return false;
        };

        // 반복되는 로그 항목 생성을 위한 클로저
        const pushLog = (cat, label = t, extra = {}) => logs[cat].push({
            txt: `[${displayName}] ${valDisplay}${stackSuffix} (${label})`,
            uid: eff.uid, stack: eff.stack, stackCount: eff._stackCount,
            _triggerFailed: eff._triggerFailed, ...extra,
        });

        // 스탯 로그 (별도 배열에 수집 후 logs.atk에 삽입)
        if (t === '스탯' || t === '스탯%') {
            const tgt = getStatName(eff.stat || eff.stats);
            statLogs.push({
                txt: `[${displayName}] ${valDisplay}${stackSuffix} (${tgt})`,
                uid: eff.uid, stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed,
            });
            return;
        }

        // 저항 감소
        if (t === '저항 감소') {
            const resKey = getOpResKey(opData);
            if (resKey) {
                logs.res.push({ txt: `[${displayName}] ${resKey} 저항 ${valDisplay}`, uid: eff.uid, _triggerFailed: eff._triggerFailed });
                if (!checkDisabled()) resistance[resKey] += (parseFloat(eff.val) || 0) * (eff.forgeMult || 1.0);
            }
            return;
        }

        if (!isApplicableEffect(opData, eff.type, eff.name)) return;

        const val = resolveVal(eff.val, stats) * (eff.forgeMult || 1.0);

        if (t === '공격력 증가') {
            if (!checkDisabled('common')) atkInc += val;
            pushLog('atkBuffs');

        } else if (t === '오리지늄 아츠 강도') {
            if (!checkDisabled('common')) originiumArts += val;
            pushLog('arts');

        } else if (t === '궁극기 충전 효율') {
            if (!checkDisabled('common')) ultRecharge += val;
            pushLog('ultRecharge', t, { tag: 'recharge' });

        } else if (t === '궁극기 에너지 감소') {
            if (!checkDisabled('common')) ultCostReduction += val;
            pushLog('ultRecharge', t, { tag: 'reduction' });

        } else if (t === '치명타 확률' || t === '스킬 치명타 확률') {
            const targetObj = t === '스킬 치명타 확률' ? skillCritData.rate : null;
            if (eff.skillType) {
                eff.skillType.forEach(st => {
                    const cat = SKILL_TYPE_MAP[st] || 'common';
                    if (!checkDisabled(cat)) {
                        const obj = targetObj || skillCritData.rate;
                        obj[st] = (obj[st] || 0) + val;
                    }
                });
                pushLog('crit', `${t} (${eff.skillType.join(', ')})`, { tag: 'skillCrit', skillType: eff.skillType });
            } else {
                if (!checkDisabled('common')) critRate += val;
                pushLog('crit');
            }

        } else if (t === '치명타 피해' || t === '스킬 치명타 피해') {
            const targetObj = t === '스킬 치명타 피해' ? skillCritData.dmg : null;
            if (eff.skillType) {
                eff.skillType.forEach(st => {
                    const cat = SKILL_TYPE_MAP[st] || 'common';
                    if (!checkDisabled(cat)) {
                        const obj = targetObj || skillCritData.dmg;
                        obj[st] = (obj[st] || 0) + val;
                    }
                });
                pushLog('crit', `${t} (${eff.skillType.join(', ')})`, { tag: 'skillCrit', skillType: eff.skillType });
            } else {
                if (!checkDisabled('common')) critDmg += val;
                pushLog('crit');
            }

        } else if (t === '연타') {
            if (!checkDisabled('common')) multiHit = Math.max(multiHit, val || 1);
            logs.multihit.push({ txt: `[${displayName}] x${val || 1}${stackSuffix}`, uid: eff.uid, stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });

        } else if (t === '취약 증폭' || t === '냉기 취약 증폭') {
            vulnAmpEffects.push(eff);
            const ampFactor = (1 + val).toFixed(1);
            const targetLabel = (eff.targetEffect && Array.isArray(eff.targetEffect))
                ? eff.targetEffect.join(', ')
                : (t === '냉기 취약 증폭' ? '냉기 취약' : '취약');
            logs.vuln.push({ txt: `[${displayName}] *${ampFactor} (${targetLabel})`, uid: eff.uid, target: '적', _triggerFailed: eff._triggerFailed });

        } else if (t.endsWith('증폭')) {
            if (!checkDisabled('common')) amp += val;
            pushLog('amp');

        } else if (t.endsWith('취약')) {
            if (!checkDisabled('common')) {
                vuln += val;
                if (vulnMap[t] !== undefined) vulnMap[t] += val;
                else vulnMap['취약'] += val;
            }
            pushLog('vuln');

        } else if (t === '불균형 목표에 주는 피해') {
            if (state.enemyUnbalanced && !checkDisabled('common')) { dmgInc += val; dmgIncMap.all += val; }
            logs.dmgInc.push({ txt: `[${displayName}] ${valDisplay}${stackSuffix} (불균형 목표에 주는 피해)`, uid: eff.uid, unbalancedOff: !state.enemyUnbalanced, tag: 'all', stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });

        } else if (t.includes('받는')) {
            if (!checkDisabled('common')) takenDmg += val;
            pushLog('taken');

        } else if (t === '스킬 배율 증가') {
            const addVal = eff.dmg ? resolveVal(eff.dmg, stats) * (eff.forgeMult || 1.0) : 0;
            const addSkillMult = (st) => {
                const cat = SKILL_TYPE_MAP[st] || 'common';
                if (!checkDisabled(cat)) {
                    if (!skillMults[st]) skillMults[st] = { mult: 0, add: 0 };
                    else if (typeof skillMults[st] === 'number') skillMults[st] = { mult: skillMults[st], add: 0 };
                    skillMults[st].mult += val;
                    skillMults[st].add += addVal;
                }
            };
            (eff.skillType ? eff.skillType : ['all']).forEach(addSkillMult);

            const nVal = parseFloat(eff.val !== undefined ? eff.val : (eff.dmg !== undefined ? eff.dmg : 0)) || 0;
            const multDisplay = eff.dmg !== undefined ? `+${nVal}%` : `*${(1 + nVal / 100).toFixed(2)}`;
            const typeLabel = eff.skillType ? `${t} (${eff.skillType.join(', ')})` : t;
            logs.dmgInc.push({ txt: `[${displayName}] ${multDisplay}${stackSuffix} (${typeLabel})`, uid: eff.uid, tag: 'skillMult', skillType: eff.skillType, stack: eff.stack, val: nVal, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });

        } else if (t.endsWith('저항 무시')) {
            if (!checkDisabled('common')) resIgnore += val;
            logs.res.push({ txt: `[${displayName}] ${t} ${val.toFixed(1)}${stackSuffix}`, uid: eff.uid, stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });

        } else if (t.endsWith('피해') || t.includes('피해') || t === '주는 피해' || t === '모든 스킬 피해') {
            // 피해 증가 계열 처리
            let tag = 'all';
            const skillTypes = eff.skillType ? (Array.isArray(eff.skillType) ? eff.skillType : [eff.skillType]) : null;

            if (skillTypes) {
                skillTypes.forEach(st => {
                    const cat = SKILL_TYPE_MAP[st];
                    if (cat && !checkDisabled(cat)) dmgIncMap[cat] += val;
                });
                tag = 'skill';
            } else if (t === '모든 스킬 피해') {
                ['battle', 'combo', 'ult'].forEach(k => { if (!checkDisabled(k)) dmgIncMap[k] += val; });
                tag = 'skill';
            } else if (t.includes('일반 공격')) {
                if (!checkDisabled('normal')) dmgIncMap.normal += val;
                tag = 'normal';
            } else if (t.includes('배틀 스킬')) {
                if (!checkDisabled('battle')) dmgIncMap.battle += val;
                tag = 'battle';
            } else if (t.includes('연계 스킬')) {
                if (!checkDisabled('combo')) dmgIncMap.combo += val;
                tag = 'combo';
            } else if (t.includes('궁극기')) {
                if (!checkDisabled('ult')) dmgIncMap.ult += val;
                tag = 'ult';
            } else {
                // 속성별 피해 증가 확인
                const elMap = { '물리': 'phys', '열기': 'heat', '전기': 'elec', '냉기': 'cryo', '자연': 'nature' };
                let foundEl = null;
                for (const [ek, ev] of Object.entries(elMap)) {
                    if (t.includes(ek)) { foundEl = ev; break; }
                }
                if (foundEl) {
                    if (!checkDisabled('common')) {
                        dmgIncMap[foundEl] += val;
                        const opElKey = opData.type === 'phys' ? 'phys' : opData.element;
                        if (foundEl === opElKey) dmgInc += val;
                    }
                    tag = foundEl;
                } else {
                    if (!checkDisabled('common')) { dmgInc += val; dmgIncMap.all += val; }
                }
            }

            const typeLabel = skillTypes ? `${t} (${skillTypes.join(', ')})` : t;
            logs.dmgInc.push({ txt: `[${displayName}] ${valDisplay}${stackSuffix} (${typeLabel})`, uid: eff.uid, tag, skillType: skillTypes, stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });
        }
    });

    // 감전 디버프 수치 반영 (로그는 여기서 추가)
    const gamsunDisabled = state.disabledEffects.includes('debuff_gamsun');
    if (gamsunVal > 0 && opData.type === 'arts') {
        if (!gamsunDisabled) takenDmg += gamsunVal;
        logs.taken.push({ txt: `[감전 ${gamsunStacks}단계] 받는 아츠 피해 +${gamsunVal}%`, uid: 'debuff_gamsun' });
    }

    // ---- 최종 공격력 계산 ----
    const statBonusPct = (stats[opData.mainStat] * 0.005) + (stats[opData.subStat] * 0.002);
    const finalAtk = baseAtk * (1 + atkInc / 100) * (1 + statBonusPct);

    logs.atk = [
        { txt: `오퍼레이터 공격력: ${opData.baseAtk.toLocaleString()}`, uid: 'base_op_atk' },
        { txt: `무기 공격력: ${wepData.baseAtk.toLocaleString()}`, uid: 'base_wep_atk' },
        { txt: `스탯 공격보너스: +${(statBonusPct * 100).toFixed(2)}%`, uid: 'stat_bonus_atk' },
        ...logs.atkBuffs,
        ...statLogs,
    ];

    // ---- 크리티컬 기댓값 ----
    const finalCritRate = Math.min(Math.max(critRate, 0), 100);
    const critExp = ((finalCritRate / 100) * (critDmg / 100)) + 1;

    // ---- 불균형 보너스 ----
    let finalUnbal = 0;
    if (state.enemyUnbalanced) {
        finalUnbal += 30;
        logs.unbal.push({ txt: `[불균형 기본] +30.0%`, uid: 'unbalance_base' });
    }

    // ---- 저항 및 방어력 배율 계산 ----
    const activeResKey = getOpResKey(opData);
    const activeResVal = (activeResKey ? resistance[activeResKey] : 0) - resIgnore;
    const resMult = 1 - activeResVal / 100;

    const defVal = state.enemyDefense !== undefined ? state.enemyDefense : 100;
    const defMult = 1 / (0.01 * defVal + 1);

    // ---- 최종 데미지 ----
    let finalDmg = finalAtk * critExp * (1 + dmgInc / 100) * (1 + amp / 100) * (1 + takenDmg / 100) * (1 + vuln / 100) * multiHit * (1 + finalUnbal / 100) * resMult * defMult;

    // 검술사 세트 추가 피해
    const swordsman = allEffects.find(e => e.setId === 'set_swordsman' && e.triggered);
    if (swordsman) {
        const extraDmg = finalAtk * 2.5;
        finalDmg += extraDmg;
        logs.dmgInc.push({ txt: `[검술사 추가피해] +${Math.floor(extraDmg).toLocaleString()}`, uid: 'swordsman_extra' });
    }

    // ---- 궁극기 에너지 계산 ----
    const ultSkill = opData.skill?.find(s => s.skillType?.includes('궁극기'));
    const baseUltCost = ultSkill?.cost || 0;
    const finalUltCost = Math.max(0, (baseUltCost * (1 + ultCostReduction / 100)) / (1 + ultRecharge / 100));

    return {
        finalDmg,
        activeEffects,
        stats: {
            finalAtk, atkInc, baseAtk, statBonusPct, skillAtkIncData,
            mainStatName: STAT_NAME_MAP[opData.mainStat], mainStatVal: stats[opData.mainStat],
            subStatName: STAT_NAME_MAP[opData.subStat], subStatVal: stats[opData.subStat],
            str: stats.str, agi: stats.agi, int: stats.int, wil: stats.wil,
            critExp, finalCritRate, critDmg, dmgInc, amp, vuln, takenDmg, unbalanceDmg: finalUnbal,
            originiumArts, skillMults, dmgIncData: dmgIncMap, skillCritData,
            resistance: activeResVal, resMult, defMult, enemyDefense: defVal,
            ultRecharge, finalUltCost, vulnMap, vulnAmpEffects,
            allRes: resistance, armorBreakVal: abVal, gamsunVal,
            baseTakenDmg: (takenDmg - (opData.type === 'phys' ? abVal : (opData.type === 'arts' ? gamsunVal : 0))),
            resIgnore,
        },
        logs,
    };
}

// ============================================================
// 유틸리티
// ============================================================

/**
 * val이 스탯 비례 수식 문자열이면 stats를 참조해 수치를 계산한다.
 * @param {number|string} val
 * @param {object} stats
 * @returns {number}
 */
function resolveVal(val, stats) {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        let statSum = 0;
        let foundStat = false;
        ['str', 'agi', 'int', 'wil'].forEach(k => {
            if (val.includes(STAT_NAME_MAP[k])) { statSum += (stats[k] || 0); foundStat = true; }
        });
        if (foundStat) {
            const match = val.match(/([\d.]+)%/);
            if (match) return statSum * parseFloat(match[1]);
        }
        const num = parseFloat(val);
        return isNaN(num) ? 0 : num;
    }
    return 0;
}

/**
 * 무기 특성 인덱스와 상태(강화 여부, 잠재)에 따라 특성 레벨을 반환한다.
 * @param {number} idx - 특성 인덱스 (0, 1이면 기본/강화, 그 외 잠재 기반)
 * @param {boolean} wepState - 강화 여부
 * @param {number} pot - 잠재 단계
 * @returns {number}
 */
function calculateWeaponTraitLevel(idx, wepState, pot) {
    if (idx === 0 || idx === 1) return wepState ? 9 : 3;
    return (wepState ? 4 : 1) + pot;
}

/**
 * valByLevel 배열에서 해당 레벨의 값을 반환한다.
 * @param {object} trait
 * @param {number} level
 * @returns {*}
 */
function calculateWeaponTraitValue(trait, level) {
    if (trait.valByLevel?.length > 0) {
        return trait.valByLevel[Math.min(level - 1, trait.valByLevel.length - 1)];
    }
    return 0;
}

/**
 * 효과가 서브 오퍼레이터 시너지로 적용 가능한 타겟인지 확인한다.
 * @param {object} effect
 * @returns {boolean}
 */
function isSubOpTargetValid(effect) {
    return effect && (effect.target === '팀' || effect.target === '팀_외' || effect.target === '적');
}

/**
 * 효과 타입이 오퍼레이터의 속성/타입에 적용 가능한지 확인한다.
 * @param {object} opData
 * @param {string} effectType
 * @param {string} effectName
 * @returns {boolean}
 */
function isApplicableEffect(opData, effectType, effectName) {
    if (!effectType) return false;
    const type = effectType.toString();

    const ALWAYS_ON = [
        '공격력 증가', '치명타 확률', '치명타 피해', '최대 생명력', '궁극기 충전 효율', '궁극기 에너지 감소',
        '치유 효율', '연타', '주는 피해', '스탯', '스탯%', '스킬 피해', '궁극기 피해', '연계 스킬 피해',
        '배틀 스킬 피해', '일반 공격 피해', '오리지늄 아츠', '오리지늄 아츠 강도', '모든 스킬 피해',
        '스킬 배율 증가', '스킬 치명타 확률', '스킬 치명타 피해',
    ];
    if (ALWAYS_ON.includes(type) || type === '불균형 목표에 주는 피해') return true;

    const checkElement = (prefix) => {
        const p = prefix ? prefix.trim() : '';
        if (!p || p === '피해' || p === '모든' || p === '취약') return true;
        if (p === '물리' && opData.type === 'phys') return true;
        if (p === '아츠' && opData.type === 'arts') return true;
        if (p === '열기' && opData.element === 'heat') return true;
        if (p === '냉기' && opData.element === 'cryo') return true;
        if (p === '전기' && opData.element === 'elec') return true;
        if (p === '자연' && opData.element === 'nature') return true;
        return false;
    };

    if (type.endsWith('취약 증폭')) return checkElement(type.replace('취약 증폭', ''));
    if (type.endsWith('증폭')) return checkElement(type.replace('증폭', ''));
    if (type.includes('받는') || type.endsWith('취약')) {
        return checkElement(type.replace('받는 ', '').replace(' 피해', '').replace(' 취약', ''));
    }
    if (type.endsWith('저항 무시')) return checkElement(type.replace('저항 무시', ''));
    return checkElement(type.replace(' 피해', ''));
}

// ============================================================
// 세트 효과
// ============================================================

/**
 * 장비 슬롯 목록에서 3개 이상 장착된 세트 ID를 반환한다.
 * @param {Array} gears
 * @returns {string|null}
 */
function getActiveSetID(gears) {
    const counts = {};
    gears.forEach(gId => {
        if (!gId) return;
        const gear = DATA_GEAR.find(g => g.id === gId);
        if (gear?.set) counts[gear.set] = (counts[gear.set] || 0) + 1;
    });
    for (const [setId, count] of Object.entries(counts)) {
        if (count >= 3) return setId;
    }
    return null;
}

/**
 * 세트 효과를 오퍼레이터 조건에 맞게 필터링하여 반환한다.
 * @param {string} setId
 * @param {object} opData
 * @param {boolean} isSelf - 세트를 착용한 주체가 메인 오퍼레이터인지
 * @returns {Array}
 */
function getSetEffects(setId, opData, isSelf = true) {
    const set = DATA_SETS.find(s => s.id === setId);
    if (!set?.effects) return [];

    const skillStr = JSON.stringify(opData.skill);
    const talentStr = JSON.stringify(opData.talents);

    const matchTrigger = (t) => {
        if (t === '아츠 부착') {
            return ['열기 부착', '냉기 부착', '전기 부착', '자연 부착'].some(el => skillStr.includes(el) || talentStr.includes(el));
        }
        return skillStr.includes(t) || talentStr.includes(t);
    };

    return set.effects.filter(eff => {
        if (eff.triggers && !eff.triggers.some(matchTrigger)) return false;
        if (eff.cond === 'phys_only' && opData.type !== 'phys') return false;
        if (eff.cond === 'arts_only' && opData.type !== 'arts') return false;
        if (isSelf && eff.target === '팀_외') return false;
        return true;
    }).map(eff => eff.type === '검술사_추가피해'
        ? { ...eff, setId: 'set_swordsman', triggered: true }
        : { ...eff }
    );
}

/**
 * 오퍼레이터가 사용할 수 있는 무기 목록을 반환한다.
 * @param {string} opId
 * @returns {Array}
 */
function getValidWeapons(opId) {
    const op = DATA_OPERATORS.find(o => o.id === opId);
    return op?.usableWeapons ? DATA_WEAPONS.filter(w => op.usableWeapons.includes(w.type)) : [];
}

/**
 * 세트가 오퍼레이터의 스킬/재능과 호환 가능한지 확인한다.
 * @param {string} setId
 * @param {object} opData
 * @returns {boolean}
 */
function checkSetViability(setId, opData) {
    const set = DATA_SETS.find(s => s.id === setId);
    if (!set?.effects) return false;

    const skillStr = JSON.stringify(opData.skill);
    const talentStr = JSON.stringify(opData.talents);
    const matchTrigger = (t) => {
        if (t === '아츠 부착') {
            return ['열기 부착', '냉기 부착', '전기 부착', '자연 부착'].some(el => skillStr.includes(el) || talentStr.includes(el));
        }
        return skillStr.includes(t) || talentStr.includes(t);
    };

    const cond = set.effects.filter(e => e.triggers);
    return cond.length === 0 || cond.some(eff => eff.triggers.some(matchTrigger));
}

// ============================================================
// 트리거 평가
// ============================================================

/**
 * 효과의 trigger 조건을 현재 state와 opData를 기준으로 평가한다.
 *
 * [확장 방법]
 * - 새 트리거를 추가할 때 아래 TRIGGER_MAP에만 항목을 추가하면 된다.
 * - 키: data_operators.js의 bonus.trigger 값
 * - 값: (currentState) => boolean 평가 함수
 *
 * @param {string|string[]} trigger
 * @param {object} state
 * @param {object} opData
 * @param {string|string[]} triggerType
 * @param {boolean} isTargetOnly
 * @param {string|null} effectTarget
 * @param {boolean} strictMode
 * @returns {boolean}
 */
function evaluateTrigger(trigger, state, opData, triggerType, isTargetOnly = false, effectTarget = null, strictMode = false) {
    if (!trigger || trigger.length === 0) return true;

    const triggers = Array.isArray(trigger) ? trigger : [trigger];
    return triggers.some(t => {
        const specialStackVal = state.getSpecialStack ? state.getSpecialStack() : (state.mainOp?.specialStack || 0);

        // 상태 기반 트리거 맵 (각 항목은 true를 반환하면 트리거 충족)
        const TRIGGER_MAP = {
            '방어 불능': () => getAdjustedStackCount('방어 불능', state, opData, triggerType) > 0,
            '갑옷 파괴': () => getAdjustedStackCount('갑옷 파괴', state, opData, triggerType) > 0,
            '열기 부착': () => state.debuffState?.artsAttach?.type === '열기 부착',
            '냉기 부착': () => state.debuffState?.artsAttach?.type === '냉기 부착',
            '전기 부착': () => state.debuffState?.artsAttach?.type === '전기 부착',
            '자연 부착': () => state.debuffState?.artsAttach?.type === '자연 부착',
            '연소': () => getAdjustedStackCount('연소', state, opData, triggerType) > 0,
            '감전': () => getAdjustedStackCount('감전', state, opData, triggerType) > 0,
            '동결': () => getAdjustedStackCount('동결', state, opData, triggerType) > 0,
            '부식': () => getAdjustedStackCount('부식', state, opData, triggerType) > 0,
            '연타': () => (state.debuffState?.physDebuff?.combo || 0) > 0,
            '띄우기': () => state.triggerActive?.['띄우기'] || state.triggerActive?.['강제 띄우기'],
            '넘어뜨리기': () => state.triggerActive?.['넘어뜨리기'] || state.triggerActive?.['강제 넘어뜨리기'],
            '강타': () => state.triggerActive?.['강타'],
            '허약': () => state.triggerActive?.['허약'],
        };

        if (TRIGGER_MAP[t]?.()) return true;

        // 스페셜 스택 트리거 확인
        const op = opData || DATA_OPERATORS.find(o => o.id === (state.mainOp?.id));
        if (op?.specialStack) {
            const stacks = Array.isArray(op.specialStack) ? op.specialStack : [op.specialStack];
            const matchingStack = stacks.find(s => s.triggers?.includes(t));
            if (matchingStack) {
                const stackId = matchingStack.id || 'default';
                const val = typeof specialStackVal === 'object' ? (specialStackVal[stackId] || 0) : specialStackVal;
                if (val > 0) return true;
                if (strictMode) return false;
            }
        }

        // 오퍼레이터 역량(스킬/재능/잠재) 기반 트리거 확인
        if (opData && !isTargetOnly) {
            const checkOpCapability = (targetOp) => {
                if (!targetOp) return false;
                let skillPool = targetOp.skill || [];
                if (triggerType && (Array.isArray(triggerType) ? triggerType.length > 0 : !!triggerType)) {
                    const triggerTypeArr = Array.isArray(triggerType) ? triggerType : [triggerType];
                    skillPool = skillPool.filter(s => {
                        const skillTypes = Array.isArray(s.skillType) ? s.skillType : [s.skillType];
                        return skillTypes.some(st => triggerTypeArr.includes(st));
                    });
                }

                const checkTypes = [t];
                if (t === '띄우기') checkTypes.push('강제 띄우기');
                if (t === '넘어뜨리기') checkTypes.push('강제 넘어뜨리기');

                const hasInSkill = skillPool.some(s => {
                    if (!s.type) return false;
                    const typeItems = Array.isArray(s.type) ? s.type : [s.type];
                    return typeItems.some(item => {
                        const tName = (typeof item === 'object' && item !== null) ? item.type : item;
                        return Array.isArray(tName) ? tName.some(tn => checkTypes.includes(tn)) : checkTypes.includes(tName);
                    });
                });
                if (hasInSkill) return true;

                if (!triggerType || (Array.isArray(triggerType) ? triggerType.length === 0 : !triggerType)) {
                    const otherPool = [...(targetOp.talents || []).flat(), ...(targetOp.potential || []).flat()];
                    if (otherPool.some(e => e.type && (Array.isArray(e.type) ? e.type.some(et => checkTypes.includes(et)) : checkTypes.includes(e.type)))) return true;
                    if (t === targetOp.type || t === targetOp.element) return true;
                }
                return false;
            };

            if (checkOpCapability(opData)) return true;
            if (effectTarget === '팀') {
                const mainOpData = DATA_OPERATORS.find(o => o.id === (state.mainOp?.id));
                if (mainOpData && mainOpData.id !== opData.id && checkOpCapability(mainOpData)) return true;
            }
        }

        if (t === '상시' || t === '팀_상시' || t.startsWith('메인_')) return true;

        if (state.mainOp?.skill) {
            if (t === '배틀 스킬 중' && state.mainOp.skill === '배틀 스킬') return true;
            if ((t === '연계 스킬 중' || t === '팀_연계 스킬 방출') && state.mainOp.skill === '연계 스킬') return true;
            if ((t === '궁극기 중' || t === '궁극기 방출') && state.mainOp.skill === '궁극기') return true;
        }

        return !!(state.triggerActive?.[t]);
    });
}

// ============================================================
// 단일 스킬 데미지 계산
// ============================================================

/**
 * 특정 스킬 타입에 대한 1회 데미지를 계산한다.
 * baseRes(computeFinalDamageOutput 결과)를 활용하여 스킬 전용 보정을 추가로 적용한다.
 * @param {string} type - 스킬 타입 ('일반 공격', '배틀 스킬' 등)
 * @param {object} st - 현재 state
 * @param {object} bRes - calculateDamage 결과 (기본 공통 버프 포함)
 * @returns {object|null}
 */
function calcSingleSkillDamage(type, st, bRes) {
    const opData = DATA_OPERATORS.find(o => o.id === st.mainOp.id);
    const skillMap = {};
    opData.skill.forEach(s => {
        s?.skillType?.forEach(st => skillMap[st] = s);
    });

    const skillDef = skillMap[type];
    if (!skillDef) return null;

    const {
        finalAtk, atkInc, baseAtk, statBonusPct,
        skillAtkIncData = { all: 0 }, critExp, finalCritRate, critDmg,
        amp, takenDmg, vuln, unbalanceDmg, resMult, defMult = 1,
        originiumArts = 0, skillMults = { all: { mult: 0, add: 0 } },
        dmgIncData = { all: 0, skill: 0, normal: 0, battle: 0, combo: 0, ult: 0 },
        skillCritData = { rate: { all: 0 }, dmg: { all: 0 } },
        vulnMap = {}, vulnAmpEffects = [],
    } = bRes.stats;

    // 스킬 기본 배율 파싱
    let dmgMult = parseDmgPct(skillDef.dmg);

    const bonusList = [];

    // 스킬 bonus 조건 평가 및 배율 누산
    if (skillDef.bonus) {
        skillDef.bonus.forEach(b => {
            if (!evaluateTrigger(b.trigger, st, opData, b.triggerType, false, b.target, true)) return;

            if (b.base !== undefined || b.perStack !== undefined) {
                const triggers = Array.isArray(b.trigger) ? b.trigger : [b.trigger];
                const stackCount = triggers.reduce((acc, t) => Math.max(acc, getAdjustedStackCount(t, st, opData, skillDef.skillType)), 0);
                const bonusVal = (parseFloat(b.base ?? b.val ?? 0) + parseFloat(b.perStack || 0) * stackCount) / 100;
                if (bonusVal > 0) {
                    dmgMult += bonusVal;
                    bonusList.push({ name: triggers.join(', '), val: bonusVal, stack: stackCount });
                }
            } else if (b.val) {
                const bonusVal = parseFloat(String(b.val)) / 100;
                dmgMult += bonusVal;
                bonusList.push({ name: Array.isArray(b.trigger) ? b.trigger.join(', ') : b.trigger, val: bonusVal });
            }
        });
    }

    // ---- 물리 이상 / 아츠 이상 처리 ----
    const abnormalList = [];
    const defenselessStacks = st.debuffState?.physDebuff?.defenseless || 0;
    const hasDefenseless = defenselessStacks > 0;
    let abnormalMultTotal = 0;

    const skillTypes = skillDef.type ? (Array.isArray(skillDef.type) ? skillDef.type : [skillDef.type]) : [];
    skillTypes.forEach(typeItem => {
        if (!typeItem) return;
        const typeName = typeof typeItem === 'string' ? typeItem : typeItem.type;

        // 물리 이상 배율 계산
        let physMult = 0;
        if (typeName === '강타' && hasDefenseless) physMult = 1.5 + (defenselessStacks * 1.5);
        else if ((typeName === '띄우기' || typeName === '넘어뜨리기') && hasDefenseless) physMult = 1.2;
        else if ((typeName === '강제 띄우기' || typeName === '강제 넘어뜨리기')) physMult = 1.2;
        else if (typeName === '갑옷 파괴' && hasDefenseless) physMult = 0.5 + (defenselessStacks * 0.5);

        if (physMult > 0) {
            abnormalList.push({ name: typeName, mult: physMult, triggerName: '방어 불능', stackCount: defenselessStacks });
            abnormalMultTotal += physMult;
        }

        // 아츠 이상 / 아츠 폭발 처리
        const artsAttach = st.debuffState?.artsAttach || { type: null, stacks: 0 };
        const currentAttachType = artsAttach.type;
        const currentStacks = artsAttach.stacks || 0;
        const ELEMENT_TO_ANOMALY = { '열기': '연소', '냉기': '동결', '전기': '감전', '자연': '부식' };

        let nextAttachType = null;
        let isForcedAbnormal = false;
        if (typeName.includes('부착')) {
            nextAttachType = typeName;
        } else if (typeName.includes('부여')) {
            nextAttachType = typeName.replace(' 부여', '') + ' 부착';
            isForcedAbnormal = true;
        }

        if (nextAttachType) {
            const nextBase = nextAttachType.replace(' 부착', '');
            const currentBase = currentAttachType ? currentAttachType.replace(' 부착', '') : null;
            let artsMult = 0, artsName = '', shouldTrigger = false;

            if (currentAttachType && currentBase === nextBase) {
                artsName = currentBase + ' 폭발';
                artsMult = isForcedAbnormal ? 0 : 1.6;
                shouldTrigger = true;
            } else if (currentAttachType || isForcedAbnormal) {
                const targetAnomaly = ELEMENT_TO_ANOMALY[nextBase] || nextBase;
                artsName = targetAnomaly + '(이상)';
                shouldTrigger = true;
                const S = currentStacks;
                if (targetAnomaly === '연소') {
                    artsMult = (isForcedAbnormal ? 0 : (0.8 + S * 0.8)) + (isForcedAbnormal ? 1.2 : (1.2 + S * 1.2));
                } else if (!isForcedAbnormal) {
                    if (targetAnomaly === '감전') artsMult = 0.8 + S * 0.8;
                    else if (targetAnomaly === '동결') artsMult = 1.3;
                    else if (targetAnomaly === '부식') artsMult = 0.8 + S * 0.8;
                }
            }

            if (shouldTrigger) {
                abnormalList.push({ name: artsName, mult: artsMult, triggerName: currentAttachType || '없음', stackCount: currentStacks, isArts: true, originalType: typeName });
                abnormalMultTotal += artsMult;
            }
        }
    });

    // 이상 데미지 설명 문자열 생성
    const artsStrengthMult = 1 + (originiumArts / 100);
    let abnormalDesc = '';
    if (abnormalList.length > 0) {
        abnormalDesc = ' (' + abnormalList.map(a => `${a.name} +${(a.mult * artsStrengthMult * 100).toFixed(0)}%`).join(', ') + ')';
    }

    // ---- 스킬 배율 최종 보정 ----
    const baseType = type.startsWith('강화 ') ? type.substring(3) : type;
    let sMult = 0, sAdd = 0;
    if (skillMults) {
        const addObj = (obj) => {
            if (typeof obj === 'number') sMult += obj;
            else if (obj) { sMult += (obj.mult || 0); sAdd += (obj.add || 0); }
        };
        addObj(skillMults.all);
        addObj(skillMults[baseType]);
        if (type !== baseType) addObj(skillMults[type]);
    }

    let adjDmgMult = SKILL_MULT_TYPES.has(baseType)
        ? (dmgMult + sAdd / 100) * (1 + sMult / 100)
        : dmgMult;
    adjDmgMult += abnormalMultTotal;

    // ---- 피해 증가 합산 ----
    let typeInc = dmgIncData.all;
    if (baseType === '일반 공격') typeInc += dmgIncData.normal;
    else typeInc += dmgIncData.skill + (dmgIncData[SKILL_TYPE_MAP[baseType]] || 0);

    const skillElement = skillDef.element || (opData.type === 'phys' ? 'phys' : opData.element);
    if (skillElement && dmgIncData[skillElement]) typeInc += dmgIncData[skillElement];

    // ---- 스킬 전용 크리티컬 보정 ----
    const sCritRateBoost = (skillCritData.rate.all || 0) + (skillCritData.rate[baseType] || 0) + (type !== baseType ? (skillCritData.rate[type] || 0) : 0);
    const sCritDmgBoost = (skillCritData.dmg.all || 0) + (skillCritData.dmg[baseType] || 0) + (type !== baseType ? (skillCritData.dmg[type] || 0) : 0);
    const adjCritRate = Math.min(Math.max(finalCritRate + sCritRateBoost, 0), 100);
    const adjCritDmg = critDmg + sCritDmgBoost;
    const adjCritExp = ((adjCritRate / 100) * (adjCritDmg / 100)) + 1;

    // ---- 스킬 전용 공격력 보정 ----
    const sAtkIncBoost = (skillAtkIncData.all || 0) + (skillAtkIncData[baseType] || 0) + (type !== baseType ? (skillAtkIncData[type] || 0) : 0);
    const adjFinalAtk = sAtkIncBoost > 0
        ? baseAtk * (1 + (atkInc + sAtkIncBoost) / 100) * (1 + statBonusPct)
        : finalAtk;

    const baseMultOnly = adjDmgMult - abnormalMultTotal;

    // 취약 증폭 적용
    let finalVuln = vuln;
    vulnAmpEffects.forEach(eff => {
        const isTypeMatch = !eff.skillType || eff.skillType.includes(baseType);
        if (isTypeMatch && !st.disabledEffects.includes(eff.uid)) {
            const targets = eff.targetEffect || (eff.type.includes('냉기 취약 증폭') ? ['냉기 취약'] : ['취약']);
            targets.forEach(tKey => {
                const vVal = vulnMap[tKey] || 0;
                if (vVal > 0) {
                    const ampVal = vVal * (resolveVal(eff.val) * (eff.forgeMult || 1.0));
                    finalVuln += ampVal;
                    bonusList.push({ name: (eff.type === '취약 증폭' ? '취약 증폭' : '냉기 취약 증폭') + ` (${tKey})`, val: ampVal / 100 });
                }
            });
        }
    });

    const commonMults = adjCritExp * (1 + typeInc / 100) * (1 + amp / 100) * (1 + takenDmg / 100) * (1 + finalVuln / 100) * (1 + unbalanceDmg / 100) * resMult * defMult;
    const baseHitDmg = adjFinalAtk * baseMultOnly * commonMults;

    // ---- 이상 데미지 계산 ----
    const abnormalDmgMap = {};
    abnormalList.forEach(a => {
        const aData = DATA_ABNORMALS[a.name] || DATA_ABNORMALS[a.name.replace('(이상)', '')];
        let aResMult = resMult, aVuln = vuln, aTaken = takenDmg, aInc = dmgIncData.all;

        if (aData) {
            const aElem = aData.element;
            const activeResKey = aElem === 'phys' ? '물리' : (ELEMENT_RES_KEY_MAP[aElem] || null);
            if (activeResKey && bRes.stats.allRes) {
                aResMult = 1 - (bRes.stats.allRes[activeResKey] - (bRes.stats.resIgnore || 0)) / 100;
            }
            const eKey = aElem === 'phys' ? '물리' : (ELEMENT_RES_KEY_MAP[aElem] || null);
            if (eKey) {
                aVuln = (bRes.stats.vulnMap['취약'] || 0) + (bRes.stats.vulnMap[eKey + ' 취약'] || 0);
                aTaken = (bRes.stats.baseTakenDmg || 0) + (aElem !== 'phys' ? bRes.stats.gamsunVal : bRes.stats.armorBreakVal);
                aInc = (bRes.stats.dmgIncData.all || 0) + (bRes.stats.dmgIncData[aElem] || 0);
            }
        }

        const aCommonMults = adjCritExp * (1 + aInc / 100) * (1 + amp / 100) * (1 + aTaken / 100) * (1 + aVuln / 100) * (1 + unbalanceDmg / 100) * aResMult * defMult * artsStrengthMult;
        let aDmg = adjFinalAtk * a.mult * aCommonMults;
        if (st.mainOp.id === 'Da Pan' && a.name === '강타') aDmg *= 1.2;
        abnormalDmgMap[a.name] = Math.floor(aDmg);
    });

    // ---- 로그 필터링 ----
    const myLogs = JSON.parse(JSON.stringify(bRes.logs));

    myLogs.dmgInc = (bRes.logs.dmgInc || []).filter(l => {
        if (l.tag === 'all') return false;
        if (l.tag === 'skillMult') {
            const arr = l.skillType || [];
            return arr.length === 0 ? SKILL_MULT_TYPES.has(baseType) : (arr.includes(baseType) || arr.includes(type));
        }
        if (baseType === '일반 공격' && l.tag === 'normal') return true;
        if (baseType !== '일반 공격' && (l.tag === 'skill' || l.tag === SKILL_TYPE_MAP[baseType])) return true;
        return false;
    });

    myLogs.atk = (bRes.logs.atk || []).filter(l => {
        if (['base_op_atk', 'base_wep_atk', 'stat_bonus_atk'].includes(l.uid)) return true;
        if (l.tag === 'skillAtk') {
            const arr = l.skillType || [];
            return arr.length === 0 || arr.includes(baseType) || arr.includes(type);
        }
        return true;
    });

    // 연타(Combo) 곱연산 버프
    const comboStacks = st.debuffState?.physDebuff?.combo || 0;
    let comboMult = 1;
    if (comboStacks > 0) {
        if (baseType === '배틀 스킬') comboMult = 1 + ([0, 30, 45, 60, 75][comboStacks] / 100);
        else if (baseType === '궁극기') comboMult = 1 + ([0, 20, 30, 40, 50][comboStacks] / 100);
    }
    if (comboMult > 1) {
        myLogs.dmgInc.push({ txt: `[연타 ${comboStacks}단계] x${comboMult.toFixed(2)} (곱연산)`, uid: 'combo_buff', tag: SKILL_TYPE_MAP[baseType] });
    }

    if (st.mainOp.id === 'Da Pan' && abnormalDmgMap['강타'] !== undefined) {
        myLogs.dmgInc.push({ txt: `[판 고유 특성] 강타 피해 x1.20 (곱연산)`, uid: 'fan_smash_bonus', tag: SKILL_TYPE_MAP[baseType] });
    }

    if (originiumArts > 0 && abnormalList.length > 0) {
        myLogs.arts.push({ txt: `오리지늄 아츠 강도: +${originiumArts.toFixed(1)}% (이상 데미지에 적용)`, uid: 'skill_arts_strength', tag: SKILL_TYPE_MAP[baseType] });
    }

    // 취약 증폭 로그 추가
    vulnAmpEffects.forEach(eff => {
        const isTypeMatch = !eff.skillType || eff.skillType.includes(baseType);
        if (isTypeMatch && !st.disabledEffects.includes(eff.uid)) {
            const targets = eff.targetEffect || (eff.type.includes('냉기 취약 증폭') ? ['냉기 취약'] : ['취약']);
            targets.forEach(tKey => {
                const vVal = vulnMap[tKey] || 0;
                if (vVal > 0) {
                    const ampFactor = (1 + (resolveVal(eff.val, bRes.stats) * (eff.forgeMult || 1.0))).toFixed(1);
                    myLogs.vuln.push({ txt: `[${getDisplayName(eff.name)}] *${ampFactor} (${tKey})`, uid: eff.uid });
                }
            });
        }
    });

    // 스킬 전용 크리티컬 / 공격력 로그 필터링
    myLogs.crit.push(...(bRes.logs.crit || []).filter(l => {
        if (l.tag !== 'skillCrit') return false;
        const arr = l.skillType || [];
        return arr.length === 0 || arr.includes(baseType) || arr.includes(type);
    }));
    myLogs.atk.push(...(bRes.logs.atkBuffs || []).filter(l => {
        if (l.tag !== 'skillAtk') return false;
        const arr = l.skillType || [];
        return arr.length === 0 || arr.includes(baseType) || arr.includes(type);
    }));

    const finalSingleHitDmg = Math.floor(baseHitDmg * comboMult) + Object.values(abnormalDmgMap).reduce((acc, v) => acc + v, 0);

    return {
        unitDmg: finalSingleHitDmg,
        baseUnitDmg: Math.floor(baseHitDmg * comboMult),
        abnormalDmgs: abnormalDmgMap,
        logs: myLogs,
        dmgRate: (adjDmgMult * 100).toFixed(0) + '%' + abnormalDesc,
        desc: skillDef.desc,
        rawRate: adjDmgMult,
        baseRate: dmgMult - bonusList.reduce((acc, b) => acc + b.val, 0),
        bonusList,
        abnormalList,
        abnormalInfo: abnormalList.length > 0 ? abnormalList : undefined,
        activeEffects: bRes.activeEffects,
    };
}

// ============================================================
// 사이클 데미지 계산
// ============================================================

/**
 * skillSequence 순서대로 각 스킬을 호출하여 사이클 총 데미지를 계산한다.
 * 이상 데미지 / Proc 효과도 합산한다.
 * @param {object} currentState
 * @param {object} baseRes - calculateDamage 기본 결과
 * @param {boolean} forceMaxStack
 * @returns {object|null}
 */
function calculateCycleDamage(currentState, baseRes, forceMaxStack = false) {
    if (!baseRes?.stats || !currentState.mainOp?.id) return null;

    const opData = DATA_OPERATORS.find(o => o.id === currentState.mainOp.id);
    const skillMap = {};
    opData?.skill?.forEach(s => {
        s?.skillType?.forEach(st => skillMap[st] = s);
    });

    const perSkill = {};
    const perAbnormal = {};

    // ---- Proc 효과(발동형 추가 피해) 수집 ----
    const procEffects = [];

    // 재능 / 잠재 Proc
    opData.talents?.forEach((tArr, i) => {
        tArr.forEach(eff => { if (eff.dmg && eff.trigger) procEffects.push({ ...eff, label: `재능${i + 1}` }); });
    });
    for (let p = 0; p < (Number(currentState.mainOp.pot) || 0); p++) {
        opData.potential?.[p]?.forEach(eff => { if (eff.dmg && eff.trigger) procEffects.push({ ...eff, label: `잠재${p + 1}` }); });
    }

    // 무기 특성 Proc
    const wepData = DATA_WEAPONS.find(w => w.id === currentState.mainOp.wepId);
    if (wepData) {
        wepData.traits?.forEach(trait => {
            const dmgValue = trait.dmg || (trait.valByLevel ? trait.valByLevel[Math.max(0, (Number(currentState.mainOp.wepRefine) || 1) - 1)] : null);
            const hasDmgType = Array.isArray(trait.type) ? trait.type.some(t => t.includes('데미지')) : trait.type?.includes('데미지');
            if (dmgValue && trait.trigger && hasDmgType) procEffects.push({ ...trait, dmg: dmgValue, label: `무기:${wepData.name}` });
        });
    }

    // 세트 효과 Proc
    if (currentState.activeSetId) {
        DATA_SETS.find(s => s.id === currentState.activeSetId)?.effects?.forEach(eff => {
            const dmgValue = Array.isArray(eff.dmg) ? eff.dmg[0] : eff.dmg;
            const hasDmgType = Array.isArray(eff.type) ? eff.type.some(t => t.includes('데미지')) : eff.type?.includes('데미지');
            if (dmgValue && eff.trigger && hasDmgType) procEffects.push({ ...eff, dmg: dmgValue, label: `세트:${DATA_SETS.find(s => s.id === currentState.activeSetId)?.name}` });
        });
    }

    // ---- 각 스킬 타입별 기본 데미지 계산 ----
    Object.keys(skillMap).forEach(type => {
        perSkill[type] = { dmg: 0, count: 0, unitDmg: 0, logs: [], dmgRate: '0%', desc: '' };
        const skillDef = skillMap[type];
        if (!skillDef) return;

        const calculationTag = SKILL_TYPE_MAP[type] || 'common';
        const specificRes = calculateDamage({
            ...currentState,
            calculationTag,
            ...(skillDef.element ? { overrideSkillElement: skillDef.element } : {}),
        }, forceMaxStack);

        const res = calcSingleSkillDamage(type, currentState, specificRes);
        if (res) Object.assign(perSkill[type], res, { dmg: 0, count: 0 });
    });

    // ---- 시퀀스 순회 ----
    const sequenceResult = [];
    let total = 0;

    (currentState.skillSequence || []).forEach(itemObj => {
        const isObj = typeof itemObj === 'object';
        const type = isObj ? itemObj.type : itemObj;
        const pSkill = perSkill[type];

        if (!pSkill) {
            sequenceResult.push({ type, dmg: 0, dmgRate: '0%', logs: [], desc: '' });
            return;
        }

        // 개별 시퀀스 커스텀 상태 적용
        const customStateMerged = { ...currentState, mainOp: { ...currentState.mainOp } };
        let hasCustomState = false;
        if (isObj && itemObj.customState) {
            hasCustomState = true;
            Object.assign(customStateMerged, {
                disabledEffects: itemObj.customState.disabledEffects,
                effectStacks: itemObj.customState.effectStacks,
                debuffState: itemObj.customState.debuffState,
                enemyUnbalanced: itemObj.customState.enemyUnbalanced,
            });
            customStateMerged.mainOp.specialStack = itemObj.customState.specialStack;
        }

        const skillDef = skillMap[type];
        customStateMerged.calculationTag = SKILL_TYPE_MAP[type] || 'common';
        if (skillDef?.element) customStateMerged.overrideSkillElement = skillDef.element;

        const cRes = calculateDamage(customStateMerged, forceMaxStack);
        let skillData = pSkill;
        if (hasCustomState && cRes) {
            const sRes = calcSingleSkillDamage(type, customStateMerged, cRes);
            if (sRes) skillData = { ...sRes };
        }

        let skillTotal = skillData.unitDmg || 0;

        // Proc 효과 데미지 합산
        if (skillData.abnormalInfo && procEffects.length > 0) {
            procEffects.forEach(pe => {
                const isTriggerMet = pe.trigger.some(t =>
                    skillData.abnormalInfo.some(a => {
                        if (a.name === t) return true;
                        if ((t === '넘어뜨리기' && a.name === '강제 넘어뜨리기') || (t === '띄우기' && a.name === '강제 띄우기')) return true;
                        if (a.isArts) {
                            const artsBaseName = a.name.replace('(이상)', '');
                            return a.originalType === t || artsBaseName === t || t.endsWith(' 부여') && t.startsWith(artsBaseName);
                        }
                        return false;
                    })
                );

                if (isTriggerMet) {
                    const targetStats = (hasCustomState && cRes) ? cRes.stats : (skillData.stats || (cRes ? cRes.stats : baseRes.stats));
                    const procCommonMults = targetStats.critExp *
                        (1 + (targetStats.dmgIncData?.all || targetStats.dmgInc || 0) / 100) *
                        (1 + (targetStats.amp || 0) / 100) *
                        (1 + (targetStats.takenDmg || 0) / 100) *
                        (1 + (targetStats.vuln || 0) / 100) *
                        (1 + (targetStats.unbalanceDmg || 0) / 100) *
                        (targetStats.resMult || 1) *
                        (targetStats.defMult || 1);

                    const procDmg = Math.floor(targetStats.finalAtk * parseDmgPct(pe.dmg) * procCommonMults);
                    if (procDmg > 0) {
                        skillTotal += procDmg;
                        if (!perAbnormal[pe.label]) perAbnormal[pe.label] = { dmg: 0, count: 0 };
                        perAbnormal[pe.label].dmg += procDmg;
                        perAbnormal[pe.label].count += 1;
                    }
                }
            });
        }

        total += skillTotal;
        pSkill.dmg += skillData.baseUnitDmg || 0;
        pSkill.count += 1;
        pSkill.dmgRate = skillData.dmgRate;
        pSkill.unitDmg = skillData.baseUnitDmg;

        // 이상 데미지 집계 (아츠 소모 제외)
        if (skillData.abnormalDmgs) {
            Object.entries(skillData.abnormalDmgs).forEach(([aName, aDmg]) => {
                if (aName.includes('소모(이상)')) { skillTotal -= aDmg; return; }
                if (!perAbnormal[aName]) perAbnormal[aName] = { dmg: 0, count: 0 };
                perAbnormal[aName].dmg += aDmg;
                perAbnormal[aName].count += 1;
            });
        }

        sequenceResult.push({
            ...skillData,
            id: isObj ? itemObj.id : null,
            type,
            dmg: skillTotal,
            customState: hasCustomState ? itemObj.customState : null,
            indivDmg: hasCustomState ? skillTotal : undefined,
            indivRate: hasCustomState ? skillData.rawRate : undefined,
            cRes,
            activeEffects: skillData.activeEffects,
        });
    });

    return { sequence: sequenceResult, perSkill, perAbnormal, total };
}