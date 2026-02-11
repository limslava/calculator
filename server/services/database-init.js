const bcrypt = require('bcryptjs');

async function createInitialLogisticsData() {
  try {
    const {
      SeaData,
      RailData,
      DirectRailData,
      DirectSeaData,
      TariffData,
      AgentTariffData
    } = require('../../models');

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
      ],
      agent_tariff: []
    };

    const models = [
      { model: SeaData, type: 'sea', name: 'морских перевозок' },
      { model: RailData, type: 'rail', name: 'железнодорожных перевозок' },
      { model: DirectRailData, type: 'direct_rail', name: 'прямых железнодорожных перевозок' },
      { model: DirectSeaData, type: 'direct_sea', name: 'прямых морских перевозок' },
      { model: TariffData, type: 'tariff', name: 'тарифных данных' },
      { model: AgentTariffData, type: 'agent_tariff', name: 'тарифных данных агентов' }
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

async function initializeDatabase({ testConnection, syncDatabase, User }) {
  try {
    console.log('🔄 Инициализация базы данных...');

    const isConnected = await testConnection();
    if (!isConnected) {
      console.error('❌ Не удалось подключиться к базе данных');
      console.log('⚠️ Приложение запускается в режиме только для чтения');
      return true;
    }

    await syncDatabase(false);

    // 🔧 Гарантируем наличие поля fullName в users (без миграций)
    try {
      await User.sequelize.query('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "fullName" VARCHAR(255);');
    } catch (migrationError) {
      console.error('❌ Ошибка добавления поля fullName:', migrationError);
    }

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

    await createInitialLogisticsData();

    const userCount = await User.count();
    console.log(`📊 Загружено пользователей из базы данных: ${userCount}`);
    return true;
  } catch (error) {
    console.error('❌ Ошибка инициализации базы данных:', error);
    console.log('⚠️ Приложение запускается в режиме только для чтения');
    return true;
  }
}

module.exports = {
  initializeDatabase
};
