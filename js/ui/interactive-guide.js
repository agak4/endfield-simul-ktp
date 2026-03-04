/**
 * ui/interactive-guide.js — 인터랙티브 UI 가이드 관리
 */

const interactiveGuideSteps = [
    {
        target: '#guide-section-1',
        text: '메인 오퍼레이터의 무기 및 장비 세팅을 설정하는 영역입니다. 메인 오퍼레이터와 무기의 잠재단계, 기질 여부, 장비의 단조 여부 등을 설정할 수 있습니다.<br>프리셋 버튼을 통해 현재 설정을 최대 10개까지 저장할 수 있습니다.'
    },
    {
        target: '#sub-ops-container',
        text: '서브 오퍼레이터의 무기 및 장비 세팅을 설정하는 영역입니다. "메인으로 선택" 버튼을 통해 메인 오퍼레이터로 전환할 수 있습니다.'
    },
    {
        target: '.result-box.cycle-board-box',
        text: '메인 오퍼레이터의 스킬 마스터리와 사이클을 설정하는 영역입니다. 스킬 버튼을 눌러 사이클에 추가할 수 있으며, 추가된 스킬은 꾹 눌러 순서를 변경하거나, 우클릭으로 사이클에서 제거할 수 있습니다.<br><br>사이클에 추가된 스킬을 클릭하면 스킬의 개별 설정을 할 수 있습니다. 스킬을 클릭하지 않은 채로 버프 및 디버프, 옵션을 설정하면 모든 사이클에 동일하게 적용됩니다.'
    },
    {
        target: '.debuff-icon-section',
        text: '사이클에 추가된 스킬들에 대해 버프 및 디버프를 설정하는 영역입니다. 조건이 필요한 스킬의 경우 해당 버프 및 디버프를 활성화해야 적용됩니다.(ex 관리자의 오리지늄 결정)<br><br>띄우기 등 물리이상을 가진 스킬은 방어불능을 활성화해야 적용됩니다.<br>아츠부착을 가진 스킬은 다른 아츠부착을 활성화하면 아츠이상이 적용되며, 같은 아츠부착을 활성화하면 아츠폭발이 적용됩니다.<br><br>스킬을 추가해도 자동으로 스킬의 디버프가 발동하지 않습니다. 예를 들어 아츠부착 스킬을 추가해도 자동으로 아츠부착이 활성화되지 않습니다.'
    },
    {
        target: '.tile[data-tile-id="atk"]',
        text: '사이클에 추가된 스킬의 스탯 옵션 설정 영역입니다. 개별 항목을 클릭하여 비활성화 할 수 있으며, 중첩 옵션의 경우 클릭하여 중첩 단계를 설정할 수 있습니다.<br><br>각 타일 우상단의 핸들을 드래그하여 다른 옵션 타일과 위치를 변경할 수 있습니다.'
    },
    {
        target: '.result-box.cycle-dmg-box',
        text: '메인 오퍼레이터의 현재 설정된 사이클 계산값의 총합을 표시하는 영역입니다. 우상단의 정렬 버튼을 눌러 딜지분이 높은 순으로 정렬할 수 있습니다.'
    },
    {
        target: '#damage-contribution-box',
        text: '메인 오퍼레이터의 사이클 계산값에서 서브 오퍼레이터가 기여하는 딜지분을 표시하는 영역입니다.'
    },
    {
        target: '.tile[data-tile-id="weapon-comp"]',
        text: '메인 오퍼레이터의 무기를 비교하는 영역입니다. 잠재 단계와 기질 여부를 설정할 수 있습니다.<br>해당 무기를 착용했을 때의 예상 데미지를 표시하며, 중첩 옵션을 가진 무기의 경우 최대 중첩을 가정하여 적용됩니다.'
    }
];

let currentGuideStepIndex = -1;

function startInteractiveGuide() {
    const overlay = document.getElementById('interactive-guide-overlay');
    if (!overlay) return;

    currentGuideStepIndex = 0;
    overlay.classList.remove('u-display-none');
    renderGuideStep();
}

function renderGuideStep() {
    // 1. 기존 요소 하이라이트 해제
    document.querySelectorAll('.guide-active').forEach(el => {
        el.classList.remove('guide-active');
    });

    // 2. 가이드 종료 확인
    if (currentGuideStepIndex >= interactiveGuideSteps.length) {
        endInteractiveGuide();
        return;
    }

    const step = interactiveGuideSteps[currentGuideStepIndex];
    const targetElement = document.querySelector(step.target);

    const textEl = document.getElementById('interactive-guide-text');
    if (textEl) textEl.innerHTML = step.text;

    if (targetElement) {
        // 4. 스크롤 이동
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // 5. 새 요소 하이라이트
        targetElement.classList.add('guide-active');

        // 6. 마스크 및 툴팁 위치 조정
        positionGuideElements(targetElement);
    } else {
        // 타겟 요소가 없으면 중앙에 표시
        const guideContent = document.querySelector('.interactive-guide-content');
        guideContent.style.left = '50%';
        guideContent.style.top = '50%';
        guideContent.style.transform = 'translate(-50%, -50%)';

        // 마스크 전체 덮기
        ['t', 'b', 'l', 'r'].forEach(dir => {
            const mask = document.querySelector(`.guide-mask-${dir}`);
            if (mask) {
                if (dir === 't') { mask.style.top = '0'; mask.style.left = '0'; mask.style.width = '100%'; mask.style.height = '100%'; }
                else { mask.style.width = '0'; mask.style.height = '0'; }
            }
        });
    }
}

function positionGuideElements(targetElement) {
    if (!targetElement) return;

    const rect = targetElement.getBoundingClientRect();
    const padding = 10;

    const targetTop = rect.top - padding;
    const targetLeft = rect.left - padding;
    const targetWidth = rect.width + (padding * 2);
    const targetHeight = rect.height + (padding * 2);
    const targetBottom = targetTop + targetHeight;
    const targetRight = targetLeft + targetWidth;

    // 마스크 위치 설정 (Hole-punch effect)
    const maskT = document.querySelector('.guide-mask-t');
    const maskB = document.querySelector('.guide-mask-b');
    const maskL = document.querySelector('.guide-mask-l');
    const maskR = document.querySelector('.guide-mask-r');

    if (maskT) {
        maskT.style.top = '0';
        maskT.style.left = '0';
        maskT.style.width = '100%';
        maskT.style.height = `${Math.max(0, targetTop)}px`;
    }
    if (maskB) {
        maskB.style.top = `${targetBottom}px`;
        maskB.style.left = '0';
        maskB.style.width = '100%';
        maskB.style.height = `calc(100vh - ${targetBottom}px)`;
    }
    if (maskL) {
        maskL.style.top = `${targetTop}px`;
        maskL.style.left = '0';
        maskL.style.width = `${Math.max(0, targetLeft)}px`;
        maskL.style.height = `${targetHeight}px`;
    }
    if (maskR) {
        maskR.style.top = `${targetTop}px`;
        maskR.style.left = `${targetRight}px`;
        maskR.style.width = `calc(100vw - ${targetRight}px)`;
        maskR.style.height = `${targetHeight}px`;
    }

    // 툴팁 위치 조정 (타겟 바깥쪽 배치)
    const guideContent = document.querySelector('.interactive-guide-content');
    if (!guideContent) return;

    // 임시로 화면에 보이게 해서 크기를 측정
    guideContent.style.visibility = 'hidden';
    guideContent.style.display = 'block';
    const contentWidth = guideContent.offsetWidth;
    const contentHeight = guideContent.offsetHeight;
    guideContent.style.visibility = 'visible';
    guideContent.style.transform = 'none'; // 중앙 정렬용 transform 초기화

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let contentTop, contentLeft;

    // 아래쪽에 공간이 있는지 우선 확인
    if (targetBottom + contentHeight + 20 < viewportHeight) {
        contentTop = targetBottom + 20;
        contentLeft = targetLeft + (targetWidth / 2) - (contentWidth / 2);
    }
    // 위쪽에 공간이 있는지 확인
    else if (targetTop - contentHeight - 20 > 0) {
        contentTop = targetTop - contentHeight - 20;
        contentLeft = targetLeft + (targetWidth / 2) - (contentWidth / 2);
    }
    // 오른쪽 공간
    else if (targetRight + contentWidth + 20 < viewportWidth) {
        contentTop = targetTop + (targetHeight / 2) - (contentHeight / 2);
        contentLeft = targetRight + 20;
    }
    // 왼쪽 공간
    else if (targetLeft - contentWidth - 20 > 0) {
        contentTop = targetTop + (targetHeight / 2) - (contentHeight / 2);
        contentLeft = targetLeft - contentWidth - 20;
    }
    // 공간이 전혀 없으면 화면 중앙 (fallback)
    else {
        contentTop = (viewportHeight / 2) - (contentHeight / 2);
        contentLeft = (viewportWidth / 2) - (contentWidth / 2);
    }

    // 화면 밖으로 나가지 않도록 최종 보정
    contentTop = Math.max(10, Math.min(contentTop, viewportHeight - contentHeight - 10));
    contentLeft = Math.max(10, Math.min(contentLeft, viewportWidth - contentWidth - 10));

    guideContent.style.top = `${contentTop}px`;
    guideContent.style.left = `${contentLeft}px`;
}

function advanceInteractiveGuide() {
    if (currentGuideStepIndex !== -1) {
        currentGuideStepIndex++;
        renderGuideStep();
    }
}

function endInteractiveGuide() {
    const overlay = document.getElementById('interactive-guide-overlay');
    if (overlay) overlay.classList.add('u-display-none');

    document.querySelectorAll('.guide-active').forEach(el => {
        el.classList.remove('guide-active');
    });

    // 가이드 종료 후 화면 최상단으로 스크롤 복귀
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function initInteractiveGuide() {
    document.getElementById('interactive-guide-overlay')?.addEventListener('click', advanceInteractiveGuide);

    // 반응형 처리 및 스크롤 추적
    const updatePosition = () => {
        if (currentGuideStepIndex !== -1) {
            const step = interactiveGuideSteps[currentGuideStepIndex];
            if (step) {
                const targetElement = document.querySelector(step.target);
                if (targetElement) positionGuideElements(targetElement);
            }
        }
    };

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, { passive: true });
}

// 오버레이 클릭 시 다음 스텝으로 진행
document.addEventListener('DOMContentLoaded', initInteractiveGuide);
