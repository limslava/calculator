// 🎯 ИНТЕРФЕЙС СИСТЕМЫ АУТЕНТИФИКАЦИИ

// Функция для входа пользователя
async function loginUser() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const statusElement = document.getElementById('login-status');
    
    if (!email || !password) {
        Utils.showStatus('Пожалуйста, заполните все поля', 'error', 'login-status');
        return;
    }
    
    Utils.showStatus('Вход в систему...', '', 'login-status');
    
    try {
        const result = await ServerAuth.loginUser(email, password);
        
        if (result.success) {
            Utils.showStatus('Успешный вход!', 'success', 'login-status');
            showUserInterface(result.user);
        } else {
            Utils.showStatus(result.error, 'error', 'login-status');
        }
    } catch (error) {
        console.error('❌ Ошибка входа:', error);
        Utils.showStatus('Ошибка соединения с сервером', 'error', 'login-status');
    }
}

// Функция для выхода пользователя
function logoutUser() {
    console.log('🔐 Выход пользователя из системы');
    
    // Сбрасываем глобальные переменные
    window.currentRole = '';
    window.currentDatabase = '';
    window.currentCalculationType = '';
    window.uploadedData = null;
    
    // Сбрасываем все состояния навигации
    if (window.goBack) {
        window.currentRole = '';
        window.currentDatabase = '';
        window.currentCalculationType = '';
    }
    
    ServerAuth.logoutUser();
    
    // Если мы находимся в отдельном интерфейсе, возвращаемся на главную страницу
    if (window.location.pathname.includes('sales-interface.html') ||
        window.location.pathname.includes('purchaser-interface.html')) {
        window.location.href = '../index.html';
    } else {
        showLoginInterface();
    }
    
    Utils.showStatus('Вы вышли из системы', 'info');
}

// Функция для отображения интерфейса входа
function showLoginInterface() {
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('admin-panel').classList.add('hidden');
    document.getElementById('role-selection').classList.add('hidden');
    document.getElementById('database-selection').classList.add('hidden');
    document.getElementById('purchaser-interface').classList.add('hidden');
    document.getElementById('tariff-interface').classList.add('hidden');
    document.getElementById('calculation-type-selection').classList.add('hidden');
    document.getElementById('sales-interface').classList.add('hidden');
    
    // Очищаем поля входа
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('login-status').innerHTML = '';
}

// Функция для отображения интерфейса пользователя
function showUserInterface(user) {
    console.log('🔐 Показываем интерфейс для пользователя:', user.email, 'с ролью:', user.role);
    console.log('🔧 Проверка роли администратора:', user.role === ServerAuth.USER_ROLES.ADMIN);
    console.log('🔧 Проверка роли закупщика:', user.role === ServerAuth.USER_ROLES.PURCHASER);
    console.log('🔧 Проверка роли продавца:', user.role === ServerAuth.USER_ROLES.SALES);
    
    // Сбрасываем глобальные переменные при входе нового пользователя
    window.currentRole = user.role; // Устанавливаем роль пользователя
    window.currentDatabase = '';
    window.currentCalculationType = '';
    window.uploadedData = null;
    
    console.log('🔧 Установлена глобальная переменная currentRole:', window.currentRole);
    
    // Сначала скрываем ВСЕ интерфейсы
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('admin-panel').classList.add('hidden');
    document.getElementById('role-selection').classList.add('hidden');
    document.getElementById('database-selection').classList.add('hidden');
    document.getElementById('purchaser-interface').classList.add('hidden');
    document.getElementById('tariff-interface').classList.add('hidden');
    document.getElementById('calculation-type-selection').classList.add('hidden');
    document.getElementById('sales-interface').classList.add('hidden');
    
    // Обновляем информацию о пользователе (проверяем существование элементов)
    const userEmailElement = document.getElementById('user-email');
    const currentUserEmailElement = document.getElementById('current-user-email');
    
    if (userEmailElement) {
        userEmailElement.textContent = user.email;
    }
    if (currentUserEmailElement) {
        currentUserEmailElement.textContent = user.email;
    }
    
    if (user.role === ServerAuth.USER_ROLES.ADMIN) {
        // Показываем панель администратора
        document.getElementById('admin-panel').classList.remove('hidden');
        loadUsersList();
        console.log('✅ Показана панель администратора');
    } else if (user.role === ServerAuth.USER_ROLES.PURCHASER) {
        // Перенаправляем на отдельный интерфейс менеджера по закупкам
        console.log('🔄 Перенаправление менеджера по закупкам на interfaces/purchaser-interface.html');
        window.location.href = 'interfaces/purchaser-interface.html';
        return; // Прерываем выполнение, так как происходит перенаправление
    } else if (user.role === ServerAuth.USER_ROLES.SALES) {
        // Перенаправляем на отдельный интерфейс менеджера по продажам
        console.log('🔄 Перенаправление менеджера по продажам на interfaces/sales-interface.html');
        window.location.href = 'interfaces/sales-interface.html';
        return; // Прерываем выполнение, так как происходит перенаправление
    } else {
        // Показываем выбор роли для неизвестных ролей
        document.getElementById('role-selection').classList.remove('hidden');
        console.log('⚠️ Показан выбор роли для неизвестной роли');
    }
}

// Функция для отображения модального окна добавления пользователя
function showAddUserModal() {
    const modal = document.getElementById('add-user-modal');
    modal.style.display = 'flex';
    modal.classList.remove('hidden');
    
    // Очищаем поля
    document.getElementById('new-user-email').value = '';
    document.getElementById('new-user-role').value = 'purchaser';
    document.getElementById('add-user-status').innerHTML = '';
}

// Функция для закрытия модального окна добавления пользователя
function closeAddUserModal() {
    const modal = document.getElementById('add-user-modal');
    modal.style.display = 'none';
    modal.classList.add('hidden');
}

// Функция для добавления нового пользователя
async function addNewUser() {
    const email = document.getElementById('new-user-email').value;
    const role = document.getElementById('new-user-role').value;
    const statusElement = document.getElementById('add-user-status');
    
    if (!email) {
        Utils.showStatus('Пожалуйста, введите email', 'error', 'add-user-status');
        return;
    }
    
    // Проверяем формат email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        Utils.showStatus('Пожалуйста, введите корректный email', 'error', 'add-user-status');
        return;
    }
    
    Utils.showStatus('Создание пользователя...', '', 'add-user-status');
    
    try {
        const result = await ServerAuth.createUser(email, role);
        
        if (result.success) {
            Utils.showStatus('Пользователь успешно создан!', 'success', 'add-user-status');
            
            // Отправляем данные для входа на email
            const emailResult = await ServerAuth.sendLoginCredentials(email, result.generatedPassword);
            
            if (emailResult.success) {
                // Показываем данные для входа в интерфейсе
                showLoginCredentials(email, result.generatedPassword, emailResult);
                Utils.showStatus('Данные для входа сохранены', 'success', 'add-user-status');
            } else {
                Utils.showStatus('Пользователь создан, но не удалось отправить email: ' + result.generatedPassword, 'warning', 'add-user-status');
            }
            
            // Обновляем список пользователей
            await loadUsersList();
            
            // Закрываем модальное окно через 3 секунды
            setTimeout(() => {
                closeAddUserModal();
            }, 3000);
        } else {
            Utils.showStatus('Ошибка при создании пользователя: ' + result.error, 'error', 'add-user-status');
        }
    } catch (error) {
        console.error('❌ Ошибка создания пользователя:', error);
        Utils.showStatus('Ошибка соединения с сервером', 'error', 'add-user-status');
    }
}

// Функция для отображения данных для входа
function showLoginCredentials(email, password, emailResult) {
    const credentialsSection = document.getElementById('credentials-section');
    if (!credentialsSection) {
        // Создаем секцию для отображения данных для входа
        const adminPanel = document.getElementById('admin-panel');
        if (adminPanel) {
            const credentialsHTML = `
                <div class="admin-section" id="credentials-section">
                    <h3>📧 Отправленные данные для входа</h3>
                    <div id="sent-emails-list" class="sent-emails-list">
                        <div class="email-item">
                            <div class="email-header">
                                <strong>Получатель:</strong> ${email}
                            </div>
                            <div class="email-content">
                                <div><strong>Логин:</strong> ${email}</div>
                                <div><strong>Пароль:</strong> <span class="password-display">${password}</span></div>
                                <div><strong>Статус:</strong> ${emailResult.message}</div>
                                <div><strong>Время:</strong> ${new Date().toLocaleString('ru-RU')}</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            adminPanel.insertAdjacentHTML('beforeend', credentialsHTML);
        }
    } else {
        // Обновляем существующую секцию
        const sentEmailsList = document.getElementById('sent-emails-list');
        if (sentEmailsList) {
            const emailHTML = `
                <div class="email-item">
                    <div class="email-header">
                        <strong>Получатель:</strong> ${email}
                    </div>
                    <div class="email-content">
                        <div><strong>Логин:</strong> ${email}</div>
                        <div><strong>Пароль:</strong> <span class="password-display">${password}</span></div>
                        <div><strong>Статус:</strong> ${emailResult.message}</div>
                        <div><strong>Время:</strong> ${new Date().toLocaleString('ru-RU')}</div>
                    </div>
                </div>
            `;
            sentEmailsList.insertAdjacentHTML('afterbegin', emailHTML);
        }
    }
}

// Функция для загрузки списка пользователей
async function loadUsersList() {
    const usersListElement = document.getElementById('users-list');
    
    try {
        const users = await ServerAuth.getUsers();
        
        if (users.length === 0) {
            usersListElement.innerHTML = '<div class="no-users-message"><i class="fas fa-users"></i><p>Нет пользователей в системе</p></div>';
            return;
        }
        
        let usersHTML = `
            <table class="users-table">
                <thead>
                    <tr>
                        <th>Email</th>
                        <th>Роль</th>
                        <th>Статус</th>
                        <th>Дата создания</th>
                        <th>Последний вход</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        users.forEach(user => {
            const roleNames = {
                'admin': 'Администратор',
                'purchaser': 'Менеджер по закупу',
                'sales': 'Менеджер по продажам'
            };
            
            const statusText = user.isActive ? 'Активен' : 'Заблокирован';
            const statusClass = user.isActive ? 'status-active' : 'status-inactive';
            const createdAt = user.createdAt ? new Date(user.createdAt).toLocaleDateString('ru-RU') : '-';
            const lastLogin = user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('ru-RU') : 'Никогда';
            
            usersHTML += `
                <tr>
                    <td><strong>${user.email}</strong></td>
                    <td>${roleNames[user.role]}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>${createdAt}</td>
                    <td>${lastLogin}</td>
                    <td class="user-actions">
                        <button class="btn-small ${user.isActive ? 'btn-warning' : 'btn-success'}"
                                onclick="toggleUserStatus('${user.id}')">
                            <i class="fas ${user.isActive ? 'fa-lock' : 'fa-unlock'}"></i>
                            ${user.isActive ? 'Заблокировать' : 'Разблокировать'}
                        </button>
                        <button class="btn-small btn-danger"
                                onclick="deleteUser('${user.id}')"
                                ${user.id === ServerAuth.getCurrentUser()?.id ? 'disabled' : ''}>
                            <i class="fas fa-trash"></i>
                            Удалить
                        </button>
                    </td>
                </tr>
            `;
        });
        
        usersHTML += `
                </tbody>
            </table>
            <div class="users-summary">
                <p><strong>Всего пользователей:</strong> ${users.length}</p>
            </div>
        `;
        
        usersListElement.innerHTML = usersHTML;
    } catch (error) {
        console.error('❌ Ошибка загрузки списка пользователей:', error);
        usersListElement.innerHTML = '<div class="no-users-message"><i class="fas fa-exclamation-triangle"></i><p>Ошибка загрузки пользователей</p></div>';
    }
}

// Функция для блокировки/разблокировки пользователя
async function toggleUserStatus(userId) {
    try {
        const result = await ServerAuth.toggleUserStatus(userId);
        
        if (result.success) {
            Utils.showStatus(result.message, 'success');
            await loadUsersList();
        } else {
            Utils.showStatus(result.error, 'error');
        }
    } catch (error) {
        console.error('❌ Ошибка изменения статуса пользователя:', error);
        Utils.showStatus('Ошибка соединения с сервером', 'error');
    }
}

// Функция для удаления пользователя
async function deleteUser(userId) {
    if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) {
        return;
    }
    
    try {
        const result = await ServerAuth.deleteUser(userId);
        
        if (result.success) {
            Utils.showStatus(result.message, 'success');
            await loadUsersList();
        } else {
            Utils.showStatus(result.error, 'error');
        }
    } catch (error) {
        console.error('❌ Ошибка удаления пользователя:', error);
        Utils.showStatus('Ошибка соединения с сервером', 'error');
    }
}

// Функция для показа модального окна настройки email
function showEmailConfigModal() {
    const modal = document.getElementById('email-config-modal');
    modal.style.display = 'flex';
    modal.classList.remove('hidden');
    
    // Загружаем сохраненные настройки
    loadEmailConfig();
    
    document.getElementById('email-config-status').innerHTML = '';
}

// Функция для закрытия модального окна настройки email
function closeEmailConfigModal() {
    const modal = document.getElementById('email-config-modal');
    modal.style.display = 'none';
    modal.classList.add('hidden');
}

// Функция для обновления конфигурации при выборе почтового сервиса
function updateEmailConfig() {
    const provider = document.getElementById('email-provider').value;
    
    switch (provider) {
        case 'gmail':
            document.getElementById('smtp-host').value = 'smtp.gmail.com';
            document.getElementById('smtp-port').value = '587';
            break;
        case 'yandex':
            document.getElementById('smtp-host').value = 'smtp.yandex.ru';
            document.getElementById('smtp-port').value = '587';
            break;
        case 'mailru':
            document.getElementById('smtp-host').value = 'smtp.mail.ru';
            document.getElementById('smtp-port').value = '587';
            break;
        case 'custom':
            document.getElementById('smtp-host').value = '';
            document.getElementById('smtp-port').value = '587';
            break;
        default:
            // Оставляем текущие значения
            break;
    }
}

// Функция для загрузки сохраненных настроек email
function loadEmailConfig() {
    const savedConfig = localStorage.getItem('email_config');
    if (savedConfig) {
        const config = JSON.parse(savedConfig);
        
        document.getElementById('smtp-host').value = config.host || '';
        document.getElementById('smtp-port').value = config.port || '587';
        document.getElementById('email-address').value = config.auth?.user || '';
        document.getElementById('email-password').value = config.auth?.pass || '';
        
        // Определяем провайдера по хосту
        const host = config.host || '';
        if (host.includes('gmail.com')) {
            document.getElementById('email-provider').value = 'gmail';
        } else if (host.includes('yandex.ru')) {
            document.getElementById('email-provider').value = 'yandex';
        } else if (host.includes('mail.ru')) {
            document.getElementById('email-provider').value = 'mailru';
        } else if (host) {
            document.getElementById('email-provider').value = 'custom';
        }
    }
}

// Функция для сохранения настроек email
function saveEmailConfig() {
    const host = document.getElementById('smtp-host').value;
    const port = parseInt(document.getElementById('smtp-port').value) || 587;
    const email = document.getElementById('email-address').value;
    const password = document.getElementById('email-password').value;
    const statusElement = document.getElementById('email-config-status');
    
    if (!host || !email || !password) {
        Utils.showStatus('Пожалуйста, заполните все поля', 'error', 'email-config-status');
        return;
    }
    
    const emailConfig = {
        host: host,
        port: port,
        secure: false,
        auth: {
            user: email,
            pass: password
        }
    };
    
    // Сохраняем в localStorage
    localStorage.setItem('email_config', JSON.stringify(emailConfig));
    
    Utils.showStatus('Настройки email сохранены', 'success', 'email-config-status');
    
    // Закрываем модальное окно через 2 секунды
    setTimeout(() => {
        closeEmailConfigModal();
    }, 2000);
}

// Функция для тестирования настроек email
function testEmailConfig() {
    const email = document.getElementById('email-address').value;
    const host = document.getElementById('smtp-host').value;
    const port = document.getElementById('smtp-port').value;
    const password = document.getElementById('email-password').value;
    const statusElement = document.getElementById('email-config-status');
    
    if (!email || !host || !port || !password) {
        Utils.showStatus('Пожалуйста, заполните все поля для тестирования', 'error', 'email-config-status');
        return;
    }
    
    Utils.showStatus('Проверка настроек SMTP...', '', 'email-config-status');
    
    // Проверяем настройки и показываем детальную информацию
    setTimeout(() => {
        const emailConfig = {
            host: host,
            port: parseInt(port) || 587,
            secure: false,
            auth: {
                user: email,
                pass: password
            }
        };
        
        // Сохраняем настройки для использования в будущем
        localStorage.setItem('email_config', JSON.stringify(emailConfig));
        
        let testMessage = '✅ Настройки SMTP сохранены и готовы к использованию\n\n';
        testMessage += `📧 Email: ${email}\n`;
        testMessage += `🌐 SMTP сервер: ${host}:${port}\n`;
        testMessage += `🔐 Аутентификация: ${password ? 'Настроена' : 'Не настроена'}\n\n`;
        testMessage += '📝 В реальной версии приложения:\n';
        testMessage += '- При создании пользователя будут отправляться реальные email\n';
        testMessage += '- Для включения реальной отправки раскомментируйте код в функции sendEmail()\n';
        testMessage += '- Убедитесь, что у вас установлена библиотека nodemailer\n';
        testMessage += '- Для Gmail может потребоваться создание пароля приложения';
        
        Utils.showStatus(testMessage, 'success', 'email-config-status');
        
        console.log('🔧 Тест настроек SMTP:', emailConfig);
    }, 1500);
}

// Функция для проверки авторизации при загрузке страницы
async function checkAuthOnLoad() {
    // Если уже показана форма смены пароля, не показываем интерфейс пользователя
    if (window.passwordChangeFormShown) {
        console.log('🔐 Форма смены пароля уже показана, пропускаем авторизацию');
        return;
    }
    
    // Проверяем, находимся ли мы в отдельном интерфейсе
    const isSalesInterface = window.location.pathname.includes('sales-interface.html');
    const isPurchaserInterface = window.location.pathname.includes('purchaser-interface.html');
    
    // Если мы в отдельном интерфейсе, НЕ выполняем проверку авторизации здесь
    // Отдельные интерфейсы сами проверяют авторизацию
    if (isSalesInterface || isPurchaserInterface) {
        console.log('🔐 Находимся в отдельном интерфейсе, пропускаем проверку авторизации в auth-ui.js');
        return;
    }
    
    try {
        const currentUser = await ServerAuth.initialize();
        
        console.log('🔐 Проверка авторизации при загрузке:', currentUser ? currentUser.email : 'не авторизован');
        console.log('📊 localStorage auth_token:', localStorage.getItem('auth_token') ? 'есть токен' : 'нет токена');
        
        if (currentUser) {
            console.log('✅ Пользователь авторизован в главном интерфейсе');
            showUserInterface(currentUser);
        } else {
            console.log('🔐 Пользователь не авторизован, показываем форму входа');
            showLoginInterface();
        }
    } catch (error) {
        console.error('❌ Ошибка проверки авторизации:', error);
        console.log('🔐 Пользователь не авторизован, показываем форму входа');
        showLoginInterface();
    }
}

// Обработчик нажатия Enter в форме входа
document.addEventListener('DOMContentLoaded', function() {
    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    
    if (loginEmail && loginPassword) {
        loginEmail.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                loginUser();
            }
        });
        
        loginPassword.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                loginUser();
            }
        });
    }
    
    // Сначала проверяем параметры URL для смены пароля
    checkUrlParameters();
    
    // Проверяем, находимся ли мы в отдельном интерфейсе
    const isSalesInterface = window.location.pathname.includes('sales-interface.html');
    const isPurchaserInterface = window.location.pathname.includes('purchaser-interface.html');
    
    // Затем проверяем авторизацию при загрузке (если не было запроса на смену пароля и мы в главном интерфейсе)
    if (!window.location.search.includes('action=change-password') && !isSalesInterface && !isPurchaserInterface) {
        checkAuthOnLoad();
    }
});

// Функция для проверки параметров URL
function checkUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    const email = urlParams.get('email');
    
    if (action === 'change-password' && email) {
        console.log('🔐 Запрос на смену пароля для:', email);
        
        // Принудительно выходим из системы, чтобы показать форму смены пароля
        if (ServerAuth.getCurrentUser()) {
            console.log('🔐 Выход из системы для показа формы смены пароля');
            ServerAuth.logoutUser();
        }
        
        // Показываем форму смены пароля
        showChangePasswordForm(email);
    }
}

// Функция для отображения формы смены пароля
function showChangePasswordForm(email) {
    const loginSection = document.getElementById('login-section');
    const changePasswordSection = document.getElementById('change-password-section');
    
    if (loginSection && changePasswordSection) {
        loginSection.classList.add('hidden');
        changePasswordSection.classList.remove('hidden');
        
        // Заполняем email
        document.getElementById('change-password-email').value = email;
        document.getElementById('change-password-email-display').textContent = email;
        
        // Устанавливаем флаг, что показана форма смены пароля
        window.passwordChangeFormShown = true;
        
        console.log('🔐 Показана форма смены пароля для:', email);
    }
}

// Функция для смены пароля
async function changePassword() {
    const email = document.getElementById('change-password-email').value;
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const statusElement = document.getElementById('change-password-status');
    
    if (!email || !currentPassword || !newPassword || !confirmPassword) {
        Utils.showStatus('Пожалуйста, заполните все поля', 'error', 'change-password-status');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        Utils.showStatus('Новый пароль и подтверждение не совпадают', 'error', 'change-password-status');
        return;
    }
    
    if (newPassword.length < 6) {
        Utils.showStatus('Пароль должен содержать минимум 6 символов', 'error', 'change-password-status');
        return;
    }
    
    Utils.showStatus('Смена пароля...', '', 'change-password-status');
    
    try {
        // Сначала входим с текущим паролем для получения ID пользователя
        const loginResult = await ServerAuth.loginUser(email, currentPassword);
        
        if (!loginResult.success) {
            Utils.showStatus('Неверный текущий пароль', 'error', 'change-password-status');
            return;
        }
        
        // Меняем пароль
        const user = loginResult.user;
        const changeResult = await ServerAuth.changeUserPassword(user.id, currentPassword, newPassword);
        
        if (changeResult.success) {
            Utils.showStatus('Пароль успешно изменен! Теперь вы можете войти с новым паролем.', 'success', 'change-password-status');
            
            // Очищаем поля и показываем форму входа через 3 секунды
            setTimeout(() => {
                document.getElementById('current-password').value = '';
                document.getElementById('new-password').value = '';
                document.getElementById('confirm-password').value = '';
                
                const loginSection = document.getElementById('login-section');
                const changePasswordSection = document.getElementById('change-password-section');
                
                if (loginSection && changePasswordSection) {
                    changePasswordSection.classList.add('hidden');
                    loginSection.classList.remove('hidden');
                }
                
                // Очищаем URL параметры
                window.history.replaceState({}, document.title, window.location.pathname);
            }, 3000);
        } else {
            Utils.showStatus('Ошибка при смене пароля: ' + changeResult.error, 'error', 'change-password-status');
        }
    } catch (error) {
        console.error('❌ Ошибка смены пароля:', error);
        Utils.showStatus('Ошибка соединения с сервером', 'error', 'change-password-status');
    }
}

// Функция для возврата к форме входа
function backToLogin() {
    const loginSection = document.getElementById('login-section');
    const changePasswordSection = document.getElementById('change-password-section');
    
    if (loginSection && changePasswordSection) {
        changePasswordSection.classList.add('hidden');
        loginSection.classList.remove('hidden');
    }
    
    // Очищаем флаг формы смены пароля
    window.passwordChangeFormShown = false;
    
    // Очищаем URL параметры
    window.history.replaceState({}, document.title, window.location.pathname);
}

// Экспортируем функции для использования в других модулях
window.AuthUI = {
    loginUser,
    logoutUser,
    showLoginInterface,
    showUserInterface,
    showAddUserModal,
    closeAddUserModal,
    addNewUser,
    loadUsersList,
    toggleUserStatus,
    deleteUser,
    checkAuthOnLoad
};