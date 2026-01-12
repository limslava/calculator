// Скрипт для интерфейса истории загрузки тарифов (только для администратора)

// Глобальные переменные
let currentPage = 1;
let totalPages = 1;
let currentFilters = {};

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Инициализация интерфейса истории загрузки тарифов');
    
    // Проверяем авторизацию и права администратора
    const currentUser = await checkAuth();
    if (!currentUser || currentUser.role !== 'admin') {
        console.log('❌ Неавторизованный доступ или недостаточно прав, перенаправление на главную');
        window.location.href = '../index.html';
        return;
    }
    
    console.log('✅ Администратор авторизован:', currentUser.email);
    
    // Устанавливаем даты по умолчанию (последние 30 дней)
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    document.getElementById('date-from').value = thirtyDaysAgo.toISOString().split('T')[0];
    document.getElementById('date-to').value = today.toISOString().split('T')[0];
    
    // Загружаем историю и статистику
    await loadHistory();
    await loadStats();
    
    // Настраиваем обработчики событий
    setupEventListeners();
});

// Проверка авторизации с сервера
async function checkAuth() {
    try {
        const currentUser = await ServerAuth.getCurrentUser();
        return currentUser;
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
        return null;
    }
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Обработка нажатия Enter в полях фильтров
    document.getElementById('user-filter').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            applyFilters();
        }
    });
    
    // Автоматическое применение фильтров при изменении дат
    document.getElementById('date-from').addEventListener('change', function() {
        applyFilters();
    });
    
    document.getElementById('date-to').addEventListener('change', function() {
        applyFilters();
    });
    
    document.getElementById('data-type').addEventListener('change', function() {
        applyFilters();
    });
}

// Загрузка истории загрузок
async function loadHistory() {
    try {
        showLoading(true);
        
        const token = localStorage.getItem('auth_token');
        const params = new URLSearchParams({
            page: currentPage,
            limit: 20,
            ...currentFilters
        });
        
        const response = await fetch(`/api/upload-history?${params}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            renderHistoryTable(result.data);
            updatePagination(result.pagination);
        } else {
            throw new Error(result.error || 'Ошибка загрузки истории');
        }
        
    } catch (error) {
        console.error('❌ Ошибка загрузки истории:', error);
        showError('Не удалось загрузить историю загрузок');
    } finally {
        showLoading(false);
    }
}

// Загрузка статистики
async function loadStats() {
    try {
        const token = localStorage.getItem('auth_token');
        const params = new URLSearchParams(currentFilters);
        
        const response = await fetch(`/api/upload-stats?${params}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            renderStats(result);
            document.getElementById('stats').classList.remove('hidden');
        }
        
    } catch (error) {
        console.error('❌ Ошибка загрузки статистики:', error);
        // Не показываем ошибку, если статистика не загрузилась
    }
}

// Отображение статистики
function renderStats(statsData) {
    // Сбрасываем счетчики
    document.getElementById('sea-count').textContent = '0';
    document.getElementById('rail-count').textContent = '0';
    document.getElementById('direct-sea-count').textContent = '0';
    document.getElementById('direct-rail-count').textContent = '0';
    
    // Обновляем счетчики из данных
    statsData.stats.forEach(stat => {
        const count = stat.dataValues ? stat.dataValues.count : stat.count;
        switch(stat.dataType) {
            case 'sea':
                document.getElementById('sea-count').textContent = count;
                break;
            case 'rail':
                document.getElementById('rail-count').textContent = count;
                break;
            case 'direct_sea':
                document.getElementById('direct-sea-count').textContent = count;
                break;
            case 'direct_rail':
                document.getElementById('direct-rail-count').textContent = count;
                break;
        }
    });
}

// Отображение таблицы истории
function renderHistoryTable(historyData) {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;
    
    if (!historyData || historyData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-cell">
                    <div class="empty-state">
                        <i class="fas fa-history"></i>
                        <p>Нет данных о загрузках за выбранный период</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    let tableHTML = '';
    
    historyData.forEach((item, index) => {
        const upload = item.dataValues ? item.dataValues : item;
        const user = upload.user ? upload.user : { email: upload.userEmail };
        
        const dataTypeNames = {
            'sea': 'Морские перевозки',
            'rail': 'ЖД перевозки',
            'direct_sea': 'Прямые морские',
            'direct_rail': 'Прямые ЖД',
            'tariff': 'Тарифы терминалов',
            'agent_tariff': 'Тарифы агентов'
        };
        
        const dataTypeName = dataTypeNames[upload.dataType] || upload.dataType;
        const uploadDate = new Date(upload.uploadedAt).toLocaleString('ru-RU');
        
        tableHTML += `
            <tr>
                <td>${upload.id.substring(0, 8)}...</td>
                <td>
                    <span class="data-type-badge ${upload.dataType}">
                        ${dataTypeName}
                    </span>
                </td>
                <td>
                    <div class="user-info">
                        <i class="fas fa-user"></i>
                        <span>${user.email}</span>
                    </div>
                </td>
                <td>
                    <span class="record-count">${upload.recordCount}</span>
                </td>
                <td>${uploadDate}</td>
                <td class="actions-cell">
                    <button class="btn-small btn-primary" onclick="showDetail('${upload.id}')" title="Просмотреть детали">
                        <i class="fas fa-eye"></i> Детали
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = tableHTML;
}

// Обновление пагинации
function updatePagination(pagination) {
    totalPages = pagination.totalPages || 1;
    
    document.getElementById('page-info').textContent = `Страница ${currentPage} из ${totalPages}`;
    document.getElementById('prev-page').disabled = currentPage <= 1;
    document.getElementById('next-page').disabled = currentPage >= totalPages;
}

// Применение фильтров
function applyFilters() {
    currentFilters = {};
    
    const dataType = document.getElementById('data-type').value;
    if (dataType && dataType !== 'all') {
        currentFilters.dataType = dataType;
    }
    
    const dateFrom = document.getElementById('date-from').value;
    if (dateFrom) {
        currentFilters.dateFrom = dateFrom;
    }
    
    const dateTo = document.getElementById('date-to').value;
    if (dateTo) {
        currentFilters.dateTo = dateTo;
    }
    
    const userFilter = document.getElementById('user-filter').value.trim();
    if (userFilter) {
        // Ищем пользователя по email
        currentFilters.userEmail = userFilter;
    }
    
    currentPage = 1;
    loadHistory();
    loadStats();
}

// Сброс фильтров
function resetFilters() {
    document.getElementById('data-type').value = 'all';
    
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    document.getElementById('date-from').value = thirtyDaysAgo.toISOString().split('T')[0];
    document.getElementById('date-to').value = today.toISOString().split('T')[0];
    document.getElementById('user-filter').value = '';
    
    applyFilters();
}

// Изменение страницы
function changePage(delta) {
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        loadHistory();
    }
}

// Обновление истории
function refreshHistory() {
    loadHistory();
    loadStats();
}

// Показать детали загрузки
async function showDetail(uploadId) {
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`/api/upload-history/${uploadId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            renderDetailModal(result.data);
        } else {
            throw new Error(result.error || 'Ошибка загрузки деталей');
        }
        
    } catch (error) {
        console.error('❌ Ошибка загрузки деталей:', error);
        showError('Не удалось загрузить детали загрузки');
    }
}

// Отображение модального окна с деталями
function renderDetailModal(uploadData) {
    const upload = uploadData.dataValues ? uploadData.dataValues : uploadData;
    const user = upload.user ? upload.user : { email: upload.userEmail, role: 'unknown' };
    
    // Заполняем основную информацию
    document.getElementById('detail-id').textContent = upload.id;
    document.getElementById('detail-type').textContent = getDataTypeName(upload.dataType);
    document.getElementById('detail-user').textContent = `${user.email} (${user.role})`;
    document.getElementById('detail-date').textContent = new Date(upload.uploadedAt).toLocaleString('ru-RU');
    document.getElementById('detail-count').textContent = upload.recordCount;
    
    // Отображаем предпросмотр данных
    const previewContainer = document.getElementById('detail-preview');
    if (upload.previewData && upload.previewData.length > 0) {
        let previewHTML = '<div class="preview-table-container"><table><thead><tr>';
        
        // Заголовки таблицы (берем ключи из первой записи)
        const firstRecord = upload.previewData[0];
        if (firstRecord && typeof firstRecord === 'object') {
            Object.keys(firstRecord).forEach(key => {
                previewHTML += `<th>${key}</th>`;
            });
        }
        
        previewHTML += '</tr></thead><tbody>';
        
        // Данные
        upload.previewData.forEach(record => {
            previewHTML += '<tr>';
            if (record && typeof record === 'object') {
                Object.values(record).forEach(value => {
                    previewHTML += `<td>${value !== null && value !== undefined ? value : '-'}</td>`;
                });
            } else {
                previewHTML += `<td colspan="10">${record}</td>`;
            }
            previewHTML += '</tr>';
        });
        
        previewHTML += '</tbody></table>';
        previewHTML += `<p class="preview-info">Показано ${upload.previewData.length} из ${upload.recordCount} записей</p>`;
        previewHTML += '</div>';
        
        previewContainer.innerHTML = previewHTML;
    } else {
        previewContainer.innerHTML = `
            <div class="empty-preview">
                <i class="fas fa-info-circle"></i>
                <p>Предпросмотр данных недоступен</p>
            </div>
        `;
    }
    
    // Показываем модальное окно
    document.getElementById('detail-modal').classList.remove('hidden');
}

// Закрытие модального окна
function closeDetailModal() {
    document.getElementById('detail-modal').classList.add('hidden');
}

// Экспорт данных в Excel (детали)
async function exportDetailData() {
    try {
        // Получаем ID загрузки из модального окна
        const detailIdElement = document.getElementById('detail-id');
        if (!detailIdElement) {
            alert('Модальное окно с деталями не открыто');
            return;
        }
        
        const uploadId = detailIdElement.textContent;
        if (!uploadId || uploadId === '-') {
            alert('Не удалось получить ID загрузки');
            return;
        }
        
        // Показываем индикатор загрузки
        const exportButton = document.querySelector('#detail-modal .btn-primary');
        const originalText = exportButton ? exportButton.textContent : 'Экспорт в Excel';
        if (exportButton) {
            exportButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загрузка данных...';
            exportButton.disabled = true;
        }
        
        // Получаем полные данные загрузки с сервера
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`/api/upload-history/${uploadId}/full-data`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Ошибка загрузки полных данных');
        }
        
        const upload = result.data.uploadHistory.dataValues ? result.data.uploadHistory.dataValues : result.data.uploadHistory;
        const user = upload.user ? upload.user : { email: upload.userEmail, role: 'unknown' };
        const fullData = result.data.fullData || [];
        
        if (exportButton) {
            exportButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Создание файла...';
        }
        
        // Создаем Excel файл
        const workbook = XLSX.utils.book_new();
        
        // Лист с основной информацией
        const infoData = [
            ['История загрузки тарифов - Детали'],
            [''],
            ['ID загрузки:', upload.id],
            ['Тип данных:', getDataTypeName(upload.dataType)],
            ['Пользователь:', user.email],
            ['Роль пользователя:', user.role],
            ['Количество записей:', upload.recordCount],
            ['Дата загрузки:', new Date(upload.uploadedAt).toLocaleString('ru-RU')],
            ['Дата экспорта:', new Date().toLocaleString('ru-RU')],
            [''],
            ['Примечание: Экспортируются точные данные, загруженные в этой операции.'],
            [''],
            ['Данные:']
        ];
        
        const infoWorksheet = XLSX.utils.aoa_to_sheet(infoData);
        XLSX.utils.book_append_sheet(workbook, infoWorksheet, 'Информация');
        
        // Лист с данными
        if (fullData.length > 0) {
            // Определяем заголовки из первой записи
            const firstRecord = fullData[0];
            const headers = firstRecord ? Object.keys(firstRecord) : [];
            
            if (headers.length > 0) {
                const dataRows = fullData.map(record =>
                    headers.map(header => record[header] !== null && record[header] !== undefined ? record[header] : '-')
                );
                
                const dataSheet = [headers, ...dataRows];
                const dataWorksheet = XLSX.utils.aoa_to_sheet(dataSheet);
                XLSX.utils.book_append_sheet(workbook, dataWorksheet, 'Данные');
            } else {
                // Если данные пустые или нет заголовков
                const emptyData = [['Нет данных для экспорта']];
                const dataWorksheet = XLSX.utils.aoa_to_sheet(emptyData);
                XLSX.utils.book_append_sheet(workbook, dataWorksheet, 'Данные');
            }
        } else {
            // Если данных нет
            const emptyData = [['Нет данных для экспорта']];
            const dataWorksheet = XLSX.utils.aoa_to_sheet(emptyData);
            XLSX.utils.book_append_sheet(workbook, dataWorksheet, 'Данные');
        }
        
        // Генерируем имя файла
        const fileName = `history_${upload.dataType}_${upload.id.substring(0, 8)}_${new Date().toISOString().split('T')[0]}.xlsx`;
        
        // Сохраняем файл
        XLSX.writeFile(workbook, fileName);
        
        // Восстанавливаем кнопку
        if (exportButton) {
            exportButton.innerHTML = originalText;
            exportButton.disabled = false;
        }
        
        console.log(`✅ Файл экспортирован: ${fileName}, записей: ${fullData.length}`);
        
    } catch (error) {
        console.error('❌ Ошибка экспорта деталей:', error);
        alert(`Ошибка экспорта: ${error.message}`);
        
        // Восстанавливаем кнопку
        const exportButton = document.querySelector('#detail-modal .btn-primary');
        if (exportButton) {
            exportButton.innerHTML = '<i class="fas fa-file-excel"></i> Экспорт в Excel';
            exportButton.disabled = false;
        }
    }
}

// Экспорт всей таблицы истории в Excel
async function exportToExcel() {
    try {
        // Показываем индикатор загрузки
        const exportButton = document.querySelector('button[onclick="exportToExcel()"]');
        const originalText = exportButton ? exportButton.textContent : 'Экспорт в Excel';
        if (exportButton) {
            exportButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Экспорт...';
            exportButton.disabled = true;
        }
        
        // Получаем данные с текущими фильтрами
        const token = localStorage.getItem('auth_token');
        const params = new URLSearchParams({
            page: 1,
            limit: 1000, // Большой лимит для получения всех данных
            ...currentFilters
        });
        
        const response = await fetch(`/api/upload-history?${params}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Ошибка загрузки истории');
        }
        
        const historyData = result.data;
        
        if (!historyData || historyData.length === 0) {
            alert('Нет данных для экспорта');
            if (exportButton) {
                exportButton.innerHTML = originalText;
                exportButton.disabled = false;
            }
            return;
        }
        
        // Создаем Excel файл
        const workbook = XLSX.utils.book_new();
        
        // Лист с историей загрузок
        const headers = ['ID', 'Тип данных', 'Пользователь', 'Роль', 'Количество записей', 'Дата загрузки'];
        const dataRows = historyData.map(item => {
            const upload = item.dataValues ? item.dataValues : item;
            const user = upload.user ? upload.user : { email: upload.userEmail, role: 'unknown' };
            
            return [
                upload.id.substring(0, 8) + '...',
                getDataTypeName(upload.dataType),
                user.email,
                user.role,
                upload.recordCount,
                new Date(upload.uploadedAt).toLocaleString('ru-RU')
            ];
        });
        
        const historySheet = [headers, ...dataRows];
        const historyWorksheet = XLSX.utils.aoa_to_sheet(historySheet);
        XLSX.utils.book_append_sheet(workbook, historyWorksheet, 'История загрузок');
        
        // Лист с информацией о фильтрах
        const filterInfo = [
            ['История загрузки тарифов - Экспорт'],
            [''],
            ['Дата экспорта:', new Date().toLocaleString('ru-RU')],
            ['Всего записей:', historyData.length],
            [''],
            ['Примененные фильтры:'],
            ['Тип данных:', currentFilters.dataType || 'Все'],
            ['Дата с:', currentFilters.dateFrom || 'Не указано'],
            ['Дата по:', currentFilters.dateTo || 'Не указано'],
            ['Пользователь:', currentFilters.userEmail || 'Не указано']
        ];
        
        const infoWorksheet = XLSX.utils.aoa_to_sheet(filterInfo);
        XLSX.utils.book_append_sheet(workbook, infoWorksheet, 'Информация');
        
        // Генерируем имя файла
        const fileName = `upload_history_${new Date().toISOString().split('T')[0]}.xlsx`;
        
        // Сохраняем файл
        XLSX.writeFile(workbook, fileName);
        
        // Восстанавливаем кнопку
        if (exportButton) {
            exportButton.innerHTML = originalText;
            exportButton.disabled = false;
        }
        
        console.log(`✅ Файл экспортирован: ${fileName}, записей: ${historyData.length}`);
        
    } catch (error) {
        console.error('❌ Ошибка экспорта истории:', error);
        alert(`Ошибка экспорта: ${error.message}`);
        
        // Восстанавливаем кнопку
        const exportButton = document.querySelector('button[onclick="exportToExcel()"]');
        if (exportButton) {
            exportButton.innerHTML = '<i class="fas fa-file-excel"></i> Экспорт в Excel';
            exportButton.disabled = false;
        }
    }
}

// Получение читаемого названия типа данных
function getDataTypeName(dataType) {
    const names = {
        'sea': 'Морские перевозки',
        'rail': 'Железнодорожные перевозки',
        'direct_sea': 'Прямые морские перевозки',
        'direct_rail': 'Прямые железнодорожные перевозки',
        'tariff': 'Тарифы терминалов',
        'agent_tariff': 'Тарифы агентов'
    };
    
    return names[dataType] || dataType;
}

// Показать/скрыть индикатор загрузки
function showLoading(show) {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;
    
    if (show) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="loading-cell">
                    <div class="loading-spinner">
                        <i class="fas fa-spinner fa-spin"></i>
                        <span>Загрузка истории...</span>
                    </div>
                </td>
            </tr>
        `;
    }
}

// Показать сообщение об ошибке
function showError(message) {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="error-cell">
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${message}</p>
                    <button class="btn-small btn-primary" onclick="refreshHistory()">
                        <i class="fas fa-redo"></i> Повторить
                    </button>
                </div>
            </td>
        </tr>
    `;
}

// Возврат на предыдущую страницу
function goBack() {
    window.history.back();
}

// Экспорт функций в глобальную область видимости
window.applyFilters = applyFilters;
window.resetFilters = resetFilters;
window.changePage = changePage;
window.refreshHistory = refreshHistory;
window.showDetail = showDetail;
window.closeDetailModal = closeDetailModal;
window.exportDetailData = exportDetailData;
window.exportToExcel = exportToExcel;
window.goBack = goBack;