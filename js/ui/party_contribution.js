/**
 * ui/party_contribution.js — 파티 내 오퍼레이터별 개별 데미지 합산 표시
 *
 * [역할]
 * - 파티 탭에서 각 오퍼레이터(메인 + 서브 1~3)가 자신의 사이클 설정에 따라 가하는 데미지를 계산합니다.
 * - 각 오퍼레이터의 '저장된 개별 설정(opSettings)'을 불러와 현재 파티 버프 상태에서 사이클 효율을 측정합니다.
 */

function renderPartyContribution() {
    console.log('[Party] renderPartyContribution called');
    const container = document.getElementById('analysis-party-content');
    if (!container) return;

    if (!state.mainOp.id) {
        container.innerHTML = `
            <div class="empty-state-container">
                <div class="empty-state-icon">✦</div>
                <p class="empty-state-text">메인 오퍼레이터를 선택해주세요.</p>
            </div>
        `;
        return;
    }

    const party = [
        { type: 'main', id: state.mainOp.id, index: -1 },
        ...state.subOps.map((sub, idx) => ({ type: 'sub', id: sub.id, index: idx }))
    ].filter(p => p.id);

    const results = party.map(member => {
        const opData = DATA_OPERATORS.find(o => o.id === member.id);
        const settings = loadOpSettings(member.id) || {};

        // 해당 오퍼레이터를 메인으로 하는 가상 상태(virtual state) 생성
        let virtualState = deepClone(state);

        // 메인/서브 위치에 따른 데이터 교체
        if (member.type === 'sub') {
            // 현재 메인을 서브로, 타겟 서브를 메인으로 교체
            const currentMain = deepClone(virtualState.mainOp);
            const targetSub = deepClone(virtualState.subOps[member.index]);

            virtualState.mainOp = {
                id: targetSub.id,
                pot: targetSub.pot,
                wepId: targetSub.wepId,
                wepPot: targetSub.wepPot,
                wepState: targetSub.wepState,
                gears: [...targetSub.gears],
                gearForged: [...targetSub.gearForged],
                skillLevels: targetSub.skillLevels || { '일반 공격': 'M3', '배틀 스킬': 'M3', '연계 스킬': 'M3', '궁극기': 'M3' },
                specialStack: settings.specialStack || {},
            };

            virtualState.subOps[member.index] = {
                id: currentMain.id,
                pot: currentMain.pot,
                wepId: currentMain.wepId,
                wepPot: currentMain.wepPot,
                wepState: currentMain.wepState,
                gears: [...currentMain.gears],
                gearForged: [...currentMain.gearForged],
                skillLevels: currentMain.skillLevels
            };
        }

        // 저장된 오퍼레이터별 사이클/디버프 상태 적용
        // 1. 저장된 사이클이 있으면 적용, 없으면 기본 콤보
        const savedSequence = settings.skillSequence || [];
        if (savedSequence.length > 0) {
            virtualState.skillSequence = savedSequence;
        } else {
            virtualState.skillSequence = ['일반 공격', '배틀 스킬', '연계 스킬', '궁극기'].map((t, i) => ({
                id: `def_${Date.now()}_${i}`,
                type: t,
                customState: null
            }));
        }

        // 2. 스킬 레벨 적용
        if (settings.skillLevels) {
            virtualState.mainOp.skillLevels = settings.skillLevels;
        }

        // 데미지 계산
        const res = calculateDamage(virtualState);
        const cycleRes = res ? calculateCycleDamage(virtualState, res) : null;
        const totalDmg = cycleRes ? cycleRes.total : 0;

        return {
            id: member.id,
            name: opData?.name || 'Unknown',
            damage: totalDmg,
            isMain: member.type === 'main'
        };
    });

    const totalPartyDmg = results.reduce((sum, r) => sum + r.damage, 0);

    // 렌더링 HTML 생성
    let html = `
        <div class="analysis-tab-inner">
            <div class="result-box" style="margin-bottom: 20px;">
                <h3 style="margin-top: 0; margin-bottom: 5px;">파티 총합 데미지 (사이클)</h3>
                <div style="font-size: 1.8rem; font-weight: bold; color: var(--accent);">${Math.floor(totalPartyDmg).toLocaleString()}</div>
            </div>
            
            <div class="dmg-contrib-list">
    `;

    results.sort((a, b) => b.damage - a.damage).forEach((item, idx) => {
        const sharePct = totalPartyDmg > 0 ? (item.damage / totalPartyDmg) * 100 : 0;
        const mainBadge = item.isMain ? ' <span style="font-size: 0.75rem; color: var(--accent); opacity: 0.8;">(메인)</span>' : '';

        html += `
            <div class="dmg-contrib-item active" style="order: ${idx};">
                <div class="op-image-container dmg-contrib-img-box">
                    <img src="images/operators/${item.name}.webp" class="dmg-contrib-img loaded" alt="${item.name}" onerror="this.src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'">
                </div>
                <div class="dmg-contrib-info-col">
                    <div class="dmg-contrib-header">
                        <span class="dmg-contrib-name">${item.name}${mainBadge}</span>
                        <div class="dmg-contrib-val-wrap">
                            <span class="dmg-contrib-val">${Math.floor(item.damage).toLocaleString()}</span>
                            <span class="dmg-contrib-pct">${sharePct.toFixed(1)}%</span>
                        </div>
                    </div>
                    <div class="skill-card dmg-contrib-bar-track">
                        <div class="skill-dmg-bar dmg-contrib-bar-fill ${item.isMain ? 'main-op' : ''}" style="width: ${sharePct.toFixed(1)}%;"></div>
                    </div>
                </div>
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;

    container.innerHTML = html;
}

window.renderPartyContribution = renderPartyContribution;

window.renderPartyContribution = renderPartyContribution;
