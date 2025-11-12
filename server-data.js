// Серверное хранилище данных для логистического калькулятора
const fs = require('fs');
const path = require('path');

class DataStorage {
    constructor() {
        // Используем /data для Amvera persistenceMount или локальную папку
        this.dataDir = process.env.NODE_ENV === 'production' ? '/data' : path.join(__dirname, 'data');
        this.ensureDataDir();
    }

    ensureDataDir() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }

    getFilePath(dbType) {
        return path.join(this.dataDir, `${dbType}.json`);
    }

    saveData(dbType, data) {
        try {
            const filePath = this.getFilePath(dbType);
            const dataToSave = {
                data: data,
                lastUpdate: new Date().toISOString(),
                count: data.length
            };
            fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));
            console.log(`✅ Данные сохранены для ${dbType}: ${data.length} записей`);
            return true;
        } catch (error) {
            console.error(`❌ Ошибка сохранения данных для ${dbType}:`, error);
            return false;
        }
    }

    loadData(dbType) {
        try {
            const filePath = this.getFilePath(dbType);
            if (!fs.existsSync(filePath)) {
                console.log(`⚠️ Файл данных для ${dbType} не найден`);
                return { data: [], lastUpdate: null, count: 0 };
            }
            
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const parsedData = JSON.parse(fileContent);
            console.log(`✅ Данные загружены для ${dbType}: ${parsedData.count} записей`);
            return parsedData;
        } catch (error) {
            console.error(`❌ Ошибка загрузки данных для ${dbType}:`, error);
            return { data: [], lastUpdate: null, count: 0 };
        }
    }

    getAllData() {
        const dbTypes = ['sea', 'rail', 'direct_rail', 'direct_sea'];
        const result = {};
        
        dbTypes.forEach(dbType => {
            result[dbType] = this.loadData(dbType);
        });
        
        return result;
    }

    getLastUpdate(dbType) {
        const data = this.loadData(dbType);
        return data.lastUpdate;
    }
}

module.exports = DataStorage;