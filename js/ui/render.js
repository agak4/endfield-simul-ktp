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

    window.lastCalcResult = res;

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
        'stat-ult-recharge': (displayRes.stats.ultRecharge || 0).toFixed(1) + '%',
        'stat-ult-cost': Math.floor(displayRes.stats.finalUltCost || 0),
        'stat-arts': displayRes.stats.originiumArts.toFixed(0),
        'stat-arts-bonus': '+' + displayRes.stats.originiumArts.toFixed(1) + '%',
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

    // 로그 목록 업데이트
    const ultRechargeList = (displayRes.logs.ultRecharge || []).filter(log => log.tag === 'reduction');
    const logMapping = {
        'list-atk': displayRes.logs.atk,
        'list-crit': displayRes.logs.crit,
        'list-amp': displayRes.logs.amp,
        'list-vuln': displayRes.logs.vuln,
        'list-taken': displayRes.logs.taken,
        'list-unbal': displayRes.logs.unbal,
        'list-ult-recharge': ultRechargeList,
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

    // 전용 스택 등 가시성 동기화
    if (typeof updateUIStateVisuals === 'function') {
        updateUIStateVisuals();
    }

    // 무기 비교 렌더링 (사이클 데미지 우선)
    renderWeaponComparison(res, cycleRes);
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
        if (isUnbalancedOff || item._triggerFailed) {
            li.classList.add(isUnbalancedOff ? 'unbalanced-off' : 'triggerFail-effect');
        }

        if (uid) {
            li.dataset.uid = uid;
            const isProtected = PROTECTED_UIDS.includes(uid);
            if (!isProtected) {
                li.style.cursor = 'pointer';
                const targetState = getTargetState();

                // 이미 비활성화된 효과는 취소선 클래스 적용
                // stack이 있는 경우는 count가 0일 때 비활성화 처리
                const stackCount = targetState.effectStacks?.[uid];
                if (item.stack) {
                    if (stackCount === 0) li.classList.add('disabled-effect');
                } else {
                    if (targetState.disabledEffects?.includes(uid)) li.classList.add('disabled-effect');
                }

                li.onclick = () => {
                    ensureCustomState();
                    const ts = getTargetState();
                    if (item.stack) {
                        // 중첩 토글: 1 -> 2 -> ... -> max -> 0 -> 1
                        if (!ts.effectStacks) ts.effectStacks = {};
                        let cur = ts.effectStacks[uid] !== undefined ? ts.effectStacks[uid] : 1;
                        cur++;
                        if (cur > item.stack) cur = 0;
                        ts.effectStacks[uid] = cur;
                    } else {
                        // 일반 토글
                        if (!ts.disabledEffects) ts.disabledEffects = [];
                        const idx = ts.disabledEffects.indexOf(uid);
                        if (idx > -1) ts.disabledEffects.splice(idx, 1);
                        else ts.disabledEffects.push(uid);
                    }
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
        let { type, desc, customState, id, indivDmg, indivRate } = item;
        if (Array.isArray(type)) type = type[0]; // 배열인 경우 첫 번째 요소 사용

        const cardContainer = document.createElement('div');
        cardContainer.className = 'cycle-sequence-item';
        if (customState) cardContainer.classList.add('seq-is-custom');
        if (state.selectedSeqId === id) cardContainer.classList.add('seq-selected');

        cardContainer.draggable = true;
        cardContainer.dataset.index = index;

        // 클릭 시 선택/해제 토글
        cardContainer.onclick = (e) => {
            if (state.selectedSeqId === id) {
                state.selectedSeqId = null; // 이미 선택된 경우 해제
            } else {
                state.selectedSeqId = id; // 새로 선택
            }
            updateUIStateVisuals();
            updateState();
        };

        const imgMap = {
            '일반 공격': 'images/skills/기본 공격.webp',
            '배틀 스킬': 'images/skills/배틀 스킬.webp',
            '연계 스킬': 'images/skills/연계 스킬.webp',
            '궁극기': 'images/skills/궁극기.webp'
        };

        // 기본 타입을 추출 (예: '강화 일반 공격' -> '일반 공격')
        let baseType = '일반 공격';
        if (type.includes('궁극기')) baseType = '궁극기';
        else if (type.includes('연계')) baseType = '연계 스킬';
        else if (type.includes('배틀')) baseType = '배틀 스킬';
        else if (type.includes('일반')) baseType = '일반 공격';

        const imgSrc = imgMap[baseType] || imgMap['일반 공격'];
        const iconHtml = `
            <div class="skill-icon-frame">
                <img src="${imgSrc}" alt="${baseType}">
            </div>
        `;
        const iconWrapper = document.createElement('div');
        iconWrapper.style.position = 'relative';
        iconWrapper.style.zIndex = '1';

        // 강화 스킬인 경우 오퍼레이터 이미지를 백그라운드로 사용
        if (type.startsWith('강화')) {
            const opData = DATA_OPERATORS.find(o => o.id === state.mainOp.id);
            if (opData && opData.name) {
                cardContainer.style.position = 'relative';
                cardContainer.style.overflow = 'hidden';

                const bgLayer = document.createElement('div');
                bgLayer.style.position = 'absolute';
                bgLayer.style.top = '0';
                bgLayer.style.left = '0';
                bgLayer.style.width = '100%';
                bgLayer.style.height = '100%';
                bgLayer.style.backgroundImage = `url('images/operators/${opData.name}.webp')`;
                bgLayer.style.backgroundSize = 'cover';
                bgLayer.style.backgroundPosition = 'center';
                bgLayer.style.maskImage = 'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)';
                bgLayer.style.WebkitMaskImage = 'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)';
                bgLayer.style.pointerEvents = 'none';
                bgLayer.style.zIndex = '0';

                cardContainer.appendChild(bgLayer);
            }
        }

        iconWrapper.className = `seq-icon seq-icon-${baseType === '궁극기' ? 'ult' : baseType === '연계 스킬' ? 'combo' : baseType === '배틀 스킬' ? 'battle' : 'normal'}`;
        iconWrapper.innerHTML = iconHtml;

        // 삭제 버튼
        const delBtn = document.createElement('button');
        delBtn.className = 'seq-delete-btn';
        delBtn.innerHTML = '&times;';
        delBtn.style.position = 'relative';
        delBtn.style.zIndex = '1';
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
            const displayDmg = indivDmg !== undefined ? indivDmg : (item.dmg || 0);

            // 배율 표시 로직: 기본 배율 + 물리 이상 형식
            const rawRate = item.rawRate;
            const abnormalInfo = item.abnormalInfo || [];
            let rateHtml = '';

            if (rawRate !== undefined) {
                const abnormalMultTotal = abnormalInfo.reduce((acc, a) => acc + (a.mult || 0), 0);
                const baseMult = rawRate - abnormalMultTotal;
                rateHtml = `${(baseMult * 100).toFixed(0)}%`;

                abnormalInfo.forEach(a => {
                    let suffix = '';
                    if (state.mainOp.id === 'Da Pan' && a.name === '강타') {
                        suffix = ' <span style="color:var(--accent); font-size: 0.9em;">[판 특성] * 120%</span>';
                    }
                    rateHtml += ` + ${a.name} ${(a.mult * 100).toFixed(0)}%${suffix}`;
                });
            } else {
                rateHtml = item.dmgRate || '0%';
            }

            const content = `
                <div class="tooltip-title tooltip-highlight">${type}</div>
                <div class="tooltip-desc">
                    피해량: <strong class="tooltip-highlight">${Math.floor(displayDmg).toLocaleString()}</strong><br>
                    데미지 배율: <strong>${rateHtml}</strong>
                </div>
            `;
            AppTooltip.showCustom(content, e, { width: '260px' });
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

    // cycleRes.perSkill에 존재하는 모든 스킬 타입을 가져와서 렌더링 (강화 스킬 포함)
    const SKILL_TYPES = Object.keys(cycleRes.perSkill);
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
        // 배율(%) 표시 제거
        header.innerHTML = `<span class="skill-name">${t}</span><span class="skill-dmg">${dmgVal.toLocaleString()}</span>`;

        // 툴팁에는 1회 데미지를 추가로 표시
        header.onmouseenter = (e) => {
            const unitDmgStr = data.unitDmg ? data.unitDmg.toLocaleString() + ' / 회' : '';
            const opData = DATA_OPERATORS.find(o => o.id === state.mainOp.id);
            const skillDef = opData?.skill?.find(s => {
                const entry = s;
                return entry?.skillType?.includes(t);
            });

            let content;
            if (skillDef) {
                const activeEffects = window.lastCalcResult ? window.lastCalcResult.activeEffects : [];
                const extraHtml = ''; // 1회 데미지 항목 제거

                let targetSt = state;
                if (data.customState) {
                    targetSt = {
                        ...state,
                        disabledEffects: data.customState.disabledEffects,
                        debuffState: data.customState.debuffState,
                        enemyUnbalanced: data.customState.enemyUnbalanced,
                        mainOp: { ...state.mainOp, specialStack: data.customState.specialStack }
                    };
                }

                content = AppTooltip.renderSkillTooltip(t, skillDef, opData, extraHtml, activeEffects, targetSt);
            } else {
                content = `
                    <div class="tooltip-title">${t}</div> 
                    <div class="tooltip-desc">${data.desc ? data.desc : '설명 없음'}</div>
                `;
            }
            AppTooltip.showCustom(content, e, { width: '260px' });
        };
        header.onmouseleave = () => AppTooltip.hide();

        card.appendChild(header);

        // 3. 지분율 표시
        const shareDiv = document.createElement('div');
        shareDiv.className = 'skill-dmg-share';
        const totalValue = cycleRes.total || 0;
        const share = totalValue > 0 ? (dmgVal / totalValue * 100) : 0;
        shareDiv.innerText = share.toFixed(1) + '%';

        row.appendChild(countDiv);
        row.appendChild(card);
        row.appendChild(shareDiv);

        list.appendChild(row);
    });

    // 물리 이상 및 재능/잠재 항목 추가 렌더링
    if (cycleRes.perAbnormal && Object.keys(cycleRes.perAbnormal).length > 0) {
        // 물리 이상은 위로, 재능/잠재는 아래로 정렬
        const abnormalEntries = Object.entries(cycleRes.perAbnormal).sort((a, b) => {
            const isAProc = a[0].startsWith('재능') || a[0].startsWith('잠재');
            const isBProc = b[0].startsWith('재능') || b[0].startsWith('잠재');
            if (isAProc && !isBProc) return 1;
            if (!isAProc && isBProc) return -1;
            return 0;
        });

        abnormalEntries.forEach(([aName, aData]) => {
            const dmgVal = aData.dmg || 0;
            const count = aData.count || 0;

            const row = document.createElement('div');
            row.className = 'cycle-dmg-row abnormal-row';
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '8px';
            row.style.opacity = '0.9';

            const isProc = aName.startsWith('재능') || aName.startsWith('잠재');
            const labelText = isProc ? aName : `${aName}`;

            const countDiv = document.createElement('div');
            countDiv.className = 'skill-count-badge';
            countDiv.innerText = `${count}회`;
            countDiv.style.minWidth = '40px';
            countDiv.style.textAlign = 'center';
            countDiv.style.fontSize = '0.8rem';
            countDiv.style.background = 'rgba(255, 255, 255, 0.05)';
            countDiv.style.padding = '4px';
            countDiv.style.borderRadius = '4px';

            const card = document.createElement('div');
            card.className = 'skill-card';
            card.style.flex = '1';

            const header = document.createElement('div');
            header.className = 'skill-card-header';
            header.innerHTML = `<span class="skill-name"">${labelText}</span><span class="skill-dmg"">${dmgVal.toLocaleString()}</span>`;

            card.appendChild(header);

            const shareDiv = document.createElement('div');
            shareDiv.className = 'skill-dmg-share';
            const totalValue = cycleRes.total || 0;
            const share = totalValue > 0 ? (dmgVal / totalValue * 100) : 0;
            shareDiv.innerText = share.toFixed(1) + '%';

            row.appendChild(countDiv);
            row.appendChild(card);
            row.appendChild(shareDiv);

            list.appendChild(row);
        });
    }
}

/**
 * 현재 오퍼레이터가 사용할 수 있는 모든 무기의 데미지를 비교 렌더링한다.
 * 사이클 데미지 합계를 우선으로 비교하며, 합계가 0이면 최종 1회 데미지를 기준으로 한다.
 *
 * @param {object} currentRes - 현재 무기로 계산된 calculateDamage 결과
 * @param {object|null} currentCycle - 현재 무기로 계산된 calculateCycleDamage 결과
 */
function renderWeaponComparison(currentRes, currentCycle) {
    const box = document.getElementById('weapon-comparison');
    if (!box || !state.mainOp.id || !currentRes) return;

    const currentOp = DATA_OPERATORS.find(o => o.id === state.mainOp.id);
    if (!currentOp) return;

    // 기준값 결정 (사이클 합산 > 0 이면 사이클 데미지, 아니면 최종 데미지)
    const currentTotal = (currentCycle && currentCycle.total > 0) ? currentCycle.total : currentRes.finalDmg;

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

            const res = calculateDamage(state, true);
            if (!res) return null;

            const cRes = typeof calculateCycleDamage === 'function' ? calculateCycleDamage(state, res, true) : null;
            const compTotal = (cRes && cRes.total > 0) ? cRes.total : res.finalDmg;

            const diff = compTotal - currentTotal;
            const pct = currentTotal > 0 ? ((diff / currentTotal) * 100).toFixed(1) : 0;
            return { name: w.name, finalDmg: compTotal, pct: Number(pct) };
        })
        .filter(Boolean)
        .sort((a, b) => b.finalDmg - a.finalDmg);

    // 원래 무기 정보 복원
    state.mainOp.wepId = savedWepId;
    state.mainOp.wepPot = savedWepPot;
    state.mainOp.wepState = savedWepState;

    const maxDmg = comparisons.length > 0 ? Math.max(comparisons[0].finalDmg, currentTotal) : currentTotal;
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
        const valMatch = log.txt.match(/([+-]?\s*\d+(\.\d+)?)\s*%/);
        const val = valMatch ? parseFloat(valMatch[1].replace(/\s/g, '')) : 0;
        const targetState = getTargetState();

        // 태그 기반 분류
        if (log.tag === 'all') {
            if (log.txt.includes('스킬')) {
                // 스킬 관련 공통 요소 -> 배틀, 연계, 궁극기에 복사
                ['battle', 'combo', 'ult'].forEach(k => {
                    const uiLog = { ...log, txt: `(공통) ${log.txt}`, _uiUid: `${log.uid}#${k}` };
                    catLogs[k].push(uiLog);
                    const isUiDisabled = (targetState.disabledEffects && targetState.disabledEffects.includes(uiLog._uiUid)) || !!uiLog._triggerFailed;
                    if (!isUiDisabled) catSums[k] += val;
                });
            } else {
                // 순수 공통
                const uiLog = { ...log, _uiUid: `${log.uid}#common` };
                catLogs.common.push(uiLog);
                const isUiDisabled = (targetState.disabledEffects && targetState.disabledEffects.includes(uiLog._uiUid)) || !!uiLog._triggerFailed;
                if (!isUiDisabled) catSums.common += val;
            }
        } else if (log.tag === 'normal') {
            const uiLog = { ...log, _uiUid: `${log.uid}#normal` };
            catLogs.normal.push(uiLog);
            const isUiDisabled = (targetState.disabledEffects && targetState.disabledEffects.includes(uiLog._uiUid)) || !!uiLog._triggerFailed;
            if (!isUiDisabled) catSums.normal += val;
        } else if (log.tag === 'skill' || log.tag === 'skillMult') {
            const skillTypes = Array.isArray(log.skillType) ? log.skillType : (log.skillType ? [log.skillType] : []);

            if (skillTypes.length > 0) {
                skillTypes.forEach(stName => {
                    const key = categories.find(c => c.type === stName)?.id;
                    if (key) {
                        const uiLog = { ...log, _uiUid: `${log.uid}#${key}` };
                        catLogs[key].push(uiLog);
                        const isUiDisabled = (targetState.disabledEffects && targetState.disabledEffects.includes(uiLog._uiUid)) || !!uiLog._triggerFailed;
                        if (!isUiDisabled) catSums[key] += val;
                    }
                });
            } else {
                ['battle', 'combo', 'ult'].forEach(k => {
                    const uiLog = { ...log, _uiUid: `${log.uid}#${k}` };
                    catLogs[k].push(uiLog);
                    const isUiDisabled = (targetState.disabledEffects && targetState.disabledEffects.includes(uiLog._uiUid)) || !!uiLog._triggerFailed;
                    if (!isUiDisabled) catSums[k] += val;
                });
            }
        } else {
            const key = Object.keys(catLogs).find(k => k === log.tag);
            if (key) {
                const uiLog = { ...log, _uiUid: `${log.uid}#${key}` };
                catLogs[key].push(uiLog);
                const isUiDisabled = (targetState.disabledEffects && targetState.disabledEffects.includes(uiLog._uiUid)) || !!uiLog._triggerFailed;
                if (!isUiDisabled) catSums[key] += val;
            }
        }
    });

    const PROTECTED_UIDS = ['base_op_atk', 'base_wep_atk', 'stat_bonus_atk', 'unbalance_base'];

    categories.forEach(cat => {
        // 1. 상단 통계 (Flex Item)
        const statItem = document.createElement('div');
        statItem.className = 'sub-stat-item';

        if (cat.id === 'common') {
            statItem.innerHTML = `<label>총 합계</label>`;
            if (totalEl) {
                totalEl.style.fontSize = '1.1rem';
                totalEl.style.color = 'var(--accent)';
                statItem.appendChild(totalEl);
            }
        } else {
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

            const uid = log.uid;
            const uiUid = log._uiUid || uid;
            if (uid) {
                li.dataset.uid = uiUid;
                const isProtected = PROTECTED_UIDS.includes(uid);
                if (!isProtected) {
                    li.style.cursor = 'pointer';
                    const ts = getTargetState();

                    const stackCount = ts.effectStacks?.[uid] !== undefined ? ts.effectStacks[uid] : 1;
                    if (log.stack) {
                        if (stackCount === 0) li.classList.add('disabled-effect');
                    } else {
                        const targetUid = log._uiUid || uid;
                        if (ts.disabledEffects && ts.disabledEffects.includes(targetUid)) li.classList.add('disabled-effect');
                    }

                    if (log._triggerFailed) {
                        li.classList.add('triggerFail-effect');
                    }

                    li.onclick = (e) => {
                        e.stopPropagation();
                        ensureCustomState();
                        const nextTs = getTargetState();
                        const targetToggleUid = log._uiUid || uid;
                        if (log.stack) {
                            if (!nextTs.effectStacks) nextTs.effectStacks = {};
                            let cur = nextTs.effectStacks[uid] !== undefined ? nextTs.effectStacks[uid] : 1;
                            cur++;
                            if (cur > log.stack) cur = 0;
                            nextTs.effectStacks[uid] = cur;
                        } else {
                            if (!nextTs.disabledEffects) nextTs.disabledEffects = [];
                            const idx = nextTs.disabledEffects.indexOf(targetToggleUid);
                            if (idx > -1) nextTs.disabledEffects.splice(idx, 1);
                            else nextTs.disabledEffects.push(targetToggleUid);
                        }
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

/**
 * 메인 오퍼레이터 변경 시, 해당 오퍼레이터의 '강화' 스킬들에 대한 동기식 버튼을 추가합니다.
 * @param {string} opId - 오퍼레이터 ID
 */
function updateEnhancedSkillButtons(opId) {
    const btnContainer = document.querySelector('.cycle-add-buttons');
    if (!btnContainer) return;

    // 기존 동적 추가 버튼(강화 스킬) 모두 제거
    btnContainer.querySelectorAll('.cycle-btn-enhanced').forEach(btn => btn.remove());

    if (!opId) return;

    const opData = DATA_OPERATORS.find(o => o.id === opId);
    if (!opData || !opData.skill) return;

    // '강화'가 들어간 스킬을 찾음
    const enhancedSkills = opData.skill.filter(s => {
        return s.skillType && s.skillType.some(st => st.startsWith('강화 '));
    });

    enhancedSkills.forEach(es => {
        const skillName = es.skillType[0]; // 0번 인덱스가 기본 스킬명
        const btn = document.createElement('div');
        btn.className = 'cycle-btn cycle-btn-enhanced';
        btn.dataset.type = skillName;
        btn.title = skillName;

        // 버튼 디자인: 오퍼이미지 + 타이틀
        btn.innerHTML = `
            <div class="skill-icon-frame">
                <img src="images/operators/${opData.name}.webp" alt="${skillName}">
            </div>
            <span>${skillName}</span>
        `;

        btn.onclick = () => {
            if (typeof addCycleItem === 'function') addCycleItem(skillName);
        };

        btn.onmouseenter = (e) => {
            const opData = DATA_OPERATORS.find(o => o.id === opId);
            const activeEffects = window.lastCalcResult ? window.lastCalcResult.activeEffects : [];
            const content = AppTooltip.renderSkillTooltip(skillName, es, opData, '', activeEffects);
            AppTooltip.showCustom(content, e, { width: '260px' });
        };
        btn.onmouseleave = () => AppTooltip.hide();

        btnContainer.appendChild(btn);
    });
    console.log(`[DEBUG] updateEnhancedSkillButtons(${opId}) created ${enhancedSkills.length} buttons.`);
}
