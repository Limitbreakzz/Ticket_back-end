const prisma = require('../prisma');

exports.getNotificationsByUserId = async (userId) => {
  return await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
};

exports.createNotification = async (data) => {
  return await prisma.notification.create({ data });
};

exports.markNotificationsAsRead = async (userId, notificationId = null) => {
  const whereClause = { userId };
  if (notificationId) {
    whereClause.id = notificationId;
  } else {
    whereClause.isRead = false;
  }
  return await prisma.notification.updateMany({
    where: whereClause,
    data: { isRead: true },
  });
};
