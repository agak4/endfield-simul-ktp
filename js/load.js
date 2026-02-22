/**
 * js/load.js
 * 모든 스크립트를 순서에 맞게 동적으로 로드한다.
 */
(function () {
    const scripts = [
        // 1. Data
        'js/data/data_operators.js',
        'js/data/data_weapons.js',
        'js/data/data_gears.js',
        'js/data/data_abnormals.js',

        // 2. Core Logic
        'js/state.js',
        'js/calc.js',

        // 3. UI Modules
        'js/ui/controls.js',
        'js/ui/sidebar.js',
        'js/ui/modal.js',
        'js/ui/render.js',
        'js/ui/tooltip.js',
        'js/ui/init.js'
    ];

    function loadScripts(index) {
        if (index >= scripts.length) return;

        const script = document.createElement('script');
        script.src = scripts[index] + '?v=' + Date.now(); // 캐시 방지
        script.async = false;
        script.onload = () => loadScripts(index + 1);
        document.body.appendChild(script);
    }

    // 로딩 시작
    loadScripts(0);
})();
