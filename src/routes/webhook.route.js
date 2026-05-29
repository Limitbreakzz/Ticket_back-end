const express = require('express');
const app = express.Router();
const controller = require('../controllers/webhook.controller');
const { requireAuth, requireAdmin } = require('../middlewares/auth.middleware');

app.use(requireAuth, requireAdmin);

app.get('/',
  // #swagger.tags = ['webhooks']
  // #swagger.description = 'ดึงข้อมูล webhook ทั้งหมด'
  controller.getWebhooks
);

app.post('/',
  // #swagger.tags = ['webhooks']
  // #swagger.description = 'สร้าง webhook ใหม่'
  controller.createWebhook
);

app.patch('/:id',
  // #swagger.tags = ['webhooks']
  // #swagger.description = 'อัปเดตสถานะการใช้งานของ webhook'
  controller.updateWebhook
);

app.delete('/:id',
  // #swagger.tags = ['webhooks']
  // #swagger.description = 'ลบ webhook'
  controller.deleteWebhook
);

module.exports = app;
