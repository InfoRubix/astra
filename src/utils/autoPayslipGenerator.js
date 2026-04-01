import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  serverTimestamp,
  doc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { format, getYear, getMonth } from 'date-fns';

/**
 * Auto-generate draft payslips for all employees on the 3rd of each month
 * This function should be called via a scheduled task or cron job
 */
export const generateMonthlyPayslips = async () => {
  const currentDate = new Date();
  const currentDay = currentDate.getDate();
  
  // Only run on the 3rd of the month
  if (currentDay !== 3) {
    console.log('Not the 3rd of the month, skipping payslip generation');
    return { success: false, message: 'Not scheduled day' };
  }

  try {
    console.log('🔄 Starting monthly payslip generation...');
    
    // Get all active employees (users with role 'user' or 'employee')
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

    // Get previous month's date for payslip
    const payslipDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const payslipMonth = format(payslipDate, 'yyyy-MM');

    console.log(`📅 Generating payslips for: ${payslipMonth}`);

    // Check for existing payslips for this month to avoid duplicates
    const existingPayslipsQuery = query(
      collection(db, 'payslips'),
      where('month', '==', payslipMonth)
    );
    const existingPayslipsSnapshot = await getDocs(existingPayslipsQuery);
    const existingEmployeeIds = new Set(
      existingPayslipsSnapshot.docs.map(doc => doc.data().employeeId)
    );

    const results = {
      created: 0,
      skipped: 0,
      errors: 0,
      details: []
    };

    // Generate payslips for each employee
    for (const employee of employees) {
      try {
        // Skip if payslip already exists for this employee and month
        if (existingEmployeeIds.has(employee.id)) {
          console.log(`⏭️ Skipping ${employee.firstName} ${employee.lastName} - payslip already exists`);
          results.skipped++;
          results.details.push({
            employeeId: employee.id,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            status: 'skipped',
            reason: 'Payslip already exists'
          });
          continue;
        }

        // Get salary data from employee record
        const salaryData = employee.salary || {};
        
        // Use default values if no salary data exists
        const basicSalary = salaryData.basicSalary || (salaryData.hourlyRate ? salaryData.hourlyRate * 160 : 4000);
        const allowances = salaryData.allowances || 0;
        const hourlyRate = salaryData.hourlyRate || 25;
        
        // Calculate gross and net salary (basic calculation)
        const grossSalary = basicSalary + allowances;
        const employeeEPF = grossSalary * 0.11;
        const employeeEIS = Math.min(grossSalary * 0.002, 4.15);
        const employeeSOCSO = Math.min(grossSalary * 0.005, 19.75);
        const totalDeductions = employeeEPF + employeeEIS + employeeSOCSO;
        const netSalary = grossSalary - totalDeductions;

        // Create payslip data
        const payslipData = {
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          employeeEmail: employee.email,
          month: payslipMonth,
          calculationMethod: salaryData.hourlyRate ? 'hourly' : 'fixed',
          hoursWorked: salaryData.hourlyRate ? 160 : null,
          hourlyRate: salaryData.hourlyRate || null,
          basicSalary: basicSalary,
          allowances: allowances,
          overtime: 0,
          bonus: 0,
          grossSalary: grossSalary,
          netSalary: netSalary,
          status: 'draft',
          company: employee.originalCompanyName || employee.company || '',
          
          // Detailed breakdown
          employeeEPF: employeeEPF,
          employeeEIS: employeeEIS,
          employeeSOCSO: employeeSOCSO,
          employerEPF: grossSalary * 0.12,
          employerEIS: Math.min(grossSalary * 0.002, 4.15),
          employerSOCSO: Math.min(grossSalary * 0.014, 67.75),
          zakat: 0,
          mtdPCB: 0,
          
          // Other deductions (default to 0)
          loanDeduction: 0,
          insurance: 0,
          advanceSalary: 0,
          uniformEquipment: 0,
          disciplinaryFine: 0,
          otherMisc: 0,
          
          autoCalculate: true,
          dataSource: 'auto-generated',
          generatedBy: 'system',
          generatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        // Add payslip to database
        await addDoc(collection(db, 'payslips'), payslipData);
        
        console.log(`✅ Created payslip for ${employee.firstName} ${employee.lastName}`);
        results.created++;
        results.details.push({
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          status: 'created',
          basicSalary: basicSalary,
          netSalary: netSalary
        });

      } catch (error) {
        console.error(`❌ Error creating payslip for ${employee.firstName} ${employee.lastName}:`, error);
        results.errors++;
        results.details.push({
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          status: 'error',
          error: error.message
        });
      }
    }

    console.log('📈 Payslip generation completed:', results);

    return {
      success: true,
      month: payslipMonth,
      ...results
    };

  } catch (error) {
    console.error('❌ Error in monthly payslip generation:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Initialize salary data for an employee
 * This can be used to add salary fields to existing users
 */
export const initializeEmployeeSalary = async (employeeId, salaryData) => {
  try {
    const employeeRef = doc(db, 'users', employeeId);
    
    const salaryFields = {
      salary: {
        basicSalary: salaryData.basicSalary || null,
        hourlyRate: salaryData.hourlyRate || null,
        allowances: salaryData.allowances || 0,
        overtimeMultiplier: salaryData.overtimeMultiplier || 1.5,
        currency: 'MYR',
        effectiveDate: serverTimestamp(),
        lastUpdated: serverTimestamp()
      }
    };

    await updateDoc(employeeRef, salaryFields);
    
    console.log(`✅ Initialized salary data for employee ${employeeId}`);
    return { success: true };

  } catch (error) {
    console.error(`❌ Error initializing salary data for employee ${employeeId}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Update salary data for an employee
 */
export const updateEmployeeSalary = async (employeeId, salaryData) => {
  try {
    const employeeRef = doc(db, 'users', employeeId);
    
    const salaryFields = {
      'salary.basicSalary': salaryData.basicSalary || null,
      'salary.hourlyRate': salaryData.hourlyRate || null,
      'salary.allowances': salaryData.allowances || 0,
      'salary.overtimeMultiplier': salaryData.overtimeMultiplier || 1.5,
      'salary.lastUpdated': serverTimestamp()
    };

    await updateDoc(employeeRef, salaryFields);
    
    console.log(`✅ Updated salary data for employee ${employeeId}`);
    return { success: true };

  } catch (error) {
    console.error(`❌ Error updating salary data for employee ${employeeId}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Get salary data for an employee
 */
export const getEmployeeSalary = async (employeeId) => {
  try {
    const employeeDoc = await getDocs(query(
      collection(db, 'users'),
      where('__name__', '==', employeeId)
    ));

    if (employeeDoc.empty) {
      return { success: false, error: 'Employee not found' };
    }

    const employeeData = employeeDoc.docs[0].data();
    return {
      success: true,
      salary: employeeData.salary || null
    };

  } catch (error) {
    console.error(`❌ Error getting salary data for employee ${employeeId}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if today is the 3rd of the month and run auto-generation
 * This function can be called from anywhere in the app
 */
export const checkAndRunAutoGeneration = async () => {
  const currentDate = new Date();
  const currentDay = currentDate.getDate();
  
  if (currentDay === 3) {
    console.log('🎯 It\'s the 3rd of the month - running auto payslip generation');
    return await generateMonthlyPayslips();
  }
  
  return { success: false, message: 'Not the 3rd of the month' };
};

/**
 * Manually trigger payslip generation (for testing or manual run)
 */
export const manualPayslipGeneration = async (targetMonth = null) => {
  try {
    console.log('🔧 Manual payslip generation triggered');
    
    // Get all active employees
    const usersQuery = query(
      collection(db, 'users'),
      where('role', 'in', ['user', 'employee'])
    );
    
    const usersSnapshot = await getDocs(usersQuery);
    const employees = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Use provided month or current month
    const payslipMonth = targetMonth || format(new Date(), 'yyyy-MM');
    
    console.log(`📅 Generating payslips for: ${payslipMonth} (${employees.length} employees)`);

    const results = {
      created: 0,
      errors: 0,
      details: []
    };

    for (const employee of employees) {
      try {
        const salaryData = employee.salary || {};
        const basicSalary = salaryData.basicSalary || (salaryData.hourlyRate ? salaryData.hourlyRate * 160 : 4000);
        const allowances = salaryData.allowances || 0;
        const grossSalary = basicSalary + allowances;
        const employeeEPF = grossSalary * 0.11;
        const employeeEIS = Math.min(grossSalary * 0.002, 4.15);
        const employeeSOCSO = Math.min(grossSalary * 0.005, 19.75);
        const netSalary = grossSalary - (employeeEPF + employeeEIS + employeeSOCSO);

        const payslipData = {
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          employeeEmail: employee.email,
          month: payslipMonth,
          calculationMethod: salaryData.hourlyRate ? 'hourly' : 'fixed',
          hoursWorked: salaryData.hourlyRate ? 160 : null,
          hourlyRate: salaryData.hourlyRate || null,
          basicSalary: basicSalary,
          allowances: allowances,
          overtime: 0,
          bonus: 0,
          grossSalary: grossSalary,
          netSalary: netSalary,
          status: 'draft',
          company: employee.originalCompanyName || employee.company || '',
          employeeEPF: employeeEPF,
          employeeEIS: employeeEIS,
          employeeSOCSO: employeeSOCSO,
          employerEPF: grossSalary * 0.12,
          employerEIS: Math.min(grossSalary * 0.002, 4.15),
          employerSOCSO: Math.min(grossSalary * 0.014, 67.75),
          zakat: 0,
          mtdPCB: 0,
          loanDeduction: 0,
          insurance: 0,
          advanceSalary: 0,
          uniformEquipment: 0,
          disciplinaryFine: 0,
          otherMisc: 0,
          autoCalculate: true,
          dataSource: 'manual-generation',
          generatedBy: 'admin',
          generatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        await addDoc(collection(db, 'payslips'), payslipData);
        results.created++;
        results.details.push({
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          status: 'created'
        });

      } catch (error) {
        results.errors++;
        results.details.push({
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          status: 'error',
          error: error.message
        });
      }
    }

    return {
      success: true,
      month: payslipMonth,
      ...results
    };

  } catch (error) {
    console.error('❌ Error in manual payslip generation:', error);
    return { success: false, error: error.message };
  }
};