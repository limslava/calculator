const { Sequelize } = require('sequelize');

// Конфигурация подключения к базе данных
const sequelize = new Sequelize(
  process.env.DATABASE_URL || 'postgresql://localhost:5432/logistics_calculator',
  {
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 60000,
      idle: 10000
    },
    dialectOptions: {
      ssl: process.env.NODE_ENV === 'production' ? {
        require: true,
        rejectUnauthorized: false
      } : false
    },
    retry: {
      max: 3,
      timeout: 30000
    }
  }
);

// Функция для тестирования подключения
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('✅ Подключение к базе данных установлено успешно');
    return true;
  } catch (error) {
    console.error('❌ Ошибка подключения к базе данных:', error.message);
    return false;
  }
}

// Функция для синхронизации моделей с базой данных
async function syncDatabase(force = false) {
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
  syncDatabase
};