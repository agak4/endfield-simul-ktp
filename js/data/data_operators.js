/**
 * [오퍼레이터 객체 기본 구조]
 * {
 *   id: string,               // 고유 ID (예: 'Endministrator')
 *   name: string,             // 이름 (예: '관리자')
 *   class: string,            // 클래스 (guard, vanguard, defender, supporter, caster, striker)
 *   rarity: number,           // 희귀도 (4, 5, 6)
 *   baseAtk: number,          // 기본 공격력 (캐릭터창 기준)
 *   mainStat: string,         // 주능력치 키 (agi, str, int, wil)
 *   subStat: string,          // 부능력치 키 (str, agi, wil, int)
 *   type: string,             // 공격 타입 ('phys': 물리, 'arts': 아츠)
 *   element: string|null,     // 속성 (null, 'heat', 'cryo', 'elec', 'nature')
 *   stats: { str, agi, int, wil }, // 기본 능력치 수치
 *   usableWeapons: string[],  // 장착 가능 무기 유형 (예: ['sword'])
 *   skill: [                  // 스킬 리스트 (일반 공격, 배틀 스킬, 연계 스킬, 궁극기 순)
 *     { skillType: string[], element, dmg, cost?, type?, target?, bonus?, desc }, ...
 *   ],
 *   talents: [                // 특성 (배열 내 배열 구조)
 *     [{ type: string[], val, target?, trigger? }, ...], ...
 *   ],
 *   potential: [              // 잠재 (1~5단계, 총 5개 슬롯)
 *     [{ type: string[], val, ... }, ...], ...
 *   ]
 * }
 */
const DATA_OPERATORS = [

    {
        id: 'Endministrator',
        name: '관리자',
        class: 'guard',
        rarity: 6,
        baseAtk: 312,
        mainStat: 'agi',
        subStat: 'str',
        type: 'phys',
        element: null,
        stats: { str: 123, agi: 200, int: 96, wil: 107 },
        usableWeapons: ['sword'],
        specialStack: [
            { name: '오리지늄 결정', id: 'originiumSeal', max: 1, triggers: ['오리지늄 결정'] }
        ],
        skill: [
            { skillType: ['일반 공격'], element: 'phys', dmg: '348%', desc: '적에게 최대 5단 공격을 하여 물리 피해를 줍니다.' },
            { skillType: ['배틀 스킬'], element: 'phys', dmg: '350%', type: ['강타'], target: '적', desc: '오리지늄 아츠를 사용해 전방 일정 범위 내의 적을 공격하여 물리 피해를 주고 강타합니다.' },
            { skillType: ['연계 스킬'], element: 'phys', dmg: '100%', type: ['오리지늄 결정'], target: '적', desc: '팀 내 다른 오퍼레이터의 연계 스킬이 피해를 줄 때 사용할 수 있습니다. 적의 근처로 돌진하여 대상에게 물리 피해를 주고 오리지늄 결정을 부착하며 일정 시간 봉인합니다. 물리 이상과 방어 불능 상태를 부여하면 오리지늄 결정을 소모하고 추가로 물리 피해를 줍니다.' },
            { skillType: ['궁극기'], element: 'phys', cost: 80, dmg: '800%', bonus: [{ trigger: ['오리지늄 결정'], val: '1000%' }], desc: '오리지늄 아츠로 지면을 강타하여, 전방 부채꼴 범위 내의 적에게 대량의 물리 피해를 줍니다. 적에게 오리지늄 결정이 부착되어 있을 경우, 오리지늄 결정을 파괴하며 1회에 한하여 추가로 물리 피해를 줍니다.' }
        ],
        talents: [
            [{ type: ['공격력 증가'], val: '30%', desc: '적에게 부착한 오리지늄 결정이 소모됐을 때, 자신의 공격력 +30%' }],
            [{ type: ['받는 물리 피해'], val: '20%', target: '적', trigger: ['오리지늄 결정'], desc: '오리지늄 결정을 부착한 적에게 주는 물리 피해 +20%' }]
        ],
        potential: [
            [{ desc: '배틀 스킬 구성 시퀀스가 오리지늄 결정을 소모했을 때, 스킬 게이지를 50포인트 반환합니다.' }],
            [{ type: ['공격력 증가'], val: '15%', target: '팀', desc: '재능1 효과 강화: 자신이 공격력 증가 효과를 획득할 때, 다른 아군 오퍼레이터가 공격력 증가 효과의 절반을 획득합니다.' }],
            [{ desc: '???' }],
            [{ desc: '???' }],
            [{ desc: '???' }]
        ]

    },
    {
        id: 'Lifeng',
        name: '여풍',
        class: 'guard',
        rarity: 6,
        baseAtk: 312,
        mainStat: 'agi',
        subStat: 'str',
        type: 'phys',
        element: null,
        stats: { str: 123, agi: 192, int: 115, wil: 117 },
        usableWeapons: ['polearm'],
        skill: [
            { skillType: ['일반 공격'], element: 'phys', dmg: '351%', desc: '적에게 최대 4단 공격을 하여 물리 피해를 줍니다.' },
            { skillType: ['배틀 스킬'], element: 'phys', dmg: '440%', type: [{ type: '물리 취약', val: '12%', target: '적' }, { type: '넘어뜨리기', target: '적' }], desc: '전방으로 창을 여러 번 휘둘러 2회의 물리 피해를 줍니다. 이후 힘차게 지면을 내리쳐 전방 모든 적에게 다시 물리 피해를 주고 넘어뜨리기 상태로 만듭니다. 마지막 공격에 명중한 적이 방어 불능 상태가 아닐 경우, 추가로 대상에게 12초간 물리 취약 상태를 부여합니다.' },
            { skillType: ['연계 스킬'], element: 'phys', dmg: '480%', type: ['연타'], target: '팀', desc: '물리 취약 또는 갑옷 파괴 상태의 적이 메인 컨트롤 오퍼레이터의 강력한 일격을 받았을 때 사용할 수 있습니다. 화신을 내세워 장창으로 찌르며, 물리 피해를 주고 20초간 연타를 획득합니다.' },
            { skillType: ['궁극기'], element: 'phys', cost: 90, dmg: '800%', type: ['넘어뜨리기'], target: '적', desc: '화신을 내세워 부동저로 지면을 힘껏 내리칩니다. 넓은 범위 내의 모든 적에게 물리 피해를 주고 넘어뜨리기 상태로 만들며, 모든 적을 중심으로 향해 끌어당깁니다. 일정 시간 후, 여전히 타격 범위 내에 남아 있는 모든 적에게는 다시 대량의 물리 피해를 주고 넘어뜨리기 상태로 만듭니다. 해당 스킬이 연타를 소모했다면, 대량의 추가 물리 피해를 줍니다.', bonus: [{ trigger: ['연타'], val: '600%' }] }
        ],
        talents: [
            [{ type: ['공격력 증가'], val: '지능, 의지 1포인트당 0.15% 증가' }],
            [{ type: ['물리 데미지'], element: 'phys', dmg: '100%', trigger: ['넘어뜨리기'] }]
        ],
        potential: [
            [{ type: ['물리 취약'], val: '5%', target: '적' }],
            [{ type: ['스탯'], stats: '모든 능력치', val: 15 }],
            [{ type: ['공격력 증가'], val: '지능, 의지 1포인트당 0.05% 증가' }],
            [{ type: ['궁극기 에너지 감소'], val: '-15%' }],
            [{ type: ['물리 데미지'], element: 'phys', dmg: '150%', trigger: ['넘어뜨리기'] }]
        ]
    },
    {
        id: 'Chen Qianyu',
        name: '진천우',
        class: 'guard',
        rarity: 5,
        baseAtk: 297,
        mainStat: 'agi',
        subStat: 'str',
        type: 'phys',
        element: null,
        stats: { str: 106, agi: 231, int: 85, wil: 93 },
        usableWeapons: ['sword'],
        skill: [
            { skillType: ['일반 공격'], element: 'phys', dmg: '317%', desc: '적에게 최대 5단 공격을 하여 물리 피해를 줍니다.' },
            { skillType: ['배틀 스킬'], element: 'phys', dmg: '380%', type: ['띄우기'], target: '적', desc: '목표한 적을 올려 칩니다. 물리 피해를 주고 띄우기 상태로 만듭니다.' },
            { skillType: ['연계 스킬'], element: 'phys', dmg: '270%', type: ['띄우기'], target: '적', desc: '적이 방어 불능 상태일 때 사용할 수 있습니다. 적을 관통하고 돌진 베기를 사용합니다. 경로 상의 모든 적에게 물리 피해를 주고, 띄우기 상태로 만듭니다.' },
            { skillType: ['궁극기'], element: 'phys', cost: 70, dmg: '1509%', desc: '목표한 적에게 7단 베기를 사용합니다. 공격할 때마다 물리 피해를 주며, 마지막 베기 공격은 더 큰 피해를 줍니다.' }
        ],
        talents: [
            [{ type: ['공격력 증가'], val: '40%' }],
            []
        ],
        potential: [
            [{ type: ['주는 피해'], val: '20%' }],
            [{ type: ['스탯'], stats: '민첩', val: 15 }, { type: ['물리 피해'], val: '8%' }],
            [{ type: ['스킬 배율 증가'], val: '10%', skillType: ['배틀 스킬'] }, { type: ['스킬 배율 증가'], val: '10%', skillType: ['연계 스킬'] }, { type: ['스킬 배율 증가'], val: '10%', skillType: ['궁극기'] }],
            [{ type: ['궁극기 에너지 감소'], val: '-15%' }],
            []
        ]
    },
    {
        id: 'Estella',
        name: '에스텔라',
        class: 'guard',
        rarity: 4,
        baseAtk: 312,
        mainStat: 'wil',
        subStat: 'str',
        type: 'arts',
        element: 'cryo',
        stats: { str: 104, agi: 97, int: 110, wil: 211 },
        usableWeapons: ['polearm'],
        skill: [
            { skillType: ['일반 공격'], element: 'phys', dmg: '293%', desc: '적에게 최대 4단 공격을 하여 물리 피해를 줍니다.' },
            { skillType: ['배틀 스킬'], element: 'cryo', dmg: '350%', type: ['냉기 부착'], target: '적', desc: '전방으로 장창을 찔러 냉기 음파를 방출합니다. 일직선상의 적에게 냉기 피해를 주고 냉기 부착 상태를 부여합니다.' },
            { skillType: ['연계 스킬'], element: 'phys', dmg: '360%', type: [{ type: '물리 취약', val: '15%', target: '적' }, { type: '강제 띄우기', target: '적' }], bonus: [{ trigger: ['동결'], val: '630%' }], desc: '적이 동결 상태일 때 사용할 수 있습니다. 빠르게 적에게 접근하여 좁은 범위 내의 적에게 물리 피해를 주고, 강제 띄우기 상태로 만듭니다. 동결 상태의 적에게 명중했을 경우, 추가로 피해를 주고 6초간 물리 취약 상태를 부여합니다.' },
            { skillType: ['궁극기'], element: 'phys', cost: 70, dmg: '1100%', bonus: [{ trigger: ['물리 취약'], type: ['강제 띄우기'], target: '적' }], desc: '모든 힘을 쏟아 창을 힘껏 내려찍어 주변 원형 범위 내의 적에게 물리 피해를 줍니다. 적이 물리 취약 상태라면, 대상을 강제 띄우기 상태로 만듭니다.' }
        ],
        talents: [
            [],
            []
        ],
        potential: [
            [],
            [{ type: ['궁극기 에너지 감소'], val: '-10%' }],
            [],
            [{ type: ['스탯'], stats: '의지', val: 10 }, { type: ['스탯'], stats: '힘', val: 10 }],
            []
        ]
    },
    {
        id: 'Ember',
        name: '엠버',
        class: 'defender',
        rarity: 6,
        baseAtk: 323,
        mainStat: 'str',
        subStat: 'wil',
        type: 'arts',
        element: 'heat',
        stats: { str: 236, agi: 96, int: 86, wil: 120 },
        usableWeapons: ['great_sword'],
        skill: [
            { skillType: ['일반 공격'], element: 'phys', dmg: '539%', desc: '적에게 최대 4단 공격을 하여 물리 피해를 줍니다.' },
            { skillType: ['배틀 스킬'], element: 'heat', dmg: '390%', type: ['넘어뜨리기'], target: '적', desc: '전방으로 뛰어올라 힘차게 내리찍어 부채꼴 범위 내의 모든 적에게 열기 피해를 주고 넘어뜨리기 상태로 만듭니다. 이 과정에서 적에게 공격받았을 경우, 명중했을 때 추가로 불균형치 피해를 줍니다.' },
            { skillType: ['연계 스킬'], element: 'phys', dmg: '230%', type: [{ type: '치유', target: '팀' }, { type: '넘어뜨리기', target: '적' }], desc: '메인 컨트롤 오퍼레이터가 공격을 받았을 때 사용할 수 있습니다. 목표한 적을 향해 뛰어올라 힘차게 내리찍습니다. 물리 피해를 주고 넘어뜨리기 상태로 만들며, 메인 컨트롤 오퍼레이터를 치유합니다. 의지는 치유량을 추가로 증가시킵니다.' },
            { skillType: ['궁극기'], element: 'heat', cost: 100, dmg: '650%', type: ['보호'], target: '팀', desc: '지면을 강타하여 주변의 적에게 열기 피해를 주고, 동시에 10초간 팀 전체에게 엠버의 최대 생명력에 따른 보호를 부여합니다.' }
        ],
        talents: [
            [{ type: ['비호'], target: '팀' }],
            [{ type: ['공격력 증가'], val: '27%' }]
        ],
        potential: [
            [],
            [{ type: ['스탯'], stats: '힘', val: 20 }, { type: ['스탯'], stats: '의지', val: 20 }],
            [],
            [{ type: ['궁극기 에너지 감소'], val: '-15%' }],
            [{ type: ['공격력 증가'], val: '10%', target: '팀' }]
        ]
    },
    {
        id: 'Snowshine',
        name: '스노우샤인',
        class: 'defender',
        rarity: 5,
        baseAtk: 297,
        mainStat: 'str',
        subStat: 'wil',
        type: 'arts',
        element: 'cryo',
        stats: { str: 214, agi: 104, int: 93, wil: 108 },
        usableWeapons: ['great_sword'],
        skill: [
            { skillType: ['일반 공격'], element: 'phys', dmg: '481%', desc: '적에게 최대 3단 공격을 하여 물리 피해를 줍니다.' },
            { skillType: ['배틀 스킬'], element: 'cryo', dmg: '450%', type: [{ type: '비호', target: '팀' }, { type: '냉기 부착', target: '적' }], desc: '방패를 들어 공격을 막으며 자신과 주변의 오퍼레이터에게 90%의 비호를 부여하고, 스킬 게이지를 30포인트 반환합니다. 방패를 들고 있는 동안 공격을 받으면 반격하며 적에게 냉기 피해를 주고 냉기 부착을 부여합니다.' },
            { skillType: ['연계 스킬'], element: 'cryo', dmg: '0%', type: ['치유'], target: '팀', desc: '메인 컨트롤 오퍼레이터가 공격받아 생명력이 60% 이하일 때 사용할 수 있습니다. 스노우샤인이 대상에게 설원 구조 조수를 던집니다. 목표에 명중하면 즉시 주변의 오퍼레이터를 대량으로 치유하고, 3초 동안 범위 내의 오퍼레이터를 0.5초마다 지속적으로 치유합니다. 의지는 치유량을 추가로 증가시킵니다.' },
            { skillType: ['궁극기'], element: 'cryo', cost: 80, dmg: '450%', type: ['동결 부여'], target: '적', desc: '분사 장치를 이용하여 점프한 다음 앞으로 방패를 내리찍습니다. 범위 내의 적에게 대량의 냉기 피해를 주고, 5초 동안 지속되는 빙설 지대를 생성하여 0.5초마다 지속적으로 적에게 냉기 피해를 줍니다. 적이 일정 시간 동안 빙설 지대에서 벗어나지 못할 경우, 강제 동결됩니다.' }
        ],
        talents: [
            [],
            []
        ],
        potential: [
            [],
            [],
            [],
            [{ type: ['스탯'], stats: '의지', val: 20 }],
            []
        ]
    },
    {
        id: 'Catcher',
        name: '카치르',
        class: 'defender',
        rarity: 4,
        baseAtk: 300,
        mainStat: 'str',
        subStat: 'wil',
        type: 'phys',
        element: null,
        stats: { str: 236, agi: 96, int: 86, wil: 106 },
        usableWeapons: ['great_sword'],
        skill: [
            { skillType: ['일반 공격'], element: 'phys', dmg: '448%', desc: '적에게 최대 4단 공격을 하여 물리 피해를 줍니다.' },
            { skillType: ['배틀 스킬'], element: 'phys', dmg: '400%', type: [{ type: '비호', target: '팀' }, { type: '방어 불능 부여', target: '적' }], desc: '방패를 들어 공격을 막으며 자신과 주변의 오퍼레이터에게 90%의 비호를 부여하고, 스킬 게이지를 30포인트 반환합니다. 방패를 들고 있는 동안 공격을 받으면 반격하며 적에게 물리 피해를 주고 방어 불능 1스택을 부여합니다.' },
            { skillType: ['연계 스킬'], element: 'phys', dmg: '280%', type: ['보호'], target: '팀', desc: '적이 차지를 시작했거나, 메인 컨트롤 오퍼레이터가 공격받아 생명력이 40%보다 낮을 때 사용할 수 있습니다.주먹을 전방으로 힘껏 내려꽂아, 적에게 물리 피해를 주며, 자신과 다른 아군 오퍼레이터(메인 컨트롤 오퍼레이터 우선)에게 10초 동안 보호를 부여합니다. 방어력은 보호 수치를 추가로 증가시킵니다.' },
            { skillType: ['궁극기'], element: 'phys', cost: 80, dmg: '1005%', type: [{ type: '허약', target: '적' }, { type: '방어 불능 부여', target: '적' }], desc: '대검을 휘둘러 전방으로 빠르게 2단 베기를 사용하여, 물리 피해를 주고, 8초 동안 허약 상태를 부여합니다. 마지막에 아래로 힘차게 내리찍어 목표 범위 내의 모든 적에게 대량의 물리 피해를 주고, 적을 넘어뜨리기 상태로 만듭니다.' }
        ],
        talents: [
            [],
            []
        ],
        potential: [
            [],
            [{ type: ['스탯'], stats: '의지', val: 10 }],
            [],
            [{ type: ['궁극기 에너지 감소'], val: '-10%' }],
            []
        ]
    },
    {
        id: 'Gilberta',
        name: '질베르타',
        class: 'supporter',
        rarity: 6,
        baseAtk: 329,
        mainStat: 'wil',
        subStat: 'int',
        type: 'arts',
        element: 'nature',
        stats: { str: 89, agi: 92, int: 127, wil: 231 },
        usableWeapons: ['arts_unit'],
        skill: [
            { skillType: ['일반 공격'], element: 'nature', dmg: '352%', desc: '적에게 최대 4단 공격을 하여 자연 피해를 줍니다.' },
            { skillType: ['배틀 스킬'], element: 'nature', dmg: '349%', type: ['자연 부착'], target: '적', desc: '지속 시전 상태에 들어가며, 전방에 중력 특이점을 생성합니다. 중력 특이점은 지속적으로 주변의 적을 끌어들이며, 대상에게 자연 피해를 줍니다. 시전이 끝나면 중력 특이점은 폭발을 일으키며 범위 내의 적에게 자연 피해를 주고, 자연 부착 상태를 부여합니다.' },
            { skillType: ['연계 스킬'], element: 'nature', dmg: '315%', type: ['강제 띄우기'], target: '적', desc: '아츠 이상 상태를 부여한 적이 있을 때 사용할 수 있습니다. 짧게 시전하여 목표 및 주변의 모든 적들을 중력으로 끌어당깁니다. 대상에게 자연 피해를 주고, 강제 띄우기 상태로 만듭니다.' },
            { skillType: ['궁극기'], element: 'nature', cost: 90, dmg: '750%', type: [{ type: '자연 부착', target: '적' }, { type: '아츠 취약', val: '30%', target: '적', trigger: ['방어 불능'], perStack: '3%' }, { type: '감속', target: '적' }], desc: '5초간 지속되는 중력 혼란 구역을 생성하여, 구역 내의 적에게 즉시 1회의 자연 피해를 주고 자연 부착 상태를 부여합니다. 구역 내 목표에게 감속과 아츠 취약 상태(기본 30%)를 부여합니다. 목표가 방어 불능 상태일 경우, 아츠 취약 효과는 방어 불능 1스택당 3%씩 추가로 증가됩니다(최대 4스택). 구역 내 목표가 띄우기 상태일 경우, 구역 효과가 종료될 때까지 띄우기 상태를 유지합니다.' }
        ],
        talents: [
            [{ type: ['궁극기 충전 효율'], val: '7%', target: '팀' }],
            [{ type: ['치유'], target: '팀' }]
        ],
        potential: [
            [],
            [
                { type: ['방어 불능 보정'], val: 1, skillType: ['궁극기'] },
                { type: ['아츠 취약'], trigger: ['방어 불능'], perStack: '3%', target: '적', skillType: ['궁극기'], desc: '잠재2: 궁극기 판정 시 방어 불능 스택 +1 및 스택당 아츠 취약 +3% 추가' }
            ],
            [{ type: ['궁극기 충전 효율'], val: '5%', target: '팀' }],
            [{ type: ['궁극기 에너지 감소'], val: '-15%' }],
            [{ type: ['스킬 배율 증가'], val: '30%', skillType: ['연계 스킬'] }]
        ]
    },
    {
        id: 'Ardelia',
        name: '아델리아',
        class: 'supporter',
        rarity: 6,
        baseAtk: 323,
        mainStat: 'int',
        subStat: 'wil',
        type: 'arts',
        element: 'nature',
        stats: { str: 112, agi: 93, int: 205, wil: 118 },
        usableWeapons: ['arts_unit'],
        skill: [
            { skillType: ['일반 공격'], element: 'nature', dmg: '400%', desc: '적에게 최대 4단 공격을 하여 자연 피해를 줍니다.' },
            { skillType: ['배틀 스킬'], element: 'nature', dmg: '320%', type: [{ type: '부식 소모' }, { type: '물리 취약', val: '20%', target: '적' }, { type: '아츠 취약', val: '20%', target: '적' }], desc: '돌리 씨를 타고 목표를 향해 돌진하여 자연 피해를 줍니다. 목표가 부식 상태일 때, 부식 상태를 소모하고, 대상에게 30초간 물리 취약과 아츠 취약 상태를 부여합니다.' },
            { skillType: ['연계 스킬'], element: 'nature', dmg: '350%', type: ['부식 부여'], target: '적', desc: '메인 컨트롤 오퍼레이터가 방어 불능 혹은 아츠 부착 상태에 처해 있지 않은 적에게 강력한 일격을 준 후 사용할 수 있습니다. 화산 구름 한 덩이를 목표에 던지고 목표와 가까워진 후, 자연 피해를 주게 됩니다. 화산 구름은 목표를 추적한 다음, 일정 시간 뒤 폭발하며 주변의 다른 적에게 절반의 자연 피해를 주고 강제로 7초간 부식 상태를 부여합니다.' },
            { skillType: ['궁극기'], element: 'nature', cost: 90, dmg: '1650%', type: ['부식 부여'], target: '적', desc: '아델리아가 3초간 이동 가능한 지속 시전 상태에 들어가며, 돌리 씨를 소환하여 돌리 씨의 분신을 무작위로 사방에 던집니다. 각 분신이 적을 공격할 때마다 자연 피해를 주고, 적은 0.3초마다 최대 1회만 피해를 받습니다.' }
        ],
        talents: [
            [{ type: ['치유'], target: '팀' }],
            []
        ],
        potential: [
            [{ type: ['물리 취약'], val: '8%', target: '적' }, { type: ['아츠 취약'], val: '8%', target: '적' }],
            [{ type: ['치유'], target: '팀' }],
            [],
            [{ type: ['궁극기 에너지 감소'], val: '-15%' }],
            [{ type: ['스킬 배율 증가'], val: '20%', skillType: ['연계 스킬'] }]
        ]
    },
    {
        id: 'Xaihi',
        name: '자이히',
        class: 'supporter',
        rarity: 5,
        baseAtk: 291,
        mainStat: 'wil',
        subStat: 'int',
        type: 'arts',
        element: 'cryo',
        stats: { str: 89, agi: 91, int: 127, wil: 210 },
        usableWeapons: ['arts_unit'],
        skill: [
            { skillType: ['일반 공격'], element: 'cryo', dmg: '315%', desc: '적에게 최대 5단 공격을 하여 냉기 피해를 줍니다.' },
            { skillType: ['배틀 스킬'], element: 'cryo', dmg: '0%', type: [{ type: '치유', target: '팀' }, { type: '아츠 증폭', val: '15%', target: '팀' }], desc: '지원 결정체를 소환하여 20초 동안 메인 컨트롤 오퍼레이터를 따라다닙니다. 메인 컨트롤 오퍼레이터가 적에게 강력한 일격 피해를 줄 때, 지원 결정체가 생명력을 회복시켜 줍니다. 해당 효과는 최대 2회 발동하며, 의지는 치유량을 추가로 증가시킵니다. 만약 회복 효과가 발동했을 때, 메인 컨트롤 오퍼레이터의 생명력이 최대치에 도달한 상태라면, 25초간 대상에게 아츠 증폭을 부여합니다. 해당 효과는 중첩되지 않습니다.' },
            { skillType: ['연계 스킬'], element: 'cryo', dmg: '450%', type: ['냉기 부착'], target: '적', desc: '메인 컨트롤 오퍼레이터가 방어 불능 혹은 아츠 부착 상태에 처해 있지 않은 적에게 강력한 일격을 준 후 사용할 수 있습니다. 화산 구름 한 덩이를 목표에 던지고 목표와 가까워진 후, 자연 피해를 주게 됩니다. 화산 구름은 목표를 추적한 다음, 일정 시간 뒤 폭발하며 주변의 다른 적에게 절반의 자연 피해를 주고 강제로 7초간 부식 상태를 부여합니다.' },
            { skillType: ['궁극기'], element: 'cryo', cost: 80, dmg: '0%', type: [{ type: '냉기 증폭', val: '36%', target: '팀' }, { type: '자연 증폭', val: '36%', target: '팀' }], desc: '팀 전체에게 12초 동안 냉기 증폭과 자연 증폭 상태를 부여합니다. 지능은 해당 증폭 효과를 추가로 강화시킵니다.' }
        ],
        talents: [
            [{ type: ['받는 냉기 피해'], val: '10%', target: '적' }],
            []
        ],
        potential: [
            [{ type: ['아츠 증폭'], val: '5%', target: '팀' }],
            [{ type: ['궁극기 에너지 감소'], val: '-10%' }],
            [],
            [{ type: ['스탯'], stats: '지능', val: 15 }],
            [{ type: ['냉기 증폭'], val: '3.6%', target: '팀' }, { type: ['자연 증폭'], val: '3.6%', target: '팀' }]
        ]
    },
    {
        id: 'Antal',
        name: '안탈',
        class: 'supporter',
        rarity: 4,
        baseAtk: 297,
        mainStat: 'int',
        subStat: 'str',
        type: 'arts',
        element: 'elec',
        stats: { str: 129, agi: 86, int: 225, wil: 82 },
        usableWeapons: ['arts_unit'],
        skill: [
            { skillType: ['일반 공격'], element: 'elec', dmg: '307%', desc: '적에게 최대 4단 공격을 하여 전기 피해를 줍니다.' },
            { skillType: ['배틀 스킬'], element: 'elec', dmg: '200%', type: [{ type: '전기 취약', val: '10%', target: '적' }, { type: '열기 취약', val: '10%', target: '적' }], desc: '적을 60초간 포커싱하며 전기 피해를 줍니다. 포커싱 당한 적에게 전기 취약과 열기 취약 상태를 부여하고, 최대 1명의 적만 포커싱할 수 있습니다.' },
            { skillType: ['연계 스킬'], element: 'elec', dmg: '340%', type: [{ type: '방어 불능 부여', target: '적' }, { type: '아츠 부착', target: '적' }], target: '적', desc: '포커싱 당한 적이 물리 이상 혹은 아츠 부착 상태일 때 사용할 수 있습니다. 해당 적에게 에너지 폭발 1회를 일으켜 전기 피해를 주고, 다시 대상에게 해당 물리 이상 혹은 아츠 부착 상태를 부여합니다.' },
            { skillType: ['궁극기'], element: 'elec', cost: 100, dmg: '0%', type: [{ type: '전기 증폭', val: '20%', target: '팀' }, { type: '열기 증폭', val: '20%', target: '팀' }], desc: '팀 전체에게 12초 동안 전기 증폭과 열기 증폭을 부여합니다.' }
        ],
        talents: [
            [{ type: ['치유'], target: '팀' }],
            []
        ],
        potential: [
            [{ type: ['전기 증폭'], val: '2%', target: '팀' }, { type: ['열기 증폭'], val: '2%', target: '팀' }],
            [{ type: ['궁극기 에너지 감소'], val: '-10%' }],
            [],
            [{ type: ['스탯'], stats: '지능', val: 10 }],
            [{ type: ['전기 취약'], val: '4%', target: '적' }, { type: ['열기 취약'], val: '4%', target: '적' }]
        ]
    },
    {
        id: 'Perlica',
        name: '펠리카',
        class: 'caster',
        rarity: 5,
        baseAtk: 303,
        mainStat: 'int',
        subStat: 'wil',
        type: 'arts',
        element: 'elec',
        stats: { str: 91, agi: 93, int: 221, wil: 113 },
        usableWeapons: ['arts_unit'],
        skill: [
            { skillType: ['일반 공격'], element: 'elec', dmg: '336%', desc: '적에게 최대 4단 공격을 하여 전기 피해를 줍니다.' },
            { skillType: ['배틀 스킬'], element: 'elec', dmg: '400%', type: ['전기 부착'], target: '적', desc: '하늘에서 전기 에너지를 떨어뜨려, 좁은 범위 내의 적에게 전기 피해를 주고 전기 부착 상태를 부여합니다' },
            { skillType: ['연계 스킬'], element: 'elec', dmg: '180%', type: ['감전 부여'], target: '적', desc: '메인 컨트롤 오퍼레이터가 적에게 강력한 일격 피해를 준 다음 사용할 수 있습니다. 누적된 전기 에너지를 방출해 목표를 강타하며 전기 피해를 주고, 5초간 강제 감전 상태를 부여합니다.' },
            { skillType: ['궁극기'], element: 'elec', cost: 80, dmg: '1000%', desc: ' 즉시 거대한 궤도 부유물을 전송하여 목표 구역에 치명적인 타격을 줍니다. 구역 내의 적은 대량의 전기 피해를 받습니다.' }
        ],
        talents: [
            [{ type: ['불균형 목표에 주는 피해'], val: '30%' }],
            []
        ],
        potential: [
            [],
            [{ type: ['궁극기 에너지 감소'], val: '15%' }],
            [{ type: ['공격력 증가'], val: '40%' }],
            [{ type: ['받는 아츠 피해'], val: '4%', target: '적' }],
            [{ type: ['스킬 치명타 확률'], val: '30%', skillType: ['궁극기'] }]
        ]
    },
    {
        id: 'Wulfgard',
        name: '울프가드',
        class: 'caster',
        rarity: 5,
        baseAtk: 294,
        mainStat: 'str',
        subStat: 'agi',
        type: 'arts',
        element: 'heat',
        stats: { str: 221, agi: 95, int: 92, wil: 111 },
        usableWeapons: ['handcannon'],
        skill: [
            { skillType: ['일반 공격'], element: 'heat', dmg: '424%', desc: '적에게 최대 4단 공격을 하여 열기 피해를 줍니다.' },
            { skillType: ['배틀 스킬'], element: 'heat', dmg: '230%', type: ['열기 부착', '연소 소모', '감전 소모'], target: '적', bonus: [{ trigger: ['연소', '감전'], val: '850%' }], desc: '목표를 연속으로 사격하여 소량의 열기 피해를 주고, 마지막 한 발은 열기 부착 상태를 부여합니다. 목표가 연소 또는 감전 상태일 경우 열기 부착 상태를 부여하지 않고, 해당 상태를 소모하여 추가로 1회 사격하며, 대량의 열기 피해를 줍니다.' },
            { skillType: ['연계 스킬'], element: 'heat', dmg: '135%', type: ['열기 부착'], target: '적', desc: '아츠 부착 상태를 부여한 적이 있을 때 사용할 수 있습니다. 목표가 있는 위치로 땅에 떨어지면 폭발하는 폭렬 수류탄을 던집니다. 근처 범위 내의 적에게 열기 피해를 주고 열기 부착 상태를 부여합니다.' },
            { skillType: ['궁극기'], element: 'heat', cost: 90, dmg: '360%', type: ['연소 부여'], target: '적', desc: '빠르게 사격하며 늑대의 분노로 주변의 적을 공격합니다. 5회에 걸쳐 열기 피해를 주고 강제 연소 상태를 부여합니다.' }
        ],
        talents: [
            [{ type: ['열기 피해'], val: '30%' }],
            []
        ],
        potential: [
            [{ type: ['스탯'], stats: '힘', val: 15 }, { type: ['스탯'], stats: '민첩', val: 15 }],
            [],
            [{ type: ['열기 피해'], val: '15%', target: '팀' }],
            [{ type: ['궁극기 에너지 감소'], val: '-15%' }],
            []
        ]
    },
    {
        id: 'Fluorite',
        name: '플루라이트',
        class: 'caster',
        rarity: 4,
        baseAtk: 303,
        mainStat: 'agi',
        subStat: 'int',
        type: 'arts',
        element: 'nature',
        stats: { str: 90, agi: 228, int: 114, wil: 91 },
        usableWeapons: ['handcannon'],
        skill: [
            { skillType: ['일반 공격'], element: 'nature', dmg: '321%', desc: '적에게 최대 4단 공격을 하여 자연 피해를 줍니다.' },
            { skillType: ['배틀 스킬'], element: 'nature', dmg: '420%', type: [{ type: '자연 부착', target: '적' }, { type: '감속', target: '적' }], desc: '수제 폭탄을 걷어차서 목표에 붙이고, 30%의 감속 상태를 부여합니다. 일정 시간 뒤 폭탄이 폭발하여 범위 내의 적에게 자연 피해를 주고, 자연 부착 상태를 부여합니다. 폭탄이 붙은 목표가 처치될 경우, 해당 수제 폭탄은 즉시 폭발합니다. 전장에는 동시에 단 하나의 수제 폭탄만 존재할 수 있습니다.' },
            { skillType: ['연계 스킬'], element: 'nature', dmg: '380%', type: [{ type: '자연 부착', target: '적' }, { type: '냉기 부착', target: '적' }], desc: '적에게 냉기 부착 혹은 자연 부착 2스택 또는 그 이상이 쌓였을 때 사용할 수 있습니다. 목표한 적을 사격해 특수한 폭발을 일으키고, 자연 피해를 주며 아츠 부착 상태를 부여합니다.' },
            { skillType: ['궁극기'], element: 'nature', cost: 100, dmg: '1000%', type: [{ type: '자연 부착', target: '적' }, { type: '냉기 부착', target: '적' }], desc: '플루라이트가 아치형 궤적을 따라 고속으로 이동하며, 궤적 내의 목표를 향해 빠르게 사격하여 4단 자연 피해를 줍니다. 명중당한 목표에 수제 폭탄이 붙어있을 경우, 즉시 폭발하며 폭발 피해와 범위가 30% 증가합니다. 마지막 공격이 2스택 혹은 그 이상의 냉기 부착 또는 자연 부착 상태인 적을 명중하면, 해당 아츠 부착을 다시 한번 더 부여합니다.' }
        ],
        talents: [
            [{ type: ['주는 피해'], val: '20%' }],
            [{ type: ['공격력 증가'], val: '20%' }]
        ],
        potential: [
            [{ type: ['스탯'], stats: '민첩', val: 10 }, { type: ['스탯'], stats: '지능', val: 10 }],
            [],
            [],
            [{ type: ['궁극기 에너지 감소'], val: '-10%' }],
            []
        ]
    },
    {
        id: 'Laevatain',
        name: '레바테인',
        class: 'striker',
        rarity: 6,
        baseAtk: 318,
        mainStat: 'int',
        subStat: 'str',
        type: 'arts',
        element: 'heat',
        stats: { str: 121, agi: 99, int: 237, wil: 89 },
        usableWeapons: ['sword'],
        specialStack: { name: '녹아내린 불꽃', max: 1, triggers: ['녹아내린 불꽃'] },
        skill: [
            { skillType: ['일반 공격'], element: 'heat', dmg: '353%', desc: '적에게 최대 5단 공격을 하여 열기 피해를 줍니다.' },
            { skillType: ['강화 일반 공격'], element: 'heat', dmg: '1044%', desc: '15초 동안, 일반 공격이 강화되며 열화의 마검이 레바테인과 함께 적을 공격합니다. 모든 공격이 열기 피해를 주며, 3단계 일반 공격은 열기 부착 상태를 부여합니다.' },
            { skillType: ['배틀 스킬'], element: 'heat', dmg: '140%', type: ['연소 부여'], target: '적', bonus: [{ trigger: ['녹아내린 불꽃'], val: '770%' }], desc: '몰튼 코어 조각을 소환해 지속적으로 전방의 적을 공격합니다. 열기 피해를 주며, 적을 명중하면 녹아내린 불꽃 1스택을 획득합니다. 이미 녹아내린 불꽃 4스택이 쌓였을 경우, 마지막에 모든 스택 수치를 소모해 넓은 범위 내의 적에게 추가로 1회 공격하며, 열기 피해를 주고, 5초간 강제 연소 상태를 부여합니다. 추가 공격이 적에게 명중했다면 추가로 궁극기 에너지를 100포인트 획득합니다. 궁극기 사용 중에는 배틀 스킬의 효과가 강화됩니다.' },
            { skillType: ['강화 배틀 스킬'], element: 'heat', dmg: '700%', type: ['연소 부여'], target: '적', bonus: [{ trigger: ['녹아내린 불꽃'], val: '900%' }], desc: '궁극기 사용 중에는 배틀 스킬의 효과가 강화됩니다.' },
            { skillType: ['연계 스킬'], element: 'heat', dmg: '540%', desc: '적이 연소 상태거나, 부식 상태일 때 사용할 수 있습니다. 모든 연소 상태 혹은 부식 상태의 적의 발밑에서 불꽃이 솟아오르게 만들고, 대상에게 열기 피해를 줍니다. 적을 1명 명중할 때마다 1스택의 녹아내린 불꽃을 획득합니다. 적을 명중할 때마다 추가로 궁극기 에너지를 획득합니다.' },
            { skillType: ['궁극기'], element: 'heat', cost: 300, dmg: '0%', type: ['열기 부착'], target: '적', desc: '열화의 마검을 소환하고 메인 컨트롤 캐릭터로 전환합니다. 15초 동안, 일반 공격이 강화되며 열화의 마검이 레바테인과 함께 적을 공격합니다.' }
        ],
        talents: [
            [{ type: ['열기 저항 무시'], val: 20 }],
            []
        ],
        potential: [
            [{ type: ['스킬 배율 증가'], val: '20%', skillType: ['배틀 스킬', '강화 배틀 스킬'] }],
            [{ type: ['스탯'], stats: '지능', val: 20 }, { type: ['일반 공격 피해'], val: '15%' }],
            [],
            [{ type: ['궁극기 에너지 감소'], val: '-15%' }],
            [{ type: ['스킬 배율 증가'], val: '20%', skillType: ['강화 일반 공격'] }]
        ]
    },
    {
        id: 'Last Rite',
        name: '라스트 라이트',
        class: 'striker',
        rarity: 6,
        baseAtk: 332,
        mainStat: 'str',
        subStat: 'wil',
        type: 'arts',
        element: 'cryo',
        stats: { str: 215, agi: 104, int: 93, wil: 109 },
        usableWeapons: ['great_sword'],
        skill: [
            { skillType: ['일반 공격'], element: 'cryo', dmg: '548%', desc: '적에게 최대 4단 공격을 하여 냉기 피해를 줍니다.' },
            { skillType: ['배틀 스킬'], element: 'cryo', dmg: '320%', type: ['냉기 부착'], target: '적', desc: '15초간 메인 컨트롤 오퍼레이터의 무기에 저온 주입을 부여하고 스킬 게이지를 30포인트 반환합니다. 일정 시간 동안, 해당 메인 컨트롤 오퍼레이터가 사용한 1회의 강력한 일격이 라스트 라이트의 환영을 소환해 목표를 추격하며, 냉기 피해를 주고 냉기 부착 상태를 부여하며 궁극기 에너지를 16포인트 획득합니다. 메인 컨트롤 오퍼레이터가 라스트 라이트라면, 해당 배틀 스킬을 사용하더라도 일반 공격이 중단되지 않습니다.' },
            { skillType: ['연계 스킬'], element: 'cryo', dmg: '320%', type: ['냉기 부착 소모'], bonus: [{ trigger: ['냉기 부착'], base: '0%', perStack: '240%' }], desc: '적에게 냉기 부착 3스택 혹은 그 이상이 쌓였을 때 사용할 수 있습니다. 목표한 적에게 얼음송곳을 응결시킨 다음 산산이 조각냅니다. 목표에 쌓인 냉기 부착을 전부 소모하고, 대상에게 냉기 부착의 스택 수치에 따른 냉기 피해를 주며, 소모한 스택 수치에 따라 궁극기 에너지를 획득합니다.' },
            { skillType: ['궁극기'], element: 'cryo', cost: 240, dmg: '1600%', desc: '서리 갑옷을 두르고 얼음 낫을 만들어 전방으로 3회의 베기 공격을 진행합니다. 해당 상태에서는 모든 피해에 면역됩니다. 벨 때마다 대량의 냉기 피해를 줍니다. 라스트 라이트는 자신의 배틀 스킬, 연계 스킬을 통해서만 궁극기 에너지를 획득할 수 있습니다.' }
        ],
        talents: [
            [{ type: ['냉기 취약'], val: '4%', trigger: ['냉기 부착'], target: '적', stack: 4 }],
            [{ type: ['취약 증폭'], val: 0.5, target: '적', targetEffect: ['아츠 취약', '냉기 취약'], skillType: ['궁극기'], desc: '궁극기 피해를 줄 때, 적이 아츠 취약 혹은 냉기 취약 상태일 경우, 해당 효과를 기존의 1.5배로 간주합니다.' }]
        ],
        potential: [
            [{ type: ['강력한 일격 피해'], val: '20%', target: '팀' }],
            [{ type: ['스탯'], stats: '힘', val: 20 }, { type: ['냉기 피해'], val: '10%' }],
            [{ type: ['스킬 배율 증가'], val: '15%', skillType: ['연계 스킬'] }, { type: ['스킬 배율 증가'], val: '15%', skillType: ['궁극기'] }],
            [{ type: ['궁극기 에너지 감소'], val: '-15%' }],
            []
        ]
    },
    {
        id: 'Yvonne',
        name: '이본',
        class: 'striker',
        rarity: 6,
        baseAtk: 321,
        mainStat: 'int',
        subStat: 'agi',
        type: 'arts',
        element: 'cryo',
        stats: { str: 82, agi: 128, int: 236, wil: 105 },
        usableWeapons: ['handcannon'],
        skill: [
            { skillType: ['일반 공격'], element: 'cryo', dmg: '398%', desc: '적에게 최대 5단 공격을 하여 냉기 피해를 줍니다.' },
            { skillType: ['강화 일반 공격'], element: 'cryo', dmg: '1600%', type: ['동결 소모'], bonus: [{ trigger: ['동결'], base: '600%', perStack: '0%' }], desc: '7초 동안, 이본의 일반 공격이 강화되며 일반 공격을 할 때마다 자신의 치명타 확률이 3% 증가합니다(최대 10스택). 스택 수치가 최대로 쌓였을 경우, 자신의 치명타 피해가 60% 증가합니다. 지속 시간이 끝나기 전의 마지막 일반 공격은 강력한 일격으로 바뀌어 대량의 냉기 피해를 줍니다. 적이 동결 상태라면, 추가로 냉기 피해를 1회 준 후, 동결 상태를 소모합니다.' }, //65타 가정
            { skillType: ['배틀 스킬'], element: 'cryo', dmg: '400%', type: ['냉기 부착 소모', '자연 부착 소모', '동결 부여'], target: '적', bonus: [{ trigger: ['냉기 부착', '자연 부착'], base: '0%', perStack: '200%' }], desc: '전방을 향해 냉각탄을 발사합니다. 냉각탄은 적에게 명중된 다음 폭발하며 냉기 피해를 줍니다. 냉기 부착 혹은 자연 부착 상태의 적에게 명중했을 때, 목표가 보유한 모든 아츠 부착을 소모하고, 대상에게 강제로 동결을 부여하며 소모한 스택 수치에 따라 냉기 피해를 줍니다. 배틀 스킬로 적에게 동결 상태를 부여한 후, 소모한 스택 수치에 따라 추가로 궁극기 에너지를 획득하며 여러 목표를 명중했을 경우 1회만 획득합니다.' },
            { skillType: ['연계 스킬'], element: 'cryo', dmg: '600%', type: ['동결 부여'], target: '적', desc: '메인 컨트롤 오퍼레이터가 동결 상태의 적에게 강력한 일격을 사용했을 때 사용할 수 있습니다. 즉시 목표의 곁에 꽁꽁이를 배치하고 3초간 끊임없이 충격파를 4번 발사합니다. 주변의 적에게 냉기 피해를 주고, 지속적으로 모든 적을 중심으로 끌어당깁니다. 지속 시간이 끝나면, 꽁꽁이가 자폭하여 주위의 적에게 강제로 동결 상태를 부여하고 냉기 피해를 줍니다. 연계 스킬이 적을 명중한 후, 추가로 궁극기 에너지를 10포인트 획득합니다. 여러 목표를 명중하더라도 1회만 획득합니다.' },
            { skillType: ['궁극기'], element: 'cryo', cost: 220, dmg: '0%', type: [{ type: '치명타 확률', val: '30%', skillType: ['강화 일반 공격'] }, { type: '치명타 피해', val: '60%', skillType: ['강화 일반 공격'] }], desc: '삐삐를 배치하여 지원을 요청하고 메인 컨트롤 오퍼레이터로 전환합니다. 7초 동안, 이본의 일반 공격이 강화되며 일반 공격을 할 때마다 자신의 치명타 확률이 3% 증가합니다(최대 10스택). 스택 수치가 최대로 쌓였을 경우, 자신의 치명타 피해가 60% 증가합니다. 지속 시간이 끝나기 전의 마지막 일반 공격은 강력한 일격으로 바뀌어 대량의 냉기 피해를 줍니다. 적이 동결 상태라면, 추가로 냉기 피해를 1회 준 후, 동결 상태를 소모합니다.' }
        ],
        talents: [
            [],
            [{ type: ['치명타 피해'], val: '20%', trigger: ['냉기 부착', '동결'], bonus: [{ type: ['치명타 피해'], val: '20%', trigger: ['동결'] }] }]
        ],
        potential: [
            [{ type: ['스킬 배율 증가'], dmg: '200%', skillType: ['배틀 스킬'] }],
            [{ type: ['스탯'], stats: '지능', val: 20 }, { type: ['치명타 확률'], val: '7%' }],
            [{ type: ['치명타 피해'], val: '10%', trigger: ['냉기 부착', '동결'], bonus: [{ type: ['치명타 피해'], val: '10%', trigger: ['동결'] }] }],
            [],
            [{ type: ['공격력 증가'], val: '10%', skillType: ['강화 일반 공격'] }, { type: ['치명타 피해'], val: '30%', skillType: ['강화 일반 공격'] }]
        ]
    },
    {
        id: 'Avywenna',
        name: '아비웨나',
        class: 'striker',
        rarity: 5,
        baseAtk: 312,
        mainStat: 'wil',
        subStat: 'agi',
        type: 'arts',
        element: 'elec',
        stats: { str: 107, agi: 106, int: 110, wil: 228 },
        usableWeapons: ['polearm'],
        specialStack: [
            { name: '썬더랜스', id: 'thunderlance', max: null, triggers: ['썬더랜스'] },
            { name: '강력한 썬더랜스', id: 'powerfulThunderlance', max: null, triggers: ['강력한 썬더랜스'] }
        ],
        skill: [
            { skillType: ['일반 공격'], element: 'phys', dmg: '312%', desc: '적에게 최대 5단 공격을 하여 물리 피해를 줍니다.' },
            { skillType: ['배틀 스킬'], element: 'elec', dmg: '150%', type: ['전기 부착'], target: '적', bonus: [{ trigger: ['썬더랜스'], base: '0%', perStack: '168%' }, { trigger: ['강력한 썬더랜스'], base: '0%', perStack: '432%' }], desc: '점프하여 창을 휘둘러 회오리바람을 일으킵니다. 주변의 적에게 소량의 전기 피해를 주며, 모든 썬더랜스와 강력한 썬더랜스를 회수합니다. 썬더랜스가 회수되는 과정에서 적을 공격할 경우, 대상에게 전기 피해를 줍니다. 강력한 썬더랜스는 더욱 큰 전기 피해를 주고 전기 부착 상태를 부여합니다.' },
            { skillType: ['연계 스킬'], element: 'elec', dmg: '380%', desc: '메인 컨트롤 오퍼레이터가 전기 부착 혹은 감전 상태의 목표에 강력한 일격을 준 후 사용할 수 있습니다. 점프하여 목표에 30초간 존재하는 썬더랜스 3개를 던져, 전방 범위 내의 적에게 전기 피해를 줍니다.' },
            { skillType: ['궁극기'], element: 'elec', cost: 100, dmg: '950%', desc: '목표 구역에 30초간 존재하는 강력한 썬더랜스 하나를 투척하여 주변의 적에게 대량의 전기 피해를 줍니다.' }
        ],
        talents: [
            [],
            [{ type: ['전기 취약'], val: '10%', target: '적' }]
        ],
        potential: [
            [],
            [],
            [{ type: ['스탯'], stats: '의지', val: 15 }, { type: ['전기 피해'], val: '8%' }],
            [{ type: ['궁극기 에너지 감소'], val: '-15%' }],
            [{ type: ['스킬 배율 증가'], dmg: '15%', skillType: ['배틀 스킬'], trigger: ['전기 취약'] }]
        ]
    },
    {
        id: 'Da Pan',
        name: '판',
        class: 'striker',
        rarity: 5,
        baseAtk: 303,
        mainStat: 'str',
        subStat: 'wil',
        type: 'phys',
        element: null,
        stats: { str: 235, agi: 96, int: 94, wil: 102 },
        usableWeapons: ['great_sword'],
        skill: [
            { skillType: ['일반 공격'], element: 'phys', dmg: '387%', desc: '적에게 최대 4단 공격을 하여 물리 피해를 줍니다.' },
            { skillType: ['배틀 스킬'], element: 'phys', dmg: '300%', type: ['띄우기'], target: '적', desc: '웍을 꺼내 짧게 차지한 다음 힘껏 위로 던집니다. 적에게 물리 피해를 주고 띄우기 상태로 만듭니다.' },
            { skillType: ['연계 스킬'], element: 'phys', dmg: '650%', type: ['강타'], target: '적', desc: '방어 불능 4스택 중첩 상태인 적이 있을 때 사용할 수 있습니다. 웍을 휘둘러 적에게 대량의 물리 피해를 주고 강타합니다. 이번 강타로 주는 피해는 조금 더 강합니다.' },
            { skillType: ['궁극기'], element: 'phys', cost: 90, dmg: '700%', type: [{ type: '강제 띄우기', target: '적' }, { type: '강제 넘어뜨리기', target: '적' }], desc: '도마를 강하게 내리쳐, 전방 범위 내의 적을 강제 띄우기 상태로 만듭니다. 이어서 연속 6단 베기 공격을 사용하여 물리 피해를 주며, 마지막에 모든 적을 추락시켜 강제 넘어뜨리기 상태로 만들고, 대량의 물리 피해를 줍니다.' }
        ],
        talents: [
            [{ type: ['물리 피해'], val: '24%' }],
            []
        ],
        potential: [
            [{ type: ['물리 피해'], val: '30%' }],
            [],
            [{ type: ['스탯'], stats: '힘', val: 15 }, { type: ['물리 피해'], val: '8%' }],
            [{ type: ['궁극기 에너지 감소'], val: '-15%' }],
            []
        ]
    },
    {
        id: 'Pogranichnik',
        name: '포그라니치니크',
        class: 'vanguard',
        rarity: 6,
        baseAtk: 321,
        mainStat: 'wil',
        subStat: 'agi',
        type: 'phys',
        element: null,
        stats: { str: 101, agi: 110, int: 97, wil: 233 },
        usableWeapons: ['sword'],
        skill: [
            { skillType: ['일반 공격'], element: 'phys', dmg: '372%', desc: '적에게 최대 5단 공격을 하여 물리 피해를 줍니다.' },
            { skillType: ['배틀 스킬'], element: 'phys', dmg: '430%', type: [{ type: '갑옷 파괴', target: '적' }, { type: '스킬 게이지 회복', target: '팀' }], desc: '전방 범위 내의 적에게 두 번 베기 공격을 진행합니다. 물리 피해를 주고, 갑옷 파괴 상태를 부여하며, 소모한 방어 불능 상태의 스택 수치에 따라 스킬 게이지를 회복합니다. 여러 목표를 명중했을 경우, 1회만 회복합니다.' },
            { skillType: ['연계 스킬'], element: 'phys', dmg: '514%', type: ['스킬 게이지 회복'], desc: '적이 강타 혹은 갑옷 파괴로 인해 방어 불능의 스택 수치가 소모되었을 때 사용할 수 있습니다. 소모한 최대 방어 불능 스택 수치에 따라, 적에게 동일 횟수의 베기 공격(최대 3회)을 하여 물리 피해를 주고, 일정량의 스킬 게이지를 회복하며 베기 공격마다 주는 피해와 스킬 게이지 회복 효과가 증가합니다. 만약 방어 불능 4스택을 소모할 경우, 세 번째 베기 공격이 강화됩니다.' },
            { skillType: ['궁극기'], element: 'phys', cost: 90, dmg: '1150%', type: ['스킬 게이지 회복'], desc: '목표를 중심으로 방패병 네 명을 소환해 목표를 향해 진군시킵니다. 진군 경로의 적들을 목표 방향으로 밀쳐내며 물리 피해를 주고 30초간 철의 서약 5포인트를 생성합니다. 적이 물리 디버프 효과를 받거나, 포그라니치니크의 연계 스킬이 주는 피해를 받을 경우, 철의 서약 1포인트를 소모해 방패병 한 명을 추가 소환하여 대상을 교란하며 물리 피해를 주고, 일정량의 스킬 게이지를 회복합니다. 소모한 철의 서약이 마지막 1포인트일 경우, 방패병 네 명이 최후의 승부를 사용하며, 대상에게 대량의 물리 피해를 주고 대량의 스킬 게이지를 회복합니다.' }
        ],
        talents: [
            [{ type: ['공격력 증가'], val: '24%' }, { type: ['오리지늄 아츠 강도'], val: 24 }],
            []
        ],
        potential: [
            [],
            [{ type: ['스탯'], stats: '의지', val: '20%' }, { type: ['물리 피해'], val: '10%' }],
            [],
            [{ type: ['궁극기 에너지 감소'], val: '-15%' }],
            []
        ]
    },
    {
        id: 'Arclight',
        name: '아크라이트',
        class: 'vanguard',
        rarity: 5,
        baseAtk: 306,
        mainStat: 'agi',
        subStat: 'int',
        type: 'arts',
        element: 'elec',
        stats: { str: 107, agi: 205, int: 123, wil: 100 },
        usableWeapons: ['sword'],
        skill: [
            { skillType: ['일반 공격'], element: 'phys', dmg: '298%', desc: '적에게 최대 5단 공격을 하여 물리 피해를 줍니다.' },
            { skillType: ['배틀 스킬'], element: 'elec', dmg: '202%', type: ['감전 소모', '스킬 게이지 회복'], bonus: [{ trigger: ['감전'], val: '405%' }], desc: '적의 옆으로 순간 이동해 2회의 베기 공격을 하며 소량의 물리 피해를 줍니다. 적이 감전 상태일 경우, 감전 상태를 소모하여 추가로 1회 공격하고 전기 피해를 주며 일정량의 스킬 게이지를 회복합니다.' },
            { skillType: ['연계 스킬'], element: 'phys', dmg: '350%', type: ['스킬 게이지 회복'], desc: '적이 감전 상태거나, 감전 상태가 소모됐을 때 사용할 수 있습니다. 적의 옆으로 순간 이동해 연속으로 베기 공격을 하여 물리 피해를 주고 일정량의 스킬 게이지를 회복합니다.' },
            { skillType: ['궁극기'], element: 'elec', cost: 90, dmg: '900%', type: [{ type: '전기 부착', target: '적' }, '전기 부착 소모', { type: '감전 부여', target: '적' }], desc: '전기 아크로 자신을 둘러싼 다음, 전방 일정 거리를 돌진하며 경로 상의 적에게 전기 피해를 주고 전기 부착 상태를 부여합니다. 일정 시간이 지나면, 남겨 둔 전기 아크를 폭파시켜 다시 전기 피해를 줍니다. 적이 전기 부착 상태일 경우, 전기 부착 상태를 소모하여 감전 상태를 부여합니다.' }
        ],
        talents: [
            [// 지능 500기준
                { type: ['전기 피해'], val: '40%', target: '팀' }],
            []
        ],
        potential: [
            [],
            [{ type: ['스탯'], stats: '민첩', val: 15 }, { type: ['스탯'], stats: '지능', val: 15 }],
            [{ type: ['전기 피해'], val: '12%', target: '팀' }],
            [{ type: ['궁극기 에너지 감소'], val: '-15%' }],
            []
        ]
    },
    {
        id: 'Alesh',
        name: '알레쉬',
        class: 'vanguard',
        rarity: 5,
        baseAtk: 309,
        mainStat: 'str',
        subStat: 'int',
        type: 'arts',
        element: 'cryo',
        stats: { str: 218, agi: 95, int: 125, wil: 89 },
        usableWeapons: ['sword'],
        skill: [
            { skillType: ['일반 공격'], element: 'phys', dmg: '310%', desc: '적에게 최대 5단 공격을 하여 물리 피해를 줍니다.' },
            { skillType: ['배틀 스킬'], element: 'phys', dmg: '450%', type: ['냉기 부착 소모', { type: '스킬 게이지 회복' }, { type: '동결 부여', target: '적' }], desc: '얼음 조각을 낚아올려 전방의 적을 내리치며, 물리 피해를 줍니다. 냉기 부착 상태의 적을 명중하면, 목표의 냉기 부착을 전부 소모하고, 대상에게 강제 동결 상태를 부여합니다. 소모한 스택 수치에 따라 스킬 게이지를 회복하며, 여러 목표를 명중했을 경우, 1회만 회복합니다.' },
            { skillType: ['연계 스킬'], element: 'phys', dmg: '480%', type: ['스킬 게이지 회복'], desc: '근처 목표의 아츠 이상 혹은 오리지늄 결정이 소모되었을 때 사용할 수 있습니다. 적의 발밑에 구멍을 내 낚시를 시도하여, 물리 피해를 주고 일정 스킬 게이지를 회복합니다. 또한 10% 확률로 진귀한 린수를 낚을 수 있으며, 피해가 대폭 증가하고 추가로 스킬 게이지를 10포인트 회복합니다.' },
            { skillType: ['궁극기'], element: 'cryo', cost: 100, dmg: '980%', type: [{ type: '스킬 게이지 회복' }, { type: '냉기 부착', target: '적' }], desc: '상상을 초월하는 거대한 린수를 낚아 올린 다음, 전방 모든 적을 향해 내리칩니다. 넓은 범위의 냉기 피해를 주고 냉기 부착 상태를 부여하며 일정 스킬 게이지를 회복합니다. 목표를 처치할 때마다 일정량의 스킬 게이지가 추가로 회복됩니다(최대 100포인트).' }
        ],
        talents: [
            [],
            []
        ],
        potential: [
            [],
            [{ type: ['스탯'], stats: '힘', val: 15 }, { type: ['스탯'], stats: '지능', val: 15 }],
            [{ type: ['공격력 증가'], val: '15%', target: '팀' }],
            [{ type: ['궁극기 에너지 감소'], val: '-15%' }],
            [{ type: ['스킬 배율 증가'], val: '50%', skillType: ['궁극기'] }]
        ]
    },
    {
        id: 'Akekuri',
        name: '아케쿠리',
        class: 'vanguard',
        rarity: 4,
        baseAtk: 319,
        mainStat: 'agi',
        subStat: 'int',
        type: 'arts',
        element: 'heat',
        stats: { str: 110, agi: 200, int: 106, wil: 108 },
        usableWeapons: ['sword'],
        skill: [
            { skillType: ['일반 공격'], element: 'phys', dmg: '291%', desc: '적에게 최대 4단 공격을 하여 물리 피해를 줍니다.' },
            { skillType: ['배틀 스킬'], element: 'heat', dmg: '320%', type: ['열기 부착'], target: '적', desc: '전방으로 검을 휘둘러 열기 피해를 주고 열기 부착 상태를 부여합니다.' },
            { skillType: ['연계 스킬'], element: 'phys', dmg: '180%', type: ['스킬 게이지 회복'], desc: '불균형 상태 혹은 불균형 지점에 도달한 적이 있을 때 사용할 수 있습니다. 2번 연속 찌르기를 사용하여 각 공격마다 물리 피해를 주고 스킬 게이지를 7.5포인트 회복합니다.' },
            { skillType: ['궁극기'], element: 'heat', cost: 120, dmg: '0%', type: ['스킬 게이지 회복'], desc: '지속 시전 상태에 들어가며, 신호탄 3발을 발사합니다. 발사할 때마다 일정량의 스킬 게이지를 회복합니다.' }
        ],
        talents: [
            [],
            [{ type: ['연타'], target: '팀' }]
        ],
        potential: [
            [{ type: ['공격력 증가'], val: '50%' }],
            [{ type: ['스탯'], stats: '민첩', val: 10 }, { type: ['스탯'], stats: '지능', val: 10 }],
            [{ type: ['공격력 증가'], val: '10%', target: '팀' }],
            [{ type: ['궁극기 에너지 감소'], val: '-10%' }],
            []
        ]
    }
];
