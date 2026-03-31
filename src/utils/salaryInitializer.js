import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../services/firebase';

/**
 * Initialize salary data for all employees who don't have it yet
 * This helps migrate existing users to the new salary system
 */
export const initializeAllEmployeeSalaries = async () => {
  try {
    console.log('🔄 Starting salary initialization for all employees...');
    
    // Get all employees (users with role 'user' or 'employee')
    const usersQuery = query(
      collection(db, 'users'),
      where('role', 'in', ['user', 'employee'])
    );
    
    const usersSnapshot = await getDocs(usersQuery);
    const employees = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`📊 Found ${employees.length} employees to process`);

    const results = {
      initialized: 0,
      skipped: 0,
      errors: 0,
      details: []
    };

    for (const employee of employees) {
      try {
        // Skip if employee already has salary data
        if (employee.salary && (employee.salary.basicSalary || employee.salary.hourlyRate)) {
          console.log(`⏭️ Skipping ${employee.firstName} ${employee.lastName} - salary data already exists`);
          results.skipped++;
          results.details.push({
            employeeId: employee.id,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            status: 'skipped',
            reason: 'Salary data already exists'
          });
          continue;
        }

        // Determine default salary based on position or set generic defaults
        let defaultSalary = getDefaultSalaryByPosition(employee.position);
        
        if (!defaultSalary) {
          // Generic defaults if position not found
          defaultSalary = {
            basicSalary: 4000,
            hourlyRate: 25,
            allowances: 300
          };
        }

        // Initialize salary data
        const salaryData = {
          salary: {
            basicSalary: defaultSalary.basicSalary,
            hourlyRate: defaultSalary.hourlyRate,
            allowances: defaultSalary.allowances,
            overtimeMultiplier: 1.5,
            currency: 'MYR',
            effectiveDate: serverTimestamp(),
            lastUpdated: serverTimestamp(),
            source: 'system-initialized'
          }
        };

        const employeeRef = doc(db, 'users', employee.id);
        await updateDoc(employeeRef, salaryData);
        
        console.log(`✅ Initialized salary for ${employee.firstName} ${employee.lastName}:`, defaultSalary);
        results.initialized++;
        results.details.push({
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          status: 'initialized',
          ...defaultSalary
        });

      } catch (error) {
        console.error(`❌ Error initializing salary for ${employee.firstName} ${employee.lastName}:`, error);
        results.errors++;
        results.details.push({
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          status: 'error',
          error: error.message
        });
      }
    }

    console.log('📈 Salary initialization completed:', results);
    return {
      success: true,
      ...results
    };

  } catch (error) {
    console.error('❌ Error in salary initialization:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get default salary based on employee position
 */
const getDefaultSalaryByPosition = (position) => {
  if (!position) return null;

  const positionLower = position.toLowerCase();
  
  // Software Development positions
  if (positionLower.includes('developer') || positionLower.includes('programmer')) {
    if (positionLower.includes('senior')) {
      return { basicSalary: 7000, hourlyRate: 43.75, allowances: 500 };
    } else if (positionLower.includes('junior')) {
      return { basicSalary: 3500, hourlyRate: 21.88, allowances: 300 };
    } else {
      return { basicSalary: 5000, hourlyRate: 31.25, allowances: 400 };
    }
  }

  // Management positions
  if (positionLower.includes('manager') || positionLower.includes('director') || positionLower.includes('lead')) {
    return { basicSalary: 8000, hourlyRate: 50, allowances: 600 };
  }

  // IT positions
  if (positionLower.includes('analyst') || positionLower.includes('engineer')) {
    if (positionLower.includes('senior')) {
      return { basicSalary: 6500, hourlyRate: 40.63, allowances: 450 };
    } else {
      return { basicSalary: 4500, hourlyRate: 28.13, allowances: 350 };
    }
  }

  // HR positions
  if (positionLower.includes('hr') || positionLower.includes('human resource')) {
    return { basicSalary: 4000, hourlyRate: 25, allowances: 300 };
  }

  // Finance positions
  if (positionLower.includes('accountant') || positionLower.includes('finance')) {
    return { basicSalary: 4500, hourlyRate: 28.13, allowances: 350 };
  }

  // Sales positions
  if (positionLower.includes('sales') || positionLower.includes('marketing')) {
    return { basicSalary: 3800, hourlyRate: 23.75, allowances: 400 };
  }

  // Support positions
  if (positionLower.includes('support') || positionLower.includes('assistant')) {
    return { basicSalary: 3200, hourlyRate: 20, allowances: 250 };
  }

  // Default fallback
  return { basicSalary: 4000, hourlyRate: 25, allowances: 300 };
};

/**
 * Update salary for a specific employee
 */
export const updateEmployeeSalaryData = async (employeeId, salaryData) => {
  try {
    const employeeRef = doc(db, 'users', employeeId);
    
    const updateData = {
      'salary.basicSalary': salaryData.basicSalary || null,
      'salary.hourlyRate': salaryData.hourlyRate || null,
      'salary.allowances': salaryData.allowances || 0,
      'salary.overtimeMultiplier': salaryData.overtimeMultiplier || 1.5,
      'salary.lastUpdated': serverTimestamp(),
      'salary.source': 'manual-update'
    };

    await updateDoc(employeeRef, updateData);
    
    console.log(`✅ Updated salary data for employee ${employeeId}`);
    return { success: true };

  } catch (error) {
    console.error(`❌ Error updating salary data for employee ${employeeId}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Bulk update salaries for multiple employees
 */
export const bulkUpdateSalaries = async (updates) => {
  try {
    console.log(`🔄 Starting bulk salary update for ${updates.length} employees...`);
    
    const results = {
      updated: 0,
      errors: 0,
      details: []
    };

    for (const update of updates) {
      try {
        const result = await updateEmployeeSalaryData(update.employeeId, update.salaryData);
        
        if (result.success) {
          results.updated++;
          results.details.push({
            employeeId: update.employeeId,
            status: 'updated'
          });
        } else {
          results.errors++;
          results.details.push({
            employeeId: update.employeeId,
            status: 'error',
            error: result.error
          });
        }
      } catch (error) {
        results.errors++;
        results.details.push({
          employeeId: update.employeeId,
          status: 'error',
          error: error.message
        });
      }
    }

    console.log('📈 Bulk salary update completed:', results);
    return {
      success: true,
      ...results
    };

  } catch (error) {
    console.error('❌ Error in bulk salary update:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get employees without salary data
 */
export const getEmployeesWithoutSalary = async () => {
  try {
    const usersQuery = query(
      collection(db, 'users'),
      where('role', 'in', ['user', 'employee'])
    );
    
    const usersSnapshot = await getDocs(usersQuery);
    const employees = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const employeesWithoutSalary = employees.filter(employee => 
      !employee.salary || (!employee.salary.basicSalary && !employee.salary.hourlyRate)
    );

    return {
      success: true,
      employees: employeesWithoutSalary,
      count: employeesWithoutSalary.length
    };

  } catch (error) {
    console.error('❌ Error getting employees without salary:', error);
    return {
      success: false,
      error: error.message
    };
  }
};