// 🎯 УЛУЧШЕННЫЙ ПОИСКОВЫЙ ДВИГ ДЛЯ МОРЯ С КАСКАДНОЙ ФИЛЬТРАЦИЕЙ
class EnhancedSeaSearchEngine {
    constructor(data) {
        this.data = data;
        this.cache = new Map();
    }

    normalizeName(name) {
        if (!name) return '';
        return name.toString()
            .toLowerCase()
            .trim()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ');
    }

    // 1. POL - список где есть ненулевые ставки
    getPOLWithRates() {
        const cacheKey = 'sea_pol_with_rates';
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const polWithRates = [...new Set(
            this.data
                .filter(item => {
                    const hasSOC20 = item.soc20 && parseFloat(item.soc20) > 0;
                    const hasSOC40 = item.soc40 && parseFloat(item.soc40) > 0;
                    const hasDC20 = item.dc20 && parseFloat(item.dc20) > 0;
                    const hasHC40 = item.hc40 && parseFloat(item.hc40) > 0;
                    
                    return hasSOC20 || hasSOC40 || hasDC20 || hasHC40;
                })
                .map(item => item.pol)
                .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b));

        this.cache.set(cacheKey, polWithRates);
        console.log('🌊 POL с ненулевыми ставками:', polWithRates.length, polWithRates);
        return polWithRates;
    }

    // 2. City - динамически фильтруется на основе выбранного POL и показывает где ставки > 0
    getCityWithRatesForPOL(selectedPOL) {
        if (!selectedPOL) return [];

        const cacheKey = `sea_city_with_rates_for_${this.normalizeName(selectedPOL)}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const normalizedPOL = this.normalizeName(selectedPOL);
        
        const cityWithRates = [...new Set(
            this.data
                .filter(item => {
                    const itemPOL = this.normalizeName(item.pol);
                    const matchesPOL = itemPOL.includes(normalizedPOL) || normalizedPOL.includes(itemPOL);
                    
                    return matchesPOL && (
                        (item.soc20 && parseFloat(item.soc20) > 0) ||
                        (item.soc40 && parseFloat(item.soc40) > 0) ||
                        (item.dc20 && parseFloat(item.dc20) > 0) ||
                        (item.hc40 && parseFloat(item.hc40) > 0)
                    );
                })
                .map(item => item.city)
                .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b));

        this.cache.set(cacheKey, cityWithRates);
        console.log(`🌊 City с ненулевыми ставками для "${selectedPOL}":`, cityWithRates.length, cityWithRates);
        return cityWithRates;
    }

    // 3. POD - динамически фильтруется на основе выбранного POL и City и показывает где ставки > 0
    getPODWithRatesForPOLAndCity(selectedPOL, selectedCity) {
        if (!selectedPOL) return [];

        const cacheKey = `sea_pod_with_rates_for_${this.normalizeName(selectedPOL)}_${this.normalizeName(selectedCity || '')}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const normalizedPOL = this.normalizeName(selectedPOL);
        const normalizedCity = selectedCity ? this.normalizeName(selectedCity) : null;
        
        const podWithRates = [...new Set(
            this.data
                .filter(item => {
                    const itemPOL = this.normalizeName(item.pol);
                    const matchesPOL = itemPOL.includes(normalizedPOL) || normalizedPOL.includes(itemPOL);
                    const matchesCity = !normalizedCity || (item.city && this.normalizeName(item.city) === normalizedCity);
                    
                    return matchesPOL && matchesCity && (
                        (item.soc20 && parseFloat(item.soc20) > 0) ||
                        (item.soc40 && parseFloat(item.soc40) > 0) ||
                        (item.dc20 && parseFloat(item.dc20) > 0) ||
                        (item.hc40 && parseFloat(item.hc40) > 0)
                    );
                })
                .map(item => item.pod)
                .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b));

        this.cache.set(cacheKey, podWithRates);
        console.log(`🌊 POD с ненулевыми ставками для "${selectedPOL}"${selectedCity ? ` и City "${selectedCity}"` : ''}:`, podWithRates.length, podWithRates);
        return podWithRates;
    }

    // Старый метод для обратной совместимости
    getPODWithRatesForPOL(selectedPOL) {
        return this.getPODWithRatesForPOLAndCity(selectedPOL, null);
    }

    // 4. DROP OFF AREA - динамически фильтруется на основе POL, City и POD (полное и частичное совпадение POD)
    getDropOffAreasWithRates(selectedPOL, selectedCity, selectedPOD) {
        if (!selectedPOL || !selectedPOD) return [];

        const cacheKey = `sea_dropoff_with_rates_${this.normalizeName(selectedPOL)}_${this.normalizeName(selectedCity || '')}_${this.normalizeName(selectedPOD)}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const normalizedPOL = this.normalizeName(selectedPOL);
        const normalizedCity = selectedCity ? this.normalizeName(selectedCity) : null;
        const normalizedPOD = this.normalizeName(selectedPOD);

        const dropOffAreasWithRates = [...new Set(
            this.data
                .filter(item => {
                    const itemPOL = this.normalizeName(item.pol);
                    const itemPOD = this.normalizeName(item.pod);
                    
                    // 🔧 ИСПРАВЛЕНИЕ: Частичные совпадения для POL и POD
                    const matchesPOL = itemPOL.includes(normalizedPOL) || normalizedPOL.includes(itemPOL);
                    const matchesPOD = itemPOD.includes(normalizedPOD) || normalizedPOD.includes(itemPOD);
                    const matchesCity = !normalizedCity || (item.city && this.normalizeName(item.city) === normalizedCity);
                    
                    return matchesPOL && matchesPOD && matchesCity && (
                        (item.soc20 && parseFloat(item.soc20) > 0) ||
                        (item.soc40 && parseFloat(item.soc40) > 0) ||
                        (item.dc20 && parseFloat(item.dc20) > 0) ||
                        (item.hc40 && parseFloat(item.hc40) > 0)
                    );
                })
                .map(item => item.dropOffArea)
                .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b));

        this.cache.set(cacheKey, dropOffAreasWithRates);
        console.log(`🌊 DROP OFF AREA с ненулевыми ставками для "${selectedPOL}${selectedCity ? ` (${selectedCity})` : ''} → ${selectedPOD}":`, dropOffAreasWithRates.length, dropOffAreasWithRates);
        return dropOffAreasWithRates;
    }

    // Старый метод для обратной совместимости
    getDropOffAreasWithRatesOld(selectedPOL, selectedPOD) {
        return this.getDropOffAreasWithRates(selectedPOL, null, selectedPOD);
    }

    // 5. ТИП КОНТЕЙНЕРА - показывается только после выбора POL + City + POD + DROP OFF AREA
    getAvailableContainersWithRates(selectedPOL, selectedCity, selectedPOD, selectedDropOffArea) {
        if (!selectedPOL || !selectedPOD || !selectedDropOffArea) {
            console.log('⚠️ Типы контейнеров: требуется POL + POD + Drop Off Area');
            return {};
        }

        const cacheKey = `sea_containers_with_rates_${this.normalizeName(selectedPOL)}_${this.normalizeName(selectedCity || '')}_${this.normalizeName(selectedPOD)}_${this.normalizeName(selectedDropOffArea)}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const normalizedPOL = this.normalizeName(selectedPOL);
        const normalizedCity = selectedCity ? this.normalizeName(selectedCity) : null;
        const normalizedPOD = this.normalizeName(selectedPOD);
        const normalizedDropOffArea = this.normalizeName(selectedDropOffArea);

        const matchingItems = this.data.filter(item =>
            this.normalizeName(item.pol) === normalizedPOL &&
            // Проверка City если указан
            (!normalizedCity || (item.city && this.normalizeName(item.city) === normalizedCity)) &&
            // Полное ИЛИ частичное совпадение POD
            (this.normalizeName(item.pod) === normalizedPOD ||
             this.normalizeName(item.pod).includes(normalizedPOD) ||
             normalizedPOD.includes(this.normalizeName(item.pod))) &&
            // Точное совпадение Drop Off Area
            this.normalizeName(item.dropOffArea) === normalizedDropOffArea &&
            // Хотя бы одна ненулевая ставка
            (
                (item.soc20 && parseFloat(item.soc20) > 0) ||
                (item.soc40 && parseFloat(item.soc40) > 0) ||
                (item.dc20 && parseFloat(item.dc20) > 0) ||
                (item.hc40 && parseFloat(item.hc40) > 0)
            )
        );

        const availableContainers = {
            'soc_20': matchingItems.some(item => item.soc20 && parseFloat(item.soc20) > 0),
            'soc_40': matchingItems.some(item => item.soc40 && parseFloat(item.soc40) > 0),
            'dc_20': matchingItems.some(item => item.dc20 && parseFloat(item.dc20) > 0),
            'hc_40': matchingItems.some(item => item.hc40 && parseFloat(item.hc40) > 0)
        };

        this.cache.set(cacheKey, availableContainers);
        console.log(`📦 Доступные контейнеры для "${selectedPOL}${selectedCity ? ` (${selectedCity})` : ''} → ${selectedPOD} → ${selectedDropOffArea}":`, availableContainers);
        return availableContainers;
    }

    // Старый метод для обратной совместимости
    getAvailableContainersWithRatesOld(selectedPOL, selectedPOD, selectedDropOffArea) {
        return this.getAvailableContainersWithRates(selectedPOL, null, selectedPOD, selectedDropOffArea);
    }

    // Получить все записи для маршрута с ненулевыми ставками (с поддержкой City)
    getRatesForRoute(selectedPOL, selectedCity, selectedPOD, selectedDropOffArea, containerType) {
        if (!selectedPOL || !selectedPOD || !selectedDropOffArea || !containerType) {
            console.log('❌ Не все параметры переданы для поиска ставок');
            return [];
        }

        const normalizedPOL = this.normalizeName(selectedPOL);
        const normalizedCity = selectedCity ? this.normalizeName(selectedCity) : null;
        const normalizedPOD = this.normalizeName(selectedPOD);
        const normalizedDropOffArea = this.normalizeName(selectedDropOffArea);

        console.log('🔍 Поиск в базе данных:', {
            normalizedPOL,
            normalizedCity,
            normalizedPOD,
            normalizedDropOffArea,
            containerType,
            totalRecords: this.data.length
        });

        const results = this.data.filter(item => {
            const matchesPOL = this.normalizeName(item.pol) === normalizedPOL;
            const matchesCity = !normalizedCity || (item.city && this.normalizeName(item.city) === normalizedCity);
            const matchesPOD = this.normalizeName(item.pod) === normalizedPOD ||
                              this.normalizeName(item.pod).includes(normalizedPOD) ||
                              normalizedPOD.includes(this.normalizeName(item.pod));
            const matchesDropOff = this.normalizeName(item.dropOffArea) === normalizedDropOffArea;
            const hasRate = this.hasContainerRate(item, containerType);

            if (matchesPOL && matchesCity && matchesPOD && matchesDropOff && hasRate) {
                console.log('✅ Найдена подходящая запись:', item);
            }

            return matchesPOL && matchesCity && matchesPOD && matchesDropOff && hasRate;
        });

        console.log(`📊 Итоговые результаты поиска: ${results.length} записей`);
        return results;
    }

    // Старый метод для обратной совместимости
    getRatesForRouteOld(selectedPOL, selectedPOD, selectedDropOffArea, containerType) {
        return this.getRatesForRoute(selectedPOL, null, selectedPOD, selectedDropOffArea, containerType);
    }

    hasContainerRate(item, containerType) {
        switch (containerType) {
            case 'soc_20':
                return item.soc20 && parseFloat(item.soc20) > 0;
            case 'soc_40':
                return item.soc40 && parseFloat(item.soc40) > 0;
            case 'dc_20':
                return item.dc20 && parseFloat(item.dc20) > 0;
            case 'hc_40':
                return item.hc40 && parseFloat(item.hc40) > 0;
            default:
                return false;
        }
    }

    clearCache() {
        this.cache.clear();
    }
}

// 🚀 ФУНКЦИЯ ДЛЯ НАСТРОЙКИ ЦЕПНОГО ОБНОВЛЕНИЯ ДЛЯ МОРЯ
function setupEnhancedSeaChainUpdate(data) {
    function resolveElement(primaryId, fallbackIds = []) {
        const primary = document.getElementById(primaryId);
        if (primary) return { el: primary, id: primaryId };
        for (const fallbackId of fallbackIds) {
            const fallback = document.getElementById(fallbackId);
            if (fallback) return { el: fallback, id: fallbackId };
        }
        return { el: null, id: primaryId };
    }

    const polResolved = resolveElement('sea-pol', ['pol']);
    const cityResolved = resolveElement('sea-city', ['city']);
    const podResolved = resolveElement('sea-pod', ['pod']);
    const dropOffResolved = resolveElement('sea-drop-off-area', ['drop-off-area']);
    const containerResolved = resolveElement('sea-container-type', ['container-type']);

    const polInput = polResolved.el;
    const cityInput = cityResolved.el;
    const podInput = podResolved.el;
    const dropOffAreaInput = dropOffResolved.el;
    const containerTypeSelect = containerResolved.el;

    const hasCityField = Boolean(cityInput);

    if (!polInput || !podInput || !dropOffAreaInput || !containerTypeSelect) {
        console.error('❌ Не найдены необходимые элементы DOM для морского модуля');
        return;
    }
    if (!hasCityField) {
        console.warn('⚠️ Поле "Город" не найдено. Морская фильтрация будет работать без города.');
    }
    
    console.log('🔧 Инициализация улучшенного цепного обновления для моря с каскадной фильтрацией (с полем Город)');
    
    // Инициализируем улучшенный поисковый движок
    const enhancedSeaSearchEngine = new EnhancedSeaSearchEngine(data);
    
    // 🔧 ДОБАВЛЯЕМ ФЛАГИ ДЛЯ УПРАВЛЕНИЯ СОСТОЯНИЕМ
    let isUpdatingInterface = false;
    let currentFocusedElement = null;
    const isActive = () => window.currentDatabase === 'sea';
    
    // 🔧 ВЫНЕСИТЕ ФУНКЦИЮ setupCustomDropdown ЗДЕСЬ
    function setupCustomDropdown(inputId, values, preserveFocus = false) {
        if (window.Utils && window.Utils.setupCustomDropdown) {
            const currentElement = document.getElementById(inputId);
            const wasFocused = document.activeElement === currentElement;
            
            window.Utils.setupCustomDropdown(inputId, values);
            
            // 🔧 ВОССТАНАВЛИВАЕМ ФОКУС ЕСЛИ НУЖНО
            if (preserveFocus && wasFocused) {
                const newElement = document.getElementById(inputId);
                if (newElement) {
                    setTimeout(() => newElement.focus(), 10);
                }
            }
        } else {
            console.error('❌ Utils.setupCustomDropdown не доступен');
        }
    }
    
    // Функция для обновления интерфейса
    function updateInterface(skipFields = []) {
        if (!isActive()) return;
        if (isUpdatingInterface) return;
        
        isUpdatingInterface = true;
        currentFocusedElement = document.activeElement;
        
        const selectedPOL = polInput.value.trim();
        const selectedCity = hasCityField ? cityInput.value.trim() : '';
        const selectedPOD = podInput.value.trim();
        const selectedDropOffArea = dropOffAreaInput.value.trim();
        
        console.log('🔄 Обновление интерфейса моря:', {
            POL: selectedPOL,
            City: selectedCity,
            POD: selectedPOD,
            DropOffArea: selectedDropOffArea,
            skipFields: skipFields
        });
        
        try {
            // 1. POL - всегда показываем где есть ненулевые ставки
            const availablePOL = enhancedSeaSearchEngine.getPOLWithRates();
            
            // 🔧 ОБНОВЛЯЕМ POL ТОЛЬКО ЕСЛИ НЕ В SKIP FIELDS
            if (!skipFields.includes('pol')) {
                setupCustomDropdown(polResolved.id, availablePOL, currentFocusedElement === polInput);
            }
            
            // 2. CITY - динамически фильтруется на основе выбранного POL
            let availableCities = [];
            if (selectedPOL) {
                availableCities = enhancedSeaSearchEngine.getCityWithRatesForPOL(selectedPOL);
            }
            
            // 🔧 ОБНОВЛЯЕМ CITY ТОЛЬКО ЕСЛИ НЕ В SKIP FIELDS
            if (hasCityField && !skipFields.includes('city')) {
                setupCustomDropdown(cityResolved.id, availableCities, currentFocusedElement === cityInput);
            }
            
            // 3. POD - динамически фильтруется на основе выбранного POL и City
            let availablePOD = [];
            if (selectedPOL) {
                availablePOD = enhancedSeaSearchEngine.getPODWithRatesForPOLAndCity(selectedPOL, selectedCity);
            }
            
            // 🔧 ОБНОВЛЯЕМ POD ТОЛЬКО ЕСЛИ НЕ В SKIP FIELDS
            if (!skipFields.includes('pod')) {
                setupCustomDropdown(podResolved.id, availablePOD, currentFocusedElement === podInput);
            }
            
            // 4. DROP OFF AREA - динамически фильтруется на основе POL, City и POD
            let availableDropOffAreas = [];
            if (selectedPOL && selectedPOD) {
                availableDropOffAreas = enhancedSeaSearchEngine.getDropOffAreasWithRates(selectedPOL, selectedCity, selectedPOD);
            }
            
            // 🔧 ОБНОВЛЯЕМ DROP OFF AREA ТОЛЬКО ЕСЛИ НЕ В SKIP FIELDS
            if (!skipFields.includes('drop-off-area')) {
                setupCustomDropdown(dropOffResolved.id, availableDropOffAreas, currentFocusedElement === dropOffAreaInput);
            }
            
            // 5. ТИП КОНТЕЙНЕРА - показывается ТОЛЬКО после выбора POL + POD + DROP OFF AREA
            if (selectedPOL && selectedPOD && selectedDropOffArea) {
                const availableContainers = enhancedSeaSearchEngine.getAvailableContainersWithRates(
                    selectedPOL, selectedCity, selectedPOD, selectedDropOffArea
                );
                updateContainerTypeDropdown(containerTypeSelect, availableContainers);
            } else {
                // Сбрасываем контейнеры если не все обязательные поля заполнены
                resetContainerTypeDropdown(containerTypeSelect, selectedPOL, selectedPOD, selectedDropOffArea);
            }
            
            // Очищаем зависимые поля если значения стали недоступны
            cleanupDependentFields(selectedPOL, selectedCity, selectedPOD, selectedDropOffArea, availablePOL, availableCities, availablePOD, availableDropOffAreas);
            
        } catch (error) {
            console.error('❌ Ошибка при обновлении интерфейса моря:', error);
        } finally {
            isUpdatingInterface = false;
        }
    }
    
    // Функция для обновления dropdown типов контейнеров
    function updateContainerTypeDropdown(selectElement, availableContainers) {
        if (!selectElement) return;
        
        selectElement.innerHTML = '<option value="">Выберите тип контейнера</option>';
        
        let hasAvailableContainers = false;
        
        if (availableContainers['soc_20']) {
            const option = document.createElement('option');
            option.value = 'soc_20';
            option.textContent = 'SOC 20\'';
            selectElement.appendChild(option);
            hasAvailableContainers = true;
        }
        
        if (availableContainers['soc_40']) {
            const option = document.createElement('option');
            option.value = 'soc_40';
            option.textContent = 'SOC 40\'';
            selectElement.appendChild(option);
            hasAvailableContainers = true;
        }
        
        if (availableContainers['dc_20']) {
            const option = document.createElement('option');
            option.value = 'dc_20';
            option.textContent = '20\'DC FILO';
            selectElement.appendChild(option);
            hasAvailableContainers = true;
        }
        
        if (availableContainers['hc_40']) {
            const option = document.createElement('option');
            option.value = 'hc_40';
            option.textContent = '40\'HC FILO';
            selectElement.appendChild(option);
            hasAvailableContainers = true;
        }
        
        if (hasAvailableContainers) {
            selectElement.disabled = false;
            console.log('✅ Типы контейнеров доступны для выбора');
        } else {
            selectElement.innerHTML = '<option value="">Нет доступных контейнеров для выбранного маршрута</option>';
            selectElement.disabled = true;
            console.log('⚠️ Нет доступных типов контейнеров для выбранного маршрута');
        }
    }
    
    // Функция для сброса dropdown типов контейнеров
    function resetContainerTypeDropdown(selectElement, pol, pod, dropOffArea) {
        if (!selectElement) return;
        
        if (!pol) {
            selectElement.innerHTML = '<option value="">Сначала выберите POL</option>';
        } else if (!pod) {
            selectElement.innerHTML = '<option value="">Сначала выберите POD</option>';
        } else if (!dropOffArea) {
            selectElement.innerHTML = '<option value="">Сначала выберите Drop Off Area</option>';
        } else {
            selectElement.innerHTML = '<option value="">Загрузка...</option>';
        }
        
        selectElement.disabled = false;
    }
    
    // Функция для очистки зависимых полей
    function cleanupDependentFields(selectedPOL, selectedCity, selectedPOD, selectedDropOffArea, availablePOL, availableCities, availablePOD, availableDropOffAreas) {
        let needsUpdate = false;
        
        // 🔧 ИСПРАВЛЕНИЕ: Не очищаем POL при вводе, только при реальном изменении
        // Проверяем POL только если он был выбран из dropdown (полное совпадение)
        if (selectedPOL && selectedPOL.length > 1 && !availablePOL.includes(selectedPOL)) {
            // Проверяем, является ли введенное значение началом какого-то из доступных вариантов
            const isPartialMatch = availablePOL.some(pol =>
                pol.toLowerCase().startsWith(selectedPOL.toLowerCase())
            );
            
            if (!isPartialMatch) {
                console.log(`⚠️ POL "${selectedPOL}" больше не доступен, очищаем цепочку`);
                polInput.value = '';
                if (hasCityField) {
                    cityInput.value = '';
                }
                podInput.value = '';
                dropOffAreaInput.value = '';
                containerTypeSelect.value = '';
                needsUpdate = true;
            }
        }
        
        // Проверяем City только если он был выбран из dropdown
        if (hasCityField && selectedCity && selectedPOL && selectedCity.length > 1 && !availableCities.includes(selectedCity)) {
            const isPartialMatch = availableCities.some(city =>
                city.toLowerCase().startsWith(selectedCity.toLowerCase())
            );
            
            if (!isPartialMatch) {
                console.log(`⚠️ City "${selectedCity}" больше не доступен для POL "${selectedPOL}", очищаем зависимые поля`);
                cityInput.value = '';
                podInput.value = '';
                dropOffAreaInput.value = '';
                containerTypeSelect.value = '';
                needsUpdate = true;
            }
        }
        
        // Проверяем POD только если он был выбран из dropdown
        if (selectedPOD && selectedPOL && selectedPOD.length > 1 && !availablePOD.includes(selectedPOD)) {
            const isPartialMatch = availablePOD.some(pod =>
                pod.toLowerCase().startsWith(selectedPOD.toLowerCase())
            );
            
            if (!isPartialMatch) {
                console.log(`⚠️ POD "${selectedPOD}" больше не доступен для POL "${selectedPOL}"${selectedCity ? ` и City "${selectedCity}"` : ''}, очищаем зависимые поля`);
                podInput.value = '';
                dropOffAreaInput.value = '';
                containerTypeSelect.value = '';
                needsUpdate = true;
            }
        }
        
        // Проверяем Drop Off Area только если он был выбран из dropdown
        if (selectedDropOffArea && selectedPOL && selectedPOD && selectedDropOffArea.length > 1 && !availableDropOffAreas.includes(selectedDropOffArea)) {
            const isPartialMatch = availableDropOffAreas.some(area =>
                area.toLowerCase().startsWith(selectedDropOffArea.toLowerCase())
            );
            
            if (!isPartialMatch) {
                console.log(`⚠️ Drop Off Area "${selectedDropOffArea}" больше не доступен для "${selectedPOL}${selectedCity ? ` (${selectedCity})` : ''} → ${selectedPOD}", очищаем контейнер`);
                dropOffAreaInput.value = '';
                containerTypeSelect.value = '';
                needsUpdate = true;
            }
        }
        
        // Если были изменения, обновляем интерфейс
        if (needsUpdate) {
            setTimeout(() => updateInterface(), 0);
        }
    }
    
    // 🔧 УЛУЧШЕННЫЕ ОБРАБОТЧИКИ СОБЫТИЙ
    polInput.addEventListener('input', function() {
        if (!isActive()) return;
        console.log('📝 Ввод в POL:', this.value);
        // 🔧 ОБНОВЛЯЕМ ТОЛЬКО CITY, POD И ДАЛЬНЕЙШИЕ ПОЛЯ, НЕ ПЕРЕСОЗДАЕМ POL DROPDOWN
        updateInterface(['pol']);
    });
    
    polInput.addEventListener('change', function() {
        if (!isActive()) return;
        console.log('✅ Изменение POL:', this.value);
        // При изменении POL очищаем всю цепочку
        if (hasCityField) {
            cityInput.value = '';
        }
        podInput.value = '';
        dropOffAreaInput.value = '';
        containerTypeSelect.value = '';
        // 🔧 ОБНОВЛЯЕМ ВСЕ ПОЛЯ КРОМЕ POL
        updateInterface(['pol']);
    });
    
    if (hasCityField) {
        cityInput.addEventListener('input', function() {
            if (!isActive()) return;
            console.log('📝 Ввод в City:', this.value);
            // 🔧 ОБНОВЛЯЕМ ТОЛЬКО POD И ДАЛЬНЕЙШИЕ ПОЛЯ
            updateInterface(['pol', 'city']);
        });
        
        cityInput.addEventListener('change', function() {
            if (!isActive()) return;
            console.log('✅ Изменение City:', this.value);
            // При изменении City очищаем POD, Drop Off Area и контейнер
            podInput.value = '';
            dropOffAreaInput.value = '';
            containerTypeSelect.value = '';
            // 🔧 ОБНОВЛЯЕМ ВСЕ ПОЛЯ КРОМЕ POL И CITY
            updateInterface(['pol', 'city']);
        });
    }
    
    podInput.addEventListener('input', function() {
        if (!isActive()) return;
        console.log('📝 Ввод в POD:', this.value);
        // 🔧 ОБНОВЛЯЕМ ТОЛЬКО DROP OFF AREA И ДАЛЬНЕЙШИЕ ПОЛЯ
        updateInterface(['pol', 'city', 'pod']);
    });
    
    podInput.addEventListener('change', function() {
        if (!isActive()) return;
        console.log('✅ Изменение POD:', this.value);
        // При изменении POD очищаем Drop Off Area и контейнер
        dropOffAreaInput.value = '';
        containerTypeSelect.value = '';
        // 🔧 ОБНОВЛЯЕМ ВСЕ ПОЛЯ КРОМЕ POL, CITY И POD
        updateInterface(['pol', 'city', 'pod']);
    });
    
    dropOffAreaInput.addEventListener('input', function() {
        if (!isActive()) return;
        console.log('📝 Ввод в Drop Off Area:', this.value);
        // 🔧 ОБНОВЛЯЕМ ТОЛЬКО КОНТЕЙНЕР
        updateInterface(['pol', 'city', 'pod', 'drop-off-area']);
    });
    
    dropOffAreaInput.addEventListener('change', function() {
        if (!isActive()) return;
        console.log('✅ Изменение Drop Off Area:', this.value);
        // При изменении Drop Off Area очищаем контейнер
        containerTypeSelect.value = '';
        // 🔧 ОБНОВЛЯЕМ ТОЛЬКО КОНТЕЙНЕР
        updateInterface(['pol', 'city', 'pod', 'drop-off-area']);
    });
    
    // Обработчик для контейнера
    containerTypeSelect.addEventListener('change', function() {
        if (!isActive()) return;
        console.log('✅ Изменение типа контейнера:', this.value);
        
        if (this.value) {
            const selectedPOL = polInput.value.trim();
            const selectedCity = hasCityField ? cityInput.value.trim() : '';
            const selectedPOD = podInput.value.trim();
            const selectedDropOffArea = dropOffAreaInput.value.trim();
            const selectedContainer = this.value;
            
            console.log('🎯 Поиск ставок для:', {
                POL: selectedPOL,
                City: selectedCity,
                POD: selectedPOD,
                DropOffArea: selectedDropOffArea,
                Container: selectedContainer
            });
            
            // Вызов функции поиска ставок
            const result = searchSeaRates(selectedPOL, selectedCity, selectedPOD, selectedDropOffArea, selectedContainer);
            console.log('📊 Результат поиска:', result);
            
            if (result.success) {
                displaySeaRates(result.data, selectedContainer);
            } else {
                console.error('❌ Ошибка поиска ставок:', result.error);
                // Показываем сообщение об ошибке
                const table = document.getElementById('rates-table');
                const resultsSection = document.getElementById('results');
                if (table && resultsSection) {
                    table.innerHTML = `<p style="color: red; text-align: center;">${result.error}</p>`;
                    resultsSection.classList.remove('hidden');
                }
            }
        }
    });
    
    // Инициализируем интерфейс
    updateInterface();
    console.log('✅ Морской модуль с каскадной фильтрацией инициализирован');
}

// 🎯 ФУНКЦИЯ ДЛЯ ПОИСКА СТАВОК ДЛЯ МОРЯ (с поддержкой города)
function searchSeaRates(pol, city, pod, dropOffArea, containerType) {
    console.log('🔍 Поиск ставок с параметрами:', { pol, city, pod, dropOffArea, containerType });
    
    // 🔧 ИСПОЛЬЗУЕМ ГЛОБАЛЬНУЮ БАЗУ ДАННЫХ
    const data = window.database ? window.database.sea : [];
    
    console.log('📊 Проверка данных:', {
        hasWindowDatabase: !!window.database,
        hasSeaData: data && data.length > 0,
        dataLength: data ? data.length : 0,
        dataSample: data ? data.slice(0, 2) : 'нет данных'
    });
    
    if (!data || data.length === 0) {
        console.error('❌ База данных моря пуста. Проверьте загрузку данных.');
        
        // 🔧 ПОПРОБУЕМ ЗАГРУЗИТЬ ИЗ LOCALSTORAGE НАПРЯМУЮ
        const savedData = localStorage.getItem('logistics_db_sea');
        if (savedData) {
            try {
                const parsedData = JSON.parse(savedData);
                console.log('✅ Данные найдены в localStorage:', parsedData.length);
                window.database = window.database || {};
                window.database.sea = parsedData;
                
                // Повторяем поиск с загруженными данными
                const searchEngine = new EnhancedSeaSearchEngine(parsedData);
                const rates = searchEngine.getRatesForRoute(pol, city, pod, dropOffArea, containerType);
                
                if (rates.length === 0) {
                    return { error: 'Ставки не найдены для выбранного маршрута' };
                }
                
                return { success: true, data: rates };
            } catch (error) {
                console.error('❌ Ошибка парсинга данных из localStorage:', error);
            }
        }
        
        return { error: 'База данных моря пуста. Сначала загрузите данные через интерфейс закупщика.' };
    }
    
    console.log(`📊 Всего записей в базе: ${data.length}`);
    
    const searchEngine = new EnhancedSeaSearchEngine(data);
    const rates = searchEngine.getRatesForRoute(pol, city, pod, dropOffArea, containerType);
    
    console.log(`📈 Найдено ставок: ${rates.length}`, rates);
    
    if (rates.length === 0) {
        console.warn('⚠️ Ставки не найдены для выбранного маршрута');
        return { error: 'Ставки не найдены для выбранного маршрута' };
    }
    
    return { success: true, data: rates };
}

// 🔧 ФУНКЦИЯ ДЛЯ КОНВЕРТАЦИИ ДАТЫ ИЗ EXCEL ФОРМАТА
function convertExcelDate(excelDate) {
    if (!excelDate) return '-';
    
    // Если это уже строка (текстовая дата), возвращаем как есть
    if (typeof excelDate === 'string') {
        return excelDate;
    }
    
    // Если это число (Excel дата), конвертируем
    if (typeof excelDate === 'number' && excelDate > 0) {
        try {
            const excelEpoch = new Date(1900, 0, 1);
            // Excel имеет баг с 1900 годом (считает его високосным), поэтому корректируем
            const date = new Date(excelEpoch.getTime() + (excelDate - 2) * 24 * 60 * 60 * 1000);
            return date.toLocaleDateString('ru-RU');
        } catch (error) {
            console.error('Ошибка конвертации даты:', error);
            return excelDate.toString();
        }
    }
    
    return excelDate.toString();
}

// 🔧 ФУНКЦИЯ ДЛЯ ПРОВЕРКИ И ОБРАБОТКИ ССЫЛОК
function processLink(text) {
    if (!text) return '-';
    
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const hasUrl = urlRegex.test(text);
    
    if (hasUrl) {
        return text.replace(urlRegex, '<a href="$1" target="_blank" style="color: #0066cc; text-decoration: underline;">$1</a>');
    }
    
    return text;
}

// 🎯 ФУНКЦИЯ ДЛЯ ОТОБРАЖЕНИЯ СТАВОК МОРЯ (с поддержкой города)
function displaySeaRates(rates, containerType) {
    console.log('🔄 Отображение ставок:', { ratesCount: rates.length, containerType });
    
    const table = document.getElementById('rates-table');
    const resultsSection = document.getElementById('results');
    
    if (!table || !resultsSection) {
        console.error('❌ Не найдены элементы для отображения результатов');
        return;
    }
    
    console.log('✅ Элементы для отображения найдены');
    
    // 🔧 СОРТИРОВКА ПО СТАВКАМ ОТ МЕНЬШЕГО К БОЛЬШЕМУ
    const sortedRates = [...rates].sort((a, b) => {
        const rateA = getRateValueByContainerType(a, containerType) || 0;
        const rateB = getRateValueByContainerType(b, containerType) || 0;
        return rateA - rateB;
    });
    
    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>POL</th>
                    <th>Город</th>
                    <th>POD</th>
                    <th>DROP OFF AREA</th>
                    <th>${getContainerTypeDisplayName(containerType)}</th>
                    <th>Линия</th>
                    <th>Агент</th>
                    <th>Дата действия</th>
                    <th>ETD</th>
                    <th>Примечания</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    sortedRates.forEach(rate => {
        const rateValue = getRateValueByContainerType(rate, containerType);
        const dateOfValidity = convertExcelDate(rate.dateOfValidity);
        const etd = processLink(convertExcelDate(rate.etd));
        const remarks = rate.remarks || '-';
        
        tableHTML += `
            <tr>
                <td>${rate.pol || '-'}</td>
                <td>${rate.city || '-'}</td>
                <td>${rate.pod || '-'}</td>
                <td>${rate.dropOffArea || '-'}</td>
                <td>$${rateValue || 0}</td>
                <td>${rate.carrier || '-'}</td>
                <td>${rate.agent || '-'}</td>
                <td>${dateOfValidity}</td>
                <td>${etd}</td>
                <td>${remarks}</td>
            </tr>
        `;
    });
    
    tableHTML += `
            </tbody>
        </table>
        <p style="margin-top: 10px; color: #666; font-size: 14px;">
            📊 Найдено ${sortedRates.length} ставок, отсортировано по возрастанию цены
        </p>
    `;
    
    table.innerHTML = tableHTML;
    resultsSection.classList.remove('hidden');
    console.log(`✅ Отображено ${sortedRates.length} ставок для типа контейнера: ${containerType}`);
}

// Вспомогательные функции
function getContainerTypeDisplayName(containerType) {
    switch (containerType) {
        case 'soc_20': return 'SOC 20\'';
        case 'soc_40': return 'SOC 40\'';
        case 'dc_20': return '20\'DC FILO';
        case 'hc_40': return '40\'HC FILO';
        default: return containerType;
    }
}

function getRateValueByContainerType(rate, containerType) {
    switch (containerType) {
        case 'soc_20': return rate.soc20;
        case 'soc_40': return rate.soc40;
        case 'dc_20': return rate.dc20;
        case 'hc_40': return rate.hc40;
        default: return 0;
    }
}

// 🔧 ФУНКЦИЯ ДЛЯ НАСТРОЙКИ КАСТОМНЫХ DROPDOWN
function setupCustomDropdown(inputId, values) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(`${inputId}-dropdown`);
    
    if (!input || !dropdown) {
        console.warn(`❌ Элементы для ${inputId} не найдены`);
        return;
    }
    
    // Очищаем только dropdown
    dropdown.innerHTML = '';
    
    const normalizedValues = [...new Set(values)].sort((a, b) => a.localeCompare(b));
    
    function showDropdown() {
        dropdown.innerHTML = '';
        const searchTerm = input.value.toLowerCase();
        
        const filtered = normalizedValues.filter(value => 
            value.toLowerCase().includes(searchTerm)
        );
        
        filtered.forEach(value => {
            const div = document.createElement('div');
            div.className = 'custom-dropdown-item';
            div.textContent = value;
            div.addEventListener('click', () => {
                input.value = value;
                dropdown.classList.remove('active');
                // Триггерим событие change для цепного обновления
                const changeEvent = new Event('change', { bubbles: true });
                input.dispatchEvent(changeEvent);
            });
            dropdown.appendChild(div);
        });
        
        if (filtered.length > 0) {
            dropdown.classList.add('active');
        } else {
            dropdown.classList.remove('active');
        }
    }
    
    // Удаляем старые обработчики
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    
    // Обновляем ссылки
    const currentInput = document.getElementById(inputId);
    const currentDropdown = document.getElementById(`${inputId}-dropdown`);
    
    // Простые обработчики
    currentInput.addEventListener('focus', showDropdown);
    currentInput.addEventListener('input', showDropdown);
    
    currentInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            currentDropdown.classList.remove('active');
        }
    });
    
    // Закрытие при клике вне
    document.addEventListener('click', (e) => {
        if (!currentInput.contains(e.target) && !currentDropdown.contains(e.target)) {
            currentDropdown.classList.remove('active');
        }
    });
    
    // Показываем dropdown если есть значения
    if (normalizedValues.length > 0) {
        showDropdown();
    }
}

// 🔧 ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ПОКАЗА СТАТУСА
function showStatus(message, type = '') {
    const statusElement = document.getElementById('upload-status');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = 'status-message';
        if (type) {
            statusElement.classList.add(type);
        }
    }
    console.log(`📢 ${message}`);
}

// Экспортируем функции для использования в основном файле
window.SeaModule = {
    setupEnhancedSeaChainUpdate,
    searchSeaRates,
    displaySeaRates,
    EnhancedSeaSearchEngine,
    convertExcelDate,
    processLink
};

console.log('✅ Морской модуль с каскадной фильтрацией загружен и готов к работе');
