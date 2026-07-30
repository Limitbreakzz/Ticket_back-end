/**
 * SLA Utility — Backend
 * ────────────────────
 */

const SLA_POLICY = {
  CRITICAL: { hours: 4,   label: '4 ชั่วโมง',    desc: 'วิกฤต! ต้องแก้ไขภายใน 4 ชม.' },
  HIGH:     { hours: 8,   label: '8 ชั่วโมง',    desc: 'เร่งด่วน! ต้องแก้ไขภายใน 8 ชม.' },
  MEDIUM:   { hours: 24,  label: '24 ชั่วโมง',   desc: 'ต้องแก้ไขภายใน 24 ชม.' },
  LOW:      { hours: 72,  label: '72 ชั่วโมง',   desc: 'ต้องแก้ไขภายใน 72 ชม.' },
};

const SLA_RESPONSE_POLICY = {
  CRITICAL: { hours: 0.25, label: '15 นาที',    desc: 'วิกฤต! ต้องรับเรื่องภายใน 15 นาที' },
  HIGH:     { hours: 0.5,  label: '30 นาที',    desc: 'เร่งด่วน! ต้องรับเรื่องภายใน 30 นาที' },
  MEDIUM:   { hours: 2,    label: '2 ชั่วโมง',   desc: 'ต้องรับเรื่องภายใน 2 ชั่วโมง' },
  LOW:      { hours: 4,    label: '4 ชั่วโมง',   desc: 'ต้องรับเรื่องภายใน 4 ชั่วโมง' },
};

const CLOSED_STATUSES = new Set(['RESOLVED', 'CLOSED', 'REJECTED']);

function getAcceptedDate(ticket, comments = []) {
  const claimComment = comments.find(c => 
    c.message && (
      c.message.includes('ได้กดรับผิดชอบดูแล') || 
      c.message.includes('มอบหมายให้') || 
      c.message.includes('กำลังดำเนินการ')
    )
  );
  if (claimComment) {
    return new Date(claimComment.createdAt);
  }
  if (ticket.agentId) {
    return new Date(ticket.createdAt);
  }
  return null;
}

function calcSLA(ticket, comments = [], now = new Date()) {
  const createdDate = new Date(ticket.createdAt);
  let deadlineDate = ticket.slaDueDate ? new Date(ticket.slaDueDate) : null;
  const policy = SLA_POLICY[ticket.priority || 'MEDIUM'];
  if (!policy) return null;

  const acceptedDate = getAcceptedDate(ticket, comments);

  if (!acceptedDate || isNaN(acceptedDate.getTime())) {
    const fallbackDeadline = deadlineDate || (createdDate ? new Date(createdDate.getTime() + policy.hours * 3600 * 1000) : null);
    return {
      policy,
      elapsedH: 0,
      remainingH: policy.hours,
      pct: 0,
      slaStatus: 'not-started',
      deadlineDate: fallbackDeadline,
      isClosed: false,
    };
  }

  const isClosed = CLOSED_STATUSES.has(ticket.status);
  const referenceDate = isClosed ? new Date(ticket.updatedAt) : now;

  if (!deadlineDate || isNaN(deadlineDate.getTime())) {
    deadlineDate = new Date(acceptedDate.getTime() + policy.hours * 3600 * 1000);
  }

  const elapsedMs  = referenceDate - acceptedDate;
  const elapsedH   = elapsedMs / (1000 * 60 * 60);
  const remainingH = (deadlineDate - referenceDate) / (1000 * 60 * 60);
  const limitH = Math.max(0.1, (deadlineDate - acceptedDate) / (1000 * 60 * 60));
  const pct = Math.min(100, Math.max(0, (elapsedH / limitH) * 100));

  let slaStatus;
  if (isClosed) {
    slaStatus = referenceDate <= deadlineDate ? 'met' : 'missed';
  } else {
    if (remainingH <= 0)                        slaStatus = 'breached';
    else if (pct >= 75)                         slaStatus = 'at-risk';
    else                                        slaStatus = 'on-track';
  }

  return {
    policy,
    elapsedH,
    remainingH,
    pct,
    slaStatus,
    deadlineDate,
    isClosed,
  };
}

function calcResponseSLA(ticket, comments = [], now = new Date()) {
  const policy = SLA_RESPONSE_POLICY[ticket.priority] || SLA_RESPONSE_POLICY.MEDIUM;
  const createdDate = new Date(ticket.createdAt);
  if (!createdDate || isNaN(createdDate.getTime())) return null;

  const isAcknowledged = (ticket.agentId) || !['PENDING', 'NEW'].includes(ticket.status);
  const ackDate = isAcknowledged ? new Date(ticket.updatedAt) : now;

  const elapsedMs = ackDate - createdDate;
  const elapsedH = elapsedMs / (1000 * 60 * 60);

  const deadlineH = policy.hours;
  const remainingH = deadlineH - elapsedH;
  const pct = Math.min((elapsedH / deadlineH) * 100, 100);

  let slaStatus;
  if (isAcknowledged) {
    slaStatus = elapsedH <= deadlineH ? 'met' : 'missed';
  } else {
    if (remainingH <= 0)                        slaStatus = 'breached';
    else if (pct >= 75)                         slaStatus = 'at-risk';
    else                                        slaStatus = 'on-track';
  }

  const deadlineDate = new Date(createdDate.getTime() + deadlineH * 3600 * 1000);

  return {
    policy,
    elapsedH,
    remainingH,
    pct,
    slaStatus,
    deadlineDate,
    isClosed: isAcknowledged,
  };
}

module.exports = {
  calcSLA,
  calcResponseSLA,
  getAcceptedDate
};
