const express = require('express');

function buildDateWhere(dateFrom, dateTo, Op) {
  if (!dateFrom && !dateTo) return null;

  const uploadedAt = {};
  if (dateFrom) {
    uploadedAt[Op.gte] = new Date(dateFrom);
  }
  if (dateTo) {
    const endDate = new Date(dateTo);
    endDate.setDate(endDate.getDate() + 1);
    uploadedAt[Op.lt] = endDate;
  }
  return uploadedAt;
}

function createUploadHistoryRouter({
  UploadHistory,
  UploadData,
  User,
  Op,
  sequelize,
  authenticateToken,
  requireAdmin
}) {
  const router = express.Router();

  router.get('/upload-history', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { dataType, userId, dateFrom, dateTo, page = 1, limit = 20 } = req.query;

      const where = {};
      if (dataType && dataType !== 'all') where.dataType = dataType;
      if (userId) where.userId = userId;

      const dateWhere = buildDateWhere(dateFrom, dateTo, Op);
      if (dateWhere) where.uploadedAt = dateWhere;

      const parsedPage = parseInt(page, 10);
      const parsedLimit = parseInt(limit, 10);
      const offset = (parsedPage - 1) * parsedLimit;

      const { count, rows } = await UploadHistory.findAndCountAll({
        where,
        include: [{
          model: User,
          as: 'user',
          attributes: ['email', 'role']
        }],
        order: [['uploadedAt', 'DESC']],
        limit: parsedLimit,
        offset
      });

      return res.json({
        success: true,
        data: rows,
        pagination: {
          total: count,
          page: parsedPage,
          limit: parsedLimit,
          totalPages: Math.ceil(count / parsedLimit)
        }
      });
    } catch (error) {
      console.error('❌ Ошибка получения истории загрузки:', error);
      console.error('🔧 Детали ошибки:', error.message, error.stack);
      return res.status(500).json({ error: 'Ошибка получения истории загрузки', details: error.message });
    }
  });

  router.get('/upload-stats', authenticateToken, requireAdmin, async (req, res) => {
    const { dateFrom, dateTo } = req.query;
    const where = {};
    const dateWhere = buildDateWhere(dateFrom, dateTo, Op);
    if (dateWhere) where.uploadedAt = dateWhere;

    try {
      const stats = await UploadHistory.findAll({
        where,
        attributes: [
          'dataType',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('SUM', sequelize.col('recordCount')), 'totalRecords']
        ],
        group: ['dataType']
      });

      const recentUploads = await UploadHistory.findAll({
        where,
        include: [{
          model: User,
          as: 'user',
          attributes: ['email']
        }],
        order: [['uploadedAt', 'DESC']],
        limit: 5
      });

      const topUsers = await UploadHistory.findAll({
        where,
        attributes: [
          'userId',
          'userEmail',
          [sequelize.fn('COUNT', sequelize.col('id')), 'uploadCount'],
          [sequelize.fn('SUM', sequelize.col('recordCount')), 'totalRecords']
        ],
        group: ['userId', 'userEmail'],
        order: [[sequelize.literal('"uploadCount"'), 'DESC']],
        limit: 5
      });

      return res.json({
        success: true,
        stats,
        recentUploads,
        topUsers
      });
    } catch (error) {
      console.error('❌ Ошибка получения статистики загрузок:', error);
      console.error('🔧 Детали ошибки:', error.message, error.stack);
      console.error('🔧 Query params:', req.query);
      console.error('🔧 Where clause:', where);
      return res.status(500).json({ error: 'Ошибка получения статистики', details: error.message });
    }
  });

  router.get('/upload-history/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      const upload = await UploadHistory.findByPk(id, {
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['email', 'role']
          },
          {
            model: UploadData,
            as: 'uploadData',
            attributes: ['id', 'recordCount', 'uploadedAt']
          }
        ]
      });

      if (!upload) {
        return res.status(404).json({ error: 'Запись истории не найдена' });
      }

      return res.json({
        success: true,
        data: upload
      });
    } catch (error) {
      console.error('❌ Ошибка получения деталей загрузки:', error);
      console.error('🔧 Детали ошибки:', error.message, error.stack);
      return res.status(500).json({ error: 'Ошибка получения деталей загрузки', details: error.message });
    }
  });

  router.get('/upload-history/:id/full-data', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      const upload = await UploadHistory.findByPk(id, {
        include: [{
          model: User,
          as: 'user',
          attributes: ['email', 'role']
        }]
      });

      if (!upload) {
        return res.status(404).json({ error: 'Запись истории не найдена' });
      }

      const uploadData = await UploadData.findOne({
        where: { uploadHistoryId: id },
        attributes: ['id', 'fullData', 'recordCount', 'uploadedAt']
      });

      if (!uploadData) {
        return res.status(404).json({ error: 'Полные данные загрузки не найдены' });
      }

      return res.json({
        success: true,
        data: {
          uploadHistory: upload,
          fullData: uploadData.fullData,
          recordCount: uploadData.recordCount,
          uploadedAt: uploadData.uploadedAt
        }
      });
    } catch (error) {
      console.error('❌ Ошибка получения полных данных загрузки:', error);
      console.error('🔧 Детали ошибки:', error.message, error.stack);
      return res.status(500).json({ error: 'Ошибка получения полных данных загрузки', details: error.message });
    }
  });

  return router;
}

module.exports = {
  createUploadHistoryRouter
};
