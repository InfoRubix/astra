import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { getSalaryTemplateByPosition, getSalaryTemplateByPositionAndExperience } from './salaryTemplates';

/**
 * Employee Salary Override Management
 * Handles individual salary adjustments while maintaining template-based system
 */

/**
 * Get salary override for a specific employee
 */
export const getEmployeeSalaryOverride = async (employeeId) => {
  try {
    const q = query(
      collection(db, 'employeeSalaryOverrides'),
      where('employeeId', '==', employeeId),
      where('isActive', '==', true)
    );
    
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting employee salary override:', error);
    return null;
  }
};

/**
 * Create or update salary override for employee
 */
export const saveEmployeeSalaryOverride = async (employeeId, overrideData, reason, createdBy) => {
  try {
    // Check if override already exists
    const existingOverride = await getEmployeeSalaryOverride(employeeId);
    
    const data = {
      employeeId,
      overrides: overrideData,
      reason: reason || 'Manual adjustment',
      updatedAt: serverTimestamp(),
      updatedBy: createdBy.uid,
      updatedByName: `${createdBy.firstName} ${createdBy.lastName}`,
      isActive: true
    };
    
    if (existingOverride) {
      // Update existing override
      await updateDoc(doc(db, 'employeeSalaryOverrides', existingOverride.id), data);
      return { success: true, id: existingOverride.id, action: 'updated' };
    } else {
      // Create new override
      data.createdAt = serverTimestamp();
      data.createdBy = createdBy.uid;
      data.createdByName = `${createdBy.firstName} ${createdBy.lastName}`;
      
      const docRef = await addDoc(collection(db, 'employeeSalaryOverrides'), data);
      return { success: true, id: docRef.id, action: 'created' };
    }
  } catch (error) {
    console.error('Error saving employee salary override:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete salary override for employee
 */
export const deleteEmployeeSalaryOverride = async (employeeId) => {
  try {
    const override = await getEmployeeSalaryOverride(employeeId);
    if (override) {
      await deleteDoc(doc(db, 'employeeSalaryOverrides', override.id));
      return { success: true };
    }
    return { success: false, error: 'No override found' };
  } catch (error) {
    console.error('Error deleting employee salary override:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Enhanced salary calculation with overrides support
 * Priority: Individual Override > Experience Template > Position Template > Default
 */
export const calculateEmployeeSalary = async (employee, baseHours = 160, calculationMethod = 'fixed') => {
  try {
    console.log('🧮 Calculating salary for employee:', employee.firstName, employee.lastName);
    
    // 1. Check for individual salary override (highest priority)
    const salaryOverride = await getEmployeeSalaryOverride(employee.id);
    
    // 2. Get base template (experience-aware or position-only)
    let baseTemplate = null;
    if (employee.position && employee.experienceLevel) {
      baseTemplate = await getSalaryTemplateByPositionAndExperience(employee.position, employee.experienceLevel);
      console.log('📋 Experience-based template found:', baseTemplate?.position, baseTemplate?.experienceLevel);
    }
    
    if (!baseTemplate && employee.position) {
      baseTemplate = await getSalaryTemplateByPosition(employee.position);
      console.log('📋 Position-only template found:', baseTemplate?.position);
    }
    
    if (!baseTemplate) {
      console.log('⚠️ No template found, using defaults');
      baseTemplate = {
        position: employee.position || 'General',
        baseSalary: 3000,
        hourlyRate: 20,
        allowances: {},
        experienceLevel: employee.experienceLevel || 'entry'
      };
    }
    
    // 3. Apply overrides if they exist
    let finalSalaryData = { ...baseTemplate };
    let salarySource = 'template';
    
    if (salaryOverride && salaryOverride.overrides) {
      console.log('🔧 Applying salary overrides:', salaryOverride.overrides);
      
      // Override specific fields
      if (salaryOverride.overrides.baseSalary !== undefined) {
        finalSalaryData.baseSalary = salaryOverride.overrides.baseSalary;
      }
      if (salaryOverride.overrides.hourlyRate !== undefined) {
        finalSalaryData.hourlyRate = salaryOverride.overrides.hourlyRate;
      }
      if (salaryOverride.overrides.allowances) {
        finalSalaryData.allowances = {
          ...finalSalaryData.allowances,
          ...salaryOverride.overrides.allowances
        };
      }
      
      salarySource = 'override';
    }
    
    // 4. Calculate final salary values
    const totalAllowances = Object.values(finalSalaryData.allowances || {}).reduce((sum, amount) => {
      return sum + (typeof amount === 'number' ? amount : parseFloat(amount) || 0);
    }, 0);
    
    let basicSalary = 0;
    if (calculationMethod === 'hourly') {
      basicSalary = baseHours * finalSalaryData.hourlyRate;
    } else {
      basicSalary = finalSalaryData.baseSalary;
    }
    
    const grossSalary = basicSalary + totalAllowances;
    
    // Basic deductions (simplified)
    const epfEmployee = grossSalary * 0.11;
    const socso = Math.min(grossSalary * 0.005, 19.75);
    const basicDeductions = epfEmployee + socso;
    
    const netSalary = grossSalary - basicDeductions;
    
    console.log('💰 Salary calculation complete:', {
      source: salarySource,
      basicSalary: basicSalary.toFixed(2),
      totalAllowances: totalAllowances.toFixed(2),
      grossSalary: grossSalary.toFixed(2),
      netSalary: netSalary.toFixed(2)
    });
    
    return {
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      employeeEmail: employee.email,
      position: employee.position || finalSalaryData.position,
      experienceLevel: employee.experienceLevel || finalSalaryData.experienceLevel,
      calculationMethod,
      basicSalary: parseFloat(basicSalary.toFixed(2)),
      allowances: parseFloat(totalAllowances.toFixed(2)),
      deductions: parseFloat(basicDeductions.toFixed(2)),
      grossSalary: parseFloat(grossSalary.toFixed(2)),
      netSalary: parseFloat(netSalary.toFixed(2)),
      hourlyRate: finalSalaryData.hourlyRate,
      hoursWorked: calculationMethod === 'hourly' ? baseHours : null,
      
      // Metadata
      salarySource, // 'template' or 'override'
      templateUsed: baseTemplate?.id || null,
      overrideUsed: salaryOverride?.id || null,
      allowanceBreakdown: finalSalaryData.allowances || {},
      
      // Raw data for editing
      templateData: baseTemplate,
      overrideData: salaryOverride?.overrides || null
    };
  } catch (error) {
    console.error('Error calculating employee salary:', error);
    throw error;
  }
};

/**
 * Get all salary overrides (for admin overview)
 */
export const loadAllSalaryOverrides = async () => {
  try {
    const q = query(
      collection(db, 'employeeSalaryOverrides'),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date()
    }));
  } catch (error) {
    console.error('Error loading salary overrides:', error);
    return [];
  }
};

/**
 * Generate comparison report between template and override
 */
export const generateSalaryComparisonReport = async (employee) => {
  try {
    // Get template-only calculation
    const templateCalculation = await calculateEmployeeSalary(employee);
    
    // Get current salary (with overrides)
    const actualCalculation = await calculateEmployeeSalary(employee);
    
    return {
      employee: {
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
        position: employee.position,
        experienceLevel: employee.experienceLevel
      },
      template: {
        basicSalary: templateCalculation.templateData?.baseSalary || 0,
        hourlyRate: templateCalculation.templateData?.hourlyRate || 0,
        allowances: templateCalculation.templateData?.allowances || {},
        grossSalary: templateCalculation.grossSalary,
        netSalary: templateCalculation.netSalary
      },
      actual: {
        basicSalary: actualCalculation.basicSalary,
        hourlyRate: actualCalculation.hourlyRate,
        allowances: actualCalculation.allowanceBreakdown,
        grossSalary: actualCalculation.grossSalary,
        netSalary: actualCalculation.netSalary
      },
      differences: {
        basicSalary: actualCalculation.basicSalary - (templateCalculation.templateData?.baseSalary || 0),
        grossSalary: actualCalculation.grossSalary - templateCalculation.grossSalary,
        netSalary: actualCalculation.netSalary - templateCalculation.netSalary
      },
      hasOverrides: actualCalculation.salarySource === 'override',
      overrideData: actualCalculation.overrideData
    };
  } catch (error) {
    console.error('Error generating salary comparison report:', error);
    throw error;
  }
};