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

function calculateDamage(currentState) {
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

    collectAllEffects(currentState, opData, wepData, stats, allEffects);

    const activeEffects = allEffects.filter(e => !currentState.disabledEffects.includes(e.uid));
    applyFixedStats(activeEffects, stats);
    applyPercentStats(activeEffects, stats);

    return computeFinalDamageOutput(currentState, opData, wepData, stats, allEffects);
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

// ---- 효과 수집 ----
function collectAllEffects(state, opData, wepData, stats, allEffects) {
    const activeNonStackTypes = new Set();

    const addEffect = (source, name, forgeMult = 1.0, isSub = false) => {
        if (!source) return;
        const sources = Array.isArray(source) ? source : [source];
        sources.forEach((eff, i) => {
            if (!eff) return;

            // type이 배열이면 각 항목을 개별 효과로 분리 (항목별 target 지원)
            if (Array.isArray(eff.type)) {
                eff.type.forEach((typeItem, j) => {
                    if (!typeItem?.type) return;
                    const expanded = {
                        ...eff,
                        type: typeItem.type,
                        val: typeItem.val !== undefined ? typeItem.val : eff.val,
                        target: typeItem.target
                    };
                    if (isSub && !isSubOpTargetValid(expanded)) return;
                    if (expanded.nonStack) {
                        const key = `${expanded.sourceId || name}_${expanded.type}`;
                        if (activeNonStackTypes.has(key)) return;
                        activeNonStackTypes.add(key);
                    }
                    const uid = `${name}_${typeItem.type}_v${i}_${j}`;
                    allEffects.push({ ...expanded, name, forgeMult, uid });
                });
                return;
            }

            if (isSub && !isSubOpTargetValid(eff)) return;

            if (eff.nonStack) {
                const key = `${eff.sourceId || name}_${eff.type}`;
                if (activeNonStackTypes.has(key)) return;
                activeNonStackTypes.add(key);
            }

            const uid = `${name}_${eff.type}_v${i}`;
            allEffects.push({ ...eff, name, forgeMult, uid });
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
                if (t.type === '스탯') {
                    // 값에 % 포함 여부로 결정
                    const isPercent = (typeof val === 'string' && val.includes('%'));
                    type = isPercent ? '스탯%' : '스탯';
                    stat = t.stat === '주스탯' ? opData.mainStat
                        : t.stat === '부스탯' ? opData.subStat
                            : t.stat;
                }
                return { ...t, type, stat, val };
            };

            const traits = Array.isArray(gear.trait)
                ? gear.trait.map(processGearTrait)
                : processGearTrait(gear.trait);
            addEffect(traits, gear.name);
        }
    });

    // 2. 무기 (메인 + 서브)
    const weaponsToProcess = [
        { data: wepData, state: state.mainOp.wepState, pot: state.mainOp.wepPot, name: opData.name },
        ...state.subOps.map((sub, idx) => {
            const sOp = DATA_OPERATORS.find(o => o.id === sub.id);
            const sWep = DATA_WEAPONS.find(w => w.id === sub.wepId);
            return { data: sWep, state: sub.wepState, pot: sub.wepPot, name: sOp ? sOp.name : `서브${idx + 1}` };
        })
    ];

    weaponsToProcess.forEach((entry, wIdx) => {
        if (!entry.data) return;
        entry.data.traits.forEach((trait, idx) => {
            if (!trait) return;
            const traitIdx = idx >= 2 ? 3 : idx + 1;
            const finalLv = calculateWeaponTraitLevel(idx, entry.state, entry.pot);
            const val = calculateWeaponTraitValue(trait, finalLv);
            const eff = { ...trait, val, sourceId: entry.data.id };

            let label = `${entry.data.name} 특성${traitIdx}(Lv${finalLv})`;
            if (wIdx > 0) label = `${entry.name} ${entry.data.name} 특성${traitIdx}`;
            const uniqueLabel = `${label}_t${idx}`;

            if (trait.type === '스탯') {
                const targetStat = trait.stat === '주스탯' ? opData.mainStat
                    : trait.stat === '부스탯' ? opData.subStat
                        : trait.stat;
                // idx 기반 판정 삭제, 값에 % 포함 여부로 결정
                const isPercent = typeof val === 'string' && val.includes('%');
                const type = isPercent ? '스탯%' : '스탯';
                addEffect({ ...eff, type, stat: targetStat }, uniqueLabel, 1.0, wIdx > 0);
            } else {
                addEffect(eff, uniqueLabel, 1.0, wIdx > 0);
            }
        });
    });

    // 3. 메인 오퍼레이터
    const skillNames = ['배틀 스킬', '연계 스킬', '궁극기'];
    if (opData.skill) opData.skill.forEach((s, i) => addEffect(s, `${opData.name} ${skillNames[i] || `스킬${i + 1}`}`));
    if (opData.talents) opData.talents.forEach((t, i) => addEffect(t, `${opData.name} 재능${i + 1}`));

    const mainPot = Number(state.mainOp.pot) || 0;
    for (let p = 0; p < mainPot; p++) {
        if (opData.potential?.[p]) addEffect(opData.potential[p], `${opData.name} 잠재${p + 1}`);
    }

    // 4. 서브 오퍼레이터 시너지
    state.subOps.forEach((sub, idx) => {
        if (!sub.id) return;
        const subOpData = DATA_OPERATORS.find(o => o.id === sub.id);
        if (!subOpData?.talents) return;
        const prefix = subOpData.name;

        if (subOpData.skill) {
            const skNames = ['배틀 스킬', '연계 스킬', '궁극기'];
            subOpData.skill.forEach((s, i) => addEffect(s, `${prefix} ${skNames[i]}`, 1.0, true));
        }
        subOpData.talents.forEach((t, ti) => addEffect(t, `${prefix} 재능${ti + 1}`, 1.0, true));

        const subPot = Number(sub.pot) || 0;
        for (let sp = 0; sp < subPot; sp++) {
            if (subOpData.potential?.[sp]) addEffect(subOpData.potential[sp], `${prefix} 잠재${sp + 1}`, 1.0, true);
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
            allEffects.push({ ...eff, name: `${entry.name} ${setName} 세트효과`, uid });
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
function computeFinalDamageOutput(state, opData, wepData, stats, allEffects) {
    const baseAtk = opData.baseAtk + wepData.baseAtk;
    let atkInc = 0, critRate = 5, critDmg = 50, dmgInc = 0, amp = 0, vuln = 0, takenDmg = 0, multiHit = 1.0, unbalanceDmg = 0, originiumArts = 0, skillMults = { all: 0 }, dmgIncMap = { all: 0, skill: 0, normal: 0, battle: 0, combo: 0, ult: 0 };
    const logs = {
        atk: [], atkBuffs: [], dmgInc: [], amp: [], vuln: [],
        taken: [], unbal: [], multihit: [], crit: [], arts: [], res: []
    };
    let resIgnore = 0;

    // ---- 저항 (적 속성별, 0 시작 / 낮을수록 피해 증가) ----
    const ALL_RES_KEYS = ['물리', '열기', '전기', '냉기', '자연'];
    const resistance = { '물리': 0, '열기': 0, '전기': 0, '냉기': 0, '자연': 0 };

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

    const resolveVal = (val) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
            let statSum = 0;
            ['str', 'agi', 'int', 'wil'].forEach(k => { if (val.includes(STAT_NAME_MAP[k])) statSum += stats[k]; });
            const match = val.match(/([\d.]+)%/);
            if (match) {
                // 스탯 키워드가 있으면 스탯 기반 수식 (예: '지능, 의지 1포인트당 0.15% 증가')
                // 스탯 키워드가 없으면 단순 퍼센트 (예: '5%', '30%')
                return statSum > 0 ? statSum * parseFloat(match[1]) : parseFloat(match[1]);
            }
            // % 없는 숫자 문자열 (예: '30')
            const num = parseFloat(val);
            return isNaN(num) ? 0 : num;
        }
        return 0;
    };

    const statLogs = [];

    allEffects.forEach(eff => {
        const isDisabled = state.disabledEffects.includes(eff.uid);
        const displayName = (eff.name || '').replace(/_t\d+$/, '');

        // 표시용 수치 (입력된 값 그대로 사용, 양수면 + 붙임)
        let valDisplay = eff.val;
        if (typeof eff.val === 'number' && eff.val > 0) valDisplay = '+' + eff.val;
        else if (typeof eff.val === 'string' && !eff.val.startsWith('-') && !eff.val.startsWith('+')) valDisplay = '+' + eff.val;

        if (eff.type === '스탯' || eff.type === '스탯%') {
            const tgt = getStatName(eff.stat || eff.stats);
            const line = `[${displayName}] ${valDisplay} (${tgt})`;
            statLogs.push({ txt: line, uid: eff.uid });
            return;
        }

        if (eff.type === '저항 감소') {
            const val = (parseFloat(eff.val) || 0) * (eff.forgeMult || 1.0);
            const resKey = opData.type === 'phys' ? '물리' : (
                { heat: '열기', elec: '전기', cryo: '냉기', nature: '자연' }[opData.element] || null
            );
            if (resKey) {
                logs.res.push({ txt: `[${displayName}] ${resKey} 저항 ${valDisplay}`, uid: eff.uid });
                if (!isDisabled) resistance[resKey] += val;
            }
            return;
        }

        if (!isApplicableEffect(opData, eff.type, eff.name)) return;

        // 계산용 수치 (수식 문자열이면 resolveVal로 스탯 기반 계산)
        const val = resolveVal(eff.val) * (eff.forgeMult || 1.0);

        const t = (eff.type || '').toString();
        const uid = eff.uid;

        if (t === '공격력 증가' || t === '모든 능력치') {
            if (!isDisabled) atkInc += val;
            logs.atkBuffs.push({ txt: `[${displayName}] ${valDisplay} (${t})`, uid });
        } else if (t === '오리지늄 아츠 강도') {
            if (!isDisabled) originiumArts += val;
            logs.arts.push({ txt: `[${displayName}] ${valDisplay} (${t})`, uid });
        } else if (t === '치명타 확률') {
            if (!isDisabled) critRate += val;
            logs.crit.push({ txt: `[${displayName}] ${valDisplay} (${t})`, uid });
        } else if (t === '치명타 피해') {
            if (!isDisabled) critDmg += val;
            logs.crit.push({ txt: `[${displayName}] ${valDisplay} (${t})`, uid });
        } else if (t === '연타') {
            if (!isDisabled) multiHit = Math.max(multiHit, val || 1);
            logs.multihit.push({ txt: `[${displayName}] x${val || 1}`, uid });
        } else if (t.endsWith('증폭')) {
            if (!isDisabled) amp += val;
            logs.amp.push({ txt: `[${displayName}] ${valDisplay} (${t})`, uid });
        } else if (t.endsWith('취약')) {
            if (!isDisabled) vuln += val;
            logs.vuln.push({ txt: `[${displayName}] ${valDisplay} (${t})`, uid });
        } else if (t === '불균형 목표에 주는 피해') {
            if (state.enemyUnbalanced && !isDisabled) {
                dmgInc += val;
                dmgIncMap.all += val;
            }
            logs.dmgInc.push({ txt: `[${displayName}] ${valDisplay} (불균형 목표에 주는 피해)`, uid, unbalancedOff: !state.enemyUnbalanced, tag: 'all' });
        } else if (t.includes('받는')) {
            if (!isDisabled) takenDmg += val;
            logs.taken.push({ txt: `[${displayName}] ${valDisplay} (${t})`, uid });
        } else if (t === '스킬 배율 증가') {
            // 배틀/연계/궁극기 dmg 계수에 곱연산 (사이클 계산에서 반영)
            if (!isDisabled) {
                if (eff.skilltype) skillMults[eff.skilltype] = (skillMults[eff.skilltype] || 0) + val;
                else skillMults.all += val;
            }
            // 스킬 타입 표기 제거 (UI 상에서 이미 구분됨)
            logs.dmgInc.push({ txt: `[${displayName}] ${valDisplay} (${t})`, uid, tag: 'skillMult', skillType: eff.skilltype });
        } else if (t.endsWith('피해') || t.includes('피해') || t === '주는 피해' || t === '모든 스킬 피해') {
            let tag = 'all';
            if (t === '일반 공격 피해') tag = 'normal';
            else if (t === '배틀 스킬 피해') tag = 'battle';
            else if (t === '연계 스킬 피해') tag = 'combo';
            else if (t === '궁극기 피해') tag = 'ult';
            else if (t === '모든 스킬 피해') tag = 'skill';

            if (!isDisabled) {
                dmgInc += val;
                dmgIncMap[tag] += val;
            }
            logs.dmgInc.push({ txt: `[${displayName}] ${valDisplay} (${t})`, uid, tag });
        } else if (t.endsWith('저항 무시')) {
            // 이미 isApplicableEffect 통과했으므로 오퍼레이터 속성과 일치함
            if (!isDisabled) resIgnore += val;
            logs.res.push({ txt: `[${displayName}] ${t} ${val.toFixed(1)}`, uid });
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

    let finalDmg = finalAtk * critExp * (1 + dmgInc / 100) * (1 + amp / 100) * (1 + takenDmg / 100) * (1 + vuln / 100) * multiHit * (1 + finalUnbal / 100) * resMult;

    const swordsman = allEffects.find(e => e.setId === 'set_swordsman' && e.triggered);
    if (swordsman) {
        const extraDmg = finalAtk * 2.5;
        finalDmg += extraDmg;
        logs.dmgInc.push({ txt: `[검술사 추가피해] +${Math.floor(extraDmg).toLocaleString()}`, uid: 'swordsman_extra' });
    }

    return {
        finalDmg,
        stats: {
            finalAtk, atkInc,
            mainStatName: STAT_NAME_MAP[opData.mainStat], mainStatVal: stats[opData.mainStat],
            subStatName: STAT_NAME_MAP[opData.subStat], subStatVal: stats[opData.subStat],
            critExp, finalCritRate, critDmg, dmgInc, amp, vuln, takenDmg, unbalanceDmg: finalUnbal, originiumArts, skillMults, dmgIncData: dmgIncMap,
            resistance: activeResVal, resMult
        },
        logs
    };
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
        '공격력 증가', '치명타 확률', '치명타 피해', '최대 체력', '궁극기 충전', '치유 효율', '연타',
        '주는 피해', '스탯', '스탯%', '스킬 피해', '궁극기 피해', '연계 스킬 피해', '배틀 스킬 피해',
        '일반 공격 피해', '오리지늄 아츠', '오리지늄 아츠 강도', '모든 스킬 피해', '스킬 배율 증가'
    ];
    if (ALWAYS_ON.includes(type) || type === '불균형 목표에 주는 피해') return true;

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
        const prefix = type.replace('받는 ', '').replace(' 피해', '').replace(' 취약', '');
        return checkElement(prefix);
    }
    if (type.endsWith('저항 무시')) {
        return checkElement(type.replace(' 저항 무시', ''));
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
function evaluateTrigger(trigger, currentState) {
    if (!trigger) return true; // trigger 없으면 항상 발동

    const physDebuff = currentState.debuffState?.physDebuff || {};

    const TRIGGER_MAP = {
        '방어 불능': () => (physDebuff.defenseless || 0) > 0,
        '오리지늄 봉인': () => (physDebuff.originiumSeal || 0) > 0,
        // 향후 추가될 트리거 예시:
        // '갑옷 파괴': () => (physDebuff.armorBreak || 0) > 0,
        // '부식': () => (currentState.debuffState?.artsAbnormal?.['corrosion'] || 0) > 0,
    };

    const evalFn = TRIGGER_MAP[trigger];
    if (evalFn) return evalFn();

    // 등록되지 않은 트리거는 항상 발동으로 간주
    return true;
}

function calcSingleSkillDamage(type, st, bRes) {
    const opData = DATA_OPERATORS.find(o => o.id === st.mainOp.id);
    const skillMap = {};
    opData.skill.forEach(s => {
        const entry = Array.isArray(s) ? s[0] : s;
        if (entry?.skilltype) skillMap[entry.skilltype] = entry;
    });

    const skillDef = skillMap[type];
    if (!skillDef) return null;

    const { finalAtk, critExp, amp, takenDmg, vuln, unbalanceDmg, resMult, skillMults = { all: 0 }, dmgIncData = { all: 0, skill: 0, normal: 0, battle: 0, combo: 0, ult: 0 } } = bRes.stats;

    // dmg 파싱
    const parseDmgPct = (v) => {
        if (!v || v === 0) return 0;
        const m = String(v).match(/([\d.]+)%/);
        return m ? parseFloat(m[1]) / 100 : 0;
    };
    let dmgMult = parseDmgPct(skillDef.dmg);

    if (skillDef.bonus) {
        const bonus = skillDef.bonus;
        const triggerMet = evaluateTrigger(bonus.trigger, st);
        if (triggerMet && bonus) {
            const parsePct = (v) => v ? parseFloat(String(v)) / 100 : 0;
            if (bonus.base !== undefined || bonus.perStack !== undefined) {
                const n = st.debuffState?.physDebuff?.defenseless || 0;
                dmgMult += parsePct(bonus.base) + parsePct(bonus.perStack) * n;
            } else if (bonus.val) {
                dmgMult += parsePct(bonus.val);
            }
        }
    }

    const SKILL_MULT_TYPES = new Set(['배틀 스킬', '연계 스킬', '궁극기']);
    let sMult = 0;
    if (typeof skillMults === 'number') sMult = skillMults;
    else sMult = (skillMults.all || 0) + (skillMults[type] || 0);
    const adjDmgMult = SKILL_MULT_TYPES.has(type) ? dmgMult * (1 + sMult / 100) : dmgMult;

    const typeMap = { '배틀 스킬': 'battle', '연계 스킬': 'combo', '궁극기': 'ult', '일반 공격': 'normal' };
    let typeInc = dmgIncData.all;
    if (type === '일반 공격') typeInc += dmgIncData.normal;
    else typeInc += dmgIncData.skill + (dmgIncData[typeMap[type]] || 0);

    const singleHitDmg = finalAtk * adjDmgMult * critExp
        * (1 + typeInc / 100) * (1 + amp / 100)
        * (1 + takenDmg / 100) * (1 + vuln / 100)
        * (1 + unbalanceDmg / 100) * resMult;

    const myLogs = (bRes.logs.dmgInc || []).filter(l => {
        if (l.tag === 'all') return false;
        if (l.tag === 'skillMult') {
            if (!l.skillType) return SKILL_MULT_TYPES.has(type);
            return l.skillType === type;
        }
        if (type === '일반 공격' && l.tag === 'normal') return true;
        if (type !== '일반 공격' && (l.tag === 'skill' || l.tag === typeMap[type])) return true;
        return false;
    });

    return {
        unitDmg: Math.floor(singleHitDmg),
        logs: myLogs,
        dmgRate: Math.round(adjDmgMult * 100) + '%',
        desc: skillDef.desc,
        rawRate: adjDmgMult
    };
}

/**
 * 사이클 데미지를 계산한다.
 * 각 스킬을 sequence 순서대로 순회하며, 스킬 타입별 dmg(배율%)로 데미지를 구한다.
 */
function calculateCycleDamage(currentState, baseRes) {
    if (!baseRes || !baseRes.stats || !currentState.mainOp?.id) return null;
    const sequenceInput = currentState.skillSequence || [];

    const opData = DATA_OPERATORS.find(o => o.id === currentState.mainOp.id);
    const skillMap = {};
    if (opData && opData.skill) {
        opData.skill.forEach(s => {
            const entry = Array.isArray(s) ? s[0] : s;
            if (entry?.skilltype) skillMap[entry.skilltype] = entry;
        });
    }

    const perSkill = {
        '일반 공격': { dmg: 0, count: 0, unitDmg: 0, logs: [], dmgRate: '0%', desc: '' },
        '배틀 스킬': { dmg: 0, count: 0, unitDmg: 0, logs: [], dmgRate: '0%', desc: '' },
        '연계 스킬': { dmg: 0, count: 0, unitDmg: 0, logs: [], dmgRate: '0%', desc: '' },
        '궁극기': { dmg: 0, count: 0, unitDmg: 0, logs: [], dmgRate: '0%', desc: '' }
    };

    // 1. 모든 스킬 타입(4종류)의 기본 데미지
    ['일반 공격', '배틀 스킬', '연계 스킬', '궁극기'].forEach(type => {
        const skillDef = skillMap[type];
        if (!skillDef) return;

        let specificRes = baseRes;
        if (skillDef.element) {
            specificRes = calculateDamage({ ...currentState, overrideSkillElement: skillDef.element });
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
        let hasCustomState = false;

        if (isObj && itemObj.customState) {
            hasCustomState = true;
            customStateMerged.disabledEffects = itemObj.customState.disabledEffects;
            customStateMerged.debuffState = itemObj.customState.debuffState;
            customStateMerged.enemyUnbalanced = itemObj.customState.enemyUnbalanced;
        }

        // 스킬에 지정된 속성이 있다면 덮어쓰기를 설정합니다.
        if (skillDef && skillDef.element) {
            customStateMerged.overrideSkillElement = skillDef.element;
        }

        // 개별 설정을 선택했을 때, 대시보드가 해당 옵션과 스킬 속성 기준으로 표시될 수 있도록 cRes를 항상 구합니다.
        cRes = calculateDamage(customStateMerged);

        if (hasCustomState && cRes) {
            const sRes = calcSingleSkillDamage(type, customStateMerged, cRes);
            if (sRes) skillData = { ...sRes };
        }

        const skillTotal = skillData.unitDmg || 0;
        total += skillTotal;

        pSkill.dmg += skillTotal; // 집계는 perSkill.dmg에 누적
        pSkill.count += 1;

        sequenceResult.push({
            id: isObj ? itemObj.id : null,
            type,
            dmg: skillTotal,
            logs: skillData.logs,
            dmgRate: skillData.dmgRate,
            desc: skillData.desc,
            customState: hasCustomState ? itemObj.customState : null,
            indivDmg: hasCustomState ? skillTotal : undefined,
            indivRate: hasCustomState ? skillData.rawRate : undefined,
            cRes: cRes
        });
    });

    return { sequence: sequenceResult, perSkill, total };
}
