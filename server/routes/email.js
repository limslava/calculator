const express = require('express');
const nodemailer = require('nodemailer');

function createEmailRouter({ authenticateToken }) {
  const router = express.Router();

  router.post('/test', authenticateToken, async (req, res) => {
    try {
      const { config } = req.body;

      if (!config || !config.host || !config.port || !config.auth?.user || !config.auth?.pass) {
        return res.status(400).json({
          success: false,
          error: 'Не все обязательные поля заполнены'
        });
      }

      const transporter = nodemailer.createTransport(config);
      await transporter.verify();

      return res.json({
        success: true,
        message: 'SMTP соединение успешно'
      });
    } catch (error) {
      console.error('❌ Ошибка теста SMTP:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  router.post('/', authenticateToken, async (req, res) => {
    try {
      const { to, subject, message, config } = req.body;

      console.log('📧 Отправка email через сервер:', { to, subject });

      if (!to || !subject || !message || !config) {
        return res.status(400).json({
          success: false,
          error: 'Не все обязательные поля заполнены'
        });
      }

      const transporter = nodemailer.createTransport(config);
      const mailOptions = {
        from: config.auth.user,
        to,
        subject,
        text: message,
        html: message.replace(/\n/g, '<br>')
      };

      const result = await transporter.sendMail(mailOptions);
      console.log('✅ Email успешно отправлен через сервер:', result.messageId);

      return res.json({
        success: true,
        message: 'Email отправлен',
        messageId: result.messageId
      });
    } catch (error) {
      console.error('❌ Ошибка отправки email через сервер:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}

module.exports = {
  createEmailRouter
};
