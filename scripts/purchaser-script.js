// 🎯 ОСНОВНОЙ ФАЙЛ ДЛЯ МЕНЕДЖЕРА ПО ЗАКУПАМ

// Глобальные переменные
let currentRole = 'purchaser';
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
    
    // Показываем выбор типа базы данных
    document.getElementById('database-selection').classList.remove('hidden');
});

// Функции для управления интерфейсом
function selectDatabase(dbType) {
    currentDatabase = dbType;
    console.log('🎯 Выбран тип базы данных:', dbType);
    
    document.getElementById('database-selection').classList.add('hidden');
    
    // Синхронизируем данные с сервером при каждом входе
    loadDatabaseData().then(() => {
        if (dbType === 'tariff') {
            console.log('🔧 Открываем интерфейс тарифов для закупщика');
            document.getElementById('tariff-interface').classList.remove('hidden');
            // Показываем время обновления тарифов
            Utils.showLastUpdate('tariff', 'last-update-tariff');
            // Устанавливаем тип тарифов по умолчанию (терминалы)
            currentTariffType = 'terminal';
            // Загружаем данные для обоих типов
            loadTariffData();
            loadAgentTariffData();
            // Активируем кнопку терминалов
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
        }
    });
}

// Переключение типа тарифов (терминалы/агенты)
function switchTariffType(type) {
    console.log('🔄 Переключение типа тарифов:', type);
    currentTariffType = type;
    
    // Обновляем активность кнопок
    document.getElementById('terminal-tariff-btn').classList.toggle('active', type === 'terminal');
    document.getElementById('agent-tariff-btn').classList.toggle('active', type === 'agent');
    
    // Показываем/скрываем соответствующие секции
    document.getElementById('terminal-tariff-section').classList.toggle('hidden', type !== 'terminal');
    document.getElementById('agent-tariff-section').classList.toggle('hidden', type !== 'agent');
    
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
            tableHTML += `<th>${key}</th>`;
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
            tableHTML += `<td>${value || '-'}</td>`;
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
            
        } else {
            throw new Error(result.message || 'Ошибка загрузки данных');
        }
        
    } catch (error) {
        console.error('❌ Ошибка загрузки данных в базу:', error);
        Utils.showStatus(`Ошибка загрузки данных: ${error.message}`, 'error');
    }
    
}

// Функции для работы с тарифами (расширенные для терминалов)
function loadTariffData() {
    console.log('📊 Загрузка данных тарифов с сервера');
    
    const tbody = document.getElementById('tariff-table-body');
    if (!tbody) return;
    
    // Очищаем таблицу
    tbody.innerHTML = '';
    
    // Тарифы загружаются автоматически через loadDatabaseData()
    // Эта функция вызывается после загрузки данных с сервера
    
    // Обновляем отображение времени обновления тарифов
    Utils.showLastUpdate('tariff', 'last-update-tariff');
    
    // Если есть тарифы в базе, отображаем их
    if (database.tariff && database.tariff.length > 0) {
        database.tariff.forEach((tariff, index) => {
            addTariffRowToTable(tariff, index);
        });
        
        // Показываем предпросмотр всех тарифов
        showTariffPreview(database.tariff);
    } else {
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
            <input type="text" class="tariff-terminal" placeholder="Например: Терминал А" value="${tariff?.terminal || ''}" title="Введите название терминала">
        </td>
        <td>
            <input type="number" class="tariff-vtt" placeholder="0" min="0" step="1" value="${tariff?.vtt || ''}" title="Внутренний тариф терминала (руб)">
        </td>
        <td>
            <input type="number" class="tariff-prr20" placeholder="0" min="0" step="1" value="${tariff?.prr20 || ''}" title="Погрузо-разгрузочные работы для 20-футового контейнера (руб)">
        </td>
        <td>
            <input type="number" class="tariff-prr40" placeholder="0" min="0" step="1" value="${tariff?.prr40 || ''}" title="Погрузо-разгрузочные работы для 40-футового контейнера (руб)">
        </td>
        <td>
            <input type="number" class="tariff-auto20" placeholder="0" min="0" step="1" value="${tariff?.auto20 || ''}" title="Автовывоз 20-футового контейнера (руб)">
        </td>
        <td>
            <input type="number" class="tariff-auto40" placeholder="0" min="0" step="1" value="${tariff?.auto40 || ''}" title="Автовывоз 40-футового контейнера (руб)">
        </td>
        <td class="actions-cell">
            <button class="btn-small btn-primary" onclick="editTariffRow(this)" title="Редактировать детали терминала">
                <i class="fas fa-edit"></i> Редактировать
            </button>
            <button class="btn-small btn-danger" onclick="removeTariffRow(this)" title="Удалить строку">
                <i class="fas fa-trash-alt"></i> Удалить
            </button>
        </td>
    `;
    tbody.appendChild(row);
    
    // Добавляем валидацию ввода (только положительные числа)
    const inputs = row.querySelectorAll('input[type="number"]');
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            if (this.value < 0) this.value = 0;
        });
    });
}

function addTariffRowToTable(tariff, index) {
    const tbody = document.getElementById('tariff-table-body');
    if (!tbody) return;
    
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>
            <input type="text" class="tariff-terminal" placeholder="Например: Терминал А" value="${tariff.terminal || ''}" title="Введите название терминала">
        </td>
        <td>
            <input type="number" class="tariff-vtt" placeholder="0" min="0" step="1" value="${tariff.vtt || ''}" title="Внутренний тариф терминала (руб)">
        </td>
        <td>
            <input type="number" class="tariff-prr20" placeholder="0" min="0" step="1" value="${tariff.prr20 || ''}" title="Погрузо-разгрузочные работы для 20-футового контейнера (руб)">
        </td>
        <td>
            <input type="number" class="tariff-prr40" placeholder="0" min="0" step="1" value="${tariff.prr40 || ''}" title="Погрузо-разгрузочные работы для 40-футового контейнера (руб)">
        </td>
        <td>
            <input type="number" class="tariff-auto20" placeholder="0" min="0" step="1" value="${tariff.auto20 || ''}" title="Автовывоз 20-футового контейнера (руб)">
        </td>
        <td>
            <input type="number" class="tariff-auto40" placeholder="0" min="0" step="1" value="${tariff.auto40 || ''}" title="Автовывоз 40-футового контейнера (руб)">
        </td>
        <td class="actions-cell">
            <button class="btn-small btn-primary" onclick="editTariffRow(this)" title="Редактировать детали терминала">
                <i class="fas fa-edit"></i> Редактировать
            </button>
            <button class="btn-small btn-danger" onclick="removeTariffRow(this)" title="Удалить строку">
                <i class="fas fa-trash-alt"></i> Удалить
            </button>
        </td>
    `;
    tbody.appendChild(row);
    
    // Добавляем валидацию ввода (только положительные числа)
    const inputs = row.querySelectorAll('input[type="number"]');
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            if (this.value < 0) this.value = 0;
        });
    });
}

function removeTariffRow(button) {
    const row = button.closest('tr');
    if (row) {
        row.remove();
    }
}

// Редактирование строки тарифа
function editTariffRow(button) {
    const row = button.closest('tr');
    const tbody = document.getElementById('tariff-table-body');
    if (!row || !tbody) return;
    
    const index = Array.from(tbody.children).indexOf(row);
    if (index < 0) return;
    
    // Собираем данные из полей ввода строки
    const terminal = row.querySelector('.tariff-terminal').value.trim();
    const vtt = parseFloat(row.querySelector('.tariff-vtt').value) || 0;
    const prr20 = parseFloat(row.querySelector('.tariff-prr20').value) || 0;
    const prr40 = parseFloat(row.querySelector('.tariff-prr40').value) || 0;
    const auto20 = parseFloat(row.querySelector('.tariff-auto20').value) || 0;
    const auto40 = parseFloat(row.querySelector('.tariff-auto40').value) || 0;
    
    // Ищем полные данные тарифа из базы (если есть)
    let fullTariff = null;
    if (database.tariff && database.tariff[index]) {
        fullTariff = database.tariff[index];
    } else {
        // Создаём минимальный объект
        fullTariff = {
            terminal,
            vtt,
            prr20,
            prr40,
            auto20,
            auto40
        };
    }
    
    openTerminalModal(index, fullTariff);
}

// Открытие модального окна для редактирования терминала
function openTerminalModal(index, tariff = null) {
    editingTariffIndex = index;
    const modal = document.getElementById('terminal-modal');
    if (!modal) return;

    // Очистка формы
    document.getElementById('modal-terminal').value = tariff?.terminal || '';
    document.getElementById('modal-vtt').value = tariff?.vtt || '';
    document.getElementById('modal-prr20').value = tariff?.prr20 || '';
    document.getElementById('modal-prr40').value = tariff?.prr40 || '';
    document.getElementById('modal-auto20').value = tariff?.auto20 || '';
    document.getElementById('modal-auto40').value = tariff?.auto40 || '';
    document.getElementById('modal-weighing20').value = tariff?.weighing20 || '';
    document.getElementById('modal-weighing40').value = tariff?.weighing40 || '';
    document.getElementById('modal-midk20').value = tariff?.midk20 || '';
    document.getElementById('modal-midk40').value = tariff?.midk40 || '';
    
    // Обработка разделения по ЖД
    const railDeparture = tariff?.rail_departure || false;
    document.getElementById('modal-rail-departure').checked = railDeparture;
    toggleRailRates(railDeparture);
    
    if (railDeparture && tariff?.rail_rates) {
        document.getElementById('modal-rail-prr20').value = tariff.rail_rates.prr20 || '';
        document.getElementById('modal-rail-prr40').value = tariff.rail_rates.prr40 || '';
        document.getElementById('modal-rail-weighing20').value = tariff.rail_rates.weighing20 || '';
        document.getElementById('modal-rail-weighing40').value = tariff.rail_rates.weighing40 || '';
        document.getElementById('modal-rail-midk20').value = tariff.rail_rates.midk20 || '';
        document.getElementById('modal-rail-midk40').value = tariff.rail_rates.midk40 || '';
    } else {
        document.getElementById('modal-rail-prr20').value = '';
        document.getElementById('modal-rail-prr40').value = '';
        document.getElementById('modal-rail-weighing20').value = '';
        document.getElementById('modal-rail-weighing40').value = '';
        document.getElementById('modal-rail-midk20').value = '';
        document.getElementById('modal-rail-midk40').value = '';
    }

    // Очистка и заполнение диапазонов хранения
    const storageContainer = document.getElementById('storage-container');
    storageContainer.innerHTML = '';
    if (tariff?.storage && Array.isArray(tariff.storage)) {
        tariff.storage.forEach(range => {
            addStorageRange(range.from_days, range.to_days, range.rate20, range.rate40);
        });
    } else {
        // Добавляем один пустой диапазон по умолчанию
        addStorageRange();
    }

    // Показать модальное окно
    modal.classList.remove('hidden');
}

// Закрытие модального окна
function closeTerminalModal() {
    const modal = document.getElementById('terminal-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    editingTariffIndex = -1;
}

// Переключение видимости полей для ЖД
function toggleRailRates(show) {
    const section = document.getElementById('rail-rates-section');
    if (section) {
        if (show) {
            section.classList.remove('hidden');
        } else {
            section.classList.add('hidden');
        }
    }
}

// Добавление диапазона хранения
function addStorageRange(from = '', to = '', rate20 = '', rate40 = '') {
    const container = document.getElementById('storage-container');
    if (!container) return;

    const rangeIndex = container.children.length;
    const rangeDiv = document.createElement('div');
    rangeDiv.className = 'storage-grid-row';
    rangeDiv.innerHTML = `
        <div class="storage-cell">
            <input type="number" class="storage-input storage-from" min="0" step="1" value="${from}" placeholder="От суток">
        </div>
        <div class="storage-cell">
            <input type="number" class="storage-input storage-to" min="0" step="1" value="${to}" placeholder="До суток">
        </div>
        <div class="storage-cell">
            <input type="number" class="storage-input storage-rate20" min="0" step="1" value="${rate20}" placeholder="20 фут">
        </div>
        <div class="storage-cell">
            <input type="number" class="storage-input storage-rate40" min="0" step="1" value="${rate40}" placeholder="40 фут">
        </div>
        <div class="storage-actions-cell">
            <button type="button" class="remove-storage" onclick="removeStorageRange(this)" title="Удалить диапазон">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `;
    container.appendChild(rangeDiv);
}

// Удаление диапазона хранения
function removeStorageRange(button) {
    const rangeDiv = button.closest('.storage-grid-row');
    if (rangeDiv) {
        rangeDiv.remove();
    }
}

// Обработка отправки формы модального окна
function handleTerminalFormSubmit(event) {
    event.preventDefault();
    
    const terminal = document.getElementById('modal-terminal').value.trim();
    if (!terminal) {
        alert('Введите название терминала');
        return;
    }

    const tariff = {
        terminal,
        vtt: parseFloat(document.getElementById('modal-vtt').value) || 0,
        prr20: parseFloat(document.getElementById('modal-prr20').value) || 0,
        prr40: parseFloat(document.getElementById('modal-prr40').value) || 0,
        auto20: parseFloat(document.getElementById('modal-auto20').value) || 0,
        auto40: parseFloat(document.getElementById('modal-auto40').value) || 0,
        weighing20: parseFloat(document.getElementById('modal-weighing20').value) || 0,
        weighing40: parseFloat(document.getElementById('modal-weighing40').value) || 0,
        midk20: parseFloat(document.getElementById('modal-midk20').value) || 0,
        midk40: parseFloat(document.getElementById('modal-midk40').value) || 0,
        rail_departure: document.getElementById('modal-rail-departure').checked,
        timestamp: new Date().toISOString()
    };

    // Если включено разделение по ЖД, добавляем rail_rates
    if (tariff.rail_departure) {
        tariff.rail_rates = {
            prr20: parseFloat(document.getElementById('modal-rail-prr20').value) || 0,
            prr40: parseFloat(document.getElementById('modal-rail-prr40').value) || 0,
            weighing20: parseFloat(document.getElementById('modal-rail-weighing20').value) || 0,
            weighing40: parseFloat(document.getElementById('modal-rail-weighing40').value) || 0,
            midk20: parseFloat(document.getElementById('modal-rail-midk20').value) || 0,
            midk40: parseFloat(document.getElementById('modal-rail-midk40').value) || 0
        };
    }

    // Сбор диапазонов хранения
    const storageRanges = [];
    document.querySelectorAll('.storage-grid-row').forEach(rangeDiv => {
        const from = parseFloat(rangeDiv.querySelector('.storage-from').value) || 0;
        const to = parseFloat(rangeDiv.querySelector('.storage-to').value) || 0;
        const rate20 = parseFloat(rangeDiv.querySelector('.storage-rate20').value) || 0;
        const rate40 = parseFloat(rangeDiv.querySelector('.storage-rate40').value) || 0;
        if (from > 0 || to > 0 || rate20 > 0 || rate40 > 0) {
            storageRanges.push({ from_days: from, to_days: to, rate20, rate40 });
        }
    });
    if (storageRanges.length > 0) {
        tariff.storage = storageRanges;
    }

    // Обновление строки в таблице
    const tbody = document.getElementById('tariff-table-body');
    if (editingTariffIndex >= 0 && tbody.children[editingTariffIndex]) {
        // Обновляем существующую строку
        const row = tbody.children[editingTariffIndex];
        row.querySelector('.tariff-terminal').value = tariff.terminal;
        row.querySelector('.tariff-vtt').value = tariff.vtt;
        row.querySelector('.tariff-prr20').value = tariff.prr20;
        row.querySelector('.tariff-prr40').value = tariff.prr40;
        row.querySelector('.tariff-auto20').value = tariff.auto20;
        row.querySelector('.tariff-auto40').value = tariff.auto40;
        // Обновляем локальную базу данных
        if (!database.tariff) database.tariff = [];
        database.tariff[editingTariffIndex] = tariff;
    } else {
        // Добавляем новую строку
        addTariffRow(tariff);
        // Добавляем в локальную базу данных
        if (!database.tariff) database.tariff = [];
        database.tariff.push(tariff);
    }

    // Закрываем модальное окно
    closeTerminalModal();
}

// Инициализация обработчиков модального окна
function initTerminalModal() {
    const form = document.getElementById('terminal-form');
    if (form) {
        form.addEventListener('submit', handleTerminalFormSubmit);
    }
    const railCheckbox = document.getElementById('modal-rail-departure');
    if (railCheckbox) {
        railCheckbox.addEventListener('change', function() {
            toggleRailRates(this.checked);
        });
    }
}

async function saveTariffData() {
    console.log('💾 Сохранение тарифных данных на сервере');
    
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
        
        // Базовый объект тарифа
        const baseTariff = {
            terminal: terminal || 'Общий',
            vtt,
            prr20,
            prr40,
            auto20,
            auto40,
            timestamp: new Date().toISOString()
        };
        
        // Ищем расширенные данные из локальной базы (если есть)
        let extendedTariff = null;
        if (database.tariff && database.tariff[index]) {
            extendedTariff = database.tariff[index];
        }
        
        // Объединяем базовые поля с расширенными, но не перезаписываем базовые поля
        const finalTariff = {
            ...baseTariff,
            // Расширенные поля (если есть)
            weighing20: extendedTariff?.weighing20 || 0,
            weighing40: extendedTariff?.weighing40 || 0,
            midk20: extendedTariff?.midk20 || 0,
            midk40: extendedTariff?.midk40 || 0,
            rail_departure: extendedTariff?.rail_departure || false,
            rail_rates: extendedTariff?.rail_rates || null,
            storage: extendedTariff?.storage || []
        };
        
        tariffs.push(finalTariff);
    });
    
    if (tariffs.length === 0) {
        Utils.showStatus('Добавьте хотя бы один тариф', 'error', 'tariff-status');
        return;
    }
    
    try {
        // Получаем токен авторизации
        const token = localStorage.getItem('auth_token');
        
        // Отправляем на сервер
        const response = await fetch('/api/data/tariff', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                data: tariffs,
                type: 'tariff'
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            // Обновляем локальную копию данных
            database.tariff = tariffs;
            
            console.log('✅ Тарифы успешно сохранены на сервере');
            Utils.showStatus(`Тарифы успешно сохранены на сервере (${tariffs.length} записей)`, 'success', 'tariff-status');
            showTariffPreview(tariffs);
            
            // Обновляем отображение времени обновления
            await Utils.showLastUpdate('tariff', 'last-update-tariff');
        } else {
            throw new Error(result.message || 'Ошибка сохранения на сервере');
        }
        
    } catch (error) {
        console.error('❌ Ошибка сохранения тарифов:', error);
        Utils.showStatus(`Ошибка сохранения тарифов: ${error.message}`, 'error', 'tariff-status');
    }
}

function showTariffPreview(tariffs) {
    const previewSection = document.getElementById('tariff-preview');
    const previewTable = document.getElementById('tariff-preview-table');
    
    if (!previewSection || !previewTable) {
        console.error('❌ Не найдены элементы для отображения предварительного просмотра тарифов');
        return;
    }
    
    // Проверяем, есть ли данные для отображения
    if (!tariffs || tariffs.length === 0) {
        previewTable.innerHTML = `
            <div class="status-message info">
                <i class="fas fa-info-circle"></i>
                <p>Тарифы еще не сохранены. Заполните поля и нажмите "Сохранить тарифы"</p>
            </div>
        `;
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
                <td>${tariff.terminal}</td>
                <td>${tariff.vtt ? tariff.vtt.toLocaleString('ru-RU') : '-'}</td>
                <td>${tariff.prr20 ? tariff.prr20.toLocaleString('ru-RU') : '-'}</td>
                <td>${tariff.prr40 ? tariff.prr40.toLocaleString('ru-RU') : '-'}</td>
                <td>${tariff.auto20 ? tariff.auto20.toLocaleString('ru-RU') : '-'}</td>
                <td>${tariff.auto40 ? tariff.auto40.toLocaleString('ru-RU') : '-'}</td>
                <td>${new Date(tariff.timestamp).toLocaleDateString('ru-RU')}</td>
            </tr>
        `;
    });
    
    tableHTML += `
            </tbody>
        </table>
        <p style="margin-top: 10px; color: #666; font-size: 14px;">
            Всего тарифов: ${tariffs.length}
        </p>
    `;
    
    previewTable.innerHTML = tableHTML;
    previewSection.classList.remove('hidden');
}

// Функции для работы с тарифами агентов
function addAgentTariffRow(tariff = null) {
    const tbody = document.getElementById('agent-tariff-table-body');
    if (!tbody) return;
    
    const rowIndex = tbody.children.length;
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>
            <input type="text" class="agent-tariff-name" placeholder="Наименование агента" value="${tariff?.name || ''}" title="Введите наименование агента">
        </td>
        <td>
            <input type="text" class="agent-tariff-snp" placeholder="СНП (текст)" value="${tariff?.snp || ''}" title="Введите сверхнормативное пользование">
        </td>
        <td class="actions-cell">
            <button class="btn-small btn-danger" onclick="removeAgentTariffRow(this)" title="Удалить строку">
                <i class="fas fa-trash-alt"></i> Удалить
            </button>
        </td>
    `;
    tbody.appendChild(row);
}

// Предпросмотр тарифов агентов
function showAgentTariffPreview(tariffs) {
    const previewSection = document.getElementById('tariff-preview');
    const previewTable = document.getElementById('tariff-preview-table');
    
    if (!previewSection || !previewTable) {
        console.error('❌ Не найдены элементы для отображения предварительного просмотра тарифов агентов');
        return;
    }
    
    // Проверяем, есть ли данные для отображения
    if (!tariffs || tariffs.length === 0) {
        previewTable.innerHTML = `
            <div class="status-message info">
                <i class="fas fa-info-circle"></i>
                <p>Тарифы агентов еще не сохранены. Заполните поля и нажмите "Сохранить тарифы агентов"</p>
            </div>
        `;
        previewSection.classList.remove('hidden');
        return;
    }
    
    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Наименование агента</th>
                    <th>СНП</th>
                    <th>Обновлено</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    tariffs.forEach(tariff => {
        tableHTML += `
            <tr>
                <td>${tariff.name}</td>
                <td>${tariff.snp || '-'}</td>
                <td>${new Date(tariff.timestamp).toLocaleDateString('ru-RU')}</td>
            </tr>
        `;
    });
    
    tableHTML += `
            </tbody>
        </table>
        <p style="margin-top: 10px; color: #666; font-size: 14px;">
            Всего тарифов агентов: ${tariffs.length}
        </p>
    `;
    
    previewTable.innerHTML = tableHTML;
    previewSection.classList.remove('hidden');
}

// Обновление предпросмотра в зависимости от текущего типа тарифов
function updateTariffPreview() {
    if (currentTariffType === 'terminal') {
        if (database.tariff && database.tariff.length > 0) {
            showTariffPreview(database.tariff);
        } else {
            const previewSection = document.getElementById('tariff-preview');
            const previewTable = document.getElementById('tariff-preview-table');
            if (previewSection && previewTable) {
                previewTable.innerHTML = `
                    <div class="status-message info">
                        <i class="fas fa-info-circle"></i>
                        <p>Тарифы терминалов еще не сохранены. Заполните поля и нажмите "Сохранить тарифы терминалов"</p>
                    </div>
                `;
                previewSection.classList.remove('hidden');
            }
        }
    } else if (currentTariffType === 'agent') {
        if (database.agent_tariff && database.agent_tariff.length > 0) {
            showAgentTariffPreview(database.agent_tariff);
        } else {
            const previewSection = document.getElementById('tariff-preview');
            const previewTable = document.getElementById('tariff-preview-table');
            if (previewSection && previewTable) {
                previewTable.innerHTML = `
                    <div class="status-message info">
                        <i class="fas fa-info-circle"></i>
                        <p>Тарифы агентов еще не сохранены. Заполните поля и нажмите "Сохранить тарифы агентов"</p>
                    </div>
                `;
                previewSection.classList.remove('hidden');
            }
        }
    }
}

function removeAgentTariffRow(button) {
    const row = button.closest('tr');
    if (row) {
        row.remove();
    }
}

function loadAgentTariffData() {
    console.log('📊 Загрузка данных тарифов агентов с сервера');
    
    const tbody = document.getElementById('agent-tariff-table-body');
    if (!tbody) return;
    
    // Очищаем таблицу
    tbody.innerHTML = '';
    
    // Если есть тарифы агентов в базе, отображаем их
    if (database.agent_tariff && database.agent_tariff.length > 0) {
        database.agent_tariff.forEach((tariff, index) => {
            addAgentTariffRow(tariff);
        });
        // Показываем предпросмотр тарифов агентов
        showAgentTariffPreview(database.agent_tariff);
    } else {
        // Если нет тарифов, добавляем одну пустую строку
        addAgentTariffRow();
        // Скрываем предпросмотр или показываем сообщение
        const previewSection = document.getElementById('tariff-preview');
        if (previewSection) {
            previewSection.classList.add('hidden');
        }
    }
}

async function saveAgentTariffData() {
    console.log('💾 Сохранение тарифных данных агентов на сервере');
    
    const rows = document.querySelectorAll('#agent-tariff-table-body tr');
    const tariffs = [];
    
    rows.forEach((row) => {
        const name = row.querySelector('.agent-tariff-name').value.trim();
        const snp = row.querySelector('.agent-tariff-snp').value.trim();
        
        // Если все поля пустые, пропускаем строку
        if (!name && !snp) {
            return;
        }
        
        const tariff = {
            name: name || 'Без названия',
            snp: snp || '',
            timestamp: new Date().toISOString()
        };
        
        tariffs.push(tariff);
    });
    
    if (tariffs.length === 0) {
        Utils.showStatus('Добавьте хотя бы один тариф агента', 'error', 'agent-tariff-status');
        return;
    }
    
    try {
        // Получаем токен авторизации
        const token = localStorage.getItem('auth_token');
        
        // Отправляем на сервер (тип 'agent_tariff')
        const response = await fetch('/api/data/agent_tariff', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                data: tariffs,
                type: 'agent_tariff'
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            // Обновляем локальную копию данных
            database.agent_tariff = tariffs;
            
            console.log('✅ Тарифы агентов успешно сохранены на сервере');
            Utils.showStatus(`Тарифы агентов успешно сохранены на сервере (${tariffs.length} записей)`, 'success', 'agent-tariff-status');
            
            // Показываем предпросмотр тарифов агентов
            showAgentTariffPreview(tariffs);
            
            // Обновляем отображение времени обновления
            await Utils.showLastUpdate('agent_tariff', 'last-update-tariff');
        } else {
            throw new Error(result.message || 'Ошибка сохранения на сервере');
        }
        
    } catch (error) {
        console.error('❌ Ошибка сохранения тарифов агентов:', error);
        Utils.showStatus(`Ошибка сохранения тарифов агентов: ${error.message}`, 'error', 'agent-tariff-status');
    }
}

// Функция для загрузки данных с сервера
async function loadDatabaseData() {
    const dbTypes = ['sea', 'rail', 'direct_rail', 'direct_sea', 'tariff', 'agent_tariff'];
    
    for (const dbType of dbTypes) {
        try {
            // Получаем токен авторизации
            const token = localStorage.getItem('auth_token');
            
            const response = await fetch(`/api/data/${dbType}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const serverData = await response.json();
            database[dbType] = serverData.data || [];
            console.log(`✅ Загружены данные с сервера для ${dbType}: ${database[dbType].length} записей`);
            
            // Если загружены тарифы и мы находимся в интерфейсе тарифов, показываем их
            if (dbType === 'tariff' && database.tariff.length > 0 && currentDatabase === 'tariff') {
                // Тарифы уже загружены, интерфейс обновится через loadTariffData()
                // Ничего дополнительного не делаем
            }
            
        } catch (error) {
            console.error(`❌ Ошибка загрузки данных с сервера для ${dbType}:`, error);
            
            console.warn(`⚠️ Нет данных на сервере для ${dbType}`);
            database[dbType] = [];
        }
    }
    
    // Экспортируем данные в глобальную область для модулей
    window.database = database;
    console.log('🌐 Данные экспортированы в window.database для модулей');
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
    window.currentRole = '';
    window.currentDatabase = '';
    window.uploadedData = null;
    
    // Возвращаем на главную страницу (index.html)
    window.location.href = '../index.html';
}