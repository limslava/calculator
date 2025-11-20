// Скрипт для сброса данных пользователей и восстановления администратора
console.log('🔄 Сброс данных пользователей и восстановление администратора...');

// Очищаем localStorage
localStorage.removeItem('logistics_users');
localStorage.removeItem('current_user');
localStorage.removeItem('sent_emails');

console.log('✅ localStorage очищен');

// Создаем нового администратора с правильной ролью
const adminUser = {
    id: Date.now().toString(),
    email: 'admin@logistics.com',
    role: 'admin', // Правильная роль администратора
    password: btoa('admin123'), // Пароль в base64
    isActive: true,
    createdAt: new Date().toISOString(),
    lastLogin: null
};

// Сохраняем пользователей в localStorage
const users = [adminUser];
localStorage.setItem('logistics_users', JSON.stringify(users));

console.log('✅ Администратор восстановлен:');
console.log('   Логин: admin@logistics.com');
console.log('   Пароль: admin123');
console.log('   Роль: admin');

// Проверяем сохранение
const savedUsers = JSON.parse(localStorage.getItem('logistics_users') || '[]');
console.log('📊 Проверка сохраненных пользователей:', savedUsers);

alert('✅ Администратор восстановлен!\n\nЛогин: admin@logistics.com\nПароль: admin123\n\nОбновите страницу для входа.');