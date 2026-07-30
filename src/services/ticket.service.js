const prisma = require('../prisma');
const socketService = require('./socket.service');

// Safe user select — excludes password
const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  username: true,
  role: true,
  avatarUrl: true,
  departmentId: true,
  createdAt: true,
  department: {
    select: { id: true, name: true, code: true }
  }
};

exports.findManyTickets = async (whereClause, page, limit) => {
  const options = {
    where: whereClause,
    include: {
      agent: { select: SAFE_USER_SELECT },
      user: { select: SAFE_USER_SELECT },
      sourceDepartment: true,
      targetDepartment: true,
      receiverManager: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        }
      },
      comments: {
        select: {
          message: true,
          createdAt: true
        }
      }
    },
    orderBy: { createdAt: "desc" },
  };

  if (page && limit) {
    options.skip = (page - 1) * limit;
    options.take = limit;
  }

  return await prisma.ticket.findMany(options);
};

exports.findAllTickets = async (page, limit, whereClause) => {
  const options = {
    where: whereClause,
    include: {
      agent: { select: SAFE_USER_SELECT },
      user: { select: SAFE_USER_SELECT },
      sourceDepartment: true,
      targetDepartment: true,
      receiverManager: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        }
      },
      comments: {
        select: {
          message: true,
          createdAt: true
        }
      }
    },
    orderBy: { createdAt: "desc" },
  };

  if (page && limit) {
    options.skip = (page - 1) * limit;
    options.take = limit;
  }

  return await prisma.ticket.findMany(options);
};

exports.createTicket = async (data) => {
  const ticket = await prisma.ticket.create({
    data,
    include: {
      user: { select: SAFE_USER_SELECT },
      sourceDepartment: true,
      targetDepartment: true,
      receiverManager: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        }
      },
    },
  });

  // Emit ticket:created event to relevant target rooms
  if (ticket.receiverManagerId) {
    socketService.emitToUser(ticket.receiverManagerId, 'ticket:created', ticket);
  } else if (ticket.targetDepartmentId && ticket.targetDepartment && ticket.targetDepartment.code) {
    socketService.emitToDepartment(ticket.targetDepartment.code, 'ticket:created', ticket);
  } else {
    socketService.emitToAdmins('ticket:created', ticket);
  }
  socketService.emitToUser(ticket.userId, 'ticket:created', ticket);

  return ticket;
};

exports.countTickets = async (whereClause) => {
  return await prisma.ticket.count({ where: whereClause });
};

exports.findTicketByIdWithDetails = async (id) => {
  return await prisma.ticket.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatarUrl: true,
          department: true,
        }
      },
      agent: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatarUrl: true,
          department: true,
        }
      },
      sourceDepartment: true,
      targetDepartment: true,
      receiverManager: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        }
      },
      transfers: {
        include: {
          fromDepartment: true,
          toDepartment: true,
          requestedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          }
        },
        orderBy: { createdAt: "desc" }
      }
    },
  });
};

exports.findTicketById = async (id) => {
  return await prisma.ticket.findUnique({
    where: { id },
    include: {
      targetDepartment: true,
    }
  });
};

exports.findTicketByIdWithRelations = async (id) => {
  return await prisma.ticket.findUnique({
    where: { id },
    include: {
      user: { select: SAFE_USER_SELECT },
      agent: { select: SAFE_USER_SELECT },
      sourceDepartment: true,
      targetDepartment: true,
      receiverManager: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        }
      },
    },
  });
};

exports.updateTicket = async (id, data) => {
  const ticket = await prisma.ticket.update({
    where: { id },
    data,
    include: {
      user: { select: SAFE_USER_SELECT },
      agent: { select: SAFE_USER_SELECT },
      sourceDepartment: true,
      targetDepartment: true,
      receiverManager: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        }
      },
    },
  });

  // Emit ticket:updated to the specific ticket's room
  socketService.emitToTicket(ticket.id, 'ticket:updated', ticket);

  // Emit ticket:updated to relevant staff/creator rooms for dashboard updates
  if (ticket.receiverManagerId) {
    socketService.emitToUser(ticket.receiverManagerId, 'ticket:updated', ticket);
  } else if (ticket.targetDepartmentId && ticket.targetDepartment && ticket.targetDepartment.code) {
    socketService.emitToDepartment(ticket.targetDepartment.code, 'ticket:updated', ticket);
  } else {
    socketService.emitToAdmins('ticket:updated', ticket);
  }
  socketService.emitToUser(ticket.userId, 'ticket:updated', ticket);
  if (ticket.agentId) {
    socketService.emitToUser(ticket.agentId, 'ticket:updated', ticket);
  }

  return ticket;
};

exports.createComment = async (data) => {
  const comment = await prisma.comment.create({
    data,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          role: true,
          avatarUrl: true,
        },
      },
    },
  });

  // Emit comment:created event to the specific ticket room in real-time
  socketService.emitToTicket(comment.ticketId, 'comment:created', comment);

  return comment;
};

exports.getCommentsByTicketId = async (ticketId) => {
  return await prisma.comment.findMany({
    where: { ticketId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          role: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
};

exports.markCommentsAsRead = async (ticketId, userId) => {
  return await prisma.comment.updateMany({
    where: {
      ticketId,
      userId: { not: userId },
      readAt: null
    },
    data: {
      readAt: new Date()
    }
  });
};

exports.createTransfer = async (data) => {
  return await prisma.ticketTransfer.create({ data });
};

exports.getAnalyticsSummary = async (departmentId = null) => {
  const whereDept = departmentId ? {
    OR: [
      { targetDepartmentId: departmentId },
      { sourceDepartmentId: departmentId }
    ]
  } : {};

  const totalTickets = await prisma.ticket.count({ where: whereDept });
  const criticalTickets = await prisma.ticket.count({
    where: { ...whereDept, priority: "CRITICAL" }
  });

  const resolvedTickets = await prisma.ticket.findMany({
    where: {
      ...whereDept,
      status: { in: ["RESOLVED", "CLOSED"] }
    },
    select: {
      createdAt: true,
      updatedAt: true,
      resolvedAt: true
    }
  });

  let avgResolutionTimeHours = 0;
  if (resolvedTickets.length > 0) {
    const totalDiffMs = resolvedTickets.reduce((sum, ticket) => {
      const resolveTime = ticket.resolvedAt || ticket.updatedAt;
      const diff = resolveTime.getTime() - ticket.createdAt.getTime();
      return sum + (diff > 0 ? diff : 0);
    }, 0);
    const avgMs = totalDiffMs / resolvedTickets.length;
    avgResolutionTimeHours = Number((avgMs / (1000 * 60 * 60)).toFixed(1));
  }

  const total = totalTickets;
  const resolved = resolvedTickets.length;
  const active = await prisma.ticket.count({
    where: {
      ...whereDept,
      status: {
        notIn: ["RESOLVED", "CLOSED", "CANCELLED", "REJECTED"]
      }
    }
  });
  const cancelled = await prisma.ticket.count({
    where: {
      ...whereDept,
      status: {
        in: ["CANCELLED", "REJECTED"]
      }
    }
  });

  return { 
    total, 
    active, 
    resolved, 
    cancelled, 
    totalTickets, 
    avgResolutionTimeHours, 
    criticalTickets 
  };
};

exports.getAnalyticsGroupedData = async (departmentId = null) => {
  const whereDept = departmentId ? {
    OR: [
      { targetDepartmentId: departmentId },
      { sourceDepartmentId: departmentId }
    ]
  } : {};

  const statusCounts = await prisma.ticket.groupBy({
    by: ["status"],
    where: whereDept,
    _count: { id: true }
  });

  const priorityCounts = await prisma.ticket.groupBy({
    by: ["priority"],
    where: whereDept,
    _count: { id: true }
  });

  const categoryCounts = await prisma.ticket.groupBy({
    by: ["category"],
    where: whereDept,
    _count: { id: true }
  });

  const deptCounts = await prisma.ticket.groupBy({
    by: ["targetDepartmentId"],
    where: whereDept,
    _count: { id: true }
  });

  return { statusCounts, priorityCounts, categoryCounts, deptCounts };
};
