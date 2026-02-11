const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

function createAuthRouter({ User, jwtSecret, authenticateToken }) {
  const router = express.Router();

  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email и пароль обязательны' });
      }

      const user = await User.findOne({
        where: {
          email: email.toLowerCase().trim(),
          isActive: true
        }
      });

      if (!user) {
        return res.status(401).json({ error: 'Пользователь не найден или заблокирован' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Неверный пароль' });
      }

      await user.update({ lastLogin: new Date() });

      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role
        },
        jwtSecret,
        { expiresIn: '24h' }
      );

      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin
        },
        token
      });
    } catch (error) {
      console.error('❌ Ошибка входа:', error);
      return res.status(500).json({ error: 'Ошибка сервера при входе' });
    }
  });

  router.get('/me', authenticateToken, async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      return res.json({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      });
    } catch (error) {
      console.error('❌ Ошибка получения пользователя:', error);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

  router.post('/logout', (req, res) => {
    res.json({ success: true, message: 'Успешный выход' });
  });

  return router;
}

module.exports = {
  createAuthRouter
};
