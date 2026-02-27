/**
 * js/ui/sortable-grid.js — 대시보드 타일 드래그앤드롭
 *
 * [역할]
 * - dashboard-grid 내 타일들을 꾹 눌러 드래그로 순서 변경
 * - data-full-row="true" 타일(주는 피해)은 그리드에서 2칸을 점유
 * - 순서를 localStorage에 저장하고 페이지 로드 시 복원
 */

(function () {
    const STORAGE_KEY = 'dashboard-tile-order';

    function getGrid() {
        return document.querySelector('.dashboard-grid');
    }

    /** 현재 타일 순서를 localStorage에 저장 */
    function saveOrder(grid) {
        const order = Array.from(grid.children).map(el => el.dataset.tileId).filter(Boolean);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
    }

    /** localStorage에서 순서를 읽어 타일을 재배치 */
    function restoreOrder(grid) {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return;
        try {
            const order = JSON.parse(saved);
            order.forEach(tileId => {
                const el = grid.querySelector(`[data-tile-id="${tileId}"]`);
                if (el) grid.appendChild(el);
            });
        } catch (e) {
            // 손상된 저장값 무시
        }
    }

    /** full-row 타일의 grid-column을 업데이트 */
    function updateFullRowStyles(grid) {
        Array.from(grid.children).forEach(el => {
            if (el.dataset.fullRow === 'true') {
                el.style.gridColumn = 'span 2';
            } else {
                el.style.gridColumn = '';
            }
        });
    }

    function initSortable() {
        const grid = getGrid();
        if (!grid || typeof Sortable === 'undefined') return;

        // 저장된 순서 복원
        restoreOrder(grid);
        updateFullRowStyles(grid);

        Sortable.create(grid, {
            animation: 200,
            delay: 300,
            delayOnTouchOnly: false,
            ghostClass: 'tile-drag-ghost',
            chosenClass: 'tile-drag-chosen',
            dragClass: 'tile-drag-active',
            scroll: true,
            scrollSensitivity: 200,
            scrollSpeed: 20,
            bubbleScroll: true,
            // data-full-row 타일은 항상 별도 row를 차지하므로 group filter 없음
            onEnd() {
                saveOrder(grid);
                updateFullRowStyles(grid);
            }
        });
    }

    // DOMContentLoaded 이후 또는 defer 스크립트들이 로드된 후 초기화
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSortable);
    } else {
        initSortable();
    }
})();
