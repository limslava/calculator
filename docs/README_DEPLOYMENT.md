# Калькулятор ставок в логистике - Развертывание

## 🚀 Быстрый старт

Проект готов к развертыванию на Amvera. Репозиторий: https://github.com/limslava/calculator

### Шаги для развертывания:

1. **Перейдите в Amvera Console:**
   - https://cloud.amvera.ru
   - Авторизуйтесь в системе

2. **Создайте новый проект:**
   - Нажмите "Создать проект"
   - Выберите "Из Git репозитория"
   - Укажите URL: `https://github.com/limslava/calculator`

3. **Настройте проект:**
   - Amvera автоматически обнаружит конфигурационные файлы
   - Проверьте настройки в [`amvera.yml`](amvera.yml:1)

4. **Запустите развертывание:**
   - Нажмите "Deploy"
   - Дождитесь завершения процесса

5. **Проверьте приложение:**
   - Откройте предоставленный Amvera URL
   - Убедитесь, что приложение работает корректно

## 📁 Структура проекта для развертывания

```
calculator/
├── .github/workflows/deploy-amvera.yml  # GitHub Actions для CI/CD
├── amvera.yml                           # Конфигурация Amvera
├── Dockerfile                           # Конфигурация Docker
├── package.json                         # Зависимости Node.js
├── server.js                            # Express сервер
├── index.html                           # Главная страница
├── styles.css                           # Стили
├── script.js                            # Основная логика
├── utils.js                             # Утилиты
├── sea.js                               # Модуль морских перевозок
├── direct-rail.js                       # Модуль прямого ЖД
├── direct-sea.js                        # Модуль прямого моря
├── template-*.xlsx                      # Шаблоны Excel файлов
└── README_DEPLOYMENT.md                 # Эта инструкция
```

## 🔧 Технические детали

### Конфигурация Amvera ([`amvera.yml`](amvera.yml:1))
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

### Конфигурация Docker ([`Dockerfile`](Dockerfile:1))
- Базовый образ: Node.js 18 Alpine
- Рабочая директория: /app
- Пользователь: nextjs (безопасность)
- Порт: 3001

### Сервер ([`server.js`](server.js:1))
- Express сервер для статических файлов
- Настройки безопасности с Helmet
- Сжатие данных с Compression
- Content Security Policy

## 🧪 Локальное тестирование

```bash
# Клонируйте репозиторий
git clone https://github.com/limslava/calculator
cd calculator

# Установите зависимости
npm install

# Запустите сервер
npm start

# Откройте в браузере: http://localhost:3001
```

## 📊 Мониторинг

После развертывания в Amvera Console доступны:
- Логи приложения
- Мониторинг ресурсов (CPU, память)
- Health checks
- Метрики производительности

## 🔄 Обновление приложения

Для обновления приложения:
1. Внесите изменения в код
2. Загрузите изменения в репозиторий:
   ```bash
   git add .
   git commit -m "Описание изменений"
   git push origin main
   ```
3. Amvera автоматически пересоберет и развернет новую версию

## 🛠️ Устранение неполадок

Если приложение не запускается:
1. Проверьте логи в Amvera Console
2. Убедитесь, что все файлы загружены в репозиторий
3. Проверьте корректность [`amvera.yml`](amvera.yml:1)
4. Убедитесь, что порт 3001 доступен

## 📞 Поддержка

Для технической поддержки обратитесь к разработчикам проекта.

---

**Репозиторий:** https://github.com/limslava/calculator  
**Amvera Console:** https://cloud.amvera.ru