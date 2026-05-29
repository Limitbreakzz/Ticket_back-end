const express = require('express');
const app = express.Router();
const controller = require('../controllers/notification.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

app.get('/',
  // #swagger.tags = ['notifications']
  // #swagger.description = 'ดึงการแจ้งเตือนทั้งหมด'
  requireAuth,
  controller.getNotifications
);

app.put('/',
  // #swagger.tags = ['notifications']
  // #swagger.description = 'อ่านการแจ้งเตือน (ระบุ id หรือเว้นว่างเพื่ออ่านทั้งหมด)'
  requireAuth,
  controller.readNotification
);

module.exports = app;
