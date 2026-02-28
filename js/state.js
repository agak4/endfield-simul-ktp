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
 * - ui/render.js : renderResult
 *
 * [내부 규칙]
 * - state를 직접 수정하는 유일한 진입점은 updateState()다.
 *   다른 파일에서 state를 직접 변경하지 않는다.
 * - GEAR_SLOT_KEYS 순서는 HTML의 슬롯 순서와 동일하게 유지한다.
 *   (gloves → armor → kit1 → kit2)
 * - localStorage 키: 'endfield_cal_save' (변경 시 모든 저장 데이터가 초기화됨)
 */

// ============================================================
// 전역 상수
// ============================================================

const APP_VERSION = Date.now();

/** 스탯 키 → 한글 이름 변환 테이블 */
const STAT_NAME_MAP = { str: '힘', agi: '민첩', int: '지능', wil: '의지' };

/**
 * 장비 슬롯 식별자 목록.
 * 순서가 state.mainOp.gears / gearForged 배열 인덱스와 1:1 대응된다.
 */
const GEAR_SLOT_KEYS = ['gloves', 'armor', 'kit1', 'kit2'];
const GEAR_SELECT_IDS = GEAR_SLOT_KEYS.map(k => `gear-${k}-select`);
const GEAR_FORGE_IDS = GEAR_SLOT_KEYS.map(k => `gear-${k}-forge`);
const GEAR_IMAGE_IDS = GEAR_SLOT_KEYS.map(k => `gear-${k}-image`);

/** debuffState 기본값 팩토리 — loadState 마이그레이션과 초기화에서 공통 사용 */
const DEFAULT_DEBUFF_STATE = () => ({
    physDebuff: { defenseless: 0, armorBreak: 0, combo: 0 },
    artsAttach: { type: null, stacks: 0 },
    artsAbnormal: { '연소': 0, '감전': 0, '동결': 0, '부식': 0 },
});

// ============================================================
// 전역 상태
// ============================================================

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
        gearForged: [false, false, false, false],
        specialStack: {},
        skillLevels: { '일반 공격': 'M3', '배틀 스킬': 'M3', '연계 스킬': 'M3', '궁극기': 'M3' },
    },
    subOps: [
        { id: null, pot: 0, wepId: null, wepPot: 0, wepState: false, equipSet: null, skillLevels: { '일반 공격': 'M3', '배틀 스킬': 'M3', '연계 스킬': 'M3', '궁극기': 'M3' } },
        { id: null, pot: 0, wepId: null, wepPot: 0, wepState: false, equipSet: null, skillLevels: { '일반 공격': 'M3', '배틀 스킬': 'M3', '연계 스킬': 'M3', '궁극기': 'M3' } },
        { id: null, pot: 0, wepId: null, wepPot: 0, wepState: false, equipSet: null, skillLevels: { '일반 공격': 'M3', '배틀 스킬': 'M3', '연계 스킬': 'M3', '궁극기': 'M3' } },
    ],
    subOpsCollapsed: [false, true, true], // 기본값: 첫 번째만 펼침
    enemyUnbalanced: false,
    enemyDefense: 100,   // 적 방어력 (기본 100)
    enemyResistance: 0,  // 적의 기본 저항 (0, 20, 50, 70)
    activeSetId: null,   // collectAllEffects에서 갱신됨
    disabledEffects: [], // uid 문자열 배열
    effectStacks: {},    // { [uid]: count }

    /**
     * 디버프 상태 (스킬 트리거 조건 계산에 활용)
     *
     * artsAttach: 아츠 부착 (단 하나의 종류만 선택 가능)
     *   - type: '열기 부착' | '전기 부착' | '냉기 부착' | '자연 부착' | null
     *   - stacks: 0~4 단계
     *
     * artsAbnormal: 아츠 이상 4종, 각 0~4단계
     * physDebuff: 방어불능(0~4), 갑옷파괴(0~4), 연타(0~4)
     */
    debuffState: DEFAULT_DEBUFF_STATE(),

    /**
     * 사용 아이템 활성화 상태
     * - 혼란의 약제, 아츠가 부여된 금속 병, 제이콥의 유산, 푹 삶은 갈비 미삼탕, 원기 회복 탕약
     */
    usables: {
        '혼란의 약제': false,
        '아츠가 부여된 금속 병': false,
        '제이콥의 유산': false,
        '푹 삶은 갈비 미삼탕': false,
        '원기 회복 탕약': false
    },

    selectedSeqId: null, // 현재 선택된 사이클 아이템의 id
    skillSequence: [],   // { id: 'seq_...', type: '일반 공격', customState: null | {...} }
};

// ============================================================
// 공통 유틸리티
// ============================================================

/** @param {string} key @returns {string} 한글 스탯 이름 또는 원본 키 */
function getStatName(key) { return STAT_NAME_MAP[key] || key; }

/**
 * JSON 직렬화를 이용한 깊은 복사 (Date·함수 등 제외한 순수 데이터용).
 * state 내부의 debuffState, effectStacks 등 복사에 사용한다.
 * @template T
 * @param {T} obj
 * @returns {T}
 */
function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

// ============================================================
// localStorage 헬퍼
// ============================================================

/**
 * localStorage에 값을 JSON으로 저장한다.
 * 실패 시 콘솔 에러만 출력하고 앱을 중단하지 않는다.
 * @param {string} key
 * @param {*} value
 */
function lsSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { console.error(`[lsSet] Failed to save "${key}":`, e); }
}

/**
 * localStorage에서 JSON을 파싱하여 반환한다.
 * 키가 없거나 파싱 실패 시 null을 반환한다.
 * @param {string} key
 * @returns {*|null}
 */
function lsGet(key) {
    try {
        const v = localStorage.getItem(key);
        return v ? JSON.parse(v) : null;
    } catch (e) {
        console.error(`[lsGet] Failed to load "${key}":`, e);
        return null;
    }
}

// ============================================================
// 상태 업데이트
// ============================================================

/**
 * [Sync] 전역 설정을 개별 설정(customState)이 있는 모든 시퀀스 항목에 전파한다.
 * 특정 시퀀스 항목이 선택된 상태에서는 전파하지 않는다.
 * @param {'unbalanced'|'debuff'|'specialStack'|'effects'} type
 */
window.propagateGlobalStateToCustom = function (type) {
    if (state.selectedSeqId) return;

    state.skillSequence.forEach(item => {
        if (!item.customState) return;
        switch (type) {
            case 'unbalanced': item.customState.enemyUnbalanced = state.enemyUnbalanced; break;
            case 'debuff': item.customState.debuffState = deepClone(state.debuffState); break;
            case 'specialStack': item.customState.specialStack = deepClone(state.mainOp.specialStack); break;
            case 'effects':
                item.customState.disabledEffects = [...state.disabledEffects];
                item.customState.effectStacks = deepClone(state.effectStacks);
                break;
        }
    });
};

/**
 * DOM에서 현재 입력값을 읽어 state를 갱신하고,
 * 계산 → 렌더링 → 저장을 순서대로 실행한다.
 *
 * [주의] UI 이벤트 핸들러의 최종 호출지여야 한다.
 *        state를 직접 수정해야 한다면 이 함수를 통해 반영한다.
 */
function updateState() {
    // 메인 오퍼레이터
    state.mainOp.id = document.getElementById('main-op-select')?.value || null;
    state.mainOp.pot = Number(document.getElementById('main-op-pot')?.value) || 0;
    state.mainOp.wepId = document.getElementById('main-wep-select')?.value || null;
    state.mainOp.wepPot = Number(document.getElementById('main-wep-pot')?.value) || 0;
    state.mainOp.wepState = document.getElementById('main-wep-state')?.checked || false;
    state.mainOp.gearForge = document.getElementById('main-gear-forge')?.checked || false;

    // 장비 슬롯 일괄 읽기 (GEAR_SLOT_KEYS 순서와 동일)
    GEAR_SELECT_IDS.forEach((id, i) => { state.mainOp.gears[i] = document.getElementById(id)?.value || null; });
    GEAR_FORGE_IDS.forEach((id, i) => { state.mainOp.gearForged[i] = document.getElementById(id)?.checked || false; });

    // 서브 오퍼레이터 3명
    for (let i = 0; i < 3; i++) {
        const sub = state.subOps[i];
        sub.id = document.getElementById(`sub-${i}-op`)?.value || null;
        sub.pot = Number(document.getElementById(`sub-${i}-pot`)?.value) || 0;
        sub.wepId = document.getElementById(`sub-${i}-wep`)?.value || null;
        sub.wepPot = Number(document.getElementById(`sub-${i}-wep-pot`)?.value) || 0;
        sub.wepState = document.getElementById(`sub-${i}-wep-state`)?.checked || false;
        sub.equipSet = document.getElementById(`sub-${i}-set`)?.value || null;

        const content = document.getElementById(`sub-op-content-${i}`);
        if (content) state.subOpsCollapsed[i] = content.classList.contains('collapsed');
    }

    const unbalancedCb = document.getElementById('enemy-unbalanced');
    if (unbalancedCb) getTargetState().setUnbalanced(unbalancedCb.checked);

    const defenseEl = document.getElementById('enemy-defense');
    state.enemyDefense = defenseEl ? (parseInt(defenseEl.value || defenseEl.innerText) || 0) : 100;

    // 계산 → 렌더링
    const result = calculateDamage(state);
    if (typeof renderResult === 'function') renderResult(result);

    saveState();

    // 오퍼레이터별 설정 자동 저장
    if (state.mainOp.id) saveOpSettings(state.mainOp.id, {
        pot: state.mainOp.pot,
        wepId: state.mainOp.wepId, wepPot: state.mainOp.wepPot, wepState: state.mainOp.wepState,
        gears: state.mainOp.gears, gearForged: state.mainOp.gearForged, gearForge: state.mainOp.gearForge,
        specialStack: state.mainOp.specialStack,
        skillLevels: state.mainOp.skillLevels,
        skillSequence: state.skillSequence || [],
    });

    // 무기별 설정 자동 저장 (메인만)
    if (state.mainOp.wepId) saveWepSettings(state.mainOp.wepId, { pot: state.mainOp.wepPot, state: state.mainOp.wepState });

    for (let i = 0; i < 3; i++) {
        const sub = state.subOps[i];
        if (sub.id) saveOpSettings(sub.id, {
            pot: sub.pot,
            wepId: sub.wepId, wepPot: sub.wepPot, wepState: sub.wepState,
            equipSet: sub.equipSet,
            skillLevels: sub.skillLevels
        });
    }
}

// ============================================================
// 상태 접점 헬퍼 (일괄 vs 개별)
// ============================================================

/**
 * 선택된 스킬이 있을 때 해당 스킬 전용 상태(customState)를 초기화한다.
 * customState가 이미 있으면 아무 작업도 하지 않는다.
 */
function ensureCustomState() {
    if (!state.selectedSeqId) return;
    const item = state.skillSequence.find(s => s.id === state.selectedSeqId);
    if (item && !item.customState) {
        item.customState = {
            disabledEffects: [...state.disabledEffects],
            effectStacks: deepClone(state.effectStacks),
            debuffState: deepClone(state.debuffState),
            enemyUnbalanced: state.enemyUnbalanced,
            specialStack: state.mainOp.specialStack,
            usables: deepClone(state.usables)
        };
    }
}

/**
 * 현재 조작해야 할 상태 대상을 반환한다.
 * 선택된 스킬이 있으면 해당 스킬 전용 상태를, 없으면 전역 상태를 반환한다.
 * @returns {{ disabledEffects: Array, effectStacks: object, debuffState: object,
 *             isUnbalanced: ()=>boolean, setUnbalanced: (val:boolean)=>void,
 *             getSpecialStack: ()=>object, setSpecialStack: (val:object)=>void }}
 */
function getTargetState() {
    if (state.selectedSeqId) {
        const item = state.skillSequence.find(s => s.id === state.selectedSeqId);
        if (item?.customState) {
            const cs = item.customState;
            return {
                disabledEffects: cs.disabledEffects,
                effectStacks: cs.effectStacks,
                debuffState: cs.debuffState,
                usables: cs.usables,
                isUnbalanced: () => cs.enemyUnbalanced,
                setUnbalanced: (val) => { cs.enemyUnbalanced = val; },
                getSpecialStack: () => cs.specialStack,
                setSpecialStack: (val) => { cs.specialStack = val; },
                mainOp: { ...state.mainOp, specialStack: cs.specialStack }
            };
        }
    }
    return {
        disabledEffects: state.disabledEffects,
        effectStacks: state.effectStacks,
        debuffState: state.debuffState,
        usables: state.usables,
        isUnbalanced: () => state.enemyUnbalanced,
        setUnbalanced: (val) => { state.enemyUnbalanced = val; },
        getSpecialStack: () => state.mainOp.specialStack,
        setSpecialStack: (val) => { state.mainOp.specialStack = val; },
        mainOp: state.mainOp
    };
}

// ============================================================
// 저장 / 로드
// ============================================================

/**
 * 현재 state를 localStorage에 저장한다.
 * 실패 시 콘솔 에러만 출력하고 앱 실행을 중단하지 않는다.
 */
function saveState() { lsSet('endfield_cal_save', state); }

/**
 * 오퍼레이터별 설정을 localStorage에 저장한다.
 * 기존 설정과 병합(merge)하여 일부 필드만 덮어쓸 수 있다.
 * @param {string} opId
 * @param {object} settings
 */
function saveOpSettings(opId, settings) {
    if (!opId) return;
    lsSet(`opSettings_${opId}`, { ...(loadOpSettings(opId) || {}), ...settings });
}

/**
 * 오퍼레이터별 저장 설정을 불러온다. 없으면 null 반환.
 * @param {string} opId
 * @returns {object|null}
 */
function loadOpSettings(opId) { return opId ? lsGet(`opSettings_${opId}`) : null; }

/**
 * 무기별 설정을 localStorage에 저장한다.
 * @param {string} wepId
 * @param {object} settings
 */
function saveWepSettings(wepId, settings) { if (wepId) lsSet(`wepSettings_${wepId}`, settings); }

/**
 * 무기별 저장 설정을 불러온다. 없으면 null 반환.
 * @param {string} wepId
 * @returns {object|null}
 */
function loadWepSettings(wepId) { return wepId ? lsGet(`wepSettings_${wepId}`) : null; }

/**
 * localStorage에서 저장된 state를 복원한다.
 * 구버전 저장 데이터에 대한 마이그레이션도 이 함수에서 처리한다.
 * 성공하면 true, 저장 데이터가 없거나 파싱 실패 시 false를 반환한다.
 *
 * [주의] 로드 후 applyStateToUI()를 호출해야 UI에 반영된다.
 * @returns {boolean}
 */
function loadState() {
    const parsed = lsGet('endfield_cal_save');
    if (!parsed) return false;

    state = { ...state, ...parsed };

    // ---- 필드 누락 안전장치 ----
    if (!state.disabledEffects) state.disabledEffects = [];
    if (!state.effectStacks) state.effectStacks = {};
    if (typeof state.mainOp.specialStack !== 'object' || state.mainOp.specialStack === null) {
        state.mainOp.specialStack = {};
    }
    if (!state.mainOp.skillLevels) {
        state.mainOp.skillLevels = { '일반 공격': 'M3', '배틀 스킬': 'M3', '연계 스킬': 'M3', '궁극기': 'M3' };
    }
    state.subOps.forEach(sub => {
        if (!sub.skillLevels) {
            sub.skillLevels = { '일반 공격': 'M3', '배틀 스킬': 'M3', '연계 스킬': 'M3', '궁극기': 'M3' };
        }
    });
    if (!state.usables) {
        state.usables = {
            '혼란의 약제': false,
            '아츠가 부여된 금속 병': false,
            '제이콥의 유산': false,
            '푹 삶은 갈비 미삼탕': false,
            '원기 회복 탕약': false
        };
    }

    // enemyDefense는 저장값을 무시하고 항상 기본값(100)으로 초기화한다.
    state.enemyDefense = 100;

    // ---- debuffState 마이그레이션 ----
    state.debuffState = migrateDebuffState(state.debuffState);

    // ---- skillSequence 마이그레이션 ----
    state.skillSequence = migrateSkillSequence(parsed);

    return true;
}

/**
 * 저장된 debuffState를 현재 스키마로 마이그레이션한다.
 * 세 가지 구버전 형태를 처리한다:
 *   1. debuffState 자체가 없는 경우 → 기본값 생성
 *   2. 중첩 구조(debuffState.debuffState) → 평탄화
 *   3. 평탄화된 옛 구조(defenseless 직접 존재) → physDebuff로 이동
 * @param {object|undefined} ds - 복원된 debuffState
 * @returns {object} 마이그레이션된 debuffState
 */
function migrateDebuffState(ds) {
    if (!ds) return DEFAULT_DEBUFF_STATE();

    // 케이스 2: 중첩 구조 복구
    if (ds.debuffState) {
        console.warn('Fixing nested debuffState structure...');
        const old = ds.debuffState;
        ds = {
            physDebuff: { defenseless: old.defenseless || 0, armorBreak: old.armorBreak || 0, combo: 0 },
            artsAttach: old.artsAttach || { type: null, stacks: 0 },
            artsAbnormal: old.artsAbnormal || { '연소': 0, '감전': 0, '동결': 0, '부식': 0 },
        };
    }

    // 케이스 3: 평탄화된 옛 구조 → physDebuff로 이동
    if (ds.defenseless !== undefined || ds.armorBreak !== undefined) {
        if (!ds.physDebuff) {
            ds.physDebuff = { defenseless: ds.defenseless || 0, armorBreak: ds.armorBreak || 0, combo: 0 };
        }
        delete ds.defenseless;
        delete ds.armorBreak;
    }

    // physDebuff 객체 자체가 없는 경우 생성
    if (!ds.physDebuff) ds.physDebuff = { defenseless: 0, armorBreak: 0, combo: 0 };

    // combo 필드 누락 처리
    if (ds.physDebuff.combo === undefined) ds.physDebuff.combo = 0;

    return ds;
}

/**
 * 저장된 skillSequence를 현재 스키마로 마이그레이션한다.
 * 세 가지 구버전 형태를 처리한다:
 *   1. 구버전 skillCounts 객체 → skillSequence 배열로 변환
 *   2. skillSequence가 없는 경우 → 빈 배열 반환
 *   3. 문자열 배열 → 객체 배열로 변환
 * @param {object} parsed - localStorage에서 복원된 원시 state 객체
 * @returns {Array}
 */
function migrateSkillSequence(parsed) {
    // 케이스 1: 구버전 skillCounts → skillSequence
    if (parsed.skillCounts && !parsed.skillSequence) {
        const seq = [];
        ['일반 공격', '배틀 스킬', '연계 스킬', '궁극기'].forEach(type => {
            const count = parsed.skillCounts[type] || 0;
            for (let n = 0; n < count; n++) {
                seq.push({ id: `seq_${Date.now()}_${Math.random().toString(36).substr(2, 5)}_${n}`, type, customState: null });
            }
        });
        return seq;
    }

    // 케이스 2: skillSequence 없음
    if (!parsed.skillSequence) return [];

    // 케이스 3: 문자열 배열 → 객체 배열
    return parsed.skillSequence.map((item, idx) =>
        typeof item === 'string'
            ? { id: `seq_mig_${Date.now()}_${idx}`, type: item, customState: null }
            : item
    );
}