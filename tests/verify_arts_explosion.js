
const fs = require('fs');
const path = require('path');

// Mock data
global.DATA_ABNORMALS = {
    '아츠 폭발': { element: 'arts', base: '160%', desc: '...' }
};
global.DATA_OPERATORS = [{ id: 'TestOp', skill: [] }];
global.DATA_WEAPONS = [];
global.DATA_GEAR = [];
global.DATA_SETS = [];

const calcCode = fs.readFileSync(path.join(__dirname, '../js/calc.js'), 'utf8');

// 검증 1: 코드 내 명칭 통합 확인
const isArtsExplosionUnified = calcCode.includes("artsName = '아츠 폭발'");
const isElementPassed = calcCode.includes("element: (artsName === '아츠 폭발')");
const isDynamicElementUsed = calcCode.includes("const aElem = a.element || aData.element");

console.log('--- 아츠 폭발 통합 검증 ---');
console.log('1. 아츠 폭발 명칭 통합:', isArtsExplosionUnified ? '성공' : '실패');
console.log('2. 동적 속성 정보 전달:', isElementPassed ? '성공' : '실패');
console.log('3. 계산 시 동적 속성 사용:', isDynamicElementUsed ? '성공' : '실패');

if (isArtsExplosionUnified && isElementPassed && isDynamicElementUsed) {
    console.log('\n모든 수정 사항이 반영되었습니다.');
} else {
    process.exit(1);
}
