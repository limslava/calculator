const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 80;

// Middleware для безопасности
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrcAttr: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  }
}));

// Middleware для сжатия
app.use(compression());

// Обслуживание статических файлов
app.use(express.static(path.join(__dirname)));

// Прокси для получения курса ЦБ РФ
app.get('/api/exchange-rate', async (req, res) => {
    try {
        console.log('🔄 Получение курса ЦБ РФ через прокси...');
        const response = await fetch('https://www.cbr.ru/currency_base/daily/');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const html = await response.text();
        
        // Парсим курс USD из HTML
        const usdMatch = html.match(/<td>840<\/td>\s*<td>USD<\/td>\s*<td>1<\/td>\s*<td>Доллар США<\/td>\s*<td>(\d+,\d+)<\/td>/);
        if (usdMatch && usdMatch[1]) {
            const rate = parseFloat(usdMatch[1].replace(',', '.'));
            console.log('✅ Курс ЦБ РФ получен:', rate);
            res.json({ success: true, rate: rate });
        } else {
            throw new Error('Не удалось найти курс USD в HTML');
        }
    } catch (error) {
        console.error('❌ Ошибка получения курса:', error);
        res.json({ success: false, error: error.message });
    }
});

// Healthcheck endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Маршрут для главной страницы
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Обработка всех маршрутов для SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Обработчик ошибок
app.use((err, req, res, next) => {
  console.error('Ошибка сервера:', err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📁 Обслуживание статических файлов из: ${__dirname}`);
  console.log(`🌐 Приложение доступно по адресу: http://localhost:${PORT}`);
});

module.exports = app;