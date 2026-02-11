// Вспомогательные функции главной страницы: модальное окно маржинальности

let currentResultForMargin = null;

function escapeHtml(value) {
    if (window.Utils && typeof Utils.escapeHtml === 'function') {
        return Utils.escapeHtml(value);
    }
    return String(value ?? '');
}

function getRouteInfo(result) {
    if (!result) return 'Маршрут не указан';

    if (result.transportType === 'direct_rail') {
        return `${result.data.fob || 'Не указан'} → ${result.data.arrivalCity || 'Не указан'}`;
    }
    if (result.transportType === 'direct_sea') {
        return `${result.data.pol || 'Не указан'} → ${result.data.pod || 'Не указан'}`;
    }
    if (result.transportType === 'sea') {
        return `${result.data.pol || 'Не указан'} → ${result.data.pod || 'Не указан'}`;
    }
    if (result.transportType === 'rail') {
        return `${result.data.city || 'Не указан'} → ${result.data.destination || 'Не указан'}`;
    }
    if (result.transportType === 'sea_rail') {
        return result.data.connection || 'Комплексный маршрут';
    }

    return 'Маршрут не указан';
}

function getBaseMetrics(result) {
    if (!result) return [];

    if (result.transportType === 'direct_rail') {
        return [
            { label: 'ЖД перевозка', value: `$${result.rate}` }
        ];
    }

    if (result.transportType === 'direct_sea' || result.transportType === 'sea') {
        return [
            { label: 'Фрахт', value: `$${result.rate}` }
        ];
    }

    if (result.transportType === 'rail') {
        return [
            { label: 'ЖД перевозка', value: `${result.rate} RUB` }
        ];
    }

    if (result.transportType === 'sea_rail') {
        const rows = [
            { label: 'Фрахт', value: `$${result.data.seaRate || 0}` },
            { label: 'ЖД перевозка', value: `${result.data.railRate || 0} RUB` }
        ];
        if (result.data.vttIncluded) {
            rows.push({ label: 'ВТТ', value: `${result.data.vttRate || 0} RUB` });
        }
        rows.push({ label: 'Итог', value: `${result.rate || 0} ${result.currency || 'RUB'}` });
        return rows;
    }

    return [];
}

function openMarginModal(resultIndex) {
    const sourceResults = Array.isArray(window.displayedResults) && window.displayedResults.length > 0
        ? window.displayedResults
        : window.allResults;

    if (!sourceResults || !sourceResults[resultIndex]) {
        console.error('Результат не найден');
        return;
    }

    currentResultForMargin = sourceResults[resultIndex];

    const modal = document.getElementById('margin-modal');
    if (!modal) return;

    modal.style.display = 'flex';
    modal.classList.remove('hidden');

    populateCostDetails(currentResultForMargin);
    createMarginInputs(currentResultForMargin);
    calculateAndDisplayMargin();

    document.addEventListener('click', handleModalOutsideClick);
}

function handleModalOutsideClick(event) {
    const modal = document.getElementById('margin-modal');
    const modalContent = modal?.querySelector('.modal-content');

    if (modal && modalContent && !modalContent.contains(event.target)) {
        closeMarginModal();
    }
}

function closeMarginModal() {
    const modal = document.getElementById('margin-modal');
    if (!modal) return;

    modal.style.display = 'none';
    modal.classList.add('hidden');
    document.removeEventListener('click', handleModalOutsideClick);
    currentResultForMargin = null;
}

function populateCostDetails(result) {
    const costDetails = document.getElementById('cost-details');
    if (!costDetails) return;

    const routeInfo = getRouteInfo(result);
    const metrics = getBaseMetrics(result);

    const metricsHTML = metrics.map(item => `
        <div class="cost-metric">
            <span class="cost-metric-label">${escapeHtml(item.label)}</span>
            <span class="cost-metric-value">${escapeHtml(item.value)}</span>
        </div>
    `).join('');

    costDetails.innerHTML = `
        <div class="cost-route-block">
            <div class="cost-route-title">Маршрут</div>
            <div class="cost-route-text">${escapeHtml(routeInfo)}</div>
        </div>
        <div class="cost-metrics-grid">
            ${metricsHTML}
        </div>
    `;
}

function createMarginInputs(result) {
    const marginInputsContainer = document.getElementById('margin-inputs-container');
    if (!marginInputsContainer) return;

    if (result.transportType === 'direct_rail' || result.transportType === 'rail') {
        marginInputsContainer.innerHTML = `
            <div class="margin-input-group">
                <label for="rail-margin">Накрутка на ЖД (${result.transportType === 'rail' ? 'RUB' : '$'}):</label>
                <input type="number" id="rail-margin" class="margin-input" value="0" min="0" step="1" oninput="calculateAndDisplayMargin()">
            </div>
        `;
        return;
    }

    if (result.transportType === 'direct_sea' || result.transportType === 'sea') {
        marginInputsContainer.innerHTML = `
            <div class="margin-input-group">
                <label for="sea-margin">Накрутка на фрахт ($):</label>
                <input type="number" id="sea-margin" class="margin-input" value="0" min="0" step="1" oninput="calculateAndDisplayMargin()">
            </div>
        `;
        return;
    }

    marginInputsContainer.innerHTML = `
        <div class="margin-input-group">
            <label for="sea-margin">Накрутка на море ($):</label>
            <input type="number" id="sea-margin" class="margin-input" value="0" min="0" step="1" oninput="calculateAndDisplayMargin()">
        </div>
        <div class="margin-input-group">
            <label for="rail-margin">Накрутка на ЖД (RUB):</label>
            <input type="number" id="rail-margin" class="margin-input" value="0" min="0" step="1" oninput="calculateAndDisplayMargin()">
        </div>
    `;
}

function buildComponentRows(result) {
    if (!result) return [];

    if (result.transportType === 'direct_rail' || result.transportType === 'rail') {
        const margin = parseFloat(document.getElementById('rail-margin')?.value) || 0;
        const currency = result.transportType === 'rail' ? 'RUB' : 'USD';
        return [{
            description: `ЖД перевозка ${getRouteInfo(result)}`,
            value: (result.rate || 0) + margin,
            currency
        }];
    }

    if (result.transportType === 'direct_sea' || result.transportType === 'sea') {
        const margin = parseFloat(document.getElementById('sea-margin')?.value) || 0;
        return [{
            description: `Морской фрахт ${getRouteInfo(result)}`,
            value: (result.rate || 0) + margin,
            currency: 'USD'
        }];
    }

    const seaMargin = parseFloat(document.getElementById('sea-margin')?.value) || 0;
    const railMargin = parseFloat(document.getElementById('rail-margin')?.value) || 0;

    return [
        {
            description: `Морской фрахт ${result.data?.sea?.pol || ''} → ${result.data?.sea?.pod || ''}`,
            value: (result.data?.seaRate || 0) + seaMargin,
            currency: 'USD'
        },
        {
            description: `ЖД перевозка ${result.data?.rail?.city || ''} → ${result.data?.rail?.destination || ''}`,
            value: (result.data?.railRate || 0) + railMargin,
            currency: 'RUB'
        }
    ];
}

function calculateAndDisplayMargin() {
    if (!currentResultForMargin) return;

    const resultContainer = document.getElementById('margin-result-container');
    if (!resultContainer) return;

    const routeInfo = getRouteInfo(currentResultForMargin);
    const componentRows = buildComponentRows(currentResultForMargin);

    const rowsHTML = componentRows.map(row => `
        <tr>
            <td>${escapeHtml(row.description)}</td>
            <td>${escapeHtml(row.value)}</td>
            <td>${escapeHtml(row.currency)}</td>
        </tr>
    `).join('');

    const seaRow = componentRows.find(row => row.currency === 'USD');
    const rubRows = componentRows.filter(row => row.currency === 'RUB');
    const rubTotal = rubRows.reduce((sum, row) => sum + row.value, 0);
    const seaUsd = seaRow ? seaRow.value : 0;
    const seaInRub = usdToRubRate ? Math.round(seaUsd * usdToRubRate) : 0;
    const vttRub = currentResultForMargin.transportType === 'sea_rail' && currentResultForMargin.data?.vttIncluded
        ? (currentResultForMargin.data?.vttRate || 0)
        : 0;
    const grandTotalRub = seaInRub + rubTotal + vttRub;

    let totalsHTML = '';
    if (componentRows.length === 1) {
        const single = componentRows[0];
        totalsHTML = `
            <div class="margin-total-item margin-total-final">
                <span class="margin-total-label">Итог</span>
                <span class="margin-total-value">${escapeHtml(single.value)} ${escapeHtml(single.currency)}</span>
            </div>
        `;
    } else {
        totalsHTML = `
            <div class="margin-total-item">
                <span class="margin-total-label">Море (USD)</span>
                <span class="margin-total-value">$${escapeHtml(seaUsd)}</span>
            </div>
            <div class="margin-total-item">
                <span class="margin-total-label">ЖД и RUB-компоненты</span>
                <span class="margin-total-value">${escapeHtml(rubTotal)} RUB</span>
            </div>
            ${vttRub > 0 ? `
                <div class="margin-total-item">
                    <span class="margin-total-label">ВТТ</span>
                    <span class="margin-total-value">${escapeHtml(vttRub)} RUB</span>
                </div>
            ` : ''}
            <div class="margin-total-item margin-total-final">
                <span class="margin-total-label">Итог (RUB)</span>
                <span class="margin-total-value">${escapeHtml(grandTotalRub)} RUB</span>
            </div>
        `;
    }

    const notesHTML = `
        <details class="margin-notes-card">
            <summary>Условия и примечания</summary>
            <div class="additional-info">
                <p><strong>Включено:</strong></p>
                <ul>
                    <li>Базовая перевозка по выбранному маршруту</li>
                    <li>Параметры контейнера из выбранной ставки</li>
                    ${currentResultForMargin.transportType === 'sea_rail' ? '<li>Комплексная связка Море + ЖД</li>' : ''}
                </ul>
                <p><strong>Примечание:</strong> итог пересчитывается в реальном времени при изменении накрутки.</p>
            </div>
        </details>
    `;

    const html = `
        <div class="margin-summary-card">
            <div class="margin-summary-route-title">Маршрут</div>
            <div class="margin-summary-route-value">${escapeHtml(routeInfo)}</div>
            <div class="margin-summary-totals">
                ${totalsHTML}
            </div>
        </div>

        <div class="margin-breakdown-card">
            <h4>Разбивка по услугам</h4>
            <table class="margin-table">
                <thead>
                    <tr>
                        <th>Услуга</th>
                        <th>Стоимость</th>
                        <th>Валюта</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHTML}
                </tbody>
            </table>
        </div>

        ${notesHTML}
    `;

    resultContainer.innerHTML = html;

    const textRows = componentRows.map(row => `${row.description}\t${row.value}\t${row.currency}`).join('\n');
    const totalText = componentRows.length === 1
        ? `Итог: ${componentRows[0].value} ${componentRows[0].currency}`
        : `Итог: ${grandTotalRub} RUB`;

    window.marginTableText = `Услуга\tСтоимость\tВалюта\n${textRows}\n${totalText}`;
}

function copyMarginResult() {
    const resultContainer = document.getElementById('margin-result-container');
    if (!resultContainer) return;

    const textToCopy = window.marginTableText || resultContainer.innerText;

    navigator.clipboard.writeText(textToCopy).then(() => {
        const copyButton = document.getElementById('copy-result');
        if (!copyButton) return;

        const originalText = copyButton.textContent;
        copyButton.textContent = '✅ Скопировано';
        setTimeout(() => {
            copyButton.textContent = originalText;
        }, 1400);
    }).catch(err => {
        console.error('Ошибка копирования:', err);
        alert('Не удалось скопировать результат');
    });
}

window.allResults = window.allResults || [];
