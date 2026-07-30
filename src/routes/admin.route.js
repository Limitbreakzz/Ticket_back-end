const express = require('express');
const app = express.Router();
const controller = require('../controllers/admin.controller');
const { requireAuth, requireAdmin, requireManager } = require('../middlewares/auth.middleware');

// Require authentication for all endpoints
app.use(requireAuth);

// Department management endpoints (Admin only)
app.get('/departments', requireAdmin, controller.getDepartments);
app.post('/departments', requireAdmin, controller.createDepartment);
app.patch('/departments/:id', requireAdmin, controller.updateDepartment);
app.delete('/departments/:id', requireAdmin, controller.deleteDepartment);

// User management endpoints (Admin only)
app.get('/users', requireAdmin, controller.getUsers);
app.post('/users', requireAdmin, controller.createUser);
app.patch('/users/:id', requireAdmin, controller.updateUser);
app.delete('/users/:id', requireAdmin, controller.deleteUser);

// Analytics endpoints (Allow both ADMIN and MANAGER)
app.get('/analytics', requireManager, controller.getAnalytics);

module.exports = app;
