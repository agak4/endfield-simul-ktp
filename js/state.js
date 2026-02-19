/**
 * state.js — 전역 상태 관리
 *
 * [역할]
 * - 앱 전체에서 공유되는 `state` 객체를 선언·관리한다.
 * - UI에서 읽은 값으로 state를 갱신하고 (updateState),
 *   localStorage에 저장·복원한다 (saveState / loadState).
 *
 * [의존]
 * - calc.js : calculateDamage
 * - ui/render.js : renderResult, renderWeaponComparison
 *
 * [내부 규칙]
 * - state를 직접 수정하는 유일한 진입점은 updateState()다.
 *   다른 파일에서 state를 직접 변경하지 않는다.
 * - GEAR_SLOT_KEYS 순서는 HTML의 슬롯 순서와 동일하게 유지한다.
 *   (gloves → armor → kit1 → kit2)
 * - localStorage 키: 'endfield_cal_save' (변경 시 모든 저장 데이터가 초기화됨)
 */

// ============ 전역 상태 ============

/**
 * 앱의 모든 상태를 담는 중앙 객체.
 * 이 객체의 값이 곧 계산 입력값이다.
 *
 * - mainOp : 메인 오퍼레이터 및 장비 정보
 *   - gears[i]      : 슬롯별 장비 ID (gloves/armor/kit1/kit2 순)
 *   - gearForged[i] : 슬롯별 단조 여부
 * - subOps[i]       : 서브 오퍼레이터 3명의 정보
 * - subOpsCollapsed : 서브 카드 접힘 여부 (저장 후 복원용)
 * - disabledEffects : 사용자가 클릭으로 비활성화한 효과 uid 목록
 */
let state = {
    mainOp: {
        id: null, pot: 0,
        wepId: null, wepPot: 0, wepState: false,
        gearForge: false,
        gears: [null, null, null, null],
        gearForged: [false, false, false, false]
    },
    subOps: [
        { id: null, pot: 0, wepId: null, wepPot: 0, wepState: false, equipSet: null },
        { id: null, pot: 0, wepId: null, wepPot: 0, wepState: false, equipSet: null },
        { id: null, pot: 0, wepId: null, wepPot: 0, wepState: false, equipSet: null }
    ],
    subOpsCollapsed: [false, true, true], // 기본값: 첫 번째만 펼침
    enemyUnbalanced: false,
    activeSetId: null,   // collectAllEffects에서 갱신됨
    disabledEffects: [],  // uid 문자열 배열

    /**
     * 디버프 상태 (이후 스킬 트리거 조건 계산에 활용)
     *
     * artsAttach: 아츠 부착 (단 하나의 종류만 선택 가능)
     *   - type: '열기 부착' | '전기 부착' | '냉기 부착' | '자연 부착' | null
     *   - stacks: 0~4 단계
     *
     * artsAbnormal: 아츠 이상 4종, 각 0~4단계
     *   - 연소 | 감전 | 동결 | 부식
     *
     * defenseless: 방어불능, 0~4단계
     */
    debuffState: {
        debuffState: {
            defenseless: 0, // 방어 불능
            armorBreak: 0, // 갑옷 파괴 (물리 받는 피해 증가)
            artsAttach: { type: null, stacks: 0 }, // 한 종류만 가능
            artsAbnormal: { '연소': 0, '감전': 0, '동결': 0, '부식': 0 }
        }
    }
};

// ============ 공통 상수 ============

/** 스탯 키 → 한글 이름 변환 테이블 */
const STAT_NAME_MAP = {
    str: '힘', agi: '민첩', int: '지능', wil: '의지'
};

/**
 * 장비 슬롯 식별자 목록.
 * 순서가 state.mainOp.gears / gearForged 배열 인덱스와 1:1 대응된다.
 */
const GEAR_SLOT_KEYS = ['gloves', 'armor', 'kit1', 'kit2'];
const GEAR_SELECT_IDS = GEAR_SLOT_KEYS.map(k => `gear-${k}-select`);
const GEAR_FORGE_IDS = GEAR_SLOT_KEYS.map(k => `gear-${k}-forge`);
const GEAR_IMAGE_IDS = GEAR_SLOT_KEYS.map(k => `gear-${k}-image`);

/** 스탯 키를 한글 이름으로 반환. 매핑이 없으면 원본 키를 반환한다. */
function getStatName(key) {
    return STAT_NAME_MAP[key] || key;
}

// ============ 상태 업데이트 ============

/**
 * DOM에서 현재 입력값을 읽어 state를 갱신하고,
 * 계산 → 렌더링 → 저장을 순서대로 실행한다.
 *
 * [주의] UI 이벤트 핸들러의 최종 호출지여야 한다.
 *        직접 state를 수정해야 한다면 이 함수를 통해 반영한다.
 */
function updateState() {
    state.mainOp.id = document.getElementById('main-op-select')?.value || null;
    state.mainOp.pot = Number(document.getElementById('main-op-pot')?.value) || 0;
    state.mainOp.wepId = document.getElementById('main-wep-select')?.value || null;
    state.mainOp.wepPot = Number(document.getElementById('main-wep-pot')?.value) || 0;
    state.mainOp.wepState = document.getElementById('main-wep-state')?.checked || false;
    state.mainOp.gearForge = document.getElementById('main-gear-forge')?.checked || false;

    // 장비 슬롯 일괄 읽기 (GEAR_SLOT_KEYS 순서와 동일)
    GEAR_SELECT_IDS.forEach((id, idx) => {
        state.mainOp.gears[idx] = document.getElementById(id)?.value || null;
    });
    GEAR_FORGE_IDS.forEach((id, idx) => {
        state.mainOp.gearForged[idx] = document.getElementById(id)?.checked || false;
    });

    // 서브 오퍼레이터 3명
    for (let i = 0; i < 3; i++) {
        state.subOps[i].id = document.getElementById(`sub-${i}-op`)?.value || null;
        state.subOps[i].pot = Number(document.getElementById(`sub-${i}-pot`)?.value) || 0;
        state.subOps[i].wepId = document.getElementById(`sub-${i}-wep`)?.value || null;
        state.subOps[i].wepPot = Number(document.getElementById(`sub-${i}-wep-pot`)?.value) || 0;
        state.subOps[i].wepState = document.getElementById(`sub-${i}-wep-state`)?.checked || false;
        state.subOps[i].equipSet = document.getElementById(`sub-${i}-set`)?.value || null;

        // 접힘 상태 동기화 (UI 토글 → state 반영)
        const content = document.getElementById(`sub-op-content-${i}`);
        if (content) state.subOpsCollapsed[i] = content.classList.contains('collapsed');
    }

    state.enemyUnbalanced = document.getElementById('enemy-unbalanced')?.checked || false;

    // 계산 → 렌더링
    const result = calculateDamage(state);
    if (typeof renderResult === 'function') renderResult(result);
    if (typeof renderWeaponComparison === 'function') renderWeaponComparison(result ? result.finalDmg : 0);

    saveState();
}

// ============ 저장 / 로드 ============

/**
 * 현재 state를 localStorage에 JSON으로 저장한다.
 * 저장 실패 시 콘솔 에러만 출력하고 앱 실행을 중단하지 않는다.
 */
function saveState() {
    try {
        localStorage.setItem('endfield_cal_save', JSON.stringify(state));
    } catch (e) {
        console.error('State save failed:', e);
    }
}

/**
 * localStorage에서 저장된 state를 복원한다.
 * 성공하면 true, 저장 데이터가 없거나 파싱 실패 시 false를 반환한다.
 *
 * [주의] 로드 후 applyStateToUI()를 호출해야 UI에 반영된다.
 */
function loadState() {
    try {
        const saved = localStorage.getItem('endfield_cal_save');
        if (saved) {
            const parsed = JSON.parse(saved);
            state = { ...state, ...parsed };
            // 구버전 저장 데이터 호환: disabledEffects 필드가 없는 경우 초기화
            if (!state.disabledEffects) state.disabledEffects = [];
            // 구버전 저장 데이터 호환: debuffState 필드 없으면 기본값
            if (!state.debuffState) state.debuffState = {
                defenseless: 0,
                artsAttach: { type: null, stacks: 0 },
                artsAbnormal: { '연소': 0, '감전': 0, '동결': 0, '부식': 0 }
            };
            return true;
        }
    } catch (e) {
        console.error('State load failed:', e);
    }
    return false;
}
