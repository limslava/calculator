const { Sequelize } = require('sequelize');

// Конфигурация подключения к базе данных
const sequelize = new Sequelize(
  process.env.DATABASE_URL || 'postgresql://localhost:5432/logistics_calculator',
  {
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: process.env.NODE_ENV === 'production' ? {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    } : {}
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