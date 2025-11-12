// Анализируем типы контейнеров в разных базах
const dbTypes = ['sea', 'rail', 'direct_rail', 'direct_sea'];

dbTypes.forEach(dbType => {
    const data = localStorage.getItem(`logistics_db_${dbType}`);
    if (data) {
        const parsed = JSON.parse(data);
        console.log(`\n📊 База: ${dbType} (${parsed.length} записей)`);
        
        if (parsed.length > 0) {
            const firstRecord = parsed[0];
            const containerFields = Object.keys(firstRecord).filter(key => 
                key.toLowerCase().includes('container') || 
                key.toLowerCase().includes('20') || 
                key.toLowerCase().includes('40') ||
                key.toLowerCase().includes('soc') ||
                key.toLowerCase().includes('dc') ||
                key.toLowerCase().includes('hc')
            );
            
            console.log('📦 Поля контейнеров:', containerFields);
            
            // Показываем уникальные значения для первых 5 записей
            console.log('🔍 Примеры значений:');
            parsed.slice(0, 3).forEach((item, i) => {
                const containerValues = {};
                containerFields.forEach(field => {
                    if (item[field] && item[field] > 0) {
                        containerValues[field] = item[field];
                    }
                });
                if (Object.keys(containerValues).length > 0) {
                    console.log(`  ${i+1}. `, containerValues);
                }
            });
        }
    } else {
        console.log(`\n❌ Нет данных для ${dbType}`);
    }
});