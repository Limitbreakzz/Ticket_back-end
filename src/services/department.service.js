const prisma = require('../prisma');

exports.getActiveDepartments = async () => {
  const depts = await prisma.department.findMany({
    where: { is_active: true },
    orderBy: { name: 'asc' },
    select: {
      dept_id: true,
      name: true,
      code: true,
    },
  });

  return depts.map(d => ({
    id: d.dept_id,
    dept_id: d.dept_id,
    name: d.name,
    code: d.code
  }));
};

exports.getAllDepartmentsWithCounts = async () => {
  const depts = await prisma.department.findMany({
    orderBy: [{ is_active: "desc" }, { created_at: "asc" }],
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

  return depts.map(d => ({
    ...d,
    id: d.dept_id,
    isActive: d.is_active,
    createdAt: d.created_at,
    updatedAt: d.updated_at
  }));
};

exports.findDepartmentById = async (id) => {
  const d = await prisma.department.findUnique({ where: { dept_id: id } });
  if (!d) return null;
  return {
    ...d,
    id: d.dept_id,
    isActive: d.is_active,
    createdAt: d.created_at,
    updatedAt: d.updated_at
  };
};

exports.findDuplicateDepartment = async (name, code, excludeId = null) => {
  if (excludeId) {
    return await prisma.department.findFirst({
      where: {
        AND: [
          { dept_id: { not: excludeId } },
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
  const payload = {
    name: data.name,
    code: data.code,
    is_active: data.is_active !== undefined ? data.is_active : (data.isActive !== undefined ? data.isActive : true)
  };

  const d = await prisma.department.create({
    data: payload,
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

  return {
    ...d,
    id: d.dept_id,
    isActive: d.is_active,
    createdAt: d.created_at,
    updatedAt: d.updated_at
  };
};

exports.updateDepartment = async (id, data) => {
  const payload = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.code !== undefined) payload.code = data.code;
  if (data.is_active !== undefined) payload.is_active = data.is_active;
  if (data.isActive !== undefined) payload.is_active = data.isActive;

  const d = await prisma.department.update({
    where: { dept_id: id },
    data: payload,
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

  return {
    ...d,
    id: d.dept_id,
    isActive: d.is_active,
    createdAt: d.created_at,
    updatedAt: d.updated_at
  };
};

exports.deleteDepartment = async (id) => {
  return await prisma.department.delete({ where: { dept_id: id } });
};
