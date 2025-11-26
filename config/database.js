const { Sequelize } = require('sequelize');

// Функция для парсинга DATABASE_URL с улучшенной обработкой ошибок
function getDatabaseConfig() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL не установлен в переменных окружения');
    console.log('🔧 Проверьте настройки в Amvera Console -> Переменные окружения');
    return null;
  }

  try {
    const url = new URL(databaseUrl);
    console.log('🔧 Конфигурация БД из DATABASE_URL:');
    console.log(`   Host: ${url.hostname}`);
    console.log(`   Port: ${url.port}`);
    console.log(`   Database: ${url.pathname.substring(1)}`);
    console.log(`   Username: ${url.username}`);
    
    return {
      database: url.pathname.substring(1),
      username: url.username,
      password: url.password,
      host: url.hostname,
      port: url.port,
      dialect: 'postgres',
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: {
        max: 10,
        min: 0,
        acquire: 60000,
        idle: 10000
      },
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      },
      retry: {
        max: 5,
        timeout: 30000,
        match: [
          /ConnectionError/,
          /SequelizeConnectionError/,
          /ECONNREFUSED/,
          /ETIMEDOUT/
        ]
      }
    };
  } catch (error) {
    console.error('❌ Ошибка парсинга DATABASE_URL:', error.message);
    console.error('🔧 DATABASE_URL value:', databaseUrl);
    return null;
  }
}

const dbConfig = getDatabaseConfig();
let sequelize = null;

if (dbConfig) {
  sequelize = new Sequelize(dbConfig);
  
  // Тестируем подключение при инициализации
  (async () => {
    try {
      await sequelize.authenticate();
      console.log('✅ Подключение к базе данных установлено успешно');
    } catch (error) {
      console.error('❌ Ошибка подключения к базе данных при инициализации:', error.message);
    }
  })();
} else {
  console.log('⚠️ База данных не будет использоваться из-за ошибки конфигурации');
}

// Функция для тестирования подключения с повторными попытками
async function testConnection(maxRetries = 3, delay = 5000) {
  if (!sequelize) {
    console.error('❌ Sequelize не инициализирован - DATABASE_URL не настроен');
    return false;
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await sequelize.authenticate();
      console.log('✅ Подключение к базе данных установлено успешно');
      return true;
    } catch (error) {
      console.error(`❌ Ошибка подключения к базе данных (попытка ${attempt}/${maxRetries}):`, error.message);
      
      if (attempt < maxRetries) {
        console.log(`🔄 Повторная попытка через ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('🔧 Детали ошибки подключения:', error);
        return false;
      }
    }
  }
}

// Функция для синхронизации моделей с базой данных
async function syncDatabase(force = false) {
  if (!sequelize) {
    console.error('❌ Sequelize не инициализирован');
    return false;
  }

  try {
    await sequelize.sync({ force });
    console.log('✅ База данных синхронизирована');
    return true;
  } catch (error) {
    console.error('❌ Ошибка синхронизации базы данных:', error);
    return false;
  }
}

module.exports = {
  sequelize,
  testConnection,
  syncDatabase,
  getDatabaseConfig
};