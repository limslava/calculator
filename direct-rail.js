// 🎯 МОДУЛЬ ДЛЯ ПРЯМОГО ЖЕЛЕЗНОДОРОЖНОГО ТРАНСПОРТА С КАСКАДНОЙ ФИЛЬТРАЦИЕЙ И АВТОПОИСКОМ

// 🎯 УЛУЧШЕННЫЙ ПОИСКОВЫЙ ДВИГ ДЛЯ ПРЯМОГО ЖД
class EnhancedDirectRailSearchEngine {
    constructor(data) {
        this.data = data;
        this.cache = new Map();
    }

    normalizeName(name) {
        if (!name) return '';
        return name.toString()
            .toLowerCase()
            .trim()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ');
    }

    // 1. FOB - список где есть ненулевые ставки
    getFOBWithRates() {
        const cacheKey = 'rail_fob_with_rates';
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const fobWithRates = [...new Set(
            this.data
                .filter(item => 
                    (item.fob40hc && parseFloat(item.fob40hc) > 0) || 
                    (item.exwFca40hc && parseFloat(item.exwFca40hc) > 0)
                )
                .map(item => item.fob)
                .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b));

        this.cache.set(cacheKey, fobWithRates);
        console.log('🚆 FOB с ненулевыми ставками:', fobWithRates.length, fobWithRates);
        return fobWithRates;
    }

    // 2. Город прибытия - динамически фильтруется на основе выбранного FOB и показывает где ставки > 0
    getArrivalCitiesWithRatesForFOB(selectedFOB) {
        if (!selectedFOB) return [];

        const cacheKey = `rail_cities_with_rates_for_${this.normalizeName(selectedFOB)}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const normalizedFOB = this.normalizeName(selectedFOB);
        
        // 🔧 ИСПРАВЛЕНИЕ: Ищем частичные совпадения FOB
        const citiesWithRates = [...new Set(
            this.data
                .filter(item => {
                    const itemFOB = this.normalizeName(item.fob);
                    // Ищем частичные совпадения (вместо точного)
                    const matchesFOB = itemFOB.includes(normalizedFOB) || normalizedFOB.includes(itemFOB);
                    
                    return matchesFOB && (
                        (item.fob40hc && parseFloat(item.fob40hc) > 0) || 
                        (item.exwFca40hc && parseFloat(item.exwFca40hc) > 0)
                    );
                })
                .map(item => item.arrivalCity)
                .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b));

        this.cache.set(cacheKey, citiesWithRates);
        console.log(`🚆 Города прибытия с ненулевыми ставками для "${selectedFOB}":`, citiesWithRates.length, citiesWithRates);
        return citiesWithRates;
    }

    // 3. Погран переход - динамически фильтруется на основе FOB и Города прибытия (не обязательно)
    getBorderCrossingsWithRates(selectedFOB, selectedArrivalCity) {
        if (!selectedFOB || !selectedArrivalCity) return [];

        const cacheKey = `rail_border_with_rates_${this.normalizeName(selectedFOB)}_${this.normalizeName(selectedArrivalCity)}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const normalizedFOB = this.normalizeName(selectedFOB);
        const normalizedCity = this.normalizeName(selectedArrivalCity);

        // 🔧 ИСПРАВЛЕНИЕ: Частичные совпадения для FOB и Города прибытия
        const borderCrossingsWithRates = [...new Set(
            this.data
                .filter(item => {
                    const itemFOB = this.normalizeName(item.fob);
                    const itemCity = this.normalizeName(item.arrivalCity);
                    
                    // Частичные совпадения для FOB и Города прибытия
                    const matchesFOB = itemFOB.includes(normalizedFOB) || normalizedFOB.includes(itemFOB);
                    const matchesCity = itemCity.includes(normalizedCity) || normalizedCity.includes(itemCity);
                    
                    return matchesFOB && matchesCity && (
                        (item.fob40hc && parseFloat(item.fob40hc) > 0) || 
                        (item.exwFca40hc && parseFloat(item.exwFca40hc) > 0)
                    );
                })
                .map(item => item.borderCrossing)
                .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b));

        this.cache.set(cacheKey, borderCrossingsWithRates);
        console.log(`🚆 Погран переходы с ненулевыми ставками для "${selectedFOB} → ${selectedArrivalCity}":`, borderCrossingsWithRates.length, borderCrossingsWithRates);
        return borderCrossingsWithRates;
    }

    // Получить все записи для маршрута с ненулевыми ставками
    getRatesForRoute(selectedFOB, selectedArrivalCity, selectedBorderCrossing) {
        if (!selectedFOB || !selectedArrivalCity) {
            console.log('❌ Не все обязательные параметры переданы для поиска ставок');
            return [];
        }

        const normalizedFOB = this.normalizeName(selectedFOB);
        const normalizedCity = this.normalizeName(selectedArrivalCity);
        const normalizedBorder = selectedBorderCrossing ? this.normalizeName(selectedBorderCrossing) : null;

        console.log('🔍 Поиск в базе данных прямого жд:', {
            normalizedFOB,
            normalizedCity,
            normalizedBorder,
            totalRecords: this.data.length
        });

        const results = this.data.filter(item => {
            const itemFOB = this.normalizeName(item.fob);
            const itemCity = this.normalizeName(item.arrivalCity);
            
            // Частичные совпадения для FOB и Города прибытия
            const matchesFOB = itemFOB.includes(normalizedFOB) || normalizedFOB.includes(itemFOB);
            const matchesCity = itemCity.includes(normalizedCity) || normalizedCity.includes(itemCity);
            const matchesBorder = !selectedBorderCrossing || this.normalizeName(item.borderCrossing) === normalizedBorder;
            
            const hasRate = (item.fob40hc && parseFloat(item.fob40hc) > 0) || 
                           (item.exwFca40hc && parseFloat(item.exwFca40hc) > 0);

            if (matchesFOB && matchesCity && matchesBorder && hasRate) {
                console.log('✅ Найдена подходящая запись:', item);
            }

            return matchesFOB && matchesCity && matchesBorder && hasRate;
        });

        console.log(`📊 Итоговые результаты поиска прямого жд: ${results.length} записей`);
        return results;
    }

    clearCache() {
        this.cache.clear();
    }
}

// 🚀 ФУНКЦИЯ ДЛЯ НАСТРОЙКИ ЦЕПНОГО ОБНОВЛЕНИЯ ДЛЯ ПРЯМОГО ЖД
function setupEnhancedDirectRailChainUpdate(data) {
    const fobInput = document.getElementById('fob');
    const arrivalCityInput = document.getElementById('arrival-city');
    const borderCrossingInput = document.getElementById('border-crossing');
    
    if (!fobInput || !arrivalCityInput) {
        console.error('❌ Не найдены необходимые элементы DOM для модуля прямого жд');
        return;
    }
    
    console.log('🔧 Инициализация улучшенного цепного обновления для прямого жд с каскадной фильтрацией и автопоиском');
    
    // Инициализируем улучшенный поисковый движок
    const enhancedDirectRailSearchEngine = new EnhancedDirectRailSearchEngine(data);
    
    // 🔧 ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ НАСТРОЙКИ DROPDOWN
    function setupCustomDropdown(inputId, values) {
        if (window.Utils && window.Utils.setupCustomDropdown) {
            window.Utils.setupCustomDropdown(inputId, values);
        } else {
            console.error('❌ Utils.setupCustomDropdown не доступен');
            // Fallback: просто установим placeholder
            const input = document.getElementById(inputId);
            if (input) {
                input.placeholder = `Доступно ${values.length} вариантов`;
            }
        }
    }
    
    // 🔧 ФУНКЦИЯ ДЛЯ АВТОМАТИЧЕСКОГО ПОИСКА СТАВОК
    function autoSearchRates() {
        const selectedFOB = fobInput.value.trim();
        const selectedArrivalCity = arrivalCityInput.value.trim();
        const selectedBorderCrossing = borderCrossingInput ? borderCrossingInput.value.trim() : '';
        
        console.log('🔍 Автопоиск ставок:', { selectedFOB, selectedArrivalCity, selectedBorderCrossing });
        
        // Проверяем, что заполнены обязательные поля
        if (selectedFOB && selectedArrivalCity) {
            console.log('✅ Все обязательные поля заполнены, запускаем поиск...');
            
            // 🔧 ИСПОЛЬЗУЕМ ДАННЫЕ ПЕРЕДАННЫЕ В ФУНКЦИЮ (data)
            if (!data || data.length === 0) {
                console.error('❌ База данных прямого жд пуста в переданных данных');
                
                // 🔧 ПРОБУЕМ НАЙТИ ДАННЫЕ В РАЗНЫХ МЕСТАХ
                let searchData = null;
                
                // 1. Проверяем window.database
                if (window.database && window.database.direct_rail) {
                    searchData = window.database.direct_rail;
                    console.log('✅ Данные найдены в window.database.direct_rail:', searchData.length);
                }
                // 2. Проверяем глобальную переменную database
                else if (window.database && window.database.direct_rail) {
                    searchData = window.database.direct_rail;
                    console.log('✅ Данные найдены в database.direct_rail:', searchData.length);
                }
                // 3. Проверяем localStorage
                else {
                    const savedData = localStorage.getItem('logistics_db_direct_rail');
                    if (savedData) {
                        try {
                            searchData = JSON.parse(savedData);
                            console.log('✅ Данные найдены в localStorage:', searchData.length);
                        } catch (error) {
                            console.error('❌ Ошибка парсинга данных из localStorage:', error);
                        }
                    }
                }
                
                if (!searchData || searchData.length === 0) {
                    console.error('❌ Данные не найдены ни в одном источнике');
                    // Скрываем результаты если ничего не найдено
                    document.getElementById('results').classList.add('hidden');
                    showStatus('База данных прямого жд пуста. Сначала загрузите данные через интерфейс закупщика.', 'error');
                    return;
                }
                
                // Обновляем поисковый движок с найденными данными
                enhancedDirectRailSearchEngine.data = searchData;
                enhancedDirectRailSearchEngine.clearCache();
                
                const rates = enhancedDirectRailSearchEngine.getRatesForRoute(selectedFOB, selectedArrivalCity, selectedBorderCrossing);
                
                if (rates.length === 0) {
                    console.warn('⚠️ Ставки не найдены для выбранного маршрута');
                    // Скрываем результаты если ничего не найдено
                    document.getElementById('results').classList.add('hidden');
                    showStatus('Ставки не найдены для выбранного маршрута', 'warning');
                } else {
                    console.log(`✅ Найдено ${rates.length} ставок, отображаем результаты`);
                    displayDirectRailRates(rates);
                    showStatus(`Найдено ${rates.length} ставок`, 'success');
                }
            } else {
                // Используем переданные данные
                const rates = enhancedDirectRailSearchEngine.getRatesForRoute(selectedFOB, selectedArrivalCity, selectedBorderCrossing);
                
                if (rates.length === 0) {
                    console.warn('⚠️ Ставки не найдены для выбранного маршрута');
                    // Скрываем результаты если ничего не найдено
                    document.getElementById('results').classList.add('hidden');
                    showStatus('Ставки не найдены для выбранного маршрута', 'warning');
                } else {
                    console.log(`✅ Найдено ${rates.length} ставок, отображаем результаты`);
                    displayDirectRailRates(rates);
                    showStatus(`Найдено ${rates.length} ставок`, 'success');
                }
            }
        } else {
            // Скрываем результаты если не все обязательные поля заполнены
            document.getElementById('results').classList.add('hidden');
            console.log('⏳ Ожидание заполнения обязательных полей...');
        }
    }
    
    // Функция для обновления интерфейса
    function updateInterface() {
        const selectedFOB = fobInput.value.trim();
        const selectedArrivalCity = arrivalCityInput.value.trim();
        
        console.log('🔄 Обновление интерфейса прямого жд:', { 
            FOB: selectedFOB, 
            ArrivalCity: selectedArrivalCity 
        });
        
        try {
            // 1. FOB - всегда показываем где есть ненулевые ставки
            const availableFOB = enhancedDirectRailSearchEngine.getFOBWithRates();
            setupCustomDropdown('fob', availableFOB);
            
            // 2. Город прибытия - динамически фильтруется на основе выбранного FOB
            let availableCities = [];
            if (selectedFOB) {
                availableCities = enhancedDirectRailSearchEngine.getArrivalCitiesWithRatesForFOB(selectedFOB);
            }
            setupCustomDropdown('arrival-city', availableCities);
            
            // 3. Погран переход - динамически фильтруется на основе FOB и Города прибытия (не обязательно)
            let availableBorders = [];
            if (selectedFOB && selectedArrivalCity) {
                availableBorders = enhancedDirectRailSearchEngine.getBorderCrossingsWithRates(selectedFOB, selectedArrivalCity);
            }
            setupCustomDropdown('border-crossing', availableBorders);
            
            // Очищаем зависимые поля если значения стали недоступны
            cleanupDependentFields(selectedFOB, selectedArrivalCity, availableFOB, availableCities);
            
            // 🔧 ЗАПУСКАЕМ АВТОМАТИЧЕСКИЙ ПОИСК ПРИ ИЗМЕНЕНИИ ДАННЫХ
            autoSearchRates();
            
        } catch (error) {
            console.error('❌ Ошибка при обновлении интерфейса прямого жд:', error);
        }
    }
    
    // Функция для очистки зависимых полей
    function cleanupDependentFields(selectedFOB, selectedArrivalCity, availableFOB, availableCities) {
        let needsUpdate = false;
        
        // 🔧 ИСПРАВЛЕНИЕ: Не очищаем FOB при вводе, только при реальном изменении
        // Проверяем FOB только если он был выбран из dropdown (полное совпадение)
        if (selectedFOB && selectedFOB.length > 1 && !availableFOB.includes(selectedFOB)) {
            // Проверяем, является ли введенное значение началом какого-то из доступных вариантов
            const isPartialMatch = availableFOB.some(fob => 
                fob.toLowerCase().startsWith(selectedFOB.toLowerCase())
            );
            
            if (!isPartialMatch) {
                console.log(`⚠️ FOB "${selectedFOB}" больше не доступен, очищаем цепочку`);
                fobInput.value = '';
                arrivalCityInput.value = '';
                if (borderCrossingInput) borderCrossingInput.value = '';
                needsUpdate = true;
            }
        }
        
        // Проверяем Город прибытия только если он был выбран из dropdown
        if (selectedArrivalCity && selectedFOB && selectedArrivalCity.length > 1 && !availableCities.includes(selectedArrivalCity)) {
            const isPartialMatch = availableCities.some(city => 
                city.toLowerCase().startsWith(selectedArrivalCity.toLowerCase())
            );
            
            if (!isPartialMatch) {
                console.log(`⚠️ Город прибытия "${selectedArrivalCity}" больше не доступен для FOB "${selectedFOB}", очищаем зависимые поля`);
                arrivalCityInput.value = '';
                if (borderCrossingInput) borderCrossingInput.value = '';
                needsUpdate = true;
            }
        }
        
        // Если были изменения, обновляем интерфейс
        if (needsUpdate) {
            setTimeout(updateInterface, 0);
        }
    }
    
    // Настраиваем обработчики событий для каскадного обновления
    fobInput.addEventListener('input', function() {
        console.log('📝 Ввод в FOB:', this.value);
        updateInterface();
    });
    
    fobInput.addEventListener('change', function() {
        console.log('✅ Изменение FOB:', this.value);
        // При изменении FOB очищаем город прибытия и погран переход
        arrivalCityInput.value = '';
        if (borderCrossingInput) borderCrossingInput.value = '';
        updateInterface();
    });
    
    arrivalCityInput.addEventListener('input', function() {
        console.log('📝 Ввод в Город прибытия:', this.value);
        updateInterface();
    });
    
    arrivalCityInput.addEventListener('change', function() {
        console.log('✅ Изменение Города прибытия:', this.value);
        // При изменении города прибытия очищаем погран переход
        if (borderCrossingInput) borderCrossingInput.value = '';
        updateInterface();
    });
    
    if (borderCrossingInput) {
        borderCrossingInput.addEventListener('input', function() {
            console.log('📝 Ввод в Погран переход:', this.value);
            updateInterface();
        });
        
        borderCrossingInput.addEventListener('change', function() {
            console.log('✅ Изменение Погран перехода:', this.value);
            updateInterface();
        });
    }
    
    // 🔧 ДОБАВЛЯЕМ ОБРАБОТЧИК ДЛЯ КЛАВИШИ ENTER
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            const activeElement = document.activeElement;
            if ([fobInput, arrivalCityInput, borderCrossingInput].includes(activeElement)) {
                e.preventDefault();
                console.log('🔍 Запуск поиска по Enter');
                autoSearchRates();
            }
        }
    });
    
    // Инициализируем интерфейс
    updateInterface();
    console.log('✅ Модуль прямого жд с каскадной фильтрацией и автопоиском инициализирован');
}

// 🎯 ФУНКЦИЯ ДЛЯ ПОИСКА СТАВОК ДЛЯ ПРЯМОГО ЖД (ручной поиск)
function searchDirectRailRates() {
    const fob = document.getElementById('fob').value.trim();
    const arrivalCity = document.getElementById('arrival-city').value.trim();
    const borderCrossing = document.getElementById('border-crossing') ? document.getElementById('border-crossing').value.trim() : '';
    
    console.log('🔍 Ручной поиск ставок прямого жд с параметрами:', { fob, arrivalCity, borderCrossing });
    
    if (!fob || !arrivalCity) {
        showStatus('Пожалуйста, заполните обязательные поля FOB и Город прибытия', 'error');
        return;
    }
    
    // 🔧 ПОИСК ДАННЫХ В РАЗНЫХ ИСТОЧНИКАХ
    let data = null;
    
    // 1. Проверяем window.database
    if (window.database && window.database.direct_rail) {
        data = window.database.direct_rail;
        console.log('✅ Данные найдены в window.database.direct_rail:', data.length);
    }
    // 2. Проверяем localStorage
    else {
        const savedData = localStorage.getItem('logistics_db_direct_rail');
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
        console.error('❌ База данных прямого жд пуста');
        showStatus('База данных прямого жд пуста. Сначала загрузите данные через интерфейс закупщика.', 'error');
        return;
    }
    
    console.log(`📊 Всего записей в базе прямого жд: ${data.length}`);
    
    const searchEngine = new EnhancedDirectRailSearchEngine(data);
    const rates = searchEngine.getRatesForRoute(fob, arrivalCity, borderCrossing);
    
    console.log(`📈 Найдено ставок прямого жд: ${rates.length}`, rates);
    
    if (rates.length === 0) {
        console.warn('⚠️ Ставки не найдены для выбранного маршрута');
        showStatus('Ставки не найдены для выбранного маршрута', 'warning');
        document.getElementById('results').classList.add('hidden');
        return;
    }
    
    displayDirectRailRates(rates);
    showStatus(`Найдено ${rates.length} ставок`, 'success');
}

// 🔧 ФУНКЦИЯ ДЛЯ КОНВЕРТАЦИИ ДАТЫ ИЗ EXCEL ФОРМАТА
function convertExcelDate(excelDate) {
    if (!excelDate) return '-';
    
    // Если это уже строка (текстовая дата), возвращаем как есть
    if (typeof excelDate === 'string') {
        return excelDate;
    }
    
    // Если это число (Excel дата), конвертируем
    if (typeof excelDate === 'number' && excelDate > 0) {
        try {
            const excelEpoch = new Date(1900, 0, 1);
            // Excel имеет баг с 1900 годом (считает его високосным), поэтому корректируем
            const date = new Date(excelEpoch.getTime() + (excelDate - 2) * 24 * 60 * 60 * 1000);
            return date.toLocaleDateString('ru-RU');
        } catch (error) {
            console.error('Ошибка конвертации даты:', error);
            return excelDate.toString();
        }
    }
    
    return excelDate.toString();
}

// 🔧 ФУНКЦИЯ ДЛЯ ПРОВЕРКИ И ОБРАБОТКИ ССЫЛОК
function processLink(text) {
    if (!text) return '-';
    
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const hasUrl = urlRegex.test(text);
    
    if (hasUrl) {
        return text.replace(urlRegex, '<a href="$1" target="_blank" style="color: #0066cc; text-decoration: underline;">$1</a>');
    }
    
    return text;
}

// 🎯 ФУНКЦИЯ ДЛЯ ОТОБРАЖЕНИЯ СТАВОК ПРЯМОГО ЖД
function displayDirectRailRates(rates) {
    console.log('🔄 Отображение ставок прямого жд:', { ratesCount: rates.length });
    
    const table = document.getElementById('rates-table');
    const resultsSection = document.getElementById('results');
    
    if (!table || !resultsSection) {
        console.error('❌ Не найдены элементы для отображения результатов');
        return;
    }
    
    console.log('✅ Элементы для отображения найдены');
    
    // 🔧 СОРТИРОВКА ПО СТАВКАМ FOB ОТ МЕНЬШЕГО К БОЛЬШЕМУ
    const sortedRates = [...rates].sort((a, b) => {
        const rateA = parseFloat(a.fob40hc) || 0;
        const rateB = parseFloat(b.fob40hc) || 0;
        return rateA - rateB;
    });
    
    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>FOB</th>
                    <th>Станция отправления</th>
                    <th>Город прибытия</th>
                    <th>Станция прибытия</th>
                    <th>Погран переход</th>
                    <th>FOB 40'HC</th>
                    <th>EXW/FCA 40'HC</th>
                    <th>Дата котировки</th>
                    <th>ETD</th>
                    <th>Агент</th>
                    <th>Примечания</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    sortedRates.forEach(rate => {
        const fob40hc = rate.fob40hc || 0;
        const exwFca40hc = rate.exwFca40hc || 0;
        const quoteDate = convertExcelDate(rate.quoteDate);
        const etd = processLink(convertExcelDate(rate.etd));
        const remarks = rate.remarks || '-';
        
        tableHTML += `
            <tr>
                <td>${rate.fob || '-'}</td>
                <td>${rate.departureStation || '-'}</td>
                <td>${rate.arrivalCity || '-'}</td>
                <td>${rate.arrivalStation || '-'}</td>
                <td>${rate.borderCrossing || '-'}</td>
                <td>$${fob40hc}</td>
                <td>$${exwFca40hc}</td>
                <td>${quoteDate}</td>
                <td>${etd}</td>
                <td>${rate.agent || '-'}</td>
                <td>${remarks}</td>
            </tr>
        `;
    });
    
    tableHTML += `
            </tbody>
        </table>
        <p style="margin-top: 10px; color: #666; font-size: 14px;">
            📊 Найдено ${sortedRates.length} ставок, отсортировано по возрастанию цены FOB
        </p>
    `;
    
    table.innerHTML = tableHTML;
    resultsSection.classList.remove('hidden');
    console.log(`✅ Отображено ${sortedRates.length} ставок прямого жд`);
}

// 🔧 ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ПОКАЗА СТАТУСА
function showStatus(message, type = '') {
    const statusElement = document.getElementById('upload-status');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = 'status-message';
        if (type) {
            statusElement.classList.add(type);
        }
    }
    console.log(`📢 ${message}`);
}

// Экспортируем функции для использования в основном файле
window.DirectRailModule = {
    setupEnhancedDirectRailChainUpdate,
    searchDirectRailRates,
    displayDirectRailRates,
    EnhancedDirectRailSearchEngine,
    convertExcelDate,
    processLink
};

console.log('✅ Модуль прямого железнодорожного транспорта с каскадной фильтрацией и автопоиском загружен и готов к работе');