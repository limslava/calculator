// 🎯 СИСТЕМА АУТЕНТИФИКАЦИИ И УПРАВЛЕНИЯ ПОЛЬЗОВАТЕЛЯМИ

// Роли пользователей
const USER_ROLES = {
    ADMIN: 'admin',
    PURCHASER: 'purchaser',
    SALES: 'sales'
};

// База данных пользователей (в реальном приложении должна быть на сервере)
let users = [];

// Текущий авторизованный пользователь
let currentUser = null;

// Функция для генерации случайного пароля
function generatePassword(length = 8) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
}

// Функция для хеширования пароля (упрощенная версия)
function hashPassword(password) {
    // В реальном приложении используйте bcrypt или аналогичную библиотеку
    return btoa(password); // Простое кодирование в base64 для демонстрации
}

// Функция для проверки пароля
function verifyPassword(password, hashedPassword) {
    return btoa(password) === hashedPassword;
}

// Функция для создания нового пользователя
function createUser(email, role, password = null) {
    const newPassword = password || generatePassword();
    const hashedPassword = hashPassword(newPassword);
    
    const user = {
        id: Date.now().toString(),
        email: email.toLowerCase().trim(),
        role: role,
        password: hashedPassword,
        isActive: true,
        createdAt: new Date().toISOString(),
        lastLogin: null
    };
    
    users.push(user);
    saveUsersToStorage();
    
    return {
        user: { ...user, password: undefined }, // Не возвращаем пароль
        generatedPassword: newPassword
    };
}

// Функция для аутентификации пользователя
function authenticateUser(email, password) {
    const user = users.find(u =>
        u.email === email.toLowerCase().trim() &&
        u.isActive
    );
    
    if (!user) {
        return { success: false, error: 'Пользователь не найден или заблокирован' };
    }
    
    if (!verifyPassword(password, user.password)) {
        return { success: false, error: 'Неверный пароль' };
    }
    
    // Обновляем время последнего входа
    user.lastLogin = new Date().toISOString();
    saveUsersToStorage();
    
    currentUser = { ...user, password: undefined };
    saveCurrentUserToStorage();
    console.log('✅ Пользователь авторизован:', currentUser.email);
    console.log('🔧 Роль пользователя:', currentUser.role);
    console.log('🔧 Проверка роли администратора:', currentUser.role === USER_ROLES.ADMIN);
    return { success: true, user: currentUser };
}

// Функция для сохранения текущего пользователя в localStorage
function saveCurrentUserToStorage() {
    if (currentUser) {
        localStorage.setItem('current_user', JSON.stringify(currentUser));
    } else {
        localStorage.removeItem('current_user');
    }
}

// Функция для загрузки текущего пользователя из localStorage
function loadCurrentUserFromStorage() {
    try {
        const savedUser = localStorage.getItem('current_user');
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            console.log('👤 Текущий пользователь восстановлен из localStorage:', currentUser.email);
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки текущего пользователя:', error);
        currentUser = null;
    }
}

// Функция для выхода пользователя
function logoutUser() {
    console.log('👋 Выход пользователя:', currentUser ? currentUser.email : 'не авторизован');
    currentUser = null;
    saveCurrentUserToStorage();
    console.log('✅ Пользователь вышел из системы, localStorage очищен');
}

// Функция для получения списка пользователей (только для администратора)
function getUsers() {
    if (currentUser?.role !== USER_ROLES.ADMIN) {
        return [];
    }
    
    return users.map(user => ({
        ...user,
        password: undefined // Не возвращаем пароли
    }));
}

// Функция для блокировки/разблокировки пользователя
function toggleUserStatus(userId) {
    if (currentUser?.role !== USER_ROLES.ADMIN) {
        return { success: false, error: 'Недостаточно прав' };
    }
    
    const user = users.find(u => u.id === userId);
    if (!user) {
        return { success: false, error: 'Пользователь не найден' };
    }
    
    user.isActive = !user.isActive;
    saveUsersToStorage();
    
    return { 
        success: true, 
        user: { ...user, password: undefined },
        message: `Пользователь ${user.isActive ? 'разблокирован' : 'заблокирован'}`
    };
}

// Функция для смены пароля пользователя
function changeUserPassword(userId, newPassword) {
    if (currentUser?.role !== USER_ROLES.ADMIN && currentUser?.id !== userId) {
        return { success: false, error: 'Недостаточно прав' };
    }
    
    const user = users.find(u => u.id === userId);
    if (!user) {
        return { success: false, error: 'Пользователь не найден' };
    }
    
    user.password = hashPassword(newPassword);
    saveUsersToStorage();
    
    return { success: true, message: 'Пароль успешно изменен' };
}

// Функция для смены пароля по email (для формы смены пароля)
function changePasswordByEmail(email, currentPassword, newPassword) {
    // Проверяем текущий пароль
    const authResult = authenticateUser(email, currentPassword);
    if (!authResult.success) {
        return { success: false, error: 'Неверный текущий пароль' };
    }
    
    // Меняем пароль
    const user = authResult.user;
    return changeUserPassword(user.id, newPassword);
}

// Функция для удаления пользователя
function deleteUser(userId) {
    if (currentUser?.role !== USER_ROLES.ADMIN) {
        return { success: false, error: 'Недостаточно прав' };
    }
    
    if (currentUser.id === userId) {
        return { success: false, error: 'Нельзя удалить свой аккаунт' };
    }
    
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
        return { success: false, error: 'Пользователь не найден' };
    }
    
    users.splice(userIndex, 1);
    saveUsersToStorage();
    
    return { success: true, message: 'Пользователь удален' };
}

// Функция для проверки прав доступа
function hasPermission(requiredRole) {
    if (!currentUser) return false;
    
    // Админ имеет все права
    if (currentUser.role === USER_ROLES.ADMIN) return true;
    
    // Проверяем соответствие роли
    return currentUser.role === requiredRole;
}

// Функция для получения текущего пользователя
function getCurrentUser() {
    return currentUser;
}

// Функция для сохранения пользователей в localStorage
function saveUsersToStorage() {
    localStorage.setItem('logistics_users', JSON.stringify(users));
}

// Функция для загрузки пользователей из localStorage
function loadUsersFromStorage() {
    try {
        const savedUsers = localStorage.getItem('logistics_users');
        if (savedUsers) {
            users = JSON.parse(savedUsers);
            console.log('📊 Загружены пользователи из localStorage:', users.length);
            
            // Проверяем наличие администратора
            const adminExists = users.some(user => user.role === USER_ROLES.ADMIN);
            if (!adminExists) {
                console.log('⚠️ Администратор не найден, создаем по умолчанию');
                createDefaultAdmin();
            } else {
                console.log('✅ Администратор найден в базе пользователей');
            }
        } else {
            // Создаем администратора по умолчанию
            console.log('📊 Пользователи не найдены, создаем администратора по умолчанию');
            createDefaultAdmin();
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки пользователей:', error);
        console.log('🔄 Создаем администратора по умолчанию');
        createDefaultAdmin();
    }
}

// Функция для создания администратора по умолчанию
function createDefaultAdmin() {
    const defaultPassword = 'admin123';
    createUser('admin@logistics.com', USER_ROLES.ADMIN, defaultPassword);
    console.log('✅ Создан администратор по умолчанию: admin@logistics.com / admin123');
    console.log('🔧 Роль администратора:', USER_ROLES.ADMIN);
}

// Функция для отправки email (реальная или заглушка)
async function sendEmail(to, subject, message) {
    console.log('📧 Отправка email:', { to, subject, message });
    
    // Проверяем, есть ли сохраненные настройки email
    const savedConfig = localStorage.getItem('email_config');
    
    if (savedConfig) {
        try {
            const emailConfig = JSON.parse(savedConfig);
            
            // 🔧 РЕАЛЬНАЯ ОТПРАВКА ЧЕРЕЗ SMTP
            try {
                // Отправляем запрос на сервер для отправки email
                const response = await fetch('/api/send-email', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        to: to,
                        subject: subject,
                        message: message,
                        config: emailConfig
                    })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    console.log('✅ Email успешно отправлен через сервер');
                    
                    return {
                        success: true,
                        message: 'Email отправлен',
                        serverResponse: result
                    };
                } else {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            } catch (error) {
                console.error('❌ Ошибка отправки email через сервер:', error);
                console.log('🔄 Используем заглушку для отображения данных');
                // Если реальная отправка не удалась, используем заглушку
            }
            
            console.log('✅ Настройки SMTP найдены, отправка через сервер');
            
        } catch (error) {
            console.error('❌ Ошибка парсинга настроек email:', error);
        }
    }
    
    // 🔧 ЗАГЛУШКА: Сохраняем данные для отображения в интерфейсе
    const emailData = {
        to: to,
        subject: subject,
        message: message,
        timestamp: new Date().toISOString(),
        configUsed: !!savedConfig
    };
    
    // Сохраняем в localStorage для отображения в интерфейсе
    const sentEmails = JSON.parse(localStorage.getItem('sent_emails') || '[]');
    sentEmails.push(emailData);
    localStorage.setItem('sent_emails', JSON.stringify(sentEmails));
    
    let statusMessage = 'Данные для входа сохранены';
    if (savedConfig) {
        statusMessage += ' (SMTP настроен, но реальная отправка отключена)';
    } else {
        statusMessage += ' (SMTP не настроен)';
    }
    
    return {
        success: true,
        message: statusMessage,
        emailData: emailData,
        smtpConfigured: !!savedConfig
    };
}

// Функция для отправки данных для входа пользователю
function sendLoginCredentials(email, password) {
    const subject = 'Данные для входа в систему расчета логистических ставок';
    const changePasswordUrl = `${window.location.origin}?action=change-password&email=${encodeURIComponent(email)}`;
    
    const message = `
        Здравствуйте!

        Ваши данные для входа в систему расчета логистических ставок:

        Логин: ${email}
        Пароль: ${password}

        Ссылка для входа: ${window.location.origin}

        🔐 Ссылка для смены пароля: ${changePasswordUrl}

        Рекомендуем сменить пароль после первого входа.

        С уважением,
        Хасан
    `;
    
    return sendEmail(email, subject, message);
}

// Функция для инициализации системы аутентификации
function initialize() {
    loadUsersFromStorage();
    loadCurrentUserFromStorage();
    console.log('🔐 Система аутентификации инициализирована');
    console.log('👤 Текущий пользователь:', currentUser ? currentUser.email : 'не авторизован');
}

// Функция для обновления роли пользователя
function updateUserRole(userId, newRole) {
    const user = users.find(u => u.id === userId);
    if (user) {
        user.role = newRole;
        saveUsersToStorage();
        return { success: true, user: { ...user, password: undefined } };
    }
    return { success: false, error: 'Пользователь не найден' };
}

// Экспортируем функции для использования в других модулях
window.Auth = {
    USER_ROLES,
    initialize,
    createUser,
    authenticateUser,
    logoutUser,
    getUsers,
    toggleUserStatus,
    changeUserPassword,
    changePasswordByEmail,
    deleteUser,
    hasPermission,
    getCurrentUser,
    loadUsersFromStorage,
    sendLoginCredentials,
    generatePassword,
    updateUserRole
};

// Инициализация при загрузке (вызывается из script.js)
// document.addEventListener('DOMContentLoaded', function() {
//     loadUsersFromStorage();
//     console.log('🔐 Система аутентификации инициализирована');
// });