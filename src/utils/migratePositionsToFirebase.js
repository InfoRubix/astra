/**
 * Migration Script: Sync Predefined Positions to Firebase
 *
 * This script syncs the hardcoded positions from positionHierarchy.js
 * to the Firebase 'positions' collection so they can be managed through the UI.
 *
 * Run this once to populate the database with predefined positions.
 */

import { collection, query, where, getDocs, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { COMPANY_POSITIONS } from './positionHierarchy';

/**
 * Sync predefined positions to Firebase
 * @param {string} userId - The ID of the user performing the migration
 * @param {string} userName - The name of the user performing the migration
 * @returns {Promise<Object>} Migration results
 */
export const migratePositionsToFirebase = async (userId, userName) => {
  console.log('🔄 Starting position migration to Firebase...');

  const results = {
    totalProcessed: 0,
    added: 0,
    skipped: 0,
    errors: [],
    positions: []
  };

  try {
    // Process each company
    for (const [companyName, levels] of Object.entries(COMPANY_POSITIONS)) {
      console.log(`📋 Processing positions for company: ${companyName}`);

      // Check existing positions for this company
      const existingPositionsQuery = query(
        collection(db, 'positions'),
        where('companyName', '==', companyName)
      );
      const existingSnapshot = await getDocs(existingPositionsQuery);

      // Create a map of existing positions
      const existingPositions = new Map();
      existingSnapshot.docs.forEach(doc => {
        const data = doc.data();
        existingPositions.set(data.positionName, {
          id: doc.id,
          ...data
        });
      });

      // Process each level and its positions
      for (const [level, positions] of Object.entries(levels)) {
        for (const positionName of positions) {
          results.totalProcessed++;

          try {
            // Check if position already exists
            if (existingPositions.has(positionName)) {
              console.log(`⏭️  Skipping existing position: ${positionName} (${companyName})`);
              results.skipped++;
              continue;
            }

            // Create new position document
            const positionData = {
              positionName: positionName,
              companyName: companyName,
              level: parseInt(level),
              isPredefined: true, // Mark as predefined
              isCustom: false,
              isDeleted: false,
              createdAt: serverTimestamp(),
              createdBy: userId,
              createdByName: userName,
              source: 'migration',
              description: `Level ${level} position - ${getPositionLevelName(parseInt(level))}`
            };

            // Use positionName + companyName as document ID for consistency
            const docId = `${companyName}_${positionName}`.replace(/[^a-zA-Z0-9_]/g, '_');
            await setDoc(doc(db, 'positions', docId), positionData);

            console.log(`✅ Added position: ${positionName} (${companyName}, Level ${level})`);
            results.added++;
            results.positions.push({
              name: positionName,
              company: companyName,
              level: parseInt(level)
            });

          } catch (error) {
            console.error(`❌ Error adding position ${positionName}:`, error);
            results.errors.push({
              position: positionName,
              company: companyName,
              error: error.message
            });
          }
        }
      }
    }

    // Add system-level positions (available for all companies)
    console.log('📋 Processing system-level positions...');
    const systemPositions = [
      { name: 'Admin', level: -1 },
      { name: 'System Administrator', level: -1 },
      { name: 'Super Admin', level: -1 }
    ];

    for (const sysPos of systemPositions) {
      results.totalProcessed++;

      try {
        // Check if system position already exists (company-agnostic)
        const sysQuery = query(
          collection(db, 'positions'),
          where('positionName', '==', sysPos.name),
          where('level', '==', -1)
        );
        const sysSnapshot = await getDocs(sysQuery);

        if (!sysSnapshot.empty) {
          console.log(`⏭️  Skipping existing system position: ${sysPos.name}`);
          results.skipped++;
          continue;
        }

        // Create system position (applies to all companies)
        const sysPositionData = {
          positionName: sysPos.name,
          companyName: 'SYSTEM', // System-wide position
          level: -1,
          isPredefined: true,
          isCustom: false,
          isDeleted: false,
          isSystemPosition: true, // Flag for system-level positions
          createdAt: serverTimestamp(),
          createdBy: userId,
          createdByName: userName,
          source: 'migration',
          description: 'System-level position with cross-company authority'
        };

        const docId = `SYSTEM_${sysPos.name}`.replace(/[^a-zA-Z0-9_]/g, '_');
        await setDoc(doc(db, 'positions', docId), sysPositionData);

        console.log(`✅ Added system position: ${sysPos.name}`);
        results.added++;
        results.positions.push({
          name: sysPos.name,
          company: 'SYSTEM',
          level: -1
        });

      } catch (error) {
        console.error(`❌ Error adding system position ${sysPos.name}:`, error);
        results.errors.push({
          position: sysPos.name,
          company: 'SYSTEM',
          error: error.message
        });
      }
    }

    console.log('✅ Migration completed!');
    console.log(`📊 Results: ${results.added} added, ${results.skipped} skipped, ${results.errors.length} errors`);

    return results;

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

/**
 * Helper function to get position level name
 */
const getPositionLevelName = (level) => {
  const levelNames = {
    '-1': 'System Administrator',
    0: 'Top Management',
    1: 'Manager/Department Head',
    2: 'Senior/Supervisor',
    3: 'Staff/Executive'
  };
  return levelNames[level] || 'Unknown';
};

/**
 * Check migration status
 */
export const checkMigrationStatus = async () => {
  try {
    const positionsSnapshot = await getDocs(collection(db, 'positions'));
    const migratedPositions = positionsSnapshot.docs.filter(
      doc => doc.data().source === 'migration'
    );

    return {
      totalPositions: positionsSnapshot.size,
      migratedPositions: migratedPositions.length,
      needsMigration: migratedPositions.length === 0
    };
  } catch (error) {
    console.error('Error checking migration status:', error);
    return null;
  }
};
