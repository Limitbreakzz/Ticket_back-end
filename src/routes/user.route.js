const express = require('express');
const app = express.Router();
const controller = require('../controllers/user.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

app.post('/',
  // #swagger.tags = ['users']
  // #swagger.description = 'สร้างผู้ใช้งานใหม่'
  requireAuth,
  controller.createUser
);

app.get('/',
  // #swagger.tags = ['users']
  // #swagger.description = 'ดึงผู้ใช้งานทั้งหมด'
  requireAuth,
  controller.getAllUsers
);

app.get('/:id',
  // #swagger.tags = ['users']
  // #swagger.description = 'ดึงผู้ใช้งานตาม id'
  requireAuth,
  controller.getUserById
);

module.exports = app;
