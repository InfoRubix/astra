// Utility to migrate all existing user records to use normalized company names
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

const NORMALIZED_COMPANY_NAME = 'RUBIX TECHNOLOGY';

export const migrateCompanyNames = async () => {
  console.log('Starting company name migration...');
  
  try {
    // Update users collection
    const usersSnapshot = await getDocs(collection(db, 'users'));
    console.log(`Found ${usersSnapshot.size} users to update`);
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const currentCompanyName = userData.companyName;
      
      if (currentCompanyName !== NORMALIZED_COMPANY_NAME) {
        await updateDoc(doc(db, 'users', userDoc.id), {
          companyName: NORMALIZED_COMPANY_NAME,
          originalCompanyName: currentCompanyName,
          migratedAt: new Date()
        });
        console.log(`Updated user ${userData.email}: "${currentCompanyName}" → "${NORMALIZED_COMPANY_NAME}"`);
      } else {
        console.log(`User ${userData.email} already has normalized company name`);
      }
    }
    
    // Update attendance records
    const attendanceSnapshot = await getDocs(collection(db, 'attendance'));
    console.log(`Found ${attendanceSnapshot.size} attendance records to update`);
    
    for (const attendanceDoc of attendanceSnapshot.docs) {
      const attendanceData = attendanceDoc.data();
      const currentCompanyName = attendanceData.companyName;
      
      if (currentCompanyName && currentCompanyName !== NORMALIZED_COMPANY_NAME) {
        await updateDoc(doc(db, 'attendance', attendanceDoc.id), {
          companyName: NORMALIZED_COMPANY_NAME
        });
        console.log(`Updated attendance record: "${currentCompanyName}" → "${NORMALIZED_COMPANY_NAME}"`);
      }
    }
    
    // Update leave records
    const leavesSnapshot = await getDocs(collection(db, 'leaves'));
    console.log(`Found ${leavesSnapshot.size} leave records to update`);
    
    for (const leaveDoc of leavesSnapshot.docs) {
      const leaveData = leaveDoc.data();
      const currentCompanyName = leaveData.companyName;
      
      if (currentCompanyName && currentCompanyName !== NORMALIZED_COMPANY_NAME) {
        await updateDoc(doc(db, 'leaves', leaveDoc.id), {
          companyName: NORMALIZED_COMPANY_NAME
        });
        console.log(`Updated leave record: "${currentCompanyName}" → "${NORMALIZED_COMPANY_NAME}"`);
      }
    }
    
    // Update claims records
    const claimsSnapshot = await getDocs(collection(db, 'claims'));
    console.log(`Found ${claimsSnapshot.size} claims records to update`);
    
    for (const claimDoc of claimsSnapshot.docs) {
      const claimData = claimDoc.data();
      const currentCompanyName = claimData.companyName;
      
      if (currentCompanyName && currentCompanyName !== NORMALIZED_COMPANY_NAME) {
        await updateDoc(doc(db, 'claims', claimDoc.id), {
          companyName: NORMALIZED_COMPANY_NAME
        });
        console.log(`Updated claim record: "${currentCompanyName}" → "${NORMALIZED_COMPANY_NAME}"`);
      }
    }
    
    console.log('✅ Company name migration completed successfully!');
    return { success: true, message: 'Migration completed' };
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return { success: false, error: error.message };
  }
};