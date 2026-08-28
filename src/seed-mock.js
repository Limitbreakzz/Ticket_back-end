const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('./utils/password');

const prisma = new PrismaClient();

const DEPARTMENTS_DATA = [
  { name: 'ฝ่ายผลิต 1', code: 'PROD1' },
  { name: 'ฝ่ายบรรจุภัณฑ์', code: 'PKG' },
  { name: 'ฝ่าย Machining', code: 'MACH' },
  { name: 'ฝ่าย Pressing', code: 'PRESS' },
  { name: 'ฝ่ายคลังสินค้า', code: 'WH' },
  { name: 'แผนก IT', code: 'IT' },
  { name: 'ฝ่ายบุคคล', code: 'HR' },
  { name: 'แผนกจัดซื้อ', code: 'PUR' },
  { name: 'ฝ่ายอาคารสถานที่', code: 'FAC' },
  { name: 'ฝ่ายซ่อมบำรุง', code: 'MAINT' },
  { name: 'ส่วนกลาง', code: 'HQ' },
];

const THAI_FIRSTNAMES = [
  'สมชาย', 'วิภา', 'ธนา', 'กิตติ', 'ประเสริฐ', 'นภา', 'สิริพร', 'อนุชา', 'พงษ์ศักดิ์', 'สุรชัย',
  'อรทัย', 'ธีรพล', 'กานดา', 'วรวิทย์', 'รัตนา', 'ปิยะ', 'ศิริรัตน์', 'ชัยวัฒน์', 'ณัฐพล', 'ชัชวาล',
  'พรทิพย์', 'อานนท์', 'ดวงใจ', 'สุชาติ', 'นฤมล', 'จิราภรณ์', 'กฤษณะ', 'ทวีศักดิ์', 'พัชรี', 'มานพ',
  'อัมพร', 'ไพโรจน์', 'นงลักษณ์', 'วิชัย', 'สุภัทรา', 'ศิริชัย', 'เกรียงไกร', 'บุญส่ง', 'จินตนา', 'วีระ',
  'ลัดดา', 'ชาตรี', 'มณีรัตน์', 'สุเทพ', 'วาสนา', 'ศุภชัย', 'ประภาส', 'ชลธิชา', 'อดิศร', 'สุดารัตน์',
  'เอกชัย', 'ปิยมาศ', 'สุรศักดิ์', 'จริยา', 'ธนากร', 'ศศิธร', 'ภูวนาท', 'เบญจมาศ', 'ทินกร', 'มณฑา'
];

const THAI_LASTNAMES = [
  'ใจดี', 'รักดี', 'สมบูรณ์', 'วัฒนพาณิชย์', 'ตั้งมั่น', 'เจริญสุข', 'ศรีสุข', 'คงคา', 'ทองดี', 'ประสิทธิ์',
  'สุขสวัสดิ์', 'ศิริวงศ์', 'มีชัย', 'พิทักษ์', 'บุญมี', 'รุ่งเรือง', 'กิจเจริญ', 'วงศ์สุวรรณ', 'รัตนโกสินทร์', 'พงษ์พานิช',
  'พูลสวัสดิ์', 'มิ่งขวัญ', 'แสงสุวรรณ', 'มณีโชติ', 'มงคล', 'สิทธิโชค', 'เลิศวิไล', 'บวรศิลป์', 'ชูจิตต์', 'แซ่ลิ้ม',
  'แซ่ตั้ง', 'โพธิ์ทอง', 'เกิดผล', 'มั่นคง', 'ยืนยง', 'แซ่โค้ว', 'ทรัพย์อนันต์', 'ศรีวิไล', 'พูนทรัพย์', 'นิลกุล',
  'ดวงมณี', 'สุขเกษม', 'บริสุทธิ์', 'อินทร์จันทร์', 'สุขุม', 'ยอดแก้ว', 'สว่างศรี', 'กลิ่นสุคนธ์', 'ศรีเจริญ', 'บัวทอง'
];

const TICKET_TEMPLATES = [
  {
    category: 'HARDWARE',
    priority: 'HIGH',
    title: 'คอมพิวเตอร์หน้าไลน์ผลิตบูตไม่ขึ้น หน้าจอดำ',
    desc: 'เครื่องคอมพิวเตอร์ควบคุมเครื่องจักรกะเช้าเปิดไม่ติด มีไฟสถานะกระพริบสีส้ม ต้องการให้ทีม IT เข้ามาตรวจสอบด่วนเนื่องจากกระทบยอดการผลิต',
    sub: 'คอมพิวเตอร์ / PC'
  },
  {
    category: 'HARDWARE',
    priority: 'MEDIUM',
    title: 'เครื่องพิมพ์สติ๊กเกอร์บาร์โค้ดดึงกระดาษติดขัดบ่อย',
    desc: 'เครื่องพิมพ์ Barcode ฝ่ายคลังสินค้าเกิดปัญหากระดาษติดและหัวพิมพ์มีรอยเส้นคาด ทำให้สแกนไม่ติด',
    sub: 'เครื่องพิมพ์ / Printer'
  },
  {
    category: 'SOFTWARE',
    priority: 'CRITICAL',
    title: 'ระบบ ERP เข้าไม่ได้ แจ้งเตือน Error Database Connection',
    desc: 'ผู้ใช้งานฝ่ายจัดซื้อและคลังสินค้าไม่สามารถบันทึกรายการรับ-จ่ายสินค้าได้ ระบบค้างที่หน้าล็อกอิน',
    sub: 'ระบบ ERP / ระบบองค์กร'
  },
  {
    category: 'SOFTWARE',
    priority: 'LOW',
    title: 'ขอติดตั้งโปรแกรม Adobe Acrobat Reader และฟอนต์ภาษาไทย',
    desc: 'เครื่องคอมพิวเตอร์พนักงานใหม่ฝ่ายบุคคลยังไม่มีโปรแกรมเปิดอ่านไฟล์ PDF และฟอนต์มาตรฐานบริษัท',
    sub: 'การติดตั้งโปรแกรม'
  },
  {
    category: 'NETWORK',
    priority: 'HIGH',
    title: 'สัญญาณ Wi-Fi โซนคลังสินค้าชั้น 2 หลุดบ่อย',
    desc: 'อุปกรณ์ Handheld สแกนเนอร์หลุดจากเครือข่ายบ่อยครั้ง ทำให้การหยิบสินค้าล่าช้า',
    sub: 'Wi-Fi / เครือข่ายไร้สาย'
  },
  {
    category: 'NETWORK',
    priority: 'MEDIUM',
    title: 'สาย LAN ที่โต๊ะทำงานหัวล็อกหัก ไม่สามารถต่อเน็ตได้',
    desc: 'ขยับโต๊ะแล้วสายแลนหลุด หัว RJ45 ตัวล็อกหัก ขอความอนุเคราะห์ช่างเข้าเปลี่ยนหัวต่อใหม่',
    sub: 'ระบบสาย LAN'
  },
  {
    category: 'ACCESS',
    priority: 'HIGH',
    title: 'ขอสิทธิ์เข้าถึง Shared Drive โฟลเดอร์งานฝ่ายซ่อมบำรุง',
    desc: 'พนักงานย้ายสังกัดต้องการเปิดดูประวัติเครื่องจักรและคู่มือ PM ขอสิทธิ์ Read/Write',
    sub: 'สิทธิ์การเข้าถึงข้อมูล'
  },
  {
    category: 'ACCESS',
    priority: 'MEDIUM',
    title: 'รีเซ็ตรหัสผ่านอีเมลบริษัท เนื่องจากจำรหัสผ่านเดิมไม่ได้',
    desc: 'พนักงานพิมพ์รหัสผิดเกิน 5 ครั้ง ทำให้ระบบล็อกบัญชีชั่วคราว ขอปลดล็อกและตั้งรหัสผ่านใหม่',
    sub: 'รีเซ็ตรหัสผ่าน'
  },
  {
    category: 'OTHER',
    priority: 'MEDIUM',
    title: 'แอร์ห้องควบคุมอุณหภูมิเซิร์ฟเวอร์มีน้ำหยด',
    desc: 'พบน้ำหยดจากคอยล์เย็นห้อง Server ชั้น 3 เกรงว่าจะหยดโดนตู้ Rack อุปกรณ์สื่อสาร',
    sub: 'อาคารและสถานที่'
  },
  {
    category: 'OTHER',
    priority: 'HIGH',
    title: 'เครื่องปั๊มชิ้นงาน Pressing #3 มีเสียงดังผิดปกติ',
    desc: 'ระหว่างเดินเครื่องรอบสูงพบเสียงกระแทกช่วงลูกสูบไฮดรอลิก ขอทีมซ่อมบำรุงเข้าประเมินสภาพทันที',
    sub: 'เครื่องจักรโรงงาน'
  },
  {
    category: 'HARDWARE',
    priority: 'LOW',
    title: 'ขอเบิกเมาส์และคีย์บอร์ดใหม่แทนของเดิมที่ปุ่มฝืด',
    desc: 'คีย์บอร์ดตัวเลขกดไม่ค่อยติดและลูกกลิ้งเมาส์เลื่อนไม่ไป',
    sub: 'อุปกรณ์ต่อพ่วง'
  },
  {
    category: 'OTHER',
    priority: 'LOW',
    title: 'หลอดไฟส่องสว่างทางเดินหน้าฝ่ายบุคคลกระพริบ',
    desc: 'หลอดไฟ LED ช่วงทางเดินหน้าฝ่ายบุคคลกระพริบต่อเนื่อง รบกวนสายตา ขอให้เปลี่ยนหลอดใหม่',
    sub: 'ระบบไฟฟ้า'
  }
];

const SAMPLE_IMAGES = [
  'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800',
  'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=800',
  'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800',
  'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
  'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=800',
  'https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?w=800'
];

const CHAT_RESPONSES = [
  'ได้รับข้อมูลเรียบร้อยแล้วครับ กำลังเตรียมอุปกรณ์เข้าไปตรวจสอบหน้างานครับ',
  'เบื้องต้นลอง Restart เครื่องหรือยังครับ หรือถอดปลั๊กทิ้งไว้ 30 วินาทีดูครับ',
  'ทีมงานกำลังเดินทางไปที่จุดเกิดเหตุ คาดว่าจะถึงภายใน 15 นาทีครับ',
  'อะไหล่ตัวนี้ต้องสั่งซื้อเข้ามาใหม่ รอของประมาณ 1-2 วันทำการครับ',
  'ได้ทำการแก้ไขและทดสอบระบบเรียบร้อยแล้ว รบกวนตรวจสอบอีกครั้งนะครับ',
  'ตอนนี้ใช้งานได้ปกติแล้วครับ ขอบคุณทีมงานมากครับที่มาช่วยดูให้ไวมาก',
  'ขออนุญาตปิดตั๋วงานนี้นะครับ หากมีปัญหาเพิ่มเติมสามารถเปิดตั๋วใหม่ได้ตลอดครับ',
  'ขอส่งรูปหน้าจอ Error เพิ่มเติมให้ทีมงานตรวจสอบครับ',
  'ส่งต่อเรื่องให้อาจารย์ผู้เชี่ยวชาญ/หัวหน้าแผนกตรวจสอบเพิ่มเติมครับ'
];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log('🚀 เริ่มต้นกระบวนการสร้างข้อมูลเสมือนจริง (Realistic Seeding)...');

  // 1. Seed / Find Departments
  console.log('📦 1. ตรวจสอบและสร้างแผนก...');
  const deptMap = {};
  for (const d of DEPARTMENTS_DATA) {
    let dept = await prisma.department.findFirst({
      where: { OR: [{ name: d.name }, { code: d.code }] }
    });
    if (!dept) {
      dept = await prisma.department.create({
        data: { name: d.name, code: d.code }
      });
    }
    deptMap[d.code] = dept;
  }
  const deptList = Object.values(deptMap);
  console.log(`✅ แผนกพร้อมใช้งานทั้งหมด ${deptList.length} แผนก`);

  // 2. Create 60 Users with password '123456789' (1 Admin, several Managers, rest Users)
  console.log('👥 2. สร้างรายชื่อผู้ใช้งาน 60 คน (รหัสผ่าน 123456789)...');
  const hashedPassword = await hashPassword('123456789');

  const users = [];

  for (let i = 0; i < 60; i++) {
    const fn = THAI_FIRSTNAMES[i % THAI_FIRSTNAMES.length];
    const ln = THAI_LASTNAMES[(i * 3 + 1) % THAI_LASTNAMES.length];
    const fullName = `${fn} ${ln}`;
    const username = `emp${String(i + 1).padStart(3, '0')}`;
    const email = `${username}@tickethub.com`;
    
    // Assign Role: Index 0 is the single ADMIN, indices 1..11 are MANAGERs of different depts, rest are USERs
    let role = 'USER';
    let dept = deptList[i % deptList.length];

    if (i === 0) {
      role = 'ADMIN';
      dept = deptMap['HQ'] || deptList[0];
    } else if (i <= 11) {
      role = 'MANAGER';
      dept = deptList[(i - 1) % deptList.length];
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        username,
        name: fullName,
        password: hashedPassword,
        role,
        departmentId: dept.id,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`
      },
      create: {
        username,
        email,
        name: fullName,
        password: hashedPassword,
        role,
        departmentId: dept.id,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`
      }
    });

    users.push(user);
  }

  const itUsers = users.filter(u => u.departmentId === deptMap['IT']?.id);
  const maintUsers = users.filter(u => u.departmentId === deptMap['MAINT']?.id);
  const managers = users.filter(u => u.role === 'MANAGER');
  const supportAgents = (itUsers.length > 0 || maintUsers.length > 0) ? [...itUsers, ...maintUsers] : users.filter(u => u.role !== 'USER');

  console.log(`✅ สร้างผู้ใช้งานครบ ${users.length} คน (Admin: 1, Manager: 11, User: 48)`);

  // 3. Create 1,680 Realistic Tickets
  console.log('🎫 3. กำลังสร้างข้อมูล Ticket จำนวน 1,680 รายการพร้อมแชท รูปภาพ และประวัติการทำงาน...');
  
  const TOTAL_TICKETS = 1680;
  let createdCount = 0;
  const batchSize = 100;

  for (let b = 0; b < TOTAL_TICKETS; b += batchSize) {
    const currentBatchLimit = Math.min(batchSize, TOTAL_TICKETS - b);
    
    for (let i = 0; i < currentBatchLimit; i++) {
      const ticketIndex = b + i + 1;
      const template = randomChoice(TICKET_TEMPLATES);
      const creator = randomChoice(users);
      const srcDeptId = creator.departmentId;

      // Status determination
      const randStatus = Math.random();
      let status = 'RESOLVED';
      if (randStatus < 0.08) status = 'NEW';
      else if (randStatus < 0.25) status = 'IN_PROGRESS';
      else if (randStatus < 0.32) status = 'PENDING_APPROVAL'; // 7% pending approval
      else if (randStatus < 0.36) status = 'APPROVED';         // 4% approved
      else if (randStatus < 0.39) status = 'REJECTED';         // 3% rejected
      else if (randStatus < 0.42) status = 'CANCELLED';        // 3% cancelled
      else status = 'RESOLVED';                                // ~58% resolved

      // Dates
      const pastDays = randomInt(1, 90);
      const createdAt = new Date(Date.now() - pastDays * 24 * 60 * 60 * 1000 - randomInt(10, 500) * 60 * 1000);
      const slaDueDate = new Date(createdAt.getTime() + (template.priority === 'CRITICAL' ? 4 : template.priority === 'HIGH' ? 8 : 24) * 60 * 60 * 1000);
      
      let resolvedAt = null;
      let agentId = null;
      let receiverManagerId = null;
      let tgtDeptId = null;

      // Approval logic
      const isApprovalTicket = (status === 'PENDING_APPROVAL' || status === 'APPROVED' || status === 'REJECTED');
      
      if (isApprovalTicket || Math.random() < 0.15) {
        const targetManagers = managers.filter(m => m.id !== creator.id);
        if (targetManagers.length > 0) {
          receiverManagerId = randomChoice(targetManagers).id;
          agentId = receiverManagerId; // Assign to manager for approval view
        }
      } else {
        const targetDepts = (template.category === 'HARDWARE' || template.category === 'SOFTWARE' || template.category === 'NETWORK') 
          ? [deptMap['IT']] 
          : [deptMap['MAINT'], deptMap['FAC'], deptMap['HR'], deptMap['PUR']];
        const chosenDept = randomChoice(targetDepts) || randomChoice(deptList);
        tgtDeptId = chosenDept.id;
      }

      if (!isApprovalTicket && status !== 'NEW') {
        const potentialAgents = supportAgents.length > 0 ? supportAgents : users;
        agentId = randomChoice(potentialAgents).id;
      }

      if (status === 'RESOLVED' || status === 'APPROVED') {
        const resolveHours = randomInt(1, 16);
        resolvedAt = new Date(createdAt.getTime() + resolveHours * 60 * 60 * 1000);
      }

      const hasAttachment = Math.random() < 0.45; // 45% have photo attachment
      const attachUrl = hasAttachment ? randomChoice(SAMPLE_IMAGES) : null;

      const ticket = await prisma.ticket.create({
        data: {
          title: `[#TK-${String(ticketIndex).padStart(5, '0')}] ${template.title}`,
          description: template.desc,
          status,
          priority: template.priority,
          category: template.category,
          subcategory: template.sub,
          slaDueDate,
          resolvedAt,
          attachmentUrl: attachUrl,
          userId: creator.id,
          agentId,
          receiverManagerId,
          sourceDepartmentId: srcDeptId,
          targetDepartmentId: tgtDeptId,
          createdAt,
          updatedAt: resolvedAt || new Date(createdAt.getTime() + 60 * 60 * 1000)
        }
      });

      // 3.1 If has attachment, create Attachment record
      if (attachUrl) {
        await prisma.attachment.create({
          data: {
            fileName: `issue_photo_${ticketIndex}.jpg`,
            fileType: 'image/jpeg',
            fileUrl: attachUrl,
            userId: creator.id,
            ticketId: ticket.id,
            createdAt
          }
        });
      }

      // 3.2 Create Chat Comments
      if (status === 'APPROVED') {
        await prisma.comment.create({
          data: {
            ticketId: ticket.id,
            userId: receiverManagerId || creator.id,
            message: '🟢 ได้รับการอนุมัติเรียบร้อยแล้ว: ดำเนินการจัดสรรและสั่งซื้อตามระเบียบบริษัทได้เลยครับ',
            createdAt: new Date(createdAt.getTime() + 30 * 60 * 1000)
          }
        });
      } else if (status === 'REJECTED') {
        await prisma.comment.create({
          data: {
            ticketId: ticket.id,
            userId: receiverManagerId || creator.id,
            message: '❌ ปฏิเสธคำขอ: ยังมีอุปกรณ์สำรองอยู่ในคลังส่วนกลาง ให้ติดต่อเบิกจากฝ่ายคลังก่อนครับ',
            createdAt: new Date(createdAt.getTime() + 30 * 60 * 1000)
          }
        });
      } else if (status === 'IN_PROGRESS' || status === 'RESOLVED') {
        const commentCount = randomInt(2, 4);
        for (let c = 0; c < commentCount; c++) {
          const isAgent = c % 2 === 1;
          const commentUser = (isAgent && agentId) ? (users.find(u => u.id === agentId) || creator) : creator;
          const commentTime = new Date(createdAt.getTime() + (c + 1) * randomInt(15, 60) * 60 * 1000);
          const hasChatPic = (c === 0 && Math.random() < 0.25);

          await prisma.comment.create({
            data: {
              ticketId: ticket.id,
              userId: commentUser.id,
              message: randomChoice(CHAT_RESPONSES),
              attachmentUrl: hasChatPic ? randomChoice(SAMPLE_IMAGES) : null,
              createdAt: commentTime,
              updatedAt: commentTime,
              readAt: new Date(commentTime.getTime() + 5 * 60 * 1000)
            }
          });
        }
      }

      // 3.3 Create Ticket Transfers for ~8% of tickets
      if (Math.random() < 0.08 && status !== 'NEW') {
        const fromDept = deptMap['IT']?.id || srcDeptId;
        const toDept = deptMap['MAINT']?.id || deptList[0].id;
        await prisma.ticketTransfer.create({
          data: {
            ticketId: ticket.id,
            fromDepartmentId: fromDept,
            toDepartmentId: toDept,
            requestedById: agentId || creator.id,
            status: status === 'RESOLVED' ? 'COMPLETED' : 'PENDING',
            note: 'เนื่องจากตรวจสอบแล้วเป็นปัญหาเกี่ยวกับระบบสายไฟหลักของอาคาร จึงขอส่งต่อให้ทีมซ่อมบำรุงเข้าตรวจสอบต่อครับ',
            createdAt: new Date(createdAt.getTime() + 45 * 60 * 1000)
          }
        });
      }

      // 3.4 Create Notifications for recent tickets
      if (ticketIndex <= 80) {
        await prisma.notification.create({
          data: {
            userId: creator.id,
            title: `ตั๋วของคุณ (#TK-${String(ticketIndex).padStart(5, '0')}) มีการอัปเดต`,
            message: status === 'RESOLVED' ? 'ตั๋วปัญหาของคุณได้รับการแก้ไขและปิดงานเรียบร้อยแล้ว' : 'เจ้าหน้าที่ได้รับเรื่องและกำลังดำเนินการ',
            isRead: status === 'RESOLVED',
            link: `/tickets?id=${ticket.id}`,
            createdAt: resolvedAt || createdAt
          }
        });
      }

      createdCount++;
    }
    console.log(`⏳ สร้างแล้ว ${createdCount} / ${TOTAL_TICKETS} ตั๋ว...`);
  }

  // 4. Webhook config
  await prisma.webhookConfig.upsert({
    where: { id: 'webhook-discord-it' },
    update: {},
    create: {
      id: 'webhook-discord-it',
      name: 'Discord IT Alert Channel',
      url: 'https://discord.com/api/webhooks/demo-channel-url',
      targetDepartment: deptMap['IT']?.id || 'all',
      allowPrivateTickets: true,
      isActive: true
    }
  });

  console.log('🎉 ข้อมูลเสมือนจริง 1,680 ตั๋ว และ 60 ผู้ใช้งาน ถูกบันทึกลง Database เรียบร้อยสมบูรณ์ 100%!');
}

main()
  .catch(e => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
