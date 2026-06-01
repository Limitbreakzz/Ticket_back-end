const ticketService = require('../services/ticket.service');
const departmentService = require('../services/department.service');
const userService = require('../services/user.service');
const notificationService = require('../services/notification.service');
const webhookService = require('../services/webhook.service');
const { dispatchWebhook } = require('../utils/webhooks');

// Helper to calculate SLA
function calculateSLADueDate(priority, category, subcategory) {
  const now = new Date();
  
  if (priority === "CRITICAL") {
    now.setHours(now.getHours() + 2);
    return now;
  }

  let hours = 24; // Default: 24 hours

  if (category === "NETWORK") {
    hours = priority === "HIGH" ? 4 : 8;
  } else if (category === "ACCESS") {
    if (subcategory === "password_reset") {
      hours = priority === "HIGH" ? 2 : 4;
    } else {
      hours = priority === "HIGH" ? 8 : 24;
    }
  } else if (category === "HARDWARE") {
    hours = priority === "HIGH" ? 8 : 24;
  } else if (category === "SOFTWARE") {
    hours = priority === "HIGH" ? 12 : 24;
  } else if (category === "OTHER") {
    if (priority === "HIGH") {
      hours = 24;
    } else if (priority === "MEDIUM") {
      hours = 72;
    } else {
      hours = 120;
    }
  } else {
    if (priority === "HIGH") hours = 12;
    else if (priority === "MEDIUM") hours = 24;
    else hours = 72;
  }

  now.setHours(now.getHours() + hours);
  return now;
}

// Helper to create notifications using the notification service
async function createNotification({ userId, title, message, link }) {
  try {
    return await notificationService.createNotification({ userId, title, message, link });
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
}

// Translate status to Thai helper
const translateStatus = (s) => {
  switch (s) {
    case "NEW": return "🆕 รอดำเนินการ";
    case "APPROVED": return "🟢 อนุมัติแล้ว";
    case "IN_PROGRESS": return "🟡 กำลังดำเนินการ";
    case "RESOLVED": return "🟢 ดำเนินการเสร็จสิ้น";
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

// ==========================================
// 1. TICKET LIST & CREATION
// ==========================================

exports.getAllTickets = async (req, res) => {
  try {
    const user = req.user;
    let tickets = [];

    if (user.role === "ADMIN") {
      tickets = await ticketService.findAllTickets();
    } else {
      const departmentOrConditions = user.departmentId
        ? [
            { sourceDepartmentId: user.departmentId },
            { targetDepartmentId: user.departmentId },
          ]
        : [];

      const ticketsWhereClause = {
        OR: [
          { userId: user.id },
          { agentId: user.id },
          ...departmentOrConditions,
          {
            targetDepartmentId: null,
            agentId: null,
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
        ],
      };

      tickets = await ticketService.findManyTickets(ticketsWhereClause);
    }

    res.json({
      status: "success",
      message: "Tickets retrieved successfully",
      data: tickets
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
      targetDepartmentId 
    } = req.body;

    if (!title || !description || !category) {
      return res.status(400).json({
        status: "error",
        message: "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน"
      });
    }

    const resolvedSourceDeptId = sourceDepartmentId || user.departmentId;
    if (resolvedSourceDeptId && targetDepartmentId && resolvedSourceDeptId === targetDepartmentId) {
      return res.status(400).json({
        status: "error",
        message: "ไม่สามารถส่ง Ticket แจ้งเรื่องไปยังแผนกเดียวกันกับแผนกผู้แจ้งได้"
      });
    }

    const computedSlaDueDate = calculateSLADueDate(priority || "MEDIUM", category, subcategory);

    const ticket = await ticketService.createTicket({
      title,
      description,
      category,
      subcategory: subcategory || null,
      priority: priority || "MEDIUM",
      slaDueDate: computedSlaDueDate,
      attachmentUrl: attachmentUrl || null,
      userId: user.id,
      status: (category === "ACCESS" || category === "HARDWARE") ? "PENDING_APPROVAL" : "NEW",
      sourceDepartmentId: sourceDepartmentId || user.departmentId || null,
      targetDepartmentId: targetDepartmentId || null,
    });

    const categoryThai = ({
      HARDWARE: "ฮาร์ดแวร์ / อุปกรณ์",
      SOFTWARE: "ซอฟต์แวร์ / โปรแกรม",
      NETWORK: "อินเทอร์เน็ต / Wi-Fi",
      ACCESS: "สิทธิ์เข้าใช้งาน",
      OTHER: "ทั่วไป / บริการอื่นๆ",
    })[category] || category;

    const subcategoryThaiMap = {
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

    const subLabel = subcategory ? subcategoryThaiMap[subcategory] || subcategory : null;
    const catDisplay = subLabel ? `${categoryThai} > ${subLabel}` : categoryThai;

    const priorityThai = ({
      LOW: "ต่ำ",
      MEDIUM: "ปานกลาง",
      HIGH: "สูง",
      CRITICAL: "วิกฤต",
    })[priority || "MEDIUM"] || (priority || "ปานกลาง");

    // 2. สร้าง System Log Comment
    await ticketService.createComment({
      ticketId: ticket.id,
      userId: user.id,
      message: `📋 ระบบ: Ticket ถูกจัดตั้งเข้าระบบสำเร็จแล้วในหมวดหมู่ [${catDisplay}] ความเร่งด่วน [${priorityThai}] สถานะตอนนี้คือ [รอดำเนินการ]`,
      isInternal: false,
    });

    // 3. สร้าง Notification
    try {
      const recipientIds = [];
      if (ticket.targetDepartmentId) {
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

    // 4. ทริกเกอร์ Webhook
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
        await dispatchWebhook(config.url, {
          event: "TICKET_CREATED",
          title: "📋 มี Ticket แจ้งเรื่อง/คำขอใหม่เข้ามาในระบบ!",
          description: descriptionPreview,
          text: `มี Ticket แจ้งเรื่อง/คำขอใหม่เข้ามาในระบบ! หัวข้อ: ${ticket.title} ผู้ส่ง: ${ticket.user.name} (แผนก: ${ticket.sourceDepartment?.name || "ไม่ระบุ"}) ส่งถึง: ${ticket.targetDepartment?.name || "ศูนย์บริการส่วนกลาง"} หมวดหมู่: ${getCategoryLabel(ticket.category)} ระดับความสำคัญ: ${getPriorityLabel(ticket.priority)}`,
          fields: [
            { name: "หัวข้อ", value: ticket.title, inline: false },
            { name: "ผู้ส่ง", value: `👤 ${ticket.user.name}`, inline: true },
            { name: "แผนกผู้แจ้ง", value: `🏢 ${ticket.sourceDepartment?.name || "ไม่ระบุ"}`, inline: true },
            { name: "ส่งถึงแผนกปลายทาง", value: `⚙️ ${ticket.targetDepartment?.name || "ศูนย์บริการส่วนกลาง"}`, inline: false },
            { name: "หมวดหมู่", value: getCategoryLabel(ticket.category), inline: true },
            { name: "ระดับความสำคัญ", value: getPriorityLabel(ticket.priority), inline: true },
            { name: "ลิงก์ Ticket", value: `🔗 [คลิกเพื่อดูรายละเอียด Ticket](${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/tickets/${ticket.id})`, inline: false },
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

// ==========================================
// 2. COUNTS
// ==========================================

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

// ==========================================
// 3. TICKET DETAIL & COMMENTS
// ==========================================

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

    const hasAccess =
      user.role === "ADMIN" ||
      ticket.userId === user.id ||
      ticket.agentId === user.id ||
      (user.departmentId && ticket.sourceDepartmentId === user.departmentId) ||
      (user.departmentId && ticket.targetDepartmentId === user.departmentId) ||
      (ticket.targetDepartmentId === null && ticket.agentId === null) ||
      ((ticket.targetDepartment?.name === 'ส่วนกลาง' || ticket.targetDepartment?.code === 'HQ') && ticket.agentId === null);

    if (!hasAccess) {
      return res.status(403).json({
        status: "error",
        message: "คุณไม่มีสิทธิ์เข้าถึง Ticket นี้"
      });
    }

    const comments = await ticketService.getCommentsByTicketId(ticketId);

    res.json({
      status: "success",
      message: "Ticket details and comments retrieved successfully",
      data: { ticket, comments }
    });
  } catch (error) {
    console.error("Error fetching ticket details:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

exports.addComment = async (req, res) => {
  try {
    const user = req.user;
    const { message, isInternal, attachmentUrl } = req.body;
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

    if (ticket.status === "CANCELLED" || ticket.status === "CLOSED") {
      return res.status(400).json({
        status: "error",
        message: "ไม่สามารถส่งข้อความเพิ่มเติมใน Ticket ที่ยกเลิกหรือปิดเคสแล้ว"
      });
    }

    const isAgent =
      user.role === "ADMIN" ||
      (user.departmentId && ticket.targetDepartmentId === user.departmentId) ||
      ticket.agentId === user.id;

    const isInternalMessage = isInternal && isAgent;

    const comment = await ticketService.createComment({
      ticketId,
      userId: user.id,
      message: finalMessage,
      isInternal: isInternalMessage,
      attachmentUrl: attachmentUrl || null,
    });

    // Notify
    try {
      if (!isInternalMessage && ticket) {
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

    // Webhooks for public comments
    if (!isInternalMessage && ticket) {
      try {
        const activeWebhooks = await webhookService.getActiveWebhooks();

        const getRoleLabel = (role) => {
          switch (role) {
            case "USER": return "ผู้ใช้งานทั่วไป";
            case "ADMIN": return "แอดมิน (Admin)";
            case "EMPLOYEE": return "ผู้ใช้งานทั่วไป";
            case "TECHNICIAN": return "ผู้ใช้งานทั่วไป";
            default: return role;
          }
        };

        const commentPreview = message.length > 200 
          ? message.substring(0, 200) + "..." 
          : message;

        for (const config of activeWebhooks) {
          await dispatchWebhook(config.url, {
            event: "TICKET_COMMENT_ADDED",
            title: "💬 มีข้อความตอบกลับใหม่ in Ticket",
            description: commentPreview,
            text: `มีข้อความตอบกลับใหม่ใน Ticket หัวข้อ: ${ticket.title} ผู้ตอบ: ${user.name}`,
            fields: [
              { name: "หัวข้อ", value: ticket.title, inline: false },
              { name: "ผู้ตอบ", value: `${user.name} (${getRoleLabel(user.role)})`, inline: true },
              { name: "แผนกผู้แจ้ง", value: `🏢 ${ticket.sourceDepartment?.name || "ไม่ระบุ"}`, inline: true },
              { name: "แผนกไอทีรับผิดชอบ", value: `⚙️ ${ticket.targetDepartment?.name || "ไอทีส่วนกลาง"}`, inline: false },
              { name: "ลิงก์ Ticket", value: `🔗 [คลิกเพื่อดูรายละเอียด Ticket](${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/tickets/${ticket.id})`, inline: false },
            ],
          });
        }
      } catch (webhookErr) {
        console.error("Failed to post comment webhooks:", webhookErr);
      }
    }

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

// ==========================================
// 4. STATUS UPDATES
// ==========================================

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

    if (existingTicket.status === "CANCELLED") {
      return res.status(403).json({
        status: "error",
        message: "Ticket ที่ถูกยกเลิกแล้วไม่สามารถเปลี่ยนสถานะต่อได้"
      });
    }

    const isAgent =
      user.role === "ADMIN" ||
      (user.departmentId && existingTicket.targetDepartmentId === user.departmentId) ||
      existingTicket.targetDepartmentId === null ||
      existingTicket.targetDepartment?.name === 'ส่วนกลาง' ||
      existingTicket.targetDepartment?.code === 'HQ' ||
      existingTicket.agentId === user.id;

    const isApprovalPermitted =
      user.role === "ADMIN" ||
      (user.role === "MANAGER" && user.departmentId && (
        user.departmentId === existingTicket.sourceDepartmentId ||
        user.departmentId === existingTicket.targetDepartmentId
      ));

    if (approvalAction) {
      if (existingTicket.status !== "PENDING_APPROVAL" && existingTicket.status !== "NEW") {
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
    });

    let commentMessage = "";
    if (approvalAction) {
      const actionText = approvalAction === "APPROVE" ? "อนุมัติคำขอ" : "ปฏิเสธคำขอ";
      commentMessage = `🔄 ระบบ: ${actionText} โดยคุณ ${user.name} ${approvalNote ? `\n(บันทึก: ${approvalNote})` : ""}`;
    } else {
      commentMessage = shouldAutoAssign
        ? `🔄 ระบบ: สถานะ Ticket ได้ถูกปรับเป็น [${translateStatus(status)}] และมอบหมายให้ ${user.name} รับผิดชอบแล้ว`
        : `🔄 ระบบ: สถานะ Ticket ได้ถูกปรับเป็น [${translateStatus(status)}] โดยคุณ ${user.name}`;
    }

    await ticketService.createComment({
      ticketId,
      userId: user.id,
      message: commentMessage,
      isInternal: false,
    });

    // Notify
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

    // Webhooks
    try {
      const activeWebhooks = await webhookService.getActiveWebhooks();

      for (const config of activeWebhooks) {
        await dispatchWebhook(config.url, {
          event: "TICKET_STATUS_UPDATED",
          title: "🔄 สถานะ Ticket ถูกอัปเดต",
          description: `Ticket มีการเปลี่ยนสถานะเป็น ${translateStatus(status)} แล้ว`,
          text: `Ticket มีการเปลี่ยนสถานะเป็น ${translateStatus(status)} หัวข้อ: ${updatedTicket.title} ผู้จัดการ: ${user.name}`,
          fields: [
            { name: "หัวข้อ", value: updatedTicket.title, inline: false },
            { name: "สถานะใหม่", value: translateStatus(status), inline: true },
            { name: "ผู้จัดการ", value: `👤 ${user.name}`, inline: true },
            { name: "แผนกผู้แจ้ง", value: `🏢 ${updatedTicket.sourceDepartment?.name || "ไม่ระบุ"}`, inline: false },
            { name: "แผนกผู้รับผิดชอบ", value: `⚙️ ${updatedTicket.targetDepartment?.name || "ศูนย์บริการส่วนกลาง"}`, inline: false },
            { name: "ลิงก์ Ticket", value: `🔗 [คลิกเพื่อดูรายละเอียด Ticket](${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/tickets/${updatedTicket.id})`, inline: false },
          ],
          imageUrl: updatedTicket.attachmentUrl || undefined,
        });
      }
    } catch (webhookErr) {
      console.error("Failed to post status webhooks:", webhookErr);
    }

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

// ==========================================
// 5. DEPT TRANSFERS
// ==========================================

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

    if (ticket.status === "CANCELLED" || ticket.status === "CLOSED" || ticket.status === "RESOLVED") {
      return res.status(400).json({
        status: "error",
        message: "ไม่สามารถส่งต่อ Ticket ที่ยกเลิก แก้ไขเสร็จสิ้น หรือปิดเคสแล้วได้"
      });
    }

    const isAgent =
      user.role === "ADMIN" ||
      (user.departmentId && ticket.targetDepartmentId === user.departmentId) ||
      ticket.targetDepartmentId === null ||
      ticket.targetDepartment?.name === 'ส่วนกลาง' ||
      ticket.targetDepartment?.code === 'HQ' ||
      ticket.agentId === user.id;

    if (!isAgent) {
      return res.status(403).json({
        status: "error",
        message: "คุณไม่มีสิทธิ์ส่งต่อ Ticket ข้ามแผนกที่ไม่ได้อยู่ในการดูแลของคุณ"
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
      isInternal: false,
    });

    // Notify
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

    // Webhooks
    try {
      const activeWebhooks = await webhookService.getActiveWebhooks();

      for (const config of activeWebhooks) {
        await dispatchWebhook(config.url, {
          event: "TICKET_TRANSFERRED",
          title: "🔄 มีการส่งต่อ Ticket ปัญหาไปยังแผนกใหม่",
          description: note || "ไม่มีเหตุผลระบุ",
          text: `มีการส่งต่อ Ticket ปัญหา #${updatedTicket.id} ไปยังแผนก ${updatedTicket.targetDepartment?.name || "ไอทีส่วนกลาง"} โดย ${user.name} เหตุผล: ${note || "-"}`,
          fields: [
            { name: "หัวข้อ Ticket", value: updatedTicket.title, inline: false },
            { name: "โอนย้ายจาก", value: fromDeptName, inline: true },
            { name: "โอนย้ายไปยัง", value: updatedTicket.targetDepartment?.name || "ไอทีส่วนกลาง", inline: true },
            { name: "ผู้ดำเนินการ", value: `👤 ${user.name}`, inline: false },
            { name: "ลิงก์ Ticket", value: `🔗 [คลิกเพื่อดูรายละเอียด Ticket](${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/tickets/${updatedTicket.id})`, inline: false },
          ],
        });
      }
    } catch (webhookErr) {
      console.error("Failed to process transfer webhooks:", webhookErr);
    }

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

// ==========================================
// 6. AGENT ASSIGN / UNASSIGN
// ==========================================

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
      (user.departmentId && existingTicket.targetDepartmentId === user.departmentId) ||
      existingTicket.targetDepartmentId === null ||
      existingTicket.targetDepartment?.name === 'ส่วนกลาง' ||
      existingTicket.targetDepartment?.code === 'HQ' ||
      existingTicket.agentId === user.id;

    if (!hasAccess) {
      return res.status(403).json({
        status: "error",
        message: "คุณไม่มีสิทธิ์จัดการหรือรับมอบหมาย Ticket ข้ามแผนก"
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
        isInternal: false,
      });

      await createNotification({
        userId: updatedTicket.userId,
        title: "🔄 Ticket ของคุณถูกยกเลิกการดูแล",
        message: `Ticket "${updatedTicket.title}" ถูกส่งกลับเข้าสู่คิวงาน เนื่องจากเจ้าหน้าที่ยกเลิกการรับเคส`,
        link: `/tickets/${updatedTicket.id}`,
      });
    } else {
      updatedTicket = await ticketService.updateTicket(ticketId, {
        agentId,
        status: "IN_PROGRESS",
      });

      await ticketService.createComment({
        ticketId,
        userId: agentId,
        message: `ระบบ: เจ้าหน้าที่ ${updatedTicket.agent?.name} ได้กดรับผิดชอบดูแล Ticket นี้แล้ว และกำลังเริ่มดำเนินการแก้ไข`,
        isInternal: false,
      });

      await createNotification({
        userId: updatedTicket.userId,
        title: "🔧 มีเจ้าหน้าที่รับดูแล Ticket ของคุณแล้ว",
        message: `เจ้าหน้าที่ ${updatedTicket.agent?.name} ได้กดรับรับผิดชอบดูแล Ticket "${updatedTicket.title}" ของคุณแล้ว`,
        link: `/tickets/${updatedTicket.id}`,
      });
    }

    // Webhooks
    try {
      const activeWebhooks = await webhookService.getActiveWebhooks();

      for (const config of activeWebhooks) {
        await dispatchWebhook(config.url, {
          event: isUnassign ? "TICKET_UNASSIGNED" : "TICKET_ASSIGNED",
          title: isUnassign ? "🔄 Ticket ถูกยกเลิกการรับเคส" : "🔧 Ticket ได้รับการรับเคสแล้ว",
          description: isUnassign ? "Ticket ได้รับการยกเลิกผู้รับผิดชอบโดยเจ้าหน้าที่" : "Ticket ได้รับการรับเคสโดยเจ้าหน้าที่เรียบร้อยแล้ว",
          text: isUnassign
            ? `Ticket ถูกยกเลิกการรับเคส หัวข้อ: ${updatedTicket.title} ผู้ส่ง: ${updatedTicket.user.name}`
            : `Ticket ถูกรับเคสแล้ว หัวข้อ: ${updatedTicket.title} ผู้ส่ง: ${updatedTicket.user.name} เจ้าหน้าที่ผู้ดูแล: ${updatedTicket.agent?.name}`,
          fields: [
            { name: "หัวข้อ", value: updatedTicket.title, inline: false },
            { name: "ผู้ส่ง", value: `👤 ${updatedTicket.user.name}`, inline: true },
            { name: "แผนกผู้แจ้ง", value: `🏢 ${updatedTicket.sourceDepartment?.name || "ไม่ระบุ"}`, inline: true },
            { name: "แผนกผู้รับผิดชอบ", value: `⚙️ ${updatedTicket.targetDepartment?.name || "ศูนย์บริการส่วนกลาง"}`, inline: false },
            { name: "เจ้าหน้าที่ผู้รับผิดชอบ", value: `🛠️ ${updatedTicket.agent?.name || "ยังไม่มีผู้รับผิดชอบ"}`, inline: true },
            { name: "สถานะ Ticket", value: translateStatus(updatedTicket.status), inline: true },
            { name: "ลิงก์ Ticket", value: `🔗 [คลิกเพื่อดูรายละเอียด Ticket](${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/tickets/${updatedTicket.id})`, inline: false },
          ],
          imageUrl: updatedTicket.attachmentUrl || undefined,
        });
      }
    } catch (webhookErr) {
      console.error("Failed to dispatch webhooks:", webhookErr);
    }

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
