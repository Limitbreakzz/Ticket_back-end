const prisma = require('../prisma');
const ticketService = require('../services/ticket.service');
const departmentService = require('../services/department.service');
const userService = require('../services/user.service');
const notificationService = require('../services/notification.service');
const webhookService = require('../services/webhook.service');
const { dispatchWebhook } = require('../utils/webhooks');
const slaUtil = require('../utils/sla');
const xss = require('xss'); // BUG-005 fix: XSS sanitization
const socketService = require('../services/socket.service');

const SUBCATEGORY_THAI_MAP = {
  computer_laptop: "คอมพิวเตอร์ / โน้ตบุ๊ก",
  monitor: "หน้าจอ / จอภาพ",
  printer_scanner: "ปริ้นเตอร์",
  accessory: "คีย์บอร์ด / เมาส์",
  hardware_other: "อุปกรณ์อื่นๆ",
  os_system: "OS (Windows / macOS)",
  office_apps: "Microsoft 365 / Outlook",
  internal_systems: "ERP / ระบบงานภายใน",
  install_update: "ติดตั้ง / อัปเดตโปรแกรม",
  software_other: "ซอฟต์แวร์อื่นๆ",
  wifi_issue: "ต่อ Wi-Fi ไม่ได้",
  lan_issue: "เน็ตสายแลนเสีย",
  vpn_remote: "VPN / เข้าถึงระยะไกล",
  slow_network: "เน็ตช้า / หลุดบ่อย",
  network_other: "ระบบเครือข่ายอื่นๆ",
  password_reset: "รีเซ็ตรหัสผ่าน / ปลดล็อกบัญชี",
  shared_folder: "ขอสิทธิ์โฟลเดอร์แชร์",
  license_request: "ขอสิทธิ์ใช้งานโปรแกรม / อีเมล",
  keycard_building: "บัตรพนักงาน / สิทธิ์เข้าออกอาคาร",
  access_other: "สิทธิ์เข้าใช้งานอื่นๆ",
  desk_chair: "ขอโต๊ะทำงาน / เก้าอี้",
  stationery: "อุปกรณ์สำนักงาน / เครื่องเขียน",
  intern_coord: "ประสานงานนักศึกษาฝึกงาน",
  consultation: "ขอคำปรึกษา / แนะนำทั่วไป",
  other_general: "บริการและคำขอทั่วไปอื่นๆ",
};

// Calculate SLA resolution deadline based on severity and category, skipping weekends (Saturday and Sunday)
function calculateSLADueDate(priority) {
  const date = new Date();
  const DEFAULT_SLA = {
    CRITICAL: 4,
    HIGH: 8,
    MEDIUM: 24,
    LOW: 72
  };

  const hoursToAdd = DEFAULT_SLA[priority] || 24; // Default fallback to 24 hours
  let hoursRemaining = hoursToAdd;
  
  while (hoursRemaining > 0) {
    date.setHours(date.getHours() + 1);
    const day = date.getDay(); // 0 = Sunday, 6 = Saturday
    if (day !== 0 && day !== 6) {
      hoursRemaining--;
    }
  }
  return date;
}

async function createNotification({ userId, title, message, link }) {
  try {
    return await notificationService.createNotification({ userId, title, message, link });
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
}

const translateStatus = (s) => {
  switch (s) {
    case "NEW": return "🆕 รอดำเนินการ";
    case "APPROVED": return "🟢 อนุมัติแล้ว";
    case "IN_PROGRESS": return "🟡 กำลังดำเนินการ";
    case "RESOLVED": return "🟢 แก้ไขเสร็จสิ้น";
    case "CLOSED": return "⚫ ปิดเรื่องถาวร";
    case "CANCELLED": return "🚫 ยกเลิกโดยผู้ส่ง";
    case "FORWARDED": return "➡️ ส่งต่อแผนกอื่น";
    case "PENDING_APPROVAL": return "⏳ รออนุมัติ";
    case "PENDING_DEPARTMENT": return "🏢 รอตอบรับจากแผนก";
    case "WAITING_PARTS": return "🔧 รออะไหล่/อุปกรณ์";
    case "REJECTED": return "❌ ปฏิเสธการอนุมัติ";
    default: return s;
  }
};

// Retrieval and creation

exports.getAllTickets = async (req, res) => {
  try {
    const user = req.user;
    const page = req.query.page ? parseInt(req.query.page, 10) : null;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;
    const { status, priority, category, search } = req.query;

    let tickets = [];
    let ticketsWhereClause = {};

    if (user.role === "ADMIN") {
      const andConditions = [];
      if (status) andConditions.push({ status: status.toUpperCase() });
      if (priority) andConditions.push({ priority: priority.toUpperCase() });
      if (category) andConditions.push({ category: category.toUpperCase() });
      if (search) {
        andConditions.push({
          OR: [
            { title: { contains: search } },
            { description: { contains: search } },
            { comments: { some: { message: { contains: search } } } }
          ]
        });
      }
      if (andConditions.length > 0) {
        ticketsWhereClause.AND = andConditions;
      }
      tickets = await ticketService.findAllTickets(page, limit, ticketsWhereClause);
    } else {
      const departmentOrConditions = user.departmentId
        ? [
            { sourceDepartmentId: user.departmentId, receiverManagerId: null },
            { targetDepartmentId: user.departmentId, receiverManagerId: null },
          ]
        : [];

      const baseOrConditions = [
        { userId: user.id },
        { agentId: user.id },
        { receiverManagerId: user.id },
        ...departmentOrConditions,
        {
          targetDepartmentId: null,
          agentId: null,
          receiverManagerId: null,
        },
        {
          targetDepartment: {
            name: 'ส่วนกลาง'
          },
          agentId: null,
        },
        {
          targetDepartment: {
            code: 'HQ'
          },
          agentId: null,
        },
      ];

      const andConditions = [
        { OR: baseOrConditions }
      ];

      if (status) andConditions.push({ status: status.toUpperCase() });
      if (priority) andConditions.push({ priority: priority.toUpperCase() });
      if (category) andConditions.push({ category: category.toUpperCase() });
      if (search) {
        andConditions.push({
          OR: [
            { title: { contains: search } },
            { description: { contains: search } },
            { comments: { some: { message: { contains: search } } } }
          ]
        });
      }

      ticketsWhereClause = { AND: andConditions };
      tickets = await ticketService.findManyTickets(ticketsWhereClause, page, limit);
    }

    const computedTickets = tickets.map(tk => {
      const sla = slaUtil.calcSLA(tk, tk.comments);
      const responseSla = slaUtil.calcResponseSLA(tk, tk.comments);
      return {
        ...tk,
        sla,
        responseSla
      };
    });

    let total = null;
    let totalPages = null;

    if (page && limit) {
      total = await ticketService.countTickets(ticketsWhereClause);
      totalPages = Math.ceil(total / limit);
    }

    res.json({
      status: "success",
      message: "Tickets retrieved successfully",
      data: computedTickets,
      ...(page && limit ? { pagination: { total, page, limit, totalPages } } : {})
    });
  } catch (error) {
    console.error("Error fetching tickets:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

exports.createTicket = async (req, res) => {
  try {
    const user = req.user;
    const { 
      title, 
      description, 
      category, 
      subcategory, 
      priority, 
      attachmentUrl, 
      sourceDepartmentId, 
      targetDepartmentId,
      receiverManagerId
    } = req.body;

    // BUG-006 fix: Input validation — return 400 instead of 500 for missing required fields
    if (!title || !title.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'กรุณาระบุหัวข้อ Ticket'
      });
    }
    if (!category) {
      return res.status(400).json({
        status: 'error',
        message: 'กรุณาระบุหมวดหมู่'
      });
    }

    // BUG-005 fix: XSS sanitization — strip all HTML tags from free-text fields
    const xssOptions = { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ['script'] };
    const sanitizedTitle = xss(title.trim(), xssOptions);
    const sanitizedDescription = description ? xss(description.trim(), xssOptions) : '';
    const sanitizedSubcategory = subcategory ? xss(subcategory.trim(), xssOptions) : null;

    if (receiverManagerId) {
      if (user.role !== "MANAGER") {
        return res.status(403).json({
          status: "error",
          message: "เฉพาะ MANAGER เท่านั้นที่สามารถสร้าง Ticket ส่งตรงถึง MANAGER คนอื่นได้"
        });
      }

      const targetUser = await userService.getUserById(receiverManagerId);
      if (!targetUser || targetUser.role !== "MANAGER") {
        return res.status(400).json({
          status: "error",
          message: "ผู้รับปลายทางต้องเป็นผู้ใช้งานที่มีบทบาทเป็น MANAGER เท่านั้น"
        });
      }
    }

    const computedSlaDueDate = calculateSLADueDate(priority || "MEDIUM");

    const ticket = await ticketService.createTicket({
      title: sanitizedTitle,
      description: sanitizedDescription,
      category,
      subcategory: sanitizedSubcategory || null,
      priority: priority || "MEDIUM",
      slaDueDate: computedSlaDueDate,
      attachmentUrl: attachmentUrl || null,
      userId: user.id,
      status: "NEW",
      sourceDepartmentId: sourceDepartmentId || user.departmentId || null,
      targetDepartmentId: receiverManagerId ? null : (targetDepartmentId || null),
      receiverManagerId: receiverManagerId || null,
    });

    // Link uploaded attachment to this ticket
    if (attachmentUrl) {
      try {
        const prismaInstance = require('../prisma');
        await prismaInstance.attachment.updateMany({
          where: { file_url: attachmentUrl },
          data: { ticket_id: ticket.id }
        });
      } catch (err) {
        console.error("Failed to link attachment:", err);
      }
    }

    const categoryThai = ({
      HARDWARE: "ฮาร์ดแวร์ / อุปกรณ์",
      SOFTWARE: "ซอฟต์แวร์ / โปรแกรม",
      NETWORK: "อินเทอร์เน็ต / Wi-Fi",
      ACCESS: "สิทธิ์เข้าใช้งาน",
      OTHER: "ทั่วไป / บริการอื่นๆ",
    })[category] || category;

    const subLabel = subcategory ? SUBCATEGORY_THAI_MAP[subcategory] || subcategory : null;
    const catDisplay = subLabel ? `${categoryThai} > ${subLabel}` : categoryThai;

    const priorityThai = ({
      LOW: "ต่ำ",
      MEDIUM: "ปานกลาง",
      HIGH: "สูง",
      CRITICAL: "วิกฤต",
    })[priority || "MEDIUM"] || (priority || "ปานกลาง");

    await ticketService.createComment({
      ticketId: ticket.id,
      userId: user.id,
      message: `📋 ระบบ: Ticket ถูกจัดตั้งเข้าระบบสำเร็จแล้วในหมวดหมู่ [${catDisplay}] ความเร่งด่วน [${priorityThai}] สถานะตอนนี้คือ [รอดำเนินการ]`,
    });

    try {
      const recipientIds = [];
      if (ticket.receiverManagerId) {
        if (ticket.receiverManagerId !== user.id) {
          recipientIds.push(ticket.receiverManagerId);
        }
      } else if (ticket.targetDepartmentId) {
        const targetDeptUsers = await userService.findUsersByDepartmentId(ticket.targetDepartmentId);
        targetDeptUsers.forEach(u => {
          if (u.id !== user.id) recipientIds.push(u.id);
        });
      } else {
        const admins = await userService.findAdmins();
        admins.forEach(u => {
          if (u.id !== user.id) recipientIds.push(u.id);
        });
      }

      for (const recipientId of recipientIds) {
        await createNotification({
          userId: recipientId,
          title: "📋 มี Ticket แจ้งเรื่อง/คำขอใหม่เข้ามา",
          message: `Ticket หัวข้อ: "${ticket.title}" ถูกส่งมาโดย ${user.name}`,
          link: `/tickets/${ticket.id}`,
        });
      }
    } catch (notifErr) {
      console.error("Failed to create in-app notifications:", notifErr);
    }

    try {
      const activeWebhooks = await webhookService.getActiveWebhooks();

      const getCategoryLabel = (cat) => {
        switch (cat) {
          case "HARDWARE": return "💻 ฮาร์ดแวร์ / อุปกรณ์";
          case "SOFTWARE": return "💿 ซอฟต์แวร์ / โปรแกรม";
          case "NETWORK": return "🌐 อินเทอร์เน็ต / Wi-Fi";
          case "ACCESS": return "🔑 สิทธิ์เข้าใช้งาน";
          case "OTHER": return "📦 ทั่วไป / บริการอื่นๆ";
          default: return `📦 ${cat}`;
        }
      };

      const getSubcategoryLabel = (sub) => {
        if (!sub) return "-";
        return SUBCATEGORY_THAI_MAP[sub] || sub;
      };

      const getPriorityLabel = (prio) => {
        switch (prio) {
          case "LOW": return "🟢 ต่ำ";
          case "MEDIUM": return "🔵 ปานกลาง";
          case "HIGH": return "🟡 สูง";
          case "CRITICAL": return "🔴 วิกฤต";
          default: return prio;
        }
      };

      const descriptionPreview = ticket.description.length > 200 
        ? ticket.description.substring(0, 200) + "..." 
        : ticket.description;

      for (const config of activeWebhooks) {
        // 1. If it's a private ticket (receiverManagerId is set), only send if allowPrivateTickets is true
        if (ticket.receiverManagerId && !config.allowPrivateTickets) {
          continue;
        }

        // 2. If it's a public ticket and config has a specific targetDepartment, check if it matches
        if (!ticket.receiverManagerId && config.targetDepartment && config.targetDepartment !== 'all') {
          const ticketDept = ticket.targetDepartment?.name || "ส่วนกลาง";
          const webhookDept = config.targetDepartment;
          
          const normalize = (name) => name.replace('แผนก', '').replace('ฝ่าย', '').trim().toLowerCase();
          
          if (normalize(ticketDept) !== normalize(webhookDept)) {
            continue;
          }
        }

        await dispatchWebhook(config.url, {
          event: "TICKET_CREATED",
          title: "📋 มี Ticket แจ้งเรื่อง/คำขอใหม่เข้ามาในระบบ!",
          description: descriptionPreview,
          text: `มี Ticket แจ้งเรื่อง/คำขอใหม่เข้ามาในระบบ! หัวข้อ: ${ticket.title} ผู้ส่ง: ${ticket.user.name} (แผนก: ${ticket.sourceDepartment?.name || "ไม่ระบุ"}) ส่งถึง: ${ticket.targetDepartment?.name || "ศูนย์บริการส่วนกลาง"} หมวดหมู่: ${getCategoryLabel(ticket.category)} หมวดหมู่ย่อย: ${getSubcategoryLabel(ticket.subcategory)} ระดับความสำคัญ: ${getPriorityLabel(ticket.priority)}`,
          fields: [
            { name: "หัวข้อ", value: ticket.title, inline: false },
            { name: "ผู้ส่ง", value: `👤 ${ticket.user.name}`, inline: true },
            { name: "แผนกผู้แจ้ง", value: `🏢 ${ticket.sourceDepartment?.name || "ไม่ระบุ"}`, inline: true },
            { name: "ส่งถึงแผนกปลายทาง", value: `⚙️ ${ticket.targetDepartment?.name || "ศูนย์บริการส่วนกลาง"}`, inline: false },
            { name: "หมวดหมู่", value: getCategoryLabel(ticket.category), inline: true },
            { name: "หมวดหมู่ย่อย", value: `🏷️ ${getSubcategoryLabel(ticket.subcategory)}`, inline: true },
            { name: "ระดับความสำคัญ", value: getPriorityLabel(ticket.priority), inline: true },
            { name: "ลิงก์ Ticket", value: `🔗 [คลิกเพื่อดูรายละเอียด Ticket](${process.env.FRONTEND_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://ticket-hub-g6yc.onrender.com"}/tickets/${ticket.id})`, inline: false },
          ],
          imageUrl: ticket.attachmentUrl || undefined,
        });
      }
    } catch (webhookErr) {
      console.error("Failed to process webhooks:", webhookErr);
    }

    res.json({
      status: "success",
      message: "Ticket created successfully",
      data: ticket
    });
  } catch (error) {
    console.error("Error creating ticket:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

// Metrics

exports.getPendingCount = async (req, res) => {
  try {
    const user = req.user;
    if (user.role !== "ADMIN" && user.role !== "MANAGER") {
      return res.json({
        status: "success",
        message: "Pending tickets count retrieved successfully",
        data: { count: 0 }
      });
    }

    let count = 0;
    if (user.role === "ADMIN") {
      count = await ticketService.countTickets({
        status: "PENDING_APPROVAL"
      });
    } else if (user.role === "MANAGER" && user.departmentId) {
      count = await ticketService.countTickets({
        status: "PENDING_APPROVAL",
        OR: [
          { sourceDepartmentId: user.departmentId },
          { targetDepartmentId: user.departmentId }
        ]
      });
    }

    res.json({
      status: "success",
      message: "Pending tickets count retrieved successfully",
      data: { count }
    });
  } catch (error) {
    console.error("Error fetching pending tickets count:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

exports.getOutboxCount = async (req, res) => {
  try {
    const user = req.user;
    const count = await ticketService.countTickets({
      userId: user.id,
      status: {
        notIn: ["RESOLVED", "CLOSED", "CANCELLED", "REJECTED"]
      }
    });

    res.json({
      status: "success",
      message: "Outbox tickets count retrieved successfully",
      data: { count }
    });
  } catch (error) {
    console.error("Error fetching outbox tickets count:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

// Detail and communications

exports.getTicketDetail = async (req, res) => {
  try {
    const user = req.user;
    const ticketId = req.params.id;

    const ticket = await ticketService.findTicketByIdWithDetails(ticketId);

    if (!ticket) {
      return res.status(404).json({
        status: "error",
        message: "ไม่พบ Ticket นี้"
      });
    }

    let hasAccess = false;
    if (ticket.receiverManagerId) {
      hasAccess = 
        user.role === "ADMIN" ||
        ticket.userId === user.id ||
        ticket.receiverManagerId === user.id ||
        ticket.agentId === user.id;
    } else {
      hasAccess =
        user.role === "ADMIN" ||
        ticket.userId === user.id ||
        ticket.agentId === user.id ||
        (user.departmentId && ticket.sourceDepartmentId === user.departmentId) ||
        (user.departmentId && ticket.targetDepartmentId === user.departmentId) ||
        (ticket.targetDepartmentId === null && ticket.agentId === null && ticket.receiverManagerId === null) ||
        ((ticket.targetDepartment?.name === 'ส่วนกลาง' || ticket.targetDepartment?.code === 'HQ') && ticket.agentId === null);
    }

    if (!hasAccess) {
      return res.status(403).json({
        status: "error",
        message: "คุณไม่มีสิทธิ์เข้าถึง Ticket นี้"
      });
    }

    // Mark comments written by others as read when user opens the ticket
    const updateResult = await ticketService.markCommentsAsRead(ticketId, user.id);
    if (updateResult.count > 0) {
      socketService.emitToTicket(ticketId, 'comment:read', { ticketId, readBy: user.id });
    }

    const comments = await ticketService.getCommentsByTicketId(ticketId);

    const sla = slaUtil.calcSLA(ticket, comments);
    const responseSla = slaUtil.calcResponseSLA(ticket, comments);
    const ticketWithSla = {
      ...ticket,
      sla,
      responseSla
    };

    res.json({
      status: "success",
      message: "Ticket details and comments retrieved successfully",
      data: { ticket: ticketWithSla, comments }
    });
  } catch (error) {
    console.error("Error fetching ticket details:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

exports.getTicketChatUpdates = async (req, res) => {
  try {
    const user = req.user;
    const ticketId = req.params.id;

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        userId: true,
        agentId: true,
        status: true,
        sourceDepartmentId: true,
        targetDepartmentId: true,
        receiverManagerId: true,
        agent: {
          select: {
            name: true,
            avatarUrl: true
          }
        },
        targetDepartment: {
          select: {
            name: true,
            code: true
          }
        }
      }
    });

    if (!ticket) {
      return res.status(404).json({
        status: "error",
        message: "ไม่พบ Ticket นี้"
      });
    }

    let hasAccess = false;
    if (ticket.receiverManagerId) {
      hasAccess = 
        user.role === "ADMIN" ||
        ticket.userId === user.id ||
        ticket.receiverManagerId === user.id ||
        ticket.agentId === user.id;
    } else {
      hasAccess =
        user.role === "ADMIN" ||
        ticket.userId === user.id ||
        ticket.agentId === user.id ||
        (user.departmentId && ticket.sourceDepartmentId === user.departmentId) ||
        (user.departmentId && ticket.targetDepartmentId === user.departmentId) ||
        (ticket.targetDepartmentId === null && ticket.agentId === null && ticket.receiverManagerId === null) ||
        ((ticket.targetDepartment?.name === 'ส่วนกลาง' || ticket.targetDepartment?.code === 'HQ') && ticket.agentId === null);
    }

    if (!hasAccess) {
      return res.status(403).json({
        status: "error",
        message: "คุณไม่มีสิทธิ์เข้าถึง Ticket นี้"
      });
    }

    const comments = await prisma.comment.findMany({
      where: { ticketId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json({
      status: "success",
      message: "Ticket chat updates retrieved successfully",
      data: {
        status: ticket.status,
        agent: ticket.agent,
        targetDepartment: ticket.targetDepartment,
        comments
      }
    });
  } catch (error) {
    console.error("Error fetching ticket chat updates:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

exports.addComment = async (req, res) => {
  try {
    const user = req.user;
    const { message, attachmentUrl } = req.body;
    const ticketId = req.params.id;

    let finalMessage = (message || "").trim();
    if (!finalMessage) {
      if (attachmentUrl) {
        finalMessage = "ส่งรูปภาพประกอบ";
      } else {
        return res.status(400).json({
          status: "error",
          message: "กรุณากรอกข้อความ"
        });
      }
    }

    const ticket = await ticketService.findTicketByIdWithRelations(ticketId);

    if (!ticket) {
      return res.status(404).json({
        status: "error",
        message: "ไม่พบ Ticket นี้"
      });
    }

    let hasAccess = false;
    if (ticket.receiverManagerId) {
      hasAccess =
        user.role === "ADMIN" ||
        ticket.userId === user.id ||
        ticket.receiverManagerId === user.id ||
        ticket.agentId === user.id;
    } else {
      hasAccess =
        user.role === "ADMIN" ||
        ticket.userId === user.id ||
        ticket.agentId === user.id ||
        (user.departmentId && ticket.sourceDepartmentId === user.departmentId) ||
        (user.departmentId && ticket.targetDepartmentId === user.departmentId) ||
        (ticket.targetDepartmentId === null && ticket.agentId === null && ticket.receiverManagerId === null) ||
        ((ticket.targetDepartment?.name === 'ส่วนกลาง' || ticket.targetDepartment?.code === 'HQ') && ticket.agentId === null);
    }

    if (!hasAccess) {
      return res.status(403).json({
        status: "error",
        message: "คุณไม่มีสิทธิ์เข้าถึงหรือเพิ่มข้อคิดเห็นใน Ticket นี้"
      });
    }

    if (ticket.status === "CANCELLED" || ticket.status === "CLOSED") {
      return res.status(400).json({
        status: "error",
        message: "ไม่สามารถส่งข้อความเพิ่มเติมใน Ticket ที่ยกเลิกหรือปิดเคสแล้ว"
      });
    }

    const comment = await ticketService.createComment({
      ticketId,
      userId: user.id,
      message: finalMessage,
      attachmentUrl: attachmentUrl || null,
    });

    // Link uploaded attachment to this ticket
    if (attachmentUrl) {
      try {
        const prismaInstance = require('../prisma');
        await prismaInstance.attachment.updateMany({
          where: { file_url: attachmentUrl },
          data: { ticket_id: ticketId }
        });
      } catch (err) {
        console.error("Failed to link comment attachment:", err);
      }
    }

    try {
      if (ticket) {
        if (user.id === ticket.userId) {
          if (ticket.agentId && ticket.agentId !== user.id) {
            await createNotification({
              userId: ticket.agentId,
              title: "💬 ผู้แจ้งตอบกลับใน Ticket ที่คุณดูแล",
              message: `${user.name} ได้แสดงความคิดเห็นใน Ticket "${ticket.title}"`,
              link: `/tickets/${ticket.id}`,
            });
          } else if (ticket.targetDepartmentId) {
            const targetDeptUsers = await userService.findUsersByDepartmentId(ticket.targetDepartmentId);
            for (const targetUser of targetDeptUsers) {
              if (targetUser.id !== user.id) {
                await createNotification({
                  userId: targetUser.id,
                  title: "💬 มีข้อความตอบกลับใน Ticket ใหม่",
                  message: `${user.name} ได้แสดงความคิดเห็นใน Ticket "${ticket.title}"`,
                  link: `/tickets/${ticket.id}`,
                });
              }
            }
          }
        } else {
          if (ticket.userId !== user.id) {
            await createNotification({
              userId: ticket.userId,
              title: "💬 มีข้อความตอบกลับใน Ticket ของคุณ",
              message: `${user.name} ได้ตอบกลับ Ticket "${ticket.title}" ของคุณ`,
              link: `/tickets/${ticket.id}`,
            });
          }
        }
      }
    } catch (notifErr) {
      console.error("Failed to create comment notifications:", notifErr);
    }

    // Webhook: only TICKET_CREATED is sent — no webhook for comments

    res.json({
      status: "success",
      message: "Comment added successfully",
      data: comment
    });
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

// Status transitions

exports.updateStatus = async (req, res) => {
  try {
    const user = req.user;
    const body = req.body;
    let status = body.status;
    const approvalAction = body.approvalAction;
    const approvalNote = body.approvalNote;
    const ticketId = req.params.id;

    if (approvalAction) {
      if (approvalAction === "APPROVE") {
        status = "APPROVED";
      } else if (approvalAction === "REJECT") {
        status = "REJECTED";
      }
    }

    if (status === "REJECTED" || approvalAction === "REJECT") {
      if (!approvalNote || !approvalNote.trim()) {
        return res.status(400).json({
          status: "error",
          message: "กรุณาระบุเหตุผลในการปฏิเสธคำขออนุมัติ"
        });
      }
    }

    if (!status) {
      return res.status(400).json({
        status: "error",
        message: "กรุณาระบุสถานะใหม่"
      });
    }

    const existingTicket = await ticketService.findTicketById(ticketId);

    if (!existingTicket) {
      return res.status(404).json({
        status: "error",
        message: "ไม่พบ Ticket นี้"
      });
    }

    if (existingTicket.status === "CANCELLED" || existingTicket.status === "REJECTED") {
      return res.status(403).json({
        status: "error",
        message: "Ticket ที่ถูกยกเลิกหรือถูกปฏิเสธแล้วไม่สามารถเปลี่ยนสถานะต่อได้"
      });
    }

    const isAgent =
      user.role === "ADMIN" ||
      (existingTicket.receiverManagerId
        ? (existingTicket.receiverManagerId === user.id || existingTicket.agentId === user.id)
        : (
            (user.departmentId && existingTicket.targetDepartmentId === user.departmentId) ||
            existingTicket.targetDepartmentId === null ||
            existingTicket.targetDepartment?.name === 'ส่วนกลาง' ||
            existingTicket.targetDepartment?.code === 'HQ' ||
            existingTicket.agentId === user.id
          ));

    if (status === "CANCELLED" && existingTicket.status === "PENDING_APPROVAL" && existingTicket.userId !== user.id && user.role !== "ADMIN") {
      return res.status(403).json({
        status: "error",
        message: "มีเพียงผู้แจ้งเรื่องหรือผู้ดูแลระบบเท่านั้นที่สามารถยกเลิก Ticket ในระหว่างรออนุมัติได้"
      });
    }

    if (status === "CANCELLED" && existingTicket.agentId && user.role !== "ADMIN") {
      return res.status(403).json({
        status: "error",
        message: "ไม่สามารถยกเลิก Ticket ที่มีเจ้าหน้าที่รับผิดชอบแล้วได้"
      });
    }

    const isTargetDeptMember = user.departmentId && existingTicket.targetDepartmentId === user.departmentId;
    if (existingTicket.agentId && existingTicket.agentId !== user.id && user.role !== "ADMIN" && user.role !== "MANAGER" && !isTargetDeptMember) {
      return res.status(403).json({
        status: "error",
        message: "Ticket นี้ถูกรับมอบหมายโดยเจ้าหน้าที่ท่านอื่นแล้ว มีเพียงผู้รับผิดชอบเคส, หัวหน้างาน หรือเจ้าหน้าที่ในแผนกเดียวกันเท่านั้นที่สามารถเปลี่ยนแปลงสถานะได้"
      });
    }

    const isAssigned = !!existingTicket.agentId;
    const isApprovalPermitted =
      user.role === "ADMIN" ||
      (user.role === "MANAGER" && user.departmentId && (
        !isAssigned
          ? user.departmentId === existingTicket.sourceDepartmentId
          : user.departmentId === existingTicket.targetDepartmentId
      ));

    if (approvalAction) {
      if (existingTicket.status !== "PENDING_APPROVAL") {
        return res.status(400).json({
          status: "error",
          message: "Ticket นี้ไม่อยู่ในขั้นตอนที่ต้องอนุมัติ"
        });
      }
      if (!isApprovalPermitted) {
        return res.status(403).json({
          status: "error",
          message: "คุณไม่มีสิทธิ์พิจารณาอนุมัติ Ticket นี้"
        });
      }
    } else {
      if (!isAgent) {
        if (existingTicket.userId !== user.id) {
          return res.status(403).json({
            status: "error",
            message: "คุณไม่มีสิทธิ์ในการจัดการ Ticket ของผู้อื่น"
          });
        }
        if (status !== "CANCELLED") {
          return res.status(403).json({
            status: "error",
            message: "ผู้แจ้งเรื่องสามารถยกเลิก Ticket ของตัวเองได้เท่านั้น"
          });
        }
      }
    }

    const activeStatuses = ["IN_PROGRESS", "PENDING_APPROVAL", "WAITING_PARTS", "RESOLVED"];
    const shouldAutoAssign =
      activeStatuses.includes(status) &&
      !existingTicket.agentId &&
      isAgent;

    const updatedTicket = await ticketService.updateTicket(ticketId, {
      status,
      ...(shouldAutoAssign ? { agentId: user.id } : {}),
      ...(status === "RESOLVED" || status === "CLOSED" ? { resolvedAt: new Date() } : {}),
    });

    let commentMessage = "";
    if (approvalAction) {
      const actionText = approvalAction === "APPROVE" ? "อนุมัติคำขอ" : "ปฏิเสธคำขอ";
      commentMessage = `🔄 ระบบ: ${actionText} โดยคุณ ${user.name} ${approvalNote ? `\n(บันทึก: ${approvalNote})` : ""}`;
    } else {
      if (status === "CANCELLED" && existingTicket.userId !== user.id) {
        // Cancelled by agent/colleague on behalf of assignee
        commentMessage = `🔄 ระบบ: Ticket ได้ถูกยกเลิกแทนผู้รับผิดชอบหลัก โดยคุณ ${user.name} ${approvalNote ? `\n(เหตุผล: ${approvalNote})` : ""}`;
      } else {
        commentMessage = shouldAutoAssign
          ? `🔄 ระบบ: สถานะ Ticket ได้ถูกปรับเป็น [${translateStatus(status)}] และมอบหมายให้ ${user.name} รับผิดชอบแล้ว`
          : `🔄 ระบบ: สถานะ Ticket ได้ถูกปรับเป็น [${translateStatus(status)}] โดยคุณ ${user.name}`;
      }
    }

    await ticketService.createComment({
      ticketId,
      userId: user.id,
      message: commentMessage,
    });

    try {
      let notifTitle = "🔄 Ticket ของคุณมีการอัปเดตสถานะ";
      let notifMsg = `Ticket "${updatedTicket.title}" ได้ถูกปรับสถานะเป็น [${translateStatus(status).split(" (")[0]}]`;

      if (approvalAction) {
        if (approvalAction === "APPROVE") {
          notifTitle = "✅ คำขอรับการอนุมัติสำเร็จแล้ว";
          notifMsg = `Ticket "${updatedTicket.title}" ได้รับการอนุมัติแล้ว โดย ${user.name}`;
        } else {
          notifTitle = "❌ คำขอรับการอนุมัติถูกปฏิเสธ";
          notifMsg = `Ticket "${updatedTicket.title}" ถูกปฏิเสธการอนุมัติ โดย ${user.name} ${approvalNote ? `(เหตุผล: ${approvalNote})` : ""}`;
        }
      } else if (status === "CANCELLED") {
        if (existingTicket.userId === user.id) {
          notifTitle = "🚫 Ticket ถูกยกเลิกโดยผู้แจ้งเรื่อง";
          notifMsg = `Ticket "${updatedTicket.title}" ถูกยกเลิกโดยผู้แจ้งเรื่อง (${user.name})`;
        } else {
          notifTitle = "🚫 Ticket ของคุณถูกยกเลิกโดยเจ้าหน้าที่";
          notifMsg = `Ticket "${updatedTicket.title}" ถูกยกเลิกโดยเจ้าหน้าที่ ${user.name} ${approvalNote ? `(เหตุผล: ${approvalNote})` : ""}`;
        }
      }

      await createNotification({
        userId: updatedTicket.userId,
        title: notifTitle,
        message: notifMsg,
        link: `/tickets/${updatedTicket.id}`,
      });

      if (updatedTicket.agentId && updatedTicket.agentId !== user.id) {
        await createNotification({
          userId: updatedTicket.agentId,
          title: notifTitle,
          message: notifMsg,
          link: `/tickets/${updatedTicket.id}`,
        });
      }

      if (status === "PENDING_APPROVAL" && updatedTicket.sourceDepartmentId) {
        const managers = await userService.findManagersByDepartmentId(updatedTicket.sourceDepartmentId);
        for (const mgr of managers) {
          if (mgr.id !== user.id) {
            await createNotification({
              userId: mgr.id,
              title: "⏳ มี Ticket รอการอนุมัติจากคุณ",
              message: `Ticket "${updatedTicket.title}" จากคุณ ${updatedTicket.user.name} กำลังรอการอนุมัติของคุณ`,
              link: `/tickets/${updatedTicket.id}`,
            });
          }
        }
      }
    } catch (notifErr) {
      console.error("Failed to create status notifications:", notifErr);
    }

    // Webhook: only TICKET_CREATED is sent — no webhook for status updates

    res.json({
      status: "success",
      message: "Ticket status updated successfully",
      data: updatedTicket
    });
  } catch (error) {
    console.error("Error updating ticket status:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

// Department transfers

exports.transferTicket = async (req, res) => {
  try {
    const user = req.user;
    const { toDepartmentId, note } = req.body;
    const ticketId = req.params.id;

    if (!toDepartmentId) {
      return res.status(400).json({
        status: "error",
        message: "กรุณาระบุแผนกปลายทาง"
      });
    }

    const ticket = await ticketService.findTicketById(ticketId);

    if (!ticket) {
      return res.status(404).json({
        status: "error",
        message: "ไม่พบ Ticket นี้"
      });
    }

    if (ticket.status === "CANCELLED" || ticket.status === "CLOSED" || ticket.status === "RESOLVED" || ticket.status === "PENDING_APPROVAL") {
      return res.status(400).json({
        status: "error",
        message: "ไม่สามารถส่งต่อ Ticket ที่ยกเลิก ปิดเคส แก้ไขเสร็จสิ้น หรืออยู่ในระหว่างรออนุมัติได้"
      });
    }

    const isAgent =
      user.role === "ADMIN" ||
      (ticket.receiverManagerId
        ? (ticket.receiverManagerId === user.id || ticket.agentId === user.id)
        : (
            (user.departmentId && ticket.targetDepartmentId === user.departmentId) ||
            ticket.targetDepartmentId === null ||
            ticket.targetDepartment?.name === 'ส่วนกลาง' ||
            ticket.targetDepartment?.code === 'HQ' ||
            ticket.agentId === user.id
          ));

    if (!isAgent) {
      return res.status(403).json({
        status: "error",
        message: "คุณไม่มีสิทธิ์ส่งต่อ Ticket ข้ามแผนกที่ไม่ได้อยู่ในการดูแลของคุณ"
      });
    }

    if (ticket.agentId && ticket.agentId !== user.id && user.role !== "ADMIN" && user.role !== "MANAGER") {
      return res.status(403).json({
        status: "error",
        message: "Ticket นี้ถูกรับมอบหมายโดยเจ้าหน้าที่ท่านอื่นแล้ว มีเพียงผู้รับผิดชอบเคสหรือหัวหน้างานเท่านั้นที่สามารถส่งต่อได้"
      });
    }

    const targetDept = await departmentService.findDepartmentById(toDepartmentId);

    if (!targetDept) {
      return res.status(404).json({
        status: "error",
        message: "ไม่พบแผนกปลายทางในระบบ"
      });
    }

    const transfer = await ticketService.createTransfer({
      ticketId: ticket.id,
      fromDepartmentId: ticket.targetDepartmentId,
      toDepartmentId: toDepartmentId,
      requestedById: user.id,
      status: "COMPLETED",
      note: note || null,
    });

    const updatedTicket = await ticketService.updateTicket(ticket.id, {
      targetDepartmentId: toDepartmentId,
      agentId: null,
      status: "FORWARDED",
    });

    const fromDeptName = ticket.targetDepartment?.name || "แผนกไอทีส่วนกลาง (ไม่มีระบุ)";
    const commentMessage = `ระบบ: ได้โอนย้ายความรับผิดชอบ Ticket นี้ จากแผนก [${fromDeptName}] ไปยังแผนก [${targetDept.name}] โดยคุณ [${user.name}] ${note ? `\n(เหตุผล: ${note})` : ""}`;

    await ticketService.createComment({
      ticketId: ticket.id,
      userId: user.id,
      message: commentMessage,
    });

    try {
      await createNotification({
        userId: updatedTicket.userId,
        title: "🔄 Ticket ของคุณถูกส่งต่อต่างแผนก",
        message: `Ticket "${updatedTicket.title}" ได้ถูกโอนย้ายไปยังแผนก [${targetDept.name}] เพื่อรับช่วงต่อดูแล`,
        link: `/tickets/${updatedTicket.id}`,
      });

      const targetDeptUsers = await userService.findUsersByDepartmentId(toDepartmentId);
      for (const targetUser of targetDeptUsers) {
        if (targetUser.id !== user.id) {
          await createNotification({
            userId: targetUser.id,
            title: "🔄 มี Ticket โอนย้ายมาใหม่ในแผนกคุณ",
            message: `Ticket "${updatedTicket.title}" ถูกส่งต่อมาจาก [${fromDeptName}]`,
            link: `/tickets/${updatedTicket.id}`,
          });
        }
      }
    } catch (notifErr) {
      console.error("Failed to create transfer notifications:", notifErr);
    }

    // Webhook: only TICKET_CREATED is sent — no webhook for transfers

    res.json({
      status: "success",
      message: "Ticket transferred successfully",
      data: { ticket: updatedTicket, transfer }
    });
  } catch (error) {
    console.error("Error transferring ticket:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

// Agent assignment

exports.assignTicket = async (req, res) => {
  try {
    const user = req.user;
    const { agentId } = req.body;
    const ticketId = req.params.id;

    const isUnassign = !agentId;
    let updatedTicket;

    const existingTicket = await ticketService.findTicketByIdWithRelations(ticketId);

    if (!existingTicket) {
      return res.status(404).json({
        status: "error",
        message: "ไม่พบ Ticket นี้"
      });
    }

    const hasAccess =
      user.role === "ADMIN" ||
      (existingTicket.receiverManagerId
        ? (existingTicket.receiverManagerId === user.id || existingTicket.agentId === user.id)
        : (
            (user.departmentId && existingTicket.targetDepartmentId === user.departmentId) ||
            existingTicket.targetDepartmentId === null ||
            existingTicket.targetDepartment?.name === 'ส่วนกลาง' ||
            existingTicket.targetDepartment?.code === 'HQ' ||
            existingTicket.agentId === user.id
          ));

    if (!hasAccess) {
      return res.status(403).json({
        status: "error",
        message: "คุณไม่มีสิทธิ์จัดการหรือรับมอบหมาย Ticket ข้ามแผนก"
      });
    }

    const isTargetDeptMember = user.departmentId && existingTicket.targetDepartmentId === user.departmentId;
    if (existingTicket.agentId && existingTicket.agentId !== user.id && user.role !== "ADMIN" && user.role !== "MANAGER" && !isTargetDeptMember) {
      return res.status(403).json({
        status: "error",
        message: "Ticket นี้ถูกรับมอบหมายโดยเจ้าหน้าที่ท่านอื่นแล้ว มีเพียงผู้รับผิดชอบเคส, หัวหน้างาน หรือเจ้าหน้าที่ในแผนกเดียวกันเท่านั้นที่สามารถแก้ไขการมอบหมายได้"
      });
    }

    if (!isUnassign && existingTicket.status === "CANCELLED") {
      return res.status(403).json({
        status: "error",
        message: "Ticket ที่ถูกยกเลิกโดยผู้ส่งไม่สามารถรับเคสได้"
      });
    }

    if (isUnassign) {
      updatedTicket = await ticketService.updateTicket(ticketId, {
        agentId: null,
        status: "NEW",
      });

      await ticketService.createComment({
        ticketId,
        userId: user.id,
        message: `ระบบ: เจ้าหน้าที่ ${user.name} ได้ยกเลิกการรับผิดชอบดูแล Ticket นี้แล้ว`,
      });

      await createNotification({
        userId: updatedTicket.userId,
        title: "🔄 Ticket ของคุณถูกยกเลิกการดูแล",
        message: `Ticket "${updatedTicket.title}" ถูกส่งกลับเข้าสู่คิวงาน เนื่องจากเจ้าหน้าที่ยกเลิกการรับเคส`,
        link: `/tickets/${updatedTicket.id}`,
      });
    } else {
      const isTakeover = existingTicket.agentId && existingTicket.agentId !== agentId;

      updatedTicket = await ticketService.updateTicket(ticketId, {
        agentId,
        status: "IN_PROGRESS",
      });

      const commentMessage = isTakeover
        ? `🔄 ระบบ: เจ้าหน้าที่ ${updatedTicket.agent?.name} ได้รับช่วงงานดูแล Ticket นี้ต่อแทน เจ้าหน้าที่ ${existingTicket.agent?.name || "ไม่ระบุ"}`
        : `ระบบ: เจ้าหน้าที่ ${updatedTicket.agent?.name} ได้กดรับผิดชอบดูแล Ticket นี้แล้ว และกำลังเริ่มดำเนินการแก้ไข`;

      await ticketService.createComment({
        ticketId,
        userId: user.id,
        message: commentMessage,
      });

      if (isTakeover) {
        await createNotification({
          userId: existingTicket.agentId,
          title: "🔄 Ticket ในความดูแลของคุณถูกรับช่วงต่อ",
          message: `Ticket "${updatedTicket.title}" ของคุณถูกรับช่วงต่อโดยเจ้าหน้าที่ ${updatedTicket.agent?.name}`,
          link: `/tickets/${updatedTicket.id}`,
        });

        await createNotification({
          userId: updatedTicket.userId,
          title: "🔄 เปลี่ยนตัวเจ้าหน้าที่รับดูแล Ticket ของคุณ",
          message: `เจ้าหน้าที่ ${updatedTicket.agent?.name} ได้รับช่วงดูแล Ticket "${updatedTicket.title}" ของคุณต่อแทน ${existingTicket.agent?.name || "ไม่ระบุ"}`,
          link: `/tickets/${updatedTicket.id}`,
        });
      } else {
        await createNotification({
          userId: updatedTicket.userId,
          title: "🔧 มีเจ้าหน้าที่รับดูแล Ticket ของคุณแล้ว",
          message: `เจ้าหน้าที่ ${updatedTicket.agent?.name} ได้กดรับรับผิดชอบดูแล Ticket "${updatedTicket.title}" ของคุณแล้ว`,
          link: `/tickets/${updatedTicket.id}`,
        });
      }
    }

    // Webhook: only TICKET_CREATED is sent — no webhook for assignment changes

    res.json({
      status: "success",
      message: isUnassign ? "Ticket unassigned successfully" : "Ticket assigned successfully",
      data: updatedTicket
    });
  } catch (error) {
    console.error("Error assigning ticket:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

exports.getTicketById = async (req, res) => {
  try {
    const user = req.user;
    const ticketId = req.params.id;

    const ticket = await ticketService.findTicketByIdWithDetails(ticketId);

    if (!ticket) {
      return res.status(404).json({
        status: "error",
        message: "ไม่พบ Ticket นี้"
      });
    }

    let hasAccess = false;
    if (ticket.receiverManagerId) {
      hasAccess =
        user.role === "ADMIN" ||
        ticket.userId === user.id ||
        ticket.receiverManagerId === user.id ||
        ticket.agentId === user.id;
    } else {
      hasAccess =
        user.role === "ADMIN" ||
        ticket.userId === user.id ||
        ticket.agentId === user.id ||
        (user.departmentId && ticket.sourceDepartmentId === user.departmentId) ||
        (user.departmentId && ticket.targetDepartmentId === user.departmentId) ||
        (ticket.targetDepartmentId === null && ticket.agentId === null && ticket.receiverManagerId === null) ||
        ((ticket.targetDepartment?.name === 'ส่วนกลาง' || ticket.targetDepartment?.code === 'HQ') && ticket.agentId === null);
    }

    if (!hasAccess) {
      return res.status(403).json({
        status: "error",
        message: "คุณไม่มีสิทธิ์เข้าถึง Ticket นี้"
      });
    }

    const comments = await ticketService.getCommentsByTicketId(ticketId);
    const sla = slaUtil.calcSLA(ticket, comments);
    const responseSla = slaUtil.calcResponseSLA(ticket, comments);
    const ticketWithSla = {
      ...ticket,
      sla,
      responseSla
    };

    res.json({
      status: "success",
      message: "Ticket retrieved successfully",
      data: ticketWithSla
    });
  } catch (error) {
    console.error("Error fetching ticket by ID:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

exports.editComment = async (req, res) => {
  try {
    const user = req.user;
    const { commentId } = req.params;
    const { message } = req.body;

    const trimmedMsg = (message || "").trim();
    if (!trimmedMsg) {
      return res.status(400).json({
        status: "error",
        message: "กรุณากรอกข้อความ"
      });
    }

    const comment = await prisma.comment.findUnique({
      where: { id: commentId }
    });

    if (!comment) {
      return res.status(404).json({
        status: "error",
        message: "ไม่พบข้อความนี้"
      });
    }

    if (comment.userId !== user.id) {
      return res.status(403).json({
        status: "error",
        message: "คุณไม่มีสิทธิ์แก้ไขข้อความนี้"
      });
    }

    const isSystem = comment.message.includes('ระบบ:') || comment.message.includes('🔄');
    if (isSystem) {
      return res.status(400).json({
        status: "error",
        message: "ไม่สามารถแก้ไขข้อความบันทึกของระบบได้"
      });
    }

    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: { message: trimmedMsg, isEdited: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
            avatarUrl: true,
          }
        }
      }
    });

    socketService.emitToTicket(updatedComment.ticketId, 'comment:updated', updatedComment);

    res.json({
      status: "success",
      message: "Comment updated successfully",
      data: updatedComment
    });
  } catch (error) {
    console.error("Error editing comment:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const user = req.user;
    const { commentId } = req.params;

    const comment = await prisma.comment.findUnique({
      where: { id: commentId }
    });

    if (!comment) {
      return res.status(404).json({
        status: "error",
        message: "ไม่พบข้อความนี้"
      });
    }

    if (comment.userId !== user.id) {
      return res.status(403).json({
        status: "error",
        message: "คุณไม่มีสิทธิ์ยกเลิกการส่งข้อความนี้"
      });
    }

    const isSystem = comment.message.includes('ระบบ:') || comment.message.includes('🔄');
    if (isSystem) {
      return res.status(400).json({
        status: "error",
        message: "ไม่สามารถลบข้อความบันทึกของระบบได้"
      });
    }

    await prisma.comment.update({
      where: { id: commentId },
      data: {
        message: "ยกเลิกการส่งข้อความแล้ว",
        attachmentUrl: null
      }
    });

    socketService.emitToTicket(comment.ticketId, 'comment:deleted', { ticketId: comment.ticketId, commentId });

    res.json({
      status: "success",
      message: "Comment deleted successfully",
      data: { commentId }
    });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};
