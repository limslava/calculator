const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');
const DataStorage = require('./server-data');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const dataStorage = new DataStorage();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// База данных пользователей (в реальном приложении используйте базу данных)
let users = [];

// Функция для загрузки пользователей из файла
function loadUsers() {
    try {
        const fs = require('fs');
        if (fs.existsSync('./data/users.json')) {
            const data = fs.readFileSync('./data/users.json', 'utf8');
            users = JSON.parse(data);
            console.log('📊 Загружены пользователи из файла:', users.length);
        } else {
            // Создаем администратора по умолчанию
            createDefaultAdmin();
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки пользователей:', error);
        createDefaultAdmin();
    }
}

// Функция для сохранения пользователей в файл
function saveUsers() {
    try {
        const fs = require('fs');
        const path = require('path');
        const dir = './data';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(path.join(dir, 'users.json'), JSON.stringify(users, null, 2));
        console.log('✅ Пользователи сохранены в файл');
    } catch (error) {
        console.error('❌ Ошибка сохранения пользователей:', error);
    }
}

// Функция для создания администратора по умолчанию
function createDefaultAdmin() {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    const adminUser = {
        id: '1',
        email: 'admin@logistics.com',
        role: 'admin',
        password: hashedPassword,
        isActive: true,
        createdAt: new Date().toISOString(),
        lastLogin: null
    };
    users.push(adminUser);
    saveUsers();
    console.log('✅ Создан администратор по умолчанию: admin@logistics.com / admin123');
}

// Middleware для проверки JWT токена
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Токен доступа не предоставлен' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Недействительный токен' });
        }
        req.user = user;
        next();
    });
}

// Middleware для проверки прав администратора
function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Недостаточно прав' });
    }
    next();
}

// Middleware для парсинга JSON
app.use(express.json({ limit: '10mb' }));

// Middleware для безопасности
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrcAttr: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      styleSrcElem: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  }
}));

// Middleware для сжатия
app.use(compression());

// Обслуживание статических файлов
app.use(express.static(path.join(__dirname)));

// Прокси для получения курса ЦБ РФ
app.get('/api/exchange-rate', async (req, res) => {
    try {
        console.log('🔄 Получение курса ЦБ РФ через прокси...');
        
        // Добавляем таймаут для запроса
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 секунд таймаут
        
        const response = await fetch('https://www.cbr.ru/currency_base/daily/', {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const html = await response.text();
        
        // Парсим курс USD из HTML
        const usdMatch = html.match(/<td>840<\/td>\s*<td>USD<\/td>\s*<td>1<\/td>\s*<td>Доллар США<\/td>\s*<td>(\d+,\d+)<\/td>/);
        if (usdMatch && usdMatch[1]) {
            const rate = parseFloat(usdMatch[1].replace(',', '.'));
            console.log('✅ Курс ЦБ РФ получен:', rate);
            res.json({ success: true, rate: rate });
        } else {
            // Альтернативный парсинг на случай изменения структуры HTML
            const alternativeMatch = html.match(/USD.*?(\d+,\d+)/);
            if (alternativeMatch && alternativeMatch[1]) {
                const rate = parseFloat(alternativeMatch[1].replace(',', '.'));
                console.log('✅ Курс ЦБ РФ получен (альтернативный метод):', rate);
                res.json({ success: true, rate: rate });
            } else {
                throw new Error('Не удалось найти курс USD в HTML');
            }
        }
    } catch (error) {
        console.error('❌ Ошибка получения курса:', error);
        // Возвращаем фиксированный курс в случае ошибки
        res.json({
            success: false,
            error: error.message,
            fallbackRate: 90.0 // Фиксированный курс на случай недоступности ЦБ
        });
    }
});

// API для работы с данными
app.get('/api/data/:dbType', (req, res) => {
    try {
        const { dbType } = req.params;
        const data = dataStorage.loadData(dbType);
        res.json(data);
    } catch (error) {
        console.error('❌ Ошибка получения данных:', error);
        res.status(500).json({ error: 'Ошибка получения данных' });
    }
});

app.post('/api/data/:dbType', (req, res) => {
    try {
        const { dbType } = req.params;
        const { data } = req.body;
        
        if (!data) {
            return res.status(400).json({ error: 'Данные не предоставлены' });
        }
        
        const success = dataStorage.saveData(dbType, data);
        if (success) {
            res.json({ success: true, message: 'Данные сохранены', count: data.length });
        } else {
            res.status(500).json({ error: 'Ошибка сохранения данных' });
        }
    } catch (error) {
        console.error('❌ Ошибка сохранения данных:', error);
        res.status(500).json({ error: 'Ошибка сохранения данных' });
    }
});

app.get('/api/data', (req, res) => {
    try {
        const allData = dataStorage.getAllData();
        res.json(allData);
    } catch (error) {
        console.error('❌ Ошибка получения всех данных:', error);
        res.status(500).json({ error: 'Ошибка получения данных' });
    }
});

// Маршрут для отправки email
app.post('/api/send-email', async (req, res) => {
    try {
        const { to, subject, message, config } = req.body;
        
        console.log('📧 Отправка email через сервер:', { to, subject });
        
        if (!to || !subject || !message || !config) {
            return res.status(400).json({
                success: false,
                error: 'Не все обязательные поля заполнены'
            });
        }
        
        // Создаем транспортер для отправки email
        const transporter = nodemailer.createTransport(config);
        
        const mailOptions = {
            from: config.auth.user,
            to: to,
            subject: subject,
            text: message,
            html: message.replace(/\n/g, '<br>')
        };
        
        const result = await transporter.sendMail(mailOptions);
        console.log('✅ Email успешно отправлен через сервер:', result.messageId);
        
        res.json({
            success: true,
            message: 'Email отправлен',
            messageId: result.messageId
        });
        
    } catch (error) {
        console.error('❌ Ошибка отправки email через сервер:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API для аутентификации
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email и пароль обязательны' });
        }

        const user = users.find(u => u.email === email.toLowerCase().trim() && u.isActive);
        
        if (!user) {
            return res.status(401).json({ error: 'Пользователь не найден или заблокирован' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Неверный пароль' });
        }

        // Обновляем время последнего входа
        user.lastLogin = new Date().toISOString();
        saveUsers();

        // Создаем JWT токен
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                isActive: user.isActive,
                createdAt: user.createdAt,
                lastLogin: user.lastLogin
            },
            token: token
        });

    } catch (error) {
        console.error('❌ Ошибка входа:', error);
        res.status(500).json({ error: 'Ошибка сервера при входе' });
    }
});

// API для получения текущего пользователя
app.get('/api/auth/me', authenticateToken, (req, res) => {
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
    });
});

// API для выхода (на клиенте просто удаляем токен)
app.post('/api/auth/logout', (req, res) => {
    res.json({ success: true, message: 'Успешный выход' });
});

// API для получения списка пользователей (только для администратора)
app.get('/api/users', authenticateToken, requireAdmin, (req, res) => {
    const usersList = users.map(user => ({
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
    }));
    res.json(usersList);
});

// API для создания пользователя (только для администратора)
app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { email, role } = req.body;
        
        if (!email || !role) {
            return res.status(400).json({ error: 'Email и роль обязательны' });
        }

        // Проверяем, существует ли пользователь
        const existingUser = users.find(u => u.email === email.toLowerCase().trim());
        if (existingUser) {
            return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
        }

        // Генерируем случайный пароль
        const password = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = {
            id: Date.now().toString(),
            email: email.toLowerCase().trim(),
            role: role,
            password: hashedPassword,
            isActive: true,
            createdAt: new Date().toISOString(),
            lastLogin: null
        };

        users.push(newUser);
        saveUsers();

        res.json({
            success: true,
            user: {
                id: newUser.id,
                email: newUser.email,
                role: newUser.role,
                isActive: newUser.isActive,
                createdAt: newUser.createdAt,
                lastLogin: newUser.lastLogin
            },
            generatedPassword: password
        });

    } catch (error) {
        console.error('❌ Ошибка создания пользователя:', error);
        res.status(500).json({ error: 'Ошибка сервера при создании пользователя' });
    }
});

// API для блокировки/разблокировки пользователя
app.put('/api/users/:id/toggle-status', authenticateToken, requireAdmin, (req, res) => {
    const userId = req.params.id;
    const user = users.find(u => u.id === userId);
    
    if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }

    user.isActive = !user.isActive;
    saveUsers();

    res.json({
        success: true,
        message: `Пользователь ${user.isActive ? 'разблокирован' : 'заблокирован'}`,
        user: {
            id: user.id,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin
        }
    });
});

// API для удаления пользователя
app.delete('/api/users/:id', authenticateToken, requireAdmin, (req, res) => {
    const userId = req.params.id;
    
    if (req.user.id === userId) {
        return res.status(400).json({ error: 'Нельзя удалить свой аккаунт' });
    }

    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }

    users.splice(userIndex, 1);
    saveUsers();

    res.json({ success: true, message: 'Пользователь удален' });
});

// API для смены пароля
app.put('/api/users/:id/change-password', authenticateToken, async (req, res) => {
    try {
        const userId = req.params.id;
        const { currentPassword, newPassword } = req.body;
        
        // Проверяем права (пользователь может менять только свой пароль, админ - любой)
        if (req.user.id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }

        const user = users.find(u => u.id === userId);
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        // Проверяем текущий пароль (если не админ)
        if (req.user.role !== 'admin') {
            const isValidPassword = await bcrypt.compare(currentPassword, user.password);
            if (!isValidPassword) {
                return res.status(401).json({ error: 'Неверный текущий пароль' });
            }
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        saveUsers();

        res.json({ success: true, message: 'Пароль успешно изменен' });

    } catch (error) {
        console.error('❌ Ошибка смены пароля:', error);
        res.status(500).json({ error: 'Ошибка сервера при смене пароля' });
    }
});

// Healthcheck endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Маршрут для главной страницы
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Обработка всех маршрутов для SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Обработчик ошибок
app.use((err, req, res, next) => {
  console.error('Ошибка сервера:', err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// Запуск сервера
console.log('=== DEBUG INFO ===');
console.log(`🔧 Переменная окружения PORT: ${process.env.PORT}`);
console.log(`🔧 Используемый порт: ${PORT}`);
console.log('==================');

// Загружаем пользователей при запуске сервера
loadUsers();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📁 Обслуживание статических файлов из: ${__dirname}`);
  console.log(`🌐 Приложение доступно по адресу: http://localhost:${PORT}`);
  console.log(`👥 Загружено пользователей: ${users.length}`);
});

module.exports = app;