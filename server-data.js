// Серверное хранилище данных для логистического калькулятора с поддержкой базы данных
const { 
  SeaData, 
  RailData, 
  DirectRailData, 
  DirectSeaData, 
  TariffData 
} = require('./models');

class DataStorage {
  constructor() {
    console.log('📊 Инициализация хранилища данных с базой данных');
  }

  // Получить модель по типу данных
  getModel(dbType) {
    const models = {
      'sea': SeaData,
      'rail': RailData,
      'direct_rail': DirectRailData,
      'direct_sea': DirectSeaData,
      'tariff': TariffData
    };
    
    return models[dbType];
  }

  // Проверить, является ли тип данных комплексным (не требует отдельной модели)
  isComplexType(dbType) {
    return dbType === 'complex';
  }

  async saveData(dbType, data) {
    try {
      // Для комплексного типа данных не сохраняем в базу
      if (this.isComplexType(dbType)) {
        console.log(`⚠️ Тип данных "${dbType}" не сохраняется в базу данных (комплексный расчет)`);
        return true;
      }

      const model = this.getModel(dbType);
      if (!model) {
        throw new Error(`Неизвестный тип данных: ${dbType}`);
      }

      // Находим существующую запись или создаем новую
      const [record, created] = await model.findOrCreate({
        where: {},
        defaults: {
          data: data,
          lastUpdate: new Date(),
          count: data.length
        }
      });

      if (!created) {
        // Обновляем существующую запись
        await record.update({
          data: data,
          lastUpdate: new Date(),
          count: data.length
        });
      }

      console.log(`✅ Данные сохранены в базу данных для ${dbType}: ${data.length} записей`);
      return true;
    } catch (error) {
      console.error(`❌ Ошибка сохранения данных для ${dbType}:`, error);
      return false;
    }
  }

  async loadData(dbType) {
    try {
      // Для комплексного типа данных возвращаем пустой массив
      if (this.isComplexType(dbType)) {
        console.log(`⚠️ Тип данных "${dbType}" не загружается из базы данных (комплексный расчет)`);
        return { data: [], lastUpdate: null, count: 0 };
      }

      const model = this.getModel(dbType);
      if (!model) {
        throw new Error(`Неизвестный тип данных: ${dbType}`);
      }

      const record = await model.findOne();
      
      if (!record) {
        console.log(`⚠️ Данные для ${dbType} не найдены в базе данных`);
        return { data: [], lastUpdate: null, count: 0 };
      }

      console.log(`✅ Данные загружены из базы данных для ${dbType}: ${record.count} записей`);
      return {
        data: record.data,
        lastUpdate: record.lastUpdate,
        count: record.count
      };
    } catch (error) {
      console.error(`❌ Ошибка загрузки данных для ${dbType}:`, error);
      return { data: [], lastUpdate: null, count: 0 };
    }
  }

  async getAllData() {
    const dbTypes = ['sea', 'rail', 'direct_rail', 'direct_sea', 'tariff'];
    const result = {};
    
    for (const dbType of dbTypes) {
      result[dbType] = await this.loadData(dbType);
    }
    
    return result;
  }

  async getLastUpdate(dbType) {
    const data = await this.loadData(dbType);
    return data.lastUpdate;
  }
}

module.exports = DataStorage;