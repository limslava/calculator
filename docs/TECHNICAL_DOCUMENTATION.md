# 📚 Техническая документация

## Архитектура приложения

### Общая структура
Приложение представляет собой SPA (Single Page Application) на Node.js с клиентской частью на чистом JavaScript.

### Компоненты системы

#### Серверная часть
- **Node.js + Express** - сервер для обслуживания статических файлов
- **Helmet** - настройки безопасности заголовков
- **Compression** - сжатие данных Gzip
- **Content Security Policy** - политика безопасности контента

#### Клиентская часть
- **HTML/CSS/JavaScript** - чистый фронтенд без фреймворков
- **SheetJS (XLSX)** - обработка Excel файлов
- **localStorage** - хранение данных в браузере
- **Fetch API** - получение курса ЦБ РФ

#### Модули расчета
- **Морские перевозки** ([`sea.js`](sea.js:1))
- **Железнодорожные перевозки** ([`rail.js`](rail.js:1))
- **Прямые морские перевозки** ([`direct-sea.js`](direct-sea.js:1))
- **Прямые ЖД перевозки** ([`direct-rail.js`](direct-rail.js:1))

## Функциональность

### Роли пользователей
- **Администратор** - полный доступ, управление пользователями
- **Менеджер по закупкам** - доступ к интерфейсу закупок
- **Менеджер по продажам** - доступ к интерфейсу продаж

### Типы перевозок
1. **Море** - морские контейнерные перевозки
2. **ЖД** - железнодорожные перевозки
3. **Прямое ЖД** - прямые железнодорожные перевозки
4. **Прямое море** - прямые морские перевозки
5. **Море+ЖД** - комбинированные перевозки

### Формат данных
- **Excel файлы** с определенной структурой столбцов
- **Автоматический поиск** по параметрам перевозки
- **Расчет ставок** на основе загруженных данных

## Конфигурационные файлы

### Amvera ([`amvera.yml`](amvera.yml:1))
```yaml
name: logistics-calculator
services:
  web:
    build: .
    ports:
      - 3000:3001    # Внешний порт:3000 → внутренний порт:3001
    environment:
      - NODE_ENV=production
      - PORT=3001
    resources:
      memory: 512Mi
      cpu: 500m
```

### Docker ([`Dockerfile`](Dockerfile:1))
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
USER nextjs
EXPOSE 3001
CMD ["node", "server.js"]
```

### Сервер ([`server.js`](server.js:1))
```javascript
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware безопасности
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://www.cbr-xml-daily.ru"]
        }
    }
}));

app.use(compression());
app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
```

## API интеграции

### Курс ЦБ РФ
Приложение автоматически получает курс USD через публичное API:

```javascript
async function getExchangeRate() {
    try {
        const response = await fetch('https://www.cbr-xml-daily.ru/daily_json.js');
        const data = await response.json();
        return data.Valute.USD.Value;
    } catch (error) {
        console.error('Ошибка получения курса:', error);
        return 90; // Значение по умолчанию
    }
}
```

## Безопасность

### Content Security Policy
Настроена политика безопасности для предотвращения XSS атак:

```javascript
contentSecurityPolicy: {
    directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://www.cbr-xml-daily.ru"]
    }
}
```

### Аутентификация
- Хранение паролей в зашифрованном виде (base64)
- Проверка ролей при доступе к интерфейсам
- Сессии через localStorage

## Хранение данных

### localStorage структура
```javascript
{
    "logistics_users": [ // Список пользователей
        {
            "id": "timestamp",
            "email": "user@example.com",
            "role": "admin|purchaser|sales",
            "password": "base64_encoded",
            "isActive": true,
            "createdAt": "ISO_date",
            "lastLogin": "ISO_date"
        }
    ],
    "current_user": { // Текущая сессия
        "id": "user_id",
        "email": "user@example.com",
        "role": "user_role"
    },
    "sent_emails": [ // История отправленных email
        {
            "to": "user@example.com",
            "subject": "Тема",
            "sentAt": "ISO_date"
        }
    ]
}
```

## Модули расчета ставок

### Структура модуля
Каждый модуль расчета экспортирует объект с методами:

```javascript
module.exports = {
    name: "Название модуля",
    templateFile: "template-file.xlsx",
    calculate: function(data, params) {
        // Логика расчета
        return result;
    },
    validate: function(data) {
        // Валидация данных
        return isValid;
    }
};
```

### Параметры расчета
- **Тип контейнера** (20ft, 40ft, 40ft HQ)
- **Порт отправления/назначения**
- **Вес груза**
- **Дополнительные услуги**

## Технические требования

### Системные требования
- **Node.js:** версия 18 или выше
- **Память:** минимум 512MB
- **Порты:** 3001 (внутренний), 3000 (внешний)

### Браузерная поддержка
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

### Зависимости
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "helmet": "^7.1.0",
    "compression": "^1.7.4"
  }
}
```

## Мониторинг и логи

### Логирование
Приложение использует консольное логирование с префиксами:

```javascript
console.log('✅ Успешная операция');
console.log('⚠️ Предупреждение');
console.log('❌ Ошибка');
console.log('🔐 Действие аутентификации');
console.log('📧 Отправка email');
```

### Health checks
Amvera автоматически проверяет доступность приложения через порт 3001.

## Разработка

### Локальная разработка
```bash
# Установка зависимостей
npm install

# Запуск в режиме разработки
npm run dev

# Запуск продакшн версии
npm start
```

### Структура проекта
```
├── modules/           # Модули расчета
├── interfaces/        # HTML интерфейсы
├── scripts/          # JavaScript файлы
├── templates/        # Шаблоны Excel
├── data/            # Тестовые данные
├── config/          # Конфигурационные файлы
└── docs/            # Документация
```

## Устранение неполадок

### Частые проблемы
1. **Не загружаются Excel файлы** - проверьте структуру файла
2. **Не работает расчет** - проверьте наличие данных в localStorage
3. **Ошибка авторизации** - используйте страницу сброса администратора
4. **Не приходят email** - проверьте настройки SMTP

### Отладка
Используйте консоль разработчика (F12) для просмотра логов и проверки данных в localStorage.

---

## Заключение

Приложение представляет собой полнофункциональную систему расчета логистических ставок с современной архитектурой и надежной системой безопасности. Все компоненты спроектированы для легкого развертывания и масштабирования.