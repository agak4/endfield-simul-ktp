/**
 * ui/damage_contribution.js — 오퍼레이터별 딜 지분 시각화
 *
 * [역할]
 * - 현재 선택된 메인 오퍼레이터 및 서브 오퍼레이터들이 전체 사이클 데미지에 기여하는 비중을 계산하고 표시합니다.
 * - 서브 오퍼레이터 기여도 = (전체 데미지 - 해당 서브 오퍼레이터 제외 시 데미지)
 * - 메인 오퍼레이터 코어 데미지 = 전체 데미지 - 모든 서브 오퍼레이터 기여도의 합
 */

function calculateDamageContribution(targetState, cycleRes) {
    if (!cycleRes || typeof calculateCycleDamage !== 'function' || !targetState.mainOp.id || cycleRes.total === 0) {
        return [];
    }

    // Get active effects from all sequence items to identify which ones belong to which subOp
    let activeEffects = [];
    if (cycleRes && cycleRes.sequence) {
        cycleRes.sequence.forEach(seq => {
            if (seq.activeEffects) {
                seq.activeEffects.forEach(eff => {
                    if (!activeEffects.some(a => a.uid === eff.uid)) {
                        activeEffects.push(eff);
                    }
                });
            }
        });
    }

    // fallback to baseRes if sequence is empty but total > 0 (should not happen normally)
    if (activeEffects.length === 0) {
        const baseRes = calculateDamage(targetState, false, false);
        activeEffects = baseRes ? baseRes.activeEffects : [];
    }

    const getSubOpEffects = (subOpId) => {
        return activeEffects.filter(eff => {
            return eff._sourceOpId === subOpId || (eff._opData && eff._opData.id === subOpId);
        });
    };

    const createExcludedState = (effectsToExclude, excludedOpIds = []) => {
        const excludedState = { ...targetState };
        excludedState.disabledEffects = targetState.disabledEffects ? [...targetState.disabledEffects] : [];
        excludedState.effectStacks = targetState.effectStacks ? { ...targetState.effectStacks } : {};

        // attribution에서 제외 대상 오퍼레이터의 귀속을 null로 처리한다.
        // 귀속 오퍼레이터가 제외되면 그 오퍼레이터의 부가 효과 증강도 제외되어야 한다.
        if (excludedOpIds.length > 0 && targetState.debuffState?.attribution) {
            const newAttribution = { ...targetState.debuffState.attribution };
            let attributionChanged = false;
            for (const key of Object.keys(newAttribution)) {
                if (excludedOpIds.includes(newAttribution[key])) {
                    newAttribution[key] = null;
                    attributionChanged = true;
                }
            }
            if (attributionChanged) {
                excludedState.debuffState = { ...targetState.debuffState, attribution: newAttribution };
            }
        }

        effectsToExclude.forEach(eff => {
            excludedState.disabledEffects.push(eff.uid);
            excludedState.disabledEffects.push(`${eff.uid}#common`);
            excludedState.disabledEffects.push(`${eff.uid}#normal`);
            excludedState.disabledEffects.push(`${eff.uid}#battle`);
            excludedState.disabledEffects.push(`${eff.uid}#combo`);
            excludedState.disabledEffects.push(`${eff.uid}#ult`);
            if (eff.stack) {
                excludedState.effectStacks[eff.uid] = 0;
            }
        });

        if (targetState.skillSequence) {
            excludedState.skillSequence = targetState.skillSequence.map(seq => {
                if (seq.customState) {
                    const customDisabled = seq.customState.disabledEffects ? [...seq.customState.disabledEffects] : [];
                    const customStacks = seq.customState.effectStacks ? { ...seq.customState.effectStacks } : {};

                    effectsToExclude.forEach(eff => {
                        customDisabled.push(eff.uid);
                        customDisabled.push(`${eff.uid}#common`);
                        customDisabled.push(`${eff.uid}#normal`);
                        customDisabled.push(`${eff.uid}#battle`);
                        customDisabled.push(`${eff.uid}#combo`);
                        customDisabled.push(`${eff.uid}#ult`);
                        if (eff.stack) {
                            customStacks[eff.uid] = 0;
                        }
                    });

                    // customState의 attribution도 동일하게 제외 처리
                    let customAttribution = seq.customState.debuffState?.attribution;
                    let customAttributionChanged = false;
                    if (excludedOpIds.length > 0 && customAttribution) {
                        customAttribution = { ...customAttribution };
                        for (const key of Object.keys(customAttribution)) {
                            if (excludedOpIds.includes(customAttribution[key])) {
                                customAttribution[key] = null;
                                customAttributionChanged = true;
                            }
                        }
                    }

                    return {
                        ...seq,
                        customState: {
                            ...seq.customState,
                            disabledEffects: customDisabled,
                            effectStacks: customStacks,
                            ...(customAttributionChanged && seq.customState.debuffState
                                ? { debuffState: { ...seq.customState.debuffState, attribution: customAttribution } }
                                : {})
                        }
                    };
                }
                return seq;
            });
        }
        return excludedState;
    };

    // 1. Calculate Pure Base Damage (Main Op Only)
    let allSubEffects = [];
    targetState.subOps.forEach(subOp => {
        if (subOp && subOp.id) {
            allSubEffects = allSubEffects.concat(getSubOpEffects(subOp.id));
        }
    });

    const allSubOpIds = targetState.subOps.filter(s => s && s.id).map(s => s.id);
    const pureBaseState = createExcludedState(allSubEffects, allSubOpIds);
    const pureBaseRes = calculateDamage(pureBaseState, false, false);
    const pureBaseCycleRes = calculateCycleDamage(pureBaseState, pureBaseRes, false);
    const pureBaseDamage = pureBaseCycleRes ? pureBaseCycleRes.total : 0;

    // 2. Calculate Marginal Contribution for each Sub Op
    const marginals = [];
    let sumMarginals = 0;

    targetState.subOps.forEach((subOp) => {
        if (!subOp || !subOp.id) return;
        const subEffects = getSubOpEffects(subOp.id);
        const excludedState = createExcludedState(subEffects, [subOp.id]);

        const resExc = calculateDamage(excludedState, false, false);
        const cycleResExc = calculateCycleDamage(excludedState, resExc, false);
        const dmgExc = cycleResExc ? cycleResExc.total : 0;

        const marginalContribution = Math.max(0, cycleRes.total - dmgExc);
        marginals.push({ subOpId: subOp.id, marginalContribution });
        sumMarginals += marginalContribution;
    });

    // 3. Apportion Total Sub Damage
    let totalSubDamage = Math.max(0, cycleRes.total - pureBaseDamage);
    const contributions = [];

    marginals.forEach(({ subOpId, marginalContribution }) => {
        const opData = getOperatorData(subOpId);
        let apportioned = 0;
        if (sumMarginals > 0) {
            apportioned = totalSubDamage * (marginalContribution / sumMarginals);
        } else if (marginalContribution > 0) {
            apportioned = marginalContribution;
        }

        contributions.push({
            opId: subOpId,
            opName: opData ? opData.name : 'Unknown',
            damage: apportioned,
            isMain: false
        });
    });

    // 4. Main Op Data (Fixed at Pure Base Damage)
    const mainOpData = getOperatorData(targetState.mainOp.id);
    contributions.push({
        opId: targetState.mainOp.id,
        opName: mainOpData ? mainOpData.name : 'Unknown',
        damage: pureBaseDamage,
        isMain: true
    });

    // 5. Sort (Main is always top, others descending)
    contributions.sort((a, b) => {
        if (a.isMain) return -1;
        if (b.isMain) return 1;
        return b.damage - a.damage;
    });

    return contributions;
}

function renderDamageContribution(cycleRes) {
    const containerItem = document.getElementById('damage-contribution-box');
    if (!containerItem) return;

    if (!cycleRes || typeof calculateCycleDamage !== 'function' || !state.mainOp.id || cycleRes.total === 0) {
        containerItem.style.display = 'none';
        return;
    }

    const contributions = calculateDamageContribution(state, cycleRes);
    const finalSum = contributions.reduce((sum, item) => sum + item.damage, 0);

    // 5. Update DOM
    // Hide all items initially
    for (let i = 0; i < 4; i++) {
        const itemEl = document.getElementById(`contrib-item-${i}`);
        if (itemEl) itemEl.classList.remove('active');
    }

    if (contributions.length === 0) {
        containerItem.style.display = 'none';
        return;
    }

    containerItem.style.display = 'block';

    contributions.forEach((item, index) => {
        if (index >= 4) return;

        const itemEl = document.getElementById(`contrib-item-${index}`);
        if (!itemEl) return;

        const imgEl = document.getElementById(`contrib-img-${index}`);
        const nameEl = document.getElementById(`contrib-name-${index}`);
        const valEl = document.getElementById(`contrib-val-${index}`);
        const pctEl = document.getElementById(`contrib-pct-${index}`);
        const barEl = document.getElementById(`contrib-bar-${index}`);

        itemEl.classList.add('active');

        if (imgEl) {
            imgEl.src = `images/operators/${item.opName}.webp`;
            imgEl.alt = item.opName;
            imgEl.onload = () => imgEl.classList.add('loaded');
            // Reset opacity immediately to avoid flashing if loaded class was present previously but src changed
            imgEl.classList.remove('loaded');
            if (imgEl.complete) imgEl.classList.add('loaded');

            imgEl.onerror = () => { imgEl.src = TRANSPARENT_PIXEL; };
        }

        if (nameEl) {
            nameEl.innerText = item.isMain ? `${item.opName} (메인)` : item.opName;
            if (item.isMain) {
                nameEl.classList.add('is-main-text');
            } else {
                nameEl.classList.remove('is-main-text');
            }
        }

        const sharePct = finalSum > 0 ? (item.damage / finalSum) * 100 : 0;

        if (valEl) valEl.innerText = Math.floor(item.damage).toLocaleString();
        if (pctEl) pctEl.innerText = `${sharePct.toFixed(1)}%`;

        if (barEl) {
            barEl.style.width = `${sharePct.toFixed(1)}%`;
            if (item.isMain) {
                barEl.classList.add('main-op');
            } else {
                barEl.classList.remove('main-op');
            }
        }
    });
}
