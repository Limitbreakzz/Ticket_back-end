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
      let dept = await prisma.department.findFirst({
        where: {
          OR: [
            { name: d.name },
            { code: d.code }
          ]
        }
      });
      if (!dept) {
        dept = await prisma.department.create({
          data: { name: d.name, code: d.code }
        });
      }
      deptMap[d.name] = dept.id;
      console.log(`- Department: ${dept.name} (${dept.code})`);
    }

    console.log("Seeding users...");
    const hashedPassword = await hashPassword('password123');

    const usersToCreate = [
      {
        email: 'employee@tickethub.com',
        username: 'employee',
        name: 'สมชาย ใจดี',
        role: 'USER',
        password: hashedPassword,
        departmentId: deptMap['ฝ่ายผลิต 1']
      },
      {
        email: 'manager@tickethub.com',
        username: 'manager',
        name: 'วิภา รักดี',
        role: 'MANAGER',
        password: hashedPassword,
        departmentId: deptMap['ฝ่ายซ่อมบำรุง']
      },
      {
        email: 'admin@tickethub.com',
        username: 'admin',
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
          username: u.username,
          departmentId: u.departmentId,
          avatarUrl: null
        },
        create: {
          email: u.email,
          username: u.username,
          name: u.name,
          role: u.role,
          password: u.password,
          departmentId: u.departmentId,
          avatarUrl: null
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
