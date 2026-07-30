const express = require('express');
const app = express.Router();
const controller = require('../controllers/department.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

app.get('/',
  // #swagger.tags = ['departments']
  // #swagger.description = 'ดึงรายชื่อแผนกงานทั้งหมด'
  requireAuth,
  controller.getDepartments
);

app.get('/:id',
  // #swagger.tags = ['departments']
  // #swagger.description = 'ดึงข้อมูลแผนกงานตาม ID'
  requireAuth,
  controller.getDepartmentById
);

module.exports = app;
