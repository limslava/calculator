// 🚂 МОДУЛЬ ДЛЯ ЖЕЛЕЗНОДОРОЖНЫХ ПЕРЕВОЗОК

const RailModule = {
    
    // 🎯 НАСТРОЙКА ЦЕПОЧКИ ОБНОВЛЕНИЯ ДЛЯ ЖД ПЕРЕВОЗОК
    setupEnhancedRailChainUpdate: function(data) {
        console.log('🚂 Настройка цепочки обновления для ЖД перевозок');
        
        const cityInput = document.getElementById('rail-city');
        const destinationInput = document.getElementById('rail-destination');
        
        if (!cityInput || !destinationInput) {
            console.error('❌ Не найдены поля для ЖД перевозок');
            return;
        }
        
        // Очищаем предыдущие обработчики
        cityInput.removeEventListener('input', this.handleCityInput);
        destinationInput.removeEventListener('input', this.handleDestinationInput);
        
        // Сохраняем данные для использования в обработчиках
        this.railData = data;
        
        // Привязываем контекст
        this.handleCityInput = this.handleCityInput.bind(this);
        this.handleDestinationInput = this.handleDestinationInput.bind(this);
        
        // Добавляем обработчики
        cityInput.addEventListener('input', this.handleCityInput);
        destinationInput.addEventListener('input', this.handleDestinationInput);
        
        // Добавляем обработчик для типа контейнера (как в sea.js)
        const containerTypeSelect = document.getElementById('rail-container-type');
        if (containerTypeSelect) {
            containerTypeSelect.addEventListener('change', () => {
                console.log('✅ Изменение типа контейнера ЖД:', containerTypeSelect.value);
                
                if (containerTypeSelect.value) {
                    const city = document.getElementById('rail-city').value.trim();
                    const destination = document.getElementById('rail-destination').value.trim();
                    const containerType = containerTypeSelect.value;
                    
                    console.log('🎯 Поиск ставок ЖД для:', {
                        city: city,
                        destination: destination,
                        containerType: containerType
                    });
                    
                    // Автоматический поиск ставок
                    const filteredData = this.findRailRates(city, destination, containerType);
                    
                    if (filteredData.length > 0) {
                        this.displayRailResults(filteredData, containerType);
                    } else {
                        console.error('❌ Ставки не найдены для выбранных параметров');
                        const table = document.getElementById('rates-table');
                        const resultsSection = document.getElementById('results');
                        if (table && resultsSection) {
                            table.innerHTML = '<p style="color: red; text-align: center;">Ставки не найдены для выбранных параметров</p>';
                            resultsSection.classList.remove('hidden');
                        }
                    }
                }
            });
        }
        
        // Инициализируем автозаполнение для городов
        this.updateCityDropdown(data);
    },
    
    // 🎯 ОБРАБОТКА ВВОДА ГОРОДА
    handleCityInput: function(e) {
        const city = e.target.value.toLowerCase();
        const data = this.railData;
        
        if (!data || data.length === 0) return;
        
        // Фильтруем города по введенному тексту и ставке ≠ 0
        const filteredCities = [...new Set(data
            .filter(item => {
                // Проверяем, что есть хотя бы одна ненулевая ставка
                const hasRate = (item.container20Under24 && parseFloat(item.container20Under24) > 0) ||
                               (item.container20Over24 && parseFloat(item.container20Over24) > 0) ||
                               (item.container40 && parseFloat(item.container40) > 0);
                return item.city && item.city.toLowerCase().includes(city) && hasRate;
            })
            .map(item => item.city))
        ].sort((a, b) => a.localeCompare(b));
        
        // Обновляем выпадающий список городов
        this.updateCityDropdown(filteredCities);
        
        // Если город выбран, обновляем список пунктов назначения
        if (filteredCities.length === 1 && filteredCities[0].toLowerCase() === city) {
            this.updateDestinationDropdownForCity(filteredCities[0]);
        }
        
        // Очищаем зависимые поля
        document.getElementById('rail-destination').value = '';
        document.getElementById('rail-container-type').value = '';
        this.updateDestinationDropdown([]);
        
    },
    
    // 🎯 ОБРАБОТКА ВВОДА ПУНКТА НАЗНАЧЕНИЯ
    handleDestinationInput: function(e) {
        const destination = e.target.value.toLowerCase();
        const city = document.getElementById('rail-city').value;
        const data = this.railData;
        
        if (!data || data.length === 0 || !city) return;
        
        // Фильтруем пункты назначения для выбранного города со ставкой ≠ 0
        const filteredDestinations = [...new Set(data
            .filter(item => {
                const hasRate = (item.container20Under24 && parseFloat(item.container20Under24) > 0) ||
                               (item.container20Over24 && parseFloat(item.container20Over24) > 0) ||
                               (item.container40 && parseFloat(item.container40) > 0);
                return item.city === city &&
                       item.destination &&
                       item.destination.toLowerCase().includes(destination) &&
                       hasRate;
            })
            .map(item => item.destination))
        ].sort((a, b) => a.localeCompare(b));
        
        // Обновляем выпадающий список пунктов назначения
        this.updateDestinationDropdown(filteredDestinations);
        
        // Очищаем зависимое поле типа контейнера
        document.getElementById('rail-container-type').value = '';
        
    },
    
    // 🎯 ОБНОВЛЕНИЕ ВЫПАДАЮЩЕГО СПИСКА ГОРОДОВ
    updateCityDropdown: function(cities) {
        const dropdown = document.getElementById('rail-city-dropdown');
        if (!dropdown) return;
        
        dropdown.innerHTML = '';
        
        if (Array.isArray(cities) && cities.length > 0) {
            // Если cities - это массив объектов, извлекаем названия городов
            const cityNames = cities.map(city => typeof city === 'object' ? city.city : city);
            const uniqueCityNames = [...new Set(cityNames.filter(Boolean))].sort((a, b) => a.localeCompare(b));
            
            uniqueCityNames.forEach(cityName => {
                const option = document.createElement('div');
                option.className = 'dropdown-option';
                option.textContent = cityName;
                option.addEventListener('click', () => {
                    document.getElementById('rail-city').value = cityName;
                    dropdown.classList.remove('active');
                    this.updateDestinationDropdownForCity(cityName);
                });
                dropdown.appendChild(option);
            });
            dropdown.classList.add('active');
        } else {
            dropdown.classList.remove('active');
        }
    },
    
    // 🎯 ОБНОВЛЕНИЕ ВЫПАДАЮЩЕГО СПИСКА ПУНКТОВ НАЗНАЧЕНИЯ ДЛЯ ГОРОДА
    updateDestinationDropdownForCity: function(city) {
        const data = this.railData;
        if (!data || data.length === 0) return;
        
        const destinations = [...new Set(data
            .filter(item => {
                const hasRate = (item.container20Under24 && parseFloat(item.container20Under24) > 0) ||
                               (item.container20Over24 && parseFloat(item.container20Over24) > 0) ||
                               (item.container40 && parseFloat(item.container40) > 0);
                return item.city === city && item.destination && hasRate;
            })
            .map(item => item.destination)
        )].sort((a, b) => a.localeCompare(b));
        
        this.updateDestinationDropdown(destinations);
    },
    
    // 🎯 ОБНОВЛЕНИЕ ВЫПАДАЮЩЕГО СПИСКА ПУНКТОВ НАЗНАЧЕНИЯ
    updateDestinationDropdown: function(destinations) {
        const dropdown = document.getElementById('rail-destination-dropdown');
        if (!dropdown) return;
        
        dropdown.innerHTML = '';
        
        if (Array.isArray(destinations) && destinations.length > 0) {
            // Если destinations - это массив объектов, извлекаем названия пунктов назначения
            const destinationNames = destinations.map(dest => typeof dest === 'object' ? dest.destination : dest);
            const uniqueDestinationNames = [...new Set(destinationNames.filter(Boolean))].sort((a, b) => a.localeCompare(b));
            
            uniqueDestinationNames.forEach(destinationName => {
                const option = document.createElement('div');
                option.className = 'dropdown-option';
                option.textContent = destinationName;
                option.addEventListener('click', () => {
                    document.getElementById('rail-destination').value = destinationName;
                    dropdown.classList.remove('active');
                });
                dropdown.appendChild(option);
            });
            dropdown.classList.add('active');
        } else {
            dropdown.classList.remove('active');
        }
    },
    
    
    // 🎯 ПОИСК СТАВОК ДЛЯ ЖД ПЕРЕВОЗОК
    findRailRates: function(city, destination, containerType) {
        const data = this.railData || database.rail;
        
        if (!data || data.length === 0) {
            console.warn('⚠️ Нет данных для поиска ЖД ставок');
            return [];
        }
        
        return data.filter(item => {
            if (item.city !== city || item.destination !== destination) {
                return false;
            }
            
            // Проверяем, что ставка для выбранного типа контейнера не равна 0
            switch (containerType) {
                case 'container20Under24':
                    return item.container20Under24 && parseFloat(item.container20Under24) > 0;
                case 'container20Over24':
                    return item.container20Over24 && parseFloat(item.container20Over24) > 0;
                case 'container40':
                    return item.container40 && parseFloat(item.container40) > 0;
                default:
                    return false;
            }
        });
    },
    
    // 🎯 ОТОБРАЖЕНИЕ РЕЗУЛЬТАТОВ ДЛЯ ЖД ПЕРЕВОЗОК
    displayRailResults: function(data, containerType) {
        const resultsSection = document.getElementById('results');
        const ratesTable = document.getElementById('rates-table');
        
        if (!resultsSection || !ratesTable) {
            console.error('❌ Не найдены элементы для отображения результатов');
            return;
        }
        
        // Сортируем данные от меньшей к большей ставке
        const sortedData = [...data].sort((a, b) => {
            let rateA = 0, rateB = 0;
            
            switch (containerType) {
                case 'container20Under24':
                    rateA = parseFloat(a.container20Under24) || 0;
                    rateB = parseFloat(b.container20Under24) || 0;
                    break;
                case 'container20Over24':
                    rateA = parseFloat(a.container20Over24) || 0;
                    rateB = parseFloat(b.container20Over24) || 0;
                    break;
                case 'container40':
                    rateA = parseFloat(a.container40) || 0;
                    rateB = parseFloat(b.container40) || 0;
                    break;
            }
            
            return rateA - rateB;
        });
        
        let tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Город</th>
                        <th>Агент</th>
                        <th>Пункт назначения</th>
                        <th>Ставка (руб)</th>
                        <th>Автовывоз</th>
                        <th>ПРР</th>
                        <th>НДС</th>
                        <th>Вохр</th>
                        <th>Валидность</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        sortedData.forEach(item => {
            let rate = '';
            let vochr = '';
            
            switch (containerType) {
                case 'container20Under24':
                    rate = `${item.container20Under24} руб`;
                    vochr = item.vochr20 || 'Вохр 20';
                    break;
                case 'container20Over24':
                    rate = `${item.container20Over24} руб`;
                    vochr = item.vochr20 || 'Вохр 20';
                    break;
                case 'container40':
                    rate = `${item.container40} руб`;
                    vochr = item.vochr40 || 'Вохр 40';
                    break;
            }
            
            const autovivoz = (item.autovivoz !== undefined && item.autovivoz !== null && item.autovivoz !== '') ? item.autovivoz : '-';
            const prr = (item.prr !== undefined && item.prr !== null && item.prr !== '') ? item.prr : '-';
            const nds = (item.nds !== undefined && item.nds !== null && item.nds !== '') ? item.nds : '-';
            
            tableHTML += `
                <tr>
                    <td>${item.city}</td>
                    <td>${item.agent}</td>
                    <td>${item.destination}</td>
                    <td>${rate}</td>
                    <td>${autovivoz}</td>
                    <td>${prr}</td>
                    <td>${nds}</td>
                    <td>${vochr}</td>
                    <td>${item.validity}</td>
                </tr>
            `;
        });
        
        tableHTML += `
                </tbody>
            </table>
        `;
        
        ratesTable.innerHTML = tableHTML;
        resultsSection.classList.remove('hidden');
        
        console.log(`✅ Найдено ${sortedData.length} ставок для ЖД перевозок`);
        Utils.showStatus(`Найдено ${sortedData.length} ставок для ЖД перевозок`, 'success');
    }
};

// Экспортируем модуль для использования в других файлах
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RailModule;
}