const prisma = require('../prisma');

exports.getAllUsers = async () => {
  const users = await prisma.user.findMany({
    select: {
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
    }
  });

  return users.map(u => ({
    id: u.user_id,
    user_id: u.user_id,
    name: u.name,
    email: u.email,
    username: u.username,
    role: u.role,
    avatarUrl: u.avatar_url,
    avatar_url: u.avatar_url,
    departmentId: u.dept_id,
    dept_id: u.dept_id,
    createdAt: u.created_at,
    created_at: u.created_at,
    department: u.department ? {
      id: u.department.dept_id,
      dept_id: u.department.dept_id,
      name: u.department.name,
      code: u.department.code
    } : null
  }));
};

exports.getUserById = async (id) => {
  const u = await prisma.user.findUnique({
    where: { user_id: id },
    include: { department: true }
  });
  if (!u) return null;
  return {
    ...u,
    id: u.user_id,
    avatarUrl: u.avatar_url,
    departmentId: u.dept_id,
    department: u.department ? {
      ...u.department,
      id: u.department.dept_id
    } : null
  };
};

exports.getAllUsersForAdmin = async () => {
  const users = await prisma.user.findMany({
    orderBy: { created_at: "desc" },
    select: {
      user_id: true,
      name: true,
      email: true,
      role: true,
      avatar_url: true,
      created_at: true,
      dept_id: true,
      department: {
        select: {
          dept_id: true,
          name: true,
          code: true,
        },
      },
    },
  });

  return users.map(u => ({
    id: u.user_id,
    user_id: u.user_id,
    name: u.name,
    email: u.email,
    role: u.role,
    avatarUrl: u.avatar_url,
    avatar_url: u.avatar_url,
    createdAt: u.created_at,
    created_at: u.created_at,
    departmentId: u.dept_id,
    dept_id: u.dept_id,
    department: u.department ? {
      id: u.department.dept_id,
      dept_id: u.department.dept_id,
      name: u.department.name,
      code: u.department.code
    } : null
  }));
};

exports.findUserByEmail = async (email) => {
  const u = await prisma.user.findUnique({
    where: { email },
    include: { department: true }
  });
  if (!u) return null;
  return {
    ...u,
    id: u.user_id,
    avatarUrl: u.avatar_url,
    departmentId: u.dept_id,
    department: u.department ? {
      ...u.department,
      id: u.department.dept_id
    } : null
  };
};

exports.createUser = async (data) => {
  const payload = {
    username: data.username,
    email: data.email,
    name: data.name,
    password: data.password,
    role: data.role,
    avatar_url: data.avatar_url || data.avatarUrl,
    dept_id: data.dept_id || data.departmentId
  };

  const u = await prisma.user.create({
    data: payload,
    select: {
      user_id: true,
      name: true,
      email: true,
      role: true,
      avatar_url: true,
      created_at: true,
      dept_id: true,
      department: {
        select: {
          dept_id: true,
          name: true,
          code: true,
        },
      },
    },
  });

  return {
    id: u.user_id,
    user_id: u.user_id,
    name: u.name,
    email: u.email,
    role: u.role,
    avatarUrl: u.avatar_url,
    avatar_url: u.avatar_url,
    createdAt: u.created_at,
    created_at: u.created_at,
    departmentId: u.dept_id,
    dept_id: u.dept_id,
    department: u.department ? {
      id: u.department.dept_id,
      dept_id: u.department.dept_id,
      name: u.department.name,
      code: u.department.code
    } : null
  };
};

exports.updateUser = async (id, data) => {
  const payload = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.email !== undefined) payload.email = data.email;
  if (data.username !== undefined) payload.username = data.username;
  if (data.role !== undefined) payload.role = data.role;
  if (data.password !== undefined) payload.password = data.password;
  if (data.avatar_url !== undefined || data.avatarUrl !== undefined) {
    payload.avatar_url = data.avatar_url || data.avatarUrl;
  }
  if (data.dept_id !== undefined || data.departmentId !== undefined) {
    payload.dept_id = data.dept_id || data.departmentId;
  }

  const u = await prisma.user.update({
    where: { user_id: id },
    data: payload,
    select: {
      user_id: true,
      name: true,
      email: true,
      username: true,
      role: true,
      avatar_url: true,
      created_at: true,
      dept_id: true,
      department: {
        select: {
          dept_id: true,
          name: true,
          code: true,
        },
      },
    },
  });

  return {
    id: u.user_id,
    user_id: u.user_id,
    name: u.name,
    email: u.email,
    username: u.username,
    role: u.role,
    avatarUrl: u.avatar_url,
    avatar_url: u.avatar_url,
    createdAt: u.created_at,
    created_at: u.created_at,
    departmentId: u.dept_id,
    dept_id: u.dept_id,
    department: u.department ? {
      id: u.department.dept_id,
      dept_id: u.department.dept_id,
      name: u.department.name,
      code: u.department.code
    } : null
  };
};

exports.deleteUserWithTransaction = async (id) => {
  return await prisma.$transaction([
    prisma.comment.deleteMany({ where: { user_id: id } }),
    prisma.ticket.updateMany({ where: { agent_id: id }, data: { agent_id: null } }),
    prisma.comment.deleteMany({ where: { ticket: { user_id: id } } }),
    prisma.ticket.deleteMany({ where: { user_id: id } }),
    prisma.user.delete({ where: { user_id: id } }),
  ]);
};

exports.findUsersByDepartmentId = async (departmentId) => {
  const users = await prisma.user.findMany({
    where: { dept_id: departmentId },
    select: { user_id: true }
  });
  return users.map(u => ({ id: u.user_id, user_id: u.user_id }));
};

exports.findAdmins = async () => {
  const users = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { user_id: true }
  });
  return users.map(u => ({ id: u.user_id, user_id: u.user_id }));
};

exports.findManagersByDepartmentId = async (departmentId) => {
  const users = await prisma.user.findMany({
    where: {
      dept_id: departmentId,
      role: "MANAGER"
    },
    select: { user_id: true }
  });
  return users.map(u => ({ id: u.user_id, user_id: u.user_id }));
};
