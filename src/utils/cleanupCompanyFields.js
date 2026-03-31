import { collection, getDocs, doc, updateDoc, writeBatch, deleteField } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Cleanup script to consolidate company fields in users collection
 * This script will:
 * 1. Use originalCompanyName as the primary company field if it exists
 * 2. Remove the companyName field 
 * 3. Rename originalCompanyName to company
 */
export async function cleanupCompanyFields() {
  console.log('Starting company fields cleanup...');
  
  try {
    // Get all users
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`Found ${users.length} users to process`);
    
    const batch = writeBatch(db);
    let processedCount = 0;
    
    for (const user of users) {
      console.log(`Processing user: ${user.firstName} ${user.lastName}`);
      console.log(`Current companyName: ${user.companyName}`);
      console.log(`Current originalCompanyName: ${user.originalCompanyName}`);
      
      // Determine the correct company value
      let correctCompany;
      
      if (user.originalCompanyName) {
        // Use originalCompanyName as the primary source
        correctCompany = user.originalCompanyName;
      } else if (user.companyName) {
        // Fallback to companyName if originalCompanyName doesn't exist
        correctCompany = user.companyName;
      } else {
        // Default company if neither exists
        correctCompany = 'RUBIX';
      }
      
      console.log(`Setting company to: ${correctCompany}`);
      
      // Update document to have single 'originalCompanyName' field
      const userRef = doc(db, 'users', user.id);
      const updateData = {
        originalCompanyName: correctCompany
      };
      
      // Remove old fields using deleteField() - only if they exist
      if (user.hasOwnProperty('companyName') && user.companyName !== null) {
        updateData.companyName = deleteField();
      }
      if (user.hasOwnProperty('company') && user.company !== null) {
        updateData.company = deleteField();
      }
      
      batch.update(userRef, updateData);
      processedCount++;
      
      // Commit batch every 100 operations (Firestore limit is 500)
      if (processedCount % 100 === 0) {
        console.log(`Committing batch for ${processedCount} users...`);
        await batch.commit();
        // Create new batch for remaining operations
        const newBatch = writeBatch(db);
        batch = newBatch;
      }
    }
    
    // Commit remaining operations
    if (processedCount % 100 !== 0) {
      console.log(`Committing final batch...`);
      await batch.commit();
    }
    
    console.log(`✅ Successfully processed ${processedCount} users`);
    console.log('Company fields cleanup completed!');
    
    return {
      success: true,
      processedCount,
      message: `Successfully cleaned up company fields for ${processedCount} users`
    };
    
  } catch (error) {
    console.error('❌ Error during company fields cleanup:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Preview what the cleanup would do without making changes
 */
export async function previewCompanyFieldsCleanup() {
  console.log('Previewing company fields cleanup...');
  
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`Found ${users.length} users`);
    console.log('\nPreview of changes:');
    console.log('=====================================');
    
    const changes = [];
    
    for (const user of users) {
      let correctCompany;
      
      if (user.originalCompanyName) {
        correctCompany = user.originalCompanyName;
      } else if (user.companyName) {
        correctCompany = user.companyName;
      } else {
        correctCompany = 'RUBIX';
      }
      
      const change = {
        user: `${user.firstName} ${user.lastName}`,
        currentCompanyName: user.companyName || 'none',
        currentOriginalCompanyName: user.originalCompanyName || 'none',
        newCompany: correctCompany
      };
      
      changes.push(change);
      
      console.log(`User: ${change.user}`);
      console.log(`  companyName: ${change.currentCompanyName} → will be removed`);
      console.log(`  originalCompanyName: ${change.currentOriginalCompanyName} → will be removed`);
      console.log(`  company: ${change.newCompany} (new field)`);
      console.log('---');
    }
    
    return {
      success: true,
      changes,
      totalUsers: users.length
    };
    
  } catch (error) {
    console.error('Error during preview:', error);
    return {
      success: false,
      error: error.message
    };
  }
}