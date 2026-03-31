import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

// Default salary templates for common positions
const defaultSalaryTemplates = [
  {
    position: 'Junior Developer',
    baseSalary: 3500,
    hourlyRate: 20,
    allowances: {
      transport: 200,
      meal: 300,
      tech: 100
    },
    overtimeMultiplier: 1.5,
    category: 'IT',
    experienceLevel: 'entry',
    isActive: true
  },
  {
    position: 'Senior Developer',
    baseSalary: 6000,
    hourlyRate: 35,
    allowances: {
      transport: 300,
      meal: 400,
      tech: 200
    },
    overtimeMultiplier: 1.5,
    category: 'IT',
    experienceLevel: 'senior',
    isActive: true
  },
  {
    position: 'Project Manager',
    baseSalary: 7500,
    hourlyRate: 45,
    allowances: {
      transport: 400,
      meal: 500,
      management: 300
    },
    overtimeMultiplier: 1.5,
    category: 'Management',
    experienceLevel: 'senior',
    isActive: true
  },
  {
    position: 'HR Executive',
    baseSalary: 4000,
    hourlyRate: 25,
    allowances: {
      transport: 250,
      meal: 350
    },
    overtimeMultiplier: 1.5,
    category: 'HR',
    experienceLevel: 'mid',
    isActive: true
  },
  {
    position: 'Accountant',
    baseSalary: 4500,
    hourlyRate: 28,
    allowances: {
      transport: 250,
      meal: 350,
      professional: 150
    },
    overtimeMultiplier: 1.5,
    category: 'Finance',
    experienceLevel: 'mid',
    isActive: true
  },
  {
    position: 'Sales Executive',
    baseSalary: 3000,
    hourlyRate: 18,
    allowances: {
      transport: 300,
      meal: 300,
      commission: 0 // Commission calculated separately
    },
    overtimeMultiplier: 1.5,
    category: 'Sales',
    experienceLevel: 'entry',
    isActive: true
  },
  {
    position: 'Marketing Manager',
    baseSalary: 6500,
    hourlyRate: 40,
    allowances: {
      transport: 400,
      meal: 450,
      marketing: 200
    },
    overtimeMultiplier: 1.5,
    category: 'Marketing',
    experienceLevel: 'senior',
    isActive: true
  },
  {
    position: 'Customer Service',
    baseSalary: 2800,
    hourlyRate: 16,
    allowances: {
      transport: 200,
      meal: 250
    },
    overtimeMultiplier: 1.5,
    category: 'Support',
    experienceLevel: 'entry',
    isActive: true
  }
];

/**
 * Initialize salary templates in Firestore
 */
export const initializeSalaryTemplates = async () => {
  try {
    console.log('🔄 Initializing salary templates...');
    
    // Check if templates already exist
    const existingQuery = query(collection(db, 'salaryTemplates'));
    const existingSnapshot = await getDocs(existingQuery);
    
    if (!existingSnapshot.empty) {
      console.log('✅ Salary templates already exist, skipping initialization');
      return { success: true, message: 'Salary templates already initialized' };
    }
    
    // Create initial templates
    const results = [];
    for (const template of defaultSalaryTemplates) {
      const docRef = await addDoc(collection(db, 'salaryTemplates'), {
        ...template,
        createdAt: serverTimestamp(),
        createdBy: 'system-migration'
      });
      
      results.push({
        id: docRef.id,
        position: template.position
      });
      
      console.log(`✅ Created salary template: ${template.position} (${docRef.id})`);
    }
    
    console.log('🎉 Salary templates initialization completed successfully');
    return { 
      success: true, 
      message: `Successfully created ${results.length} salary templates`,
      results 
    };
    
  } catch (error) {
    console.error('❌ Error initializing salary templates:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
};

/**
 * Load all active salary templates
 */
export const loadSalaryTemplates = async () => {
  try {
    const q = query(
      collection(db, 'salaryTemplates'),
      where('isActive', '==', true),
      orderBy('position', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    const templates = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return templates;
  } catch (error) {
    console.error('Error loading salary templates:', error);
    throw error;
  }
};

/**
 * Get salary template by position
 */
export const getSalaryTemplateByPosition = async (position) => {
  try {
    const q = query(
      collection(db, 'salaryTemplates'),
      where('position', '==', position),
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
    console.error('Error getting salary template by position:', error);
    return null;
  }
};

/**
 * Get salary template by position and experience level (enhanced matching)
 */
export const getSalaryTemplateByPositionAndExperience = async (position, experienceLevel) => {
  try {
    console.log('🔍 Searching for template:', { position, experienceLevel });
    
    // First try to find exact match (position + experience)
    const exactQuery = query(
      collection(db, 'salaryTemplates'),
      where('position', '==', position),
      where('experienceLevel', '==', experienceLevel),
      where('isActive', '==', true)
    );
    
    const exactSnapshot = await getDocs(exactQuery);
    if (!exactSnapshot.empty) {
      const doc = exactSnapshot.docs[0];
      console.log('✅ Found exact match template:', doc.data().position, doc.data().experienceLevel);
      return {
        id: doc.id,
        ...doc.data()
      };
    }
    
    // Fallback to position-only match
    console.log('⚠️ No exact match, trying position-only');
    return await getSalaryTemplateByPosition(position);
  } catch (error) {
    console.error('Error getting salary template by position and experience:', error);
    return null;
  }
};

/**
 * Get all templates for a specific position (all experience levels)
 */
export const getTemplatesByPosition = async (position) => {
  try {
    const q = query(
      collection(db, 'salaryTemplates'),
      where('position', '==', position),
      where('isActive', '==', true),
      orderBy('experienceLevel', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting templates by position:', error);
    // Fallback without orderBy
    try {
      const fallbackQuery = query(
        collection(db, 'salaryTemplates'),
        where('position', '==', position),
        where('isActive', '==', true)
      );
      
      const fallbackSnapshot = await getDocs(fallbackQuery);
      const templates = fallbackSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort on client side
      const experienceOrder = { 'entry': 0, 'mid': 1, 'senior': 2, 'lead': 3 };
      return templates.sort((a, b) => {
        return (experienceOrder[a.experienceLevel] || 0) - (experienceOrder[b.experienceLevel] || 0);
      });
    } catch (fallbackError) {
      console.error('Fallback query also failed:', fallbackError);
      return [];
    }
  }
};

/**
 * Calculate total allowances from template
 */
export const calculateTotalAllowances = (template) => {
  if (!template || !template.allowances) return 0;
  
  return Object.values(template.allowances).reduce((total, amount) => {
    return total + (typeof amount === 'number' ? amount : 0);
  }, 0);
};

/**
 * Generate payslip data from employee and template
 * Enhanced to support experience level and salary source tracking
 */
export const generatePayslipFromTemplate = (employee, template, hoursWorked = 160, calculationMethod = 'fixed') => {
  if (!template) return null;
  
  const totalAllowances = calculateTotalAllowances(template);
  let basicSalary = 0;
  
  if (calculationMethod === 'hourly') {
    basicSalary = (hoursWorked || 160) * template.hourlyRate;
  } else {
    basicSalary = template.baseSalary;
  }
  
  const grossSalary = basicSalary + totalAllowances;
  
  // Basic deductions (can be enhanced later)
  const epfEmployee = grossSalary * 0.11; // 11% EPF employee contribution
  const socso = Math.min(grossSalary * 0.005, 19.75); // SOCSO employee contribution (capped)
  const basicDeductions = epfEmployee + socso;
  
  const netSalary = grossSalary - basicDeductions;
  
  return {
    employeeId: employee.id,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    employeeEmail: employee.email,
    position: employee.position || template.position,
    experienceLevel: employee.experienceLevel || template.experienceLevel,
    calculationMethod,
    basicSalary: basicSalary.toFixed(2),
    allowances: totalAllowances.toFixed(2),
    deductions: basicDeductions.toFixed(2),
    grossSalary: grossSalary.toFixed(2),
    netSalary: netSalary.toFixed(2),
    hourlyRate: template.hourlyRate,
    hoursWorked: calculationMethod === 'hourly' ? hoursWorked : null,
    templateUsed: template.id,
    allowanceBreakdown: template.allowances,
    salarySource: 'template' // Track that this came from template
  };
};

/**
 * Create or update salary template
 */
export const saveSalaryTemplate = async (templateData, templateId = null) => {
  try {
    const data = {
      ...templateData,
      updatedAt: serverTimestamp()
    };
    
    if (templateId) {
      // Update existing template
      await updateDoc(doc(db, 'salaryTemplates', templateId), data);
      return { success: true, id: templateId, action: 'updated' };
    } else {
      // Create new template
      data.createdAt = serverTimestamp();
      const docRef = await addDoc(collection(db, 'salaryTemplates'), data);
      return { success: true, id: docRef.id, action: 'created' };
    }
  } catch (error) {
    console.error('Error saving salary template:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete salary template
 */
export const deleteSalaryTemplate = async (templateId) => {
  try {
    await deleteDoc(doc(db, 'salaryTemplates', templateId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting salary template:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get template categories for filtering
 */
export const getTemplateCategories = async () => {
  try {
    const templates = await loadSalaryTemplates();
    const categories = [...new Set(templates.map(t => t.category))].filter(Boolean);
    return categories.sort();
  } catch (error) {
    console.error('Error getting template categories:', error);
    return [];
  }
};

/**
 * Calculate Malaysian income tax (simplified)
 */
export const calculateIncomeTax = (annualIncome) => {
  // Malaysian income tax rates for 2024
  const taxBrackets = [
    { min: 0, max: 5000, rate: 0 },
    { min: 5000, max: 20000, rate: 0.01 },
    { min: 20000, max: 35000, rate: 0.03 },
    { min: 35000, max: 50000, rate: 0.08 },
    { min: 50000, max: 70000, rate: 0.13 },
    { min: 70000, max: 100000, rate: 0.21 },
    { min: 100000, max: 400000, rate: 0.24 },
    { min: 400000, max: 600000, rate: 0.245 },
    { min: 600000, max: 2000000, rate: 0.25 },
    { min: 2000000, max: Infinity, rate: 0.30 }
  ];
  
  let tax = 0;
  let remainingIncome = annualIncome;
  
  for (const bracket of taxBrackets) {
    if (remainingIncome <= 0) break;
    
    const taxableInThisBracket = Math.min(remainingIncome, bracket.max - bracket.min);
    tax += taxableInThisBracket * bracket.rate;
    remainingIncome -= taxableInThisBracket;
  }
  
  return Math.max(0, tax);
};