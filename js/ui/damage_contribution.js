/**
 * ui/damage_contribution.js — 오퍼레이터별 딜 지분 시각화
 *
 * [역할]
 * - 현재 선택된 메인 오퍼레이터 및 서브 오퍼레이터들이 전체 사이클 데미지에 기여하는 비중을 계산하고 표시합니다.
 * - 서브 오퍼레이터 기여도 = (전체 데미지 - 해당 서브 오퍼레이터 제외 시 데미지)
 * - 메인 오퍼레이터 코어 데미지 = 전체 데미지 - 모든 서브 오퍼레이터 기여도의 합
 */

function renderDamageContribution(cycleRes) {
    const containerItem = document.getElementById('damage-contribution-box');
    if (!containerItem) return;

    if (!cycleRes || typeof calculateCycleDamage !== 'function' || !state.mainOp.id || cycleRes.total === 0) {
        containerItem.style.display = 'none';
        return;
    }

    // Get active effects from baseline run to identify which ones belong to which subOp
    const baseRes = calculateDamage(state, false, false);
    const activeEffects = baseRes ? baseRes.activeEffects : [];

    const getSubOpEffects = (subOpId) => {
        return activeEffects.filter(eff => {
            return eff._sourceOpId === subOpId || (eff._opData && eff._opData.id === subOpId);
        });
    };

    const createExcludedState = (effectsToExclude) => {
        const excludedState = deepClone(state);
        if (!excludedState.disabledEffects) excludedState.disabledEffects = [];
        if (!excludedState.effectStacks) excludedState.effectStacks = {};

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

        if (excludedState.skillSequence) {
            excludedState.skillSequence.forEach(seq => {
                if (seq.customState) {
                    if (!seq.customState.disabledEffects) seq.customState.disabledEffects = [];
                    if (!seq.customState.effectStacks) seq.customState.effectStacks = {};

                    effectsToExclude.forEach(eff => {
                        seq.customState.disabledEffects.push(eff.uid);
                        seq.customState.disabledEffects.push(`${eff.uid}#common`);
                        seq.customState.disabledEffects.push(`${eff.uid}#normal`);
                        seq.customState.disabledEffects.push(`${eff.uid}#battle`);
                        seq.customState.disabledEffects.push(`${eff.uid}#combo`);
                        seq.customState.disabledEffects.push(`${eff.uid}#ult`);
                        if (eff.stack) {
                            seq.customState.effectStacks[eff.uid] = 0;
                        }
                    });
                }
            });
        }
        return excludedState;
    };

    // 1. Calculate Pure Base Damage (Main Op Only)
    let allSubEffects = [];
    state.subOps.forEach(subOp => {
        if (subOp && subOp.id) {
            allSubEffects = allSubEffects.concat(getSubOpEffects(subOp.id));
        }
    });

    const pureBaseState = createExcludedState(allSubEffects);
    const pureBaseRes = calculateDamage(pureBaseState, false, false);
    const pureBaseCycleRes = calculateCycleDamage(pureBaseState, pureBaseRes, false);
    const pureBaseDamage = pureBaseCycleRes ? pureBaseCycleRes.total : 0;

    // 2. Calculate Marginal Contribution for each Sub Op
    const marginals = [];
    let sumMarginals = 0;

    state.subOps.forEach((subOp) => {
        if (!subOp || !subOp.id) return;
        const subEffects = getSubOpEffects(subOp.id);
        const excludedState = createExcludedState(subEffects);

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
        const opData = DATA_OPERATORS.find(o => o.id === subOpId);
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
    const mainOpData = DATA_OPERATORS.find(o => o.id === state.mainOp.id);
    contributions.push({
        opId: state.mainOp.id,
        opName: mainOpData ? mainOpData.name : 'Unknown',
        damage: pureBaseDamage,
        isMain: true
    });

    const finalSum = pureBaseDamage + totalSubDamage;

    // 4. Sort (Main is always top, others descending)
    contributions.sort((a, b) => {
        if (a.isMain) return -1;
        if (b.isMain) return 1;
        return b.damage - a.damage;
    });

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

            imgEl.onerror = () => { imgEl.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; };
        }

        if (nameEl) {
            nameEl.innerText = item.isMain ? `${item.opName} (현재)` : item.opName;
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
