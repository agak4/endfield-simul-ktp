/**
 * ui/render.js — 결과 렌더링
 *
 * [역할]
 * - 데미지 계산 결과(calculateDamage 반환값)를 DOM에 표시한다.
 * - 효과 로그 리스트를 렌더링하고, 클릭으로 효과를 비활성화하는 토글 기능을 제공한다.
 * - 무기 비교 리스트를 렌더링하며, 순서 변경 시 FLIP 애니메이션을 적용한다.
 * - 활성 세트 배지(3피스)를 업데이트한다.
 *
 * [의존]
 * - state.js : state, updateState
 * - calc.js  : calculateDamage, checkSetViability
 * - data_*.js : DATA_OPERATORS, DATA_WEAPONS, DATA_SETS
 *
 * [내부 규칙]
 * - PROTECTED_UIDS에 등록된 uid는 클릭 비활성화 대상에서 제외된다.
 *   (기본 공격력/스탯 보너스처럼 항상 적용되어야 하는 항목)
 * - renderWeaponComparison()은 비교를 위해 state.mainOp의 wepId/wepPot/wepState를
 *   임시로 변경하고 계산 후 반드시 원복한다.
 * - 무기 비교의 FLIP 애니메이션은 First/Last 위치 기반으로 동작하며
 *   requestAnimationFrame 두 번의 중첩으로 구현된다.
 */

// ============ 결과 렌더링 ============

/**
 * 데미지 계산 결과를 DOM에 업데이트한다.
 * res가 null이면 최종 데미지를 0으로 표시한다.
 *
 * @param {object|null} res - calculateDamage 반환값
 */
function renderResult(res) {
    if (!res) {
        const el = document.getElementById('final-damage');
        if (el) el.innerText = '0';
        return;
    }

    // 1. Calculate global cycle sums first
    const cycleRes = typeof calculateCycleDamage === 'function' ? calculateCycleDamage(state, res) : null;

    // 2. Identify if we are viewing an individual custom item and extract its calculation results
    let displayRes = res;
    if (state.cycleMode === 'individual' && state.selectedSeqId && cycleRes && cycleRes.sequence) {
        const item = cycleRes.sequence.find(s => s.id === state.selectedSeqId);
        if (item && item.cRes) {
            displayRes = item.cRes;
        }
    }

    // 3. Render all UI values using the displayRes (either global or isolated custom state)
    // 최종 데미지 박스는 언제나 전역 기준값(res)을 사용하도록 변경
    const mapping = {
        'final-damage': Math.floor(res.finalDmg).toLocaleString(),
        'stat-atk': Math.floor(displayRes.stats.finalAtk).toLocaleString(),
        'stat-atk-inc': displayRes.stats.atkInc.toFixed(1) + '%',
        'stat-main-val': Math.floor(displayRes.stats.mainStatVal),
        'stat-sub-val': Math.floor(displayRes.stats.subStatVal),
        'stat-crit': (displayRes.stats.critExp * 100).toFixed(1) + '%',
        'val-crit-rate': displayRes.stats.finalCritRate + '%',
        'val-crit-dmg': displayRes.stats.critDmg + '%',
        'stat-dmg-inc': displayRes.stats.dmgInc.toFixed(1) + '%',
        'stat-amp': displayRes.stats.amp.toFixed(1) + '%',
        'stat-vuln': displayRes.stats.vuln.toFixed(1) + '%',
        'stat-taken': displayRes.stats.takenDmg.toFixed(1) + '%',
        'stat-unbal': displayRes.stats.unbalanceDmg.toFixed(1) + '%',
        'stat-arts': displayRes.stats.originiumArts.toFixed(1),
        'stat-res': (displayRes.stats.resistance ?? 0).toFixed(0),
        'stat-res-mult': (((displayRes.stats.resMult ?? 1) - 1) * 100).toFixed(1) + '%'
    };

    for (const [id, val] of Object.entries(mapping)) {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    }

    // 스탯 레이블 (오퍼레이터마다 주/부스탯 이름이 다름)
    const mainLabel = document.getElementById('label-main-stat');
    if (mainLabel) mainLabel.innerText = displayRes.stats.mainStatName;
    const subLabel = document.getElementById('label-sub-stat');
    if (subLabel) subLabel.innerText = displayRes.stats.subStatName;

    const multihitSpan = document.getElementById('stat-multihit');
    if (multihitSpan) multihitSpan.innerText = displayRes.logs.multihit.length > 0 ? 'ON' : 'OFF';

    // 로그 목록 업데이트
    const logMapping = {
        'list-atk': displayRes.logs.atk,
        'list-crit': displayRes.logs.crit,
        'list-amp': displayRes.logs.amp,
        'list-vuln': displayRes.logs.vuln,
        'list-taken': displayRes.logs.taken,
        'list-unbal': displayRes.logs.unbal,
        'list-multihit': displayRes.logs.multihit,
        'list-arts': displayRes.logs.arts,
        'list-res': displayRes.logs.res
    };

    for (const [id, list] of Object.entries(logMapping)) {
        renderLog(id, list);
    }

    updateActiveSetUI();

    // 사이클 카드들 렌더링은 전역 결과 cycleRes
    renderCycleDamage(cycleRes);

    // 이펙트 다이얼리스트는 개별 설정 결과
    renderDmgInc(displayRes, cycleRes);
}

/**
 * 주는 피해 5분할을 렌더링한다.
 * @param {object} res - calculateDamage 반환값
 * @param {object|null} cycleRes - calculateCycleDamage 반환값
 */


/**
 * 활성 세트 배지를 업데이트한다.
 * 3피스 조건을 충족한 세트가 없으면 컨테이너를 비운다.
 */
function updateActiveSetUI() {
    const container = document.getElementById('main-active-set');
    if (!container) return;
    container.innerHTML = '';

    if (!state.activeSetId) return;

    const set = DATA_SETS.find(s => s.id === state.activeSetId);
    const opData = DATA_OPERATORS.find(o => o.id === state.mainOp.id);
    if (!set || !opData) return;

    const isViable = checkSetViability(state.activeSetId, opData);
    const statusText = isViable ? '(발동가능)' : '(발동불가)';
    const statusClass = isViable ? 'viable' : 'not-viable';

    const badge = document.createElement('div');
    badge.className = 'active-set-badge';
    badge.innerHTML = `
        <span class="set-name">${set.name} <span class="viability ${statusClass}">${statusText}</span></span>
        <span class="set-status">ACTIVE (3피스)</span>
    `;
    container.appendChild(badge);
}

/**
 * 효과 로그 리스트를 ul 요소에 렌더링한다.
 * uid가 있는 항목은 클릭 시 비활성화(취소선)를 토글할 수 있다.
 *
 * @param {string}   id   - ul 요소의 ID
 * @param {Array}    list - { txt, uid } 또는 문자열 배열
 */
function renderLog(id, list) {
    const ul = document.getElementById(id);
    if (!ul) return;
    ul.innerHTML = '';

    // 이 uid들은 클릭으로 비활성화할 수 없다 (항상 계산에 포함되어야 함)
    const PROTECTED_UIDS = ['base_op_atk', 'base_wep_atk', 'stat_bonus_atk', 'unbalance_base'];

    list.forEach(item => {
        const li = document.createElement('li');
        const txt = typeof item === 'string' ? item : item.txt;
        const uid = typeof item === 'string' ? null : item.uid;
        const isUnbalancedOff = typeof item === 'object' && item.unbalancedOff;

        li.innerText = txt;
        if (isUnbalancedOff) {
            li.classList.add('unbalanced-off');
        }

        if (uid) {
            li.dataset.uid = uid;
            const isProtected = PROTECTED_UIDS.includes(uid);
            if (!isProtected) {
                li.style.cursor = 'pointer';
                const targetState = getTargetState();

                // 이미 비활성화된 효과는 취소선 클래스 적용
                if (targetState.disabledEffects?.includes(uid)) li.classList.add('disabled-effect');
                li.onclick = () => {
                    ensureCustomState();
                    const ts = getTargetState();
                    if (!ts.disabledEffects) ts.disabledEffects = [];
                    const idx = ts.disabledEffects.indexOf(uid);
                    if (idx > -1) ts.disabledEffects.splice(idx, 1);
                    else ts.disabledEffects.push(uid);
                    updateState();
                };
            } else {
                li.style.cursor = 'default';
            }
        }
        ul.appendChild(li);
    });
}

/**
 * 사이클 계산 결과를 DOM에 업데이트한다.
 * @param {{sequence: Array, perSkill: object, total: number}|null} cycleRes
 */
function renderCycleDamage(cycleRes) {
    renderCycleSequence(cycleRes);
    renderCyclePerSkill(cycleRes);
}

function renderCycleSequence(cycleRes) {
    const list = document.getElementById('cycle-sequence-display');
    if (list) list.innerHTML = '';
    if (!cycleRes || !list) return;

    const sequence = cycleRes.sequence || [];
    sequence.forEach((item, index) => {
        const { type, desc, customState, id, indivDmg, indivRate } = item;

        const cardContainer = document.createElement('div');
        cardContainer.className = 'cycle-sequence-item';
        if (customState) cardContainer.classList.add('seq-is-custom');
        if (state.selectedSeqId === id) cardContainer.classList.add('seq-selected');

        cardContainer.draggable = true;
        cardContainer.dataset.index = index;

        // 클릭 시 개별 설정 모드라면 선택
        cardContainer.onclick = (e) => {
            if (state.cycleMode === 'individual') {
                state.selectedSeqId = id;
                updateUIStateVisuals();
                updateState();
            }
        };

        const svgMap = {
            '일반 공격': '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M14 2L20 8V20C20 21.1 19.1 22 18 22H6C4.9 22 4 21.1 4 20V4C4 2.9 4.9 2 6 2H14ZM13 9V3.5L18.5 9H13Z"/></svg>',
            '배틀 스킬': '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M11 21H7V13H3V9L11 21ZM21 11V15H17V23L9 11H13V3L21 15V11Z"/></svg>',
            '연계 스킬': '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M16 4L22 10L16 16V11H8V17L2 11L8 5V9H16V4Z"/></svg>',
            '궁극기': '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>'
        };

        const iconHtml = svgMap[type] || '';
        const iconWrapper = document.createElement('div');
        iconWrapper.className = `seq-icon seq-icon-${type === '궁극기' ? 'ult' : type === '연계 스킬' ? 'combo' : type === '배틀 스킬' ? 'battle' : 'normal'}`;
        iconWrapper.innerHTML = iconHtml;        // 삭제 버튼
        const delBtn = document.createElement('button');
        delBtn.className = 'seq-delete-btn';
        delBtn.innerHTML = '&times;';
        delBtn.onclick = (e) => {
            e.stopPropagation();
            removeCycleItem(index);
        };

        // 우클릭 삭제 기능
        cardContainer.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            removeCycleItem(index);
            AppTooltip.hide();
        };

        cardContainer.appendChild(iconWrapper);
        cardContainer.appendChild(delBtn);

        cardContainer.onmouseenter = (e) => {
            let content;
            if (customState && indivDmg !== undefined) {
                content = `
                    <div class="tooltip-title" style="color:var(--accent)">개별 설정 적용됨</div>
                    <div class="tooltip-desc">
                        1회 데미지: <strong style="color:var(--accent)">${Math.floor(indivDmg).toLocaleString()}</strong><br>
                        데미지 배율: <strong>${Math.floor(indivRate * 100)}%</strong>
                    </div>
                `;
            } else {
                content = `
                    <div class="tooltip-title">${type}</div> 
                    <div class="tooltip-desc">${desc ? desc : '설명 없음'}</div>
                `;
            }
            AppTooltip.showCustom(content, e, { width: '220px' });
        };
        cardContainer.onmouseleave = () => AppTooltip.hide();

        cardContainer.addEventListener('dragstart', handleDragStart);
        cardContainer.addEventListener('dragover', handleDragOver);
        cardContainer.addEventListener('drop', handleDrop);
        cardContainer.addEventListener('dragenter', handleDragEnter);
        cardContainer.addEventListener('dragleave', handleDragLeave);
        cardContainer.addEventListener('dragend', handleDragEnd);

        list.appendChild(cardContainer);

        // 마지막 요소가 아니면 화살표 추가
        if (index < sequence.length - 1) {
            const arrow = document.createElement('div');
            arrow.className = 'seq-arrow';
            arrow.innerHTML = '&#10140;'; // 우측 화살표
            list.appendChild(arrow);
        }
    });
}

function renderCyclePerSkill(cycleRes) {
    const list = document.getElementById('cycle-dmg-list');
    const totalEl = document.getElementById('cycle-dmg-total');

    if (list) list.innerHTML = '';
    if (totalEl) totalEl.innerText = cycleRes ? Math.floor(cycleRes.total).toLocaleString() : '0';

    if (!cycleRes || !list) return;

    const SKILL_TYPES = ['일반 공격', '배틀 스킬', '연계 스킬', '궁극기'];
    SKILL_TYPES.forEach(t => {
        const data = cycleRes.perSkill[t];
        if (!data) return;
        const dmgVal = data.dmg || 0;
        const count = data.count || 0;
        const dmgRate = data.dmgRate || '0%';

        const row = document.createElement('div');
        row.className = 'cycle-dmg-row';
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '8px';

        // 1. 횟수 표시 뱃지
        const countDiv = document.createElement('div');
        countDiv.className = 'skill-count-badge';
        countDiv.innerText = `${count}회`;
        countDiv.style.minWidth = '40px';
        countDiv.style.textAlign = 'center';
        countDiv.style.color = 'var(--text-secondary)';
        countDiv.style.fontSize = '0.8rem';
        countDiv.style.background = 'rgba(255, 255, 255, 0.05)';
        countDiv.style.padding = '4px';
        countDiv.style.borderRadius = '4px';

        // 2. 스킬 카드 (가운데)
        const card = document.createElement('div');
        card.className = 'skill-card';
        card.style.flex = '1';

        const header = document.createElement('div');
        header.className = 'skill-card-header';
        const rateText = dmgRate ? `<span class="skill-rate" style="color:var(--text-muted); margin-left:4px;">(${dmgRate})</span>` : '';
        header.innerHTML = `<span class="skill-name">${t}${rateText}</span><span class="skill-dmg">${dmgVal.toLocaleString()}</span>`;

        // 툴팁에는 1회 데미지를 추가로 표시
        header.onmouseenter = (e) => {
            const unitDmgStr = data.unitDmg ? data.unitDmg.toLocaleString() + ' / 회' : '';
            const content = `
                <div class="tooltip-title">${t}</div> 
                <div class="tooltip-desc" style="color: var(--accent); margin-bottom: 5px;">${unitDmgStr}</div>
                <div class="tooltip-desc">${data.desc ? data.desc : '설명 없음'}</div>
            `;
            AppTooltip.showCustom(content, e, { width: '220px' });
        };
        header.onmouseleave = () => AppTooltip.hide();

        card.appendChild(header);

        // 3. 지분율 표시
        const shareDiv = document.createElement('div');
        shareDiv.className = 'skill-dmg-share';
        const total = cycleRes.total || 0;
        const share = total > 0 ? (dmgVal / total * 100) : 0;
        shareDiv.innerText = share.toFixed(1) + '%';

        row.appendChild(countDiv);
        row.appendChild(card);
        row.appendChild(shareDiv);

        list.appendChild(row);
    });
}

/**
 * 현재 오퍼레이터가 사용할 수 있는 모든 무기의 데미지를 비교 렌더링한다.
 *
 * 현재 장착 무기는 제외하고 나머지를 순회하며 각 무기로 calculateDamage를 호출한다.
 * 비교 완료 후 state.mainOp의 무기 정보를 반드시 원복한다.
 * 순서가 바뀌면 FLIP 애니메이션을 적용한다.
 *
 * @param {number} currentDmg - 현재 무기로 계산된 최종 데미지 (기준값)
 */
function renderWeaponComparison(currentDmg) {
    const box = document.getElementById('weapon-comparison');
    if (!box || !state.mainOp.id) return;

    const currentOp = DATA_OPERATORS.find(o => o.id === state.mainOp.id);
    if (!currentOp) return;

    // FLIP 애니메이션: 현재 각 항목의 위치(First) 저장
    const firstPositions = new Map();
    Array.from(box.children).forEach(child => {
        const name = child.querySelector('.comp-name')?.innerText;
        if (name) firstPositions.set(name, child.getBoundingClientRect());
    });

    const compPot = Number(document.getElementById('comp-wep-pot')?.value) || 0;
    const compState = document.getElementById('comp-wep-state')?.checked || false;

    // 현재 무기 정보 임시 백업 (비교 후 원복 필요)
    const { wepId: savedWepId, wepPot: savedWepPot, wepState: savedWepState } = state.mainOp;

    const comparisons = DATA_WEAPONS
        .filter(w => currentOp.usableWeapons.includes(w.type) && w.id !== savedWepId)
        .map(w => {
            // 임시로 비교 무기로 교체하여 계산
            state.mainOp.wepId = w.id;
            state.mainOp.wepPot = compPot;
            state.mainOp.wepState = compState;
            const res = calculateDamage(state);
            if (!res) return null;
            const diff = res.finalDmg - currentDmg;
            const pct = currentDmg > 0 ? ((diff / currentDmg) * 100).toFixed(1) : 0;
            return { name: w.name, finalDmg: res.finalDmg, pct: Number(pct) };
        })
        .filter(Boolean)
        .sort((a, b) => b.finalDmg - a.finalDmg);

    // 원래 무기 정보 복원
    state.mainOp.wepId = savedWepId;
    state.mainOp.wepPot = savedWepPot;
    state.mainOp.wepState = savedWepState;

    const maxDmg = comparisons.length > 0 ? Math.max(comparisons[0].finalDmg, currentDmg) : currentDmg;
    box.innerHTML = '';

    comparisons.forEach(item => {
        const sign = item.pct > 0 ? '+' : '';
        const cls = item.pct >= 0 ? (item.pct === 0 ? 'current' : 'positive') : 'negative';
        const barWidth = maxDmg > 0 ? (item.finalDmg / maxDmg * 100) : 0;

        const div = document.createElement('div');
        div.className = `comp-item ${cls}`;
        div.setAttribute('data-weapon-name', item.name);
        div.innerHTML = `
            <div class="comp-info">
                <span class="comp-name">${item.name}</span>
                <span class="comp-dmg">${Math.floor(item.finalDmg).toLocaleString()}</span>
                <span class="comp-pct">${sign}${item.pct}%</span>
            </div>
            <div class="comp-bar-bg"><div class="comp-bar" style="width:${barWidth}%"></div></div>
        `;
        box.appendChild(div);
    });

    // FLIP 애니메이션: Last 위치와 비교하여 변위(delta) 계산 후 트랜지션
    requestAnimationFrame(() => {
        Array.from(box.children).forEach(child => {
            const name = child.getAttribute('data-weapon-name');
            const firstRect = firstPositions.get(name);
            if (firstRect) {
                const lastRect = child.getBoundingClientRect();
                const deltaY = firstRect.top - lastRect.top;
                if (deltaY !== 0) {
                    child.style.transition = 'none';
                    child.style.transform = `translateY(${deltaY}px)`;
                    requestAnimationFrame(() => { child.style.transition = ''; child.style.transform = ''; });
                }
            } else {
                // 새로 추가된 항목은 페이드인
                child.style.opacity = '0';
                requestAnimationFrame(() => { child.style.opacity = '1'; });
            }
        });
    });
}
/**
 * 주는 피해 세부 정보를 5개 컬럼으로 나누어 렌더링한다.
 * @param {object} res - calculateDamage 결과
 * @param {object} cycleRes - calculateCycleDamage 결과 (지분율 계산용)
 */
function renderDmgInc(res, cycleRes) {
    const statsContainer = document.getElementById('dmg-inc-stats-container');
    const listContainer = document.getElementById('dmg-inc-list-container');
    const totalEl = document.getElementById('dmg-inc-value');

    // 헤더 총 합계 표시
    if (totalEl) {
        const totalVal = res.stats.dmgIncData ? res.stats.dmgIncData.all : res.stats.dmgInc;
        totalEl.innerText = (totalVal || 0).toFixed(1) + '%';
    }

    if (!statsContainer || !listContainer) return;

    statsContainer.innerHTML = '';
    listContainer.innerHTML = '';

    const totalCycleDmg = cycleRes ? cycleRes.total : 0;

    // 5개 카테고리 정의
    const categories = [
        { id: 'common', title: '공통', filter: (t) => t === 'all' },
        { id: 'normal', title: '일반 공격', type: '일반 공격' },
        { id: 'battle', title: '배틀 스킬', type: '배틀 스킬' },
        { id: 'combo', title: '연계 스킬', type: '연계 스킬' },
        { id: 'ult', title: '궁극기', type: '궁극기' }
    ];

    // 로그 분류를 위한 임시 저장소
    const catLogs = { common: [], normal: [], battle: [], combo: [], ult: [] };
    const catSums = { common: 0, normal: 0, battle: 0, combo: 0, ult: 0 };

    // 1. 로그 분류
    (res.logs.dmgInc || []).forEach(log => {
        // 정규식 개선: 부호와 숫자 사이, 숫자와 % 사이 공백 허용
        const valMatch = log.txt.match(/([+-]?\s*\d+(\.\d+)?)\s*%/);
        // 공백 제거 후 파싱
        const val = valMatch ? parseFloat(valMatch[1].replace(/\s/g, '')) : 0;

        const targetState = getTargetState();
        const isDisabled = targetState.disabledEffects && targetState.disabledEffects.includes(log.uid);

        // 태그 기반 분류
        if (log.tag === 'all') {
            if (log.txt.includes('스킬')) {
                // 스킬 관련 공통 요소 -> 배틀, 연계, 궁극기에 복사
                ['battle', 'combo', 'ult'].forEach(k => {
                    catLogs[k].push({ ...log, txt: `(공통) ${log.txt}` });
                    if (!isDisabled) catSums[k] += val;
                });
            } else {
                // 순수 공통
                catLogs.common.push(log);
                if (!isDisabled) catSums.common += val;
            }
        } else if (log.tag === 'normal') {
            catLogs.normal.push(log);
            if (!isDisabled) catSums.normal += val;
        } else if (log.tag === 'skill' || log.tag === 'skillMult') {
            if (log.skillType) {
                const key = categories.find(c => c.type === log.skillType)?.id;
                if (key) {
                    catLogs[key].push(log);
                    if (!isDisabled) catSums[key] += val;
                }
            } else {
                ['battle', 'combo', 'ult'].forEach(k => {
                    catLogs[k].push(log);
                    if (!isDisabled) catSums[k] += val;
                });
            }
        } else {
            const key = Object.keys(catLogs).find(k => k === log.tag);
            if (key) {
                catLogs[key].push(log);
                if (!isDisabled) catSums[key] += val;
            }
        }
    });

    const PROTECTED_UIDS = ['base_op_atk', 'base_wep_atk', 'stat_bonus_atk', 'unbalance_base'];

    categories.forEach(cat => {
        // 1. 상단 통계 (Flex Item)
        const statItem = document.createElement('div');
        statItem.className = 'sub-stat-item';

        if (cat.id === 'common') {
            // "공통" 칸 -> 기존 "총 합계" 요소(totalEl)를 여기로 이동
            // 기존 label("공통") 대신 "총 합계"라고 명시하거나, totalEl 자체만 보여줌
            statItem.innerHTML = `<label>총 합계</label>`;
            if (totalEl) {
                // totalEl 스타일 조정 (필요시)
                totalEl.style.fontSize = '1.1rem';
                totalEl.style.color = 'var(--accent)';
                statItem.appendChild(totalEl);
            }
        } else {
            // 나머지 칸 -> 해당 카테고리 합계 표시
            statItem.innerHTML = `
                <label>${cat.title}</label>
                <span>${catSums[cat.id].toFixed(1)}%</span>
            `;
        }
        statsContainer.appendChild(statItem);

        // 2. 하단 리스트 (Column)
        const col = document.createElement('div');
        col.className = 'dmg-inc-column';

        const ul = document.createElement('ul');
        ul.className = 'detail-list';

        catLogs[cat.id].forEach(log => {
            const li = document.createElement('li');
            li.innerText = log.txt;

            if (log.uid) {
                li.dataset.uid = log.uid;
                const isProtected = PROTECTED_UIDS.includes(log.uid);
                if (!isProtected) {
                    li.style.cursor = 'pointer';
                    const targetState = getTargetState();
                    if (targetState.disabledEffects?.includes(log.uid)) li.classList.add('disabled-effect');

                    li.onclick = () => {
                        ensureCustomState();
                        const ts = getTargetState();
                        if (!ts.disabledEffects) ts.disabledEffects = [];
                        const idx = ts.disabledEffects.indexOf(log.uid);
                        if (idx > -1) ts.disabledEffects.splice(idx, 1);
                        else ts.disabledEffects.push(log.uid);
                        updateState();
                    };
                } else {
                    li.style.cursor = 'default';
                }
            }
            ul.appendChild(li);
        });

        col.appendChild(ul);
        listContainer.appendChild(col);
    });
}
