/**
 * ui/init.js — UI 초기화 및 이벤트 바인딩
 *
 * [역할]
 * - DOMContentLoaded 진입점: UI 초기화 → 저장 상태 복원(또는 기본값) 순서로 실행한다.
 * - 오퍼레이터/무기 선택 UI, 서브 오퍼레이터 이벤트, 무기 목록 갱신,
 *   저장 상태 → UI 동기화(applyStateToUI)를 담당한다.
 *
 * [파일 간 의존 / 로딩 순서]
 * data_*.js → state.js → calc.js → ui/controls.js → ui/sidebar.js
 *   → ui/modal.js → ui/tooltip.js → ui/render.js → ui/init.js
 *
 * [내부 규칙]
 * - DOMContentLoaded에서 loadState()가 true를 반환하면 applyStateToUI()로 UI를 복원하고
 *   기본값 설정 블록은 건너뛴다.
 * - applyStateToUI()는 restore* 헬퍼 함수로 분리되어 있다.
 * - preloadAllImages()는 _preloadedImages 배열에 Image 객체를 저장하여
 *   GC로 인한 캐시 무효화를 방지한다.
 */

// ============================================================
// 모듈 상수
// ============================================================

/** 기본 장비 슬롯 → ID 설정 (저장값 없을 때 초기화용) */
const DEFAULT_GEAR_MAP = [
    { selectId: 'gear-gloves-select', val: 'gear_13' },
    { selectId: 'gear-armor-select', val: 'gear_16' },
    { selectId: 'gear-kit1-select', val: 'gear_11' },
    { selectId: 'gear-kit2-select', val: 'gear_12' },
];

const DEFAULT_OP_ID = 'Endministrator';
const DEFAULT_WEP_ID = 'Grand Vision';

// ============================================================
// 내부 유틸리티
// ============================================================

/**
 * 체크박스 값과 토글 버튼 상태를 동시에 설정한다.
 * `cb.checked = x; updateToggleButton(btn, x, label)` 패턴을 대체한다.
 * @param {string}  cbId    - checkbox 요소 ID
 * @param {string}  btnId   - 토글 버튼 요소 ID
 * @param {string}  label   - 버튼 레이블
 * @param {boolean} checked - 설정할 ON/OFF 값
 */
function applyToggle(cbId, btnId, label, checked) {
    const cb = document.getElementById(cbId);
    const btn = document.getElementById(btnId);
    if (cb) cb.checked = checked;
    if (btn) updateToggleButton(btn, checked, label);
}

/**
 * select 버튼의 텍스트를 엔티티 이름으로 갱신한다.
 * @param {string}      btnId       - 버튼 요소 ID
 * @param {object|null} entity      - name 필드를 가진 데이터 객체
 * @param {string}      defaultText - 엔티티가 없을 때 표시할 텍스트
 */
function setSelectBtnText(btnId, entity, defaultText = '== 선택 해제 ==') {
    const btn = document.getElementById(btnId);
    if (btn) btn.innerText = entity ? entity.name : defaultText;
}

/**
 * 서브 오퍼레이터의 무기 select / 버튼 / 이미지를 일괄 갱신한다.
 * restoreSubOps와 applyOpSettingsToUI(sub)에서 공통으로 사용한다.
 * @param {number}      i     - 서브 오퍼레이터 인덱스
 * @param {string|null} wepId - 무기 ID (없으면 빈 문자열)
 */
function setSubWepUI(i, wepId) {
    const wepSel = document.getElementById(`sub-${i}-wep`);
    if (!wepSel) return;
    const wepData = DATA_WEAPONS.find(w => w.id === wepId);
    wepSel.value = wepId || '';
    setSelectBtnText(`sub-${i}-wep-btn`, wepData);
    updateEntityImage(wepId, `sub-${i}-wep-image`, 'weapons');
}

// ============================================================
// 진입점
// ============================================================

/**
 * UI 초기화 진입점. DOM 구조가 준비되면 즉시 실행된다.
 */
document.addEventListener('DOMContentLoaded', function () {
    initUI();

    if (typeof loadState === 'function' && loadState()) {
        applyStateToUI();
    } else {
        _applyDefaultState();
    }

    // 첫 방문 시 가이드 모달 표시
    if (!localStorage.getItem('endfield_guide_seen')) {
        document.getElementById('guide-modal')?.classList.add('open');
        localStorage.setItem('endfield_guide_seen', 'true');
    }

    updateState();
});

/**
 * 모든 리소스 로드 완료 후 무거운 이미지 프리로딩을 시작한다.
 */
window.onload = function () { preloadAllImages(); };

/**
 * 저장된 상태가 없을 때 기본 오퍼레이터/무기/장비를 설정한다.
 */
function _applyDefaultState() {
    // 기본 오퍼레이터
    const mainOpSel = document.getElementById('main-op-select');
    const opData = DATA_OPERATORS.find(o => o.id === DEFAULT_OP_ID);
    if (mainOpSel && opData) {
        mainOpSel.value = DEFAULT_OP_ID;
        setSelectBtnText('main-op-select-btn', opData);
        updateMainWeaponList(DEFAULT_OP_ID);
        applyOpSettingsToUI(DEFAULT_OP_ID, 'main');
        updateEntityImage(DEFAULT_OP_ID, 'main-op-image', 'operators');
        updateEnhancedSkillButtons?.(DEFAULT_OP_ID);
        updateStaticCycleButtonsElementColor?.(DEFAULT_OP_ID);
    }

    // 기본 무기
    const wepSel = document.getElementById('main-wep-select');
    if (wepSel?.querySelector(`option[value="${DEFAULT_WEP_ID}"]`)) {
        wepSel.value = DEFAULT_WEP_ID;
        setSelectBtnText('main-wep-select-btn', DATA_WEAPONS.find(w => w.id === DEFAULT_WEP_ID));
        updateEntityImage(DEFAULT_WEP_ID, 'main-wep-image', 'weapons');
    }

    // 기본 장비
    DEFAULT_GEAR_MAP.forEach(({ selectId, val }) => {
        const el = document.getElementById(selectId);
        if (el) {
            el.value = val;
            updateEntityImage(val, selectId.replace('-select', '-image'), 'gears');
        }
    });
}

// ============================================================
// UI 초기화
// ============================================================

/**
 * 전체 UI를 초기화하고 이벤트 리스너를 등록한다.
 */
function initUI() {
    setupOperatorSelect('main-op-select', 'main-op-select-btn', (opId) => {
        updateMainWeaponList(opId);
        applyOpSettingsToUI(opId, 'main');
        updateEntityImage(opId, 'main-op-image', 'operators');
        updateStaticCycleButtonsElementColor?.(opId);
        updateState();
    });

    for (let i = 0; i < 3; i++) {
        setupSubOperatorEvents(i);
        updateEntityImage(null, `sub-${i}-image`, 'operators');
        updateEntityImage(null, `sub-${i}-wep-image`, 'weapons');
    }

    setupPotencyButtons('main-op-pot', 'main-op-pot-group');
    setupPotencyButtons('main-wep-pot', 'main-wep-pot-group');
    setupToggleButton('main-wep-state', 'main-wep-toggle', '기질');
    setupMainForgeToggle();
    setupGearForgeToggles();

    // 기어 사이드바 외부 클릭 닫기
    document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('gear-sidebar');
        if (sidebar?.classList.contains('open')
            && !sidebar.contains(e.target)
            && !e.target.closest('.gear-image-container')) {
            closeGearSidebar();
        }
    });

    // 불균형 토글
    const enemyCb = document.getElementById('enemy-unbalanced');
    const enemyBtn = document.getElementById('enemy-unbalanced-toggle');
    if (enemyCb && enemyBtn) {
        enemyCb.style.display = 'none';
        enemyBtn.onclick = () => {
            ensureCustomState();
            enemyCb.checked = !enemyCb.checked;
            updateToggleButton(enemyBtn, enemyCb.checked, '불균형');
            if (!state.selectedSeqId) propagateGlobalStateToCustom('unbalanced');
            updateState();
        };
        updateToggleButton(enemyBtn, enemyCb.checked, '불균형');
    }

    // 적 저항 버튼
    const resBtns = document.querySelectorAll('.res-btn');
    resBtns.forEach(btn => {
        btn.onclick = () => {
            resBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.enemyResistance = Number(btn.dataset.val);
            updateState();
        };
    });

    // 디버프 아이콘 우클릭
    document.querySelectorAll('.debuff-icon-wrap').forEach(el => {
        el.oncontextmenu = (e) => handleDebuffRightClick?.(el, e);
    });

    // 메인 무기 선택
    setupWeaponSelect('main-wep-select', 'main-wep-select-btn', () => state.mainOp.id);
    document.getElementById('main-wep-select')?.addEventListener('change', (e) => {
        const wepId = e.target.value;
        updateEntityImage(wepId, 'main-wep-image', 'weapons');
        applyWepSettingsToUI(wepId);
        updateState();
    });

    setupPotencyButtons('comp-wep-pot', 'comp-wep-pot-group');
    setupToggleButton('comp-wep-state', 'comp-wep-toggle', '기질');

    // 가이드 모달
    document.getElementById('nav-guide')?.addEventListener('click',
        () => document.getElementById('guide-modal')?.classList.add('open'));

    // 데미지 공식 툴팁
    const formulaBtn = document.getElementById('formula-info-btn');
    const formulaTooltip = document.getElementById('formula-tooltip');
    if (formulaBtn && formulaTooltip) {
        formulaBtn.onclick = (e) => { e.stopPropagation(); formulaTooltip.classList.toggle('open'); };
        document.addEventListener('click', () => formulaTooltip.classList.remove('open'));
    }

    // 스킬 사이클 버튼
    document.querySelectorAll('.cycle-btn').forEach(btn => {
        btn.onclick = () => { const type = btn.getAttribute('data-type'); if (type) addCycleItem(type); };
        btn.onmouseenter = (e) => {
            const type = btn.getAttribute('data-type');
            const opData = DATA_OPERATORS.find(o => o.id === state.mainOp.id);
            const skillDef = opData?.skill?.find(s => s?.skillType?.includes(type));
            if (skillDef) {
                const content = AppTooltip.renderSkillTooltip(type, skillDef, opData, '', window.lastCalcResult?.activeEffects || [], state);
                AppTooltip.showCustom(content, e, { width: '350px' });
            }
        };
        btn.onmouseleave = () => AppTooltip.hide();
    });

    window.updateSkillLevelButtonsUI?.();

    document.getElementById('clear-cycle-btn')?.addEventListener('click', clearCycleItems);

    initCycleSortButton?.();
    AppTooltip.init();
}

// ============================================================
// 서브 오퍼레이터 이벤트
// ============================================================

/**
 * 특정 서브 오퍼레이터 슬롯의 select/버튼/잠재/무기 이벤트를 초기화한다.
 * @param {number} i - 슬롯 인덱스 (0~2)
 */
function setupSubOperatorEvents(i) {
    const opSel = document.getElementById(`sub-${i}-op`);
    if (!opSel) return;
    opSel.add(new Option('-', ''));
    DATA_OPERATORS.forEach(op => opSel.add(new Option(op.name, op.id)));

    const wepSel = document.getElementById(`sub-${i}-wep`);
    if (wepSel) {
        wepSel.add(new Option('-', ''));
        wepSel.onchange = (e) => { updateEntityImage(e.target.value, `sub-${i}-wep-image`, 'weapons'); updateState(); };
        setupWeaponSelect(`sub-${i}-wep`, `sub-${i}-wep-btn`, () => document.getElementById(`sub-${i}-op`)?.value);
    }

    const setSel = document.getElementById(`sub-${i}-set`);
    if (setSel) {
        setSel.classList.add('visual-select-btn', 'btn-select');
        setSel.innerHTML = '<option value="">== 선택 해제 ==</option>';
        DATA_SETS.forEach(s => { if (s.id !== 'set_crisis') setSel.add(new Option(s.name, s.id)); });
        setSel.onchange = updateState;
    }

    setupOperatorSelect(`sub-${i}-op`, `sub-${i}-op-btn`, (opId) => {
        updateSubWeaponList(i, opId);
        applyOpSettingsToUI(opId, 'sub', i);
        updateEntityImage(opId, `sub-${i}-image`, 'operators');
        document.getElementById(`sub-${i}-summary`).innerText = DATA_OPERATORS.find(o => o.id === opId)?.name || '';
        updateState();
    });

    setupPotencyButtons(`sub-${i}-pot`, `sub-${i}-pot-group`);

    // X 버튼: 해당 슬롯 전체 초기화
    const potGroup = document.getElementById(`sub-${i}-pot-group`);
    if (potGroup?.parentNode) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'potency-btn';
        removeBtn.innerText = 'X';
        removeBtn.style.color = '#ff4d4d';
        removeBtn.title = '선택 해제';
        removeBtn.onclick = () => {
            document.getElementById(`sub-${i}-op`).value = '';
            setSelectBtnText(`sub-${i}-op-btn`, null);
            document.getElementById(`sub-${i}-summary`).innerText = '';
            document.getElementById(`sub-${i}-pot`).value = 0;
            setupPotencyButtons(`sub-${i}-pot`, `sub-${i}-pot-group`);
            updateEntityImage('', `sub-${i}-image`, 'operators');

            const wSel = document.getElementById(`sub-${i}-wep`);
            if (wSel) {
                wSel.innerHTML = '';
                wSel.add(new Option('-', ''));
                wSel.value = '';
                setSelectBtnText(`sub-${i}-wep-btn`, null);
                updateEntityImage('', `sub-${i}-wep-image`, 'weapons');
                document.getElementById(`sub-${i}-wep-pot`).value = 0;
                setupPotencyButtons(`sub-${i}-wep-pot`, `sub-${i}-wep-pot-group`);
            }

            const sSel = document.getElementById(`sub-${i}-set`);
            if (sSel) sSel.value = '';

            updateState();
        };
        potGroup.parentNode.appendChild(removeBtn);
    }

    setupPotencyButtons(`sub-${i}-wep-pot`, `sub-${i}-wep-pot-group`);
    setupToggleButton(`sub-${i}-wep-state`, `sub-${i}-wep-toggle`, '기질');
}

// ============================================================
// 선택 UI 설정
// ============================================================

/**
 * 오퍼레이터 select + 모달 버튼을 초기화한다.
 * @param {string}   selectId     - select 요소 ID
 * @param {string}   btnId        - 모달 오픈 버튼 ID
 * @param {Function} onChangeInfo - 선택 완료 후 콜백 (selectedId) => void
 */
function setupOperatorSelect(selectId, btnId, onChangeInfo) {
    const sel = document.getElementById(selectId);
    const btn = document.getElementById(btnId);
    if (!sel || !btn) return;

    if (sel.options.length === 0) renderSelect(selectId, DATA_OPERATORS);

    btn.onclick = () => {
        const currentSelectedIds = [state.mainOp.id, ...state.subOps.map(s => s.id)]
            .filter(id => id && id !== sel.value);
        openOperatorModal((selectedId) => {
            sel.value = selectedId;
            setSelectBtnText(btnId, DATA_OPERATORS.find(o => o.id === selectedId));
            onChangeInfo?.(selectedId);
        }, currentSelectedIds, selectId);
    };

    if (sel.value) setSelectBtnText(btnId, DATA_OPERATORS.find(o => o.id === sel.value));
}

/**
 * 무기 select + 모달 버튼을 초기화한다.
 * @param {string}   selectId   - select 요소 ID
 * @param {string}   btnId      - 모달 오픈 버튼 ID
 * @param {Function} getOpIdFunc - 현재 오퍼레이터 ID를 반환하는 함수
 */
function setupWeaponSelect(selectId, btnId, getOpIdFunc) {
    const sel = document.getElementById(selectId);
    const btn = document.getElementById(btnId);
    if (!sel || !btn) return;

    btn.onclick = () => {
        openWeaponModal((selectedId) => {
            sel.value = selectedId;
            setSelectBtnText(btnId, DATA_WEAPONS.find(w => w.id === selectedId));
            sel.dispatchEvent(new Event('change'));
            sel.onchange?.({ target: sel });
        }, getValidWeapons(getOpIdFunc()), sel.value);
    };

    if (sel.value) setSelectBtnText(btnId, DATA_WEAPONS.find(w => w.id === sel.value));
}

// ============================================================
// 무기 목록 갱신
// ============================================================

/**
 * 메인 무기 select 목록을 현재 오퍼레이터의 사용 가능 무기로 갱신한다.
 * 기존 선택값이 유효하면 유지하고, 아니면 목록 첫 번째 무기를 기본으로 선택한다.
 * @param {string} opId - 오퍼레이터 ID
 */
function updateMainWeaponList(opId) {
    const validWeps = getValidWeapons(opId);
    const wepSel = document.getElementById('main-wep-select');
    if (!wepSel) return;

    const currentVal = wepSel.value;
    renderSelect('main-wep-select', validWeps);

    const stillValid = validWeps.find(w => w.id === currentVal);
    if (stillValid) {
        wepSel.value = currentVal;
        setSelectBtnText('main-wep-select-btn', stillValid);
    } else if (validWeps.length > 0) {
        wepSel.value = validWeps[0].id;
        setSelectBtnText('main-wep-select-btn', validWeps[0]);
        updateEntityImage(validWeps[0].id, 'main-wep-image', 'weapons');
        applyWepSettingsToUI(validWeps[0].id);
    } else {
        setSelectBtnText('main-wep-select-btn', null, '선택 불가');
        updateEntityImage(null, 'main-wep-image', 'weapons');
    }
}

/**
 * 서브 오퍼레이터의 무기 select 목록을 갱신한다.
 * @param {number} idx  - 서브 오퍼레이터 인덱스
 * @param {string} opId - 오퍼레이터 ID
 */
function updateSubWeaponList(idx, opId) {
    const sel = document.getElementById(`sub-${idx}-wep`);
    if (!sel) return;

    const currentVal = sel.value;
    sel.innerHTML = '';
    sel.add(new Option('-', ''));

    const validWeps = getValidWeapons(opId);
    validWeps.forEach(w => sel.add(new Option(w.name, w.id)));

    const stillValid = validWeps.find(w => w.id === currentVal);
    sel.value = stillValid ? currentVal : '';
    setSelectBtnText(`sub-${idx}-wep-btn`, stillValid || null);
}

// ============================================================
// 상태 → UI 동기화
// ============================================================

/**
 * state 전체를 UI에 반영한다.
 * loadState() 성공 후 또는 reset 시 호출한다.
 */
function applyStateToUI() {
    if (!state.mainOp.id) return;
    restoreMainOperator();
    restoreMainWeapon();
    restoreGears();
    restoreSubOps();

    applyToggle('enemy-unbalanced', 'enemy-unbalanced-toggle', '불균형', state.enemyUnbalanced);

    const defEl = document.getElementById('enemy-defense');
    if (defEl) {
        if (defEl.tagName === 'INPUT') defEl.value = state.enemyDefense || 100;
        else defEl.innerText = state.enemyDefense || 100;
    }

    document.querySelectorAll('.res-btn').forEach(btn => {
        btn.classList.toggle('active', Number(btn.dataset.val) === (state.enemyResistance || 0));
    });

    applyDebuffStateToUI();
    applySkillCountsToUI();
    window.updateSkillLevelButtonsUI?.();
    updateState();
}

/**
 * 스킬 레벨 버튼 UI 동기화 및 렌더링
 */
window.updateSkillLevelButtonsUI = function () {
    document.querySelectorAll('.cycle-btn').forEach(btn => {
        let type = btn.dataset.type;
        if (!type) return;
        const opData = DATA_OPERATORS.find(o => o.id === (typeof state !== 'undefined' && state.mainOp ? state.mainOp.id : null));
        const skillDef = opData?.skill?.find(s => s?.skillType?.includes(type));
        let baseType = skillDef?.masterySource || (type.startsWith('강화 ') ? type.substring(3) : type);

        let container = btn.querySelector('.skill-level-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'skill-level-container';
            container.onclick = (e) => e.stopPropagation();

            ['M0', 'M1', 'M2', 'M3'].forEach(lvl => {
                const lvlBtn = document.createElement('button');
                lvlBtn.className = 'skill-lvl-btn';
                lvlBtn.dataset.level = lvl;
                lvlBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="mastery-svg">
                        <!-- M1: Left center -->
                        <polygon class="m1-on" points="5,50 17.5,28.4 42.5,28.4 55,50 42.5,71.6 17.5,71.6" />
                        <!-- M3: Top right -->
                        <polygon class="m3-on" points="45,29.1 57.5,7.5 82.5,7.5 95,29.1 82.5,50.7 57.5,50.7" />
                        <!-- M2: Bottom right -->
                        <polygon class="m2-on" points="45,70.9 57.5,49.3 82.5,49.3 95,70.9 82.5,92.5 57.5,92.5" />
                    </svg>
                `;
                lvlBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (!state.mainOp.skillLevels) {
                        state.mainOp.skillLevels = { '일반 공격': 'M3', '배틀 스킬': 'M3', '연계 스킬': 'M3', '궁극기': 'M3' };
                    }
                    state.mainOp.skillLevels[baseType] = lvl;

                    window.updateSkillLevelButtonsUI();
                    updateState();

                    // Refresh tooltip dynamically
                    btn.dispatchEvent(new MouseEvent('mouseenter', {
                        bubbles: false, cancelable: true, clientX: e.clientX, clientY: e.clientY
                    }));
                };

                lvlBtn.onmouseenter = (e) => {
                    e.stopPropagation();
                    const opData = DATA_OPERATORS.find(o => o.id === state.mainOp.id);
                    const skillDef = opData?.skill?.find(s => s?.skillType?.includes(type));
                    if (skillDef) {
                        const tooltipWidth = '350px';
                        const content = AppTooltip.renderSkillTooltip(type, skillDef, opData, '', window.lastCalcResult?.activeEffects || [], state, lvl);
                        AppTooltip.showCustom(content, e, { width: tooltipWidth });
                    }
                };

                lvlBtn.onmouseleave = (e) => {
                    e.stopPropagation();
                    btn.dispatchEvent(new MouseEvent('mouseenter', {
                        bubbles: false, cancelable: true, clientX: e.clientX, clientY: e.clientY
                    }));
                };
                container.appendChild(lvlBtn);
            });
            btn.appendChild(container);
        }

        // update active state
        let currentLevel = 'M3';
        if (state.mainOp && state.mainOp.skillLevels && state.mainOp.skillLevels[baseType]) {
            currentLevel = state.mainOp.skillLevels[baseType];
        }

        container.querySelectorAll('.skill-lvl-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.level === currentLevel);
        });
    });
};

/**
 * 메인 오퍼레이터 관련 UI를 state에서 복원한다.
 */
function restoreMainOperator() {
    document.getElementById('main-op-select').value = state.mainOp.id;
    document.getElementById('main-op-pot').value = state.mainOp.pot;
    setupPotencyButtons('main-op-pot', 'main-op-pot-group');

    const opData = DATA_OPERATORS.find(o => o.id === state.mainOp.id);
    if (opData) {
        setSelectBtnText('main-op-select-btn', opData);
        updateMainWeaponList(state.mainOp.id);
        updateEntityImage(state.mainOp.id, 'main-op-image', 'operators');
        updateEnhancedSkillButtons?.(state.mainOp.id);
        updateStaticCycleButtonsElementColor?.(state.mainOp.id);
    }
}

/**
 * 메인 무기 관련 UI를 state에서 복원한다.
 */
function restoreMainWeapon() {
    const wepSel = document.getElementById('main-wep-select');
    const wepData = DATA_WEAPONS.find(w => w.id === state.mainOp.wepId);
    if (wepSel) {
        wepSel.value = state.mainOp.wepId || '';
        setSelectBtnText('main-wep-select-btn', wepData);
        updateEntityImage(state.mainOp.wepId, 'main-wep-image', 'weapons');
    }
    document.getElementById('main-wep-pot').value = state.mainOp.wepPot;
    setupPotencyButtons('main-wep-pot', 'main-wep-pot-group');
    applyToggle('main-wep-state', 'main-wep-toggle', '기질', state.mainOp.wepState);
}

/**
 * 장비 슬롯 관련 UI를 state에서 복원한다.
 */
function restoreGears() {
    applyToggle('main-gear-forge', 'main-forge-toggle', '전체 단조', state.mainOp.gearForge);

    GEAR_SELECT_IDS.forEach((id, idx) => {
        const el = document.getElementById(id);
        if (el) {
            el.value = state.mainOp.gears[idx] || '';
            updateEntityImage(el.value, id.replace('-select', '-image'), 'gears');
        }
    });

    GEAR_FORGE_IDS.forEach((id, idx) => {
        const el = document.getElementById(id);
        if (el) {
            el.checked = state.mainOp.gearForged[idx];
            updateToggleButton(document.getElementById(id + '-toggle'), el.checked, '단조');
            syncForgedToTooltip(id, el.checked);
        }
    });
}

/**
 * 서브 오퍼레이터 3명의 UI를 state에서 복원한다.
 */
function restoreSubOps() {
    for (let i = 0; i < 3; i++) {
        const s = state.subOps[i];

        document.getElementById(`sub-${i}-pot`).value = s.pot;
        setupPotencyButtons(`sub-${i}-pot`, `sub-${i}-pot-group`);

        const opSel = document.getElementById(`sub-${i}-op`);
        const opData = DATA_OPERATORS.find(o => o.id === s.id);
        if (opSel) {
            opSel.value = s.id || '';
            setSelectBtnText(`sub-${i}-op-btn`, opData);
            document.getElementById(`sub-${i}-summary`).innerText = opData?.name || '';
            updateSubWeaponList(i, s.id);
            updateEntityImage(s.id, `sub-${i}-image`, 'operators');
        }

        setSubWepUI(i, s.wepId);

        document.getElementById(`sub-${i}-wep-pot`).value = s.wepPot;
        setupPotencyButtons(`sub-${i}-wep-pot`, `sub-${i}-wep-pot-group`);
        applyToggle(`sub-${i}-wep-state`, `sub-${i}-wep-toggle`, '기질', s.wepState);

        const setSel = document.getElementById(`sub-${i}-set`);
        if (setSel) setSel.value = s.equipSet || '';

        const content = document.getElementById(`sub-op-content-${i}`);
        if (content && state.subOpsCollapsed) {
            content.classList.toggle('collapsed', state.subOpsCollapsed[i]);
        }
    }
}

// ============================================================
// 오퍼레이터 / 무기 설정 동기화
// ============================================================

/**
 * 오퍼레이터 선택 시 저장된 설정(잠재, 무기, 장비, 스킬시퀀스 등)을 UI에 반영한다.
 * @param {string}        opId   - 오퍼레이터 ID
 * @param {'main'|'sub'}  type   - 메인/서브 구분
 * @param {number}        [subIdx] - 서브 인덱스 (0~2)
 */
function applyOpSettingsToUI(opId, type, subIdx) {
    const s = loadOpSettings(opId);

    if (type === 'main') {
        document.getElementById('main-op-pot').value = s?.pot || 0;
        setupPotencyButtons('main-op-pot', 'main-op-pot-group');

        // 무기: 저장값이 유효하면 적용, 아니면 현재 목록 기본값 유지
        const wepSel = document.getElementById('main-wep-select');
        const savedWepId = s?.wepId;
        if (savedWepId && wepSel?.querySelector(`option[value="${savedWepId}"]`)) {
            wepSel.value = savedWepId;
            setSelectBtnText('main-wep-select-btn', DATA_WEAPONS.find(w => w.id === savedWepId));
            updateEntityImage(savedWepId, 'main-wep-image', 'weapons');
            applyWepSettingsToUI(savedWepId);
        } else {
            applyWepSettingsToUI(wepSel?.value);
        }

        // 장비 슬롯
        GEAR_SELECT_IDS.forEach((id, idx) => {
            const val = s?.gears?.[idx] ?? null;
            const el = document.getElementById(id);
            if (el) { el.value = val || ''; updateEntityImage(val || '', id.replace('-select', '-image'), 'gears'); }
        });

        // 장비 단조
        GEAR_FORGE_IDS.forEach((id, idx) => {
            const checked = s?.gearForged?.[idx] ?? false;
            const el = document.getElementById(id);
            if (el) {
                el.checked = checked;
                updateToggleButton(document.getElementById(id + '-toggle'), checked, '단조');
                syncForgedToTooltip(id, checked);
            }
        });

        // 메인 단조 일괄 토글 동기화
        const allOn = GEAR_FORGE_IDS.every(id => document.getElementById(id)?.checked);
        applyToggle('main-gear-forge', 'main-forge-toggle', '전체 단조', allOn);

        // 스킬 시퀀스 복원 (없으면 기본 4종 세팅)
        state.skillSequence = s?.skillSequence
            ? s.skillSequence.map((item, idx) =>
                typeof item === 'string'
                    ? { id: `seq_mig_op_${Date.now()}_${idx}`, type: item, customState: null }
                    : item)
            : ['일반 공격', '배틀 스킬', '연계 스킬', '궁극기'].map((type, idx) =>
                ({ id: `seq_def_${Date.now()}_${idx}`, type, customState: null }));

        if (s?.skillLevels) {
            state.mainOp.skillLevels = { ...s.skillLevels };
        } else {
            state.mainOp.skillLevels = { '일반 공격': 'M3', '배틀 스킬': 'M3', '연계 스킬': 'M3', '궁극기': 'M3' };
        }

        state.mainOp.specialStack = s?.specialStack ? { ...s.specialStack } : {};
        state.selectedSeqId = null;

        updateUIStateVisuals?.();
        updateEnhancedSkillButtons?.(opId);
        window.updateSkillLevelButtonsUI?.();

    } else {
        document.getElementById(`sub-${subIdx}-pot`).value = s?.pot || 0;
        setupPotencyButtons(`sub-${subIdx}-pot`, `sub-${subIdx}-pot-group`);

        const wepSel = document.getElementById(`sub-${subIdx}-wep`);
        const wepId = s?.wepId;
        if (wepSel?.querySelector(`option[value="${wepId}"]`)) {
            setSubWepUI(subIdx, wepId);
        } else {
            setSubWepUI(subIdx, '');
        }

        document.getElementById(`sub-${subIdx}-wep-pot`).value = s?.wepPot || 0;
        setupPotencyButtons(`sub-${subIdx}-wep-pot`, `sub-${subIdx}-wep-pot-group`);
        applyToggle(`sub-${subIdx}-wep-state`, `sub-${subIdx}-wep-toggle`, '기질', s?.wepState || false);

        if (s?.skillLevels) {
            state.subOps[subIdx].skillLevels = { ...s.skillLevels };
        } else {
            state.subOps[subIdx].skillLevels = { '일반 공격': 'M3', '배틀 스킬': 'M3', '연계 스킬': 'M3', '궁극기': 'M3' };
        }

        const setSel = document.getElementById(`sub-${subIdx}-set`);
        if (setSel) setSel.value = s?.equipSet || '';
    }
}

/**
 * 무기 선택 시 해당 무기의 저장된 설정(잠재, 기질)을 메인 무기 UI에 반영한다.
 * @param {string} wepId - 무기 ID
 */
function applyWepSettingsToUI(wepId) {
    if (!wepId) return;
    const s = typeof loadWepSettings === 'function' ? loadWepSettings(wepId) : null;

    document.getElementById('main-wep-pot').value = s?.pot ?? 0;
    setupPotencyButtons('main-wep-pot', 'main-wep-pot-group');
    applyToggle('main-wep-state', 'main-wep-toggle', '기질', s?.state ?? false);
}

// ============================================================
// 이미지 프리로딩
// ============================================================

window._preloadedImages = [];

/**
 * 현재 장착 중인 필수 이미지를 즉시 로드하고,
 * 나머지는 유휴 시간에 청크 단위로 지연 로드한다.
 */
function preloadAllImages() {
    const v = APP_VERSION;
    const categories = {
        operators: typeof DATA_OPERATORS !== 'undefined' ? DATA_OPERATORS : [],
        weapons: typeof DATA_WEAPONS !== 'undefined' ? DATA_WEAPONS : [],
        gears: typeof DATA_GEAR !== 'undefined' ? DATA_GEAR : [],
    };

    // 1. 필수 이미지 추출 (현재 장착 중)
    const essentialSpecs = [];
    const pushSpec = (folder, entity) => { if (entity) essentialSpecs.push({ folder, name: entity.name }); };

    pushSpec('operators', DATA_OPERATORS.find(o => o.id === state.mainOp.id));
    pushSpec('weapons', DATA_WEAPONS.find(w => w.id === state.mainOp.wepId));
    (state.mainOp.gears || []).forEach(gid => pushSpec('gears', DATA_GEAR.find(g => g.id === gid)));
    state.subOps.forEach(sub => {
        pushSpec('operators', DATA_OPERATORS.find(o => o.id === sub.id));
        pushSpec('weapons', DATA_WEAPONS.find(w => w.id === sub.wepId));
    });

    // 2. 필수 이미지 즉시 로드
    essentialSpecs.forEach(({ folder, name }) => {
        const img = new Image();
        img.src = `images/${folder}/${name}.webp?v=${v}`;
        window._preloadedImages.push(img);
    });

    // 3. 나머지는 청크 단위로 지연 로드 (초기 렌더링 부하 최소화)
    const remaining = [];
    Object.entries(categories).forEach(([folder, data]) => {
        data.forEach(item => {
            if (item.name && !essentialSpecs.some(s => s.name === item.name && s.folder === folder)) {
                remaining.push({ folder, name: item.name });
            }
        });
    });

    let idx = 0;
    function loadNextChunk() {
        if (idx >= remaining.length) return;
        remaining.slice(idx, idx += 15).forEach(({ folder, name }) => {
            const img = new Image();
            img.src = `images/${folder}/${name}.webp?v=${v}`;
            window._preloadedImages.push(img);
        });
        setTimeout(loadNextChunk, 50);
    }
    setTimeout(loadNextChunk, 300);
}