const jwt = require('jsonwebtoken');
const prisma = require('../prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      req.user = null;
      return next();
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      // Token expired or invalid
      req.user = null;
      return next();
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { department: true }
    });

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    req.user = null;
    next();
  }
};

const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'ไม่ได้รับสิทธิ์เข้าถึง กรุณาล็อกอินใหม่' });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึง สำหรับผู้ดูแลระบบเท่านั้น' });
  }
  next();
};

const requireManager = (req, res, next) => {
  if (!req.user || (req.user.role !== 'MANAGER' && req.user.role !== 'ADMIN')) {
    return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึง สำหรับหัวหน้างาน/ผู้ดูแลระบบเท่านั้น' });
  }
  next();
};

module.exports = {
  authMiddleware,
  requireAuth,
  requireAdmin,
  requireManager
};
