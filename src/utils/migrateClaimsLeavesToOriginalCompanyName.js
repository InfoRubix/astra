import { collection, getDocs, doc, updateDoc, writeBatch, deleteField } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Migration script to update Claims and Leaves collections
 * Changes companyName → originalCompanyName to match Users collection
 */

export async function migrateClaimsAndLeavesToOriginalCompanyName() {
  console.log('Starting Claims and Leaves migration to originalCompanyName...');
  
  try {
    let totalProcessed = 0;
    
    // Migrate Claims collection
    console.log('\n=== Migrating Claims Collection ===');
    const claimsSnapshot = await getDocs(collection(db, 'claims'));
    const claims = claimsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`Found ${claims.length} claims to process`);
    
    let batch = writeBatch(db);
    let batchCount = 0;
    
    for (const claim of claims) {
      if (claim.companyName) {
        console.log(`Migrating claim ${claim.id}: ${claim.companyName} → originalCompanyName`);
        
        const claimRef = doc(db, 'claims', claim.id);
        batch.update(claimRef, {
          originalCompanyName: claim.companyName,
          companyName: deleteField()
        });
        
        batchCount++;
        totalProcessed++;
        
        // Commit batch every 100 operations
        if (batchCount === 100) {
          console.log(`Committing claims batch (${totalProcessed} processed so far)...`);
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }
    }
    
    // Commit remaining claims
    if (batchCount > 0) {
      console.log('Committing final claims batch...');
      await batch.commit();
    }
    
    console.log(`✅ Claims migration completed: ${claims.length} claims processed`);
    
    // Migrate Leaves collection
    console.log('\n=== Migrating Leaves Collection ===');
    const leavesSnapshot = await getDocs(collection(db, 'leaves'));
    const leaves = leavesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`Found ${leaves.length} leaves to process`);
    
    batch = writeBatch(db);
    batchCount = 0;
    
    for (const leave of leaves) {
      if (leave.companyName) {
        console.log(`Migrating leave ${leave.id}: ${leave.companyName} → originalCompanyName`);
        
        const leaveRef = doc(db, 'leaves', leave.id);
        batch.update(leaveRef, {
          originalCompanyName: leave.companyName,
          companyName: deleteField()
        });
        
        batchCount++;
        totalProcessed++;
        
        // Commit batch every 100 operations
        if (batchCount === 100) {
          console.log(`Committing leaves batch (${totalProcessed} processed so far)...`);
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }
    }
    
    // Commit remaining leaves
    if (batchCount > 0) {
      console.log('Committing final leaves batch...');
      await batch.commit();
    }
    
    console.log(`✅ Leaves migration completed: ${leaves.length} leaves processed`);
    
    // Migrate Attendance collection (optional)
    console.log('\n=== Migrating Attendance Collection ===');
    const attendanceSnapshot = await getDocs(collection(db, 'attendance'));
    const attendanceRecords = attendanceSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`Found ${attendanceRecords.length} attendance records to process`);
    
    batch = writeBatch(db);
    batchCount = 0;
    
    for (const attendance of attendanceRecords) {
      if (attendance.companyName) {
        console.log(`Migrating attendance ${attendance.id}: ${attendance.companyName} → originalCompanyName`);
        
        const attendanceRef = doc(db, 'attendance', attendance.id);
        batch.update(attendanceRef, {
          originalCompanyName: attendance.companyName,
          companyName: deleteField()
        });
        
        batchCount++;
        totalProcessed++;
        
        // Commit batch every 100 operations
        if (batchCount === 100) {
          console.log(`Committing attendance batch (${totalProcessed} processed so far)...`);
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }
    }
    
    // Commit remaining attendance records
    if (batchCount > 0) {
      console.log('Committing final attendance batch...');
      await batch.commit();
    }
    
    console.log(`✅ Attendance migration completed: ${attendanceRecords.length} records processed`);
    
    console.log(`\n🎉 Migration completed successfully!`);
    console.log(`Total documents processed: ${totalProcessed}`);
    console.log(`- Claims: ${claims.length}`);
    console.log(`- Leaves: ${leaves.length}`);
    console.log(`- Attendance: ${attendanceRecords.length}`);
    
    return {
      success: true,
      totalProcessed,
      claims: claims.length,
      leaves: leaves.length,
      attendance: attendanceRecords.length,
      message: `Successfully migrated ${totalProcessed} documents to use originalCompanyName`
    };
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Preview what the migration would do without making changes
 */
export async function previewClaimsLeavesMigration() {
  console.log('Previewing Claims and Leaves migration...');
  
  try {
    const preview = {
      claims: [],
      leaves: [],
      attendance: []
    };
    
    // Preview Claims
    const claimsSnapshot = await getDocs(collection(db, 'claims'));
    claimsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.companyName) {
        preview.claims.push({
          id: doc.id,
          currentCompanyName: data.companyName,
          willBecomeOriginalCompanyName: data.companyName
        });
      }
    });
    
    // Preview Leaves
    const leavesSnapshot = await getDocs(collection(db, 'leaves'));
    leavesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.companyName) {
        preview.leaves.push({
          id: doc.id,
          currentCompanyName: data.companyName,
          willBecomeOriginalCompanyName: data.companyName
        });
      }
    });
    
    // Preview Attendance
    const attendanceSnapshot = await getDocs(collection(db, 'attendance'));
    attendanceSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.companyName) {
        preview.attendance.push({
          id: doc.id,
          currentCompanyName: data.companyName,
          willBecomeOriginalCompanyName: data.companyName
        });
      }
    });
    
    console.log('\nPreview Results:');
    console.log(`Claims to migrate: ${preview.claims.length}`);
    console.log(`Leaves to migrate: ${preview.leaves.length}`);
    console.log(`Attendance to migrate: ${preview.attendance.length}`);
    
    return {
      success: true,
      preview,
      totalCount: preview.claims.length + preview.leaves.length + preview.attendance.length
    };
    
  } catch (error) {
    console.error('Error during preview:', error);
    return {
      success: false,
      error: error.message
    };
  }
}