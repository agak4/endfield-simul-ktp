const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'data_operators.js');
const code = fs.readFileSync(filePath, 'utf8');

let lines = code.split('\n');
let inSkill = false;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^\s*skill:\s*\[/)) {
        inSkill = true;
    } else if (inSkill && lines[i].match(/^\s*\],/)) {
        inSkill = false;
    } else if (inSkill && lines[i].match(/^\s*talents:\s*\[/)) {
        inSkill = false; // Just in case
    }

    if (inSkill) {
        // Regex to match "desc: '... ' }" or "desc: '...' }, //comment"
        const regex = /(desc:\s*(['"`])(?:(?!\2)[^\\]|\\.)*\2)(\s*\})(\s*,?)(\s*\/\/.*)?\s*$/;
        if (lines[i].match(regex)) {
            lines[i] = lines[i].replace(regex, (match, descPortion, quoteChar, closingBrace, comma, comments) => {
                let c = comma || '';
                let comm = comments || '';
                return descPortion + ',\n                levels: {\n                    M0: { },\n                    M1: { },\n                    M2: { },\n                    M3: { }\n                }\n            }' + c + comm;
            });
        }
    }
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log("data_operators.js updated successfully.");
