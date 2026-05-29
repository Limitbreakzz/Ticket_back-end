const prisma = require('../prisma');

exports.getAllUsers = async () => {
  return await prisma.user.findMany();
};

exports.getUserById = async (id) => {
  return await prisma.user.findUnique({
    where: { id }
  });
};

exports.getUserByIdWithDept = async (id) => {
  return await prisma.user.findUnique({
    where: { id },
    include: { department: true }
  });
};

exports.getAllUsersForAdmin = async () => {
  return await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarUrl: true,
      createdAt: true,
      departmentId: true,
      department: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });
};

exports.findUserByEmail = async (email) => {
  return await prisma.user.findUnique({
    where: { email }
  });
};

exports.createUser = async (data) => {
  return await prisma.user.create({
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarUrl: true,
      createdAt: true,
      departmentId: true,
      department: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });
};

exports.updateUser = async (id, data) => {
  return await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarUrl: true,
      createdAt: true,
      departmentId: true,
      department: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });
};

exports.deleteUserWithTransaction = async (id) => {
  return await prisma.$transaction([
    prisma.comment.deleteMany({ where: { userId: id } }),
    prisma.ticket.updateMany({ where: { agentId: id }, data: { agentId: null } }),
    prisma.comment.deleteMany({ where: { ticket: { userId: id } } }),
    prisma.ticket.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ]);
};

exports.findUsersByDepartmentId = async (departmentId) => {
  return await prisma.user.findMany({
    where: { departmentId },
    select: { id: true }
  });
};

exports.findAdmins = async () => {
  return await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true }
  });
};

exports.findManagersByDepartmentId = async (departmentId) => {
  return await prisma.user.findMany({
    where: {
      departmentId,
      role: "MANAGER"
    },
    select: { id: true }
  });
};

