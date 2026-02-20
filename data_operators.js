const DATA_OPERATORS = [
    //   - type: '공격력 증가' (공격력 증가)
    //          | '물리 피해' (장착 오퍼가 주는 물리 피해 증가)
    //          | '아츠 피해' (장착 오퍼가 주는 아츠 피해 증가)
    //          | '열기 피해' (장착 오퍼가 주는 열기 피해 증가)
    //          | '전기 피해' (장착 오퍼가 주는 전기 피해 증가)
    //          | '냉기 피해' (장착 오퍼가 주는 냉기 피해 증가)
    //          | '자연 피해' (장착 오퍼가 주는 자연 피해 증가)
    //          | '불균형 피해' (불균형 상태의 적에게 주는 피해 증가)

    //          | '받는 물리 피해' (적이 받는 물리 피해 증가)
    //          | '받는 아츠 피해' (적이 받는 아츠 피해 증가)
    //          | '받는 열기 피해' (적이 받는 열기 피해 증가)
    //          | '받는 전기 피해' (적이 받는 전기 피해 증가)
    //          | '받는 냉기 피해' (적이 받는 냉기 피해 증가)
    //          | '받는 자연 피해' (적이 받는 자연 피해 증가)

    //          | '스킬 배율 증가' (배틀/연계/궁극기 dmg 계수 ×(1+val%) - 사이클 계산에서 곱연산 적용)
    //            - skilltype: '배틀스킬' | '연계스킬' | '궁극기' (선택 시 해당 스킬만 적용, 미지정 시 3종 모두 적용)

    //          | '물리 증폭' (물리 피해 증가 - 피해증가와 곱연산)

    //          | '아츠 취약' (적이 아츠 피해에 취약해지는 효과)

    //          | '연타'

    //          | '기본 공격 피해' (기본 공격 피해 증가)
    //          | '배틀 스킬 피해' (배틀 스킬 피해 증가)
    //          | '연계 스킬 피해' (연계 스킬 피해 증가)
    //          | '궁극기 피해' (궁극기 피해 증가)

    //          | '오리지늄 아츠 강도' (오리지늄 아츠 강도 증가)
    //          | '치명타 확률' (치명타 확률 증가)
    //          | '치명타 피해' (치명타 피해 증가)
    //          | '최대 체력' (최대 생명력 증가)
    //          | '궁극기 충전' (궁극기 충전 효율 증가)
    //          | '치유 효율' (치유 효율 증가)

    //          | '주는 피해' (장착 오퍼가 주는 모든 피해 증가 - 피해증가와 합연산)
    //          | '모든 능력치' (장착 오퍼의 모든 스탯 증가)
    //          | '모든 스킬 피해' (모든 스킬의 피해 증가 - 피해증가와 합연산)
    //
    // target (선택사항):
    //   - '팀': 팀 전체에 적용
    //   - '적': 적에 적용
    //   type이 배열일 때는 각 항목에 target을 개별 지정 (외부 target 생략)
    //   예) type: [{ type: '물리 취약', val: '12%', target: '적' }, { type: '연타', target: '팀' }]

    // skill 작성 규칙:
    //   skilltype : '기본공격' | '배틀스킬' | '연계스킬' | '궁극기'
    //   dmg       : 기본 배율 문자열, 예) '348%'
    //   type      : (선택) 단일 효과: string, 예) '방어 불능 부여'
    //              복합 효과: [{type, val?}, ...], 예) [{type: '물리 취약', val: '12%'}, {type: '방어 불능 부여'}]
    //              (val 없는 효과는 val 생략)
    //   target    : (선택) '팀' | '적'
    //
    //   bonus     : (선택) 특정 조건이 충족될 때 추가되는 보너스 데미지
    //     .trigger  : 조건 이름 — calc.js의 evaluateTrigger() TRIGGER_MAP에 등록된 키
    //                 현재 지원: '방어 불능', '오리지늄 봉인'
    //                 (새 트리거 추가 시 evaluateTrigger의 TRIGGER_MAP에만 항목을 추가)
    //
    //     보너스 값 형식 (둘 중 하나 선택):
    //     ① 스택 의존 보너스 — base + perStack × (트리거 스택 수)
    //        .base      : 조건 충족 시 고정으로 더해지는 배율, 예) '150%'
    //        .perStack  : 스택 1개당 추가되는 배율, 예) '150%'
    //        예) base:'150%', perStack:'150%' → 방어불능 2스택이면 +150% + 150%×2 = +450%
    //
    //     ② 단순 고정 보너스 — 조건 충족 시 고정 배율 추가
    //        .val       : 고정 추가 배율, 예) '1000%'
    //        예) val:'1000%' → 오리지늄 봉인 ON이면 +1000%

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
        skill: [
            { skilltype: '기본공격', dmg: '348%' },
            { skilltype: '배틀스킬', dmg: '350%', type: '방어 불능 부여', target: '적', bonus: { trigger: '방어 불능', base: '150%', perStack: '150%' } },
            { skilltype: '연계스킬', dmg: '100%' },
            { skilltype: '궁극기', dmg: '800%', bonus: { trigger: '오리지늄 봉인', val: '1000%' } }
        ],
        talents: [
            { type: '공격력 증가', val: '30%' },
            { type: '받는 물리 피해', val: '20%', target: '적', trigger: '오리지늄 봉인' }
        ],
        potential: [
            {},
            { type: '공격력 증가', val: '15%', target: '팀' },
            {},
            {},
            {}
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
            { skilltype: '기본공격', dmg: '351%', desc: '적에게 최대 4단 공격을 하여 물리 피해를 줍니다.' },
            { skilltype: '배틀스킬', dmg: '440%', type: [{ type: '물리 취약', val: '12%', target: '적' }, { type: '방어 불능 부여' }, { type: '넘어뜨리기', target: '적' }], desc: '전방으로 창을 여러 번 휘둘러 2회의 물리 피해를 줍니다. 이후 힘차게 지면을 내리쳐 전방 모든 적에게 다시 물리 피해를 주고 넘어뜨리기 상태로 만듭니다. 마지막 공격에 명중한 적이 방어 불능 상태가 아닐 경우, 추가로 대상에게 12초간 물리 취약 상태를 부여합니다.' },
            { skilltype: '연계스킬', dmg: '480%', type: '연타', target: '팀', desc: '물리 취약 또는 갑옷 파괴 상태의 적이 메인 컨트롤 오퍼레이터의 강력한 일격을 받았을 때 사용할 수 있습니다. 화신을 내세워 장창으로 찌르며, 물리 피해를 주고 20초간 연타를 획득합니다.' },
            { skilltype: '궁극기', dmg: '800%', type: [{ type: '방어 불능 부여', target: '적' }, { type: '넘어뜨리기', target: '적' }], desc: '화신을 내세워 부동저로 지면을 힘껏 내리칩니다. 넓은 범위 내의 모든 적에게 물리 피해를 주고 넘어뜨리기 상태로 만들며, 모든 적을 중심으로 향해 끌어당깁니다. 일정 시간 후, 여전히 타격 범위 내에 남아 있는 모든 적에게는 다시 대량의 물리 피해를 주고 넘어뜨리기 상태로 만듭니다. 해당 스킬이 연타를 소모했다면, 대량의 추가 물리 피해를 줍니다.', bonus: { trigger: '연타', val: '600%' } }
        ],
        talents: [
            { type: '공격력 증가', val: '지능, 의지 1포인트당 0.15% 증가' },
            {}
        ],
        potential: [
            { type: '물리 취약', val: '5%', target: '적' },
            { type: '스탯', stats: '모든 능력치', val: 15 },
            { type: '공격력 증가', val: '지능, 의지 1포인트당 0.05% 증가' },
            {},
            {}
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
            { skilltype: '기본공격', dmg: '317%', desc: '적에게 최대 5단 공격을 하여 물리 피해를 줍니다.' },
            { skilltype: '배틀스킬', dmg: '380%', type: [{ type: '방어 불능 부여', target: '적' }, { type: '띄우기', target: '적' }], desc: '목표한 적을 올려 칩니다. 물리 피해를 주고 띄우기 상태로 만듭니다.' },
            { skilltype: '연계스킬', dmg: '270%', type: [{ type: '방어 불능 부여', target: '적' }, { type: '띄우기', target: '적' }], desc: '적이 방어 불능 상태일 때 사용할 수 있습니다. 적을 관통하고 돌진 베기를 사용합니다. 경로 상의 모든 적에게 물리 피해를 주고, 띄우기 상태로 만듭니다.' },
            { skilltype: '궁극기', dmg: '1509%', desc: '목표한 적에게 7단 베기를 사용합니다. 공격할 때마다 물리 피해를 주며, 마지막 베기 공격은 더 큰 피해를 줍니다.' }
        ],
        talents: [
            { type: '공격력 증가', val: '40%' },
            {}
        ],
        potential: [
            { type: '주는 피해', val: '20%' },
            [{ type: '스탯', stats: '민첩', val: 15 }, { type: '물리 피해', val: '8%' }],
            [{ type: '스킬 배율 증가', val: '10%', skilltype: '배틀스킬' }, { type: '스킬 배율 증가', val: '10%', skilltype: '연계스킬' }, { type: '스킬 배율 증가', val: '10%', skilltype: '궁극기' }],
            {},
            {}
        ]
    },
    {
        id: 'Estella',
        name: '에스텔라',
        rarity: 4,
        baseAtk: 312,
        mainStat: 'wil',
        subStat: 'str',
        type: 'arts',
        element: 'cryo',
        stats: { str: 104, agi: 97, int: 110, wil: 211 },
        usableWeapons: ['polearm'],
        skill: [
            { skilltype: '기본공격', dmg: '293%', desc: '적에게 최대 4단 공격을 하여 물리 피해를 줍니다.' },
            { skilltype: '배틀스킬', dmg: '350%', type: '냉기 부착', target: '적', desc: '전방으로 장창을 찔러 냉기 음파를 방출합니다. 일직선상의 적에게 냉기 피해를 주고 엔드필드/냉기 부착 상태를 부여합니다.' },
            [{ skilltype: '연계스킬', dmg: '360%', type: [{ type: '물리 취약', val: '15%', target: '적' }, { type: '방어 불능 부여', target: '적' }, { type: '띄우기', target: '적' }], bonus: { trigger: '동결', val: '630%' }, desc: '적이 동결 상태일 때 사용할 수 있습니다. 빠르게 적에게 접근하여 좁은 범위 내의 적에게 물리 피해를 주고, 강제 띄우기 상태로 만듭니다. 동결 상태의 적에게 명중했을 경우, 추가로 피해를 주고 6초간 물리 취약 상태를 부여합니다.' }],
            { skilltype: '궁극기', dmg: '1100%', type: '방어 불능 부여', target: '적', bonus: { trigger: '물리 취약', type: '띄우기' }, desc: '모든 힘을 쏟아 창을 힘껏 내려찍어 주변 원형 범위 내의 적에게 물리 피해를 줍니다. 적이 물리 취약 상태라면, 대상을 강제 띄우기 상태로 만듭니다.' }
        ],
        talents: [
            {},
            {}
        ],
        potential: [
            {},
            {},
            {},
            {},
            [{ type: '스탯', stats: '의지', val: 10 }, { type: '스탯', stats: '힘', val: 10 }]
        ]
    },
    {
        id: 'Ember',
        name: '엠버',
        rarity: 6,
        baseAtk: 323,
        mainStat: 'str',
        subStat: 'wil',
        type: 'arts',
        element: 'heat',
        stats: { str: 236, agi: 96, int: 86, wil: 120 },
        usableWeapons: ['great_sword'],
        skill: [
            { skilltype: '기본공격', dmg: '%' },
            { skilltype: '배틀스킬', dmg: '%', type: '방어 불능 부여', target: '적' },
            [{ skilltype: '연계스킬', dmg: '%', type: '치유' }, { skilltype: '연계스킬', dmg: '%', type: '방어 불능 부여', target: '적' }],
            { skilltype: '궁극기', dmg: '%', type: '보호' }
        ],
        talents: [
            { type: '비호' },
            { type: '공격력 증가', val: 27 }
        ],
        potential: [
            {},
            [{ type: '스탯', stats: '힘', val: 20 }, { type: '스탯', stats: '의지', val: 20 }],
            {},
            {},
            { type: '공격력 증가', val: 10, target: '팀' }
        ]
    },
    {
        id: 'Snowshine',
        name: '스노우샤인',
        rarity: 5,
        baseAtk: 297,
        mainStat: 'str',
        subStat: 'wil',
        type: 'arts',
        element: 'cryo',
        stats: { str: 214, agi: 104, int: 93, wil: 108 },
        usableWeapons: ['great_sword'],
        skill: [
            { skilltype: '기본공격', dmg: '%' },
            [{ skilltype: '배틀스킬', dmg: '%', type: '비호' }, { skilltype: '배틀스킬', dmg: '%', type: '냉기 부착', target: '적' }],
            [{ skilltype: '연계스킬', dmg: '%', type: '치유' }],
            { skilltype: '궁극기', dmg: '%', type: '동결 부여', target: '적' }
        ],
        talents: [
            {},
            {}
        ],
        potential: [
            {},
            {},
            {},
            { type: '스탯', stats: '의지', val: 20 },
            {}
        ]
    },
    {
        id: 'Catcher',
        name: '카치르',
        rarity: 4,
        baseAtk: 300,
        mainStat: 'str',
        subStat: 'wil',
        type: 'phys',
        element: null,
        stats: { str: 236, agi: 96, int: 86, wil: 106 },
        usableWeapons: ['great_sword'],
        skill: [
            { skilltype: '기본공격', dmg: '%' },
            [{ skilltype: '배틀스킬', dmg: '%', type: '비호' }, { skilltype: '배틀스킬', dmg: '%', type: '방어 불능 부여', target: '적' }],
            { skilltype: '연계스킬', dmg: '%', type: '보호' },
            [{ skilltype: '궁극기', dmg: '%', type: '허약' }, { skilltype: '궁극기', dmg: '%', type: '방어 불능 부여', target: '적' }]
        ],
        talents: [
            {},
            {}
        ],
        potential: [
            {},
            { type: '스탯', stats: '의지', val: 10 },
            {},
            {},
            {}
        ]
    },
    {
        id: 'Gilberta',
        name: '질베르타',
        rarity: 6,
        baseAtk: 329,
        mainStat: 'wil',
        subStat: 'int',
        type: 'arts',
        element: 'nature',
        stats: { str: 89, agi: 92, int: 127, wil: 231 },
        usableWeapons: ['arts_unit'],
        skill: [
            { skilltype: '기본공격', dmg: '%' },
            { skilltype: '배틀스킬', dmg: '%', type: '자연 부착', target: '적' },
            { skilltype: '연계스킬', dmg: '%', type: '방어 불능 부여', target: '적' },
            [{ skilltype: '궁극기', dmg: '%', type: '자연 부착' }, { skilltype: '궁극기', dmg: '%', type: '아츠 취약', val: 33, target: '적' }, { skilltype: '궁극기', dmg: '%', type: '감속' }]
        ],
        talents: [
            { type: '궁극기 충전', val: 7, target: '팀' },
            { type: '치유' }
        ],
        potential: [
            {},
            { type: '아츠 취약', val: 9, target: '적' },
            { type: '궁극기 충전', val: 5, target: '팀' },
            {},
            {}
        ]
    },
    {
        id: 'Ardelia',
        name: '아델리아',
        rarity: 6,
        baseAtk: 323,
        mainStat: 'int',
        subStat: 'wil',
        type: 'arts',
        element: 'nature',
        stats: { str: 112, agi: 93, int: 205, wil: 118 },
        usableWeapons: ['arts_unit'],
        skill: [
            { skilltype: '기본공격', dmg: '%' },
            [{ skilltype: '배틀스킬', dmg: '%', type: '물리 취약', val: 20, target: '적' }, { skilltype: '배틀스킬', dmg: '%', type: '아츠 취약', val: 20, target: '적' }],
            { skilltype: '연계스킬', dmg: '%', type: '부식 부여', target: '적' },
            { skilltype: '궁극기', dmg: '%' }
        ],
        talents: [
            { type: '치유' },
            {}
        ],
        potential: [
            [{ type: '물리 취약', val: 8, target: '적' }, { type: '아츠 취약', val: 8, target: '적' }],
            {},
            {},
            {},
            {}
        ]
    },
    {
        id: 'Xaihi',
        name: '자이히',
        rarity: 5,
        baseAtk: 291,
        mainStat: 'wil',
        subStat: 'int',
        type: 'arts',
        element: 'cryo',
        stats: { str: 89, agi: 91, int: 127, wil: 210 },
        usableWeapons: ['arts_unit'],
        skill: [
            { skilltype: '기본공격', dmg: '%' },
            [{ skilltype: '배틀스킬', dmg: '%', type: '치유' }, { skilltype: '배틀스킬', dmg: '%', type: '아츠 증폭', val: 15, target: '팀' }],
            { skilltype: '연계스킬', dmg: '%', type: '냉기 부착', target: '적' },
            [{ skilltype: '궁극기', dmg: '%', type: '냉기 증폭', val: 36, target: '팀' }, { skilltype: '궁극기', dmg: '%', type: '자연 증폭', val: 36, target: '팀' }]
        ],
        talents: [
            { type: '받는 냉기 피해', val: 10, target: '적' },
            {}
        ],
        potential: [
            { type: '아츠 증폭', val: 5, target: '팀' },
            {},
            {},
            { type: '스탯', stats: '지능', val: 15 },
            [{ type: '냉기 증폭', val: 3.6, target: '팀' }, { type: '자연 증폭', val: 3.6, target: '팀' }]
        ]
    },
    {
        id: 'Antal',
        name: '안탈',
        rarity: 4,
        baseAtk: 297,
        mainStat: 'int',
        subStat: 'str',
        type: 'arts',
        element: 'elec',
        stats: { str: 129, agi: 86, int: 225, wil: 82 },
        usableWeapons: ['arts_unit'],
        skill: [
            { skilltype: '기본공격', dmg: '%' },
            [{ skilltype: '배틀스킬', dmg: '%', type: '전기 취약', val: 10, target: '적' }, { skilltype: '배틀스킬', dmg: '%', type: '열기 취약', val: 10, target: '적' }],
            [{ skilltype: '연계스킬', dmg: '%', type: '방어 불능 부여' }, { skilltype: '연계스킬', dmg: '%', type: '아츠 부착', target: '적' }],
            [{ skilltype: '궁극기', dmg: '%', type: '전기 증폭', val: 20, target: '팀' }, { skilltype: '궁극기', dmg: '%', type: '열기 증폭', val: 20, target: '팀' }]
        ],
        talents: [
            { type: '치유' },
            {}
        ],
        potential: [
            [{ type: '전기 증폭', val: 2, target: '팀' }, { type: '열기 증폭', val: 2, target: '팀' }],
            {},
            {},
            { type: '스탯', stats: '지능', val: 10 },
            [{ type: '전기 취약', val: 4, target: '적' }, { type: '열기 취약', val: 4, target: '적' }]
        ]
    },
    {
        id: 'Perlica',
        name: '펠리카',
        rarity: 5,
        baseAtk: 303,
        mainStat: 'int',
        subStat: 'wil',
        type: 'arts',
        element: 'elec',
        stats: { str: 91, agi: 93, int: 221, wil: 113 },
        usableWeapons: ['arts_unit'],
        skill: [
            { skilltype: '기본공격', dmg: '%' },
            { skilltype: '배틀스킬', dmg: '%', type: '전기 부착', target: '적' },
            { skilltype: '연계스킬', dmg: '%', type: '감전 부여', target: '적' },
            { skilltype: '궁극기', dmg: '%' }
        ],
        talents: [
            { type: '불균형 피해', val: 30 },
            {}
        ],
        potential: [
            {},
            {},
            { type: '공격력 증가', val: 40 },
            { type: '받는 아츠 피해', val: 4, target: '적' },
            {}
        ]
    },
    {
        id: 'Wulfgard',
        name: '울프가드',
        rarity: 5,
        baseAtk: 294,
        mainStat: 'str',
        subStat: 'agi',
        type: 'arts',
        element: 'heat',
        stats: { str: 221, agi: 95, int: 92, wil: 111 },
        usableWeapons: ['handcannon'],
        skill: [
            { skilltype: '기본공격', dmg: '%' },
            { skilltype: '배틀스킬', dmg: '%', type: '열기 부착', target: '적' },
            { skilltype: '연계스킬', dmg: '%', type: '열기 부착', target: '적' },
            { skilltype: '궁극기', dmg: '%', type: '연소 부여', target: '적' }
        ],
        talents: [
            { type: '열기 피해', val: 30 },
            {}
        ],
        potential: [
            [{ type: '스탯', stats: '힘', val: 15 }, { type: '스탯', stats: '민첩', val: 15 }],
            {},
            { type: '열기 피해', val: 15, target: '팀' },
            {},
            {}
        ]
    },
    {
        id: 'Fluorite',
        name: '플루라이트',
        rarity: 4,
        baseAtk: 303,
        mainStat: 'agi',
        subStat: 'int',
        type: 'arts',
        element: 'nature',
        stats: { str: 90, agi: 228, int: 114, wil: 91 },
        usableWeapons: ['handcannon'],
        skill: [
            { skilltype: '기본공격', dmg: '%' },
            [{ skilltype: '배틀스킬', dmg: '%', type: '자연 부착' }, { skilltype: '배틀스킬', dmg: '%', type: '감속', target: '적' }],
            [{ skilltype: '연계스킬', dmg: '%', type: '냉기 부착' }, { skilltype: '연계스킬', dmg: '%', type: '자연 부착', target: '적' }],
            [{ skilltype: '궁극기', dmg: '%', type: '자연 부착' }, { skilltype: '궁극기', dmg: '%', type: '냉기 부착', target: '적' }]
        ],
        talents: [
            { type: '주는 피해', val: 20 },
            { type: '공격력 증가', val: 20 }
        ],
        potential: [
            [{ type: '스탯', stats: '민첩', val: 10 }, { type: '스탯', stats: '지능', val: 10 }],
            {},
            {},
            {},
            {}
        ]
    },
    {
        id: 'Laevatain',
        name: '레바테인',
        rarity: 6,
        baseAtk: 318,
        mainStat: 'int',
        subStat: 'str',
        type: 'arts',
        element: 'heat',
        stats: { str: 121, agi: 99, int: 237, wil: 89 },
        usableWeapons: ['sword'],
        skill: [
            { skilltype: '기본공격', dmg: '%' },
            { skilltype: '배틀스킬', dmg: '%', type: '연소 부여', target: '적' },
            { skilltype: '연계스킬', dmg: '%' },
            { skilltype: '궁극기', dmg: '%', type: '열기 부착', target: '적' }
        ],
        talents: [
            { type: '열기 저항 무시', val: 20 },
            {}
        ],
        potential: [
            {},
            [{ type: '스탯', stats: '지능', val: 20 }, { type: '기본 공격 피해', val: '15%' }],
            {},
            {},
            {}
        ]
    },
    {
        id: 'Last Rite',
        name: '라스트 라이트',
        rarity: 6,
        baseAtk: 332,
        mainStat: 'str',
        subStat: 'wil',
        type: 'arts',
        element: 'cryo',
        stats: { str: 215, agi: 104, int: 93, wil: 109 },
        usableWeapons: ['great_sword'],
        skill: [
            { skilltype: '기본공격', dmg: '%' },
            { skilltype: '배틀스킬', dmg: '%', type: '냉기 부착', target: '적' },
            { skilltype: '연계스킬', dmg: '%', type: '냉기 부착 소모' },
            { skilltype: '궁극기', dmg: '%' }
        ],
        talents: [
            { type: '냉기 취약', val: 16, target: '적' },
            {}
        ],
        potential: [
            {},
            [{ type: '스탯', stats: '힘', val: 20 }, { type: '냉기 피해', val: 10 }],
            {},
            {},
            {}
        ]
    },
    {
        id: 'Yvonne',
        name: '이본',
        rarity: 6,
        baseAtk: 321,
        mainStat: 'int',
        subStat: 'agi',
        type: 'arts',
        element: 'cryo',
        stats: { str: 82, agi: 128, int: 236, wil: 105 },
        usableWeapons: ['handcannon'],
        skill: [
            { skilltype: '기본공격', dmg: '%' },
            { skilltype: '배틀스킬', dmg: '%', type: '동결 부여', target: '적' },
            { skilltype: '연계스킬', dmg: '%', type: '동결 부여', target: '적' },
            [{ skilltype: '궁극기', dmg: '%', type: '치명타 확률', val: 30 }, { skilltype: '궁극기', dmg: '%', type: '치명타 피해', val: 60 }]
        ],
        talents: [
            {},
            { type: '치명타 피해', val: 40 }
        ],
        potential: [
            {},
            [{ type: '스탯', stats: '지능', val: 20 }, { type: '치명타 확률', val: 7 }],
            { type: '치명타 피해', val: 20 },
            {},
            [{ type: '공격력 증가', val: 10 }, { type: '치명타 피해', val: 30 }]
        ]
    },
    {
        id: 'Avywenna',
        name: '아비웨나',
        rarity: 5,
        baseAtk: 312,
        mainStat: 'wil',
        subStat: 'agi',
        type: 'arts',
        element: 'elec',
        stats: { str: 107, agi: 106, int: 110, wil: 228 },
        usableWeapons: ['polearm'],
        skill: [
            { skilltype: '기본공격', dmg: '%' },
            { skilltype: '배틀스킬', dmg: '%', type: '전기 부착', target: '적' },
            { skilltype: '연계스킬', dmg: '%' },
            { skilltype: '궁극기', dmg: '%' }
        ],
        talents: [
            {},
            { type: '전기 취약', val: 10, target: '적' }
        ],
        potential: [
            {},
            {},
            [{ type: '스탯', stats: '의지', val: 15 }, { type: '전기 피해', val: 8 }],
            {},
            {}
        ]
    },
    {
        id: 'Da Pan',
        name: '판',
        rarity: 5,
        baseAtk: 303,
        mainStat: 'str',
        subStat: 'wil',
        type: 'phys',
        element: null,
        stats: { str: 235, agi: 96, int: 94, wil: 102 },
        usableWeapons: ['great_sword'],
        skill: [
            { skilltype: '기본공격', dmg: '%' },
            { skilltype: '배틀스킬', dmg: '%', type: '방어 불능 부여', target: '적' },
            { skilltype: '연계스킬', dmg: '%', type: '방어 불능 부여', target: '적' },
            { skilltype: '궁극기', dmg: '%', type: '방어 불능 부여', target: '적' }
        ],
        talents: [
            { type: '물리 피해', val: 24 },
            {}
        ],
        potential: [
            { type: '물리 피해', val: 30 },
            {},
            [{ type: '스탯', stats: '힘', val: 15 }, { type: '물리 피해', val: 8 }],
            {},
            {}
        ]
    },
    {
        id: 'Pogranichnik',
        name: '포그라니치니크',
        rarity: 6,
        baseAtk: 321,
        mainStat: 'wil',
        subStat: 'agi',
        type: 'phys',
        element: null,
        stats: { str: 101, agi: 110, int: 97, wil: 233 },
        usableWeapons: ['sword'],
        skill: [
            { skilltype: '기본공격', dmg: '%' },
            [{ skilltype: '배틀스킬', dmg: '%', type: '방어 불능 부여' }, { skilltype: '배틀스킬', dmg: '%', type: '스킬 게이지 회복', target: '적' }],
            { skilltype: '연계스킬', dmg: '%', type: '스킬 게이지 회복' },
            { skilltype: '궁극기', dmg: '%', type: '스킬 게이지 회복' }
        ],
        talents: [
            [{ type: '공격력 증가', val: 24 }, { type: '오리지늄 아츠 강도', val: 24 }],
            {}
        ],
        potential: [
            {},
            [{ type: '스탯', stats: '의지', val: 20 }, { type: '물리 피해', val: 10 }],
            {},
            {},
            {}
        ]
    },
    {
        id: 'Arclight',
        name: '아크라이트',
        rarity: 5,
        baseAtk: 306,
        mainStat: 'agi',
        subStat: 'int',
        type: 'arts',
        element: 'elec',
        stats: { str: 107, agi: 205, int: 123, wil: 100 },
        usableWeapons: ['sword'],
        skill: [
            { skilltype: '기본공격', dmg: '%' },
            { skilltype: '배틀스킬', dmg: '%', type: '스킬 게이지 회복' },
            { skilltype: '연계스킬', dmg: '%', type: '스킬 게이지 회복' },
            [{ skilltype: '궁극기', dmg: '%', type: '전기 부착' }, { skilltype: '궁극기', dmg: '%', type: '감전 부여', target: '적' }]
        ],
        talents: [
            { type: '전기 피해', val: 25, target: '팀' }, // 지능 500기준
            {}
        ],
        potential: [
            {},
            [{ type: '스탯', stats: '민첩', val: 15 }, { type: '스탯', stats: '지능', val: 15 }],
            {},
            {},
            {}
        ]
    },
    {
        id: 'Alesh',
        name: '알레쉬',
        rarity: 5,
        baseAtk: 309,
        mainStat: 'str',
        subStat: 'int',
        type: 'arts',
        element: 'cryo',
        stats: { str: 218, agi: 95, int: 125, wil: 89 },
        usableWeapons: ['sword'],
        skill: [
            { skilltype: '기본공격', dmg: '%' },
            [{ skilltype: '배틀스킬', dmg: '%', type: '스킬 게이지 회복' }, { skilltype: '배틀스킬', dmg: '%', type: '동결 부여', target: '적' }],
            { skilltype: '연계스킬', dmg: '%', type: '스킬 게이지 회복' },
            [{ skilltype: '궁극기', dmg: '%', type: '스킬 게이지 회복' }, { skilltype: '궁극기', dmg: '%', type: '냉기 부착', target: '적' }]
        ],
        talents: [
            {},
            {}
        ],
        potential: [
            {},
            [{ type: '스탯', stats: '힘', val: 15 }, { type: '스탯', stats: '지능', val: 15 }],
            { type: '공격력 증가', val: 15, target: '팀' },
            {},
            {}
        ]
    },
    {
        id: 'Akekuri',
        name: '아케쿠리',
        rarity: 4,
        baseAtk: 319,
        mainStat: 'agi',
        subStat: 'int',
        type: 'arts',
        element: 'heat',
        stats: { str: 110, agi: 200, int: 106, wil: 108 },
        usableWeapons: ['sword'],
        skill: [
            { skilltype: '기본공격', dmg: '%' },
            { skilltype: '배틀스킬', dmg: '%', type: '열기 부착', target: '적' },
            { skilltype: '연계스킬', dmg: '%', type: '스킬 게이지 회복' },
            { skilltype: '궁극기', dmg: '%', type: '스킬 게이지 회복' }
        ],
        talents: [
            {},
            { type: '연타', target: '팀' }
        ],
        potential: [
            { type: '공격력 증가', val: 50 },
            [{ type: '스탯', stats: '민첩', val: 10 }, { type: '스탯', stats: '지능', val: 10 }],
            { type: '공격력 증가', val: 10, target: '팀' },
            {},
            {}
        ]
    }
];
