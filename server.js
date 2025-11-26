// Загрузка переменных окружения
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
} else {
  require('dotenv').config({ path: '.env.production' });
}

const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');
const DataStorage = require('./server-data');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sequelize, testConnection, syncDatabase } = require('./config/database');
const { User } = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;
const dataStorage = new DataStorage();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Функция для инициализации базы данных и создания начальных данных
async function initializeDatabase() {
    try {
        console.log('🔄 Инициализация базы данных...');
        
        // Тестируем подключение к базе данных
        const isConnected = await testConnection();
        if (!isConnected) {
            console.error('❌ Не удалось подключиться к базе данных');
            return false;
        }

        // Синхронизируем базу данных
        await syncDatabase(false); // force: false - не пересоздавать таблицы

        // Проверяем наличие администратора, если нет - создаем
        const adminExists = await User.findOne({ where: { role: 'admin' } });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await User.create({
                email: 'admin@logistics.com',
                password: hashedPassword,
                role: 'admin',
                isActive: true
            });
            console.log('✅ Создан администратор по умолчанию: admin@logistics.com / admin123');
        } else {
            console.log('✅ Администратор уже существует');
        }

        // Создаем начальные данные для логистики, если их нет
        await createInitialLogisticsData();

        const userCount = await User.count();
        console.log(`📊 Загружено пользователей из базы данных: ${userCount}`);
        return true;
    } catch (error) {
        console.error('❌ Ошибка инициализации базы данных:', error);
        return false;
    }
}

// Функция для создания начальных данных логистики
async function createInitialLogisticsData() {
    try {
        const { SeaData, RailData, DirectRailData, DirectSeaData, TariffData } = require('./models');
        
        // Начальные данные
        const initialData = {
            sea: [],
            rail: [],
            direct_rail: [],
            direct_sea: [],
            tariff: [
                {
                    vtt: 5000,
                    prr20: 2000,
                    prr40: null,
                    auto20: null,
                    auto40: null,
                    timestamp: new Date().toISOString()
                }
            ]
        };

        // Создаем данные только если таблицы пустые
        const models = [
            { model: SeaData, type: 'sea', name: 'морских перевозок' },
            { model: RailData, type: 'rail', name: 'железнодорожных перевозок' },
            { model: DirectRailData, type: 'direct_rail', name: 'прямых железнодорожных перевозок' },
            { model: DirectSeaData, type: 'direct_sea', name: 'прямых морских перевозок' },
            { model: TariffData, type: 'tariff', name: 'тарифных данных' }
        ];

        for (const { model, type, name } of models) {
            const existingData = await model.findOne();
            if (!existingData) {
                await model.create({
                    data: initialData[type],
                    lastUpdate: new Date(),
                    count: initialData[type].length
                });
                console.log(`✅ Созданы начальные данные для ${name}`);
            }
        }
    } catch (error) {
        console.error('❌ Ошибка создания начальных данных:', error);
    }
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
app.get('/api/data/:dbType', authenticateToken, async (req, res) => {
    try {
        const { dbType } = req.params;
        const data = await dataStorage.loadData(dbType);
        res.json(data);
    } catch (error) {
        console.error('❌ Ошибка получения данных:', error);
        res.status(500).json({ error: 'Ошибка получения данных' });
    }
});

app.post('/api/data/:dbType', authenticateToken, (req, res) => {
    try {
        const { dbType } = req.params;
        const { data } = req.body;
        
        if (!data) {
            return res.status(400).json({ error: 'Данные не предоставлены' });
        }
        
        // Проверяем права доступа
        const allowedRoles = ['admin', 'purchaser'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Недостаточно прав для сохранения данных' });
        }
        
        const success = dataStorage.saveData(dbType, data);
        if (success) {
            console.log(`✅ Данные сохранены пользователем ${req.user.email} для ${dbType}: ${data.length} записей`);
            res.json({ success: true, message: 'Данные сохранены', count: data.length });
        } else {
            res.status(500).json({ error: 'Ошибка сохранения данных' });
        }
    } catch (error) {
        console.error('❌ Ошибка сохранения данных:', error);
        res.status(500).json({ error: 'Ошибка сохранения данных' });
    }
});

app.get('/api/data', async (req, res) => {
    try {
        const allData = await dataStorage.getAllData();
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

        const user = await User.findOne({
            where: {
                email: email.toLowerCase().trim(),
                isActive: true
            }
        });
        
        if (!user) {
            return res.status(401).json({ error: 'Пользователь не найден или заблокирован' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Неверный пароль' });
        }

        // Обновляем время последнего входа
        await user.update({ lastLogin: new Date() });

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
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id);
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
    } catch (error) {
        console.error('❌ Ошибка получения пользователя:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// API для выхода (на клиенте просто удаляем токен)
app.post('/api/auth/logout', (req, res) => {
    res.json({ success: true, message: 'Успешный выход' });
});

// API для получения списка пользователей (только для администратора)
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const usersList = await User.findAll({
            attributes: ['id', 'email', 'role', 'isActive', 'createdAt', 'lastLogin'],
            order: [['createdAt', 'DESC']]
        });
        res.json(usersList);
    } catch (error) {
        console.error('❌ Ошибка получения списка пользователей:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// API для создания пользователя (только для администратора)
app.post('/api/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { email, role } = req.body;
        
        if (!email || !role) {
            return res.status(400).json({ error: 'Email и роль обязательны' });
        }

        // Проверяем, существует ли пользователь
        const existingUser = await User.findOne({
            where: { email: email.toLowerCase().trim() }
        });
        if (existingUser) {
            return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
        }

        // Генерируем случайный пароль
        const password = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await User.create({
            email: email.toLowerCase().trim(),
            role: role,
            password: hashedPassword,
            isActive: true
        });

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
app.put('/api/users/:id/toggle-status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findByPk(userId);
        
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        await user.update({ isActive: !user.isActive });

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
    } catch (error) {
        console.error('❌ Ошибка изменения статуса пользователя:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// API для удаления пользователя
app.delete('/api/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        
        if (req.user.id === userId) {
            return res.status(400).json({ error: 'Нельзя удалить свой аккаунт' });
        }

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        await user.destroy();

        res.json({ success: true, message: 'Пользователь удален' });
    } catch (error) {
        console.error('❌ Ошибка удаления пользователя:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
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

        const user = await User.findByPk(userId);
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
        await user.update({ password: hashedPassword });

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

// Инициализируем базу данных при запуске сервера
initializeDatabase().then(success => {
  if (success) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Сервер запущен на порту ${PORT}`);
      console.log(`📁 Обслуживание статических файлов из: ${__dirname}`);
      console.log(`🌐 Приложение доступно по адресу: http://localhost:${PORT}`);
      console.log(`🗄️ Используется база данных вместо JSON файлов`);
    });
  } else {
    console.error('❌ Не удалось инициализировать базу данных. Сервер не запущен.');
    process.exit(1);
  }
});

module.exports = app;