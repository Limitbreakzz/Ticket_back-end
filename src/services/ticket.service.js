const prisma = require('../prisma');

exports.findManyTickets = async (whereClause) => {
  return await prisma.ticket.findMany({
    where: whereClause,
    include: {
      agent: true,
      user: true,
      sourceDepartment: true,
      targetDepartment: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

exports.findAllTickets = async () => {
  return await prisma.ticket.findMany({
    include: {
      agent: true,
      user: true,
      sourceDepartment: true,
      targetDepartment: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

exports.createTicket = async (data) => {
  return await prisma.ticket.create({
    data,
    include: {
      user: true,
      sourceDepartment: true,
      targetDepartment: true,
    },
  });
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
      user: true,
      agent: true,
      sourceDepartment: true,
      targetDepartment: true,
    },
  });
};

exports.updateTicket = async (id, data) => {
  return await prisma.ticket.update({
    where: { id },
    data,
    include: {
      user: true,
      agent: true,
      sourceDepartment: true,
      targetDepartment: true,
    },
  });
};

exports.createComment = async (data) => {
  return await prisma.comment.create({
    data,
    include: {
      user: true,
    },
  });
};

exports.getCommentsByTicketId = async (ticketId) => {
  return await prisma.comment.findMany({
    where: { ticketId },
    include: {
      user: true,
    },
    orderBy: { createdAt: "asc" },
  });
};

exports.createTransfer = async (data) => {
  return await prisma.ticketTransfer.create({ data });
};

// Analytics database queries
exports.getAnalyticsSummary = async () => {
  const totalTickets = await prisma.ticket.count();
  const criticalTickets = await prisma.ticket.count({
    where: { priority: "CRITICAL" }
  });

  const resolvedTickets = await prisma.ticket.findMany({
    where: {
      status: { in: ["RESOLVED", "CLOSED"] }
    },
    select: {
      createdAt: true,
      updatedAt: true
    }
  });

  let avgResolutionTimeHours = 0;
  if (resolvedTickets.length > 0) {
    const totalDiffMs = resolvedTickets.reduce((sum, ticket) => {
      const diff = ticket.updatedAt.getTime() - ticket.createdAt.getTime();
      return sum + (diff > 0 ? diff : 0);
    }, 0);
    const avgMs = totalDiffMs / resolvedTickets.length;
    avgResolutionTimeHours = Number((avgMs / (1000 * 60 * 60)).toFixed(1));
  }

  return { totalTickets, avgResolutionTimeHours, criticalTickets };
};

exports.getAnalyticsGroupedData = async () => {
  const statusCounts = await prisma.ticket.groupBy({
    by: ["status"],
    _count: { id: true }
  });

  const priorityCounts = await prisma.ticket.groupBy({
    by: ["priority"],
    _count: { id: true }
  });

  const categoryCounts = await prisma.ticket.groupBy({
    by: ["category"],
    _count: { id: true }
  });

  const deptCounts = await prisma.ticket.groupBy({
    by: ["targetDepartmentId"],
    _count: { id: true }
  });

  return { statusCounts, priorityCounts, categoryCounts, deptCounts };
};
