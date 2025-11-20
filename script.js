// 🎯 ОСНОВНОЙ ФАЙЛ ПРИЛОЖЕНИЯ - ТЕПЕРЬ ИСПОЛЬЗУЕТ МОДУЛИ

// Глобальные переменные
let currentRole = window.currentRole || '';
let currentDatabase = '';
let currentCalculationType = 'separate'; // 'separate' или 'complex'
let uploadedData = null;
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
function selectRole(role) {
    const currentUser = Auth.getCurrentUser();
    
    if (!currentUser) {
        Utils.showStatus('Ошибка: пользователь не авторизован', 'error');
        return;
    }
    
    // Обновляем роль пользователя в системе
    Auth.updateUserRole(currentUser.id, role);
    
    currentRole = role;
    document.getElementById('role-selection').classList.add('hidden');
    document.getElementById('database-selection').classList.remove('hidden');
    updateDatabaseButtonsVisibility();
    
    Utils.showStatus(`Выбран режим: ${role === 'purchaser' ? 'Менеджер по закупу' : 'Менеджер по продажам'}`, 'success');
}

function selectSalesRole() {
    const currentUser = Auth.getCurrentUser();
    
    if (!currentUser) {
        Utils.showStatus('Ошибка: пользователь не авторизован', 'error');
        return;
    }
    
    // Обновляем роль пользователя в системе
    Auth.updateUserRole(currentUser.id, 'sales');
    
    currentRole = 'sales';
    document.getElementById('role-selection').classList.add('hidden');
    document.getElementById('calculation-type-selection').classList.remove('hidden');
    updateDatabaseButtonsVisibility();
    
    Utils.showStatus('Выбран режим: Менеджер по продажам', 'success');
}

async function selectDatabase(dbType) {
    const currentUser = Auth.getCurrentUser();
    
    if (!currentUser) {
        Utils.showStatus('Ошибка: пользователь не авторизован', 'error');
        return;
    }
    
    // Используем глобальную переменную window.currentRole
    const role = window.currentRole || currentRole;
    
    // Проверяем права доступа для тарифов
    if (dbType === 'tariff' && currentUser.role !== 'purchaser') {
        Utils.showStatus('Доступ запрещен. Только менеджеры по закупу могут управлять тарифами.', 'error');
        return;
    }
    
    currentDatabase = dbType;
    console.log('🎯 Выбран тип базы данных:', dbType, 'для роли:', role);
    document.getElementById('database-selection').classList.add('hidden');
    
    // Синхронизируем данные с сервером при каждом входе
    await loadDatabaseData();
    
    if (role === 'purchaser') {
        if (dbType === 'tariff') {
            console.log('🔧 Открываем интерфейс тарифов для закупщика');
            document.getElementById('tariff-interface').classList.remove('hidden');
            loadTariffData();
        } else {
            console.log('🔧 Открываем интерфейс загрузки файлов для закупщика:', dbType);
            document.getElementById('purchaser-interface').classList.remove('hidden');
            // Очищаем предыдущие данные
            document.getElementById('excel-file').value = '';
            document.getElementById('process-file').disabled = true;
            document.getElementById('data-preview').classList.add('hidden');
            uploadedData = null;
            // Инициализируем загрузку файлов
            setupFileUpload();
        }
    } else if (role === 'sales') {
        console.log('🔧 Открываем интерфейс продаж для менеджера');
        document.getElementById('sales-interface').classList.remove('hidden');
        resetCalculatorForm();
        setupCalculator();
        Utils.showLastUpdate();
        
        // Обновляем отображение кнопок в заголовке
        updateSalesHeaderButtons();
    }
}

// Функция для обновления отображения кнопок в зависимости от роли
function updateDatabaseButtonsVisibility() {
    const databaseSelection = document.getElementById('database-selection');
    if (!databaseSelection) return;
    
    // Используем глобальную переменную window.currentRole
    const role = window.currentRole || currentRole;
    console.log('🔧 Обновление видимости кнопок для роли:', role);
    
    // Находим все кнопки базы данных
    const dbButtons = databaseSelection.querySelectorAll('.db-btn');
    console.log('🔧 Найдено кнопок базы данных:', dbButtons.length);
    
    dbButtons.forEach((button, index) => {
        // Проверяем, является ли это кнопкой "Тариф" по тексту
        const buttonText = button.textContent.toLowerCase();
        const isTariffButton = buttonText.includes('тариф');
        
        console.log(`🔧 Кнопка ${index}: "${button.textContent.trim()}" - тариф: ${isTariffButton}`);
        
        if (isTariffButton) {
            // Показываем кнопку "Тариф" только для закупщика
            if (role === 'purchaser') {
                button.style.display = 'block';
                console.log('✅ Кнопка "Тариф" показана для закупщика');
            } else {
                button.style.display = 'none';
                console.log('❌ Кнопка "Тариф" скрыта для роли:', role);
            }
        }
    });
    
    console.log('🔧 Обновлена видимость кнопок базы данных для роли:', role);
}

function goBack() {
    // Используем глобальную переменную для синхронизации с auth-ui.js
    const role = window.currentRole || currentRole;
    console.log('🔙 Нажата кнопка "Назад":', { role, currentDatabase, currentCalculationType });
    
    if (role === 'sales' && currentDatabase) {
        // Возврат из отдельных ставок к выбору типа базы данных
        console.log('🔙 Возврат из отдельных ставок к выбору типа базы данных');
        resetCalculatorForm();
        currentDatabase = '';
        document.getElementById('sales-interface').classList.add('hidden');
        document.getElementById('database-selection').classList.remove('hidden');
        updateDatabaseButtonsVisibility();
    } else if (role === 'sales' && currentCalculationType === 'complex') {
        // Возврат из комплексного расчета к выбору типа расчета
        console.log('🔙 Возврат из комплексного расчета к выбору типа расчета');
        resetCalculatorForm();
        currentCalculationType = '';
        document.getElementById('sales-interface').classList.add('hidden');
        document.getElementById('calculation-type-selection').classList.remove('hidden');
        updateDatabaseButtonsVisibility();
    } else if (role === 'sales' && document.getElementById('database-selection').classList.contains('hidden') === false) {
        // Возврат из выбора типа базы данных к выбору типа расчета
        console.log('🔙 Возврат из выбора типа базы данных к выбору типа расчета');
        document.getElementById('database-selection').classList.add('hidden');
        document.getElementById('calculation-type-selection').classList.remove('hidden');
        updateDatabaseButtonsVisibility();
    } else if (role === 'sales') {
        // Возврат из выбора типа расчета к выбору роли
        console.log('🔙 Возврат из выбора типа расчета к выбору роли');
        currentRole = '';
        currentCalculationType = '';
        document.getElementById('calculation-type-selection').classList.add('hidden');
        document.getElementById('role-selection').classList.remove('hidden');
        updateDatabaseButtonsVisibility();
    } else if (role === 'purchaser' && currentDatabase === 'tariff') {
        // Возврат из интерфейса тарифов к выбору типа базы данных
        console.log('🔙 Возврат из интерфейса тарифов для закупщика');
        currentDatabase = '';
        document.getElementById('tariff-interface').classList.add('hidden');
        document.getElementById('database-selection').classList.remove('hidden');
        updateDatabaseButtonsVisibility();
    } else if (role === 'purchaser' && currentDatabase) {
        // Возврат для закупщика из интерфейса загрузки файлов
        console.log('🔙 Возврат из интерфейса загрузки файлов для закупщика');
        currentDatabase = '';
        document.getElementById('purchaser-interface').classList.add('hidden');
        document.getElementById('database-selection').classList.remove('hidden');
        updateDatabaseButtonsVisibility();
    } else if (role === 'purchaser') {
        // Возврат к выбору типа базы данных
        console.log('🔙 Возврат к выбору типа базы данных для закупщика');
        currentDatabase = '';
        document.getElementById('purchaser-interface').classList.add('hidden');
        document.getElementById('tariff-interface').classList.add('hidden');
        document.getElementById('database-selection').classList.remove('hidden');
        updateDatabaseButtonsVisibility();
    } else {
        // Общий возврат к выбору роли
        console.log('🔙 Общий возврат к выбору роли');
        currentRole = '';
        currentDatabase = '';
        currentCalculationType = '';
        document.getElementById('database-selection').classList.add('hidden');
        document.getElementById('calculation-type-selection').classList.add('hidden');
        document.getElementById('purchaser-interface').classList.add('hidden');
        document.getElementById('tariff-interface').classList.add('hidden');
        document.getElementById('sales-interface').classList.add('hidden');
        document.getElementById('role-selection').classList.remove('hidden');
        updateDatabaseButtonsVisibility();
    }
    
    console.log('✅ После нажатия "Назад":', { role, currentDatabase, currentCalculationType });
    
    // Обновляем кнопки в заголовке после навигации
    if (role === 'sales') {
        updateSalesHeaderButtons();
    }
}

// Функция перенаправления менеджера по продажам на отдельный интерфейс
function redirectToSalesInterface() {
    const currentUser = Auth.getCurrentUser();
    
    if (!currentUser) {
        Utils.showStatus('Ошибка: пользователь не авторизован', 'error');
        return;
    }
    
    // Обновляем роль пользователя в системе
    Auth.updateUserRole(currentUser.id, 'sales');
    
    // Перенаправляем на отдельный интерфейс менеджера по продажам
    window.location.href = 'sales-interface.html';
}

// Функция перенаправления менеджера по закупкам на отдельный интерфейс
function redirectToPurchaserInterface() {
    const currentUser = Auth.getCurrentUser();
    
    if (!currentUser) {
        Utils.showStatus('Ошибка: пользователь не авторизован', 'error');
        return;
    }
    
    // Обновляем роль пользователя в системе
    Auth.updateUserRole(currentUser.id, 'purchaser');
    
    // Перенаправляем на отдельный интерфейс менеджера по закупкам
    window.location.href = 'purchaser-interface.html';
}

// Функция для обновления отображения кнопок в заголовке менеджера по продажам
// ТОЛЬКО ДЛЯ ОСНОВНОГО ИНТЕРФЕЙСА - НЕ ИСПОЛЬЗУЕТСЯ В ОТДЕЛЬНЫХ ИНТЕРФЕЙСАХ
function updateSalesHeaderButtons() {
    const salesInterface = document.getElementById('sales-interface');
    if (!salesInterface) return;
    
    const headerButtons = salesInterface.querySelector('.sales-header-buttons');
    if (!headerButtons) return;
    
    // Для комплексных ставок показываем только кнопку "Назад"
    // Для отдельных ставок тоже показываем только кнопку "Назад"
    if (currentCalculationType === 'complex' || currentDatabase) {
        headerButtons.innerHTML = `
            <button class="btn-back" onclick="goBack()">← Назад</button>
        `;
    } else {
        // В выборе типа расчета показываем обе кнопки
        headerButtons.innerHTML = `
            <button class="btn-back" onclick="goBack()">← Назад</button>
            <button class="btn-logout" onclick="logoutUser()">
                <i class="fas fa-sign-out-alt"></i> Выйти
            </button>
        `;
    }
    
    console.log('🔧 Обновлены кнопки в заголовке менеджера по продажам:', {
        currentCalculationType,
        currentDatabase
    });
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
    
    console.log('🔧 Настройка загрузки файлов для базы:', currentDatabase);
    
    if (!fileInput || !processButton) {
        console.error('❌ Не найдены элементы для загрузки файлов');
        return;
    }
    
    // Сбрасываем состояние
    fileInput.value = '';
    processButton.disabled = true;
    
    fileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            processButton.disabled = false;
            Utils.showStatus('Файл выбран. Нажмите "Обработать файл"', 'success');
        }
    });
    
    console.log('✅ Настройка загрузки файлов завершена');
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
                        <th>Тыловой Терминал</th>
                        <th>Пункт назначения</th>
                        <th>Автовывоз</th>
                        <th>ПРР</th>
                        <th>20фут ктк (до 24т)</th>
                        <th>20фут ктк (24-28т)</th>
                        <th>40фут ктк</th>
                        <th>НДС</th>
                        <th>ВОХР 20</th>
                        <th>ВОХР 40</th>
                        <th>Фитинг/ПВ</th>
                        <th>Условия</th>
                        <th>Валидность</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        data.slice(0, 5).forEach(item => {
            const тыловойТерминал = (item.тыловойТерминал !== undefined && item.тыловойТерминал !== null && item.тыловойТерминал !== '') ? item.тыловойТерминал : '-';
            const autovivoz = (item.autovivoz !== undefined && item.autovivoz !== null && item.autovivoz !== '') ? item.autovivoz : '-';
            const prr = (item.prr !== undefined && item.prr !== null && item.prr !== '') ? item.prr : '-';
            const nds = (item.nds !== undefined && item.nds !== null && item.nds !== '') ? item.nds : '-';
            const vochr20 = (item.vochr20 !== undefined && item.vochr20 !== null && item.vochr20 !== '') ? item.vochr20 : '-';
            const vochr40 = (item.vochr40 !== undefined && item.vochr40 !== null && item.vochr40 !== '') ? item.vochr40 : '-';
            const fitting = (item.fitting !== undefined && item.fitting !== null && item.fitting !== '') ? item.fitting : '-';
            const conditions = (item.conditions !== undefined && item.conditions !== null && item.conditions !== '') ? item.conditions : '-';
            
            tableHTML += `
                <tr>
                    <td>${item.city}</td>
                    <td>${item.agent}</td>
                    <td>${тыловойТерминал}</td>
                    <td>${item.destination}</td>
                    <td>${autovivoz}</td>
                    <td>${prr}</td>
                    <td>$${item.container20Under24}</td>
                    <td>$${item.container20Over24}</td>
                    <td>$${item.container40}</td>
                    <td>${nds}</td>
                    <td>${vochr20}</td>
                    <td>${vochr40}</td>
                    <td>${fitting}</td>
                    <td>${conditions}</td>
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

// Функции для работы с тарифами
function loadTariffData() {
    // Загружаем сохраненные тарифы из базы данных
    if (database.tariff && database.tariff.length > 0) {
        const tariffData = database.tariff[0]; // Берем первый (и единственный) набор тарифов
        document.getElementById('vtt-rate').value = tariffData.vtt || '';
        document.getElementById('prr20-rate').value = tariffData.prr20 || '';
        document.getElementById('prr40-rate').value = tariffData.prr40 || '';
        document.getElementById('auto20-rate').value = tariffData.auto20 || '';
        document.getElementById('auto40-rate').value = tariffData.auto40 || '';
        
        // Показываем предпросмотр сохраненных тарифов
        showTariffPreview(tariffData);
    }
}

function saveTariffData() {
    const vttRate = parseFloat(document.getElementById('vtt-rate').value) || 0;
    const prr20Rate = parseFloat(document.getElementById('prr20-rate').value) || 0;
    const prr40Rate = parseFloat(document.getElementById('prr40-rate').value) || 0;
    const auto20Rate = parseFloat(document.getElementById('auto20-rate').value) || 0;
    const auto40Rate = parseFloat(document.getElementById('auto40-rate').value) || 0;
    
    // Проверяем, что все поля заполнены
    if (vttRate === 0 && prr20Rate === 0 && prr40Rate === 0 && auto20Rate === 0 && auto40Rate === 0) {
        Utils.showStatus('Пожалуйста, заполните хотя бы одно поле', 'error', 'tariff-status');
        return;
    }
    
    const tariffData = {
        vtt: vttRate,
        prr20: prr20Rate,
        prr40: prr40Rate,
        auto20: auto20Rate,
        auto40: auto40Rate,
        timestamp: new Date().toISOString()
    };
    
    // Сохраняем в базу данных
    database.tariff = [tariffData];
    
    // Сохраняем на сервер
    saveTariffToServer(tariffData);
    
    // Показываем предпросмотр
    showTariffPreview(tariffData);
    
    Utils.showStatus('Тарифы успешно сохранены', 'success', 'tariff-status');
}

async function saveTariffToServer(tariffData) {
    try {
        const response = await fetch('/api/data/tariff', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ data: [tariffData] })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Тарифы сохранены на сервере');
            
            // Сохраняем в localStorage как резервную копию
            localStorage.setItem('logistics_db_tariff', JSON.stringify([tariffData]));
            
            // Сохраняем дату обновления
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
            localStorage.setItem('last_update_tariff', JSON.stringify(updateDate));
            
        } else {
            throw new Error(result.error || 'Ошибка сохранения тарифов');
        }
    } catch (error) {
        console.error('❌ Ошибка сохранения тарифов на сервере:', error);
        // Сохраняем в localStorage как резервную копию
        localStorage.setItem('logistics_db_tariff', JSON.stringify([tariffData]));
        Utils.showStatus('Тарифы сохранены локально (ошибка связи с сервером)', 'warning', 'tariff-status');
    }
}

function showTariffPreview(tariffData) {
    const previewSection = document.getElementById('tariff-preview');
    const previewTable = document.getElementById('tariff-preview-table');
    
    const tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Услуга</th>
                    <th>Стоимость (руб)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>ВТТ</td>
                    <td>${tariffData.vtt}</td>
                </tr>
                <tr>
                    <td>ПРР 20</td>
                    <td>${tariffData.prr20}</td>
                </tr>
                <tr>
                    <td>ПРР 40</td>
                    <td>${tariffData.prr40}</td>
                </tr>
                <tr>
                    <td>Автовывоз 20</td>
                    <td>${tariffData.auto20}</td>
                </tr>
                <tr>
                    <td>Автовывоз 40</td>
                    <td>${tariffData.auto40}</td>
                </tr>
            </tbody>
        </table>
        <p>Тарифы сохранены: ${new Date(tariffData.timestamp).toLocaleString('ru-RU')}</p>
    `;
    
    previewTable.innerHTML = tableHTML;
    previewSection.classList.remove('hidden');
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
        
        // Обновляем кнопки в заголовке для комплексных ставок
        updateSalesHeaderButtons();
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
    
    // 🔧 ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА ВСЕХ ДАННЫХ
    console.log('📊 Проверка всех данных:', {
        sea: database.sea ? database.sea.length : 0,
        rail: database.rail ? database.rail.length : 0,
        direct_rail: database.direct_rail ? database.direct_rail.length : 0,
        direct_sea: database.direct_sea ? database.direct_sea.length : 0,
        tariff: database.tariff ? database.tariff.length : 0,
        currentDatabase: currentDatabase,
        currentRole: currentRole
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
    
    // Инициализация системы аутентификации
    Auth.initialize();
    
    // Небольшая задержка для гарантии загрузки всех модулей
    setTimeout(() => {
        // Проверяем авторизацию при загрузке
        AuthUI.checkAuthOnLoad();
    }, 100);
    
    // СРОЧНО: Принудительно скрываем модальное окно при загрузке
    const modal = document.getElementById('margin-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.add('hidden');
        console.log('✅ Модальное окно принудительно скрыто');
    }
    
    // Обновляем видимость кнопок базы данных при загрузке
    updateDatabaseButtonsVisibility();
    
    // Загружаем курс ЦБ РФ
    await loadExchangeRate();
    
    // Автоматически загружаем данные с сервера при запуске
    await loadDatabaseData();
    console.log('✅ Данные загружены с сервера при инициализации');
    
    // Проверяем наличие библиотеки XLSX
    if (typeof XLSX === 'undefined') {
        console.error('❌ Библиотека XLSX не загружена');
        Utils.showStatus('Ошибка: библиотека XLSX не загружена', 'error');
    }
    
    // Добавляем отображение текущего курса
    addExchangeRateDisplay();
});

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