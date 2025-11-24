// 🎯 СЕРВЕРНАЯ СИСТЕМА АУТЕНТИФИКАЦИИ

// Роли пользователей
const USER_ROLES = {
    ADMIN: 'admin',
    PURCHASER: 'purchaser',
    SALES: 'sales'
};

// Текущий авторизованный пользователь
let currentUser = null;

// Функция для сохранения токена в localStorage
function saveToken(token) {
    localStorage.setItem('auth_token', token);
}

// Функция для получения токена из localStorage
function getToken() {
    return localStorage.getItem('auth_token');
}

// Функция для удаления токена из localStorage
function removeToken() {
    localStorage.removeItem('auth_token');
}

// Функция для выполнения авторизованных запросов
async function makeAuthRequest(url, options = {}) {
    const token = getToken();
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(url, {
        ...options,
        headers
    });
    
    if (response.status === 401) {
        // Токен недействителен, выходим из системы
        logoutUser();
        throw new Error('Сессия истекла. Пожалуйста, войдите снова.');
    }
    
    return response;
}

// Функция для входа пользователя
async function loginUser(email, password) {
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const result = await response.json();
        
        if (result.success) {
            saveToken(result.token);
            currentUser = result.user;
            return { success: true, user: result.user };
        } else {
            return { success: false, error: result.error };
        }
    } catch (error) {
        console.error('❌ Ошибка входа:', error);
        return { success: false, error: 'Ошибка соединения с сервером' };
    }
}

// Функция для получения текущего пользователя с сервера
async function getCurrentUser() {
    const token = getToken();
    
    if (!token) {
        return null;
    }
    
    try {
        const response = await makeAuthRequest('/api/auth/me');
        
        if (response.ok) {
            const user = await response.json();
            currentUser = user;
            return user;
        } else {
            // Токен недействителен
            removeToken();
            currentUser = null;
            return null;
        }
    } catch (error) {
        console.error('❌ Ошибка получения текущего пользователя:', error);
        return null;
    }
}

// Функция для выхода пользователя
function logoutUser() {
    currentUser = null;
    removeToken();
    console.log('✅ Пользователь вышел из системы');
}

// Функция для создания пользователя (только для администратора)
async function createUser(email, role) {
    try {
        const response = await makeAuthRequest('/api/users', {
            method: 'POST',
            body: JSON.stringify({ email, role })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            return { 
                success: true, 
                user: result.user, 
                generatedPassword: result.generatedPassword 
            };
        } else {
            return { success: false, error: result.error };
        }
    } catch (error) {
        console.error('❌ Ошибка создания пользователя:', error);
        return { success: false, error: 'Ошибка соединения с сервером' };
    }
}

// Функция для получения списка пользователей (только для администратора)
async function getUsers() {
    try {
        const response = await makeAuthRequest('/api/users');
        
        if (response.ok) {
            const users = await response.json();
            return users;
        } else {
            return [];
        }
    } catch (error) {
        console.error('❌ Ошибка получения списка пользователей:', error);
        return [];
    }
}

// Функция для блокировки/разблокировки пользователя
async function toggleUserStatus(userId) {
    try {
        const response = await makeAuthRequest(`/api/users/${userId}/toggle-status`, {
            method: 'PUT'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            return { success: true, message: result.message, user: result.user };
        } else {
            return { success: false, error: result.error };
        }
    } catch (error) {
        console.error('❌ Ошибка изменения статуса пользователя:', error);
        return { success: false, error: 'Ошибка соединения с сервером' };
    }
}

// Функция для удаления пользователя
async function deleteUser(userId) {
    try {
        const response = await makeAuthRequest(`/api/users/${userId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            return { success: true, message: result.message };
        } else {
            return { success: false, error: result.error };
        }
    } catch (error) {
        console.error('❌ Ошибка удаления пользователя:', error);
        return { success: false, error: 'Ошибка соединения с сервером' };
    }
}

// Функция для смены пароля
async function changeUserPassword(userId, currentPassword, newPassword) {
    try {
        const response = await makeAuthRequest(`/api/users/${userId}/change-password`, {
            method: 'PUT',
            body: JSON.stringify({ currentPassword, newPassword })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            return { success: true, message: result.message };
        } else {
            return { success: false, error: result.error };
        }
    } catch (error) {
        console.error('❌ Ошибка смены пароля:', error);
        return { success: false, error: 'Ошибка соединения с сервером' };
    }
}

// Функция для проверки прав доступа
function hasPermission(requiredRole) {
    if (!currentUser) return false;
    
    // Админ имеет все права
    if (currentUser.role === USER_ROLES.ADMIN) return true;
    
    // Проверяем соответствие роли
    return currentUser.role === requiredRole;
}

// Функция для инициализации системы аутентификации
async function initialize() {
    try {
        const user = await getCurrentUser();
        if (user) {
            console.log('🔐 Пользователь авторизован:', user.email);
        } else {
            console.log('🔐 Пользователь не авторизован');
        }
        return user;
    } catch (error) {
        console.error('❌ Ошибка инициализации аутентификации:', error);
        return null;
    }
}

// Функция для отправки данных для входа пользователю
async function sendLoginCredentials(email, password) {
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
    
    // Проверяем, есть ли сохраненные настройки email
    const savedConfig = localStorage.getItem('email_config');
    
    if (savedConfig) {
        try {
            const emailConfig = JSON.parse(savedConfig);
            
            // Отправляем запрос на сервер для отправки email
            const response = await fetch('/api/send-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to: email,
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
        }
    }
    
    // Заглушка для отображения данных
    const emailData = {
        to: email,
        subject: subject,
        message: message,
        timestamp: new Date().toISOString(),
        configUsed: !!savedConfig
    };
    
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

// Экспортируем функции для использования в других модулях
window.ServerAuth = {
    USER_ROLES,
    initialize,
    loginUser,
    logoutUser,
    getCurrentUser,
    createUser,
    getUsers,
    toggleUserStatus,
    deleteUser,
    changeUserPassword,
    hasPermission,
    sendLoginCredentials,
    makeAuthRequest
};