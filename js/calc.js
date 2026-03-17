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
 * [효과 수집 아키텍처]
 * 데이터 파일의 서로 다른 형식(val/val_f, valByLevel, levels.M0~M3)을
 * 정규화 함수가 단일 EffectSource 구조로 변환한다.
 *
 *   데이터 파일 → 정규화 함수 → EffectSource[] → processEffectSource → allEffects[]
 *
 * [EffectSource 확장 방법]
 * - 새 소스 타입 추가: collect*EffectSources() 함수 작성 → collectAllEffects() 에 등록
 * - 새 메타 필드 추가: makeEffectSource() 기본값에 추가 → processEffectSource() 에서 참조
 *
 * [내부 규칙]
 * - 효과 UID : `${uidPrefix|name}_${type}_v${index}_${j}` 형태로 생성한다.
 * - nonStack 효과: sourceId(무기) 또는 setId(세트) + type을 키로 중복 차단한다.
 * - 서브 오퍼레이터 효과: target이 '팀' | '팀_외' | '적'인 효과만 적용한다.
 * - computeFinalDamageOutput의 데미지 공식:
 *   finalAtk × critExp × (1 + dmgInc) × (1 + amp) × (1 + takenDmg) × (1 + vuln) × multiHit × (1 + unbal) × resMult
 * - 디버프 직접 적용 규칙: uid를 'debuff_XXXX' 형태로 고정한다.
 */

// ============ 공통 상수 ============
let OPERATOR_MAP = null;
function getOperatorData(id) {
    if (!OPERATOR_MAP) {
        OPERATOR_MAP = {};
        if (typeof DATA_OPERATORS !== 'undefined') {
            DATA_OPERATORS.forEach(op => OPERATOR_MAP[op.id] = op);
        }
    }
    return OPERATOR_MAP[id] || null;
}

// 스킬 타입명 → 카테고리 키 매핑 (여러 함수에서 공유)
const SKILL_TYPE_CAT_MAP = {
    '일반 공격': 'normal', '강화 일반 공격': 'normal',
    '배틀 스킬': 'battle', '강화 배틀 스킬': 'battle',
    '연계 스킬': 'combo',
    '궁극기': 'ult'
};

// 한국어 속성 접두어 → 내부 element 키
const KO_ELEM_MAP = {
    '물리': 'phys', '열기': 'heat', '전기': 'elec', '냉기': 'cryo', '자연': 'nature', '아츠': 'arts'
};
const KO_ELEM_ENTRIES = Object.entries(KO_ELEM_MAP);

// 효과 type 문자열에서 속성 element 키를 추출한다.
function extractElemTag(typeStr, opData) {
    for (const [ko, key] of KO_ELEM_ENTRIES) {
        if (typeStr.includes(ko)) {
            if (key === 'arts') return opData?.element || null;
            return key;
        }
    }
    return null;
}

// ============ 공통 헬퍼 ============

function buildLogEntry(eff, displayName, label, extra = {}) {
    const stackSuffix = eff.stack ? ` <span class="tooltip-highlight">(${eff._stackCount}중첩)</span>` : '';
    return {
        txt: `[${displayName}] ${label} ${extra.valDisplay ?? ''} ${stackSuffix}`.replace(/\s+/g, ' ').trim(),
        uid: eff.uid,
        stack: eff.stack,
        stackCount: eff._stackCount,
        _triggerFailed: eff._triggerFailed,
        ...extra
    };
}

function calcPerStackValue(perStack, base, stackCount) {
    const nPer = parseFloat(perStack) || 0;
    const nBase = parseFloat(base) || 0;
    const total = parseFloat((nPer * stackCount + nBase).toPrecision(12));
    const isPct = String(perStack).includes('%') || (base && String(base).includes('%'));
    return isPct ? total + '%' : total;
}

// ============ 효과 소스 정규화 레이어 ============

/**
 * EffectSource 팩토리 — 정규화된 효과 소스 객체를 생성한다.
 *
 * [확장 방법] 새 메타 필드가 필요하면 options에 추가하고 기본값을 여기에 등록한다.
 * processEffectSource() 에서 구조분해로 참조하면 하위 호환성이 유지된다.
 *
 * @param {Array}  effects         - 정규화된 효과 배열
 * @param {string} name            - 표시용 출처명
 * @param {object} options         - 선택적 메타 필드
 */
function makeEffectSource(effects, name, options = {}) {
    return {
        effects,
        name,
        forgeMult: options.forgeMult ?? 1.0,
        isSub: options.isSub ?? false,
        isSkillSource: options.isSkillSource ?? false,
        forceMaxStack: options.forceMaxStack ?? false,
        effectiveOpData: options.effectiveOpData ?? null,  // null이면 메인 opData 사용
        uidPrefix: options.uidPrefix ?? null,
    };
}

/**
 * 장비 특성 하나를 정규화한다.
 * - val/val_f 해석
 * - '스탯' 타입의 퍼센트 여부 판별 → '스탯' | '스탯%' 결정
 * - '주스탯' | '부스탯' → 실제 stat 키로 변환
 */
function resolveGearTrait(trait, isForged, ownerOpData) {
    const val = (isForged && trait.val_f !== undefined) ? trait.val_f : trait.val;
    const types = Array.isArray(trait.type) ? trait.type : [trait.type];

    if (types.includes('스탯')) {
        const isPercent = typeof val === 'string' && val.includes('%');
        const stat = trait.stat === '주스탯' ? ownerOpData.mainStat
            : trait.stat === '부스탯' ? ownerOpData.subStat
                : trait.stat;
        return { ...trait, type: isPercent ? '스탯%' : '스탯', stat, val };
    }
    return { ...trait, val };
}

/**
 * 무기 특성 하나를 정규화한다.
 * - valByLevel 배열에서 레벨 수치를 추출
 * - '스탯' 타입의 퍼센트 여부 판별 → '스탯' | '스탯%' 결정
 * - '주스탯' | '부스탯' → 실제 stat 키로 변환
 */
function resolveWeaponTrait(trait, level, mainOpData) {
    const val = calculateWeaponTraitValue(trait, level);
    const types = Array.isArray(trait.type) ? trait.type : [trait.type];

    if (types.includes('스탯')) {
        const targetStat = trait.stat === '주스탯' ? mainOpData.mainStat
            : trait.stat === '부스탯' ? mainOpData.subStat
                : trait.stat;
        const isPercent = typeof val === 'string' && val.includes('%');
        return { ...trait, type: isPercent ? '스탯%' : '스탯', stat: targetStat, val };
    }
    return { ...trait, val };
}

/**
 * 오퍼레이터 스킬 정의에 마스터리 레벨 데이터를 병합한다.
 * - levels.M0~M3 중 해당 레벨의 데이터를 최상위로 병합
 */
function resolveSkillLevel(skillDef, skillType, skillLevels) {
    const skillName = Array.isArray(skillType) ? skillType[0] : (skillType || '');
    const baseType = skillDef.masterySource
        || (skillName.startsWith('강화 ') ? skillName.substring(3) : skillName);
    const level = skillLevels?.[baseType] || 'M3';
    if (skillDef.levels?.[level]) {
        return { ...skillDef, ...skillDef.levels[level] };
    }
    return skillDef;
}

/**
 * 잠재/재능 효과 항목에 마스터리 레벨 데이터를 병합한다.
 */
function resolvePotentialEffect(eff, skillLevels) {
    if (!eff.levels) return eff;
    const skillName = Array.isArray(eff.skillType) ? eff.skillType[0] : (eff.skillType || '');
    const baseType = eff.masterySource
        || (skillName.startsWith('강화 ') ? skillName.substring(3) : skillName);
    const level = skillLevels?.[baseType] || 'M3';
    if (eff.levels[level]) {
        return { ...eff, ...eff.levels[level] };
    }
    return eff;
}

// ============ 효과 소스 수집 함수 ============

/**
 * 장비 EffectSource 목록을 수집한다. (메인 + 서브 오퍼레이터)
 * 메인 오퍼레이터 장비의 글로벌 스탯(stat1/stat2)은 stats 객체에 직접 적용한다.
 */
function collectGearEffectSources(state, mainOpData, stats) {
    const sources = [];
    const entries = [
        { isMain: true, opData: mainOpData, gears: state.mainOp.gears, gearForged: state.mainOp.gearForged },
        ...state.subOps.map(sub => {
            const sData = getOperatorData(sub.id);
            return { isMain: false, opData: sData, gears: sub.gears || [], gearForged: sub.gearForged || [] };
        })
    ];

    entries.forEach(entry => {
        if (!entry.opData) return;
        entry.gears.forEach((gId, i) => {
            if (!gId) return;
            const gear = DATA_GEAR.find(g => g.id === gId);
            if (!gear) return;
            const isForged = entry.gearForged[i];

            // 메인 오퍼레이터 장비의 글로벌 스탯 직접 적용 (stat1, stat2)
            if (entry.isMain) {
                [1, 2].forEach(num => {
                    const statKey = gear[`stat${num}`];
                    if (!statKey) return;
                    const val = (isForged && gear[`val${num}_f`] !== undefined)
                        ? gear[`val${num}_f`] : gear[`val${num}`];
                    const key = resolveStatKey(statKey, stats);
                    if (stats[key] !== undefined) stats[key] += val;
                });
            }

            if (!gear.trait) return;

            const resolvedTraits = gear.trait.map(t => resolveGearTrait(t, isForged, entry.opData));
            const gearName = entry.isMain
                ? `${gear.name}_s${i}`
                : `${entry.opData.name} ${gear.name}_s${i}`;

            sources.push(makeEffectSource(resolvedTraits, gearName, {
                isSub: !entry.isMain,
                effectiveOpData: entry.opData,
            }));
        });
    });

    return sources;
}

/**
 * 무기 EffectSource 목록을 수집한다. (메인 + 서브 오퍼레이터)
 */
function collectWeaponEffectSources(state, mainOpData, wepData, forceMaxStack) {
    const sources = [];
    const weaponEntries = [
        { data: wepData, wepState: state.mainOp.wepState, wepPot: state.mainOp.wepPot, isMain: true, ownerOp: mainOpData },
        ...state.subOps.map(sub => {
            const sData = getOperatorData(sub.id);
            const sWep = DATA_WEAPONS.find(w => w.id === sub.wepId);
            return { data: sWep, wepState: sub.wepState, wepPot: sub.wepPot, isMain: false, ownerOp: sData };
        })
    ];

    weaponEntries.forEach((entry) => {
        if (!entry.data || !entry.ownerOp) return;
        entry.data.traits.forEach((trait, idx) => {
            if (!trait) return;
            const traitIdx = idx + 1;
            const level = calculateWeaponTraitLevel(idx, entry.wepState, entry.wepPot);
            const resolved = resolveWeaponTrait(trait, level, mainOpData);
            const effWithMeta = { ...resolved, sourceId: entry.data.id, traitIdx };

            const label = entry.isMain
                ? `${entry.data.name} 특성${traitIdx}(Lv${level})`
                : `${entry.ownerOp.name} ${entry.data.name} 특성${traitIdx}`;
            const uidPrefix = entry.isMain
                ? `${entry.data.name}_trait${traitIdx}`
                : `${entry.ownerOp.name}_${entry.data.id}_trait${traitIdx}`;

            sources.push(makeEffectSource([effWithMeta], `${label}_t${idx}`, {
                isSub: !entry.isMain,
                effectiveOpData: entry.ownerOp,
                uidPrefix,
                forceMaxStack: entry.isMain ? forceMaxStack : false,
            }));
        });
    });

    return sources;
}

/**
 * 메인 오퍼레이터의 스킬/재능/잠재 EffectSource 목록을 수집한다.
 */
function collectMainOpEffectSources(state, opData, combineValues) {
    const sources = [];

    // 스킬
    (opData.skill || []).forEach((s, i) => {
        const skName = (s.skillType && Array.isArray(s.skillType)) ? s.skillType.join('/') : `스킬${i + 1}`;
        const resolved = resolveSkillLevel(s, s.skillType, state.mainOp.skillLevels);
        sources.push(makeEffectSource([resolved], `${opData.name} ${skName}`, {
            isSkillSource: true,
            effectiveOpData: opData,
        }));
    });

    // 재능
    (opData.talents || []).forEach((t, i) => {
        if (!t || t.length === 0) return;
        const merged = mergeEffects(t, combineValues);
        sources.push(makeEffectSource(merged, `${opData.name} ${i + 1}재능`, {
            effectiveOpData: opData,
            uidPrefix: `${opData.id}_talent${i}`,
        }));
    });

    // 잠재
    const mainPot = Number(state.mainOp.pot) || 0;
    for (let p = 0; p < mainPot; p++) {
        const pot = opData.potential?.[p];
        if (!pot || pot.length === 0) continue;
        const merged = mergeEffects(pot, combineValues);
        const resolved = merged.map(eff => resolvePotentialEffect(eff, state.mainOp.skillLevels));
        sources.push(makeEffectSource(resolved, `${opData.name} ${p + 1}잠재`, {
            effectiveOpData: opData,
            uidPrefix: `${opData.id}_pot${p}`,
        }));
    }

    return sources;
}

/**
 * 서브 오퍼레이터들의 스킬/재능/잠재 시너지 EffectSource 목록을 수집한다.
 */
function collectSubOpEffectSources(state, combineValues) {
    const sources = [];

    state.subOps.forEach((sub) => {
        if (!sub.id) return;
        const subOpData = getOperatorData(sub.id);
        if (!subOpData) return;

        // 서브 스킬
        (subOpData.skill || []).forEach((s, i) => {
            const skName = (s.skillType && Array.isArray(s.skillType)) ? s.skillType.join('/') : `스킬${i + 1}`;
            const resolved = resolveSkillLevel(s, s.skillType, sub.skillLevels);
            sources.push(makeEffectSource([resolved], `${subOpData.name} ${skName}`, {
                isSub: true,
                isSkillSource: true,
                effectiveOpData: subOpData,
            }));
        });

        // 서브 재능
        (subOpData.talents || []).forEach((t, ti) => {
            if (!t || t.length === 0) return;
            const merged = mergeEffects(t, combineValues);
            sources.push(makeEffectSource(merged, `${subOpData.name} ${ti + 1}재능`, {
                isSub: true,
                effectiveOpData: subOpData,
                uidPrefix: `${subOpData.id}_talent${ti}`,
            }));
        });

        // 서브 잠재
        const subPot = Number(sub.pot) || 0;
        for (let sp = 0; sp < subPot; sp++) {
            const pot = subOpData.potential?.[sp];
            if (!pot || pot.length === 0) continue;
            const merged = mergeEffects(pot, combineValues);
            const resolved = merged.map(eff => resolvePotentialEffect(eff, sub.skillLevels));
            sources.push(makeEffectSource(resolved, `${subOpData.name} ${sp + 1}잠재`, {
                isSub: true,
                effectiveOpData: subOpData,
                uidPrefix: `${subOpData.id}_pot${sp}`,
            }));
        }
    });

    return sources;
}

/**
 * 세트 효과 EffectSource 목록을 수집한다. (메인 + 서브 오퍼레이터)
 */
function collectSetEffectSources(state, mainOpData) {
    const sources = [];
    const opsForSet = [
        { opData: mainOpData, setId: getActiveSetID(state.mainOp.gears), isSelf: true },
        ...state.subOps.map((sub, idx) => ({
            opData: getOperatorData(sub.id),
            setId: getActiveSetID(sub.gears || []),
            isSelf: false,
            idx,
        }))
    ];

    state.activeSetId = opsForSet[0].setId;

    opsForSet.forEach((entry, listIdx) => {
        if (!entry.setId || !entry.opData) return;
        const rawSetEffects = getSetEffects(entry.setId, entry.opData, entry.isSelf);
        if (!rawSetEffects || rawSetEffects.length === 0) return;

        const setName = DATA_SETS.find(s => s.id === entry.setId)?.name || entry.setId;
        const setLabel = `${entry.opData.name} ${setName} 세트효과`;
        const effWithId = rawSetEffects.map(e => ({ ...e, setId: entry.setId }));

        sources.push(makeEffectSource(effWithId, setLabel, {
            isSub: !entry.isSelf,
            effectiveOpData: entry.opData,
            uidPrefix: `set_${entry.setId}_${listIdx}`,
        }));
    });

    return sources;
}

// ============ 데미지 계산 엔진 ============

function calculateDamage(currentState, forceMaxStack = false, isStatCalcOnly = false) {
    const originalOpData = getOperatorData(currentState.mainOp.id);
    const wepData = DATA_WEAPONS.find(w => w.id === currentState.mainOp.wepId);
    if (!originalOpData || !wepData) return null;

    const opData = { ...originalOpData };

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

    // 서브 오퍼레이터 스탯 사전 계산
    if (!isStatCalcOnly && currentState.subOps) {
        if (!currentState._subStatsCache) {
            currentState._subStatsCache = {};
            currentState.subOps.forEach(subOp => {
                if (subOp.id && subOp.id !== currentState.mainOp.id) {
                    const fakeState = { ...currentState, mainOp: subOp, subOps: [currentState.mainOp, ...currentState.subOps.filter(o => o.id !== subOp.id)], overrideSkillElement: null, _subStatsCache: {} };
                    const res = calculateDamage(fakeState, false, true);
                    if (res && res.stats) {
                        currentState._subStatsCache[subOp.id] = res.stats;
                        subOp.cachedStats = res.stats;
                    }
                }
            });
        }
    }

    collectAllEffects(currentState, opData, wepData, stats, allEffects, forceMaxStack);

    const activeEffects = allEffects.filter(e => {
        if (e._triggerFailed) return false;
        if (currentState.disabledEffects.includes(e.uid)) return false;
        if ((e.type === '스탯' || e.type === '스탯%') && currentState.disabledEffects.includes(`${e.uid}#common`)) return false;
        return true;
    });
    applyFixedStats(activeEffects, stats);
    applyPercentStats(activeEffects, stats);

    const finalResult = computeFinalDamageOutput(currentState, opData, wepData, stats, allEffects, activeEffects);

    if (isStatCalcOnly) {
        return { stats: finalResult.stats };
    }

    return finalResult;
}

// ---- 스탯 키 정규화 ----
const PHYS_ANOMALY_TAGS = ['강타', '띄우기', '넘어뜨리기', '강제 띄우기', '강제 넘어뜨리기', '갑옷 파괴'];
const REVERSE_STAT_NAME_MAP = { '힘': 'str', '민첩': 'agi', '지능': 'int', '의지': 'wil' };

function resolveStatKey(target, container) {
    if (container[target] !== undefined) return target;
    const mapped = STAT_NAME_MAP[target];
    if (mapped && container[mapped] !== undefined) return mapped;
    const reverseKey = REVERSE_STAT_NAME_MAP[target];
    if (reverseKey && container[reverseKey] !== undefined) return reverseKey;
    return target;
}

function getAdjustedStackCount(triggerName, state, opData, skillTypes) {
    let count = 0;
    if (triggerName === '물리 이상') {
        return Math.max(...PHYS_ANOMALY_TAGS.map(t => getAdjustedStackCount(t, state, opData, skillTypes)));
    }
    if (triggerName === '방어 불능') {
        count = state.debuffState?.physDebuff?.defenseless || 0;
        const mainOp = state.mainOp;
        const op = opData;
        if (op) {
            let opPot = 0;
            if (op.id === mainOp?.id) {
                opPot = Number(mainOp.pot) || 0;
            } else {
                const subMatch = state.subOps?.find(s => s.id === op.id);
                if (subMatch) opPot = Number(subMatch.pot) || 0;
            }
            const checkPool = (subArr) => {
                if (!subArr) return;
                subArr.forEach(pEff => {
                    if (!pEff || !pEff.type) return;
                    const pTypes = Array.isArray(pEff.type) ? pEff.type : [pEff.type];
                    if (pTypes.includes('방어 불능 보정')) {
                        const matchSkill = !pEff.skillType || (skillTypes && skillTypes.some(st => pEff.skillType.includes(st)));
                        if (matchSkill) count += (pEff.val || 0);
                    }
                });
            };
            if (op.talents) op.talents.forEach(checkPool);
            if (op.potential) op.potential.slice(0, opPot).forEach(checkPool);
        }
        return Math.min(4, count);
    }

    const op2 = opData;
    const specialStackVal = state.getSpecialStack ? state.getSpecialStack() : (state.mainOp?.specialStack || {});
    if (op2 && op2.specialStack) {
        const stacks = Array.isArray(op2.specialStack) ? op2.specialStack : [op2.specialStack];
        const matchingStack = stacks.find(s => s.triggers && s.triggers.includes(triggerName));
        if (matchingStack) {
            const stackId = matchingStack.id || 'default';
            return typeof specialStackVal === 'object' ? (specialStackVal[stackId] || 0) : specialStackVal;
        }
    }

    if (triggerName === '갑옷 파괴') return state.debuffState?.physDebuff?.armorBreak || 0;
    if (['열기 부착', '전기 부착', '냉기 부착', '자연 부착'].includes(triggerName)) {
        if (state.debuffState?.artsAttach?.type === triggerName) return state.debuffState.artsAttach.stacks || 0;
    }
    if (['연소', '감전', '동결', '부식'].includes(triggerName)) return state.debuffState?.artsAbnormal?.[triggerName] || 0;

    return count;
}

const MERGE_EFFECTS_CACHE = new Map();

function getStrForMerge(v) {
    if (v == null) return '';
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    if (Array.isArray(v)) return v.map(getStrForMerge).join(',');
    if (typeof v === 'object') return v.type ? getStrForMerge(v.type) : JSON.stringify(v);
    return String(v);
}

function mergeEffects(effs, combineValues) {
    if (!effs || effs.length === 0) return [];
    if (MERGE_EFFECTS_CACHE.has(effs)) return MERGE_EFFECTS_CACHE.get(effs);

    const groups = {};
    effs.forEach(eff => {
        if (!eff) return;
        const typeStr = getStrForMerge(eff.type);
        const triggerStr = getStrForMerge(eff.trigger);
        const skillTypeStr = getStrForMerge(eff.skillType);
        const key = `${typeStr}|${triggerStr}|${eff.target}|${skillTypeStr}|${eff.cond}`;

        if (!groups[key]) {
            groups[key] = deepClone(eff);
        } else {
            const g = groups[key];
            if (eff.val !== undefined) g.val = combineValues(g.val, eff.val);
            if (eff.dmg !== undefined) g.dmg = combineValues(g.dmg, eff.dmg);
            if (eff.bonus) {
                if (!g.bonus) g.bonus = [];
                eff.bonus.forEach(eb => {
                    const bTypeStr = getStrForMerge(eb.type);
                    const bTriggerStr = getStrForMerge(eb.trigger);
                    const existingBonus = g.bonus.find(gb =>
                        getStrForMerge(gb.type) === bTypeStr &&
                        getStrForMerge(gb.trigger) === bTriggerStr &&
                        gb.target === eb.target
                    );
                    if (existingBonus) {
                        if (eb.val !== undefined) existingBonus.val = combineValues(existingBonus.val, eb.val);
                    } else {
                        g.bonus.push(deepClone(eb));
                    }
                });
            }
        }
    });
    const res = Object.values(groups);
    MERGE_EFFECTS_CACHE.set(effs, res);
    return res;
}

// ============ 효과 수집 ============

/**
 * collectAllEffects — 모든 소스의 효과를 allEffects 배열에 수집한다.
 *
 * 각 소스 타입(장비/무기/오퍼레이터/세트)은 독립적인 collect* 함수로 분리되어 있다.
 * 새 소스를 추가하려면 collect*EffectSources() 함수를 작성하고 아래 목록에 등록한다.
 */
function collectAllEffects(state, opData, wepData, stats, allEffects, forceMaxStack = false) {
    const activeNonStackTypes = new Set();

    const combineValues = (v1, v2) => {
        if (v1 === undefined) return v2;
        if (v2 === undefined) return v1;
        const isPct1 = typeof v1 === 'string' && v1.includes('%');
        const isPct2 = typeof v2 === 'string' && v2.includes('%');
        const n1 = parseFloat(v1) || 0;
        const n2 = parseFloat(v2) || 0;
        const sum = parseFloat((n1 + n2).toPrecision(12));
        if (isPct1 || isPct2) return sum + '%';
        return sum;
    };

    // ── 효과 소스 수집 (새 소스 추가 시 여기에 한 줄 추가) ──
    const effectSources = [
        ...collectGearEffectSources(state, opData, stats),
        ...collectWeaponEffectSources(state, opData, wepData, forceMaxStack),
        ...collectMainOpEffectSources(state, opData, combineValues),
        ...collectSubOpEffectSources(state, combineValues),
        ...collectSetEffectSources(state, opData),
    ];

    // ── 단일 파이프라인으로 처리 ──
    effectSources.forEach(source => {
        processEffectSource(source, state, opData, allEffects, activeNonStackTypes, combineValues, forceMaxStack);
    });
}

/**
 * processEffectSource — 정규화된 EffectSource를 처리하여 allEffects 배열에 추가한다.
 *
 * 트리거 평가 → bonus 평가 → 스택/perStack 수치 계산 → UID 생성 → nonStack 중복 차단
 * 순서로 처리된다. 로직 자체는 이전 addEffect와 동일하며, 파라미터 구조만 EffectSource로 통일됐다.
 */
function processEffectSource(source, state, opData, allEffects, activeNonStackTypes, combineValues, globalForceMaxStack) {
    const {
        effects,
        name,
        forgeMult = 1.0,
        isSub = false,
        isSkillSource = false,
        effectiveOpData: rawEffectiveOpData = null,
        uidPrefix = null,
    } = source;

    // forceMaxStack: 소스 자체 설정이 있으면 그것을, 없으면 전역 값 사용
    const forceMaxStack = source.forceMaxStack || globalForceMaxStack;
    const effectiveOpData = rawEffectiveOpData || opData;

    if (!effects || !Array.isArray(effects)) return;

    effects.forEach((eff, i) => {
        if (!eff) return;

        let triggerMet = true;
        let targetMet = true;
        if (eff.trigger) {
            triggerMet = evaluateTrigger(eff.trigger, state, effectiveOpData, eff.triggerType, 'op', eff.target, !!eff.sourceId);
        }
        if (eff.triggerTarget) {
            targetMet = evaluateTrigger(eff.triggerTarget, state, effectiveOpData, null, 'target', eff.target, !!eff.sourceId);
        }

        let baseTriggerMet = triggerMet && targetMet;

        if (eff.targetFilter === '다른 속성') {
            const sourceElem = effectiveOpData.element || effectiveOpData.type;
            const targetElem = opData.element || opData.type;
            if (sourceElem === targetElem) baseTriggerMet = false;
        } else if (eff.targetFilter === '자신 제외') {
            if (effectiveOpData.id === opData.id) baseTriggerMet = false;
        }

        if (eff.targetClass && Array.isArray(eff.targetClass)) {
            if (!eff.targetClass.includes(opData.class)) baseTriggerMet = false;
        }

        const typeArr = eff.type
            ? (Array.isArray(eff.type) ? eff.type : [eff.type]).map(item =>
                typeof item === 'string' ? { type: item } : { ...item })
            : [];
        const bonuses = eff.bonus || [];

        const evaluatedBonuses = bonuses.map(b => {
            const bTriggerMet = !b.trigger || evaluateTrigger(b.trigger, state, effectiveOpData, null, 'op', b.target || eff.target, !!eff.sourceId);
            const bTargetMet = !b.triggerTarget || evaluateTrigger(b.triggerTarget, state, effectiveOpData, null, 'target', b.target || eff.target, !!eff.sourceId);
            return { ...b, _active: bTriggerMet && bTargetMet };
        });
        const activeBonuses = evaluatedBonuses.filter(b => b._active);
        const inactiveBonuses = evaluatedBonuses.filter(b => !b._active);

        const isMatchOpType = typeArr.some(ta => {
            const t = ta.type;
            const elMap = { heat: '열기', elec: '전기', cryo: '냉기', nature: '자연' };
            const opElK = elMap[effectiveOpData.element];
            const opTypeK = effectiveOpData.type === 'phys' ? '물리' : '아츠';
            return (t && (t.includes(opTypeK) || (opElK && t.includes(opElK)) || t.includes('취약') || t.includes('증폭') || t.includes('불균형')));
        });
        const isWeaponSource = !!eff.sourceId;
        const isTargetClassFail = eff.targetClass && !baseTriggerMet;
        const hasFailedCondition = (eff.trigger && !triggerMet) || (eff.triggerTarget && !targetMet);
        const showEvenIfFailed = hasFailedCondition || (!baseTriggerMet && (isWeaponSource || isMatchOpType)) || isTargetClassFail;

        if (baseTriggerMet || showEvenIfFailed) {
            const triggerFailed = !baseTriggerMet;

            typeArr.forEach((typeItem, j) => {
                if (!typeItem?.type) return;

                if (typeItem.excludeTarget) {
                    const isExcluded = evaluateTrigger(typeItem.excludeTarget, state, effectiveOpData, null, 'target', eff.target, !!eff.sourceId);
                    if (isExcluded) return;
                }

                let currentVal = typeItem.val !== undefined ? typeItem.val : eff.val;

                // perStack 계산: perStack + trigger 조합이면 스택 수에 따라 값 결정
                const ps = typeItem.perStack || eff.perStack;
                const tr = typeItem.trigger || eff.trigger;
                const bs = typeItem.base !== undefined ? typeItem.base : (eff.base !== undefined ? eff.base : currentVal);
                if (ps && tr) {
                    const triggers = Array.isArray(tr) ? tr : [tr];
                    const maxStackForThis = triggers.reduce(
                        (acc, t) => Math.max(acc, getAdjustedStackCount(t, state, effectiveOpData, eff.skillType)),
                        0
                    );
                    currentVal = calcPerStackValue(ps, bs, maxStackForThis);
                }

                // 스택 배율 계산: stack 속성이 있으면 effectStacks 기반 중첩값 반영
                const maxStack = typeItem.stack || eff.stack;
                const effUid = `${uidPrefix || name}_${typeItem.type}_v${i}_${j}`;
                let stackCount = state.effectStacks?.[effUid] ?? 1;
                if (forceMaxStack && maxStack) stackCount = maxStack;
                if (maxStack) {
                    const n = parseFloat(currentVal) || 0;
                    const multiplied = parseFloat((n * stackCount).toPrecision(12));
                    currentVal = (typeof currentVal === 'string' && currentVal.includes('%')) ? multiplied + '%' : multiplied;
                    typeItem._stackCount = stackCount;
                    typeItem._uid = effUid;
                    typeItem.stack = maxStack;
                }

                // activeBonuses 병합: 같은 type의 bonus 값을 currentVal에 합산
                activeBonuses.forEach(b => {
                    if (b.type !== typeItem.type && !(!b.type && typeArr.length === 1)) return;
                    if (b.val !== undefined) {
                        let bVal = b.val;
                        if (maxStack) {
                            const bn = parseFloat(bVal) || 0;
                            const bMul = parseFloat((bn * stackCount).toPrecision(12));
                            bVal = (typeof bVal === 'string' && bVal.includes('%')) ? bMul + '%' : bMul;
                        }
                        currentVal = combineValues(currentVal, bVal);
                    }
                    if (b.perStack && b.trigger) {
                        const bTriggers = Array.isArray(b.trigger) ? b.trigger : [b.trigger];
                        const maxStackForBonus = bTriggers.reduce(
                            (acc, t) => Math.max(acc, getAdjustedStackCount(t, state, effectiveOpData, eff.skillType)),
                            0
                        );
                        const bnBase = b.base !== undefined ? b.base : (b.val !== undefined ? b.val : 0);
                        currentVal = combineValues(currentVal, calcPerStackValue(b.perStack, bnBase, maxStackForBonus));
                    }
                    b._applied = true;
                });

                const expanded = {
                    ...eff,
                    ...typeItem,
                    type: typeItem.type,
                    val: currentVal,
                    target: typeItem.target || eff.target,
                    skillType: typeItem.skillType || eff.skillType || eff.skilltype,
                    _stackCount: typeItem._stackCount,
                    _isExternal: !isSkillSource || !!(typeItem.skillType),
                    _triggerFailed: triggerFailed,
                    _sourceOpId: effectiveOpData ? effectiveOpData.id : null,
                };

                if (isSub && !isSubOpTargetValid(expanded)) return;

                if (expanded.nonStack) {
                    const key = `${expanded.setId || expanded.sourceId || name}_${expanded.traitIdx || ''}_${expanded.type}`;
                    if (activeNonStackTypes.has(key)) return;
                    activeNonStackTypes.add(key);
                }

                const finalUid = typeItem._uid || `${uidPrefix || name}_${typeItem.type.toString()}_v${i}_${j}`;
                allEffects.push({ ...expanded, name, forgeMult, uid: finalUid });
            });
        }

        // 활성 bonus 독립 처리
        activeBonuses.forEach((b, j) => {
            const bonusTypes = b.type
                ? (Array.isArray(b.type) ? b.type : [b.type])
                : (typeArr.length === 1 ? [typeArr[0].type] : []);
            if (!b._applied && bonusTypes.length > 0) {
                bonusTypes.forEach((bt, bj) => {
                    const bonusEff = { target: b.target || eff.target, ...b, type: bt };
                    if (!isSub || isSubOpTargetValid(bonusEff)) {
                        const bUid = `${uidPrefix || name}_bonus_${bt.toString()}_v${i}_${j}_${bj}`;
                        allEffects.push({ ...bonusEff, name, forgeMult, uid: bUid, _triggerFailed: !baseTriggerMet });
                    }
                });
            }
        });

        // 비활성 bonus (트리거 미충족) — 로그 표시용으로만 추가
        inactiveBonuses.forEach((b, j) => {
            const bonusTypes = b.type
                ? (Array.isArray(b.type) ? b.type : [b.type])
                : (typeArr.length === 1 ? [typeArr[0].type] : []);
            if (bonusTypes.length > 0) {
                bonusTypes.forEach((bt, bj) => {
                    const bonusEff = { target: b.target || eff.target, ...b, type: bt };
                    if (!isSub || isSubOpTargetValid(bonusEff)) {
                        const bUid = `${uidPrefix || name}_bonus_${bt.toString()}_v${i}_fail_${j}_${bj}`;
                        allEffects.push({ ...bonusEff, name, forgeMult, uid: bUid, _triggerFailed: true });
                    }
                });
            }
        });
    });
}

// ---- 스탯 적용 ----
function applyFixedStats(effects, stats) {
    effects.forEach(eff => {
        if (eff.type !== '스탯') return;
        const rawVal = eff.val || 0;
        const val = parseFloat(rawVal) * (eff.forgeMult || 1.0);
        const target = eff.stat || eff.stats;
        if (target === '모든 능력치') {
            ['str', 'agi', 'int', 'wil'].forEach(k => stats[k] += val);
        } else {
            const key = resolveStatKey(target, stats);
            if (stats[key] !== undefined) stats[key] += val;
        }
    });
}

function applyPercentStats(effects, stats) {
    const statPct = { str: 0, agi: 0, int: 0, wil: 0 };
    effects.forEach(eff => {
        if (eff.type !== '스탯%') return;
        const rawVal = eff.val || 0;
        const val = parseFloat(rawVal) * (eff.forgeMult || 1.0);
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

// ---- 최종 데미지 산출 ----

const LEVEL_COEFF_PHYS = 89 / 392;
const LEVEL_COEFF_ARTS = 89 / 196;

function computeFinalDamageOutput(state, opData, wepData, stats, allEffects, activeEffects) {
    const baseAtk = opData.baseAtk + wepData.baseAtk;
    let atkInc = 0, fixedAtk = 0, statBonusBase = 0, critRate = 5, critDmg = 50, dmgInc = 0, amp = 0, multiHit = 1.0, unbalanceDmg = 0, originiumArts = 0, ultRecharge = 0, ultCostReduction = 0,
        skillMults = { all: { mult: 0, add: 0 } },
        bonusMults = { all: { mult: 0, add: 0 } },
        dmgIncMap = { all: 0, skill: 0, normal: 0, battle: 0, combo: 0, ult: 0, phys: 0, heat: 0, elec: 0, cryo: 0, nature: 0 };
    const bonusHitDmgIncData = {};
    let takenDmgMap = { all: 0, phys: 0, heat: 0, elec: 0, cryo: 0, nature: 0, arts: 0 };
    const vulnMap = { '물리 취약': 0, '아츠 취약': 0, '열기 취약': 0, '전기 취약': 0, '냉기 취약': 0, '자연 취약': 0, '취약': 0 };
    const vulnAmpEffects = [];
    const skillCritData = { rate: { all: 0 }, dmg: { all: 0 } };
    const skillAtkIncData = { all: 0 };
    const logs = {
        atk: [], atkBuffs: [], statAtkBuffs: [], fixedAtk: [], dmgInc: [], amp: [], vuln: [],
        taken: [], unbal: [], multihit: [], crit: [], arts: [], res: [], ultRecharge: []
    };
    let resIgnore = 0;

    // ---- 사용 아이템 ----
    const tsUsables = state.usables;
    if (tsUsables) {
        if (tsUsables['혼란의 약제']) {
            const uid = 'usable_1';
            logs.ultRecharge.push({ txt: `[혼란의 약제] 궁극기 충전 효율 +24%`, uid, tag: 'recharge' });
            if (!state.disabledEffects.includes(uid)) ultRecharge += 24;
        }
        if (tsUsables['아츠가 부여된 금속 병']) {
            const uid = 'usable_2';
            logs.dmgInc.push({ txt: `[아츠가 부여된 금속 병] 모든 피해 +25%`, uid, tag: 'all' });
            if (!state.disabledEffects.includes(uid)) { dmgInc += 25; dmgIncMap.all += 25; }
        }
        if (tsUsables['제이콥의 유산']) {
            const uid = 'usable_3';
            logs.atkBuffs.push({ txt: `[제이콥의 유산] 공격력 +27%`, uid });
            if (!state.disabledEffects.includes(uid)) atkInc += 27;
        }
        if (tsUsables['푹 삶은 갈비 미삼탕']) {
            const val = 180;
            const uidAtk = 'usable_4_atk';
            const uidCrit = 'usable_4_crit';
            logs.fixedAtk.push({ txt: `[푹 삶은 갈비 미삼탕] 고정 공격력 +${val}`, uid: uidAtk });
            if (!state.disabledEffects.includes(uidAtk)) fixedAtk += val;
            logs.crit.push({ txt: `[푹 삶은 갈비 미삼탕] 치명타 확률 +11%`, uid: uidCrit, type: 'rate' });
            if (!state.disabledEffects.includes(uidCrit)) critRate += 11;
        }
        if (tsUsables['원기 회복 탕약']) {
            const uidCrit = 'usable_5_crit';
            const uidDmg = 'usable_5_dmgInc';
            logs.crit.push({ txt: `[원기 회복 탕약] 치명타 확률 +9%`, uid: uidCrit, type: 'rate' });
            if (!state.disabledEffects.includes(uidCrit)) critRate += 9;
            logs.dmgInc.push({ txt: `[원기 회복 탕약] 모든 피해 +18%`, uid: uidDmg, tag: 'all' });
            if (!state.disabledEffects.includes(uidDmg)) { dmgInc += 18; dmgIncMap.all += 18; }
        }
    }

    // ---- 저항 ----
    const ALL_RES_KEYS = ['물리', '열기', '전기', '냉기', '자연'];
    const baseRes = state.enemyResistance || 0;
    const resistance = { '물리': baseRes, '열기': baseRes, '전기': baseRes, '냉기': baseRes, '자연': baseRes };

    let abVal = 0, busikVal = 0, gamsunVal = 0;
    let abnormalMults = { '갑옷 파괴': [], '감전': [], '부식': [], '연소': [], '동결': [] };

    const atkBaseLogs = [
        { txt: `오퍼레이터 공격력: ${opData.baseAtk.toLocaleString()}`, uid: 'base_op_atk' },
        { txt: `무기 공격력: ${wepData.baseAtk.toLocaleString()}`, uid: 'base_wep_atk' }
    ];
    if (tsUsables?.['푹 삶은 갈비 미삼탕']) {
        atkBaseLogs.push({ txt: `사용 아이템 공격력: 180 (푹 삶은 갈비 미삼탕)`, uid: 'base_usable_atk' });
    }

    const statLogs = [];

    // ---- 효과 타입별 핸들러 ----
    // 새 효과 타입을 추가할 때 EFFECT_HANDLERS에 핸들러 함수 하나만 등록하면 된다.
    const EFFECT_HANDLERS = {
        '스탯': (eff, val, t, displayName, checkDisabled, stackSuffix) => {
            const tgt = getStatName(eff.stat || eff.stats);
            statLogs.push({ txt: `[${displayName}] ${tgt} ${_rawValDisplay(eff)}${stackSuffix}`, uid: eff.uid, stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });
        },
        '스탯%': (eff, val, t, displayName, checkDisabled, stackSuffix) => {
            const tgt = getStatName(eff.stat || eff.stats);
            statLogs.push({ txt: `[${displayName}] ${tgt} ${_rawValDisplay(eff)}${stackSuffix}`, uid: eff.uid, stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });
        },
        '저항 감소': (eff, val, t, displayName, checkDisabled, stackSuffix) => {
            const isDisabled = state.disabledEffects.includes(eff.uid) || !!eff._triggerFailed;
            const valNum = (parseFloat(eff.val) || 0) * (eff.forgeMult || 1.0);
            const _resKeyMap = { heat: '열기', elec: '전기', cryo: '냉기', nature: '자연' };
            const resKey = opData.type === 'phys' ? '물리' : (_resKeyMap[opData.element] || null);
            if (resKey) {
                logs.res.push({ txt: `[${displayName}] ${resKey} 저항 ${_rawValDisplay(eff)}`, uid: eff.uid, _triggerFailed: eff._triggerFailed });
                if (!isDisabled) resistance[resKey] += valNum;
            }
        },
        '상태 이상 배율': (eff, val, t, displayName, checkDisabled, stackSuffix) => {
            if (!eff.targetAbnormal) return;
            if (!abnormalMults[eff.targetAbnormal]) abnormalMults[eff.targetAbnormal] = [];
            abnormalMults[eff.targetAbnormal].push({ name: displayName, val: parseFloat(val) || 0, uid: eff.uid, disabled: checkDisabled('common') });
        },
        '공격력 증가': (eff, val, t, displayName, checkDisabled, stackSuffix) => {
            if (eff.skillType) {
                const getCat = (st) => SKILL_TYPE_CAT_MAP[st] || 'common';
                eff.skillType.forEach(st => { if (!checkDisabled(getCat(st))) skillAtkIncData[st] = (skillAtkIncData[st] || 0) + val; });
            } else {
                if (!checkDisabled('common')) atkInc += val;
            }
            _applySkillTypedEffect(eff, val, null, logs.atkBuffs, t, { tag: eff.skillType ? 'skillAtkInc' : undefined });
        },
        '스탯 공격 보너스': (eff, val, t, displayName, checkDisabled, stackSuffix) => {
            if (!checkDisabled('common')) statBonusBase += val;
            logs.statAtkBuffs.push({ txt: `[${displayName}] ${t} ${_valDisplay(val, t)}${stackSuffix}`, uid: eff.uid, stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });
        },
        '오리지늄 아츠 강도': (eff, val, t, displayName, checkDisabled, stackSuffix) => {
            if (!checkDisabled('common')) originiumArts += val;
            logs.arts.push({ txt: `[${displayName}] ${t} ${_valDisplay(val, t)}${stackSuffix}`, uid: eff.uid, stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });
        },
        '궁극기 충전 효율': (eff, val, t, displayName, checkDisabled, stackSuffix) => {
            if (!checkDisabled('common')) ultRecharge += val;
            logs.ultRecharge.push({ txt: `[${displayName}] ${t} ${_valDisplay(val, t)}${stackSuffix}`, uid: eff.uid, tag: 'recharge', stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });
        },
        '궁극기 에너지 감소': (eff, val, t, displayName, checkDisabled, stackSuffix) => {
            if (!checkDisabled('common')) ultCostReduction += val;
            logs.ultRecharge.push({ txt: `[${displayName}] ${t} ${_valDisplay(val, t)}${stackSuffix}`, uid: eff.uid, tag: 'reduction', stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });
        },
        '치명타 확률': (eff, val, t, displayName, checkDisabled, stackSuffix) => {
            const getCat = (st) => SKILL_TYPE_CAT_MAP[st] || 'common';
            if (eff.skillType) {
                eff.skillType.forEach(st => { if (!checkDisabled(getCat(st))) skillCritData.rate[st] = (skillCritData.rate[st] || 0) + val; });
            } else {
                if (!checkDisabled('common')) critRate += val;
            }
            _applySkillTypedEffect(eff, val, null, logs.crit, t, { tag: eff.skillType ? 'skillCrit' : undefined, type: 'rate' });
        },
        '치명타 피해': (eff, val, t, displayName, checkDisabled, stackSuffix) => {
            const getCat = (st) => SKILL_TYPE_CAT_MAP[st] || 'common';
            if (eff.skillType) {
                eff.skillType.forEach(st => { if (!checkDisabled(getCat(st))) skillCritData.dmg[st] = (skillCritData.dmg[st] || 0) + val; });
            } else {
                if (!checkDisabled('common')) critDmg += val;
            }
            _applySkillTypedEffect(eff, val, null, logs.crit, t, { tag: eff.skillType ? 'skillCrit' : undefined, type: 'dmg' });
        },
        '연타': (eff, val, t, displayName, checkDisabled, stackSuffix) => {
            if (!checkDisabled('common')) multiHit = Math.max(multiHit, val || 1);
            logs.multihit.push({ txt: `[${displayName}] x${val || 1}${stackSuffix}`, uid: eff.uid, stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });
        },
        '불균형 목표에 주는 피해': (eff, val, t, displayName, checkDisabled, stackSuffix) => {
            if (state.enemyUnbalanced && !checkDisabled('common')) { dmgInc += val; dmgIncMap.all += val; }
            logs.dmgInc.push({ txt: `[${displayName}] ${t} ${_valDisplay(val, t)}${stackSuffix}`, uid: eff.uid, unbalancedOff: !state.enemyUnbalanced, tag: 'all', stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });
        },
        '스킬 배율 증가': (eff, val, t, displayName, checkDisabled, stackSuffix) => _handleSkillMult(eff, val, t, displayName, checkDisabled, stackSuffix, false),
        '추가 공격 피해 배율 증가': (eff, val, t, displayName, checkDisabled, stackSuffix) => _handleSkillMult(eff, val, t, displayName, checkDisabled, stackSuffix, true),
    };

    // ---- 패턴 기반 핸들러 (접미사/접두사로 분기) ----
    function _handleByPattern(eff, val, t, displayName, checkDisabled, stackSuffix) {
        if (t === '취약 증폭' || t === '냉기 취약 증폭') {
            vulnAmpEffects.push(eff);
            const ampFactor = (1 + val).toFixed(1);
            const targetLabel = (eff.targetEffect && Array.isArray(eff.targetEffect)) ? eff.targetEffect.join(', ') : (t === '냉기 취약 증폭' ? '냉기 취약' : '취약');
            logs.vuln.push({ txt: `[${displayName}] ${targetLabel} *${ampFactor}`, uid: eff.uid, target: '적', _triggerFailed: eff._triggerFailed });
            return true;
        }
        if (t.endsWith('증폭')) {
            if (!checkDisabled('common')) amp += val;
            const ampElemTag = extractElemTag(t, opData);
            logs.amp.push({ txt: `[${displayName}] ${t} ${_valDisplay(val, t)}${stackSuffix}`, uid: eff.uid, tag: ampElemTag || 'all', stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });
            return true;
        }
        if (t.endsWith('취약')) {
            if (!checkDisabled('common')) {
                if (vulnMap[t] !== undefined) vulnMap[t] += val;
                else vulnMap['취약'] += val;
            }
            const vulnElemTag = extractElemTag(t, opData);
            logs.vuln.push({ txt: `[${displayName}] ${t} ${_valDisplay(val, t)}${stackSuffix}`, uid: eff.uid, tag: vulnElemTag || 'all', stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });
            return true;
        }
        if (t.includes('받는')) {
            if (!checkDisabled('common')) {
                let foundMatch = false;
                for (const [ko, key] of KO_ELEM_ENTRIES) {
                    if (t.includes(ko)) { takenDmgMap[key === 'arts' ? 'arts' : key] += val; foundMatch = true; break; }
                }
                if (!foundMatch) takenDmgMap.all += val;
            }
            const takenElemTag = extractElemTag(t, opData);
            logs.taken.push({ txt: `[${displayName}] ${t} ${_valDisplay(val, t)}${stackSuffix}`, uid: eff.uid, tag: takenElemTag || 'all', stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });
            return true;
        }
        if (t === '스킬 치명타 확률' || t === '스킬 치명타 피해') {
            const isRate = t === '스킬 치명타 확률';
            const targetObj = isRate ? skillCritData.rate : skillCritData.dmg;
            const getCat = (st) => SKILL_TYPE_CAT_MAP[st] || 'common';
            if (!checkDisabled('common')) {
                if (eff.skillType) { eff.skillType.forEach(st => { if (!checkDisabled(getCat(st))) targetObj[st] = (targetObj[st] || 0) + val; }); }
                else { targetObj.all += val; }
            }
            const vd = _valDisplay(val, t);
            const skillTypeHtml = eff.skillType ? ` (<span class="tooltip-highlight">${eff.skillType.join(', ')}</span>)` : '';
            logs.crit.push({ txt: `[${displayName}] ${t} ${vd}${stackSuffix}${skillTypeHtml}`, uid: eff.uid, tag: 'skillCrit', skillType: eff.skillType, stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed, type: isRate ? 'rate' : 'dmg' });
            return true;
        }
        if (t.endsWith('피해') || t.includes('피해') || t === '주는 피해' || t === '모든 스킬 피해') {
            _handleDmgInc(eff, val, t, displayName, checkDisabled, stackSuffix);
            return true;
        }
        if (t.endsWith('저항 무시')) {
            if (!checkDisabled('common')) resIgnore += val;
            logs.res.push({ txt: `[${displayName}] ${t} ${val.toFixed(1)}${stackSuffix}`, uid: eff.uid, stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });
            return true;
        }
        return false;
    }

    // ---- 피해 증가 처리 서브 함수 ----
    function _handleDmgInc(eff, val, t, displayName, checkDisabled, stackSuffix) {
        let tag = 'all';
        const skillTypes = eff.skillType ? (Array.isArray(eff.skillType) ? eff.skillType : [eff.skillType]) : null;
        if (!skillTypes) {
            const skillTagMap = [
                { check: () => t === '모든 스킬 피해', cats: ['battle', 'combo', 'ult'], tag: 'skill' },
                { check: () => t.includes('일반 공격'), cats: ['normal'], tag: 'normal' },
                { check: () => t.includes('배틀 스킬'), cats: ['battle'], tag: 'battle' },
                { check: () => t.includes('연계 스킬'), cats: ['combo'], tag: 'combo' },
                { check: () => t.includes('궁극기'), cats: ['ult'], tag: 'ult' },
            ];
            const matched = skillTagMap.find(m => m.check());
            if (matched) {
                matched.cats.forEach(k => { if (!checkDisabled(k)) dmgIncMap[k] += val; });
                tag = matched.tag;
            } else {
                const elMap = { '물리': 'phys', '열기': 'heat', '전기': 'elec', '냉기': 'cryo', '자연': 'nature', '아츠': null };
                let foundEl = null;
                for (const [ek, ev] of Object.entries(elMap)) {
                    if (t.includes(ek)) { foundEl = (ek === '아츠') ? (opData.element || null) : ev; break; }
                }
                if (foundEl && dmgIncMap[foundEl] !== undefined) {
                    if (!checkDisabled('common')) {
                        dmgIncMap[foundEl] += val;
                        const opSkillElements = opData.skill ? [...new Set(opData.skill.map(s => s.element).filter(Boolean))] : [];
                        if (opSkillElements.includes(foundEl)) dmgInc += val;
                    }
                    tag = foundEl;
                } else {
                    if (!checkDisabled('common')) { dmgInc += val; dmgIncMap.all += val; }
                }
            }
        } else {
            skillTypes.forEach(st => {
                if (eff.applyToBonusHit) { bonusHitDmgIncData[st] = (bonusHitDmgIncData[st] || 0) + val; return; }
                const cat = SKILL_TYPE_CAT_MAP[st];
                if (cat && !checkDisabled(cat)) dmgIncMap[cat] += val;
            });
            tag = 'skill';
        }
        const skillTypeHtml = skillTypes ? ` (<span class="tooltip-highlight">${skillTypes.join(', ')}</span>)` : '';
        logs.dmgInc.push({ txt: `[${displayName}] ${t} ${_valDisplay(val, t)}${stackSuffix}${skillTypeHtml}`, uid: eff.uid, tag, skillType: skillTypes, stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });
    }

    // ---- 스킬 배율 증가 처리 서브 함수 ----
    function _handleSkillMult(eff, val, t, displayName, checkDisabled, stackSuffix, isBonusMult) {
        const targetMults = isBonusMult ? bonusMults : skillMults;
        const addVal = eff.dmg ? resolveVal(eff.dmg, stats, eff.dmgScaling || eff.scaling, eff._sourceOpId, state) * (eff.forgeMult || 1.0) : 0;
        const getCat = (st) => SKILL_TYPE_CAT_MAP[st] || 'common';
        const addTargetMult = (st) => {
            const cat = getCat(st);
            if (!checkDisabled(cat)) {
                if (typeof targetMults[st] === 'number') targetMults[st] = { mult: targetMults[st], add: 0 };
                else if (!targetMults[st]) targetMults[st] = { mult: 0, add: 0 };
                targetMults[st].mult += val;
                targetMults[st].add += addVal;
            }
        };
        if (eff.skillType) { eff.skillType.forEach(st => addTargetMult(st)); }
        else { addTargetMult('all'); }
        const nVal = parseFloat(eff.val !== undefined ? eff.val : (eff.dmg !== undefined ? eff.dmg : 0)) || 0;
        const multDisplay = eff.dmg !== undefined ? `+${nVal}%` : `*${(1 + nVal / 100).toFixed(2)}`;
        const skillTypeHtml = eff.skillType ? ` (<span class="tooltip-highlight">${eff.skillType.join(', ')}</span>)` : '';
        logs.dmgInc.push({ txt: `[${displayName}] ${t} ${multDisplay}${stackSuffix}${skillTypeHtml}`, uid: eff.uid, tag: 'skillMult', skillType: eff.skillType, stack: eff.stack, val: nVal, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });
    }

    // ---- 공통 유틸 (클로저로 각 핸들러에서 참조) ----
    // valDisplay: 퍼센트/절댓값 여부에 따라 + 부호와 % 접미 자동 처리
    function _valDisplay(val, t) {
        const pcts = ['증폭', '피해', '확률', '효율', '감소', '취약', '공격력 증가', '스탯 공격 보너스'];
        let disp = (val > 0 ? '+' : '') + val.toFixed(val % 1 === 0 ? 0 : 1);
        if (pcts.some(kw => t.includes(kw)) || t === '공격력 증가' || t === '스탯 공격 보너스') {
            if (!disp.endsWith('%')) disp += '%';
        }
        return disp;
    }
    // 원시 val 값에서 단순 표시 문자열 생성 (스탯/저항 감소 등)
    function _rawValDisplay(eff) {
        let v = eff.val !== undefined ? eff.val : eff.dmg;
        if (typeof v === 'number' && v > 0) v = '+' + v;
        else if (typeof v === 'string' && !v.startsWith('-') && !v.startsWith('+')) v = '+' + v;
        return v;
    }
    // stackSuffix 생성 유틸
    function _makeStackSuffix(eff) {
        return eff.stack ? ` <span class="tooltip-highlight">(${eff._stackCount}중첩)</span>` : '';
    }
    // skillTyped 효과 적용 + 로그
    function _applySkillTypedEffect(eff, val, dataObj, logArr, label, extra = {}) {
        const displayName = (eff.name || '').replace(/(_t|_s)\d+$/g, '');
        const stackSuffix = _makeStackSuffix(eff);
        const vd = _valDisplay(val, label);
        if (eff.skillType) {
            const skTypes = eff.skillType;
            skTypes.forEach(st => {
                if (dataObj && !state.disabledEffects.includes(eff.uid) && !eff._triggerFailed) {
                    dataObj[st] = (dataObj[st] || 0) + val;
                }
            });
            logArr.push({ txt: `[${displayName}] ${label} ${vd}${stackSuffix} (<span class="tooltip-highlight">${skTypes.join(', ')}</span>)`, uid: eff.uid, skillType: eff.skillType, stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed, ...extra });
        } else {
            logArr.push({ txt: `[${displayName}] ${label} ${vd}${stackSuffix}`, uid: eff.uid, stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed, ...extra });
        }
    }
    // ---- 효과 순회 및 핸들러 디스패치 ----
    allEffects.forEach(eff => {
        const displayName = (eff.name || '').replace(/(_t|_s)\d+$/g, '');
        const t = (eff.type || '').toString();

        // 스탯/저항 감소는 val 정규화 전에 처리
        if (t === '스탯' || t === '스탯%') {
            const stackSuffix = _makeStackSuffix(eff);
            EFFECT_HANDLERS[t](eff, null, t, displayName, null, stackSuffix);
            return;
        }
        if (t === '저항 감소') {
            EFFECT_HANDLERS[t](eff, null, t, displayName, null, '');
            return;
        }

        if (!isApplicableEffect(opData, eff.type, eff.name)) return;

        const val = resolveVal(eff.val, stats, eff.scaling, eff._sourceOpId, state) * (eff.forgeMult || 1.0);
        const stackSuffix = _makeStackSuffix(eff);

        const checkDisabled = (cat) => {
            if (state.disabledEffects.includes(eff.uid) || !!eff._triggerFailed) return true;
            if (cat && state.disabledEffects.includes(`${eff.uid}#${cat}`)) return true;
            if (state.calculationTag && state.disabledEffects.includes(`${eff.uid}#${state.calculationTag}`)) return true;
            return false;
        };

        // 1) 정확히 일치하는 핸들러 먼저 시도
        const exactHandler = EFFECT_HANDLERS[t];
        if (exactHandler) {
            exactHandler(eff, val, t, displayName, checkDisabled, stackSuffix);
            return;
        }
        // 2) 패턴 기반 처리 (접미사/접두사 분기)
        _handleByPattern(eff, val, t, displayName, checkDisabled, stackSuffix);
    });

    stats.originiumArts = originiumArts;
    stats.abnormalMults = abnormalMults;

    // ---- 디버프 직접 적용 ----
    const getSecondaryAmpRaw = (opId) => {
        if (!opId) return { ampRaw: 0, abnormalMults: {}, opName: null };
        let arts = 0, pName = null, abnM = {};
        if (state.mainOp.id === opId) {
            arts = originiumArts; pName = opData.name; abnM = abnormalMults;
        } else {
            const cached = state._subStatsCache?.[opId];
            if (cached) { arts = cached.originiumArts || 0; abnM = cached.abnormalMults || {}; }
            const subOpData = getOperatorData(opId);
            if (subOpData) pName = subOpData.name;
        }
        return { ampRaw: (2 * arts) / (300 + arts), abnormalMults: abnM, opName: pName };
    };

    const attr = state.debuffState.attribution || {};

    const ARMOR_BREAK_BONUS = [0, 12, 16, 20, 24];
    const abStacks = state.debuffState.physDebuff?.armorBreak || 0;
    if (abStacks > 0) {
        const { ampRaw, abnormalMults: aMults, opName } = getSecondaryAmpRaw(attr['갑옷 파괴']);
        let customMultTotal = 0;
        const multList = aMults['갑옷 파괴'] || [];
        multList.forEach(m => { if (!m.disabled) customMultTotal += m.val; });
        const ampFactor = 1 + ampRaw;
        const baseAbValFloat = ARMOR_BREAK_BONUS[abStacks] * ampFactor;
        const baseAbVal = parseFloat(baseAbValFloat.toFixed(1));
        abVal = parseFloat((baseAbValFloat * (1 + customMultTotal / 100)).toFixed(1));
        const abDisabled = state.disabledEffects.includes('debuff_armorBreak');
        if (!abDisabled) takenDmgMap.phys += abVal;
        const msgSuffix = ampFactor > 1 && opName ? ` <span class="tooltip-highlight">(${opName})</span>` : '';
        logs.taken.push({ txt: `[갑옷 파괴 ${abStacks}단계] 받는 물리 피해 +${baseAbVal}%${msgSuffix}`, uid: 'debuff_armorBreak', tag: 'phys', _triggerFailed: abDisabled });
        multList.forEach(m => {
            const extraVal = parseFloat((baseAbValFloat * (m.val / 100)).toFixed(1));
            if (extraVal > 0 || m.disabled) logs.taken.push({ txt: `[${m.name}] 받는 물리 피해 +${extraVal}%`, uid: m.uid, tag: 'phys', _triggerFailed: m.disabled || abDisabled });
        });
    }

    const BUSIK_RED = [0, 12, 16, 20, 24];
    const busikStacks = state.debuffState.artsAbnormal['부식'] || 0;
    if (busikStacks > 0) {
        const { ampRaw, abnormalMults: aMults, opName } = getSecondaryAmpRaw(attr['부식']);
        let customMultTotal = 0;
        const multList = aMults['부식'] || [];
        multList.forEach(m => { if (!m.disabled) customMultTotal += m.val; });
        const ampFactor = 1 + ampRaw;
        const baseBusikValFloat = BUSIK_RED[busikStacks] * ampFactor;
        const baseBusikVal = parseFloat(baseBusikValFloat.toFixed(1));
        busikVal = parseFloat((baseBusikValFloat * (1 + customMultTotal / 100)).toFixed(1));
        const busikDisabled = state.disabledEffects.includes('debuff_busik');
        if (!busikDisabled) ALL_RES_KEYS.forEach(k => resistance[k] -= busikVal);
        const msgSuffix = ampFactor > 1 && opName ? ` <span class="tooltip-highlight">(${opName})</span>` : '';
        logs.res.push({ txt: `[부식 ${busikStacks}단계] 모든 저항 -${baseBusikVal}${msgSuffix}`, uid: 'debuff_busik', _triggerFailed: busikDisabled });
        multList.forEach(m => {
            const extraVal = parseFloat((baseBusikValFloat * (m.val / 100)).toFixed(1));
            if (extraVal > 0 || m.disabled) logs.res.push({ txt: `[${m.name}] 모든 저항 -${extraVal}`, uid: m.uid, _triggerFailed: m.disabled || busikDisabled });
        });
    }

    const GAMSUN_BONUS = [0, 12, 16, 20, 24];
    const gamsunStacks = state.debuffState.artsAbnormal['감전'] || 0;
    if (gamsunStacks > 0) {
        const { ampRaw, abnormalMults: aMults, opName } = getSecondaryAmpRaw(attr['감전']);
        let customMultTotal = 0;
        const multList = aMults['감전'] || [];
        multList.forEach(m => { if (!m.disabled) customMultTotal += m.val; });
        const ampFactor = 1 + ampRaw;
        const baseGamsunValFloat = GAMSUN_BONUS[gamsunStacks] * ampFactor;
        const baseGamsunVal = parseFloat(baseGamsunValFloat.toFixed(1));
        gamsunVal = parseFloat((baseGamsunValFloat * (1 + customMultTotal / 100)).toFixed(1));
        const gamsunDisabled = state.disabledEffects.includes('debuff_gamsun');
        if (!gamsunDisabled) takenDmgMap.arts += gamsunVal;
        const msgSuffix = ampFactor > 1 && opName ? ` <span class="tooltip-highlight">(${opName})</span>` : '';
        logs.taken.push({ txt: `[감전 ${gamsunStacks}단계] 받는 아츠 피해 +${baseGamsunVal}%${msgSuffix}`, uid: 'debuff_gamsun', tag: 'arts', _triggerFailed: gamsunDisabled });
        multList.forEach(m => {
            const extraVal = parseFloat((baseGamsunValFloat * (m.val / 100)).toFixed(1));
            if (extraVal > 0 || m.disabled) logs.taken.push({ txt: `[${m.name}] 받는 아츠 피해 +${extraVal}%`, uid: m.uid, tag: 'arts', _triggerFailed: m.disabled || gamsunDisabled });
        });
    }

    const statBonusPct = (stats[opData.mainStat] * 0.005) + (stats[opData.subStat] * 0.002) + (statBonusBase / 100);
    const finalAtk = (baseAtk * (1 + atkInc / 100) + fixedAtk) * (1 + statBonusPct);

    logs.atk = [
        atkBaseLogs[0], atkBaseLogs[1],
        ...logs.atkBuffs, ...logs.fixedAtk, ...statLogs,
        { txt: `스탯 공격 보너스: +${(statBonusPct * 100).toFixed(2)}%`, uid: 'stat_bonus_atk' },
        ...logs.statAtkBuffs
    ];

    const finalCritRate = Math.min(Math.max(critRate, 0), 100);
    const critExp = ((finalCritRate / 100) * (critDmg / 100)) + 1;
    let finalUnbal = unbalanceDmg + (state.enemyUnbalanced ? 30 : 0);
    logs.unbal.push({ txt: `[불균형 기본] +30.0%`, uid: 'unbalance_base', _triggerFailed: !state.enemyUnbalanced });

    const resKeyMap = { heat: '열기', elec: '전기', cryo: '냉기', nature: '자연' };
    const activeResKey = opData.type === 'phys' ? '물리' : (resKeyMap[opData.element] || null);
    const baseResVal = activeResKey ? resistance[activeResKey] : 0;
    const activeResVal = baseResVal - resIgnore;
    const resMult = 1 - activeResVal / 100;

    const defVal = state.enemyDefense !== undefined ? state.enemyDefense : 100;
    const defMult = 1 / (0.01 * defVal + 1);

    let opVuln = vulnMap['취약'] || 0;
    if (activeResKey) opVuln += (vulnMap[`${activeResKey} 취약`] || 0);

    let opTakenDmg = takenDmgMap.all || 0;
    if (opData.type === 'phys') opTakenDmg += takenDmgMap.phys;
    else if (opData.type === 'arts') {
        opTakenDmg += takenDmgMap.arts;
        if (opData.element && takenDmgMap[opData.element]) opTakenDmg += takenDmgMap[opData.element];
    }

    let finalDmg = finalAtk * critExp * (1 + dmgInc / 100) * (1 + amp / 100) * (1 + opTakenDmg / 100) * (1 + opVuln / 100) * multiHit * (1 + finalUnbal / 100) * resMult * defMult;

    const swordsman = allEffects.find(e => e.setId === 'set_swordsman' && e.triggered);
    if (swordsman) {
        const extraDmg = finalAtk * 2.5;
        finalDmg += extraDmg;
        logs.dmgInc.push({ txt: `[검술사 추가피해] +${Math.floor(extraDmg).toLocaleString()}`, uid: 'swordsman_extra' });
    }

    let baseUltCost = 0;
    if (opData.skill) {
        const ultSkill = opData.skill.find(s => s.skillType && s.skillType.includes('궁극기'));
        if (ultSkill) baseUltCost = ultSkill.cost || 0;
    }
    const finalUltCost = Math.max(0, (baseUltCost * (1 - ultCostReduction / 100)) / (1 + ultRecharge / 100));

    const artsSecondary = (2 * originiumArts) / (300 + originiumArts) * 100;

    logs.dmgInc.push({ txt: `[레벨 계수] 물리 이상 +${(LEVEL_COEFF_PHYS * 100).toFixed(1)}%`, uid: 'level_coeff_phys', tag: 'phys' });
    logs.dmgInc.push({ txt: `[레벨 계수] 아츠 이상/폭발 +${(LEVEL_COEFF_ARTS * 100).toFixed(1)}%`, uid: 'level_coeff_arts', tag: 'arts' });

    return {
        finalDmg,
        activeEffects,
        stats: {
            finalAtk, atkInc, baseAtk, statBonusPct, skillAtkIncData,
            mainStatName: STAT_NAME_MAP[opData.mainStat], mainStatVal: stats[opData.mainStat],
            subStatName: STAT_NAME_MAP[opData.subStat], subStatVal: stats[opData.subStat],
            str: stats.str, agi: stats.agi, int: stats.int, wil: stats.wil,
            critExp, finalCritRate, critDmg, dmgInc, amp, vuln: opVuln, takenDmg: opTakenDmg, unbalanceDmg: finalUnbal,
            originiumArts, skillMults, bonusMults, dmgIncData: dmgIncMap, bonusHitDmgIncData,
            skillCritData, resistance: activeResVal, resMult, defMult, enemyDefense: defVal,
            ultRecharge, finalUltCost, vulnMap, takenDmgMap, vulnAmpEffects,
            allRes: resistance, armorBreakVal: abVal, gamsunVal, baseTakenDmg: takenDmgMap.all,
            resIgnore, levelCoeffPhys: LEVEL_COEFF_PHYS, levelCoeffArts: LEVEL_COEFF_ARTS, artsSecondary, abnormalMults
        },
        logs
    };
}

// ---- 유틸리티 함수 ----
function resolveVal(val, stats, scaling, sourceOpId = null, state = null) {
    let result = (typeof val === 'number') ? val : (parseFloat(val) || 0);

    let activeStats = stats;
    if (sourceOpId && state && state.mainOp && state.mainOp.id !== sourceOpId) {
        if (state._subStatsCache && state._subStatsCache[sourceOpId]) {
            activeStats = state._subStatsCache[sourceOpId];
        } else {
            const subOp = state.subOps?.find(o => o.id === sourceOpId);
            if (subOp && subOp.cachedStats) activeStats = subOp.cachedStats;
        }
    }

    if (scaling && activeStats) {
        const statsToSum = Array.isArray(scaling.stat) ? scaling.stat : [scaling.stat];
        let sVal = 0;
        statsToSum.forEach(s => { sVal += (activeStats[s] || 0); });
        const ratio = (typeof scaling.ratio === 'string') ? parseFloat(scaling.ratio) : (scaling.ratio || 0);
        const max = (typeof scaling.max === 'string') ? parseFloat(scaling.max) : (scaling.max || 999999);
        result += Math.min(max, sVal * ratio);
    }

    return result;
}

// ---- 무기 특성 레벨/값 ----
function calculateWeaponTraitLevel(idx, wepState, pot) {
    if (idx === 0 || idx === 1) return wepState ? 9 : 3;
    return (wepState ? 4 : 1) + pot;
}

function calculateWeaponTraitValue(trait, level) {
    if (trait.valByLevel?.length > 0) {
        return trait.valByLevel[Math.min(level - 1, trait.valByLevel.length - 1)];
    }
    return 0;
}

// ---- 효과 유효성 판단 ----
function isSubOpTargetValid(effect) {
    return effect && (effect.target === '팀' || effect.target === '팀_외' || effect.target === '적');
}

const ALWAYS_ON_EFFECTS = new Set([
    '공격력 증가', '치명타 확률', '치명타 피해', '최대 생명력', '궁극기 충전 효율', '궁극기 에너지 감소', '치유 효율', '연타',
    '주는 피해', '스탯', '스탯%', '스킬 피해', '궁극기 피해', '연계 스킬 피해', '배틀 스킬 피해',
    '일반 공격 피해', '오리지늄 아츠', '오리지늄 아츠 강도', '모든 스킬 피해', '스킬 배율 증가',
    '스킬 치명타 확률', '스킬 치명타 피해', '상태 이상 배율', '추가 공격 피해 배율 증가', '스탯 공격 보너스'
]);

function isApplicableEffect(opData, effectType, effectName) {
    if (!effectType) return false;
    const type = effectType.toString();

    if (ALWAYS_ON_EFFECTS.has(type) || type === '불균형 목표에 주는 피해') return true;

    const checkElement = (prefix) => {
        const p = prefix ? prefix.trim() : '';
        if (!p || p === '피해' || p === '모든' || p === '취약') return true;
        if (p === '아츠' && opData.type === 'arts') return true;
        if (p === '물리' && opData.type === 'phys') return true;
        if (p === '열기' && opData.element === 'heat') return true;
        if (p === '냉기' && opData.element === 'cryo') return true;
        if (p === '전기' && opData.element === 'elec') return true;
        if (p === '자연' && opData.element === 'nature') return true;
        const skillElements = opData.skill ? opData.skill.map(s => s.element).filter(Boolean) : [];
        const elPrefixMap = { '물리': 'phys', '열기': 'heat', '전기': 'elec', '냉기': 'cryo', '자연': 'nature' };
        const mappedEl = elPrefixMap[p];
        if (mappedEl && skillElements.includes(mappedEl)) return true;
        return false;
    };

    if (type.endsWith('취약 증폭')) return checkElement(type.replace('취약 증폭', ''));
    if (type.endsWith('증폭')) return checkElement(type.replace('증폭', ''));
    if (type.includes('받는') || type.endsWith('취약')) {
        const prefix = type.replace('받는 ', '').replace(' 피해', '').replace(' 취약', '');
        return checkElement(prefix);
    }
    if (type.endsWith('저항 무시')) return checkElement(type.replace('저항 무시', ''));
    return checkElement(type.replace(' 피해', ''));
}

// ---- 세트 관련 ----
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
        if (isSelf && eff.targetFilter === '자신 제외') return false;
        return true;
    }).map(eff => eff.type === '검술사_추가피해'
        ? { ...eff, setId: 'set_swordsman', triggered: true }
        : { ...eff }
    );
}

function getValidWeapons(opId) {
    const op = getOperatorData(opId);
    return op?.usableWeapons ? DATA_WEAPONS.filter(w => op.usableWeapons.includes(w.type)) : [];
}

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
    if (cond.length === 0) return true;
    return cond.some(eff => eff.triggers.some(matchTrigger));
}

const OP_CAPABILITY_CACHE = new Map();

function evaluateTrigger(trigger, state, opData, triggerType, evalMode = 'both', effectTarget = null, strictMode = false) {
    if (!trigger || trigger.length === 0) return true;

    const triggers = Array.isArray(trigger) ? trigger : [trigger];
    return triggers.some(t => {
        if (t === '물리 이상') {
            return PHYS_ANOMALY_TAGS.some(tag => evaluateTrigger(tag, state, opData, triggerType, evalMode, effectTarget, strictMode));
        }

        if (evalMode === 'both' || evalMode === 'target') {
            const specialStackVal = state.getSpecialStack ? state.getSpecialStack() : (state.mainOp?.specialStack || 0);
            let isTriggerMet = false;
            switch (t) {
                case '방어 불능': isTriggerMet = getAdjustedStackCount('방어 불능', state, opData, triggerType) > 0; break;
                case '갑옷 파괴': isTriggerMet = getAdjustedStackCount('갑옷 파괴', state, opData, triggerType) > 0; break;
                case '열기 부착': isTriggerMet = state.debuffState?.artsAttach?.type === '열기 부착'; break;
                case '냉기 부착': isTriggerMet = state.debuffState?.artsAttach?.type === '냉기 부착'; break;
                case '전기 부착': isTriggerMet = state.debuffState?.artsAttach?.type === '전기 부착'; break;
                case '자연 부착': isTriggerMet = state.debuffState?.artsAttach?.type === '자연 부착'; break;
                case '연소': isTriggerMet = getAdjustedStackCount('연소', state, opData, triggerType) > 0; break;
                case '감전': isTriggerMet = getAdjustedStackCount('감전', state, opData, triggerType) > 0; break;
                case '동결': isTriggerMet = getAdjustedStackCount('동결', state, opData, triggerType) > 0; break;
                case '부식': isTriggerMet = getAdjustedStackCount('부식', state, opData, triggerType) > 0; break;
                case '연타': isTriggerMet = (state.debuffState?.physDebuff?.combo || 0) > 0; break;
                case '띄우기': isTriggerMet = state.triggerActive?.['띄우기'] || state.triggerActive?.['강제 띄우기']; break;
                case '넘어뜨리기': isTriggerMet = state.triggerActive?.['넘어뜨리기'] || state.triggerActive?.['강제 넘어뜨리기']; break;
                case '강타': isTriggerMet = state.triggerActive?.['강타']; break;
                case '허약': isTriggerMet = state.triggerActive?.['허약']; break;
                case '물리 취약': isTriggerMet = state.triggerActive?.['물리 취약']; break;
                case '아츠 취약': isTriggerMet = state.triggerActive?.['아츠 취약']; break;
                case '열기 취약': isTriggerMet = state.triggerActive?.['열기 취약']; break;
                case '냉기 취약': isTriggerMet = state.triggerActive?.['냉기 취약']; break;
                case '전기 취약': isTriggerMet = state.triggerActive?.['전기 취약']; break;
                case '자연 취약': isTriggerMet = state.triggerActive?.['자연 취약']; break;
                case '불균형': isTriggerMet = !!state.enemyUnbalanced; break;
            }
            if (isTriggerMet) return true;

            const op = opData;
            if (op && op.specialStack) {
                const stacks = Array.isArray(op.specialStack) ? op.specialStack : [op.specialStack];
                const matchingStack = stacks.find(s => s.triggers && s.triggers.includes(t));
                if (matchingStack) {
                    const stackId = matchingStack.id || 'default';
                    const val = typeof specialStackVal === 'object' ? (specialStackVal[stackId] || 0) : specialStackVal;
                    if (val > 0) return true;
                    if (strictMode) return false;
                }
            }
        }

        if (opData && (evalMode === 'both' || evalMode === 'op')) {
            const checkOpCapability = (targetOp) => {
                if (!targetOp) return false;
                const triggerTypeStr = Array.isArray(triggerType) ? triggerType.join(',') : (triggerType || '');
                const cacheKey = `${targetOp.id}_${t}_${triggerTypeStr}`;
                if (OP_CAPABILITY_CACHE.has(cacheKey)) return OP_CAPABILITY_CACHE.get(cacheKey);

                let result = false;
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
                    const skillData = (s.levels && s.levels.M3) ? { ...s, ...s.levels.M3 } : s;
                    if (!skillData.type) return false;
                    const typeItems = Array.isArray(skillData.type) ? skillData.type : [skillData.type];
                    return typeItems.some(item => {
                        const tName = (typeof item === 'object' && item !== null) ? item.type : item;
                        return Array.isArray(tName) ? tName.some(tn => checkTypes.includes(tn)) : checkTypes.includes(tName);
                    });
                });

                if (hasInSkill) {
                    result = true;
                } else if (!triggerType || (Array.isArray(triggerType) ? triggerType.length === 0 : !triggerType)) {
                    let hasInOther = false;
                    const checkArr = (arr) => arr.some(subArr => subArr && subArr.some(e => e.type && (Array.isArray(e.type) ? e.type.some(et => checkTypes.includes(et)) : checkTypes.includes(e.type))));
                    if (targetOp.talents && checkArr(targetOp.talents)) hasInOther = true;
                    if (!hasInOther && targetOp.potential && checkArr(targetOp.potential)) hasInOther = true;
                    if (hasInOther) result = true;
                    else if (t === targetOp.type || t === targetOp.element) result = true;
                }

                OP_CAPABILITY_CACHE.set(cacheKey, result);
                return result;
            };

            if (checkOpCapability(opData)) return true;
            if (effectTarget === '팀' && !strictMode) {
                const mainOpData = getOperatorData(state.mainOp?.id);
                if (mainOpData && mainOpData.id !== opData.id && checkOpCapability(mainOpData)) return true;
            }
        }

        if (t === '상시' || t === '팀_상시' || t.startsWith('메인_')) return true;

        if (state.mainOp?.skill) {
            if (t === '배틀 스킬 중' && state.mainOp.skill === '배틀 스킬') return true;
            if ((t === '연계 스킬 중' || t === '팀_연계 스킬 방출') && state.mainOp.skill === '연계 스킬') return true;
            if ((t === '궁극기 중' || t === '궁극기 방출') && state.mainOp.skill === '궁극기') return true;
        }

        if (state.triggerActive && state.triggerActive[t]) return true;
        return false;
    });
}

// ---- 스킬 단일 데미지 계산 ----
function calcSingleSkillDamage(type, state, res) {
    const opData = getOperatorData(state.mainOp.id);
    const skillMap = {};
    opData.skill.forEach(s => {
        if (s?.skillType) s.skillType.forEach(st => skillMap[st] = s);
    });

    let originalSkillDef = skillMap[type];
    if (!originalSkillDef) return null;

    let skillDef = { ...originalSkillDef };
    const skillNameForLvl = Array.isArray(type) ? type[0] : type;
    const baseTypeForLvl = originalSkillDef.masterySource || (skillNameForLvl.startsWith('강화 ') ? skillNameForLvl.substring(3) : skillNameForLvl);
    const selectedLevel = state.mainOp?.skillLevels?.[baseTypeForLvl] || 'M3';

    if (originalSkillDef.levels && originalSkillDef.levels[selectedLevel]) {
        const lvlData = originalSkillDef.levels[selectedLevel];
        if (lvlData.dmg !== undefined) skillDef.dmg = lvlData.dmg;
        if (lvlData.type !== undefined) skillDef.type = lvlData.type;
        if (lvlData.bonus !== undefined) skillDef.bonus = lvlData.bonus;
        if (lvlData.cost !== undefined) skillDef.cost = lvlData.cost;
        if (lvlData.target !== undefined) skillDef.target = lvlData.target;
        if (lvlData.element !== undefined) skillDef.element = lvlData.element;
        if (lvlData.desc !== undefined) skillDef.desc = lvlData.desc;
    }

    const { finalAtk, atkInc, baseAtk, statBonusPct, skillAtkIncData = { all: 0 }, critExp, finalCritRate, critDmg, amp, vuln, takenDmg, unbalanceDmg, resMult, defMult = 1, originiumArts = 0, skillMults = { all: { mult: 0, add: 0 } }, bonusMults = { all: { mult: 0, add: 0 } }, dmgIncData = { all: 0, skill: 0, normal: 0, battle: 0, combo: 0, ult: 0 }, skillCritData = { rate: { all: 0 }, dmg: { all: 0 } }, vulnMap = {}, takenDmgMap = { all: 0, phys: 0, arts: 0, heat: 0, elec: 0, cryo: 0, nature: 0 }, vulnAmpEffects = [], bonusHitDmgIncData = {} } = res.stats;

    const parseDmgPct = (v) => {
        if (!v || v === 0) return 0;
        if (typeof v === 'string') {
            const idx = v.indexOf('%');
            return idx !== -1 ? parseFloat(v.substring(0, idx)) / 100 : (parseFloat(v) / 100 || 0);
        }
        return v / 100 || 0;
    };
    let dmgMult = parseDmgPct(skillDef.dmg);

    const op = opData;
    const skillTypes = skillDef.type ? (Array.isArray(skillDef.type) ? skillDef.type : [skillDef.type]) : [];
    const baseSkillElement = skillDef.element || (opData.type === 'phys' ? 'phys' : opData.element);

    const bSkillName = Array.isArray(type) ? type[0] : type;
    const bBaseType = bSkillName.startsWith('강화 ') ? bSkillName.substring(3) : bSkillName;
    let bMult = 0;
    if (bonusMults) {
        if (typeof bonusMults === 'number') { bMult = bonusMults; }
        else {
            const addObjB = (obj) => { if (typeof obj === 'number') bMult += obj; else if (obj) bMult += (obj.mult || 0); };
            addObjB(bonusMults.all);
            addObjB(bonusMults[bBaseType]);
            if (type !== bBaseType) addObjB(bonusMults[type]);
        }
    }

    const bonusList = [];
    if (skillDef.bonus) {
        skillDef.bonus.forEach(b => {
            if (b.masterySource && b.levels) {
                const bonusMasteryLevel = state.mainOp?.skillLevels?.[b.masterySource] || 'M3';
                if (b.levels[bonusMasteryLevel]) b = { ...b, ...b.levels[bonusMasteryLevel] };
            }

            const opTriggerMet = !b.trigger || evaluateTrigger(b.trigger, state, opData, b.triggerType, 'op', b.target, true);
            const targetTriggerMet = !b.triggerTarget || evaluateTrigger(b.triggerTarget, state, opData, b.triggerType, 'target', b.target, true);
            let triggerMet = opTriggerMet && targetTriggerMet;

            const combinedTriggers = [
                ...(Array.isArray(b.trigger) ? b.trigger : (b.trigger ? [b.trigger] : [])),
                ...(Array.isArray(b.triggerTarget) ? b.triggerTarget : (b.triggerTarget ? [b.triggerTarget] : []))
            ];

            if (!triggerMet && (b.trigger || b.triggerTarget) && vulnMap) {
                if (combinedTriggers.some(t => vulnMap[t] > 0 || vulnMap['취약'] > 0)) triggerMet = true;
            }

            if (triggerMet) {
                if (b.type) {
                    const bTypes = Array.isArray(b.type) ? b.type : [b.type];
                    bTypes.forEach(bt => { if (!skillTypes.includes(bt)) skillTypes.push(bt); });
                }

                const parsePct = (v) => v ? parseFloat(String(v)) / 100 : 0;
                const trName = combinedTriggers.join(', ');

                if (b.base !== undefined || b.perStack !== undefined) {
                    let stackCount = 0;
                    for (const t of combinedTriggers) {
                        stackCount = Math.max(stackCount, getAdjustedStackCount(t, state, opData, skillDef.skillType));
                    }
                    const bp = b.perStack;
                    const bb = b.base !== undefined ? b.base : (b.val !== undefined ? b.val : 0);
                    const bonusVal = ((parseFloat(bb) + parseFloat(bp) * stackCount) / 100) * (1 + bMult / 100);
                    if (bonusVal > 0) {
                        const isStackable = b.perStack !== undefined && parseFloat(b.perStack) !== 0;
                        const isSeparate = b.isSeparateHit || (b.element && b.element !== baseSkillElement);
                        if (isSeparate) {
                            bonusList.push({ name: trName, val: bonusVal, stack: isStackable ? stackCount : undefined, isStackable, isSeparateHit: true, element: b.element || baseSkillElement, bonusDmgInc: b.bonusDmgInc, skillType: b.skillType });
                        } else {
                            dmgMult += bonusVal;
                            bonusList.push({ name: trName, val: bonusVal, stack: isStackable ? stackCount : undefined, isStackable });
                        }
                    }
                } else if (b.stackValues !== undefined) {
                    let stackCount = 0;
                    for (const t of combinedTriggers) {
                        stackCount = Math.max(stackCount, getAdjustedStackCount(t, state, opData, skillDef.skillType));
                    }
                    const valAtStack = b.stackValues[stackCount] || b.stackValues[String(stackCount)];
                    if (valAtStack) {
                        const bonusVal = parsePct(valAtStack) * (1 + bMult / 100);
                        if (bonusVal > 0) {
                            const isSeparate = b.isSeparateHit || (b.element && b.element !== baseSkillElement);
                            if (isSeparate) {
                                bonusList.push({ name: trName + ` (${stackCount}스택)`, val: bonusVal, isSeparateHit: true, element: b.element || baseSkillElement, bonusDmgInc: b.bonusDmgInc, skillType: b.skillType });
                            } else {
                                dmgMult += bonusVal;
                                bonusList.push({ name: trName + ` (${stackCount}스택)`, val: bonusVal });
                            }
                        }
                    }
                } else if (b.val) {
                    const bonusVal = parsePct(b.val) * (1 + bMult / 100);
                    const isSeparate = b.isSeparateHit || (b.element && b.element !== baseSkillElement);
                    if (isSeparate) {
                        bonusList.push({ name: trName, val: bonusVal, isSeparateHit: true, element: b.element || baseSkillElement, bonusDmgInc: b.bonusDmgInc, skillType: b.skillType });
                    } else {
                        dmgMult += bonusVal;
                        bonusList.push({ name: trName, val: bonusVal });
                    }
                }
            }
        });
    }

    const abnormalList = [];
    const defenselessStacks = state.debuffState?.physDebuff?.defenseless || 0;
    const hasDefenseless = defenselessStacks > 0;
    let abnormalMultTotal = 0;

    skillTypes.forEach(t => {
        if (!t) return;
        if (typeof t === 'object' && t.excludeTarget) {
            const isExcluded = evaluateTrigger(t.excludeTarget, state, opData, null, 'target', skillDef.target);
            if (isExcluded) return;
        }
        if (typeof t === 'object' && t.triggerTarget) {
            const isTargetMet = evaluateTrigger(t.triggerTarget, state, opData, null, 'target', skillDef.target);
            if (!isTargetMet) return;
        }
        if (typeof t === 'object' && t.trigger) {
            const isTriggerMet = evaluateTrigger(t.trigger, state, opData, null, 'op', skillDef.target);
            if (!isTriggerMet) return;
        }

        const typeName = typeof t === 'string' ? t : t.type;
        let addMult = 0;

        if (typeName === '강타') {
            if (hasDefenseless) addMult = 1.5 + (defenselessStacks * 1.5);
        } else if (typeName === '띄우기' || typeName === '넘어뜨리기') {
            if (hasDefenseless) addMult = 1.2;
        } else if (typeName === '강제 띄우기' || typeName === '강제 넘어뜨리기') {
            addMult = 1.2;
        } else if (typeName === '갑옷 파괴') {
            if (hasDefenseless) addMult = 0.5 + (defenselessStacks * 0.5);
        }

        if (addMult > 0 || PHYS_ANOMALY_TAGS.includes(typeName)) {
            abnormalList.push({ name: typeName, mult: addMult, triggerName: '방어 불능', stackCount: defenselessStacks });
            abnormalMultTotal += addMult;
        }

        const freezeStacks = state.debuffState?.artsAbnormal?.['동결'] || 0;
        const isPhysAnomaly = PHYS_ANOMALY_TAGS.includes(typeName) || ['방어 불능 부여', '방어 불능'].includes(typeName);
        if (freezeStacks > 0 && isPhysAnomaly) {
            const shatterMult = 1.2 + (freezeStacks * 1.2);
            abnormalList.push({ name: '쇄빙', mult: shatterMult, triggerName: '동결', stackCount: freezeStacks, isShatter: true, originalType: typeName });
            abnormalMultTotal += shatterMult;
        }

        const artsAttach = state.debuffState?.artsAttach || { type: null, stacks: 0 };
        const currentAttachType = artsAttach.type;
        const currentStacks = artsAttach.stacks || 0;

        let nextAttachType = null;
        let isForcedAbnormal = false;

        if (typeName.includes('소모')) {
            nextAttachType = null;
        } else if (typeName.includes('부착')) {
            nextAttachType = typeName;
        } else if (typeName.includes('부여')) {
            const base = typeName.replace(' 부여', '');
            nextAttachType = base + ' 부착';
            isForcedAbnormal = true;
        }

        const ELEMENT_TO_ANOMALY = { '열기': '연소', '냉기': '동결', '전기': '감전', '자연': '부식' };

        if (nextAttachType) {
            const nextBase = nextAttachType.replace(' 부착', '');
            const currentBase = currentAttachType ? currentAttachType.replace(' 부착', '') : null;
            let artsMult = 0, artsName = '', shouldTrigger = false;

            if (currentAttachType && currentBase === nextBase) {
                artsName = '아츠 폭발';
                artsMult = isForcedAbnormal ? 0 : 1.6;
                shouldTrigger = true;
            } else if (currentAttachType || isForcedAbnormal) {
                const targetAnomaly = ELEMENT_TO_ANOMALY[nextBase] || nextBase;
                artsName = (isForcedAbnormal && targetAnomaly === '연소') ? '연소' : targetAnomaly;
                shouldTrigger = true;

                const S = currentStacks;
                if (targetAnomaly === '연소') {
                    const initial = isForcedAbnormal ? 0 : (0.8 + S * 0.8);
                    let additional = 1.2;
                    if (!isForcedAbnormal) {
                        additional = 1.2 + S * 1.2;
                    } else if (typeof t === 'object' && t.abnormalMult !== undefined) {
                        let mult = parseFloat(t.abnormalMult);
                        if (t.potOverrides && state.mainOp && opData.id === state.mainOp.id) {
                            const currentPot = Number(state.mainOp.pot) || 0;
                            const matchingPots = Object.keys(t.potOverrides).map(Number).filter(p => currentPot >= p);
                            if (matchingPots.length > 0) {
                                const maxPot = Math.max(...matchingPots);
                                if (t.potOverrides[maxPot].abnormalMult !== undefined) mult = parseFloat(t.potOverrides[maxPot].abnormalMult);
                            }
                        }
                        additional = mult / 100;
                    }
                    artsMult = initial + additional;
                } else {
                    if (isForcedAbnormal) {
                        artsMult = 0;
                    } else {
                        if (targetAnomaly === '감전') artsMult = (0.8 + S * 0.8);
                        else if (targetAnomaly === '동결') artsMult = 1.3;
                        else if (targetAnomaly === '부식') artsMult = (0.8 + S * 0.8);
                    }
                }
            }

            if (shouldTrigger) {
                abnormalList.push({
                    name: artsName, mult: artsMult, triggerName: currentAttachType || '없음', stackCount: currentStacks, isArts: true,
                    element: (artsName === '아츠 폭발') ? (currentBase === '열기' ? 'heat' : (currentBase === '전기' ? 'elec' : (currentBase === '냉기' ? 'cryo' : (currentBase === '자연' ? 'nature' : null)))) : null,
                    originalType: typeName, uiHidden: !!isForcedAbnormal && artsMult === 0
                });
                abnormalMultTotal += artsMult;
            }
        }
    });

    let abnormalDesc = '';
    const visibleAbnormals = abnormalList.filter(a => !a.uiHidden);
    if (visibleAbnormals.length > 0) {
        const artsStrengthMult = 1 + (originiumArts / 100);
        const descParts = visibleAbnormals.map(a => {
            const boostedMult = a.mult * artsStrengthMult;
            return `${a.name} +${(boostedMult * 100).toFixed(0)}%`;
        });
        abnormalDesc = ` (${descParts.join(', ')})`;
    }

    const skillName = Array.isArray(type) ? type[0] : type;
    const baseType = skillName.startsWith('강화 ') ? skillName.substring(3) : skillName;

    const SKILL_MULT_TYPES = new Set(['일반 공격', '배틀 스킬', '연계 스킬', '궁극기']);
    let sMult = 0, sAdd = 0;
    if (skillMults) {
        if (typeof skillMults === 'number') { sMult = skillMults; }
        else {
            const addObj = (obj) => { if (typeof obj === 'number') sMult += obj; else if (obj) { sMult += (obj.mult || 0); sAdd += (obj.add || 0); } };
            addObj(skillMults.all);
            addObj(skillMults[baseType]);
            if (type !== baseType) addObj(skillMults[type]);
        }
    }

    let adjDmgMult = SKILL_MULT_TYPES.has(baseType)
        ? (dmgMult + sAdd / 100) * (1 + sMult / 100)
        : dmgMult;

    let typeInc = dmgIncData.all;
    if (baseType === '일반 공격') typeInc += dmgIncData.normal;
    else typeInc += dmgIncData.skill + (dmgIncData[SKILL_TYPE_CAT_MAP[baseType]] || 0);

    const skillElement = skillDef.element || (opData.type === 'phys' ? 'phys' : opData.element);
    if (skillElement && dmgIncData[skillElement]) typeInc += dmgIncData[skillElement];

    let sCritRateBoost = (skillCritData.rate.all || 0) + (skillCritData.rate[baseType] || 0) + (type !== baseType ? (skillCritData.rate[type] || 0) : 0);
    let sCritDmgBoost = (skillCritData.dmg.all || 0) + (skillCritData.dmg[baseType] || 0) + (type !== baseType ? (skillCritData.dmg[type] || 0) : 0);
    let adjCritRate = Math.min(Math.max(finalCritRate + sCritRateBoost, 0), 100);
    let adjCritDmg = critDmg + sCritDmgBoost;
    let adjCritExp = ((adjCritRate / 100) * (adjCritDmg / 100)) + 1;

    let sAtkIncBoost = (skillAtkIncData.all || 0) + (skillAtkIncData[baseType] || 0) + (type !== baseType ? (skillAtkIncData[type] || 0) : 0);
    let adjFinalAtk = finalAtk;
    if (sAtkIncBoost > 0) {
        adjFinalAtk = baseAtk * (1 + (atkInc + sAtkIncBoost) / 100) * (1 + statBonusPct);
    }

    let finalVuln = res.stats.vulnMap['취약'] || 0;
    const elMapKO = { 'phys': '물리', 'heat': '열기', 'elec': '전기', 'cryo': '냉기', 'nature': '자연' };
    const skillElementKO = elMapKO[skillElement];
    if (skillElementKO) finalVuln += (res.stats.vulnMap[`${skillElementKO} 취약`] || 0);
    if (skillElement && skillElement !== 'phys') finalVuln += (res.stats.vulnMap['아츠 취약'] || 0);

    let finalTakenDmg = res.stats.takenDmgMap.all || 0;
    if (skillElement === 'phys') {
        finalTakenDmg += res.stats.takenDmgMap.phys;
    } else {
        finalTakenDmg += res.stats.takenDmgMap.arts;
        if (skillElement && res.stats.takenDmgMap[skillElement]) finalTakenDmg += res.stats.takenDmgMap[skillElement];
    }

    vulnAmpEffects.forEach(eff => {
        const isTypeMatch = !eff.skillType || (eff.skillType && eff.skillType.includes(baseType));
        if (isTypeMatch && !state.disabledEffects.includes(eff.uid)) {
            const targets = eff.targetEffect || (eff.type.includes('냉기 취약 증폭') ? ['냉기 취약'] : ['취약']);
            targets.forEach(tKey => {
                const vVal = vulnMap[tKey] || 0;
                if (vVal > 0) {
                    const ampVal = vVal * (resolveVal(eff.val, res.stats, null, eff._sourceOpId, state) * (eff.forgeMult || 1.0));
                    finalVuln += ampVal;
                    bonusList.push({ name: (eff.type === '취약 증폭' ? '취약 증폭' : '냉기 취약 증폭') + ` (${tKey})`, val: ampVal / 100 });
                }
            });
        }
    });

    const commonMults = adjCritExp * (1 + typeInc / 100) * (1 + amp / 100) * (1 + finalTakenDmg / 100) * (1 + finalVuln / 100) * (1 + unbalanceDmg / 100) * resMult * defMult;
    const artsStrengthMult = 1 + (originiumArts / 100);
    const abnormalInc = dmgIncData.all;
    const finalSkillCommonMults = commonMults;

    let baseHitDmg = adjFinalAtk * adjDmgMult * finalSkillCommonMults;

    const abnormalDmgMap = {};
    const resKeyMap = { heat: '열기', elec: '전기', cryo: '냉기', nature: '자연' };

    abnormalList.forEach(a => {
        const aData = DATA_ABNORMALS[a.name] || DATA_ABNORMALS[a.name.replace('(이상)', '')];
        const aElem = a.element || (aData ? aData.element : null);
        let aResMult = resMult, aVuln = vuln, aTaken = takenDmg, aInc = abnormalInc;

        if (aData) {
            const activeResKey = aElem === 'phys' ? '물리' : (resKeyMap[aElem] || null);
            if (activeResKey && res.stats.allRes) {
                const aResVal = res.stats.allRes[activeResKey] - (res.stats.resIgnore || 0);
                aResMult = 1 - aResVal / 100;
            }
            const eKey = aElem === 'phys' ? '물리' : (resKeyMap[aElem] || null);
            if (eKey) {
                aVuln = (res.stats.vulnMap['취약'] || 0) + (res.stats.vulnMap[eKey + ' 취약'] || 0);
                if (aElem !== 'phys') aVuln += (res.stats.vulnMap['아츠 취약'] || 0);
                aTaken = (res.stats.takenDmgMap.all || 0);
                if (aElem === 'phys') {
                    aTaken += (res.stats.takenDmgMap.phys || 0);
                } else {
                    aTaken += (res.stats.takenDmgMap.arts || 0);
                    if (res.stats.takenDmgMap[aElem]) aTaken += res.stats.takenDmgMap[aElem];
                }
                aInc = (res.stats.dmgIncData.all || 0) + (res.stats.dmgIncData[aElem] || 0);
            }
        }

        const aLevelCoeff = (aElem === 'phys' && a.name !== '쇄빙') ? (1 + LEVEL_COEFF_PHYS) : (1 + LEVEL_COEFF_ARTS);
        const aCommonMults = adjCritExp * (1 + aInc / 100) * (1 + amp / 100) * (1 + aTaken / 100) * (1 + aVuln / 100) * (1 + unbalanceDmg / 100) * aResMult * defMult * artsStrengthMult * aLevelCoeff;
        let aDmg = adjFinalAtk * a.mult * aCommonMults;
        if (state.mainOp.id === 'Da Pan' && a.name === '강타') aDmg *= 1.2;
        abnormalDmgMap[a.name] = (abnormalDmgMap[a.name] || 0) + Math.floor(aDmg);
    });

    bonusList.forEach(b => {
        if (!b.isSeparateHit) return;
        const bElem = b.element;
        let bResMult = resMult, bVuln = res.stats.vulnMap['취약'] || 0, bTaken = res.stats.takenDmgMap.all || 0, bInc = dmgIncData.all || 0;

        const activeResKey = bElem === 'phys' ? '물리' : (resKeyMap[bElem] || null);
        if (activeResKey && res.stats.allRes) {
            const bResVal = res.stats.allRes[activeResKey] - (res.stats.resIgnore || 0);
            bResMult = 1 - bResVal / 100;
        }
        const eKey = bElem === 'phys' ? '물리' : (resKeyMap[bElem] || null);
        if (eKey) {
            bVuln += (res.stats.vulnMap[`${eKey} 취약`] || 0);
            if (bElem !== 'phys') bVuln += (res.stats.vulnMap['아츠 취약'] || 0);
            if (bElem === 'phys') bTaken += (res.stats.takenDmgMap.phys || 0);
            else { bTaken += (res.stats.takenDmgMap.arts || 0); if (res.stats.takenDmgMap[bElem]) bTaken += res.stats.takenDmgMap[bElem]; }
            bInc += (res.stats.dmgIncData[bElem] || 0);
        }

        const bSkillType = b.skillType || baseType;
        const bCat = SKILL_TYPE_CAT_MAP[bSkillType] || 'common';
        if (bSkillType === '일반 공격') bInc += dmgIncData.normal;
        else bInc += dmgIncData.skill + (dmgIncData[bCat] || 0);
        if (b.bonusDmgInc) bInc += parseFloat(String(b.bonusDmgInc).replace('%', ''));
        if (bonusHitDmgIncData[skillName]) bInc += bonusHitDmgIncData[skillName];

        vulnAmpEffects.forEach(eff => {
            const isTypeMatch = !eff.skillType || (eff.skillType && eff.skillType.includes(baseType));
            if (isTypeMatch && !state.disabledEffects.includes(eff.uid)) {
                const targets = eff.targetEffect || (eff.type.includes('냉기 취약 증폭') ? ['냉기 취약'] : ['취약']);
                targets.forEach(tKey => {
                    const vVal = res.stats.vulnMap[tKey] || 0;
                    if (vVal > 0) bVuln += vVal * (resolveVal(eff.val, res.stats, null, eff._sourceOpId, state) * (eff.forgeMult || 1.0));
                });
            }
        });

        const adjustedBonusVal = b.val * (1 + sMult / 100);
        const bCommonMults = adjCritExp * (1 + bInc / 100) * (1 + amp / 100) * (1 + bTaken / 100) * (1 + bVuln / 100) * (1 + unbalanceDmg / 100) * bResMult * defMult;
        baseHitDmg += adjFinalAtk * adjustedBonusVal * bCommonMults;
        visibleAbnormals.push({ name: `추가 피해(${eKey || '알 수 없음'})`, mult: adjustedBonusVal, isSeparateBonus: true });
    });

    if (visibleAbnormals.length > 0) {
        const descParts = visibleAbnormals.map(a => {
            if (a.isSeparateBonus) return `${a.name} +${(a.mult * 100).toFixed(0)}%`;
            const boostedMult = (a.isArts || a.name === '아츠 폭발') ? a.mult * artsStrengthMult : a.mult;
            return `${a.name} +${(boostedMult * 100).toFixed(0)}%`;
        });
        abnormalDesc = ` (${descParts.join(', ')})`;
    }

    const myLogs = {
        ...res.logs,
        dmgInc: [...(res.logs.dmgInc || [])],
        atk: [...(res.logs.atk || [])],
        arts: [...(res.logs.arts || [])],
        vuln: [...(res.logs.vuln || [])],
        crit: [...(res.logs.crit || [])]
    };

    myLogs.dmgInc = (res.logs.dmgInc || []).filter(l => {
        if (l.uid === 'level_coeff_phys' || l.uid === 'level_coeff_arts') return false;
        if (l.tag === 'all') return false;
        if (l.tag === 'skillMult') {
            const arr = l.skillType || [];
            if (arr.length === 0) return SKILL_MULT_TYPES.has(baseType);
            return arr.includes(baseType) || arr.includes(type);
        }
        if (baseType === '일반 공격' && l.tag === 'normal') return true;
        if (baseType !== '일반 공격' && (l.tag === 'skill' || l.tag === SKILL_TYPE_CAT_MAP[baseType])) return true;
        return false;
    });

    myLogs.atk = (res.logs.atk || []).filter(l => {
        if (l.uid === 'base_op_atk' || l.uid === 'base_wep_atk' || l.uid === 'stat_bonus_atk') return true;
        if (l.tag === 'skillAtk') {
            const arr = l.skillType || [];
            if (arr.length === 0) return true;
            return arr.includes(baseType) || arr.includes(type);
        }
        return true;
    });

    let comboMult = 1;
    const comboStacks = state.debuffState?.physDebuff?.combo || 0;
    if (comboStacks > 0) {
        if (baseType === '배틀 스킬') comboMult = 1 + ([0, 30, 45, 60, 75][comboStacks] / 100);
        else if (baseType === '궁극기') comboMult = 1 + ([0, 20, 30, 40, 50][comboStacks] / 100);
    }
    if (comboMult > 1) {
        const tag = baseType === '배틀 스킬' ? 'battle' : 'ult';
        myLogs.dmgInc.push({ txt: `[연타 ${comboStacks}단계] x${comboMult.toFixed(2)} (곱연산)`, uid: 'combo_buff', tag });
    }
    if (state.mainOp.id === 'Da Pan' && abnormalDmgMap['강타'] !== undefined) {
        myLogs.dmgInc.push({ txt: `[판 고유 특성] 강타 피해 x1.20 (곱연산)`, uid: 'fan_smash_bonus', tag: SKILL_TYPE_CAT_MAP[baseType] });
    }
    if (originiumArts > 0 && abnormalList.length > 0) {
        myLogs.arts.push({ txt: `오리지늄 아츠 강도: +${originiumArts.toFixed(1)}% (이상 데미지에 적용)`, uid: 'skill_arts_strength', tag: SKILL_TYPE_CAT_MAP[baseType] });
    }

    vulnAmpEffects.forEach(eff => {
        const isTypeMatch = !eff.skillType || (eff.skillType && eff.skillType.includes(baseType));
        if (isTypeMatch && !state.disabledEffects.includes(eff.uid)) {
            const targets = eff.targetEffect || (eff.type.includes('냉기 취약 증폭') ? ['냉기 취약'] : ['취약']);
            targets.forEach(tKey => {
                const vVal = vulnMap[tKey] || 0;
                if (vVal > 0) {
                    const ampFactor = (1 + (resolveVal(eff.val, res.stats, null, eff._sourceOpId, state) * (eff.forgeMult || 1.0))).toFixed(1);
                    const displayName = (eff.name || '').replace(/(_t|_s)\d+$/g, '');
                    myLogs.vuln.push({ txt: `[${displayName}] *${ampFactor} (${tKey})`, uid: eff.uid });
                }
            });
        }
    });

    const critLogs = (res.logs.crit || []).filter(l => {
        if (l.tag === 'skillCrit') {
            const arr = l.skillType || [];
            if (arr.length === 0) return true;
            return arr.includes(baseType) || arr.includes(type);
        }
        return false;
    });
    myLogs.crit.push(...critLogs);

    const atkLogs = (res.logs.atkBuffs || []).filter(l => {
        if (l.tag === 'skillAtk') {
            const arr = l.skillType || [];
            if (arr.length === 0) return true;
            return arr.includes(baseType) || arr.includes(type);
        }
        return false;
    });
    myLogs.atk.push(...atkLogs);

    const finalSingleHitDmg = Math.floor(baseHitDmg * comboMult) + Object.values(abnormalDmgMap).reduce((acc, v) => acc + v, 0);

    return {
        unitDmg: finalSingleHitDmg,
        baseUnitDmg: Math.floor(baseHitDmg * comboMult),
        abnormalDmgs: abnormalDmgMap,
        logs: myLogs,
        dmgRate: (adjDmgMult * 100).toFixed(0) + '%' + abnormalDesc,
        desc: skillDef.desc,
        rawRate: adjDmgMult,
        baseRate: dmgMult - bonusList.reduce((acc, b) => acc + (b.isSeparateHit ? 0 : b.val), 0),
        bonusList,
        abnormalList,
        abnormalInfo: visibleAbnormals.length > 0 ? visibleAbnormals : undefined,
        activeEffects: res.activeEffects
    };
}

// ---- Proc 효과 수집 ----
function collectProcEffects(opData, currentState) {
    const procEffects = [];

    if (opData.talents) {
        opData.talents.forEach((tArr, i) => {
            tArr.forEach(eff => {
                if (eff.dmg && eff.trigger) procEffects.push({ ...eff, label: `재능${i + 1}` });
            });
        });
    }

    const mainPot = Number(currentState.mainOp.pot) || 0;
    for (let p = 0; p < mainPot; p++) {
        if (opData.potential?.[p]) {
            opData.potential[p].forEach(eff => {
                if (eff.dmg && eff.trigger) procEffects.push({ ...eff, label: `잠재${p + 1}` });
            });
        }
    }

    if (currentState.mainOp?.wepId) {
        const wepData = DATA_WEAPONS.find(w => w.id === currentState.mainOp.wepId);
        if (wepData?.traits) {
            wepData.traits.forEach((trait, idx) => {
                const isProcType = trait.dmg || (Array.isArray(trait.type) && trait.type.includes('물리 데미지'));
                if (isProcType && trait.trigger) {
                    const finalLv = calculateWeaponTraitLevel(idx, currentState.mainOp.wepState, currentState.mainOp.wepPot);
                    let dmgValue = trait.dmg;
                    if (!dmgValue && trait.valByLevel) dmgValue = calculateWeaponTraitValue(trait, finalLv);
                    if (dmgValue) procEffects.push({ ...trait, dmg: dmgValue, label: `무기:${wepData.name}` });
                }
            });
        }
    }

    if (currentState.activeSetId) {
        const setData = DATA_SETS.find(s => s.id === currentState.activeSetId);
        if (setData?.effects) {
            setData.effects.forEach(eff => {
                const isProcType = eff.dmg || (Array.isArray(eff.type) && eff.type.includes('물리 데미지'));
                if (isProcType && eff.trigger) {
                    let dmgValue = eff.dmg;
                    if (Array.isArray(dmgValue)) dmgValue = dmgValue[0];
                    if (dmgValue) procEffects.push({ ...eff, dmg: dmgValue, label: `세트:${setData.name}` });
                }
            });
        }
    }

    return procEffects;
}

/**
 * 사이클 데미지를 계산한다.
 */
function calculateCycleDamage(currentState, baseRes, forceMaxStack = false) {
    if (!baseRes || !baseRes.stats || !currentState.mainOp?.id) return null;
    const sequenceInput = currentState.skillSequence || [];

    const opData = getOperatorData(currentState.mainOp.id);
    const skillMap = {};
    if (opData?.skill) {
        opData.skill.forEach(s => {
            if (s?.skillType) s.skillType.forEach(st => skillMap[st] = s);
        });
    }

    const perSkill = {};
    const perAbnormal = {};
    const procEffects = collectProcEffects(opData, currentState);

    Object.keys(skillMap).forEach(type => {
        perSkill[type] = { dmg: 0, count: 0, unitDmg: 0, logs: [], dmgRate: '0%', desc: '' };
        let originalSkillDef = skillMap[type];
        if (!originalSkillDef) return;

        let skillDef = { ...originalSkillDef };
        const skillNameForLvl = Array.isArray(type) ? type[0] : type;
        const baseTypeForLvl = originalSkillDef.masterySource || (skillNameForLvl.startsWith('강화 ') ? skillNameForLvl.substring(3) : skillNameForLvl);
        const selectedLevel = currentState.mainOp?.skillLevels?.[baseTypeForLvl] || 'M3';
        if (originalSkillDef.levels && originalSkillDef.levels[selectedLevel]) {
            const lvlData = originalSkillDef.levels[selectedLevel];
            if (lvlData.element !== undefined) skillDef.element = lvlData.element;
        }

        const calculationTag = SKILL_TYPE_CAT_MAP[type] || 'common';
        let specificRes = skillDef.element
            ? calculateDamage({ ...currentState, overrideSkillElement: skillDef.element, calculationTag }, forceMaxStack)
            : calculateDamage({ ...currentState, calculationTag }, forceMaxStack);

        const res = calcSingleSkillDamage(type, currentState, specificRes);
        if (res) {
            perSkill[type] = { ...perSkill[type], ...res, dmg: 0, count: 0, _specificRes: specificRes };
        }
    });

    const sequenceResult = [];
    let total = 0;

    sequenceInput.forEach((itemObj) => {
        const isObj = typeof itemObj === 'object';
        const type = isObj ? itemObj.type : itemObj;
        const pSkill = perSkill[type];

        if (!pSkill) { sequenceResult.push({ type, dmg: 0, dmgRate: '0%', logs: [], desc: '' }); return; }

        let originalSkillDef = skillMap[type];
        if (!originalSkillDef) { sequenceResult.push({ type, dmg: 0, dmgRate: '0%', logs: [], desc: '' }); return; }

        let skillDef = { ...originalSkillDef };
        const skillNameForLvl = Array.isArray(type) ? type[0] : type;
        const baseTypeForLvl = originalSkillDef.masterySource || (skillNameForLvl.startsWith('강화 ') ? skillNameForLvl.substring(3) : skillNameForLvl);
        const selectedLevel = currentState.mainOp?.skillLevels?.[baseTypeForLvl] || 'M3';
        if (originalSkillDef.levels && originalSkillDef.levels[selectedLevel]) {
            const lvlData = originalSkillDef.levels[selectedLevel];
            if (lvlData.element !== undefined) skillDef.element = lvlData.element;
        }

        let skillData = pSkill;
        let cRes = null;
        const customStateMerged = { ...currentState, mainOp: { ...currentState.mainOp } };
        let hasCustomState = false;

        if (isObj && itemObj.customState) {
            hasCustomState = true;
            customStateMerged.disabledEffects = itemObj.customState.disabledEffects;
            customStateMerged.effectStacks = itemObj.customState.effectStacks;
            customStateMerged.debuffState = itemObj.customState.debuffState;
            customStateMerged.enemyUnbalanced = itemObj.customState.enemyUnbalanced;
            customStateMerged.mainOp.specialStack = itemObj.customState.specialStack;
            customStateMerged.usables = itemObj.customState.usables;
        }

        if (hasCustomState) {
            customStateMerged.calculationTag = SKILL_TYPE_CAT_MAP[type] || 'common';
            customStateMerged._subStatsCache = null;
            if (skillDef && skillDef.element) customStateMerged.overrideSkillElement = skillDef.element;
            cRes = calculateDamage(customStateMerged, forceMaxStack);
            if (cRes) {
                const sRes = calcSingleSkillDamage(type, customStateMerged, cRes);
                if (sRes) skillData = { ...sRes };
            }
        } else {
            cRes = pSkill._specificRes || baseRes;
        }

        const skillBaseDmg = skillData.baseUnitDmg || 0;
        let skillTotal = skillData.unitDmg || 0;

        if (skillData.abnormalList && procEffects.length > 0) {
            procEffects.forEach(pe => {
                let matchCount = 0;
                skillData.abnormalList.forEach(a => {
                    const isMatch = pe.trigger.some(t => {
                        if (a.name === t) return true;
                        if (t === '물리 이상' && PHYS_ANOMALY_TAGS.includes(a.name)) return true;
                        if ((t === '넘어뜨리기' && a.name === '강제 넘어뜨리기') || (t === '띄우기' && a.name === '강제 띄우기')) return true;
                        if (a.isArts) {
                            if (a.originalType === t) return true;
                            const artsBaseName = a.name.replace('(이상)', '');
                            if (artsBaseName === t || artsBaseName + ' 부여' === t) return true;
                            if (t.endsWith(' 부여') && t.startsWith(artsBaseName)) return true;
                        }
                        return false;
                    });
                    if (isMatch) matchCount++;
                });

                if (matchCount > 0) {
                    const targetStats = (hasCustomState && cRes) ? cRes.stats : skillData.stats || (cRes ? cRes.stats : baseRes.stats);
                    const parsePct = (v) => {
                        if (!v || v === 0) return 0;
                        if (typeof v === 'string') { const idx = v.indexOf('%'); return idx !== -1 ? parseFloat(v.substring(0, idx)) / 100 : (parseFloat(v) / 100 || 0); }
                        return v / 100 || 0;
                    };
                    const dmgMult = parsePct(pe.dmg);
                    const peElem = pe.element;
                    const _resKeyMapProc = { heat: '열기', elec: '전기', cryo: '냉기', nature: '자연' };
                    const peElemKO = peElem === 'phys' ? '물리' : (_resKeyMapProc[peElem] || null);

                    let procDmgInc = targetStats.dmgIncData?.all || 0;
                    if (peElem === 'phys') procDmgInc += (targetStats.dmgIncData?.phys || 0);
                    else if (peElem) procDmgInc += (targetStats.dmgIncData?.[peElem] || 0);

                    let procVuln = targetStats.vulnMap?.['취약'] || 0;
                    if (peElemKO && targetStats.vulnMap) {
                        procVuln += (targetStats.vulnMap[`${peElemKO} 취약`] || 0);
                        if (peElem !== 'phys') procVuln += (targetStats.vulnMap['아츠 취약'] || 0);
                    }
                    if (!targetStats.vulnMap) procVuln = targetStats.vuln || 0;

                    let procTakenDmg = targetStats.takenDmgMap?.all || 0;
                    if (targetStats.takenDmgMap) {
                        if (peElem === 'phys') procTakenDmg += (targetStats.takenDmgMap.phys || 0);
                        else if (peElem) { procTakenDmg += (targetStats.takenDmgMap.arts || 0); if (targetStats.takenDmgMap[peElem]) procTakenDmg += targetStats.takenDmgMap[peElem]; }
                    } else { procTakenDmg = targetStats.takenDmg || 0; }

                    let procResMult = targetStats.resMult || 1;
                    if (peElemKO && targetStats.allRes) {
                        const procResVal = (targetStats.allRes[peElemKO] || 0) - (targetStats.resIgnore || 0);
                        procResMult = 1 - procResVal / 100;
                    }

                    const commonMults = targetStats.critExp *
                        (1 + procDmgInc / 100) * (1 + (targetStats.amp || 0) / 100) *
                        (1 + procTakenDmg / 100) * (1 + procVuln / 100) *
                        (1 + (targetStats.unbalanceDmg || 0) / 100) * procResMult * (targetStats.defMult || 1);

                    const procDmg = Math.floor(targetStats.finalAtk * dmgMult * commonMults) * matchCount;
                    if (procDmg > 0) {
                        skillTotal += procDmg;
                        if (!perAbnormal[pe.label]) perAbnormal[pe.label] = { dmg: 0, count: 0 };
                        perAbnormal[pe.label].dmg += procDmg;
                        perAbnormal[pe.label].count += matchCount;
                    }
                }
            });
        }

        total += skillTotal;
        pSkill.dmg += skillBaseDmg;
        pSkill.count += 1;
        pSkill.dmgRate = skillData.dmgRate;
        pSkill.unitDmg = skillData.baseUnitDmg;

        if (skillData.abnormalDmgs) {
            const occurrences = {};
            if (skillData.abnormalList) {
                skillData.abnormalList.forEach(a => {
                    occurrences[a.name] = (occurrences[a.name] || 0) + 1;
                });
            }

            Object.entries(skillData.abnormalDmgs).forEach(([aName, aDmg]) => {
                const info = skillData.abnormalList ? skillData.abnormalList.find(a => a.name === aName) : null;
                if (info && info.uiHidden) return;
                if (!perAbnormal[aName]) perAbnormal[aName] = { dmg: 0, count: 0, elements: [] };
                perAbnormal[aName].dmg += aDmg;
                // 단순 1이 아닌 해당 스킬에서의 실제 발생 횟수를 더함
                perAbnormal[aName].count += (occurrences[aName] || 1);
                if (info && info.element && !perAbnormal[aName].elements.includes(info.element)) {
                    perAbnormal[aName].elements.push(info.element);
                }
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
            activeEffects: skillData.activeEffects
        });
    });

    return { sequence: sequenceResult, perSkill, perAbnormal, total };
}