const prisma = require('../prisma');
const socketService = require('./socket.service');

exports.getNotificationsByUserId = async (userId) => {
  return await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
};

exports.createNotification = async (data) => {
  const notification = await prisma.notification.create({ data });
  // Emit to user room in real-time
  socketService.emitToUser(notification.userId, 'notification:new', notification);
  return notification;
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
