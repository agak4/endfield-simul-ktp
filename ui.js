// ============ UI 초기화 및 관리 (ui.js) ============

window.onload = function () {
    const DEFAULT_OP_ID = 'Endministrator';
    const DEFAULT_WEP_ID = 'Grand Vision';

    // UI 초기화
    initUI();

    // 메인 오퍼레이터 초기 설정
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

    // 메인 무기 초기 설정
    const wepSelect = document.getElementById('main-wep-select');
    if (wepSelect && wepSelect.querySelector(`option[value="${DEFAULT_WEP_ID}"]`)) {
        wepSelect.value = DEFAULT_WEP_ID;
        updateEntityImage(DEFAULT_WEP_ID, 'main-wep-image', 'weapons');
    }

    // 메인 장비 초기 설정 (응룡 50식 세트 예시)
    const defaultGears = [
        { id: 'gear-glove-select', val: 'gear_13' },
        { id: 'gear-armor-select', val: 'gear_16' },
        { id: 'gear-comp1-select', val: 'gear_11' },
        { id: 'gear-comp2-select', val: 'gear_12' }
    ];

    defaultGears.forEach(gear => {
        const el = document.getElementById(gear.id);
        if (el && el.querySelector(`option[value="${gear.val}"]`)) {
            el.value = gear.val;
            updateEntityImage(gear.val, gear.id.replace('-select', '-image'), 'gears');
        }
    });

    updateState();
}

function initUI() {
    setupOperatorSelect('main-op-select', 'main-op-select-btn', (opId) => {
        updateMainWeaponList(opId);
        updateEntityImage(opId, 'main-op-image', 'operators');
        updateState();
    });

    const gearMap = [
        { id: 'gear-glove-select', part: 'glove' },
        { id: 'gear-armor-select', part: 'armor' },
        { id: 'gear-comp1-select', part: 'component' },
        { id: 'gear-comp2-select', part: 'component' }
    ];

    gearMap.forEach(m => {
        const sel = document.getElementById(m.id);
        if (!sel) return;
        sel.innerHTML = '';
        sel.add(new Option('-', ''));
        DATA_GEAR.filter(e => e.part === m.part).forEach(e => {
            const setName = (DATA_SETS.find(s => s.id === e.set)?.name || '').split(' ')[0] || '';
            sel.add(new Option(`${e.name} ${setName ? '[' + setName + ']' : ''}`, e.id));
        });
        sel.onchange = (e) => {
            updateState();
            const imgId = m.id.replace('-select', '-image');
            updateEntityImage(e.target.value, imgId, 'gears');
        };
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

    const mainWepSelect = document.getElementById('main-wep-select');
    if (mainWepSelect) {
        mainWepSelect.onchange = (e) => {
            updateEntityImage(e.target.value, 'main-wep-image', 'weapons');
            updateState();
        };
    }

    // 비교 설정 초기화
    setupPotencyButtons('comp-wep-pot', 'comp-wep-pot-group');
    setupToggleButton('comp-wep-state', 'comp-wep-toggle', '기질');
}

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
    }

    const setSel = document.getElementById(`sub-${i}-set`);
    if (setSel) {
        setSel.classList.add('visual-select-btn', 'btn-select');
        setSel.innerHTML = '<option value="">(세트 없음)</option>';
        DATA_SETS.forEach(s => {
            if (s.id === 'set_crisis') return;
            const option = new Option(s.name, s.id);
            setSel.add(option);
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
            document.getElementById(`sub-${i}-op-btn`).innerText = '선택하세요';
            document.getElementById(`sub-${i}-summary`).innerText = '';
            updateEntityImage('', `sub-${i}-image`, 'operators');

            const wSel = document.getElementById(`sub-${i}-wep`);
            if (wSel) {
                wSel.innerHTML = '';
                wSel.add(new Option('-', ''));
                wSel.value = '';
                updateEntityImage('', `sub-${i}-wep-image`, 'weapons');
            }
            updateState();
        };
        potGroup.parentNode.appendChild(removeBtn);
    }

    setupPotencyButtons(`sub-${i}-wep-pot`, `sub-${i}-wep-pot-group`);
    setupToggleButton(`sub-${i}-wep-state`, `sub-${i}-wep-toggle`, '기질');
}

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
            btn.innerText = opData ? opData.name : '선택하세요';
            if (onChangeInfo) onChangeInfo(selectedId);
        }, currentSelectedIds);
    };

    if (sel.value) {
        const opData = DATA_OPERATORS.find(o => o.id === sel.value);
        if (opData) btn.innerText = opData.name;
    }
}

function openOperatorModal(onSelect, excludedIds = []) {
    const modal = document.getElementById('op-selector-modal');
    const grid = document.getElementById('op-modal-grid');
    const closeBtn = document.getElementById('modal-close-btn');
    if (!modal || !grid) return;

    grid.innerHTML = '';

    DATA_OPERATORS.forEach(op => {
        const item = document.createElement('div');
        item.className = 'modal-item';

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
            updateState();
        };
        group.appendChild(btn);
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
        const gearIds = ['gear-glove-forge', 'gear-armor-forge', 'gear-comp1-forge', 'gear-comp2-forge'];
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
    const gearForgeIds = ['gear-glove-forge', 'gear-armor-forge', 'gear-comp1-forge', 'gear-comp2-forge'];
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
    if (validWeps.length > 0) {
        const firstWepId = validWeps[0].id;
        mainWepSelect.value = firstWepId;
        updateEntityImage(firstWepId, 'main-wep-image', 'weapons');
    } else {
        updateEntityImage(null, 'main-wep-image', 'weapons');
    }
}

function updateSubWeaponList(idx, opId) {
    const sel = document.getElementById(`sub-${idx}-wep`);
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = '';
    sel.add(new Option('-', ''));
    const validWeps = getValidWeapons(opId);
    validWeps.forEach(w => sel.add(new Option(w.name, w.id)));
    if (validWeps.find(w => w.id === currentVal)) {
        sel.value = currentVal;
    } else {
        sel.value = '';
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
        imgElement.onerror = function () {
            this.style.display = 'none';
        };
    } else {
        imgElement.src = '';
        imgElement.style.display = 'none';
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

function renderResult(res) {
    if (!res) {
        const finalDmgEl = document.getElementById('final-damage');
        if (finalDmgEl) finalDmgEl.innerText = '0';
        return;
    }

    const mapping = {
        'final-damage': Math.floor(res.finalDmg).toLocaleString(),
        'stat-atk': Math.floor(res.stats.finalAtk).toLocaleString(),
        'stat-crit': Math.floor(res.stats.critExp * 100) + '%',
        'val-crit-rate': res.stats.finalCritRate,
        'val-crit-dmg': res.stats.critDmg,
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

    // 활성 세트 UI 업데이트
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

    // FLIP Animation: First (기존 위치 기록)
    const currentItems = Array.from(box.children);
    const firstPositions = new Map();
    currentItems.forEach(child => {
        const name = child.querySelector('.comp-name')?.innerText;
        if (name) firstPositions.set(name, child.getBoundingClientRect());
    });

    // 비교용 설정값 읽기
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

    // 원본 상태 복구
    state.mainOp.wepId = savedWepId;
    state.mainOp.wepPot = savedWepPot;
    state.mainOp.wepState = savedWepState;

    // 새로운 HTML 생성
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

    // FLIP Animation: Last & Invert & Play
    requestAnimationFrame(() => {
        const newItems = Array.from(box.children);
        newItems.forEach(child => {
            const name = child.getAttribute('data-weapon-name');
            const firstRect = firstPositions.get(name);
            if (firstRect) {
                const lastRect = child.getBoundingClientRect();
                const deltaY = firstRect.top - lastRect.top;

                if (deltaY !== 0) {
                    // Invert: 새 위치에서 옛 위치로 강제 이동 (transition 없이)
                    child.style.transition = 'none';
                    child.style.transform = `translateY(${deltaY}px)`;

                    // Play: 다음 프레임에서 transition과 함께 원위치(translateY(0))로 복구
                    requestAnimationFrame(() => {
                        child.style.transition = '';
                        child.style.transform = '';
                    });
                }
            } else {
                // 새로 등장하는 아이템은 fade-in 효과
                child.style.opacity = '0';
                requestAnimationFrame(() => {
                    child.style.opacity = '1';
                });
            }
        });
    });
}
