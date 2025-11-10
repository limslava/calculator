// 🎯 ОСНОВНОЙ ФАЙЛ ПРИЛОЖЕНИЯ - ТЕПЕРЬ ИСПОЛЬЗУЕТ МОДУЛИ

// Глобальные переменные
let currentRole = '';
let currentDatabase = '';
let uploadedData = null;
let database = {
    sea: [],
    rail: [],
    direct_rail: [],
    direct_sea: [],
    sea_rail: []
};

// Функции для управления интерфейсом
function selectRole(role) {
    currentRole = role;
    document.getElementById('role-selection').classList.add('hidden');
    document.getElementById('database-selection').classList.remove('hidden');
}

function selectDatabase(dbType) {
    currentDatabase = dbType;
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
    if (currentRole && currentDatabase) {
        if (currentRole === 'sales') {
            resetCalculatorForm();
        }
        
        currentDatabase = '';
        document.getElementById('database-selection').classList.remove('hidden');
        document.getElementById('purchaser-interface').classList.add('hidden');
        document.getElementById('sales-interface').classList.add('hidden');
    } else if (currentRole) {
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
            
            if (currentDatabase === 'direct_rail') {
                uploadedData = Utils.parseDirectRailData(jsonData);
            } else if (currentDatabase === 'direct_sea') {
                uploadedData = Utils.parseDirectSeaData(jsonData);
            } else if (currentDatabase === 'sea') {
                uploadedData = Utils.parseSeaData(jsonData);
            } else {
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

function saveData() {
    if (!uploadedData) {
        Utils.showStatus('Нет данных для сохранения', 'error');
        return;
    }
    
    database[currentDatabase] = uploadedData;
    localStorage.setItem(`logistics_db_${currentDatabase}`, JSON.stringify(uploadedData));
    
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
}

// Функции для менеджера по продажам
function setupCalculator() {
    loadDatabaseData();
    showCorrectFields();
    setupAutocomplete();
}

function loadDatabaseData() {
    // 🔧 ЗАГРУЗКА ДАННЫХ ИЗ LOCALSTORAGE ДЛЯ ВСЕХ ТИПОВ БАЗ
    const dbTypes = ['sea', 'rail', 'direct_rail', 'direct_sea', 'sea_rail'];
    
    dbTypes.forEach(dbType => {
        const savedData = localStorage.getItem(`logistics_db_${dbType}`);
        if (savedData) {
            try {
                database[dbType] = JSON.parse(savedData);
                console.log(`✅ Загружены данные для ${dbType}: ${database[dbType].length} записей`);
            } catch (error) {
                console.error(`❌ Ошибка загрузки данных для ${dbType}:`, error);
                database[dbType] = [];
            }
        } else {
            console.warn(`⚠️ Нет сохраненных данных для ${dbType}`);
            database[dbType] = [];
        }
    });
    
    // 🔧 ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА ДЛЯ МОРЯ
    console.log('📊 Проверка данных моря:', {
        hasSeaData: database.sea && database.sea.length > 0,
        seaRecords: database.sea ? database.sea.length : 0,
        currentDatabase: currentDatabase
    });
}

function showCorrectFields() {
    const seaFields = document.getElementById('sea-fields');
    const directRailFields = document.getElementById('direct-rail-fields');
    const dropOffAreaField = document.getElementById('drop-off-area-container');
    const containerTypeSelect = document.getElementById('container-type');
    
    if (currentDatabase === 'direct_rail') {
        seaFields.classList.add('hidden');
        directRailFields.classList.remove('hidden');
    } else if (currentDatabase === 'direct_sea') {
        seaFields.classList.remove('hidden');
        directRailFields.classList.add('hidden');
        if (dropOffAreaField) {
            dropOffAreaField.classList.add('hidden');
        }
        updateContainerTypesForDirectSea(containerTypeSelect);
    } else {
        seaFields.classList.remove('hidden');
        directRailFields.classList.add('hidden');
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

function loadDatabaseData() {
    const savedData = localStorage.getItem(`logistics_db_${currentDatabase}`);
    if (savedData) {
        database[currentDatabase] = JSON.parse(savedData);
    }
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


// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Приложение логистики инициализировано');
    
    // Проверяем наличие библиотеки XLSX
    if (typeof XLSX === 'undefined') {
        console.error('❌ Библиотека XLSX не загружена');
        Utils.showStatus('Ошибка: библиотека XLSX не загружена', 'error');
    }
});