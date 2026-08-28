const prisma = require('../prisma');

exports.findUserByUsername = async (username) => {
  return await prisma.user.findUnique({
    where: { username },
    include: { department: true }
  });
};

exports.upsertExternalUser = async (username, email, name, role, departmentName) => {
  let departmentId = null;
  if (departmentName) {
    let dept = await prisma.department.findUnique({
      where: { name: departmentName }
    });
    if (!dept) {
      const code = departmentName.substring(0, 10) + Math.floor(Math.random() * 1000);
      dept = await prisma.department.create({
        data: {
          name: departmentName,
          code: code
        }
      });
    }
    departmentId = dept.dept_id;
  }

  let user = await prisma.user.findUnique({
    where: { username }
  });

  if (!user && email) {
    user = await prisma.user.findUnique({
      where: { email }
    });
  }

  if (user) {
    return await prisma.user.update({
      where: { user_id: user.user_id },
      data: {
        username,
        email,
        name,
        role,
        dept_id: departmentId
      },
      include: { department: true }
    });
  } else {
    return await prisma.user.create({
      data: {
        username,
        email,
        name,
        role,
        dept_id: departmentId
      },
      include: { department: true }
    });
  }
};

