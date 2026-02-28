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

// ---- 공통 헬퍼 ----

// customState가 있으면 state와 병합한 타겟 state를 반환한다.
function buildTargetState(customState) {
    if (!customState) return state;
    return {
        ...state,
        disabledEffects: customState.disabledEffects,
        debuffState: customState.debuffState,
        enemyUnbalanced: customState.enemyUnbalanced,
        mainOp: { ...state.mainOp, specialStack: customState.specialStack }
    };
}

// FLIP 애니메이션을 컨테이너에 적용한다.
// firstPositions: Map<key, DOMRect>, attrName: data-* 속성 이름
function applyFlipAnimation(container, firstPositions, attrName) {
    requestAnimationFrame(() => {
        Array.from(container.children).forEach(child => {
            const key = child.getAttribute(attrName);
            const firstRect = firstPositions.get(key);
            if (firstRect) {
                const lastRect = child.getBoundingClientRect();
                const deltaY = firstRect.top - lastRect.top;
                if (deltaY !== 0) {
                    child.style.transition = 'none';
                    child.style.transform = `translateY(${deltaY}px)`;
                    requestAnimationFrame(() => {
                        child.style.transition = 'transform 0.3s ease';
                        child.style.transform = '';
                    });
                }
            } else {
                requestAnimationFrame(() => {
                    child.style.transition = 'opacity 0.3s ease';
                    child.style.opacity = child.classList.contains('abnormal-row') ? '0.9' : '1';
                });
            }
        });
    });
}

// 스킬 아이콘 HTML 문자열을 반환한다.
function buildSkillIconHtml(imgSrc, color, altText) {
    return `<div class="skill-icon-frame" style="border-color: ${color}"><img src="${imgSrc}" alt="${altText}"></div>`;
}

// 클릭으로 효과를 비활성화할 수 있는 <li> 요소를 생성한다.
// options: { isProtected, log, uid, uiUid }
function createEffectListItem(log, options = {}) {
    const PROTECTED_UIDS = ['base_op_atk', 'base_wep_atk', 'stat_bonus_atk', 'unbalance_base', 'level_coeff_phys', 'level_coeff_arts'];
    const uid = options.uid || log.uid;
    const uiUid = options.uiUid || uid;
    const isProtected = options.isProtected || PROTECTED_UIDS.includes(uid);

    const li = document.createElement('li');
    li.innerHTML = log.txt;

    const isUnbalancedOff = log.unbalancedOff;
    if (isUnbalancedOff) li.classList.add('unbalanced-off');
    if (log._triggerFailed) li.classList.add('triggerFail-effect');

    if (!uid) return li;

    li.dataset.uid = uiUid;

    if (isProtected) {
        li.style.cursor = 'default';
        return li;
    }

    li.style.cursor = 'pointer';
    const ts = getTargetState();
    if (log.stack) {
        if ((ts.effectStacks?.[uid] ?? 1) === 0) li.classList.add('disabled-effect');
    } else {
        if (ts.disabledEffects?.includes(uiUid)) li.classList.add('disabled-effect');
    }

    li.onclick = (e) => {
        if (e) e.stopPropagation();
        ensureCustomState();
        const ts2 = getTargetState();
        if (log.stack) {
            if (!ts2.effectStacks) ts2.effectStacks = {};
            let cur = ts2.effectStacks[uid] !== undefined ? ts2.effectStacks[uid] : 1;
            cur = (cur >= log.stack) ? 0 : cur + 1;
            ts2.effectStacks[uid] = cur;
        } else {
            if (!ts2.disabledEffects) ts2.disabledEffects = [];
            const idx = ts2.disabledEffects.indexOf(uiUid);
            if (idx > -1) ts2.disabledEffects.splice(idx, 1);
            else ts2.disabledEffects.push(uiUid);
        }
        if (!state.selectedSeqId) propagateGlobalStateToCustom('effects');
        updateState();
    };

    return li;
}

/**
 * 정적 사이클 버튼(일반, 배틀, 연계, 궁극기)의 테두리 색상을 오퍼레이터 속성에 맞춰 업데이트
 * @param {string} [opId] - 오퍼레이터 ID (생략 시 state.mainOp.id 사용)
 */
function updateStaticCycleButtonsElementColor(opId) {
    const targetId = opId || (state && state.mainOp && state.mainOp.id);
    if (!targetId) return;

    const opData = DATA_OPERATORS.find(o => o.id === targetId);
    if (!opData) return;

    const buttons = document.querySelectorAll('.cycle-add-buttons .cycle-btn:not(.cycle-btn-enhanced)');
    buttons.forEach(btn => {
        const type = btn.dataset.type;
        const color = AppTooltip.getSkillElementColor(opData, type);
        const frame = btn.querySelector('.skill-icon-frame');
        if (frame) {
            frame.style.borderColor = color;
        }
    });
}
window.updateStaticCycleButtonsElementColor = updateStaticCycleButtonsElementColor;

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
    if (state.selectedSeqId && cycleRes && cycleRes.sequence) {
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
        'stat-str-val': Math.floor(displayRes.stats.str || 0),
        'stat-agi-val': Math.floor(displayRes.stats.agi || 0),
        'stat-int-val': Math.floor(displayRes.stats.int || 0),
        'stat-wil-val': Math.floor(displayRes.stats.wil || 0),
        'stat-crit': (displayRes.stats.critExp * 100).toFixed(1) + '%',
        'val-crit-rate': displayRes.stats.finalCritRate + '%',
        'val-crit-dmg': displayRes.stats.critDmg + '%',
        'stat-dmg-inc': displayRes.stats.dmgInc.toFixed(1) + '%',
        'stat-unbal': displayRes.stats.unbalanceDmg.toFixed(1) + '%',
        'stat-ult-recharge': (displayRes.stats.ultRecharge || 0).toFixed(1) + '%',
        'stat-ult-cost': Math.ceil(displayRes.stats.finalUltCost || 0),
        'stat-arts': displayRes.stats.originiumArts.toFixed(0),
        'stat-arts-bonus': displayRes.stats.originiumArts.toFixed(1) + '%',
        'stat-res': (displayRes.stats.resistance ?? 0).toFixed(0),
        'stat-res-mult': (((displayRes.stats.resMult ?? 1) - 1) * 100).toFixed(1) + '%',
        'stat-def-red': ((1 - (displayRes.stats.defMult ?? 1)) * 100).toFixed(1) + '%'
    };

    // 피해 배율 빨간색 표시
    const resMultEl = document.getElementById('stat-res-mult');
    if (resMultEl) {
        if ((displayRes.stats.resistance ?? 0) > 0) {
            resMultEl.classList.add('text-red');
        } else {
            resMultEl.classList.remove('text-red');
        }
    }

    for (const [id, val] of Object.entries(mapping)) {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    }



    // 로그 목록 업데이트
    const logMapping = {
        'list-atk': displayRes.logs.atk,
        'list-crit': (displayRes.logs.crit || []).sort((a, b) => {
            const order = { 'rate': 1, 'dmg': 2 };
            return (order[a.type] || 99) - (order[b.type] || 99);
        }),
        'list-unbal': displayRes.logs.unbal,
        'list-ult-recharge': (displayRes.logs.ultRecharge || []).sort((a, b) => {
            if (a.tag === 'reduction' && b.tag !== 'reduction') return -1;
            if (a.tag !== 'reduction' && b.tag === 'reduction') return 1;
            return 0;
        }),
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
    renderLevelCoeff(displayRes);

    // 증폭/받는피해/취약 속성 분리 렌더링
    renderElemSplit('amp-container', displayRes.logs.amp, '증폭');
    renderElemSplit('taken-container', displayRes.logs.taken, '적이 받는 피해');
    renderElemSplit('vuln-container', displayRes.logs.vuln, '취약');

    // 전용 스택 등 가시성 동기화
    if (typeof updateUIStateVisuals === 'function') {
        updateUIStateVisuals();
    }

    // 무기 비교 렌더링 (사이클 데미지 우선)
    renderWeaponComparison(res, cycleRes);
}

/**
 * 로그 배열을 오퍼레이터 속성(elem1/elem2)에 따라 분리하여 statsEl/listEl에 렌더링한다.
 * 주는 피해 박스와 동일한 속성 분리 패턴을 사용한다.
 * @param {string} containerId - 컬럼들을 삽입할 flex container 요소 id
 * @param {Array}  logs        - calc.js 로그 배열 (각 항목에 tag 속성 있음)
 * @param {string} label       - 전체 카테고리 표시명 (예: '증폭')
 */
function renderElemSplit(containerId, logs, label) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const opData = DATA_OPERATORS.find(o => o.id === state.mainOp.id);

    // 오퍼레이터 스킬에서 고유 element 목록 추출 (최대 2개)
    const skillElements = [];
    if (opData?.skill) {
        opData.skill.forEach(s => {
            if (s.element && !skillElements.includes(s.element)) skillElements.push(s.element);
        });
    }

    const ELEMENT_LABEL_MAP = { phys: '물리', heat: '열기', elec: '전기', cryo: '냉기', nature: '자연' };
    const elem1Key = skillElements[0] || null;
    const elem2Key = skillElements[1] || null;

    // 카테고리 목록 (속성1 + 속성2, 전역 없음)
    const cats = [
        ...(elem1Key ? [{ id: 'elem1', title: (ELEMENT_LABEL_MAP[elem1Key] || elem1Key) + ' ' + label }] : []),
        ...(elem2Key ? [{ id: 'elem2', title: (ELEMENT_LABEL_MAP[elem2Key] || elem2Key) + ' ' + label }] : [])
    ];
    if (cats.length === 0) return;

    // 로그 분류
    const catLogs = { elem1: [], elem2: [] };
    const catSums = { elem1: 0, elem2: 0 };
    const targetState = getTargetState();

    (logs || []).forEach(log => {
        let val = 0;
        const valMatch = log.txt?.match(/([+-]?\s*\d+(\.\d+)?)\s*%/);
        if (valMatch) val = parseFloat(valMatch[1].replace(/\s/g, ''));

        const tag = log.tag || 'all';
        const uiLog = { ...log, _uiUid: log.uid };
        const isDisabled = targetState.disabledEffects?.includes(log.uid) || !!log._triggerFailed;

        if (tag === 'all') {
            // 전역 로그 → 존재하는 모든 속성 칸에 복사 (uid 공유, 동시 토글)
            cats.forEach(cat => {
                catLogs[cat.id].push(uiLog);
                if (!isDisabled) catSums[cat.id] += val;
            });
        } else if (tag === 'phys') {
            cats.forEach(cat => {
                const elemKey = cat.id === 'elem1' ? elem1Key : elem2Key;
                if (elemKey === 'phys') {
                    catLogs[cat.id].push(uiLog);
                    if (!isDisabled) catSums[cat.id] += val;
                }
            });
        } else if (tag === 'arts') {
            cats.forEach(cat => {
                const elemKey = cat.id === 'elem1' ? elem1Key : elem2Key;
                if (elemKey && elemKey !== 'phys') {
                    catLogs[cat.id].push(uiLog);
                    if (!isDisabled) catSums[cat.id] += val;
                }
            });
        } else {
            const catId = (tag === elem1Key) ? 'elem1' : (tag === elem2Key) ? 'elem2' : null;
            if (catId && catLogs[catId]) {
                catLogs[catId].push(uiLog);
                if (!isDisabled) catSums[catId] += val;
            }
        }
    });

    // 각 카테고리를 하나의 컬럼(제목+수치+리스트)으로 좌우 배치
    cats.forEach(cat => {
        const col = document.createElement('div');
        col.className = 'dmg-inc-column';

        // 제목 + 수치 헤더
        const header = document.createElement('div');
        header.className = 'dmg-inc-col-header';
        header.innerHTML = `<label>${cat.title}</label><span>${catSums[cat.id].toFixed(1)}%</span>`;
        col.appendChild(header);

        // 로그 리스트
        const ul = document.createElement('ul');
        ul.className = 'detail-list';
        catLogs[cat.id].forEach(log => {
            ul.appendChild(createEffectListItem(log, { uid: log.uid, uiUid: log._uiUid }));
        });
        col.appendChild(ul);

        container.appendChild(col);
    });
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
        ${set.desc ? `<div class="set-desc">${set.desc}</div>` : ''}
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

    list.forEach(item => {
        const log = typeof item === 'string' ? { txt: item } : item;
        const li = createEffectListItem(log, { uid: log.uid, uiUid: log.uid });
        ul.appendChild(li);
    });
}

/**
 * 사이클 계산 결과를 DOM에 업데이트한다.
 * @param {{sequence: Array, perSkill: object, total: number}|null} cycleRes
 */
function renderCycleDamage(cycleRes) {
    window.lastCycleRes = cycleRes;
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
            '일반 공격': 'images/skills/일반 공격.webp',
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

        const opData = DATA_OPERATORS.find(o => o.id === state.mainOp.id);
        const color = AppTooltip.getSkillElementColor(opData, type);

        const imgSrc = imgMap[baseType] || imgMap['일반 공격'];
        const iconHtml = buildSkillIconHtml(imgSrc, color, baseType);
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
                const baseRate = item.baseRate !== undefined ? item.baseRate : rawRate;
                rateHtml = `${(baseRate * 100).toFixed(0)}%`;

                // 보너스 항목 (이본 등)
                if (item.bonusList && item.bonusList.length > 0) {
                    item.bonusList.forEach(b => {
                        const stackStr = b.stack ? ` ${b.stack}스택` : '';
                        rateHtml += ` + ${b.name}${stackStr} ${(b.val * 100).toFixed(0)}%`;
                    });
                }

                // 물리/아츠 이상 항목
                if (item.abnormalList && item.abnormalList.length > 0) {
                    item.abnormalList.forEach(a => {
                        let suffix = '';
                        if (state.mainOp.id === 'Da Pan' && a.name === '강타') {
                            suffix = ' <span style="color:var(--accent); font-size: 0.9em;">[판 특성] * 120%</span>';
                        }
                        // 아츠 이상인 경우 colorizeText를 통해 색상 적용 (아츠 폭발, 연소 등)
                        const nameHtml = (typeof AppTooltip !== 'undefined' && AppTooltip.colorizeText)
                            ? AppTooltip.colorizeText(a.name)
                            : a.name;
                        rateHtml += ` + ${nameHtml} ${(a.mult * 100).toFixed(0)}%${suffix}`;
                    });
                }
            } else {
                rateHtml = item.dmgRate || '0%';
            }

            const opData = DATA_OPERATORS.find(o => o.id === (state.mainOp?.id || ''));
            const activeEffects = item.activeEffects || (window.lastCalcResult ? window.lastCalcResult.activeEffects : []);
            const targetSt = buildTargetState(item.customState);

            const content = AppTooltip.renderSequenceTooltip(type, displayDmg, rateHtml, activeEffects, targetSt, opData);
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

window.isCycleSortEnabled = false;

function renderCyclePerSkill(cycleRes) {
    const list = document.getElementById('cycle-dmg-list');
    const totalEl = document.getElementById('cycle-dmg-total');

    if (totalEl) totalEl.innerText = cycleRes ? Math.floor(cycleRes.total).toLocaleString() : '0';

    if (!cycleRes || !list) return;

    // FLIP 애니메이션: 현재 위치 저장 및 기존 노드 매핑
    const firstPositions = new Map();
    const existingNodes = new Map();

    Array.from(list.children).forEach(child => {
        const key = child.getAttribute('data-item-key');
        if (key) {
            firstPositions.set(key, child.getBoundingClientRect());
            existingNodes.set(key, child);
        }
    });

    let allItems = [];

    // 1. 데이터 통합
    if (cycleRes.perSkill) {
        Object.keys(cycleRes.perSkill).forEach(key => {
            allItems.push({
                type: 'skill',
                key: key,
                data: cycleRes.perSkill[key]
            });
        });
    }

    if (cycleRes.perAbnormal) {
        Object.keys(cycleRes.perAbnormal).forEach(key => {
            allItems.push({
                type: 'abnormal',
                key: key,
                data: cycleRes.perAbnormal[key]
            });
        });
    }

    // 2. 정렬 로직
    if (window.isCycleSortEnabled) {
        allItems.sort((a, b) => (b.data.dmg || 0) - (a.data.dmg || 0));
    } else {
        const skills = allItems.filter(i => i.type === 'skill');
        const abnormals = allItems.filter(i => i.type === 'abnormal');

        abnormals.sort((a, b) => {
            const isAProc = a.key.includes('무기') || a.key.includes('재능') || a.key.includes('잠재');
            const isBProc = b.key.includes('무기') || b.key.includes('재능') || b.key.includes('잠재');
            if (isAProc && !isBProc) return 1;
            if (!isAProc && isBProc) return -1;
            return 0; // 나머지는 원래 순서(계산 순서) 유지
        });

        allItems = [...skills, ...abnormals];
    }

    // 3. 렌더링 (DOM 재사용)
    allItems.forEach(item => {
        const name = item.key;
        const data = item.data;
        const dmgVal = data.dmg || 0;
        const count = data.count || 0;
        const totalValue = cycleRes.total || 0;
        const share = totalValue > 0 ? (dmgVal / totalValue * 100) : 0;

        let row = existingNodes.get(name);
        let isNew = false;

        if (!row) {
            isNew = true;
            row = document.createElement('div');
            row.className = 'cycle-dmg-row';
            row.setAttribute('data-item-key', name);
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '8px';
            row.style.opacity = '0'; // 신규 항목은 투명하게 시작
        } else {
            // 기존 노드 재사용 시 스타일 초기화 (혹시 모를 잔여 스타일 제거)
            row.style.transition = '';
            row.style.transform = '';
            row.style.opacity = item.type === 'abnormal' ? '0.9' : '1';
            // 맵에서 제거하여 나중에 남은 것들(삭제 대상)만 남김
            existingNodes.delete(name);
        }

        // 클래스 업데이트
        if (item.type === 'abnormal') row.classList.add('abnormal-row');
        else row.classList.remove('abnormal-row');

        // 내부 HTML 갱신 (데이터가 변경되었을 수 있으므로 재생성)
        // *주의: innerHTML을 덮어쓰면 내부 이벤트 리스너가 사라지므로 다시 걸어줘야 함.
        row.innerHTML = '';

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

        // 딜 지분 바 (배경)
        const bar = document.createElement('div');
        bar.className = 'skill-dmg-bar';
        bar.style.width = `${share.toFixed(1)}%`;
        card.appendChild(bar);

        const header = document.createElement('div');
        header.className = 'skill-card-header';

        let displayName = name.replace('(이상)', '');
        header.innerHTML = `<span class="skill-name">${displayName}</span><span class="skill-dmg">${dmgVal.toLocaleString()}</span>`;

        // 툴팁 이벤트
        header.onmouseenter = (e) => {
            if (item.type === 'skill') {
                const opData = DATA_OPERATORS.find(o => o.id === state.mainOp.id);
                const skillDef = opData?.skill?.find(s => {
                    const entry = s;
                    return entry?.skillType?.includes(name);
                });

                let content;
                if (skillDef) {
                    const activeEffects = window.lastCalcResult ? window.lastCalcResult.activeEffects : [];
                    const extraHtml = '';

                    let targetSt = buildTargetState(data.customState);

                    content = AppTooltip.renderSkillTooltip(name, skillDef, opData, extraHtml, activeEffects, targetSt);
                } else {
                    content = `
                        <div class="tooltip-title">${name}</div> 
                        <div class="tooltip-desc">${data.desc ? data.desc : '설명 없음'}</div>
                    `;
                }
                AppTooltip.showCustom(content, e, { width: '350px' });
            } else {
                const isProc = name.startsWith('재능') || name.startsWith('잠재') || name.startsWith('무기') || name.startsWith('세트');
                if (!isProc) {
                    const artsStrength = window.lastCalcResult?.stats?.originiumArts || 0;
                    const content = AppTooltip.renderAbnormalTooltip(name, artsStrength, state, data.elements);
                    AppTooltip.showCustom(content, e, { width: '350px' });
                }
            }
        };
        header.onmouseleave = () => AppTooltip.hide();

        card.appendChild(header);

        // 3. 지분율 표시
        const shareDiv = document.createElement('div');
        shareDiv.className = 'skill-dmg-share';
        shareDiv.innerText = share.toFixed(1) + '%';

        row.appendChild(countDiv);
        row.appendChild(card);
        row.appendChild(shareDiv);

        // 리스트에 추가 (기존 노드면 이동, 새 노드면 추가됨)
        list.appendChild(row);
    });

    // 4. 남은 노드 삭제 (더 이상 존재하지 않는 항목)
    existingNodes.forEach(node => node.remove());

    // 5. FLIP 애니메이션 적용
    applyFlipAnimation(list, firstPositions, 'data-item-key');
}

function initCycleSortButton() {
    const btn = document.getElementById('btn-sort-cycle');
    if (!btn) return;

    btn.onclick = () => {
        window.isCycleSortEnabled = !window.isCycleSortEnabled;
        btn.classList.toggle('active', window.isCycleSortEnabled);

        if (window.lastCycleRes) {
            renderCyclePerSkill(window.lastCycleRes);
        }
    };
}


/**
 * 현재 오퍼레이터가 사용할 수 있는 모든 무기의 데미지를 비교 렌더링한다.
 * 사이클 데미지 합계를 우선으로 비교하며, 합계가 0이면 최종 1회 데미지를 기준으로 한다.
 *
 * [리팩토링] currentRes → res, currentCycle → cycleRes
 * - res: renderResult(res), renderDmgInc(res, cycleRes) 등 파일 전체 관례에 맞게 통일
 * - cycleRes: renderCycleDamage(cycleRes), renderDmgInc(res, cycleRes) 관례에 맞게 통일
 * - 내부 지역변수 충돌 방지: calculateDamage 결과를 담는 로컬 변수는 wepRes로 명명
 *
 * @param {object} res - 현재 무기로 계산된 calculateDamage 결과
 * @param {object|null} cycleRes - 현재 무기로 계산된 calculateCycleDamage 결과
 */
function renderWeaponComparison(res, cycleRes) {
    const box = document.getElementById('weapon-comparison');
    if (!box || !state.mainOp.id || !res) return;

    const currentOp = DATA_OPERATORS.find(o => o.id === state.mainOp.id);
    if (!currentOp) return;

    // 기준값 결정 (사이클 합산 > 0 이면 사이클 데미지, 아니면 최종 데미지)
    const currentTotal = (cycleRes && cycleRes.total > 0) ? cycleRes.total : res.finalDmg;

    // FLIP 애니메이션: 현재 각 항목의 위치(First) 저장
    const firstPositions = new Map();
    Array.from(box.children).forEach(child => {
        const name = child.getAttribute('data-weapon-name');
        if (name) firstPositions.set(name, child.getBoundingClientRect());
    });

    const compPot = Number(document.getElementById('comp-wep-pot')?.value) || 0;
    const compState = document.getElementById('comp-wep-state')?.checked || false;

    const comparisons = DATA_WEAPONS
        .filter(w => currentOp.usableWeapons.includes(w.type))
        .map(w => {
            // [Fix] 전역 state 직접 수정 방지: 깊은 복사하여 독립적으로 계산
            // state에는 저항, 디버프, 비활성화된 효과(disabledEffects) 등 현재 설정이 모두 포함되어 있음
            // 따라서 현재 옵션 상태 그대로 무기만 변경하여 비교함
            const tempState = JSON.parse(JSON.stringify(state));

            // [Fix] 서브 무기 등의 특성 설정은 유지하고, 비교 대상 무기(w)의 특성만 강제로 활성화(기본값)한다.
            if (tempState.disabledEffects) {
                const targetPrefix = `${w.name}_trait`;
                tempState.disabledEffects = tempState.disabledEffects.filter(uid => !uid.startsWith(targetPrefix));
            }

            tempState.mainOp.wepId = w.id;
            tempState.mainOp.wepPot = compPot;
            tempState.mainOp.wepState = compState;

            // forceMaxStack: true로 설정하여 비교 시에만 최대 중첩 상태 가정
            const wepRes = calculateDamage(tempState, true);
            if (!wepRes) return null;

            const wepCycleRes = typeof calculateCycleDamage === 'function' ? calculateCycleDamage(tempState, wepRes, true) : null;
            const compTotal = (wepCycleRes && wepCycleRes.total > 0) ? wepCycleRes.total : wepRes.finalDmg;

            const diff = compTotal - currentTotal;
            const pct = currentTotal > 0 ? ((diff / currentTotal) * 100).toFixed(1) : 0;
            const displayName = w.name;
            return { name: displayName, finalDmg: compTotal, pct: Number(pct) };
        })
        .filter(Boolean)
        .sort((a, b) => b.finalDmg - a.finalDmg);

    // [Mod] 바 너비 기준 설정
    // 기본적으로 목록 내 가장 높은 데미지를 100% 기준으로 삼되,
    // 가장 높은 무기의 효율이 음수(현재 무기보다 약함)라면 현재 무기(currentTotal)를 100% 기준으로 삼는다.
    let maxDmg = comparisons.length > 0 ? comparisons[0].finalDmg : 0;
    if (comparisons.length > 0 && comparisons[0].pct < 0) {
        maxDmg = currentTotal;
    }
    box.innerHTML = '';

    comparisons.forEach(item => {
        const sign = item.pct > 0 ? '+' : '';
        const cls = item.pct >= 0 ? (item.pct === 0 ? 'current' : 'positive') : 'negative';

        // [Fix] 너비 계산 안전장치
        let ratio = maxDmg > 0 ? (item.finalDmg / maxDmg) : 0;
        ratio = Math.max(0, Math.min(1, ratio));
        const barWidth = (ratio * 100).toFixed(1);

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
    applyFlipAnimation(box, firstPositions, 'data-weapon-name');
}
/**
 * 주는 피해 세부 정보를 2층(상단: 주는피해+속성1+2, 하단: 4스킬)으로 나누어 렌더링한다.
 * @param {object} res - calculateDamage 결과
 * @param {object} cycleRes - calculateCycleDamage 결과 (지분율 계산용)
 */
function renderDmgInc(res, cycleRes) {
    const statsTopEl = document.getElementById('dmg-inc-stats-top');
    const listTopEl = document.getElementById('dmg-inc-list-top');
    const statsBotEl = document.getElementById('dmg-inc-stats-bottom');
    const listBotEl = document.getElementById('dmg-inc-list-bottom');

    if (!statsTopEl || !listTopEl || !statsBotEl || !listBotEl) return;

    statsTopEl.innerHTML = '';
    listTopEl.innerHTML = '';
    statsBotEl.innerHTML = '';
    listBotEl.innerHTML = '';

    const opData = DATA_OPERATORS.find(o => o.id === state.mainOp.id);

    // 오퍼레이터 스킬에서 고유 element 목록 추출 (최대 2개)
    const skillElements = [];
    if (opData && opData.skill) {
        opData.skill.forEach(s => {
            if (s.element && !skillElements.includes(s.element)) {
                skillElements.push(s.element);
            }
        });
    }

    // 속성 내부 키 → 표시명 매핑
    const ELEMENT_LABEL_MAP = {
        phys: '물리 피해',
        heat: '열기 피해',
        elec: '전기 피해',
        cryo: '냉기 피해',
        nature: '자연 피해'
    };

    const elem1Key = skillElements[0] || null;
    const elem2Key = skillElements[1] || null;
    const hasElem2 = !!elem2Key;

    // 스킬타입별 element 맵 (정확한 합산에 사용)
    // 일반공격/배틀/연계/궁극기 각각이 어떤 속성을 쓰는지
    const SKILL_TYPE_NAMES = ['일반 공격', '배틀 스킬', '연계 스킬', '궁극기'];
    const SKILL_CAT_NAMES = ['normal', 'battle', 'combo', 'ult'];
    const skillTypeElems = { normal: null, battle: null, combo: null, ult: null };
    const SKILL_CAT_MAP = { '일반 공격': 'normal', '배틀 스킬': 'battle', '연계 스킬': 'combo', '궁극기': 'ult' };
    if (opData && opData.skill) {
        opData.skill.forEach(s => {
            const cat = SKILL_CAT_MAP[s.skillType?.[0]];
            if (cat && !skillTypeElems[cat]) skillTypeElems[cat] = s.element || null;
        });
    }

    // 스킬 element → catId 매핑 헬퍼 (elem1/elem2)
    function getElemCatForKey(elKey) {
        if (!elKey) return null;
        if (elKey === elem1Key) return 'elem1';
        if (elKey === elem2Key) return 'elem2';
        return null;
    }

    // 쳤테고리: 주는피해 단일 속성 오퍼레이터는 elem1만, 다속성은 elem1+elem2
    const topCats = [
        { id: 'elem1', title: elem1Key ? ELEMENT_LABEL_MAP[elem1Key] : '속성 피해' },
        ...(hasElem2 ? [{ id: 'elem2', title: ELEMENT_LABEL_MAP[elem2Key] }] : [])
    ];
    const botCats = [
        { id: 'normal', title: '일반 공격', elemKey: skillTypeElems.normal },
        { id: 'battle', title: '배틀 스킬', elemKey: skillTypeElems.battle },
        { id: 'combo', title: '연계 스킬', elemKey: skillTypeElems.combo },
        { id: 'ult', title: '궁극기', elemKey: skillTypeElems.ult }
    ];

    // 로그 분류 저장소
    const catLogs = { elem1: [], elem2: [], normal: [], battle: [], combo: [], ult: [] };
    const catSums = { elem1: 0, elem2: 0, normal: 0, battle: 0, combo: 0, ult: 0 };

    // 로그 분류
    (res.logs.dmgInc || []).forEach(log => {
        // 레벨 계수 전용 로그는 별도 타일에서 렌더링하므로 제외
        if (log.uid === 'level_coeff_phys' || log.uid === 'level_coeff_arts') return;

        let val = 0;
        const isMult = (log.tag === 'skillMult' || log.txt.includes('*'));
        if (!isMult) {
            if (log.val !== undefined) {
                val = log.val;
            } else {
                const valMatch = log.txt.match(/([+-]?\s*\d+(\.\d+)?)\s*%/);
                if (valMatch) val = parseFloat(valMatch[1].replace(/\s/g, ''));
            }
        }
        const targetState = getTargetState();

        const tag = log.tag;
        const skillTypes = log.skillType ? (Array.isArray(log.skillType) ? log.skillType : [log.skillType]) : null;

        // 스킬 타입별 분류 (normal/battle/combo/ult)
        if (tag === 'normal' || tag === 'battle' || tag === 'combo' || tag === 'ult') {
            const uiLog = { ...log, _uiUid: `${log.uid}#${tag}` };
            catLogs[tag].push(uiLog);
            const isUiDisabled = (targetState.disabledEffects && targetState.disabledEffects.includes(uiLog._uiUid)) || !!uiLog._triggerFailed;
            if (!isUiDisabled) catSums[tag] += val;
        } else if (tag === 'skill' || tag === 'skillMult') {
            if (skillTypes && skillTypes.length > 0) {
                skillTypes.forEach(stName => {
                    const k = SKILL_CAT_MAP[stName];
                    if (k) {
                        const uiLog = { ...log, _uiUid: `${log.uid}#${k}` };
                        catLogs[k].push(uiLog);
                        const isUiDisabled = (targetState.disabledEffects && targetState.disabledEffects.includes(uiLog._uiUid)) || !!uiLog._triggerFailed;
                        if (!isUiDisabled && !isMult) catSums[k] += val;
                    }
                });
            } else {
                ['battle', 'combo', 'ult'].forEach(k => {
                    const uiLog = { ...log, _uiUid: `${log.uid}#${k}` };
                    catLogs[k].push(uiLog);
                    const isUiDisabled = (targetState.disabledEffects && targetState.disabledEffects.includes(uiLog._uiUid)) || !!uiLog._triggerFailed;
                    if (!isUiDisabled && !isMult) catSums[k] += val;
                });
            }
        } else if (tag === 'all') {
            // 전역 피해 → elem1, elem2 모두에 복사 (공유 uid로 동시 토글)
            const uiLog = { ...log, _uiUid: log.uid };
            const isUiDisabled = (targetState.disabledEffects && targetState.disabledEffects.includes(log.uid)) || !!uiLog._triggerFailed;
            topCats.forEach(tc => {
                catLogs[tc.id].push(uiLog);
                if (!isUiDisabled) catSums[tc.id] += val;
            });
        } else if (elem1Key && tag === elem1Key) {
            const uiLog = { ...log, _uiUid: log.uid };
            catLogs.elem1.push(uiLog);
            const isUiDisabled = (targetState.disabledEffects && targetState.disabledEffects.includes(log.uid)) || !!uiLog._triggerFailed;
            if (!isUiDisabled) catSums.elem1 += val;
        } else if (elem2Key && tag === elem2Key) {
            const uiLog = { ...log, _uiUid: log.uid };
            catLogs.elem2.push(uiLog);
            const isUiDisabled = (targetState.disabledEffects && targetState.disabledEffects.includes(log.uid)) || !!uiLog._triggerFailed;
            if (!isUiDisabled) catSums.elem2 += val;
        } else {
            // 매핑되지 않은 속성 피해 → 비활성으로 deal에 표시
            const uiLog = { ...log, _uiUid: log.uid, _inactiveElement: true };
            catLogs.deal.push(uiLog);
        }
    });

    // 컬럼 생성 헬퍼
    function buildColumn(cat, statsContainer, listContainer, statVal) {
        // 통계 아이템
        const statItem = document.createElement('div');
        statItem.className = 'sub-stat-item';
        const displayVal = statVal !== undefined ? statVal : catSums[cat.id];
        statItem.innerHTML = `
            <label>${cat.title}</label>
            <span>${displayVal.toFixed(1)}%</span>
        `;
        statsContainer.appendChild(statItem);

        // 리스트 컬럼
        const col = document.createElement('div');
        col.className = 'dmg-inc-column';

        const ul = document.createElement('ul');
        ul.className = 'detail-list';

        const sortedLogs = [...catLogs[cat.id]].sort((a, b) => {
            const isAllSkillA = a.txt.includes('모든 스킬 피해');
            const isAllSkillB = b.txt.includes('모든 스킬 피해');
            if (isAllSkillA && !isAllSkillB) return -1;
            if (!isAllSkillA && isAllSkillB) return 1;
            if (a.tag === 'skillMult' && b.tag !== 'skillMult') return 1;
            if (a.tag !== 'skillMult' && b.tag === 'skillMult') return -1;
            return 0;
        });

        sortedLogs.forEach(log => {
            const uiUid = log._uiUid || log.uid;
            const li = createEffectListItem(log, { uid: log.uid, uiUid });

            if (log._inactiveElement) {
                li.classList.add('disabled-effect');
                li.title = '오퍼레이터 속성과 일치하지 않아 적용되지 않습니다.';
                li.style.cursor = 'default';
                li.onclick = (e) => e.stopPropagation();
            }

            ul.appendChild(li);
        });

        col.appendChild(ul);
        listContainer.appendChild(col);
    }

    // 상단 행 렌더링
    topCats.forEach(cat => buildColumn(cat, statsTopEl, listTopEl));

    // 하단 행 렌더링: 합계 = 해당 스킬타입 피해 전용
    botCats.forEach(cat => {
        buildColumn(cat, statsBotEl, listBotEl, catSums[cat.id]);
    });
}


/**
 * 레벨 계수 타일을 렌더링한다.
 * 오퍼레이터 스킬 속성에 따라 물리/아츠 컨럼을 유동적으로 표시한다.
 * @param {object} res - calculateDamage 반환값
 */
function renderLevelCoeff(res) {
    const container = document.getElementById('lv-coeff-container');
    if (!container) return;
    container.innerHTML = '';

    const opData = DATA_OPERATORS.find(o => o.id === state.mainOp.id);

    // 오퍼레이터 스킬에서 고유 element 목록 추출 (최대 2개)
    const skillElements = [];
    if (opData && opData.skill) {
        opData.skill.forEach(s => {
            if (s.element && !skillElements.includes(s.element)) skillElements.push(s.element);
        });
    }

    const ELEMENT_LABEL_MAP = { phys: '물리', heat: '열기', elec: '전기', cryo: '냉기', nature: '자연' };
    const elem1Key = skillElements[0] || null;
    const elem2Key = skillElements[1] || null;

    // 레벨 계수 로그 항목 (tag: phys 혹은 arts)
    const coeffLogs = (res.logs.dmgInc || []).filter(l => l.uid === 'level_coeff_phys' || l.uid === 'level_coeff_arts');

    // 속성에 따라 표시할 컨럼 결정
    // 물리 속성 스킬이 있으면 물리 레벨 계수 표시
    // 아츠 속성 스킬이 있으면 아츠 레벨 계수 표시
    const hasPhys = elem1Key === 'phys' || elem2Key === 'phys';
    const hasArts = (elem1Key && elem1Key !== 'phys') || (elem2Key && elem2Key !== 'phys');

    const cats = [
        ...(hasPhys ? [{ id: 'phys', title: '물리 레벨 계수', uid: 'level_coeff_phys' }] : []),
        ...(hasArts ? [{ id: 'arts', title: '아츠 레벨 계수', uid: 'level_coeff_arts' }] : [])
    ];

    if (cats.length === 0) return;

    cats.forEach(cat => {
        const log = coeffLogs.find(l => l.uid === cat.uid);
        if (!log) return;

        const col = document.createElement('div');
        col.className = 'dmg-inc-column';

        const header = document.createElement('div');
        header.className = 'dmg-inc-col-header';
        const coeffPct = cat.id === 'phys'
            ? (res.stats.levelCoeffPhys !== undefined ? (res.stats.levelCoeffPhys * 100).toFixed(1) : (89 / 392 * 100).toFixed(1))
            : (res.stats.levelCoeffArts !== undefined ? (res.stats.levelCoeffArts * 100).toFixed(1) : (89 / 196 * 100).toFixed(1));
        header.innerHTML = `<label>${cat.title}</label><span>${coeffPct}%</span>`;
        col.appendChild(header);

        const ul = document.createElement('ul');
        ul.className = 'detail-list';
        ul.appendChild(createEffectListItem(log, { uid: log.uid, uiUid: log.uid }));
        col.appendChild(ul);

        container.appendChild(col);
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
        const color = AppTooltip.getSkillElementColor(opData, skillName);

        const btn = document.createElement('div');
        btn.className = 'cycle-btn cycle-btn-enhanced';
        btn.dataset.type = skillName;
        btn.title = skillName;

        // 버튼 디자인: 오퍼이미지 + 타이틀
        btn.innerHTML = `
            ${buildSkillIconHtml(`images/operators/${opData.name}.webp`, color, skillName)}
            <span>${skillName}</span>
        `;

        btn.onclick = () => {
            if (typeof addCycleItem === 'function') addCycleItem(skillName);
        };

        btn.onmouseenter = (e) => {
            const opData = DATA_OPERATORS.find(o => o.id === opId);
            const activeEffects = window.lastCalcResult ? window.lastCalcResult.activeEffects : [];
            const content = AppTooltip.renderSkillTooltip(skillName, es, opData, '', activeEffects, getTargetState());
            AppTooltip.showCustom(content, e, { width: '350px' });
        };
        btn.onmouseleave = () => AppTooltip.hide();

        btnContainer.appendChild(btn);
    });

    window.updateSkillLevelButtonsUI?.();
}