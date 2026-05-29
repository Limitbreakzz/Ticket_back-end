const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('./utils/password');
const prisma = new PrismaClient();

const DEPARTMENTS = [
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

async function main() {
  try {
    console.log("Seeding departments...");
    const deptMap = {};
    for (const d of DEPARTMENTS) {
      const dept = await prisma.department.upsert({
        where: { name: d.name },
        update: { code: d.code },
        create: { name: d.name, code: d.code }
      });
      deptMap[d.name] = dept.id;
      console.log(`- Created/Updated department: ${d.name} (${d.code})`);
    }

    console.log("Seeding users...");
    const hashedPassword = await hashPassword('password123');

    const usersToCreate = [
      {
        email: 'employee@tickethub.com',
        name: 'สมชาย ใจดี',
        role: 'USER',
        password: hashedPassword,
        departmentId: deptMap['ฝ่ายผลิต 1']
      },
      {
        email: 'manager@tickethub.com',
        name: 'วิภา รักดี',
        role: 'MANAGER',
        password: hashedPassword,
        departmentId: deptMap['ฝ่ายซ่อมบำรุง']
      },
      {
        email: 'admin@tickethub.com',
        name: 'ธนา สมบูรณ์',
        role: 'ADMIN',
        password: hashedPassword,
        departmentId: deptMap['ส่วนกลาง']
      }
    ];

    for (const u of usersToCreate) {
      const user = await prisma.user.upsert({
        where: { email: u.email },
        update: {
          name: u.name,
          role: u.role,
          password: u.password,
          departmentId: u.departmentId
        },
        create: {
          email: u.email,
          name: u.name,
          role: u.role,
          password: u.password,
          departmentId: u.departmentId
        }
      });
      console.log(`- Created/Updated user: ${user.name} (${user.role})`);
    }

    console.log("Seeding completed successfully!");
  } catch (err) {
    console.error("Error seeding database:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
