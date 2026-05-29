const express = require('express');
const app = express.Router();
const controller = require('../controllers/ticket.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

// ==========================================
// 1. TICKET LIST & CREATION
// ==========================================
app.get('/',
  // #swagger.tags = ['tickets']
  // #swagger.description = 'ดึงข้อมูลตั๋วปัญหาทั้งหมดตามสิทธิ์ของผู้ใช้งาน'
  requireAuth,
  controller.getAllTickets
);

app.post('/',
  // #swagger.tags = ['tickets']
  // #swagger.description = 'สร้างตั๋วปัญหาใหม่'
  requireAuth,
  controller.createTicket
);

// ==========================================
// 2. COUNTS
// ==========================================
app.get('/pending-count',
  // #swagger.tags = ['tickets']
  // #swagger.description = 'ดึงจำนวนตั๋วปัญหาที่อยู่ระหว่างรอการดำเนินการ'
  requireAuth,
  controller.getPendingCount
);

app.get('/outbox-count',
  // #swagger.tags = ['tickets']
  // #swagger.description = 'ดึงจำนวนตั๋วปัญหาขาออกของผู้ใช้ปัจจุบัน'
  requireAuth,
  controller.getOutboxCount
);

// ==========================================
// 3. TICKET DETAIL & COMMENTS
// ==========================================
app.get('/:id/data',
  // #swagger.tags = ['tickets']
  // #swagger.description = 'ดึงข้อมูลตั๋วและข้อคิดเห็นของตั๋วนั้นๆ'
  requireAuth,
  controller.getTicketDetail
);

app.post('/:id/comments',
  // #swagger.tags = ['tickets']
  // #swagger.description = 'เพิ่มข้อคิดเห็นในตั๋วปัญหา'
  requireAuth,
  controller.addComment
);

// ==========================================
// 4. STATUS UPDATES
// ==========================================
app.post('/:id/status',
  // #swagger.tags = ['tickets']
  // #swagger.description = 'อัปเดตสถานะตั๋วปัญหา'
  requireAuth,
  controller.updateStatus
);

// ==========================================
// 5. DEPT TRANSFERS
// ==========================================
app.post('/:id/transfer',
  // #swagger.tags = ['tickets']
  // #swagger.description = 'ส่งต่อตั๋วปัญหาไปยังแผนกอื่น'
  requireAuth,
  controller.transferTicket
);

// ==========================================
// 6. AGENT ASSIGN / UNASSIGN
// ==========================================
app.post('/:id/assign',
  // #swagger.tags = ['tickets']
  // #swagger.description = 'รับมอบหมายดูแลตั๋วปัญหา หรือ ยกเลิกการรับเคส'
  requireAuth,
  controller.assignTicket
);

module.exports = app;
