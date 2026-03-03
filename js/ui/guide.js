/**
 * ui/guide.js — 사용 가이드 모달 관리
 *
 * [역할]
 * - 가이드 모달의 HTML 구조를 정의하고 동적으로 렌더링한다.
 * - 가이드 열기/닫기 기능을 제공한다.
 */

/**
 * 가이드 모달을 열고, 필요한 경우 DOM에 생성한다.
 */
function openGuideModal() {
    let modal = document.getElementById('guide-modal');

    // 모달이 없으면 생성
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'guide-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content guide-content">
                <div class="modal-header">
                    <span class="modal-header-title">사용 가이드</span>
                    <button class="modal-close" onclick="closeGuideModal()">&times;</button>
                </div>
                <div class="guide-body">
                    <h3>개요</h3>
                    <p>이 시뮬레이터는 오퍼레이터의 세팅에 따른 이론적인 데미지 기댓값을 산출하기 위해 제작되었습니다. 실제 게임 내 데미지와는 차이가 있을 수 있습니다.</p>
                    <h3>기본 스펙 기준</h3>
                    <ul>
                        <li><strong>오퍼레이터:</strong> 90레벨, 신뢰도 100</li>
                        <li><strong>무기:</strong> 90레벨</li>
                    </ul>
                    <h3>계산 제외 항목</h3>
                    <ul>
                        <li>버프 및 디버프의 지속 시간 (상시 적용으로 가정)</li>
                        <li>데미지에 직접적인 영향이 없는 유틸리티 능력치 (예: 궁극기 충전 효율, 궁극기 에너지 감소 등)</li>
                    </ul>
                    <h3>주의사항</h3>
                    <ul>
                        <li>오류가 있을 수 있으니 계산 정보는 반드시 맹신하지 마시고 참고용으로만 사용하여 주시기 바랍니다.</li>
                    </ul>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // 배경 클릭 시 닫기
        modal.onclick = (e) => {
            if (e.target === modal) closeGuideModal();
        };
    }

    modal.classList.add('open');
}

/**
 * 가이드 모달을 닫는다.
 */
function closeGuideModal() {
    const modal = document.getElementById('guide-modal');
    if (modal) {
        modal.classList.remove('open');
    }
}
