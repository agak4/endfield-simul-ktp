/**
 * ui/init.js — UI 초기화 및 이벤트 바인딩
 *
 * [역할]
 * - window.onload 진입점: 이미지 프리로딩 → UI 초기화 → 저장 상태 복원(또는 기본값) 순서로 실행한다.
 * - 오퍼레이터/무기 선택 UI, 서브 오퍼레이터 이벤트, 무기 목록 갱신,
 *   저장 상태 → UI 동기화(applyStateToUI)를 담당한다.
 * - 이미지 프리로딩으로 첫 선택 시 지연을 줄인다.
 *
 * [파일 간 의존 / 로딩 순서]
 * data_*.js → state.js → calc.js → ui/controls.js → ui/sidebar.js
 *   → ui/modal.js → ui/tooltip.js → ui/render.js → ui/init.js
 *
 * [내부 규칙]
 * - window.onload 내에서 loadState()가 true를 반환하면 applyStateToUI()로 UI를 복원하고
 *   기본값 설정 블록은 건너뛴다. 실행 흐름이 단락하는 지점이므로 return을 유지해야 한다.
 * - setupOperatorSelect / setupWeaponSelect는 btn.onclick을 덮어쓴다.
 *   초기화 후 onclick을 다시 할당하면 안 된다.
 * - applyStateToUI()는 restore* 헬퍼 함수로 분리되어 있다.
 *   각 헬퍼는 state의 특정 부분(메인 오퍼, 무기, 장비, 서브)만 담당한다.
 * - preloadAllImages()는 _preloadedImages 배열에 Image 객체를 저장한다.
 *   GC로 인한 캐시 무효화를 방지하기 위해 전역 배열에 유지한다.
 */

// ============ UI 초기화 및 이벤트 바인딩 ============

window.onload = function () {
    const DEFAULT_OP_ID = 'Endministrator';
    const DEFAULT_WEP_ID = 'Grand Vision';

    preloadAllImages();
    initUI();

    if (typeof loadState === 'function' && loadState()) {
        applyStateToUI();
        return;
    }

    // 기본 오퍼레이터
    const mainOpSelect = document.getElementById('main-op-select');
    if (mainOpSelect) {
        mainOpSelect.value = DEFAULT_OP_ID;
        const opData = DATA_OPERATORS.find(o => o.id === DEFAULT_OP_ID);
        if (opData) {
            document.getElementById('main-op-select-btn').innerText = opData.name;
            updateMainWeaponList(DEFAULT_OP_ID);
            updateEntityImage(DEFAULT_OP_ID, 'main-op-image', 'operators');
        }
    }

    // 기본 무기
    const wepSelect = document.getElementById('main-wep-select');
    if (wepSelect?.querySelector(`option[value="${DEFAULT_WEP_ID}"]`)) {
        wepSelect.value = DEFAULT_WEP_ID;
        const wepData = DATA_WEAPONS.find(w => w.id === DEFAULT_WEP_ID);
        if (wepData) document.getElementById('main-wep-select-btn').innerText = wepData.name;
        updateEntityImage(DEFAULT_WEP_ID, 'main-wep-image', 'weapons');
    }

    // 기본 장비
    const defaultGears = [
        { selectId: 'gear-gloves-select', val: 'gear_13' },
        { selectId: 'gear-armor-select', val: 'gear_16' },
        { selectId: 'gear-kit1-select', val: 'gear_11' },
        { selectId: 'gear-kit2-select', val: 'gear_12' }
    ];
    defaultGears.forEach(({ selectId, val }) => {
        const el = document.getElementById(selectId);
        if (el) {
            el.value = val;
            updateEntityImage(val, selectId.replace('-select', '-image'), 'gears');
        }
    });

    // 첫 방문 시 가이드 오픈
    if (!localStorage.getItem('endfield_guide_seen')) {
        document.getElementById('guide-modal')?.classList.add('open');
        localStorage.setItem('endfield_guide_seen', 'true');
    }

    updateState();
};

function initUI() {
    setupOperatorSelect('main-op-select', 'main-op-select-btn', (opId) => {
        updateMainWeaponList(opId);
        updateEntityImage(opId, 'main-op-image', 'operators');
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
            enemyCb.checked = !enemyCb.checked;
            updateToggleButton(enemyBtn, enemyCb.checked, '불균형');
            updateState();
        };
        updateToggleButton(enemyBtn, enemyCb.checked, '불균형');
    }

    // 메인 무기 선택
    setupWeaponSelect('main-wep-select', 'main-wep-select-btn', () => state.mainOp.id);
    const mainWepSelect = document.getElementById('main-wep-select');
    if (mainWepSelect) {
        mainWepSelect.onchange = (e) => {
            updateEntityImage(e.target.value, 'main-wep-image', 'weapons');
            updateState();
        };
    }

    setupPotencyButtons('comp-wep-pot', 'comp-wep-pot-group');
    setupToggleButton('comp-wep-state', 'comp-wep-toggle', '기질');

    // 가이드 모달 버튼
    const guideNav = document.getElementById('nav-guide');
    if (guideNav) {
        guideNav.onclick = () => document.getElementById('guide-modal')?.classList.add('open');
    }

    // 데미지 공식 툴팁
    const formulaBtn = document.getElementById('formula-info-btn');
    const formulaTooltip = document.getElementById('formula-tooltip');
    if (formulaBtn && formulaTooltip) {
        formulaBtn.onclick = (e) => { e.stopPropagation(); formulaTooltip.classList.toggle('open'); };
        document.addEventListener('click', () => formulaTooltip.classList.remove('open'));
    }

    AppTooltip.init();
}

// ============ 서브 오퍼레이터 이벤트 ============
function setupSubOperatorEvents(i) {
    const opSel = document.getElementById(`sub-${i}-op`);
    if (!opSel) return;
    opSel.add(new Option('-', ''));
    DATA_OPERATORS.forEach(op => opSel.add(new Option(op.name, op.id)));

    const wepSel = document.getElementById(`sub-${i}-wep`);
    if (wepSel) {
        wepSel.add(new Option('-', ''));
        wepSel.onchange = (e) => {
            updateEntityImage(e.target.value, `sub-${i}-wep-image`, 'weapons');
            updateState();
        };
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
        updateEntityImage(opId, `sub-${i}-image`, 'operators');
        document.getElementById(`sub-${i}-summary`).innerText = DATA_OPERATORS.find(o => o.id === opId)?.name || '';
        updateState();
    });

    setupPotencyButtons(`sub-${i}-pot`, `sub-${i}-pot-group`);

    // X 버튼 (선택 해제)
    const potGroup = document.getElementById(`sub-${i}-pot-group`);
    if (potGroup?.parentNode) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'potency-btn';
        removeBtn.innerText = 'X';
        removeBtn.style.color = '#ff4d4d';
        removeBtn.title = '선택 해제';
        removeBtn.onclick = () => {
            document.getElementById(`sub-${i}-op`).value = '';
            document.getElementById(`sub-${i}-op-btn`).innerText = '== 선택 해제 ==';
            document.getElementById(`sub-${i}-summary`).innerText = '';
            updateEntityImage('', `sub-${i}-image`, 'operators');

            const wSel = document.getElementById(`sub-${i}-wep`);
            if (wSel) {
                wSel.innerHTML = '';
                wSel.add(new Option('-', ''));
                wSel.value = '';
                document.getElementById(`sub-${i}-wep-btn`).innerText = '== 선택 해제 ==';
                updateEntityImage('', `sub-${i}-wep-image`, 'weapons');
            }
            updateState();
        };
        potGroup.parentNode.appendChild(removeBtn);
    }

    setupPotencyButtons(`sub-${i}-wep-pot`, `sub-${i}-wep-pot-group`);
    setupToggleButton(`sub-${i}-wep-state`, `sub-${i}-wep-toggle`, '기질');
}

// ============ 선택 UI 설정 ============
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
            const opData = DATA_OPERATORS.find(o => o.id === selectedId);
            btn.innerText = opData ? opData.name : '== 선택 해제 ==';
            if (onChangeInfo) onChangeInfo(selectedId);
        }, currentSelectedIds, selectId);
    };

    if (sel.value) {
        const opData = DATA_OPERATORS.find(o => o.id === sel.value);
        if (opData) btn.innerText = opData.name;
    }
}

function setupWeaponSelect(selectId, btnId, getOpIdFunc) {
    const sel = document.getElementById(selectId);
    const btn = document.getElementById(btnId);
    if (!sel || !btn) return;

    btn.onclick = () => {
        const validWeapons = getValidWeapons(getOpIdFunc());
        openWeaponModal((selectedId) => {
            sel.value = selectedId;
            const wepData = DATA_WEAPONS.find(w => w.id === selectedId);
            btn.innerText = wepData ? wepData.name : '== 선택 해제 ==';
            sel.dispatchEvent(new Event('change'));
            if (sel.onchange) sel.onchange({ target: sel });
        }, validWeapons, sel.value);
    };

    if (sel.value) {
        const wepData = DATA_WEAPONS.find(w => w.id === sel.value);
        if (wepData) btn.innerText = wepData.name;
    }
}

// ============ 무기/오퍼레이터 목록 갱신 ============
function updateMainWeaponList(opId) {
    const validWeps = getValidWeapons(opId);
    const mainWepSelect = document.getElementById('main-wep-select');
    const mainWepBtn = document.getElementById('main-wep-select-btn');
    if (!mainWepSelect) return;

    const currentVal = mainWepSelect.value;
    renderSelect('main-wep-select', validWeps);

    const stillValid = validWeps.find(w => w.id === currentVal);
    if (stillValid) {
        mainWepSelect.value = currentVal;
        if (mainWepBtn) mainWepBtn.innerText = stillValid.name;
    } else if (validWeps.length > 0) {
        mainWepSelect.value = validWeps[0].id;
        if (mainWepBtn) mainWepBtn.innerText = validWeps[0].name;
        updateEntityImage(validWeps[0].id, 'main-wep-image', 'weapons');
    } else {
        if (mainWepBtn) mainWepBtn.innerText = '선택 불가';
        updateEntityImage(null, 'main-wep-image', 'weapons');
    }
}

function updateSubWeaponList(idx, opId) {
    const sel = document.getElementById(`sub-${idx}-wep`);
    const btn = document.getElementById(`sub-${idx}-wep-btn`);
    if (!sel) return;

    const currentVal = sel.value;
    sel.innerHTML = '';
    sel.add(new Option('-', ''));
    const validWeps = getValidWeapons(opId);
    validWeps.forEach(w => sel.add(new Option(w.name, w.id)));

    const stillValid = validWeps.find(w => w.id === currentVal);
    if (stillValid) { sel.value = currentVal; if (btn) btn.innerText = stillValid.name; }
    else { sel.value = ''; if (btn) btn.innerText = '== 선택 해제 =='; }
}

// ============ 상태 → UI 동기화 ============
function applyStateToUI() {
    if (!state.mainOp.id) return;
    restoreMainOperator();
    restoreMainWeapon();
    restoreGears();
    restoreSubOps();

    const enemyCb = document.getElementById('enemy-unbalanced');
    if (enemyCb) {
        enemyCb.checked = state.enemyUnbalanced;
        updateToggleButton(document.getElementById('enemy-unbalanced-toggle'), enemyCb.checked, '불균형');
    }

    applyDebuffStateToUI();
    updateState();
}

function restoreMainOperator() {
    document.getElementById('main-op-select').value = state.mainOp.id;
    document.getElementById('main-op-pot').value = state.mainOp.pot;
    setupPotencyButtons('main-op-pot', 'main-op-pot-group');

    const opData = DATA_OPERATORS.find(o => o.id === state.mainOp.id);
    if (opData) {
        document.getElementById('main-op-select-btn').innerText = opData.name;
        updateMainWeaponList(state.mainOp.id);
        updateEntityImage(state.mainOp.id, 'main-op-image', 'operators');
    }
}

function restoreMainWeapon() {
    const mainWepSelect = document.getElementById('main-wep-select');
    if (mainWepSelect) {
        mainWepSelect.value = state.mainOp.wepId || '';
        const wepData = DATA_WEAPONS.find(w => w.id === state.mainOp.wepId);
        const mainWepBtn = document.getElementById('main-wep-select-btn');
        if (mainWepBtn) mainWepBtn.innerText = wepData ? wepData.name : '== 선택 해제 ==';
        updateEntityImage(state.mainOp.wepId, 'main-wep-image', 'weapons');
    }

    document.getElementById('main-wep-pot').value = state.mainOp.wepPot;
    setupPotencyButtons('main-wep-pot', 'main-wep-pot-group');

    const wepCb = document.getElementById('main-wep-state');
    if (wepCb) {
        wepCb.checked = state.mainOp.wepState;
        updateToggleButton(document.getElementById('main-wep-toggle'), wepCb.checked, '기질');
    }
}

function restoreGears() {
    const gearForgeCb = document.getElementById('main-gear-forge');
    if (gearForgeCb) {
        gearForgeCb.checked = state.mainOp.gearForge;
        updateToggleButton(document.getElementById('main-forge-toggle'), gearForgeCb.checked, '단조');
    }

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

function restoreSubOps() {
    for (let i = 0; i < 3; i++) {
        const s = state.subOps[i];
        document.getElementById(`sub-${i}-pot`).value = s.pot;
        setupPotencyButtons(`sub-${i}-pot`, `sub-${i}-pot-group`);

        const opSel = document.getElementById(`sub-${i}-op`);
        if (opSel) {
            opSel.value = s.id || '';
            const opData = DATA_OPERATORS.find(o => o.id === s.id);
            document.getElementById(`sub-${i}-op-btn`).innerText = opData ? opData.name : '== 선택 해제 ==';
            document.getElementById(`sub-${i}-summary`).innerText = opData ? opData.name : '';
            updateSubWeaponList(i, s.id);
            updateEntityImage(s.id, `sub-${i}-image`, 'operators');
        }

        const wepSel = document.getElementById(`sub-${i}-wep`);
        const wepBtn = document.getElementById(`sub-${i}-wep-btn`);
        if (wepSel) {
            wepSel.value = s.wepId || '';
            const wepData = DATA_WEAPONS.find(w => w.id === s.wepId);
            if (wepBtn) wepBtn.innerText = wepData ? wepData.name : '== 선택 해제 ==';
            updateEntityImage(s.wepId, `sub-${i}-wep-image`, 'weapons');
        }

        document.getElementById(`sub-${i}-wep-pot`).value = s.wepPot;
        setupPotencyButtons(`sub-${i}-wep-pot`, `sub-${i}-wep-pot-group`);

        const wepStateCb = document.getElementById(`sub-${i}-wep-state`);
        if (wepStateCb) {
            wepStateCb.checked = s.wepState;
            updateToggleButton(document.getElementById(`sub-${i}-wep-toggle`), wepStateCb.checked, '기질');
        }

        const setSel = document.getElementById(`sub-${i}-set`);
        if (setSel) setSel.value = s.equipSet || '';

        const content = document.getElementById(`sub-op-content-${i}`);
        if (content && state.subOpsCollapsed) {
            content.classList.toggle('collapsed', state.subOpsCollapsed[i]);
        }
    }
}

// ============ 이미지 프리로딩 ============
window._preloadedImages = [];
function preloadAllImages() {
    const categories = {
        operators: typeof DATA_OPERATORS !== 'undefined' ? DATA_OPERATORS : [],
        weapons: typeof DATA_WEAPONS !== 'undefined' ? DATA_WEAPONS : [],
        gears: typeof DATA_GEAR !== 'undefined' ? DATA_GEAR : []
    };
    Object.entries(categories).forEach(([folder, data]) => {
        data.forEach(item => {
            if (item.name) {
                const img = new Image();
                img.src = `images/${folder}/${item.name}.webp`;
                window._preloadedImages.push(img);
            }
        });
    });
}
