
// 무기 비교 스택 버그 수정 검증 스크립트 (Node.js 환경 또는 브라우저 콘솔용)
// 실제 환경에서 DATA_* 및 calculateDamage 등을 호출할 수 있다고 가정합니다.

const testState = {
    mainOp: {
        id: 'Chen Qianyu',
        wepId: 'sword_0',
        wepPot: 0,
        wepState: false,
        pot: 0,
        gears: [],
        gearForged: [],
        specialStack: {}
    },
    subOps: [],
    disabledEffects: [],
    effectStacks: {
        // 진천우 재능 1: 'Chen Qianyu_talent0_공격력 증가_v0_0' (예시 UID)
        // 실제 UID 형식을 확인해야 함. addEffect 로직상 `Chen Qianyu_talent0_공격력 증가_v0_0` 형태임
        'Endfield_Chen Qianyu_talent0_공격력 증가_v0_0': 1 // 1스택 강제 설정
    },
    debuffState: { physDebuff: {}, artsAttach: {}, artsAbnormal: {} },
    enemyResistance: 20
};

// 1. 일반 계산 (forceMaxStack = false)
const resNormal = calculateDamage(testState, false);
const talentEffectNormal = resNormal.activeEffects.find(e => e.uid.includes('talent0'));
console.log('--- 일반 계산 ---');
console.log('재능 스택:', talentEffectNormal ? talentEffectNormal._stackCount : '없음');

// 2. 무기 비교 모드 (forceMaxStack = true)
const resCompare = calculateDamage(testState, true);
const talentEffectCompare = resCompare.activeEffects.find(e => e.uid.includes('talent0'));
console.log('\n--- 무기 비교 계산 (forceMaxStack = true) ---');
console.log('재능 스택:', talentEffectCompare ? talentEffectCompare._stackCount : '없음');

if (talentEffectCompare && talentEffectCompare._stackCount === 1) {
    console.log('\n✅ 성공: 무기 비교 모드에서도 캐릭터 재능 스택(1)이 유지됩니다.');
} else {
    console.log('\n❌ 실패: 무기 비교 모드에서 캐릭터 재능 스택이 최대치(5)로 변경되었습니다.');
}
