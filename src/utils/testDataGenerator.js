import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Test Data Generator for Attendance System
 * This utility helps create test attendance records for debugging
 */
export const testDataGenerator = {
  
  /**
   * Create a test attendance record with incomplete checkout
   */
  async createIncompleteAttendanceRecord(userId, userEmail, userName, company, department) {
    try {
      console.log('🧪 Creating test incomplete attendance record...');
      
      // Create a record from yesterday with no checkout
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateString = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Set check-in time to 9 AM yesterday
      const checkInTime = new Date(yesterday);
      checkInTime.setHours(9, 0, 0, 0);
      
      const testRecord = {
        userId,
        userEmail,
        userName,
        company,
        department,
        date: dateString,
        dateString: dateString,
        checkInTime: serverTimestamp(),
        checkOutTime: null, // This makes it incomplete
        status: 'present',
        workingHours: 0,
        overtimeHours: 0,
        notes: 'Test record - forgot to check out',
        location: 'Test Office',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'attendance'), testRecord);
      console.log('✅ Test incomplete attendance record created:', docRef.id);
      
      return {
        success: true,
        recordId: docRef.id,
        message: 'Test incomplete attendance record created successfully'
      };
      
    } catch (error) {
      console.error('❌ Error creating test data:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  /**
   * Create multiple test records for different scenarios
   */
  async createTestScenarios(userId, userEmail, userName, company, department) {
    try {
      console.log('🧪 Creating multiple test scenarios...');
      
      const scenarios = [];
      
      // Scenario 1: Yesterday - forgot to check out
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      scenarios.push({
        userId,
        userEmail,
        userName,
        company,
        department,
        date: yesterday.toISOString().split('T')[0],
        dateString: yesterday.toISOString().split('T')[0],
        checkInTime: serverTimestamp(),
        checkOutTime: null,
        status: 'present',
        workingHours: 0,
        overtimeHours: 0,
        notes: 'Forgot to check out yesterday',
        location: 'Main Office',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Scenario 2: Two days ago - forgot to check out
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      
      scenarios.push({
        userId,
        userEmail,
        userName,
        company,
        department,
        date: twoDaysAgo.toISOString().split('T')[0],
        dateString: twoDaysAgo.toISOString().split('T')[0],
        checkInTime: serverTimestamp(),
        checkOutTime: null,
        status: 'present',
        workingHours: 0,
        overtimeHours: 0,
        notes: 'Forgot to check out - emergency call',
        location: 'Remote',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Scenario 3: Complete record (should not appear in forgotten checkouts)
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      scenarios.push({
        userId,
        userEmail,
        userName,
        company,
        department,
        date: threeDaysAgo.toISOString().split('T')[0],
        dateString: threeDaysAgo.toISOString().split('T')[0],
        checkInTime: serverTimestamp(),
        checkOutTime: serverTimestamp(), // Complete record
        status: 'present',
        workingHours: 8.5,
        overtimeHours: 0.5,
        notes: 'Complete workday',
        location: 'Main Office',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      const createdRecords = [];
      
      for (const scenario of scenarios) {
        const docRef = await addDoc(collection(db, 'attendance'), scenario);
        createdRecords.push({
          id: docRef.id,
          type: scenario.checkOutTime ? 'complete' : 'incomplete',
          date: scenario.date
        });
      }
      
      console.log('✅ Test scenarios created:', createdRecords);
      
      return {
        success: true,
        records: createdRecords,
        message: `Created ${createdRecords.length} test attendance records`
      };
      
    } catch (error) {
      console.error('❌ Error creating test scenarios:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  /**
   * Check existing data for debugging
   */
  async debugAttendanceData(userId) {
    try {
      console.log('🔍 Debugging attendance data for user:', userId);
      
      const { getDocs, query, where } = await import('firebase/firestore');
      
      // Get all attendance records for user
      const q = query(
        collection(db, 'attendance'),
        where('userId', '==', userId)
      );
      
      const querySnapshot = await getDocs(q);
      const records = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('📊 Total attendance records for user:', records.length);
      
      records.forEach((record, index) => {
        console.log(`📋 Record ${index + 1}:`, {
          id: record.id,
          date: record.date,
          dateString: record.dateString,
          hasCheckIn: !!record.checkInTime,
          hasCheckOut: !!record.checkOutTime,
          isIncomplete: !!record.checkInTime && !record.checkOutTime,
          status: record.status,
          allFields: Object.keys(record)
        });
      });
      
      const incompleteRecords = records.filter(r => !!r.checkInTime && !r.checkOutTime);
      console.log('⚠️ Incomplete records found:', incompleteRecords.length);
      
      return {
        total: records.length,
        incomplete: incompleteRecords.length,
        records: records
      };
      
    } catch (error) {
      console.error('❌ Error debugging data:', error);
      return {
        error: error.message
      };
    }
  }
};

// Export for use in browser console
if (typeof window !== 'undefined') {
  window.testDataGenerator = testDataGenerator;
}