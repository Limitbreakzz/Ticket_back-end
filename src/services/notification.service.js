const prisma = require('../prisma');
const socketService = require('./socket.service');

function formatNotification(n) {
  if (!n) return null;
  return {
    ...n,
    id: n.notify_id,
    notify_id: n.notify_id,
    userId: n.user_id,
    user_id: n.user_id,
    isRead: n.is_read,
    is_read: n.is_read,
    createdAt: n.created_at,
    created_at: n.created_at
  };
}

exports.getNotificationsByUserId = async (userId) => {
  const list = await prisma.notification.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
  });
  return list.map(formatNotification);
};

exports.createNotification = async (data) => {
  const payload = {
    user_id: data.user_id || data.userId,
    title: data.title,
    message: data.message,
    link: data.link || null,
    is_read: data.is_read !== undefined ? data.is_read : (data.isRead !== undefined ? data.isRead : false)
  };
  const raw = await prisma.notification.create({ data: payload });
  const notification = formatNotification(raw);
  // Emit to user room in real-time
  socketService.emitToUser(notification.userId, 'notification:new', notification);
  return notification;
};

exports.markNotificationsAsRead = async (userId, notificationId = null) => {
  const whereClause = { user_id: userId };
  if (notificationId) {
    whereClause.notify_id = notificationId;
  } else {
    whereClause.is_read = false;
  }
  return await prisma.notification.updateMany({
    where: whereClause,
    data: { is_read: true },
  });
};
