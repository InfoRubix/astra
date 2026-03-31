/**
 * Debug script to check position hierarchy
 * Run this in browser console to debug why General Manager can't see Staff approvals
 */

// Copy the functions from positionHierarchy.js
const COMPANY_POSITIONS = {
  'ASIAH HISAM': {
    0: ['Managing Partner', 'Senior Partner', 'Director', 'CEO', 'General Manager'],
    1: ['Partner', 'Legal Manager', 'HR Manager', 'Finance Manager', 'Operations Manager', 'Administration Manager', 'Company Administrator'],
    2: ['Senior Lawyer', 'Senior Paralegal', 'Senior Accountant', 'Supervisor', 'Team Lead'],
    3: ['Lawyer', 'Paralegal', 'Legal Assistant', 'Legal Clerk', 'Secretary', 'HR Executive', 'Administrative Assistant', 'Accountant', 'Clerk', 'Staff']
  },
  'LITIGATION': {
    0: ['Managing Partner', 'Senior Partner', 'Director', 'CEO', 'General Manager'],
    1: ['Partner', 'Legal Manager', 'HR Manager', 'Finance Manager', 'Operations Manager', 'Administration Manager', 'Company Administrator'],
    2: ['Senior Lawyer', 'Senior Paralegal', 'Senior Accountant', 'Supervisor', 'Team Lead'],
    3: ['Lawyer', 'Paralegal', 'Legal Assistant', 'Legal Clerk', 'Secretary', 'HR Executive', 'Administrative Assistant', 'Accountant', 'Clerk', 'Staff']
  },
  'AFC': {
    0: ['General Manager', 'Director'],
    1: ['Finance Manager', 'Operations Manager', 'Branch Manager', 'Mortgage Manager', 'Loan Manager'],
    2: ['Senior Loan Officer', 'Senior Financial Advisor', 'Senior Accountant', 'Supervisor'],
    3: ['Loan Officer', 'Financial Advisor', 'Mortgage Consultant', 'Accountant', 'Customer Service', 'Administrative Assistant', 'Clerk', 'Secretary', 'Staff']
  },
  'RUBIX': {
    0: ['General Manager', 'Director'],
    1: ['Project Manager', 'Finance Manager', 'Operations Manager', 'Marketing Manager', 'Sales Manager'],
    2: ['Senior Developer', 'Senior Executive', 'Team Lead', 'Supervisor'],
    3: ['Developer', 'Junior Developer', 'Accountant', 'Marketing Executive', 'Sales Executive', 'Customer Service', 'Administrative Assistant', 'Clerk', 'Secretary', 'Staff']
  }
};

const POSITION_LEVELS = {};
Object.keys(COMPANY_POSITIONS).forEach(company => {
  Object.keys(COMPANY_POSITIONS[company]).forEach(level => {
    COMPANY_POSITIONS[company][level].forEach(position => {
      POSITION_LEVELS[position] = parseInt(level);
    });
  });
});

POSITION_LEVELS['Admin'] = -1;
POSITION_LEVELS['System Administrator'] = -1;
POSITION_LEVELS['Super Admin'] = -1;

const normalizeCompanyName = (companyName) => {
  if (!companyName) return null;
  const normalized = companyName.trim().toUpperCase();
  if (normalized === 'LITIGATION' || normalized === 'ASIAH HISAM') {
    return 'ASIAH HISAM';
  }
  return normalized;
};

const getPositionLevel = (position) => {
  if (!position) return 3;
  if (POSITION_LEVELS.hasOwnProperty(position)) {
    return POSITION_LEVELS[position];
  }
  const normalizedPosition = position.trim();
  for (const [key, level] of Object.entries(POSITION_LEVELS)) {
    if (key.toLowerCase() === normalizedPosition.toLowerCase()) {
      return level;
    }
  }
  const positionLower = normalizedPosition.toLowerCase();
  if (positionLower.includes('ceo') || positionLower.includes('director') ||
      positionLower.includes('partner') || positionLower.includes('general manager')) {
    return 0;
  }
  if (positionLower.includes('manager') || positionLower.includes('head of')) {
    return 1;
  }
  if (positionLower.includes('senior') || positionLower.includes('supervisor') ||
      positionLower.includes('team lead') || positionLower.includes('lead')) {
    return 2;
  }
  return 3;
};

const canApprove = (approverUser, requesterUser) => {
  if (!approverUser || !requesterUser) return false;
  const approverLevel = getPositionLevel(approverUser.position);
  const requesterLevel = getPositionLevel(requesterUser.position);

  console.log('🔍 Checking approval:', {
    approver: {
      name: `${approverUser.firstName} ${approverUser.lastName}`,
      position: approverUser.position,
      level: approverLevel,
      company: approverUser.company || approverUser.originalCompanyName,
      normalized: normalizeCompanyName(approverUser.company || approverUser.originalCompanyName)
    },
    requester: {
      name: `${requesterUser.firstName} ${requesterUser.lastName}`,
      position: requesterUser.position,
      level: requesterLevel,
      company: requesterUser.company || requesterUser.originalCompanyName,
      normalized: normalizeCompanyName(requesterUser.company || requesterUser.originalCompanyName)
    }
  });

  if (approverLevel === -1) {
    const result = approverLevel < requesterLevel;
    console.log('✅ System Admin can approve:', result);
    return result;
  }

  const approverCompany = normalizeCompanyName(approverUser.company || approverUser.originalCompanyName);
  const requesterCompany = normalizeCompanyName(requesterUser.company || requesterUser.originalCompanyName);

  if (!approverCompany || !requesterCompany) {
    console.log('❌ Missing company information');
    return false;
  }

  if (approverCompany !== requesterCompany) {
    console.log('❌ Different companies:', approverCompany, '!==', requesterCompany);
    return false;
  }

  const result = approverLevel < requesterLevel;
  console.log(result ? '✅ Can approve' : '❌ Cannot approve', `(${approverLevel} < ${requesterLevel})`);
  return result;
};

// Test function
window.debugHierarchy = (lailiData, reshauanData) => {
  console.log('=== DEBUG HIERARCHY ===');
  console.log('Laili:', lailiData);
  console.log('Reshauan:', reshauanData);
  console.log('');
  console.log('Can Laili approve Reshauan?', canApprove(lailiData, reshauanData));
};

// Quick test
console.log('=== HIERARCHY DEBUG SCRIPT LOADED ===');
console.log('To test, call in console:');
console.log('debugHierarchy(lailiUserObject, reshauanUserObject)');
console.log('');
console.log('Example:');
console.log('debugHierarchy(');
console.log('  { firstName: "Laili", lastName: "X", position: "General Manager", company: "ASIAH HISAM" },');
console.log('  { firstName: "Reshauan", lastName: "Y", position: "Staff", company: "ASIAH HISAM" }');
console.log(')');
