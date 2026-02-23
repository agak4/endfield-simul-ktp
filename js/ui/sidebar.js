/**
 * ui/sidebar.js — 장비 선택 사이드바
 *
 * [역할]
 * - 왼쪽 슬라이드 사이드바를 열고 닫는다.
 * - DATA_SETS / DATA_GEAR를 기반으로 장비 목록을 렌더링한다.
 * - 장비 선택 시 해당 슬롯의 hidden input 값을 갱신하고 updateState()를 호출한다.
 *
 * [의존]
 * - data_gears.js : DATA_GEAR
 * - data_sets.js  : DATA_SETS (있는 경우)
 * - state.js  : updateState
 * - ui/controls.js : updateEntityImage
 *
 * [내부 규칙]
 * - openGearSidebar / closeGearSidebar는 window에 노출한다.
 *   (HTML의 onclick 속성에서 직접 호출하기 때문)
 * - currentGearInputId에는 항상 열려 있는 슬롯의 select 요소 ID가 저장된다.
 *   사이드바가 닫히면 반드시 null로 초기화해야 한다.
 * - 슬롯 타입이 다른(isMatch=false) 장비는 disabled 처리만 하며 삭제하지 않는다.
 *   (같은 세트의 다른 슬롯을 시각적으로 보여주기 위함)
 */

// ============ 장비 사이드바 ============

/** 현재 열려 있는 장비 슬롯의 select 요소 ID. 사이드바가 닫히면 null. */
let currentGearInputId = null;

/**
 * 장비 사이드바를 연다.
 * @param {string} inputId  - 연결된 장비 hidden input 요소의 ID
 * @param {string} partType - 필터할 장비 파트 타입 ('gloves' | 'armor' | 'kit')
 */
window.openGearSidebar = function (inputId, partType) {
    currentGearInputId = inputId;
    const sidebar = document.getElementById('gear-sidebar');
    if (sidebar) {
        renderGearSidebar(partType);
        sidebar.classList.add('open');
    }
};

/** 장비 사이드바를 닫고 currentGearInputId를 초기화한다. */
window.closeGearSidebar = function () {
    const sidebar = document.getElementById('gear-sidebar');
    if (sidebar) sidebar.classList.remove('open');
    currentGearInputId = null;
};

/**
 * 사이드바 내부를 세트 그룹별로 렌더링한다.
 * filterPart와 일치하지 않는 장비는 disabled 클래스를 적용하여 회색으로 표시한다.
 *
 * @param {string} filterPart - 현재 슬롯의 파트 타입
 */
function renderGearSidebar(filterPart) {
    const container = document.querySelector('#gear-sidebar .sidebar-content');
    if (!container) return;
    container.innerHTML = '';

    // 장착 해제 버튼
    const unequipBtn = document.createElement('div');
    unequipBtn.className = 'sidebar-item unequip-item';
    unequipBtn.innerHTML = `<span class="sidebar-item-name">== 장착 해제 ==</span>`;
    unequipBtn.onclick = () => selectGear('');
    container.appendChild(unequipBtn);

    // 세트 그룹별로 장비 목록 렌더링
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

            // 툴팁 데이터 속성
            item.setAttribute('data-tooltip-id', gear.id);
            item.setAttribute('data-tooltip-type', 'gear');

            const isMatch = (gear.part === filterPart);

            // 슬롯이 다른 장비는 클릭 불가, 현재 장착 중이면 selected 표시
            if (!isMatch) item.classList.add('disabled');
            if (document.getElementById(currentGearInputId)?.value === gear.id) item.classList.add('selected');

            const v = Date.now();
            item.innerHTML = `
                <div class="sidebar-item-img"><img src="images/gears/${gear.name}.webp?v=${v}"></div>
                <span class="sidebar-item-name">${gear.name}</span>
            `;
            if (isMatch) item.onclick = () => selectGear(gear.id);
            grid.appendChild(item);
        });

        container.appendChild(grid);
    });
}

/**
 * 장비를 선택하고 사이드바를 닫는다.
 * hidden input 값 → 이미지 업데이트 → updateState 순으로 실행한다.
 *
 * @param {string} gearId - 선택된 장비 ID. 빈 문자열이면 장착 해제.
 */
function selectGear(gearId) {
    if (!currentGearInputId) return;
    const input = document.getElementById(currentGearInputId);
    if (input) {
        input.value = gearId;
        updateEntityImage(gearId, currentGearInputId.replace('-select', '-image'), 'gears');
        updateState();
    }
    closeGearSidebar();
}
