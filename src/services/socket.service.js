const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.WS_RATE_LIMIT_MAX || '10');

let io = null;
const rateLimits = new Map(); // socketId -> { count: number, resetTime: number }

function logSocketEvent(userId, socketId, ipAddress, room, event, extra = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[WS LOG] [${timestamp}] Event: ${event} | User: ${userId} | Socket: ${socketId} | IP: ${ipAddress} | Room: ${room || 'None'} | Extra: ${JSON.stringify(extra)}`);
}

function checkRateLimit(socketId) {
  const now = Date.now();
  let userLimit = rateLimits.get(socketId);
  if (!userLimit || now > userLimit.resetTime) {
    userLimit = { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
    rateLimits.set(socketId, userLimit);
    return false;
  }
  userLimit.count++;
  if (userLimit.count > RATE_LIMIT_MAX_REQUESTS) {
    return true; // Exceeded limit
  }
  return false;
}

exports.init = (server) => {
  io = new Server(server, {
    cors: {
      origin: true,
      credentials: true
    }
  });

  // JWT Handshake Verification
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      if (!token) {
        return next(new Error('Authentication error: Token is required'));
      }
      const payload = jwt.verify(token, JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        include: { department: true }
      });
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }
      socket.user = user;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    const userRole = socket.user.role;
    const ipAddress = socket.handshake.address;

    // Join default personal room
    socket.join(`user:${userId}`);
    logSocketEvent(userId, socket.id, ipAddress, `user:${userId}`, 'connect', {
      username: socket.user.username,
      role: userRole
    });

    // Join role-based rooms
    if (userRole === 'ADMIN') {
      socket.join('role:ADMIN');
      logSocketEvent(userId, socket.id, ipAddress, 'role:ADMIN', 'join_role_room');
    }

    // Join department-based rooms
    if (socket.user.department && socket.user.department.code) {
      const deptCode = socket.user.department.code;
      socket.join(`department:${deptCode}`);
      logSocketEvent(userId, socket.id, ipAddress, `department:${deptCode}`, 'join_dept_room');
    }

    // Room Authorization Guard for Joining Ticket Rooms
    socket.on('join_ticket', async (ticketId, callback) => {
      if (typeof callback !== 'function') return;

      if (checkRateLimit(socket.id)) {
        return callback({ status: 'error', message: 'Rate limit exceeded' });
      }

      try {
        const ticket = await prisma.ticket.findUnique({
          where: { id: ticketId }
        });

        if (!ticket) {
          return callback({ status: 'error', message: 'Ticket not found' });
        }

        // Auth check: Creator, Assigned Agent, Target Manager, Staff (Admin/Manager), or Target Department Member
        const isCreator = ticket.userId === userId;
        const isAgent = ticket.agentId === userId;
        const isReceiver = ticket.receiverManagerId === userId;
        const isStaff = userRole === 'ADMIN' || userRole === 'MANAGER';
        const isTargetDept = socket.user && socket.user.departmentId && ticket.targetDepartmentId === socket.user.departmentId;

        if (isCreator || isAgent || isReceiver || isStaff || isTargetDept) {
          socket.join(`ticket:${ticketId}`);
          logSocketEvent(userId, socket.id, ipAddress, `ticket:${ticketId}`, 'join_room');
          callback({ status: 'ok' });
        } else {
          logSocketEvent(userId, socket.id, ipAddress, `ticket:${ticketId}`, 'join_room_denied');
          callback({ status: 'error', message: 'Unauthorized access to this ticket room' });
        }
      } catch (err) {
        console.error('join_ticket error:', err);
        callback({ status: 'error', message: 'Internal server error' });
      }
    });

    socket.on('leave_ticket', (ticketId) => {
      socket.leave(`ticket:${ticketId}`);
      logSocketEvent(userId, socket.id, ipAddress, `ticket:${ticketId}`, 'leave_room');
    });

    socket.on('disconnect', () => {
      rateLimits.delete(socket.id);
      logSocketEvent(userId, socket.id, ipAddress, null, 'disconnect');
    });
  });

  // Graceful Shutdown Registration
  const gracefulShutdown = () => {
    console.log('[Server] Graceful shutdown initiated. Stopping new WebSocket connections...');
    io.close(() => {
      console.log('[Server] All WebSocket connections closed.');
    });
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  return io;
};

exports.getIO = () => {
  return io;
};

// Emitting Helper Functions (Targeted Event Delivery)
exports.emitToUser = (userId, event, data) => {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, { version: "1.0", payload: data });
};

exports.emitToTicket = (ticketId, event, data) => {
  if (!io) return;
  io.to(`ticket:${ticketId}`).emit(event, { version: "1.0", payload: data });
};

exports.emitToDepartment = (departmentCode, event, data) => {
  if (!io) return;
  io.to(`department:${departmentCode}`).emit(event, { version: "1.0", payload: data });
};

exports.emitToAdmins = (event, data) => {
  if (!io) return;
  io.to('role:ADMIN').emit(event, { version: "1.0", payload: data });
};
