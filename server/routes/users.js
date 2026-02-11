const express = require('express');
const bcrypt = require('bcryptjs');

function createUsersRouter({ User, authenticateToken, requireAdmin }) {
  const router = express.Router();

  router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const usersList = await User.findAll({
        attributes: ['id', 'email', 'fullName', 'role', 'isActive', 'createdAt', 'lastLogin'],
        order: [['createdAt', 'DESC']]
      });
      res.json(usersList);
    } catch (error) {
      console.error('❌ Ошибка получения списка пользователей:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

  router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { email, role, fullName } = req.body;

      if (!email || !role) {
        return res.status(400).json({ error: 'Email и роль обязательны' });
      }

      if (!fullName || !fullName.trim()) {
        return res.status(400).json({ error: 'ФИО обязательно' });
      }

      const existingUser = await User.findOne({
        where: { email: email.toLowerCase().trim() }
      });
      if (existingUser) {
        return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
      }

      const password = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = await User.create({
        email: email.toLowerCase().trim(),
        fullName: fullName.trim(),
        role,
        password: hashedPassword,
        isActive: true
      });

      return res.json({
        success: true,
        user: {
          id: newUser.id,
          email: newUser.email,
          fullName: newUser.fullName,
          role: newUser.role,
          isActive: newUser.isActive,
          createdAt: newUser.createdAt,
          lastLogin: newUser.lastLogin
        },
        generatedPassword: password
      });
    } catch (error) {
      console.error('❌ Ошибка создания пользователя:', error);
      return res.status(500).json({ error: 'Ошибка сервера при создании пользователя' });
    }
  });

  router.put('/:id/toggle-status', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      const user = await User.findByPk(userId);

      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      await user.update({ isActive: !user.isActive });

      return res.json({
        success: true,
        message: `Пользователь ${user.isActive ? 'разблокирован' : 'заблокирован'}`,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin
        }
      });
    } catch (error) {
      console.error('❌ Ошибка изменения статуса пользователя:', error);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

  router.put('/:id/role', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      const { role } = req.body;

      const allowedRoles = ['admin', 'purchaser', 'sales'];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ error: 'Недопустимая роль' });
      }

      if (String(req.user.id) === String(userId)) {
        return res.status(400).json({ error: 'Нельзя менять роль собственного аккаунта' });
      }

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      await user.update({ role });

      return res.json({
        success: true,
        message: 'Роль пользователя обновлена',
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin
        }
      });
    } catch (error) {
      console.error('❌ Ошибка изменения роли пользователя:', error);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

  router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      const { email, role, fullName } = req.body;

      if (!email && !role && !fullName) {
        return res.status(400).json({ error: 'Нет данных для обновления' });
      }

      const allowedRoles = ['admin', 'purchaser', 'sales'];
      if (role && !allowedRoles.includes(role)) {
        return res.status(400).json({ error: 'Недопустимая роль' });
      }

      if (role && String(req.user.id) === String(userId)) {
        return res.status(400).json({ error: 'Нельзя менять роль собственного аккаунта' });
      }

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      const updates = {};
      if (email) {
        const normalizedEmail = email.toLowerCase().trim();
        const existingUser = await User.findOne({ where: { email: normalizedEmail } });
        if (existingUser && String(existingUser.id) !== String(userId)) {
          return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
        }
        updates.email = normalizedEmail;
      }
      if (fullName !== undefined) {
        if (!fullName || !fullName.trim()) {
          return res.status(400).json({ error: 'ФИО обязательно' });
        }
        updates.fullName = fullName.trim();
      }
      if (role) {
        updates.role = role;
      }

      await user.update(updates);

      return res.json({
        success: true,
        message: 'Данные пользователя обновлены',
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin
        }
      });
    } catch (error) {
      console.error('❌ Ошибка обновления пользователя:', error);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

  router.post('/:id/reset-password', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      const password = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(password, 10);
      await user.update({ password: hashedPassword });

      return res.json({
        success: true,
        message: 'Пароль сброшен',
        generatedPassword: password,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin
        }
      });
    } catch (error) {
      console.error('❌ Ошибка сброса пароля пользователя:', error);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

  router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      if (String(req.user.id) === String(userId)) {
        return res.status(400).json({ error: 'Нельзя удалить свой аккаунт' });
      }

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      await user.destroy();
      return res.json({ success: true, message: 'Пользователь удален' });
    } catch (error) {
      console.error('❌ Ошибка удаления пользователя:', error);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }
  });

  router.put('/:id/change-password', authenticateToken, async (req, res) => {
    try {
      const userId = req.params.id;
      const { currentPassword, newPassword } = req.body;

      if (String(req.user.id) !== String(userId) && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Недостаточно прав' });
      }

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      if (req.user.role !== 'admin') {
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
          return res.status(401).json({ error: 'Неверный текущий пароль' });
        }
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await user.update({ password: hashedPassword });

      return res.json({ success: true, message: 'Пароль успешно изменен' });
    } catch (error) {
      console.error('❌ Ошибка смены пароля:', error);
      return res.status(500).json({ error: 'Ошибка сервера при смене пароля' });
    }
  });

  return router;
}

module.exports = {
  createUsersRouter
};
