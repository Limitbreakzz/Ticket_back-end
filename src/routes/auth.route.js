const express = require('express');
const app = express.Router();
const controller = require('../controllers/auth.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const rateLimit = require('express-rate-limit');

// Rate limiting — BUG-003 fix: max 15 failed login attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'คุณลองล็อกอินผิดเกิน 15 ครั้ง กรุณารอ 15 นาทีแล้วลองใหม่อีกครั้ง' },
  skipSuccessfulRequests: true,
});

app.post('/login',
  // #swagger.tags = ['auth']
  // #swagger.description = 'ล็อกอินเข้าสู่ระบบ'
  loginLimiter,
  controller.login
);

app.post('/logout',
  // #swagger.tags = ['auth']
  // #swagger.description = 'ออกจากระบบ'
  controller.logout
);

app.get('/me',
  // #swagger.tags = ['auth']
  // #swagger.description = 'ดึงข้อมูลโปรไฟล์ผู้ใช้งานปัจจุบัน'
  requireAuth,
  controller.me
);

app.patch('/me',
  // #swagger.tags = ['auth']
  // #swagger.description = 'อัปเดตข้อมูลโปรไฟล์ (ชื่อและรูปประจำตัว)'
  requireAuth,
  controller.updateMe
);

module.exports = app;
