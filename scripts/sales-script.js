// 🎯 ОСНОВНОЙ ФАЙЛ ДЛЯ МЕНЕДЖЕРА ПО ПРОДАЖАМ

// Глобальные переменные
let currentDatabase = '';
let currentCalculationType = 'separate'; // 'separate' или 'complex'
let database = {
    sea: [],
    rail: [],
    direct_rail: [],
    direct_sea: [],
    tariff: [],
    agent_tariff: []
};

// Курс ЦБ РФ
let usdToRubRate = null;

// Флаг для весовой категории 20-футовых контейнеров
let is20ftOver24Tons = false;

// Флаг для триггера ВТТ (море POD = жд агент)
let isVTTTrigger = false;
function escapeHtml(value) {
    return (window.Utils && typeof Utils.escapeHtml === 'function')
        ? Utils.escapeHtml(value)
        : String(value ?? '');
}

function setSalesMenuState(calcType, dbType = '') {
    const salesGroup = document.querySelector('[data-sales-group="sales"]');
    if (salesGroup) {
        salesGroup.classList.toggle('is-active', Boolean(calcType));
        if (salesGroup.tagName === 'DETAILS') {
            salesGroup.open = Boolean(calcType);
        }
    }

    const separateGroup = document.querySelector('[data-sales-calc="separate"]');
    if (separateGroup && separateGroup.tagName === 'DETAILS') {
        separateGroup.open = calcType === 'separate';
    }
    if (separateGroup) {
        separateGroup.classList.toggle('is-active', calcType === 'separate');
    }

    const complexButton = document.querySelector('[data-sales-calc="complex"]');
    if (complexButton) {
        complexButton.classList.toggle('is-active', calcType === 'complex');
    }

    const dbButtons = document.querySelectorAll('[data-sales-db]');
    dbButtons.forEach((button) => {
        button.classList.toggle('is-active', calcType === 'separate' && button.dataset.salesDb === dbType);
    });
}

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

// Функция для получения ставки ВТТ по терминалу
function getVttRateForTerminal(terminalName) {
    if (!database.tariff || database.tariff.length === 0) {
        return 0;
    }
    
    // Ищем тариф с указанным терминалом (регистронезависимо)
    const normalizedTerminal = terminalName ? terminalName.trim().toLowerCase() : '';
    const tariff = database.tariff.find(t =>
        t.terminal && t.terminal.trim().toLowerCase() === normalizedTerminal
    );
    
    if (tariff && tariff.vtt !== undefined && tariff.vtt !== null) {
        return tariff.vtt;
    }
    
    // Если не нашли, ищем тариф с терминалом "Общий"
    const generalTariff = database.tariff.find(t =>
        t.terminal && t.terminal.trim().toLowerCase() === 'общий'
    );
    
    if (generalTariff && generalTariff.vtt !== undefined && generalTariff.vtt !== null) {
        return generalTariff.vtt;
    }
    
    // Если нет общего, берем первый тариф
    if (database.tariff[0] && database.tariff[0].vtt !== undefined && database.tariff[0].vtt !== null) {
        return database.tariff[0].vtt;
    }
    
    return 0;
}

// 🔧 ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ ИНФОРМАЦИИ О СНП ПО КОМБИНАЦИИ ПОЛЕЙ
function getAgentInfo(transportType, data) {
    if (!database.agent_tariff || database.agent_tariff.length === 0) {
        console.log('❌ База данных тарифов агентов пуста');
        return null;
    }
    
    console.log('🔍 Поиск СНП для типа перевозки:', transportType);
    console.log('📊 Данные для поиска:', data);
    
    let searchKey = '';
    let agentRecord = null;
    
    // 🔧 ЛОГИКА ПОИСКА В ЗАВИСИМОСТИ ОТ ТИПА ПЕРЕВОЗКИ
    if (transportType === 'sea' || transportType === 'sea_rail') {
        // Для моря: взаимосвязь Carrier, POD, DROP OFF AREA VIA VVO
        const carrier = data.carrier || data.sea?.carrier || '';
        const pod = data.pod || data.sea?.pod || '';
        const dropOffArea = data.dropOffArea || data.sea?.dropOffArea || '';
        
        console.log('🔍 Поиск СНП для моря:', { carrier, pod, dropOffArea });
        
        // Ищем точное совпадение по всем трем полям
        agentRecord = database.agent_tariff.find(agent => {
            const agentCarrier = agent.carrier || agent.name || '';
            const agentPod = agent.pod || '';
            const agentDropOffArea = agent.dropOffArea || '';
            
            // Нормализуем значения для сравнения
            const normalizedCarrier = normalizeAgentAndCarrier(carrier).toLowerCase();
            const normalizedAgentCarrier = normalizeAgentAndCarrier(agentCarrier).toLowerCase();
            
            return normalizedAgentCarrier === normalizedCarrier &&
                   agentPod.toLowerCase() === pod.toLowerCase() &&
                   agentDropOffArea.toLowerCase() === dropOffArea.toLowerCase();
        });
        
        if (agentRecord) {
            console.log('✅ Найден СНП для моря:', agentRecord.snp);
            return agentRecord;
        }
        
        // Если не нашли с dropOffArea, ищем только по Carrier и POD
        if (!agentRecord && dropOffArea) {
            agentRecord = database.agent_tariff.find(agent => {
                const agentCarrier = agent.carrier || agent.name || '';
                const agentPod = agent.pod || '';
                
                const normalizedCarrier = normalizeAgentAndCarrier(carrier).toLowerCase();
                const normalizedAgentCarrier = normalizeAgentAndCarrier(agentCarrier).toLowerCase();
                
                return normalizedAgentCarrier === normalizedCarrier &&
                       agentPod.toLowerCase() === pod.toLowerCase();
            });
            
            if (agentRecord) {
                console.log('✅ Найден СНП для моря (без dropOffArea):', agentRecord.snp);
                return agentRecord;
            }
        }
        
        searchKey = `${carrier}_${pod}_${dropOffArea}`;
        
    } else if (transportType === 'direct_sea') {
        // Для прямого моря: взаимосвязь Carrier, POD
        const carrier = data.carrier || '';
        const pod = data.pod || '';
        
        console.log('🔍 Поиск СНП для прямого моря:', { carrier, pod });
        
        agentRecord = database.agent_tariff.find(agent => {
            const agentCarrier = agent.carrier || agent.name || '';
            const agentPod = agent.pod || '';
            
            const normalizedCarrier = normalizeAgentAndCarrier(carrier).toLowerCase();
            const normalizedAgentCarrier = normalizeAgentAndCarrier(agentCarrier).toLowerCase();
            
            return normalizedAgentCarrier === normalizedCarrier &&
                   agentPod.toLowerCase() === pod.toLowerCase();
        });
        
        if (agentRecord) {
            console.log('✅ Найден СНП для прямого моря:', agentRecord.snp);
            return agentRecord;
        }
        
        searchKey = `${carrier}_${pod}`;
        
    } else if (transportType === 'direct_rail' || transportType === 'rail') {
        // Для прямого ЖД - заглушка: возвращаем "СНП не найден"
        console.log('⚠️ Для прямого ЖД СНП не ищется - заглушка');
        return {
            snp: 'СНП не найден',
            note: 'Для прямых ЖД перевозок СНП не применяется'
        };
    }
    
    // Если ничего не нашли
    if (!agentRecord) {
        console.log('⚠️ СНП не найден для:', searchKey);
        return {
            snp: 'СНП не найден',
            note: 'Не найдено соответствие в тарифах агентов'
        };
    }
    
    return agentRecord;
}

// 🔧 ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ НОРМАЛИЗАЦИИ ПЕРЕВОЗЧИКА
function normalizeAgentAndCarrier(value) {
    if (!value) return value;
    
    const normalizedValue = value.toString().trim();
    
    // Заменяем "Sollers" на "Pacific Logistic"
    if (normalizedValue.toLowerCase().includes('sollers')) {
        console.log(`🔄 Нормализация: "${normalizedValue}" → "Pacific Logistic"`);
        return 'Pacific Logistic';
    }
    
    return normalizedValue;
}

// Функции для управления интерфейсом
function selectCalculationType(type) {
    currentCalculationType = type;
    
    if (type === 'separate') {
        // Показываем выбор типа базы данных для отдельных ставок
        document.getElementById('calculation-type-selection').classList.add('hidden');
        document.getElementById('database-selection').classList.remove('hidden');
        setSalesMenuState('separate', currentDatabase);
    } else {
        currentDatabase = '';
        window.currentDatabase = '';
        setSalesMenuState('complex');
        // Показываем интерфейс комплексного расчета
        document.getElementById('calculation-type-selection').classList.add('hidden');
        document.getElementById('sales-interface').classList.remove('hidden');
        resetCalculatorForm();
        setupCalculator();
        Utils.showLastUpdate('complex', 'last-update');
    }
}

function openSeparateDatabase(dbType) {
    selectCalculationType('separate');
    selectDatabase(dbType);
}

async function openChangePassword() {
    try {
        const user = window.currentUser || await ServerAuth.getCurrentUser();
        if (!user || !user.email) {
            Utils.showStatus('Не удалось получить email пользователя', 'error');
            return;
        }
        window.location.href = `../index.html?action=change-password&email=${encodeURIComponent(user.email)}`;
    } catch (error) {
        console.error('❌ Ошибка перехода к смене пароля:', error);
        Utils.showStatus('Ошибка перехода к смене пароля', 'error');
    }
}

function openSalesDatabaseView() {
    console.log('🔧 Открываем интерфейс продаж для менеджера');
    document.getElementById('sales-separate-interface').classList.remove('hidden');
    resetCalculatorForm();
    setupCalculator();
    Utils.showLastUpdate(currentDatabase, 'last-update-separate');
}

function selectDatabase(dbType, options = {}) {
    currentDatabase = dbType;
    window.currentDatabase = dbType;
    console.log('🎯 Выбран тип базы данных:', dbType);
    setSalesMenuState('separate', dbType);
    
    document.getElementById('database-selection').classList.add('hidden');
    
    if (options.skipLoad) {
        openSalesDatabaseView();
    } else {
        // Синхронизируем данные с сервером при каждом входе
        loadDatabaseData().then(() => {
            openSalesDatabaseView();
        });
    }
    console.log('📊 Проверка структуры tariff данных:', {
        hasTariffData: !!database.tariff,
        tariffLength: database.tariff?.length || 0,
        tariffStructure: database.tariff?.slice(0, 3) || 'нет данных',
        firstTariff: database.tariff?.[0] || 'нет данных'
    });
}

function goBack() {
    console.log('🔙 Нажата кнопка "Назад":', { currentDatabase, currentCalculationType });
    
    if (currentDatabase) {
        // Возврат из отдельных ставок к выбору типа базы данных
        console.log('🔙 Возврат из отдельных ставок к выбору типа базы данных');
        resetCalculatorForm();
        currentDatabase = '';
        window.currentDatabase = '';
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
    setSalesMenuState(currentCalculationType, currentDatabase);
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

    const multiselects = document.querySelectorAll('.trd-multiselect');
    multiselects.forEach(select => {
        select.dataset.selected = '[]';
        select.classList.remove('is-open');
        const trigger = select.querySelector('.trd-ms-trigger');
        if (trigger) trigger.textContent = 'Все';
        select.querySelectorAll('input[type=\"checkbox\"]').forEach(input => {
            input.checked = false;
        });
        const search = select.querySelector('.trd-ms-search');
        if (search) search.value = '';
    });
    
    // Сбрасываем флаги
    is20ftOver24Tons = false;
    isVTTTrigger = false;
}

async function refreshComplexData() {
    try {
        await loadExchangeRate();
        await loadDatabaseData();
    } catch (error) {
        console.warn('❌ Ошибка обновления данных для комплексных ставок:', error);
    }

    const apiStatus = document.getElementById('rb-summary-api');
    if (apiStatus) {
        const now = new Date();
        apiStatus.textContent = `Обновлено: ${now.toLocaleDateString('ru-RU')} ${now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
    }

    const departure = document.getElementById('complex-departure')?.value?.trim();
    const destination = document.getElementById('complex-destination')?.value?.trim();
    const containerType = document.getElementById('complex-container-type')?.value;

    if (departure && destination && containerType) {
        calculateAllRates(departure, destination, containerType);
    }
}

function saveAuthTokenSimple() {
    const input = document.getElementById('complex-auth');
    if (!input) return;
    const value = input.value.trim();
    if (value) {
        localStorage.setItem('auth_token', value);
        if (window.Utils && typeof window.Utils.showStatus === 'function') {
            window.Utils.showStatus('Токен сохранен', 'success');
        }
    } else {
        localStorage.removeItem('auth_token');
        if (window.Utils && typeof window.Utils.showStatus === 'function') {
            window.Utils.showStatus('Токен очищен', 'warning');
        }
    }
}

async function loadApiData() {
    try {
        await loadDatabaseData();
    } catch (error) {
        console.warn('❌ Ошибка загрузки данных из API:', error);
    }
    const apiStatus = document.getElementById('rb-summary-api');
    if (apiStatus) {
        const now = new Date();
        apiStatus.textContent = `Обновлено: ${now.toLocaleDateString('ru-RU')} ${now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
    }
}

function applyComplexCalculation() {
    const departure = document.getElementById('complex-departure')?.value?.trim();
    const destination = document.getElementById('complex-destination')?.value?.trim();
    const containerType = document.getElementById('complex-container-type')?.value;

    if (!departure || !destination || !containerType) {
        if (window.Utils && typeof window.Utils.showStatus === 'function') {
            window.Utils.showStatus('Заполните маршрут и тип контейнера', 'warning');
        } else {
            alert('Заполните маршрут и тип контейнера');
        }
        updateComplexSummary([]);
        return;
    }

    calculateAllRates(departure, destination, containerType);
}

function exportComplexResults() {
    const results = window.displayedResults || window.allResults || [];
    if (!results.length) {
        if (window.Utils && typeof window.Utils.showStatus === 'function') {
            window.Utils.showStatus('Нет данных для экспорта', 'warning');
        } else {
            alert('Нет данных для экспорта');
        }
        return;
    }

    const header = [
        'Тип',
        'Маршрут',
        'Ставка',
        'Валюта',
        'Линия',
        'Агент',
        'Доп.инфо'
    ];

    const lines = [
        header.join(';'),
        ...results.map(result => {
            const route = result.data?.connection || `${result.data?.sea?.pol || result.data?.pol || '-'} → ${result.data?.rail?.destination || result.data?.pod || '-'}`;
            const line = result.data?.sea?.carrier || result.data?.carrier || '-';
            const agent = result.data?.rail?.agent || result.data?.agent || '-';
            const info = result.transportName || '-';
            return [
                result.transportName || '',
                route,
                result.rate || '',
                result.currency || '',
                line,
                agent,
                info
            ].map(value => `"${String(value).replace(/\"/g, '\"\"')}"`).join(';');
        })
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `complex_rates_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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
                const city = document.getElementById('sea-city').value;
                const pod = document.getElementById('sea-pod').value;
                const dropOffArea = document.getElementById('sea-drop-off-area').value;
                const containerType = this.value;
                
                if (pol && city && pod && dropOffArea && containerType) {
                    console.log('🎯 Расчет морских ставок:', { pol, city, pod, dropOffArea, containerType });
                    const result = searchSeaRates(pol, city, pod, dropOffArea, containerType);
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
                        <th>Город</th>
                        <th>POD</th>
                        <th>DROP OFF AREA</th>
                        <th>Тип контейнера</th>
                        <th>Ставка ($)</th>
                        <th>Линия</th>
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
            <tr style="cursor: pointer;">
                <td>${result.pol || '-'}</td>
                <td>${result.city || '-'}</td>
                <td>${result.pod || '-'}</td>
                <td>${result.dropOffArea || '-'}</td>
                <td>${containerTypeDisplay}</td>
                <td>$${rate}</td>
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
        case 'soc_20': return 'SOC 20\' COC';
        case 'soc_40': return 'SOC 40\' COC';
        case 'dc_20': return '20\'DC COC';
        case 'hc_40': return '40\'HC COC';
        case 'dc_20_direct': return '20\'DC COC';
        case 'hc_40_direct': return '40\'HC COC';
        case 'container20Under24': return '20\'DC COC';
        case 'container20Over24': return '20\'DC COC';
        case 'container40': return '40\'HC COC';
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
            <tr style="cursor: pointer;">
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
    
    // 🔧 СОРТИРОВКА ПО СТАВКАМ FOB ОТ МЕНЬШЕГО К БОЛЬШЕМУ
    const sortedResults = [...results].sort((a, b) => {
        const rateA = parseFloat(a.fob40hc) || 0;
        const rateB = parseFloat(b.fob40hc) || 0;
        return rateA - rateB;
    });
    
    let tableHTML = `
        <div class="results-section">
            <h4>Результаты расчета прямых ЖД перевозок</h4>
            ${usdToRubRate ? `<div class="exchange-rate-info"><small>Курс ЦБ РФ: 1 USD = ${usdToRubRate} RUB</small></div>` : ''}
            <table>
                <thead>
                    <tr>
                        <th>Город погрузки</th>
                        <th>Город прибытия</th>
                        <th>Погран переход</th>
                        <th>Агент</th>
                        <th>Тип контейнера</th>
                        <th>Ставка FOB</th>
                        <th>Ставка EXW/FCA</th>
                        <th>ETD</th>
                        <th>Конвертация</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    sortedResults.forEach((result, index) => {
        // Получаем ставку для 40'HC контейнера (основной тип для прямых ЖД)
        const rate = parseFloat(result.fob40hc) || 0;
        const rateInRub = usdToRubRate ? Math.round(rate * usdToRubRate) : 0;
        
        // Определяем, является ли это самой выгодной ставкой (первая в отсортированном списке)
        const isBestRate = index === 0;
        const bestRateClass = isBestRate ? 'best-rate-row' : '';
        
        tableHTML += `
            <tr class="${bestRateClass}" style="cursor: pointer;">
                <td>${result.fob || '-'}</td>
                <td>${result.arrivalCity || '-'}</td>
                <td>${result.borderCrossing || '-'}</td>
                <td>${result.agent || '-'}</td>
                <td>40'HC</td>
                <td>$${rate}</td>
                <td>${result.exwFca40hc ? '$' + result.exwFca40hc : '-'}</td>
                <td>${result.etd || '-'}</td>
                <td>${result.conversion || '-'}</td>
            </tr>
        `;
    });
    
    tableHTML += `
                </tbody>
            </table>
            <p style="margin-top: 10px; color: #666; font-size: 14px;">
                📊 Найдено ${sortedResults.length} ставок, отсортировано по возрастанию цены FOB
            </p>
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
                        <th>Линия</th>
                        <th>Агент</th>
                        <th>Remark</th>
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
        
        // Определяем, является ли это самой выгодной ставкой (первая в отсортированном списке)
        const isBestRate = index === 0;
        const bestRateClass = isBestRate ? 'best-rate-row' : '';
        
        tableHTML += `
            <tr class="${bestRateClass}" style="cursor: pointer;">
                <td>${result.pol || '-'}</td>
                <td>${result.pod || '-'}</td>
                <td>${containerTypeDisplay}</td>
                <td>$${rate}</td>
                <td>${result.carrier || '-'}</td>
                <td>${result.agent || '-'}</td>
                <td>${result.remarks || '-'}</td>
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

// 🎯 ФУНКЦИЯ ДЛЯ ПОИСКА СТАВОК ДЛЯ МОРЯ (с поддержкой города)
function searchSeaRates(pol, city, pod, dropOffArea, containerType) {
    console.log('🔍 Поиск морских ставок с параметрами:', { pol, city, pod, dropOffArea, containerType });
    
    const data = database.sea;
    
    if (!data || data.length === 0) {
        return { error: 'База данных моря пуста' };
    }
    
    // Используем поисковый движок из модуля моря
    if (window.SeaModule && window.SeaModule.EnhancedSeaSearchEngine) {
        const searchEngine = new window.SeaModule.EnhancedSeaSearchEngine(data);
        const rates = searchEngine.getRatesForRoute(pol, city, pod, dropOffArea, containerType);
        
        if (rates.length === 0) {
            return { error: 'Ставки не найдены для выбранного маршрута' };
        }
        
        return { success: true, data: rates };
    } else {
        // Резервный поиск если модуль недоступен
        const filteredData = data.filter(item =>
            item.pol === pol &&
            item.city === city &&
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
    
    const departureList = document.getElementById('complex-departure-list');
    const destinationList = document.getElementById('complex-destination-list');

    const populateDatalist = (listEl, values) => {
        if (!listEl) return;
        listEl.innerHTML = '';
        values.slice(0, 200).forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            listEl.appendChild(option);
        });
    };

    const updateSuggestions = (inputValue, values, listEl) => {
        const query = normalizeCityName(inputValue || '');
        if (!query) {
            populateDatalist(listEl, values.slice(0, 80));
            return;
        }
        const filtered = values.filter(value => normalizeCityName(value).includes(query)).slice(0, 80);
        populateDatalist(listEl, filtered);
    };

    populateDatalist(departureList, departureValues);
    populateDatalist(destinationList, destinationValues);
    
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

    if (departureInput) {
        departureInput.addEventListener('input', () => updateSuggestions(departureInput.value, departureValues, departureList));
        departureInput.addEventListener('focus', () => updateSuggestions(departureInput.value, departureValues, departureList));
    }
    if (destinationInput) {
        destinationInput.addEventListener('input', () => updateSuggestions(destinationInput.value, destinationValues, destinationList));
        destinationInput.addEventListener('focus', () => updateSuggestions(destinationInput.value, destinationValues, destinationList));
    }

    // Line / Agent / Terminal selects (same idea as test-real-data-check)
    const lineSelect = document.getElementById('complex-line');
    const agentSelect = document.getElementById('complex-agent');
    const terminalSelect = document.getElementById('complex-terminal');
    const rateTypeSelect = document.getElementById('complex-rate-type');
    const lineMultiInput = document.getElementById('complex-line-multi');
    const agentMultiInput = document.getElementById('complex-agent-multi');
    const terminalMultiInput = document.getElementById('complex-terminal-multi');

    const isMeaningfulTerminal = value => {
        if (value === null || value === undefined) return false;
        if (typeof value === 'boolean') return false;
        if (value === 0 || value === 1) return false;
        const normalized = String(value).trim().toLowerCase();
        if (!normalized) return false;
        if (/^(да|нет|true|false|yes|no|0|1)$/i.test(normalized)) return false;
        return true;
    };
    const uniqueSorted = values => [...new Set(values.filter(isMeaningfulTerminal))].sort((a, b) => a.localeCompare(b));
    const updateTriggerLabel = (container) => {
        const trigger = container.querySelector('.trd-ms-trigger');
        const selected = container.dataset.selected ? JSON.parse(container.dataset.selected) : [];
        if (!trigger) return;
        if (selected.length === 0) {
            trigger.textContent = 'Все';
        } else if (selected.length === 1) {
            trigger.textContent = selected[0];
        } else {
            trigger.textContent = `Выбрано: ${selected.length}`;
        }
    };

    const fillSelect = (container, values) => {
        if (!container) return;
        const filtered = container.id === 'complex-terminal'
            ? values.filter(isMeaningfulTerminal)
            : values;
        const optionsContainer = container.querySelector('.trd-ms-options');
        if (!optionsContainer) return;
        if (!container.dataset.selected) container.dataset.selected = '[]';
        const selected = JSON.parse(container.dataset.selected || '[]');
        optionsContainer.innerHTML = '';
        filtered.forEach(value => {
            const option = document.createElement('label');
            option.className = 'trd-ms-option';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = value;
            if (selected.includes(value)) checkbox.checked = true;
            const span = document.createElement('span');
            span.textContent = value;
            option.appendChild(checkbox);
            option.appendChild(span);
            optionsContainer.appendChild(option);
        });
        updateTriggerLabel(container);
    };

    const lineValues = uniqueSorted([
        ...database.sea.map(item => item.carrier),
        ...database.direct_sea.map(item => item.carrier)
    ]);
    const agentValues = uniqueSorted([
        ...database.sea.map(item => item.agent),
        ...database.direct_sea.map(item => item.agent),
        ...database.direct_rail.map(item => item.agent)
    ]);
    const terminalValues = uniqueSorted([
        ...database.rail.map(item => item.agent || item.city || item.destination),
        ...database.direct_rail.map(item => item.departureStation || item.city || item.destination)
    ]);

    fillSelect(lineSelect, lineValues);
    fillSelect(agentSelect, agentValues);
    fillSelect(terminalSelect, terminalValues);

    // мульти-чипы отключены

    const refreshComplexView = () => {
        if (!window.allResults) return;
        const departure = departureInput?.value;
        const destination = destinationInput?.value;
        const containerType = containerTypeSelect?.value;
        if (departure && destination && containerType) {
            displayComplexResults(window.allResults, departure, destination, containerType);
        }
    };

    const setupMultiSelect = (container) => {
        if (!container) return;
        const trigger = container.querySelector('.trd-ms-trigger');
        const panel = container.querySelector('.trd-ms-panel');
        const optionsContainer = container.querySelector('.trd-ms-options');
        const searchInput = container.querySelector('.trd-ms-search');
        const actions = container.querySelector('.trd-ms-actions');
        if (!trigger || !panel || !optionsContainer) return;

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            container.classList.toggle('is-open');
        });

        optionsContainer.addEventListener('change', (e) => {
            const checkbox = e.target.closest('input[type=\"checkbox\"]');
            if (!checkbox) return;
            const selected = container.dataset.selected ? JSON.parse(container.dataset.selected) : [];
            if (checkbox.checked) {
                if (!selected.includes(checkbox.value)) selected.push(checkbox.value);
            } else {
                const idx = selected.indexOf(checkbox.value);
                if (idx !== -1) selected.splice(idx, 1);
            }
            container.dataset.selected = JSON.stringify(selected);
            updateTriggerLabel(container);
            refreshComplexView();
        });

        if (actions) {
            actions.addEventListener('click', (e) => {
                const actionBtn = e.target.closest('.trd-ms-action');
                if (!actionBtn) return;
                const action = actionBtn.dataset.action;
                let selected = container.dataset.selected ? JSON.parse(container.dataset.selected) : [];
                const allValues = Array.from(optionsContainer.querySelectorAll('input[type=\"checkbox\"]')).map(input => input.value);
                if (action === 'all') {
                    selected = [...new Set(allValues)];
                    optionsContainer.querySelectorAll('input[type=\"checkbox\"]').forEach(input => {
                        input.checked = true;
                    });
                }
                if (action === 'clear') {
                    selected = [];
                    optionsContainer.querySelectorAll('input[type=\"checkbox\"]').forEach(input => {
                        input.checked = false;
                    });
                }
                container.dataset.selected = JSON.stringify(selected);
                updateTriggerLabel(container);
                refreshComplexView();
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                const query = searchInput.value.trim().toLowerCase();
                optionsContainer.querySelectorAll('.trd-ms-option').forEach(option => {
                    const text = option.textContent.toLowerCase();
                    option.style.display = text.includes(query) ? 'flex' : 'none';
                });
            });
        }
    };

    [lineSelect, agentSelect, terminalSelect].forEach(setupMultiSelect);

    document.addEventListener('click', (e) => {
        [lineSelect, agentSelect, terminalSelect].forEach(container => {
            if (!container) return;
            if (!container.contains(e.target)) container.classList.remove('is-open');
        });
    });

    if (rateTypeSelect) {
        rateTypeSelect.addEventListener('change', refreshComplexView);
    }
    
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
                    // Получаем стоимость ВТТ из тарифов для терминала (если есть)
                    const terminal = railItem.agent || railItem.city || '';
                    const vttRate = getVttRateForTerminal(terminal);
                    
                    // Для сортировки используем конвертированную сумму в RUB
                    let totalRateForSorting = 0;
                    let currencyForSorting = '$';
                    
                    // Курс ЦБ РФ всегда должен быть загружен для комплексных ставок
                    if (!usdToRubRate) {
                        console.error('❌ Курс ЦБ РФ не загружен! Невозможно рассчитать комплексные ставки');
                        return; // Пропускаем эту ставку если курс не загружен
                    }
                    
                    // Конвертируем морскую ставку в RUB и складываем с ЖД ставкой
                    totalRateForSorting = Math.round(seaRate * usdToRubRate) + railRate;
                    currencyForSorting = 'RUB';
                    
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
                            sea: {
                                ...seaItem,
                                containerType: containerType
                            },
                            rail: {
                                ...railItem,
                                containerType: containerType
                            },
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
    // 🔧 ИСПРАВЛЕНИЕ: Конвертируем все ставки в RUB для корректной сортировки
    allResults.sort((a, b) => {
        // Безопасная сортировка с проверкой на undefined и null
        let rateA = a.rate || 0;
        let rateB = b.rate || 0;
        
        // 🔧 Конвертируем USD в RUB для сортировки
        if (a.currency === '$' && usdToRubRate) {
            rateA = rateA * usdToRubRate;
        }
        if (b.currency === '$' && usdToRubRate) {
            rateB = rateB * usdToRubRate;
        }
        
        return rateA - rateB;
    });

    console.log('📊 Отсортированные результаты комплексного расчета:',
        allResults.map(r => ({ type: r.transportType, rate: r.rate, name: r.transportName, currency: r.currency })));

    // Сохраняем результаты в глобальную переменную для доступа из модального окна и фильтров
    window.allResults = allResults;
    window.displayedResults = allResults;

    // Обновляем доступные значения фильтров на основе текущего набора результатов
    if (typeof window.refreshLinkedFilterOptions === 'function') {
        window.refreshLinkedFilterOptions(window.allResults);
    }
    
    // Отображаем результаты
    displayComplexResults(allResults, departure, destination, containerType);
}

function formatSummaryRate(rate, currency) {
    if (!rate || Number.isNaN(rate)) return '—';
    const rounded = Math.round(Number(rate));
    if (currency === 'RUB') return `${rounded.toLocaleString('ru-RU')} ₽`;
    return `$${rounded.toLocaleString('ru-RU')}`;
}

function updateComplexSummary(results) {
    const totalEl = document.getElementById('rb-summary-total');
    const splitEl = document.getElementById('rb-summary-split');
    const bestEl = document.getElementById('rb-summary-best');
    const avgEl = document.getElementById('rb-summary-avg');
    const noteEl = document.getElementById('rb-summary-note');

    if (!totalEl || !splitEl || !bestEl || !avgEl || !noteEl) return;

    const safeResults = Array.isArray(results) ? results : [];
    totalEl.textContent = `${safeResults.length} ставок`;

    if (!safeResults.length) {
        splitEl.textContent = '—';
        bestEl.textContent = '—';
        avgEl.textContent = '—';
        noteEl.textContent = 'Нет ставок по выбранным фильтрам.';
        return;
    }

    const split = safeResults.reduce((acc, item) => {
        const key = item.transportName || item.transportType || 'Другое';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    splitEl.textContent = Object.entries(split)
        .map(([label, count]) => `${count} ${label.toLowerCase()}`)
        .join(' · ');

    const sorted = [...safeResults].sort((a, b) => {
        let rateA = a.rate || 0;
        let rateB = b.rate || 0;
        if (a.currency === '$' && usdToRubRate) rateA = rateA * usdToRubRate;
        if (b.currency === '$' && usdToRubRate) rateB = rateB * usdToRubRate;
        return rateA - rateB;
    });

    bestEl.textContent = formatSummaryRate(sorted[0].rate, sorted[0].currency);
    avgEl.textContent = '—';
    noteEl.textContent = 'Выберите строку, чтобы увидеть детали выбранной ставки.';
}

window.updateComplexSummary = updateComplexSummary;

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
    window.currentUser = currentUser;
    if (!currentUser || (currentUser.role !== 'sales' && currentUser.role !== 'admin')) {
        // Если пользователь не авторизован или не имеет прав доступа, перенаправляем на главную
        console.log('❌ Неавторизованный доступ, перенаправление на главную');
        window.location.href = '../index.html';
        return;
    }

    document.body.classList.add('sidebar-visible');

    const sidebarEmail = document.getElementById('sidebar-user-email');
    if (sidebarEmail && currentUser?.email) {
        sidebarEmail.textContent = currentUser.email;
    }
    
    console.log('✅ Пользователь авторизован:', currentUser.email, 'Роль:', currentUser.role);
    
    // Загружаем курс ЦБ РФ
    await loadExchangeRate();
    
    // Автоматически загружаем данные с сервера при запуске
    await loadDatabaseData();
    console.log('✅ Данные загружены с сервера при инициализации');
    
    // Добавляем отображение текущего курса
    addExchangeRateDisplay();
    
    // Инициализируем систему фильтров
    initializeFilters();
    
    // Пытаемся применить deep-link из URL
    const deepLinkApplied = applySalesDeepLink();
    
    // Показываем выбор типа расчета только если deep-link не применен
    if (!deepLinkApplied) {
        document.getElementById('calculation-type-selection').classList.remove('hidden');
    }
});

// Функции для загрузки данных и курса валют
async function loadDatabaseData() {
    // 🔧 ЗАГРУЗКА ДАННЫХ ИЗ СЕРВЕРА ДЛЯ ВСЕХ ТИПОВ БАЗ
    const dbTypes = ['sea', 'rail', 'direct_rail', 'direct_sea', 'tariff', 'agent_tariff'];
    
    for (const dbType of dbTypes) {
        try {
            // Используем ServerAuth.makeAuthRequest для авторизованных запросов
            const response = await ServerAuth.makeAuthRequest(`/api/data/${dbType}`);
            
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
    
    // 🔧 ОБНОВЛЯЕМ ПРЕДЛОЖЕНИЯ ДЛЯ ФИЛЬТРОВ ПОСЛЕ ЗАГРУЗКИ ДАННЫХ
    if (typeof collectFilterSuggestions === 'function') {
        collectFilterSuggestions();
        
        // Если фильтры уже инициализированы, обновляем автозаполнение
        if (typeof setupFilterInputs === 'function') {
            setTimeout(() => {
                setupFilterInputs();
                console.log('✅ Предложения для фильтров обновлены после загрузки данных');
            }, 100);
        }
    }
}

function applySalesDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const calcType = params.get('calc');
    const dbType = params.get('db');
    
    if (!calcType) {
        return false;
    }
    
    if (calcType === 'complex') {
        selectCalculationType('complex');
        return true;
    }
    
    if (calcType === 'separate') {
        selectCalculationType('separate');
        if (dbType) {
            const allowed = ['sea', 'rail', 'direct_rail', 'direct_sea'];
            if (allowed.includes(dbType)) {
                selectDatabase(dbType, { skipLoad: true });
            }
        }
        return true;
    }
    
    return false;
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
        Utils.showStatus('❌ ОШИБКА: Не удалось загрузить курс ЦБ РФ. Комплексные ставки не будут работать!', 'error');
        return false;
    }
}

function updateExchangeRateDisplay() {
    const exchangeEl = document.getElementById('exchange-rate-value');
    if (exchangeEl) {
        exchangeEl.textContent = usdToRubRate || '-';
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
