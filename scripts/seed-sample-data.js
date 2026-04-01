/**
 * Seed Sample Data Script
 *
 * Usage:
 *   1. npm install firebase-admin (if not already installed)
 *   2. Download service account key from Firebase Console:
 *      Project Settings > Service Accounts > Generate New Private Key
 *   3. Save it as scripts/serviceAccountKey.json
 *   4. Run: node scripts/seed-sample-data.js
 *
 * This will create:
 *   - 1 Company (ASTRA TECHNOLOGIES) with 2 branches
 *   - 8 users: 1 admin, 1 company admin, 2 branch admins, 4 employees
 *   - Sample attendance records (last 7 days)
 *   - Sample leave applications
 *   - Sample claims
 *   - Sample announcements
 *   - Company settings
 *
 * All user passwords: Test1234!
 */

const admin = require('firebase-admin');
// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth();

// ============ HELPER FUNCTIONS ============

function randomDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d;
}

function dateString(daysAgo) {
  return randomDate(daysAgo).toISOString().split('T')[0];
}

function clockInTime(daysAgo, hour = 8, minute = 0) {
  const d = randomDate(daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function clockOutTime(daysAgo, hour = 17, minute = 30) {
  const d = randomDate(daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// ============ DATA DEFINITIONS ============

const COMPANY_ID = 'company_astra';
const BRANCH_KL_ID = 'branch_kl_main';
const BRANCH_JB_ID = 'branch_jb';

const PASSWORD = 'Test1234!';

const USERS = [
  {
    email: 'admin@astra.com',
    firstName: 'Ahmad',
    lastName: 'Admin',
    role: 'admin',
    company: 'ASTRA TECHNOLOGIES',
    companyId: COMPANY_ID,
    department: 'Management',
    position: 'System Administrator',
    branchId: BRANCH_KL_ID,
    branchName: 'KL Main Office',
    phone: '0121234567',
  },
  {
    email: 'companyadmin@astra.com',
    firstName: 'Siti',
    lastName: 'Nurhaliza',
    role: 'company_admin',
    company: 'ASTRA TECHNOLOGIES',
    companyId: COMPANY_ID,
    department: 'Management',
    position: 'Company Director',
    branchId: BRANCH_KL_ID,
    branchName: 'KL Main Office',
    phone: '0129876543',
  },
  {
    email: 'branchadmin.kl@astra.com',
    firstName: 'Ali',
    lastName: 'Hassan',
    role: 'branch_admin',
    company: 'ASTRA TECHNOLOGIES',
    companyId: COMPANY_ID,
    department: 'Operations',
    position: 'Branch Manager',
    branchId: BRANCH_KL_ID,
    branchName: 'KL Main Office',
    phone: '0131112233',
  },
  {
    email: 'branchadmin.jb@astra.com',
    firstName: 'Aminah',
    lastName: 'Ibrahim',
    role: 'branch_admin',
    company: 'ASTRA TECHNOLOGIES',
    companyId: COMPANY_ID,
    department: 'Operations',
    position: 'Branch Manager',
    branchId: BRANCH_JB_ID,
    branchName: 'JB Branch',
    phone: '0174445566',
  },
  {
    email: 'farid@astra.com',
    firstName: 'Farid',
    lastName: 'Razak',
    role: 'user',
    company: 'ASTRA TECHNOLOGIES',
    companyId: COMPANY_ID,
    department: 'Engineering',
    position: 'Software Developer',
    branchId: BRANCH_KL_ID,
    branchName: 'KL Main Office',
    phone: '0185556677',
  },
  {
    email: 'nurul@astra.com',
    firstName: 'Nurul',
    lastName: 'Izzah',
    role: 'user',
    company: 'ASTRA TECHNOLOGIES',
    companyId: COMPANY_ID,
    department: 'Finance',
    position: 'Accountant',
    branchId: BRANCH_KL_ID,
    branchName: 'KL Main Office',
    phone: '0196667788',
  },
  {
    email: 'hafiz@astra.com',
    firstName: 'Hafiz',
    lastName: 'Abdullah',
    role: 'user',
    company: 'ASTRA TECHNOLOGIES',
    companyId: COMPANY_ID,
    department: 'Sales',
    position: 'Sales Executive',
    branchId: BRANCH_JB_ID,
    branchName: 'JB Branch',
    phone: '0167778899',
  },
  {
    email: 'aina@astra.com',
    firstName: 'Aina',
    lastName: 'Syafiqah',
    role: 'user',
    company: 'ASTRA TECHNOLOGIES',
    companyId: COMPANY_ID,
    department: 'HR',
    position: 'HR Executive',
    branchId: BRANCH_JB_ID,
    branchName: 'JB Branch',
    phone: '0148889900',
  },
];

// ============ SEED FUNCTIONS ============

async function createUsers() {
  console.log('\n📌 Creating users...');
  const userIds = {};

  for (const userData of USERS) {
    try {
      // Create Firebase Auth user
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(userData.email);
        console.log(`  ⚠️  User ${userData.email} already exists, updating Firestore doc...`);
      } catch {
        userRecord = await auth.createUser({
          email: userData.email,
          password: PASSWORD,
          displayName: `${userData.firstName} ${userData.lastName}`,
        });
        console.log(`  ✅ Created auth user: ${userData.email}`);
      }

      const uid = userRecord.uid;
      userIds[userData.email] = uid;

      // Create Firestore user document
      await db.collection('users').doc(uid).set({
        uid,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        company: userData.company,
        companyId: userData.companyId,
        department: userData.department,
        position: userData.position,
        branchId: userData.branchId,
        branchName: userData.branchName,
        phone: userData.phone,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        leaveBalance: {
          annual: 12,
          sick: 14,
          emergency: 3,
          maternity: 90,
        },
      });
    } catch (error) {
      console.error(`  ❌ Error creating ${userData.email}:`, error.message);
    }
  }

  return userIds;
}

async function createCompanyAndBranches() {
  console.log('\n📌 Creating company & branches...');

  // Company
  await db.collection('companies').doc(COMPANY_ID).set({
    name: 'ASTRA TECHNOLOGIES',
    registrationNumber: 'SSM-123456-A',
    address: 'Level 10, Menara KL, Jalan Sultan Ismail, 50250 Kuala Lumpur',
    phone: '03-21234567',
    email: 'info@astratech.com',
    industry: 'Professional Services',
    totalEmployees: 6,
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log('  ✅ Company: ASTRA TECHNOLOGIES');

  // Branches
  await db.collection('branches').doc(BRANCH_KL_ID).set({
    name: 'KL Main Office',
    companyId: COMPANY_ID,
    companyName: 'ASTRA TECHNOLOGIES',
    address: 'Level 10, Menara KL, Jalan Sultan Ismail, 50250 Kuala Lumpur',
    phone: '03-21234567',
    latitude: 3.1516,
    longitude: 101.7036,
    radius: 200,
    geofenceRadius: 200,
    isActive: true,
    isHeadquarters: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log('  ✅ Branch: KL Main Office');

  await db.collection('branches').doc(BRANCH_JB_ID).set({
    name: 'JB Branch',
    companyId: COMPANY_ID,
    companyName: 'ASTRA TECHNOLOGIES',
    address: '15, Jalan Tun Razak, 80000 Johor Bahru, Johor',
    phone: '07-2234567',
    latitude: 1.4927,
    longitude: 103.7414,
    radius: 200,
    geofenceRadius: 300,
    isActive: true,
    isHeadquarters: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log('  ✅ Branch: JB Branch');
}

async function createCompanySettings() {
  console.log('\n📌 Creating company settings...');

  await db.collection('companySettings').doc(COMPANY_ID).set({
    companyId: COMPANY_ID,
    companyName: 'ASTRA TECHNOLOGIES',
    workingHours: {
      start: '09:00',
      end: '18:00',
      standardHours: 8,
    },
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    leaveTypes: [
      { name: 'Annual Leave', days: 12, code: 'annual' },
      { name: 'Sick Leave', days: 14, code: 'sick' },
      { name: 'Emergency Leave', days: 3, code: 'emergency' },
      { name: 'Maternity Leave', days: 90, code: 'maternity' },
    ],
    claimTypes: [
      { name: 'Transport', maxAmount: 500, code: 'transport' },
      { name: 'Meal', maxAmount: 200, code: 'meal' },
      { name: 'Parking', maxAmount: 150, code: 'parking' },
      { name: 'Medical', maxAmount: 1000, code: 'medical' },
    ],
    currency: 'MYR',
    timezone: 'Asia/Kuala_Lumpur',
    geofenceRadius: 200,
    attendanceSettings: {
      allowEarlyCheckIn: 30,
      autoCheckoutTime: '23:59',
      requireLocation: true,
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log('  ✅ Company settings created');
}

async function createAttendanceRecords(userIds) {
  console.log('\n📌 Creating attendance records...');

  const employees = USERS.filter(u => u.role === 'user');
  let count = 0;

  for (const emp of employees) {
    const uid = userIds[emp.email];
    if (!uid) continue;

    // Create attendance for last 7 working days
    for (let day = 1; day <= 7; day++) {
      const date = randomDate(day);
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

      const checkIn = clockInTime(day, 8 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 30));
      const checkOut = clockOutTime(day, 17 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60));
      const workingMs = checkOut - checkIn;
      const workingHours = Math.round((workingMs / (1000 * 60 * 60)) * 100) / 100;
      const overtime = Math.max(0, workingHours - 8);

      const isLate = checkIn.getHours() >= 9 && checkIn.getMinutes() > 15;

      await db.collection('attendance').add({
        userId: uid,
        userName: `${emp.firstName} ${emp.lastName}`,
        email: emp.email,
        company: emp.company,
        companyId: emp.companyId,
        branchId: emp.branchId,
        branchName: emp.branchName,
        department: emp.department,
        date: dateString(day),
        dateString: dateString(day),
        checkInTime: admin.firestore.Timestamp.fromDate(checkIn),
        clockInTime: admin.firestore.Timestamp.fromDate(checkIn),
        checkOutTime: admin.firestore.Timestamp.fromDate(checkOut),
        clockOutTime: admin.firestore.Timestamp.fromDate(checkOut),
        status: isLate ? 'late' : 'present',
        workingHours,
        overtimeHours: Math.round(overtime * 100) / 100,
        checkInLocation: {
          latitude: emp.branchId === BRANCH_KL_ID ? 3.1516 + (Math.random() * 0.001) : 1.4927 + (Math.random() * 0.001),
          longitude: emp.branchId === BRANCH_KL_ID ? 101.7036 + (Math.random() * 0.001) : 103.7414 + (Math.random() * 0.001),
        },
        notes: '',
        createdAt: admin.firestore.Timestamp.fromDate(checkIn),
        updatedAt: admin.firestore.Timestamp.fromDate(checkOut),
      });
      count++;
    }
  }
  console.log(`  ✅ ${count} attendance records created`);
}

async function createLeaves(userIds) {
  console.log('\n📌 Creating leave applications...');

  const leaveData = [
    {
      email: 'farid@astra.com',
      type: 'annual',
      typeName: 'Annual Leave',
      startDate: '2026-04-07',
      endDate: '2026-04-09',
      days: 3,
      reason: 'Family vacation to Langkawi',
      status: 'approved',
    },
    {
      email: 'nurul@astra.com',
      type: 'sick',
      typeName: 'Sick Leave',
      startDate: '2026-03-28',
      endDate: '2026-03-28',
      days: 1,
      reason: 'Food poisoning - MC attached',
      status: 'approved',
    },
    {
      email: 'hafiz@astra.com',
      type: 'annual',
      typeName: 'Annual Leave',
      startDate: '2026-04-14',
      endDate: '2026-04-18',
      days: 5,
      reason: 'Balik kampung - Hari Raya',
      status: 'pending',
    },
    {
      email: 'aina@astra.com',
      type: 'emergency',
      typeName: 'Emergency Leave',
      startDate: '2026-03-25',
      endDate: '2026-03-25',
      days: 1,
      reason: 'Family emergency',
      status: 'approved',
    },
  ];

  for (const leave of leaveData) {
    const uid = userIds[leave.email];
    if (!uid) continue;

    const emp = USERS.find(u => u.email === leave.email);

    await db.collection('leaves').add({
      userId: uid,
      userName: `${emp.firstName} ${emp.lastName}`,
      email: emp.email,
      company: emp.company,
      companyId: emp.companyId,
      branchId: emp.branchId,
      branchName: emp.branchName,
      department: emp.department,
      leaveType: leave.type,
      leaveTypeName: leave.typeName,
      startDate: leave.startDate,
      endDate: leave.endDate,
      totalDays: leave.days,
      reason: leave.reason,
      status: leave.status,
      approvedBy: leave.status === 'approved' ? userIds['admin@astra.com'] : null,
      approvedDate: leave.status === 'approved' ? admin.firestore.FieldValue.serverTimestamp() : null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  console.log(`  ✅ ${leaveData.length} leave applications created`);
}

async function createClaims(userIds) {
  console.log('\n📌 Creating claims...');

  const claimsData = [
    {
      email: 'farid@astra.com',
      type: 'transport',
      typeName: 'Transport',
      amount: 85.50,
      description: 'Grab to client meeting at KLCC',
      date: '2026-03-27',
      status: 'approved',
    },
    {
      email: 'nurul@astra.com',
      type: 'meal',
      typeName: 'Meal',
      amount: 45.00,
      description: 'Lunch with client - Pizza Hut',
      date: '2026-03-26',
      status: 'pending',
    },
    {
      email: 'hafiz@astra.com',
      type: 'parking',
      typeName: 'Parking',
      amount: 15.00,
      description: 'Parking at JB Sentral',
      date: '2026-03-28',
      status: 'approved',
    },
    {
      email: 'aina@astra.com',
      type: 'medical',
      typeName: 'Medical',
      amount: 120.00,
      description: 'GP consultation + medication',
      date: '2026-03-25',
      status: 'pending',
    },
    {
      email: 'farid@astra.com',
      type: 'meal',
      typeName: 'Meal',
      amount: 32.50,
      description: 'Team lunch - Nasi Kandar',
      date: '2026-03-29',
      status: 'pending',
    },
  ];

  for (const claim of claimsData) {
    const uid = userIds[claim.email];
    if (!uid) continue;

    const emp = USERS.find(u => u.email === claim.email);

    await db.collection('claims').add({
      userId: uid,
      userName: `${emp.firstName} ${emp.lastName}`,
      email: emp.email,
      company: emp.company,
      companyId: emp.companyId,
      branchId: emp.branchId,
      branchName: emp.branchName,
      department: emp.department,
      claimType: claim.type,
      claimTypeName: claim.typeName,
      amount: claim.amount,
      description: claim.description,
      claimDate: claim.date,
      status: claim.status,
      receiptUrl: '',
      approvedBy: claim.status === 'approved' ? userIds['admin@astra.com'] : null,
      approvedDate: claim.status === 'approved' ? admin.firestore.FieldValue.serverTimestamp() : null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  console.log(`  ✅ ${claimsData.length} claims created`);
}

async function createAnnouncements(userIds) {
  console.log('\n📌 Creating announcements...');

  const announcements = [
    {
      title: 'Selamat Hari Raya Aidilfitri 2026',
      content: 'Kepada semua warga ASTRA TECHNOLOGIES, kami mengucapkan Selamat Hari Raya Aidilfitri. Cuti Raya bermula 28 Mac - 4 April 2026. Maaf Zahir & Batin.',
      priority: 'high',
      category: 'holiday',
    },
    {
      title: 'Town Hall Meeting - April 2026',
      content: 'Town Hall Meeting akan diadakan pada 10 April 2026 jam 3:00 PM di Meeting Room Level 10. Semua staff wajib hadir. Agenda: Q1 Performance Review & Q2 Planning.',
      priority: 'medium',
      category: 'meeting',
    },
    {
      title: 'New Parking Policy',
      content: 'Bermula 1 April 2026, parking claim akan dihadkan kepada RM150/bulan. Sila simpan resit parking untuk tujuan tuntutan. Hubungi HR untuk sebarang pertanyaan.',
      priority: 'low',
      category: 'policy',
    },
  ];

  const adminUid = userIds['admin@astra.com'];

  for (const ann of announcements) {
    await db.collection('announcements').add({
      ...ann,
      companyId: COMPANY_ID,
      companyName: 'ASTRA TECHNOLOGIES',
      createdBy: adminUid,
      createdByName: 'Ahmad Admin',
      isActive: true,
      targetBranches: ['all'],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  console.log(`  ✅ ${announcements.length} announcements created`);
}

// ============ MAIN ============

async function main() {
  console.log('🚀 ASTRA - Seeding Sample Data');
  console.log('================================');

  try {
    await createCompanyAndBranches();
    await createCompanySettings();
    const userIds = await createUsers();
    await createAttendanceRecords(userIds);
    await createLeaves(userIds);
    await createClaims(userIds);
    await createAnnouncements(userIds);

    console.log('\n================================');
    console.log('✅ Sample data seeded successfully!\n');
    console.log('📋 Login Credentials (Password for all: Test1234!)');
    console.log('─────────────────────────────────────────');
    console.log('  Admin:          admin@astra.com');
    console.log('  Company Admin:  companyadmin@astra.com');
    console.log('  Branch Admin KL: branchadmin.kl@astra.com');
    console.log('  Branch Admin JB: branchadmin.jb@astra.com');
    console.log('  Employee 1:     farid@astra.com');
    console.log('  Employee 2:     nurul@astra.com');
    console.log('  Employee 3:     hafiz@astra.com');
    console.log('  Employee 4:     aina@astra.com');
    console.log('─────────────────────────────────────────\n');
  } catch (error) {
    console.error('❌ Error seeding data:', error);
  }

  process.exit(0);
}

main();
