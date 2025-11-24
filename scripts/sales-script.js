// 🎯 ОСНОВНОЙ ФАЙЛ ДЛЯ МЕНЕДЖЕРА ПО ПРОДАЖАМ

// Глобальные переменные
let currentRole = 'sales';
let currentDatabase = '';
let currentCalculationType = 'separate'; // 'separate' или 'complex'
let database = {
    sea: [],
    rail: [],
    direct_rail: [],
    direct_sea: [],
    tariff: []
};

// Курс ЦБ РФ
let usdToRubRate = null;

// Флаг для весовой категории 20-футовых контейнеров
let is20ftOver24Tons = false;

// Флаг для триггера ВТТ (море POD = жд агент)
let isVTTTrigger = false;

// Функция для нормализации названий городов
function normalizeCityName(city) {
    if (!city) return city;
    
    const normalized = city.trim().toUpperCase();
    
    // Нормализация для Санкт-Петербурга
    if (normalized === 'STP' || normalized === 'SPB' || normalized === 'ST.PETERSBURG' ||
        normalized === 'SAINT PETERSBURG' || normalized === 'ST. PETERSBURG') {
        return 'St. Petersburg';
    }
    
    // Нормализация для Москвы
    if (normalized === 'MOW' || normalized === 'MSK') {
        return 'Moscow';
    }
    
    // Нормализация для Тольятти
    if (normalized === 'ТОЛЬЯТТИ' || normalized === 'TOLYATTI') {
        return 'Tolyatti';
    }
    
    // Возвращаем оригинальное название с правильным регистром
    return city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
}

// Функции для управления интерфейсом
function selectCalculationType(type) {
    currentCalculationType = type;
    
    if (type === 'separate') {
        // Показываем выбор типа базы данных для отдельных ставок
        document.getElementById('calculation-type-selection').classList.add('hidden');
        document.getElementById('database-selection').classList.remove('hidden');
    } else {
        // Показываем интерфейс комплексного расчета
        document.getElementById('calculation-type-selection').classList.add('hidden');
        document.getElementById('sales-interface').classList.remove('hidden');
        resetCalculatorForm();
        setupCalculator();
        Utils.showLastUpdate('complex', 'last-update');
    }
}

function selectDatabase(dbType) {
    currentDatabase = dbType;
    console.log('🎯 Выбран тип базы данных:', dbType);
    
    document.getElementById('database-selection').classList.add('hidden');
    
    // Синхронизируем данные с сервером при каждом входе
    loadDatabaseData().then(() => {
        console.log('🔧 Открываем интерфейс продаж для менеджера');
        document.getElementById('sales-separate-interface').classList.remove('hidden');
        resetCalculatorForm();
        setupCalculator();
        Utils.showLastUpdate(currentDatabase, 'last-update-separate');
    });
}

function goBack() {
    console.log('🔙 Нажата кнопка "Назад":', { currentDatabase, currentCalculationType });
    
    if (currentDatabase) {
        // Возврат из отдельных ставок к выбору типа базы данных
        console.log('🔙 Возврат из отдельных ставок к выбору типа базы данных');
        resetCalculatorForm();
        currentDatabase = '';
        document.getElementById('sales-separate-interface').classList.add('hidden');
        document.getElementById('database-selection').classList.remove('hidden');
    } else if (currentCalculationType === 'complex') {
        // Возврат из комплексного расчета к выбору типа расчета
        console.log('🔙 Возврат из комплексного расчета к выбору типа расчета');
        resetCalculatorForm();
        currentCalculationType = '';
        document.getElementById('sales-interface').classList.add('hidden');
        document.getElementById('calculation-type-selection').classList.remove('hidden');
    } else if (document.getElementById('database-selection').classList.contains('hidden') === false) {
        // Возврат из выбора типа базы данных к выбору типа расчета
        console.log('🔙 Возврат из выбора типа базы данных к выбору типа расчета');
        document.getElementById('database-selection').classList.add('hidden');
        document.getElementById('calculation-type-selection').classList.remove('hidden');
    } else {
        // Возврат к выбору типа расчета (уже показан)
        console.log('🔙 Уже в выборе типа расчета');
    }
    
    console.log('✅ После нажатия "Назад":', { currentDatabase, currentCalculationType });
}

function resetCalculatorForm() {
    // Очищаем все поля формы
    const inputs = document.querySelectorAll('input[type="text"], input[type="number"], select');
    inputs.forEach(input => {
        input.value = '';
    });
    
    // Сбрасываем чекбоксы
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    
    // Скрываем результаты
    const results = document.querySelectorAll('.results-section');
    results.forEach(result => {
        result.classList.add('hidden');
    });
    
    // Очищаем таблицы результатов
    const tables = document.querySelectorAll('.rates-table');
    tables.forEach(table => {
        table.innerHTML = '';
    });
    
    // Закрываем выпадающие списки
    const dropdowns = document.querySelectorAll('.custom-dropdown');
    dropdowns.forEach(dropdown => {
        dropdown.classList.remove('active');
        dropdown.innerHTML = '';
    });
    
    // Сбрасываем флаги
    is20ftOver24Tons = false;
    isVTTTrigger = false;
}

function resetComplexForm() {
    document.getElementById('complex-departure').value = '';
    document.getElementById('complex-destination').value = '';
    document.getElementById('complex-container-type').value = '';
    document.getElementById('weight-over-24').checked = false;
    document.getElementById('vtt-trigger').checked = false;
    is20ftOver24Tons = false;
    isVTTTrigger = false;
    
    document.getElementById('results').classList.add('hidden');
    document.getElementById('rates-table').innerHTML = '';
    
    const dropdowns = document.querySelectorAll('.custom-dropdown');
    dropdowns.forEach(dropdown => {
        dropdown.classList.remove('active');
        dropdown.innerHTML = '';
    });
}

// Функции для менеджера по продажам
function setupCalculator() {
    loadDatabaseData();
    
    console.log('🔧 Настройка калькулятора:', {
        calculationType: currentCalculationType,
        database: currentDatabase
    });
    
    if (currentCalculationType === 'complex') {
        showComplexFields();
        setupComplexAutocomplete();
    } else {
        showCorrectFields();
        setupAutocomplete();
    }
}

function showComplexFields() {
    // Скрываем все отдельные поля и показываем комплексные
    const separateInterface = document.getElementById('sales-separate-interface');
    const complexInterface = document.getElementById('sales-interface');
    
    if (separateInterface) separateInterface.classList.add('hidden');
    if (complexInterface) complexInterface.classList.remove('hidden');
    
    console.log('🔧 Показаны поля комплексного расчета, скрыты отдельные поля');
}

function showCorrectFields() {
    const seaFields = document.getElementById('sea-fields');
    const directRailFields = document.getElementById('direct-rail-fields');
    const directSeaFields = document.getElementById('direct-sea-fields');
    const railFields = document.getElementById('rail-fields');
    const dropOffAreaField = document.getElementById('drop-off-area-container');
    const seaContainerTypeSelect = document.getElementById('sea-container-type');
    const directSeaContainerTypeSelect = document.getElementById('direct-sea-container-type');
    const railContainerTypeSelect = document.getElementById('rail-container-type');
    
    // Сначала скрываем все поля
    seaFields.classList.add('hidden');
    directRailFields.classList.add('hidden');
    directSeaFields.classList.add('hidden');
    if (railFields) railFields.classList.add('hidden');
    
    if (currentDatabase === 'direct_rail') {
        directRailFields.classList.remove('hidden');
    } else if (currentDatabase === 'direct_sea') {
        directSeaFields.classList.remove('hidden');
        updateContainerTypesForDirectSea(directSeaContainerTypeSelect);
    } else if (currentDatabase === 'rail') {
        if (railFields) railFields.classList.remove('hidden');
        updateContainerTypesForRail(railContainerTypeSelect);
    } else {
        // Обычное море
        seaFields.classList.remove('hidden');
        if (dropOffAreaField) {
            dropOffAreaField.classList.remove('hidden');
        }
        updateContainerTypesForSea(seaContainerTypeSelect);
    }
}

function updateContainerTypesForDirectSea(selectElement) {
    selectElement.innerHTML = `
        <option value="">Выберите тип</option>
        <option value="dc_20">20'DC</option>
        <option value="hc_40">40'HC</option>
    `;
}

function updateContainerTypesForSea(selectElement) {
    selectElement.innerHTML = `
        <option value="">Выберите тип</option>
        <option value="soc_20">SOC 20'</option>
        <option value="soc_40">SOC 40'</option>
        <option value="dc_20">20'DC FILO</option>
        <option value="hc_40">40'HC FILO</option>
    `;
}

function updateContainerTypesForRail(selectElement) {
    selectElement.innerHTML = `
        <option value="">Выберите тип</option>
        <option value="container20Under24">20фут ктк (до 24т)</option>
        <option value="container20Over24">20фут ктк (24-28т)</option>
        <option value="container40">40фут ктк</option>
    `;
}

function updateContainerTypesForComplex(selectElement) {
    selectElement.innerHTML = `
        <option value="">Выберите тип</option>
        <option value="dc_20">20'DC</option>
        <option value="hc_40">40'HC</option>
    `;
}

function setupAutocomplete() {
    const data = database[currentDatabase];
    if (!data || data.length === 0) {
        console.warn(`⚠️ Нет данных для базы ${currentDatabase}`);
        return;
    }
    
    console.log(`🔧 Настройка автозаполнения для ${currentDatabase}: ${data.length} записей`);
    
    if (currentDatabase === 'direct_rail') {
        // 🎯 ИСПОЛЬЗУЕМ УЛУЧШЕННУЮ ЛОГИКУ ДЛЯ ПРЯМОГО ЖД
        if (window.DirectRailModule && window.DirectRailModule.setupEnhancedDirectRailChainUpdate) {
            DirectRailModule.setupEnhancedDirectRailChainUpdate(data);
            setupSeparateRatesHandlers('direct_rail');
        } else {
            console.error('❌ DirectRailModule не доступен');
            setupFallbackDropdowns(data, 'direct_rail');
        }
    } else if (currentDatabase === 'direct_sea') {
        // 🎯 ИСПОЛЬЗУЕМ УЛУЧШЕННУЮ ЛОГИКУ ДЛЯ ПРЯМОГО МОРЯ
        if (window.DirectSeaModule && window.DirectSeaModule.setupEnhancedDirectSeaChainUpdate) {
            // Передаем правильные ID для прямого моря
            const polInput = document.getElementById('direct-sea-pol');
            const podInput = document.getElementById('direct-sea-pod');
            const containerTypeSelect = document.getElementById('direct-sea-container-type');
            
            if (polInput && podInput && containerTypeSelect) {
                // Создаем временную функцию для прямого моря с правильными ID
                const setupDirectSeaWithCorrectIds = function(data) {
                    const enhancedDirectSeaSearchEngine = new window.DirectSeaModule.EnhancedDirectSeaSearchEngine(data);
                    
                    // Обновляем интерфейс с правильными ID
                    function updateInterface() {
                        const selectedPOL = polInput.value.trim();
                        const selectedPOD = podInput.value.trim();
                        
                        // Обновляем POL
                        const availablePOL = enhancedDirectSeaSearchEngine.getPOLWithRates();
                        if (window.Utils && window.Utils.setupCustomDropdown) {
                            window.Utils.setupCustomDropdown('direct-sea-pol', availablePOL);
                        }
                        
                        // Обновляем POD на основе выбранного POL
                        let availablePOD = [];
                        if (selectedPOL) {
                            availablePOD = enhancedDirectSeaSearchEngine.getPODWithRatesForPOL(selectedPOL);
                        }
                        if (window.Utils && window.Utils.setupCustomDropdown) {
                            window.Utils.setupCustomDropdown('direct-sea-pod', availablePOD);
                        }
                        
                        // Обновляем типы контейнеров
                        if (selectedPOL && selectedPOD) {
                            const availableContainers = enhancedDirectSeaSearchEngine.getAvailableContainersWithRates(selectedPOL, selectedPOD);
                            updateContainerTypeDropdown(containerTypeSelect, availableContainers);
                        } else {
                            resetContainerTypeDropdown(containerTypeSelect);
                        }
                    }
                    
                    // Настраиваем обработчики событий
                    polInput.addEventListener('input', updateInterface);
                    polInput.addEventListener('change', function() {
                        podInput.value = '';
                        containerTypeSelect.value = '';
                        updateInterface();
                    });
                    
                    podInput.addEventListener('input', updateInterface);
                    podInput.addEventListener('change', function() {
                        containerTypeSelect.value = '';
                        updateInterface();
                    });
                    
                    // Инициализируем интерфейс
                    updateInterface();
                };
                
                setupDirectSeaWithCorrectIds(data);
                setupSeparateRatesHandlers('direct_sea');
            } else {
                console.error('❌ Не найдены элементы DOM для прямого моря');
                setupFallbackDropdowns(data, 'direct_sea');
            }
        } else {
            console.error('❌ DirectSeaModule не доступен');
            setupFallbackDropdowns(data, 'direct_sea');
        }
    } else if (currentDatabase === 'sea') {
        // 🎯 ИСПОЛЬЗУЕМ УЛУЧШЕННУЮ ЛОГИКУ ДЛЯ МОРЯ
        if (window.SeaModule && window.SeaModule.setupEnhancedSeaChainUpdate) {
            SeaModule.setupEnhancedSeaChainUpdate(data);
            setupSeparateRatesHandlers('sea');
        } else {
            console.error('❌ SeaModule не доступен');
            setupFallbackDropdowns(data, 'sea');
        }
    } else if (currentDatabase === 'rail') {
        // 🎯 ИСПОЛЬЗУЕМ УЛУЧШЕННУЮ ЛОГИКУ ДЛЯ ЖД ПЕРЕВОЗОК
        if (window.RailModule && window.RailModule.setupEnhancedRailChainUpdate) {
            RailModule.setupEnhancedRailChainUpdate(data);
            setupSeparateRatesHandlers('rail');
        } else {
            console.error('❌ RailModule не доступен');
            setupFallbackDropdowns(data, 'rail');
        }
    } else {
        // Старая логика для других типов
        setupFallbackDropdowns(data, currentDatabase);
    }
}

// 🔧 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ УПРАВЛЕНИЯ КОНТЕЙНЕРАМИ
function updateContainerTypeDropdown(selectElement, availableContainers) {
    if (!selectElement) return;
    
    selectElement.innerHTML = '<option value="">Выберите тип контейнера</option>';
    
    let hasAvailableContainers = false;
    
    if (availableContainers['dc_20']) {
        const option = document.createElement('option');
        option.value = 'dc_20';
        option.textContent = '20\'DC';
        selectElement.appendChild(option);
        hasAvailableContainers = true;
    }
    
    if (availableContainers['hc_40']) {
        const option = document.createElement('option');
        option.value = 'hc_40';
        option.textContent = '40\'HC';
        selectElement.appendChild(option);
        hasAvailableContainers = true;
    }
    
    if (hasAvailableContainers) {
        selectElement.disabled = false;
        console.log('✅ Типы контейнеров доступны для выбора');
    } else {
        selectElement.innerHTML = '<option value="">Нет доступных контейнеров для выбранного маршрута</option>';
        selectElement.disabled = true;
        console.log('⚠️ Нет доступных типов контейнеров для выбранного маршрута');
    }
}

function resetContainerTypeDropdown(selectElement) {
    if (!selectElement) return;
    
    selectElement.innerHTML = `
        <option value="">Выберите тип</option>
        <option value="dc_20">20'DC</option>
        <option value="hc_40">40'HC</option>
    `;
    selectElement.disabled = false;
}

// 🔧 ФУНКЦИЯ ДЛЯ РЕЗЕРВНОЙ НАСТРОЙКИ DROPDOWN
function setupFallbackDropdowns(data, dbType) {
    console.log(`🔧 Используем резервную настройку dropdown для ${dbType}`);
    
    if (dbType === 'direct_rail') {
        const fobValues = [...new Set(data.map(item => item.fob).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        const arrivalCityValues = [...new Set(data.map(item => item.arrivalCity).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        
        Utils.setupCustomDropdown('direct-rail-fob', fobValues);
        Utils.setupCustomDropdown('direct-rail-arrival-city', arrivalCityValues);
    } else if (dbType === 'direct_sea') {
        const polValues = [...new Set(data.map(item => item.pol).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        const podValues = [...new Set(data.map(item => item.pod).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        
        Utils.setupCustomDropdown('direct-sea-pol', polValues);
        Utils.setupCustomDropdown('direct-sea-pod', podValues);
    } else if (dbType === 'sea') {
        const polValues = [...new Set(data.map(item => item.pol).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        const podValues = [...new Set(data.map(item => item.pod).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        const dropOffAreaValues = [...new Set(data.map(item => item.dropOffArea).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        
        Utils.setupCustomDropdown('sea-pol', polValues);
        Utils.setupCustomDropdown('sea-pod', podValues);
        Utils.setupCustomDropdown('sea-drop-off-area', dropOffAreaValues);
    } else if (dbType === 'rail') {
        const cityValues = [...new Set(data.map(item => item.city).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        const destinationValues = [...new Set(data.map(item => item.destination).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        
        Utils.setupCustomDropdown('rail-city', cityValues);
        Utils.setupCustomDropdown('rail-destination', destinationValues);
    }
}

// Функция для настройки обработчиков событий для отдельных ставок
function setupSeparateRatesHandlers(databaseType) {
    console.log('🔧 Настройка обработчиков для отдельных ставок:', databaseType);
    
    if (databaseType === 'sea') {
        const containerTypeSelect = document.getElementById('sea-container-type');
        if (containerTypeSelect) {
            containerTypeSelect.addEventListener('change', function() {
                const pol = document.getElementById('sea-pol').value;
                const pod = document.getElementById('sea-pod').value;
                const dropOffArea = document.getElementById('sea-drop-off-area').value;
                const containerType = this.value;
                
                if (pol && pod && dropOffArea && containerType) {
                    console.log('🎯 Расчет морских ставок:', { pol, pod, dropOffArea, containerType });
                    const result = searchSeaRates(pol, pod, dropOffArea, containerType);
                    if (result.success) {
                        displaySeaRates(result.data, containerType);
                    } else {
                        console.error('❌ Ошибка поиска ставок:', result.error);
                        const table = document.getElementById('rates-table-separate');
                        const resultsSection = document.getElementById('results-separate');
                        if (table && resultsSection) {
                            table.innerHTML = `<p style="color: red; text-align: center;">${result.error}</p>`;
                            resultsSection.classList.remove('hidden');
                        }
                    }
                }
            });
        }
    } else if (databaseType === 'rail') {
        const containerTypeSelect = document.getElementById('rail-container-type');
        if (containerTypeSelect) {
            containerTypeSelect.addEventListener('change', function() {
                const city = document.getElementById('rail-city').value;
                const destination = document.getElementById('rail-destination').value;
                const containerType = this.value;
                
                if (city && destination && containerType) {
                    console.log('🎯 Расчет ЖД ставок:', { city, destination, containerType });
                    const filteredData = findRailRates(city, destination, containerType);
                    if (filteredData.length > 0) {
                        displayRailResults(filteredData, containerType);
                    } else {
                        console.error('❌ Ставки не найдены для выбранных параметров');
                        const table = document.getElementById('rates-table-separate');
                        const resultsSection = document.getElementById('results-separate');
                        if (table && resultsSection) {
                            table.innerHTML = '<p style="color: red; text-align: center;">Ставки не найдены для выбранных параметров</p>';
                            resultsSection.classList.remove('hidden');
                        }
                    }
                }
            });
        }
    } else if (databaseType === 'direct_rail') {
        // Для прямого ЖД нет отдельного выбора типа контейнера, используем 40'HC по умолчанию
        const fobInput = document.getElementById('direct-rail-fob');
        const arrivalCityInput = document.getElementById('direct-rail-arrival-city');
        
        if (fobInput && arrivalCityInput) {
            // Добавляем обработчики для автоматического поиска при изменении полей
            const searchHandler = function() {
                const fob = fobInput.value;
                const arrivalCity = arrivalCityInput.value;
                
                if (fob && arrivalCity) {
                    console.log('🎯 Расчет прямых ЖД ставок:', { fob, arrivalCity });
                    const result = searchDirectRailRates(fob, arrivalCity, 'hc_40');
                    if (result.success) {
                        displayDirectRailRates(result.data, 'hc_40');
                    } else {
                        console.error('❌ Ошибка поиска ставок:', result.error);
                        const table = document.getElementById('rates-table-separate');
                        const resultsSection = document.getElementById('results-separate');
                        if (table && resultsSection) {
                            table.innerHTML = `<p style="color: red; text-align: center;">${result.error}</p>`;
                            resultsSection.classList.remove('hidden');
                        }
                    }
                }
            };
            
            fobInput.addEventListener('change', searchHandler);
            arrivalCityInput.addEventListener('change', searchHandler);
        }
    } else if (databaseType === 'direct_sea') {
        const containerTypeSelect = document.getElementById('direct-sea-container-type');
        if (containerTypeSelect) {
            containerTypeSelect.addEventListener('change', function() {
                const pol = document.getElementById('direct-sea-pol').value;
                const pod = document.getElementById('direct-sea-pod').value;
                const containerType = this.value;
                
                if (pol && pod && containerType) {
                    console.log('🎯 Расчет прямых морских ставок:', { pol, pod, containerType });
                    const result = searchDirectSeaRates(pol, pod, containerType);
                    if (result.success) {
                        displayDirectSeaRates(result.data, containerType);
                    } else {
                        console.error('❌ Ошибка поиска ставок:', result.error);
                        const table = document.getElementById('rates-table-separate');
                        const resultsSection = document.getElementById('results-separate');
                        if (table && resultsSection) {
                            table.innerHTML = `<p style="color: red; text-align: center;">${result.error}</p>`;
                            resultsSection.classList.remove('hidden');
                        }
                    }
                }
            });
        }
    }
}

// Функции для отображения результатов отдельных ставок
function displaySeaRates(results, containerType) {
    const resultsSection = document.getElementById('results-separate');
    const ratesTable = document.getElementById('rates-table-separate');
    
    if (!results || results.length === 0) {
        ratesTable.innerHTML = `
            <div class="status-message error">
                Нет данных для выбранных параметров
            </div>
        `;
        resultsSection.classList.remove('hidden');
        return;
    }
    
    console.log('🔄 Отображение морских ставок для типа контейнера:', containerType);
    
    // 🔧 ФИЛЬТРУЕМ РЕЗУЛЬТАТЫ ПО ВЫБРАННОМУ ТИПУ КОНТЕЙНЕРА
    const filteredResults = results.filter(result => {
        const rate = getSeaRateByContainerType(result, containerType);
        return rate > 0; // Показываем только записи с ненулевой ставкой для выбранного типа
    });
    
    if (filteredResults.length === 0) {
        ratesTable.innerHTML = `
            <div class="status-message error">
                Нет ставок для выбранного типа контейнера: ${getContainerTypeDisplayName(containerType)}
            </div>
        `;
        resultsSection.classList.remove('hidden');
        return;
    }
    
    let tableHTML = `
        <div class="results-section">
            <h4>Результаты расчета морских перевозок</h4>
            <p><strong>Тип контейнера:</strong> ${getContainerTypeDisplayName(containerType)}</p>
            ${usdToRubRate ? `<div class="exchange-rate-info"><small>Курс ЦБ РФ: 1 USD = ${usdToRubRate} RUB</small></div>` : ''}
            <table>
                <thead>
                    <tr>
                        <th>POL</th>
                        <th>POD</th>
                        <th>DROP OFF AREA</th>
                        <th>Тип контейнера</th>
                        <th>Ставка ($)</th>
                        <th>Ставка (RUB)</th>
                        <th>Перевозчик</th>
                        <th>Агент</th>
                        <th>Дата действия</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    // 🔧 СОРТИРОВКА ПО СТАВКАМ ОТ МЕНЬШЕГО К БОЛЬШЕМУ ДЛЯ ВЫБРАННОГО ТИПА
    const sortedResults = [...filteredResults].sort((a, b) => {
        const rateA = getSeaRateByContainerType(a, containerType) || 0;
        const rateB = getSeaRateByContainerType(b, containerType) || 0;
        return rateA - rateB;
    });
    
    sortedResults.forEach((result, index) => {
        const rate = getSeaRateByContainerType(result, containerType);
        const rateInRub = usdToRubRate ? Math.round(rate * usdToRubRate) : 0;
        const containerTypeDisplay = getContainerTypeDisplayName(containerType);
        
        tableHTML += `
            <tr ondblclick="openMarginModal(${index})" style="cursor: pointer;">
                <td>${result.pol || '-'}</td>
                <td>${result.pod || '-'}</td>
                <td>${result.dropOffArea || '-'}</td>
                <td>${containerTypeDisplay}</td>
                <td>$${rate}</td>
                <td>${rateInRub > 0 ? rateInRub + ' RUB' : '-'}</td>
                <td>${result.carrier || '-'}</td>
                <td>${result.agent || '-'}</td>
                <td>${result.dateOfValidity || '-'}</td>
            </tr>
        `;
    });
    
    tableHTML += `
                </tbody>
            </table>
            <p style="margin-top: 10px; color: #666; font-size: 14px;">
                📊 Найдено ${sortedResults.length} ставок для типа "${getContainerTypeDisplayName(containerType)}", отсортировано по возрастанию цены
            </p>
        </div>
    `;
    
    ratesTable.innerHTML = tableHTML;
    resultsSection.classList.remove('hidden');
    console.log(`✅ Отображено ${sortedResults.length} ставок для типа контейнера: ${containerType}`);
}

// 🔧 ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ ОТОБРАЖАЕМОГО ИМЕНИ ТИПА КОНТЕЙНЕРА
function getContainerTypeDisplayName(containerType) {
    switch (containerType) {
        case 'soc_20': return 'SOC 20\'';
        case 'soc_40': return 'SOC 40\'';
        case 'dc_20': return '20\'DC FILO';
        case 'hc_40': return '40\'HC FILO';
        case 'dc_20_direct': return '20\'DC';
        case 'hc_40_direct': return '40\'HC';
        default: return containerType;
    }
}

function displayRailResults(results) {
    const resultsSection = document.getElementById('results-separate');
    const ratesTable = document.getElementById('rates-table-separate');
    
    if (!results || results.length === 0) {
        ratesTable.innerHTML = `
            <div class="status-message error">
                Нет данных для выбранных параметров
            </div>
        `;
        resultsSection.classList.remove('hidden');
        return;
    }
    
    let tableHTML = `
        <div class="results-section">
            <h4>Результаты расчета железнодорожных перевозок</h4>
            <table>
                <thead>
                    <tr>
                        <th>Город</th>
                        <th>Пункт назначения</th>
                        <th>Тип контейнера</th>
                        <th>Ставка</th>
                        <th>Агент</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    results.forEach((result, index) => {
        // Получаем тип контейнера из выбранного значения
        const containerTypeSelect = document.getElementById('rail-container-type');
        const containerType = containerTypeSelect ? containerTypeSelect.value : '';
        
        // Получаем ставку в зависимости от типа контейнера
        let rate = 0;
        let containerTypeDisplay = '';
        
        switch (containerType) {
            case 'container20Under24':
                rate = parseFloat(result.container20Under24) || 0;
                containerTypeDisplay = '20фут ктк (до 24т)';
                break;
            case 'container20Over24':
                rate = parseFloat(result.container20Over24) || 0;
                containerTypeDisplay = '20фут ктк (24-28т)';
                break;
            case 'container40':
                rate = parseFloat(result.container40) || 0;
                containerTypeDisplay = '40фут ктк';
                break;
        }
        
        tableHTML += `
            <tr ondblclick="openMarginModal(${index})" style="cursor: pointer;">
                <td>${result.city || '-'}</td>
                <td>${result.destination || '-'}</td>
                <td>${containerTypeDisplay}</td>
                <td>${rate} RUB</td>
                <td>${result.agent || '-'}</td>
            </tr>
        `;
    });
    
    tableHTML += `
                </tbody>
            </table>
        </div>
    `;
    
    ratesTable.innerHTML = tableHTML;
    resultsSection.classList.remove('hidden');
}

function displayDirectRailRates(results) {
    const resultsSection = document.getElementById('results-separate');
    const ratesTable = document.getElementById('rates-table-separate');
    
    if (!results || results.length === 0) {
        ratesTable.innerHTML = `
            <div class="status-message error">
                Нет данных для выбранных параметров
            </div>
        `;
        resultsSection.classList.remove('hidden');
        return;
    }
    
    let tableHTML = `
        <div class="results-section">
            <h4>Результаты расчета прямых ЖД перевозок</h4>
            ${usdToRubRate ? `<div class="exchange-rate-info"><small>Курс ЦБ РФ: 1 USD = ${usdToRubRate} RUB</small></div>` : ''}
            <table>
                <thead>
                    <tr>
                        <th>FOB</th>
                        <th>Город прибытия</th>
                        <th>Тип контейнера</th>
                        <th>Ставка</th>
                        <th>Ставка в RUB</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    results.forEach((result, index) => {
        // Получаем ставку для 40'HC контейнера (основной тип для прямых ЖД)
        const rate = parseFloat(result.fob40hc) || 0;
        const rateInRub = usdToRubRate ? Math.round(rate * usdToRubRate) : 0;
        
        tableHTML += `
            <tr ondblclick="openMarginModal(${index})" style="cursor: pointer;">
                <td>${result.fob || '-'}</td>
                <td>${result.arrivalCity || '-'}</td>
                <td>40'HC</td>
                <td>$${rate}</td>
                <td>${rateInRub > 0 ? rateInRub + ' RUB' : '-'}</td>
            </tr>
        `;
    });
    
    tableHTML += `
                </tbody>
            </table>
        </div>
    `;
    
    ratesTable.innerHTML = tableHTML;
    resultsSection.classList.remove('hidden');
}

function displayDirectSeaRates(results, containerType) {
    const resultsSection = document.getElementById('results-separate');
    const ratesTable = document.getElementById('rates-table-separate');
    
    if (!results || results.length === 0) {
        ratesTable.innerHTML = `
            <div class="status-message error">
                Нет данных для выбранных параметров
            </div>
        `;
        resultsSection.classList.remove('hidden');
        return;
    }
    
    console.log('🔄 Отображение прямых морских ставок для типа контейнера:', containerType);
    
    // 🔧 ФИЛЬТРУЕМ РЕЗУЛЬТАТЫ ПО ВЫБРАННОМУ ТИПУ КОНТЕЙНЕРА
    const filteredResults = results.filter(result => {
        const rate = getDirectSeaRateByContainerType(result, containerType);
        return rate > 0;
    });
    
    if (filteredResults.length === 0) {
        ratesTable.innerHTML = `
            <div class="status-message error">
                Нет ставок для выбранного типа контейнера: ${getDirectSeaContainerTypeDisplayName(containerType)}
            </div>
        `;
        resultsSection.classList.remove('hidden');
        return;
    }
    
    let tableHTML = `
        <div class="results-section">
            <h4>Результаты расчета прямых морских перевозок</h4>
            <p><strong>Тип контейнера:</strong> ${getDirectSeaContainerTypeDisplayName(containerType)}</p>
            ${usdToRubRate ? `<div class="exchange-rate-info"><small>Курс ЦБ РФ: 1 USD = ${usdToRubRate} RUB</small></div>` : ''}
            <table>
                <thead>
                    <tr>
                        <th>POL</th>
                        <th>POD</th>
                        <th>Тип контейнера</th>
                        <th>Ставка ($)</th>
                        <th>Ставка (RUB)</th>
                        <th>Перевозчик</th>
                        <th>Агент</th>
                        <th>ETD</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    // СОРТИРОВКА ПО СТАВКАМ
    const sortedResults = [...filteredResults].sort((a, b) => {
        const rateA = getDirectSeaRateByContainerType(a, containerType) || 0;
        const rateB = getDirectSeaRateByContainerType(b, containerType) || 0;
        return rateA - rateB;
    });
    
    sortedResults.forEach((result, index) => {
        const rate = getDirectSeaRateByContainerType(result, containerType);
        const rateInRub = usdToRubRate ? Math.round(rate * usdToRubRate) : 0;
        const containerTypeDisplay = getDirectSeaContainerTypeDisplayName(containerType);
        
        tableHTML += `
            <tr ondblclick="openMarginModal(${index})" style="cursor: pointer;">
                <td>${result.pol || '-'}</td>
                <td>${result.pod || '-'}</td>
                <td>${containerTypeDisplay}</td>
                <td>$${rate}</td>
                <td>${rateInRub > 0 ? rateInRub + ' RUB' : '-'}</td>
                <td>${result.carrier || '-'}</td>
                <td>${result.agent || '-'}</td>
                <td>${result.etd || '-'}</td>
            </tr>
        `;
    });
    
    tableHTML += `
                </tbody>
            </table>
            <p style="margin-top: 10px; color: #666; font-size: 14px;">
                📊 Найдено ${sortedResults.length} ставок для типа "${getDirectSeaContainerTypeDisplayName(containerType)}", отсортировано по возрастанию цены
            </p>
        </div>
    `;
    
    ratesTable.innerHTML = tableHTML;
    resultsSection.classList.remove('hidden');
}

// 🔧 ДОПОЛНИТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ПРЯМОГО МОРЯ
function getDirectSeaContainerTypeDisplayName(containerType) {
    switch (containerType) {
        case 'dc_20': return '20\'DC';
        case 'hc_40': return '40\'HC';
        default: return containerType;
    }
}

// 🎯 ФУНКЦИЯ ДЛЯ ПОИСКА СТАВОК ДЛЯ МОРЯ
function searchSeaRates(pol, pod, dropOffArea, containerType) {
    console.log('🔍 Поиск морских ставок с параметрами:', { pol, pod, dropOffArea, containerType });
    
    const data = database.sea;
    
    if (!data || data.length === 0) {
        return { error: 'База данных моря пуста' };
    }
    
    // Используем поисковый движок из модуля моря
    if (window.SeaModule && window.SeaModule.EnhancedSeaSearchEngine) {
        const searchEngine = new window.SeaModule.EnhancedSeaSearchEngine(data);
        const rates = searchEngine.getRatesForRoute(pol, pod, dropOffArea, containerType);
        
        if (rates.length === 0) {
            return { error: 'Ставки не найдены для выбранного маршрута' };
        }
        
        return { success: true, data: rates };
    } else {
        // Резервный поиск если модуль недоступен
        const filteredData = data.filter(item => 
            item.pol === pol && 
            item.pod === pod && 
            item.dropOffArea === dropOffArea &&
            getSeaRateByContainerType(item, containerType) > 0
        );
        
        if (filteredData.length === 0) {
            return { error: 'Ставки не найдены для выбранного маршрута' };
        }
        
        return { success: true, data: filteredData };
    }
}

// Вспомогательная функция для получения ставки по типу контейнера
function getSeaRateByContainerType(item, containerType) {
    switch (containerType) {
        case 'soc_20':
            return parseFloat(item.soc20) || 0;
        case 'soc_40':
            return parseFloat(item.soc40) || 0;
        case 'dc_20':
            return parseFloat(item.dc20) || 0;
        case 'hc_40':
            return parseFloat(item.hc40) || 0;
        default:
            return 0;
    }
}

// 🎯 ФУНКЦИЯ ДЛЯ ПОИСКА СТАВОК ДЛЯ ЖД ПЕРЕВОЗОК
function findRailRates(city, destination, containerType) {
    console.log('🔍 Поиск ЖД ставок с параметрами:', { city, destination, containerType });
    
    const data = database.rail;
    
    if (!data || data.length === 0) {
        return [];
    }
    
    return data.filter(item => {
        if (item.city !== city || item.destination !== destination) {
            return false;
        }
        
        // Проверяем, что ставка для выбранного типа контейнера не равна 0
        switch (containerType) {
            case 'container20Under24':
                return item.container20Under24 && parseFloat(item.container20Under24) > 0;
            case 'container20Over24':
                return item.container20Over24 && parseFloat(item.container20Over24) > 0;
            case 'container40':
                return item.container40 && parseFloat(item.container40) > 0;
            default:
                return false;
        }
    });
}

// 🎯 ФУНКЦИЯ ДЛЯ ПОИСКА СТАВОК ДЛЯ ПРЯМОГО ЖД
function searchDirectRailRates(fob, arrivalCity, containerType) {
    console.log('🔍 Поиск прямых ЖД ставок с параметрами:', { fob, arrivalCity, containerType });
    
    const data = database.direct_rail;
    
    if (!data || data.length === 0) {
        return { error: 'База данных прямого ЖД пуста' };
    }
    
    // Используем поисковый движок из модуля прямого ЖД
    if (window.DirectRailModule && window.DirectRailModule.EnhancedDirectRailSearchEngine) {
        const searchEngine = new window.DirectRailModule.EnhancedDirectRailSearchEngine(data);
        const rates = searchEngine.getRatesForRoute(fob, arrivalCity);
        
        if (rates.length === 0) {
            return { error: 'Ставки не найдены для выбранного маршрута' };
        }
        
        return { success: true, data: rates };
    } else {
        // Резервный поиск если модуль недоступен
        const filteredData = data.filter(item => 
            item.fob === fob && 
            item.arrivalCity === arrivalCity &&
            item.fob40hc && parseFloat(item.fob40hc) > 0
        );
        
        if (filteredData.length === 0) {
            return { error: 'Ставки не найдены для выбранного маршрута' };
        }
        
        return { success: true, data: filteredData };
    }
}

// 🎯 ФУНКЦИЯ ДЛЯ ПОИСКА СТАВОК ДЛЯ ПРЯМОГО МОРЯ
function searchDirectSeaRates(pol, pod, containerType) {
    console.log('🔍 Поиск прямых морских ставок с параметрами:', { pol, pod, containerType });
    
    const data = database.direct_sea;
    
    if (!data || data.length === 0) {
        return { error: 'База данных прямого моря пуста' };
    }
    
    // Используем поисковый движок из модуля прямого моря
    if (window.DirectSeaModule && window.DirectSeaModule.EnhancedDirectSeaSearchEngine) {
        const searchEngine = new window.DirectSeaModule.EnhancedDirectSeaSearchEngine(data);
        const rates = searchEngine.getRatesForRoute(pol, pod, containerType);
        
        if (rates.length === 0) {
            return { error: 'Ставки не найдены для выбранного маршрута' };
        }
        
        return { success: true, data: rates };
    } else {
        // Резервный поиск если модуль недоступен
        const filteredData = data.filter(item => 
            item.pol === pol && 
            item.pod === pod &&
            getDirectSeaRateByContainerType(item, containerType) > 0
        );
        
        if (filteredData.length === 0) {
            return { error: 'Ставки не найдены для выбранного маршрута' };
        }
        
        return { success: true, data: filteredData };
    }
}

// Вспомогательная функция для получения ставки прямого моря по типу контейнера
function getDirectSeaRateByContainerType(item, containerType) {
    switch (containerType) {
        case 'dc_20':
            return parseFloat(item.dc20) || 0;
        case 'hc_40':
            return parseFloat(item.hc40) || 0;
        default:
            return 0;
    }
}

// Функции для комплексных ставок
function setupComplexAutocomplete() {
    // 🔧 Собираем пункты отправления только из определенных баз с ненулевыми ставками
    const allDepartures = new Set();
    const allDestinations = new Set();
    
    // 🔧 Прямое ЖД - берем FOB (fob) только с ненулевыми ставками
    database.direct_rail.forEach(item => {
        if (item.fob && item.fob40hc > 0) {
            allDepartures.add(item.fob);
        }
        if (item.arrivalCity) {
            allDestinations.add(item.arrivalCity);
        }
    });
    
    // 🔧 Прямое море - берем POL только с ненулевыми ставками
    database.direct_sea.forEach(item => {
        if (item.pol && (item.dc20 > 0 || item.hc40 > 0)) {
            allDepartures.add(item.pol);
        }
        if (item.pod) {
            allDestinations.add(item.pod);
        }
    });
    
    // 🔧 Море - берем POL только с ненулевыми ставками (для пунктов отправления)
    database.sea.forEach(item => {
        if (item.pol && (item.soc20 > 0 || item.soc40 > 0 || item.dc20 > 0 || item.hc40 > 0)) {
            allDepartures.add(item.pol);
        }
    });
    
    // 🔧 ЖД - добавляем только пункты назначения для комплексных ставок
    database.rail.forEach(item => {
        if (item.destination) {
            allDestinations.add(item.destination);
        }
    });
    
    // Нормализуем значения (приводим к стандартному виду для устранения дубликатов)
    const normalizedDepartures = [...allDepartures].map(item => normalizeCityName(item));
    const normalizedDestinations = [...allDestinations].map(item => normalizeCityName(item));
    
    // Убираем дубликаты и сортируем
    const departureValues = [...new Set(normalizedDepartures)].sort((a, b) => a.localeCompare(b));
    const destinationValues = [...new Set(normalizedDestinations)].sort((a, b) => a.localeCompare(b));
    
    console.log('🔧 Комплексные ставки - пункты отправления:', departureValues);
    console.log('🔧 Комплексные ставки - пункты назначения:', destinationValues);
    
    Utils.setupCustomDropdown('complex-departure', departureValues);
    Utils.setupCustomDropdown('complex-destination', destinationValues);
    
    // Добавляем обработчики для автоматического расчета
    const departureInput = document.getElementById('complex-departure');
    const destinationInput = document.getElementById('complex-destination');
    const containerTypeSelect = document.getElementById('complex-container-type');
    
    const calculateComplexRates = () => {
        const departure = departureInput.value;
        const destination = destinationInput.value;
        const containerType = containerTypeSelect.value;
        
        if (departure && destination && containerType) {
            calculateAllRates(departure, destination, containerType);
        }
    };
    
    // Обновляем типы контейнеров для комплексных ставок
    updateContainerTypesForComplex(containerTypeSelect);
    
    // Добавляем обработчик для чекбокса весовой категории
    const weightCheckbox = document.getElementById('weight-over-24');
    if (weightCheckbox) {
        weightCheckbox.addEventListener('change', function() {
            is20ftOver24Tons = this.checked;
            calculateComplexRates();
        });
    }
    
    // Добавляем обработчик для чекбокса ВТТ
    const vttCheckbox = document.getElementById('vtt-trigger');
    if (vttCheckbox) {
        vttCheckbox.addEventListener('change', function() {
            isVTTTrigger = this.checked;
            calculateComplexRates();
        });
    }
    
    departureInput.addEventListener('change', calculateComplexRates);
    destinationInput.addEventListener('change', calculateComplexRates);
    containerTypeSelect.addEventListener('change', calculateComplexRates);
}

function calculateAllRates(departure, destination, containerType) {
    const allResults = [];
    
    console.log('🔧 Комплексный расчет:', { departure, destination, containerType });
    
    // 🔧 Поиск в прямых ЖД перевозках - по fob и arrivalCity (регистронезависимый с нормализацией)
    if (database.direct_rail && database.direct_rail.length > 0) {
        const directRailResults = database.direct_rail.filter(item =>
            item.fob && normalizeCityName(item.fob) === normalizeCityName(departure) &&
            item.arrivalCity && normalizeCityName(item.arrivalCity) === normalizeCityName(destination) &&
            item.fob40hc > 0  // Только с ненулевой ставкой
        );
        
        console.log('🔧 Прямое ЖД результаты:', directRailResults.length);
        
        directRailResults.forEach(item => {
            let rate = 0;
            if (containerType === 'hc_40') {
                rate = item.fob40hc || 0;
            }
            
            if (rate > 0) {
                allResults.push({
                    transportType: 'direct_rail',
                    transportName: 'Прямое ЖД',
                    rate: rate,
                    currency: '$',
                    data: item
                });
            }
        });
    }
    
    // 🔧 Поиск в прямых морских перевозках - по pol и pod (регистронезависимый с нормализацией)
    if (database.direct_sea && database.direct_sea.length > 0) {
        const directSeaResults = database.direct_sea.filter(item =>
            item.pol && normalizeCityName(item.pol) === normalizeCityName(departure) &&
            item.pod && normalizeCityName(item.pod) === normalizeCityName(destination) &&
            (item.dc20 > 0 || item.hc40 > 0)  // Только с ненулевой ставкой
        );
        
        console.log('🔧 Прямое море результаты:', directSeaResults.length);
        
        directSeaResults.forEach(item => {
            let rate = 0;
            if (containerType === 'dc_20') {
                rate = item.dc20 || 0;
            } else if (containerType === 'hc_40') {
                rate = item.hc40 || 0;
            }
            
            if (rate > 0) {
                allResults.push({
                    transportType: 'direct_sea',
                    transportName: 'Прямое море',
                    rate: rate,
                    currency: '$',
                    data: item
                });
            }
        });
    }
    
    // 🔧 Поиск в морских перевозках - по pol и pod (регистронезависимый с нормализацией)
    if (database.sea && database.sea.length > 0) {
        const seaResults = database.sea.filter(item =>
            item.pol && normalizeCityName(item.pol) === normalizeCityName(departure) &&
            item.pod && normalizeCityName(item.pod) === normalizeCityName(destination) &&
            (item.soc20 > 0 || item.soc40 > 0 || item.dc20 > 0 || item.hc40 > 0)  // Только с ненулевой ставкой
        );
        
        console.log('🔧 Море результаты:', seaResults.length);
        
        seaResults.forEach(item => {
            let rate = 0;
            if (containerType === 'dc_20') {
                rate = item.dc20 || 0;
            } else if (containerType === 'hc_40') {
                rate = item.hc40 || 0;
            }
            
            if (rate > 0) {
                allResults.push({
                    transportType: 'sea',
                    transportName: 'Море',
                    rate: rate,
                    currency: '$',
                    data: item
                });
            }
        });
    }
    
    // 🔧 Комплексные ставки: Море + ЖД (связка по city и drop-off)
    if (database.sea && database.sea.length > 0 && database.rail && database.rail.length > 0) {
        console.log('🔧 Поиск комплексных ставок Море+ЖД:', { departure, destination });
        
        // Ищем морские ставки для выбранного POL (регистронезависимый с нормализацией)
        const seaRates = database.sea.filter(item =>
            item.pol && normalizeCityName(item.pol) === normalizeCityName(departure) &&
            (item.soc20 > 0 || item.soc40 > 0 || item.dc20 > 0 || item.hc40 > 0)
        );
        
        console.log('🔧 Найдено морских ставок:', seaRates.length);
        
        // Для каждой морской ставки ищем связанные ЖД ставки
        seaRates.forEach(seaItem => {
            // Ищем ЖД записи с совпадающим city и destination (регистронезависимый с нормализацией)
            const railRates = database.rail.filter(railItem => {
                // Базовые правила соединения
                const baseRules =
                    railItem.city && seaItem.city && normalizeCityName(railItem.city) === normalizeCityName(seaItem.city) && // Правило 2: city море = city жд
                    railItem.destination && seaItem.dropOffArea && normalizeCityName(railItem.destination) === normalizeCityName(seaItem.dropOffArea) && // Правило 3: drop-off море = destination жд
                    railItem.destination && normalizeCityName(railItem.destination) === normalizeCityName(destination) && // Пункт назначения должен совпадать с выбранным пользователем
                    (railItem.container20Under24 > 0 || railItem.container20Over24 > 0 || railItem.container40 > 0);
                
                // Если включен триггер ВТТ, добавляем дополнительные правила:
                if (isVTTTrigger) {
                    return baseRules &&
                           seaItem.pod && railItem.agent && normalizeCityName(seaItem.pod) === normalizeCityName(railItem.agent) && // Правило 5: море POD = жд агент
                           (railItem.тыловойТерминал && railItem.тыловойТерминал.toString().toLowerCase().trim() === 'нет'); // Правило 6: Тыловой Терминал должен быть равен "нет" (нечувствительно к регистру)
                }
                
                return baseRules;
            });
            
            console.log(`🔧 Для морской ставки "${seaItem.pol} → ${seaItem.pod}" найдено ЖД ставок:`, railRates.length);
            
            // Для каждой связанной ЖД ставки создаем комплексную ставку
            railRates.forEach(railItem => {
                let seaRate = 0;
                let railRate = 0;
                
                // Получаем морскую ставку по типу контейнера
                switch (containerType) {
                    case 'dc_20':
                        seaRate = seaItem.dc20 || 0;
                        break;
                    case 'hc_40':
                        seaRate = seaItem.hc40 || 0;
                        break;
                }
                
                // Получаем ЖД ставку по типу контейнера
                switch (containerType) {
                    case 'dc_20':
                        // Для 20-футовых контейнеров используем ставку в зависимости от весовой категории
                        if (is20ftOver24Tons) {
                            railRate = railItem.container20Over24 || 0;
                        } else {
                            railRate = railItem.container20Under24 || 0;
                        }
                        break;
                    case 'hc_40':
                        // Для 40-футовых контейнеров используем ставку 40фут ктк
                        railRate = railItem.container40 || 0;
                        break;
                }
                
                // Складываем ставки только если обе ненулевые
                if (seaRate > 0 && railRate > 0) {
                    // Получаем стоимость ВТТ из тарифов (если есть)
                    const vttRate = database.tariff && database.tariff.length > 0 ? database.tariff[0].vtt || 0 : 0;
                    
                    // Для сортировки используем конвертированную сумму в RUB
                    let totalRateForSorting = 0;
                    let currencyForSorting = '$';
                    
                    if (usdToRubRate) {
                        // Конвертируем морскую ставку в RUB и складываем с ЖД ставкой
                        totalRateForSorting = Math.round(seaRate * usdToRubRate) + railRate;
                        currencyForSorting = 'RUB';
                    } else {
                        // Если курс не загружен, используем USD для сортировки (только морская часть)
                        totalRateForSorting = seaRate;
                        currencyForSorting = '$';
                    }
                    
                    // Добавляем ВТТ к ставке только для комплексных ставок Море+ЖД
                    if (isVTTTrigger && vttRate > 0) {
                        totalRateForSorting += vttRate;
                    }
                    
                    allResults.push({
                        transportType: 'sea_rail',
                        transportName: 'Море + ЖД',
                        rate: totalRateForSorting,
                        currency: currencyForSorting,
                        data: {
                            sea: seaItem,
                            rail: railItem,
                            seaRate: seaRate,
                            railRate: railRate,
                            connection: `Море: ${normalizeCityName(seaItem.pol)} → ${normalizeCityName(seaItem.pod)} (${normalizeCityName(seaItem.city)}) → ЖД: ${normalizeCityName(railItem.city)} → ${normalizeCityName(railItem.destination)}`,
                            vttIncluded: isVTTTrigger && vttRate > 0,
                            vttRate: vttRate
                        }
                    });
                    
                    console.log(`✅ Комплексная ставка: ${seaRate} (море) + ${railRate} (жд) ${isVTTTrigger && vttRate > 0 ? `+ ${vttRate} (ВТТ)` : ''} = ${totalRateForSorting} ${currencyForSorting}`);
                }
            });
        });
    }
    
    console.log('🔧 Всего результатов комплексного расчета:', allResults.length);
    
    // Сортируем результаты по общей ставке (от меньшей к большей)
    allResults.sort((a, b) => {
        // Безопасная сортировка с проверкой на undefined и null
        const rateA = a.rate || 0;
        const rateB = b.rate || 0;
        return rateA - rateB;
    });

    console.log('📊 Отсортированные результаты комплексного расчета:',
        allResults.map(r => ({ type: r.transportType, rate: r.rate })));

    // Сохраняем результаты в глобальную переменную для доступа из модального окна
    window.allResults = allResults;
    
    // Отображаем результаты
    displayComplexResults(allResults, departure, destination, containerType);
}

function displayComplexResults(results, departure, destination, containerType) {
    const resultsSection = document.getElementById('results');
    const ratesTable = document.getElementById('rates-table');
    
    if (results.length === 0) {
        ratesTable.innerHTML = `
            <div class="status-message error">
                Нет данных для выбранных параметров: ${departure} → ${destination}
            </div>
        `;
        resultsSection.classList.remove('hidden');
        return;
    }
    
    let tableHTML = `
        <div class="complex-results-section">
            <h4>Результаты для: ${normalizeCityName(departure)} → ${normalizeCityName(destination)}</h4>
            <div class="sorting-info" style="margin-bottom: 10px; font-style: italic; color: #666;">
                📊 Результаты отсортированы по возрастанию общей ставки
            </div>
            ${usdToRubRate ? `<div class="exchange-rate-info"><small>Курс ЦБ РФ: 1 USD = ${usdToRubRate} RUB</small></div>` : ''}
            <table>
                <thead>
                    <tr>
                        <th>Тип перевозки</th>
                        <th>Ставка море</th>
                        <th>Ставка ЖД</th>
                        <th>Общая ставка</th>
                        <th>Дополнительная информация</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    results.forEach((result, index) => {
        const transportTypeClass = `transport-type-${result.transportType}`;
        
        // Определяем, является ли это самой выгодной ставкой (первая в отсортированном списке)
        const isBestRate = index === 0;
        const bestRateClass = isBestRate ? 'best-rate-row' : '';
        
        let seaRate = '';
        let railRate = '';
        let totalRate = '';
        let additionalInfo = '';
        
        if (result.transportType === 'direct_rail') {
            seaRate = '-';
            railRate = `$${result.rate}`;
            totalRate = usdToRubRate ? `${Math.round(result.rate * usdToRubRate)} RUB` : `$${result.rate}`;
            additionalInfo = `Станция прибытия: ${result.data.arrivalStation || 'Не указана'}`;
        } else if (result.transportType === 'direct_sea') {
            seaRate = `$${result.rate}`;
            railRate = '-';
            totalRate = usdToRubRate ? `${Math.round(result.rate * usdToRubRate)} RUB` : `$${result.rate}`;
            additionalInfo = `ETD: ${result.data.etd || 'Не указан'}`;
        } else if (result.transportType === 'sea') {
            seaRate = `$${result.rate}`;
            railRate = '-';
            totalRate = usdToRubRate ? `${Math.round(result.rate * usdToRubRate)} RUB` : `$${result.rate}`;
            additionalInfo = `DROP OFF AREA: ${result.data.dropOffArea || 'Не указан'}`;
        } else if (result.transportType === 'rail') {
            seaRate = '-';
            railRate = `${result.rate} RUB`;
            totalRate = `${result.rate} RUB`;
            additionalInfo = `Агент: ${result.data.agent || 'Не указан'}`;
        } else if (result.transportType === 'sea_rail') {
            // Комплексная ставка: море в USD, ЖД в RUB
            const seaRateUSD = result.data.seaRate || 0;
            const railRateRUB = result.data.railRate || 0;
            
            seaRate = `$${seaRateUSD}`;
            railRate = `${railRateRUB} RUB`;
            
            // Отображаем общую ставку в зависимости от валюты сортировки
            if (result.currency === 'RUB') {
                // Уже конвертировано в RUB
                totalRate = `${result.rate} RUB`;
            } else {
                // Используем USD для сортировки (только морская часть)
                totalRate = `$${result.rate}`;
            }
            
            additionalInfo = result.data.connection || 'Комплексная перевозка Море+ЖД';
            // Добавляем информацию о ВТТ, если он включен
            if (result.data.vttIncluded) {
                additionalInfo += ` + ВТТ: ${result.data.vttRate} RUB`;
            }
        }
        
        tableHTML += `
            <tr class="${bestRateClass}" ondblclick="openMarginModal(${index})" style="cursor: pointer;">
                <td>
                    <span class="transport-type-badge ${transportTypeClass}">
                        ${result.transportName}
                        ${isBestRate ? ' 🏆' : ''}
                    </span>
                </td>
                <td>${seaRate}</td>
                <td>${railRate}</td>
                <td><strong>${totalRate}</strong></td>
                <td>${additionalInfo}</td>
            </tr>
        `;
    });
    
    tableHTML += `
                </tbody>
            </table>
        </div>
    `;
    
    ratesTable.innerHTML = tableHTML;
    resultsSection.classList.remove('hidden');
}

// Функция для проверки авторизации с сервера
async function checkAuth() {
    try {
        const currentUser = await ServerAuth.getCurrentUser();
        return currentUser;
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
        return null;
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Приложение менеджера по продажам инициализировано');
    
    // Проверяем авторизацию с сервера
    const currentUser = await checkAuth();
    if (!currentUser || (currentUser.role !== 'sales' && currentUser.role !== 'admin')) {
        // Если пользователь не авторизован или не имеет прав доступа, перенаправляем на главную
        console.log('❌ Неавторизованный доступ, перенаправление на главную');
        window.location.href = '../index.html';
        return;
    }
    
    console.log('✅ Пользователь авторизован:', currentUser.email, 'Роль:', currentUser.role);
    
    // Загружаем курс ЦБ РФ
    await loadExchangeRate();
    
    // Автоматически загружаем данные с сервера при запуске
    await loadDatabaseData();
    console.log('✅ Данные загружены с сервера при инициализации');
    
    // Добавляем отображение текущего курса
    addExchangeRateDisplay();
    
    // Показываем выбор типа расчета
    document.getElementById('calculation-type-selection').classList.remove('hidden');
});

// Функции для загрузки данных и курса валют
async function loadDatabaseData() {
    // 🔧 ЗАГРУЗКА ДАННЫХ ИЗ СЕРВЕРА ДЛЯ ВСЕХ ТИПОВ БАЗ
    const dbTypes = ['sea', 'rail', 'direct_rail', 'direct_sea', 'tariff'];
    
    for (const dbType of dbTypes) {
        try {
            const response = await fetch(`/api/data/${dbType}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const serverData = await response.json();
            database[dbType] = serverData.data || [];
            console.log(`✅ Загружены данные с сервера для ${dbType}: ${database[dbType].length} записей`);
            
            // 🔧 СОХРАНЯЕМ ИНФОРМАЦИЮ О ВРЕМЕНИ ОБНОВЛЕНИЯ В LOCALSTORAGE
            if (serverData.lastUpdate) {
                const updateData = {
                    timestamp: serverData.lastUpdate,
                    formatted: new Date(serverData.lastUpdate).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    }),
                    count: serverData.count || database[dbType].length
                };
                localStorage.setItem(`last_update_${dbType}`, JSON.stringify(updateData));
                console.log(`✅ Сохранено время обновления для ${dbType}: ${updateData.formatted}`);
            }
            
        } catch (error) {
            console.error(`❌ Ошибка загрузки данных с сервера для ${dbType}:`, error);
            
            // 🔧 РЕЗЕРВНАЯ ЗАГРУЗКА ИЗ LOCALSTORAGE
            const savedData = localStorage.getItem(`logistics_db_${dbType}`);
            if (savedData) {
                try {
                    database[dbType] = JSON.parse(savedData);
                    console.log(`✅ Загружены резервные данные из localStorage для ${dbType}: ${database[dbType].length} записей`);
                } catch (localError) {
                    console.error(`❌ Ошибка загрузки резервных данных для ${dbType}:`, localError);
                    database[dbType] = [];
                }
            } else {
                console.warn(`⚠️ Нет сохраненных данных для ${dbType}`);
                database[dbType] = [];
            }
        }
    }
    
    // 🔧 ЭКСПОРТИРУЕМ ДАННЫЕ В ГЛОБАЛЬНУЮ ОБЛАСТЬ ДЛЯ МОДУЛЕЙ
    window.database = database;
    console.log('🌐 Данные экспортированы в window.database для модулей');
}

// Функция для парсинга курса ЦБ РФ через прокси
async function loadExchangeRate() {
    try {
        console.log('🔄 Загрузка курса ЦБ РФ через прокси...');
        
        // Используем наш прокси-маршрут
        const response = await fetch('/api/exchange-rate');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            usdToRubRate = data.rate;
            console.log('✅ Курс ЦБ РФ загружен через прокси:', usdToRubRate);
            
            // Сохраняем в localStorage
            localStorage.setItem('usd_to_rub_rate', usdToRubRate);
            localStorage.setItem('usd_to_rub_rate_date', new Date().toISOString());
            
            // Обновляем отображение курса
            updateExchangeRateDisplay();
            
            Utils.showStatus(`Курс ЦБ РФ загружен: 1 USD = ${usdToRubRate} RUB`, 'success');
            return true;
        } else {
            throw new Error(data.error || 'Не удалось получить курс');
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки курса ЦБ РФ:', error);
        Utils.showStatus('Не удалось загрузить курс ЦБ РФ', 'error');
        return false;
    }
}

// Функция выхода из системы
async function logoutUser() {
    console.log('🔐 Выход из системы менеджера по продажам');
    
    try {
        // Выход через серверную аутентификацию
        await ServerAuth.logoutUser();
    } catch (error) {
        console.error('Ошибка при выходе из системы:', error);
    }
    
    // Сбрасываем глобальные переменные
    window.currentRole = '';
    window.currentDatabase = '';
    window.currentCalculationType = '';
    window.uploadedData = null;
    
    // Возвращаем на главную страницу (index.html)
    window.location.href = '../index.html';
}

// Обновляет отображение курса в интерфейсе
function updateExchangeRateDisplay() {
    const exchangeRateLabels = document.querySelectorAll('.exchange-rate-display label');
    if (exchangeRateLabels.length > 0) {
        const savedDate = localStorage.getItem('usd_to_rub_rate_date');
        const dateInfo = savedDate ? ` (обновлен ${new Date(savedDate).toLocaleDateString('ru-RU')})` : '';
        exchangeRateLabels.forEach(label => {
            label.textContent = `Курс ЦБ РФ: 1 USD = ${usdToRubRate || 'Не загружен'} RUB${dateInfo}`;
        });
    }
}

// Добавляем отображение текущего курса
function addExchangeRateDisplay() {
    const salesInterface = document.getElementById('sales-interface');
    const salesSeparateInterface = document.getElementById('sales-separate-interface');
    
    // Добавляем отображение курса в интерфейс комплексных ставок
    if (salesInterface && !document.querySelector('.exchange-rate-display')) {
        const savedDate = localStorage.getItem('usd_to_rub_rate_date');
        const dateInfo = savedDate ? ` (обновлен ${new Date(savedDate).toLocaleDateString('ru-RU')})` : '';
        
        const exchangeRateHTML = `
            <div class="exchange-rate-display" style="margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 5px;">
                <label>Курс ЦБ РФ: 1 USD = ${usdToRubRate || 'Не загружен'} RUB${dateInfo}</label>
            </div>
        `;
        salesInterface.insertAdjacentHTML('afterbegin', exchangeRateHTML);
    }
    
    // Добавляем отображение курса в интерфейс отдельных ставок
    if (salesSeparateInterface && !salesSeparateInterface.querySelector('.exchange-rate-display')) {
        const savedDate = localStorage.getItem('usd_to_rub_rate_date');
        const dateInfo = savedDate ? ` (обновлен ${new Date(savedDate).toLocaleDateString('ru-RU')})` : '';
        
        const exchangeRateHTML = `
            <div class="exchange-rate-display" style="margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 5px;">
                <label>Курс ЦБ РФ: 1 USD = ${usdToRubRate || 'Не загружен'} RUB${dateInfo}</label>
            </div>
        `;
        salesSeparateInterface.insertAdjacentHTML('afterbegin', exchangeRateHTML);
    }
}

// Глобальные переменные для модального окна маржинальности
let currentResultForMargin = null;
let currentResultsArray = [];

// Функция открытия модального окна маржинальности
function openMarginModal(resultIndex) {
    if (!window.allResults || !window.allResults[resultIndex]) {
        console.error('Результат не найден');
        return;
    }
    
    currentResultForMargin = window.allResults[resultIndex];
    currentResultsArray = window.allResults;
    
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
    currentResultsArray = [];
}

// Заполнение информации о себестоимости
function populateCostDetails(result) {
    const costDetails = document.getElementById('cost-details');
    
    let costHTML = '';
    
    // Добавляем маршрут для всех типов перевозок
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
    
    costHTML += `
        <div class="cost-item">
            <span class="cost-label">Маршрут:</span>
            <span>${routeInfo}</span>
        </div>
    `;
    
    if (result.transportType === 'direct_rail') {
        costHTML += `
            <div class="cost-item">
                <span class="cost-label">Стоимость ЖД перевозки:</span>
                <span class="cost-value">$${result.rate}</span>
            </div>
        `;
    } else if (result.transportType === 'direct_sea') {
        costHTML += `
            <div class="cost-item">
                <span class="cost-label">Стоимость фрахта:</span>
                <span class="cost-value">$${result.rate}</span>
            </div>
        `;
    } else if (result.transportType === 'sea') {
        costHTML += `
            <div class="cost-item">
                <span class="cost-label">Стоимость фрахта:</span>
                <span class="cost-value">$${result.rate}</span>
            </div>
        `;
    } else if (result.transportType === 'rail') {
        costHTML += `
            <div class="cost-item">
                <span class="cost-label">Стоимость ЖД перевозки:</span>
                <span class="cost-value">${result.rate} RUB</span>
            </div>
        `;
    } else if (result.transportType === 'sea_rail') {
        costHTML += `
            <div class="cost-item">
                <span class="cost-label">Стоимость фрахта:</span>
                <span class="cost-value">$${result.data.seaRate}</span>
            </div>
            <div class="cost-item">
                <span class="cost-label">Стоимость ЖД перевозки:</span>
                <span class="cost-value">${result.data.railRate} RUB</span>
            </div>
        `;
        
        // Добавляем информацию о ВТТ, если он включен
        if (result.data.vttIncluded) {
            costHTML += `
                <div class="cost-item">
                    <span class="cost-label">Стоимость ВТТ:</span>
                    <span class="cost-value">${result.data.vttRate} RUB</span>
                </div>
            `;
        }
        
        costHTML += `
            <div class="cost-item">
                <span class="cost-label">Общая стоимость:</span>
                <span class="cost-value">${result.rate} ${result.currency}</span>
            </div>
        `;
    }
    
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

// Расчет и отображение результата с накруткой
function calculateAndDisplayMargin() {
    if (!currentResultForMargin) return;
    
    const resultContainer = document.getElementById('margin-result-container');
    let resultHTML = '';
    
    // Добавляем маршрут для всех типов перевозок
    let routeInfo = '';
    if (currentResultForMargin.transportType === 'direct_rail') {
        routeInfo = `${currentResultForMargin.data.fob || 'Не указан'} → ${currentResultForMargin.data.arrivalCity || 'Не указан'}`;
    } else if (currentResultForMargin.transportType === 'direct_sea') {
        routeInfo = `${currentResultForMargin.data.pol || 'Не указан'} → ${currentResultForMargin.data.pod || 'Не указан'}`;
    } else if (currentResultForMargin.transportType === 'sea') {
        routeInfo = `${currentResultForMargin.data.pol || 'Не указан'} → ${currentResultForMargin.data.pod || 'Не указан'}`;
    } else if (currentResultForMargin.transportType === 'rail') {
        routeInfo = `${currentResultForMargin.data.city || 'Не указан'} → ${currentResultForMargin.data.destination || 'Не указан'}`;
    } else if (currentResultForMargin.transportType === 'sea_rail') {
        routeInfo = currentResultForMargin.data.connection || 'Комплексный маршрут';
    }
    
    resultHTML += `
        <div class="result-section">
            <h4>Маршрут:</h4>
            <div class="cost-item">
                <span>${routeInfo}</span>
            </div>
        </div>
    `;
    
    if (currentResultForMargin.transportType === 'direct_rail' || currentResultForMargin.transportType === 'rail') {
        const margin = parseFloat(document.getElementById('rail-margin').value) || 0;
        const baseRate = currentResultForMargin.rate;
        const finalRate = baseRate + margin;
        
        resultHTML += `
            <div class="result-section">
                <h4>Стоимость ЖД перевозки:</h4>
                <div class="final-rate">${finalRate} ${currentResultForMargin.transportType === 'rail' ? 'RUB' : '$'}</div>
            </div>
        `;
    } else if (currentResultForMargin.transportType === 'direct_sea' || currentResultForMargin.transportType === 'sea') {
        const margin = parseFloat(document.getElementById('sea-margin').value) || 0;
        const baseRate = currentResultForMargin.rate;
        const finalRate = baseRate + margin;
        
        resultHTML += `
            <div class="result-section">
                <h4>Стоимость фрахта:</h4>
                <div class="final-rate">$${finalRate}</div>
            </div>
        `;
    } else if (currentResultForMargin.transportType === 'sea_rail') {
        const seaMargin = parseFloat(document.getElementById('sea-margin').value) || 0;
        const railMargin = parseFloat(document.getElementById('rail-margin').value) || 0;
        
        const seaBaseRate = currentResultForMargin.data.seaRate;
        const railBaseRate = currentResultForMargin.data.railRate;
        
        const seaFinalRate = seaBaseRate + seaMargin;
        const railFinalRate = railBaseRate + railMargin;
        
        // Конвертируем морскую ставку в RUB для сложения
        const seaFinalRateRUB = usdToRubRate ? Math.round(seaFinalRate * usdToRubRate) : seaFinalRate;
        const totalFinalRate = seaFinalRateRUB + railFinalRate;
        
        resultHTML += `
            <div class="result-section">
                <h4>Стоимость фрахта:</h4>
                <div class="final-rate">$${seaFinalRate}</div>
            </div>
            <div class="result-section">
                <h4>Стоимость ЖД перевозки:</h4>
                <div class="final-rate">${railFinalRate} RUB</div>
            </div>
        `;
        
        // Добавляем информацию о ВТТ, если он включен
        if (currentResultForMargin.data.vttIncluded) {
            resultHTML += `
                <div class="result-section">
                    <h4>Стоимость ВТТ:</h4>
                    <div class="final-rate">${currentResultForMargin.data.vttRate} RUB</div>
                </div>
            `;
        }
        
        resultHTML += `
            <div class="result-section">
                <h4>Общая стоимость:</h4>
                <div class="final-rate">${totalFinalRate} RUB</div>
            </div>
        `;
    }
    
    resultContainer.innerHTML = resultHTML;
}

// Функция копирования результата
function copyMarginResult() {
    const resultContainer = document.getElementById('margin-result-container');
    const textToCopy = resultContainer.innerText;
    
    navigator.clipboard.writeText(textToCopy).then(() => {
        const copyButton = document.getElementById('copy-result');
        const originalText = copyButton.textContent;
        copyButton.textContent = '✅ Скопировано!';
        
        setTimeout(() => {
            copyButton.textContent = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Ошибка копирования:', err);
        alert('Не удалось скопировать текст');
    });
}

// Сохраняем результаты в глобальную переменную для доступа из модального окна
window.allResults = [];