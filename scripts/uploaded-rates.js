// ============================================
// ФУНКЦИИ ДЛЯ ОТОБРАЖЕНИЯ ЗАГРУЖЕННЫХ СТАВОК
// ============================================

// Глобальные переменные для управления ставками
let uploadedRates = {
    data: [],
    filteredData: [],
    currentPage: 1,
    pageSize: 10,
    totalPages: 1,
    filters: {
        dataType: 'all',
        searchText: '',
        startDate: '',
        endDate: ''
    },
    currentDataType: 'sea' // текущий тип данных для отображения ставок
};

// Инициализация отображения загруженных ставок
function initUploadedRates(dbType) {
    console.log('📊 Инициализация отображения загруженных ставок для типа:', dbType);
    
    if (dbType) {
        uploadedRates.currentDataType = dbType;
        // Устанавливаем фильтр типа данных
        uploadedRates.filters.dataType = dbType;
    }
    
    // Добавляем обработчики событий
    const refreshBtn = document.getElementById('refresh-rates');
    const filterBtn = document.getElementById('apply-filters');
    const resetBtn = document.getElementById('reset-filters');
    const searchFilter = document.getElementById('search-filter');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            loadLatestRates(uploadedRates.currentDataType); // Загружаем последние ставки
        });
    }
    
    if (filterBtn) {
        filterBtn.addEventListener('click', applyFilters);
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', resetFilters);
    }
    
    if (searchFilter) {
        searchFilter.addEventListener('input', function() {
            uploadedRates.filters.searchText = this.value.trim().toLowerCase();
            // Автоматически применяем фильтры при вводе текста (с задержкой для производительности)
            clearTimeout(uploadedRates.searchTimeout);
            uploadedRates.searchTimeout = setTimeout(() => {
                applyFilters();
            }, 300);
        });
    }
    
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', goToPrevPage);
    }
    
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', goToNextPage);
    }
    
    // Загружаем последние ставки для текущего типа
    loadLatestRates(uploadedRates.currentDataType);
}

// Загрузка последних загруженных ставок для указанного типа данных
async function loadLatestRates(dataType) {
    console.log(`📥 Загрузка последних ставок для типа: ${dataType}`);
    
    try {
        // Получаем токен авторизации
        const token = localStorage.getItem('auth_token');
        
        // 1. Получаем последнюю загрузку для данного типа
        const historyResponse = await fetch(`/api/upload-history?dataType=${dataType}&limit=1&page=1`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!historyResponse.ok) {
            throw new Error(`HTTP error! status: ${historyResponse.status}`);
        }
        
        const historyResult = await historyResponse.json();
        console.log('📦 Результат загрузки истории:', historyResult);
        
        if (!historyResult.success || !historyResult.data || historyResult.data.length === 0) {
            // Нет загрузок для этого типа
            uploadedRates.data = [];
            uploadedRates.filteredData = [];
            uploadedRates.currentPage = 1;
            uploadedRates.totalPages = 1;
            displayRatesTable();
            Utils.showStatus(`Нет загруженных ставок для типа "${dataType}"`, 'info');
            return;
        }
        
        const latestUpload = historyResult.data[0];
        console.log(`📦 Последняя загрузка: ID ${latestUpload.id}, записей: ${latestUpload.recordCount}`);
        
        // 2. Получаем полные данные этой загрузки
        const fullDataResponse = await fetch(`/api/upload-history/${latestUpload.id}/full-data`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!fullDataResponse.ok) {
            throw new Error(`HTTP error! status: ${fullDataResponse.status}`);
        }
        
        const fullDataResult = await fullDataResponse.json();
        console.log('📦 Результат загрузки полных данных:', fullDataResult);
        
        if (fullDataResult.success && fullDataResult.data && fullDataResult.data.fullData) {
            uploadedRates.data = fullDataResult.data.fullData || [];
            console.log(`✅ Загружено ${uploadedRates.data.length} записей ставок для типа ${dataType}`);
            
            // Сбрасываем фильтры и пагинацию
            uploadedRates.filteredData = [...uploadedRates.data];
            uploadedRates.currentPage = 1;
            uploadedRates.totalPages = Math.ceil(uploadedRates.data.length / uploadedRates.pageSize);
            
            // Отображаем данные
            displayRatesTable();
            updatePagination();
            
            // Показываем уведомление
            Utils.showStatus(`Загружено ${uploadedRates.data.length} последних ставок для ${dataType}`, 'success');
        } else {
            throw new Error('Не удалось получить полные данные загрузки');
        }
        
    } catch (error) {
        console.error('❌ Ошибка загрузки последних ставок:', error);
        Utils.showStatus(`Ошибка загрузки ставок: ${error.message}`, 'error');
        
        // Показываем сообщение об ошибке в таблице
        const tableContainer = document.getElementById('rates-table-container');
        if (tableContainer) {
            tableContainer.innerHTML = `
                <div class="placeholder-text">
                    <i class="fas fa-exclamation-triangle" style="color: #dc3545; font-size: 24px; margin-bottom: 10px;"></i>
                    <p>Ошибка загрузки данных: ${error.message}</p>
                    <button onclick="loadLatestRates('${dataType}')" class="btn-small btn-primary" style="margin-top: 10px;">
                        <i class="fas fa-redo"></i> Повторить попытку
                    </button>
                </div>
            `;
        }
    }
}

// Загрузка загруженных ставок с сервера (история загрузок) - оставлена для обратной совместимости
async function loadUploadedRates() {
    console.log('📥 Загрузка загруженных ставок с сервера (история)');
    
    try {
        // Получаем токен авторизации
        const token = localStorage.getItem('auth_token');
        
        // Загружаем историю загрузок
        const response = await fetch('/api/upload-history', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('📦 Результат загрузки истории:', result);
        
        if (result.success) {
            uploadedRates.data = result.data || [];
            console.log(`✅ Загружено ${uploadedRates.data.length} записей истории загрузок`, uploadedRates.data);
            
            // Применяем фильтры и отображаем данные
            applyFilters();
            
            // Показываем уведомление
            Utils.showStatus(`Загружено ${uploadedRates.data.length} записей истории загрузок`, 'success');
        } else {
            throw new Error(result.message || 'Ошибка загрузки истории загрузок');
        }
        
    } catch (error) {
        console.error('❌ Ошибка загрузки загруженных ставок:', error);
        Utils.showStatus(`Ошибка загрузки истории: ${error.message}`, 'error');
        
        // Показываем сообщение об ошибке в таблице
        const tableContainer = document.getElementById('rates-table-container');
        if (tableContainer) {
            tableContainer.innerHTML = `
                <div class="placeholder-text">
                    <i class="fas fa-exclamation-triangle" style="color: #dc3545; font-size: 24px; margin-bottom: 10px;"></i>
                    <p>Ошибка загрузки данных: ${error.message}</p>
                    <button onclick="loadUploadedRates()" class="btn-small btn-primary" style="margin-top: 10px;">
                        <i class="fas fa-redo"></i> Повторить попытку
                    </button>
                </div>
            `;
        }
    }
}

// Применение фильтров к данным
function applyFilters() {
    console.log('🔍 Применение фильтров:', uploadedRates.filters);
    
    // Копируем исходные данные
    let filtered = [...uploadedRates.data];
    
    // Текстовый поиск по всем полям
    if (uploadedRates.filters.searchText) {
        const searchText = uploadedRates.filters.searchText;
        filtered = filtered.filter(item => {
            // Проверяем каждое поле объекта
            for (const key in item) {
                if (Object.prototype.hasOwnProperty.call(item, key)) {
                    const value = item[key];
                    // Приводим значение к строке и ищем совпадение (без учета регистра)
                    if (value !== null && value !== undefined) {
                        const stringValue = String(value).toLowerCase();
                        if (stringValue.includes(searchText)) {
                            return true;
                        }
                    }
                }
            }
            return false;
        });
    }
    
    uploadedRates.filteredData = filtered;
    uploadedRates.currentPage = 1;
    uploadedRates.totalPages = Math.ceil(filtered.length / uploadedRates.pageSize);
    
    console.log(`✅ Отфильтровано ${filtered.length} записей, всего страниц: ${uploadedRates.totalPages}`);
    
    // Отображаем данные
    displayRatesTable();
    updatePagination();
}

// Отображение таблицы с ставками
function displayRatesTable() {
    const tableContainer = document.getElementById('rates-table-container');
    if (!tableContainer) return;
    
    // Если нет данных
    if (uploadedRates.filteredData.length === 0) {
        tableContainer.innerHTML = `
            <div class="placeholder-text">
                <i class="fas fa-database" style="color: #6c757d; font-size: 24px; margin-bottom: 10px;"></i>
                <p>Нет данных для отображения</p>
                <p style="font-size: 14px; color: #999;">Попробуйте изменить фильтры или загрузить данные</p>
            </div>
        `;
        return;
    }
    
    // Проверяем, являются ли данные историей загрузок (есть поле dataType) или ставками
    const firstItem = uploadedRates.filteredData[0];
    const isHistory = firstItem && firstItem.dataType !== undefined;
    
    // Рассчитываем данные для текущей страницы
    const startIndex = (uploadedRates.currentPage - 1) * uploadedRates.pageSize;
    const endIndex = Math.min(startIndex + uploadedRates.pageSize, uploadedRates.filteredData.length);
    const pageData = uploadedRates.filteredData.slice(startIndex, endIndex);
    
    let tableHTML = '';
    
    if (isHistory) {
        // Формат истории загрузок
        tableHTML = `
            <table class="rates-table">
                <thead>
                    <tr>
                        <th>Тип данных</th>
                        <th>Пользователь</th>
                        <th>Кол-во записей</th>
                        <th>Дата загрузки</th>
                        <th>Предпросмотр</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        pageData.forEach(item => {
            // Форматируем дату
            const uploadDate = new Date(item.uploadedAt);
            const formattedDate = uploadDate.toLocaleDateString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            // Определяем класс бейджа в зависимости от типа данных
            let badgeClass = '';
            switch(item.dataType) {
                case 'sea':
                    badgeClass = 'badge-sea';
                    break;
                case 'rail':
                    badgeClass = 'badge-rail';
                    break;
                case 'direct_sea':
                    badgeClass = 'badge-direct-sea';
                    break;
                case 'direct_rail':
                    badgeClass = 'badge-direct-rail';
                    break;
                case 'tariff':
                    badgeClass = 'badge-tariff';
                    break;
                case 'agent_tariff':
                    badgeClass = 'badge-agent-tariff';
                    break;
                default:
                    badgeClass = 'badge-sea';
            }
            
            // Определяем отображаемое название типа данных
            let dataTypeName = '';
            switch(item.dataType) {
                case 'sea':
                    dataTypeName = 'Море';
                    break;
                case 'rail':
                    dataTypeName = 'ЖД';
                    break;
                case 'direct_sea':
                    dataTypeName = 'Прямое море';
                    break;
                case 'direct_rail':
                    dataTypeName = 'Прямое ЖД';
                    break;
                case 'tariff':
                    dataTypeName = 'Тариф';
                    break;
                case 'agent_tariff':
                    dataTypeName = 'Тариф агентов';
                    break;
                default:
                    dataTypeName = item.dataType;
            }
            
            tableHTML += `
                <tr>
                    <td>
                        <span class="rate-type-badge ${badgeClass}">${dataTypeName}</span>
                    </td>
                    <td>${item.userEmail || 'Неизвестно'}</td>
                    <td>${item.recordCount || 0}</td>
                    <td>${formattedDate}</td>
                    <td>
                        <button class="btn-small btn-outline" onclick="showRatePreview('${item.id}')" title="Показать предпросмотр">
                            <i class="fas fa-eye"></i> Просмотр
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tableHTML += `
                </tbody>
            </table>
        `;
    } else {
        // Формат ставок (данные)
        // Получаем все уникальные ключи из данных
        const keys = [];
        pageData.forEach(item => {
            Object.keys(item).forEach(key => {
                if (!keys.includes(key)) keys.push(key);
            });
        });
        
        // Если ключей много, ограничим для удобства
        const displayedKeys = keys.slice(0, 10); // максимум 10 колонок
        
        tableHTML = `
            <table class="rates-table">
                <thead>
                    <tr>
                        ${displayedKeys.map(key => `<th>${key}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
        `;
        
        pageData.forEach(item => {
            tableHTML += '<tr>';
            displayedKeys.forEach(key => {
                const value = item[key];
                // Форматируем значение
                let displayValue = value;
                if (value === null || value === undefined) {
                    displayValue = '-';
                } else if (typeof value === 'object') {
                    displayValue = JSON.stringify(value).substring(0, 50) + '...';
                } else if (typeof value === 'string' && value.length > 50) {
                    displayValue = value.substring(0, 50) + '...';
                }
                tableHTML += `<td>${displayValue}</td>`;
            });
            tableHTML += '</tr>';
        });
        
        tableHTML += `
                </tbody>
            </table>
        `;
    }
    
    tableHTML += `
        <div style="margin-top: 15px; font-size: 14px; color: #6c757d;">
            Показано ${startIndex + 1}-${endIndex} из ${uploadedRates.filteredData.length} записей
        </div>
    `;
    
    tableContainer.innerHTML = tableHTML;
}

// Обновление пагинации
function updatePagination() {
    const pageInfo = document.getElementById('page-info');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    
    if (pageInfo) {
        pageInfo.textContent = `Страница ${uploadedRates.currentPage} из ${uploadedRates.totalPages || 1}`;
    }
    
    if (prevBtn) {
        prevBtn.disabled = uploadedRates.currentPage <= 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = uploadedRates.currentPage >= uploadedRates.totalPages;
    }
}

// Переход на предыдущую страницу
function goToPrevPage() {
    if (uploadedRates.currentPage > 1) {
        uploadedRates.currentPage--;
        displayRatesTable();
        updatePagination();
    }
}

// Переход на следующую страницу
function goToNextPage() {
    if (uploadedRates.currentPage < uploadedRates.totalPages) {
        uploadedRates.currentPage++;
        displayRatesTable();
        updatePagination();
    }
}

// Показ предпросмотра конкретной загрузки
async function showRatePreview(uploadId) {
    console.log(`👁️ Показ предпросмотра загрузки ${uploadId}`);
    
    try {
        // Получаем токен авторизации
        const token = localStorage.getItem('auth_token');
        
        // Загружаем детали загрузки
        const response = await fetch(`/api/upload-history/${uploadId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.data) {
            // Отображаем предпросмотр в модальном окне
            showRatePreviewModal(result.data);
        } else {
            throw new Error(result.message || 'Нет данных для предпросмотра');
        }
        
    } catch (error) {
        console.error('❌ Ошибка загрузки предпросмотра:', error);
        Utils.showStatus(`Ошибка загрузки предпросмотра: ${error.message}`, 'error');
    }
}

// Показ модального окна с предпросмотром данных
function showRatePreviewModal(uploadData) {
    // Создаем модальное окно, если его нет
    let modal = document.getElementById('rate-preview-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'rate-preview-modal';
        modal.className = 'modal hidden';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 90%; max-height: 80%;">
                <div class="modal-header">
                    <h3>Предпросмотр загруженных данных</h3>
                    <button class="modal-close" onclick="closeRatePreviewModal()">&times;</button>
                </div>
                <div class="modal-body" id="rate-preview-content" style="overflow: auto;">
                    <!-- Контент будет загружен здесь -->
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeRatePreviewModal()">Закрыть</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    // Заполняем контент
    const content = document.getElementById('rate-preview-content');
    if (content) {
        let previewHTML = `
            <div style="margin-bottom: 20px;">
                <p><strong>Тип данных:</strong> ${uploadData.dataType || 'Не указан'}</p>
                <p><strong>Количество записей:</strong> ${uploadData.recordCount || 0}</p>
                <p><strong>Дата загрузки:</strong> ${new Date(uploadData.uploadedAt).toLocaleString('ru-RU')}</p>
                <p><strong>Пользователь:</strong> ${uploadData.userEmail || 'Неизвестно'}</p>
            </div>
        `;
        
        // Если есть данные предпросмотра
        if (uploadData.previewData && Array.isArray(uploadData.previewData)) {
            previewHTML += `<h4>Первые 10 записей:</h4>`;
            
            if (uploadData.previewData.length > 0) {
                // Создаем таблицу для предпросмотра
                previewHTML += `<table class="preview-table" style="width: 100%; border-collapse: collapse; margin-top: 10px;">`;
                
                // Заголовки
                const firstRow = uploadData.previewData[0];
                previewHTML += `<thead><tr>`;
                Object.keys(firstRow).forEach(key => {
                    previewHTML += `<th style="border: 1px solid #ddd; padding: 8px; background: #f5f5f5;">${key}</th>`;
                });
                previewHTML += `</tr></thead>`;
                
                // Данные
                previewHTML += `<tbody>`;
                uploadData.previewData.forEach(row => {
                    previewHTML += `<tr>`;
                    Object.values(row).forEach(value => {
                        previewHTML += `<td style="border: 1px solid #ddd; padding: 6px;">${value || '-'}</td>`;
                    });
                    previewHTML += `</tr>`;
                });
                previewHTML += `</tbody></table>`;
            } else {
                previewHTML += `<p style="color: #666; font-style: italic;">Нет данных для предпросмотра</p>`;
            }
        } else {
            previewHTML += `<p style="color: #666; font-style: italic;">Нет данных предпросмотра</p>`;
        }
        
        content.innerHTML = previewHTML;
    }
    
    // Показываем модальное окно
    modal.classList.remove('hidden');
}

// Закрытие модального окна предпросмотра
function closeRatePreviewModal() {
    const modal = document.getElementById('rate-preview-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Сброс фильтров
function resetFilters() {
    console.log('🔄 Сброс фильтров');
    
    // Сбрасываем только текстовый поиск, тип данных остается прежним
    uploadedRates.filters.searchText = '';
    
    // Сбрасываем значения в UI
    const searchFilter = document.getElementById('search-filter');
    
    if (searchFilter) searchFilter.value = '';
    
    // Применяем фильтры (показываем все данные)
    applyFilters();
    
    // Показываем уведомление
    Utils.showStatus('Фильтры сброшены', 'success');
}

// Экспорт функций в глобальную область видимости
window.initUploadedRates = initUploadedRates;
window.loadUploadedRates = loadUploadedRates;
window.applyFilters = applyFilters;
window.resetFilters = resetFilters;
window.displayRatesTable = displayRatesTable;
window.updatePagination = updatePagination;
window.goToPrevPage = goToPrevPage;
window.goToNextPage = goToNextPage;
window.showRatePreview = showRatePreview;
window.showRatePreviewModal = showRatePreviewModal;
window.closeRatePreviewModal = closeRatePreviewModal;