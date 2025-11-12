// 🎯 ОСНОВНОЙ ФАЙЛ ПРИЛОЖЕНИЯ - ТЕПЕРЬ ИСПОЛЬЗУЕТ МОДУЛИ

// Глобальные переменные
let currentRole = '';
let currentDatabase = '';
let currentCalculationType = 'separate'; // 'separate' или 'complex'
let uploadedData = null;
let database = {
    sea: [],
    rail: [],
    direct_rail: [],
    direct_sea: []
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
function selectRole(role) {
    currentRole = role;
    document.getElementById('role-selection').classList.add('hidden');
    document.getElementById('database-selection').classList.remove('hidden');
}

function selectSalesRole() {
    currentRole = 'sales';
    document.getElementById('role-selection').classList.add('hidden');
    document.getElementById('calculation-type-selection').classList.remove('hidden');
}

function selectDatabase(dbType) {
    currentDatabase = dbType;
    console.log('🎯 Выбран тип базы данных:', dbType);
    document.getElementById('database-selection').classList.add('hidden');
    
    if (currentRole === 'purchaser') {
        document.getElementById('purchaser-interface').classList.remove('hidden');
        setupFileUpload();
    } else if (currentRole === 'sales') {
        document.getElementById('sales-interface').classList.remove('hidden');
        resetCalculatorForm();
        setupCalculator();
        Utils.showLastUpdate();
    }
}

function goBack() {
    if (currentRole === 'sales' && currentDatabase) {
        // Возврат из отдельных ставок к выбору типа базы данных
        resetCalculatorForm();
        currentDatabase = '';
        document.getElementById('database-selection').classList.remove('hidden');
        document.getElementById('sales-interface').classList.add('hidden');
    } else if (currentRole === 'sales' && currentCalculationType === 'complex') {
        // Возврат из комплексного расчета к выбору типа расчета
        resetCalculatorForm();
        currentCalculationType = '';
        document.getElementById('calculation-type-selection').classList.remove('hidden');
        document.getElementById('sales-interface').classList.add('hidden');
    } else if (currentRole === 'sales' && document.getElementById('database-selection').classList.contains('hidden') === false) {
        // Возврат из выбора типа базы данных к выбору типа расчета
        document.getElementById('database-selection').classList.add('hidden');
        document.getElementById('calculation-type-selection').classList.remove('hidden');
    } else if (currentRole === 'sales') {
        // Возврат из выбора типа расчета к выбору роли
        currentRole = '';
        currentCalculationType = '';
        document.getElementById('role-selection').classList.remove('hidden');
        document.getElementById('calculation-type-selection').classList.add('hidden');
    } else if (currentRole && currentDatabase) {
        // Возврат для закупщика
        currentDatabase = '';
        document.getElementById('database-selection').classList.remove('hidden');
        document.getElementById('purchaser-interface').classList.add('hidden');
    } else if (currentRole) {
        // Возврат к выбору роли
        currentRole = '';
        document.getElementById('role-selection').classList.remove('hidden');
        document.getElementById('database-selection').classList.add('hidden');
    }
}

function resetCalculatorForm() {
    document.getElementById('pol').value = '';
    document.getElementById('pod').value = '';
    document.getElementById('drop-off-area').value = '';
    document.getElementById('container-type').value = '';
    document.getElementById('fob').value = '';
    document.getElementById('arrival-city').value = '';
    document.getElementById('border-crossing').value = '';
    document.getElementById('rail-city').value = '';
    document.getElementById('rail-destination').value = '';
    document.getElementById('rail-container-type').value = '';
    document.getElementById('complex-departure').value = '';
    document.getElementById('complex-destination').value = '';
    document.getElementById('complex-container-type').value = '';
    
    document.getElementById('results').classList.add('hidden');
    document.getElementById('rates-table').innerHTML = '';
    
    const dropdowns = document.querySelectorAll('.custom-dropdown');
    dropdowns.forEach(dropdown => {
        dropdown.classList.remove('active');
        dropdown.innerHTML = '';
    });
}

// Функции для закупщика
function setupFileUpload() {
    const fileInput = document.getElementById('excel-file');
    const processButton = document.getElementById('process-file');
    
    fileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            processButton.disabled = false;
            Utils.showStatus('Файл выбран. Нажмите "Обработать файл"', 'success');
        }
    });
}

function processExcelFile() {
    const fileInput = document.getElementById('excel-file');
    const file = fileInput.files[0];
    
    if (!file) {
        Utils.showStatus('Пожалуйста, выберите файл', 'error');
        return;
    }
    
    Utils.showStatus('Обработка файла...', '');
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            if (jsonData.length < 2) {
                throw new Error('Файл не содержит данных или имеет неправильную структуру');
            }
            
            console.log('🔍 Парсинг файла для типа базы:', currentDatabase);
            
            if (currentDatabase === 'direct_rail') {
                uploadedData = Utils.parseDirectRailData(jsonData);
            } else if (currentDatabase === 'direct_sea') {
                uploadedData = Utils.parseDirectSeaData(jsonData);
            } else if (currentDatabase === 'sea') {
                uploadedData = Utils.parseSeaData(jsonData);
            } else if (currentDatabase === 'rail') {
                uploadedData = Utils.parseRailData(jsonData);
            } else {
                console.warn('⚠️ Неизвестный тип базы, используем морской парсинг:', currentDatabase);
                uploadedData = Utils.parseSeaData(jsonData);
            }
            showDataPreview(uploadedData);
            
        } catch (error) {
            console.error('Ошибка обработки файла:', error);
            Utils.showStatus(`Ошибка обработки файла: ${error.message}`, 'error');
        }
    };
    
    reader.onerror = function() {
        Utils.showStatus('Ошибка чтения файла', 'error');
    };
    
    reader.readAsArrayBuffer(file);
}

function showDataPreview(data) {
    const previewSection = document.getElementById('data-preview');
    const previewTable = document.getElementById('preview-table');
    
    let tableHTML = '';
    
    if (currentDatabase === 'direct_rail') {
        tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Станция отправления</th>
                        <th>Станция прибытия</th>
                        <th>Город прибытия</th>
                        <th>FOB 40'HC</th>
                        <th>EXW/FCA 40'HC</th>
                        <th>Погран переход</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        data.slice(0, 5).forEach(item => {
            tableHTML += `
                <tr>
                    <td>${item.departureStation}</td>
                    <td>${item.arrivalStation}</td>
                    <td>${item.arrivalCity}</td>
                    <td>$${item.fob40hc}</td>
                    <td>$${item.exwFca40hc}</td>
                    <td>${item.borderCrossing}</td>
                </tr>
            `;
        });
    } else if (currentDatabase === 'direct_sea') {
        tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th>POL</th>
                        <th>POD</th>
                        <th>20'DC</th>
                        <th>40'HC</th>
                        <th>Конвертация</th>
                        <th>ETD</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        data.slice(0, 5).forEach(item => {
            tableHTML += `
                <tr>
                    <td>${item.pol}</td>
                    <td>${item.pod}</td>
                    <td>$${item.dc20}</td>
                    <td>$${item.hc40}</td>
                    <td>${item.conversion}</td>
                    <td>${item.etd}</td>
                </tr>
            `;
        });
    } else if (currentDatabase === 'rail') {
        tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Город</th>
                        <th>Агент</th>
                        <th>Пункт назначения</th>
                        <th>20фут ктк (до 24т)</th>
                        <th>20фут ктк (24-28т)</th>
                        <th>40фут ктк</th>
                        <th>Валидность</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        data.slice(0, 5).forEach(item => {
            tableHTML += `
                <tr>
                    <td>${item.city}</td>
                    <td>${item.agent}</td>
                    <td>${item.destination}</td>
                    <td>$${item.container20Under24}</td>
                    <td>$${item.container20Over24}</td>
                    <td>$${item.container40}</td>
                    <td>${item.validity}</td>
                </tr>
            `;
        });
    } else {
        tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th>POL</th>
                        <th>POD</th>
                        <th>DROP OFF AREA VIA VVO</th>
                        <th>SOC 20'</th>
                        <th>SOC 40'</th>
                        <th>20'DC</th>
                        <th>40'HC</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        data.slice(0, 5).forEach(item => {
            tableHTML += `
                <tr>
                    <td>${item.pol}</td>
                    <td>${item.pod}</td>
                    <td>${item.dropOffArea}</td>
                    <td>$${item.soc20}</td>
                    <td>$${item.soc40}</td>
                    <td>$${item.dc20}</td>
                    <td>$${item.hc40}</td>
                </tr>
            `;
        });
    }
    
    tableHTML += `
            </tbody>
        </table>
        <p>Показано ${Math.min(5, data.length)} из ${data.length} записей</p>
    `;
    
    previewTable.innerHTML = tableHTML;
    previewSection.classList.remove('hidden');
}

async function saveData() {
    if (!uploadedData) {
        Utils.showStatus('Нет данных для сохранения', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/data/${currentDatabase}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ data: uploadedData })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            database[currentDatabase] = uploadedData;
            
            const currentDate = new Date();
            const updateDate = {
                date: currentDate.toISOString(),
                formatted: currentDate.toLocaleDateString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                })
            };
            localStorage.setItem(`last_update_${currentDatabase}`, JSON.stringify(updateDate));
            
            Utils.showStatus(`Данные успешно сохранены в базу "${Utils.getDatabaseName(currentDatabase)}"`, 'success');
            
            setTimeout(() => {
                document.getElementById('excel-file').value = '';
                document.getElementById('process-file').disabled = true;
                document.getElementById('data-preview').classList.add('hidden');
                uploadedData = null;
            }, 2000);
        } else {
            throw new Error(result.error || 'Ошибка сохранения данных');
        }
    } catch (error) {
        console.error('❌ Ошибка сохранения данных на сервере:', error);
        Utils.showStatus(`Ошибка сохранения данных: ${error.message}`, 'error');
    }
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
    const separateFields = document.querySelectorAll('#sea-fields, #direct-rail-fields, #rail-fields');
    const complexFields = document.getElementById('complex-fields');
    
    separateFields.forEach(field => field.classList.add('hidden'));
    if (complexFields) complexFields.classList.remove('hidden');
    
    console.log('🔧 Показаны поля комплексного расчета, скрыты отдельные поля');
}

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
        Utils.showLastUpdate();
    }
}

function setupCalculationType() {
    // Устанавливаем тип расчета по умолчанию
    selectCalculationType('separate');
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
        // 🔧 POD из моря НЕ добавляем в пункты назначения для комплексных ставок
        // if (item.pod) {
        //     allDestinations.add(item.pod);
        // }
    });
    
    // 🔧 ЖД - добавляем только пункты назначения для комплексных ставок
    database.rail.forEach(item => {
        if (item.destination) {
            allDestinations.add(item.destination);
        }
    });
    
    // 🔧 Море - заглушка для пунктов назначения (POD)
    // database.sea.forEach(item => {
    //     if (item.pod) allDestinations.add(item.pod);
    // });
    
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

async function loadDatabaseData() {
    // 🔧 ЗАГРУЗКА ДАННЫХ ИЗ СЕРВЕРА ДЛЯ ВСЕХ ТИПОВ БАЗ
    const dbTypes = ['sea', 'rail', 'direct_rail', 'direct_sea'];
    
    for (const dbType of dbTypes) {
        try {
            const response = await fetch(`/api/data/${dbType}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const serverData = await response.json();
            database[dbType] = serverData.data || [];
            console.log(`✅ Загружены данные с сервера для ${dbType}: ${database[dbType].length} записей`);
            
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
    
    // 🔧 ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА ДЛЯ МОРЯ
    console.log('📊 Проверка данных моря:', {
        hasSeaData: database.sea && database.sea.length > 0,
        seaRecords: database.sea ? database.sea.length : 0,
        currentDatabase: currentDatabase
    });
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
            // В комплексных ставках связка: city моря = city жд И dropOffArea моря = destination жд
            // И destination жд должен совпадать с выбранным пользователем пунктом назначения
            const railRates = database.rail.filter(railItem => {
                // Базовые правила соединения
                const baseRules =
                    railItem.city && seaItem.city && normalizeCityName(railItem.city) === normalizeCityName(seaItem.city) && // Правило 2: city море = city жд
                    railItem.destination && seaItem.dropOffArea && normalizeCityName(railItem.destination) === normalizeCityName(seaItem.dropOffArea) && // Правило 3: drop-off море = destination жд
                    railItem.destination && normalizeCityName(railItem.destination) === normalizeCityName(destination) && // Пункт назначения должен совпадать с выбранным пользователем
                    (railItem.container20Under24 > 0 || railItem.container20Over24 > 0 || railItem.container40 > 0);
                
                // Если включен триггер ВТТ, добавляем дополнительное правило: море POD = жд агент
                if (isVTTTrigger) {
                    return baseRules &&
                           seaItem.pod && railItem.agent && normalizeCityName(seaItem.pod) === normalizeCityName(railItem.agent); // Правило 5: море POD = жд агент
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
                // Сопоставляем морские типы контейнеров с ЖД типами
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
                    const totalRate = seaRate + railRate;
                    
                    allResults.push({
                        transportType: 'sea_rail',
                        transportName: 'Море + ЖД',
                        rate: totalRate,
                        currency: '$',
                        data: {
                            sea: seaItem,
                            rail: railItem,
                            seaRate: seaRate,
                            railRate: railRate,
                            connection: `Море: ${normalizeCityName(seaItem.pol)} → ${normalizeCityName(seaItem.pod)} (${normalizeCityName(seaItem.city)}) → ЖД: ${normalizeCityName(railItem.city)} → ${normalizeCityName(railItem.destination)}`
                        }
                    });
                    
                    console.log(`✅ Комплексная ставка: ${seaRate} (море) + ${railRate} (жд) = ${totalRate}`);
                }
            });
        });
    }
    
    console.log('🔧 Всего результатов комплексного расчета:', allResults.length);
    
    // Сортируем результаты по ставке (от меньшей к большей)
    allResults.sort((a, b) => a.rate - b.rate);
    
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
    
    results.forEach(result => {
        const transportTypeClass = `transport-type-${result.transportType}`;
        
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
            // Комплексная ставка: море в USD, ЖД в RUB, общая в RUB
            const seaRateUSD = result.data.seaRate || 0;
            const railRateRUB = result.data.railRate || 0;
            
            seaRate = `$${seaRateUSD}`;
            railRate = `${railRateRUB} RUB`;
            
            if (usdToRubRate) {
                const totalRateRUB = Math.round(seaRateUSD * usdToRubRate) + railRateRUB;
                totalRate = `${totalRateRUB} RUB`;
            } else {
                totalRate = `$${seaRateUSD} + ${railRateRUB} RUB`;
            }
            
            additionalInfo = result.data.connection || 'Комплексная перевозка Море+ЖД';
        }
        
        tableHTML += `
            <tr>
                <td>
                    <span class="transport-type-badge ${transportTypeClass}">
                        ${result.transportName}
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

function showCorrectFields() {
    const seaFields = document.getElementById('sea-fields');
    const directRailFields = document.getElementById('direct-rail-fields');
    const railFields = document.getElementById('rail-fields');
    const complexFields = document.getElementById('complex-fields');
    const dropOffAreaField = document.getElementById('drop-off-area-container');
    const containerTypeSelect = document.getElementById('container-type');
    const railContainerTypeSelect = document.getElementById('rail-container-type');
    
    // 🔧 ВСЕГДА СКРЫВАЕМ ПОЛЯ КОМПЛЕКСНОГО РАСЧЕТА В ОТДЕЛЬНЫХ СТАВКАХ
    if (complexFields) {
        complexFields.classList.add('hidden');
    }
    
    if (currentDatabase === 'direct_rail') {
        seaFields.classList.add('hidden');
        directRailFields.classList.remove('hidden');
        if (railFields) railFields.classList.add('hidden');
    } else if (currentDatabase === 'direct_sea') {
        seaFields.classList.remove('hidden');
        directRailFields.classList.add('hidden');
        if (railFields) railFields.classList.add('hidden');
        if (dropOffAreaField) {
            dropOffAreaField.classList.add('hidden');
        }
        updateContainerTypesForDirectSea(containerTypeSelect);
    } else if (currentDatabase === 'rail') {
        seaFields.classList.add('hidden');
        directRailFields.classList.add('hidden');
        if (railFields) railFields.classList.remove('hidden');
        if (dropOffAreaField) {
            dropOffAreaField.classList.add('hidden');
        }
        updateContainerTypesForRail(railContainerTypeSelect);
    } else {
        seaFields.classList.remove('hidden');
        directRailFields.classList.add('hidden');
        if (railFields) railFields.classList.add('hidden');
        if (dropOffAreaField) {
            dropOffAreaField.classList.remove('hidden');
        }
        updateContainerTypesForSea(containerTypeSelect);
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
        return;
    }
    
    if (currentDatabase === 'direct_rail') {
        // 🎯 ИСПОЛЬЗУЕМ УЛУЧШЕННУЮ ЛОГИКУ ДЛЯ ПРЯМОГО ЖД
        DirectRailModule.setupEnhancedDirectRailChainUpdate(data);
    } else if (currentDatabase === 'direct_sea') {
        // 🎯 ИСПОЛЬЗУЕМ УЛУЧШЕННУЮ ЛОГИКУ ДЛЯ ПРЯМОГО МОРЯ
        DirectSeaModule.setupEnhancedDirectSeaChainUpdate(data);
    } else if (currentDatabase === 'sea') {
        // 🎯 ИСПОЛЬЗУЕМ УЛУЧШЕННУЮ ЛОГИКУ ДЛЯ МОРЯ
        SeaModule.setupEnhancedSeaChainUpdate(data);
    } else if (currentDatabase === 'rail') {
        // 🎯 ИСПОЛЬЗУЕМ УЛУЧШЕННУЮ ЛОГИКУ ДЛЯ ЖД ПЕРЕВОЗОК
        RailModule.setupEnhancedRailChainUpdate(data);
    } else {
        // Старая логика для других типов
        const polValues = [...new Set(data.map(item => item.pol).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        const podValues = [...new Set(data.map(item => item.pod).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        const dropOffAreaValues = [...new Set(data.map(item => item.dropOffArea).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        
        Utils.setupCustomDropdown('pol', polValues);
        Utils.setupCustomDropdown('pod', podValues);
        Utils.setupCustomDropdown('drop-off-area', dropOffAreaValues);
    }
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

// Обновляет отображение курса в интерфейсе
function updateExchangeRateDisplay() {
    const exchangeRateLabel = document.querySelector('.exchange-rate-display label');
    if (exchangeRateLabel) {
        const savedDate = localStorage.getItem('usd_to_rub_rate_date');
        const dateInfo = savedDate ? ` (обновлен ${new Date(savedDate).toLocaleDateString('ru-RU')})` : '';
        exchangeRateLabel.textContent = `Курс ЦБ РФ: 1 USD = ${usdToRubRate} RUB${dateInfo}`;
    }
}

// Добавляем отображение текущего курса
function addExchangeRateDisplay() {
    const salesInterface = document.getElementById('sales-interface');
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
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Приложение логистики инициализировано');
    
    // Загружаем курс ЦБ РФ
    await loadExchangeRate();
    
    // Проверяем наличие библиотеки XLSX
    if (typeof XLSX === 'undefined') {
        console.error('❌ Библиотека XLSX не загружена');
        Utils.showStatus('Ошибка: библиотека XLSX не загружена', 'error');
    }
    
    // Добавляем отображение текущего курса
    addExchangeRateDisplay();
});