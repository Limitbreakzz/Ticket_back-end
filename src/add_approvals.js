const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addApprovalTickets() {
  require('dotenv').config();
  console.log('🚀 Adding rich approval tickets...');
  
  const managers = await prisma.user.findMany({ where: { role: 'MANAGER' } });
  const regularUsers = await prisma.user.findMany({ where: { role: 'USER' } });
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const depts = await prisma.department.findMany();

  if (managers.length === 0 || regularUsers.length === 0) {
    console.log('No users found to link approval tickets.');
    return;
  }

  const approvalTemplates = [
    {
      title: 'ขออนุมัติจัดซื้อ RAM 32GB และ SSD 1TB สำหรับเครื่องตัดชิ้นงาน CNC',
      desc: 'เครื่องจักร CNC ฝ่าย Machining มีอาการค้างระหว่างประมวลผลไฟล์ 3D ขนาดใหญ่ จำเป็นต้องอัปเกรดหน่วยความจำด่วน วงเงินงบประมาณ 6,500 บาท',
      category: 'HARDWARE',
      priority: 'HIGH',
      sub: 'อุปกรณ์ฮาร์ดแวร์พิเศษ',
      status: 'PENDING_APPROVAL',
      receiverManagerId: managers[0].id,
      userId: regularUsers[0].id
    },
    {
      title: 'ขออนุมัติเปิดพอร์ต VPN สำหรับทำงานนอกสถานที่ช่วงวันหยุดยาว',
      desc: 'วิศวกรซ่อมบำรุงต้องการรีโมตเข้ามาตรวจสอบสถานะระบบเตือนภัยโรงงานในช่วงวันหยุดนักขัตฤกษ์',
      category: 'ACCESS',
      priority: 'MEDIUM',
      sub: 'สิทธิ์ระบบความปลอดภัย',
      status: 'PENDING_APPROVAL',
      receiverManagerId: managers[1].id,
      userId: regularUsers[1].id
    },
    {
      title: 'ขออนุมัติซ่อมบำรุงมอเตอร์สายพานลำเลียง Pack Line #2',
      desc: 'ตลับลูกปืนมอเตอร์มีเสียงดังและมีความร้อนสะสมสูงเกิน 75 องศาเซลเซียส ขอเปลี่ยนชุดลูกปืนด่วน',
      category: 'OTHER',
      priority: 'CRITICAL',
      sub: 'เครื่องจักรโรงงาน',
      status: 'PENDING_APPROVAL',
      receiverManagerId: managers[0].id,
      userId: regularUsers[2].id
    },
    {
      title: 'ขออนุมัติเพิ่ม License โปรแกรม SolidWorks สำหรับทีมออกแบบใหม่',
      desc: 'มีพนักงานใหม่เข้าปฏิบัติงานฝ่ายแม่พิมพ์ ต้องการ License แบบ Floating 1 ชุด',
      category: 'SOFTWARE',
      priority: 'MEDIUM',
      sub: 'ลิขสิทธิ์ซอฟต์แวร์',
      status: 'APPROVED',
      receiverManagerId: managers[0].id,
      userId: regularUsers[3].id
    },
    {
      title: 'ขออนุมัติเบิกสายไฟและท่อร้อยสายสำหรับจุดติดตั้งพัดลมระบายอากาศ',
      desc: 'ติดตั้งพัดลมไอน้ำเพิ่มเติมในโซนไลน์ประกอบเพื่อลดอุณหภูมิหน้างาน',
      category: 'OTHER',
      priority: 'LOW',
      sub: 'อุปกรณ์ไฟฟ้า',
      status: 'APPROVED',
      receiverManagerId: managers[2].id,
      userId: regularUsers[4].id
    },
    {
      title: 'ขออนุมัติจัดซื้อหน้าจอมอนิเตอร์สำรองขนาด 27 นิ้ว',
      desc: 'ขอจัดซื้อจอภาพสำรองเผื่อกรณีหน้าจอบอร์ดควบคุมชำรุด',
      category: 'HARDWARE',
      priority: 'LOW',
      sub: 'อุปกรณ์ต่อพ่วง',
      status: 'REJECTED',
      receiverManagerId: managers[0].id,
      userId: regularUsers[5].id
    }
  ];

  for (let i = 0; i < approvalTemplates.length; i++) {
    const item = approvalTemplates[i];
    const ticket = await prisma.ticket.create({
      data: {
        title: `[#TK-APP-${String(i+1).padStart(3, '0')}] ${item.title}`,
        description: item.desc,
        status: item.status,
        priority: item.priority,
        category: item.category,
        subcategory: item.sub,
        userId: item.userId,
        receiverManagerId: item.receiverManagerId,
        sourceDepartmentId: regularUsers[i % regularUsers.length].departmentId,
        targetDepartmentId: null,
        agentId: item.receiverManagerId,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    if (item.status === 'APPROVED') {
      await prisma.comment.create({
        data: {
          ticketId: ticket.id,
          userId: item.receiverManagerId,
          message: '🟢 ได้รับการอนุมัติเรียบร้อยแล้ว: ดำเนินการจัดซื้อและจัดสรรตามระเบียบบริษัทได้เลยครับ',
          createdAt: new Date()
        }
      });
    } else if (item.status === 'REJECTED') {
      await prisma.comment.create({
        data: {
          ticketId: ticket.id,
          userId: item.receiverManagerId,
          message: '❌ ปฏิเสธคำขอ: ยังมีอุปกรณ์สำรองอยู่ในคลังส่วนกลาง ให้ติดต่อเบิกจากฝ่ายคลังก่อนครับ',
          createdAt: new Date()
        }
      });
    }

    console.log(`- Created Approval Ticket: ${ticket.title} (${ticket.status})`);
  }

  console.log('✅ Approval tickets added successfully!');
}

addApprovalTickets()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
