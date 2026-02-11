const express = require('express');

function extractUsdRate(html) {
  const usdMatch = html.match(/<td>840<\/td>\s*<td>USD<\/td>\s*<td>1<\/td>\s*<td>Доллар США<\/td>\s*<td>(\d+,\d+)<\/td>/);
  if (usdMatch && usdMatch[1]) {
    return parseFloat(usdMatch[1].replace(',', '.'));
  }

  const alternativeMatch = html.match(/USD.*?(\d+,\d+)/);
  if (alternativeMatch && alternativeMatch[1]) {
    return parseFloat(alternativeMatch[1].replace(',', '.'));
  }

  return null;
}

function createExchangeRateRouter() {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      console.log('🔄 Получение курса ЦБ РФ через прокси...');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const response = await fetch('https://www.cbr.ru/currency_base/daily/', {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();
      const rate = extractUsdRate(html);
      if (!rate) {
        throw new Error('Не удалось найти курс USD в HTML');
      }

      console.log('✅ Курс ЦБ РФ получен:', rate);
      res.json({ success: true, rate });
    } catch (error) {
      console.error('❌ Ошибка получения курса:', error);
      res.json({
        success: false,
        error: error.message,
        fallbackRate: 90.0
      });
    }
  });

  return router;
}

module.exports = {
  createExchangeRateRouter
};
