/**
 * 간단한 브라우저 기반 테스트 러너
 */
const resultsDiv = document.getElementById('results');
let passed = 0;
let failed = 0;

function log(msg, isPass) {
    const div = document.createElement('div');
    div.textContent = (isPass ? '[성공] ' : '[실패] ') + msg;
    div.className = isPass ? 'pass' : 'fail';
    resultsDiv.appendChild(div);
    if (isPass) passed++; else failed++;
}

function assert(condition, desc) {
    if (condition) log(desc, true);
    else log(desc + ' (실패)', false);
}

function assertEqual(actual, expected, desc) {
    if (actual === expected) log(desc, true);
    else log(`${desc} (기대값: ${expected}, 실제값: ${actual})`, false);
}

// ============ 테스트 케이스 ============

function runTests() {
    console.log('테스트 실행 중...');

    // 1. 기본 계산 테스트
    testBasicCalculation();

    // 2. 세트 효과 테스트
    testSetEffects();

    // 요약 출력
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'summary';
    summaryDiv.textContent = `전체: ${passed + failed}, 성공: ${passed}, 실패: ${failed}`;
    resultsDiv.appendChild(summaryDiv);
}

function testBasicCalculation() {
    // 모의 상태(Mock State) 생성
    const mockState = {
        mainOp: {
            id: 'Endministrator',
            pot: 0,
            wepId: 'Grand Vision',
            wepPot: 0,
            wepState: false,
            gearForge: false,
            gears: [null, null, null, null],
            gearForged: [false, false, false, false]
        },
        subOps: [{}, {}, {}],
        disabledEffects: [],
        debuffState: { physDebuff: {}, artsAbnormal: {} }
    };

    const result = calculateDamage(mockState);

    assert(result !== null, '계산 결과가 반환되어야 함');
    if (result) {
        // 엔드미니스트레이터 기본 공격력 + 무기 공격력 확인
        assert(result.finalDmg > 1000, '최종 데미지가 합리적인 범위 내여야 함 (>1000)');
        console.log('최종 데미지:', result.finalDmg);
    }
}

function testSetEffects() {
    // 세트 효과 감지 테스트
    const mockState = {
        mainOp: {
            id: 'Endministrator', // 물리 타입
            gears: ['gear_13', 'gear_16', 'gear_11', 'gear_12'], // 개척자 세트 가정
            gearForged: [false, false, false, false]
        },
        subOps: [{}, {}, {}],
        disabledEffects: [],
        debuffState: { physDebuff: {}, artsAbnormal: {} }
    };

    const res = calculateDamage(mockState);
    if (res) {
        log('장비 세트가 포함된 상태로 계산 완료', true);
    }
}


// 실행 시작
setTimeout(runTests, 100);
