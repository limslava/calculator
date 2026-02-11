// Вспомогательные функции интерфейса продаж: фильтры

// 🔧 ГЛОБАЛЬНОЕ СОСТОЯНИЕ ФИЛЬТРОВ
let activeFilters = {
    line: [],      // Фильтры по линии/перевозчику
    agent: [],     // Фильтры по агенту
    terminal: []   // Фильтры по терминалу ЖД
};

// 🔧 КЭШ ДЛЯ УНИКАЛЬНЫХ ЗНАЧЕНИЙ ФИЛЬТРОВ (для автозаполнения)
let filterSuggestions = {
    line: new Set(),
    agent: new Set(),
    terminal: new Set()
};

function normalizeFilterText(value) {
    return String(value || '').trim();
}

function addValuesToSet(targetSet, values) {
    values.forEach(value => {
        const normalized = normalizeFilterText(value);
        if (normalized) {
            targetSet.add(normalized);
        }
    });
}

function getResultFilterValues(result, filterType) {
    const data = result?.data || {};

    if (filterType === 'line') {
        return [
            data.carrier,
            data.line,
            data.shippingLine,
            data.vessel,
            data.sea?.carrier,
            data.sea?.line,
            data.sea?.shippingLine,
            data.sea?.vessel
        ];
    }

    if (filterType === 'agent') {
        return [
            data.agent,
            data.forwarder,
            data.shippingAgent,
            data.sea?.agent,
            data.rail?.agent
        ];
    }

    if (filterType === 'terminal') {
        if (result?.transportType === 'rail') {
            return [
                data.rail?.agent,
                data.agent,
                data.rail?.city,
                data.city
            ];
        }
        if (result?.transportType === 'sea_rail') {
            return [
                data.rail?.agent,
                data.agent,
                data.rail?.departureStation,
                data.departureStation,
                data.rail?.city,
                data.city
            ];
        }
        if (result?.transportType === 'direct_rail') {
            return [
                data.rail?.departureStation,
                data.departureStation,
                data.rail?.city,
                data.city
            ];
        }
        return [
            data.rail?.agent,
            data.rail?.departureStation,
            data.rail?.arrivalStation,
            data.rail?.destination,
            data.agent,
            data.departureStation,
            data.arrivalStation,
            data.destination
        ];
    }

    return [];
}

// 🔧 ФУНКЦИИ ДЛЯ УПРАВЛЕНИЯ ФИЛЬТРАМИ

// Инициализация фильтров при загрузке страницы
function initializeFilters() {
    console.log('🔧 Инициализация системы фильтров');
    
    // Собираем уникальные значения для автозаполнения из всех баз данных
    collectFilterSuggestions();
    
    // Настраиваем обработчики событий для полей ввода фильтров
    setupFilterInputs();
    
    // Инициализируем Excel-подобные фильтры
    initializeExcelFilters();
    
    // Обновляем отображение активных фильтров
    updateActiveFiltersDisplay();
}

// Сбор уникальных значений для автозаполнения фильтров
function collectFilterSuggestions() {
    console.log('🔍 Сбор уникальных значений для фильтров из баз данных');
    
    // Очищаем предыдущие значения
    filterSuggestions.line.clear();
    filterSuggestions.agent.clear();
    filterSuggestions.terminal.clear();
    
    // 1. ЛИНИЯ (ПЕРЕВОЗЧИК) - из моря и прямого моря
    const seaDatabases = ['sea', 'direct_sea'];
    
    seaDatabases.forEach(dbType => {
        const data = database[dbType];
        if (!data || data.length === 0) return;
        
        data.forEach(item => {
            // Линия/перевозчик - проверяем различные возможные поля
            if (item.carrier) {
                filterSuggestions.line.add(item.carrier.trim());
            }
            if (item.line) {
                filterSuggestions.line.add(item.line.trim());
            }
            if (item.shippingLine) {
                filterSuggestions.line.add(item.shippingLine.trim());
            }
            if (item.vessel) {
                filterSuggestions.line.add(item.vessel.trim());
            }
        });
    });
    
    // 2. АГЕНТ - из моря и прямого моря
    seaDatabases.forEach(dbType => {
        const data = database[dbType];
        if (!data || data.length === 0) return;
        
        data.forEach(item => {
            // Агент
            if (item.agent) {
                filterSuggestions.agent.add(item.agent.trim());
            }
            if (item.forwarder) {
                filterSuggestions.agent.add(item.forwarder.trim());
            }
            if (item.shippingAgent) {
                filterSuggestions.agent.add(item.shippingAgent.trim());
            }
        });
    });
    
    // 3. ТЕРМИНАЛ ЖД - из агента жд (не прямое)
    // Пользователь сказал "из агента жд" - берем только поле agent из базы ЖД
    const railDatabases = ['rail']; // Только обычное ЖД, не прямое
    
    railDatabases.forEach(dbType => {
        const data = database[dbType];
        if (!data || data.length === 0) return;
        
        data.forEach(item => {
            // Берем только поле agent (как сказал пользователь "из агента жд")
            if (item.agent) {
                filterSuggestions.terminal.add(item.agent.trim());
            }
        });
    });
    
    console.log('📊 Уникальные значения для фильтров:', {
        line: Array.from(filterSuggestions.line),
        agent: Array.from(filterSuggestions.agent),
        terminal: Array.from(filterSuggestions.terminal)
    });
}

// Настройка обработчиков событий для полей ввода фильтров
function setupFilterInputs() {
    // Поля ввода для фильтров
    const lineInput = document.getElementById('filter-line-input');
    const agentInput = document.getElementById('filter-agent-input');
    const terminalInput = document.getElementById('filter-terminal-input');
    
    if (!lineInput || !agentInput || !terminalInput) {
        const hasExcelFilters = document.querySelector('.excel-filter-container')
            || document.getElementById('filters-panel');
        if (hasExcelFilters) {
            // Используются Excel-стиль фильтры, legacy-инпуты не нужны
            if (!window.salesQuickFiltersBound) {
                setupQuickFilters();
            }
            return;
        }
        console.warn('⚠️ Не найдены поля ввода фильтров. Проверьте HTML структуру.');
        return;
    }
    
    // Настройка автозаполнения для поля "Линия"
    setupFilterAutocomplete(lineInput, 'line', Array.from(filterSuggestions.line));
    
    // Настройка автозаполнения для поля "Агент"
    setupFilterAutocomplete(agentInput, 'agent', Array.from(filterSuggestions.agent));
    
    // Настройка автозаполнения для поля "Терминал"
    setupFilterAutocomplete(terminalInput, 'terminal', Array.from(filterSuggestions.terminal));
    
    // Обработчики событий привязываем один раз, чтобы не дублировать listeners
    if (!window.salesFilterInputsBound) {
        lineInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && lineInput.value.trim()) {
                addFilter('line', lineInput.value.trim());
                lineInput.value = '';
            }
        });
        
        agentInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && agentInput.value.trim()) {
                addFilter('agent', agentInput.value.trim());
                agentInput.value = '';
            }
        });
        
        terminalInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && terminalInput.value.trim()) {
                addFilter('terminal', terminalInput.value.trim());
                terminalInput.value = '';
            }
        });

        // Обработчики для быстрых фильтров (если есть)
        setupQuickFilters();
        window.salesFilterInputsBound = true;
    }
}

// Настройка автозаполнения для поля фильтра
function setupFilterAutocomplete(inputElement, filterType, suggestions) {
    if (!inputElement || !window.Utils || !window.Utils.setupCustomDropdown) {
        return;
    }
    
    // Сортируем предложения по алфавиту
    const sortedSuggestions = suggestions.sort((a, b) => a.localeCompare(b));
    
    // Настраиваем кастомный dropdown
    window.Utils.setupCustomDropdown(inputElement.id, sortedSuggestions);
    
    // Добавляем обработчик для добавления фильтра при выборе из dropdown
    if (inputElement.dataset.filterChangeBound === '1') {
        return;
    }

    inputElement.addEventListener('change', function() {
        if (this.value.trim()) {
            addFilter(filterType, this.value.trim());
            this.value = '';
        }
    });
    inputElement.dataset.filterChangeBound = '1';
}

// Настройка быстрых фильтров
function setupQuickFilters() {
    if (window.salesQuickFiltersBound) {
        return;
    }

    // Быстрые фильтры для линии
    const lineQuickFilters = document.querySelectorAll('.quick-filter-line');
    lineQuickFilters.forEach(button => {
        button.addEventListener('click', function() {
            const value = this.getAttribute('data-value');
            if (value) {
                addFilter('line', value);
            }
        });
    });
    
    // Быстрые фильтры для агента
    const agentQuickFilters = document.querySelectorAll('.quick-filter-agent');
    agentQuickFilters.forEach(button => {
        button.addEventListener('click', function() {
            const value = this.getAttribute('data-value');
            if (value) {
                addFilter('agent', value);
            }
        });
    });
    
    // Быстрые фильтры для терминала
    const terminalQuickFilters = document.querySelectorAll('.quick-filter-terminal');
    terminalQuickFilters.forEach(button => {
        button.addEventListener('click', function() {
            const value = this.getAttribute('data-value');
            if (value) {
                addFilter('terminal', value);
            }
        });
    });

    window.salesQuickFiltersBound = true;
}

// Добавление фильтра
function addFilter(filterType, value) {
    if (!value || !filterType) return;
    
    // Проверяем, не добавлен ли уже такой фильтр
    if (activeFilters[filterType].includes(value)) {
        console.log(`⚠️ Фильтр "${value}" уже добавлен в категорию "${filterType}"`);
        return;
    }
    
    // Добавляем фильтр
    activeFilters[filterType].push(value);
    console.log(`✅ Добавлен фильтр: ${filterType} = "${value}"`);
    
    // Обновляем UI
    updateFilterChipsDisplay(filterType);
    updateActiveFiltersDisplay();
    
    // Применяем фильтры к текущим результатам
    applyFiltersToCurrentResults();
}

// Удаление фильтра
function removeFilter(filterType, value) {
    const index = activeFilters[filterType].indexOf(value);
    if (index !== -1) {
        activeFilters[filterType].splice(index, 1);
        console.log(`🗑️ Удален фильтр: ${filterType} = "${value}"`);
        
        // Обновляем UI
        updateFilterChipsDisplay(filterType);
        updateActiveFiltersDisplay();
        
        // Применяем фильтры к текущим результатам
        applyFiltersToCurrentResults();
    }
}

// Очистка всех фильтров определенного типа
function clearAllFilters(filterType = null) {
    if (filterType) {
        activeFilters[filterType] = [];
        console.log(`🧹 Очищены все фильтры типа: ${filterType}`);
    } else {
        // Очищаем все фильтры
        activeFilters.line = [];
        activeFilters.agent = [];
        activeFilters.terminal = [];
        console.log('🧹 Очищены все фильтры');
    }
    
    // Обновляем UI
    updateFilterChipsDisplay('line');
    updateFilterChipsDisplay('agent');
    updateFilterChipsDisplay('terminal');
    updateActiveFiltersDisplay();
    
    // Применяем фильтры (или сбрасываем их)
    applyFiltersToCurrentResults();
}

// Обновление отображения чипов фильтров
function updateFilterChipsDisplay(filterType) {
    const containerId = `${filterType}-chips-container`;
    const container = document.getElementById(containerId);
    
    if (!container) {
        const hasExcelFilters = document.querySelector('.excel-filter-container')
            || document.getElementById('filters-panel');
        if (hasExcelFilters) {
            return;
        }
        console.warn(`⚠️ Не найден контейнер для чипов: ${containerId}`);
        return;
    }
    
    // Очищаем контейнер
    container.innerHTML = '';
    
    // Добавляем чипы для каждого активного фильтра
    activeFilters[filterType].forEach(value => {
        const chip = document.createElement('div');
        chip.className = 'chip';

        const text = document.createElement('span');
        text.textContent = value;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'chip-remove';
        removeBtn.type = 'button';
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', () => removeFilter(filterType, value));

        chip.appendChild(text);
        chip.appendChild(removeBtn);
        container.appendChild(chip);
    });
}

// Обновление сводки активных фильтров
function updateActiveFiltersDisplay() {
    const summaryContainer = document.getElementById('active-filters-summary');
    if (!summaryContainer) return;
    
    // Считаем общее количество активных фильтров
    const totalFilters = activeFilters.line.length + activeFilters.agent.length + activeFilters.terminal.length;
    
    // Если фильтров нет - оставляем контейнер пустым
    if (totalFilters === 0) {
        summaryContainer.innerHTML = '';
        return;
    }
    
    let summaryHTML = '';
    
    // Добавляем бейджи для каждого типа фильтров
    if (activeFilters.line.length > 0) {
        summaryHTML += `
            <div class="filter-badge">
                <span class="filter-badge-label">Линия:</span>
                <span class="filter-badge-value">${activeFilters.line.length}</span>
            </div>
        `;
    }
    
    if (activeFilters.agent.length > 0) {
        summaryHTML += `
            <div class="filter-badge">
                <span class="filter-badge-label">Агент:</span>
                <span class="filter-badge-value">${activeFilters.agent.length}</span>
            </div>
        `;
    }
    
    if (activeFilters.terminal.length > 0) {
        summaryHTML += `
            <div class="filter-badge">
                <span class="filter-badge-label">Терминал:</span>
                <span class="filter-badge-value">${activeFilters.terminal.length}</span>
            </div>
        `;
    }
    
    // Кнопка очистки всех фильтров
    summaryHTML += `
        <button class="clear-all-filters-btn" onclick="clearAllFilters()">
            Очистить все (${totalFilters})
        </button>
    `;
    
    summaryContainer.innerHTML = summaryHTML;
}

function syncExcelStateWithActiveFilters() {
    ['line', 'agent', 'terminal'].forEach(filterType => {
        const state = excelFilterState[filterType];
        if (!state) return;

        const activeSet = new Set(activeFilters[filterType] || []);
        state.options.forEach(option => {
            option.selected = activeSet.has(option.value);
        });
    });
}

function refreshLinkedFilterOptions(baseResults = window.allResults || []) {
    const sourceResults = Array.isArray(baseResults) ? baseResults : [];

    const availableValues = {
        line: new Set(),
        agent: new Set(),
        terminal: new Set()
    };

    if (sourceResults.length > 0) {
        ['line', 'agent', 'terminal'].forEach(filterType => {
            const candidates = sourceResults.filter(result => matchesAllFilters(result, filterType));
            candidates.forEach(result => {
                addValuesToSet(availableValues[filterType], getResultFilterValues(result, filterType));
            });
        });
    }

    // Удаляем активные фильтры, которые больше не соответствуют текущей выборке
    ['line', 'agent', 'terminal'].forEach(filterType => {
        const allowed = availableValues[filterType];
        activeFilters[filterType] = activeFilters[filterType].filter(value => allowed.has(value));

        filterSuggestions[filterType] = new Set(allowed);

        const sortedOptions = Array.from(allowed)
            .sort((a, b) => a.localeCompare(b))
            .map(value => ({
                value,
                label: value,
                selected: activeFilters[filterType].includes(value)
            }));

        excelFilterState[filterType].options = sortedOptions;
        if (!excelFilterState[filterType].search) {
            excelFilterState[filterType].search = '';
        }

        renderExcelFilterOptions(filterType);
        updateExcelFilterPlaceholder(filterType);
    });

    syncExcelStateWithActiveFilters();
    updateActiveFiltersDisplay();
}

// Применение фильтров к текущим результатам
function applyFiltersToCurrentResults() {
    console.log('🔍 Применение фильтров к текущим результатам');
    
    // Проверяем, есть ли активные фильтры
    const hasActiveFilters = activeFilters.line.length > 0 ||
                            activeFilters.agent.length > 0 ||
                            activeFilters.terminal.length > 0;
    
    if (!hasActiveFilters) {
        console.log('ℹ️ Нет активных фильтров, отображаем все результаты');
        refreshLinkedFilterOptions(window.allResults);
        // Если нет фильтров, просто перерисовываем текущие результаты
        if (window.allResults && window.allResults.length > 0) {
            // Нужно перерисовать результаты с учетом текущих параметров
            const departure = document.getElementById('complex-departure')?.value;
            const destination = document.getElementById('complex-destination')?.value;
            const containerType = document.getElementById('complex-container-type')?.value;
            
            if (departure && destination && containerType) {
                displayComplexResults(window.allResults, departure, destination, containerType);
            }
        }
        return;
    }
    
    // Фильтруем текущие результаты
    if (window.allResults && window.allResults.length > 0) {
        refreshLinkedFilterOptions(window.allResults);
        const filteredResults = window.allResults.filter(result => {
            return matchesAllFilters(result);
        });
        
        console.log(`📊 Результаты после фильтрации: ${filteredResults.length} из ${window.allResults.length}`);
        
        // Отображаем отфильтрованные результаты
        const departure = document.getElementById('complex-departure')?.value;
        const destination = document.getElementById('complex-destination')?.value;
        const containerType = document.getElementById('complex-container-type')?.value;
        
        if (departure && destination && containerType) {
            displayComplexResults(filteredResults, departure, destination, containerType);
        }
    } else {
        console.log('ℹ️ Нет текущих результатов для фильтрации');
    }
}

// Проверка, соответствует ли результат всем активным фильтрам
function matchesAllFilters(result, skipFilterType = null) {
    const filterTypes = ['line', 'agent', 'terminal'];
    for (const filterType of filterTypes) {
        if (skipFilterType === filterType || activeFilters[filterType].length === 0) {
            continue;
        }

        const values = getResultFilterValues(result, filterType)
            .map(value => value?.toString().toLowerCase().trim())
            .filter(Boolean);

        if (values.length === 0) {
            return false;
        }

        const matched = activeFilters[filterType].some(filter => {
            const filterText = filter.toLowerCase().trim();
            return values.some(value =>
                value.includes(filterText) || filterText.includes(value)
            );
        });

        if (!matched) {
            return false;
        }
    }
    
    return true;
}


// 🔧 ПЕРЕКЛЮЧЕНИЕ ВИДИМОСТИ ПАНЕЛИ ФИЛЬТРОВ
function toggleFiltersPanel() {
    const panel = document.getElementById('filters-panel');
    const button = document.getElementById('filters-toggle-btn');
    
    if (!panel || !button) {
        console.error('❌ Не найдены элементы панели фильтров для переключения');
        return;
    }
    
    // Переключаем класс hidden
    panel.classList.toggle('hidden');
    
    // Обновляем иконку кнопки
    const isHidden = panel.classList.contains('hidden');
    const icon = button.querySelector('i');
    
    if (isHidden) {
        // Панель скрыта - показываем плюсик
        if (icon) icon.className = 'fas fa-plus-circle';
        button.title = 'Показать расширенные фильтры';
    } else {
        // Панель видна - показываем минус
        if (icon) icon.className = 'fas fa-minus-circle';
        button.title = 'Скрыть расширенные фильтры';
        
        // Если фильтры еще не инициализированы, инициализируем их
        if (typeof initializeFilters === 'function' && !window.filtersInitialized) {
            initializeFilters();
            window.filtersInitialized = true;
        }
    }
    
    console.log(`🔧 Панель фильтров ${isHidden ? 'скрыта' : 'открыта'}`);
}

// 🔧 EXCEL-ПОДОБНЫЕ ФИЛЬТРЫ
let excelFilterState = {
    line: { options: [], search: '' },
    agent: { options: [], search: '' },
    terminal: { options: [], search: '' }
};

// Переключение видимости Excel-фильтра
function toggleExcelFilter(filterType) {
    const dropdown = document.getElementById(`${filterType}-filter-dropdown`);
    const header = document.querySelector(`#${filterType}-filter-dropdown`).parentElement.querySelector('.excel-filter-header');
    const arrow = document.getElementById(`${filterType}-filter-arrow`);
    
    if (!dropdown || !header || !arrow) return;
    
    // Закрываем другие открытые фильтры
    ['line', 'agent', 'terminal'].forEach(type => {
        if (type !== filterType) {
            const otherDropdown = document.getElementById(`${type}-filter-dropdown`);
            const otherHeader = document.querySelector(`#${type}-filter-dropdown`).parentElement.querySelector('.excel-filter-header');
            const otherArrow = document.getElementById(`${type}-filter-arrow`);
            if (otherDropdown && otherHeader && otherArrow) {
                otherDropdown.classList.add('hidden');
                otherHeader.classList.remove('active');
                otherArrow.style.transform = '';
            }
        }
    });
    
    // Переключаем текущий фильтр
    dropdown.classList.toggle('hidden');
    header.classList.toggle('active');
    
    if (dropdown.classList.contains('hidden')) {
        arrow.style.transform = '';
    } else {
        arrow.style.transform = 'rotate(180deg)';
        // Загружаем опции, если еще не загружены
        loadExcelFilterOptions(filterType);
    }
}

// Загрузка опций для Excel-фильтра
function loadExcelFilterOptions(filterType) {
    const optionsContainer = document.getElementById(`${filterType}-filter-options`);
    if (!optionsContainer) return;
    
    // Используем существующие предложения из filterSuggestions (преобразуем Set в массив)
    const suggestionsSet = filterSuggestions[filterType] || new Set();
    const suggestions = Array.from(suggestionsSet);
    
    // Сохраняем опции в состоянии
    excelFilterState[filterType].options = suggestions.map(value => ({
        value: value,
        label: value,
        selected: false
    }));
    
    // Рендерим опции
    renderExcelFilterOptions(filterType);
}

// Рендеринг опций Excel-фильтра
function renderExcelFilterOptions(filterType) {
    const optionsContainer = document.getElementById(`${filterType}-filter-options`);
    const state = excelFilterState[filterType];
    const searchTerm = state.search.toLowerCase();
    
    if (!optionsContainer) return;
    
    // Фильтруем опции по поисковому запросу
    const filteredOptions = state.options.filter(option =>
        option.label.toLowerCase().includes(searchTerm)
    );
    
    // Сортируем: выбранные сначала, затем по алфавиту
    filteredOptions.sort((a, b) => {
        if (a.selected && !b.selected) return -1;
        if (!a.selected && b.selected) return 1;
        return a.label.localeCompare(b.label);
    });
    
    // Генерируем HTML
    let html = '';
    filteredOptions.forEach(option => {
        html += `
            <div class="excel-filter-option ${option.selected ? 'selected' : ''}"
                 onclick="toggleExcelOption('${filterType}', '${option.value.replace(/'/g, "\\'")}', event)">
                <div class="excel-filter-checkbox ${option.selected ? 'checked' : ''}"></div>
                <span class="excel-filter-option-label">${option.label}</span>
            </div>
        `;
    });
    
    if (filteredOptions.length === 0) {
        html = '<div class="excel-filter-option" style="color: #777; font-style: italic;">Нет результатов</div>';
    }
    
    optionsContainer.innerHTML = html;
    updateExcelFilterPlaceholder(filterType);
}

// Фильтрация опций по поиску
function filterExcelOptions(filterType) {
    const searchInput = document.getElementById(`${filterType}-filter-search`);
    if (!searchInput) return;
    
    excelFilterState[filterType].search = searchInput.value;
    renderExcelFilterOptions(filterType);
}

// Переключение выбора опции
function toggleExcelOption(filterType, value, event) {
    // Предотвращаем всплытие события, чтобы не закрывался выпадающий список
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    const state = excelFilterState[filterType];
    const option = state.options.find(opt => opt.value === value);
    
    if (option) {
        option.selected = !option.selected;
        
        // Обновляем активные фильтры
        if (option.selected) {
            addFilter(filterType, value);
        } else {
            removeFilter(filterType, value);
        }
        
        // Обновляем отображение
        renderExcelFilterOptions(filterType);
        updateExcelFilterPlaceholder(filterType);
    }
}

// Обновление плейсхолдера фильтра
function updateExcelFilterPlaceholder(filterType) {
    const placeholder = document.getElementById(`${filterType}-filter-placeholder`);
    const state = excelFilterState[filterType];
    
    if (!placeholder) return;
    
    const selectedCount = state.options.filter(opt => opt.selected).length;
    
    if (selectedCount === 0) {
        placeholder.textContent = 'Выберите...';
        placeholder.classList.remove('has-selection');
    } else if (selectedCount === 1) {
        const selectedOption = state.options.find(opt => opt.selected);
        placeholder.textContent = selectedOption ? selectedOption.label : '1 выбрано';
        placeholder.classList.add('has-selection');
    } else {
        placeholder.textContent = `Выбрано: ${selectedCount}`;
        placeholder.classList.add('has-selection');
    }
}

// Выбор всех опций
function selectAllExcelOptions(filterType) {
    const state = excelFilterState[filterType];
    
    state.options.forEach(option => {
        if (!option.selected) {
            option.selected = true;
            addFilter(filterType, option.value);
        }
    });
    
    renderExcelFilterOptions(filterType);
    updateExcelFilterPlaceholder(filterType);
}

// Очистка всех опций
function clearAllExcelOptions(filterType) {
    const state = excelFilterState[filterType];
    
    state.options.forEach(option => {
        if (option.selected) {
            option.selected = false;
            removeFilter(filterType, option.value);
        }
    });
    
    renderExcelFilterOptions(filterType);
    updateExcelFilterPlaceholder(filterType);
}

// Инициализация Excel-фильтров при загрузке данных
function initializeExcelFilters() {
    // Загружаем опции для всех фильтров
    ['line', 'agent', 'terminal'].forEach(filterType => {
        loadExcelFilterOptions(filterType);
    });
    
    // Закрываем выпадающие списки при клике вне их
    if (!window.salesExcelOutsideClickBound) {
        document.addEventListener('click', function(event) {
            const isClickInsideFilter = event.target.closest('.excel-filter-container');
            if (!isClickInsideFilter) {
                ['line', 'agent', 'terminal'].forEach(type => {
                    const dropdown = document.getElementById(`${type}-filter-dropdown`);
                    const header = document.querySelector(`#${type}-filter-dropdown`)?.parentElement.querySelector('.excel-filter-header');
                    const arrow = document.getElementById(`${type}-filter-arrow`);
                    if (dropdown && header && arrow) {
                        dropdown.classList.add('hidden');
                        header.classList.remove('active');
                        arrow.style.transform = '';
                    }
                });
            }
        });
        window.salesExcelOutsideClickBound = true;
    }
}

// Сохраняем результаты в глобальную переменную для доступа из модального окна
window.allResults = [];
window.displayedResults = [];

// 🔧 ЭКСПОРТ ФУНКЦИЙ ФИЛЬТРОВ В ГЛОБАЛЬНУЮ ОБЛАСТЬ ВИДИМОСТИ
window.initializeFilters = initializeFilters;
window.addFilter = addFilter;
window.removeFilter = removeFilter;
window.clearAllFilters = clearAllFilters;
window.applyFiltersToCurrentResults = applyFiltersToCurrentResults;
window.toggleFiltersPanel = toggleFiltersPanel;
window.toggleExcelFilter = toggleExcelFilter;
window.filterExcelOptions = filterExcelOptions;
window.toggleExcelOption = toggleExcelOption;
window.selectAllExcelOptions = selectAllExcelOptions;
window.clearAllExcelOptions = clearAllExcelOptions;
window.initializeExcelFilters = initializeExcelFilters;
window.refreshLinkedFilterOptions = refreshLinkedFilterOptions;
