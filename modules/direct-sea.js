// 🎯 МОДУЛЬ ДЛЯ ПРЯМОГО МОРСКОГО ТРАНСПОРТА

// 🎯 УЛУЧШЕННЫЙ ПОИСКОВЫЙ ДВИГ ДЛЯ ПРЯМОГО МОРЯ
class EnhancedDirectSeaSearchEngine {
    constructor(data) {
        this.data = data;
        this.cache = new Map();
    }

    normalizePortName(portName) {
        if (!portName) return '';
        return portName.toString()
            .toLowerCase()
            .trim()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ');
    }

    // Получить POL где есть ненулевые ставки
    getPOLWithRates() {
        const cacheKey = 'pol_with_rates';
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const polWithRates = [...new Set(
            this.data
                .filter(item => (item.dc20 && item.dc20 > 0) || (item.hc40 && item.hc40 > 0))
                .map(item => item.pol)
                .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b));

        this.cache.set(cacheKey, polWithRates);
        console.log('📋 POL с ненулевыми ставками:', polWithRates);
        return polWithRates;
    }

    // Получить POD для выбранного POL где есть ненулевые ставки
    getPODWithRatesForPOL(selectedPOL) {
        if (!selectedPOL) return [];

        const cacheKey = `pod_with_rates_for_${this.normalizePortName(selectedPOL)}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const normalizedPOL = this.normalizePortName(selectedPOL);
        
        const podWithRates = [...new Set(
            this.data
                .filter(item => 
                    this.normalizePortName(item.pol) === normalizedPOL &&
                    ((item.dc20 && item.dc20 > 0) || (item.hc40 && item.hc40 > 0))
                )
                .map(item => item.pod)
                .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b));

        this.cache.set(cacheKey, podWithRates);
        console.log(`🎯 POD с ненулевыми ставками для "${selectedPOL}":`, podWithRates);
        return podWithRates;
    }

    // Получить доступные типы контейнеров для маршрута POL-POD (только с ненулевыми ставками)
    getAvailableContainersWithRates(selectedPOL, selectedPOD) {
        if (!selectedPOL || !selectedPOD) return {};

        const cacheKey = `containers_with_rates_${this.normalizePortName(selectedPOL)}_${this.normalizePortName(selectedPOD)}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const normalizedPOL = this.normalizePortName(selectedPOL);
        const normalizedPOD = this.normalizePortName(selectedPOD);

        const matchingItems = this.data.filter(item =>
            this.normalizePortName(item.pol) === normalizedPOL &&
            this.normalizePortName(item.pod) === normalizedPOD
        );

        const availableContainers = {
            'dc_20': matchingItems.some(item => item.dc20 && item.dc20 > 0),
            'hc_40': matchingItems.some(item => item.hc40 && item.hc40 > 0)
        };

        this.cache.set(cacheKey, availableContainers);
        console.log(`📦 Доступные контейнеры с ненулевыми ставками для "${selectedPOL} → ${selectedPOD}":`, availableContainers);
        return availableContainers;
    }

    // Получить все записи для маршрута POL-POD с ненулевыми ставками (с поддержкой частичного совпадения POD)
    getRatesForRoute(selectedPOL, selectedPOD, containerType) {
        if (!selectedPOL || !selectedPOD) return [];

        const normalizedPOL = this.normalizePortName(selectedPOL);
        const normalizedPOD = this.normalizePortName(selectedPOD);

        return this.data.filter(item =>
            this.normalizePortName(item.pol) === normalizedPOL &&
            (this.normalizePortName(item.pod) === normalizedPOD || this.normalizePortName(item.pod).includes(normalizedPOD)) &&
            this.hasContainerRate(item, containerType)
        );
    }

    hasContainerRate(item, containerType) {
        switch (containerType) {
            case 'dc_20':
                return item.dc20 && item.dc20 > 0;
            case 'hc_40':
                return item.hc40 && item.hc40 > 0;
            default:
                return false;
        }
    }

    clearCache() {
        this.cache.clear();
    }
}

// 🚀 ФУНКЦИЯ ДЛЯ НАСТРОЙКИ ЦЕПНОГО ОБНОВЛЕНИЯ ДЛЯ ПРЯМОГО МОРЯ
function setupEnhancedDirectSeaChainUpdate(data) {
    function resolveElement(primaryId, fallbackIds = []) {
        const primary = document.getElementById(primaryId);
        if (primary) return { el: primary, id: primaryId };
        for (const fallbackId of fallbackIds) {
            const fallback = document.getElementById(fallbackId);
            if (fallback) return { el: fallback, id: fallbackId };
        }
        return { el: null, id: primaryId };
    }

    const polResolved = resolveElement('direct-sea-pol', ['pol']);
    const podResolved = resolveElement('direct-sea-pod', ['pod']);
    const containerResolved = resolveElement('direct-sea-container-type', ['container-type']);

    const polInput = polResolved.el;
    const podInput = podResolved.el;
    const containerTypeSelect = containerResolved.el;
    
    if (!polInput || !podInput || !containerTypeSelect) {
        console.error('❌ Не найдены необходимые элементы DOM для прямого моря');
        return;
    }
    
    console.log('🔧 Инициализация улучшенного цепного обновления для прямого моря с фильтрацией ненулевых ставок и автопоиском');
    const isActive = () => window.currentDatabase === 'direct_sea';
    
    // 🔧 ПРОВЕРЯЕМ ДАННЫЕ
    if (!data || data.length === 0) {
        console.error('❌ Нет данных для прямого моря в setupEnhancedDirectSeaChainUpdate');
        console.log('🔍 Пробуем найти данные в других источниках...');
        
        // Пробуем найти данные в window.database
        if (window.database && window.database.direct_sea) {
            data = window.database.direct_sea;
            console.log('✅ Данные найдены в window.database.direct_sea:', data.length);
        }
        // Пробуем найти данные в localStorage
        else {
            const savedData = localStorage.getItem('logistics_db_direct_sea');
            if (savedData) {
                try {
                    data = JSON.parse(savedData);
                    console.log('✅ Данные найдены в localStorage:', data.length);
                } catch (error) {
                    console.error('❌ Ошибка парсинга данных из localStorage:', error);
                }
            }
        }
        
        if (!data || data.length === 0) {
            console.error('❌ Данные для прямого моря не найдены ни в одном источнике');
            return;
        }
    }
    
    console.log('📊 Данные для прямого моря:', data.length, 'записей');
    
    // Инициализируем улучшенный поисковый движок
    const enhancedDirectSeaSearchEngine = new EnhancedDirectSeaSearchEngine(data);
    
    // 🔧 ФУНКЦИЯ ДЛЯ АВТОМАТИЧЕСКОГО ПОИСКА СТАВОК
    function autoSearchRates() {
        if (!isActive()) return;
        const selectedPOL = polInput.value.trim();
        const selectedPOD = podInput.value.trim();
        const selectedContainerType = containerTypeSelect.value;
        
        console.log('🔍 Автопоиск ставок прямого моря:', {
            POL: selectedPOL,
            POD: selectedPOD,
            ContainerType: selectedContainerType
        });
        
        // Проверяем, что заполнены все обязательные поля
        if (selectedPOL && selectedPOD && selectedContainerType) {
            console.log('✅ Все обязательные поля заполнены, запускаем поиск...');
            
            const rates = enhancedDirectSeaSearchEngine.getRatesForRoute(selectedPOL, selectedPOD, selectedContainerType);
            
            console.log(`📈 Найдено ставок прямого моря: ${rates.length}`, rates);
            
            if (rates.length === 0) {
                console.warn('⚠️ Ставки не найдены для выбранного маршрута');
                // Скрываем результаты если ничего не найдено
                const resultsSection = document.getElementById('results');
                if (resultsSection) resultsSection.classList.add('hidden');
                showStatus('Ставки не найдены для выбранного маршрута', 'warning');
            } else {
                console.log(`✅ Найдено ${rates.length} ставок, отображаем результаты`);
                displayDirectSeaRates(rates, selectedContainerType);
                showStatus(`Найдено ${rates.length} ставок`, 'success');
            }
        } else {
            // Скрываем результаты если не все обязательные поля заполнены
            const resultsSection = document.getElementById('results');
            if (resultsSection) resultsSection.classList.add('hidden');
            console.log('⏳ Ожидание заполнения обязательных полей...');
        }
    }
    
    // Функция для обновления интерфейса
    function updateInterface() {
        if (!isActive()) return;
        const selectedPOL = polInput.value.trim();
        const selectedPOD = podInput.value.trim();
        
        console.log('🔄 Обновление интерфейса прямого моря:', { selectedPOL, selectedPOD });
        
        // 1. Обновляем POL - только с ненулевыми ставки
        const availablePOL = enhancedDirectSeaSearchEngine.getPOLWithRates();
        console.log('📋 Доступные POL с ненулевыми ставками:', availablePOL);
        if (window.Utils && window.Utils.setupCustomDropdown) {
            window.Utils.setupCustomDropdown(polResolved.id, availablePOL);
        } else {
            console.error('❌ Utils.setupCustomDropdown не доступен в прямом море');
        }
        
        // 2. Обновляем POD на основе выбранного POL - только с ненулевыми ставками
        let availablePOD = [];
        if (selectedPOL) {
            availablePOD = enhancedDirectSeaSearchEngine.getPODWithRatesForPOL(selectedPOL);
            console.log(`🎯 Доступные POD с ненулевыми ставками для "${selectedPOL}":`, availablePOD);
        }
        if (window.Utils && window.Utils.setupCustomDropdown) {
            window.Utils.setupCustomDropdown(podResolved.id, availablePOD);
        } else {
            console.error('❌ Utils.setupCustomDropdown не доступен в прямом море для POD');
        }
        
        // 3. Обновляем типы контейнеров на основе выбранного POL и POD - только с ненулевыми ставками
        if (selectedPOL && selectedPOD) {
            const availableContainers = enhancedDirectSeaSearchEngine.getAvailableContainersWithRates(selectedPOL, selectedPOD);
            console.log(`📦 Доступные контейнеры с ненулевыми ставками для "${selectedPOL} → ${selectedPOD}":`, availableContainers);
            
            // Динамически обновляем dropdown контейнеров
            updateContainerTypeDropdown(containerTypeSelect, availableContainers);
        } else {
            // Сбрасываем контейнеры если POL или POD не выбраны
            resetContainerTypeDropdown(containerTypeSelect);
        }
        
        // Очищаем зависимые поля если значения стали недоступны
        cleanupDependentFields(selectedPOL, selectedPOD, availablePOL, availablePOD, containerTypeSelect);
        
        // 🔧 ЗАПУСКАЕМ АВТОМАТИЧЕСКИЙ ПОИСК ПРИ ИЗМЕНЕНИИ ДАННЫХ
        autoSearchRates();
    }
    
    // Функция для обновления dropdown типов контейнеров
    function updateContainerTypeDropdown(selectElement, availableContainers) {
        selectElement.innerHTML = '<option value="">Выберите тип</option>';
        
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
        
        // Если нет доступных контейнеров, показываем сообщение
        if (!hasAvailableContainers) {
            selectElement.innerHTML = '<option value="">Нет доступных контейнеров для выбранного маршрута</option>';
            selectElement.disabled = true;
        } else {
            selectElement.disabled = false;
        }
    }
    
    // Функция для сброса dropdown типов контейнеров
    function resetContainerTypeDropdown(selectElement) {
        selectElement.innerHTML = '<option value="">Сначала выберите POL и POD</option>';
        selectElement.disabled = false;
    }
    
    // Функция для очистки зависимых полей
    function cleanupDependentFields(selectedPOL, selectedPOD, availablePOL, availablePOD, containerTypeSelect) {
        let needsUpdate = false;
        
        // Проверяем POL
        if (selectedPOL && !availablePOL.includes(selectedPOL)) {
            console.log(`⚠️ POL "${selectedPOL}" больше не доступен, очищаем`);
            polInput.value = '';
            podInput.value = '';
            containerTypeSelect.value = '';
            needsUpdate = true;
        }
        
        // Проверяем POD
        if (selectedPOD && selectedPOL && !availablePOD.includes(selectedPOD)) {
            console.log(`⚠️ POD "${selectedPOD}" больше не доступен для POL "${selectedPOL}", очищаем`);
            podInput.value = '';
            containerTypeSelect.value = '';
            needsUpdate = true;
        }
        
        // Если были изменения, обновляем интерфейс
        if (needsUpdate) {
            setTimeout(updateInterface, 0);
        }
    }
    
    // Настраиваем обработчики событий
    polInput.addEventListener('input', function() {
        if (!isActive()) return;
        console.log('📝 Ввод в POL:', this.value);
        updateInterface();
    });
    
    polInput.addEventListener('change', function() {
        if (!isActive()) return;
        console.log('✅ Изменение POL:', this.value);
        // При изменении POL очищаем POD и контейнер
        podInput.value = '';
        containerTypeSelect.value = '';
        updateInterface();
    });
    
    podInput.addEventListener('input', function() {
        if (!isActive()) return;
        console.log('📝 Ввод в POD:', this.value);
        updateInterface();
    });
    
    podInput.addEventListener('change', function() {
        if (!isActive()) return;
        console.log('✅ Изменение POD:', this.value);
        // При изменении POD очищаем контейнер
        containerTypeSelect.value = '';
        updateInterface();
    });
    
    // Обработчик для контейнера - автоматический поиск при изменении
    containerTypeSelect.addEventListener('change', function() {
        if (!isActive()) return;
        console.log('✅ Изменение типа контейнера:', this.value);
        
        if (this.value) {
            const selectedPOL = polInput.value.trim();
            const selectedPOD = podInput.value.trim();
            const selectedContainerType = this.value;
            
            console.log('🎯 Автоматический поиск ставок прямого моря для:', {
                POL: selectedPOL,
                POD: selectedPOD,
                ContainerType: selectedContainerType
            });
            
            // Автоматический поиск ставок
            autoSearchRates();
        }
    });
    
    // 🔧 ДОБАВЛЯЕМ ОБРАБОТЧИК ДЛЯ КЛАВИШИ ENTER
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            const activeElement = document.activeElement;
            if ([polInput, podInput, containerTypeSelect].includes(activeElement)) {
                if (!isActive()) return;
                e.preventDefault();
                console.log('🔍 Запуск поиска по Enter');
                autoSearchRates();
            }
        }
    });
    
    // Инициализируем интерфейс
    updateInterface();
}

// 🎯 ФУНКЦИЯ ДЛЯ ПОИСКА СТАВОК ДЛЯ ПРЯМОГО МОРЯ
function searchDirectSeaRates() {
    const polInput = document.getElementById('direct-sea-pol') || document.getElementById('pol');
    const podInput = document.getElementById('direct-sea-pod') || document.getElementById('pod');
    const containerTypeSelect = document.getElementById('direct-sea-container-type') || document.getElementById('container-type');
    const pol = polInput ? polInput.value.trim() : '';
    const pod = podInput ? podInput.value.trim() : '';
    const containerType = containerTypeSelect ? containerTypeSelect.value : '';
    
    if (!pol || !pod || !containerType) {
        showStatus('Пожалуйста, заполните все обязательные поля', 'error');
        return;
    }
    
    const data = database.direct_sea;
    if (!data || data.length === 0) {
        showStatus('База данных прямого моря пуста', 'error');
        return;
    }
    
    const searchEngine = new EnhancedDirectSeaSearchEngine(data);
    const rates = searchEngine.getRatesForRoute(pol, pod, containerType);
    
    if (rates.length === 0) {
        showStatus('Ставки не найдены для выбранного маршрута', 'warning');
        document.getElementById('results').classList.add('hidden');
        return;
    }
    
    displayDirectSeaRates(rates, containerType);
    showStatus(`Найдено ${rates.length} ставок`, 'success');
}

// 🎯 ФУНКЦИЯ ДЛЯ ОТОБРАЖЕНИЯ СТАВОК ПРЯМОГО МОРЯ
function displayDirectSeaRates(rates, containerType) {
    const table = document.getElementById('rates-table');
    const resultsSection = document.getElementById('results');
    
    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>POL</th>
                    <th>POD</th>
                    <th>${containerType === 'dc_20' ? '20\'DC' : '40\'HC'}</th>
                    <th>Линия</th>
                    <th>Агент</th>
                    <th>Дата действия</th>
                    <th>ETD</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    rates.forEach(rate => {
        const rateValue = containerType === 'dc_20' ? rate.dc20 : rate.hc40;
        tableHTML += `
            <tr>
                <td>${rate.pol || '-'}</td>
                <td>${rate.pod || '-'}</td>
                <td>$${rateValue || 0}</td>
                <td>${rate.carrier || '-'}</td>
                <td>${rate.agent || '-'}</td>
                <td>${rate.dateOfValidity || '-'}</td>
                <td>${rate.etd || '-'}</td>
            </tr>
        `;
    });
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    table.innerHTML = tableHTML;
    resultsSection.classList.remove('hidden');
}

// Экспортируем функции для использования в основном файле
window.DirectSeaModule = {
    setupEnhancedDirectSeaChainUpdate,
    searchDirectSeaRates,
    displayDirectSeaRates,
    EnhancedDirectSeaSearchEngine
};
