/**
 * ============ 전역 상태 관리 (script.js) ============
 */
let state = {
    mainOp: {
        id: null, pot: 0,
        wepId: null, wepPot: 0, wepState: false,
        gearForge: false,
        gears: [null, null, null, null],
        gearForged: [false, false, false, false]
    },
    subOps: [
        { id: null, pot: 0, wepId: null, wepPot: 0, wepState: false, equipSet: null },
        { id: null, pot: 0, wepId: null, wepPot: 0, wepState: false, equipSet: null },
        { id: null, pot: 0, wepId: null, wepPot: 0, wepState: false, equipSet: null }
    ],
    enemyUnbalanced: false,
    activeSetId: null
};

const STAT_NAME_MAP = {
    str: '힘', agi: '민첩', int: '지능', wil: '의지'
};

function getStatName(key) {
    return STAT_NAME_MAP[key] || key;
}

function updateState() {
    state.mainOp.id = document.getElementById('main-op-select')?.value || null;
    state.mainOp.pot = Number(document.getElementById('main-op-pot')?.value) || 0;
    state.mainOp.wepId = document.getElementById('main-wep-select')?.value || null;
    state.mainOp.wepPot = Number(document.getElementById('main-wep-pot')?.value) || 0;
    state.mainOp.wepState = document.getElementById('main-wep-state')?.checked || false;
    state.mainOp.gearForge = document.getElementById('main-gear-forge')?.checked || false;

    const gearIds = ['gear-gloves-select', 'gear-armor-select', 'gear-kit1-select', 'gear-kit2-select'];
    const forgeIds = ['gear-gloves-forge', 'gear-armor-forge', 'gear-kit1-forge', 'gear-kit2-forge'];

    gearIds.forEach((id, idx) => {
        state.mainOp.gears[idx] = document.getElementById(id)?.value || null;
    });
    forgeIds.forEach((id, idx) => {
        state.mainOp.gearForged[idx] = document.getElementById(id)?.checked || false;
    });

    for (let i = 0; i < 3; i++) {
        state.subOps[i].id = document.getElementById(`sub-${i}-op`)?.value || null;
        state.subOps[i].pot = Number(document.getElementById(`sub-${i}-pot`)?.value) || 0;
        state.subOps[i].wepId = document.getElementById(`sub-${i}-wep`)?.value || null;
        state.subOps[i].wepPot = Number(document.getElementById(`sub-${i}-wep-pot`)?.value) || 0;
        state.subOps[i].wepState = document.getElementById(`sub-${i}-wep-state`)?.checked || false;
        state.subOps[i].equipSet = document.getElementById(`sub-${i}-set`)?.value || null;
    }

    state.enemyUnbalanced = document.getElementById('enemy-unbalanced')?.checked || false;

    const result = calculateDamage(state);
    if (typeof renderResult === 'function') renderResult(result);
    if (typeof renderWeaponComparison === 'function') renderWeaponComparison(result ? result.finalDmg : 0);

    saveState();
}

function saveState() {
    try {
        localStorage.setItem('endfield_cal_save', JSON.stringify(state));
    } catch (e) {
        console.error('State save failed:', e);
    }
}

function loadState() {
    try {
        const saved = localStorage.getItem('endfield_cal_save');
        if (saved) {
            state = { ...state, ...JSON.parse(saved) };
            return true;
        }
    } catch (e) {
        console.error('State load failed:', e);
    }
    return false;
}

// ============ 데미지 계산 엔진 ============

function calculateDamage(currentState) {
    const opData = DATA_OPERATORS.find(o => o.id === currentState.mainOp.id);
    const wepData = DATA_WEAPONS.find(w => w.id === currentState.mainOp.wepId);

    if (!opData || !wepData) return null;

    let stats = { ...opData.stats };
    let allEffects = [];

    collectAllEffects(currentState, opData, wepData, stats, allEffects);
    applyFixedStats(allEffects, stats);
    applyPercentStats(allEffects, stats);

    return computeFinalDamageOutput(currentState, opData, wepData, stats, allEffects);
}

function collectAllEffects(state, opData, wepData, stats, allEffects) {
    const addEffect = (source, name, forgeMult = 1.0, isSub = false) => {
        if (!source) return;
        const sources = Array.isArray(source) ? source : [source];
        sources.forEach(eff => {
            if (!eff) return;
            if (isSub && !isSubOpTargetValid(eff)) return;
            allEffects.push({ ...eff, name, forgeMult });
        });
    };

        // 1. 장비
        for (let i = 0; i < state.mainOp.gears.length; i++) {
            const gId = state.mainOp.gears[i];
            if (!gId) continue;
            const gear = DATA_GEAR.find(g => g.id === gId);
            if (gear) {
                const mult = state.mainOp.gearForged[i] ? 1.5 : 1.0;
                
                // gear.stat1/2가 'str' 등 영어일 수도 있고 '힘' 등 한글일 수도 있음
                // stats 객체의 키(영어)를 정확히 찾아야 함
                [gear.stat1, gear.stat2].forEach((s, idx) => {
                    if (!s) return;
                    const val = (idx === 0 ? gear.val1 : gear.val2) * mult;
                    let key = s;
                    if (stats[s] === undefined) {
                        if (STAT_NAME_MAP[s] && stats[STAT_NAME_MAP[s]] !== undefined) {
                            key = STAT_NAME_MAP[s];
                        }
                    }
                    if (stats[key] !== undefined) stats[key] += val;
                });
                
                if (gear.trait) addEffect(gear.trait, gear.name, mult);
            }
        }
    // 2. 무기
    wepData.traits.forEach((trait, idx) => {
        if (!trait) return;
        let traitIdx = idx >= 2 ? 3 : idx + 1;
        let finalLv = calculateWeaponTraitLevel(idx, state.mainOp.wepState, state.mainOp.wepPot);
        let label = `${wepData.name} 특성${traitIdx}(Lv${finalLv})`;
        let val = calculateWeaponTraitValue(trait, finalLv, state.mainOp.wepState);

        if (trait.type === '스탯') {
            const targetStat = trait.stat === '주스탯' ? opData.mainStat :
                trait.stat === '부스탯' ? opData.subStat : trait.stat;
            const type = idx >= 2 ? '스탯%' : '스탯';
            addEffect({ type, stat: targetStat, val }, label);
        } else {
            addEffect({ ...trait, val }, label);
        }
    });

    // 3. 메인 오퍼레이터
    const skillNames = ['배틀스킬', '연계스킬', '궁극기'];
    if (opData.skill) opData.skill.forEach((s, i) => addEffect(s, `${opData.name} ${skillNames[i] || `스킬${i + 1}`}`));
    if (opData.talents) opData.talents.forEach((t, i) => addEffect(t, `${opData.name} 재능${i + 1}`));

    const mainPot = Number(state.mainOp.pot) || 0;
    for (let p = 0; p < mainPot; p++) {
        if (opData.potential && opData.potential[p]) addEffect(opData.potential[p], `${opData.name} 잠재${p + 1}`);
    }

    // 4. 서브 오퍼레이터
    state.subOps.forEach((sub, idx) => {
        if (!sub.id) return;
        const subOpData = DATA_OPERATORS.find(o => o.id === sub.id);
        const prefix = subOpData ? subOpData.name : `서브${idx + 1}`;

        if (sub.wepId) {
            const sWep = DATA_WEAPONS.find(w => w.id === sub.wepId);
            if (sWep) {
                for (let ti = 0; ti < sWep.traits.length; ti++) {
                    const trait = sWep.traits[ti];
                    if (!trait) continue;
                    let traitIdx = ti >= 2 ? 3 : ti + 1;
                    let val = calculateWeaponTraitValue(trait, (sub.wepState ? 4 : 1) + (sub.wepPot || 0), sub.wepState);
                    addEffect({ ...trait, val }, `${prefix} ${sWep.name} 특성${traitIdx}`, 1.0, true);
                }
            }
        }

        if (sub.equipSet) {
            const set = DATA_SETS.find(s => s.id === sub.equipSet);
            if (set && set.effect) {
                let active = true;
                if (set.effect.cond === 'arts_only' && subOpData.type !== 'arts') active = false;
                if (set.effect.cond === 'phys_only' && subOpData.type !== 'phys') active = false;
                if (active) addEffect(set.effect, `${prefix} 세트`, 1.0, true);
            }
        }

        if (subOpData) {
            if (subOpData.skill) subOpData.skill.forEach((s, i) => addEffect(s, `${prefix} ${skillNames[i] || `스킬${i + 1}`}`, 1.0, true));
            if (subOpData.talents) subOpData.talents.forEach((t, i) => addEffect(t, `${prefix} 재능${i + 1}`, 1.0, true));
            const subPot = Number(sub.pot) || 0;
            for (let sp = 0; sp < subPot; sp++) {
                if (subOpData.potential && subOpData.potential[sp]) addEffect(subOpData.potential[sp], `${prefix} 잠재${sp + 1}`, 1.0, true);
            }
        }
    });

    // 5. 세트 효과
    const activeNonStackTypes = new Set();
    const opsForSet = [
        { opData: opData, setId: getActiveSetID(state.mainOp.gears), name: opData.name },
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
                if (activeNonStackTypes.has(eff.type)) return;
                activeNonStackTypes.add(eff.type);
            }
            if (idx > 0 && !isSubOpTargetValid(eff)) return;

            const setName = DATA_SETS.find(s => s.id === entry.setId)?.name || entry.setId;
            allEffects.push({ ...eff, name: `${entry.name} ${setName} 세트효과` });
        });
    });
}

function applyFixedStats(allEffects, stats) {
    allEffects.forEach(eff => {
        if (eff.type === '스탯') {
            const val = Number(eff.val) * (eff.forgeMult || 1.0);
            const target = eff.stat || eff.stats;
            if (target === '모든 능력치') {
                ['str', 'agi', 'int', 'wil'].forEach(k => stats[k] += val);
            } else {
                // target이 'str'이면 'str', '힘'이면 'str'로 변환
                const sKey = STAT_NAME_MAP[target] === undefined ? target : (STAT_NAME_MAP[target].match(/^[a-z]+$/) ? STAT_NAME_MAP[target] : target);
                // 위 로직이 복잡하므로, 단순하게 처리:
                // STAT_NAME_MAP은 {str:'힘', '힘':'str'} 형태임.
                // target이 'str'이면 STAT_NAME_MAP['str']='힘'. stats['힘']은 undefined.
                // target이 '힘'이면 STAT_NAME_MAP['힘']='str'. stats['str']은 존재.

                let realKey = target;
                if (stats[target] === undefined) {
                    // target이 영어 키가 아님. 매핑 시도
                    if (STAT_NAME_MAP[target] && stats[STAT_NAME_MAP[target]] !== undefined) {
                        realKey = STAT_NAME_MAP[target];
                    }
                }

                if (stats[realKey] !== undefined) stats[realKey] += val;
            }
        }
    });
}

function applyPercentStats(allEffects, stats) {
    let statPct = { str: 0, agi: 0, int: 0, wil: 0 };
    allEffects.forEach(eff => {
        if (eff.type === '스탯%') {
            const val = Number(eff.val) * (eff.forgeMult || 1.0);
            const target = eff.stat || eff.stats;
            if (target === '모든 능력치') {
                ['str', 'agi', 'int', 'wil'].forEach(k => statPct[k] += val);
            } else {
                let realKey = target;
                if (statPct[target] === undefined) {
                    if (STAT_NAME_MAP[target] && statPct[STAT_NAME_MAP[target]] !== undefined) {
                        realKey = STAT_NAME_MAP[target];
                    }
                }
                if (statPct[realKey] !== undefined) statPct[realKey] += val;
            }
        }
    });
    ['str', 'agi', 'int', 'wil'].forEach(k => {
        if (statPct[k] > 0) stats[k] *= (1 + statPct[k] / 100);
    });
}

function computeFinalDamageOutput(state, opData, wepData, stats, allEffects) {
    let baseAtk = opData.baseAtk + wepData.baseAtk;
    let atkInc = 0, critRate = 5, critDmg = 50, dmgInc = 0, amp = 0, vuln = 0, takenDmg = 0, multiHit = 1.0, unbalanceDmg = 0, originiumArts = 0;

    let logs = {
        atk: [], atkBuffs: [], dmgInc: [], amp: [], vuln: [],
        taken: [], unbal: [], multihit: [], crit: [], arts: []
    };

    let atkBaseLogs = [
        `오퍼레이터 공격력: ${opData.baseAtk.toLocaleString()}`,
        `무기 공격력: ${wepData.baseAtk.toLocaleString()}`
    ];

    const resolveVal = (val) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
            let statSum = 0;
            ['str', 'agi', 'int', 'wil'].forEach(k => { if (val.includes(STAT_NAME_MAP[k])) statSum += stats[k]; });
            const match = val.match(/([\d.]+)%/);
            if (match) return statSum * parseFloat(match[1]);
        }
        return 0;
    };

    // 스탯 특성 로그를 분리하기 위한 임시 배열
    let statLogs = [];

    allEffects.forEach(eff => {
        // 스탯 관련 특성은 별도 로그 처리
        if (eff.type === '스탯' || eff.type === '스탯%') {
            const val = resolveVal(eff.val) * (eff.forgeMult || 1.0);
            const t = (eff.type || '').toString();
            const targetName = getStatName(eff.stat || eff.stats);
            if (t === '스탯') statLogs.push(`[${eff.name}] +${val.toFixed(1)} (${targetName})`);
            else if (t === '스탯%') statLogs.push(`[${eff.name}] +${val.toFixed(1)}% (${targetName} 증가)`);
            return; // 계산은 이미 apply functions에서 처리됨
        }

        if (!isApplicableEffect(opData, eff.type, eff.name)) return;

        const val = resolveVal(eff.val) * (eff.forgeMult || 1.0);
        const t = (eff.type || '').toString();

        if (t === '공격력 증가') { atkInc += val; logs.atkBuffs.push(`[${eff.name}] +${val.toFixed(1)}% (공격력)`); }
        else if (t === '치명타 확률') { critRate += val; logs.crit.push(`[${eff.name}] +${val.toFixed(1)}% (치명타 확률)`); }
        else if (t === '치명타 피해') { critDmg += val; logs.crit.push(`[${eff.name}] +${val.toFixed(1)}% (치명타 피해)`); }
        else if (t === '연타') { multiHit = Math.max(multiHit, eff.val || 1); logs.multihit.push(`[${eff.name}] x${multiHit}`); }
        else if (t.endsWith('증폭')) { amp += val; logs.amp.push(`[${eff.name}] +${val.toFixed(1)}% (${t})`); }
        else if (t.endsWith('취약')) { vuln += val; logs.vuln.push(`[${eff.name}] +${val.toFixed(1)}% (${t})`); }
        else if (t === '불균형 피해') { if (state.enemyUnbalanced) { unbalanceDmg += val; logs.unbal.push(`${eff.name}: +${val.toFixed(1)}%`); } }
        else if (t.includes('받는')) { takenDmg += val; logs.taken.push(`[${eff.name}] +${val.toFixed(1)}% (${t})`); }
        else if (t === '오리지늄 아츠' || t === '오리지늄 아츠 강도') { originiumArts += val; logs.arts.push(`[${eff.name}] +${val.toFixed(1)}`); }
        else if (t.includes('피해') || t === '주는 피해' || t === '모든 스킬 피해') { dmgInc += val; logs.dmgInc.push(`[${eff.name}] +${val.toFixed(1)}% (${t})`); }
    });

    const statBonusPct = (stats[opData.mainStat] * 0.005) + (stats[opData.subStat] * 0.002);
    const finalAtk = baseAtk * (1 + atkInc / 100) * (1 + statBonusPct);

    // 공격력 로그 조립 (기본 -> 공증% -> 스탯보너스 -> 스탯고정/%)
    logs.atk = [
        ...atkBaseLogs,
        ...logs.atkBuffs,
        `스탯 공격보너스: +${(statBonusPct * 100).toFixed(2)}%`,
        ...statLogs
    ];

    const finalCritRate = Math.min(Math.max(critRate, 0), 100);
    const critExp = ((finalCritRate / 100) * (critDmg / 100)) + 1;
    let finalUnbal = unbalanceDmg + (state.enemyUnbalanced ? 30 : 0);
    if (state.enemyUnbalanced) logs.unbal.push(`[불균형 기본] +30.0%`);

    const finalDmg = finalAtk * critExp * (1 + dmgInc / 100) * (1 + amp / 100) * (1 + takenDmg / 100) * (1 + vuln / 100) * multiHit * (1 + finalUnbal / 100);

    let finalWithExtra = finalDmg;
    const swordsman = allEffects.find(e => e.setId === 'set_swordsman' && e.triggered);
    if (swordsman) {
        const extraDmg = finalAtk * 2.5;
        finalWithExtra += extraDmg;
        logs.dmgInc.push(`[검술사 추가피해] +${Math.floor(extraDmg).toLocaleString()}`);
    }

    return {
        finalDmg: finalWithExtra,
        stats: {
            finalAtk, atkInc,
            mainStatName: STAT_NAME_MAP[opData.mainStat], mainStatVal: stats[opData.mainStat],
            subStatName: STAT_NAME_MAP[opData.subStat], subStatVal: stats[opData.subStat],
            critExp, finalCritRate, critDmg, dmgInc, amp, vuln, takenDmg, unbalanceDmg: finalUnbal, originiumArts
        },
        logs
    };
}

function calculateWeaponTraitLevel(idx, state, pot) {
    // 특성 0, 1 (주스탯/부스탯)은 기질 OFF -> Lv3, ON -> Lv9 고정 적용
    if (idx === 0 || idx === 1) return state ? 9 : 3;
    // 그 외 특성 (특성 3 등)은 기본 로직 (1+pot or 4+pot)
    return (state ? 4 : 1) + pot;
}

function calculateWeaponTraitValue(trait, level, state) {
    // valByLevel 배열이 있으면 레벨에 맞는 인덱스 값 반환 (1레벨 -> 0번 인덱스)
    if (trait.valByLevel && trait.valByLevel.length > 0) {
        return trait.valByLevel[Math.min(level - 1, trait.valByLevel.length - 1)];
    }

    return 0;
}

function getValidWeapons(opId) {
    const op = DATA_OPERATORS.find(o => o.id === opId);
    return op && op.usableWeapons ? DATA_WEAPONS.filter(w => op.usableWeapons.includes(w.type)) : [];
}

function isSubOpTargetValid(effect) {
    return effect && (effect.target === '팀' || effect.target === '팀_외' || effect.target === '적');
}

function isApplicableEffect(opData, effectType, effectName) {
    if (!effectType) return false;
    const type = effectType.toString();
    const ALWAYS_APPLICABLE = ['공격력 증가', '치명타 확률', '치명타 피해', '최대 체력', '궁극기 충전', '치유 효율', '연타', '주는 피해', '스탯', '스탯%', '스킬 피해', '궁극기 피해', '연계 스킬 피해', '배틀 스킬 피해', '일반 공격 피해', '오리지늄 아츠', '오리지늄 아츠 강도', '모든 스킬 피해'];
    if (ALWAYS_APPLICABLE.includes(type)) return true;
    if (type === '불균형 피해') return true;

    const checkElement = (prefix) => {
        if (prefix === '피해' || prefix === '모든') return true;
        if (prefix === '물리' && opData.type === 'phys') return true;
        if (prefix === '아츠' && opData.type === 'arts') return true;
        if (prefix === '열기' && opData.element === 'heat') return true;
        if (prefix === '냉기' && opData.element === 'cryo') return true;
        if (prefix === '전기' && opData.element === 'elec') return true;
        if (prefix === '자연' && opData.element === 'nature') return true;
        return false;
    };

    if (type.endsWith('증폭')) return checkElement(type.replace(' 증폭', ''));
    if (type.includes('받는') || type.endsWith('취약')) {
        let prefix = type.replace('받는 ', '').replace(' 피해', '').replace(' 취약', '');
        return checkElement(prefix);
    }
    if (checkElement(type.replace(' 피해', ''))) return true;

    return false;
}

function getActiveSetID(gears) {
    const counts = {};
    gears.forEach(gId => {
        if (!gId) return;
        const gear = DATA_GEAR.find(g => g.id === gId);
        if (gear && gear.set) {
            counts[gear.set] = (counts[gear.set] || 0) + 1;
        }
    });
    for (const [setId, count] of Object.entries(counts)) {
        if (count >= 3) return setId;
    }
    return null;
}

function getSetEffects(setId, opData, isSelf = true) {
    const set = DATA_SETS.find(s => s.id === setId);
    if (!set || !set.effects) return [];

    let activeEffects = [];
    const skillStr = JSON.stringify(opData.skill);
    const talentStr = JSON.stringify(opData.talents);

    const matchTrigger = (t) => {
        if (t === '아츠 부착') {
            return ['열기 부착', '냉기 부착', '전기 부착', '자연 부착'].some(el => skillStr.includes(el) || talentStr.includes(el));
        }
        return skillStr.includes(t) || talentStr.includes(t);
    };

    const canTrigger = (triggers) => {
        if (!triggers) return true;
        return triggers.some(matchTrigger);
    };

    set.effects.forEach(eff => {
        const triggered = canTrigger(eff.triggers);
        if (eff.triggers && !triggered) return;

        if (eff.cond === 'phys_only' && opData.type !== 'phys') return;
        if (eff.cond === 'arts_only' && opData.type !== 'arts') return;
        if (isSelf && eff.target === '팀_외') return;

        if (eff.type === '검술사_추가피해') {
            activeEffects.push({ ...eff, setId: 'set_swordsman', triggered: true });
        } else {
            activeEffects.push({ ...eff });
        }
    });

    return activeEffects;
}

function checkSetViability(setId, opData) {
    const set = DATA_SETS.find(s => s.id === setId);
    if (!set || !set.effects) return false;

    const skillStr = JSON.stringify(opData.skill);
    const talentStr = JSON.stringify(opData.talents);

    const matchTrigger = (t) => {
        if (t === '아츠 부착') {
            return ['열기 부착', '냉기 부착', '전기 부착', '자연 부착'].some(el => skillStr.includes(el) || talentStr.includes(el));
        }
        return skillStr.includes(t) || talentStr.includes(t);
    };

    const conditionalEffects = set.effects.filter(e => e.triggers);
    if (conditionalEffects.length === 0) return true;

    return conditionalEffects.some(eff => eff.triggers.some(matchTrigger));
}