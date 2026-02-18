// ============ UI 초기화 및 관리 (ui.js) ============

window.onload = function () {
    const DEFAULT_OP_ID = 'Endministrator';
    const DEFAULT_WEP_ID = 'Grand Vision';

    // UI 초기화
    initUI();

    // 저장된 상태 로드 시도
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
    if (wepSelect && wepSelect.querySelector(`option[value="${DEFAULT_WEP_ID}"]`)) {
        wepSelect.value = DEFAULT_WEP_ID;
        // 버튼 텍스트 업데이트 추가
        const wepData = DATA_WEAPONS.find(w => w.id === DEFAULT_WEP_ID);
        if (wepData) document.getElementById('main-wep-select-btn').innerText = wepData.name;

        updateEntityImage(DEFAULT_WEP_ID, 'main-wep-image', 'weapons');
    }

    // 기본 장비 세트
    const defaultGears = [
        { id: 'gear-gloves-select', val: 'gear_13' },
        { id: 'gear-armor-select', val: 'gear_16' },
        { id: 'gear-kit1-select', val: 'gear_11' },
        { id: 'gear-kit2-select', val: 'gear_12' }
    ];

    defaultGears.forEach(gear => {
        const el = document.getElementById(gear.id);
        if (el) {
            el.value = gear.val;
            updateEntityImage(gear.val, gear.id.replace('-select', '-image'), 'gears');
        }
    });

    updateState();
}

/** UI 컴포넌트 초기화 및 이벤트 바인딩 */
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

    document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('gear-sidebar');
        const isClickInside = sidebar.contains(e.target);
        const isGearClick = e.target.closest('.gear-image-container');
        if (sidebar.classList.contains('open') && !isClickInside && !isGearClick) {
            closeGearSidebar();
        }
    });

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

    // 메인 무기 변경 이벤트 (모달 연결)
    setupWeaponSelect('main-wep-select', 'main-wep-select-btn', () => state.mainOp.id);

    // 기존 select onchange 핸들러는 setupWeaponSelect 내부에서 트리거됨
    const mainWepSelect = document.getElementById('main-wep-select');
    if (mainWepSelect) {
        mainWepSelect.onchange = (e) => {
            updateEntityImage(e.target.value, 'main-wep-image', 'weapons');
            updateState();
        };
    }

    setupPotencyButtons('comp-wep-pot', 'comp-wep-pot-group');
    setupToggleButton('comp-wep-state', 'comp-wep-toggle', '기질');

    const guideNav = document.getElementById('nav-guide');
    if (guideNav) {
        guideNav.onclick = () => {
            const modal = document.getElementById('guide-modal');
            if (modal) modal.classList.add('open');
        };
    }

    AppTooltip.init();
}

// ============ 장비 사이드바 ============
let currentGearInputId = null;

window.openGearSidebar = function (inputId, partType) {
    currentGearInputId = inputId;
    const sidebar = document.getElementById('gear-sidebar');
    if (sidebar) {
        renderGearSidebar(partType);
        sidebar.classList.add('open');
    }
};

window.closeGearSidebar = function () {
    const sidebar = document.getElementById('gear-sidebar');
    if (sidebar) sidebar.classList.remove('open');
    currentGearInputId = null;
};

function renderGearSidebar(filterPart) {
    const container = document.querySelector('#gear-sidebar .sidebar-content');
    if (!container) return;
    container.innerHTML = '';

    const unequipBtn = document.createElement('div');
    unequipBtn.className = 'sidebar-item unequip-item';
    unequipBtn.innerHTML = `<span class="sidebar-item-name">== 장착 해제 ==</span>`;
    unequipBtn.onclick = () => selectGear('');
    container.appendChild(unequipBtn);

    DATA_SETS.forEach(set => {
        const setGears = DATA_GEAR.filter(g => g.set === set.id);
        if (setGears.length === 0) return;

        const header = document.createElement('h3');
        header.className = 'sidebar-set-header';
        header.innerText = `=== ${set.name} ===`;
        container.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'gear-sidebar-grid';

        setGears.forEach(gear => {
            const item = document.createElement('div');
            item.className = 'sidebar-item';

            item.setAttribute('data-tooltip-id', gear.id);
            item.setAttribute('data-tooltip-type', 'gear');

            const isMatch = (gear.part === filterPart);
            if (!isMatch) {
                item.classList.add('disabled');
            }

            if (document.getElementById(currentGearInputId)?.value === gear.id) {
                item.classList.add('selected');
            }

            item.innerHTML = `
                <div class="sidebar-item-img">
                    <img src="images/gears/${gear.name}.webp" loading="lazy">
                </div>
                <span class="sidebar-item-name">${gear.name}</span>
            `;

            if (isMatch) {
                item.onclick = () => selectGear(gear.id);
            }

            grid.appendChild(item);
        });

        container.appendChild(grid);
    });
}

function selectGear(gearId) {
    if (!currentGearInputId) return;

    const input = document.getElementById(currentGearInputId);
    if (input) {
        input.value = gearId;
        const imgId = currentGearInputId.replace('-select', '-image');
        updateEntityImage(gearId, imgId, 'gears');
        updateState();
    }
    closeGearSidebar();
}

// ============ 서브 오퍼레이터 ============
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
        // 무기 선택 모달 설정
        setupWeaponSelect(`sub-${i}-wep`, `sub-${i}-wep-btn`, () => {
            return document.getElementById(`sub-${i}-op`)?.value;
        });
    }

    const setSel = document.getElementById(`sub-${i}-set`);
    if (setSel) {
        setSel.classList.add('visual-select-btn', 'btn-select');
        setSel.innerHTML = '<option value="">== 선택 해제 ==</option>';
        DATA_SETS.forEach(s => {
            if (s.id === 'set_crisis') return;
            setSel.add(new Option(s.name, s.id));
        });
        setSel.onchange = updateState;
    }

    setupOperatorSelect(`sub-${i}-op`, `sub-${i}-op-btn`, (opId) => {
        updateSubWeaponList(i, opId);
        updateEntityImage(opId, `sub-${i}-image`, 'operators');
        const opName = DATA_OPERATORS.find(o => o.id === opId)?.name || '';
        document.getElementById(`sub-${i}-summary`).innerText = opName;
        updateState();
    });

    setupPotencyButtons(`sub-${i}-pot`, `sub-${i}-pot-group`);

    const potGroup = document.getElementById(`sub-${i}-pot-group`);
    if (potGroup && potGroup.parentNode) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'potency-btn';
        removeBtn.innerText = 'X';
        removeBtn.style.color = '#ff4d4d';
        removeBtn.title = '선택 해제';
        removeBtn.onclick = () => {
            const sel = document.getElementById(`sub-${i}-op`);
            sel.value = '';
            document.getElementById(`sub-${i}-op-btn`).innerText = '== 선택 해제 ==';
            document.getElementById(`sub-${i}-summary`).innerText = '';
            updateEntityImage('', `sub-${i}-image`, 'operators');

            const wSel = document.getElementById(`sub-${i}-wep`);
            if (wSel) {
                wSel.innerHTML = '';
                wSel.add(new Option('-', ''));
                wSel.value = '';
                document.getElementById(`sub-${i}-wep-btn`).innerText = '== 선택 해제 =='; // 버튼 텍스트 초기화
                updateEntityImage('', `sub-${i}-wep-image`, 'weapons');
            }
            updateState();
        };
        potGroup.parentNode.appendChild(removeBtn);
    }

    setupPotencyButtons(`sub-${i}-wep-pot`, `sub-${i}-wep-pot-group`);
    setupToggleButton(`sub-${i}-wep-state`, `sub-${i}-wep-toggle`, '기질');
}

// ============ 선택 모달 ============
function setupOperatorSelect(selectId, btnId, onChangeInfo) {
    const sel = document.getElementById(selectId);
    const btn = document.getElementById(btnId);
    if (!sel || !btn) return;

    if (sel.options.length === 0) {
        renderSelect(selectId, DATA_OPERATORS);
    }

    btn.onclick = () => {
        const currentSelectedIds = [
            state.mainOp.id,
            state.subOps[0].id,
            state.subOps[1].id,
            state.subOps[2].id
        ].filter(id => id && id !== sel.value);

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
        const opId = getOpIdFunc();
        const validWeapons = getValidWeapons(opId);

        openWeaponModal((selectedId) => {
            sel.value = selectedId;
            const wepData = DATA_WEAPONS.find(w => w.id === selectedId);
            btn.innerText = wepData ? wepData.name : '== 선택 해제 ==';

            // Trigger change event manually
            const event = new Event('change');
            sel.dispatchEvent(event);
            if (sel.onchange) sel.onchange({ target: sel });
        }, validWeapons, sel.value);
    };

    if (sel.value) {
        const wepData = DATA_WEAPONS.find(w => w.id === sel.value);
        if (wepData) btn.innerText = wepData.name;
    }
}

function openWeaponModal(onSelect, validWeapons, currentValue) {
    const modal = document.getElementById('wep-selector-modal');
    const grid = document.getElementById('wep-modal-grid');
    if (!modal || !grid) return;

    grid.innerHTML = '';

    const unequipItem = document.createElement('div');
    unequipItem.className = 'modal-item unselect-item';
    unequipItem.innerHTML = `<span class="name">선택 해제</span>`;
    unequipItem.onclick = () => {
        modal.classList.remove('open');
        onSelect('');
    };
    grid.appendChild(unequipItem);

    validWeapons.forEach(wep => {
        const item = document.createElement('div');
        item.className = 'modal-item';
        if (wep.id === currentValue) {
            item.classList.add('selected');
        }
        item.setAttribute('data-tooltip-id', wep.id);
        item.setAttribute('data-tooltip-type', 'weapon');

        const imgSrc = `images/weapons/${wep.name}.webp`;
        item.innerHTML = `
            <div style="width:50px; height:50px; margin:0 auto; background:rgba(255,255,255,0.1); border-radius:12px; display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative;">
               <img src="${imgSrc}" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
               <span style="display:none; font-size:0.7rem; color:#aaa;">IMG</span>
            </div>
            <span class="name">${wep.name}</span>
        `;

        item.onclick = () => {
            modal.classList.remove('open');
            onSelect(wep.id);
        };
        grid.appendChild(item);
    });

    modal.classList.add('open');
    modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('open'); };
}

function openOperatorModal(onSelect, excludedIds = [], selectId = null) {
    const modal = document.getElementById('op-selector-modal');
    const grid = document.getElementById('op-modal-grid');
    const closeBtn = document.getElementById('modal-close-btn');
    if (!modal || !grid) return;

    const currentVal = selectId ? document.getElementById(selectId)?.value : null;

    grid.innerHTML = '';

    if (selectId !== 'main-op-select') {
        const unequipItem = document.createElement('div');
        unequipItem.className = 'modal-item unselect-item';
        unequipItem.innerHTML = `<span class="name">선택 해제</span>`;
        unequipItem.onclick = () => {
            modal.classList.remove('open');
            onSelect('');
        };
        grid.appendChild(unequipItem);
    }

    DATA_OPERATORS.forEach(op => {
        const item = document.createElement('div');
        item.className = 'modal-item';
        if (op.id === currentVal) {
            item.classList.add('selected');
        }

        item.setAttribute('data-tooltip-id', op.id);
        item.setAttribute('data-tooltip-type', 'operator');

        const isExcluded = excludedIds.includes(op.id);
        if (isExcluded) {
            item.classList.add('disabled');
            item.style.opacity = '0.4';
            item.style.pointerEvents = 'none';
        }

        const imgSrc = `images/operators/${op.name}.webp`;
        item.innerHTML = `
            <div style="width:50px; height:50px; margin:0 auto; background:rgba(255,255,255,0.1); border-radius:12px; display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative;">
               <img src="${imgSrc}" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
               <span style="display:none; font-size:0.7rem; color:#aaa;">IMG</span>
            </div>
            <span class="name">${op.name}</span>
        `;

        item.onclick = () => {
            if (isExcluded) return;
            modal.classList.remove('open');
            onSelect(op.id);
        };
        grid.appendChild(item);
    });

    modal.classList.add('open');

    const closeModal = () => modal.classList.remove('open');
    if (closeBtn) closeBtn.onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };
}

// ============ UI 유틸리티 ============
function setupPotencyButtons(inputId, groupId) {
    const input = document.getElementById(inputId);
    const group = document.getElementById(groupId);
    if (!input || !group) return;

    group.innerHTML = '';
    const currentVal = Number(input.value) || 0;

    for (let i = 0; i <= 5; i++) {
        const btn = document.createElement('button');
        btn.className = `potency-btn ${i === currentVal ? 'active' : ''}`;
        btn.innerText = i;
        btn.onclick = () => {
            input.value = i;
            Array.from(group.children).forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            syncPotencyToTooltip(inputId, i);
            updateState();
        };
        group.appendChild(btn);
    }
    syncPotencyToTooltip(inputId, currentVal);
}

function syncPotencyToTooltip(inputId, potValue) {
    let targetImgId = '';
    if (inputId === 'main-op-pot') targetImgId = 'main-op-image';
    else if (inputId === 'main-wep-pot') targetImgId = 'main-wep-image';
    else if (inputId.includes('sub-')) {
        targetImgId = inputId.replace('-pot', '-image');
    }

    if (targetImgId) {
        const img = document.getElementById(targetImgId);
        if (img) img.setAttribute('data-tooltip-pot', potValue);
    }
}

function toggleSubOp(idx) {
    const content = document.getElementById(`sub-op-content-${idx}`);
    if (content) {
        content.classList.toggle('collapsed');
    }
}

function setupToggleButton(checkboxId, buttonId, label) {
    const cb = document.getElementById(checkboxId);
    if (!cb) return;
    cb.style.display = 'none';
    const btn = document.createElement('button');
    btn.id = buttonId;
    btn.className = 'toggle-btn';
    btn.innerText = `${label}: OFF`;
    btn.onclick = () => {
        cb.checked = !cb.checked;
        updateToggleButton(btn, cb.checked, label);
        updateState();
    };
    cb.parentNode.appendChild(btn);
    updateToggleButton(btn, cb.checked, label);
}

function setupMainForgeToggle() {
    const mainForgeCb = document.getElementById('main-gear-forge');
    if (!mainForgeCb) return;
    mainForgeCb.style.display = 'none';
    const mainForgeToggle = document.createElement('button');
    mainForgeToggle.id = 'main-forge-toggle';
    mainForgeToggle.className = 'toggle-btn';
    mainForgeToggle.innerText = '단조: OFF';
    mainForgeToggle.onclick = () => {
        mainForgeCb.checked = !mainForgeCb.checked;
        const gearIds = ['gear-gloves-forge', 'gear-armor-forge', 'gear-kit1-forge', 'gear-kit2-forge'];
        gearIds.forEach(gid => {
            const gcb = document.getElementById(gid);
            const gbtn = document.getElementById(gid + '-toggle');
            if (gcb) gcb.checked = mainForgeCb.checked;
            if (gbtn) updateToggleButton(gbtn, mainForgeCb.checked, '단조');
        });
        updateToggleButton(mainForgeToggle, mainForgeCb.checked, '단조');
        updateState();
    };
    mainForgeCb.parentNode.appendChild(mainForgeToggle);
    updateToggleButton(mainForgeToggle, mainForgeCb.checked, '단조');
}

function setupGearForgeToggles() {
    const gearForgeIds = ['gear-gloves-forge', 'gear-armor-forge', 'gear-kit1-forge', 'gear-kit2-forge'];
    const mainForgeCb = document.getElementById('main-gear-forge');
    const mainForgeToggle = document.getElementById('main-forge-toggle');

    gearForgeIds.forEach((id) => {
        const cb = document.getElementById(id);
        if (!cb) return;
        cb.style.display = 'none';
        const btn = document.createElement('button');
        btn.id = id + '-toggle';
        btn.className = 'toggle-btn';
        btn.innerText = '단조: OFF';
        btn.onclick = () => {
            cb.checked = !cb.checked;
            updateToggleButton(btn, cb.checked, '단조');
            const allOn = gearForgeIds.every(gid => {
                const c = document.getElementById(gid);
                return c ? c.checked : false;
            });
            if (mainForgeCb) mainForgeCb.checked = allOn;
            if (mainForgeToggle) updateToggleButton(mainForgeToggle, allOn, '단조');
            updateState();
        };
        cb.parentNode.appendChild(btn);
        updateToggleButton(btn, cb.checked, '단조');
    });
}

function updateMainWeaponList(opId) {
    const validWeps = getValidWeapons(opId);
    renderSelect('main-wep-select', validWeps);

    const mainWepSelect = document.getElementById('main-wep-select');
    const mainWepBtn = document.getElementById('main-wep-select-btn');

    if (validWeps.length > 0) {
        const firstWepId = validWeps[0].id;
        mainWepSelect.value = firstWepId;
        if (mainWepBtn) mainWepBtn.innerText = validWeps[0].name;
        updateEntityImage(firstWepId, 'main-wep-image', 'weapons');
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

    if (stillValid) {
        sel.value = currentVal;
        if (btn) btn.innerText = stillValid.name;
    } else {
        sel.value = '';
        if (btn) btn.innerText = '== 선택 해제 ==';
    }
}

function renderSelect(id, list) {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '';
    list.forEach(item => sel.add(new Option(item.name, item.id)));
}

function updateEntityImage(entityId, imgElementId, folder) {
    const imgElement = document.getElementById(imgElementId);
    if (!imgElement) return;

    if (!entityId) {
        imgElement.src = '';
        imgElement.style.display = 'none';
        return;
    }

    let fileName = '';
    if (folder === 'operators') {
        fileName = DATA_OPERATORS.find(op => op.id === entityId)?.name;
    } else if (folder === 'weapons') {
        fileName = DATA_WEAPONS.find(wep => wep.id === entityId)?.name;
    } else if (folder === 'gears') {
        fileName = DATA_GEAR.find(gear => gear.id === entityId)?.name;
    }

    if (fileName) {
        const imgSrc = `images/${folder}/${fileName}.webp`;
        imgElement.src = imgSrc;
        imgElement.style.display = 'block';

        imgElement.setAttribute('data-tooltip-id', entityId);
        imgElement.setAttribute('data-tooltip-type', folder === 'operators' ? 'operator' : folder === 'weapons' ? 'weapon' : 'gear');

        let potency = 0;
        if (folder === 'operators' || folder === 'weapons') {
            let inputId = '';
            if (imgElementId === 'main-op-image') inputId = 'main-op-pot';
            else if (imgElementId === 'main-wep-image') inputId = 'main-wep-pot';
            else if (imgElementId.startsWith('sub-')) {
                inputId = imgElementId.replace('-image', '-pot');
            }

            if (inputId) {
                potency = Number(document.getElementById(inputId)?.value) || 0;
            }
        }
        imgElement.setAttribute('data-tooltip-pot', potency);

        imgElement.onerror = function () {
            this.style.display = 'none';
        };
    } else {
        imgElement.src = '';
        imgElement.style.display = 'none';
        imgElement.removeAttribute('data-tooltip-id');
        imgElement.removeAttribute('data-tooltip-type');
    }
}

function updateToggleButton(btn, isChecked, label) {
    if (isChecked) {
        btn.classList.add('active');
        btn.innerText = `${label}: ON`;
    } else {
        btn.classList.remove('active');
        btn.innerText = `${label}: OFF`;
    }
}

// ============ 결과 렌더링 ============
function renderResult(res) {
    if (!res) {
        const finalDmgEl = document.getElementById('final-damage');
        if (finalDmgEl) finalDmgEl.innerText = '0';
        return;
    }

    const mapping = {
        'final-damage': Math.floor(res.finalDmg).toLocaleString(),
        'stat-atk': Math.floor(res.stats.finalAtk).toLocaleString(),
        'stat-atk-inc': res.stats.atkInc.toFixed(1) + '%',
        'stat-main-val': Math.floor(res.stats.mainStatVal),
        'stat-sub-val': Math.floor(res.stats.subStatVal),
        'stat-crit': Math.floor(res.stats.critExp * 100) + '%',
        'val-crit-rate': res.stats.finalCritRate + '%',
        'val-crit-dmg': res.stats.critDmg + '%',
        'stat-dmg-inc': res.stats.dmgInc.toFixed(1) + '%',
        'stat-amp': res.stats.amp.toFixed(1) + '%',
        'stat-vuln': res.stats.vuln.toFixed(1) + '%',
        'stat-taken': res.stats.takenDmg.toFixed(1) + '%',
        'stat-unbal': res.stats.unbalanceDmg.toFixed(1) + '%',
        'stat-arts': res.stats.originiumArts.toFixed(1)
    };

    for (const [id, val] of Object.entries(mapping)) {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    }

    const mainLabel = document.getElementById('label-main-stat');
    if (mainLabel) mainLabel.innerText = res.stats.mainStatName;
    const subLabel = document.getElementById('label-sub-stat');
    if (subLabel) subLabel.innerText = res.stats.subStatName;

    const multihitSpan = document.getElementById('stat-multihit');
    if (multihitSpan) multihitSpan.innerText = (res.logs.multihit.length > 0 ? "ON" : "OFF");

    const logMapping = {
        'list-atk': res.logs.atk,
        'list-crit': res.logs.crit,
        'list-dmg-inc': res.logs.dmgInc,
        'list-amp': res.logs.amp,
        'list-vuln': res.logs.vuln,
        'list-taken': res.logs.taken,
        'list-unbal': res.logs.unbal,
        'list-multihit': res.logs.multihit,
        'list-arts': res.logs.arts
    };

    for (const [id, list] of Object.entries(logMapping)) {
        renderLog(id, list);
    }

    updateActiveSetUI();
}

function updateActiveSetUI() {
    const container = document.getElementById('main-active-set');
    if (!container) return;
    container.innerHTML = '';

    if (state.activeSetId) {
        const set = DATA_SETS.find(s => s.id === state.activeSetId);
        const opData = DATA_OPERATORS.find(o => o.id === state.mainOp.id);

        if (set && opData) {
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
    }
}

function renderLog(id, list) {
    const ul = document.getElementById(id);
    if (!ul) return;
    ul.innerHTML = '';
    list.forEach(txt => {
        const li = document.createElement('li');
        li.innerText = txt;
        ul.appendChild(li);
    });
}

function renderWeaponComparison(currentDmg) {
    const box = document.getElementById('weapon-comparison');
    if (!box) return;
    if (!state.mainOp.id) return;

    const currentOp = DATA_OPERATORS.find(o => o.id === state.mainOp.id);
    if (!currentOp) return;

    const currentItems = Array.from(box.children);
    const firstPositions = new Map();
    currentItems.forEach(child => {
        const name = child.querySelector('.comp-name')?.innerText;
        if (name) firstPositions.set(name, child.getBoundingClientRect());
    });

    const compPot = Number(document.getElementById('comp-wep-pot')?.value) || 0;
    const compState = document.getElementById('comp-wep-state')?.checked || false;

    const savedWepId = state.mainOp.wepId;
    const savedWepPot = state.mainOp.wepPot;
    const savedWepState = state.mainOp.wepState;

    const validWeapons = DATA_WEAPONS.filter(w =>
        currentOp.usableWeapons.includes(w.type) && w.id !== savedWepId
    );

    const comparisons = validWeapons.map(w => {
        state.mainOp.wepId = w.id;
        state.mainOp.wepPot = compPot;
        state.mainOp.wepState = compState;
        const res = calculateDamage(state);
        if (!res) return null;
        const diff = res.finalDmg - currentDmg;
        const pct = currentDmg > 0 ? ((diff / currentDmg) * 100).toFixed(1) : 0;
        return { name: w.name, finalDmg: res.finalDmg, pct: Number(pct) };
    }).filter(x => x).sort((a, b) => b.finalDmg - a.finalDmg);

    state.mainOp.wepId = savedWepId;
    state.mainOp.wepPot = savedWepPot;
    state.mainOp.wepState = savedWepState;

    const maxDmg = comparisons.length > 0 ? Math.max(comparisons[0].finalDmg, currentDmg) : currentDmg;
    box.innerHTML = '';

    comparisons.forEach(item => {
        const div = document.createElement('div');
        const sign = item.pct > 0 ? '+' : '';
        const cls = item.pct >= 0 ? (item.pct === 0 ? 'current' : 'positive') : 'negative';
        const barWidth = maxDmg > 0 ? (item.finalDmg / maxDmg * 100) : 0;

        div.className = `comp-item ${cls}`;
        div.setAttribute('data-weapon-name', item.name);
        div.innerHTML = `
            <div class="comp-info">
                <span class="comp-name">${item.name}</span>
                <span class="comp-dmg">${Math.floor(item.finalDmg).toLocaleString()}</span>
                <span class="comp-pct">${sign}${item.pct}%</span>
            </div>
            <div class="comp-bar-bg">
                <div class="comp-bar" style="width: ${barWidth}%"></div>
            </div>
        `;
        box.appendChild(div);
    });

    requestAnimationFrame(() => {
        const newItems = Array.from(box.children);
        newItems.forEach(child => {
            const name = child.getAttribute('data-weapon-name');
            const firstRect = firstPositions.get(name);
            if (firstRect) {
                const lastRect = child.getBoundingClientRect();
                const deltaY = firstRect.top - lastRect.top;
                if (deltaY !== 0) {
                    child.style.transition = 'none';
                    child.style.transform = `translateY(${deltaY}px)`;
                    requestAnimationFrame(() => {
                        child.style.transition = '';
                        child.style.transform = '';
                    });
                }
            } else {
                child.style.opacity = '0';
                requestAnimationFrame(() => {
                    child.style.opacity = '1';
                });
            }
        });
    });
}

function applyStateToUI() {
    if (!state.mainOp.id) return;

    const mainOpSelect = document.getElementById('main-op-select');
    if (mainOpSelect) {
        mainOpSelect.value = state.mainOp.id;
    }
    document.getElementById('main-op-pot').value = state.mainOp.pot;
    setupPotencyButtons('main-op-pot', 'main-op-pot-group');

    if (state.mainOp.id) {
        const opData = DATA_OPERATORS.find(o => o.id === state.mainOp.id);
        if (opData) {
            document.getElementById('main-op-select-btn').innerText = opData.name;
            updateMainWeaponList(state.mainOp.id);
            updateEntityImage(state.mainOp.id, 'main-op-image', 'operators');
        }
    }

    const mainWepSelect = document.getElementById('main-wep-select');
    if (mainWepSelect) {
        mainWepSelect.value = state.mainOp.wepId;
        updateEntityImage(state.mainOp.wepId, 'main-wep-image', 'weapons');
    }
    document.getElementById('main-wep-pot').value = state.mainOp.wepPot;
    setupPotencyButtons('main-wep-pot', 'main-wep-pot-group');

    const wepCb = document.getElementById('main-wep-state');
    if (wepCb) {
        wepCb.checked = state.mainOp.wepState;
        updateToggleButton(document.getElementById('main-wep-toggle'), wepCb.checked, '기질');
    }

    const gearForgeCb = document.getElementById('main-gear-forge');
    if (gearForgeCb) {
        gearForgeCb.checked = state.mainOp.gearForge;
        updateToggleButton(document.getElementById('main-forge-toggle'), gearForgeCb.checked, '단조');
    }

    const gearIds = ['gear-gloves-select', 'gear-armor-select', 'gear-kit1-select', 'gear-kit2-select'];
    const forgeIds = ['gear-gloves-forge', 'gear-armor-forge', 'gear-kit1-forge', 'gear-kit2-forge'];

    gearIds.forEach((id, idx) => {
        const el = document.getElementById(id);
        if (el) {
            el.value = state.mainOp.gears[idx] || '';
            updateEntityImage(el.value, id.replace('-select', '-image'), 'gears');
        }
    });
    forgeIds.forEach((id, idx) => {
        const el = document.getElementById(id);
        if (el) {
            el.checked = state.mainOp.gearForged[idx];
            updateToggleButton(document.getElementById(id + '-toggle'), el.checked, '단조');
        }
    });

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
        if (wepSel) {
            wepSel.value = s.wepId || '';
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
    }

    const enemyCb = document.getElementById('enemy-unbalanced');
    if (enemyCb) {
        enemyCb.checked = state.enemyUnbalanced;
        updateToggleButton(document.getElementById('enemy-unbalanced-toggle'), enemyCb.checked, '불균형');
    }

    updateState();
}

const AppTooltip = {
    el: null,

    init() {
        this.el = document.getElementById('app-tooltip');
        if (!this.el) return;

        document.addEventListener('mouseover', (e) => {
            const target = e.target.closest('[data-tooltip-id]');
            if (target) {
                const id = target.getAttribute('data-tooltip-id');
                const type = target.getAttribute('data-tooltip-type');
                const pot = Number(target.getAttribute('data-tooltip-pot')) || 0;
                if (id && type) {
                    this.show(id, type, pot, e);
                }
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.el.style.display === 'block') {
                this.position(e);
            }
        });

        document.addEventListener('mouseout', (e) => {
            const target = e.target.closest('[data-tooltip-id]');
            if (target) {
                this.hide();
            }
        });
    },

    show(id, type, pot, event) {
        let content = '';
        const data = this.getData(id, type);
        if (!data) return;

        if (type === 'operator') content = this.renderOperator(data, pot);
        else if (type === 'weapon') content = this.renderWeapon(data);
        else if (type === 'gear') content = this.renderGear(data);

        this.el.innerHTML = content;
        this.el.style.display = 'block';
        this.position(event);
    },

    hide() {
        if (this.el) this.el.style.display = 'none';
    },

    position(e) {
        const offset = 20;
        let x = e.clientX + offset;
        let y = e.clientY + offset;

        if (x + this.el.offsetWidth > window.innerWidth) {
            x = e.clientX - this.el.offsetWidth - offset;
        }
        if (y + this.el.offsetHeight > window.innerHeight) {
            y = e.clientY - this.el.offsetHeight - offset;
        }

        this.el.style.left = x + 'px';
        this.el.style.top = y + 'px';
    },

    getData(id, type) {
        if (type === 'operator') return DATA_OPERATORS.find(o => o.id === id);
        if (type === 'weapon') return DATA_WEAPONS.find(w => w.id === id);
        if (type === 'gear') return DATA_GEAR.find(g => g.id === id);
        return null;
    },

    getElementName(op) {
        if (op.type === 'phys') return '물리';
        const map = { heat: '열기', cryo: '냉기', elec: '전기', nature: '자연' };
        return map[op.element] || op.element || '아츠';
    },

    getWepTypeName(type) {
        const map = {
            sword: '한손검', great_sword: '양손검', polearm: '장병기',
            handcannon: '권총', arts_unit: '아츠 유닛'
        };
        return map[type] || type;
    },

    renderOperator(op, currentPot) {
        const TRAIT_TYPES = [
            '공격력 증가', '물리 피해', '아츠 피해', '열기 피해', '전기 피해', '냉기 피해', '자연 피해', '불균형 피해',
            '일반 공격 피해', '배틀 스킬 피해', '연계 스킬 피해', '궁극기 피해', '모든 스킬 피해', '주는 피해',
            '오리지늄 아츠 강도', '치명타 확률', '치명타 피해'
        ];
        const SYNERGY_TYPES = [
            '물리 증폭', '아츠 증폭', '열기 증폭', '전기 증폭', '냉기 증폭', '자연 증폭',
            '물리 취약', '아츠 취약', '열기 취약', '전기 취약', '냉기 취약', '자연 취약',
            '아츠 취약', '받는 물리 피해', '받는 아츠 피해', '받는 열기 피해', '받는 전기 피해', '받는 냉기 피해', '받는 자연 피해',
            '받는 불균형 피해', '받는 피해', '연타'
        ];
        const EXCLUDE_TYPES = [
            '최대 체력', '궁극기 충전', '치유 효율', '모든 능력치', '아츠 부착', '동결 부여', '치유', '비호', '보호'
        ];

        const traitItems = [];
        const synergyItems = [];

        const processData = (data, source, potLevel = null) => {
            if (!data) return;
            const items = Array.isArray(data) ? data : [data];
            items.forEach(t => {
                if (Array.isArray(t)) t.forEach(sub => processSingle(sub, source, potLevel));
                else processSingle(t, source, potLevel);
            });
        };

        const processSingle = (t, source, potLevel) => {
            if (!t || !t.type) return;
            if (EXCLUDE_TYPES.some(ex => t.type.includes(ex)) || t.type === '스탯') return;

            const isPotential = potLevel !== null;
            const isActive = isPotential ? (currentPot >= potLevel) : true;
            const sourceLabel = isPotential ? `${potLevel}잠재` : source;
            const item = { ...t, sourceLabel, active: isActive, isPotential };

            const isSynergy = SYNERGY_TYPES.some(syn => t.type.includes(syn)) || t.target === '팀' || t.target === '적';
            if (isSynergy) synergyItems.push(item);
            else if (TRAIT_TYPES.some(tr => t.type.includes(tr))) traitItems.push(item);
        };

        processData(op.talents, '재능');
        if (op.skill) op.skill.forEach((s, i) => processData(s, (i === 0 ? '배틀' : i === 1 ? '연계' : '궁극기')));
        if (op.potential) op.potential.forEach((p, i) => processData(p, '잠재', i + 1));

        const renderSortedList = (list) => {
            const sorted = [...list].sort((a, b) => (a.isPotential !== b.isPotential ? (a.isPotential ? 1 : -1) : 0));
            return sorted.map(t => {
                const unit = '%';
                const valStr = t.val !== undefined ? ` +${t.val}${unit}` : '';
                const style = t.active === false ? 'color: rgba(255,255,255,0.3); font-weight: normal;' : 'color: var(--accent); font-weight: bold;';
                return `<div style="margin-bottom:2px; ${style}"><span style="color:inherit">•</span> [${t.sourceLabel}] ${t.type}${valStr}</div>`;
            }).join('');
        };

        return `
            <div class="tooltip-header">
                <div class="tooltip-icon"><img src="images/operators/${op.name}.webp"></div>
                <div class="tooltip-title-group">
                    <div class="tooltip-name">${op.name}</div>
                    <div class="tooltip-sub">${this.getElementName(op)} / ${this.getWepTypeName(op.usableWeapons[0])}</div>
                </div>
            </div>
            <div class="tooltip-section">
                <div class="tooltip-label">기초 능력치</div>
                <div class="tooltip-stat-grid">
                    <div class="tooltip-stat-item" title="공격력"><span class="tooltip-stat-key">ATK</span><span class="tooltip-stat-val">${op.baseAtk || 0}</span></div>
                    <div class="tooltip-stat-item" title="주스탯"><span class="tooltip-stat-key">${getStatName(op.mainStat)}</span><span class="tooltip-stat-val">${op.stats ? op.stats[op.mainStat] : 0}</span></div>
                    <div class="tooltip-stat-item" title="부스탯"><span class="tooltip-stat-key">${getStatName(op.subStat)}</span><span class="tooltip-stat-val">${op.stats ? op.stats[op.subStat] : 0}</span></div>
                </div>
            </div>
            ${traitItems.length > 0 ? `<div class="tooltip-section"><div class="tooltip-label">오퍼레이터 특성</div><div class="tooltip-desc">${renderSortedList(traitItems)}</div></div>` : ''}
            ${synergyItems.length > 0 ? `<div class="tooltip-section"><div class="tooltip-label">시너지</div><div class="tooltip-desc">${renderSortedList(synergyItems)}</div></div>` : ''}
        `;
    },

    renderWeapon(wep) {
        const traitGroups = { 1: [], 2: [], 3: [] };
        wep.traits.forEach((t, i) => {
            const groupIdx = i >= 2 ? 3 : i + 1;
            let rangeStr = '';
            const unit = t.type.includes('확률') || t.type.includes('피해') || t.type.includes('충전') ? '%' : '';

            let min, max;
            // valByLevel 배열이 있는 경우 배열 내 최소/최대값 사용
            if (t.valByLevel && t.valByLevel.length > 0) {
                min = Math.min(...t.valByLevel);
                max = Math.max(...t.valByLevel);
            } else {
                min = 0;
                max = 0;
            }

            if (t.type === '스탯') {
                // 스탯인 경우 범위로 표시
                if (min !== undefined && max !== undefined) {
                    rangeStr = `${getStatName(t.stat)} +${min}~${max}`;
                } else {
                    rangeStr = `${getStatName(t.stat)} +${t.val || 0}`;
                }
            } else {
                if (min !== undefined && max !== undefined) {
                    rangeStr = `${t.type} +${min}${unit}~${max}${unit}`;
                } else {
                    rangeStr = t.type;
                }
            }
            traitGroups[groupIdx].push(rangeStr);
        });

        const traitLines = Object.entries(traitGroups).map(([idx, lines]) => {
            if (lines.length === 0) return '';
            const content = lines.join(', ');
            return `<div style="margin-bottom:5px;"><span style="color: var(--accent)">•</span> ${content}</div>`;
        }).join('');

        return `
            <div class="tooltip-header">
                <div class="tooltip-icon"><img src="images/weapons/${wep.name}.webp"></div>
                <div class="tooltip-title-group">
                    <div class="tooltip-name">${wep.name}</div>
                    <div class="tooltip-sub">${this.getWepTypeName(wep.type)}</div>
                </div>
            </div>
            <div class="tooltip-section">
                <div class="tooltip-label">기초 능력치</div>
                <div class="tooltip-stat-grid">
                    <div class="tooltip-stat-item" title="공격력"><span class="tooltip-stat-key">ATK</span><span class="tooltip-stat-val">${wep.baseAtk}</span></div>
                </div>
            </div>
            <div class="tooltip-section">
                <div class="tooltip-label">무기 특성</div>
                <div class="tooltip-desc">${traitLines}</div>
            </div>
        `;
    },

    renderGear(gear) {
        const setName = (typeof DATA_SETS !== 'undefined' && DATA_SETS.find(s => s.id === gear.set)?.name) || '일반';
        const typeMap = { armor: '방어구', gloves: '글러브', kit: '부품' };
        const stats = [];
        if (gear.stat1) stats.push({ type: gear.stat1, val: gear.val1 });
        if (gear.stat2) stats.push({ type: gear.stat2, val: gear.val2 });
        const statsHtml = stats.map(s => `<div class="tooltip-stat-item"><span class="tooltip-stat-key">${getStatName(s.type)}</span><span class="tooltip-stat-val">+${s.val}</span></div>`).join('');

        let traitHtml = '';
        if (gear.trait) {
            const traits = Array.isArray(gear.trait) ? gear.trait : [gear.trait];
            const traitLines = traits.map(t => {
                const unit = t.type.includes('확률') || t.type.includes('피해') || t.type.includes('충전') || t.type.includes('효율') ? '%' : '';
                const valStr = t.val !== undefined ? ` +${t.val}${unit}` : '';
                return `<div style="margin-bottom:2px;"><span style="color:var(--accent)">•</span> ${t.type}${valStr}</div>`;
            }).join('');
            traitHtml = `<div class="tooltip-section"><div class="tooltip-label">장비 특성</div><div class="tooltip-desc">${traitLines}</div></div>`;
        }

        return `
            <div class="tooltip-header">
                <div class="tooltip-icon"><img src="images/gears/${gear.name}.webp"></div>
                <div class="tooltip-title-group">
                    <div class="tooltip-name">${gear.name}</div>
                    <div class="tooltip-sub">${typeMap[gear.part] || gear.part} / ${setName}</div>
                </div>
            </div>
            <div class="tooltip-section">
                <div class="tooltip-label">장비 스탯</div>
                <div class="tooltip-stat-grid">${statsHtml}</div>
            </div>
            ${traitHtml}
        `;
    }
};
