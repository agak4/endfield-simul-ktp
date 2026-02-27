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
        const order = Array.from(grid.children)
            .filter(el => !el.classList.contains('tile-placeholder'))
            .map(el => el.dataset.tileId)
            .filter(Boolean);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
    }

    /** localStorage에서 순서를 읽어 타일을 재배치 */
    function restoreOrder(grid) {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return;
        try {
            const order = JSON.parse(saved);
            order.forEach(tileId => {
                if (tileId.startsWith('placeholder-')) return;
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

    /** 3x3 그리드 규격에 맞춰 빈 칸(Placeholder) 더미 타일 생성 */
    function ensurePlaceholders(grid) {
        const placeholders = grid.querySelectorAll('.tile-placeholder');
        placeholders.forEach(el => el.remove());

        let col = 0;
        const tiles = Array.from(grid.children);
        let phCount = 0;

        function createPlaceholder() {
            const ph = document.createElement('div');
            ph.className = 'tile tile-placeholder';
            ph.dataset.tileId = `placeholder-auto-${phCount++}`;
            ph.innerHTML = '<span>빈 슬롯</span>';
            return ph;
        }

        for (let i = 0; i < tiles.length; i++) {
            const el = tiles[i];
            const span = el.dataset.fullRow === 'true' ? 2 : 1;

            if (col + span > 3) {
                const needed = 3 - col;
                for (let j = 0; j < needed; j++) {
                    grid.insertBefore(createPlaceholder(), el);
                }
                col = span;
            } else {
                col += span;
            }
        }

        if (col > 0 && col < 3) {
            const needed = 3 - col;
            for (let j = 0; j < needed; j++) {
                grid.appendChild(createPlaceholder());
            }
        }
    }

    function addDragHandles(grid) {
        const headers = grid.querySelectorAll('.tile h4, .dmg-inc-box h4');
        headers.forEach(h4 => {
            if (!h4.querySelector('.tile-drag-handle')) {
                const handle = document.createElement('span');
                handle.className = 'tile-drag-handle';
                handle.innerHTML = `
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                `;
                h4.classList.add('has-drag-handle');
                h4.appendChild(handle);
            }
        });
    }

    function initSortable() {
        const grid = getGrid();
        if (!grid || typeof Sortable === 'undefined') return;

        // 저장된 순서 복원
        restoreOrder(grid);
        updateFullRowStyles(grid);
        ensurePlaceholders(grid);

        // 드래그 핸들(햄버거 버튼) 추가
        addDragHandles(grid);

        Sortable.create(grid, {
            swap: true, // swap 플러그인 활성화
            swapClass: 'tile-drag-swap', // 교체될 대상에 부여할 클래스
            handle: '.tile-drag-handle', // 햄버거 버튼으로 옮기기
            animation: 200,
            ghostClass: 'tile-drag-ghost',
            chosenClass: 'tile-drag-chosen',
            dragClass: 'tile-drag-active',
            scroll: true,
            scrollSensitivity: 200,
            scrollSpeed: 20,
            bubbleScroll: true,
            onEnd(evt) {
                if (evt.oldIndex === evt.newIndex) return;

                saveOrder(grid);
                updateFullRowStyles(grid);
                ensurePlaceholders(grid);
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
