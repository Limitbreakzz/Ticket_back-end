const prisma = require('../prisma');

function formatWebhook(w) {
  if (!w) return null;
  return {
    ...w,
    id: w.webhook_id,
    webhook_id: w.webhook_id,
    targetDepartment: w.target_dept,
    target_dept: w.target_dept,
    allowPrivateTickets: w.allow_private,
    allow_private: w.allow_private,
    isActive: w.is_active,
    is_active: w.is_active,
    createdAt: w.created_at,
    created_at: w.created_at,
    updatedAt: w.updated_at,
    updated_at: w.updated_at
  };
}

exports.getAllWebhooks = async () => {
  const list = await prisma.webhookConfig.findMany({
    orderBy: { created_at: 'desc' },
  });
  return list.map(formatWebhook);
};

exports.getActiveWebhooks = async () => {
  const list = await prisma.webhookConfig.findMany({
    where: { is_active: true },
  });
  return list.map(formatWebhook);
};

exports.createWebhook = async (data) => {
  const payload = {
    name: data.name,
    url: data.url,
    target_dept: data.target_dept || data.targetDepartment || "all",
    allow_private: data.allow_private !== undefined ? data.allow_private : (data.allowPrivateTickets !== undefined ? data.allowPrivateTickets : false),
    is_active: data.is_active !== undefined ? data.is_active : (data.isActive !== undefined ? data.isActive : true)
  };
  const raw = await prisma.webhookConfig.create({ data: payload });
  return formatWebhook(raw);
};

exports.updateWebhook = async (id, data) => {
  const payload = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.url !== undefined) payload.url = data.url;
  if (data.target_dept !== undefined || data.targetDepartment !== undefined) {
    payload.target_dept = data.target_dept || data.targetDepartment;
  }
  if (data.allow_private !== undefined || data.allowPrivateTickets !== undefined) {
    payload.allow_private = data.allow_private !== undefined ? data.allow_private : data.allowPrivateTickets;
  }
  if (data.is_active !== undefined || data.isActive !== undefined) {
    payload.is_active = data.is_active !== undefined ? data.is_active : data.isActive;
  }

  const raw = await prisma.webhookConfig.update({
    where: { webhook_id: id },
    data: payload,
  });
  return formatWebhook(raw);
};

exports.deleteWebhook = async (id) => {
  return await prisma.webhookConfig.delete({
    where: { webhook_id: id },
  });
};

exports.getWebhookById = async (id) => {
  const raw = await prisma.webhookConfig.findUnique({
    where: { webhook_id: id },
  });
  return formatWebhook(raw);
};
