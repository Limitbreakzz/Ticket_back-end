const express = require('express');
const app = express.Router();
const controller = require('../controllers/ticket.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

// Ticket query and creation endpoints
app.get('/',
  // #swagger.tags = ['tickets']
  // #swagger.description = 'ดึงข้อมูลตั๋วปัญหาทั้งหมดตามสิทธิ์ของผู้ใช้งาน'
  requireAuth,
  controller.getAllTickets
);

// Ticket metrics endpoints (Must be declared before /:id to avoid express matching "pending-count" as :id)
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

app.post('/',
  // #swagger.tags = ['tickets']
  // #swagger.description = 'สร้างตั๋วปัญหาใหม่'
  requireAuth,
  controller.createTicket
);

app.get('/:id',
  // #swagger.tags = ['tickets']
  // #swagger.description = 'ดึงข้อมูลตั๋วปัญหาตาม ID'
  requireAuth,
  controller.getTicketById
);

// Ticket details and communications
app.get('/:id/data',
  // #swagger.tags = ['tickets']
  // #swagger.description = 'ดึงข้อมูลตั๋วและข้อคิดเห็นของตั๋วนั้นๆ'
  requireAuth,
  controller.getTicketDetail
);

app.get('/:id/chat-updates',
  // #swagger.tags = ['tickets']
  // #swagger.description = 'ดึงข้อมูลประวัติแชทและสถานะล่าสุดสำหรับ real-time polling'
  requireAuth,
  controller.getTicketChatUpdates
);

app.post('/:id/comments',
  // #swagger.tags = ['tickets']
  // #swagger.description = 'เพิ่มข้อคิดเห็นในตั๋วปัญหา'
  requireAuth,
  controller.addComment
);

// Ticket state transitions
app.post('/:id/status',
  // #swagger.tags = ['tickets']
  // #swagger.description = 'อัปเดตสถานะตั๋วปัญหา'
  requireAuth,
  controller.updateStatus
);

// Department escalations
app.post('/:id/transfer',
  // #swagger.tags = ['tickets']
  // #swagger.description = 'ส่งต่อตั๋วปัญหาไปยังแผนกอื่น'
  requireAuth,
  controller.transferTicket
);

// Ownership assignments
app.post('/:id/assign',
  // #swagger.tags = ['tickets']
  // #swagger.description = 'รับมอบหมายดูแลตั๋วปัญหา หรือ ยกเลิกการรับเคส'
  requireAuth,
  controller.assignTicket
);

// Comment edit and delete
app.patch('/:id/comments/:commentId',
  // #swagger.tags = ['tickets']
  // #swagger.description = 'แก้ไขข้อคิดเห็นในตั๋วปัญหา'
  requireAuth,
  controller.editComment
);

app.delete('/:id/comments/:commentId',
  // #swagger.tags = ['tickets']
  // #swagger.description = 'ลบข้อคิดเห็นในตั๋วปัญหา'
  requireAuth,
  controller.deleteComment
);

module.exports = app;
