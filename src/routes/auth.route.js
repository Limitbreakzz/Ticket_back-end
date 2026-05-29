const express = require('express');
const app = express.Router();
const controller = require('../controllers/auth.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

app.post('/login',
  // #swagger.tags = ['auth']
  // #swagger.description = 'ล็อคอิน'
  controller.login
);

app.post('/register',
  // #swagger.tags = ['auth']
  // #swagger.description = 'สมัครสมาชิก'
  controller.register
);

app.post('/logout',
  // #swagger.tags = ['auth']
  // #swagger.description = 'ออกจากระบบ'
  controller.logout
);

app.get('/me',
  // #swagger.tags = ['auth']
  // #swagger.description = 'ดึงข้อมูลโปรไฟล์ผู้ใช้ปัจจุบัน'
  requireAuth,
  controller.me
);

app.patch('/me',
  // #swagger.tags = ['auth']
  // #swagger.description = 'อัปเดตข้อมูลโปรไฟล์ผู้ใช้ปัจจุบัน'
  requireAuth,
  controller.updateMe
);

module.exports = app;
