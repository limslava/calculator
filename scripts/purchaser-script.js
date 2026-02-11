// 🎯 ОСНОВНОЙ ФАЙЛ ДЛЯ МЕНЕДЖЕРА ПО ЗАКУПАМ

// Глобальные переменные
let currentDatabase = '';
let uploadedData = null;
let database = {
    sea: [],
    rail: [],
    direct_rail: [],
    direct_sea: [],
    tariff: [],
    agent_tariff: []
};
let editingTariffIndex = -1; // Индекс редактируемого тарифа в таблице
let currentTariffType = 'terminal'; // 'terminal' или 'agent'
function escapeHtml(value) {
    return (window.Utils && typeof Utils.escapeHtml === 'function')
        ? Utils.escapeHtml(value)
        : String(value ?? '');
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
    console.log('🚀 Приложение менеджера по закупкам инициализировано');
    
    // Проверяем авторизацию с сервера
    const currentUser = await checkAuth();
    window.currentUser = currentUser;
    if (!currentUser || (currentUser.role !== 'purchaser' && currentUser.role !== 'admin')) {
        // Если пользователь не авторизован или не имеет прав доступа, перенаправляем на главную
        console.log('❌ Неавторизованный доступ, перенаправление на главную');
        window.location.href = '../index.html';
        return;
    }
    
    console.log('✅ Пользователь авторизован:', currentUser.email, 'Роль:', currentUser.role);
    
    // Автоматически загружаем данные с сервера при запуске
    await loadDatabaseData();
    console.log('✅ Данные загружены с сервера при инициализации');
    
    // Инициализируем модальное окно терминала
    initTerminalModal();
    
    // Пытаемся применить deep-link из URL
    const deepLinkApplied = applyPurchaserDeepLink();
    
    // Показываем выбор типа базы данных только если deep-link не применен
    if (!deepLinkApplied) {
        document.getElementById('database-selection').classList.remove('hidden');
    }

    document.body.classList.add('sidebar-visible');

    const sidebarEmail = document.getElementById('sidebar-user-email');
    if (sidebarEmail && currentUser?.email) {
        sidebarEmail.textContent = currentUser.email;
    }

    setPurchaserMenuState(currentDatabase);
});

// Функции для управления интерфейсом
function openPurchaserDatabaseView(dbType) {
    if (dbType === 'tariff') {
        console.log('🔧 Открываем интерфейс тарифов для закупщика');
        document.getElementById('tariff-interface').classList.remove('hidden');
        // Показываем время обновления тарифов
        Utils.showLastUpdate('tariff', 'last-update-tariff');
        // Устанавливаем тип тарифов по умолчанию (терминалы)
        currentTariffType = 'terminal';
        // Загружаем данные для обоих типов
        console.log('📥 Вызов loadTariffData...');
        loadTariffData();
        console.log('📥 Вызов loadAgentTariffData...');
        loadAgentTariffData();
        // Активируем кнопку терминалов
        console.log('🔄 Активация типа terminal');
        switchTariffType('terminal');
    } else {
        console.log('🔧 Открываем интерфейс загрузки файлов для закупщика:', dbType);
        document.getElementById('purchaser-interface').classList.remove('hidden');
        // Показываем время обновления текущей базы
        Utils.showLastUpdate(dbType, 'last-update-purchaser');
        // Очищаем предыдущие данные
        document.getElementById('excel-file').value = '';
        document.getElementById('process-file').disabled = true;
        document.getElementById('data-preview').classList.add('hidden');
        uploadedData = null;
        // Инициализируем загрузку файлов
        setupFileUpload();
        // Инициализируем отображение загруженных ставок для выбранного типа
        initUploadedRates(dbType);
    }
}

function selectDatabase(dbType, options = {}) {
    currentDatabase = dbType;
    console.log('🎯 Выбран тип базы данных:', dbType);
    setPurchaserMenuState(dbType);
    
    document.getElementById('database-selection').classList.add('hidden');
    
    if (options.skipLoad) {
        openPurchaserDatabaseView(dbType);
        return;
    }
    
    // Синхронизируем данные с сервером при каждом входе
    loadDatabaseData().then(() => {
        openPurchaserDatabaseView(dbType);
    });
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

// Переключение типа тарифов (терминалы/агенты)
function switchTariffType(type) {
    console.log('🔄 Переключение типа тарифов:', type);
    currentTariffType = type;
    
    // Обновляем активность кнопок
    const terminalBtn = document.getElementById('terminal-tariff-btn');
    const agentBtn = document.getElementById('agent-tariff-btn');
    if (terminalBtn) terminalBtn.classList.toggle('active', type === 'terminal');
    if (agentBtn) agentBtn.classList.toggle('active', type === 'agent');
    
    // Показываем/скрываем соответствующие секции
    const terminalSection = document.getElementById('terminal-tariff-section');
    const agentSection = document.getElementById('agent-tariff-section');
    if (terminalSection) {
        terminalSection.classList.toggle('hidden', type !== 'terminal');
        console.log(`📦 Секция терминалов hidden: ${terminalSection.classList.contains('hidden')}`);
    }
    if (agentSection) {
        agentSection.classList.toggle('hidden', type !== 'agent');
        console.log(`📦 Секция агентов hidden: ${agentSection.classList.contains('hidden')}`);
    }
    
    // Если переключились на агентов и таблица пуста, добавляем строку
    if (type === 'agent') {
        const tbody = document.getElementById('agent-tariff-table-body');
        if (tbody && tbody.children.length === 0) {
            addAgentTariffRow();
        }
    }
    
    // Обновляем предпросмотр в зависимости от типа
    updateTariffPreview();
}

function goBack() {
    console.log('🔙 Нажата кнопка "Назад":', { currentDatabase });
    
    if (currentDatabase === 'tariff') {
        // Возврат из интерфейса тарифов к выбору типа базы данных
        console.log('🔙 Возврат из интерфейса тарифов для закупщика');
        currentDatabase = '';
        document.getElementById('tariff-interface').classList.add('hidden');
        document.getElementById('database-selection').classList.remove('hidden');
    } else if (currentDatabase) {
        // Возврат для закупщика из интерфейса загрузки файлов
        console.log('🔙 Возврат из интерфейса загрузки файлов для закупщика');
        currentDatabase = '';
        document.getElementById('purchaser-interface').classList.add('hidden');
        document.getElementById('database-selection').classList.remove('hidden');
    } else {
        // Возврат к выбору типа базы данных (уже показан)
        console.log('🔙 Уже в выборе типа базы данных');
    }
    
    console.log('✅ После нажатия "Назад":', { currentDatabase });
    setPurchaserMenuState(currentDatabase);
}

function applyPurchaserDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const dbType = params.get('db');
    if (!dbType) {
        return false;
    }
    const allowed = ['sea', 'rail', 'direct_rail', 'direct_sea', 'tariff'];
    if (!allowed.includes(dbType)) {
        return false;
    }
    selectDatabase(dbType, { skipLoad: true });
    return true;
}

// Функции для закупщика
function setupFileUpload() {
    const fileInput = document.getElementById('excel-file');
    const processButton = document.getElementById('process-file');
    const fileNameDisplay = document.getElementById('selected-file-name');
    const fileLabel = document.querySelector('.file-label');
    
    console.log('🔧 Настройка загрузки файлов для базы:', currentDatabase);
    
    if (!fileInput || !processButton || !fileNameDisplay || !fileLabel) {
        console.error('❌ Не найдены элементы для загрузки файлов');
        return;
    }
    
    // Сбрасываем состояние
    fileInput.value = '';
    processButton.disabled = true;
    fileNameDisplay.textContent = 'Файл не выбран';
    fileLabel.classList.remove('file-selected');
    
    fileInput.onchange = function(e) {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            const fileName = file.name;
            const fileSize = (file.size / 1024).toFixed(2); // KB
            
            // Отображаем имя файла
            fileNameDisplay.textContent = `${fileName} (${fileSize} KB)`;
            
            // Добавляем визуальную обратную связь
            fileLabel.classList.add('file-selected');
            
            // Включаем кнопку обработки
            processButton.disabled = false;
            
            // Показываем статус
            Utils.showStatus(`Файл "${fileName}" выбран. Нажмите "Обработать файл"`, 'success');
        } else {
            // Если файл не выбран (например, пользователь отменил выбор)
            fileNameDisplay.textContent = 'Файл не выбран';
            fileLabel.classList.remove('file-selected');
            processButton.disabled = true;
        }
    };
    
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
            } else if (currentDatabase === 'agent_tariff') {
                uploadedData = Utils.parseAgentTariffData(jsonData);
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

// Функция для отображения предварительного просмотра данных
function showDataPreview(data) {
    const previewSection = document.getElementById('data-preview');
    const previewTable = document.getElementById('preview-table');
    const uploadButton = document.getElementById('upload-data');
    
    if (!previewSection || !previewTable || !uploadButton) {
        console.error('❌ Не найдены элементы для отображения предварительного просмотра');
        return;
    }
    
    if (!data || data.length === 0) {
        previewTable.innerHTML = '<p style="color: red; text-align: center;">Нет данных для отображения</p>';
        previewSection.classList.remove('hidden');
        uploadButton.disabled = true;
        return;
    }
    
    console.log('📊 Отображение предварительного просмотра данных:', data.length, 'записей');
    
    let tableHTML = `
        <table>
            <thead>
                <tr>
    `;
    
    // Создаем заголовки таблицы на основе первого элемента данных
    const firstRow = data[0];
    if (firstRow) {
        Object.keys(firstRow).forEach(key => {
            tableHTML += `<th>${escapeHtml(key)}</th>`;
        });
    }
    
    tableHTML += `
                </tr>
            </thead>
            <tbody>
    `;
    
    // Отображаем первые 10 записей для предварительного просмотра
    const previewData = data.slice(0, 10);
    previewData.forEach(row => {
        tableHTML += '<tr>';
        Object.values(row).forEach(value => {
            tableHTML += `<td>${escapeHtml(value || '-')}</td>`;
        });
        tableHTML += '</tr>';
    });
    
    tableHTML += `
            </tbody>
        </table>
        <p style="margin-top: 10px; color: #666; font-size: 14px;">
            📊 Показано ${previewData.length} из ${data.length} записей
        </p>
    `;
    
    previewTable.innerHTML = tableHTML;
    previewSection.classList.remove('hidden');
    uploadButton.disabled = false;
    
    Utils.showStatus(`Обработано ${data.length} записей. Проверьте данные и нажмите "Загрузить в базу"`, 'success');
}

// Функция для загрузки данных в базу данных
async function uploadDataToDatabase() {
    if (!uploadedData || uploadedData.length === 0) {
        Utils.showStatus('Нет данных для загрузки', 'error');
        return;
    }

    if (!currentDatabase) {
        Utils.showStatus('Не выбран тип базы данных', 'error');
        return;
    }

    Utils.showStatus('Загрузка данных в базу...', '');

    try {
        // Получаем токен авторизации
        const token = localStorage.getItem('auth_token');
        
        // Отправляем данные на сервер
        const response = await fetch(`/api/data/${currentDatabase}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                data: uploadedData,
                type: currentDatabase
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.success) {
            // Обновляем локальную копию данных
            database[currentDatabase] = uploadedData;
            
            console.log(`✅ Данные успешно загружены в серверную базу ${currentDatabase}: ${uploadedData.length} записей`);
            Utils.showStatus(`✅ Данные успешно загружены в серверную базу ${currentDatabase} (${uploadedData.length} записей)`, 'success');
            
            // Обновляем отображение времени обновления
            await Utils.showLastUpdate(currentDatabase, 'last-update-purchaser');
            
            // Сбрасываем состояние
            uploadedData = null;
            document.getElementById('excel-file').value = '';
            document.getElementById('process-file').disabled = true;
            document.getElementById('data-preview').classList.add('hidden');
            
            // Обновляем список загруженных ставок - показываем сами ставки, а не историю
            if (typeof loadLatestRates === 'function') {
                loadLatestRates(currentDatabase);
            } else {
                // Если функция не доступна, загружаем историю как запасной вариант
                loadUploadedRates();
            }
            
        } else {
            throw new Error(result.message || 'Ошибка загрузки данных');
        }
        
    } catch (error) {
        console.error('❌ Ошибка загрузки данных в базу:', error);
        Utils.showStatus(`Ошибка загрузки данных: ${error.message}`, 'error');
    }
    
}

// Функция для загрузки данных с сервера
async function loadDatabaseData() {
    const dbTypes = ['sea', 'rail', 'direct_rail', 'direct_sea', 'tariff', 'agent_tariff'];

    const currentUser = window.currentUser || await ServerAuth.getCurrentUser();
    if (!currentUser) {
        console.warn('⚠️ Пользователь не авторизован, загружаем только локальные данные');
        loadLocalDataOnly();
        return;
    }

    for (const dbType of dbTypes) {
        try {
            const response = await ServerAuth.makeAuthRequest(`/api/data/${dbType}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const serverData = await response.json();
            database[dbType] = serverData.data || [];
            console.log(`✅ Загружены данные с сервера для ${dbType}: ${database[dbType].length} записей`, dbType === 'tariff' ? serverData.data : '');

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
            }
            
            // Если загружены тарифы и мы находимся в интерфейсе тарифов, показываем их
            if (dbType === 'tariff' && database.tariff.length > 0 && currentDatabase === 'tariff') {
                // Тарифы уже загружены, интерфейс обновится через loadTariffData()
                // Ничего дополнительного не делаем
            }
            
        } catch (error) {
            console.error(`❌ Ошибка загрузки данных с сервера для ${dbType}:`, error);

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
                console.warn(`⚠️ Нет данных на сервере для ${dbType}`);
                database[dbType] = [];
            }
        }
    }
    
    // Экспортируем данные в глобальную область для модулей
    window.database = database;
    console.log('🌐 Данные экспортированы в window.database для модулей');
}

function loadLocalDataOnly() {
    const dbTypes = ['sea', 'rail', 'direct_rail', 'direct_sea', 'tariff', 'agent_tariff'];
    for (const dbType of dbTypes) {
        const savedData = localStorage.getItem(`logistics_db_${dbType}`);
        if (savedData) {
            try {
                database[dbType] = JSON.parse(savedData);
            } catch (localError) {
                console.error(`❌ Ошибка загрузки локальных данных для ${dbType}:`, localError);
                database[dbType] = [];
            }
        } else {
            database[dbType] = [];
        }
    }
    window.database = database;
    console.log('🌐 Локальные данные экспортированы в window.database для модулей');
}

// Функции для работы с тарифами (расширенные для терминалов)
function loadTariffData() {
    console.log('🔧 loadTariffData вызвана, database.tariff:', database.tariff?.length, 'записей');
    const tbody = document.getElementById('tariff-table-body');
    if (!tbody) {
        console.error('❌ Не найден элемент #tariff-table-body');
        return;
    }
    
    // Очищаем таблицу
    tbody.innerHTML = '';
    console.log('🧹 Таблица очищена');
    
    // Загружаем сохраненные тарифы из базы данных
    if (database.tariff && database.tariff.length > 0) {
        console.log(`📋 Загружаем ${database.tariff.length} тарифов в таблицу`);
        // Теперь database.tariff - это массив объектов
        database.tariff.forEach((tariff) => {
            addTariffRowToTable(tariff);
        });
        
        // Показываем предпросмотр всех тарифов
        showTariffPreview(database.tariff);
        console.log('✅ Тарифы загружены в таблицу и показан предпросмотр');
    } else {
        console.log('📝 Нет тарифов, добавляем пустую строку');
        // Если нет тарифов, добавляем одну пустую строку
        addTariffRow();
    }
}

function addTariffRow(tariff = null) {
    const tbody = document.getElementById('tariff-table-body');
    if (!tbody) return;
    
    const rowIndex = tbody.children.length;
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>
            <input type="text" class="tariff-terminal" placeholder="Название терминала" value="${escapeHtml(tariff?.terminal || '')}">
        </td>
        <td>
            <input type="number" class="tariff-vtt" placeholder="0" min="0" step="1" value="${escapeHtml(tariff?.vtt || '')}">
        </td>
        <td>
            <input type="number" class="tariff-prr20" placeholder="0" min="0" step="1" value="${escapeHtml(tariff?.prr20 || '')}">
        </td>
        <td>
            <input type="number" class="tariff-prr40" placeholder="0" min="0" step="1" value="${escapeHtml(tariff?.prr40 || '')}">
        </td>
        <td>
            <input type="number" class="tariff-auto20" placeholder="0" min="0" step="1" value="${escapeHtml(tariff?.auto20 || '')}">
        </td>
        <td>
            <input type="number" class="tariff-auto40" placeholder="0" min="0" step="1" value="${escapeHtml(tariff?.auto40 || '')}">
        </td>
        <td class="actions-cell">
            <button class="btn-small btn-edit" onclick="editTariffRow(this)" title="Редактировать"><i class="fas fa-edit"></i></button>
            <button class="btn-small btn-danger" onclick="removeTariffRow(this)" title="Удалить"><i class="fas fa-trash"></i></button>
        </td>
    `;
    tbody.appendChild(row);
}

function addTariffRowToTable(tariff) {
    const tbody = document.getElementById('tariff-table-body');
    if (!tbody) return;
    
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>
            <input type="text" class="tariff-terminal" placeholder="Название терминала" value="${escapeHtml(tariff.terminal || '')}">
        </td>
        <td>
            <input type="number" class="tariff-vtt" placeholder="0" min="0" step="1" value="${escapeHtml(tariff.vtt || '')}">
        </td>
        <td>
            <input type="number" class="tariff-prr20" placeholder="0" min="0" step="1" value="${escapeHtml(tariff.prr20 || '')}">
        </td>
        <td>
            <input type="number" class="tariff-prr40" placeholder="0" min="0" step="1" value="${escapeHtml(tariff.prr40 || '')}">
        </td>
        <td>
            <input type="number" class="tariff-auto20" placeholder="0" min="0" step="1" value="${escapeHtml(tariff.auto20 || '')}">
        </td>
        <td>
            <input type="number" class="tariff-auto40" placeholder="0" min="0" step="1" value="${escapeHtml(tariff.auto40 || '')}">
        </td>
        <td class="actions-cell">
            <button class="btn-small btn-edit" onclick="editTariffRow(this)" title="Редактировать"><i class="fas fa-edit"></i></button>
            <button class="btn-small btn-danger" onclick="removeTariffRow(this)" title="Удалить"><i class="fas fa-trash"></i></button>
        </td>
    `;
    tbody.appendChild(row);
}

function removeTariffRow(button) {
    const row = button.closest('tr');
    if (row) {
        row.remove();
    }
}

function saveTariffData() {
    const rows = document.querySelectorAll('#tariff-table-body tr');
    const tariffs = [];
    
    rows.forEach((row, index) => {
        const terminal = row.querySelector('.tariff-terminal').value.trim();
        const vtt = parseFloat(row.querySelector('.tariff-vtt').value) || 0;
        const prr20 = parseFloat(row.querySelector('.tariff-prr20').value) || 0;
        const prr40 = parseFloat(row.querySelector('.tariff-prr40').value) || 0;
        const auto20 = parseFloat(row.querySelector('.tariff-auto20').value) || 0;
        const auto40 = parseFloat(row.querySelector('.tariff-auto40').value) || 0;
        
        // Если все поля пустые, пропускаем строку
        if (!terminal && vtt === 0 && prr20 === 0 && prr40 === 0 && auto20 === 0 && auto40 === 0) {
            return;
        }
        
        // Ищем существующий тариф по индексу или по названию терминала
        let existingTariff = null;
        if (database.tariff && database.tariff[index]) {
            existingTariff = database.tariff[index];
        } else {
            // Попробуем найти по названию терминала
            existingTariff = database.tariff?.find(t => t.terminal === terminal);
        }
        
        // Создаем объект тарифа, объединяя существующие дополнительные поля с обновленными базовыми
        const tariff = {
            terminal: terminal || 'Общий',
            vtt,
            prr20,
            prr40,
            auto20,
            auto40,
            timestamp: new Date().toISOString()
        };
        
        // Если есть существующий тариф, копируем дополнительные поля
        if (existingTariff) {
            // Копируем все поля, кроме базовых
            const extraFields = ['weighing20', 'weighing40', 'midk20', 'midk40',
                                 'railDeparture', 'railPrr20', 'railPrr40',
                                 'railWeighing20', 'railWeighing40', 'railMidk20', 'railMidk40',
                                 'storageRanges'];
            extraFields.forEach(field => {
                if (existingTariff[field] !== undefined) {
                    tariff[field] = existingTariff[field];
                }
            });
        }
        
        tariffs.push(tariff);
    });
    
    if (tariffs.length === 0) {
        Utils.showStatus('Добавьте хотя бы один тариф', 'error', 'tariff-status');
        return;
    }
    
    // Сохраняем в базу данных
    database.tariff = tariffs;
    
    // Сохраняем на сервер
    saveTariffToServer(tariffs);
    
    // Показываем предпросмотр
    showTariffPreview(tariffs);
    
    Utils.showStatus(`Тарифы успешно сохранены (${tariffs.length} записей)`, 'success', 'tariff-status');
}

async function saveTariffToServer(tariffs) {
    try {
        const response = await fetch('/api/data/tariff', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ data: tariffs })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Тарифы сохранены на сервере');
            
            // Сохраняем в localStorage как резервную копию
            localStorage.setItem('logistics_db_tariff', JSON.stringify(tariffs));
            
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
        localStorage.setItem('logistics_db_tariff', JSON.stringify(tariffs));
        Utils.showStatus('Тарифы сохранены локально (ошибка связи с сервером)', 'warning', 'tariff-status');
    }
}

function showTariffPreview(tariffs) {
    const previewSection = document.getElementById('tariff-preview');
    const previewTable = document.getElementById('tariff-preview-table');
    
    if (!previewSection || !previewTable) return;
    
    if (!tariffs || tariffs.length === 0) {
        previewTable.innerHTML = '<p>Нет данных для отображения</p>';
        previewSection.classList.remove('hidden');
        return;
    }
    
    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Терминал</th>
                    <th>ВТТ</th>
                    <th>ПРР 20</th>
                    <th>ПРР 40</th>
                    <th>Автовывоз 20</th>
                    <th>Автовывоз 40</th>
                    <th>Обновлено</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    tariffs.forEach(tariff => {
        tableHTML += `
            <tr>
                <td>${escapeHtml(tariff.terminal)}</td>
                <td>${escapeHtml(tariff.vtt || '-')}</td>
                <td>${escapeHtml(tariff.prr20 || '-')}</td>
                <td>${escapeHtml(tariff.prr40 || '-')}</td>
                <td>${escapeHtml(tariff.auto20 || '-')}</td>
                <td>${escapeHtml(tariff.auto40 || '-')}</td>
                <td>${escapeHtml(new Date(tariff.timestamp).toLocaleDateString('ru-RU'))}</td>
            </tr>
        `;
    });
    
    tableHTML += `
            </tbody>
        </table>
        <p>Всего тарифов: ${tariffs.length}</p>
    `;
    
    previewTable.innerHTML = tableHTML;
    previewSection.classList.remove('hidden');
}

// Функции для работы с тарифами агентов
function loadAgentTariffData() {
    console.log('🔧 loadAgentTariffData вызвана, database.agent_tariff:', database.agent_tariff?.length, 'записей');
    const tbody = document.getElementById('agent-tariff-table-body');
    if (!tbody) {
        console.error('❌ Не найден элемент #agent-tariff-table-body');
        return;
    }
    
    // Очищаем таблицу
    tbody.innerHTML = '';
    console.log('🧹 Таблица агентов очищена');
    
    // ВСЕГДА показываем интерфейс загрузки Excel (даже если есть данные)
    console.log('📝 Показываем интерфейс загрузки Excel для тарифов агентов');
    showAgentTariffUploadInterface();
    
    // Если есть данные, показываем их в предпросмотре
    if (database.agent_tariff && database.agent_tariff.length > 0) {
        console.log(`📋 Есть ${database.agent_tariff.length} тарифов агентов в базе`);
        // Обновляем предпросмотр в разделе тарифов
        updateTariffPreview();
    }
}

function showAgentTariffUploadInterface() {
    const tbody = document.getElementById('agent-tariff-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = `
        <tr>
            <td colspan="3" style="text-align: center; padding: 40px;">
                <div style="margin-bottom: 20px;">
                    <h3>📊 Загрузка тарифов агентов из Excel</h3>
                    <p style="color: #666; margin-bottom: 20px;">
                        Загрузите Excel файл с тарифами агентов. Формат файла должен содержать колонки:
                        <strong>Carrier, POD, DROP OFF AREA VIA VVO, СНП</strong>
                    </p>
                </div>
                <div class="file-upload">
                    <input type="file" id="agent-excel-file" accept=".xlsx,.xls" class="file-input">
                    <label for="agent-excel-file" class="file-label">
                        <span>Выберите Excel файл с тарифами агентов (.xlsx или .xls)</span>
                    </label>
                    <div id="agent-file-name-display" class="file-name-display">
                        <i class="fas fa-file-excel"></i>
                        <span id="agent-selected-file-name">Файл не выбран</span>
                    </div>
                </div>
                <div style="margin-top: 15px;">
                    <button class="btn" onclick="processAgentExcelFile()" id="process-agent-file" disabled>Обработать файл</button>
                </div>
                <div id="agent-data-preview" class="hidden">
                    <h4>Предварительный просмотр данных</h4>
                    <div id="agent-preview-table" style="max-height: 300px; overflow-y: auto;"></div>
                    <button class="btn btn-success" onclick="uploadAgentTariffData()" id="upload-agent-data" disabled>Загрузить в базу</button>
                </div>
            </td>
        </tr>
    `;
    
    // Настраиваем загрузку файла с отображением имени файла
    const fileInput = document.getElementById('agent-excel-file');
    const processButton = document.getElementById('process-agent-file');
    const fileNameDisplay = document.getElementById('agent-selected-file-name');
    const fileLabel = document.querySelector('.file-label');
    
    if (fileInput && processButton && fileNameDisplay && fileLabel) {
        // Сбрасываем состояние
        fileInput.value = '';
        processButton.disabled = true;
        fileNameDisplay.textContent = 'Файл не выбран';
        fileLabel.classList.remove('file-selected');
        
        fileInput.addEventListener('change', function(e) {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                const fileName = file.name;
                const fileSize = (file.size / 1024).toFixed(2); // KB
                
                // Отображаем имя файла
                fileNameDisplay.textContent = `${fileName} (${fileSize} KB)`;
                
                // Добавляем визуальную обратную связь
                fileLabel.classList.add('file-selected');
                
                // Включаем кнопку обработки
                processButton.disabled = false;
                
                // Не показываем статус, чтобы сохранить информацию о загруженных ставках
                // Визуальная обратная связь уже есть: отображение имени файла и CSS-класс .file-selected
            } else {
                // Если файл не выбран (например, пользователь отменил выбор)
                fileNameDisplay.textContent = 'Файл не выбран';
                fileLabel.classList.remove('file-selected');
                processButton.disabled = true;
            }
        });
    }
}

function processAgentExcelFile() {
    const fileInput = document.getElementById('agent-excel-file');
    const file = fileInput.files[0];
    
    if (!file) {
        Utils.showStatus('Пожалуйста, выберите файл', 'error');
        return;
    }
    
    Utils.showStatus('Обработка файла тарифов агентов...', '');
    
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
            
            console.log('🔍 Парсинг файла тарифов агентов');
            const agentData = Utils.parseAgentTariffData(jsonData);
            
            // Сохраняем данные для загрузки
            window.agentUploadedData = agentData;
            
            // Показываем предварительный просмотр
            showAgentDataPreview(agentData);
            
        } catch (error) {
            console.error('Ошибка обработки файла тарифов агентов:', error);
            Utils.showStatus(`Ошибка обработки файла: ${error.message}`, 'error');
        }
    };
    
    reader.onerror = function() {
        Utils.showStatus('Ошибка чтения файла', 'error');
    };
    
    reader.readAsArrayBuffer(file);
}

function showAgentDataPreview(data) {
    const previewSection = document.getElementById('agent-data-preview');
    const previewTable = document.getElementById('agent-preview-table');
    const uploadButton = document.getElementById('upload-agent-data');
    
    if (!previewSection || !previewTable || !uploadButton) {
        console.error('❌ Не найдены элементы для отображения предварительного просмотра агентов');
        return;
    }
    
    if (!data || data.length === 0) {
        previewTable.innerHTML = '<p style="color: red; text-align: center;">Нет данных для отображения</p>';
        previewSection.classList.remove('hidden');
        uploadButton.disabled = true;
        return;
    }
    
    console.log('📊 Отображение предварительного просмотра тарифов агентов:', data.length, 'записей');
    
    let tableHTML = `
        <table style="width: 100%;">
            <thead>
                <tr>
                    <th>Carrier</th>
                    <th>POD</th>
                    <th>DROP OFF AREA</th>
                    <th>СНП</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    // Отображаем первые 10 записей для предварительного просмотра
    const previewData = data.slice(0, 10);
    previewData.forEach(row => {
        tableHTML += `
            <tr>
                <td>${escapeHtml(row.carrier || '-')}</td>
                <td>${escapeHtml(row.pod || '-')}</td>
                <td>${escapeHtml(row.dropOffArea || '-')}</td>
                <td>${escapeHtml(row.snp || '-')}</td>
            </tr>
        `;
    });
    
    tableHTML += `
            </tbody>
        </table>
        <p style="margin-top: 10px; color: #666; font-size: 14px;">
            📊 Показано ${previewData.length} из ${data.length} записей
        </p>
    `;
    
    previewTable.innerHTML = tableHTML;
    previewSection.classList.remove('hidden');
    uploadButton.disabled = false;
    
    Utils.showStatus(`Обработано ${data.length} записей тарифов агентов. Проверьте данные и нажмите "Загрузить в базу"`, 'success');
}

async function uploadAgentTariffData() {
    if (!window.agentUploadedData || window.agentUploadedData.length === 0) {
        Utils.showStatus('Нет данных для загрузки', 'error');
        return;
    }

    Utils.showStatus('Загрузка тарифов агентов в базу...', '');

    try {
        // Добавляем timestamp к каждому элементу данных
        const dataWithTimestamp = window.agentUploadedData.map(item => ({
            ...item,
            timestamp: new Date().toISOString()
        }));
        
        // Получаем токен авторизации
        const token = localStorage.getItem('auth_token');
        
        // Отправляем данные на сервер
        const response = await fetch(`/api/data/agent_tariff`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                data: dataWithTimestamp,
                type: 'agent_tariff'
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.success) {
            // Обновляем локальную копию данных
            database.agent_tariff = dataWithTimestamp;
            
            console.log(`✅ Тарифы агентов успешно загружены в серверную базу: ${dataWithTimestamp.length} записей`);
            Utils.showStatus(`✅ Тарифы агентов успешно загружены (${dataWithTimestamp.length} записей)`, 'success');
            
            // Обновляем отображение
            loadAgentTariffData();
            
            // Сбрасываем состояние
            window.agentUploadedData = null;
            document.getElementById('agent-excel-file').value = '';
            document.getElementById('process-agent-file').disabled = true;
            document.getElementById('agent-data-preview').classList.add('hidden');
            
        } else {
            throw new Error(result.message || 'Ошибка загрузки данных');
        }
        
    } catch (error) {
        console.error('❌ Ошибка загрузки тарифов агентов в базу:', error);
        Utils.showStatus(`Ошибка загрузки данных: ${error.message}`, 'error');
    }
}

function addAgentTariffRow(agent = null) {
    const tbody = document.getElementById('agent-tariff-table-body');
    if (!tbody) return;
    
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>
            <input type="text" class="agent-name" placeholder="Наименование агента" value="${escapeHtml(agent?.name || '')}">
        </td>
        <td>
            <input type="text" class="agent-snp" placeholder="Сверхнормативное пользование" value="${escapeHtml(agent?.snp || '')}">
        </td>
        <td class="actions-cell">
            <button class="btn-small btn-danger" onclick="removeAgentTariffRow(this)" title="Удалить"><i class="fas fa-trash"></i></button>
        </td>
    `;
    tbody.appendChild(row);
}

function removeAgentTariffRow(button) {
    const row = button.closest('tr');
    if (row) {
        row.remove();
    }
}

function saveAgentTariffData() {
    // Эта функция теперь используется только для ручного редактирования существующих данных
    const rows = document.querySelectorAll('#agent-tariff-table-body tr');
    const agents = [];
    
    rows.forEach(row => {
        const nameInput = row.querySelector('.agent-name');
        const snpInput = row.querySelector('.agent-snp');
        
        // Пропускаем строку, если это интерфейс загрузки Excel
        if (!nameInput || !snpInput) {
            return;
        }
        
        const name = nameInput.value.trim();
        const snp = snpInput.value.trim();
        
        // Если оба поля пустые, пропускаем строку
        if (!name && !snp) {
            return;
        }
        
        agents.push({
            name: name || 'Не указано',
            snp: snp || '',
            timestamp: new Date().toISOString()
        });
    });
    
    if (agents.length === 0) {
        Utils.showStatus('Нет данных для сохранения', 'error', 'agent-tariff-status');
        return;
    }
    
    // Сохраняем в базу данных
    database.agent_tariff = agents;
    
    // Сохраняем на сервер
    saveAgentTariffToServer(agents);
    
    Utils.showStatus(`Тарифы агентов успешно сохранены (${agents.length} записей)`, 'success', 'agent-tariff-status');
}

async function saveAgentTariffToServer(agents) {
    try {
        const response = await fetch('/api/data/agent_tariff', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ data: agents })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Тарифы агентов сохранены на сервере');
            
            // Сохраняем в localStorage как резервную копию
            localStorage.setItem('logistics_db_agent_tariff', JSON.stringify(agents));
            
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
            localStorage.setItem('last_update_agent_tariff', JSON.stringify(updateDate));
            
        } else {
            throw new Error(result.error || 'Ошибка сохранения тарифов агентов');
        }
    } catch (error) {
        console.error('❌ Ошибка сохранения тарифов агентов на сервере:', error);
        // Сохраняем в localStorage как резервную копию
        localStorage.setItem('logistics_db_agent_tariff', JSON.stringify(agents));
        Utils.showStatus('Тарифы агентов сохранены локально (ошибка связи с сервером)', 'warning', 'agent-tariff-status');
    }
}

function updateTariffPreview() {
    console.log('🔧 updateTariffPreview вызвана, текущий тип:', currentTariffType);
    
    if (currentTariffType === 'terminal') {
        // Показываем предпросмотр тарифов терминалов
        if (database.tariff && database.tariff.length > 0) {
            showTariffPreview(database.tariff);
        } else {
            const previewSection = document.getElementById('tariff-preview');
            const previewTable = document.getElementById('tariff-preview-table');
            if (previewSection && previewTable) {
                previewTable.innerHTML = '<p>Нет данных для отображения</p>';
                previewSection.classList.remove('hidden');
            }
        }
    } else if (currentTariffType === 'agent') {
        // Показываем предпросмотр тарифов агентов
        const previewSection = document.getElementById('tariff-preview');
        const previewTable = document.getElementById('tariff-preview-table');
        if (!previewSection || !previewTable) return;
        
        if (database.agent_tariff && database.agent_tariff.length > 0) {
            let tableHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>Carrier</th>
                            <th>POD</th>
                            <th>DROP OFF AREA</th>
                            <th>СНП</th>
                            <th>Обновлено</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            database.agent_tariff.forEach(agent => {
                // Безопасное форматирование даты
                let formattedDate = 'Не указано';
                if (agent.timestamp) {
                    try {
                        const date = new Date(agent.timestamp);
                        if (!isNaN(date.getTime())) {
                            formattedDate = date.toLocaleDateString('ru-RU');
                        }
                    } catch (error) {
                        console.warn('Ошибка форматирования даты:', error);
                    }
                }
                
                tableHTML += `
                    <tr>
                        <td>${escapeHtml(agent.carrier || agent.name || '-')}</td>
                        <td>${escapeHtml(agent.pod || '-')}</td>
                        <td>${escapeHtml(agent.dropOffArea || '-')}</td>
                        <td>${escapeHtml(agent.snp || '-')}</td>
                        <td>${escapeHtml(formattedDate)}</td>
                    </tr>
                `;
            });
            
            tableHTML += `
                    </tbody>
                </table>
                <p>Всего записей: ${database.agent_tariff.length}</p>
            `;
            
            previewTable.innerHTML = tableHTML;
            previewSection.classList.remove('hidden');
        } else {
            previewTable.innerHTML = '<p>Нет данных для отображения</p>';
            previewSection.classList.remove('hidden');
        }
    }
}

// Функции модального окна терминала
function initTerminalModal() {
    console.log('🔧 Инициализация модального окна терминала');
    const modal = document.getElementById('terminal-modal');
    const form = document.getElementById('terminal-form');
    const closeBtn = modal.querySelector('.modal-close');
    
    if (!modal || !form) {
        console.error('❌ Не найдены элементы модального окна');
        return;
    }
    
    // Обработчик закрытия по кнопке
    closeBtn.addEventListener('click', closeTerminalModal);
    
    // Обработчик отправки формы
    form.addEventListener('submit', function(event) {
        event.preventDefault();
        saveTerminalModal();
    });
    
    // Обработчик чекбокса "Учитывать отправку по ЖД"
    const railCheckbox = document.getElementById('modal-rail-departure');
    if (railCheckbox) {
        railCheckbox.addEventListener('change', function() {
            const railSection = document.getElementById('rail-rates-section');
            if (railSection) {
                railSection.classList.toggle('hidden', !this.checked);
            }
        });
    }
    
    // Инициализация контейнера хранения
    initStorageContainer();
    
    console.log('✅ Модальное окно терминала инициализировано');
}

function openTerminalModal(tariff = null, rowIndex = -1) {
    console.log('📝 Открытие модального окна терминала', { tariff, rowIndex });
    console.log('📊 Полный объект tariff:', JSON.stringify(tariff, null, 2));
    editingTariffIndex = rowIndex;
    
    const modal = document.getElementById('terminal-modal');
    if (!modal) {
        console.error('❌ Модальное окно не найдено');
        return;
    }
    
    // Заполняем основные поля
    document.getElementById('modal-terminal').value = tariff?.terminal || '';
    document.getElementById('modal-vtt').value = tariff?.vtt || '';
    document.getElementById('modal-prr20').value = tariff?.prr20 || '';
    document.getElementById('modal-prr40').value = tariff?.prr40 || '';
    document.getElementById('modal-auto20').value = tariff?.auto20 || '';
    document.getElementById('modal-auto40').value = tariff?.auto40 || '';
    
    // Заполняем дополнительные поля (если есть в объекте tariff)
    document.getElementById('modal-weighing20').value = tariff?.weighing20 || '';
    document.getElementById('modal-weighing40').value = tariff?.weighing40 || '';
    document.getElementById('modal-midk20').value = tariff?.midk20 || '';
    document.getElementById('modal-midk40').value = tariff?.midk40 || '';
    
    // Чекбокс отправки по ЖД
    const railCheckbox = document.getElementById('modal-rail-departure');
    const railSection = document.getElementById('rail-rates-section');
    if (railCheckbox && railSection) {
        const hasRail = tariff?.railDeparture || false;
        railCheckbox.checked = hasRail;
        railSection.classList.toggle('hidden', !hasRail);
        
        // Заполняем ставки для ЖД отправки
        document.getElementById('modal-rail-prr20').value = tariff?.railPrr20 || '';
        document.getElementById('modal-rail-prr40').value = tariff?.railPrr40 || '';
        document.getElementById('modal-rail-weighing20').value = tariff?.railWeighing20 || '';
        document.getElementById('modal-rail-weighing40').value = tariff?.railWeighing40 || '';
        document.getElementById('modal-rail-midk20').value = tariff?.railMidk20 || '';
        document.getElementById('modal-rail-midk40').value = tariff?.railMidk40 || '';
    }
    
    // Заполняем диапазоны хранения
    let storageRanges = [];
    if (tariff?.storageRanges && Array.isArray(tariff.storageRanges)) {
        storageRanges = tariff.storageRanges;
        console.log('📦 Используем storageRanges:', storageRanges);
    } else if (tariff?.storage && Array.isArray(tariff.storage)) {
        // Конвертируем старый формат storage в storageRanges
        storageRanges = tariff.storage.map(item => ({
            from: item.from_days || item.from || 0,
            to: item.to_days || item.to || 0,
            rate20: item.rate20 || 0,
            rate40: item.rate40 || 0
        }));
        console.log('📦 Конвертирован storage в storageRanges:', storageRanges);
    }
    console.log('📦 Передаваемые storageRanges:', storageRanges);
    loadStorageRanges(storageRanges);
    
    // Показываем модальное окно
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    
    console.log('✅ Модальное окно открыто');
}

function closeTerminalModal() {
    console.log('📝 Закрытие модального окна терминала');
    const modal = document.getElementById('terminal-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
    editingTariffIndex = -1;
}

function initStorageContainer() {
    const container = document.getElementById('storage-container');
    if (!container) return;
    
    // Очищаем контейнер
    container.innerHTML = '';
    
    // Добавляем начальный диапазон, если пусто
    if (container.children.length === 0) {
        addStorageRange();
    }
}

function addStorageRange(storageRange = null) {
    const container = document.getElementById('storage-container');
    if (!container) return;
    
    const rangeIndex = container.children.length;
    const rangeElement = document.createElement('div');
    rangeElement.className = 'storage-grid-row';
    rangeElement.innerHTML = `
        <input type="number" class="storage-from" placeholder="0" min="0" step="1" value="${escapeHtml(storageRange?.from || '')}">
        <input type="number" class="storage-to" placeholder="30" min="0" step="1" value="${escapeHtml(storageRange?.to || '')}">
        <input type="number" class="storage-rate20" placeholder="0" min="0" step="1" value="${escapeHtml(storageRange?.rate20 || '')}">
        <input type="number" class="storage-rate40" placeholder="0" min="0" step="1" value="${escapeHtml(storageRange?.rate40 || '')}">
        <button type="button" class="btn-small btn-danger" onclick="removeStorageRange(this)"><i class="fas fa-trash"></i></button>
    `;
    container.appendChild(rangeElement);
}

function removeStorageRange(button) {
    const row = button.closest('.storage-grid-row');
    if (row) {
        row.remove();
    }
}

function loadStorageRanges(storageRanges) {
    const container = document.getElementById('storage-container');
    if (!container) return;
    
    console.log('📦 Загрузка диапазонов хранения в DOM:', storageRanges);
    container.innerHTML = '';
    
    if (storageRanges.length === 0) {
        console.log('📦 Нет диапазонов, добавляем пустой');
        addStorageRange();
    } else {
        storageRanges.forEach(range => {
            console.log('📦 Добавляем диапазон:', range);
            addStorageRange(range);
        });
    }
}

function getStorageRanges() {
    const container = document.getElementById('storage-container');
    if (!container) {
        console.log('❌ Контейнер хранения не найден');
        return [];
    }
    
    const ranges = [];
    const rows = container.querySelectorAll('.storage-grid-row');
    console.log(`📦 Найдено ${rows.length} строк хранения в DOM`);
    
    rows.forEach((row, index) => {
        const fromInput = row.querySelector('.storage-from');
        const toInput = row.querySelector('.storage-to');
        const rate20Input = row.querySelector('.storage-rate20');
        const rate40Input = row.querySelector('.storage-rate40');
        
        const from = parseInt(fromInput?.value) || 0;
        const to = parseInt(toInput?.value) || 0;
        const rate20 = parseInt(rate20Input?.value) || 0;
        const rate40 = parseInt(rate40Input?.value) || 0;
        
        console.log(`📦 Строка ${index}: from=${from}, to=${to}, rate20=${rate20}, rate40=${rate40}`);
        
        if (from >= 0 && to >= from && (rate20 > 0 || rate40 > 0)) {
            ranges.push({ from, to, rate20, rate40 });
        }
    });
    
    console.log('📦 Итоговые диапазоны хранения:', ranges);
    return ranges;
}

function saveTerminalModal() {
    console.log('💾 Сохранение данных из модального окна терминала');
    
    // Собираем данные из формы
    const terminal = document.getElementById('modal-terminal').value.trim();
    const vtt = parseInt(document.getElementById('modal-vtt').value) || 0;
    const prr20 = parseInt(document.getElementById('modal-prr20').value) || 0;
    const prr40 = parseInt(document.getElementById('modal-prr40').value) || 0;
    const auto20 = parseInt(document.getElementById('modal-auto20').value) || 0;
    const auto40 = parseInt(document.getElementById('modal-auto40').value) || 0;
    const weighing20 = parseInt(document.getElementById('modal-weighing20').value) || 0;
    const weighing40 = parseInt(document.getElementById('modal-weighing40').value) || 0;
    const midk20 = parseInt(document.getElementById('modal-midk20').value) || 0;
    const midk40 = parseInt(document.getElementById('modal-midk40').value) || 0;
    
    const railDeparture = document.getElementById('modal-rail-departure').checked;
    const railPrr20 = parseInt(document.getElementById('modal-rail-prr20').value) || 0;
    const railPrr40 = parseInt(document.getElementById('modal-rail-prr40').value) || 0;
    const railWeighing20 = parseInt(document.getElementById('modal-rail-weighing20').value) || 0;
    const railWeighing40 = parseInt(document.getElementById('modal-rail-weighing40').value) || 0;
    const railMidk20 = parseInt(document.getElementById('modal-rail-midk20').value) || 0;
    const railMidk40 = parseInt(document.getElementById('modal-rail-midk40').value) || 0;
    
    const storageRanges = getStorageRanges();
    console.log('📊 Сохраненные диапазоны хранения:', storageRanges);
    
    // Создаем поле storage в старом формате для совместимости
    const storage = storageRanges.map(range => ({
        from_days: range.from,
        to_days: range.to,
        rate20: range.rate20,
        rate40: range.rate40
    }));
    
    // Создаем объект тарифа
    const tariff = {
        terminal: terminal || 'Общий',
        vtt,
        prr20,
        prr40,
        auto20,
        auto40,
        weighing20,
        weighing40,
        midk20,
        midk40,
        railDeparture,
        railPrr20,
        railPrr40,
        railWeighing20,
        railWeighing40,
        railMidk20,
        railMidk40,
        storageRanges,
        storage,
        timestamp: new Date().toISOString()
    };
    
    // Если редактируем существующую строку, обновляем её
    if (editingTariffIndex >= 0) {
        // Обновляем данные в таблице
        const tbody = document.getElementById('tariff-table-body');
        if (tbody && tbody.children[editingTariffIndex]) {
            const row = tbody.children[editingTariffIndex];
            row.querySelector('.tariff-terminal').value = tariff.terminal;
            row.querySelector('.tariff-vtt').value = tariff.vtt;
            row.querySelector('.tariff-prr20').value = tariff.prr20;
            row.querySelector('.tariff-prr40').value = tariff.prr40;
            row.querySelector('.tariff-auto20').value = tariff.auto20;
            row.querySelector('.tariff-auto40').value = tariff.auto40;
        }
        
        // Обновляем данные в базе
        if (database.tariff && database.tariff[editingTariffIndex]) {
            database.tariff[editingTariffIndex] = tariff;
            console.log(`✅ Тариф обновлен в строке ${editingTariffIndex}, storageRanges:`, tariff.storageRanges);
        } else {
            console.error(`❌ Не удалось обновить базу данных по индексу ${editingTariffIndex}`);
        }
        
        console.log(`✅ Тариф обновлен в строке ${editingTariffIndex}`);
    } else {
        // Добавляем новый тариф в таблицу
        addTariffRow(tariff);
        
        // Добавляем в базу
        if (!database.tariff) database.tariff = [];
        database.tariff.push(tariff);
        
        console.log('✅ Новый тариф добавлен');
    }
    
    // Закрываем модальное окно
    closeTerminalModal();
    
    // Показываем уведомление
    Utils.showStatus('Тариф терминала сохранен', 'success');
    
    // Обновляем предпросмотр
    showTariffPreview(database.tariff);
}

function editTariffRow(button) {
    const row = button.closest('tr');
    if (!row) return;
    
    const tbody = document.getElementById('tariff-table-body');
    const rowIndex = Array.from(tbody.children).indexOf(row);
    
    // Собираем данные из строки таблицы
    const terminal = row.querySelector('.tariff-terminal').value;
    const vtt = parseInt(row.querySelector('.tariff-vtt').value) || 0;
    const prr20 = parseInt(row.querySelector('.tariff-prr20').value) || 0;
    const prr40 = parseInt(row.querySelector('.tariff-prr40').value) || 0;
    const auto20 = parseInt(row.querySelector('.tariff-auto20').value) || 0;
    const auto40 = parseInt(row.querySelector('.tariff-auto40').value) || 0;
    
    // Ищем полные данные тарифа в базе
    let tariff = null;
    if (database.tariff && database.tariff[rowIndex]) {
        tariff = database.tariff[rowIndex];
        console.log(`🔍 editTariffRow: найден тариф в базе по индексу ${rowIndex}:`, tariff);
        console.log(`🔍 storageRanges в базе:`, tariff.storageRanges);
    } else {
        // Создаем минимальный объект
        tariff = {
            terminal,
            vtt,
            prr20,
            prr40,
            auto20,
            auto40
        };
        console.log(`🔍 editTariffRow: тариф не найден в базе, создаем минимальный объект`);
    }
    
    // Открываем модальное окно
    openTerminalModal(tariff, rowIndex);
}

// Функция выхода из системы
async function logoutUser() {
    console.log('🔐 Выход из системы менеджера по закупкам');
    
    try {
        // Выход через серверную аутентификацию
        await ServerAuth.logoutUser();
    } catch (error) {
        console.error('Ошибка при выходе из системы:', error);
    }
    
    // Сбрасываем глобальные переменные
    window.currentDatabase = '';
    window.uploadedData = null;
    
    // Возвращаем на главную страницу (index.html)
    window.location.href = '../index.html';
}

// Экспорт функций в глобальную область видимости
window.selectDatabase = selectDatabase;
window.switchTariffType = switchTariffType;
window.goBack = goBack;
window.setupFileUpload = setupFileUpload;
window.processExcelFile = processExcelFile;
window.showDataPreview = showDataPreview;
window.uploadDataToDatabase = uploadDataToDatabase;
window.loadDatabaseData = loadDatabaseData;
window.logoutUser = logoutUser;
window.initTerminalModal = initTerminalModal;
window.loadTariffData = loadTariffData;
window.loadAgentTariffData = loadAgentTariffData;
window.addAgentTariffRow = addAgentTariffRow;
window.removeAgentTariffRow = removeAgentTariffRow;
window.saveAgentTariffData = saveAgentTariffData;
window.saveAgentTariffToServer = saveAgentTariffToServer;
window.updateTariffPreview = updateTariffPreview;
window.addTariffRow = addTariffRow;
window.removeTariffRow = removeTariffRow;
window.saveTariffData = saveTariffData;
window.editTariffRow = editTariffRow;
window.openTerminalModal = openTerminalModal;
window.closeTerminalModal = closeTerminalModal;
window.saveTerminalModal = saveTerminalModal;
window.addStorageRange = addStorageRange;
window.removeStorageRange = removeStorageRange;
