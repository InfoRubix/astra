import { collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

// Initial leave types configuration
const initialLeaveTypes = [
  {
    name: 'annual',
    label: 'Annual Leave',
    defaultQuota: 14,
    color: 'primary',
    description: 'Vacation and personal time off',
    isActive: true,
    order: 1
  },
  {
    name: 'sick',
    label: 'Sick Leave',
    defaultQuota: 14,
    color: 'warning',
    description: 'Medical leave for illness or medical appointments',
    isActive: true,
    order: 2
  },
  {
    name: 'emergency',
    label: 'Emergency Leave',
    defaultQuota: 3,
    color: 'error',
    description: 'Urgent personal or family emergencies',
    isActive: true,
    order: 3
  },
  {
    name: 'maternity',
    label: 'Maternity Leave',
    defaultQuota: 90,
    color: 'info',
    description: 'Maternity and paternity leave',
    isActive: true,
    order: 4
  }
];

/**
 * Initialize leave types in Firestore
 * This should be called once to seed the initial data
 */
export const initializeLeaveTypes = async () => {
  try {
    console.log('🔄 Initializing leave types...');
    
    // Check if leave types already exist
    const existingQuery = query(collection(db, 'leaveTypes'));
    const existingSnapshot = await getDocs(existingQuery);
    
    if (!existingSnapshot.empty) {
      console.log('✅ Leave types already exist, skipping initialization');
      return { success: true, message: 'Leave types already initialized' };
    }
    
    // Create initial leave types
    const results = [];
    for (const leaveType of initialLeaveTypes) {
      const docRef = await addDoc(collection(db, 'leaveTypes'), {
        ...leaveType,
        createdAt: serverTimestamp(),
        createdBy: 'system-migration'
      });
      
      results.push({
        id: docRef.id,
        name: leaveType.name,
        label: leaveType.label
      });
      
      console.log(`✅ Created leave type: ${leaveType.label} (${docRef.id})`);
    }
    
    console.log('🎉 Leave types initialization completed successfully');
    return { 
      success: true, 
      message: `Successfully created ${results.length} leave types`,
      results 
    };
    
  } catch (error) {
    console.error('❌ Error initializing leave types:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
};

/**
 * Load all active leave types from Firestore
 */
export const loadLeaveTypes = async () => {
  try {
    const q = query(
      collection(db, 'leaveTypes'),
      where('isActive', '==', true)
    );
    
    const querySnapshot = await getDocs(q);
    const leaveTypes = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Sort by order field
    leaveTypes.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    return leaveTypes;
  } catch (error) {
    console.error('Error loading leave types:', error);
    throw error;
  }
};

/**
 * Get default quota configuration from leave types
 */
export const getDefaultQuotaConfig = async () => {
  try {
    const leaveTypes = await loadLeaveTypes();
    const config = {};
    
    leaveTypes.forEach(type => {
      config[type.name] = type.defaultQuota || 0;
    });
    
    return config;
  } catch (error) {
    console.error('Error getting default quota config:', error);
    // Fallback to hardcoded values
    return {
      annual: 14,
      sick: 14,
      emergency: 3,
      maternity: 90
    };
  }
};