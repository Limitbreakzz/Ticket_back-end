const prisma = require('../prisma');

exports.getActiveDepartments = async () => {
  return await prisma.department.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      code: true,
    },
  });
};

exports.getAllDepartmentsWithCounts = async () => {
  return await prisma.department.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    include: {
      _count: {
        select: {
          users: true,
          sourceTickets: true,
          targetTickets: true,
        },
      },
    },
  });
};

exports.findDepartmentById = async (id) => {
  return await prisma.department.findUnique({ where: { id } });
};

exports.findDuplicateDepartment = async (name, code, excludeId = null) => {
  if (excludeId) {
    return await prisma.department.findFirst({
      where: {
        AND: [
          { id: { not: excludeId } },
          { OR: [{ name }, { code }] }
        ]
      }
    });
  }
  return await prisma.department.findFirst({
    where: {
      OR: [{ name }, { code }],
    },
  });
};

exports.createDepartment = async (data) => {
  return await prisma.department.create({
    data,
    include: {
      _count: {
        select: {
          users: true,
          sourceTickets: true,
          targetTickets: true,
        },
      },
    },
  });
};

exports.updateDepartment = async (id, data) => {
  return await prisma.department.update({
    where: { id },
    data,
    include: {
      _count: {
        select: {
          users: true,
          sourceTickets: true,
          targetTickets: true,
        },
      },
    },
  });
};

exports.deleteDepartment = async (id) => {
  return await prisma.department.delete({ where: { id } });
};
