const prisma = require('../prisma');

exports.getAllWebhooks = async () => {
  return await prisma.webhookConfig.findMany({
    orderBy: { createdAt: 'desc' },
  });
};

exports.getActiveWebhooks = async () => {
  return await prisma.webhookConfig.findMany({
    where: { isActive: true },
  });
};

exports.createWebhook = async (data) => {
  return await prisma.webhookConfig.create({ data });
};

exports.updateWebhook = async (id, data) => {
  return await prisma.webhookConfig.update({
    where: { id },
    data,
  });
};

exports.deleteWebhook = async (id) => {
  return await prisma.webhookConfig.delete({
    where: { id },
  });
};
