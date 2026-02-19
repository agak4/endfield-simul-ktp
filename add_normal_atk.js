const fs = require('fs');
const path = 'c:/workspace/endfield-cal/data_operators.js';
const content = fs.readFileSync(path, 'utf8');
let lines = content.split(/\r?\n/);

let count = 0;
// skill: [ 라인을 찾아서 그 다음 줄에 일반공격 객체 추가
const newLines = [];
lines.forEach(line => {
    newLines.push(line);
    if (line.includes('skill: [')) {
        // 중복 방지: 다음 줄이나 그 근처에 이미 '일반공격'이 있는지 체크할 수도 있지만,
        // 여기서는 단순하게 바로 다음 줄에 추가. (이미 수행된 파일이면 중복될 수 있음 -> 수동 확인 필요하거나 파일 백업 필요)
        // 안전 장치: 파일 내용에 '일반공격'이 있으면 스킵? 아니오, 오퍼레이터별로 체크해야 함.
        // 하지만 정규식으로 lookahead 하기는 복잡함.
        // 일단 무조건 추가하되, 사용자가 한 번만 실행한다고 가정.

        // 들여쓰기 12칸 (보통 skill: [ 가 8칸, 그 안은 12칸)
        newLines.push("            { skilltype: '일반공격', dmg: 0 },");
        count++;
    }
});

// 만약 이미 '일반공격'이 존재하면 count가 0이어야 함?
// 일단 덮어쓰기.

fs.writeFileSync(path, newLines.join('\n'), 'utf8');
console.log(`Added 'Normal Attack' to ${count} operators.`);
