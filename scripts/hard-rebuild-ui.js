// Hard UI rebuild for compact enterprise layout without changing business logic IDs
(function hardRebuildUI() {
    function rebuildSalesSection(section) {
        if (!section || section.dataset.hardRebuilt === '1') return;

        const calculatorHeader = section.querySelector('.calculator-header');
        const calculatorForm = section.querySelector('.calculator-form');
        const filtersToggle = section.querySelector('.filters-toggle-section');
        const filtersPanel = section.querySelector('#filters-panel');
        const resultsSection = section.querySelector('#results');

        if (!calculatorForm || !filtersToggle || !filtersPanel || !resultsSection) return;

        const shell = document.createElement('div');
        shell.className = 'rb-sales-shell';

        const controlsCol = document.createElement('section');
        controlsCol.className = 'rb-sales-col rb-sales-controls';

        const resultsCol = document.createElement('section');
        resultsCol.className = 'rb-sales-col rb-sales-results';

        const controlsStack = document.createElement('div');
        controlsStack.className = 'rb-controls-stack';

        const filtersBlock = document.createElement('div');
        filtersBlock.className = 'rb-filters-block';

        controlsStack.appendChild(calculatorForm);
        filtersBlock.appendChild(filtersToggle);
        filtersBlock.appendChild(filtersPanel);
        controlsStack.appendChild(filtersBlock);
        controlsCol.appendChild(controlsStack);
        resultsCol.appendChild(resultsSection);

        shell.appendChild(controlsCol);
        shell.appendChild(resultsCol);

        if (calculatorHeader) {
            calculatorHeader.insertAdjacentElement('afterend', shell);
        } else {
            section.appendChild(shell);
        }

        section.dataset.hardRebuilt = '1';
    }

    function run() {
        rebuildSalesSection(document.getElementById('sales-interface'));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }
})();
