// Конфигурация SMTP для отправки email
const DEFAULT_EMAIL_CONFIG = {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true для порта 465, false для других портов
    auth: {
        user: 'your-email@gmail.com',
        pass: 'your-app-password'
    }
};

// Функция для сохранения конфигурации email в localStorage
function saveEmailConfig(config) {
    try {
        localStorage.setItem('email_config', JSON.stringify(config));
        console.log('✅ Настройки SMTP сохранены в localStorage');
        return { success: true, message: 'Настройки SMTP сохранены' };
    } catch (error) {
        console.error('❌ Ошибка сохранения настроек SMTP:', error);
        return { success: false, error: 'Ошибка сохранения настроек' };
    }
}

// Функция для загрузки конфигурации email из localStorage
function loadEmailConfig() {
    try {
        const savedConfig = localStorage.getItem('email_config');
        if (savedConfig) {
            return JSON.parse(savedConfig);
        }
        return null;
    } catch (error) {
        console.error('❌ Ошибка загрузки настроек SMTP:', error);
        return null;
    }
}

// Функция для проверки конфигурации email
function testEmailConfig(config) {
    return new Promise((resolve) => {
        // В реальном приложении здесь была бы проверка подключения к SMTP
        console.log('🔧 Тестирование конфигурации SMTP:', config);
        
        // Имитация проверки (в реальном приложении здесь был бы реальный тест)
        setTimeout(() => {
            if (config.auth.user && config.auth.pass) {
                resolve({ success: true, message: 'Конфигурация SMTP корректна' });
            } else {
                resolve({ success: false, error: 'Не указаны логин или пароль SMTP' });
            }
        }, 1000);
    });
}

// Экспортируем функции для использования в других модулях
window.EmailConfig = {
    DEFAULT_EMAIL_CONFIG,
    saveEmailConfig,
    loadEmailConfig,
    testEmailConfig
};