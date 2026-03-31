/**
 * Migration Script: Add company field to old forgotten checkout records
 *
 * This script updates all forgotten checkout records that are missing the company field
 * by fetching the user's current company from the users collection.
 *
 * Run this script once to fix old records.
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateForgottenCheckouts() {
  console.log('Starting migration of forgotten checkout records...\n');

  try {
    // Step 1: Get all users (to lookup company info)
    console.log('Step 1: Loading all users...');
    const usersSnapshot = await db.collection('users').get();
    const usersMap = {};

    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      usersMap[doc.id] = {
        company: userData.company || userData.originalCompanyName || 'Unknown',
        firstName: userData.firstName || 'Unknown',
        lastName: userData.lastName || 'User',
        position: userData.position || 'N/A',
        department: userData.department || 'N/A'
      };
    });

    console.log(`✓ Loaded ${Object.keys(usersMap).length} users\n`);

    // Step 2: Get all forgotten checkout records
    console.log('Step 2: Loading all forgotten checkout records...');
    const checkoutsSnapshot = await db.collection('forgottenCheckouts').get();
    console.log(`✓ Found ${checkoutsSnapshot.size} forgotten checkout records\n`);

    // Step 3: Find records missing company field
    console.log('Step 3: Identifying records that need updating...');
    const recordsToUpdate = [];

    checkoutsSnapshot.forEach(doc => {
      const data = doc.data();

      // Check if company field is missing or empty
      if (!data.company || data.company.trim() === '') {
        recordsToUpdate.push({
          id: doc.id,
          userId: data.userId,
          status: data.status || 'unknown',
          date: data.date,
          currentData: data
        });
      }
    });

    console.log(`✓ Found ${recordsToUpdate.length} records that need updating\n`);

    if (recordsToUpdate.length === 0) {
      console.log('✓ All records already have company field. Nothing to update.');
      return;
    }

    // Step 4: Update each record
    console.log('Step 4: Updating records...\n');
    let successCount = 0;
    let errorCount = 0;
    let notFoundCount = 0;

    for (const record of recordsToUpdate) {
      const userInfo = usersMap[record.userId];

      if (!userInfo) {
        console.log(`⚠ Warning: User not found for checkout ID: ${record.id} (userId: ${record.userId})`);
        notFoundCount++;
        continue;
      }

      try {
        // Update the document with company and additional user info
        await db.collection('forgottenCheckouts').doc(record.id).update({
          company: userInfo.company,
          userPosition: userInfo.position,
          userDepartment: userInfo.department,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          migrated: true,
          migrationDate: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`✓ Updated checkout ID: ${record.id}`);
        console.log(`  User: ${userInfo.firstName} ${userInfo.lastName}`);
        console.log(`  Company: ${userInfo.company}`);
        console.log(`  Status: ${record.status}`);
        console.log('');

        successCount++;
      } catch (error) {
        console.error(`✗ Error updating checkout ID: ${record.id}`);
        console.error(`  Error: ${error.message}\n`);
        errorCount++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total records processed: ${recordsToUpdate.length}`);
    console.log(`✓ Successfully updated: ${successCount}`);
    if (notFoundCount > 0) {
      console.log(`⚠ User not found: ${notFoundCount}`);
    }
    if (errorCount > 0) {
      console.log(`✗ Failed: ${errorCount}`);
    }
    console.log('='.repeat(60) + '\n');

    if (successCount > 0) {
      console.log('✓ Migration completed successfully!');
      console.log('  Old forgotten checkout records now have company information.');
      console.log('  They should now appear for General Managers to review.\n');
    }

  } catch (error) {
    console.error('✗ Migration failed with error:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the migration
migrateForgottenCheckouts();
