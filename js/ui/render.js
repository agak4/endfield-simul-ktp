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

// ============================================================
// 모듈 상수
// ============================================================

/** 클릭으로 비활성화할 수 없는 uid 목록 (항상 계산에 포함되어야 하는 항목) */
const PROTECTED_UIDS = ['base_op_atk', 'base_wep_atk', 'stat_bonus_atk', 'unbalance_base'];

/** 스킬 타입 → 아이콘 이미지 경로 */
const SKILL_IMG_MAP = {
    '일반 공격': 'images/skills/기본 공격.webp',
    '배틀 스킬': 'images/skills/배틀 스킬.webp',
    '연계 스킬': 'images/skills/연계 스킬.webp',
    '궁극기': 'images/skills/궁극기.webp',
};

/** 스킬 타입 → CSS 클래스 suffix (seq-icon-{suffix}) */
const SKILL_CLASS_MAP = { '궁극기': 'ult', '연계 스킬': 'combo', '배틀 스킬': 'battle', '일반 공격': 'normal' };

// ============================================================
// 내부 유틸리티
// ============================================================

/**
 * customState 오버라이드가 있는 경우, 전역 state와 병합한 임시 state 객체를 반환한다.
 * renderCycleSequence와 renderCyclePerSkill에서 툴팁용 state를 만들 때 공통으로 사용한다.
 * @param {object|null} customState - 시퀀스 항목의 커스텀 상태
 * @returns {object} 병합된 state 또는 원본 state
 */
function makeCustomTargetState(customState) {
    if (!customState) return state;
    return {
        ...state,
        disabledEffects: customState.disabledEffects,
        debuffState: customState.debuffState,
        enemyUnbalanced: customState.enemyUnbalanced,
        mainOp: { ...state.mainOp, specialStack: customState.specialStack },
    };
}

/**
 * 스킬 타입 문자열에서 기본 분류를 추출한다.
 * '강화 배틀 스킬' → '배틀 스킬', '일반 공격' → '일반 공격' 등.
 * @param {string} type
 * @returns {string} 기본 스킬 타입
 */
function getBaseSkillType(type) {
    if (type.includes('궁극기')) return '궁극기';
    if (type.includes('연계')) return '연계 스킬';
    if (type.includes('배틀')) return '배틀 스킬';
    return '일반 공격';
}

/**
 * FLIP 애니메이션을 container의 자식 요소에 적용한다.
 * 호출 전에 firstPositions(First 단계)를 미리 수집하고,
 * DOM 갱신(Last 단계) 후 이 함수를 호출해야 한다.
 *
 * @param {HTMLElement} container - 애니메이션 대상 부모 요소
 * @param {Map<string, DOMRect>} firstPositions - 키 → 이전 위치 맵
 * @param {Function} getKey - (child) => string 키 추출 함수
 * @param {Function} [getDefaultOpacity] - (child) => string 신규 요소 최종 opacity (기본 '1')
 */
function applyFlipAnimation(container, firstPositions, getKey, getDefaultOpacity = () => '1') {
    requestAnimationFrame(() => {
        Array.from(container.children).forEach(child => {
            const key = getKey(child);
            const firstRect = firstPositions.get(key);
            if (firstRect) {
                // 기존 요소: 위치 이동 애니메이션
                const deltaY = firstRect.top - child.getBoundingClientRect().top;
                if (deltaY !== 0) {
                    child.style.transition = 'none';
                    child.style.transform = `translateY(${deltaY}px)`;
                    requestAnimationFrame(() => {
                        child.style.transition = 'transform 0.3s ease';
                        child.style.transform = '';
                    });
                }
            } else {
                // 신규 요소: 페이드인
                child.style.opacity = '0';
                requestAnimationFrame(() => {
                    child.style.transition = 'opacity 0.3s ease';
                    child.style.opacity = getDefaultOpacity(child);
                });
            }
        });
    });
}

/**
 * 효과 로그 항목(li)에 클릭 토글 핸들러를 등록한다.
 * PROTECTED_UIDS에 포함된 uid는 등록하지 않는다.
 * renderLog와 renderDmgInc에서 공통으로 사용한다.
 *
 * @param {HTMLElement} li      - 리스트 아이템 요소
 * @param {object}      log     - 로그 데이터 { uid, stack, _uiUid, ... }
 * @param {string}      uid     - 원본 uid
 * @param {string}      uiUid   - 실제 토글에 사용할 uid (카테고리 접미사 포함 가능)
 */
function attachEffectToggle(li, log, uid, uiUid) {
    if (!uid || PROTECTED_UIDS.includes(uid)) {
        li.style.cursor = 'default';
        return;
    }

    li.style.cursor = 'pointer';
    const ts = getTargetState();

    // 초기 비활성화 상태 표시
    if (log.stack) {
        if ((ts.effectStacks?.[uid] ?? 1) === 0) li.classList.add('disabled-effect');
    } else {
        if (ts.disabledEffects?.includes(uiUid)) li.classList.add('disabled-effect');
    }

    li.onclick = (e) => {
        e.stopPropagation();
        ensureCustomState();
        const ts = getTargetState();

        if (log.stack) {
            if (!ts.effectStacks) ts.effectStacks = {};
            const cur = ((ts.effectStacks[uid] !== undefined ? ts.effectStacks[uid] : 1) + 1) % (log.stack + 1);
            ts.effectStacks[uid] = cur;
        } else {
            if (!ts.disabledEffects) ts.disabledEffects = [];
            const idx = ts.disabledEffects.indexOf(uiUid);
            if (idx > -1) ts.disabledEffects.splice(idx, 1);
            else ts.disabledEffects.push(uiUid);
        }

        if (!state.selectedSeqId) propagateGlobalStateToCustom('effects');
        updateState();
    };
}

// ============================================================
// 사이클 버튼 컬러 업데이트
// ============================================================

/**
 * 정적 사이클 버튼(일반, 배틀, 연계, 궁극기)의 테두리 색상을 오퍼레이터 속성에 맞춰 업데이트한다.
 * @param {string} [opId] - 오퍼레이터 ID (생략 시 state.mainOp.id 사용)
 */
function updateStaticCycleButtonsElementColor(opId) {
    const targetId = opId || state?.mainOp?.id;
    if (!targetId) return;

    const opData = DATA_OPERATORS.find(o => o.id === targetId);
    if (!opData) return;

    document.querySelectorAll('.cycle-add-buttons .cycle-btn:not(.cycle-btn-enhanced)').forEach(btn => {
        const frame = btn.querySelector('.skill-icon-frame');
        if (frame) frame.style.borderColor = AppTooltip.getSkillElementColor(opData, btn.dataset.type);
    });
}
window.updateStaticCycleButtonsElementColor = updateStaticCycleButtonsElementColor;

// ============================================================
// 결과 렌더링 (메인)
// ============================================================

/**
 * 데미지 계산 결과를 DOM에 업데이트한다.
 * res가 null이면 최종 데미지를 0으로 표시한다.
 * @param {object|null} res - calculateDamage 반환값
 */
function renderResult(res) {
    if (typeof AppTooltip !== 'undefined' && AppTooltip.hide) AppTooltip.hide();
    if (!res) {
        const el = document.getElementById('final-damage');
        if (el) el.innerText = '0';
        return;
    }

    window.lastCalcResult = res;

    // 전역 사이클 합계 계산
    const cycleRes = typeof calculateCycleDamage === 'function' ? calculateCycleDamage(state, res) : null;

    // 개별 커스텀 항목이 선택된 경우 해당 결과를 displayRes로 사용
    let displayRes = res;
    if (state.selectedSeqId && cycleRes?.sequence) {
        const item = cycleRes.sequence.find(s => s.id === state.selectedSeqId);
        if (item?.cRes) displayRes = item.cRes;
    }

    // 통계 수치 매핑 (최종 데미지 박스는 항상 전역 기준값 res 사용)
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
        'stat-amp': displayRes.stats.amp.toFixed(1) + '%',
        'stat-vuln': displayRes.stats.vuln.toFixed(1) + '%',
        'stat-taken': displayRes.stats.takenDmg.toFixed(1) + '%',
        'stat-unbal': displayRes.stats.unbalanceDmg.toFixed(1) + '%',
        'stat-ult-recharge': (displayRes.stats.ultRecharge || 0).toFixed(1) + '%',
        'stat-ult-cost': Math.ceil(displayRes.stats.finalUltCost || 0),
        'stat-arts': displayRes.stats.originiumArts.toFixed(0),
        'stat-arts-bonus': '+' + displayRes.stats.originiumArts.toFixed(1) + '%',
        'stat-res': (displayRes.stats.resistance ?? 0).toFixed(0),
        'stat-res-mult': (((displayRes.stats.resMult ?? 1) - 1) * 100).toFixed(1) + '%',
        'stat-def-red': ((1 - (displayRes.stats.defMult ?? 1)) * 100).toFixed(1) + '%',
    };

    // 피해 배율 빨간색 표시 (저항 > 0 이면 적)
    document.getElementById('stat-res-mult')?.classList.toggle('text-red', (displayRes.stats.resistance ?? 0) > 0);

    for (const [id, val] of Object.entries(mapping)) {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    }

    // 로그 목록 업데이트
    const logMapping = {
        'list-atk': displayRes.logs.atk,
        'list-crit': displayRes.logs.crit,
        'list-amp': displayRes.logs.amp,
        'list-vuln': displayRes.logs.vuln,
        'list-taken': displayRes.logs.taken,
        'list-unbal': displayRes.logs.unbal,
        'list-ult-recharge': (displayRes.logs.ultRecharge || []).sort((a, b) => {
            if (a.tag === 'reduction' && b.tag !== 'reduction') return -1;
            if (a.tag !== 'reduction' && b.tag === 'reduction') return 1;
            return 0;
        }),
        'list-arts': displayRes.logs.arts,
        'list-res': displayRes.logs.res,
    };
    for (const [id, list] of Object.entries(logMapping)) renderLog(id, list);

    updateActiveSetUI();
    renderCycleDamage(cycleRes);         // 사이클 카드는 전역 결과
    renderDmgInc(displayRes, cycleRes);  // 이펙트 다이얼리스트는 개별 설정 결과

    if (typeof updateUIStateVisuals === 'function') updateUIStateVisuals();

    renderWeaponComparison(res, cycleRes);
}

// ============================================================
// 세트 배지
// ============================================================

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
    const badge = document.createElement('div');
    badge.className = 'active-set-badge';
    badge.innerHTML = `
        <span class="set-name">${set.name} <span class="viability ${isViable ? 'viable' : 'not-viable'}">${isViable ? '(발동가능)' : '(발동불가)'}</span></span>
        <span class="set-status">ACTIVE (3피스)</span>
        ${set.desc ? `<div class="set-desc">${set.desc}</div>` : ''}
    `;
    container.appendChild(badge);
}

// ============================================================
// 효과 로그 렌더링
// ============================================================

/**
 * 효과 로그 리스트를 ul 요소에 렌더링한다.
 * uid가 있는 항목은 클릭 시 비활성화(취소선) 토글이 가능하다.
 * @param {string} id   - ul 요소의 ID
 * @param {Array}  list - { txt, uid } 또는 문자열 배열
 */
function renderLog(id, list) {
    const ul = document.getElementById(id);
    if (!ul) return;
    ul.innerHTML = '';

    list.forEach(item => {
        const li = document.createElement('li');
        const txt = typeof item === 'string' ? item : item.txt;
        const uid = typeof item === 'string' ? null : item.uid;

        li.innerText = txt;

        if (typeof item === 'object') {
            if (item.unbalancedOff) li.classList.add('unbalanced-off');
            if (item._triggerFailed) li.classList.add('triggerFail-effect');
        }

        if (uid) {
            li.dataset.uid = uid;
            attachEffectToggle(li, item, uid, uid);
        }

        ul.appendChild(li);
    });
}

// ============================================================
// 사이클 데미지 렌더링
// ============================================================

/**
 * 사이클 계산 결과를 시퀀스 카드와 스킬별 통계 두 영역에 렌더링한다.
 * @param {{sequence: Array, perSkill: object, total: number}|null} cycleRes
 */
function renderCycleDamage(cycleRes) {
    window.lastCycleRes = cycleRes;
    renderCycleSequence(cycleRes);
    renderCyclePerSkill(cycleRes);
}

/**
 * 사이클 시퀀스 카드 목록을 렌더링한다.
 * 각 카드는 드래그&드롭, 클릭 선택/해제, 우클릭 삭제를 지원한다.
 * @param {object|null} cycleRes
 */
function renderCycleSequence(cycleRes) {
    const list = document.getElementById('cycle-sequence-display');
    if (list) list.innerHTML = '';
    if (!cycleRes || !list) return;

    const opData = DATA_OPERATORS.find(o => o.id === state.mainOp.id);

    (cycleRes.sequence || []).forEach((item, index) => {
        let type = Array.isArray(item.type) ? item.type[0] : item.type;
        const baseType = getBaseSkillType(type);

        const cardContainer = document.createElement('div');
        cardContainer.className = 'cycle-sequence-item';
        if (item.customState) cardContainer.classList.add('seq-is-custom');
        if (state.selectedSeqId === item.id) cardContainer.classList.add('seq-selected');
        cardContainer.draggable = true;
        cardContainer.dataset.index = index;

        // 강화 스킬 배경 이미지 레이어
        if (type.startsWith('강화') && opData?.name) {
            cardContainer.style.cssText += 'position:relative; overflow:hidden;';
            const bgLayer = document.createElement('div');
            bgLayer.style.cssText = `
                position:absolute; top:0; left:0; width:100%; height:100%;
                background-image:url('images/operators/${opData.name}.webp');
                background-size:cover; background-position:center;
                mask-image:linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%);
                -webkit-mask-image:linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%);
                pointer-events:none; z-index:0;
            `;
            cardContainer.appendChild(bgLayer);
        }

        // 아이콘 래퍼
        const iconWrapper = document.createElement('div');
        iconWrapper.className = `seq-icon seq-icon-${SKILL_CLASS_MAP[baseType] || 'normal'}`;
        iconWrapper.style.cssText = 'position:relative; z-index:1;';
        iconWrapper.innerHTML = `
            <div class="skill-icon-frame" style="border-color:${AppTooltip.getSkillElementColor(opData, type)}">
                <img src="${SKILL_IMG_MAP[baseType] || SKILL_IMG_MAP['일반 공격']}" alt="${baseType}">
            </div>
        `;

        // 삭제 버튼
        const delBtn = document.createElement('button');
        delBtn.className = 'seq-delete-btn';
        delBtn.innerHTML = '&times;';
        delBtn.style.cssText = 'position:relative; z-index:1;';
        delBtn.onclick = (e) => { e.stopPropagation(); removeCycleItem(index); };

        // 이벤트 핸들러
        cardContainer.onclick = () => {
            state.selectedSeqId = (state.selectedSeqId === item.id) ? null : item.id;
            updateUIStateVisuals();
            updateState();
        };
        cardContainer.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); removeCycleItem(index); AppTooltip.hide(); };

        cardContainer.onmouseenter = (e) => {
            const displayDmg = item.indivDmg !== undefined ? item.indivDmg : (item.dmg || 0);
            let rateHtml = '';

            if (item.rawRate !== undefined) {
                rateHtml = `${((item.baseRate ?? item.rawRate) * 100).toFixed(0)}%`;

                (item.bonusList || []).forEach(b => {
                    rateHtml += ` + ${b.name}${b.stack ? ` ${b.stack}스택` : ''} ${(b.val * 100).toFixed(0)}%`;
                });

                (item.abnormalList || []).forEach(a => {
                    let suffix = '';
                    if (state.mainOp.id === 'Da Pan' && a.name === '강타') {
                        suffix = ' <span style="color:var(--accent); font-size:0.9em;">[판 특성] * 120%</span>';
                    }
                    const nameHtml = AppTooltip?.colorizeText ? AppTooltip.colorizeText(a.name) : a.name;
                    rateHtml += ` + ${nameHtml} ${(a.mult * 100).toFixed(0)}%${suffix}`;
                });
            } else {
                rateHtml = item.dmgRate || '0%';
            }

            const activeEffects = item.activeEffects || window.lastCalcResult?.activeEffects || [];
            const content = AppTooltip.renderSequenceTooltip(type, displayDmg, rateHtml, activeEffects, makeCustomTargetState(item.customState), opData);
            AppTooltip.showCustom(content, e, { width: '260px' });
        };
        cardContainer.onmouseleave = () => AppTooltip.hide();

        ['dragstart', 'dragover', 'drop', 'dragenter', 'dragleave', 'dragend'].forEach(ev => {
            cardContainer.addEventListener(ev, window[`handle${ev.charAt(0).toUpperCase() + ev.slice(1)}`]);
        });

        cardContainer.appendChild(iconWrapper);
        cardContainer.appendChild(delBtn);
        list.appendChild(cardContainer);

        // 마지막 요소가 아니면 화살표 추가
        if (index < (cycleRes.sequence || []).length - 1) {
            const arrow = document.createElement('div');
            arrow.className = 'seq-arrow';
            arrow.innerHTML = '&#10140;';
            list.appendChild(arrow);
        }
    });
}

window.isCycleSortEnabled = false;

/**
 * 스킬별 데미지 통계 목록을 렌더링한다.
 * FLIP 애니메이션을 적용하며, DOM 노드를 재사용하여 불필요한 재생성을 최소화한다.
 * @param {object|null} cycleRes
 */
function renderCyclePerSkill(cycleRes) {
    const list = document.getElementById('cycle-dmg-list');
    const totalEl = document.getElementById('cycle-dmg-total');

    if (totalEl) totalEl.innerText = cycleRes ? Math.floor(cycleRes.total).toLocaleString() : '0';
    if (!cycleRes || !list) return;

    // FLIP First: 현재 위치 저장 및 기존 노드 매핑
    const firstPositions = new Map();
    const existingNodes = new Map();
    Array.from(list.children).forEach(child => {
        const key = child.getAttribute('data-item-key');
        if (key) {
            firstPositions.set(key, child.getBoundingClientRect());
            existingNodes.set(key, child);
        }
    });

    // 데이터 통합 및 정렬
    let allItems = [
        ...Object.keys(cycleRes.perSkill || {}).map(key => ({ type: 'skill', key, data: cycleRes.perSkill[key] })),
        ...Object.keys(cycleRes.perAbnormal || {}).map(key => ({ type: 'abnormal', key, data: cycleRes.perAbnormal[key] })),
    ];

    if (window.isCycleSortEnabled) {
        allItems.sort((a, b) => (b.data.dmg || 0) - (a.data.dmg || 0));
    } else {
        const skills = allItems.filter(i => i.type === 'skill');
        const abnormals = allItems.filter(i => i.type === 'abnormal').sort((a, b) => {
            const isProc = k => k.startsWith('무기') || k.startsWith('재능') || k.startsWith('잠재');
            if (isProc(a.key) && !isProc(b.key)) return 1;
            if (!isProc(a.key) && isProc(b.key)) return -1;
            return 0;
        });
        allItems = [...skills, ...abnormals];
    }

    const totalValue = cycleRes.total || 0;

    allItems.forEach(item => {
        const { key: name, data } = item;
        const dmgVal = data.dmg || 0;
        const count = data.count || 0;
        const share = totalValue > 0 ? (dmgVal / totalValue * 100) : 0;
        const isAbnormal = item.type === 'abnormal';

        let row = existingNodes.get(name);
        const isNew = !row;

        if (isNew) {
            row = document.createElement('div');
            row.className = 'cycle-dmg-row';
            row.setAttribute('data-item-key', name);
            row.style.cssText = 'display:flex; align-items:center; gap:8px; opacity:0;';
        } else {
            row.style.transition = '';
            row.style.transform = '';
            row.style.opacity = isAbnormal ? '0.9' : '1';
            existingNodes.delete(name);
        }

        row.classList.toggle('abnormal-row', isAbnormal);
        row.innerHTML = '';

        // 횟수 뱃지
        const countDiv = document.createElement('div');
        countDiv.className = 'skill-count-badge';
        countDiv.innerText = `${count}회`;
        countDiv.style.cssText = 'min-width:40px; text-align:center; color:var(--text-secondary); font-size:0.8rem; background:rgba(255,255,255,0.05); padding:4px; border-radius:4px;';

        // 스킬 카드
        const card = document.createElement('div');
        card.className = 'skill-card';
        card.style.flex = '1';

        const bar = document.createElement('div');
        bar.className = 'skill-dmg-bar';
        bar.style.width = `${share.toFixed(1)}%`;

        const header = document.createElement('div');
        header.className = 'skill-card-header';
        header.innerHTML = `<span class="skill-name">${name}</span><span class="skill-dmg">${dmgVal.toLocaleString()}</span>`;

        header.onmouseenter = (e) => {
            if (item.type === 'skill') {
                const opData = DATA_OPERATORS.find(o => o.id === state.mainOp.id);
                const skillDef = opData?.skill?.find(s => s?.skillType?.includes(name));
                const targetSt = makeCustomTargetState(data.customState);
                const activeEffects = window.lastCalcResult?.activeEffects || [];

                const content = skillDef
                    ? AppTooltip.renderSkillTooltip(name, skillDef, opData, '', activeEffects, targetSt)
                    : `<div class="tooltip-title">${name}</div><div class="tooltip-desc">${data.desc || '설명 없음'}</div>`;
                AppTooltip.showCustom(content, e, { width: '260px' });
            } else {
                const isProc = name.startsWith('재능') || name.startsWith('잠재') || name.startsWith('무기');
                if (!isProc) {
                    const artsStrength = window.lastCalcResult?.stats?.originiumArts || 0;
                    AppTooltip.showCustom(AppTooltip.renderAbnormalTooltip(name, artsStrength, state), e, { width: '260px' });
                }
            }
        };
        header.onmouseleave = () => AppTooltip.hide();

        card.appendChild(bar);
        card.appendChild(header);

        // 지분율
        const shareDiv = document.createElement('div');
        shareDiv.className = 'skill-dmg-share';
        shareDiv.innerText = share.toFixed(1) + '%';

        row.appendChild(countDiv);
        row.appendChild(card);
        row.appendChild(shareDiv);
        list.appendChild(row);
    });

    // 사라진 항목 제거
    existingNodes.forEach(node => node.remove());

    // FLIP 애니메이션
    applyFlipAnimation(
        list,
        firstPositions,
        child => child.getAttribute('data-item-key'),
        child => child.classList.contains('abnormal-row') ? '0.9' : '1'
    );
}

/**
 * 사이클 정렬 버튼을 초기화한다.
 * 버튼 클릭 시 isCycleSortEnabled를 토글하고 스킬별 통계를 재렌더링한다.
 */
function initCycleSortButton() {
    const btn = document.getElementById('btn-sort-cycle');
    if (!btn) return;
    btn.onclick = () => {
        window.isCycleSortEnabled = !window.isCycleSortEnabled;
        btn.classList.toggle('active', window.isCycleSortEnabled);
        if (window.lastCycleRes) renderCyclePerSkill(window.lastCycleRes);
    };
}

// ============================================================
// 무기 비교 렌더링
// ============================================================

/**
 * 현재 오퍼레이터가 사용할 수 있는 모든 무기의 데미지를 비교 렌더링한다.
 * 사이클 데미지 합계를 우선으로 비교하며, 합계가 0이면 최종 1회 데미지를 기준으로 한다.
 * @param {object}      currentRes   - 현재 무기로 계산된 calculateDamage 결과
 * @param {object|null} currentCycle - 현재 무기로 계산된 calculateCycleDamage 결과
 */
function renderWeaponComparison(currentRes, currentCycle) {
    const box = document.getElementById('weapon-comparison');
    if (!box || !state.mainOp.id || !currentRes) return;

    const currentOp = DATA_OPERATORS.find(o => o.id === state.mainOp.id);
    if (!currentOp) return;

    const currentTotal = (currentCycle?.total > 0) ? currentCycle.total : currentRes.finalDmg;

    // FLIP First: 현재 위치 저장
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
            // state를 깊은 복사하여 현재 옵션(저항/디버프/비활성효과)은 유지하면서 무기만 교체
            const tempState = JSON.parse(JSON.stringify(state));

            // 비교 대상 무기의 특성은 강제 활성화 (disabledEffects에서 해당 무기 접두사 제거)
            tempState.disabledEffects = (tempState.disabledEffects || [])
                .filter(uid => !uid.startsWith(`${w.name}_trait`));

            tempState.mainOp.wepId = w.id;
            tempState.mainOp.wepPot = compPot;
            tempState.mainOp.wepState = compState;

            const res = calculateDamage(tempState, true);
            if (!res) return null;

            const cRes = typeof calculateCycleDamage === 'function' ? calculateCycleDamage(tempState, res, true) : null;
            const compTotal = (cRes?.total > 0) ? cRes.total : res.finalDmg;
            const pct = currentTotal > 0 ? ((compTotal - currentTotal) / currentTotal * 100).toFixed(1) : 0;
            return { name: w.name, finalDmg: compTotal, pct: Number(pct) };
        })
        .filter(Boolean)
        .sort((a, b) => b.finalDmg - a.finalDmg);

    // 바 너비 기준: 목록 최고값 (단, 최고값이 현재 무기보다 낮으면 currentTotal 기준)
    const maxDmg = (comparisons.length > 0 && comparisons[0].pct >= 0) ? comparisons[0].finalDmg : currentTotal;

    box.innerHTML = '';
    comparisons.forEach(item => {
        const ratio = maxDmg > 0 ? Math.max(0, Math.min(1, item.finalDmg / maxDmg)) : 0;
        const sign = item.pct > 0 ? '+' : '';
        const cls = item.pct > 0 ? 'positive' : item.pct === 0 ? 'current' : 'negative';

        const div = document.createElement('div');
        div.className = `comp-item ${cls}`;
        div.setAttribute('data-weapon-name', item.name);
        div.innerHTML = `
            <div class="comp-info">
                <span class="comp-name">${item.name}</span>
                <span class="comp-dmg">${Math.floor(item.finalDmg).toLocaleString()}</span>
                <span class="comp-pct">${sign}${item.pct}%</span>
            </div>
            <div class="comp-bar-bg"><div class="comp-bar" style="width:${(ratio * 100).toFixed(1)}%"></div></div>
        `;
        box.appendChild(div);
    });

    // FLIP 애니메이션
    applyFlipAnimation(
        box,
        firstPositions,
        child => child.getAttribute('data-weapon-name')
    );
}

// ============================================================
// 주는 피해 세부 렌더링
// ============================================================

/**
 * 주는 피해 세부 정보를 5개 카테고리(공통/일반/배틀/연계/궁극기)로 나누어 렌더링한다.
 * @param {object}      res      - calculateDamage 결과
 * @param {object|null} cycleRes - calculateCycleDamage 결과 (지분율 계산용)
 */
function renderDmgInc(res, cycleRes) {
    const statsContainer = document.getElementById('dmg-inc-stats-container');
    const listContainer = document.getElementById('dmg-inc-list-container');
    const totalEl = document.getElementById('dmg-inc-value');

    if (totalEl) totalEl.innerText = (res.stats.dmgInc || 0).toFixed(1) + '%';
    if (!statsContainer || !listContainer) return;

    statsContainer.innerHTML = '';
    listContainer.innerHTML = '';

    const opData = DATA_OPERATORS.find(o => o.id === state.mainOp.id);
    const opElement = opData ? (opData.type === 'phys' ? 'phys' : opData.element) : null;

    const categories = [
        { id: 'common', title: '공통', filter: t => t === 'all' },
        { id: 'normal', title: '일반 공격', type: '일반 공격' },
        { id: 'battle', title: '배틀 스킬', type: '배틀 스킬' },
        { id: 'combo', title: '연계 스킬', type: '연계 스킬' },
        { id: 'ult', title: '궁극기', type: '궁극기' },
    ];

    const catLogs = { common: [], normal: [], battle: [], combo: [], ult: [] };
    const catSums = { common: 0, normal: 0, battle: 0, combo: 0, ult: 0 };

    // ---- 로그 분류 ----
    (res.logs.dmgInc || []).forEach(log => {
        const isMult = log.tag === 'skillMult' || log.txt.includes('*');
        let val = 0;
        if (!isMult) {
            if (log.val !== undefined) {
                val = log.val;
            } else {
                const m = log.txt.match(/([+-]?\s*\d+(\.\d+)?)\s*%/);
                if (m) val = parseFloat(m[1].replace(/\s/g, ''));
            }
        }

        const targetState = getTargetState();

        /** 로그를 특정 카테고리에 추가하고 비활성 여부에 따라 catSums를 갱신한다. */
        const pushLog = (catKey) => {
            const uiLog = { ...log, _uiUid: `${log.uid}#${catKey}` };
            const disabled = targetState.disabledEffects?.includes(uiLog._uiUid) || !!uiLog._triggerFailed;
            catLogs[catKey].push(uiLog);
            if (!disabled) catSums[catKey] += val;
        };

        if (log.tag === 'all' || log.tag === opElement) {
            if (log.txt.includes('스킬')) {
                ['battle', 'combo', 'ult'].forEach(k => {
                    pushLog(k);
                    // 공통 태그인 경우 텍스트에 (공통) 접두사 추가
                    if (log.tag !== opElement) {
                        catLogs[k][catLogs[k].length - 1].txt = `(공통) ${log.txt}`;
                    }
                });
            } else {
                pushLog('common');
            }
        } else if (log.tag === 'normal') {
            pushLog('normal');
        } else if (log.tag === 'skill' || log.tag === 'skillMult') {
            const skillTypes = Array.isArray(log.skillType) ? log.skillType : (log.skillType ? [log.skillType] : []);
            if (skillTypes.length > 0) {
                skillTypes.forEach(stName => {
                    const key = categories.find(c => c.type === stName)?.id;
                    if (key) pushLog(key);
                });
            } else {
                ['battle', 'combo', 'ult'].forEach(k => pushLog(k));
            }
        } else {
            const key = Object.keys(catLogs).find(k => k === log.tag);
            if (key) {
                pushLog(key);
            } else {
                // 오퍼레이터 속성과 맞지 않아 적용되지 않는 버프 → common에만 표시, sum 제외
                catLogs.common.push({ ...log, _uiUid: `${log.uid}#inactive`, _inactiveElement: true });
            }
        }
    });

    // ---- 카테고리별 렌더링 ----
    categories.forEach(cat => {
        // 상단 통계 아이템
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
            statItem.innerHTML = `<label>${cat.title}</label><span>${catSums[cat.id].toFixed(1)}%</span>`;
        }
        statsContainer.appendChild(statItem);

        // 하단 리스트 컬럼
        const col = document.createElement('div');
        col.className = 'dmg-inc-column';

        const ul = document.createElement('ul');
        ul.className = 'detail-list';

        const sortedLogs = [...catLogs[cat.id]].sort((a, b) => {
            if (a.txt.includes('모든 스킬 피해') && !b.txt.includes('모든 스킬 피해')) return -1;
            if (!a.txt.includes('모든 스킬 피해') && b.txt.includes('모든 스킬 피해')) return 1;
            if (a.tag === 'skillMult' && b.tag !== 'skillMult') return 1;
            if (a.tag !== 'skillMult' && b.tag === 'skillMult') return -1;
            return 0;
        });

        sortedLogs.forEach(log => {
            const li = document.createElement('li');
            const uid = log.uid;
            const uiUid = log._uiUid || uid;
            li.innerText = log.txt;
            if (uid) li.dataset.uid = uiUid;

            if (log._inactiveElement) {
                // 속성 불일치 버프: 취소선 표시, 클릭 불가
                li.classList.add('disabled-effect');
                li.title = '오퍼레이터 속성과 일치하지 않아 적용되지 않습니다.';
                li.style.cursor = 'default';
                li.onclick = (e) => e.stopPropagation();
            } else if (uid) {
                attachEffectToggle(li, log, uid, uiUid);
            }

            if (log._triggerFailed) li.classList.add('triggerFail-effect');
            ul.appendChild(li);
        });

        col.appendChild(ul);
        listContainer.appendChild(col);
    });
}

// ============================================================
// 강화 스킬 버튼 동적 생성
// ============================================================

/**
 * 메인 오퍼레이터 변경 시 '강화' 스킬 버튼을 동적으로 생성·삽입한다.
 * 기존에 추가된 강화 버튼은 먼저 제거하고 새로 생성한다.
 * @param {string} opId - 오퍼레이터 ID
 */
function updateEnhancedSkillButtons(opId) {
    const btnContainer = document.querySelector('.cycle-add-buttons');
    if (!btnContainer) return;

    btnContainer.querySelectorAll('.cycle-btn-enhanced').forEach(btn => btn.remove());
    if (!opId) return;

    const opData = DATA_OPERATORS.find(o => o.id === opId);
    if (!opData?.skill) return;

    opData.skill
        .filter(s => s.skillType?.some(st => st.startsWith('강화 ')))
        .forEach(es => {
            const skillName = es.skillType[0];
            const color = AppTooltip.getSkillElementColor(opData, skillName);

            const btn = document.createElement('div');
            btn.className = 'cycle-btn cycle-btn-enhanced';
            btn.dataset.type = skillName;
            btn.title = skillName;
            btn.innerHTML = `
                <div class="skill-icon-frame" style="border-color:${color}">
                    <img src="images/operators/${opData.name}.webp" alt="${skillName}">
                </div>
                <span>${skillName}</span>
            `;

            btn.onclick = () => { if (typeof addCycleItem === 'function') addCycleItem(skillName); };
            btn.onmouseenter = (e) => {
                const activeEffects = window.lastCalcResult?.activeEffects || [];
                AppTooltip.showCustom(AppTooltip.renderSkillTooltip(skillName, es, opData, '', activeEffects), e, { width: '260px' });
            };
            btn.onmouseleave = () => AppTooltip.hide();

            btnContainer.appendChild(btn);
        });

    console.log(`[DEBUG] updateEnhancedSkillButtons(${opId}) created buttons.`);
}