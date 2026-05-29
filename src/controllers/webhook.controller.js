const webhookService = require('../services/webhook.service');

exports.getWebhooks = async (req, res) => {
  try {
    const webhooks = await webhookService.getAllWebhooks();
    res.json({
      status: "success",
      message: "Webhooks retrieved successfully",
      data: webhooks
    });
  } catch (error) {
    console.error("Error fetching webhooks:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

exports.createWebhook = async (req, res) => {
  try {
    const { name, url } = req.body;
    if (!name || !url) {
      return res.status(400).json({
        status: "error",
        message: "กรุณากรอกข้อมูลให้ครบถ้วน"
      });
    }

    const config = await webhookService.createWebhook({
      name,
      url,
      isActive: true,
    });
    res.json({
      status: "success",
      message: "Webhook created successfully",
      data: config
    });
  } catch (error) {
    console.error("Error creating webhook:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

exports.updateWebhook = async (req, res) => {
  try {
    const { isActive } = req.body;
    const { id } = req.params;

    const updated = await webhookService.updateWebhook(id, { isActive });
    res.json({
      status: "success",
      message: "Webhook updated successfully",
      data: updated
    });
  } catch (error) {
    console.error("Error updating webhook:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

exports.deleteWebhook = async (req, res) => {
  try {
    const { id } = req.params;
    await webhookService.deleteWebhook(id);
    res.json({
      status: "success",
      message: "Webhook deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting webhook:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};
