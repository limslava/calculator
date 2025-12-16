# Настройка базы данных для логистического калькулятора

## Обзор

Приложение использует PostgreSQL базу данных для хранения всех данных. Все данные создаются автоматически при инициализации базы данных.

## Требования

- PostgreSQL 12+ (локально или облачная база данных)
- Переменные окружения для подключения к базе данных

## Настройка базы данных

### 1. Локальная установка PostgreSQL

```bash
# Установка PostgreSQL (macOS)
brew install postgresql
brew services start postgresql

# Создание базы данных
createdb logistics_calculator
```

### 2. Облачная база данных (рекомендуется для продакшена)

Используйте любой облачный провайдер:
- PostgreSQL на Amvera
- Amazon RDS
- Google Cloud SQL
- Azure Database for PostgreSQL
- Heroku PostgreSQL

### 3. Переменные окружения

Создайте файл `.env` в корне проекта:

```env
# База данных
DATABASE_URL=postgresql://username:password@localhost:5432/logistics_calculator

# JWT секрет
JWT_SECRET=your-very-secure-jwt-secret-key

# Окружение
NODE_ENV=development
```

Или установите переменные окружения в панели управления Amvera.

## Инициализация базы данных

### Автоматическая инициализация

При запуске сервера база данных автоматически инициализируется:

```bash
npm start
```

Это создаст:
- Таблицы базы данных
- Администратора по умолчанию (admin@logistics.com / admin123)
- Начальные данные для всех типов логистики
- Пустые наборы данных для морских, железнодорожных и прямых перевозок
- Начальные тарифные данные

### Ручная инициализация

```bash
npm run db:init
```

### Сброс базы данных

```bash
npm run db:reset
```

**Внимание**: Это пересоздаст все таблицы и данные!

## Скрипты управления базой данных

- `npm run db:init` - Инициализация базы данных
- `npm run db:reset` - Сброс базы данных (осторожно!)

## Структура базы данных

### Таблицы

1. **users** - Пользователи системы
   - id (UUID)
   - email (string)
   - password (string)
   - role (enum: admin, purchaser, sales)
   - isActive (boolean)
   - lastLogin (datetime)
   - createdAt (datetime)
   - updatedAt (datetime)

2. **sea_data** - Данные морских перевозок
   - id (UUID)
   - data (JSONB)
   - lastUpdate (datetime)
   - count (integer)

3. **rail_data** - Данные железнодорожных перевозок
   - id (UUID)
   - data (JSONB)
   - lastUpdate (datetime)
   - count (integer)

4. **direct_rail_data** - Данные прямых железнодорожных перевозок
   - id (UUID)
   - data (JSONB)
   - lastUpdate (datetime)
   - count (integer)

5. **direct_sea_data** - Данные прямых морских перевозок
   - id (UUID)
   - data (JSONB)
   - lastUpdate (datetime)
   - count (integer)

6. **tariff_data** - Тарифные данные
   - id (UUID)
   - data (JSONB)
   - lastUpdate (datetime)
   - count (integer)

## Начальные данные

При инициализации создаются:

### Пользователи
- Администратор: admin@logistics.com / admin123

### Данные логистики
- Пустые массивы для морских, железнодорожных и прямых перевозок
- Начальные тарифные данные:
  - VTT: 5000
  - PRR20: 2000

## Резервное копирование

### Экспорт данных

```sql
-- Экспорт пользователей
COPY (SELECT * FROM users) TO '/tmp/users_backup.csv' WITH CSV HEADER;

-- Экспорт данных логистики
COPY (SELECT * FROM sea_data) TO '/tmp/sea_data_backup.csv' WITH CSV HEADER;
-- Повторить для других таблиц
```

### Импорт данных

```sql
-- Импорт пользователей
COPY users FROM '/tmp/users_backup.csv' WITH CSV HEADER;

-- Импорт данных логистики
COPY sea_data FROM '/tmp/sea_data_backup.csv' WITH CSV HEADER;
```

## Устранение неисправностей

### Ошибка подключения к базе данных

1. Проверьте переменные окружения `DATABASE_URL`
2. Убедитесь, что база данных запущена
3. Проверьте права доступа пользователя

### Ошибка инициализации данных

1. Проверьте подключение к базе данных
2. Убедитесь, что база данных пустая или таблицы могут быть созданы
3. Проверьте права на создание таблиц

### Потеря данных

Если данные были потеряны, восстановите их из резервной копии или переинициализируйте базу данных.

## Производительность

- Используются индексы для быстрого поиска пользователей по email
- JSONB формат для эффективного хранения данных логистики
- Подключение к базе данных с пулом соединений

## Безопасность

- Пароли хешируются с помощью bcrypt
- JWT токены для аутентификации
- SQL инъекции предотвращаются с помощью Sequelize ORM
- SSL подключения для облачных баз данных