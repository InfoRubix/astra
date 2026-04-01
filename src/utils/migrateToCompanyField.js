import { collection, getDocs, doc, updateDoc, setDoc, deleteField } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Migration script to update existing Firebase data from companyName to company field
 * and normalize company values to the new structure
 */

const COMPANY_MAPPING = {
  'RUBIX TECHNOLOGY': 'RUBIX',
  'RUBIX': 'RUBIX',
  'AFC': 'AFC',
  'KFC': 'KFC',
  'LITIGATION': 'LITIGATION',
  'ASIAH HISAM': 'ASIAH HISAM'
};

const VALID_COMPANIES = ['ASIAH HISAM', 'RUBIX', 'AFC', 'KFC', 'LITIGATION'];

export async function migrateCompanyFields() {
  console.log('🚀 Starting migration from companyName to company field...');
  
  try {
    // 1. Migrate Users Collection
    await migrateUsersCollection();
    
    // 2. Migrate Attendance Collection
    await migrateAttendanceCollection();
    
    // 3. Migrate Leaves Collection
    await migrateLeavesCollection();
    
    // 4. Migrate Claims Collection
    await migrateClaimsCollection();
    
    console.log('✅ Migration completed successfully!');
    return { success: true, message: 'Migration completed successfully!' };
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return { success: false, error: error.message };
  }
}

async function migrateUsersCollection() {
  console.log('📄 Migrating Users collection...');
  
  const usersSnapshot = await getDocs(collection(db, 'users'));
  const promises = [];
  
  usersSnapshot.forEach((userDoc) => {
    const userData = userDoc.data();
    
    if (userData.companyName && !userData.company) {
      const mappedCompany = COMPANY_MAPPING[userData.companyName] || '';
      
      promises.push(
        updateDoc(doc(db, 'users', userDoc.id), {
          company: mappedCompany,
          companyName: deleteField(), // Remove old field
          migratedAt: new Date()
        })
      );
      
      console.log(`  • User ${userData.email}: ${userData.companyName} → ${mappedCompany}`);
    }
  });
  
  await Promise.all(promises);
  console.log(`✅ Updated ${promises.length} users`);
}

async function migrateAttendanceCollection() {
  console.log('📄 Migrating Attendance collection...');
  
  const attendanceSnapshot = await getDocs(collection(db, 'attendance'));
  const promises = [];
  
  attendanceSnapshot.forEach((attendanceDoc) => {
    const attendanceData = attendanceDoc.data();
    
    if (attendanceData.companyName && !attendanceData.company) {
      const mappedCompany = COMPANY_MAPPING[attendanceData.companyName] || '';
      
      promises.push(
        updateDoc(doc(db, 'attendance', attendanceDoc.id), {
          company: mappedCompany,
          companyName: deleteField(), // Remove old field
          migratedAt: new Date()
        })
      );
    }
  });
  
  await Promise.all(promises);
  console.log(`✅ Updated ${promises.length} attendance records`);
}

async function migrateLeavesCollection() {
  console.log('📄 Migrating Leaves collection...');
  
  const leavesSnapshot = await getDocs(collection(db, 'leaves'));
  const promises = [];
  
  leavesSnapshot.forEach((leaveDoc) => {
    const leaveData = leaveDoc.data();
    
    if (leaveData.companyName && !leaveData.company) {
      const mappedCompany = COMPANY_MAPPING[leaveData.companyName] || '';
      
      promises.push(
        updateDoc(doc(db, 'leaves', leaveDoc.id), {
          company: mappedCompany,
          companyName: deleteField(), // Remove old field
          migratedAt: new Date()
        })
      );
    }
  });
  
  await Promise.all(promises);
  console.log(`✅ Updated ${promises.length} leave records`);
}

async function migrateClaimsCollection() {
  console.log('📄 Migrating Claims collection...');
  
  const claimsSnapshot = await getDocs(collection(db, 'claims'));
  const promises = [];
  
  claimsSnapshot.forEach((claimDoc) => {
    const claimData = claimDoc.data();
    
    if (claimData.companyName && !claimData.company) {
      const mappedCompany = COMPANY_MAPPING[claimData.companyName] || '';
      
      promises.push(
        updateDoc(doc(db, 'claims', claimDoc.id), {
          company: mappedCompany,
          companyName: deleteField(), // Remove old field
          migratedAt: new Date()
        })
      );
    }
  });
  
  await Promise.all(promises);
  console.log(`✅ Updated ${promises.length} claim records`);
}


// Helper function to get migration status
export async function getMigrationStatus() {
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    let usersWithOldField = 0;
    let usersWithNewField = 0;
    
    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.companyName) usersWithOldField++;
      if (data.company) usersWithNewField++;
    });
    
    return {
      usersWithOldField,
      usersWithNewField,
      totalUsers: usersSnapshot.size,
      needsMigration: usersWithOldField > 0
    };
  } catch (error) {
    console.error('Error checking migration status:', error);
    return { error: error.message };
  }
}