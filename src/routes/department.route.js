const express = require('express');
const app = express.Router();
const controller = require('../controllers/department.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

app.get('/',
  // #swagger.tags = ['departments']
  // #swagger.description = 'ดึงข้อมูลแผนกทั้งหมด'
  requireAuth,
  controller.getDepartments
);

module.exports = app;
