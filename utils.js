// 🎯 УНИВЕРСАЛЬНЫЕ УТИЛИТЫ С ИНТЕГРАЦИЕЙ ВСЕХ МОДУЛЕЙ

// Функция для определения типа транспорта по ID поля
function getTransportTypeByField(inputId) {
    const seaFields = ['pol', 'pod', 'drop-off-area', 'container-type'];
    const directSeaFields = ['pol', 'pod', 'container-type']; 
    const directRailFields = ['departure-station', 'arrival-station', 'arrival-city', 'border-crossing', 'fob'];
    
    if (seaFields.includes(inputId)) return 'sea';
    if (directSeaFields.includes(inputId)) return 'direct_sea';
    if (directRailFields.includes(inputId)) return 'direct_rail';
    
    return 'universal';
}

// Функция для настройки кастомного выпадающего списка
function setupCustomDropdown(inputId, options) {
    const transportType = getTransportTypeByField(inputId);
    
    console.log(`🔧 Настройка dropdown для: ${inputId}, тип: ${transportType}, опций: ${options.length}`);
    
    // 🔧 ДЛЯ МОРСКИХ ПЕРЕВОЗОК - ИСПОЛЬЗУЕМ УНИВЕРСАЛЬНЫЙ DROPDOWN С ДАННЫМИ ИЗ SEA.JS
    if (transportType === 'sea') {
        console.log(`🌊 Настройка морского dropdown для: ${inputId} с ${options.length} опциями`);
        setupUniversalDropdown(inputId, options);
        return;
    }
    
    // 🔧 ДЛЯ ПРЯМОГО МОРЯ - ИСПОЛЬЗУЕМ УНИВЕРСАЛЬНЫЙ DROPDOWN
    if (transportType === 'direct_sea') {
        console.log(`🚢 Настройка прямого морского dropdown для: ${inputId} с ${options.length} опциями`);
        setupUniversalDropdown(inputId, options);
        return;
    }
    
    // 🔧 ДЛЯ ПРЯМОЙ ЖЕЛЕЗНОЙ ДОРОГИ - ИСПОЛЬЗУЕМ УНИВЕРСАЛЬНЫЙ DROPDOWN
    if (transportType === 'direct_rail') {
        console.log(`🚂 Настройка прямого ж/д dropdown для: ${inputId} с ${options.length} опциями`);
        setupUniversalDropdown(inputId, options);
        return;
    }
    
    // 🔧 ДЛЯ ОСТАЛЬНЫХ СЛУЧАЕВ - УНИВЕРСАЛЬНАЯ РЕАЛИЗАЦИЯ
    console.log(`🔧 Используем универсальный dropdown для: ${inputId}`);
    setupUniversalDropdown(inputId, options);
}

// 🔧 УЛУЧШЕННАЯ РЕАЛИЗАЦИЯ DROPDOWN С ВОЗМОЖНОСТЬЮ ПЕЧАТАТИ
// 🔧 УЛУЧШЕННАЯ РЕАЛИЗАЦИЯ DROPDOWN С АВТОДОПОЛНЕНИЕМ
function setupUniversalDropdown(inputId, options) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    // Удаляем существующий dropdown если есть
    const existingDropdown = input.parentNode.querySelector('.custom-dropdown');
    if (existingDropdown) {
        existingDropdown.remove();
    }
    
    // Создаем контейнер для dropdown
    const dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'custom-dropdown';
    dropdownContainer.style.display = 'none';
    dropdownContainer.id = `${inputId}-dropdown`;
    
    // 🔧 ГАРАНТИРУЕМ, ЧТО INPUT ДОСТУПЕН ДЛЯ ВВОДА
    input.readOnly = false;
    input.disabled = false;
    input.autocomplete = 'off';
    input.setAttribute('autocomplete', 'off');
    
    // Добавляем dropdown в DOM
    input.parentNode.appendChild(dropdownContainer);
    
    // Функция для показа отфильтрованных опций
    function showFilteredOptions(searchValue) {
        const searchTerm = searchValue.toLowerCase().trim();
        
        // 🔧 ФИЛЬТРУЕМ ОПЦИИ ПО ВХОЖДЕНИЮ ТЕКСТА (не только начало)
        const filteredOptions = options.filter(option => 
            option.toLowerCase().includes(searchTerm)
        ); // Ограничиваем до 10 результатов
        
        // Обновляем dropdown с отфильтрованными опциями
        dropdownContainer.innerHTML = '';
        
        if (filteredOptions.length === 0 && searchTerm.length > 0) {
            // Показываем сообщение если ничего не найдено
            const noResults = document.createElement('div');
            noResults.className = 'dropdown-option no-results';
            noResults.textContent = 'Ничего не найдено';
            dropdownContainer.appendChild(noResults);
        } else {
            filteredOptions.forEach(option => {
                const optionElement = document.createElement('div');
                optionElement.className = 'dropdown-option';
                optionElement.textContent = option;
                optionElement.addEventListener('click', function() {
                    input.value = option;
                    dropdownContainer.style.display = 'none';
                    input.focus();
                    // 🔧 ТРИГГЕРИМ СОБЫТИЕ CHANGE ДЛЯ ОБНОВЛЕНИЯ ЦЕПОЧКИ
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                });
                dropdownContainer.appendChild(optionElement);
            });
        }
        
        // Показываем dropdown если есть результаты или идет поиск
        dropdownContainer.style.display = (filteredOptions.length > 0 || searchTerm.length > 0) ? 'block' : 'none';
    }
    
    // 🔧 ПОКАЗЫВАЕМ ВСЕ ОПЦИИ ПРИ ФОКУСЕ (если поле пустое)
    input.addEventListener('focus', function() {
        if (options.length > 0) {
            if (this.value.trim() === '') {
                // Если поле пустое, показываем все опции
                showFilteredOptions('');
            } else {
                // Если есть текст, показываем отфильтрованные опции
                showFilteredOptions(this.value);
            }
        }
    });
    
    // 🔧 ОБРАБОТКА ВВОДА С ЗАДЕРЖКОЙ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ
    let inputTimeout;
    input.addEventListener('input', function() {
        clearTimeout(inputTimeout);
        inputTimeout = setTimeout(() => {
            showFilteredOptions(this.value);
        }, 100); // Задержка 100ms для производительности
    });
    
    // 🔧 ОБРАБОТКА КЛАВИШ
    input.addEventListener('keydown', function(e) {
        const options = dropdownContainer.querySelectorAll('.dropdown-option:not(.no-results)');
        
        if (e.key === 'Enter') {
            e.preventDefault();
            const firstOption = options[0];
            if (firstOption && !firstOption.classList.contains('no-results')) {
                input.value = firstOption.textContent;
                dropdownContainer.style.display = 'none';
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        } else if (e.key === 'Escape') {
            dropdownContainer.style.display = 'none';
        } else if (e.key === 'ArrowDown' && options.length > 0) {
            e.preventDefault();
            options[0].focus();
        }
    });
    
    // 🔧 НАВИГАЦИЯ СТРЕЛКАМИ В DROPDOWN
    dropdownContainer.addEventListener('keydown', function(e) {
        const options = this.querySelectorAll('.dropdown-option:not(.no-results)');
        
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const currentFocused = document.activeElement;
            let currentIndex = Array.from(options).indexOf(currentFocused);
            
            if (e.key === 'ArrowDown') {
                currentIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
            } else {
                currentIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
            }
            
            if (options[currentIndex]) {
                options[currentIndex].focus();
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const focusedOption = document.activeElement;
            if (focusedOption && focusedOption.classList.contains('dropdown-option')) {
                input.value = focusedOption.textContent;
                dropdownContainer.style.display = 'none';
                input.focus();
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        } else if (e.key === 'Escape') {
            dropdownContainer.style.display = 'none';
            input.focus();
        }
    });
    
    // Закрываем dropdown при клике вне
    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !dropdownContainer.contains(e.target)) {
            dropdownContainer.style.display = 'none';
        }
    });
    
    // 🔧 ИНИЦИАЛИЗИРУЕМ DROPDOWN ЕСЛИ ЕСТЬ ЗНАЧЕНИЕ В INPUT
    if (input.value.trim() !== '' && options.length > 0) {
        showFilteredOptions(input.value);
    }
}

// Функция для отображения статуса
function showStatus(message, type = '') {
    const statusElement = document.getElementById('status');
    if (!statusElement) {
        console.log('Статус:', message);
        return;
    }
    
    statusElement.textContent = message;
    statusElement.className = 'status';
    
    if (type === 'success') {
        statusElement.classList.add('success');
    } else if (type === 'error') {
        statusElement.classList.add('error');
    } else if (type === 'warning') {
        statusElement.classList.add('warning');
    }
    
    // Автоматически скрываем через 5 секунд
    setTimeout(() => {
        statusElement.textContent = '';
        statusElement.className = 'status';
    }, 5000);
}

// Функция для получения имени базы данных
function getDatabaseName(dbType) {
    const dbNames = {
        'sea': 'Море',
        'rail': 'Железная дорога',
        'direct_rail': 'Прямой жд',
        'direct_sea': 'Прямое море',
        'sea_rail': 'Море+ЖД'
    };
    return dbNames[dbType] || dbType;
}

// Функция для показа последнего обновления
function showLastUpdate() {
    const lastUpdateElement = document.getElementById('last-update');
    if (!lastUpdateElement) return;
    
    const savedUpdate = localStorage.getItem(`last_update_${currentDatabase}`);
    if (savedUpdate) {
        try {
            const updateData = JSON.parse(savedUpdate);
            lastUpdateElement.textContent = `Последнее обновление: ${updateData.formatted}`;
        } catch (e) {
            console.error('Ошибка парсинга даты обновления:', e);
        }
    } else {
        lastUpdateElement.textContent = 'Данные не обновлялись';
    }
}

// Функция для поиска индекса колонки в Excel
function findColumnIndex(headers, possibleNames) {
    for (let name of possibleNames) {
        const index = headers.findIndex(header =>
            header && header.toString().toLowerCase().includes(name.toLowerCase())
        );
        if (index !== -1) return index;
    }
    return -1;
}

// 🔧 УЛУЧШЕННАЯ ФУНКЦИЯ ДЛЯ КОНВЕРТАЦИИ ДАТ ИЗ EXCEL
function convertExcelDate(value) {
    if (!value) return '';
    
    // Если это уже строка, возвращаем как есть
    if (typeof value === 'string') {
        return value.trim();
    }
    
    // Если это число (Excel дата), конвертируем
    if (typeof value === 'number' && value > 0) {
        try {
            const excelEpoch = new Date(1900, 0, 1);
            // Excel имеет баг с 1900 годом (считает его високосным), поэтому корректируем
            const date = new Date(excelEpoch.getTime() + (value - 2) * 24 * 60 * 60 * 1000);
            return date.toLocaleDateString('ru-RU');
        } catch (error) {
            console.error('Ошибка конвертации даты:', error);
            return value.toString();
        }
    }
    
    return value.toString();
}

// Функция для парсинга данных моря
function parseSeaData(excelData) {
    const headers = excelData[0];
    const dataRows = excelData.slice(1);
    const parsedData = [];
    
    const headerMap = {
        dateOfValidity: findColumnIndex(headers, ['Date of validity', 'Дата действия']),
        agent: findColumnIndex(headers, ['Agent', 'Агент']),
        carrier: findColumnIndex(headers, ['Carrier', 'Перевозчик']),
        pol: findColumnIndex(headers, ['POL', 'Порт погрузки']),
        pod: findColumnIndex(headers, ['POD', 'Порт выгрузки']),
        city: findColumnIndex(headers, ['City', 'Город']),
        transitPort: findColumnIndex(headers, ['Transit port', 'Транзитный порт']),
        dropOffArea: findColumnIndex(headers, ['DROP OFF AREA VIA VVO', 'Зона выгрузки']),
        soc20: findColumnIndex(headers, ['SOC 20', 'SOC 20\'']),
        soc40: findColumnIndex(headers, ['SOC 40', 'SOC 40\'']),
        dc20: findColumnIndex(headers, ['20\'DC', '20DC']),
        hc40: findColumnIndex(headers, ['40\'HC', '40HC']),
        conversion: findColumnIndex(headers, ['Конвертация', 'Валюта']),
        etd: findColumnIndex(headers, ['ETD', 'Дата отгрузки']),
        remarks: findColumnIndex(headers, ['Remarks', 'Примечания'])
    };
    
    const criticalFields = ['pol', 'pod'];
    const missingCriticalFields = criticalFields.filter(field => headerMap[field] === -1);
    
    if (missingCriticalFields.length > 0) {
        throw new Error(`Отсутствуют критические колонки: ${missingCriticalFields.join(', ')}`);
    }
    
    dataRows.forEach((row, index) => {
        if (!row || row.length === 0 || !row.some(cell => cell !== null && cell !== undefined && cell !== '')) {
            return;
        }
        
        const item = {};
        
        Object.keys(headerMap).forEach(key => {
            const colIndex = headerMap[key];
            let value = '';
            
            if (colIndex !== -1 && row[colIndex] !== undefined && row[colIndex] !== null && row[colIndex] !== '') {
                value = row[colIndex];
                
                if (['soc20', 'soc40', 'dc20', 'hc40'].includes(key)) {
                    if (typeof value === 'string') {
                        value = value.toString().replace(/\s+/g, '').replace(',', '.');
                    }
                    value = parseFloat(value) || 0;
                }
                
                // 🔧 КОНВЕРТИРУЕМ ДАТЫ ИЗ EXCEL ФОРМАТА
                if (['dateOfValidity', 'etd'].includes(key)) {
                    value = convertExcelDate(value);
                }
                
                if (typeof value === 'string') {
                    value = value.trim();
                }
            }
            
            item[key] = value;
        });
        
        if (item.pol && item.pod) {
            parsedData.push(item);
        }
    });
    
    console.log(`Всего строк в файле: ${dataRows.length}`);
    console.log(`Успешно обработано: ${parsedData.length}`);
    
    if (parsedData.length === 0) {
        throw new Error('Не найдено корректных данных для обработки. Проверьте наличие колонок POL и POD.');
    }
    
    showStatus(`Успешно обработано ${parsedData.length} из ${dataRows.length} записей`, 'success');
    
    return parsedData;
}

// Функция для парсинга данных прямого жд
function parseDirectRailData(excelData) {
    const headers = excelData[0];
    const dataRows = excelData.slice(1);
    const parsedData = [];
    
    const headerMap = {
        quoteDate: findColumnIndex(headers, ['дата котировки', 'Date of quote', 'Quote date']),
        agent: findColumnIndex(headers, ['Agent', 'Агент']),
        fob: findColumnIndex(headers, ['FOB', 'FOB']),
        departureStation: findColumnIndex(headers, ['станция отправления', 'Departure station', 'Station of departure']),
        borderCrossing: findColumnIndex(headers, ['погран переход', 'Border crossing', 'Border']),
        arrivalCity: findColumnIndex(headers, ['город прибытия', 'Arrival city', 'City of arrival']),
        arrivalStation: findColumnIndex(headers, ['станция прибытия', 'Arrival station', 'Station of arrival']),
        fob40hc: findColumnIndex(headers, ['FOB 40\'HC', 'FOB 40HC', 'FOB 40']),
        exwFca40hc: findColumnIndex(headers, ['EXW/FCA 40\'HC', 'EXW FCA 40HC', 'EXW/FCA 40']),
        etd: findColumnIndex(headers, ['ETD', 'ETD']),
        conversion: findColumnIndex(headers, ['Конвертация', 'Currency', 'Conversion']),
        remarks: findColumnIndex(headers, ['Remark', 'Remarks', 'Примечания'])
    };
    
    const requiredHeaders = ['станция отправления', 'станция прибытия'];
    const foundHeaders = requiredHeaders.filter(header =>
        headers.some(h => h && h.toString().toLowerCase().includes(header.toLowerCase()))
    );

    if (foundHeaders.length === 0) {
        throw new Error(`Отсутствуют обязательные заголовки: ${requiredHeaders.join(', ')}`);
    }
    
    dataRows.forEach((row, index) => {
        if (!row || row.length === 0 || !row.some(cell => cell !== null && cell !== undefined && cell !== '')) {
            return;
        }
        
        const item = {};
        
        Object.keys(headerMap).forEach(key => {
            const colIndex = headerMap[key];
            let value = '';
            
            if (colIndex !== -1 && row[colIndex] !== undefined && row[colIndex] !== null && row[colIndex] !== '') {
                value = row[colIndex];
                
                if (['fob40hc', 'exwFca40hc'].includes(key)) {
                    if (typeof value === 'string') {
                        value = value.toString().replace(/\s+/g, '').replace(',', '.');
                        value = value.replace(/[^\d.-]/g, '');
                    }
                    value = parseFloat(value) || 0;
                }
                
                // 🔧 КОНВЕРТИРУЕМ ДАТЫ ИЗ EXCEL ФОРМАТА
                if (['quoteDate', 'etd'].includes(key)) {
                    value = convertExcelDate(value);
                }
                
                if (typeof value === 'string') {
                    value = value.trim();
                }
            }
            
            item[key] = value;
        });
        
        if (item.fob || item.arrivalCity || item.departureStation || item.arrivalStation) {
            parsedData.push(item);
        }
    });
    
    console.log(`Всего строк в файле: ${dataRows.length}`);
    console.log(`Успешно обработано: ${parsedData.length}`);
    
    if (parsedData.length === 0) {
        throw new Error('Не найдено корректных данных для обработки.');
    }
    
    showStatus(`Успешно обработано ${parsedData.length} из ${dataRows.length} записей`, 'success');
    
    return parsedData;
}

// Функция для парсинга данных прямого моря
function parseDirectSeaData(excelData) {
    const headers = excelData[0];
    const dataRows = excelData.slice(1);
    const parsedData = [];
    
    const headerMap = {
        dateOfValidity: findColumnIndex(headers, ['Date of validity', 'Дата действия']),
        agent: findColumnIndex(headers, ['Agent', 'Агент']),
        carrier: findColumnIndex(headers, ['Carrier', 'Перевозчик']),
        pol: findColumnIndex(headers, ['POL', 'Порт погрузки']),
        pod: findColumnIndex(headers, ['POD', 'Порт выгрузки']),
        dc20: findColumnIndex(headers, ['20\'DC', '20DC']),
        hc40: findColumnIndex(headers, ['40\'HC', '40HC']),
        conversion: findColumnIndex(headers, ['Конвертация', 'Валюта']),
        etd: findColumnIndex(headers, ['ETD', 'Дата отгрузки']),
        remarks: findColumnIndex(headers, ['Remarks', 'Примечания', 'Remark'])
    };
    
    const criticalFields = ['pol', 'pod'];
    const missingCriticalFields = criticalFields.filter(field => headerMap[field] === -1);
    
    if (missingCriticalFields.length > 0) {
        throw new Error(`Отсутствуют критические колонки: ${missingCriticalFields.join(', ')}`);
    }
    
    dataRows.forEach((row, index) => {
        if (!row || row.length === 0 || !row.some(cell => cell !== null && cell !== undefined && cell !== '')) {
            return;
        }
        
        const item = {};
        
        Object.keys(headerMap).forEach(key => {
            const colIndex = headerMap[key];
            let value = '';
            
            if (colIndex !== -1 && row[colIndex] !== undefined && row[colIndex] !== null && row[colIndex] !== '') {
                value = row[colIndex];
                
                if (['dc20', 'hc40'].includes(key)) {
                    if (typeof value === 'string') {
                        value = value.toString().replace(/\s+/g, '').replace(',', '.');
                        value = value.replace(/[^\d.-]/g, '');
                    }
                    value = parseFloat(value) || 0;
                }
                
                // 🔧 КОНВЕРТИРУЕМ ДАТЫ ИЗ EXCEL ФОРМАТА
                if (['dateOfValidity', 'etd'].includes(key)) {
                    value = convertExcelDate(value);
                }
                
                if (typeof value === 'string') {
                    value = value.trim();
                }
            }
            
            item[key] = value;
        });
        
        if (item.pol && item.pod) {
            parsedData.push(item);
        }
    });
    
    console.log(`Всего строк в файле прямого моря: ${dataRows.length}`);
    console.log(`Успешно обработано: ${parsedData.length}`);
    
    if (parsedData.length === 0) {
        throw new Error('Не найдено корректных данных для обработки. Проверьте наличие колонок POL и POD.');
    }
    
    showStatus(`Успешно обработано ${parsedData.length} из ${dataRows.length} записей`, 'success');
    
    return parsedData;
}

// 🔧 ФУНКЦИЯ ДЛЯ ПРОВЕРКИ ДОСТУПНОСТИ МОДУЛЕЙ
function checkModulesAvailability() {
    const modules = {
        'SeaModule': !!window.SeaModule,
        'DirectSeaModule': !!window.DirectSeaModule,
        'DirectRailModule': !!window.DirectRailModule
    };
    
    console.log('🔍 Проверка доступности модулей:', modules);
    return modules;
}

// Экспортируем функции для использования в основном файле
window.Utils = {
    setupCustomDropdown,
    setupUniversalDropdown,
    showStatus,
    getDatabaseName,
    showLastUpdate,
    findColumnIndex,
    parseSeaData,
    parseDirectRailData,
    parseDirectSeaData,
    checkModulesAvailability,
    getTransportTypeByField,
    convertExcelDate
};

console.log('✅ Утилиты загружены с интеграцией всех модулей');