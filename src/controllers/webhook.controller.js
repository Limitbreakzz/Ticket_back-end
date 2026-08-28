const webhookService = require('../services/webhook.service');
const { dispatchWebhook } = require('../utils/webhooks');

// In-memory rate limit: track last test time per webhook ID
// Key: webhookId (string), Value: timestamp (ms)
const testRateLimitMap = new Map();
const TEST_COOLDOWN_MS = 30 * 1000; // 30 seconds

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
    const { name, url, targetDepartment, allowPrivateTickets } = req.body;
    if (!name || !url) {
      return res.status(400).json({
        status: "error",
        message: "กรุณากรอกข้อมูลให้ครบถ้วน"
      });
    }

    const config = await webhookService.createWebhook({
      name,
      url,
      targetDepartment: targetDepartment || 'all',
      allowPrivateTickets: !!allowPrivateTickets,
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
    const { name, url, targetDepartment, allowPrivateTickets, isActive } = req.body;
    const { id } = req.params;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (url !== undefined) updateData.url = url;
    if (targetDepartment !== undefined) updateData.targetDepartment = targetDepartment;
    if (allowPrivateTickets !== undefined) updateData.allowPrivateTickets = allowPrivateTickets;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updated = await webhookService.updateWebhook(id, updateData);
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

exports.testWebhook = async (req, res) => {
  try {
    const { id } = req.params;

    // Rate limit check
    const lastTestedAt = testRateLimitMap.get(id);
    if (lastTestedAt) {
      const elapsed = Date.now() - lastTestedAt;
      if (elapsed < TEST_COOLDOWN_MS) {
        const retryAfter = Math.ceil((TEST_COOLDOWN_MS - elapsed) / 1000);
        return res.status(429).json({
          status: 'error',
          message: `กรุณารอ ${retryAfter} วินาทีก่อนทดสอบซ้ำ`,
          retryAfter
        });
      }
    }

    const webhook = await webhookService.getWebhookById(id);
    if (!webhook) {
      return res.status(404).json({
        status: "error",
        message: "ไม่พบข้อมูล Webhook ในระบบ"
      });
    }

    const testPayload = {
      event: "TICKET_CREATED",
      title: "🧪 ทดสอบการเชื่อมต่อ Webhook",
      description: `การเชื่อมต่อกับระบบ Ticket Hub ทำงานได้ตามปกติ!\nทดสอบส่งโดย: ${req.user.email}\nเวลาส่ง: ${new Date().toLocaleString('th-TH')}`,
      imageUrl: null,
      fields: [
        { name: "สถานะการทดสอบ", value: "✅ ผ่าน (Successful Connection)", inline: true },
        { name: "ชื่อการแจ้งเตือน", value: webhook.name, inline: true }
      ]
    };

    const result = await dispatchWebhook(webhook.url, testPayload);

    if (result.success) {
      testRateLimitMap.set(id, Date.now()); // Record successful test time
      return res.json({
        status: "success",
        message: "ส่ง Webhook ทดสอบสำเร็จ!",
        data: {
          statusCode: result.status,
          statusText: result.statusText,
          responseBody: result.body
        }
      });
    } else {
      return res.status(502).json({
        status: "error",
        message: "การส่ง Webhook ทดสอบล้มเหลว (เกิดข้อผิดพลาดในการเชื่อมต่อไปยัง Discord/ปลายทาง)",
        error: result.error
      });
    }
  } catch (error) {
    console.error("Error testing webhook:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};
