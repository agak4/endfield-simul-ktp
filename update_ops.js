const fs = require('fs');
const path = 'c:/workspace/endfield-cal/data_operators.js';
let content = fs.readFileSync(path, 'utf8');

const targets = [
    '감전 부여', '동결 부여', '부식 부여', '연소 부여', '방어 불능 부여',
    '열기 부착', '냉기 부착', '전기 부착', '자연 부착', '아츠 부착'
];

let count = 0;
// 객체 리터럴 찾기 (약식: { ... } 구조)
// type: '...'이 포함된 블록을 찾아서 처리
content = content.replace(/\{([^{}]+)\}/g, (match, body) => {
    const typeMatch = body.match(/type:\s*['"]([^'"]+)['"]/);
    if (!typeMatch) return match;
    const type = typeMatch[1];

    if (targets.includes(type)) {
        // 이미 target 속성이 있는지 확인
        if (!body.includes('target:')) {
            count++;
            // 끝에 , target: '적' 추가 (단, 뒤에 공백이 있을 수 있음)
            return match.replace(/(\s*)\}/, ", target: '적'$1}");
        }
    }
    return match;
});

fs.writeFileSync(path, content, 'utf8');
console.log(`Updated ${count} items in data_operators.js`);
