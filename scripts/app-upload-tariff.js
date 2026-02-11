// Вспомогательные функции главной страницы: загрузка файлов и тарифы
function escapeHtml(value) {
    return (window.Utils && typeof Utils.escapeHtml === 'function')
        ? Utils.escapeHtml(value)
        : String(value ?? '');
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
    
    fileInput.onchange = function(e) {
        if (e.target.files.length > 0) {
            processButton.disabled = false;
            Utils.showStatus('Файл выбран. Нажмите "Обработать файл"', 'success');
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
                    <td>${escapeHtml(item.departureStation)}</td>
                    <td>${escapeHtml(item.arrivalStation)}</td>
                    <td>${escapeHtml(item.arrivalCity)}</td>
                    <td>$${escapeHtml(item.fob40hc)}</td>
                    <td>$${escapeHtml(item.exwFca40hc)}</td>
                    <td>${escapeHtml(item.borderCrossing)}</td>
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
                    <td>${escapeHtml(item.pol)}</td>
                    <td>${escapeHtml(item.pod)}</td>
                    <td>$${escapeHtml(item.dc20)}</td>
                    <td>$${escapeHtml(item.hc40)}</td>
                    <td>${escapeHtml(item.conversion)}</td>
                    <td>${escapeHtml(item.etd)}</td>
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
                    <td>${escapeHtml(item.city)}</td>
                    <td>${escapeHtml(item.agent)}</td>
                    <td>${escapeHtml(тыловойТерминал)}</td>
                    <td>${escapeHtml(item.destination)}</td>
                    <td>${escapeHtml(autovivoz)}</td>
                    <td>${escapeHtml(prr)}</td>
                    <td>$${escapeHtml(item.container20Under24)}</td>
                    <td>$${escapeHtml(item.container20Over24)}</td>
                    <td>$${escapeHtml(item.container40)}</td>
                    <td>${escapeHtml(nds)}</td>
                    <td>${escapeHtml(vochr20)}</td>
                    <td>${escapeHtml(vochr40)}</td>
                    <td>${escapeHtml(fitting)}</td>
                    <td>${escapeHtml(conditions)}</td>
                    <td>${escapeHtml(item.validity)}</td>
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
                    <td>${escapeHtml(item.pol)}</td>
                    <td>${escapeHtml(item.pod)}</td>
                    <td>${escapeHtml(item.dropOffArea)}</td>
                    <td>$${escapeHtml(item.soc20)}</td>
                    <td>$${escapeHtml(item.soc40)}</td>
                    <td>$${escapeHtml(item.dc20)}</td>
                    <td>$${escapeHtml(item.hc40)}</td>
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

// Функции для работы с тарифами (расширенные для терминалов)
function loadTariffData() {
    const tbody = document.getElementById('tariff-table-body');
    if (!tbody) return;
    
    // Очищаем таблицу
    tbody.innerHTML = '';
    
    // Загружаем сохраненные тарифы из базы данных
    if (database.tariff && database.tariff.length > 0) {
        // Теперь database.tariff - это массив объектов
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

// Функция для получения ставки ВТТ по терминалу
function getVttRateForTerminal(terminalName) {
    if (!database.tariff || database.tariff.length === 0) {
        return 0;
    }
    
    // Ищем тариф с указанным терминалом (регистронезависимо)
    const normalizedTerminal = terminalName ? terminalName.trim().toLowerCase() : '';
    const tariff = database.tariff.find(t =>
        t.terminal && t.terminal.trim().toLowerCase() === normalizedTerminal
    );
    
    if (tariff && tariff.vtt !== undefined && tariff.vtt !== null) {
        return tariff.vtt;
    }
    
    // Если не нашли, ищем тариф с терминалом "Общий"
    const generalTariff = database.tariff.find(t =>
        t.terminal && t.terminal.trim().toLowerCase() === 'общий'
    );
    
    if (generalTariff && generalTariff.vtt !== undefined && generalTariff.vtt !== null) {
        return generalTariff.vtt;
    }
    
    // Если нет общего, берем первый тариф
    if (database.tariff[0] && database.tariff[0].vtt !== undefined && database.tariff[0].vtt !== null) {
        return database.tariff[0].vtt;
    }
    
    return 0;
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
            <button class="btn-small btn-danger" onclick="removeTariffRow(this)">Удалить</button>
        </td>
    `;
    tbody.appendChild(row);
}

function addTariffRowToTable(tariff, index) {
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
            <button class="btn-small btn-danger" onclick="removeTariffRow(this)">Удалить</button>
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
    
    rows.forEach(row => {
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
        
        tariffs.push({
            terminal: terminal || 'Общий',
            vtt,
            prr20,
            prr40,
            auto20,
            auto40,
            timestamp: new Date().toISOString()
        });
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
