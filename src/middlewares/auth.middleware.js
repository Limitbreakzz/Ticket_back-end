const prisma = require('../prisma');

const parseCookies = (req) => {
  const list = {};
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    let [name, ...rest] = cookie.split('=');
    name = name.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    list[name] = decodeURIComponent(value);
  });
  return list;
};

const authMiddleware = async (req, res, next) => {
  try {
    const cookies = parseCookies(req);
    const sessionCookie = cookies['session_user'];
    
    if (!sessionCookie) {
      req.user = null;
      return next();
    }
    
    const sessionUser = JSON.parse(sessionCookie);
    if (!sessionUser || !sessionUser.id) {
      req.user = null;
      return next();
    }
    
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
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

module.exports = {
  authMiddleware,
  requireAuth,
  requireAdmin
};
