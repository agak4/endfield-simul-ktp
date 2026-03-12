const equipmentData = [
    { set: "식양의 숨결", name: "식양의 숨결 보조 견갑", s1: "의지", v1: "32", s2: "지능", v2: "21", t: "궁극기 충전 효율", tv: "+24.6%", category: "부품" },
    { set: "식양의 숨결", name: "식양의 숨결 충전 코어 · I", s1: "지능", v1: "32", s2: "의지", v2: "21", t: "치유 효율 보너스", tv: "+20.7%", category: "부품" },
    { set: "식양의 숨결", name: "식양의 숨결 충전 코어", s1: "지능", v1: "32", s2: "힘", v2: "21", t: "궁극기 충전 효율", tv: "+24.6%", category: "부품" },
    { set: "식양의 숨결", name: "식양의 숨결 글러브 · I", s1: "지능", v1: "65", s2: "의지", v2: "43", t: "궁극기 충전 효율", tv: "+20.5%", category: "글러브" },
    { set: "식양의 숨결", name: "식양의 숨결 글러브", s1: "지능", v1: "65", s2: "힘", v2: "43", t: "궁극기 충전 효율", tv: "+20.5%", category: "글러브" },
    { set: "식양의 숨결", name: "식양의 숨결 장갑", s1: "의지", v1: "87", s2: "지능", v2: "58", t: "오리지늄 아츠 강도", tv: "+20", category: "방어구" },

    { set: "조류의 물결", name: "탁류 화염 절단기", s1: "지능", v1: "32", s2: "힘", v2: "21", t: "일반 공격 피해 보너스", tv: "+27.6%", category: "부품" },
    { set: "조류의 물결", name: "현하 산소 공급 장치", s1: "힘", v1: "32", s2: "의지", v2: "21", t: "냉기와 전기 피해 보너스", tv: "+23%", category: "부품" },
    { set: "조류의 물결", name: "조류의 물결 건틀릿", s1: "힘", v1: "65", s2: "의지", v2: "43", t: "냉기와 전기 피해 보너스", tv: "+19.2%", category: "글러브" },
    { set: "조류의 물결", name: "낙조 경갑", s1: "지능", v1: "87", s2: "힘", v2: "58", t: "궁극기 충전 효율", tv: "+12.3%", category: "방어구" },

    { set: "응룡 50식", name: "응룡 50식 탐지기", s1: "힘", v1: "32", s2: "의지", v2: "21", t: "물리 피해 보너스", tv: "+23%", category: "부품" },
    { set: "응룡 50식", name: "응룡 50식 단검 · I", s1: "지능", v1: "32", s2: "힘", v2: "21", t: "모든 스킬 피해 보너스", tv: "+27.6%", category: "부품" },
    { set: "응룡 50식", name: "응룡 50식 단검", s1: "의지", v1: "32", s2: "민첩", v2: "21", t: "연계 스킬 피해 보너스", tv: "+41.4%", category: "부품" },
    { set: "응룡 50식", name: "응룡 50식 글러브 · I", s1: "의지", v1: "65", s2: "민첩", v2: "43", t: "연계 스킬 피해 보너스", tv: "+34.5%", category: "글러브" },
    { set: "응룡 50식", name: "응룡 50식 글러브", s1: "민첩", v1: "65", s2: "지능", v2: "43", t: "연계 스킬 피해 보너스", tv: "+34.5%", category: "글러브" },
    { set: "응룡 50식", name: "응룡 50식 경갑", s1: "의지", v1: "87", s2: "힘", v2: "58", t: "모든 스킬 피해 보너스", tv: "+13.8%", category: "방어구" },
    { set: "응룡 50식", name: "응룡 50식 중갑", s1: "힘", v1: "87", s2: "의지", v2: "58", t: "물리 피해 보너스", tv: "+11.5%", category: "방어구" },

    { set: "M. I. 경찰용", name: "M. I. 경찰용 단검 · I", s1: "의지", v1: "32", s2: "민첩", v2: "21", t: "배틀 스킬 피해 보너스", tv: "+41.4%", category: "부품" },
    { set: "M. I. 경찰용", name: "M. I. 경찰용 단검", s1: "의지", v1: "32", s2: "지능", v2: "21", t: "열기와 자연 피해 보너스", tv: "+23%", category: "부품" },
    { set: "M. I. 경찰용", name: "M. I. 경찰용 도구 세트", s1: "지능", v1: "32", s2: "민첩", v2: "21", t: "치명타 확률", tv: "+10.4%", category: "부품" },
    { set: "M. I. 경찰용", name: "M. I. 경찰용 조준기", s1: "민첩", v1: "32", s2: "힘", v2: "21", t: "배틀 스킬 피해 보너스", tv: "+41.4%", category: "부품" },
    { set: "M. I. 경찰용", name: "M. I. 경찰용 수갑", s1: "힘", v1: "32", s2: "의지", v2: "21", t: "냉기와 전기 피해 보너스", tv: "+23%", category: "부품" },
    { set: "M. I. 경찰용", name: "M. I. 경찰용 팔찌 · I", s1: "지능", v1: "65", s2: "의지", v2: "43", t: "치명타 확률", tv: "+8.6%", category: "글러브" },
    { set: "M. I. 경찰용", name: "M. I. 경찰용 팔찌", s1: "지능", v1: "65", s2: "민첩", v2: "43", t: "일반 공격 피해 보너스", tv: "+23%", category: "글러브" },
    { set: "M. I. 경찰용", name: "M. I. 경찰용 장갑", s1: "민첩", v1: "65", s2: "힘", v2: "43", t: "배틀 스킬 피해 보너스", tv: "+34.5%", category: "글러브" },
    { set: "M. I. 경찰용", name: "M. I. 경찰용 망토 · II", s1: "의지", v1: "87", s2: "민첩", v2: "58", t: "배틀 스킬 피해 보너스", tv: "+20.7%", category: "방어구" },
    { set: "M. I. 경찰용", name: "M. I. 경찰용 망토 · I", s1: "지능", v1: "87", s2: "의지", v2: "58", t: "치명타 확률", tv: "+5.2%", category: "방어구" },
    { set: "M. I. 경찰용", name: "M. I. 경찰용 망토", s1: "지능", v1: "87", s2: "민첩", v2: "58", t: "일반 공격 피해 보너스", tv: "+13.8%", category: "방어구" },
    { set: "M. I. 경찰용", name: "M. I. 경찰용 방어구", s1: "민첩", v1: "87", s2: "힘", v2: "58", t: "오리지늄 아츠 강도", tv: "+20", category: "방어구" },

    { set: "열 작업용", name: "열 작업용 전력 상자", s1: "의지", v1: "32", s2: "지능", v2: "21", t: "오리지늄 아츠 강도", tv: "+41", category: "부품" },
    { set: "열 작업용", name: "열 작업용 에너지 저장함", s1: "힘", v1: "32", s2: "민첩", v2: "21", t: "오리지늄 아츠 강도", tv: "+41", category: "부품" },
    { set: "열 작업용", name: "열 작업용 온도 측정기", s1: "지능", v1: "41", s2: "-", v2: "-", t: "배틀 스킬 피해 보너스", tv: "+41.4%", category: "부품" },
    { set: "열 작업용", name: "열 작업용 장갑", s1: "힘", v1: "65", s2: "의지", v2: "43", t: "오리지늄 아츠 강도", tv: "+34", category: "글러브" },
    { set: "열 작업용", name: "열 작업용 건틀릿 · I", s1: "의지", v1: "65", s2: "지능", v2: "43", t: "열기와 자연 피해 보너스", tv: "+19.2%", category: "글러브" },
    { set: "열 작업용", name: "열 작업용 건틀릿", s1: "지능", v1: "65", s2: "힘", v2: "43", t: "열기와 자연 피해 보너스", tv: "+19.2%", category: "글러브" },
    { set: "열 작업용", name: "열 작업용 보조 골격", s1: "지능", v1: "87", s2: "의지", v2: "58", t: "열기와 자연 피해 보너스", tv: "+11.5%", category: "방어구" },
    { set: "열 작업용", name: "열 작업용 강화 골격", s1: "힘", v1: "87", s2: "민첩", v2: "58", t: "열기와 자연 피해 보너스", tv: "+11.5%", category: "방어구" },

    { set: "개척", name: "개척자 증량 산소 공급 장치", s1: "민첩", v1: "32", s2: "지능", v2: "21", t: "보조 능력치", tv: "+20.7%", category: "부품" },
    { set: "개척", name: "개척자 통신기 · I", s1: "힘", v1: "32", s2: "지능", v2: "21", t: "냉기와 전기 피해 보너스", tv: "+23%", category: "부품" },
    { set: "개척", name: "개척자 통신기", s1: "힘", v1: "32", s2: "민첩", v2: "21", t: "연계 스킬 피해 보너스", tv: "+41.4%", category: "부품" },
    { set: "개척", name: "개척자 내부식성 장갑", s1: "민첩", v1: "65", s2: "지능", v2: "43", t: "배틀 스킬 피해 보너스", tv: "+34.5%", category: "글러브" },
    { set: "개척", name: "개척자 방어구 · III", s1: "민첩", v1: "87", s2: "지능", v2: "58", t: "보조 능력치", tv: "+10.4%", category: "방어구" },
    { set: "개척", name: "개척자 방어구 · II", s1: "민첩", v1: "87", s2: "지능", v2: "58", t: "배틀 스킬 피해 보너스", tv: "+20.7%", category: "방어구" },
    { set: "개척", name: "개척자 방어구 · I", s1: "힘", v1: "87", s2: "민첩", v2: "58", t: "배틀 스킬 피해 보너스", tv: "+20.7%", category: "방어구" },
    { set: "개척", name: "개척자 방어구", s1: "힘", v1: "87", s2: "지능", v2: "58", t: "궁극기 피해 보너스", tv: "+25.9%", category: "방어구" },

    { set: "펄스식", name: "펄스식 침입 코어", s1: "의지", v1: "41", s2: "-", v2: "0", t: "궁극기 피해 보너스", tv: "+51.8%", category: "부품" },
    { set: "펄스식", name: "펄스식 시험침", s1: "지능", v1: "32", s2: "민첩", v2: "21", t: "오리지늄 아츠 강도", tv: "+41", category: "부품" },
    { set: "펄스식", name: "펄스식 교정기", s1: "지능", v1: "41", s2: "-", v2: "-", t: "오리지늄 아츠 강도", tv: "+41", category: "부품" },
    { set: "펄스식", name: "펄스식 장갑", s1: "의지", v1: "65", s2: "지능", v2: "43", t: "냉기와 전기 피해 보너스", tv: "+19.2%", category: "글러브" },
    { set: "펄스식", name: "펄스식 방해 슈트", s1: "지능", v1: "87", s2: "의지", v2: "58", t: "오리지늄 아츠 강도", tv: "+20", category: "방어구" },

    { set: "본 크러셔", name: "본 크러셔 조각상 · I", s1: "의지", v1: "32", s2: "지능", v2: "21", t: "연계 스킬 피해 보너스", tv: "+41.4%", category: "부품" },
    { set: "본 크러셔", name: "본 크러셔 조각상", s1: "의지", v1: "32", s2: "민첩", v2: "21", t: "배틀 스킬 피해 보너스", tv: "+41.4%", category: "부품" },
    { set: "본 크러셔", name: "본 크러셔 마스크 · I", s1: "민첩", v1: "32", s2: "힘", v2: "21", t: "치명타 확률", tv: "+10.4%", category: "부품" },
    { set: "본 크러셔", name: "본 크러셔 마스크", s1: "민첩", v1: "32", s2: "힘", v2: "21", t: "불균형 목표에 주는 피해 보너스", tv: "+41.4%", category: "부품" },
    { set: "본 크러셔", name: "본 크러셔 머플러 · I", s1: "의지", v1: "87", s2: "민첩", v2: "58", t: "궁극기 충전 효율", tv: "+12.3%", category: "방어구" },
    { set: "본 크러셔", name: "본 크러셔 머플러", s1: "의지", v1: "87", s2: "힘", v2: "58", t: "연계 스킬 피해 보너스", tv: "+20.7%", category: "방어구" },
    { set: "본 크러셔", name: "본 크러셔 중갑 방어구 · I", s1: "민첩", v1: "87", s2: "힘", v2: "58", t: "연계 스킬 피해 보너스", tv: "+20.7%", category: "방어구" },
    { set: "본 크러셔", name: "본 크러셔 중갑 방어구", s1: "민첩", v1: "87", s2: "지능", v2: "58", t: "궁극기 충전 효율", tv: "+12.3%", category: "방어구" },

    { set: "경량 초자연", name: "경량 초자연 손목시계", s1: "힘", v1: "32", s2: "민첩", v2: "21", t: "배틀 스킬 피해 보너스", tv: "+41.4%", category: "부품" },
    { set: "경량 초자연", name: "경량 초자연 안정판 · I", s1: "민첩", v1: "32", s2: "힘", v2: "21", t: "물리 피해 보너스", tv: "+23.0%", category: "부품" },
    { set: "경량 초자연", name: "경량 초자연 안정판", s1: "민첩", v1: "32", s2: "힘", v2: "21", t: "오리지늄 아츠 강도", tv: "+41", category: "부품" },
    { set: "경량 초자연", name: "경량 초자연 분석 반지", s1: "힘", v1: "32", s2: "의지", v2: "21", t: "물리 피해 보너스", tv: "+23%", category: "부품" },
    { set: "경량 초자연", name: "경량 초자연 경량 보호 장갑", s1: "의지", v1: "65", s2: "민첩", v2: "43", t: "모든 스킬 피해 보너스", tv: "+23.0%", category: "글러브" },
    { set: "경량 초자연", name: "경량 초자연 글러브", s1: "민첩", v1: "65", s2: "힘", v2: "43", t: "오리지늄 아츠 강도", tv: "+34", category: "글러브" },
    { set: "경량 초자연", name: "경량 초자연 보호판", s1: "힘", v1: "87", s2: "의지", v2: "58", t: "불균형 목표에 주는 피해 보너스", tv: "+20.7%", category: "방어구" },

    { set: "생체 보조", name: "생체 보조 보호 주사기", s1: "의지", v1: "41", s2: "-", v2: "-", t: "치유 효율 보너스", tv: "+20.7%", category: "부품" },
    { set: "생체 보조", name: "생체 보조 보호판", s1: "의지", v1: "32", s2: "지능", v2: "21", t: "주요 능력치", tv: "+20.7%", category: "부품" },
    { set: "생체 보조", name: "생체 보조 접속기 · II", s1: "힘", v1: "41", s2: "-", v2: "0", t: "생명력", tv: "+41.4%", category: "부품" },
    { set: "생체 보조", name: "생체 보조 접속기 · I", s1: "힘", v1: "32", s2: "의지", v2: "21", t: "생명력", tv: "+41.4%", category: "부품" },
    { set: "생체 보조", name: "생체 보조 접속기", s1: "힘", v1: "32", s2: "의지", v2: "21", t: "모든 피해 감소", tv: "17.2%", category: "부품" },
    { set: "생체 보조", name: "생체 보조 금속 장갑", s1: "의지", v1: "65", s2: "힘", v2: "43", t: "치유 효율 보너스", tv: "+17.3%", category: "글러브" },
    { set: "생체 보조", name: "생체 보조 장갑(팔목)", s1: "힘", v1: "65", s2: "의지", v2: "43", t: "궁극기 충전 효율", tv: "+20.5%", category: "글러브" },
    { set: "생체 보조", name: "생체 보조 흉갑", s1: "의지", v1: "87", s2: "지능", v2: "58", t: "치유 효율 보너스", tv: "+10.4%", category: "방어구" },
    { set: "생체 보조", name: "생체 보조 중갑", s1: "힘", v1: "87", s2: "의지", v2: "58", t: "치유 효율 보너스", tv: "+10.4%", category: "방어구" },

    { set: "검술사", name: "검술사 초소형 필터", s1: "힘", v1: "32", s2: "의지", v2: "21", t: "물리 피해 보너스", tv: "+23%", category: "부품" },
    { set: "검술사", name: "검술사 위치 신호기", s1: "힘", v1: "41", s2: "-", v2: "0", t: "오리지늄 아츠 강도", tv: "+41", category: "부품" },
    { set: "검술사", name: "검술사 부싯돌", s1: "민첩", v1: "32", s2: "힘", v2: "21", t: "물리 피해 보너스", tv: "+23%", category: "부품" },
    { set: "검술사", name: "검술사 전술 금속 장갑", s1: "민첩", v1: "65", s2: "힘", v2: "43", t: "궁극기 피해 보너스", tv: "+43.1%", category: "글러브" },
    { set: "검술사", name: "검술사 전술 장갑", s1: "힘", v1: "65", s2: "의지", v2: "43", t: "물리 피해 보너스", tv: "+19.2%", category: "글러브" },
    { set: "검술사", name: "검술사 경장갑", s1: "힘", v1: "87", s2: "의지", v2: "58", t: "궁극기 충전 효율", tv: "+12.3%", category: "방어구" },
    { set: "검술사", name: "검술사 중장갑", s1: "민첩", v1: "87", s2: "힘", v2: "58", t: "오리지늄 아츠 강도", tv: "+20", category: "방어구" },

    { set: "위기 탈출", name: "위기 탈출 도장 · I", s1: "의지", v1: "43", s2: "-", v2: "0", t: "치명타 확률", tv: "+10.8%", category: "부품" },
    { set: "위기 탈출", name: "위기 탈출 도장", s1: "지능", v1: "43", s2: "-", v2: "0", t: "궁극기 충전 효율", tv: "+25.7%", category: "부품" },
    { set: "위기 탈출", name: "위기 탈출 식별 패널 · I", s1: "민첩", v1: "43", s2: "-", v2: "0", t: "연계 스킬 피해 보너스", tv: "+43.2%", category: "부품" },
    { set: "위기 탈출", name: "위기 탈출 식별 패널", s1: "힘", v1: "43", s2: "-", v2: "0", t: "모든 피해 감소", tv: "17.8%", category: "부품" },
    { set: "위기 탈출", name: "위기 탈출 장갑", s1: "힘", v1: "69", s2: "의지", v2: "46", t: "치명타 확률", tv: "+10.8%", category: "글러브" },
    { set: "위기 탈출", name: "위기 탈출 보호 장갑", s1: "민첩", v1: "86", s2: "-", v2: "0", t: "궁극기 피해 보너스", tv: "+45%", category: "글러브" },
    { set: "위기 탈출", name: "위기 탈출 방어구", s1: "지능", v1: "115", s2: "-", v2: "0", t: "궁극기 충전 효율", tv: "+12.9%", category: "방어구" },
    { set: "위기 탈출", name: "위기 탈출 중장갑", s1: "민첩", v1: "115", s2: "-", v2: "0", t: "일반 공격 피해 보너스", tv: "+14.4%", category: "방어구" }
];

let currentItem = null;
let activeFilterContext = null;

function init() {
    const sidebar = document.getElementById('sidebar');
    let currentSet = "";
    let gridContainer = null;

    equipmentData.forEach((item, index) => {
        if (item.set !== currentSet) {
            currentSet = item.set;

            const setGroup = document.createElement('div');
            setGroup.className = 'set-group';

            const header = document.createElement('div');
            header.className = 'set-header';
            header.textContent = `=== ${currentSet} ===`;
            setGroup.appendChild(header);

            // 4열 그리드 컨테이너
            gridContainer = document.createElement('div');
            gridContainer.className = 'item-grid';
            setGroup.appendChild(gridContainer);

            sidebar.appendChild(setGroup);
        }

        const row = document.createElement('div');
        row.className = 'item-row';
        row.id = `item-${index}`;
        row.title = item.name; // 툴팁으로 이름 표시
        row.onclick = () => selectItem(index);

        const img = document.createElement('img');
        img.className = 'item-thumb';
        img.src = `images/${item.name}.webp`;
        img.onerror = function () { this.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IiMyMjIiLz48L3N2Zz4='; };

        row.appendChild(img);
        gridContainer.appendChild(row);
    });

    selectItem(0);
}

// 2. 아이템 선택
function selectItem(index) {
    const prev = document.querySelector('.item-row.active');
    if (prev) prev.classList.remove('active');

    const current = document.getElementById(`item-${index}`);
    if (current) current.classList.add('active');

    currentItem = equipmentData[index];
    updateDetailView(currentItem);

    // 개선점 3: 필터가 활성화된 상태라면, 새 아이템의 해당 스탯 위치를 찾아 하이라이트 갱신
    if (activeFilterContext) {
        syncFilterHighlight(currentItem);
    }
}

// 스탯 하이라이트 동기화 함수
function syncFilterHighlight(item) {
    // 모든 하이라이트 제거 후 재검사
    document.querySelectorAll('.stat-row').forEach(row => row.classList.remove('active-filter'));

    const targetName = activeFilterContext.name;

    // 현재 아이템의 스탯 중 필터 이름과 일치하는 곳 찾기
    if (item.s1 === targetName) {
        document.getElementById('row-stat1').classList.add('active-filter');
    } else if (item.s2 === targetName) {
        document.getElementById('row-stat2').classList.add('active-filter');
    } else if (item.t === targetName) {
        document.getElementById('row-trait').classList.add('active-filter');
    }
    // 일치하는 스탯이 없으면 하이라이트 표시 안함 (필터 효과는 목록에 남아있음)
}

function updateDetailView(item) {
    const mainImg = document.getElementById('mainImage');
    const placeholder = document.querySelector('.img-placeholder');

    mainImg.style.display = 'block';
    placeholder.style.display = 'none';
    mainImg.src = `images/${item.name}.webp`;

    document.getElementById('detailSet').textContent = item.set;
    document.getElementById('detailName').textContent = item.name;

    document.getElementById('stat1Label').textContent = item.s1;
    document.getElementById('stat1Value').textContent = item.v1;

    document.getElementById('stat2Label').textContent = item.s2 !== '-' ? item.s2 : '없음';
    document.getElementById('stat2Value').textContent = item.v2;

    document.getElementById('traitLabel').textContent = item.t;
    document.getElementById('traitValue').textContent = item.tv;

    document.getElementById('detailCategory').textContent = item.category || "부품";
}

// 3. 필터링 로직
function parseValue(str) {
    if (!str || str === '-') return 0;
    return parseFloat(str.replace(/[^0-9.]/g, ''));
}

function filterByStat(statNum) {
    if (!currentItem) return;

    let targetStatName, targetStatValRaw;

    if (statNum === 1) {
        targetStatName = currentItem.s1;
        targetStatValRaw = currentItem.v1;
    } else {
        if (currentItem.s2 === '-') return;
        targetStatName = currentItem.s2;
        targetStatValRaw = currentItem.v2;
    }

    const targetVal = parseValue(targetStatValRaw);

    // 컨텍스트 저장
    activeFilterContext = { name: targetStatName, value: targetVal, type: 'basic' };

    applyFilter((item) => {
        const val1 = item.s1 === targetStatName ? parseValue(item.v1) : -1;
        const val2 = item.s2 === targetStatName ? parseValue(item.v2) : -1;
        const maxVal = Math.max(val1, val2);

        return {
            match: maxVal >= targetVal,
            exceed: maxVal > targetVal // 개선점 4: 초과 여부 확인
        };
    }, `${targetStatName} ${targetStatValRaw} 이상`);

    syncFilterHighlight(currentItem);
}

function filterByTrait() {
    if (!currentItem) return;

    const targetName = currentItem.t;
    const targetValRaw = currentItem.tv;
    const targetVal = parseValue(targetValRaw);

    activeFilterContext = { name: targetName, value: targetVal, type: 'trait' };

    applyFilter((item) => {
        const val = item.t === targetName ? parseValue(item.tv) : -1;
        return {
            match: val >= targetVal,
            exceed: val > targetVal
        };
    }, `${targetName} ${targetValRaw} 이상`);

    syncFilterHighlight(currentItem);
}

function applyFilter(conditionFn, msg) {
    equipmentData.forEach((item, index) => {
        const row = document.getElementById(`item-${index}`);
        const result = conditionFn(item);

        const isSameCategory = currentItem && (item.category === currentItem.category);

        row.classList.remove('dimmed', 'exceed');

        if (result.match && isSameCategory) {
            if (result.exceed) {
                row.classList.add('exceed');
            }
        } else {
            row.classList.add('dimmed');
        }
    });

    document.getElementById('filterInfoArea').style.display = 'block';
    document.getElementById('filterMsg').textContent = `필터: ${msg} (분류: ${currentItem.category})`;
    document.getElementById('resetBtn').style.display = 'block';
}

function resetFilter() {
    const rows = document.querySelectorAll('.item-row');
    rows.forEach(row => row.classList.remove('dimmed', 'exceed'));

    document.getElementById('filterInfoArea').style.display = 'none';
    document.getElementById('filterMsg').textContent = '';

    document.querySelectorAll('.stat-row').forEach(row => row.classList.remove('active-filter'));
    activeFilterContext = null;
}


window.onload = init;

