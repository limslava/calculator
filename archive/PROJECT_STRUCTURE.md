# Структура проекта Logistics Calculator

## Основные файлы
```
├── 📄 index.html              # Главная страница приложения
├── 📄 server.js               # Основной сервер Node.js
├── 📄 server-data.js          # Модуль работы с данными
├── 📄 script.js               # Клиентский JavaScript
├── 📄 styles.css              # Стили приложения
├── 📄 package.json            # Зависимости и скрипты
├── 📄 Dockerfile              # Конфигурация Docker
├── 📄 amvera.yml              # Конфигурация для Amvera
├── 📄 .env.production         # Переменные окружения для продакшн
├── 📄 .dockerignore           # Исключения для Docker
├── 📄 .gitignore              # Исключения для Git
```

## Конфигурация
```
config/
├── 📄 auth.js                 # Настройки аутентификации
├── 📄 database.js             # Конфигурация PostgreSQL
└── 📄 email-config.js         # Настройки email
```

## Модели базы данных
```
models/
└── 📄 index.js                # Sequelize модели (User, SeaData, RailData, etc.)
```

## Интерфейсы
```
interfaces/
├── 📄 sales-interface.html    # Интерфейс для продаж
├── 📄 purchaser-interface.html # Интерфейс для закупок
└── 📄 reset-admin.html        # Сброс пароля администратора
```

## Скрипты
```
scripts/
├── 📄 auth-ui.js              # UI для аутентификации
├── 📄 init-database.js        # Инициализация базы данных
├── 📄 purchaser-script.js     # Логика закупок
├── 📄 reset-admin.js          # Сброс пароля
├── 📄 sales-script.js         # Логика продаж
├── 📄 server-auth.js          # Серверная аутентификация
└── 📄 utils.js                # Утилиты
```

## Модули расчета
```
modules/
├── 📄 direct-rail.js          # Расчет прямых ж/д перевозок
├── 📄 direct-sea.js           # Расчет прямых морских перевозок
├── 📄 rail.js                 # Расчет ж/д перевозок
└── 📄 sea.js                  # Расчет морских перевозок
```

## Документация
```
docs/
├── 📄 ADMIN_GUIDE.md          # Руководство администратора
├── 📄 COMPLEX_CALCULATIONS.md # Архитектура комплексных расчетов
├── 📄 DEPLOYMENT_GUIDE.md     # Руководство по развертыванию
├── 📄 POSTGRESQL_SETUP_GUIDE.md # Настройка PostgreSQL
└── 📄 TECHNICAL_DOCUMENTATION.md # Техническая документация
```

## Шаблоны Excel
```
templates/
├── 📄 template-direct-rail.xlsx
├── 📄 template-direct-sea.xlsx
├── 📄 template-rail.xlsx
└── 📄 template-sea.xlsx
```

## Дополнительные файлы
```
├── 📄 AMVERA_DEPLOYMENT.md    # Инструкция по развертыванию на Amvera
├── 📄 AMVERA_POSTGRESQL_GUIDE.md # Руководство по Amvera PostgreSQL
├── 📄 DATABASE_SETUP.md       # Настройка базы данных
├── 📄 IMPROVEMENT_SPEC.md     # Спецификация улучшений
└── 📄 test-update-display.html # Тестовая страница
```

## GitHub Actions
```
.github/
└── (workflows для CI/CD)
```

## Ключевые особенности архитектуры:
- **PostgreSQL** - основное хранилище данных
- **JWT аутентификация** - безопасный доступ
- **Sequelize ORM** - работа с базой данных
- **Express.js** - серверная часть
- **Модульная структура** - разделение логики расчетов
- **SPA интерфейс** - одностраничное приложение
- **Docker контейнеризация** - готовность к развертыванию