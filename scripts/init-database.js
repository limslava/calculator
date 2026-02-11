require('dotenv').config();
const { sequelize, testConnection, syncDatabase } = require('../config/database');
const { User, SeaData, RailData, DirectRailData, DirectSeaData, TariffData } = require('../models');
const bcrypt = require('bcryptjs');

// Начальные данные для логистики
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

async function initializeDatabase() {
  console.log('🚀 Инициализация базы данных...');
  
  try {
    // Тестируем подключение к базе данных
    const isConnected = await testConnection();
    if (!isConnected) {
      console.error('❌ Не удалось подключиться к базе данных');
      process.exit(1);
    }

    // Синхронизируем базу данных
    console.log('🔄 Синхронизация базы данных...');
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

    // Создаем начальные данные для логистики
    console.log('📊 Создание начальных данных логистики...');
    
    // Sea data
    const seaDataExists = await SeaData.findOne();
    if (!seaDataExists) {
      await SeaData.create({
        data: initialData.sea,
        lastUpdate: new Date(),
        count: initialData.sea.length
      });
      console.log('✅ Созданы начальные данные для морских перевозок');
    }

    // Rail data
    const railDataExists = await RailData.findOne();
    if (!railDataExists) {
      await RailData.create({
        data: initialData.rail,
        lastUpdate: new Date(),
        count: initialData.rail.length
      });
      console.log('✅ Созданы начальные данные для железнодорожных перевозок');
    }

    // Direct rail data
    const directRailDataExists = await DirectRailData.findOne();
    if (!directRailDataExists) {
      await DirectRailData.create({
        data: initialData.direct_rail,
        lastUpdate: new Date(),
        count: initialData.direct_rail.length
      });
      console.log('✅ Созданы начальные данные для прямых железнодорожных перевозок');
    }

    // Direct sea data
    const directSeaDataExists = await DirectSeaData.findOne();
    if (!directSeaDataExists) {
      await DirectSeaData.create({
        data: initialData.direct_sea,
        lastUpdate: new Date(),
        count: initialData.direct_sea.length
      });
      console.log('✅ Созданы начальные данные для прямых морских перевозок');
    }

    // Tariff data
    const tariffDataExists = await TariffData.findOne();
    if (!tariffDataExists) {
      await TariffData.create({
        data: initialData.tariff,
        lastUpdate: new Date(),
        count: initialData.tariff.length
      });
      console.log('✅ Созданы начальные тарифные данные');
    }

    const userCount = await User.count();
    console.log(`📊 Всего пользователей в базе данных: ${userCount}`);
    
    console.log('✅ База данных успешно инициализирована с начальными данными');
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка инициализации базы данных:', error);
    process.exit(1);
  }
}

// Запуск инициализации
initializeDatabase();