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
    tariff: []
};

// Простая функция для проверки авторизации
function checkAuth() {
    const currentUserData = localStorage.getItem('current_user');
    if (!currentUserData) {
        return null;
    }
    
    try {
        const user = JSON.parse(currentUserData);
        return user;
    } catch (error) {
        console.error('Ошибка парсинга данных пользователя:', error);
        return null;
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Приложение менеджера по закупкам инициализировано');
    
    // Проверяем авторизацию
    const currentUser = checkAuth();
    if (!currentUser || currentUser.role !== 'purchaser') {
        // Если пользователь не авторизован или не менеджер по закупкам, перенаправляем на главную
        console.log('❌ Неавторизованный доступ, перенаправление на главную');
        window.location.href = 'index.html';
        return;
    }
    
    console.log('✅ Пользователь авторизован как менеджер по закупкам:', currentUser.email);
    
    // Автоматически загружаем данные с сервера при запуске
    await loadDatabaseData();
    console.log('✅ Данные загружены с сервера при инициализации');
    
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
    });
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
        // Отправляем данные на сервер
        const response = await fetch(`/api/data/${currentDatabase}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
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
            
            // Сохраняем в localStorage как резервную копию
            localStorage.setItem(`logistics_db_${currentDatabase}`, JSON.stringify(uploadedData));
            
            console.log(`✅ Данные успешно загружены в базу ${currentDatabase}: ${uploadedData.length} записей`);
            Utils.showStatus(`✅ Данные успешно загружены в базу ${currentDatabase} (${uploadedData.length} записей)`, 'success');
            
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

// Функции для работы с тарифами
function loadTariffData() {
    console.log('📊 Загрузка данных тарифов');
    
    // Загружаем тарифы из localStorage или базы данных
    const savedTariffs = localStorage.getItem('logistics_db_tariff');
    if (savedTariffs) {
        try {
            const tariffs = JSON.parse(savedTariffs);
            if (tariffs && tariffs.length > 0) {
                // Заполняем поля формы
                const tariff = tariffs[0]; // Берем первый тариф
                document.getElementById('vtt-rate').value = tariff.vtt || '';
                document.getElementById('prr20-rate').value = tariff.prr20 || '';
                document.getElementById('prr40-rate').value = tariff.prr40 || '';
                document.getElementById('auto20-rate').value = tariff.auto20 || '';
                document.getElementById('auto40-rate').value = tariff.auto40 || '';
                
                console.log('✅ Тарифы загружены из localStorage');
                Utils.showStatus('Тарифы загружены', 'success', 'tariff-status');
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки тарифов:', error);
        }
    }
}

function saveTariffData() {
    console.log('💾 Сохранение тарифных данных');
    
    const vttRate = document.getElementById('vtt-rate').value;
    const prr20Rate = document.getElementById('prr20-rate').value;
    const prr40Rate = document.getElementById('prr40-rate').value;
    const auto20Rate = document.getElementById('auto20-rate').value;
    const auto40Rate = document.getElementById('auto40-rate').value;
    
    // Проверяем, что хотя бы одно поле заполнено
    if (!vttRate && !prr20Rate && !prr40Rate && !auto20Rate && !auto40Rate) {
        Utils.showStatus('Заполните хотя бы одно поле тарифа', 'error', 'tariff-status');
        return;
    }
    
    const tariffData = {
        vtt: vttRate ? parseInt(vttRate) : null,
        prr20: prr20Rate ? parseInt(prr20Rate) : null,
        prr40: prr40Rate ? parseInt(prr40Rate) : null,
        auto20: auto20Rate ? parseInt(auto20Rate) : null,
        auto40: auto40Rate ? parseInt(auto40Rate) : null,
        timestamp: new Date().toISOString()
    };
    
    // Сохраняем в localStorage
    localStorage.setItem('logistics_db_tariff', JSON.stringify([tariffData]));
    
    // Сохраняем в глобальную базу данных
    database.tariff = [tariffData];
    
    // Отправляем на сервер
    fetch('/api/data/tariff', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            data: [tariffData],
            type: 'tariff'
        })
    }).then(response => {
        if (response.ok) {
            console.log('✅ Тарифы успешно сохранены');
            Utils.showStatus('Тарифы успешно сохранены', 'success', 'tariff-status');
            showTariffPreview(tariffData);
        } else {
            throw new Error('Ошибка сохранения на сервере');
        }
    }).catch(error => {
        console.error('❌ Ошибка сохранения тарифов:', error);
        Utils.showStatus('Тарифы сохранены локально (ошибка сервера)', 'warning', 'tariff-status');
        showTariffPreview(tariffData);
    });
}

function showTariffPreview(tariffData) {
    const previewSection = document.getElementById('tariff-preview');
    const previewTable = document.getElementById('tariff-preview-table');
    
    if (!previewSection || !previewTable) {
        console.error('❌ Не найдены элементы для отображения предварительного просмотра тарифов');
        return;
    }
    
    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Тип тарифа</th>
                    <th>Стоимость (руб)</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    if (tariffData.vtt) {
        tableHTML += `<tr><td>ВТТ</td><td>${tariffData.vtt.toLocaleString('ru-RU')}</td></tr>`;
    }
    if (tariffData.prr20) {
        tableHTML += `<tr><td>ПРР 20</td><td>${tariffData.prr20.toLocaleString('ru-RU')}</td></tr>`;
    }
    if (tariffData.prr40) {
        tableHTML += `<tr><td>ПРР 40</td><td>${tariffData.prr40.toLocaleString('ru-RU')}</td></tr>`;
    }
    if (tariffData.auto20) {
        tableHTML += `<tr><td>Автовывоз 20</td><td>${tariffData.auto20.toLocaleString('ru-RU')}</td></tr>`;
    }
    if (tariffData.auto40) {
        tableHTML += `<tr><td>Автовывоз 40</td><td>${tariffData.auto40.toLocaleString('ru-RU')}</td></tr>`;
    }
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    previewTable.innerHTML = tableHTML;
    previewSection.classList.remove('hidden');
}

// Функция для загрузки данных с сервера
async function loadDatabaseData() {
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
            
            // Резервная загрузка из localStorage
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
    
    // Экспортируем данные в глобальную область для модулей
    window.database = database;
    console.log('🌐 Данные экспортированы в window.database для модулей');
}

// Функция выхода из системы
function logoutUser() {
    console.log('🔐 Выход из системы менеджера по закупкам');
    
    // Сбрасываем глобальные переменные
    window.currentRole = '';
    window.currentDatabase = '';
    window.uploadedData = null;
    
    // Очищаем localStorage авторизации
    localStorage.removeItem('current_user');
    
    // Возвращаем на главную страницу
    window.location.href = 'index.html';
}