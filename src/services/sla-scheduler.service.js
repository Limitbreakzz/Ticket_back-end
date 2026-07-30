const prisma = require('../prisma');
const notificationService = require('./notification.service');

async function checkSLADeadlines() {
  try {
    const now = new Date();
    // 2 hours in milliseconds
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    const warningTimeThreshold = new Date(now.getTime() + TWO_HOURS_MS);

    // Find active tickets (not RESOLVED, CLOSED, or CANCELLED)
    // with a deadline in the future, and within the 2-hour window.
    const ticketsNearDeadline = await prisma.ticket.findMany({
      where: {
        status: {
          notIn: ['RESOLVED', 'CLOSED', 'CANCELLED']
        },
        slaDueDate: {
          gt: now,
          lte: warningTimeThreshold
        },
        agentId: {
          not: null
        }
      },
      include: {
        agent: true
      }
    });

    for (const ticket of ticketsNearDeadline) {
      if (!ticket.agentId) continue;

      const link = `/tickets/${ticket.id}`;
      const title = `⏳ เตือนภัย: Ticket ใกล้เกินกำหนดเวลา SLA`;
      
      // Check if we have already sent an SLA warning notification for this ticket to this agent
      const existingNotification = await prisma.notification.findFirst({
        where: {
          userId: ticket.agentId,
          link,
          title
        }
      });

      if (!existingNotification) {
        // Send notification to the agent
        await notificationService.createNotification({
          userId: ticket.agentId,
          title,
          message: `Ticket "${ticket.title}" ของคุณ เหลือเวลาดำเนินการตาม SLA อีกไม่เกิน 2 ชั่วโมง! (กำหนดส่ง: ${ticket.slaDueDate.toLocaleString('th-TH')})`,
          link
        });
        console.log(`[SLA Scheduler] Sent SLA reminder notification to agent ${ticket.agent.name} for ticket #${ticket.id}`);
      }
    }
  } catch (err) {
    console.error('[SLA Scheduler] Error checking SLA deadlines:', err);
  }
}

function startSLAScheduler() {
  console.log('[SLA Scheduler] Background service started.');
  // Run check every 5 minutes
  setInterval(checkSLADeadlines, 5 * 60 * 1000);
  // Run once initially after 10 seconds
  setTimeout(checkSLADeadlines, 10000);
}

module.exports = {
  startSLAScheduler
};
