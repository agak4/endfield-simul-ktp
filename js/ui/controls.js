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
 * - updateEntityImage()는 entityId가 없으면 이미지를 숨기고 툴팁 속성을 제거한다.
 * - syncPotencyToTooltip / syncForgedToTooltip은 툴팁 데이터 속성만 업데이트한다.
 */

// ============================================================
// 모듈 상수
// ============================================================

/** 아츠 부착 타입 목록 (cycleDebuffAttach, applyDebuffStateToUI 공용) */
const ATTACH_TYPES = ['열기 부착', '전기 부착', '냉기 부착', '자연 부착'];

/** 아츠 이상 타입 목록 (applyDebuffStateToUI 공용) */
const ABNORMAL_TYPES = ['연소', '감전', '동결', '부식'];

/** 잠재 input ID → 대응 이미지 element ID 매핑 */
const POT_INPUT_TO_IMAGE = {
    'main-op-pot': 'main-op-image',
    'main-wep-pot': 'main-wep-image',
};

/** 단조 체크박스 ID → 대응 이미지 element ID 매핑 */
const FORGE_CB_TO_IMAGE = Object.fromEntries(
    GEAR_SLOT_KEYS.map(k => [`gear-${k}-forge`, `gear-${k}-image`])
);

// ============================================================
// 내부 유틸리티
// ============================================================

/**
 * 고유한 스킬 시퀀스 ID를 생성한다.
 * @returns {string}
 */
function makeSeqId() {
    return `seq_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
}

/**
 * 디버프 변경 후 공통으로 필요한 저장·전파·갱신을 실행한다.
 * cycleDebuff, cycleDebuffAttach, cycleDebuffAbnormal, cycleSpecialStack에서 공통 사용.
 * @param {'debuff'|'specialStack'} propagateType
 */
function commitDebuffChange(propagateType) {
    saveState();
    if (!state.selectedSeqId) propagateGlobalStateToCustom(propagateType);
    updateState();
}

// ============================================================
// 잠재 버튼
// ============================================================

/**
 * 잠재 레벨 선택 버튼 그룹을 렌더링한다 (0~5).
 * 버튼 클릭 시 hidden input 값을 갱신하고 updateState()를 호출한다.
 * @param {string} inputId - 연결된 hidden number input의 ID
 * @param {string} groupId - 버튼을 삽입할 컨테이너 div의 ID
 */
function setupPotencyButtons(inputId, groupId) {
    const input = document.getElementById(inputId);
    const group = document.getElementById(groupId);
    if (!input || !group) return;

    const currentVal = Number(input.value) || 0;
    group.innerHTML = '';

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
 * 잠재 레벨 변경 시 대응 이미지 요소의 data-tooltip-pot 속성을 갱신한다.
 * @param {string} inputId  - 잠재 레벨 input의 ID
 * @param {number} potValue - 새로운 잠재 레벨 값
 */
function syncPotencyToTooltip(inputId, potValue) {
    // sub-N-pot 패턴은 동적으로 이미지 ID를 도출한다
    const imgId = POT_INPUT_TO_IMAGE[inputId]
        || (inputId.includes('sub-') ? inputId.replace('-pot', '-image') : '');
    document.getElementById(imgId)?.setAttribute('data-tooltip-pot', potValue);
}

// ============================================================
// 단조 / 기질 토글
// ============================================================

/**
 * 단조 체크박스 변경 시 대응 장비 이미지의 data-tooltip-forged 속성을 갱신한다.
 * @param {string}  checkboxId - 단조 checkbox 요소의 ID
 * @param {boolean} isForged   - 단조 ON/OFF
 */
function syncForgedToTooltip(checkboxId, isForged) {
    document.getElementById(FORGE_CB_TO_IMAGE[checkboxId])
        ?.setAttribute('data-tooltip-forged', isForged);
}

/**
 * 체크박스를 숨기고 토글 버튼을 DOM에 삽입한다.
 * 버튼 클릭 시 체크박스 값을 반전시키고 updateState()를 호출한다.
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
 * 클릭 시 모든 개별 슬롯 단조를 동시에 ON/OFF한다.
 */
function setupMainForgeToggle() {
    const mainForgeCb = document.getElementById('main-gear-forge');
    if (!mainForgeCb) return;
    mainForgeCb.style.display = 'none';

    const toggle = document.createElement('button');
    toggle.id = 'main-forge-toggle';
    toggle.className = 'toggle-btn';
    toggle.onclick = () => {
        mainForgeCb.checked = !mainForgeCb.checked;
        GEAR_FORGE_IDS.forEach(gid => {
            const gcb = document.getElementById(gid);
            const gbtn = document.getElementById(gid + '-toggle');
            if (gcb) gcb.checked = mainForgeCb.checked;
            if (gbtn) updateToggleButton(gbtn, mainForgeCb.checked, '단조');
            syncForgedToTooltip(gid, mainForgeCb.checked);
        });
        updateToggleButton(toggle, mainForgeCb.checked, '전체 단조');
        updateState();
    };
    mainForgeCb.parentNode.appendChild(toggle);
    updateToggleButton(toggle, mainForgeCb.checked, '전체 단조');
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
        btn.onclick = () => {
            cb.checked = !cb.checked;
            updateToggleButton(btn, cb.checked, '단조');
            syncForgedToTooltip(id, cb.checked);

            // 모든 슬롯 ON이면 메인 단조도 ON
            const allOn = GEAR_FORGE_IDS.every(gid => document.getElementById(gid)?.checked);
            if (mainForgeCb) mainForgeCb.checked = allOn;
            if (mainForgeToggle) updateToggleButton(mainForgeToggle, allOn, '전체 단조');
            updateState();
        };
        cb.parentNode.appendChild(btn);
        updateToggleButton(btn, cb.checked, '단조');
        syncForgedToTooltip(id, cb.checked);
    });
}

/**
 * 토글 버튼의 텍스트와 active 클래스를 갱신한다.
 * @param {HTMLButtonElement} btn       - 대상 버튼 요소
 * @param {boolean}           isChecked - 현재 ON/OFF 상태
 * @param {string}            label     - 버튼 레이블
 */
function updateToggleButton(btn, isChecked, label) {
    btn.classList.toggle('active', isChecked);
    btn.innerText = `${label}`;
}

// ============================================================
// 서브 오퍼레이터 접기/펼치기
// ============================================================

/**
 * 서브 오퍼레이터 카드를 접거나 펼친다.
 * HTML의 onclick 속성에서 직접 호출되므로 전역에서 접근 가능해야 한다.
 * @param {number} idx - 서브 오퍼레이터 인덱스 (0~2)
 */
function toggleSubOp(idx) {
    const content = document.getElementById(`sub-op-content-${idx}`);
    if (content) {
        content.classList.toggle('collapsed');
        if (typeof updateState === 'function') updateState();
    }
}

// ============================================================
// 엔티티 이미지 업데이트
// ============================================================

/**
 * 엔티티(오퍼레이터/무기/장비) 이미지를 업데이트하고 툴팁 속성을 동기화한다.
 *
 * - entityId가 없으면 이미지를 숨기고 툴팁 속성을 제거한다.
 * - 이미지 로드 실패(onerror) 시 자동으로 숨긴다.
 * - 오퍼레이터/무기는 희귀도 클래스(rarity-N)를 컨테이너에 적용한다.
 *
 * @param {string|null} entityId     - 엔티티 ID
 * @param {string}      imgElementId - <img> 요소의 ID
 * @param {string}      folder       - 이미지 폴더명 ('operators' | 'weapons' | 'gears')
 */
function updateEntityImage(entityId, imgElementId, folder) {
    const imgElement = document.getElementById(imgElementId);
    if (!imgElement) return;

    const container = imgElement.parentElement;
    container?.classList.remove('rarity-6', 'rarity-5', 'rarity-4');

    if (!entityId) {
        imgElement.src = '';
        imgElement.style.display = 'none';
        return;
    }

    let fileName = '', rarity = 0;
    if (folder === 'operators') {
        const op = DATA_OPERATORS.find(o => o.id === entityId);
        fileName = op?.name; rarity = op?.rarity || 0;
    } else if (folder === 'weapons') {
        const wep = DATA_WEAPONS.find(w => w.id === entityId);
        fileName = wep?.name; rarity = wep?.rarity || 0;
    } else if (folder === 'gears') {
        fileName = DATA_GEAR.find(g => g.id === entityId)?.name;
    }

    if (!fileName) {
        imgElement.src = '';
        imgElement.style.display = 'none';
        imgElement.removeAttribute('data-tooltip-id');
        imgElement.removeAttribute('data-tooltip-type');
        return;
    }

    if (rarity && container) container.classList.add(`rarity-${rarity}`);
    imgElement.src = `images/${folder}/${fileName}.webp?v=${APP_VERSION}`;
    imgElement.loading = 'eager';
    imgElement.style.display = 'block';
    imgElement.setAttribute('data-tooltip-id', entityId);
    imgElement.setAttribute('data-tooltip-type',
        folder === 'operators' ? 'operator' : folder === 'weapons' ? 'weapon' : 'gear');

    // 잠재 레벨 속성 (오퍼레이터/무기 전용)
    if (folder === 'operators' || folder === 'weapons') {
        const inputId = POT_INPUT_TO_IMAGE[imgElementId.replace('-image', '-pot')]
            ? imgElementId.replace('-image', '-pot')
            : imgElementId.startsWith('sub-') ? imgElementId.replace('-image', '-pot') : '';
        imgElement.setAttribute('data-tooltip-pot', Number(document.getElementById(inputId)?.value) || 0);
    }

    // 단조 속성 (장비 전용)
    if (folder === 'gears') {
        const slot = imgElementId.replace('gear-', '').replace('-image', '');
        imgElement.setAttribute('data-tooltip-forged',
            document.getElementById(`gear-${slot}-forge`)?.checked || false);
    }

    imgElement.onerror = function () { this.style.display = 'none'; };
}

// ============================================================
// select 유틸리티
// ============================================================

/**
 * select 요소의 옵션을 데이터 배열로 채운다.
 * 기존 옵션은 모두 지우고 새로 렌더링한다.
 * @param {string}   id   - select 요소의 ID
 * @param {object[]} list - { name, id } 형태의 배열
 */
function renderSelect(id, list) {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '';
    list.forEach(item => sel.add(new Option(item.name, item.id)));
}

// ============================================================
// 디버프 아이콘 상태 관리
// ============================================================

/**
 * 아이콘 래퍼 요소에 stacks 값을 반영하여 호(ring-seg)를 활성/비활성 처리한다.
 * seg-0(상단)부터 stacks 개수만큼 active 클래스를 부여한다.
 * @param {HTMLElement} wrap   - .debuff-icon-wrap 요소
 * @param {number}      stacks - 활성 단계 (0~4)
 */
function applyDebuffIconState(wrap, stacks) {
    wrap.dataset.stacks = stacks;

    const label = wrap.querySelector('.debuff-stack-label');
    if (label) label.textContent = stacks;

    const bubble = wrap.querySelector('.debuff-stack-bubble');
    if (bubble) {
        const maxAttr = wrap.dataset.max;
        const max = (maxAttr === 'null' || maxAttr === undefined) ? null : parseInt(maxAttr, 10);
        bubble.textContent = stacks;
        if (max === 1) {
            bubble.style.display = 'none';
        } else {
            bubble.style.display = '';
            bubble.classList.toggle('active', stacks > 0);
            bubble.classList.toggle('zero', stacks === 0);
        }
    }

    const ringSvg = wrap.querySelector('.debuff-ring-svg');
    wrap.classList.toggle('active', stacks > 0);
    if (ringSvg?.classList.contains('single-ring-svg')) {
        ringSvg.classList.toggle('active', stacks > 0);
    } else {
        wrap.querySelectorAll('.ring-seg').forEach((seg, i) => {
            seg.classList.toggle('active', i < Math.min(stacks, 4));
        });
    }
}

/**
 * 디버프 아이콘 우클릭 시 호출. 스택을 감소(dir = -1)시킨다.
 * @param {HTMLElement} el - .debuff-icon-wrap 요소
 * @param {MouseEvent}  e
 */
function handleDebuffRightClick(el, e) {
    e.preventDefault();
    if (el.dataset.debuff === 'specialStack') cycleSpecialStack(el, -1);
    else if (el.dataset.attachType) cycleDebuffAttach(el, -1);
    else if (el.dataset.abnormalType) cycleDebuffAbnormal(el, -1);
    else if (el.dataset.debuff) cycleDebuff(el, -1);
    else if (el.dataset.usable) cycleDebuff(el, -1);
}

/**
 * 현재 활성 상태(일괄 or 개별)에 맞춰 디버프 아이콘과 불균형 토글 등 UI를 최신화한다.
 */
function updateUIStateVisuals() {
    const ts = getTargetState();
    const ds = ts.debuffState;
    if (!ds) return;

    document.querySelectorAll('.debuff-icon-wrap').forEach(el => {
        if (el.dataset.debuff === 'specialStack') return;

        let val = 0;
        if (el.dataset.attachType) {
            val = (ds.artsAttach?.type === el.dataset.attachType) ? (ds.artsAttach?.stacks || 0) : 0;
        } else if (el.dataset.abnormalType) {
            val = ds.artsAbnormal?.[el.dataset.abnormalType] || 0;
        } else if (el.dataset.debuff) {
            const type = el.dataset.debuff;
            val = ds.physDebuff?.[type] !== undefined ? ds.physDebuff[type] : (ds[type] || 0);
        } else if (el.dataset.usable) {
            const type = el.dataset.usable;
            val = ts.usables?.[type] ? 1 : 0;
        }
        applyDebuffIconState(el, val);
    });

    const enemyCb = document.getElementById('enemy-unbalanced');
    const enemyBtn = document.getElementById('enemy-unbalanced-toggle');
    if (enemyCb && enemyBtn) {
        enemyCb.checked = !!ts.isUnbalanced();
        updateToggleButton(enemyBtn, enemyCb.checked, '불균형');
    }

    // 전용 스택 UI 동기화 (오퍼레이터 변경 시 동적 재생성)
    const mainOp = DATA_OPERATORS.find(o => o.id === state.mainOp.id);
    const specGroup = document.getElementById('special-stack-group');
    if (!specGroup) return;

    if (mainOp?.specialStack) {
        specGroup.style.display = 'block';
        specGroup.innerHTML = '';

        const stacks = Array.isArray(mainOp.specialStack) ? mainOp.specialStack : [mainOp.specialStack];
        const row = document.createElement('div');
        row.className = 'debuff-attach-row';
        const specStacks = ts.getSpecialStack ? ts.getSpecialStack() : (state.mainOp.specialStack || {});

        stacks.forEach(s => {
            const stackId = s.id || 'default';
            const useSingleCircle = s.max === 1 || s.max === null;

            const wrap = document.createElement('div');
            wrap.className = 'debuff-icon-wrap';
            wrap.id = `debuff-icon-special-${stackId}`;
            wrap.dataset.debuff = 'specialStack';
            wrap.dataset.stackId = stackId;
            wrap.dataset.max = s.max;

            wrap.innerHTML = useSingleCircle ? `
                <svg xmlns="http://www.w3.org/2000/svg" class="debuff-ring-svg single-ring-svg" viewBox="0 0 100 100">
                    <path class="ring-bg"   d="M 50, 8 A 42, 42 0 1, 1 50, 92 A 42, 42 0 1, 1 50, 8" />
                    <path class="ring-fill" d="M 50, 8 A 42, 42 0 1, 1 50, 92 A 42, 42 0 1, 1 50, 8" />
                </svg>
                <div class="debuff-icon-img-wrap special-stack-bg" style="background-image:url('images/operators/${mainOp.name}.webp')">
                    <img src="" alt="${s.name}" style="display:none">
                </div>
                <span class="debuff-stack-label">0</span>
                <div class="debuff-stack-bubble">0</div>
                <span class="special-stack-name">${s.name}</span>
            ` : `
                <svg xmlns="http://www.w3.org/2000/svg" class="debuff-ring-svg" viewBox="0 0 100 100">
                    <path class="ring-seg seg-0" d="M74.1,15.6 A42,42 0 0,0 25.9,15.6" />
                    <path class="ring-seg seg-1" d="M84.4,74.1 A42,42 0 0,0 84.4,25.9" />
                    <path class="ring-seg seg-2" d="M25.9,84.4 A42,42 0 0,0 74.1,84.4" />
                    <path class="ring-seg seg-3" d="M15.6,25.9 A42,42 0 0,0 15.6,74.1" />
                </svg>
                <div class="debuff-icon-img-wrap special-stack-bg" style="background-image:url('images/operators/${mainOp.name}.webp')">
                    <img src="" alt="${s.name}" style="display:none">
                </div>
                <span class="debuff-stack-label">0</span>
                <span class="special-stack-name">${s.name}</span>
            `;

            wrap.onclick = () => cycleSpecialStack(wrap, 1);
            wrap.oncontextmenu = (e) => handleDebuffRightClick(wrap, e);
            applyDebuffIconState(wrap, specStacks[stackId] || 0);
            row.appendChild(wrap);
        });
        specGroup.appendChild(row);
    } else {
        specGroup.style.display = 'none';
    }
}

// ============================================================
// 디버프 사이클 핸들러
// ============================================================

/**
 * 방어불능/갑옷파괴/연타 아이콘 클릭: 0→1→2→3→4→0 순환.
 * data-debuff 속성을 읽어 state.debuffState.physDebuff[type]을 갱신한다.
 * @param {HTMLElement} el  - 클릭된 .debuff-icon-wrap
 * @param {number}      dir - 순환 방향 (+1 증가 / -1 감소)
 */
function cycleDebuff(el, dir = 1) {
    ensureCustomState();

    // 사용 아이템인 경우 토글 처리
    if (el.dataset.usable) {
        const type = el.dataset.usable;
        const ts = getTargetState();
        if (!ts.usables) ts.usables = {};

        // 클릭(dir=1) 시 토글, 우클릭(dir=-1) 시 끄기
        const next = dir === 1 ? !ts.usables[type] : false;
        ts.usables[type] = next;

        applyDebuffIconState(el, next ? 1 : 0);
        commitDebuffChange('debuff');
        return;
    }

    const type = el.dataset.debuff;
    const next = ((parseInt(el.dataset.stacks, 10) || 0) + dir + 5) % 5;
    const ds = getTargetState().debuffState;

    if (ds.physDebuff?.[type] !== undefined) ds.physDebuff[type] = next;
    else if (ds[type] !== undefined) ds[type] = next;

    applyDebuffIconState(el, next);
    commitDebuffChange('debuff');
}

/**
 * 연타 아이콘을 0/1로 토글한다.
 * @param {HTMLElement} el - .debuff-icon-wrap
 */
function cycleDebuffToggle(el) {
    ensureCustomState();
    const type = el.dataset.debuff;
    const ds = getTargetState().debuffState;
    if (!ds.physDebuff) ds.physDebuff = {};
    const next = ds.physDebuff[type] ? 0 : 1;
    ds.physDebuff[type] = next;
    applyDebuffIconState(el, next);
    commitDebuffChange('debuff');
}

/**
 * 아츠 부착 아이콘 클릭: 스택을 0~4로 순환하며, 다른 타입 선택 시 해당 타입으로 교체.
 * @param {HTMLElement} el  - .debuff-icon-wrap
 * @param {number}      dir - 순환 방향 (+1 / -1)
 */
function cycleDebuffAttach(el, dir = 1) {
    ensureCustomState();
    const attachType = el.dataset.attachType;
    const ds = getTargetState().debuffState.artsAttach;

    // 다른 타입이 활성화된 상태에서 클릭하면 해당 타입으로 즉시 교체
    const nextStacks = (ds.type !== null && ds.type !== attachType)
        ? (dir === 1 ? 1 : 4)
        : ((parseInt(el.dataset.stacks, 10) || 0) + dir + 5) % 5;

    ds.type = nextStacks === 0 ? null : attachType;
    ds.stacks = nextStacks;

    ATTACH_TYPES.forEach(t => {
        const wrap = document.getElementById(`debuff-icon-${t}`);
        if (!wrap) return;
        applyDebuffIconState(wrap, t === attachType && nextStacks > 0 ? nextStacks : 0);
        wrap.classList.toggle('attach-disabled', ds.type !== null && t !== ds.type);
    });

    commitDebuffChange('debuff');
}

/**
 * 아츠 이상 아이콘 클릭: 0~4 순환.
 * @param {HTMLElement} el  - .debuff-icon-wrap
 * @param {number}      dir - 순환 방향
 */
function cycleDebuffAbnormal(el, dir = 1) {
    ensureCustomState();
    const abnType = el.dataset.abnormalType;
    const next = ((parseInt(el.dataset.stacks, 10) || 0) + dir + 5) % 5;
    getTargetState().debuffState.artsAbnormal[abnType] = next;
    applyDebuffIconState(el, next);
    commitDebuffChange('debuff');
}

/**
 * 전용 스택 아이콘 클릭: 0 → 1 → ... → max → 0 순환.
 * max === null이면 상한 없이 증감한다.
 * @param {HTMLElement} el  - .debuff-icon-wrap
 * @param {number}      dir - 순환 방향
 */
function cycleSpecialStack(el, dir = 1) {
    ensureCustomState();
    const op = DATA_OPERATORS.find(o => o.id === state.mainOp.id);
    if (!op?.specialStack) return;

    const stackId = el.dataset.stackId || 'default';
    const ts = getTargetState();
    const specStacks = ts.getSpecialStack ? ts.getSpecialStack() : (state.mainOp.specialStack || {});
    const cur = specStacks[stackId] || 0;

    const stacksData = Array.isArray(op.specialStack) ? op.specialStack : [op.specialStack];
    const specData = stacksData.find(s => (s.id || 'default') === stackId);
    const max = (specData && specData.max !== undefined) ? specData.max : 1;

    let next;
    if (max === null) {
        next = Math.max(0, Number(cur) + dir);
    } else {
        next = Number(cur) + dir;
        if (next > max) next = 0;
        else if (next < 0) next = max;
    }

    if (ts.setSpecialStack) ts.setSpecialStack({ ...specStacks, [stackId]: next });
    else state.mainOp.specialStack[stackId] = next;

    applyDebuffIconState(el, next);
    commitDebuffChange('specialStack');
}

// ============================================================
// 디버프 상태 → UI 반영
// ============================================================

function applyDebuffStateToUI() {
    updateUIStateVisuals();
}

/** 사용 아이템 설명 데이터 */
const USABLE_DESCS = {
    '혼란의 약제': {
        name: '혼란의 약제',
        desc: '사용 시 궁극기 충전 효율이 24% 증가하며, 300초 동안 지속됩니다.'
    },
    '아츠가 부여된 금속 병': {
        name: '아츠가 부여된 금속 병',
        desc: '사용 시 주는 모든 피해가 25% 증가하며, 300초 동안 지속됩니다.'
    },
    '제이콥의 유산': {
        name: '제이콥의 유산',
        desc: '사용 시 공격력이 27% 증가하며, 300초 동안 지속됩니다.'
    },
    '푹 삶은 갈비 미삼탕': {
        name: '푹 삶은 갈비 미삼탕',
        desc: '사용 시 공격력이 180, 치명타 확률이 11% 증가하며, 300초 동안 지속됩니다.'
    },
    '원기 회복 탕약': {
        name: '원기 회복 탕약',
        desc: '사용 시 치명타 확률이 9%, 주는 모든 피해가 18% 증가하며, 300초 동안 지속됩니다.'
    }
};

/**
 * 사용 아이템 툴팁 표시
 * @param {HTMLElement} el
 * @param {MouseEvent} event
 */
function showUsableTooltip(el, event) {
    const type = el.dataset.usable;
    const data = USABLE_DESCS[type];
    if (!data || !AppTooltip) return;

    const html = `
        <div class="tooltip-header">
            <div class="tooltip-title-group">
                <div class="tooltip-name">${data.name}</div>
            </div>
        </div>
        <div class="tooltip-section">
            <div class="tooltip-desc">${AppTooltip.colorizeText(data.desc)}</div>
        </div>
    `;
    AppTooltip.showCustom(html, event);
}



// ============================================================
// 스킬 사이클 보드 제어 및 드래그 앤 드롭
// ============================================================

/**
 * 스킬 아이콘 클릭 시 사이클 배열 마지막에 항목을 추가한다.
 * @param {string} skillType - 추가할 스킬 타입
 */
function addCycleItem(skillType) {
    if (!state.skillSequence) state.skillSequence = [];
    state.skillSequence.push({ id: makeSeqId(), type: skillType, customState: null });
    saveState();
    updateState();
}

/**
 * 디스플레이 보드 내 특정 위치의 아이템을 삭제한다.
 * @param {number} index - 삭제할 아이템의 인덱스
 */
function removeCycleItem(index) {
    if (!state.skillSequence) return;
    const removedId = state.skillSequence[index]?.id;
    state.skillSequence.splice(index, 1);
    if (state.selectedSeqId === removedId) state.selectedSeqId = null;
    saveState();
    if (typeof AppTooltip !== 'undefined' && AppTooltip.hide) AppTooltip.hide();
    updateState();
}

/**
 * 전체 사이클을 초기화한다.
 */
function clearCycleItems() {
    state.skillSequence = [];
    state.selectedSeqId = null;
    saveState();
    if (typeof AppTooltip !== 'undefined' && AppTooltip.hide) AppTooltip.hide();
    updateState();
}

// ============================================================
// 드래그 앤 드롭 핸들러
// ============================================================

let dragStartIndex = -1;

/** 드래그 시작 시 인덱스를 저장하고 'dragging' 클래스를 추가한다. */
function handleDragStart(e) {
    dragStartIndex = +this.dataset.index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragStartIndex); // Firefox 호환
    this.classList.add('dragging');
    AppTooltip?.hide();
}

/** 드롭 대상 위 이동 중: 커서 위치에 따라 left/right 방향 표시를 업데이트한다. */
function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = this.getBoundingClientRect();
    this.classList.remove('drag-over-left', 'drag-over-right');
    this.classList.add(e.clientX - rect.left < rect.width / 2 ? 'drag-over-left' : 'drag-over-right');
    return false;
}

/** dragenter: 기본 동작 방지 */
function handleDragEnter(e) { e.preventDefault(); }

/** dragleave: 방향 표시 클래스 제거 */
function handleDragLeave() { this.classList.remove('drag-over-left', 'drag-over-right'); }

/** 드롭 시 아이템을 새 위치로 이동하고 상태를 저장한다. */
function handleDrop(e) {
    e.stopPropagation();
    const isRight = this.classList.contains('drag-over-right');
    this.classList.remove('drag-over-left', 'drag-over-right');

    let dragEndIndex = +this.dataset.index;
    if (dragStartIndex !== dragEndIndex && dragStartIndex >= 0) {
        if (isRight) dragEndIndex++;
        if (dragStartIndex < dragEndIndex) dragEndIndex--;

        const [item] = state.skillSequence.splice(dragStartIndex, 1);
        state.skillSequence.splice(dragEndIndex, 0, item);
        saveState();
        updateState();
    }
    return false;
}

/** 드래그 종료 시 모든 드래그 관련 클래스를 정리한다. */
function handleDragEnd() {
    this.classList.remove('dragging');
    document.querySelectorAll('.cycle-sequence-item')
        .forEach(item => item.classList.remove('drag-over-left', 'drag-over-right'));
    dragStartIndex = -1;
}

/** @deprecated 구버전 호환용 빈 함수 */
function applySkillCountsToUI() { }