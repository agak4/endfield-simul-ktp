/**
 * ui/preset.js — 프리셋 기능 관리
 * 
 * [역할]
 * - 모달 창의 프리셋 목록을 렌더링하고,
 * - 현재 메인 오퍼레이터의 잠재효과, 무기, 장비 상태를 localStorage에 슬롯 별로 저장/불러오기 한다.
 */

function getPresetKey(opId) {
    return `opPreset_${opId}`;
}

function loadPresets(opId) {
    const data = localStorage.getItem(getPresetKey(opId));
    if (data) {
        try {
            return JSON.parse(data);
        } catch (e) {
            console.error('Failed to parse preset', e);
        }
    }
    return new Array(10).fill(null);
}

function savePresets(opId, presets) {
    localStorage.setItem(getPresetKey(opId), JSON.stringify(presets));
}

function togglePresetPopup(btn) {
    if (!state || !state.mainOp || !state.mainOp.id) {
        alert('메인 오퍼레이터를 먼저 선택해주세요.');
        return;
    }

    const popup = document.getElementById('preset-popup');
    if (!popup) return;

    if (popup.classList.contains('open')) {
        closePresetPopup();
        return;
    }

    const opData = DATA_OPERATORS.find(o => o.id === state.mainOp.id);
    const opNameEl = document.getElementById('preset-op-name');
    if (opNameEl) opNameEl.innerText = opData ? opData.name : '';

    if (window.innerWidth >= 1024) {
        // 위치 계산 (페이지 단위 절대 좌표)
        const rect = btn.getBoundingClientRect();
        const margin = 10;

        popup.style.top = `${rect.top + window.scrollY}px`;
        popup.style.left = `${rect.right + window.scrollX + margin}px`;

        // 화면 우측을 벗어나는지 체크
        const popupWidth = 620; // CSS width
        if (rect.right + margin + popupWidth > window.innerWidth) {
            popup.style.left = `${rect.left + window.scrollX - popupWidth - margin}px`;
        }
        popup.style.transform = '';
    } else {
        // 모달 모드: 인라인 스타일 제거하여 CSS 미디어 쿼리 적용
        popup.style.top = '';
        popup.style.left = '';
        popup.style.transform = '';
    }

    popup.classList.add('open');
    renderPresetList(state.mainOp.id);

    // 외부 클릭 시 닫기 (이벤트 전파 방지 필요)
    setTimeout(() => {
        window.onclick = function (e) {
            if (!popup.contains(e.target) && e.target !== btn) {
                closePresetPopup();
            }
        };
    }, 0);
}

function closePresetPopup() {
    const popup = document.getElementById('preset-popup');
    if (popup) popup.classList.remove('open');
    window.onclick = null;
}

function renderPresetList(opId) {
    const listEl = document.getElementById('preset-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    const presets = loadPresets(opId);

    // 계산 기준점을 위해 현재 상태로 데미지를 먼저 구합니다
    const baseCalc = (typeof calculateDamage === 'function') ? calculateDamage(state) : null;
    const currentResult = (baseCalc && typeof calculateCycleDamage === 'function') ? calculateCycleDamage(state, baseCalc) : null;
    const currentTotalDmg = currentResult ? currentResult.total : 0;

    for (let i = 0; i < 10; i++) {
        const p = presets[i];
        const slotEl = document.createElement('div');
        slotEl.className = 'preset-slot';

        if (!p) {
            slotEl.classList.add('empty');
            slotEl.innerText = `[${i + 1}] 빈 슬롯 - 클릭하여 보관`;
            slotEl.onclick = () => savePreset(opId, i);
        } else {
            // 무기 및 아이콘 경로 설정
            let wepImgSrc = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            if (p.wepId && typeof DATA_WEAPONS !== 'undefined') {
                const w = DATA_WEAPONS.find(x => x.id === p.wepId);
                // URL safe encode needed if names have spaces
                if (w) wepImgSrc = `images/weapons/${w.name}.webp`;
            }

            let gearSrcs = [null, null, null, null].map((_, idx) => {
                const gId = p.gears && p.gears[idx];
                if (gId && typeof DATA_GEAR !== 'undefined') {
                    const g = DATA_GEAR.find(x => x.id === gId);
                    if (g) return `images/gears/${g.name}.webp`;
                }
                return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            });

            // 데미지 차이 계산
            let diffHtml = '<span class="preset-dmg neutral">-</span>';
            if (currentResult && typeof deepClone === 'function') {
                const clonedState = deepClone(state);
                Object.assign(clonedState.mainOp, p);

                // 복원된 상태에서 임시 캐시를 비워서 정상적으로 데미지를 구할 수 있도록 함
                clonedState._subStatsCache = null;

                const pBase = calculateDamage(clonedState);
                const pResult = (pBase && typeof calculateCycleDamage === 'function') ? calculateCycleDamage(clonedState, pBase) : null;
                const pDmg = pResult ? pResult.total : 0;

                const diff = pDmg - currentTotalDmg;

                if (diff > 0) {
                    diffHtml = `<span class="preset-dmg positive">+${diff.toLocaleString()}</span>`;
                } else if (diff < 0) {
                    diffHtml = `<span class="preset-dmg negative">${diff.toLocaleString()}</span>`;
                } else {
                    diffHtml = `<span class="preset-dmg neutral">변화 없음</span>`;
                }
            }

            slotEl.innerHTML = `
                <div class="preset-row-first">
                    <span class="preset-number">#${i + 1}</span>
                    <div class="preset-icons">
                        <div class="preset-icon" 
                             data-tooltip-id="${p.wepId || ''}" 
                             data-tooltip-type="weapon" 
                             data-tooltip-pot="${p.wepPot || 0}">
                            <img src="${wepImgSrc}" class="loaded" alt="wep">
                        </div>
                        ${gearSrcs.map((src, idx) => {
                const gId = p.gears && p.gears[idx];
                const isForged = p.gearForged && p.gearForged[idx];
                return `
                                <div class="preset-icon" 
                                     data-tooltip-id="${gId || ''}" 
                                     data-tooltip-type="gear" 
                                     data-tooltip-forged="${isForged ? 'true' : 'false'}">
                                    <img src="${src}" class="loaded" alt="gear">
                                </div>`;
            }).join('')}
                    </div>
                    <div class="preset-dmg-wrap">${diffHtml}</div>
                </div>
                <div class="preset-row-second">
                    <div class="preset-name-wrap">
                        <input type="text" class="preset-name-input" id="preset-name-${i}"
                               placeholder="프리셋 이름" 
                               value="${p.name || ''}" 
                               onclick="event.stopPropagation()">
                        <button class="btn-preset-name-save" onclick="updatePresetName('${opId}', ${i}, document.getElementById('preset-name-${i}').value)">저장</button>
                    </div>
                    <div class="preset-actions">
                        <button class="btn-preset save" onclick="savePreset('${opId}', ${i})">덮어쓰기</button>
                        <button class="btn-preset load" onclick="loadPreset('${opId}', ${i})">불러오기</button>
                        <button class="btn-preset clear" onclick="clearPreset('${opId}', ${i})">삭제</button>
                    </div>
                </div>
            `;
        }
        listEl.appendChild(slotEl);
    }
}

function savePreset(opId, index) {
    if (!state || !state.mainOp || opId !== state.mainOp.id) return;

    // 클릭 이벤트가 버블링될 수 있으므로, 해당 인덱스의 빈 슬롯 클릭 시 방지 차원
    window.event?.stopPropagation();

    const presets = loadPresets(opId);
    const existingName = presets[index] ? presets[index].name : '';

    const presetData = {
        name: existingName,
        pot: state.mainOp.pot,
        wepId: state.mainOp.wepId,
        wepPot: state.mainOp.wepPot,
        wepState: state.mainOp.wepState,
        gears: [...state.mainOp.gears],
        gearForge: state.mainOp.gearForge,
        gearForged: [...state.mainOp.gearForged]
    };

    presets[index] = presetData;
    savePresets(opId, presets);
    renderPresetList(opId);
}

function loadPreset(opId, index) {
    if (!state || !state.mainOp || opId !== state.mainOp.id) return;

    window.event?.stopPropagation();

    const presets = loadPresets(opId);
    const p = presets[index];
    if (!p) return;

    // 1. 잠재효과 적용
    const opPotEl = document.getElementById('main-op-pot');
    if (opPotEl) {
        opPotEl.value = p.pot;
        if (typeof setupPotencyButtons === 'function') setupPotencyButtons('main-op-pot', 'main-op-pot-group');
    }

    // 2. 무기 선택 및 적용
    const wepSel = document.getElementById('main-wep-select');
    if (wepSel) {
        // 무기 목록에 해당 무기가 있는지(사실 메인 오퍼에 귀속되므로 무조건 있음) 확인
        if (p.wepId && wepSel.querySelector(`option[value="${p.wepId}"]`)) {
            wepSel.value = p.wepId;
            const w = (typeof DATA_WEAPONS !== 'undefined') ? DATA_WEAPONS.find(x => x.id === p.wepId) : null;
            if (typeof setSelectBtnText === 'function') setSelectBtnText('main-wep-select-btn', w);
            if (typeof updateEntityImage === 'function') updateEntityImage(p.wepId, 'main-wep-image', 'weapons');
        } else if (!p.wepId) {
            wepSel.value = '';
            if (typeof setSelectBtnText === 'function') setSelectBtnText('main-wep-select-btn', null);
            if (typeof updateEntityImage === 'function') updateEntityImage(null, 'main-wep-image', 'weapons');
        }
    }

    // 3. 무기 잠재효과 및 기질 적용
    const wepPotEl = document.getElementById('main-wep-pot');
    if (wepPotEl) {
        wepPotEl.value = p.wepPot || 0;
        if (typeof setupPotencyButtons === 'function') setupPotencyButtons('main-wep-pot', 'main-wep-pot-group');
    }

    const wStateCb = document.getElementById('main-wep-state');
    const wStateBtn = document.getElementById('main-wep-toggle');
    if (wStateCb) {
        wStateCb.checked = p.wepState || false;
        if (wStateBtn && typeof updateToggleButton === 'function') {
            updateToggleButton(wStateBtn, p.wepState || false, '기질');
        }
    }

    // 5. 단조 적용
    GEAR_FORGE_IDS.forEach((id, idx) => {
        const checked = p.gearForged && p.gearForged[idx] ? p.gearForged[idx] : false;
        const el = document.getElementById(id);
        if (el) {
            el.checked = checked;
            const toggleBtn = document.getElementById(id + '-toggle');
            if (toggleBtn && typeof updateToggleButton === 'function') updateToggleButton(toggleBtn, checked, '단조');
            if (typeof syncForgedToTooltip === 'function') syncForgedToTooltip(id, checked);
        }
    });

    // 5. 장비 적용
    GEAR_SELECT_IDS.forEach((id, idx) => {
        const el = document.getElementById(id);
        const val = p.gears && p.gears[idx] ? p.gears[idx] : '';
        if (el) {
            el.value = val;
            if (typeof updateEntityImage === 'function') updateEntityImage(val, id.replace('-select', '-image'), 'gears');
        }
    });

    const mainGearForgeCb = document.getElementById('main-gear-forge');
    const mainForgeToggleBtn = document.getElementById('main-forge-toggle');
    if (mainGearForgeCb) {
        mainGearForgeCb.checked = p.gearForge || false;
        if (mainForgeToggleBtn && typeof updateToggleButton === 'function') {
            updateToggleButton(mainForgeToggleBtn, p.gearForge || false, '전체 단조');
        }
    }

    // state 업데이트 및 렌더링 파이프라인 진행
    if (typeof updateState === 'function') updateState();

    // 방금 목록을 클릭해서 불러왔으니 계산기준점이 바뀌었으므로 리스트를 다시 그린다
    renderPresetList(opId);
}

function clearPreset(opId, index) {
    if (confirm('이 슬롯의 프리셋을 삭제하시겠습니까?')) {
        window.event?.stopPropagation();
        const presets = loadPresets(opId);
        presets[index] = null;
        savePresets(opId, presets);
        renderPresetList(opId);
    }
}

function updatePresetName(opId, index, newName) {
    const presets = loadPresets(opId);
    if (presets[index]) {
        presets[index].name = newName;
        savePresets(opId, presets);
    } else {
        // 프리셋이 없는데 이름만 넣는 경우, 현재 상태를 저장하면서 이름 부여
        const presetData = {
            name: newName,
            pot: state.mainOp.pot,
            wepId: state.mainOp.wepId,
            wepPot: state.mainOp.wepPot,
            wepState: state.mainOp.wepState,
            gears: [...state.mainOp.gears],
            gearForge: state.mainOp.gearForge,
            gearForged: [...state.mainOp.gearForged]
        };
        presets[index] = presetData;
        savePresets(opId, presets);
        renderPresetList(opId);
    }
}
