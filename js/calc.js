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
 *   서로 다른 출처(다른 무기 vs. 같은 무기)의 동일 타입은 중복 허용하지 않는다.
 * - 서브 오퍼레이터 효과: target이 '팀' | '팀_외' | '적'인 효과만 적용한다.
 * - EFFECT_LOG_HANDLERS는 로그만 기록한다.
 *   실제 수치 누산(atkInc, critRate 등)은 isDisabled 체크 후 별도로 수행한다.
 *   (두 로직이 분리된 이유: 비활성화된 효과도 로그에는 표시해야 하기 때문)
 * - computeFinalDamageOutput의 데미지 공식:
 *   finalAtk × critExp × (1 + dmgInc) × (1 + amp) × (1 + takenDmg) × (1 + vuln) × multiHit × (1 + unbal) × resMult
 *   resMult = 1 − resistance / 100  (resistance가 0이면 resMult=1, 음수일수록 피해 증가)
 * - 디버프 직접 적용 규칙 (부식/감전 등 state.debuffState 기반 효과):
 *   ① uid를 'debuff_XXXX' 형태로 고정한다.
 *   ② 로그는 항상 추가한다 (state.disabledEffects와 무관하게).
 *   ③ 수치 누산은 `!state.disabledEffects.includes('디버프_uid')` 조건에서만 수행한다.
 *   ④ 새 디버프 속성을 추가할 때 반드시 위 세 규칙을 지켜야 한다.
 */

// ============ 데미지 계산 엔진 ============

function calculateDamage(currentState, forceMaxStack = false) {
    const originalOpData = DATA_OPERATORS.find(o => o.id === currentState.mainOp.id);
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

// ---- 스탯 키 정규화 ----
function resolveStatKey(target, container) {
    if (container[target] !== undefined) return target;
    const mapped = STAT_NAME_MAP[target];
    if (mapped && container[mapped] !== undefined) return mapped;
    // 한글 이름 역방향 조회 (예: '민첩' → 'agi')
    const reverseKey = Object.keys(STAT_NAME_MAP).find(k => STAT_NAME_MAP[k] === target);
    if (reverseKey && container[reverseKey] !== undefined) return reverseKey;
    return target;
}

// 스택 수치 계산 보정 (방어 불능 보정 등 반영)
function getAdjustedStackCount(triggerName, state, opData, skillTypes) {
    let count = 0;
    if (triggerName === '방어 불능') {
        count = state.debuffState?.physDebuff?.defenseless || 0;
        const mainOp = state.mainOp;
        const op = opData || DATA_OPERATORS.find(o => o.id === mainOp.id);
        if (op) {
            // 잠재/재능에서 '방어 불능 보정' 수집
            const pools = [
                ...(op.talents || []).flat(),
                ...((op.potential || []).slice(0, Number(mainOp.pot) || 0)).flat()
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

    return count;
}

// ---- 효과 수집 ----
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

    const mergeEffects = (effs) => {
        if (!effs || effs.length === 0) return [];
        const groups = {};
        effs.forEach(eff => {
            if (!eff) return;
            const typeStr = JSON.stringify(eff.type);
            const triggerStr = JSON.stringify(eff.trigger);
            const skillTypeStr = JSON.stringify(eff.skillType);
            const key = `${typeStr}|${triggerStr}|${eff.target}|${skillTypeStr}|${eff.cond}`;

            if (!groups[key]) {
                groups[key] = JSON.parse(JSON.stringify(eff));
            } else {
                const g = groups[key];
                if (eff.val !== undefined) g.val = combineValues(g.val, eff.val);
                if (eff.dmg !== undefined) g.dmg = combineValues(g.dmg, eff.dmg);
                if (eff.bonus) {
                    if (!g.bonus) g.bonus = [];
                    eff.bonus.forEach(eb => {
                        const bTypeStr = JSON.stringify(eb.type);
                        const bTriggerStr = JSON.stringify(eb.trigger);
                        const existingBonus = g.bonus.find(gb =>
                            JSON.stringify(gb.type) === bTypeStr &&
                            JSON.stringify(gb.trigger) === bTriggerStr &&
                            gb.target === eb.target
                        );
                        if (existingBonus) {
                            if (eb.val !== undefined) existingBonus.val = combineValues(existingBonus.val, eb.val);
                        } else {
                            g.bonus.push(JSON.parse(JSON.stringify(eb)));
                        }
                    });
                }
            }
        });
        return Object.values(groups);
    };

    const addEffect = (source, name, forgeMult = 1.0, isSub = false, isSkillSource = false, forceMaxStack = false, effectiveOpData = opData, uidPrefix = null) => {
        if (!source || !Array.isArray(source)) return;
        const sources = source;
        sources.forEach((eff, i) => {
            if (!eff) return;

            let baseTriggerMet = true;
            if (eff.trigger) {
                baseTriggerMet = baseTriggerMet && evaluateTrigger(eff.trigger, state, effectiveOpData, eff.triggerType, false, eff.target);
            }
            if (eff.triggerTarget) {
                baseTriggerMet = baseTriggerMet && evaluateTrigger(eff.triggerTarget, state, effectiveOpData, null, true, eff.target);
            }

            if (eff.targetFilter === '다른 속성') {
                const sourceElem = effectiveOpData.element || effectiveOpData.type;
                const targetElem = opData.element || opData.type;
                if (sourceElem === targetElem) baseTriggerMet = false;
            }

            const typeArr = eff.type ? (Array.isArray(eff.type) ? eff.type : [eff.type]).map(item => typeof item === 'string' ? { type: item } : item) : [];
            const bonuses = eff.bonus || [];

            const activeBonuses = bonuses.filter(b => !b.trigger || evaluateTrigger(b.trigger, state, effectiveOpData, null, false, b.target || eff.target));

            // [추가] 오퍼레이터 속성과 일치하는 무기 효과인지 확인 (트리거 미충족 시 표시용)
            const isMatchOpType = typeArr.some(ta => {
                const t = ta.type;
                const opTypeK = effectiveOpData.type === 'phys' ? '물리' : '아츠';
                const elMap = { heat: '열기', elec: '전기', cryo: '냉기', nature: '자연' };
                const opElK = elMap[effectiveOpData.element];
                return (t && (t.includes(opTypeK) || (opElK && t.includes(opElK)) || t.includes('취약') || t.includes('증폭')));
            });
            const isWeaponSource = !!eff.sourceId;
            const showEvenIfFailed = !baseTriggerMet && (isWeaponSource || isMatchOpType);

            if (baseTriggerMet || showEvenIfFailed) {
                const triggerFailed = !baseTriggerMet;

                typeArr.forEach((typeItem, j) => {
                    if (!typeItem?.type) return;

                    let currentVal = typeItem.val !== undefined ? typeItem.val : eff.val;

                    // perStack 처리 (주 효과 아이템에 대해서도 지원)
                    const ps = typeItem.perStack || eff.perStack;
                    const tr = typeItem.trigger || eff.trigger;
                    const bs = typeItem.base !== undefined ? typeItem.base : (eff.base !== undefined ? eff.base : (typeItem.val !== undefined ? typeItem.val : eff.val));

                    if (ps && tr) {
                        let maxStackForThis = 0;
                        const triggers = Array.isArray(tr) ? tr : [tr];
                        triggers.forEach(t => {
                            maxStackForThis = Math.max(maxStackForThis, getAdjustedStackCount(t, state, effectiveOpData, eff.skillType));
                        });
                        const nPer = parseFloat(ps) || 0;
                        const nBase = parseFloat(bs) || 0;
                        const totalValue = parseFloat((nPer * maxStackForThis + nBase).toPrecision(12));
                        const isPct = String(ps).includes('%') || (bs && String(bs).includes('%'));
                        currentVal = isPct ? totalValue + '%' : totalValue;
                    }

                    // stack 처리
                    const effUid = `${uidPrefix || name}_${typeItem.type}_v${i}_${j}`;
                    const targetEffectStacks = state.effectStacks;
                    let stackCount = targetEffectStacks?.[effUid];
                    if (stackCount === undefined) {
                        stackCount = eff.stack ? 1 : 1; // 기본은 1 (비활성은 0)
                    }
                    if (forceMaxStack && eff.stack) {
                        stackCount = eff.stack;
                    }

                    if (eff.stack) {
                        // 수치에 중첩수 곱하기 (0이면 0이 됨)
                        const n = parseFloat(currentVal) || 0;
                        const multiplied = parseFloat((n * stackCount).toPrecision(12));
                        currentVal = (typeof currentVal === 'string' && currentVal.includes('%')) ? multiplied + '%' : multiplied;
                        typeItem._stackCount = stackCount; // UI 표시용
                        typeItem._uid = effUid;
                    }

                    activeBonuses.forEach(b => {
                        if (b.type === typeItem.type || (!b.type && typeArr.length === 1)) {
                            if (b.val !== undefined) {
                                let bVal = b.val;
                                if (eff.stack) {
                                    const bn = parseFloat(bVal) || 0;
                                    const bMultiplied = parseFloat((bn * stackCount).toPrecision(12));
                                    bVal = (typeof bVal === 'string' && bVal.includes('%')) ? bMultiplied + '%' : bMultiplied;
                                }
                                currentVal = combineValues(currentVal, bVal);
                            }
                            // perStack 처리 (기존 스페셜 스택 로직)
                            // perStack 처리 (보너스 아이템)
                            if (b.perStack && b.trigger) {
                                let maxStackForThisBonus = 0;
                                const bTriggers = Array.isArray(b.trigger) ? b.trigger : [b.trigger];
                                bTriggers.forEach(t => {
                                    maxStackForThisBonus = Math.max(maxStackForThisBonus, getAdjustedStackCount(t, state, effectiveOpData, eff.skillType));
                                });
                                const bnPer = parseFloat(b.perStack) || 0;
                                const bnBase = b.base !== undefined ? parseFloat(b.base) : (b.val !== undefined ? parseFloat(b.val) : 0);
                                const bonusRawTotal = parseFloat((bnPer * maxStackForThisBonus + bnBase).toPrecision(12));
                                const bisPct = String(b.perStack).includes('%') || (b.base && String(b.base).includes('%')) || (b.val && String(b.val).includes('%'));
                                currentVal = combineValues(currentVal, bisPct ? bonusRawTotal + '%' : bonusRawTotal);
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
                        _triggerFailed: triggerFailed
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
            }

            activeBonuses.forEach((b, j) => {
                const bonusTypes = b.type ? (Array.isArray(b.type) ? b.type : [b.type]) : (typeArr.length === 1 ? [typeArr[0].type] : []);

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
        });
    };

    // 1. 장비
    state.mainOp.gears.forEach((gId, i) => {
        if (!gId) return;
        const gear = DATA_GEAR.find(g => g.id === gId);
        if (!gear) return;
        const isForged = state.mainOp.gearForged[i];

        [1, 2].forEach(num => {
            const statKey = gear[`stat${num}`];
            if (!statKey) return;
            const val = isForged && gear[`val${num}_f`] !== undefined
                ? gear[`val${num}_f`]
                : gear[`val${num}`];
            const key = resolveStatKey(statKey, stats);
            if (stats[key] !== undefined) stats[key] += val;
        });

        if (gear.trait) {
            const processGearTrait = (t) => {
                // val은 원본 값을 유지하고, 계산 시 parseFloat 적용
                const val = isForged && t.val_f !== undefined ? t.val_f : t.val;
                let type = t.type;
                let stat = t.stat;
                const types = Array.isArray(t.type) ? t.type : [t.type];
                if (types.includes('스탯')) {
                    // 값에 % 포함 여부로 결정
                    const isPercent = (typeof val === 'string' && val.includes('%'));
                    type = isPercent ? '스탯%' : '스탯';
                    stat = t.stat === '주스탯' ? opData.mainStat
                        : t.stat === '부스탯' ? opData.subStat
                            : t.stat;
                }
                return { ...t, type, stat, val };
            };

            const traits = gear.trait.map(processGearTrait);
            const gearUniqueName = `${gear.name}_s${i}`;
            addEffect(traits, gearUniqueName, 1.0, false, false, false, opData);
        }
    });

    // 2. 무기 (메인 + 서브)
    const weaponsToProcess = [
        { data: wepData, state: state.mainOp.wepState, pot: state.mainOp.wepPot, name: opData.name, isMain: true, ownerOp: opData },
        ...state.subOps.map((sub, idx) => {
            const sOpData = DATA_OPERATORS.find(o => o.id === sub.id);
            const sWep = DATA_WEAPONS.find(w => w.id === sub.wepId);
            return { data: sWep, state: sub.wepState, pot: sub.wepPot, name: sOpData ? sOpData.name : `서브${idx + 1}`, isMain: false, ownerOp: sOpData };
        })
    ];

    weaponsToProcess.forEach((entry, wIdx) => {
        if (!entry.data) return;
        entry.data.traits.forEach((trait, idx) => {
            if (!trait) return;
            const traitIdx = idx + 1;
            const finalLv = calculateWeaponTraitLevel(idx, entry.state, entry.pot);
            const val = calculateWeaponTraitValue(trait, finalLv);
            const eff = { ...trait, val, sourceId: entry.data.id };

            let label = `${entry.data.name} 특성${traitIdx}(Lv${finalLv})`;
            if (!entry.isMain) label = `${entry.name} ${entry.data.name} 특성${traitIdx}`;

            // UID 안정화를 위해 Lv 정보를 제외한 고정 접두사 생성
            let uidPrefix = `${entry.data.name}_trait${traitIdx}`;
            if (!entry.isMain) uidPrefix = `${entry.name}_${entry.data.id}_trait${traitIdx}`;

            const uniqueLabel = `${label}_t${idx}`;

            const types = Array.isArray(trait.type) ? trait.type : [trait.type];
            // 메인 무기인 경우에만 forceMaxStack 적용
            const useMaxStack = entry.isMain ? forceMaxStack : false;

            if (types.includes('스탯')) {
                const targetStat = trait.stat === '주스탯' ? opData.mainStat
                    : trait.stat === '부스탯' ? opData.subStat
                        : trait.stat;
                // idx 기반 판정 삭제, 값에 % 포함 여부로 결정
                const isPercent = typeof val === 'string' && val.includes('%');
                const type = isPercent ? '스탯%' : '스탯';
                addEffect([{ ...eff, type, stat: targetStat }], uniqueLabel, 1.0, !entry.isMain, false, useMaxStack, entry.ownerOp, uidPrefix);
            } else {
                addEffect([eff], uniqueLabel, 1.0, !entry.isMain, false, useMaxStack, entry.ownerOp, uidPrefix);
            }
        });
    });

    // 3. 메인 오퍼레이터
    if (opData.skill) {
        opData.skill.forEach((s, i) => {
            const skName = (s.skillType && Array.isArray(s.skillType)) ? s.skillType.join('/') : `스킬${i + 1}`;
            addEffect([s], `${opData.name} ${skName}`, 1.0, false, true, false, opData);
        });
    }
    if (opData.talents) {
        opData.talents.forEach((t, i) => {
            if (!t || t.length === 0) return;
            const merged = mergeEffects(t);
            addEffect(merged, `${opData.name} 재능${i + 1}`, 1.0, false, false, false, opData, `${opData.id}_talent${i}`);
        });
    }

    const mainPot = Number(state.mainOp.pot) || 0;
    for (let p = 0; p < mainPot; p++) {
        const pot = opData.potential?.[p];
        if (!pot || pot.length === 0) continue;
        const merged = mergeEffects(pot);
        addEffect(merged, `${opData.name} 잠재${p + 1}`, 1.0, false, false, false, opData, `${opData.id}_pot${p}`);
    }

    // 4. 서브 오퍼레이터 시너지
    state.subOps.forEach((sub, idx) => {
        if (!sub.id) return;
        const subOpData = DATA_OPERATORS.find(o => o.id === sub.id);
        if (!subOpData?.talents) return;
        const prefix = subOpData.name;

        if (subOpData.skill) {
            subOpData.skill.forEach((s, i) => {
                const skName = (s.skillType && Array.isArray(s.skillType)) ? s.skillType.join('/') : `스킬${i + 1}`;
                addEffect([s], `${prefix} ${skName}`, 1.0, true, true, false, subOpData);
            });
        }
        if (subOpData.talents) {
            subOpData.talents.forEach((t, ti) => {
                if (!t || t.length === 0) return;
                const merged = mergeEffects(t);
                addEffect(merged, `${prefix} 재능${ti + 1}`, 1.0, true, false, false, subOpData, `${subOpData.id}_talent${ti}`);
            });
        }

        const subPot = Number(sub.pot) || 0;
        for (let sp = 0; sp < subPot; sp++) {
            const pot = subOpData.potential?.[sp];
            if (!pot || pot.length === 0) continue;
            const merged = mergeEffects(pot);
            addEffect(merged, `${prefix} 잠재${sp + 1}`, 1.0, true, false, false, subOpData, `${subOpData.id}_pot${sp}`);
        }
    });

    // 5. 세트 효과
    const opsForSet = [
        { opData, setId: getActiveSetID(state.mainOp.gears), name: opData.name },
        ...state.subOps.map((sub, idx) => {
            const sData = DATA_OPERATORS.find(o => o.id === sub.id);
            return { opData: sData, setId: sub.equipSet, name: sData ? sData.name : `서브${idx + 1}` };
        })
    ];

    state.activeSetId = opsForSet[0].setId;

    opsForSet.forEach((entry, idx) => {
        if (!entry.setId || !entry.opData) return;
        const isSelf = (idx === 0);
        const setEffects = getSetEffects(entry.setId, entry.opData, isSelf);

        setEffects.forEach(eff => {
            if (eff.nonStack) {
                const key = `${entry.setId}_${eff.type}`;
                if (activeNonStackTypes.has(key)) return;
                activeNonStackTypes.add(key);
            }
            if (idx > 0 && !isSubOpTargetValid(eff)) return;

            const setName = DATA_SETS.find(s => s.id === entry.setId)?.name || entry.setId;
            const uid = `set_${entry.setId}_${eff.type}_${idx}`;
            allEffects.push({ ...eff, name: `${entry.name} ${setName} 세트효과`, uid, _opData: entry.opData }); // 세트 효과는 판정 시 _opData 필요할 수 있음
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
function computeFinalDamageOutput(state, opData, wepData, stats, allEffects, activeEffects) {
    const baseAtk = opData.baseAtk + wepData.baseAtk;
    let atkInc = 0, critRate = 5, critDmg = 50, dmgInc = 0, amp = 0, vuln = 0, takenDmg = 0, multiHit = 1.0, unbalanceDmg = 0, originiumArts = 0, ultRecharge = 0, ultCostReduction = 0, skillMults = { all: { mult: 0, add: 0 } }, dmgIncMap = { all: 0, skill: 0, normal: 0, battle: 0, combo: 0, ult: 0, phys: 0, heat: 0, elec: 0, cryo: 0, nature: 0 };
    const vulnMap = { '물리 취약': 0, '아츠 취약': 0, '열기 취약': 0, '전기 취약': 0, '냉기 취약': 0, '자연 취약': 0, '취약': 0 };
    const vulnAmpEffects = [];
    const skillCritData = { rate: { all: 0 }, dmg: { all: 0 } };
    const skillAtkIncData = { all: 0 };
    const logs = {
        atk: [], atkBuffs: [], dmgInc: [], amp: [], vuln: [],
        taken: [], unbal: [], multihit: [], crit: [], arts: [], res: [], ultRecharge: []
    };
    let resIgnore = 0;

    // ---- 저항 (적 속성별, 0 시작 / 낮을수록 피해 증가) ----
    const ALL_RES_KEYS = ['물리', '열기', '전기', '냉기', '자연'];
    const baseRes = state.enemyResistance || 0;
    const resistance = { '물리': baseRes, '열기': baseRes, '전기': baseRes, '냉기': baseRes, '자연': baseRes };

    // 갑옷 파괴 디버프 (물리 받는 피해 증가)
    const ARMOR_BREAK_BONUS = [0, 12, 16, 20, 24];
    const abStacks = state.debuffState.physDebuff?.armorBreak || 0;
    const abVal = ARMOR_BREAK_BONUS[abStacks];
    const abDisabled = state.disabledEffects.includes('debuff_armorBreak');
    if (abVal > 0 && opData.type === 'phys') {
        if (!abDisabled) takenDmg += abVal;
        logs.taken.push({ txt: `[갑옷 파괴 ${abStacks}단계] 받는 물리 피해 +${abVal}%`, uid: 'debuff_armorBreak' });
    }

    // 부식 디버프: 모든 저항 감소
    const BUSIK_RED = [0, 12, 16, 20, 24];
    const busikStacks = state.debuffState.artsAbnormal['부식'] || 0;
    const busikVal = BUSIK_RED[busikStacks];
    const busikDisabled = state.disabledEffects.includes('debuff_busik');
    if (busikVal > 0) {
        if (!busikDisabled) ALL_RES_KEYS.forEach(k => resistance[k] -= busikVal);
        logs.res.push({ txt: `[부식 ${busikStacks}단계] 모든 저항 -${busikVal}`, uid: 'debuff_busik' });
    }

    // 감전 디버프: 받는 아츠 피해 증가
    const GAMSUN_BONUS = [0, 12, 16, 20, 24];
    const gamsunStacks = state.debuffState.artsAbnormal['감전'] || 0;
    const gamsunVal = GAMSUN_BONUS[gamsunStacks];

    const atkBaseLogs = [
        { txt: `오퍼레이터 공격력: ${opData.baseAtk.toLocaleString()}`, uid: 'base_op_atk' },
        { txt: `무기 공격력: ${wepData.baseAtk.toLocaleString()}`, uid: 'base_wep_atk' }
    ];


    const statLogs = [];

    allEffects.forEach(eff => {
        const isDisabled = state.disabledEffects.includes(eff.uid) || !!eff._triggerFailed;
        const displayName = (eff.name || '').replace(/(_t|_s)\d+$/g, '');

        // 표시용 수치
        let valDisplay = eff.val !== undefined ? eff.val : eff.dmg;
        if (typeof valDisplay === 'number' && valDisplay > 0) valDisplay = '+' + valDisplay;
        else if (typeof valDisplay === 'string' && !valDisplay.startsWith('-') && !valDisplay.startsWith('+')) valDisplay = '+' + valDisplay;

        if (eff.type === '스탯' || eff.type === '스탯%') {
            const tgt = getStatName(eff.stat || eff.stats);
            const line = `[${displayName}] ${valDisplay}${eff.stack ? ` (${eff._stackCount}중첩)` : ''} (${tgt})`;
            statLogs.push({ txt: line, uid: eff.uid, stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });
            return;
        }

        if (eff.type === '저항 감소') {
            const valNum = (parseFloat(eff.val) || 0) * (eff.forgeMult || 1.0);
            const resKey = opData.type === 'phys' ? '물리' : (
                { heat: '열기', elec: '전기', cryo: '냉기', nature: '자연' }[opData.element] || null
            );
            if (resKey) {
                logs.res.push({ txt: `[${displayName}] ${resKey} 저항 ${valDisplay}`, uid: eff.uid, _triggerFailed: eff._triggerFailed });
                if (!isDisabled) resistance[resKey] += valNum;
            }
            return;
        }

        if (!isApplicableEffect(opData, eff.type, eff.name)) return;

        const val = resolveVal(eff.val, stats) * (eff.forgeMult || 1.0);
        const t = (eff.type || '').toString();

        const checkDisabled = (cat) => {
            if (state.disabledEffects.includes(eff.uid) || !!eff._triggerFailed) return true;
            if (cat && state.disabledEffects.includes(`${eff.uid}#${cat}`)) return true;
            // 실시간 동기화: 현재 계산 컨텍스트(calculationTag)가 있으면 해당 카테고리 태그도 체크
            if (state.calculationTag && state.disabledEffects.includes(`${eff.uid}#${state.calculationTag}`)) return true;
            return false;
        };

        if (t === '공격력 증가') {
            if (!checkDisabled('common')) atkInc += val;
            logs.atkBuffs.push({ txt: `[${displayName}] ${valDisplay}${eff.stack ? ` (${eff._stackCount}중첩)` : ''} (${t})`, uid: eff.uid, stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });
        } else if (t === '오리지늄 아츠 강도') {
            if (!checkDisabled('common')) originiumArts += val;
            logs.arts.push({ txt: `[${displayName}] ${valDisplay}${eff.stack ? ` (${eff._stackCount}중첩)` : ''} (${t})`, uid: eff.uid, stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });
        } else if (t === '궁극기 충전 효율') {
            if (!checkDisabled('common')) ultRecharge += val;
            logs.ultRecharge.push({ txt: `[${displayName}] ${valDisplay}${eff.stack ? ` (${eff._stackCount}중첩)` : ''} (${t})`, uid: eff.uid, tag: 'recharge', stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });
        } else if (t === '궁극기 에너지 감소') {
            if (!checkDisabled('common')) ultCostReduction += val;
            logs.ultRecharge.push({ txt: `[${displayName}] ${valDisplay}${eff.stack ? ` (${eff._stackCount}중첩)` : ''} (${t})`, uid: eff.uid, tag: 'reduction', stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });
        } else if (t === '치명타 확률') {
            if (eff.skillType) {
                const skTypes = eff.skillType || [];
                skTypes.forEach(st => {
                    const cat = { '일반 공격': 'normal', '배틀 스킬': 'battle', '연계 스킬': 'combo', '궁극기': 'ult' }[st] || 'common';
                    if (!checkDisabled(cat)) {
                        skillCritData.rate[st] = (skillCritData.rate[st] || 0) + val;
                    }
                });
                logs.crit.push({ txt: `[${displayName}] ${valDisplay}${eff.stack ? ` (${eff._stackCount}중첩)` : ''} (${t} / ${skTypes.join(', ')})`, uid: eff.uid, tag: 'skillCrit', skillType: eff.skillType, stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });
            } else {
                if (!checkDisabled('common')) critRate += val;
                logs.crit.push({ txt: `[${displayName}] ${valDisplay}${eff.stack ? ` (${eff._stackCount}중첩)` : ''} (${t})`, uid: eff.uid, stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });
            }
        } else if (t === '치명타 피해') {
            if (eff.skillType) {
                const skTypes = eff.skillType || [];
                skTypes.forEach(st => {
                    const cat = { '일반 공격': 'normal', '배틀 스킬': 'battle', '연계 스킬': 'combo', '궁극기': 'ult' }[st] || 'common';
                    if (!checkDisabled(cat)) {
                        skillCritData.dmg[st] = (skillCritData.dmg[st] || 0) + val;
                    }
                });
                logs.crit.push({ txt: `[${displayName}] ${valDisplay}${eff.stack ? ` (${eff._stackCount}중첩)` : ''} (${t} / ${skTypes.join(', ')})`, uid: eff.uid, tag: 'skillCrit', skillType: eff.skillType, stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });
            } else {
                if (!checkDisabled('common')) critDmg += val;
                logs.crit.push({ txt: `[${displayName}] ${valDisplay}${eff.stack ? ` (${eff._stackCount}중첩)` : ''} (${t})`, uid: eff.uid, stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });
            }
        } else if (t === '연타') {
            if (!checkDisabled('common')) multiHit = Math.max(multiHit, val || 1);
            logs.multihit.push({ txt: `[${displayName}] x${val || 1}${eff.stack ? ` (${eff._stackCount}중첩)` : ''}`, uid: eff.uid, stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });
        } else if (t === '취약 증폭' || t === '냉기 취약 증폭') {
            vulnAmpEffects.push(eff);
            const ampFactor = (1 + val).toFixed(1);
            const targetLabel = (eff.targetEffect && Array.isArray(eff.targetEffect)) ? eff.targetEffect.join(', ') : (t === '냉기 취약 증폭' ? '냉기 취약' : '취약');
            logs.vuln.push({ txt: `[${displayName}] *${ampFactor} (${targetLabel})`, uid: eff.uid, target: '적', _triggerFailed: eff._triggerFailed });
        } else if (t.endsWith('증폭')) {
            if (!checkDisabled('common')) amp += val;
            logs.amp.push({ txt: `[${displayName}] ${valDisplay}${eff.stack ? ` (${eff._stackCount}중첩)` : ''} (${t})`, uid: eff.uid, stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });
        } else if (t.endsWith('취약')) {
            if (!checkDisabled('common')) {
                vuln += val;
                if (vulnMap[t] !== undefined) vulnMap[t] += val;
                else vulnMap['취약'] += val;
            }
            logs.vuln.push({ txt: `[${displayName}] ${valDisplay}${eff.stack ? ` (${eff._stackCount}중첩)` : ''} (${t})`, uid: eff.uid, stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });
        } else if (t === '불균형 목표에 주는 피해') {
            if (state.enemyUnbalanced && !checkDisabled('common')) {
                dmgInc += val;
                dmgIncMap.all += val;
            }
            logs.dmgInc.push({ txt: `[${displayName}] ${valDisplay}${eff.stack ? ` (${eff._stackCount}중첩)` : ''} (불균형 목표에 주는 피해)`, uid: eff.uid, unbalancedOff: !state.enemyUnbalanced, tag: 'all', stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });
        } else if (t.includes('받는')) {
            if (!checkDisabled('common')) takenDmg += val;
            logs.taken.push({ txt: `[${displayName}] ${valDisplay}${eff.stack ? ` (${eff._stackCount}중첩)` : ''} (${t})`, uid: eff.uid, stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });
        } else if (t === '스킬 치명타 확률' || t === '스킬 치명타 피해') {
            const isRate = (t === '스킬 치명타 확률');
            const targetObj = isRate ? skillCritData.rate : skillCritData.dmg;
            if (!checkDisabled('common')) {
                if (eff.skillType) {
                    const skTypes = eff.skillType || [];
                    skTypes.forEach(st => {
                        const cat = { '일반 공격': 'normal', '배틀 스킬': 'battle', '연계 스킬': 'combo', '궁극기': 'ult' }[st] || 'common';
                        if (!checkDisabled(cat)) {
                            targetObj[st] = (targetObj[st] || 0) + val;
                        }
                    });
                } else {
                    targetObj.all += val;
                }
            }
            let typeLabel = t;
            if (eff.skillType) typeLabel += ` (${eff.skillType.join(', ')})`;
            logs.crit.push({ txt: `[${displayName}] ${valDisplay}${eff.stack ? ` (${eff._stackCount}중첩)` : ''} (${typeLabel})`, uid: eff.uid, tag: 'skillCrit', skillType: eff.skillType, stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });
        } else if (t === '스킬 배율 증가') {
            const addVal = eff.dmg ? resolveVal(eff.dmg, stats) * (eff.forgeMult || 1.0) : 0;
            const addSkillMult = (st) => {
                const cat = { '일반 공격': 'normal', '배틀 스킬': 'battle', '연계 스킬': 'combo', '궁극기': 'ult' }[st] || 'common';
                if (!checkDisabled(cat)) {
                    if (typeof skillMults[st] === 'number') skillMults[st] = { mult: skillMults[st], add: 0 };
                    else if (!skillMults[st]) skillMults[st] = { mult: 0, add: 0 };
                    skillMults[st].mult += val;
                    skillMults[st].add += addVal;
                }
            };
            if (eff.skillType) {
                eff.skillType.forEach(st => addSkillMult(st));
            } else {
                addSkillMult('all');
            }
            let typeLabel = t;
            if (eff.skillType) typeLabel += ` (${eff.skillType.join(', ')})`;

            const nVal = parseFloat(eff.val !== undefined ? eff.val : (eff.dmg !== undefined ? eff.dmg : 0)) || 0;
            let multDisplay;

            if (eff.dmg !== undefined) {
                // 합연산
                multDisplay = `+${nVal}%`;
            } else {
                // 곱연산
                multDisplay = `*${(1 + nVal / 100).toFixed(2)}`;
            }

            logs.dmgInc.push({
                txt: `[${displayName}] ${multDisplay}${eff.stack ? ` (${eff._stackCount}중첩)` : ''} (${typeLabel})`,
                uid: eff.uid,
                tag: 'skillMult',
                skillType: eff.skillType,
                stack: eff.stack,
                val: nVal,
                stackCount: eff._stackCount,
                _triggerFailed: eff._triggerFailed
            });
        } else if (t.endsWith('피해') || t.includes('피해') || t === '주는 피해' || t === '모든 스킬 피해') {
            let tag = 'all';
            const skillTypes = eff.skillType ? (Array.isArray(eff.skillType) ? eff.skillType : [eff.skillType]) : null;

            if (!skillTypes) {
                if (t === '모든 스킬 피해') {
                    ['battle', 'combo', 'ult'].forEach(k => {
                        if (!checkDisabled(k)) dmgIncMap[k] += val;
                    });
                } else if (t.includes('일반 공격')) {
                    if (!checkDisabled('normal')) dmgIncMap.normal += val;
                } else if (t.includes('배틀 스킬')) {
                    if (!checkDisabled('battle')) dmgIncMap.battle += val;
                } else if (t.includes('연계 스킬')) {
                    if (!checkDisabled('combo')) dmgIncMap.combo += val;
                } else if (t.includes('궁극기')) {
                    if (!checkDisabled('ult')) dmgIncMap.ult += val;
                } else {
                    const elMap = { '물리': 'phys', '열기': 'heat', '전기': 'elec', '냉기': 'cryo', '자연': 'nature' };
                    let foundEl = null;
                    for (const [ek, ev] of Object.entries(elMap)) {
                        if (t.includes(ek)) { foundEl = ev; break; }
                    }

                    if (foundEl) {
                        if (!checkDisabled('common')) {
                            dmgIncMap[foundEl] += val;
                            // 오퍼레이터의 주 속성과 일치하는 경우 기본 dmgInc에도 합산 (스킬 데미지용)
                            const opElKey = opData.type === 'phys' ? 'phys' : opData.element;
                            if (foundEl === opElKey) {
                                dmgInc += val;
                            }
                        }
                        // 속성 태그 할당 (render.js에서 분류용으로 사용)
                        tag = foundEl;
                    } else {
                        if (!checkDisabled('common')) {
                            dmgInc += val;
                            dmgIncMap.all += val;
                        }
                    }
                }
            } else {
                skillTypes.forEach(st => {
                    const cat = { '일반 공격': 'normal', '배틀 스킬': 'battle', '연계 스킬': 'combo', '궁극기': 'ult' }[st];
                    if (cat && !checkDisabled(cat)) dmgIncMap[cat] += val;
                });
            }

            if (skillTypes) tag = 'skill';
            else if (t === '모든 스킬 피해') tag = 'skill';
            else if (t.includes('일반 공격')) tag = 'normal';
            else if (t.includes('배틀 스킬')) tag = 'battle';
            else if (t.includes('연계 스킬')) tag = 'combo';
            else if (t.includes('궁극기')) tag = 'ult';

            let label = t;
            if (skillTypes) label += ` (${skillTypes.join(', ')})`;
            logs.dmgInc.push({
                txt: `[${displayName}] ${valDisplay}${eff.stack ? ` (${eff._stackCount}중첩)` : ''} (${label})`,
                uid: eff.uid,
                tag: tag,
                skillType: skillTypes,
                stack: eff.stack,
                stackCount: eff._stackCount,
                _triggerFailed: eff._triggerFailed
            });
        } else if (t.endsWith('저항 무시')) {
            if (!checkDisabled('common')) resIgnore += val;
            logs.res.push({ txt: `[${displayName}] ${t} ${val.toFixed(1)}${eff.stack ? ` (${eff._stackCount}중첩)` : ''}`, uid: eff.uid, stack: eff.stack, stackCount: eff._stackCount, _triggerFailed: eff._triggerFailed });
        }
    });

    // [디버프 직접 적용 규칙] 로그는 항상 push, 수치 반영은 !isDisabled 시에만
    const gamsunDisabled = state.disabledEffects.includes('debuff_gamsun');
    if (gamsunVal > 0 && opData.type === 'arts') {
        if (!gamsunDisabled) takenDmg += gamsunVal;
        logs.taken.push({ txt: `[감전 ${gamsunStacks}단계] 받는 아츠 피해 +${gamsunVal}%`, uid: 'debuff_gamsun' });
    }

    const statBonusPct = (stats[opData.mainStat] * 0.005) + (stats[opData.subStat] * 0.002);
    const finalAtk = baseAtk * (1 + atkInc / 100) * (1 + statBonusPct);

    logs.atk = [
        atkBaseLogs[0],
        atkBaseLogs[1],
        { txt: `스탯 공격보너스: +${(statBonusPct * 100).toFixed(2)}%`, uid: 'stat_bonus_atk' },
        ...logs.atkBuffs,
        ...statLogs
    ];

    const finalCritRate = Math.min(Math.max(critRate, 0), 100);
    const critExp = ((finalCritRate / 100) * (critDmg / 100)) + 1;
    let finalUnbal = unbalanceDmg + (state.enemyUnbalanced ? 30 : 0);
    if (state.enemyUnbalanced) logs.unbal.push({ txt: `[불균형 기본] +30.0%`, uid: 'unbalance_base' });

    // 적용할 저항 (오퍼레이터 속성에 매핑)
    const resKeyMap = { heat: '열기', elec: '전기', cryo: '냉기', nature: '자연' };
    const activeResKey = opData.type === 'phys' ? '물리' : (resKeyMap[opData.element] || null);
    const baseResVal = activeResKey ? resistance[activeResKey] : 0;
    const activeResVal = baseResVal - resIgnore;
    // 저항 0 기준, 음수 = 저항 감소 = 피해 배율 1 이상
    const resMult = 1 - activeResVal / 100;

    // 방어력에 의한 피해 감소 (기본 100)
    // 감소율 = 1 - 1 / (0.01 * 방어력 + 1)
    // 피해 배율 = 1 / (0.01 * 방어력 + 1)
    const defVal = state.enemyDefense !== undefined ? state.enemyDefense : 100;
    const defMult = 1 / (0.01 * defVal + 1);

    let finalDmg = finalAtk * critExp * (1 + dmgInc / 100) * (1 + amp / 100) * (1 + takenDmg / 100) * (1 + vuln / 100) * multiHit * (1 + finalUnbal / 100) * resMult * defMult;

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
    const finalUltCost = Math.max(0, (baseUltCost * (1 + ultCostReduction / 100)) / (1 + ultRecharge / 100));

    return {
        finalDmg,
        activeEffects,
        stats: {
            finalAtk, atkInc, baseAtk, statBonusPct, skillAtkIncData,
            mainStatName: STAT_NAME_MAP[opData.mainStat], mainStatVal: stats[opData.mainStat],
            subStatName: STAT_NAME_MAP[opData.subStat], subStatVal: stats[opData.subStat],
            str: stats.str, agi: stats.agi, int: stats.int, wil: stats.wil,
            critExp, finalCritRate, critDmg, dmgInc, amp, vuln, takenDmg, unbalanceDmg: finalUnbal, originiumArts, skillMults, dmgIncData: dmgIncMap,
            skillCritData, resistance: activeResVal, resMult, defMult, enemyDefense: defVal, ultRecharge, finalUltCost, vulnMap, vulnAmpEffects,
            allRes: resistance, armorBreakVal: abVal, gamsunVal: gamsunVal, baseTakenDmg: (takenDmg - (opData.type === 'phys' ? abVal : (opData.type === 'arts' ? gamsunVal : 0))),
            resIgnore: resIgnore
        },
        logs
    };
}

// ---- 유틸리티 함수 ----
function resolveVal(val, stats) {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        let statSum = 0;
        let foundStat = false;

        // [Fix] 스탯 비례 수치 처리 (예: "지능, 의지 1포인트당 0.15% 증가")
        ['str', 'agi', 'int', 'wil'].forEach(k => {
            if (val.includes(STAT_NAME_MAP[k])) {
                statSum += (stats[k] || 0);
                foundStat = true;
            }
        });

        const num = parseFloat(val);

        if (foundStat) {
            // "1포인트당 X%" 또는 "X%" 패턴 추출 -> 스탯 총합에 곱함
            const match = val.match(/([\d.]+)%/);
            if (match) {
                const perPoint = parseFloat(match[1]);
                return statSum * perPoint;
            }
        }

        return isNaN(num) ? 0 : num;
    }
    return 0;
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

function isApplicableEffect(opData, effectType, effectName) {
    if (!effectType) return false;
    const type = effectType.toString();

    const ALWAYS_ON = [
        '공격력 증가', '치명타 확률', '치명타 피해', '최대 생명력', '궁극기 충전 효율', '궁극기 에너지 감소', '치유 효율', '연타',
        '주는 피해', '스탯', '스탯%', '스킬 피해', '궁극기 피해', '연계 스킬 피해', '배틀 스킬 피해',
        '일반 공격 피해', '오리지늄 아츠', '오리지늄 아츠 강도', '모든 스킬 피해', '스킬 배율 증가',
        '스킬 치명타 확률', '스킬 치명타 피해'
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
        const prefix = type.replace('받는 ', '').replace(' 피해', '').replace(' 취약', '');
        return checkElement(prefix);
    }
    if (type.endsWith('저항 무시')) {
        return checkElement(type.replace('저항 무시', ''));
    }
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
        if (isSelf && eff.target === '팀_외') return false;
        return true;
    }).map(eff => eff.type === '검술사_추가피해'
        ? { ...eff, setId: 'set_swordsman', triggered: true }
        : { ...eff }
    );
}

function getValidWeapons(opId) {
    const op = DATA_OPERATORS.find(o => o.id === opId);
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

/**
 * 스킬 bonus.trigger 조건을 평가한다.
 * 각 trigger 이름은 state.debuffState 또는 기타 state와 매핑된다.
 *
 * [확장 방법]
 * - 새 트리거를 추가할 때 아래 TRIGGER_MAP에만 항목을 추가하면 된다.
 * - 트리거 이름(data_operators.js의 bonus.trigger 값)을 key로,
 *   평가 함수(currentState → boolean)를 value로 등록한다.
 *
 * @param {string|undefined} trigger
 * @param {object} currentState
 * @returns {boolean}
 */
function evaluateTrigger(trigger, state, opData, triggerType, isTargetOnly = false, effectTarget = null, strictMode = false) {
    if (!trigger || trigger.length === 0) return true;

    const triggers = Array.isArray(trigger) ? trigger : [trigger];
    return triggers.some(t => {
        // 1. 타겟 상태 확인 (TargetTrigger - TRIGGER_MAP 우선)
        const specialStackVal = state.getSpecialStack ? state.getSpecialStack() : (state.mainOp?.specialStack || 0);

        const TRIGGER_MAP = {
            '방어 불능': () => getAdjustedStackCount('방어 불능', state, opData, triggerType) > 0,
            // '오리지늄 결정' removed to use generic specialStack logic (like Levatain)
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

        const evalFn = TRIGGER_MAP[t];
        if (evalFn && evalFn()) return true;

        const op = opData || DATA_OPERATORS.find(o => o.id === (state.mainOp?.id));
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

        // 2. 오퍼레이터 역량 확인 (OpTrigger)
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
                    const talentPool = (targetOp.talents || []).flat();
                    const potentialPool = (targetOp.potential || []).flat();
                    const hasInOther = [...talentPool, ...potentialPool].some(e => e.type && (Array.isArray(e.type) ? e.type.some(et => checkTypes.includes(et)) : checkTypes.includes(e.type)));
                    if (hasInOther) return true;
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

        if (state.triggerActive && state.triggerActive[t]) return true;

        return false;
    });
}

// ---- 스킬 단일 데미지 계산 ----
// [리팩토링] st → state, bRes → res
// - state: 모든 상태 관련 함수(collectAllEffects, evaluateTrigger 등)와 동일하게 state로 통일
// - res: calculateDamage 반환값. render.js 및 호출부(calculateCycleDamage)의 관례(res, specificRes, cRes)에 맞춰 통일
function calcSingleSkillDamage(type, state, res) {
    const opData = DATA_OPERATORS.find(o => o.id === state.mainOp.id);
    const skillMap = {};
    opData.skill.forEach(s => {
        if (s?.skillType) {
            s.skillType.forEach(st => skillMap[st] = s);
        }
    });

    const skillDef = skillMap[type];
    if (!skillDef) return null;

    const { finalAtk, atkInc, baseAtk, statBonusPct, skillAtkIncData = { all: 0 }, critExp, finalCritRate, critDmg, amp, takenDmg, vuln, unbalanceDmg, resMult, defMult = 1, originiumArts = 0, skillMults = { all: { mult: 0, add: 0 } }, dmgIncData = { all: 0, skill: 0, normal: 0, battle: 0, combo: 0, ult: 0 }, skillCritData = { rate: { all: 0 }, dmg: { all: 0 } }, vulnMap = {}, vulnAmpEffects = [] } = res.stats;

    // dmg 파싱
    const parseDmgPct = (v) => {
        if (!v || v === 0) return 0;
        const m = String(v).match(/([\d.]+)%/);
        return m ? parseFloat(m[1]) / 100 : 0;
    };
    let dmgMult = parseDmgPct(skillDef.dmg);

    const op = DATA_OPERATORS.find(o => o.id === state.mainOp?.id);
    const specialStackVal = state.getSpecialStack ? state.getSpecialStack() : (state.mainOp?.specialStack || 0);

    const bonusList = [];
    if (skillDef.bonus) {
        skillDef.bonus.forEach(b => {
            if (evaluateTrigger(b.trigger, state, opData, b.triggerType, false, b.target, true)) {
                const parsePct = (v) => v ? parseFloat(String(v)) / 100 : 0;
                if (b.base !== undefined || b.perStack !== undefined) {
                    let stackCount = 0;
                    const triggers = Array.isArray(b.trigger) ? b.trigger : [b.trigger];

                    for (const t of triggers) {
                        const count = getAdjustedStackCount(t, state, opData, skillDef.skillType);
                        stackCount = Math.max(stackCount, count);
                    }

                    const bp = b.perStack;
                    const bb = b.base !== undefined ? b.base : (b.val !== undefined ? b.val : 0);
                    const bonusVal = (parseFloat(bb) + parseFloat(bp) * stackCount) / 100;

                    if (bonusVal > 0) {
                        dmgMult += bonusVal;
                        bonusList.push({
                            name: triggers.join(', '),
                            val: bonusVal,
                            stack: stackCount
                        });
                    }
                } else if (b.val) {
                    const bonusVal = parsePct(b.val);
                    dmgMult += bonusVal;
                    bonusList.push({
                        name: Array.isArray(b.trigger) ? b.trigger.join(', ') : b.trigger,
                        val: bonusVal
                    });
                }
            }
        });
    }


    // 7. 물리 이상 처리를 위한 데이터 구성
    const abnormalList = [];
    const defenselessStacks = state.debuffState?.physDebuff?.defenseless || 0;
    const hasDefenseless = defenselessStacks > 0;

    let abnormalMultTotal = 0;
    const skillTypes = skillDef.type ? (Array.isArray(skillDef.type) ? skillDef.type : [skillDef.type]) : [];
    skillTypes.forEach(t => {
        if (!t) return;
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

        if (addMult > 0) {
            abnormalList.push({ name: typeName, mult: addMult, triggerName: '방어 불능', stackCount: defenselessStacks });
            abnormalMultTotal += addMult;
        }

        // --- 아츠 이상 및 아츠 폭발 구현 ---
        const artsAttach = state.debuffState?.artsAttach || { type: null, stacks: 0 };
        const currentAttachType = artsAttach.type;
        const currentStacks = artsAttach.stacks || 0;

        // 스킬이 부여하는 아츠 타입 확인
        let nextAttachType = null;
        let isForcedAbnormal = false;

        if (typeName.includes('부착')) {
            nextAttachType = typeName;
        } else if (typeName.includes('부여')) {
            const base = typeName.replace(' 부여', '');
            nextAttachType = base + ' 부착';
            isForcedAbnormal = true;
        }

        // 아츠 속성 - 이상 상태 매핑
        const ELEMENT_TO_ANOMALY = {
            '열기': '연소',
            '냉기': '동결',
            '전기': '감전',
            '자연': '부식'
        };

        if (nextAttachType) {
            const nextBase = nextAttachType.replace(' 부착', '');
            const currentBase = currentAttachType ? currentAttachType.replace(' 부착', '') : null;

            let artsMult = 0;
            let artsName = '';
            let shouldTrigger = false;

            if (currentAttachType && currentBase === nextBase) {
                // 1. 아츠 폭발 (동일 속성)
                artsName = currentBase + ' 폭발';
                // 강제 부여로 인한 폭발은 데미지 0
                artsMult = isForcedAbnormal ? 0 : 1.6;
                shouldTrigger = true;
            } else if (currentAttachType || isForcedAbnormal) {
                // 2. 아츠 이상 (다른 속성 혹은 강제 부여)
                const targetAnomaly = ELEMENT_TO_ANOMALY[nextBase] || nextBase;
                artsName = targetAnomaly + '(이상)';
                shouldTrigger = true;

                const S = currentStacks;
                if (targetAnomaly === '연소') {
                    // 연소: 초기 (80%+S*80%) + 추가 (120%+S*120%)
                    // 강제 부여(연소 부여)는 초기 데미지 0, 추가 데미지는 스택 보너스 없이 1스택분(120%) 고정
                    const initial = isForcedAbnormal ? 0 : (0.8 + S * 0.8);
                    const additional = isForcedAbnormal ? 1.2 : (1.2 + S * 1.2);
                    artsMult = initial + additional;
                } else {
                    // 감전, 동결, 부식: 강제 부여된 아츠 이상은 데미지가 없음
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
                    name: artsName,
                    mult: artsMult,
                    triggerName: currentAttachType || '없음',
                    stackCount: currentStacks,
                    isArts: true,
                    originalType: typeName // 트리거 연동용
                });
                abnormalMultTotal += artsMult;
            }
        }
    });

    // 스킬 관련 로그/기록용 최종 배율 (UI용)
    let abnormalDesc = '';
    if (abnormalList.length > 0) {
        const artsStrengthMult = 1 + (originiumArts / 100);
        const descParts = abnormalList.map(a => {
            const boostedMult = a.mult * artsStrengthMult;
            return `${a.name} +${(boostedMult * 100).toFixed(0)}%`;
        });
        abnormalDesc = ` (${descParts.join(', ')})`;
    }

    // '강화 일반 공격' -> '일반 공격' 처럼 베이스 스킬 타입 추출
    const skillName = Array.isArray(type) ? type[0] : type;
    const baseType = skillName.startsWith('강화 ') ? skillName.substring(3) : skillName;

    const SKILL_MULT_TYPES = new Set(['일반 공격', '배틀 스킬', '연계 스킬', '궁극기']);
    let sMult = 0;
    let sAdd = 0;

    if (skillMults) {
        if (typeof skillMults === 'number') {
            sMult = skillMults;
        } else {
            const addObj = (obj) => {
                if (typeof obj === 'number') { sMult += obj; }
                else if (obj) { sMult += (obj.mult || 0); sAdd += (obj.add || 0); }
            };
            addObj(skillMults.all);
            addObj(skillMults[baseType]);
            if (type !== baseType) addObj(skillMults[type]);
        }
    }

    let adjDmgMult = SKILL_MULT_TYPES.has(baseType)
        ? (dmgMult + sAdd / 100) * (1 + sMult / 100)
        : dmgMult;

    // 물리 이상은 스킬 배율(sMult)에 영향받지 않도록 나중에 더함
    adjDmgMult += abnormalMultTotal;

    const typeMap = { '배틀 스킬': 'battle', '연계 스킬': 'combo', '궁극기': 'ult', '일반 공격': 'normal' };
    let typeInc = dmgIncData.all;
    if (baseType === '일반 공격') typeInc += dmgIncData.normal;
    else typeInc += dmgIncData.skill + (dmgIncData[typeMap[baseType]] || 0);

    // [Fix] 속성별 주는 피해(물리/열기 등)가 스킬 계산에서 누락되던 문제 수정
    const skillElement = skillDef.element || (opData.type === 'phys' ? 'phys' : opData.element);
    if (skillElement && dmgIncData[skillElement]) {
        typeInc += dmgIncData[skillElement];
    }

    // 강화 스킬 전용 피해 증가 옵션이 있다면 그것도 더해줌 (현재 구조상 skill, normal, battle등에 합산됨)
    // baseType으로 이미 합산되었음.

    // 스킬 전용 치명타 확률/피해 합산 및 기댓값 재계산
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

    const baseMultOnly = adjDmgMult - abnormalMultTotal;

    let finalVuln = vuln;
    vulnAmpEffects.forEach(eff => {
        const isTypeMatch = !eff.skillType || (eff.skillType && eff.skillType.includes(baseType));
        if (isTypeMatch && !state.disabledEffects.includes(eff.uid)) {
            const targets = eff.targetEffect || (eff.type.includes('냉기 취약 증폭') ? ['냉기 취약'] : ['취약']);
            targets.forEach(tKey => {
                const vVal = vulnMap[tKey] || 0;
                if (vVal > 0) {
                    const ampVal = vVal * (resolveVal(eff.val) * (eff.forgeMult || 1.0));
                    finalVuln += ampVal;
                    const label = (eff.type === '취약 증폭' ? '취약 증폭' : '냉기 취약 증폭') + ` (${tKey})`;
                    bonusList.push({ name: label, val: ampVal / 100 });
                }
            });
        }
    });

    const commonMults = adjCritExp * (1 + typeInc / 100) * (1 + amp / 100) * (1 + takenDmg / 100) * (1 + finalVuln / 100) * (1 + unbalanceDmg / 100) * resMult * defMult;

    // 물리 이상용 공통 승수 (스킬 관련 피해 증가 제외) + 아츠 강도 보너스
    const artsStrengthMult = 1 + (originiumArts / 100);
    const abnormalInc = dmgIncData.all;

    // [Fix] 오리지늄 아츠 강도는 물리/아츠 이상 데미지에만 적용 (스킬 기본 데미지 미적용)
    const finalSkillCommonMults = commonMults;

    const baseHitDmg = adjFinalAtk * baseMultOnly * finalSkillCommonMults;

    const abnormalDmgMap = {};
    const resKeyMap = { heat: '열기', elec: '전기', cryo: '냉기', nature: '자연' };

    abnormalList.forEach(a => {
        const aData = DATA_ABNORMALS[a.name] || DATA_ABNORMALS[a.name.replace('(이상)', '')];
        let aResMult = resMult;
        let aVuln = vuln;
        let aTaken = takenDmg;
        let aInc = abnormalInc; // 기본은 dmgIncData.all

        if (aData) {
            const aElem = aData.element;
            const activeResKey = aElem === 'phys' ? '물리' : (resKeyMap[aElem] || null);

            if (activeResKey && res.stats.allRes) {
                const aResVal = res.stats.allRes[activeResKey] - (res.stats.resIgnore || 0);
                aResMult = 1 - aResVal / 100;
            }

            const eKey = aElem === 'phys' ? '물리' : (resKeyMap[aElem] || null);
            if (eKey) {
                aVuln = (res.stats.vulnMap['취약'] || 0) + (res.stats.vulnMap[eKey + ' 취약'] || 0);

                const isArts = (aElem !== 'phys');
                const abVal = res.stats.armorBreakVal || 0;
                const gsVal = res.stats.gamsunVal || 0;
                aTaken = (res.stats.baseTakenDmg || 0) + (isArts ? gsVal : abVal);

                // 속성별 피해 증가 적용 (예: 물리 피해 증가, 열기 피해 증가)
                const elKey = aElem; // phys, heat, elec, cryo, nature
                aInc = (res.stats.dmgIncData.all || 0) + (res.stats.dmgIncData[elKey] || 0);
            }
        }

        const aCommonMults = adjCritExp * (1 + aInc / 100) * (1 + amp / 100) * (1 + aTaken / 100) * (1 + aVuln / 100) * (1 + unbalanceDmg / 100) * aResMult * defMult * artsStrengthMult;
        let aDmg = adjFinalAtk * a.mult * aCommonMults;

        // 판(Da Pan) 전용 강타 보너스 (1.2배 곱연산)
        if (state.mainOp.id === 'Da Pan' && a.name === '강타') {
            aDmg *= 1.2;
        }

        abnormalDmgMap[a.name] = Math.floor(aDmg);
    });

    const myLogs = JSON.parse(JSON.stringify(res.logs));

    // 스킬 전용 로그 필터링
    myLogs.dmgInc = (res.logs.dmgInc || []).filter(l => {
        if (l.tag === 'all') return false;
        if (l.tag === 'skillMult') {
            const arr = l.skillType || [];
            if (arr.length === 0) return SKILL_MULT_TYPES.has(baseType);
            return arr.includes(baseType) || arr.includes(type);
        }
        if (baseType === '일반 공격' && l.tag === 'normal') return true;
        if (baseType !== '일반 공격' && (l.tag === 'skill' || l.tag === typeMap[baseType])) return true;
        return false;
    });

    // 필터링된 공격력 로그 (스킬 타입 매칭되는 것만)
    myLogs.atk = (res.logs.atk || []).filter(l => {
        if (l.uid === 'base_op_atk' || l.uid === 'base_wep_atk' || l.uid === 'stat_bonus_atk') return true;
        if (l.tag === 'skillAtk') {
            const arr = l.skillType || [];
            if (arr.length === 0) return true;
            return arr.includes(baseType) || arr.includes(type);
        }
        return true;
    });

    // 연타(Combo) 곱연산 버프 처리
    let comboMult = 1;
    const comboStacks = state.debuffState?.physDebuff?.combo || 0;
    if (comboStacks > 0) {
        if (baseType === '배틀 스킬') comboMult = 1 + ([0, 30, 45, 60, 75][comboStacks] / 100);
        else if (baseType === '궁극기') comboMult = 1 + ([0, 20, 30, 40, 50][comboStacks] / 100);
    }

    if (comboMult > 1) {
        const tag = baseType === '배틀 스킬' ? 'battle' : 'ult';
        myLogs.dmgInc.push({ txt: `[연타 ${comboStacks}단계] x${comboMult.toFixed(2)} (곱연산)`, uid: 'combo_buff', tag: tag });
    }

    // 판 전용 강타 로그 추가
    if (state.mainOp.id === 'Da Pan' && abnormalDmgMap['강타'] !== undefined) {
        myLogs.dmgInc.push({ txt: `[판 고유 특성] 강타 피해 x1.20 (곱연산)`, uid: 'fan_smash_bonus', tag: typeMap[baseType] });
    }

    // 아츠 강도 로그 추가 (이상 데미지가 있는 경우에만)
    if (originiumArts > 0 && abnormalList.length > 0) {
        myLogs.arts.push({ txt: `오리지늄 아츠 강도: +${originiumArts.toFixed(1)}% (이상 데미지에 적용)`, uid: 'skill_arts_strength', tag: typeMap[baseType] });
    }

    // 취약 증폭 로그 추가
    vulnAmpEffects.forEach(eff => {
        const isTypeMatch = !eff.skillType || (eff.skillType && eff.skillType.includes(baseType));
        if (isTypeMatch && !state.disabledEffects.includes(eff.uid)) {
            const targets = eff.targetEffect || (eff.type.includes('냉기 취약 증폭') ? ['냉기 취약'] : ['취약']);
            targets.forEach(tKey => {
                const vVal = vulnMap[tKey] || 0;
                if (vVal > 0) {
                    const ampFactor = (1 + (resolveVal(eff.val, res.stats) * (eff.forgeMult || 1.0))).toFixed(1);
                    const displayName = (eff.name || '').replace(/(_t|_s)\d+$/g, '');
                    myLogs.vuln.push({ txt: `[${displayName}] *${ampFactor} (${tKey})`, uid: eff.uid });
                }
            });
        }
    });

    const finalSingleHitDmg = Math.floor(baseHitDmg * comboMult) + Object.values(abnormalDmgMap).reduce((acc, v) => acc + v, 0);

    // 스킬 전용 치명타 로그 필터링 및 추가
    const critLogs = (res.logs.crit || []).filter(l => {
        if (l.tag === 'skillCrit') {
            const arr = l.skillType || [];
            if (arr.length === 0) return true; // all
            return arr.includes(baseType) || arr.includes(type);
        }
        return false;
    });
    myLogs.crit.push(...critLogs);

    // 스킬 전용 공격력 보너스 로그 필터링 및 추가
    const atkLogs = (res.logs.atkBuffs || []).filter(l => {
        if (l.tag === 'skillAtk') {
            const arr = l.skillType || [];
            if (arr.length === 0) return true; // all
            return arr.includes(baseType) || arr.includes(type);
        }
        return false;
    });
    myLogs.atk.push(...atkLogs);

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
        activeEffects: res.activeEffects
    };
}

/**
 * 사이클 데미지를 계산한다.
 * 각 스킬을 sequence 순서대로 순회하며, 스킬 타입별 dmg(배율%)로 데미지를 구한다.
 */
function calculateCycleDamage(currentState, baseRes, forceMaxStack = false) {
    if (!baseRes || !baseRes.stats || !currentState.mainOp?.id) return null;
    const sequenceInput = currentState.skillSequence || [];

    const opData = DATA_OPERATORS.find(o => o.id === currentState.mainOp.id);
    const skillMap = {};
    if (opData && opData.skill) {
        opData.skill.forEach(s => {
            if (s?.skillType) {
                s.skillType.forEach(st => skillMap[st] = s);
            }
        });
    }

    const perSkill = {};
    const perAbnormal = {};

    // 추가 피해(Proc) 효과 수집 (재능/잠재 중 dmg와 trigger가 있는 항목)
    const procEffects = [];
    if (opData.talents) {
        opData.talents.forEach((tArr, i) => {
            tArr.forEach(eff => {
                if (eff.dmg && eff.trigger) {
                    procEffects.push({ ...eff, label: `재능${i + 1}` });
                }
            });
        });
    }
    const mainPot = Number(currentState.mainOp.pot) || 0;
    for (let p = 0; p < mainPot; p++) {
        if (opData.potential?.[p]) {
            opData.potential[p].forEach(eff => {
                if (eff.dmg && eff.trigger) {
                    procEffects.push({ ...eff, label: `잠재${p + 1}` });
                }
            });
        }
    }

    // 무기 특성 Proc 효과 수집
    if (currentState.mainOp?.wepId) {
        const wepData = DATA_WEAPONS.find(w => w.id === currentState.mainOp.wepId);
        const wepRefine = Math.max(0, (Number(currentState.mainOp.wepRefine) || 1) - 1);
        if (wepData && wepData.traits) {
            wepData.traits.forEach(trait => {
                const isProcType = trait.dmg || (Array.isArray(trait.type) && trait.type.includes('물리 데미지'));
                if (isProcType && trait.trigger) {
                    let dmgValue = trait.dmg;
                    if (!dmgValue && trait.valByLevel) {
                        dmgValue = trait.valByLevel[wepRefine];
                    }
                    if (dmgValue) {
                        procEffects.push({
                            ...trait,
                            dmg: dmgValue,
                            label: `무기:${wepData.name}`
                        });
                    }
                }
            });
        }
    }

    // 세트 효과 Proc 수집
    if (currentState.activeSetId) {
        const setData = DATA_SETS.find(s => s.id === currentState.activeSetId);
        if (setData && setData.effects) {
            setData.effects.forEach(eff => {
                const isProcType = eff.dmg || (Array.isArray(eff.type) && eff.type.includes('물리 데미지'));
                if (isProcType && eff.trigger) {
                    let dmgValue = eff.dmg;
                    // dmg가 배열인 경우 첫 번째 값 사용 (예: ['250%'])
                    if (Array.isArray(dmgValue)) dmgValue = dmgValue[0];

                    if (dmgValue) {
                        procEffects.push({
                            ...eff,
                            dmg: dmgValue,
                            label: `세트:${setData.name}`
                        });
                    }
                }
            });
        }
    }

    // 1. 모든 스킬 타입(강화 스킬 포함)의 기본 데미지
    Object.keys(skillMap).forEach(type => {
        perSkill[type] = { dmg: 0, count: 0, unitDmg: 0, logs: [], dmgRate: '0%', desc: '' };
        const skillDef = skillMap[type];
        if (!skillDef) return;

        let specificRes = baseRes;
        const typeMap = { '배틀 스킬': 'battle', '연계 스킬': 'combo', '궁극기': 'ult', '일반 공격': 'normal' };
        const calculationTag = typeMap[type] || 'common';

        if (skillDef.element) {
            specificRes = calculateDamage({ ...currentState, overrideSkillElement: skillDef.element, calculationTag }, forceMaxStack);
        } else {
            // 속성 변경이 없더라도 태그를 전달하기 위해 새 결과 계산
            specificRes = calculateDamage({ ...currentState, calculationTag }, forceMaxStack);
        }

        const res = calcSingleSkillDamage(type, currentState, specificRes);
        if (res) {
            perSkill[type] = { ...perSkill[type], ...res, dmg: 0, count: 0 };
        }
    });

    const sequenceResult = [];
    let total = 0;

    // 2. sequence를 순회하며 개별 시퀀스 리스트 구성 및 누적
    sequenceInput.forEach((itemObj) => {
        const isObj = typeof itemObj === 'object';
        const type = isObj ? itemObj.type : itemObj;
        const pSkill = perSkill[type];

        if (!pSkill) {
            sequenceResult.push({ type, dmg: 0, dmgRate: '0%', logs: [], desc: '' });
            return;
        }

        const skillDef = skillMap[type];
        let skillData = pSkill;
        let cRes = null;

        const customStateMerged = { ...currentState };
        // mainOp의 불변성을 위해 복사본 생성 (개별 설정 시 specialStack 오염 방지)
        customStateMerged.mainOp = { ...currentState.mainOp };
        let hasCustomState = false;

        if (isObj && itemObj.customState) {
            hasCustomState = true;
            customStateMerged.disabledEffects = itemObj.customState.disabledEffects;
            customStateMerged.effectStacks = itemObj.customState.effectStacks;
            customStateMerged.debuffState = itemObj.customState.debuffState;
            customStateMerged.enemyUnbalanced = itemObj.customState.enemyUnbalanced;
            customStateMerged.mainOp.specialStack = itemObj.customState.specialStack;
        }

        const typeMap = { '배틀 스킬': 'battle', '연계 스킬': 'combo', '궁극기': 'ult', '일반 공격': 'normal' };
        customStateMerged.calculationTag = typeMap[type] || 'common';

        // 스킬에 지정된 속성이 있다면 덮어쓰기를 설정합니다.
        if (skillDef && skillDef.element) {
            customStateMerged.overrideSkillElement = skillDef.element;
        }

        // 개별 설정을 선택했을 때, 대시보드가 해당 옵션과 스킬 속성 기준으로 표시될 수 있도록 cRes를 항상 구합니다.
        cRes = calculateDamage(customStateMerged, forceMaxStack);

        if (hasCustomState && cRes) {
            const sRes = calcSingleSkillDamage(type, customStateMerged, cRes);
            if (sRes) skillData = { ...sRes };
        }

        const skillBaseDmg = skillData.baseUnitDmg || 0;
        let skillTotal = skillData.unitDmg || 0;

        // 발동형 추가 피해(Proc) 처리
        if (skillData.abnormalInfo && procEffects.length > 0) {
            procEffects.forEach(pe => {
                // 발동 조건(trigger) 중 하나라도 스킬의 상태 이상(abnormalInfo)에 포함되어 있는지 확인
                const isTriggerMet = pe.trigger.some(t =>
                    skillData.abnormalInfo.some(a => {
                        // 1. 기본 이름 매칭 (예: '강타')
                        if (a.name === t) return true;
                        // 2. 물리 이상 강제 이름 매칭
                        if ((t === '넘어뜨리기' && a.name === '강제 넘어뜨리기') || (t === '띄우기' && a.name === '강제 띄우기')) return true;
                        // 3. 아츠 이상 매칭 (원본 부여 타입 혹은 이상 상태 이름)
                        if (a.isArts) {
                            if (a.originalType === t) return true;
                            const artsBaseName = a.name.replace('(이상)', '');
                            if (artsBaseName === t || artsBaseName + ' 부여' === t) return true;
                            // '동결 부여' 트리거는 '동결(이상)'과 매칭되어야 함
                            if (t.endsWith(' 부여') && t.startsWith(artsBaseName)) return true;
                        }
                        return false;
                    })
                );

                if (isTriggerMet) {
                    // Proc 데미지 계산 (해당 스킬 시점의 스탯/버프 반영)
                    const targetStats = (hasCustomState && cRes) ? cRes.stats : skillData.stats || (cRes ? cRes.stats : baseRes.stats);

                    // 계수 파싱
                    const parsePct = (v) => {
                        const m = String(v).match(/([\d.]+)%/);
                        return m ? parseFloat(m[1]) / 100 : 0;
                    };
                    const dmgMult = parsePct(pe.dmg);

                    // 공통 승수 (스킬 전용 버프 제외한 전역 버프들)
                    const commonMults = targetStats.critExp *
                        (1 + (targetStats.dmgIncData?.all || targetStats.dmgInc || 0) / 100) *
                        (1 + (targetStats.amp || 0) / 100) *
                        (1 + (targetStats.takenDmg || 0) / 100) *
                        (1 + (targetStats.vuln || 0) / 100) *
                        (1 + (targetStats.unbalanceDmg || 0) / 100) *
                        (targetStats.resMult || 1) *
                        (targetStats.defMult || 1);

                    const procDmg = Math.floor(targetStats.finalAtk * dmgMult * commonMults);
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

        pSkill.dmg += skillBaseDmg; // 집계는 이제 baseUnitDmg만 누적
        pSkill.count += 1;
        pSkill.dmgRate = skillData.dmgRate; // 실제 적용된 배율로 업데이트
        pSkill.unitDmg = skillData.baseUnitDmg; // 실제 적용된 1회 데미지로 업데이트 (베이스만)

        if (skillData.abnormalDmgs) {
            Object.entries(skillData.abnormalDmgs).forEach(([aName, aDmg]) => {
                // [Fix] '아츠 소모' 종류는 사이클 합계 및 리스트에서 제외 (데미지 0 취급)
                if (aName.includes('소모(이상)')) {
                    skillTotal -= aDmg; // skillTotal에서 해당 데미지 차감
                    return;
                }
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
            cRes: cRes,
            activeEffects: skillData.activeEffects
        });
    });

    return { sequence: sequenceResult, perSkill, perAbnormal, total };
}