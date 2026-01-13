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
    tariff: [],
    agent_tariff: []
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
    onsole.log('📊 Проверка структуры tariff данных:', {
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
            <tr style="cursor: pointer;">
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
            <tr style="cursor: pointer;">
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
            <tr style="cursor: pointer;">
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

    // Сохраняем результаты в глобальную переменную для доступа из модального окна
    window.allResults = allResults;
    
    // Отображаем результаты
    displayComplexResults(allResults, departure, destination, containerType);
}

function displayComplexResults(results, departure, destination, containerType) {
    const resultsSection = document.getElementById('results');
    const ratesTable = document.getElementById('rates-table');
    
    // 🔧 ДОПОЛНИТЕЛЬНАЯ ОТЛАДКА ДЛЯ ПРОВЕРКИ СОРТИРОВКИ
    console.log('🔧 Отладочная информация перед отображением:');
    results.forEach((result, index) => {
        // 🔧 Показываем конвертированные значения для сортировки
        let rateForSorting = result.rate;
        if (result.currency === '$' && usdToRubRate) {
            rateForSorting = Math.round(result.rate * usdToRubRate);
        }
        console.log(`  ${index + 1}. ${result.transportName}: ${result.rate} ${result.currency} (${rateForSorting} RUB для сортировки)`);
    });
    
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
                        <th>Агент</th>
                        <th>Перевозчик</th>
                        <th>ETD</th>
                        <th>Дата действия</th>
                        <th>Ставка ЖД</th>
                        <th>Станция отправления</th>
                        <th>Погран переход</th>
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
        let carrier = '-';
        let agent = '-';
        let etd = '-';
        let dateOfValidity = '-';
        let departureStation = '-';
        let borderCrossing = '-';
        let additionalInfo = '';
        
        if (result.transportType === 'direct_rail') {
            seaRate = '-';
            railRate = `$${result.rate}`;
            totalRate = usdToRubRate ? `${Math.round(result.rate * usdToRubRate)} RUB` : `$${result.rate}`;
            carrier = '-';
            agent = result.data.agent || '-';
            etd = result.data.etd || '-';
            dateOfValidity = '-';
            departureStation = result.data.departureStation || '-';
            borderCrossing = result.data.borderCrossing || '-';
            additionalInfo = `Станция прибытия: ${result.data.arrivalStation || 'Не указана'}`;
        } else if (result.transportType === 'direct_sea') {
            seaRate = `$${result.rate}`;
            railRate = '-';
            totalRate = usdToRubRate ? `${Math.round(result.rate * usdToRubRate)} RUB` : `$${result.rate}`;
            carrier = result.data.carrier || '-';
            agent = result.data.agent || '-';
            etd = result.data.etd || '-';
            dateOfValidity = result.data.dateOfValidity || '-';
            departureStation = '-';
            borderCrossing = '-';
            additionalInfo = `Агент: ${result.data.agent || 'Не указан'}`;
        } else if (result.transportType === 'sea') {
            seaRate = `$${result.rate}`;
            railRate = '-';
            totalRate = usdToRubRate ? `${Math.round(result.rate * usdToRubRate)} RUB` : `$${result.rate}`;
            carrier = result.data.carrier || '-';
            agent = result.data.agent || '-';
            etd = result.data.etd || '-';
            dateOfValidity = result.data.dateOfValidity || '-';
            departureStation = '-';
            borderCrossing = '-';
            additionalInfo = `DROP OFF AREA: ${result.data.dropOffArea || 'Не указан'}`;
        } else if (result.transportType === 'rail') {
            seaRate = '-';
            railRate = `${result.rate} RUB`;
            totalRate = `${result.rate} RUB`;
            carrier = '-';
            agent = result.data.agent || '-';
            etd = '-';
            dateOfValidity = '-';
            departureStation = '-';
            borderCrossing = '-';
            additionalInfo = `Агент: ${result.data.agent || 'Не указан'}`;
        } else if (result.transportType === 'sea_rail') {
            // Комплексная ставка: море в USD, ЖД в RUB
            const seaRateUSD = result.data.seaRate || 0;
            const railRateRUB = result.data.railRate || 0;
            
            seaRate = `$${seaRateUSD}`;
            railRate = `${railRateRUB} RUB`;
            
            // Для комплексных ставок Море+ЖД всегда отображаем в RUB
            // (курс ЦБ РФ всегда должен быть загружен)
            totalRate = `${result.rate} RUB`;
            
            // Для комплексных ставок берем данные из морской части
            carrier = result.data.sea.carrier || '-';
            agent = result.data.sea.agent || '-';
            etd = result.data.sea.etd || '-';
            dateOfValidity = result.data.sea.dateOfValidity || '-';
            departureStation = '-';
            borderCrossing = '-';
            
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
                    </span>
                </td>
                <td>${seaRate}</td>
                <td>${agent}</td>
                <td>${carrier}</td>
                <td>${etd}</td>
                <td>${dateOfValidity}</td>
                <td>${railRate}</td>
                <td>${departureStation}</td>
                <td>${borderCrossing}</td>
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

// Расчет и отображение результата с накруткой в виде таблицы
// Расчет и отображение результата с накруткой в виде таблицы
function calculateAndDisplayMargin() {
    if (!currentResultForMargin) return;
    
    const resultContainer = document.getElementById('margin-result-container');
    let resultHTML = '';
    
    let transportType = currentResultForMargin.transportType;
    let data = currentResultForMargin.data;
    
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
    
    // Генерируем таблицу в зависимости от типа перевозки
    let tableHTML = '';
    let textTable = ''; // текстовое представление для копирования
    
    // Общая логика для всех типов перевозок
    if (components.length === 2) { // Комплексные перевозки (Море+ЖД)
        const seaFinal = components[0].baseRate + components[0].margin;
        const railFinal = components[1].baseRate + components[1].margin;
        
        tableHTML = `
            <table class="margin-table">
                <thead>
                    <tr>
                        <th>Услуга</th>
                        <th>Стоимость услуг</th>
                        <th>Валюта</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${components[0].description}</td>
                        <td>${seaFinal}</td>
                        <td>${components[0].currency}</td>
                    </tr>
                    <tr>
                        <td>${components[1].description}</td>
                        <td>${railFinal}</td>
                        <td>${components[1].currency}</td>
                    </tr>
                </tbody>
            </table>
        `;
        
        textTable = `Услуга\tСтоимость услуг\tВалюта\n`;
        textTable += `${components[0].description}\t${seaFinal}\t${components[0].currency}\n`;
        textTable += `${components[1].description}\t${railFinal}\t${components[1].currency}`;
        
    } else if (components.length === 1) { // Отдельные перевозки
        const finalRate = components[0].baseRate + components[0].margin;
        
        tableHTML = `
            <table class="margin-table">
                <thead>
                    <tr>
                        <th>Услуга</th>
                        <th>Стоимость услуг</th>
                        <th>Валюта</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${components[0].description}</td>
                        <td>${finalRate}</td>
                        <td>${components[0].currency}</td>
                    </tr>
                </tbody>
            </table>
        `;
        
        textTable = `Услуга\tСтоимость услуг\tВалюта\n`;
        textTable += `${components[0].description}\t${finalRate}\t${components[0].currency}`;
    }
    
    resultHTML = tableHTML;
    
    // Добавляем информацию о ВТТ отдельно, если это комплексная ставка и ВТТ включен
if (transportType === 'sea_rail' && data.vttIncluded) {
    const vttText = `ВТТ : ${data.vttRate} RUB`;
    resultHTML += `
        <div class="vtt-section" style="margin-top: 13px;">
            <p style="font-weight: bold; font-size: 12px; margin-bottom: 5px; color: #333;">
                ${vttText}
            </p>
        </div>
    `;
    textTable += `\nВТТ\t${data.vttRate}\tRUB`;
}
    
    // Добавляем блок дополнительной информации с динамическими данными
    let infoHTML = generateAdditionalInfo(transportType, data, storageInfo, terminalInfo, components);
    resultHTML += infoHTML;
    
    resultContainer.innerHTML = resultHTML;
    
    // Сохраняем текстовое представление в глобальной переменной для копирования
    window.marginTableText = textTable;
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
                    <li>Морской фрахт FILO ${data.sea?.pol || ''} - ${data.sea?.pod || ''}</li>
                    <li>Терминальные услуги в порту прибытия (ПРР с моря на ЖД)</li>
                    <li>${freeStorageDays} дней хранения в порту.</li>
                    ${vttItem}
                    <li>ЖД перевозка ${data.rail?.city || ''} - ${data.rail?.destination || ''}</li>
                </ul>
                <p><strong>В ставки не включено:</strong></p>
                <ul>
                    <li>Таможенное оформление в порту прибытия</li>
                    <li>Доп расходы в порту, вызванные требованиями таможни (МИДК, взвешивание, досмотр груза)</li>
                    <li>Сверхнормативное хранение в порту по тарифам порта, в зависимости от направления выдачи (с ${paidStorageStart} суток)</li>
                    <li>Охрана в пути следования по ЖД</li>
                </ul>
                <p><strong>Примечания:</strong></p>
                <ul>
                    <li>Ставка фиксируется на дату выхода судна</li>
                    <li>Ставка по ЖД фиксируется на дату отправки контейнера по ЖД (НДС 0%)</li>
                    <li>Ставки даны для неопасного груза${data.sea?.dateOfValidity ? `, Валидность по ${data.sea.dateOfValidity}` : ''}</li>
                    ${agentInfo && agentInfo.snp ? `<li>СНП (сверхнормативное пользование контейнером): ${agentInfo.snp}</li>` : ''}
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
                    <li>Морской фрахт FILO ${data.pol || ''} - ${data.pod || ''}</li>
                    <li>Терминальные услуги в порту прибытия</li>
                    <li>${freeStorageDays} дней хранения в порту (в зависимости от тарифа на хранение в порту). Т.е. если у нас хранение для данного типа контейнера в данном порту начинается с ${paidStorageStart} суток, то ${freeStorageDays} дней хранения бесплатных</li>
                    <li>Пользование контейнером 40 сут с момента прибытия в порт назначения</li>
                </ul>
                <p><strong>В ставки не включено:</strong></p>
                <ul>
                    <li>Таможенное оформление в порту прибытия</li>
                    <li>Доп расходы в порту, вызванные требованиями таможни (МИДК, взвешивание, досмотр груза)</li>
                    <li>Сверхнормативное хранение в порту по тарифам порта, в зависимости от направления выдачи (с ${paidStorageStart} суток)</li>
                    <li>Сверхнормативное пользование контейнером с 41-х суток</li>
                </ul>
                <p><strong>Примечания:</strong></p>
                <ul>
                    <li>Ставка фиксируется на дату выхода судна</li>
                    <li>Ставки даны для неопасного груза${data.dateOfValidity ? `, Валидность по ${data.dateOfValidity}` : ''}</li>
                    ${agentInfo && agentInfo.snp ? `<li>СНП (сверхнормативное пользование контейнером): ${agentInfo.snp}</li>` : ''}
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
                    <li>ЖД перевозка ${transportType === 'direct_rail' ? data.fob || '' : data.city || ''} - ${transportType === 'direct_rail' ? data.arrivalCity || '' : data.destination || ''}</li>
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
                    <li>Ставки даны для неопасного груза${data.dateOfValidity || data.validity ? `, Валидность по ${data.dateOfValidity || data.validity || ''}` : ''}</li>
                    ${agentInfo && agentInfo.snp ? `<li>СНП (сверхнормативное пользование контейнером): ${agentInfo.snp}</li>` : ''}
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
                <p>Курс ЦБ РФ: 1 USD = ${usdToRubRate || 'Не загружен'} RUB</p>
            </div>
        </div>
    `;
    
    // 5. Формируем текстовую версию (только таблица и условия)
    const fullText = `
${tableText ? tableText + '\n' : ''}
${vttText ? vttText + '\n' : ''}
${additionalText ? additionalText + '\n' : ''}
---
Курс ЦБ РФ: 1 USD = ${usdToRubRate || 'Не загружен'} RUB
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

// Сохраняем результаты в глобальную переменную для доступа из модального окна
window.allResults = [];