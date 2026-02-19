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

    //          | '물리 증폭' (물리 피해 증가 - 피해증가와 곱연산)

    //          | '아츠 취약' (적이 아츠 피해에 취약해지는 효과)

    //          | '연타'

    //          | '일반 공격 피해' (일반 공격 피해 증가)
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

    // skill 작성 규칙:
    //   skilltype : '일반공격' | '배틀스킬' | '연계스킬' | '궁극기'
    //   dmg       : 기본 배율 문자열, 예) '348%'
    //   type      : (선택) 스킬 효과 설명 문자열, 예) '방어 불능 부여'
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
            { skilltype: '일반공격', dmg: '348%' },
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
        rarity: 6,
        baseAtk: 312,
        mainStat: 'agi',
        subStat: 'str',
        type: 'phys',
        element: null,
        stats: { str: 123, agi: 192, int: 115, wil: 117 },
        usableWeapons: ['polearm'],
        skill: [
            { skilltype: '일반공격', dmg: 0 },
            [{ skilltype: '배틀스킬', dmg: '%', type: '물리 취약', val: 12, target: '적' }, { skilltype: '배틀스킬', dmg: '%', type: '방어 불능 부여' }],
            { skilltype: '연계스킬', dmg: '%', type: '연타', target: '팀' },
            { skilltype: '궁극기', dmg: '%', type: '방어 불능 부여', target: '적' }
        ],
        talents: [
            { type: '공격력 증가', val: '지능, 의지 1포인트당 0.15% 증가' },
            {}
        ],
        potential: [
            { type: '물리 취약', val: 5, target: '적' },
            { type: '스탯', stats: '모든 능력치', val: 15 },
            { type: '공격력 증가', val: '지능, 의지 1포인트당 0.05% 증가' },
            {},
            {}
        ]
    },
    {
        id: 'Chen Qianyu',
        name: '진천우',
        rarity: 5,
        baseAtk: 297,
        mainStat: 'agi',
        subStat: 'str',
        type: 'phys',
        element: null,
        stats: { str: 106, agi: 231, int: 85, wil: 93 },
        usableWeapons: ['sword'],
        skill: [
            { skilltype: '일반공격', dmg: 0 },
            [{ skilltype: '배틀스킬', dmg: '%', type: '방어 불능 부여', target: '적' }],
            { skilltype: '연계스킬', dmg: '%', type: '방어 불능 부여', target: '적' },
            { skilltype: '궁극기', dmg: '%' }
        ],
        talents: [
            { type: '공격력 증가', val: 40 },
            {}
        ],
        potential: [
            { type: '주는 피해', val: 20 },
            [{ type: '스탯', stats: '민첩', val: 15 }, { type: '물리 피해', val: 8 }],
            {},
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
            { skilltype: '일반공격', dmg: 0 },
            { skilltype: '배틀스킬', dmg: '%', type: '냉기 부착', target: '적' },
            [{ skilltype: '연계스킬', dmg: '%', type: '물리 취약', val: 15, target: '적' }, { skilltype: '연계스킬', dmg: '%', type: '방어 불능 부여' }],
            { skilltype: '궁극기', dmg: '%', type: '방어 불능 부여', target: '적' }
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
            { skilltype: '일반공격', dmg: 0 },
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
            { skilltype: '일반공격', dmg: 0 },
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
            { skilltype: '일반공격', dmg: 0 },
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
            { skilltype: '일반공격', dmg: 0 },
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
            { skilltype: '일반공격', dmg: 0 },
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
            { skilltype: '일반공격', dmg: 0 },
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
            { skilltype: '일반공격', dmg: 0 },
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
            { skilltype: '일반공격', dmg: 0 },
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
            { skilltype: '일반공격', dmg: 0 },
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
            { skilltype: '일반공격', dmg: 0 },
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
            { skilltype: '일반공격', dmg: 0 },
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
            [{ type: '스탯', stats: '지능', val: 20 }, { type: '일반 공격 피해', val: '15%' }],
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
            { skilltype: '일반공격', dmg: 0 },
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
            { skilltype: '일반공격', dmg: 0 },
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
            { skilltype: '일반공격', dmg: 0 },
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
            { skilltype: '일반공격', dmg: 0 },
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
            { skilltype: '일반공격', dmg: 0 },
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
            { skilltype: '일반공격', dmg: 0 },
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
            { skilltype: '일반공격', dmg: 0 },
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
            { skilltype: '일반공격', dmg: 0 },
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
