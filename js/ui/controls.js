/**
 * ui/controls.js — UI 컨트롤 (버튼, 토글, 잠재, 이미지)
 *
 * [역할]
 * - 잠재 레벨 버튼 그룹, 기질/단조 토글 버튼을 생성하고 관리한다.
 * - 엔티티(오퍼레이터/무기/장비) 이미지를 업데이트하고 툴팁 데이터 속성을 동기화한다.
 * - 서브 오퍼레이터 카드의 접기/펼치기를 제어한다.
 * - select 요소에 옵션을 채우는 유틸리티 함수(renderSelect)를 제공한다.
 *
 * [의존]
 * - state.js   : GEAR_FORGE_IDS, updateState
 * - data_*.js  : DATA_OPERATORS, DATA_WEAPONS, DATA_GEAR
 *
 * [내부 규칙]
 * - setupToggleButton()은 체크박스를 숨기고 버튼을 DOM에 동적으로 삽입한다.
 *   이미 버튼이 삽입된 요소에 중복 호출하지 않도록 초기화 시점을 주의한다.
 * - updateEntityImage()는 entityId가 빈 문자열이거나 null이면 이미지를 숨기고
 *   툴팁 속성을 제거한다. 이 함수가 이미지 관련 모든 상태의 단일 진입점이다.
 * - syncPotencyToTooltip / syncForgedToTooltip은 툴팁 표시를 위한 데이터 속성만
 *   업데이트하며, state를 직접 수정하지 않는다.
 */

// ============ UI 컨트롤 (버튼, 토글, 잠재, 이미지) ============

/**
 * 잠재 레벨 선택 버튼 그룹을 렌더링한다 (0~5).
 * 버튼 클릭 시 hidden input 값을 갱신하고 updateState()를 호출한다.
 *
 * @param {string} inputId - 연결된 hidden number input의 ID
 * @param {string} groupId - 버튼을 삽입할 컨테이너 div의 ID
 */
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

/**
 * 잠재 레벨 변경 시 연결된 이미지 요소의 data-tooltip-pot 속성을 갱신한다.
 * 툴팁이 현재 잠재 레벨을 반영하도록 동기화하기 위함이다.
 *
 * @param {string} inputId  - 잠재 레벨 input의 ID
 * @param {number} potValue - 새로운 잠재 레벨 값
 */
function syncPotencyToTooltip(inputId, potValue) {
    let targetImgId = '';
    if (inputId === 'main-op-pot') targetImgId = 'main-op-image';
    else if (inputId === 'main-wep-pot') targetImgId = 'main-wep-image';
    else if (inputId.includes('sub-')) targetImgId = inputId.replace('-pot', '-image');

    if (targetImgId) {
        const img = document.getElementById(targetImgId);
        if (img) img.setAttribute('data-tooltip-pot', potValue);
    }
}

/**
 * 단조 체크박스 변경 시 연결된 장비 이미지의 data-tooltip-forged 속성을 갱신한다.
 *
 * @param {string}  checkboxId - 단조 checkbox 요소의 ID
 * @param {boolean} isForged   - 단조 ON/OFF
 */
function syncForgedToTooltip(checkboxId, isForged) {
    // 체크박스 ID → 이미지 ID 매핑
    const gearSlotMap = {
        'gear-gloves-forge': 'gear-gloves-image',
        'gear-armor-forge': 'gear-armor-image',
        'gear-kit1-forge': 'gear-kit1-image',
        'gear-kit2-forge': 'gear-kit2-image'
    };
    const imgId = gearSlotMap[checkboxId];
    if (imgId) {
        const img = document.getElementById(imgId);
        if (img) img.setAttribute('data-tooltip-forged', isForged);
    }
}

/**
 * 체크박스를 숨기고 토글 버튼을 DOM에 삽입한다.
 * 버튼 클릭 시 체크박스 값을 반전시키고 updateState()를 호출한다.
 *
 * @param {string} checkboxId - 원본 checkbox 요소의 ID
 * @param {string} buttonId   - 생성할 버튼에 부여할 ID
 * @param {string} label      - 버튼 텍스트에 표시할 레이블 (e.g. '기질', '단조')
 */
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

/**
 * 메인 단조 일괄 토글을 설정한다.
 * 메인 단조 버튼 클릭 시 모든 개별 슬롯 단조를 동시에 ON/OFF한다.
 */
function setupMainForgeToggle() {
    const mainForgeCb = document.getElementById('main-gear-forge');
    if (!mainForgeCb) return;
    mainForgeCb.style.display = 'none';

    const toggle = document.createElement('button');
    toggle.id = 'main-forge-toggle';
    toggle.className = 'toggle-btn';
    toggle.innerText = '단조: OFF';
    toggle.onclick = () => {
        mainForgeCb.checked = !mainForgeCb.checked;
        // 모든 슬롯 단조 체크박스 일괄 동기화
        GEAR_FORGE_IDS.forEach(gid => {
            const gcb = document.getElementById(gid);
            const gbtn = document.getElementById(gid + '-toggle');
            if (gcb) gcb.checked = mainForgeCb.checked;
            if (gbtn) updateToggleButton(gbtn, mainForgeCb.checked, '단조');
            syncForgedToTooltip(gid, mainForgeCb.checked);
        });
        updateToggleButton(toggle, mainForgeCb.checked, '단조');
        updateState();
    };
    mainForgeCb.parentNode.appendChild(toggle);
    updateToggleButton(toggle, mainForgeCb.checked, '단조');
}

/**
 * 장비 슬롯별 개별 단조 토글을 설정한다.
 * 모든 슬롯이 ON이면 메인 단조 버튼도 자동으로 ON 상태가 된다.
 */
function setupGearForgeToggles() {
    const mainForgeCb = document.getElementById('main-gear-forge');
    const mainForgeToggle = document.getElementById('main-forge-toggle');

    GEAR_FORGE_IDS.forEach(id => {
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
            syncForgedToTooltip(id, cb.checked);
            // 모든 슬롯이 ON인지 확인하여 메인 단조 버튼 상태를 갱신
            const allOn = GEAR_FORGE_IDS.every(gid => document.getElementById(gid)?.checked || false);
            if (mainForgeCb) mainForgeCb.checked = allOn;
            if (mainForgeToggle) updateToggleButton(mainForgeToggle, allOn, '단조');
            updateState();
        };
        cb.parentNode.appendChild(btn);
        updateToggleButton(btn, cb.checked, '단조');
        syncForgedToTooltip(id, cb.checked);
    });
}

/**
 * 토글 버튼의 텍스트와 active 클래스를 갱신한다.
 *
 * @param {HTMLButtonElement} btn       - 대상 버튼 요소
 * @param {boolean}           isChecked - 현재 ON/OFF 상태
 * @param {string}            label     - 버튼 레이블 (e.g. '기질', '단조')
 */
function updateToggleButton(btn, isChecked, label) {
    if (isChecked) {
        btn.classList.add('active');
        btn.innerText = `${label}: ON`;
    } else {
        btn.classList.remove('active');
        btn.innerText = `${label}: OFF`;
    }
}

/**
 * 서브 오퍼레이터 카드를 접거나 펼친다.
 * HTML의 onclick 속성에서 직접 호출되므로 전역에서 접근 가능해야 한다.
 *
 * @param {number} idx - 서브 오퍼레이터 인덱스 (0~2)
 */
function toggleSubOp(idx) {
    const content = document.getElementById(`sub-op-content-${idx}`);
    if (content) {
        content.classList.toggle('collapsed');
        if (typeof updateState === 'function') updateState();
    }
}

/**
 * 엔티티(오퍼레이터/무기/장비) 이미지를 업데이트하고 툴팁 속성을 동기화한다.
 *
 * - entityId가 없으면 이미지를 숨기고 툴팁 속성을 제거한다.
 * - 이미지 로드 실패(onerror) 시 자동으로 숨긴다.
 * - 오퍼레이터/무기는 희귀도 클래스(rarity-N)를 컨테이너에 적용한다.
 *
 * @param {string|null} entityId     - 엔티티 ID. null 또는 빈 문자열이면 이미지 숨김.
 * @param {string}      imgElementId - <img> 요소의 ID
 * @param {string}      folder       - 이미지 폴더명 ('operators' | 'weapons' | 'gears')
 */
function updateEntityImage(entityId, imgElementId, folder) {
    const imgElement = document.getElementById(imgElementId);
    if (!imgElement) return;

    const container = imgElement.parentElement;
    // 기존 희귀도 클래스 초기화
    if (container) container.classList.remove('rarity-6', 'rarity-5', 'rarity-4');

    if (!entityId) {
        imgElement.src = '';
        imgElement.style.display = 'none';
        return;
    }

    let fileName = '', rarity = 0;
    if (folder === 'operators') {
        const op = DATA_OPERATORS.find(o => o.id === entityId);
        fileName = op?.name;
        rarity = op?.rarity || 0;
    } else if (folder === 'weapons') {
        const wep = DATA_WEAPONS.find(w => w.id === entityId);
        fileName = wep?.name;
        rarity = wep?.rarity || 0;
    } else if (folder === 'gears') {
        fileName = DATA_GEAR.find(g => g.id === entityId)?.name;
    }

    if (fileName) {
        if (rarity && container) container.classList.add(`rarity-${rarity}`);

        imgElement.src = `images/${folder}/${fileName}.webp`;
        imgElement.style.display = 'block';

        // 툴팁용 데이터 속성 설정
        imgElement.setAttribute('data-tooltip-id', entityId);
        imgElement.setAttribute('data-tooltip-type', folder === 'operators' ? 'operator' : folder === 'weapons' ? 'weapon' : 'gear');

        // 잠재 레벨 속성 (오퍼레이터/무기 전용)
        let potency = 0;
        if (folder === 'operators' || folder === 'weapons') {
            let inputId = '';
            if (imgElementId === 'main-op-image') inputId = 'main-op-pot';
            else if (imgElementId === 'main-wep-image') inputId = 'main-wep-pot';
            else if (imgElementId.startsWith('sub-')) inputId = imgElementId.replace('-image', '-pot');
            if (inputId) potency = Number(document.getElementById(inputId)?.value) || 0;
        }
        imgElement.setAttribute('data-tooltip-pot', potency);

        // 단조 속성 (장비 전용)
        if (folder === 'gears') {
            const slot = imgElementId.replace('gear-', '').replace('-image', '');
            const forged = document.getElementById(`gear-${slot}-forge`)?.checked || false;
            imgElement.setAttribute('data-tooltip-forged', forged);
        }

        imgElement.onerror = function () { this.style.display = 'none'; };
    } else {
        imgElement.src = '';
        imgElement.style.display = 'none';
        imgElement.removeAttribute('data-tooltip-id');
        imgElement.removeAttribute('data-tooltip-type');
    }
}

/**
 * select 요소의 옵션을 데이터 배열로 채운다.
 * 기존 옵션은 모두 지우고 새로 렌더링한다.
 *
 * @param {string}   id   - select 요소의 ID
 * @param {object[]} list - { name, id } 형태의 배열
 */
function renderSelect(id, list) {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '';
    list.forEach(item => sel.add(new Option(item.name, item.id)));
}

// ============ 디버프 아이콘 ============

/**
 * 아이콘 래퍼 요소에 stacks값을 반영하여 호(ring-seg)를 활성/비활성 처리.
 * seg-0(상단)부터 stacks 개수만큼 active 클래스 부여.
 *
 * @param {HTMLElement} wrap   - .debuff-icon-wrap 요소
 * @param {number}      stacks - 활성 단계 (0~4)
 */
function applyDebuffIconState(wrap, stacks) {
    wrap.dataset.stacks = stacks;
    const label = wrap.querySelector('.debuff-stack-label');
    if (label) label.textContent = stacks;
    wrap.querySelectorAll('.ring-seg').forEach((seg, i) => {
        seg.classList.toggle('active', i < stacks);
    });
}

/**
 * 단일 디버프(방어불능, 갑옷파괴) 아이콘 클릭: 0→1→2→3→4→0 순환.
 * data-debuff 속성을 읽어 state.debuffState[type]을 갱신한다.
 *
 * @param {HTMLElement} el - 클릭된 .debuff-icon-wrap
 */
function cycleDebuff(el) {
    const type = el.dataset.debuff;
    const cur = parseInt(el.dataset.stacks, 10) || 0;
    const next = (cur + 1) % 5;

    if (state.debuffState && state.debuffState[type] !== undefined) {
        state.debuffState[type] = next;
    }

    applyDebuffIconState(el, next);
    saveState();
    updateState();
}

/**
 * 아츠 부착 아이콘 클릭: 한 종류만 활성 가능.
 * - 다른 종류가 활성화된 상태에서 클릭하면 해당 종류로 전환 (스택 1부터 시작).
 * - 같은 종류 클릭: 0→1→2→3→4→0 순환. 0이 되면 type도 null.
 *
 * @param {HTMLElement} el - 클릭된 .debuff-icon-wrap
 */
function cycleDebuffAttach(el) {
    const attachType = el.dataset.attachType;
    const ds = state.debuffState.artsAttach;

    let nextStacks;
    if (ds.type !== null && ds.type !== attachType) {
        // 다른 종류 선택 → 해당 종류 1단계로 전환
        nextStacks = 1;
    } else {
        const cur = parseInt(el.dataset.stacks, 10) || 0;
        nextStacks = (cur + 1) % 5;
    }

    state.debuffState.artsAttach.type = nextStacks === 0 ? null : attachType;
    state.debuffState.artsAttach.stacks = nextStacks;

    // 4개 아이콘 모두 갱신
    const ATTACH_TYPES = ['열기 부착', '전기 부착', '냉기 부착', '자연 부착'];
    ATTACH_TYPES.forEach(t => {
        const wrap = document.getElementById(`debuff-icon-${t}`);
        if (!wrap) return;
        const isSelected = (t === attachType && nextStacks > 0);
        const isOther = (state.debuffState.artsAttach.type !== null && t !== state.debuffState.artsAttach.type);
        applyDebuffIconState(wrap, isSelected ? nextStacks : 0);
        wrap.classList.toggle('attach-disabled', isOther);
    });

    saveState();
    updateState();
}

/**
 * 아츠 이상 아이콘 클릭: 각 종류 독립적으로 0→1→2→3→4→0 순환.
 * state.debuffState.artsAbnormal[type] 갱신 후 재계산.
 *
 * @param {HTMLElement} el - 클릭된 .debuff-icon-wrap
 */
function cycleDebuffAbnormal(el) {
    const abnType = el.dataset.abnormalType;
    const cur = parseInt(el.dataset.stacks, 10) || 0;
    const next = (cur + 1) % 5;
    state.debuffState.artsAbnormal[abnType] = next;
    applyDebuffIconState(el, next);
    saveState();
    updateState();
}

/**
 * 저장된 state.debuffState를 UI 아이콘에 반영한다.
 * loadState() 후 applyStateToUI()에서 호출한다.
 */
function applyDebuffStateToUI() {
    const ds = state.debuffState;
    if (!ds) return;

    // 방어불능
    const defEl = document.getElementById('debuff-icon-defenseless');
    if (defEl) applyDebuffIconState(defEl, ds.defenseless || 0);

    // 갑옷 파괴
    const abEl = document.getElementById('debuff-icon-armorBreak');
    if (abEl) applyDebuffIconState(abEl, ds.armorBreak || 0);

    // 아츠 부착
    const ATTACH_TYPES = ['열기 부착', '전기 부착', '냉기 부착', '자연 부착'];
    ATTACH_TYPES.forEach(t => {
        const wrap = document.getElementById(`debuff-icon-${t}`);
        if (!wrap) return;
        const activeType = ds.artsAttach?.type;
        const isSelected = activeType === t;
        const isOther = activeType !== null && activeType !== t;
        applyDebuffIconState(wrap, isSelected ? (ds.artsAttach?.stacks || 0) : 0);
        wrap.classList.toggle('attach-disabled', isOther);
    });

    // 아츠 이상
    const ABNORMAL_TYPES = ['연소', '감전', '동결', '부식'];
    ABNORMAL_TYPES.forEach(t => {
        const wrap = document.getElementById(`debuff-icon-${t}`);
        if (wrap) applyDebuffIconState(wrap, ds.artsAbnormal?.[t] || 0);
    });
}
