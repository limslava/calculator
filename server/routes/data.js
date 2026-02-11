const express = require('express');

function createDataRouter({ dataStorage, authenticateToken, UploadHistory, UploadData }) {
  const router = express.Router();

  router.get('/:dbType', authenticateToken, async (req, res) => {
    try {
      const { dbType } = req.params;
      const data = await dataStorage.loadData(dbType);
      res.json(data);
    } catch (error) {
      console.error('❌ Ошибка получения данных:', error);
      res.status(500).json({ error: 'Ошибка получения данных' });
    }
  });

  router.post('/:dbType', authenticateToken, async (req, res) => {
    try {
      const { dbType } = req.params;
      const { data } = req.body;

      if (!data) {
        return res.status(400).json({ error: 'Данные не предоставлены' });
      }

      const allowedRoles = ['admin', 'purchaser'];
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Недостаточно прав для сохранения данных' });
      }

      const success = await dataStorage.saveData(dbType, data);
      if (!success) {
        return res.status(500).json({ error: 'Ошибка сохранения данных' });
      }

      console.log(`✅ Данные сохранены пользователем ${req.user.email} для ${dbType}: ${data.length} записей`);

      try {
        const previewData = data.slice(0, 5);
        const uploadHistory = await UploadHistory.create({
          dataType: dbType,
          userId: req.user.id,
          userEmail: req.user.email,
          recordCount: data.length,
          previewData,
          uploadedAt: new Date()
        });

        await UploadData.create({
          uploadHistoryId: uploadHistory.id,
          dataType: dbType,
          fullData: data,
          recordCount: data.length,
          uploadedAt: new Date()
        });

        console.log(`📝 Запись добавлена в историю загрузки для ${dbType} с полными данными`);
      } catch (historyError) {
        console.error('❌ Ошибка сохранения истории загрузки:', historyError);
      }

      return res.json({ success: true, message: 'Данные сохранены', count: data.length });
    } catch (error) {
      console.error('❌ Ошибка сохранения данных:', error);
      return res.status(500).json({ error: 'Ошибка сохранения данных' });
    }
  });

  router.get('/', authenticateToken, async (req, res) => {
    try {
      const allData = await dataStorage.getAllData();
      res.json(allData);
    } catch (error) {
      console.error('❌ Ошибка получения всех данных:', error);
      res.status(500).json({ error: 'Ошибка получения данных' });
    }
  });

  return router;
}

module.exports = {
  createDataRouter
};
