const prisma = require('../prisma');
const socketService = require('./socket.service');

// Safe user select — excludes password
const SAFE_USER_SELECT = {
  user_id: true,
  name: true,
  email: true,
  username: true,
  role: true,
  avatar_url: true,
  dept_id: true,
  created_at: true,
  department: {
    select: { dept_id: true, name: true, code: true }
  }
};

function formatUser(u) {
  if (!u) return null;
  return {
    ...u,
    id: u.user_id,
    avatarUrl: u.avatar_url,
    departmentId: u.dept_id,
    createdAt: u.created_at,
    department: u.department ? {
      ...u.department,
      id: u.department.dept_id
    } : null
  };
}

function formatTicket(t) {
  if (!t) return null;
  return {
    ...t,
    id: t.ticket_id,
    ticket_id: t.ticket_id,
    attachmentUrl: t.attach_url,
    attach_url: t.attach_url,
    userId: t.user_id,
    user_id: t.user_id,
    agentId: t.agent_id,
    agent_id: t.agent_id,
    receiverManagerId: t.manager_id,
    manager_id: t.manager_id,
    sourceDepartmentId: t.src_dept_id,
    src_dept_id: t.src_dept_id,
    targetDepartmentId: t.tgt_dept_id,
    tgt_dept_id: t.tgt_dept_id,
    slaDueDate: t.sla_due_date,
    sla_due_date: t.sla_due_date,
    resolvedAt: t.resolved_at,
    resolved_at: t.resolved_at,
    createdAt: t.created_at,
    created_at: t.created_at,
    updatedAt: t.updated_at,
    updated_at: t.updated_at,
    user: formatUser(t.user),
    agent: formatUser(t.agent),
    receiverManager: formatUser(t.receiverManager),
    sourceDepartment: t.sourceDepartment ? {
      ...t.sourceDepartment,
      id: t.sourceDepartment.dept_id,
      isActive: t.sourceDepartment.is_active,
      createdAt: t.sourceDepartment.created_at,
      updatedAt: t.sourceDepartment.updated_at
    } : null,
    targetDepartment: t.targetDepartment ? {
      ...t.targetDepartment,
      id: t.targetDepartment.dept_id,
      isActive: t.targetDepartment.is_active,
      createdAt: t.targetDepartment.created_at,
      updatedAt: t.targetDepartment.updated_at
    } : null,
    comments: t.comments ? t.comments.map(c => ({
      ...c,
      id: c.comment_id,
      comment_id: c.comment_id,
      ticketId: c.ticket_id,
      ticket_id: c.ticket_id,
      userId: c.user_id,
      user_id: c.user_id,
      attachmentUrl: c.attach_url,
      attach_url: c.attach_url,
      isEdited: c.is_edited,
      is_edited: c.is_edited,
      createdAt: c.created_at,
      created_at: c.created_at,
      updatedAt: c.updated_at,
      updated_at: c.updated_at,
      readAt: c.read_at,
      read_at: c.read_at,
      user: formatUser(c.user)
    })) : []
  };
}

function normalizeTicketWhereClause(where = {}) {
  const normalized = { ...where };
  if (normalized.userId !== undefined) {
    normalized.user_id = normalized.userId;
    delete normalized.userId;
  }
  if (normalized.agentId !== undefined) {
    normalized.agent_id = normalized.agentId;
    delete normalized.agentId;
  }
  if (normalized.targetDepartmentId !== undefined) {
    normalized.tgt_dept_id = normalized.targetDepartmentId;
    delete normalized.targetDepartmentId;
  }
  if (normalized.sourceDepartmentId !== undefined) {
    normalized.src_dept_id = normalized.sourceDepartmentId;
    delete normalized.sourceDepartmentId;
  }
  if (normalized.receiverManagerId !== undefined) {
    normalized.manager_id = normalized.receiverManagerId;
    delete normalized.receiverManagerId;
  }
  if (normalized.createdAt !== undefined) {
    normalized.created_at = normalized.createdAt;
    delete normalized.createdAt;
  }
  if (normalized.updatedAt !== undefined) {
    normalized.updated_at = normalized.updatedAt;
    delete normalized.updatedAt;
  }
  if (Array.isArray(normalized.OR)) {
    normalized.OR = normalized.OR.map(normalizeTicketWhereClause);
  }
  if (Array.isArray(normalized.AND)) {
    normalized.AND = normalized.AND.map(normalizeTicketWhereClause);
  }
  return normalized;
}

exports.findManyTickets = async (whereClause, page, limit) => {
  const options = {
    where: normalizeTicketWhereClause(whereClause),
    include: {
      agent: { select: SAFE_USER_SELECT },
      user: { select: SAFE_USER_SELECT },
      sourceDepartment: true,
      targetDepartment: true,
      receiverManager: { select: SAFE_USER_SELECT },
      comments: {
        select: {
          comment_id: true,
          message: true,
          attach_url: true,
          created_at: true,
          read_at: true,
          user: { select: SAFE_USER_SELECT }
        }
      }
    },
    orderBy: { created_at: "desc" },
  };

  if (page && limit) {
    options.skip = (page - 1) * limit;
    options.take = limit;
  }

  const list = await prisma.ticket.findMany(options);
  return list.map(formatTicket);
};

exports.findAllTickets = async (page, limit, whereClause) => {
  return await exports.findManyTickets(whereClause, page, limit);
};

exports.createTicket = async (data) => {
  const payload = {
    title: data.title,
    description: data.description,
    category: data.category,
    subcategory: data.subcategory,
    priority: data.priority,
    status: data.status,
    sla_due_date: data.sla_due_date || data.slaDueDate,
    attach_url: data.attach_url || data.attachmentUrl,
    user_id: data.user_id || data.userId,
    agent_id: data.agent_id || data.agentId,
    manager_id: data.manager_id || data.receiverManagerId,
    src_dept_id: data.src_dept_id || data.sourceDepartmentId,
    tgt_dept_id: data.tgt_dept_id || data.targetDepartmentId,
  };

  const rawTicket = await prisma.ticket.create({
    data: payload,
    include: {
      user: { select: SAFE_USER_SELECT },
      sourceDepartment: true,
      targetDepartment: true,
      receiverManager: { select: SAFE_USER_SELECT },
    },
  });

  const ticket = formatTicket(rawTicket);

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
  return await prisma.ticket.count({ where: normalizeTicketWhereClause(whereClause) });
};

exports.findTicketByIdWithDetails = async (id) => {
  const raw = await prisma.ticket.findUnique({
    where: { ticket_id: id },
    include: {
      user: { select: SAFE_USER_SELECT },
      agent: { select: SAFE_USER_SELECT },
      sourceDepartment: true,
      targetDepartment: true,
      receiverManager: { select: SAFE_USER_SELECT },
      transfers: {
        include: {
          fromDepartment: true,
          toDepartment: true,
          requestedBy: { select: SAFE_USER_SELECT }
        },
        orderBy: { created_at: "desc" }
      }
    },
  });

  if (!raw) return null;
  const formatted = formatTicket(raw);
  if (raw.transfers) {
    formatted.transfers = raw.transfers.map(tr => ({
      ...tr,
      id: tr.transfer_id,
      ticketId: tr.ticket_id,
      fromDepartmentId: tr.from_dept_id,
      toDepartmentId: tr.to_dept_id,
      requestedById: tr.req_by_id,
      createdAt: tr.created_at,
      updatedAt: tr.updated_at,
      fromDepartment: tr.fromDepartment ? {
        ...tr.fromDepartment,
        id: tr.fromDepartment.dept_id
      } : null,
      toDepartment: tr.toDepartment ? {
        ...tr.toDepartment,
        id: tr.toDepartment.dept_id
      } : null,
      requestedBy: formatUser(tr.requestedBy)
    }));
  }
  return formatted;
};

exports.findTicketById = async (id) => {
  const raw = await prisma.ticket.findUnique({
    where: { ticket_id: id },
    include: {
      targetDepartment: true,
      sourceDepartment: true,
      user: { select: SAFE_USER_SELECT },
      agent: { select: SAFE_USER_SELECT },
      receiverManager: { select: SAFE_USER_SELECT },
    }
  });
  return formatTicket(raw);
};

exports.findTicketByIdWithRelations = async (id) => {
  return await exports.findTicketById(id);
};

exports.updateTicket = async (id, data) => {
  const payload = {};
  if (data.title !== undefined) payload.title = data.title;
  if (data.description !== undefined) payload.description = data.description;
  if (data.category !== undefined) payload.category = data.category;
  if (data.subcategory !== undefined) payload.subcategory = data.subcategory;
  if (data.priority !== undefined) payload.priority = data.priority;
  if (data.status !== undefined) payload.status = data.status;
  if (data.resolved_at !== undefined || data.resolvedAt !== undefined) {
    payload.resolved_at = data.resolved_at !== undefined ? data.resolved_at : data.resolvedAt;
  }
  if (data.sla_due_date !== undefined || data.slaDueDate !== undefined) {
    payload.sla_due_date = data.sla_due_date !== undefined ? data.sla_due_date : data.slaDueDate;
  }
  if (data.attach_url !== undefined || data.attachmentUrl !== undefined) {
    payload.attach_url = data.attach_url !== undefined ? data.attach_url : data.attachmentUrl;
  }
  if (data.agent_id !== undefined || data.agentId !== undefined) {
    payload.agent_id = data.agent_id !== undefined ? data.agent_id : data.agentId;
  }
  if (data.manager_id !== undefined || data.receiverManagerId !== undefined) {
    payload.manager_id = data.manager_id !== undefined ? data.manager_id : data.receiverManagerId;
  }
  if (data.src_dept_id !== undefined || data.sourceDepartmentId !== undefined) {
    payload.src_dept_id = data.src_dept_id !== undefined ? data.src_dept_id : data.sourceDepartmentId;
  }
  if (data.tgt_dept_id !== undefined || data.targetDepartmentId !== undefined) {
    payload.tgt_dept_id = data.tgt_dept_id !== undefined ? data.tgt_dept_id : data.targetDepartmentId;
  }

  const raw = await prisma.ticket.update({
    where: { ticket_id: id },
    data: payload,
    include: {
      user: { select: SAFE_USER_SELECT },
      agent: { select: SAFE_USER_SELECT },
      sourceDepartment: true,
      targetDepartment: true,
      receiverManager: { select: SAFE_USER_SELECT },
    },
  });

  const ticket = formatTicket(raw);

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
  const payload = {
    ticket_id: data.ticket_id || data.ticketId,
    user_id: data.user_id || data.userId,
    message: data.message,
    attach_url: data.attach_url || data.attachmentUrl
  };

  const raw = await prisma.comment.create({
    data: payload,
    include: {
      user: {
        select: SAFE_USER_SELECT
      },
    },
  });

  const comment = {
    ...raw,
    id: raw.comment_id,
    comment_id: raw.comment_id,
    ticketId: raw.ticket_id,
    ticket_id: raw.ticket_id,
    userId: raw.user_id,
    user_id: raw.user_id,
    attachmentUrl: raw.attach_url,
    attach_url: raw.attach_url,
    isEdited: raw.is_edited,
    is_edited: raw.is_edited,
    createdAt: raw.created_at,
    created_at: raw.created_at,
    updatedAt: raw.updated_at,
    updated_at: raw.updated_at,
    readAt: raw.read_at,
    read_at: raw.read_at,
    user: formatUser(raw.user)
  };

  // Emit comment:created event to the specific ticket room in real-time
  socketService.emitToTicket(comment.ticketId, 'comment:created', comment);

  return comment;
};

exports.getCommentsByTicketId = async (ticketId) => {
  const list = await prisma.comment.findMany({
    where: { ticket_id: ticketId },
    include: {
      user: {
        select: SAFE_USER_SELECT,
      },
    },
    orderBy: { created_at: "asc" },
  });

  return list.map(c => ({
    ...c,
    id: c.comment_id,
    comment_id: c.comment_id,
    ticketId: c.ticket_id,
    ticket_id: c.ticket_id,
    userId: c.user_id,
    user_id: c.user_id,
    attachmentUrl: c.attach_url,
    attach_url: c.attach_url,
    isEdited: c.is_edited,
    is_edited: c.is_edited,
    createdAt: c.created_at,
    created_at: c.created_at,
    updatedAt: c.updated_at,
    updated_at: c.updated_at,
    readAt: c.read_at,
    read_at: c.read_at,
    user: formatUser(c.user)
  }));
};

exports.markCommentsAsRead = async (ticketId, userId) => {
  return await prisma.comment.updateMany({
    where: {
      ticket_id: ticketId,
      user_id: { not: userId },
      read_at: null
    },
    data: {
      read_at: new Date()
    }
  });
};

exports.createTransfer = async (data) => {
  const payload = {
    ticket_id: data.ticket_id || data.ticketId,
    from_dept_id: data.from_dept_id || data.fromDepartmentId,
    to_dept_id: data.to_dept_id || data.toDepartmentId,
    req_by_id: data.req_by_id || data.requestedById,
    note: data.note,
    status: data.status || "PENDING"
  };
  return await prisma.ticketTransfer.create({ data: payload });
};

exports.getAnalyticsSummary = async (departmentId = null) => {
  const whereDept = departmentId ? {
    OR: [
      { tgt_dept_id: departmentId },
      { src_dept_id: departmentId }
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
      created_at: true,
      updated_at: true,
      resolved_at: true
    }
  });

  let avgResolutionTimeHours = 0;
  if (resolvedTickets.length > 0) {
    const totalDiffMs = resolvedTickets.reduce((sum, ticket) => {
      const resolveTime = ticket.resolved_at || ticket.updated_at;
      const diff = resolveTime.getTime() - ticket.created_at.getTime();
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
      { tgt_dept_id: departmentId },
      { src_dept_id: departmentId }
    ]
  } : {};

  const statusCounts = await prisma.ticket.groupBy({
    by: ["status"],
    where: whereDept,
    _count: { ticket_id: true }
  });

  const priorityCounts = await prisma.ticket.groupBy({
    by: ["priority"],
    where: whereDept,
    _count: { ticket_id: true }
  });

  const categoryCounts = await prisma.ticket.groupBy({
    by: ["category"],
    where: whereDept,
    _count: { ticket_id: true }
  });

  const deptCounts = await prisma.ticket.groupBy({
    by: ["tgt_dept_id"],
    where: whereDept,
    _count: { ticket_id: true }
  });

  return { statusCounts, priorityCounts, categoryCounts, deptCounts };
};
