const notificationService = require('../services/notification.service');

exports.getNotifications = async (req, res) => {
  try {
    const notifications = await notificationService.getNotificationsByUserId(req.user.id);
    res.json({
      status: "success",
      message: "Notifications retrieved successfully",
      data: notifications
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

exports.readNotification = async (req, res) => {
  try {
    const { id } = req.body || {};
    await notificationService.markNotificationsAsRead(req.user.id, id);
    res.json({
      status: "success",
      message: "Notifications marked as read successfully"
    });
  } catch (error) {
    console.error("Error marking notifications as read:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};
