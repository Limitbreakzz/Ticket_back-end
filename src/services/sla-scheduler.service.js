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
          notIn: ['RESOLVED', 'CLOSED', 'CANCELLED', 'REJECTED']
        },
        sla_due_date: {
          gt: now,
          lte: warningTimeThreshold
        },
        agent_id: {
          not: null
        }
      },
      include: {
        agent: true
      }
    });

    for (const ticket of ticketsNearDeadline) {
      if (!ticket.agent_id) continue;

      const link = `/tickets/${ticket.ticket_id}`;
      const title = `⏳ เตือนภัย: Ticket ใกล้เกินกำหนดเวลา SLA`;
      
      // Check if we have already sent an SLA warning notification for this ticket to this agent
      const existingNotification = await prisma.notification.findFirst({
        where: {
          user_id: ticket.agent_id,
          link,
          title
        }
      });

      if (!existingNotification) {
        // Send notification to the agent
        await notificationService.createNotification({
          userId: ticket.agent_id,
          title,
          message: `Ticket "${ticket.title}" ของคุณ เหลือเวลาดำเนินการตาม SLA อีกไม่เกิน 2 ชั่วโมง! (กำหนดส่ง: ${ticket.sla_due_date ? ticket.sla_due_date.toLocaleString('th-TH') : '-'})`,
          link
        });
        console.log(`[SLA Scheduler] Sent SLA reminder notification to agent ${ticket.agent ? ticket.agent.name : ''} for ticket #${ticket.ticket_id}`);
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
