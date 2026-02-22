/**
 * ui/modal.js — 오퍼레이터 / 무기 선택 모달
 *
 * [역할]
 * - 오퍼레이터·무기를 그리드 형태로 보여주는 선택 모달을 렌더링한다.
 * - 선택 완료 시 콜백(onSelect)을 호출하고 모달을 닫는다.
 *
 * [의존]
 * - data_operators.js : DATA_OPERATORS
 * - data_weapons.js   : DATA_WEAPONS
 *
 * [내부 규칙]
 * - buildModalThumb()은 이미지 로드 실패 시 fallback span을 표시하는
 *   공통 템플릿 함수다. 모달 내부의 이미지는 반드시 이 함수를 통해 생성한다.
 * - 메인 오퍼레이터 선택 모달에는 '선택 해제' 항목을 표시하지 않는다.
 *   (selectId === 'main-op-select' 조건으로 분기)
 * - 이미 선택된 오퍼레이터(excludedIds)는 disabled 처리하되 목록에서 제거하지 않는다.
 */

// ============ 오퍼레이터 / 무기 선택 모달 ============

/**
 * 모달 썸네일 HTML을 생성한다.
 * 이미지 로드 실패 시 'IMG' 텍스트 fallback을 표시한다.
 *
 * @param {string} src - 이미지 경로
 * @param {string} alt - alt 텍스트
 * @returns {string} HTML 문자열
 */
function buildModalThumb(src, alt = '') {
    return `
        <div class="modal-thumb">
            <img src="${src}" alt="${alt}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
            <span class="modal-thumb-fallback">IMG</span>
        </div>`;
}

/**
 * 오퍼레이터 선택 모달을 열고 렌더링한다.
 * 희귀도 내림차순으로 정렬해 표시한다.
 *
 * @param {function} onSelect    - 선택 완료 콜백. 인자: 선택된 opId (문자열)
 * @param {string[]} excludedIds - 다른 슬롯에서 이미 선택된 오퍼레이터 ID 목록 (비활성화)
 * @param {string|null} selectId - 연결된 select 요소의 ID. null이면 현재 값 하이라이트 없음.
 */
function openOperatorModal(onSelect, excludedIds = [], selectId = null) {
    const modal = document.getElementById('op-selector-modal');
    const grid = document.getElementById('op-modal-grid');
    const closeBtn = document.getElementById('modal-close-btn');
    if (!modal || !grid) return;

    const currentVal = selectId ? document.getElementById(selectId)?.value : null;
    grid.innerHTML = '';

    // 메인 오퍼레이터 슬롯 이외에서는 '선택 해제' 항목을 추가
    if (selectId !== 'main-op-select') {
        const unequip = document.createElement('div');
        unequip.className = 'modal-item unselect-item';
        unequip.innerHTML = `<span class="name">선택 해제</span>`;
        unequip.onclick = () => { modal.classList.remove('open'); onSelect(''); };
        grid.appendChild(unequip);
    }

    // 희귀도 내림차순 정렬 후 렌더링
    const sorted = [...DATA_OPERATORS].sort((a, b) => (b.rarity || 0) - (a.rarity || 0));
    sorted.forEach(op => {
        const isExcluded = excludedIds.includes(op.id);
        const item = document.createElement('div');
        item.className = 'modal-item';
        if (op.id === currentVal) item.classList.add('selected');
        if (op.rarity) item.classList.add(`rarity-${op.rarity}`);
        // 다른 슬롯에서 선택 중인 오퍼레이터는 클릭 불가
        if (isExcluded) { item.classList.add('disabled'); item.style.opacity = '0.4'; }

        item.setAttribute('data-tooltip-id', op.id);
        item.setAttribute('data-tooltip-type', 'operator');
        item.innerHTML = buildModalThumb(`images/operators/${op.name}.webp`, op.name) + `<span class="name">${op.name}</span>`;
        item.onclick = () => { if (isExcluded) return; modal.classList.remove('open'); onSelect(op.id); };
        grid.appendChild(item);
    });

    modal.classList.add('open');
    const closeModal = () => modal.classList.remove('open');
    if (closeBtn) closeBtn.onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };
}

/**
 * 무기 선택 모달을 열고 렌더링한다.
 * 오퍼레이터가 사용 가능한 무기 타입만 표시한다.
 *
 * @param {function} onSelect     - 선택 완료 콜백. 인자: 선택된 wepId (문자열)
 * @param {object[]} validWeapons - 표시할 무기 데이터 배열 (getValidWeapons 결과)
 * @param {string}   currentValue - 현재 선택된 무기 ID (하이라이트용)
 */
function openWeaponModal(onSelect, validWeapons, currentValue) {
    const modal = document.getElementById('wep-selector-modal');
    const grid = document.getElementById('wep-modal-grid');
    if (!modal || !grid) return;

    grid.innerHTML = '';

    // 선택 해제 항목
    const unequip = document.createElement('div');
    unequip.className = 'modal-item unselect-item';
    unequip.innerHTML = `<span class="name">선택 해제</span>`;
    unequip.onclick = () => { modal.classList.remove('open'); onSelect(''); };
    grid.appendChild(unequip);

    validWeapons.forEach(wep => {
        const item = document.createElement('div');
        item.className = 'modal-item';
        if (wep.id === currentValue) item.classList.add('selected');
        if (wep.rarity) item.classList.add(`rarity-${wep.rarity}`);
        item.setAttribute('data-tooltip-id', wep.id);
        item.setAttribute('data-tooltip-type', 'weapon');
        item.innerHTML = buildModalThumb(`images/weapons/${wep.name}.webp`, wep.name) + `<span class="name">${wep.name}</span>`;
        item.onclick = () => { modal.classList.remove('open'); onSelect(wep.id); };
        grid.appendChild(item);
    });

    modal.classList.add('open');
    modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('open'); };
}
