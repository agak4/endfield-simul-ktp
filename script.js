// ============ 전역 상태 ============
let state = {
    mainOp: {
        id: null, pot: 0,
        wepId: null, wepPot: 0, wepState: false,
        gearForge: false, gears: [null, null, null, null], gearForged: [false, false, false, false]
    },
    subOps: [
        { id: null, pot: 0, wepId: null, wepPot: 0, wepState: false, equipSet: null },
        { id: null, pot: 0, wepId: null, wepPot: 0, wepState: false, equipSet: null },
        { id: null, pot: 0, wepId: null, wepPot: 0, wepState: false, equipSet: null }
    ],
    enemyUnbalanced: false,
};

// ============ 페이지 초기화 ============
window.onload = function () {
    initUI();

    // 기본값 설정: 관리자, 장대한 염원
    const defaultOpId = 'Endministrator';
    const defaultWepId = 'Grand Vision';

    // 메인 오퍼레이터 설정
    document.getElementById('main-op-select').value = defaultOpId;
    const opData = DATA_OPERATORS.find(o => o.id === defaultOpId);
    if (opData) {
        document.getElementById('main-op-select-btn').innerText = opData.name;
        updateMainWeaponList(defaultOpId);
        updateEntityImage(defaultOpId, 'main-op-image', 'operators');
    }

    // 메인 무기 설정
    const wepSelect = document.getElementById('main-wep-select');
    if (wepSelect.querySelector(`option[value="${defaultWepId}"]`)) {
        wepSelect.value = defaultWepId;
        updateEntityImage(defaultWepId, 'main-wep-image', 'weapons');
    }

    // 메인 장비 기본값 설정 (응룡 50식 세트 예시)
    const defaultGears = [
        { id: 'gear-glove-select', val: 'gear_13' },
        { id: 'gear-armor-select', val: 'gear_16' },
        { id: 'gear-comp1-select', val: 'gear_11' },
        { id: 'gear-comp2-select', val: 'gear_12' }
    ];

    defaultGears.forEach(g => {
        const el = document.getElementById(g.id);
        if (el && el.querySelector(`option[value="${g.val}"]`)) {
            el.value = g.val;
            updateEntityImage(g.val, g.id.replace('-select', '-image'), 'gears');
        }
    });

    updateState();
}

// ============ UI 초기화 ============
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

    document.getElementById('main-wep-select').onchange = (e) => {
        updateEntityImage(e.target.value, 'main-wep-image', 'weapons');
        updateState();
    };
}

function setupSubOperatorEvents(i) {
    const opSel = document.getElementById(`sub-${i}-op`);
    opSel.add(new Option('-', ''));
    DATA_OPERATORS.forEach(op => opSel.add(new Option(op.name, op.id)));

    const wepSel = document.getElementById(`sub-${i}-wep`);
    wepSel.add(new Option('-', ''));

    const setSel = document.getElementById(`sub-${i}-set`);
    DATA_SETS.forEach(s => setSel.add(new Option(s.name, s.id)));

    setupOperatorSelect(`sub-${i}-op`, `sub-${i}-op-btn`, (opId) => {
        updateSubWeaponList(i, opId);
        updateEntityImage(opId, `sub-${i}-image`, 'operators');
        const opName = DATA_OPERATORS.find(o => o.id === opId)?.name || '';
        document.getElementById(`sub-${i}-summary`).innerText = opName;
        updateState();
    });

    if (wepSel) {
        wepSel.onchange = (e) => {
            updateEntityImage(e.target.value, `sub-${i}-wep-image`, 'weapons');
            updateState();
        };
    }

    setupPotencyButtons(`sub-${i}-pot`, `sub-${i}-pot-group`);

    const potGroup = document.getElementById(`sub-${i}-pot-group`);
    if (potGroup && potGroup.parentNode) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'potency-btn';
        removeBtn.innerText = 'X';
        removeBtn.style.marginLeft = '10px';
        removeBtn.style.color = '#ff4d4d';
        removeBtn.title = '선택 해제';
        removeBtn.onclick = () => {
            const sel = document.getElementById(`sub-${i}-op`);
            sel.value = '';
            document.getElementById(`sub-${i}-op-btn`).innerText = '선택하세요';
            document.getElementById(`sub-${i}-summary`).innerText = '';
            updateEntityImage('', `sub-${i}-image`, 'operators');

            const wSel = document.getElementById(`sub-${i}-wep`);
            wSel.innerHTML = '';
            wSel.add(new Option('-', ''));
            wSel.value = '';
            updateEntityImage('', `sub-${i}-wep-image`, 'weapons');

            updateState();
        };
        potGroup.parentNode.appendChild(removeBtn);
    }

    setupPotencyButtons(`sub-${i}-wep-pot`, `sub-${i}-wep-pot-group`);
    setupToggleButton(`sub-${i}-wep-state`, `sub-${i}-wep-toggle`, '기질');
    document.getElementById(`sub-${i}-set`).onchange = updateState;
}

function setupOperatorSelect(selectId, btnId, onChangeInfo) {
    const sel = document.getElementById(selectId);
    const btn = document.getElementById(btnId);

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
    closeBtn.onclick = closeModal;
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
    if (content.classList.contains('collapsed')) {
        content.classList.remove('collapsed');
    } else {
        content.classList.add('collapsed');
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
            mainForgeCb.checked = allOn;
            if (mainForgeToggle) updateToggleButton(mainForgeToggle, mainForgeCb.checked, '단조');
            updateState();
        };
        cb.parentNode.appendChild(btn);
        updateToggleButton(btn, cb.checked, '단조');
    });
}

function getValidWeapons(opId) {
    if (!opId) return [];
    const op = DATA_OPERATORS.find(o => o.id === opId);
    if (!op || !op.usableWeapons) return [];
    return DATA_WEAPONS.filter(w => op.usableWeapons.includes(w.type));
}

function updateMainWeaponList(opId) {
    const validWeps = getValidWeapons(opId);
    renderSelect('main-wep-select', validWeps);

    if (validWeps.length > 0) {
        const firstWepId = validWeps[0].id;
        document.getElementById('main-wep-select').value = firstWepId;
        updateEntityImage(firstWepId, 'main-wep-image', 'weapons');
    } else {
        updateEntityImage(null, 'main-wep-image', 'weapons');
    }
}

function updateSubWeaponList(idx, opId) {
    const sel = document.getElementById(`sub-${idx}-wep`);
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

function updateState() {
    state.mainOp.id = document.getElementById('main-op-select').value;
    state.mainOp.pot = Number(document.getElementById('main-op-pot').value);
    state.mainOp.wepId = document.getElementById('main-wep-select').value;
    state.mainOp.wepPot = Number(document.getElementById('main-wep-pot').value);
    state.mainOp.wepState = document.getElementById('main-wep-state').checked;
    state.mainOp.gearForge = document.getElementById('main-gear-forge').checked;

    state.mainOp.gears[0] = document.getElementById('gear-glove-select')?.value || null;
    state.mainOp.gears[1] = document.getElementById('gear-armor-select')?.value || null;
    state.mainOp.gears[2] = document.getElementById('gear-comp1-select')?.value || null;
    state.mainOp.gears[3] = document.getElementById('gear-comp2-select')?.value || null;

    state.mainOp.gearForged[0] = document.getElementById('gear-glove-forge')?.checked || false;
    state.mainOp.gearForged[1] = document.getElementById('gear-armor-forge')?.checked || false;
    state.mainOp.gearForged[2] = document.getElementById('gear-comp1-forge')?.checked || false;
    state.mainOp.gearForged[3] = document.getElementById('gear-comp2-forge')?.checked || false;

    for (let i = 0; i < 3; i++) {
        state.subOps[i].id = document.getElementById(`sub-${i}-op`).value;
        state.subOps[i].pot = Number(document.getElementById(`sub-${i}-pot`).value);
        state.subOps[i].wepId = document.getElementById(`sub-${i}-wep`).value;
        state.subOps[i].wepPot = Number(document.getElementById(`sub-${i}-wep-pot`).value);
        state.subOps[i].wepState = document.getElementById(`sub-${i}-wep-state`).checked;
        state.subOps[i].equipSet = document.getElementById(`sub-${i}-set`).value;
    }

    const enemyCb = document.getElementById('enemy-unbalanced');
    state.enemyUnbalanced = enemyCb ? enemyCb.checked : false;

    const result = calculateDamage(state);
    renderResult(result);
    renderWeaponComparison(result ? result.finalDmg : 0);
}

function isSubOpTargetValid(effect) {
    if (!effect) return false;
    if (effect.target === '팀') return true;
    if (effect.target === '적') return true;
    return false;
}

function isApplicableEffect(opData, effectType, effectName) {
    if (!effectType) return false;
    const typeStr = effectType.toString();

    if (['공격력 증가', '치명타 확률', '치명타 피해', '최대 체력', '궁극기 충전', '치유 효율', '연타', '주는 피해', '스탯', '스탯%'].includes(typeStr)) return true;

    if (typeStr === '물리 피해' && opData.type === 'phys') return true;
    if (typeStr === '아츠 피해' && opData.type === 'arts') return true;
    if (typeStr === '열기 피해' && opData.element === 'heat') return true;
    if (typeStr === '냉기 피해' && opData.element === 'cryo') return true;
    if (typeStr === '전기 피해' && opData.element === 'elec') return true;
    if (typeStr === '자연 피해' && opData.element === 'nature') return true;
    if (typeStr === '불균형 피해') return true;

    if (typeStr.endsWith('증폭')) {
        const prefix = typeStr.replace(' 증폭', '');
        if (prefix === '피해' || prefix === '모든') return true;
        if (prefix === '물리' && opData.type === 'phys') return true;
        if (prefix === '아츠' && opData.type === 'arts') return true;
        if (prefix === '열기' && opData.element === 'heat') return true;
        if (prefix === '냉기' && opData.element === 'cryo') return true;
        if (prefix === '전기' && opData.element === 'elec') return true;
        if (prefix === '자연' && opData.element === 'nature') return true;
        if (prefix === '아츠 피해' && opData.type === 'arts') return true;
    }

    if (typeStr.includes('받는') || typeStr.endsWith('취약')) {
        if (typeStr === '아츠 취약' && opData.type === 'arts') return true;

        let prefix = typeStr.replace('받는 ', '').replace(' 피해', '').replace(' 취약', '');
        if (prefix === '모든') return true;
        if (prefix === '물리' && opData.type === 'phys') return true;
        if (prefix === '아츠' && opData.type === 'arts') return true;
        if (prefix === '열기' && opData.element === 'heat') return true;
        if (prefix === '냉기' && opData.element === 'cryo') return true;
        if (prefix === '전기' && opData.element === 'elec') return true;
        if (prefix === '자연' && opData.element === 'nature') return true;
    }

    if (typeStr.includes('스킬 피해') || typeStr.includes('궁극기 피해')) return true;
    if (typeStr === '오리지늄 아츠' || typeStr === '오리지늄 아츠 강도') return true;

    return false;
}

function calculateDamage(currentState) {
    const opData = DATA_OPERATORS.find(o => o.id === currentState.mainOp.id);
    const wepData = DATA_WEAPONS.find(w => w.id === currentState.mainOp.wepId);

    if (!opData || !wepData) return null;

    const statMap = { '힘': 'str', '민첩': 'agi', '지능': 'int', '의지': 'wil' };
    let stats = { ...opData.stats };

    let allEffects = [];

    const addEffect = (source, name, forgeMult = 1.0, isSub = false) => {
        if (!source) return;

        if (isSub) {
            if (Array.isArray(source)) {
                source.forEach(eff => {
                    if (eff && isSubOpTargetValid(eff)) {
                        allEffects.push({ ...eff, name, forgeMult });
                    }
                });
            } else {
                if (isSubOpTargetValid(source)) {
                    allEffects.push({ ...source, name, forgeMult });
                }
            }
            return;
        }

        if (Array.isArray(source)) {
            source.forEach(eff => {
                if (eff) allEffects.push({ ...eff, name, forgeMult });
            });
        } else {
            allEffects.push({ ...source, name, forgeMult });
        }
    };

    for (let i = 0; i < currentState.mainOp.gears.length; i++) {
        const gId = currentState.mainOp.gears[i];
        if (!gId) continue;
        const gear = DATA_GEAR.find(g => g.id === gId);
        if (gear) {
            const mult = currentState.mainOp.gearForged && currentState.mainOp.gearForged[i] ? 1.5 : 1.0;
            const s1 = statMap[gear.stat1];
            const s2 = statMap[gear.stat2];
            if (s1 && stats[s1] !== undefined) stats[s1] += gear.val1 * mult;
            if (s2 && stats[s2] !== undefined) stats[s2] += gear.val2 * mult;
            if (gear.trait) addEffect(gear.trait, gear.name, mult);
        }
    }

    wepData.traits.forEach((trait, idx) => {
        if (!trait) return;
        let finalTrait = { ...trait };
        let label = idx >= 2 ? `${wepData.name} 특성3` : `${wepData.name} 특성${idx + 1}`;

        let finalLv;
        if (idx === 0 || idx === 1) {
            finalLv = currentState.mainOp.wepState ? 9 : 3;
        } else {
            const baseLv = currentState.mainOp.wepState ? 4 : 1;
            finalLv = baseLv + currentState.mainOp.wepPot;
        }
        label += `(Lv${finalLv})`;

        let val;
        if (trait.valByLevel && Array.isArray(trait.valByLevel)) {
            const levelIndex = Math.min(finalLv - 1, trait.valByLevel.length - 1);
            val = trait.valByLevel[levelIndex];
        } else if (trait.valStep !== undefined) {
            val = trait.valBase + (trait.valStep * (finalLv - 1));
        } else if (trait.valBase !== undefined && trait.valMax !== undefined) {
            const progress = (finalLv - 1) / 8;
            val = trait.valBase + (trait.valMax - trait.valBase) * progress;
        } else {
            val = currentState.mainOp.wepState ? trait.valMax : trait.valBase;
        }

        if (trait.type === '스탯') {
            const targetStat = trait.stat === '주스탯' ? opData.mainStat :
                trait.stat === '부스탯' ? opData.subStat : trait.stat;

            if (idx >= 2) {
                addEffect({ type: '스탯%', stat: targetStat, val: val }, label);
            } else {
                addEffect({ type: '스탯', stat: targetStat, val: val }, label);
            }
            return;
        }

        finalTrait.val = val;
        addEffect(finalTrait, label);
    });

    const skillNames = ['배틀스킬', '연계스킬', '궁극기'];
    if (opData.skill) opData.skill.forEach((s, i) => addEffect(s, `${opData.name} ${skillNames[i] || `스킬${i + 1}`}`));
    if (opData.talents) opData.talents.forEach((t, i) => addEffect(t, `${opData.name} 재능${i + 1}`));
    const mainPot = Number(currentState.mainOp.pot) || 0;
    for (let p = 0; p < mainPot; p++) {
        if (opData.potential && opData.potential[p]) addEffect(opData.potential[p], `${opData.name} 잠재${p + 1}`);
    }

    currentState.subOps.forEach((sub, idx) => {
        if (!sub.id) return;
        const subOpData = DATA_OPERATORS.find(o => o.id === sub.id);
        const prefix = subOpData ? subOpData.name : `서브${idx + 1}`;

        if (sub.wepId) {
            const sWep = DATA_WEAPONS.find(w => w.id === sub.wepId);
            if (sWep) {
                for (let ti = 1; ti < sWep.traits.length; ti++) {
                    const trait = sWep.traits[ti];
                    if (!trait) continue;
                    let val;
                    if (trait.valByLevel) {
                        const baseLv = sub.wepState ? 4 : 1;
                        const finalLv = baseLv + (sub.wepPot || 0);
                        const levelIndex = Math.min(finalLv - 1, trait.valByLevel.length - 1);
                        val = trait.valByLevel[levelIndex];
                    } else if (trait.valStep !== undefined) {
                        const baseLv = sub.wepState ? 4 : 1;
                        const finalLv = baseLv + (sub.wepPot || 0);
                        val = trait.valBase + (trait.valStep * (finalLv - 1));
                    } else {
                        val = sub.wepState ? trait.valMax : trait.valBase || trait.val;
                    }
                    addEffect({ ...trait, val }, `${prefix} 무기특성${ti + 1}`, 1.0, true);
                }
            }
        }

        if (sub.equipSet) {
            const set = DATA_SETS.find(s => s.id === sub.equipSet);
            if (set && set.effect) {
                let active = true;
                if (set.effect.cond === 'arts_only' && subOpData.type !== 'arts') active = false;
                if (set.effect.cond === 'phys_only' && subOpData.type !== 'phys') active = false;

                if (active) {
                    addEffect(set.effect, `${prefix} 세트`, 1.0, true);
                }
            }
        }

        if (subOpData) {
            if (subOpData.skill) subOpData.skill.forEach((s, i) => {
                const skillName = skillNames[i] || `스킬${i + 1}`;
                addEffect(s, `${prefix} ${skillName}`, 1.0, true);
            });
            if (subOpData.talents) subOpData.talents.forEach((t, i) => addEffect(t, `${prefix} 재능${i + 1}`, 1.0, true));

            const subPot = Number(sub.pot) || 0;
            for (let sp = 0; sp < subPot; sp++) {
                if (subOpData.potential && subOpData.potential[sp]) {
                    addEffect(subOpData.potential[sp], `${prefix} 잠재${sp + 1}`, 1.0, true);
                }
            }
        }
    });

    let baseAtk = opData.baseAtk + wepData.baseAtk;

    let atkInc = 0;
    let critRate = 5;
    let critDmg = 50;
    let dmgInc = 0;
    let amp = 0;
    let vuln = 0;
    let takenDmg = 0;
    let multiHit = 1.0;
    let unbalanceDmg = 0;
    let originiumArts = 0;

    let logs = { atk: [], dmgInc: [], amp: [], vuln: [], taken: [], unbal: [], multihit: [], etc: [], crit: [], arts: [] };

    allEffects.forEach(eff => {
        if (eff.type === '스탯') {
            const forgeMult = eff.forgeMult || 1.0;
            const val = Number(eff.val) * forgeMult;
            const targetStat = eff.stat || eff.stats;

            if (targetStat === '모든 능력치') {
                ['힘', '민첩', '지능', '의지'].forEach(k => stats[statMap[k]] += val);
            } else {
                const sKey = statMap[targetStat] || targetStat;
                if (stats[sKey] !== undefined) {
                    stats[sKey] += val;
                }
            }
        }
    });

    let statPct = { str: 0, agi: 0, int: 0, wil: 0 };

    allEffects.forEach(eff => {
        if (eff.type === '스탯%') {
            const forgeMult = eff.forgeMult || 1.0;
            const val = Number(eff.val) * forgeMult;
            const targetStat = eff.stat || eff.stats;

            if (targetStat === '모든 능력치') {
                ['str', 'agi', 'int', 'wil'].forEach(k => statPct[k] += val);
            } else {
                const sKey = statMap[targetStat] || targetStat;
                if (statPct[sKey] !== undefined) {
                    statPct[sKey] += val;
                }
            }
        }
    });

    ['str', 'agi', 'int', 'wil'].forEach(k => {
        if (statPct[k] > 0) {
            stats[k] = stats[k] * (1 + statPct[k] / 100);
        }
    });

    const resolveVal = (val) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
            let statSum = 0;
            if (val.includes('힘')) statSum += stats['str'] || 0;
            if (val.includes('민첩')) statSum += stats['agi'] || 0;
            if (val.includes('지능')) statSum += stats['int'] || 0;
            if (val.includes('의지')) statSum += stats['wil'] || 0;

            const match = val.match(/([\d.]+)%/);
            if (match) {
                return statSum * parseFloat(match[1]);
            }
        }
        return 0;
    };

    allEffects.forEach(eff => {
        if (eff.type === '스탯' || eff.type === '스탯%') return;

        if (!isApplicableEffect(opData, eff.type, eff.name)) return;

        const forgeMult = eff.forgeMult || 1.0;
        const rawVal = resolveVal(eff.val);
        const finalVal = rawVal * forgeMult;
        const name = eff.name;
        const t = (eff.type || '').toString();

        if (t === '공격력 증가') {
            atkInc += finalVal;
        }
        else if (t === '치명타 확률') {
            critRate += finalVal;
            logs.crit.push(`[${name}] +${finalVal.toFixed(1)}% (치명타 확률)`);
        }
        else if (t === '치명타 피해') {
            critDmg += finalVal;
            logs.crit.push(`[${name}] +${finalVal.toFixed(1)}% (치명타 피해)`);
        }
        else if (t === '연타') {
            const val = eff.val ? eff.val : 1.2;
            if (val > multiHit) multiHit = val;
            logs.multihit.push(`[${name}] x${val} (연타)`);
        }
        else if (t.endsWith('증폭')) {
            amp += finalVal;
            logs.amp.push(`[${name}] +${finalVal.toFixed(1)}% (${t})`);
        }
        else if (t.endsWith('취약')) {
            vuln += finalVal;
            logs.vuln.push(`[${name}] +${finalVal.toFixed(1)}% (${t})`);
        }
        else if (t === '불균형 피해') {
            if (currentState.enemyUnbalanced) {
                unbalanceDmg += finalVal;
                logs.unbal.push(`${name}: +${finalVal.toFixed(1)}% (불균형)`);
            }
        }
        else if (t.includes('받는')) {
            takenDmg += finalVal;
            logs.taken.push(`[${name}] +${finalVal.toFixed(1)}% (${t})`);
        }
        else if (t.includes('피해') && !t.includes('받는') && !t.includes('증폭') && t !== '치명타 피해') {
            dmgInc += finalVal;
            logs.dmgInc.push(`[${name}] +${finalVal.toFixed(1)}% (${t})`);
        }
        else if (t === '오리지늄 아츠' || t === '오리지늄 아츠 강도') {
            originiumArts += finalVal;
            logs.arts.push(`[${name}] +${finalVal.toFixed(1)} (오리지늄 아츠 강도)`);
        }
        else if (t === '주는 피해' || t === '모든 스킬 피해') {
            dmgInc += finalVal;
            logs.dmgInc.push(`[${name}] +${finalVal.toFixed(1)}% (${t})`);
        }
    });

    const mainStatName = opData.mainStat === 'str' ? '힘' : opData.mainStat === 'agi' ? '민첩' : opData.mainStat === 'int' ? '지능' : '의지';
    const subStatName = opData.subStat === 'str' ? '힘' : opData.subStat === 'agi' ? '민첩' : opData.subStat === 'int' ? '지능' : '의지';

    const mainStatVal = stats[opData.mainStat];
    const subStatVal = stats[opData.subStat];
    const statBonusPct = (mainStatVal * 0.005) + (subStatVal * 0.002);
    const finalAtk = baseAtk * (1 + atkInc / 100) * (1 + statBonusPct);

    logs.atk.push(`오퍼레이터 공격력: ${opData.baseAtk.toLocaleString()}`);
    logs.atk.push(`무기 공격력: ${wepData.baseAtk.toLocaleString()}`);

    const statNameMap = { 'str': '힘', 'agi': '민첩', 'int': '지능', 'wil': '의지' };
    const getStatKo = (s) => statNameMap[s] || s;

    allEffects.filter(eff => eff.name.includes('특성') && (eff.type === '공격력 증가' || eff.type === '스탯' || eff.type === '스탯%')).forEach(eff => {
        const forgeMult = eff.forgeMult || 1.0;
        const finalVal = resolveVal(eff.val) * forgeMult;
        let valStr = finalVal.toFixed(1);

        if (eff.type === '공격력 증가') {
            valStr += '% (공격력)';
        } else if (eff.type === '스탯%') {
            valStr += `% (${getStatKo(eff.stat)} 증가)`;
        } else if (eff.type === '스탯') {
            valStr += ` (${getStatKo(eff.stat)})`;
        }

        logs.atk.push(`[${eff.name}] +${valStr}`);
    });

    logs.atk.push(`스탯 공격보너스: +${(statBonusPct * 100).toFixed(2)}%`);

    logs.atk.push(`주스탯 (${mainStatName}): ${Math.floor(mainStatVal)}`);
    logs.atk.push(`부스탯 (${subStatName}): ${Math.floor(subStatVal)}`);

    allEffects.filter(eff => (eff.type === '공격력 증가') && !eff.name.includes('특성')).forEach(eff => {
        const forgeMult = eff.forgeMult || 1.0;
        const finalVal = resolveVal(eff.val) * forgeMult;
        logs.atk.push(`[${eff.name}] +${finalVal.toFixed(1)}% (공격력)`);
    });

    const finalCritRate = Math.min(Math.max(critRate, 0), 100);
    const critExp = ((finalCritRate / 100) * (critDmg / 100)) + 1;

    const multDmgInc = 1 + (dmgInc / 100);
    const multAmp = 1 + (amp / 100);
    const multTaken = 1 + (takenDmg / 100);
    const multVuln = 1 + (vuln / 100);

    let finalUnbalanceDmg = unbalanceDmg;
    if (currentState.enemyUnbalanced) {
        finalUnbalanceDmg += 30;
        logs.unbal.push(`[불균형 기본] +30.0% (불균형 피해)`);
    }
    const multUnbal = 1 + (finalUnbalanceDmg / 100);

    const finalDmg = finalAtk * critExp * multDmgInc * multAmp * multTaken * multVuln * multiHit * multUnbal;

    return {
        finalDmg,
        stats: { finalAtk, critExp, finalCritRate, critDmg, dmgInc, amp, vuln, takenDmg, unbalanceDmg: finalUnbalanceDmg, originiumArts },
        logs
    };
}

function renderResult(res) {
    if (!res) {
        document.getElementById('final-damage').innerText = '0';
        return;
    }
    document.getElementById('final-damage').innerText = Math.floor(res.finalDmg).toLocaleString();
    document.getElementById('stat-atk').innerText = Math.floor(res.stats.finalAtk).toLocaleString();
    document.getElementById('stat-crit').innerText = Math.floor(res.stats.critExp * 100) + '%';
    document.getElementById('val-crit-rate').innerText = res.stats.finalCritRate;
    document.getElementById('val-crit-dmg').innerText = res.stats.critDmg;
    document.getElementById('stat-dmg-inc').innerText = res.stats.dmgInc.toFixed(1) + '%';
    document.getElementById('stat-amp').innerText = res.stats.amp.toFixed(1) + '%';
    document.getElementById('stat-vuln').innerText = res.stats.vuln.toFixed(1) + '%';
    document.getElementById('stat-taken').innerText = res.stats.takenDmg.toFixed(1) + '%';
    document.getElementById('stat-unbal').innerText = res.stats.unbalanceDmg.toFixed(1) + '%';
    document.getElementById('stat-arts').innerText = res.stats.originiumArts.toFixed(1);

    const multihitSpan = document.getElementById('stat-multihit');
    if (multihitSpan) multihitSpan.innerText = (res.logs.multihit.length > 0 ? "ON" : "OFF");

    renderLog('list-atk', res.logs.atk);
    renderLog('list-crit', res.logs.crit);
    renderLog('list-dmg-inc', res.logs.dmgInc);
    renderLog('list-amp', res.logs.amp);
    renderLog('list-vuln', res.logs.vuln);
    renderLog('list-taken', res.logs.taken);
    renderLog('list-unbal', res.logs.unbal);
    renderLog('list-multihit', res.logs.multihit);
    renderLog('list-arts', res.logs.arts);
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
    box.innerHTML = '';
    if (!state.mainOp.id) return;

    const currentOp = DATA_OPERATORS.find(o => o.id === state.mainOp.id);
    const savedWepId = state.mainOp.wepId;
    const validWeapons = DATA_WEAPONS.filter(w => currentOp.usableWeapons.includes(w.type));

    const comparisons = validWeapons.map(w => {
        state.mainOp.wepId = w.id;
        const res = calculateDamage(state);
        if (!res) return null;
        const diff = res.finalDmg - currentDmg;
        const pct = currentDmg > 0 ? ((diff / currentDmg) * 100).toFixed(1) : 0;
        return { name: w.name, pct: Number(pct) };
    }).filter(x => x).sort((a, b) => b.pct - a.pct);

    state.mainOp.wepId = savedWepId;

    comparisons.forEach(item => {
        const div = document.createElement('div');
        const sign = item.pct > 0 ? '+' : '';
        const cls = item.pct >= 0 ? 'positive' : 'negative';
        div.className = `comp-item ${cls}`;
        div.innerHTML = `<span>${item.name}</span> <span>${sign}${item.pct}%</span>`;
        box.appendChild(div);
    });
}
