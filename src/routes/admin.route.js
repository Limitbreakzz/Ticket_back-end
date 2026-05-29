const express = require('express');
const app = express.Router();
const controller = require('../controllers/admin.controller');
const { requireAuth, requireAdmin } = require('../middlewares/auth.middleware');

// Apply admin guard to all routes in this router
app.use(requireAuth, requireAdmin);

// ==========================================
// 1. DEPARTMENTS MANAGEMENT
// ==========================================
app.get('/departments',
  // #swagger.tags = ['admin']
  // #swagger.description = 'ดึงแผนกทั้งหมดสำหรับ admin'
  controller.getDepartments
);

app.post('/departments',
  // #swagger.tags = ['admin']
  // #swagger.description = 'สร้างแผนกใหม่'
  controller.createDepartment
);

app.patch('/departments/:id',
  // #swagger.tags = ['admin']
  // #swagger.description = 'แก้ไขแผนก'
  controller.updateDepartment
);

app.delete('/departments/:id',
  // #swagger.tags = ['admin']
  // #swagger.description = 'ลบแผนก'
  controller.deleteDepartment
);

// ==========================================
// 2. USERS MANAGEMENT
// ==========================================
app.get('/users',
  // #swagger.tags = ['admin']
  // #swagger.description = 'ดึงผู้ใช้งานทั้งหมดสำหรับ admin'
  controller.getUsers
);

app.post('/users',
  // #swagger.tags = ['admin']
  // #swagger.description = 'สร้างผู้ใช้งานใหม่'
  controller.createUser
);

app.patch('/users/:id',
  // #swagger.tags = ['admin']
  // #swagger.description = 'แก้ไขข้อมูลผู้ใช้งาน'
  controller.updateUser
);

app.delete('/users/:id',
  // #swagger.tags = ['admin']
  // #swagger.description = 'ลบผู้ใช้งาน'
  controller.deleteUser
);

// ==========================================
// 3. ANALYTICS
// ==========================================
app.get('/analytics',
  // #swagger.tags = ['admin']
  // #swagger.description = 'ดึงข้อมูลแดชบอร์ดสถิติสำหรับ admin'
  controller.getAnalytics
);

module.exports = app;
