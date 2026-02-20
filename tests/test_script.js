const fs = require('fs');
global.document = { getElementById: () => ({ addEventListener: () => { } }), querySelectorAll: () => ([]) };
const dataOp = fs.readFileSync('./data_operators.js', 'utf8');
const calcJs = fs.readFileSync('./js/calc.js', 'utf8');

eval(dataOp.replace('const DATA_OPERATORS =', 'global.DATA_OPERATORS ='));
global.DATA_WEAPONS = [{ id: 'handcannon', type: 'handcannon', baseAtk: 100, traits: [] }];
global.DATA_GEAR = [];
global.DATA_SETS = [];

const STAT_NAME_MAP = { str: '힘', agi: '민첩', int: '지능', wil: '의지' };
global.STAT_NAME_MAP = STAT_NAME_MAP;
function getStatName(k) { return STAT_NAME_MAP[k] || k; }
global.getStatName = getStatName;

eval(calcJs);

const state = {
    mainOp: { id: 'Yvonne', wepId: 'handcannon', pot: 5, gears: [], gearForged: [] },
    subOps: [], disabledEffects: [], debuffState: { physDebuff: {}, artsAttach: {}, artsAbnormal: {} },
    overrideSkillElement: null
};

const baseRes = calculateDamage(state);
console.log('--- 강화 일반 공격 ---');
const singleHitEnhancedNormal = calcSingleSkillDamage('강화 일반 공격', state, baseRes);
console.log(singleHitEnhancedNormal.logs);

console.log('\n--- 일반 공격 ---');
const singleHitNormal = calcSingleSkillDamage('일반 공격', state, baseRes);
console.log(singleHitNormal.logs);

const statePerlica = {
    mainOp: { id: 'Perlica', wepId: 'handcannon', pot: 5, gears: [], gearForged: [] },
    subOps: [], disabledEffects: [], debuffState: { physDebuff: {}, artsAttach: {}, artsAbnormal: {} },
    overrideSkillElement: null
};
const baseResPerlica = calculateDamage(statePerlica);

console.log('\n--- 펠리카 궁극기 ---');
const singleHitUltPerlica = calcSingleSkillDamage('궁극기', statePerlica, baseResPerlica);
console.log(singleHitUltPerlica.logs);

console.log('\n--- 펠리카 일반 공격 ---');
const singleHitNormalPerlica = calcSingleSkillDamage('일반 공격', statePerlica, baseResPerlica);
console.log(singleHitNormalPerlica.logs);
