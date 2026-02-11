// Загрузка переменных окружения
require('dotenv').config();
if (process.env.NODE_ENV === 'production') {
  require('dotenv').config({ path: '.env.production' });
}

const isServerDebug = process.env.DEBUG_LOGS === 'true';
if (process.env.NODE_ENV === 'production' && !isServerDebug) {
  console.log = () => {};
}

console.log('=== ENV DEBUG INFO ===');
console.log(`🔧 NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`🔧 DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
console.log(`🔧 PORT: ${process.env.PORT}`);
console.log(`🔧 JWT_SECRET: ${process.env.JWT_SECRET ? 'SET' : 'NOT SET'}`);
console.log('======================');

const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');

const DataStorage = require('./server-data');
const { sequelize, testConnection, syncDatabase } = require('./config/database');
const { User, UploadHistory, UploadData, Op } = require('./models');

const { createAuthMiddleware } = require('./server/middleware/auth');
const { initializeDatabase } = require('./server/services/database-init');
const { createExchangeRateRouter } = require('./server/routes/exchange-rate');
const { createDataRouter } = require('./server/routes/data');
const { createEmailRouter } = require('./server/routes/email');
const { createAuthRouter } = require('./server/routes/auth');
const { createUsersRouter } = require('./server/routes/users');
const { createUploadHistoryRouter } = require('./server/routes/upload-history');
const { createSystemRouter } = require('./server/routes/system');

const app = express();
const PORT = process.env.PORT || 3000;
const dataStorage = new DataStorage();
const JWT_SECRET = process.env.JWT_SECRET || (require.main === module ? '' : 'internal-test-secret');
if (!JWT_SECRET && require.main === module) {
  console.error('❌ JWT_SECRET не задан. Добавьте JWT_SECRET в .env');
  process.exit(1);
}

const { authenticateToken, requireAdmin } = createAuthMiddleware(JWT_SECRET);

app.use(express.json({ limit: '10mb' }));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
      scriptSrcAttr: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
      styleSrcElem: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'https://cdnjs.cloudflare.com', 'data:'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'"]
    }
  }
}));

app.use(compression());

const appDist = path.join(__dirname, 'app', 'dist');
app.use('/app', express.static(appDist));

// Redirect root to the new React app (legacy UI remains доступен по /index.html)
app.get('/', (req, res) => {
  res.redirect('/app/');
});

app.use(express.static(path.join(__dirname)));

app.use('/api/exchange-rate', createExchangeRateRouter());
app.use('/api/data', createDataRouter({
  dataStorage,
  authenticateToken,
  UploadHistory,
  UploadData
}));
app.use('/api/send-email', createEmailRouter({ authenticateToken }));
app.use('/api/auth', createAuthRouter({
  User,
  jwtSecret: JWT_SECRET,
  authenticateToken
}));
app.use('/api/users', createUsersRouter({
  User,
  authenticateToken,
  requireAdmin
}));
app.use('/api', createUploadHistoryRouter({
  UploadHistory,
  UploadData,
  User,
  Op,
  sequelize,
  authenticateToken,
  requireAdmin
}));

app.use(createSystemRouter(__dirname));

app.get('/app/*', (req, res) => {
  res.sendFile(path.join(appDist, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Ошибка сервера:', err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

async function startServer() {
  console.log('=== DEBUG INFO ===');
  console.log(`🔧 Переменная окружения PORT: ${process.env.PORT}`);
  console.log(`🔧 Используемый порт: ${PORT}`);
  console.log('==================');

  const success = await initializeDatabase({ testConnection, syncDatabase, User });
  if (!success) {
    console.error('❌ Не удалось инициализировать базу данных. Сервер не запущен.');
    process.exit(1);
  }

  return app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📁 Обслуживание статических файлов из: ${__dirname}`);
    console.log(`🌐 Приложение доступно по адресу: http://localhost:${PORT}`);
    console.log('🗄️ Используется база данных вместо JSON файлов');
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
