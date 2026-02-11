// 🎯 ОСНОВНОЙ ФАЙЛ ПРИЛОЖЕНИЯ - ТЕПЕРЬ ИСПОЛЬЗУЕТ МОДУЛИ
console.log('✅ script.js загружен и выполняется');

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
async function selectRole(role) {
    const currentUser = await ServerAuth.getCurrentUser();
    
    if (!currentUser) {
        Utils.showStatus('Ошибка: пользователь не авторизован', 'error');
        return;
    }
    
    // Обновляем роль пользователя в системе
    // Auth.updateUserRole(currentUser.id, role); // Функция не реализована
    
    currentRole = role;
    document.getElementById('role-selection').classList.add('hidden');
    document.getElementById('database-selection').classList.remove('hidden');
    updateDatabaseButtonsVisibility();
    
    Utils.showStatus(`Выбран режим: ${role === 'purchaser' ? 'Менеджер по закупу' : 'Менеджер по продажам'}`, 'success');
}

function setCurrentRole(role) {
    currentRole = role;
    window.currentRole = role;
}

function setCurrentDatabase(dbType) {
    currentDatabase = dbType;
    window.currentDatabase = dbType;
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

function setPurchaserMenuState(dbType = '') {
    const purchaserGroup = document.querySelector('[data-purchaser-group="purchaser"]');
    if (purchaserGroup) {
        purchaserGroup.classList.toggle('is-active', Boolean(dbType));
        if (purchaserGroup.tagName === 'DETAILS') {
            purchaserGroup.open = Boolean(dbType);
        }
    }

    const dbButtons = document.querySelectorAll('[data-purchaser-db]');
    dbButtons.forEach((button) => {
        button.classList.toggle('is-active', Boolean(dbType) && button.dataset.purchaserDb === dbType);
    });
}

function updateSalesHeaderTitle() {
    const header = document.querySelector('#sales-interface .section-header h2');
    if (!header) return;
    if (currentCalculationType === 'complex') {
        header.textContent = 'Калькулятор ставок — комплексные';
        return;
    }
    if (currentCalculationType === 'separate' && currentDatabase) {
        const names = {
            sea: 'Море',
            rail: 'ЖД',
            direct_rail: 'Прямое ЖД',
            direct_sea: 'Прямое море',
            tariff: 'Тариф'
        };
        header.textContent = `Калькулятор ставок — раздельные: ${names[currentDatabase] || currentDatabase}`;
        return;
    }
    header.textContent = 'Калькулятор ставок';
}

function setMainHeaderTitle(title) {
    const headerTitle = document.getElementById('main-header-title');
    if (!headerTitle) return;
    headerTitle.textContent = title || 'Калькулятор ставок';
}

function getDatabaseLabel(dbType) {
    const names = {
        sea: 'Море',
        rail: 'ЖД',
        direct_rail: 'Прямое ЖД',
        direct_sea: 'Прямое море',
        tariff: 'Тариф'
    };
    return names[dbType] || dbType || '';
}

function getSalesMainTitle() {
    if (currentCalculationType === 'complex') {
        return 'Менеджер по продажам — комплексные ставки';
    }
    if (currentCalculationType === 'separate') {
        if (currentDatabase) {
            return `Менеджер по продажам — раздельные: ${getDatabaseLabel(currentDatabase)}`;
        }
        return 'Менеджер по продажам — раздельные ставки';
    }
    return 'Менеджер по продажам';
}

function getPurchaserMainTitle() {
    if (currentDatabase) {
        return `Закупщик — ${getDatabaseLabel(currentDatabase)}`;
    }
    return 'Закупщик';
}

function updatePurchaserTemplateInfo(dbType) {
    const infoRoot = document.getElementById('purchaser-template-info');
    if (!infoRoot) return;

    const titleEl = document.getElementById('template-title');
    const descriptionEl = document.getElementById('template-description');
    const columnsEl = document.getElementById('template-columns');
    const downloadEl = document.getElementById('template-download');

    const config = {
        sea: {
            title: 'Формат файла — Морские перевозки',
            required: ['POL', 'POD'],
            optional: [
                'Date of validity', 'Agent', 'Carrier', 'City', 'Transit port',
                'DROP OFF AREA VIA VVO', 'SOC 20', 'SOC 40', "20'DC", "40'HC",
                'Конвертация', 'ETD', 'Remarks'
            ],
            download: { href: 'templates/template-sea.xlsx', label: 'морских перевозок' }
        },
        direct_sea: {
            title: 'Формат файла — Прямое море',
            required: ['POL', 'POD'],
            optional: [
                'Date of validity', 'Agent', 'Carrier', "20'DC", "40'HC",
                'Конвертация', 'ETD', 'Remarks'
            ],
            download: { href: 'templates/template-direct-sea.xlsx', label: 'прямого моря' }
        },
        direct_rail: {
            title: 'Формат файла — Прямое ЖД',
            required: ['станция отправления', 'станция прибытия'],
            optional: [
                'дата котировки', 'Agent', 'FOB', 'погран переход', 'город прибытия',
                "FOB 40'HC", "EXW/FCA 40'HC", 'ETD', 'Конвертация', 'Remark'
            ],
            download: { href: 'templates/template-direct-rail.xlsx', label: 'прямого ЖД' }
        },
        rail: {
            title: 'Формат файла — Железнодорожные перевозки',
            required: ['City', 'Пункт назначения'],
            optional: [
                'Агент', 'Тыловой Терминал', 'Автовывоз', 'ПРР',
                '20фут ктк ( до 24 тонн)', '20фут ктк (от 24 тонн до 28 тонн)',
                '40фут ктк', 'НДС', 'ВОХР 20', 'ВОХР 40', 'Фитинг/ПВ',
                'Условия', 'Валидность'
            ],
            download: { href: 'templates/template-rail.xlsx', label: 'железнодорожных перевозок' }
        }
    };

    const info = config[dbType];
    if (!info) {
        if (titleEl) titleEl.textContent = 'Формат файла для загрузки';
        if (descriptionEl) descriptionEl.textContent = 'Выберите тип перевозки слева, чтобы увидеть требования к файлу.';
        if (columnsEl) columnsEl.textContent = '';
        if (downloadEl) downloadEl.innerHTML = '';
        return;
    }

    if (titleEl) titleEl.textContent = info.title;
    if (descriptionEl) descriptionEl.textContent = 'Используйте следующий формат столбцов в Excel файле:';
    if (columnsEl) {
        const required = info.required.length
            ? `<strong>Обязательные заголовки:</strong> ${info.required.join(', ')}`
            : '';
        const optional = info.optional.length
            ? `<br><strong>Дополнительные заголовки:</strong> ${info.optional.join(', ')}`
            : '';
        const note = '<br><strong>Примечание:</strong> Заголовки обязательны, значения могут быть пустыми.';
        columnsEl.innerHTML = `${required}${optional}${note}`;
    }
    if (downloadEl) {
        downloadEl.innerHTML = `<a href="${info.download.href}" download class="download-link">📥 Скачать шаблон Excel файла для ${info.download.label}</a>`;
    }
}

function updateMainHeaderFromState() {
    const loginSection = document.getElementById('login-section');
    if (loginSection && !loginSection.classList.contains('hidden')) {
        setMainHeaderTitle('Вход в систему');
        return;
    }
    const changePasswordSection = document.getElementById('change-password-section');
    if (changePasswordSection && !changePasswordSection.classList.contains('hidden')) {
        setMainHeaderTitle('Смена пароля');
        return;
    }
    const emailConfig = document.getElementById('email-config-section');
    if (emailConfig && !emailConfig.classList.contains('hidden')) {
        setMainHeaderTitle('Настройка email');
        return;
    }
    const uploadHistory = document.getElementById('upload-history-section');
    if (uploadHistory && !uploadHistory.classList.contains('hidden')) {
        setMainHeaderTitle('История загрузок');
        return;
    }
    const adminPanel = document.getElementById('admin-panel');
    if (adminPanel && !adminPanel.classList.contains('hidden')) {
        setMainHeaderTitle('Управление пользователями');
        return;
    }
    const salesInterface = document.getElementById('sales-interface');
    if (salesInterface && !salesInterface.classList.contains('hidden')) {
        setMainHeaderTitle(getSalesMainTitle());
        return;
    }
    const purchaserInterface = document.getElementById('purchaser-interface');
    const tariffInterface = document.getElementById('tariff-interface');
    if ((purchaserInterface && !purchaserInterface.classList.contains('hidden')) ||
        (tariffInterface && !tariffInterface.classList.contains('hidden'))) {
        setMainHeaderTitle(getPurchaserMainTitle());
        return;
    }
    const calculationSelection = document.getElementById('calculation-type-selection');
    if (calculationSelection && !calculationSelection.classList.contains('hidden')) {
        setMainHeaderTitle('Менеджер по продажам');
        return;
    }
    const databaseSelection = document.getElementById('database-selection');
    if (databaseSelection && !databaseSelection.classList.contains('hidden')) {
        const role = window.currentRole || currentRole;
        if (role === 'purchaser') {
            setMainHeaderTitle('Закупщик');
            return;
        }
        if (role === 'sales') {
            setMainHeaderTitle('Менеджер по продажам');
            return;
        }
    }
    const roleSelection = document.getElementById('role-selection');
    if (roleSelection && !roleSelection.classList.contains('hidden')) {
        setMainHeaderTitle('Выбор роли');
        return;
    }
    setMainHeaderTitle('Калькулятор ставок');
}

function ensureSidebarVisible() {
    if (typeof setSidebarVisibility === 'function') {
        setSidebarVisibility(true);
        return;
    }
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar) {
        sidebar.classList.remove('hidden');
    }
    document.body.classList.add('sidebar-visible');
}

function initUploadHistoryFrameAutoHeight() {
    const frame = document.getElementById('upload-history-frame');
    if (!frame) return;

    window.addEventListener('message', (event) => {
        if (event.origin !== window.location.origin) return;
        if (!frame.contentWindow || event.source !== frame.contentWindow) return;
        const data = event.data;
        if (!data || data.type !== 'upload-history-height') return;
        const height = Number(data.height);
        if (!Number.isFinite(height) || height <= 0) return;
        frame.style.height = `${Math.max(400, Math.ceil(height))}px`;
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUploadHistoryFrameAutoHeight);
} else {
    initUploadHistoryFrameAutoHeight();
}

function hideMainSections() {
    const sectionIds = [
        'login-section',
        'change-password-section',
        'admin-panel',
        'email-config-section',
        'upload-history-section',
        'role-selection',
        'database-selection',
        'purchaser-interface',
        'tariff-interface',
        'calculation-type-selection',
        'sales-interface'
    ];

    sectionIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('hidden');
        }
    });
}

function adminShowAdminPanel() {
    setCurrentRole('admin');
    ensureSidebarVisible();
    hideMainSections();
    const adminPanel = document.getElementById('admin-panel');
    if (adminPanel) {
        adminPanel.classList.remove('hidden');
    }
    if (typeof loadUsersList === 'function') {
        loadUsersList();
    }
    updateMainHeaderFromState();
}

function adminOpenPurchaser(dbType) {
    setCurrentRole('purchaser');
    setSalesMenuState('');
    setPurchaserMenuState(dbType);
    ensureSidebarVisible();
    hideMainSections();
    setMainHeaderTitle(`Закупщик — ${getDatabaseLabel(dbType)}`);
    updatePurchaserTemplateInfo(dbType);
    selectDatabase(dbType);
}

function adminShowEmailConfig() {
    setCurrentRole('admin');
    ensureSidebarVisible();
    hideMainSections();
    const section = document.getElementById('email-config-section');
    if (section) {
        section.classList.remove('hidden');
    }
    if (typeof loadEmailConfig === 'function') {
        loadEmailConfig();
    }
    updateMainHeaderFromState();
}

function adminShowUploadHistory() {
    setCurrentRole('admin');
    ensureSidebarVisible();
    hideMainSections();
    const section = document.getElementById('upload-history-section');
    if (section) {
        section.classList.remove('hidden');
    }
    const frame = document.getElementById('upload-history-frame');
    if (frame && !frame.src) {
        const src = frame.getAttribute('data-src');
        if (src) {
            frame.src = src;
        }
    }
    updateMainHeaderFromState();
}

function adminOpenSalesSeparate(dbType) {
    setCurrentRole('sales');
    currentCalculationType = 'separate';
    setSalesMenuState('separate', dbType);
    setPurchaserMenuState('');
    updateSalesHeaderTitle();
    ensureSidebarVisible();
    hideMainSections();
    setMainHeaderTitle(`Менеджер по продажам — раздельные: ${getDatabaseLabel(dbType)}`);
    selectDatabase(dbType);
}

function adminOpenSalesComplex() {
    setCurrentRole('sales');
    setCurrentDatabase('');
    currentCalculationType = 'complex';
    setSalesMenuState('complex');
    setPurchaserMenuState('');
    updateSalesHeaderTitle();
    ensureSidebarVisible();
    hideMainSections();
    setMainHeaderTitle('Менеджер по продажам — комплексные ставки');
    selectCalculationType('complex');
}

async function selectSalesRole() {
    const currentUser = await ServerAuth.getCurrentUser();
    
    if (!currentUser) {
        Utils.showStatus('Ошибка: пользователь не авторизован', 'error');
        return;
    }
    
    // Обновляем роль пользователя в системе
    // Auth.updateUserRole(currentUser.id, 'sales'); // Функция не реализована
    
    currentRole = 'sales';
    document.getElementById('role-selection').classList.add('hidden');
    document.getElementById('calculation-type-selection').classList.remove('hidden');
    updateDatabaseButtonsVisibility();
    
    Utils.showStatus('Выбран режим: Менеджер по продажам', 'success');
}

async function selectDatabase(dbType) {
    const currentUser = await ServerAuth.getCurrentUser();
    
    if (!currentUser) {
        Utils.showStatus('Ошибка: пользователь не авторизован', 'error');
        return;
    }
    
    // Используем глобальную переменную window.currentRole
    const role = window.currentRole || currentRole;
    if (role === 'sales') {
        currentCalculationType = 'separate';
        setSalesMenuState('separate', dbType);
        updateSalesHeaderTitle();
        setMainHeaderTitle(`Менеджер по продажам — раздельные: ${getDatabaseLabel(dbType)}`);
    } else if (role === 'purchaser') {
        setPurchaserMenuState(dbType);
        setMainHeaderTitle(`Закупщик — ${getDatabaseLabel(dbType)}`);
        updatePurchaserTemplateInfo(dbType);
    }
    
    // Проверяем права доступа для тарифов
    if (dbType === 'tariff' && !['purchaser', 'admin'].includes(currentUser.role)) {
        Utils.showStatus('Доступ запрещен. Только менеджеры по закупу могут управлять тарифами.', 'error');
        return;
    }
    
    setCurrentDatabase(dbType);
    console.log('🎯 Выбран тип базы данных:', dbType, 'для роли:', role);
    document.getElementById('database-selection').classList.add('hidden');
    
    // Синхронизируем данные с сервером при каждом входе (только после авторизации)
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

    updateMainHeaderFromState();
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
            // Показываем кнопку "Тариф" только для закупщика и администратора
            if (role === 'purchaser' || role === 'admin') {
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
        setCurrentDatabase('');
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
        setCurrentDatabase('');
        document.getElementById('tariff-interface').classList.add('hidden');
        document.getElementById('database-selection').classList.remove('hidden');
        updateDatabaseButtonsVisibility();
    } else if (role === 'purchaser' && currentDatabase) {
        // Возврат для закупщика из интерфейса загрузки файлов
        console.log('🔙 Возврат из интерфейса загрузки файлов для закупщика');
        setCurrentDatabase('');
        document.getElementById('purchaser-interface').classList.add('hidden');
        document.getElementById('database-selection').classList.remove('hidden');
        updateDatabaseButtonsVisibility();
    } else if (role === 'purchaser') {
        // Возврат к выбору типа базы данных
        console.log('🔙 Возврат к выбору типа базы данных для закупщика');
        setCurrentDatabase('');
        document.getElementById('purchaser-interface').classList.add('hidden');
        document.getElementById('tariff-interface').classList.add('hidden');
        document.getElementById('database-selection').classList.remove('hidden');
        updateDatabaseButtonsVisibility();
    } else {
        // Общий возврат к выбору роли
        console.log('🔙 Общий возврат к выбору роли');
        currentRole = '';
        setCurrentDatabase('');
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
        setSalesMenuState(currentCalculationType, currentDatabase);
        updateSalesHeaderTitle();
    } else if (role === 'purchaser') {
        setPurchaserMenuState(currentDatabase);
    }

    updateMainHeaderFromState();
}

window.setMainHeaderTitle = setMainHeaderTitle;
window.updateMainHeaderFromState = updateMainHeaderFromState;

// Функция перенаправления менеджера по продажам на отдельный интерфейс
async function redirectToSalesInterface(options = null) {
    const currentUser = await ServerAuth.getCurrentUser();
    
    if (!currentUser) {
        Utils.showStatus('Ошибка: пользователь не авторизован', 'error');
        return;
    }
    
    // Для администратора не меняем роль, для остальных пользователей обновляем роль
    if (currentUser.role !== ServerAuth.USER_ROLES.ADMIN) {
        // Auth.updateUserRole(currentUser.id, 'sales'); // Функция не реализована
    }
    
    const resolvedOptions = options && typeof options === 'object' ? options : {};
    const params = new URLSearchParams();
    if (resolvedOptions.calcType) {
        params.set('calc', resolvedOptions.calcType);
    }
    if (resolvedOptions.dbType) {
        params.set('db', resolvedOptions.dbType);
    }
    const query = params.toString();
    
    // Для всех пользователей (включая администратора) перенаправляем на отдельный интерфейс
    window.location.href = `interfaces/sales-interface.html${query ? `?${query}` : ''}`;
}

// Функция перенаправления менеджера по закупкам на отдельный интерфейс
async function redirectToPurchaserInterface(options = null) {
    const currentUser = await ServerAuth.getCurrentUser();
    
    if (!currentUser) {
        Utils.showStatus('Ошибка: пользователь не авторизован', 'error');
        return;
    }
    
    // Для администратора не меняем роль, для остальных пользователей обновляем роль
    if (currentUser.role !== ServerAuth.USER_ROLES.ADMIN) {
        // Auth.updateUserRole(currentUser.id, 'purchaser'); // Функция не реализована
    }
    
    const resolvedOptions = typeof options === 'string'
        ? { dbType: options }
        : (options && typeof options === 'object' ? options : {});
    const params = new URLSearchParams();
    if (resolvedOptions.dbType) {
        params.set('db', resolvedOptions.dbType);
    }
    const query = params.toString();
    
    // Для всех пользователей (включая администратора) перенаправляем на отдельный интерфейс
    window.location.href = `interfaces/purchaser-interface.html${query ? `?${query}` : ''}`;
}

// Функция перенаправления на страницу истории загрузок
async function redirectToTariffHistory() {
    console.log('🔍 redirectToTariffHistory вызвана - проверка кнопки');
    console.log('🔍 window.location.href:', window.location.href);
    console.log('🔍 ServerAuth доступен?', typeof ServerAuth);
    
    // Проверяем, доступна ли функция getCurrentUser
    if (typeof ServerAuth.getCurrentUser !== 'function') {
        console.error('❌ ServerAuth.getCurrentUser не является функцией');
        Utils.showStatus('Ошибка: модуль аутентификации не загружен', 'error');
        return;
    }
    
    const currentUser = await ServerAuth.getCurrentUser();
    console.log('🔍 currentUser:', currentUser);
    
    if (!currentUser) {
        console.log('🔍 Пользователь не авторизован');
        Utils.showStatus('Ошибка: пользователь не авторизован', 'error');
        return;
    }
    
    // Проверяем, есть ли у пользователя роль администратора
    // Если роль отсутствует, всё равно разрешаем переход (сервер проверит права)
    if (currentUser.role && currentUser.role !== 'admin') {
        console.log('🔍 Пользователь не администратор, но разрешаем переход для проверки сервером');
    }
    
    console.log('🔍 Перенаправление на tariff-history.html');
    // Перенаправляем на страницу истории загрузок
    window.location.href = 'interfaces/tariff-history.html';
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
    document.getElementById('city').value = '';
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

    const multiselects = document.querySelectorAll('.trd-multiselect');
    multiselects.forEach(select => {
        select.dataset.selected = '[]';
        select.classList.remove('is-open');
        const trigger = select.querySelector('.trd-ms-trigger');
        if (trigger) trigger.textContent = 'Все';
        select.querySelectorAll('input[type="checkbox"]').forEach(input => {
            input.checked = false;
        });
        const search = select.querySelector('.trd-ms-search');
        if (search) search.value = '';
    });
}

// Функции для менеджера по продажам
function setupCalculator() {
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
        setSalesMenuState('separate', currentDatabase);
        updateSalesHeaderTitle();
        setMainHeaderTitle('Менеджер по продажам — раздельные ставки');
    } else {
        setCurrentDatabase('');
        setSalesMenuState('complex');
        updateSalesHeaderTitle();
        setMainHeaderTitle('Менеджер по продажам — комплексные ставки');
        // Показываем интерфейс комплексного расчета
        document.getElementById('calculation-type-selection').classList.add('hidden');
        document.getElementById('sales-interface').classList.remove('hidden');
        resetCalculatorForm();
        loadDatabaseData().then(() => setupCalculator());
        Utils.showLastUpdate();
        
        // Обновляем кнопки в заголовке для комплексных ставок
        updateSalesHeaderButtons();
    }

    updateMainHeaderFromState();
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

    fillSelect(lineSelect, lineValues);
    fillSelect(agentSelect, agentValues);
    fillSelect(terminalSelect, terminalValues);

    // мульти-чипы отключены

    const rateTypeSelect = document.getElementById('complex-rate-type');
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

async function loadDatabaseData() {
    // 🔧 ПРОВЕРЯЕМ АВТОРИЗАЦИЮ ПЕРЕД ЗАГРУЗКОЙ ДАННЫХ
    const currentUser = await ServerAuth.getCurrentUser();
    if (!currentUser) {
        console.warn('⚠️ Пользователь не авторизован, загружаем только локальные данные');
        // Загружаем только локальные данные без обращения к серверу
        loadLocalDataOnly();
        return;
    }
    
    // 🔧 ЗАГРУЗКА ДАННЫХ ИЗ СЕРВЕРА ДЛЯ ВСЕХ ТИПОВ БАЗ
    const dbTypes = ['sea', 'rail', 'direct_rail', 'direct_sea', 'tariff'];
    
    for (const dbType of dbTypes) {
        try {
            const response = await ServerAuth.makeAuthRequest(`/api/data/${dbType}`);
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

// Функция для загрузки только локальных данных (без обращения к серверу)
function loadLocalDataOnly() {
    const dbTypes = ['sea', 'rail', 'direct_rail', 'direct_sea', 'tariff'];
    
    for (const dbType of dbTypes) {
        const savedData = localStorage.getItem(`logistics_db_${dbType}`);
        if (savedData) {
            try {
                database[dbType] = JSON.parse(savedData);
                console.log(`✅ Загружены локальные данные для ${dbType}: ${database[dbType].length} записей`);
            } catch (localError) {
                console.error(`❌ Ошибка загрузки локальных данных для ${dbType}:`, localError);
                database[dbType] = [];
            }
        } else {
            console.warn(`⚠️ Нет локальных данных для ${dbType}`);
            database[dbType] = [];
        }
    }
    
    // 🔧 ЭКСПОРТИРУЕМ ДАННЫЕ В ГЛОБАЛЬНУЮ ОБЛАСТЬ ДЛЯ МОДУЛЕЙ
    window.database = database;
    console.log('🌐 Локальные данные экспортированы в window.database для модулей');
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
                    // Получаем стоимость ВТТ из тарифов для терминала (если есть)
                    const terminal = railItem.agent || railItem.city || '';
                    const vttRate = getVttRateForTerminal(terminal);
                    
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
    window.displayedResults = allResults;
    
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

    const blob = new Blob([lines.join('\\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `complex_rates_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

window.updateComplexSummary = updateComplexSummary;

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
            const exchangeEl = document.getElementById('exchange-rate-value');
            if (exchangeEl) {
                exchangeEl.textContent = usdToRubRate || '-';
            }
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
    const exchangeEl = document.getElementById('exchange-rate-value');
    if (exchangeEl) {
        exchangeEl.textContent = usdToRubRate || '-';
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Приложение логистики инициализировано');

    // 🔧 Очищаем поле с подсказками при повторном клике, чтобы показать полный список
    document.addEventListener('mousedown', event => {
        const target = event.target;
        if (target instanceof HTMLInputElement && target.getAttribute('list')) {
            if (target.value.trim() !== '') {
                target.value = '';
                target.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    });
    
    // Инициализация системы аутентификации
    ServerAuth.initialize();
    
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
    
    // НЕ загружаем данные с сервера при запуске - ждем авторизации
    // Данные будут загружены при выборе роли или базы данных
    console.log('⏳ Ожидание авторизации для загрузки данных с сервера');

    updateMainHeaderFromState();
    
    // Проверяем наличие библиотеки XLSX
    if (typeof XLSX === 'undefined') {
        console.error('❌ Библиотека XLSX не загружена');
        Utils.showStatus('Ошибка: библиотека XLSX не загружена', 'error');
    }
    
    // Добавляем отображение текущего курса
    updateExchangeRateDisplay();
});
