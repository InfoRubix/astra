/**
 * Position Hierarchy System
 *
 * Defines the organizational hierarchy for approval workflows.
 * Lower level number = higher authority
 *
 * Rule 1: Position Hierarchy (Same Company Only)
 * - Approvers must be in the SAME COMPANY as the requester
 * - Approvers must have a HIGHER position level (lower number)
 * - Department does NOT matter (company-wide approval authority within same company)
 * - ASIAH HISAM and LITIGATION are treated as the SAME company
 */

// Company-specific position configurations
// Note: Only 3 companies in system - ASIAH HISAM, AFC, and RUBIX
export const COMPANY_POSITIONS = {
  // ASIAH HISAM - Law Firm (Main company - Mix of legal & administrative positions)
  'ASIAH HISAM': {
    0: ['Managing Partner', 'Senior Partner', 'Director', 'CEO', 'General Manager'],
    1: ['Partner', 'Legal Manager', 'HR Manager', 'Finance Manager', 'Operations Manager', 'Administration Manager', 'Company Administrator'],
    2: ['Senior Lawyer', 'Senior Paralegal', 'Senior Accountant', 'Supervisor', 'Team Lead'],
    3: ['Lawyer', 'Paralegal', 'Legal Assistant', 'Legal Clerk', 'Secretary', 'HR Executive', 'Administrative Assistant', 'Accountant', 'Clerk', 'Staff']
  },

  // AFC - Mortgage/Financial Services Company
  'AFC': {
    0: ['General Manager', 'Director', 'CEO'],
    1: ['Finance Manager', 'Operations Manager', 'Branch Manager', 'Mortgage Manager', 'Loan Manager', 'Administration Manager'],
    2: ['Senior Loan Officer', 'Senior Financial Advisor', 'Senior Accountant', 'Supervisor', 'Team Lead'],
    3: ['Loan Officer', 'Financial Advisor', 'Mortgage Consultant', 'Accountant', 'Customer Service', 'Administrative Assistant', 'Clerk', 'Secretary', 'Staff']
  },

  // RUBIX - Tech/Business Company
  'RUBIX': {
    0: ['General Manager', 'Director', 'CEO'],
    1: ['Project Manager', 'Finance Manager', 'Operations Manager', 'Marketing Manager', 'Sales Manager', 'Administration Manager'],
    2: ['Senior Developer', 'Senior Executive', 'Team Lead', 'Supervisor', 'Senior Accountant'],
    3: ['Developer', 'Junior Developer', 'Accountant', 'Marketing Executive', 'Sales Executive', 'Customer Service', 'Administrative Assistant', 'Clerk', 'Secretary', 'Staff']
  }
};

// Build reverse lookup: position -> level mapping
const POSITION_LEVELS = {};
Object.keys(COMPANY_POSITIONS).forEach(company => {
  Object.keys(COMPANY_POSITIONS[company]).forEach(level => {
    COMPANY_POSITIONS[company][level].forEach(position => {
      POSITION_LEVELS[position] = parseInt(level);
    });
  });
});

// Add System Administrator positions (Level -1 - Above all companies)
POSITION_LEVELS['Admin'] = -1;
POSITION_LEVELS['System Administrator'] = -1;
POSITION_LEVELS['Super Admin'] = -1;

/**
 * Normalize company name
 * Converts company names to uppercase for consistent comparison
 * Valid companies: ASIAH HISAM, AFC, RUBIX
 */
export const normalizeCompanyName = (companyName) => {
  if (!companyName) return null;

  const normalized = companyName.trim().toUpperCase();

  // Return normalized company name
  return normalized;
};

/**
 * Get the hierarchy level for a position
 * Returns the level number (0-3), or 3 (lowest) if position not found
 */
export const getPositionLevel = (position) => {
  if (!position) return 3; // Default to lowest level if no position

  // Try exact match first
  if (POSITION_LEVELS.hasOwnProperty(position)) {
    return POSITION_LEVELS[position];
  }

  // Try case-insensitive match
  const normalizedPosition = position.trim();
  for (const [key, level] of Object.entries(POSITION_LEVELS)) {
    if (key.toLowerCase() === normalizedPosition.toLowerCase()) {
      return level;
    }
  }

  // Try partial match for common keywords
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

  // Default to level 3 (regular staff)
  return 3;
};

/**
 * Check if user1 can approve requests from user2
 *
 * Rule 1: Same Company Only (except for System Admin)
 * Requirements:
 * 1. System Admin (position level -1) can approve ANYONE from ANY company
 * 2. Otherwise: Same company (ASIAH HISAM and LITIGATION are treated as same)
 * 3. Approver must have higher authority (lower level number)
 */
export const canApprove = (approverUser, requesterUser) => {
  if (!approverUser || !requesterUser) return false;

  // Get position levels
  const approverLevel = getPositionLevel(approverUser.position);
  const requesterLevel = getPositionLevel(requesterUser.position);

  // System Admin (level -1) can approve ANYONE from ANY company
  if (approverLevel === -1) {
    return approverLevel < requesterLevel; // System Admin can approve anyone except other admins
  }

  // For non-admin users, must be same company
  const approverCompany = normalizeCompanyName(approverUser.company || approverUser.originalCompanyName);
  const requesterCompany = normalizeCompanyName(requesterUser.company || requesterUser.originalCompanyName);

  if (!approverCompany || !requesterCompany) return false;

  // Must be same company (after normalization)
  if (approverCompany !== requesterCompany) {
    return false;
  }

  // Approver must have higher authority (lower number = higher authority)
  return approverLevel < requesterLevel;
};

/**
 * Get all users who can approve for a given user
 */
export const getPotentialApprovers = (requesterUser, allUsers) => {
  if (!requesterUser || !allUsers) return [];

  return allUsers.filter(user => canApprove(user, requesterUser));
};

/**
 * Get all users whose requests this user can approve
 */
export const getSubordinates = (approverUser, allUsers) => {
  if (!approverUser || !allUsers) return [];

  // DEBUG: Log detailed approval checks
  const subordinates = allUsers.filter(user => {
    const canApproveResult = canApprove(approverUser, user);

    // Skip self
    if (user.id === approverUser.id || user.uid === approverUser.uid) {
      return false;
    }

    // Debug each user check
    if (process.env.NODE_ENV === 'development') {
      const approverLevel = getPositionLevel(approverUser.position);
      const userLevel = getPositionLevel(user.position);
      const approverCompany = normalizeCompanyName(approverUser.company || approverUser.originalCompanyName);
      const userCompany = normalizeCompanyName(user.company || user.originalCompanyName);

      if (canApproveResult) {
        console.log(`✅ CAN APPROVE: ${approverUser.firstName} (${approverUser.position}, ${approverCompany}, Level ${approverLevel}) -> ${user.firstName} (${user.position}, ${userCompany}, Level ${userLevel})`);
      }
    }

    return canApproveResult;
  });

  return subordinates;
};

/**
 * Get the default approver for a user
 * Returns the closest higher-level person (smallest level difference)
 */
export const getDefaultApprover = (requesterUser, allUsers) => {
  const potentialApprovers = getPotentialApprovers(requesterUser, allUsers);

  if (potentialApprovers.length === 0) return null;

  const requesterLevel = getPositionLevel(requesterUser.position);

  // Sort by position level difference (closest level first)
  potentialApprovers.sort((a, b) => {
    const aLevel = getPositionLevel(a.position);
    const bLevel = getPositionLevel(b.position);

    // Calculate level difference from requester
    const aDiff = requesterLevel - aLevel;
    const bDiff = requesterLevel - bLevel;

    // Prefer closest level (smallest difference)
    if (aDiff !== bDiff) {
      return aDiff - bDiff;
    }

    // If same difference, prefer higher authority
    if (aLevel !== bLevel) {
      return aLevel - bLevel;
    }

    // If same level, sort by name
    const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
    const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
    return nameA.localeCompare(nameB);
  });

  // Return the first one (closest higher-level person)
  return potentialApprovers[0];
};

/**
 * Check if a user is a leader (has subordinates)
 */
export const isLeader = (user, allUsers) => {
  if (!user || !allUsers) return false;

  const subordinates = getSubordinates(user, allUsers);
  return subordinates.length > 0;
};

/**
 * Get position level name for display
 */
export const getPositionLevelName = (level) => {
  const levelNames = {
    0: 'Top Management',
    1: 'Manager/Department Head',
    2: 'Senior/Supervisor',
    3: 'Staff/Executive'
  };
  return levelNames[level] || 'Unknown';
};

/**
 * Get all positions for a company (synchronous - pre-defined only)
 */
export const getPositionsForCompany = (companyName) => {
  const normalized = normalizeCompanyName(companyName);

  if (!COMPANY_POSITIONS[normalized]) {
    return [];
  }

  // Flatten all positions for this company
  const positions = [];
  Object.keys(COMPANY_POSITIONS[normalized]).forEach(level => {
    positions.push(...COMPANY_POSITIONS[normalized][level]);
  });

  return positions.sort();
};

/**
 * Get all positions for a company including positions from database (async)
 */
export const getAllPositionsForCompany = async (companyName, db) => {
  const normalized = normalizeCompanyName(companyName);
  const company = normalized;

  // Get pre-defined positions
  const preDefined = getPositionsForCompany(companyName);

  // Add system-level positions (available for all companies)
  const systemPositions = ['Admin', 'System Administrator', 'Super Admin'];

  // Get positions from database (both custom and edited pre-defined)
  let dbPositions = [];
  let deletedPositions = [];
  if (db) {
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const positionsQuery = query(
        collection(db, 'positions'),
        where('companyName', '==', company)
      );
      const snapshot = await getDocs(positionsQuery);
      const allDBPositions = snapshot.docs
        .map(doc => doc.data())
        .filter(data => data != null); // Filter out null/undefined documents

      // Filter active and deleted positions
      dbPositions = allDBPositions
        .filter(p => p && !p.isDeleted && p.positionName) // Add null checks
        .map(p => p.positionName)
        .filter(name => name && name.trim()); // Filter out empty/null names

      deletedPositions = allDBPositions
        .filter(p => p && p.isDeleted && p.positionName)
        .map(p => p.positionName)
        .filter(name => name && name.trim());
    } catch (err) {
      console.error('Error loading positions from database:', err);
    }
  }

  // Filter out deleted positions from pre-defined list
  const activePreDefined = preDefined.filter(
    pos => pos && !deletedPositions.includes(pos)
  );

  // Combine system positions, active pre-defined, and database positions
  const allPositions = [...systemPositions, ...activePreDefined, ...dbPositions];
  // Remove duplicates, filter out any remaining null/undefined/empty values, and sort
  return [...new Set(allPositions)].filter(pos => pos && pos.trim()).sort();
};

/**
 * Get all positions at a specific level for a company
 */
export const getPositionsAtLevel = (companyName, level) => {
  const normalized = normalizeCompanyName(companyName);

  if (!COMPANY_POSITIONS[normalized] || !COMPANY_POSITIONS[normalized][level]) {
    return [];
  }

  return COMPANY_POSITIONS[normalized][level].sort();
};

/**
 * Get user's company (normalized)
 */
export const getUserCompany = (user) => {
  if (!user) return null;
  return normalizeCompanyName(user.company || user.originalCompanyName);
};
