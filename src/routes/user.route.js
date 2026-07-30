const express = require('express');
const app = express.Router();
const controller = require('../controllers/user.controller');
const { requireAuth, requireAdmin, requireManager } = require('../middlewares/auth.middleware');

app.get('/',
  // #swagger.tags = ['users']
  // #swagger.description = 'ดึงรายชื่อผู้ใช้ทั้งหมดในระบบ (MANAGER/ADMIN เท่านั้น)'
  requireAuth,
  requireManager, // BUG-007 fix: only MANAGER and ADMIN can list all users
  controller.getAllUsers
);

app.get('/:id',
  // #swagger.tags = ['users']
  // #swagger.description = 'ดึงข้อมูลผู้ใช้ตาม ID'
  requireAuth,
  controller.getUserById
);

module.exports = app;
