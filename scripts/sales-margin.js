// Вспомогательные функции интерфейса продаж: маржинальность и копирование

// Глобальные переменные для модального окна маржинальности
let currentResultForMargin = null;
function escapeHtml(value) {
    return (window.Utils && typeof Utils.escapeHtml === 'function')
        ? Utils.escapeHtml(value)
        : String(value ?? '');
}

// Функция открытия модального окна маржинальности
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
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.remove('hidden');
        
        // Заполняем информацию о себестоимости
        populateCostDetails(currentResultForMargin);
        
        // Создаем поля для ввода маржинальности
        createMarginInputs(currentResultForMargin);
        
        // Рассчитываем и отображаем результат
        calculateAndDisplayMargin();
        
        // Добавляем обработчик для закрытия при клике вне модального окна
        document.addEventListener('click', handleModalOutsideClick);
    }
}

// Обработчик клика вне модального окна
function handleModalOutsideClick(event) {
    const modal = document.getElementById('margin-modal');
    const modalContent = document.querySelector('.modal-content');
    
    // Если клик был вне содержимого модального окна, закрываем его
    if (modal && modalContent && !modalContent.contains(event.target)) {
        closeMarginModal();
    }
}

// Функция закрытия модального окна
function closeMarginModal() {
    const modal = document.getElementById('margin-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.add('hidden');
        // Удаляем обработчик клика вне модального окна
        document.removeEventListener('click', handleModalOutsideClick);
    }
    currentResultForMargin = null;
}

// Заполнение информации о себестоимости
function populateCostDetails(result) {
    const costDetails = document.getElementById('cost-details');
    
    let routeInfo = '';
    if (result.transportType === 'direct_rail') {
        routeInfo = `${result.data.fob || 'Не указан'} → ${result.data.arrivalCity || 'Не указан'}`;
    } else if (result.transportType === 'direct_sea') {
        routeInfo = `${result.data.pol || 'Не указан'} → ${result.data.pod || 'Не указан'}`;
    } else if (result.transportType === 'sea') {
        routeInfo = `${result.data.pol || 'Не указан'} → ${result.data.pod || 'Не указан'}`;
    } else if (result.transportType === 'rail') {
        routeInfo = `${result.data.city || 'Не указан'} → ${result.data.destination || 'Не указан'}`;
    } else if (result.transportType === 'sea_rail') {
        routeInfo = result.data.connection || 'Комплексный маршрут';
    }

    const metrics = [];

    if (result.transportType === 'direct_rail') {
        metrics.push({ label: 'ЖД перевозка', value: `$${escapeHtml(result.rate)}` });
    } else if (result.transportType === 'direct_sea') {
        metrics.push({ label: 'Фрахт', value: `$${escapeHtml(result.rate)}` });
    } else if (result.transportType === 'sea') {
        metrics.push({ label: 'Фрахт', value: `$${escapeHtml(result.rate)}` });
    } else if (result.transportType === 'rail') {
        metrics.push({ label: 'ЖД перевозка', value: `${escapeHtml(result.rate)} RUB` });
    } else if (result.transportType === 'sea_rail') {
        metrics.push({ label: 'Фрахт', value: `$${escapeHtml(result.data.seaRate)}` });
        metrics.push({ label: 'ЖД перевозка', value: `${escapeHtml(result.data.railRate)} RUB` });

        if (result.data.vttIncluded) {
            metrics.push({ label: 'ВТТ', value: `${escapeHtml(result.data.vttRate)} RUB` });
        }

        metrics.push({ label: 'Итог', value: `${escapeHtml(result.rate)} ${escapeHtml(result.currency)}` });
    }

    const metricsHTML = metrics.map(item => `
        <div class="cost-metric">
            <span class="cost-metric-label">${item.label}</span>
            <span class="cost-metric-value">${item.value}</span>
        </div>
    `).join('');

    const costHTML = `
        <div class="cost-route-block">
            <div class="cost-route-title">Маршрут</div>
            <div class="cost-route-text">${escapeHtml(routeInfo)}</div>
        </div>
        <div class="cost-metrics-grid">
            ${metricsHTML}
        </div>
    `;

    costDetails.innerHTML = costHTML;
}

// Создание полей для ввода маржинальности
function createMarginInputs(result) {
    const marginInputsContainer = document.getElementById('margin-inputs-container');
    
    let marginHTML = '';
    
    if (result.transportType === 'direct_rail' || result.transportType === 'rail') {
        marginHTML = `
            <div class="margin-input-group">
                <label for="rail-margin">Накрутка на ЖД (${result.transportType === 'rail' ? 'RUB' : '$'}):</label>
                <input type="number" id="rail-margin" class="margin-input" value="0" min="0" step="1" oninput="calculateAndDisplayMargin()">
            </div>
        `;
    } else if (result.transportType === 'direct_sea' || result.transportType === 'sea') {
        marginHTML = `
            <div class="margin-input-group">
                <label for="sea-margin">Накрутка на фрахт ($):</label>
                <input type="number" id="sea-margin" class="margin-input" value="0" min="0" step="1" oninput="calculateAndDisplayMargin()">
            </div>
        `;
    } else if (result.transportType === 'sea_rail') {
        marginHTML = `
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
    
    marginInputsContainer.innerHTML = marginHTML;
}

// Расчет и отображение результата с накруткой в виде таблицы
function calculateAndDisplayMargin() {
    if (!currentResultForMargin) return;
    
    const resultContainer = document.getElementById('margin-result-container');
    const transportType = currentResultForMargin.transportType;
    const data = currentResultForMargin.data;
    
    // Определяем компоненты в зависимости от типа перевозки
    const components = [];
    let storageInfo = null; // Информация о хранении из тарифов
    let terminalInfo = null; // Информация о терминале
    
    if (transportType === 'direct_rail' || transportType === 'rail') {
        // ЖД перевозки
        const containerTypeDisplay = getContainerTypeDisplayName(data.containerType || 'container40');
        const terminalName = data.agent || data.city || '';
        
        // Получаем информацию о терминале из тарифов
        terminalInfo = getTerminalInfo(terminalName);
        if (terminalInfo) {
            storageInfo = getStorageInfoForContainer(terminalInfo, 'rail', containerTypeDisplay);
        }
        
        components.push({
            name: 'ЖД',
            baseRate: currentResultForMargin.rate,
            margin: parseFloat(document.getElementById('rail-margin').value) || 0,
            currency: transportType === 'rail' ? 'RUB' : 'USD',
            isRail: true,
            description: transportType === 'direct_rail' 
                ? `ЖД перевозки FOB ${data.fob || ''} - ${data.arrivalCity || ''}, ${containerTypeDisplay}`
                : `ЖД перевозки ${data.city || ''} - ${data.destination || ''}, ${containerTypeDisplay}`,
            terminalName: terminalName
        });
    } else if (transportType === 'direct_sea' || transportType === 'sea') {
        // Морские перевозки
        const containerTypeDisplay = getContainerTypeDisplayName(data.containerType || 'hc_40');
        const terminalName = data.pod || data.agent || '';
        
        // Получаем информацию о терминале из тарифов
        terminalInfo = getTerminalInfo(terminalName);
        if (terminalInfo) {
            storageInfo = getStorageInfoForContainer(terminalInfo, 'sea', containerTypeDisplay);
        }
        
        components.push({
            name: 'Море',
            baseRate: currentResultForMargin.rate,
            margin: parseFloat(document.getElementById('sea-margin').value) || 0,
            currency: 'USD',
            isSea: true,
            description: `Морской фрахт FOB ${data.pol || ''} - ${data.pod || ''}, ${containerTypeDisplay}`,
            terminalName: terminalName
        });
    } else if (transportType === 'sea_rail') {
        // Комплексные перевозки Море+ЖД
        const seaMargin = parseFloat(document.getElementById('sea-margin').value) || 0;
        const railMargin = parseFloat(document.getElementById('rail-margin').value) || 0;
        
        const seaContainerType = getContainerTypeDisplayName(data.sea?.containerType || 'hc_40');
        const railContainerType = getContainerTypeDisplayName(data.rail?.containerType || 'container40');
        
        const seaTerminalName = data.sea?.pod || data.sea?.agent || '';
        const railTerminalName = data.rail?.agent || data.rail?.city || '';
        
        // Получаем информацию о терминалах из тарифов
        // Используем морской терминал для информации о хранении
        terminalInfo = getTerminalInfo(seaTerminalName);
        if (terminalInfo) {
            storageInfo = getStorageInfoForContainer(terminalInfo, 'sea', seaContainerType);
        }
        
        components.push({
            name: 'Море',
            baseRate: data.seaRate,
            margin: seaMargin,
            currency: 'USD',
            isSea: true,
            description: `Морской фрахт FOB ${data.sea?.pol || ''} - ${data.sea?.pod || ''}, ${seaContainerType}`,
            terminalName: seaTerminalName
        });
        components.push({
            name: 'ЖД',
            baseRate: data.railRate,
            margin: railMargin,
            currency: 'RUB',
            isRail: true,
            description: `ЖД перевозки ${data.rail?.city || ''} - ${data.rail?.destination || ''}, ${railContainerType}`,
            terminalName: railTerminalName
        });
        // ВТТ не включаем в таблицу, будет отдельно
    }

    const routeInfo = transportType === 'direct_rail'
        ? `${data.fob || 'Не указан'} → ${data.arrivalCity || 'Не указан'}`
        : transportType === 'direct_sea'
            ? `${data.pol || 'Не указан'} → ${data.pod || 'Не указан'}`
            : transportType === 'sea'
                ? `${data.pol || 'Не указан'} → ${data.pod || 'Не указан'}`
                : transportType === 'rail'
                    ? `${data.city || 'Не указан'} → ${data.destination || 'Не указан'}`
                    : (data.connection || 'Комплексный маршрут');

    const componentRows = components.map(component => {
        const finalValue = component.baseRate + component.margin;
        return {
            description: component.description,
            value: finalValue,
            currency: component.currency
        };
    });

    const tableRowsHTML = componentRows.map(row => `
        <tr>
            <td>${escapeHtml(row.description)}</td>
            <td>${escapeHtml(row.value)}</td>
            <td>${escapeHtml(row.currency)}</td>
        </tr>
    `).join('');

    const tableHTML = `
        <table class="margin-table">
            <thead>
                <tr>
                    <th>Услуга</th>
                    <th>Стоимость</th>
                    <th>Валюта</th>
                </tr>
            </thead>
            <tbody>
                ${tableRowsHTML}
            </tbody>
        </table>
    `;

    const seaRow = componentRows.find(row => row.currency === 'USD');
    const rubRows = componentRows.filter(row => row.currency === 'RUB');
    const rubTotal = rubRows.reduce((sum, row) => sum + row.value, 0);
    const seaUsd = seaRow ? seaRow.value : 0;
    const seaInRub = usdToRubRate ? Math.round(seaUsd * usdToRubRate) : 0;
    const vttRub = transportType === 'sea_rail' && data.vttIncluded ? (data.vttRate || 0) : 0;
    const grandTotalRub = seaInRub + rubTotal + vttRub;
    const singleTotal = componentRows.length === 1 ? componentRows[0] : null;

    let totalBlockHTML = '';
    if (singleTotal) {
        totalBlockHTML = `
            <div class="margin-total-item">
                <span class="margin-total-label">Итог</span>
                <span class="margin-total-value">${escapeHtml(singleTotal.value)} ${escapeHtml(singleTotal.currency)}</span>
            </div>
        `;
    } else {
        totalBlockHTML = `
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

    const infoHTML = generateAdditionalInfo(transportType, data, storageInfo, terminalInfo, components);
    const resultHTML = `
        <div class="margin-summary-card">
            <div class="margin-summary-route-title">Маршрут</div>
            <div class="margin-summary-route-value">${escapeHtml(routeInfo)}</div>
            <div class="margin-summary-totals">
                ${totalBlockHTML}
            </div>
        </div>
        <div class="margin-breakdown-card">
            <h4>Разбивка по услугам</h4>
            ${tableHTML}
        </div>
        <details class="margin-notes-card">
            <summary>Условия и примечания</summary>
            ${infoHTML}
        </details>
    `;

    resultContainer.innerHTML = resultHTML;

    const textTable = `Услуга\tСтоимость\tВалюта\n${componentRows.map(row => `${row.description}\t${row.value}\t${row.currency}`).join('\n')}`;
    const totalText = singleTotal
        ? `Итог: ${singleTotal.value} ${singleTotal.currency}`
        : `Итог: ${grandTotalRub} RUB`;
    window.marginTableText = `${textTable}\n${totalText}`;
    window.marginTableHTML = resultHTML;
}

// 🔧 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ

// Получение информации о терминале из тарифов
function getTerminalInfo(terminalName) {
    console.log('🔍 getTerminalInfo вызвана с terminalName:', terminalName);
    
    if (!terminalName || !database.tariff || database.tariff.length === 0) {
        console.log('❌ Недостаточно данных: terminalName отсутствует или база тарифов пуста');
        return null;
    }
    
    const normalizedTerminal = terminalName.trim().toLowerCase();
    console.log('🔍 Нормализованное имя терминала:', normalizedTerminal);
    
    // Отладочный вывод всех терминалов
    console.log('📋 Все доступные терминалы в базе:');
    database.tariff.forEach((t, i) => {
        if (t.terminal) {
            console.log(`  ${i}. "${t.terminal}" -> нормализовано: "${t.terminal.trim().toLowerCase()}"`);
        }
    });
    
    // Ищем точное совпадение
    let terminal = database.tariff.find(t =>
        t.terminal && t.terminal.trim().toLowerCase() === normalizedTerminal
    );
    
    if (terminal) {
        console.log('✅ Найден терминал точным совпадением:', terminal.terminal);
        console.log('📊 Структура найденного терминала:', {
            terminal: terminal.terminal,
            hasStorage: !!terminal.storage,
            storageLength: terminal.storage?.length || 0,
            storage: terminal.storage
        });
    } else {
        console.log('⚠️ Не найдено точного совпадения, ищем частичное');
        
        // Ищем частичное совпадение
        terminal = database.tariff.find(t =>
            t.terminal && t.terminal.trim().toLowerCase().includes(normalizedTerminal)
        );
        
        if (terminal) {
            console.log('✅ Найден терминал частичным совпадением:', terminal.terminal);
        } else {
            console.log('⚠️ Не найдено частичного совпадения, ищем "Общий"');
            
            // Используем общий тариф
            terminal = database.tariff.find(t =>
                t.terminal && t.terminal.trim().toLowerCase() === 'общий'
            );
            
            if (terminal) {
                console.log('✅ Используем общий терминал:', terminal.terminal);
            } else {
                console.log('❌ Не найден даже общий терминал');
                return null;
            }
        }
    }
    
    return terminal;
}

// Получение информации о хранении для контейнера
function getStorageInfoForContainer(terminalInfo, transportType, containerType) {
    if (!terminalInfo || !terminalInfo.storage || terminalInfo.storage.length === 0) {
        return null;
    }
    
    // Определяем, используем ли ставки для 20' или 40' контейнера
    const is20ft = containerType.includes('20');
    const is40ft = containerType.includes('40');
    
    // Ищем первый диапазон хранения (самый дешевый/бесплатный)
    const firstStorageRange = terminalInfo.storage[0];
    
    if (firstStorageRange) {
        // Определяем бесплатные дни (с 0 по X дней)
        // Количество свободных дней = from_days - 1
        const freeDays = firstStorageRange.from_days - 1;
        // Платное хранение начинается с from_days суток
        const paidStorageStarts = firstStorageRange.from_days;
        
        // Получаем ставку за хранение
        let storageRate = 0;
        if (is20ft && firstStorageRange.rate20 > 0) {
            storageRate = firstStorageRange.rate20;
        } else if (is40ft && firstStorageRange.rate40 > 0) {
            storageRate = firstStorageRange.rate40;
        }
        
        return {
            freeDays: freeDays,
            paidStorageStarts: paidStorageStarts,
            storageRate: storageRate,
            containerType: containerType
        };
    }
    
    return null;
}

// Генерация дополнительной информации с динамическими данными
function generateAdditionalInfo(transportType, data, storageInfo, terminalInfo, components) {
    console.log('🔍 Генерация дополнительной информации:', {
        transportType,
        hasData: !!data,
        hasStorageInfo: !!storageInfo,
        hasTerminalInfo: !!terminalInfo,
        storageInfo: storageInfo,
        terminalInfo: terminalInfo ? {
            name: terminalInfo.terminal,
            hasStorage: !!terminalInfo.storage,
            storageLength: terminalInfo.storage?.length || 0
        } : 'нет'
    });
    let containerTypeDisplay = '';
    if (transportType === 'sea_rail') {
        containerTypeDisplay = getContainerTypeDisplayName(data.sea?.containerType || 'hc_40');
    } else if (transportType === 'direct_sea' || transportType === 'sea') {
        containerTypeDisplay = getContainerTypeDisplayName(data.containerType || 'hc_40');
    } else if (transportType === 'direct_rail' || transportType === 'rail') {
        containerTypeDisplay = getContainerTypeDisplayName(data.containerType || 'container40');
    }
    
    // Определяем бесплатные дни хранения
    const freeStorageDays = storageInfo ? storageInfo.freeDays : 7; // По умолчанию 7 дней (from_days - 1)
    const paidStorageStart = storageInfo ? storageInfo.paidStorageStarts : 8; // По умолчанию с 8-х суток (from_days)
    const storageRate = storageInfo ? storageInfo.storageRate : 0;
    
    // Определяем ставку за сверхнормативное пользование контейнером
    const containerOvertimeRate = containerTypeDisplay.includes('40') ? 20 : 10; // $20 для 40', $10 для 20'
    
    // Получаем информацию о СНП для морских перевозок
    let agentInfo = null;
    if (transportType === 'sea_rail') {
        agentInfo = getAgentInfo('sea', data.sea || data);
        console.log('🔍 Информация о СНП для моря+жд:', agentInfo);
    } else if (transportType === 'direct_sea' || transportType === 'sea') {
        agentInfo = getAgentInfo(transportType, data);
        console.log('🔍 Информация о СНП для моря:', agentInfo);
    } else if (transportType === 'direct_rail' || transportType === 'rail') {
        agentInfo = getAgentInfo(transportType, data);
        console.log('🔍 Информация о СНП для жд:', agentInfo);
    }
    
    let infoHTML = '';
    
    if (transportType === 'sea_rail') {
        // Добавляем пункт "Оформление ВТТ" если ВТТ включен
        const vttIncluded = data.vttIncluded || false;
        const vttItem = vttIncluded ? '<li>Оформление ВТТ.</li>' : '';
        
        infoHTML = `
            <div class="additional-info" style="margin-top: 20px; font-size: 12px; color: #555;">
                <p><strong>Ставка применима для неопасного груза, весом не более 1500 кг/место</strong></p>
                <p><strong>В ставки включено:</strong></p>
                <ul>
                    <li>Предоставление порожнего в порту отправления</li>
                    <li>Морской фрахт FILO ${escapeHtml(data.sea?.pol || '')} - ${escapeHtml(data.sea?.pod || '')}</li>
                    <li>Терминальные услуги в порту прибытия (ПРР с моря на ЖД)</li>
                    <li>${escapeHtml(freeStorageDays)} дней хранения в порту.</li>
                    ${vttItem}
                    <li>ЖД перевозка ${escapeHtml(data.rail?.city || '')} - ${escapeHtml(data.rail?.destination || '')}</li>
                </ul>
                <p><strong>В ставки не включено:</strong></p>
                <ul>
                    <li>Таможенное оформление в порту прибытия</li>
                    <li>Доп расходы в порту, вызванные требованиями таможни (МИДК, взвешивание, досмотр груза)</li>
                    <li>Сверхнормативное хранение в порту по тарифам порта, в зависимости от направления выдачи (с ${escapeHtml(paidStorageStart)} суток)</li>
                    <li>Охрана в пути следования по ЖД</li>
                </ul>
                <p><strong>Примечания:</strong></p>
                <ul>
                    <li>Ставка фиксируется на дату выхода судна</li>
                    <li>Ставка по ЖД фиксируется на дату отправки контейнера по ЖД (НДС 0%)</li>
                    <li>Ставки даны для неопасного груза${data.sea?.dateOfValidity ? `, Валидность по ${escapeHtml(data.sea.dateOfValidity)}` : ''}</li>
                    ${agentInfo && agentInfo.snp ? `<li>СНП (сверхнормативное пользование контейнером): ${escapeHtml(agentInfo.snp)}</li>` : ''}
                </ul>
            </div>
        `;
    } else if (transportType === 'direct_sea' || transportType === 'sea') {
        infoHTML = `
            <div class="additional-info" style="margin-top: 20px; font-size: 12px; color: #555;">
                <p><strong>Ставка применима для неопасного груза, весом не более 1500 кг/место</strong></p>
                <p><strong>В ставки включено:</strong></p>
                <ul>
                    <li>Предоставление порожнего в порту отправления</li>
                    <li>Морской фрахт FILO ${escapeHtml(data.pol || '')} - ${escapeHtml(data.pod || '')}</li>
                    <li>Терминальные услуги в порту прибытия</li>
                    <li>${escapeHtml(freeStorageDays)} дней хранения в порту (в зависимости от тарифа на хранение в порту). Т.е. если у нас хранение для данного типа контейнера в данном порту начинается с ${escapeHtml(paidStorageStart)} суток, то ${escapeHtml(freeStorageDays)} дней хранения бесплатных</li>
                    <li>Пользование контейнером 40 сут с момента прибытия в порт назначения</li>
                </ul>
                <p><strong>В ставки не включено:</strong></p>
                <ul>
                    <li>Таможенное оформление в порту прибытия</li>
                    <li>Доп расходы в порту, вызванные требованиями таможни (МИДК, взвешивание, досмотр груза)</li>
                    <li>Сверхнормативное хранение в порту по тарифам порта, в зависимости от направления выдачи (с ${escapeHtml(paidStorageStart)} суток)</li>
                    <li>Сверхнормативное пользование контейнером с 41-х суток</li>
                </ul>
                <p><strong>Примечания:</strong></p>
                <ul>
                    <li>Ставка фиксируется на дату выхода судна</li>
                    <li>Ставки даны для неопасного груза${data.dateOfValidity ? `, Валидность по ${escapeHtml(data.dateOfValidity)}` : ''}</li>
                    ${agentInfo && agentInfo.snp ? `<li>СНП (сверхнормативное пользование контейнером): ${escapeHtml(agentInfo.snp)}</li>` : ''}
                </ul>
            </div>
        `;
    } else if (transportType === 'direct_rail' || transportType === 'rail') {
        infoHTML = `
            <div class="additional-info" style="margin-top: 20px; font-size: 12px; color: #555;">
                <p><strong>Ставка применима для неопасного груза, весом не более 1500 кг/место</strong></p>
                <p><strong>В ставки включено:</strong></p>
                <ul>
                    <li>Предоставление порожнего в пункте отправления</li>
                    <li>ЖД перевозка ${escapeHtml(transportType === 'direct_rail' ? data.fob || '' : data.city || '')} - ${escapeHtml(transportType === 'direct_rail' ? data.arrivalCity || '' : data.destination || '')}</li>
                    <li>Терминальные услуги в пункте прибытия</li>
                </ul>
                <p><strong>В ставки не включено:</strong></p>
                <ul>
                    <li>Таможенное оформление</li>
                    <li>Доп расходы, вызванные требованиями таможни (МИДК, взвешивание, досмотр груза)</li>
                    <li>Сверхнормативное хранение</li>
                    <li>Охрана в пути следования по ЖД</li>
                </ul>
                <p><strong>Примечания:</strong></p>
                <ul>
                    <li>Ставка по ЖД фиксируется на дату отправки контейнера по ЖД (НДС 0%)</li>
                    <li>Ставки даны для неопасного груза${data.dateOfValidity || data.validity ? `, Валидность по ${escapeHtml(data.dateOfValidity || data.validity || '')}` : ''}</li>
                    ${agentInfo && agentInfo.snp ? `<li>СНП (сверхнормативное пользование контейнером): ${escapeHtml(agentInfo.snp)}</li>` : ''}
                </ul>
            </div>
        `;
    }
    
    return infoHTML;
}

// 🔧 ДОПОЛНИТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ УЛУЧШЕНИЯ ПОИСКА ТЕРМИНАЛА
function normalizeTerminalName(terminalName) {
    if (!terminalName) return '';
    
    // Приводим к нижнему регистру и удаляем лишние пробелы
    const normalized = terminalName.trim().toLowerCase();
    
    // Удаляем общие слова, которые могут мешать поиску
    const commonWords = ['terminal', 'терминал', 'порт', 'port', 'станция', 'station'];
    let result = normalized;
    
    commonWords.forEach(word => {
        result = result.replace(new RegExp(`\\b${word}\\b`, 'g'), '').trim();
    });
    
    return result || normalized;
}

// 🔧 УЛУЧШЕННАЯ ФУНКЦИЯ КОПИРОВАНИЯ РЕЗУЛЬТАТА (БЕЗ ДЕТАЛЕЙ СТОИМОСТИ)
function copyMarginResult() {
    try {
        // 1. Получаем все элементы для копирования
        const marginResultContainer = document.getElementById('margin-result-container');
        
        if (!marginResultContainer) {
            throw new Error('Контейнер результатов не найден');
        }
        
        // 2. Подготавливаем данные в нескольких форматах
        const content = prepareMarginContentForCopy(marginResultContainer);
        
        // 3. Пробуем скопировать с HTML форматом (сохраняет таблицы)
        copyWithHTMLFormat(content.html).then(() => {
            showCopySuccess('copy-result');
        }).catch(async (htmlError) => {
            console.log('HTML копирование не удалось, пробуем plain text:', htmlError);
            
            // 4. Fallback: копируем как plain text
            try {
                await navigator.clipboard.writeText(content.text);
                showCopySuccess('copy-result');
            } catch (textError) {
                console.log('Clipboard API не доступен, используем fallback:', textError);
                
                // 5. Старый способ копирования
                copyWithFallbackMethod(content.text, 'copy-result');
            }
        });
        
    } catch (error) {
        console.error('Ошибка копирования:', error);
        showCopyError('copy-result');
    }
}

// 🔧 ПОДГОТОВКА КОНТЕНТА ДЛЯ КОПИРОВАНИЯ (БЕЗ ИНФОРМАЦИИ О СТОИМОСТИ)
function prepareMarginContentForCopy(resultContainer) {
    // 1. Подготавливаем таблицу (только услуги и ставки)
    const tableElement = resultContainer.querySelector('table.margin-table');
    let tableHTML = '';
    let tableText = '';
    
    if (tableElement) {
        // HTML версия таблицы (сохраняет форматирование)
        tableHTML = cleanTableHTML(tableElement.outerHTML);
        
        // Текстовая версия с табуляцией (для Excel)
        tableText = convertTableToTabDelimited(tableElement);
    }
    
    // 2. Подготавливаем дополнительную информацию (условия, примечания)
    const additionalInfo = resultContainer.querySelector('.additional-info');
    let additionalHTML = '';
    let additionalText = '';
    
    if (additionalInfo) {
        // Убираем возможные дублирующиеся заголовки из дополнительной информации
        additionalHTML = cleanAdditionalInfoHTML(additionalInfo.innerHTML);
        additionalText = cleanAdditionalInfoText(additionalInfo.innerText);
    }
    
    // 3. Подготавливаем ВТТ информацию (если есть)
    const vttSection = resultContainer.querySelector('.vtt-section');
    let vttHTML = '';
    let vttText = '';
    
    if (vttSection) {
        vttHTML = vttSection.innerHTML;
        vttText = vttSection.innerText;
    }
    
    // 4. Формируем полный HTML контент (только таблица и условия)
    const fullHTML = `
        <div style="font-family: Arial, sans-serif; font-size: 12px; max-width: 800px;">
            ${tableHTML ? `
            <div style="margin: 10px 0; overflow-x: auto;">
                ${tableHTML}
            </div>
            ` : ''}
            
            ${vttHTML ? `
            <div style="margin: 10px 0; padding: 8px; background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px;">
                ${vttHTML}
            </div>
            ` : ''}
            
            ${additionalHTML ? `
            <div style="margin-top: 15px; padding: 12px; background-color: #f8f9fa; border-radius: 6px; border: 1px solid #dee2e6;">
                ${additionalHTML}
            </div>
            ` : ''}
            
            <div style="margin-top: 15px; padding-top: 8px; border-top: 1px dashed #ccc; color: #6c757d; font-size: 11px;">
                <p>Курс ЦБ РФ: 1 USD = ${escapeHtml(usdToRubRate || 'Не загружен')} RUB</p>
            </div>
        </div>
    `;
    
    // 5. Формируем текстовую версию (только таблица и условия)
    const fullText = `
${tableText ? tableText + '\n' : ''}
${vttText ? vttText + '\n' : ''}
${additionalText ? additionalText + '\n' : ''}
---
Курс ЦБ РФ: 1 USD = ${escapeHtml(usdToRubRate || 'Не загружен')} RUB
    `.trim();
    
    // Сохраняем оба формата в глобальной переменной
    window.marginTableText = fullText;
    window.marginTableHTML = fullHTML;
    
    return {
        html: fullHTML,
        text: fullText
    };
}

// 🔧 ОЧИСТКА HTML ТАБЛИЦЫ (убираем лишние стили и классы)
function cleanTableHTML(tableHTML) {
    // Упрощаем таблицу для копирования
    return tableHTML
        .replace(/class="[^"]*"/g, '') // Убираем классы
        .replace(/style="[^"]*"/g, '') // Убираем inline стили
        .replace(/<tbody>/g, '')
        .replace(/<\/tbody>/g, '')
        .replace(/<thead>/g, '')
        .replace(/<\/thead>/g, '')
        .replace(/\s+/g, ' ') // Убираем лишние пробелы
        .trim();
}

// 🔧 ОЧИСТКА HTML ДОПОЛНИТЕЛЬНОЙ ИНФОРМАЦИИ
function cleanAdditionalInfoHTML(html) {
    // Убираем заголовки, которые уже есть в таблице
    return html
        .replace(/<strong>Ставка применима для неопасного груза, весом не более 1500 кг\/место<\/strong>/g, '')
        .replace(/<p><strong>В ставки включено:<\/strong><\/p>/g, '<p><strong>В ставки включено:</strong></p>')
        .replace(/<p><strong>В ставки не включено:<\/strong><\/p>/g, '<p><strong>В ставки не включено:</strong></p>')
        .replace(/<p><strong>Примечания:<\/strong><\/p>/g, '<p><strong>Примечания:</strong></p>')
        .trim();
}

// 🔧 ОЧИСТКА ТЕКСТА ДОПОЛНИТЕЛЬНОЙ ИНФОРМАЦИИ
function cleanAdditionalInfoText(text) {
    // Убираем возможные дублирующиеся строки
    const lines = text.split('\n').filter(line => {
        // Убираем пустые строки и строки с маршрутом/стоимостью
        const trimmedLine = line.trim();
        return trimmedLine.length > 0 && 
               !trimmedLine.startsWith('Маршрут:') &&
               !trimmedLine.startsWith('Стоимость фрахта:') &&
               !trimmedLine.startsWith('Стоимость ЖД перевозки:') &&
               !trimmedLine.startsWith('Общая стоимость:') &&
               !trimmedLine.startsWith('Расчет стоимости перевозки');
    });
    
    return lines.join('\n');
}

// 🔧 КОНВЕРТАЦИЯ ТАБЛИЦЫ В ТАБУЛИРОВАННЫЙ ТЕКСТ
function convertTableToTabDelimited(tableElement) {
    const rows = tableElement.querySelectorAll('tr');
    let result = '';
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td, th');
        const rowData = Array.from(cells).map(cell => {
            // Очищаем текст
            let text = cell.textContent.trim();
            text = text.replace(/\t/g, ' ') // Заменяем табы в тексте
                      .replace(/\n/g, ' ')  // Заменяем переносы строк
                      .replace(/\s+/g, ' '); // Убираем лишние пробелы
            return text;
        });
        
        // Добавляем строку, только если есть данные
        if (rowData.some(cell => cell.length > 0)) {
            result += rowData.join('\t') + '\n';
        }
    });
    
    return result.trim();
}

// 🔧 КОПИРОВАНИЕ С HTML ФОРМАТОМ (без изменений)
function copyWithHTMLFormat(htmlContent) {
    return new Promise((resolve, reject) => {
        try {
            // Создаем временный div
            const tempDiv = document.createElement('div');
            tempDiv.style.position = 'absolute';
            tempDiv.style.left = '-9999px';
            tempDiv.innerHTML = htmlContent;
            document.body.appendChild(tempDiv);
            
            // Выделяем содержимое
            const range = document.createRange();
            range.selectNode(tempDiv);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            
            // Пытаемся скопировать
            const successful = document.execCommand('copy');
            
            // Очищаем
            selection.removeAllRanges();
            document.body.removeChild(tempDiv);
            
            if (successful) {
                resolve();
            } else {
                reject(new Error('execCommand не сработал'));
            }
        } catch (error) {
            reject(error);
        }
    });
}

// 🔧 FALLBACK МЕТОД КОПИРОВАНИЯ (без изменений)
function copyWithFallbackMethod(text, buttonId) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showCopySuccess(buttonId);
        } else {
            showCopyError(buttonId);
        }
    } catch (err) {
        console.error('Fallback копирование не удалось:', err);
        showCopyError(buttonId);
    } finally {
        document.body.removeChild(textArea);
    }
}

// 🔧 ПОКАЗАТЬ УСПЕШНОЕ КОПИРОВАНИЕ (без изменений)
function showCopySuccess(buttonId) {
    const copyButton = document.getElementById(buttonId);
    if (!copyButton) return;
    
    const originalHTML = copyButton.innerHTML;
    const originalBackground = copyButton.style.backgroundColor;
    const originalColor = copyButton.style.color;
    
    // Временно меняем вид кнопки
    copyButton.innerHTML = '✅ Скопировано!';
    copyButton.style.backgroundColor = '#4CAF50';
    copyButton.style.color = 'white';
    copyButton.disabled = true;
    
    // Возвращаем исходный вид через 2 секунды
    setTimeout(() => {
        copyButton.innerHTML = originalHTML;
        copyButton.style.backgroundColor = originalBackground;
        copyButton.style.color = originalColor;
        copyButton.disabled = false;
    }, 2000);
}

// 🔧 ПОКАЗАТЬ ОШИБКУ КОПИРОВАНИЯ (без изменений)
function showCopyError(buttonId) {
    const copyButton = document.getElementById(buttonId);
    if (!copyButton) return;
    
    const originalHTML = copyButton.innerHTML;
    
    copyButton.innerHTML = '❌ Ошибка!';
    copyButton.style.backgroundColor = '#f44336';
    copyButton.style.color = 'white';
    copyButton.disabled = true;
    
    setTimeout(() => {
        copyButton.innerHTML = originalHTML;
        copyButton.style.backgroundColor = '';
        copyButton.style.color = '';
        copyButton.disabled = false;
    }, 2000);
}
