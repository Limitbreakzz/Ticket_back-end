const prisma = require('../prisma');

exports.findUserByEmail = async (email) => {
  return await prisma.user.findUnique({
    where: { email },
    include: { department: true }
  });
};

exports.createUser = async (data) => {
  return await prisma.user.create({
    data,
  });
};
