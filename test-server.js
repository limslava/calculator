const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Простой healthcheck
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Test server is running'
  });
});

// Простой маршрут
app.get('/', (req, res) => {
  res.send('Test server is working!');
});

// Запуск сервера
console.log('=== TEST SERVER STARTING ===');
console.log(`Port: ${PORT}`);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Test server running on port ${PORT}`);
});