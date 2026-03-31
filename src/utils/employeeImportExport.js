import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

// CSV Template columns
const CSV_COLUMNS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'company',
  'department',
  'position',
  'role'
];

// All columns that can appear in an export (superset of import columns)
const EXPORT_COLUMNS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'company',
  'department',
  'position',
  'branch',
  'role',
  'status',
  'joinDate'
];

/**
 * Escapes a value for safe CSV embedding.
 * Wraps in quotes if the value contains commas, quotes, or newlines.
 */
function escapeCsvValue(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Export employees to a CSV string and trigger a browser download.
 *
 * @param {Array} employees - Array of employee objects from Firestore.
 * @param {Object} options - Optional filters/metadata for the filename.
 * @param {string} options.selectedCompany - Current company filter (for filename).
 * @param {string} options.selectedDepartment - Current department filter (for filename).
 */
export function exportEmployeesToCSV(employees, options = {}) {
  if (!employees || employees.length === 0) {
    throw new Error('No employees to export');
  }

  const getCompany = (emp) => emp.company || emp.originalCompanyName || '';

  // Build header row
  const headers = EXPORT_COLUMNS.map(col => escapeCsvValue(col));

  // Build data rows
  const rows = employees.map(emp => {
    const joinDate = emp.joinDate
      ? (emp.joinDate instanceof Date ? emp.joinDate : new Date(emp.joinDate)).toLocaleDateString('en-GB')
      : (emp.createdAt?.toDate ? emp.createdAt.toDate().toLocaleDateString('en-GB') : '');

    return [
      escapeCsvValue(emp.firstName || ''),
      escapeCsvValue(emp.lastName || ''),
      escapeCsvValue(emp.email || ''),
      escapeCsvValue(emp.phone || ''),
      escapeCsvValue(getCompany(emp)),
      escapeCsvValue(emp.department || ''),
      escapeCsvValue(emp.position || ''),
      escapeCsvValue(emp.branch || emp.branchName || ''),
      escapeCsvValue(emp.role || 'user'),
      escapeCsvValue(emp.isActive === false ? 'Inactive' : 'Active'),
      escapeCsvValue(joinDate)
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');

  // Build filename
  const sanitize = (str) => str.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const companyPart = options.selectedCompany ? `${sanitize(options.selectedCompany)}_` : '';
  const departmentPart = options.selectedDepartment ? `${sanitize(options.selectedDepartment)}_` : '';
  const datePart = new Date().toISOString().split('T')[0];
  const filename = `employees_export_${companyPart}${departmentPart}${datePart}.csv`;

  // Trigger download
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { success: true, count: employees.length, filename };
}

/**
 * Download a blank CSV template that users can fill in.
 */
export function downloadImportTemplate() {
  const headers = CSV_COLUMNS.join(',');
  const exampleRows = [
    'John,Doe,john.doe@company.com,012-3456789,Infotech,Engineering,Software Engineer,user',
    'Jane,Smith,jane.smith@company.com,012-9876543,Infotech,HR,HR Manager,user',
    'Ali,Ahmad,ali.ahmad@company.com,011-1234567,Infotech,Finance,Accountant,user'
  ];

  const csvContent = [headers, ...exampleRows].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'employee_import_template.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Parse raw CSV text into an array of employee objects.
 *
 * Handles quoted fields, commas within quotes, and various header name formats.
 *
 * @param {string} csvText - The raw text content of the CSV file.
 * @returns {Object} { headers: string[], employees: Object[], rawRows: string[][] }
 */
export function parseEmployeeCSV(csvText) {
  if (!csvText || typeof csvText !== 'string') {
    throw new Error('CSV text is empty or invalid');
  }

  const lines = csvText.split(/\r?\n/).filter(line => line.trim());

  if (lines.length < 2) {
    throw new Error('CSV file must contain at least a header row and one data row');
  }

  // Parse a single CSV line respecting quoted fields
  const parseLine = (line) => {
    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const headerRow = parseLine(lines[0]);
  const rawHeaders = headerRow.map(h => h.replace(/^["']|["']$/g, '').trim());

  // Map headers to standardised field names (case-insensitive, flexible naming)
  const headerMapping = {};
  const HEADER_ALIASES = {
    firstName: ['firstname', 'first_name', 'first name', 'given name', 'givenname'],
    lastName: ['lastname', 'last_name', 'last name', 'surname', 'family name', 'familyname'],
    email: ['email', 'e-mail', 'email address', 'emailaddress'],
    phone: ['phone', 'phone number', 'phonenumber', 'mobile', 'contact', 'telephone', 'tel'],
    company: ['company', 'company name', 'companyname', 'organization', 'organisation', 'org'],
    department: ['department', 'dept', 'division', 'team'],
    position: ['position', 'job title', 'jobtitle', 'title', 'designation'],
    role: ['role', 'user role', 'userrole', 'access level', 'accesslevel']
  };

  rawHeaders.forEach((header, index) => {
    const lower = header.toLowerCase();
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(lower) || lower === field.toLowerCase()) {
        headerMapping[field] = index;
        break;
      }
    }
  });

  // Parse data rows
  const dataRows = lines.slice(1);
  const rawRows = dataRows.map(parseLine);

  const employees = rawRows.map((row, rowIdx) => {
    const getValue = (field) => {
      const colIndex = headerMapping[field];
      if (colIndex === undefined || colIndex >= row.length) return '';
      return (row[colIndex] || '').replace(/^["']|["']$/g, '').trim();
    };

    return {
      firstName: getValue('firstName'),
      lastName: getValue('lastName'),
      email: getValue('email').toLowerCase(),
      phone: getValue('phone'),
      company: getValue('company'),
      department: getValue('department'),
      position: getValue('position'),
      role: getValue('role').toLowerCase() || 'user',
      _rowNumber: rowIdx + 2 // 1-based, skip header
    };
  });

  return {
    headers: rawHeaders,
    employees,
    rawRows,
    headerMapping
  };
}

/**
 * Validate an array of parsed employee objects.
 *
 * Returns an object with:
 *   - valid: boolean (true if zero errors)
 *   - errors: Array<{ row: number, field: string, message: string }>
 *   - warnings: Array<{ row: number, field: string, message: string }>
 *
 * @param {Array} employees - Output from parseEmployeeCSV().employees
 * @returns {Object}
 */
export function validateEmployeeData(employees) {
  const errors = [];
  const warnings = [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const validRoles = ['user', 'admin', 'branch_admin', 'company_admin', 'employee'];
  const seenEmails = new Set();

  if (!employees || employees.length === 0) {
    errors.push({ row: 0, field: '', message: 'No employee data found in CSV' });
    return { valid: false, errors, warnings };
  }

  employees.forEach((emp, idx) => {
    const row = emp._rowNumber || idx + 2;

    // Required fields
    if (!emp.firstName) {
      errors.push({ row, field: 'firstName', message: `Row ${row}: First name is required` });
    }
    if (!emp.lastName) {
      errors.push({ row, field: 'lastName', message: `Row ${row}: Last name is required` });
    }
    if (!emp.email) {
      errors.push({ row, field: 'email', message: `Row ${row}: Email is required` });
    } else if (!emailRegex.test(emp.email)) {
      errors.push({ row, field: 'email', message: `Row ${row}: Invalid email format "${emp.email}"` });
    } else if (seenEmails.has(emp.email.toLowerCase())) {
      errors.push({ row, field: 'email', message: `Row ${row}: Duplicate email "${emp.email}" in CSV` });
    } else {
      seenEmails.add(emp.email.toLowerCase());
    }

    // Warnings for optional fields
    if (!emp.company) {
      warnings.push({ row, field: 'company', message: `Row ${row}: No company specified - will need to be set manually` });
    }
    if (!emp.department) {
      warnings.push({ row, field: 'department', message: `Row ${row}: No department specified - defaults to "General"` });
    }
    if (emp.role && !validRoles.includes(emp.role.toLowerCase())) {
      warnings.push({ row, field: 'role', message: `Row ${row}: Unknown role "${emp.role}" - will default to "user"` });
    }
    if (!emp.phone) {
      warnings.push({ row, field: 'phone', message: `Row ${row}: No phone number provided` });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Import validated employees into Firestore (users collection only, no Firebase Auth).
 *
 * For each employee:
 *   1. Checks if email already exists in the users collection.
 *   2. Creates a new document in users collection with the employee data.
 *   3. Sets requiresPasswordReset = true so the admin knows auth setup is needed.
 *
 * @param {Array} employees - Validated employee objects from parseEmployeeCSV/validateEmployeeData.
 * @param {Object} options
 * @param {string} options.createdByUid - UID of the admin performing the import.
 * @param {string} options.createdByName - Name of the admin performing the import.
 * @param {Function} options.onProgress - Callback (current, total) for progress tracking.
 * @returns {Promise<Object>} { successCount, errorCount, errors: string[], importedEmployees: Object[] }
 */
export async function importEmployees(employees, options = {}) {
  const { createdByUid, createdByName, onProgress } = options;

  let successCount = 0;
  let errorCount = 0;
  const importErrors = [];
  const importedEmployees = [];

  const total = employees.length;

  // Process in batches of 10
  const batchSize = 10;

  for (let i = 0; i < total; i += batchSize) {
    const batch = employees.slice(i, i + batchSize);

    for (const emp of batch) {
      const row = emp._rowNumber || '?';
      try {
        // Skip rows with critical missing data
        if (!emp.firstName || !emp.lastName || !emp.email) {
          importErrors.push(`Row ${row}: Missing required fields (firstName, lastName, or email)`);
          errorCount++;
          continue;
        }

        const sanitizedEmail = emp.email.trim().toLowerCase();

        // Check if email already exists in Firestore
        const existingQuery = query(
          collection(db, 'users'),
          where('email', '==', sanitizedEmail)
        );
        const existingSnapshot = await getDocs(existingQuery);

        if (!existingSnapshot.empty) {
          importErrors.push(`Row ${row}: Email "${sanitizedEmail}" already exists in the system`);
          errorCount++;
          continue;
        }

        // Normalise role
        const validRoles = ['admin', 'branch_admin', 'company_admin'];
        const normalizedRole = validRoles.includes(emp.role) ? emp.role : 'user';

        // Build the user document
        const newUser = {
          firstName: emp.firstName.trim(),
          lastName: emp.lastName.trim(),
          email: sanitizedEmail,
          phone: (emp.phone || '').trim(),
          company: (emp.company || '').trim(),
          originalCompanyName: (emp.company || '').trim(),
          department: (emp.department || 'General').trim(),
          position: (emp.position || '').trim(),
          role: normalizedRole,
          branch: '',
          branchId: '',
          branchName: '',
          isActive: true,
          requiresPasswordReset: true,
          createdAt: serverTimestamp(),
          importedViaCSV: true,
          ...(createdByUid && { createdBy: createdByUid }),
          ...(createdByName && { createdByName }),
          leaveBalance: {
            annual: 12,
            sick: 14,
            emergency: 3,
            maternity: 90
          }
        };

        const docRef = await addDoc(collection(db, 'users'), newUser);
        importedEmployees.push({ ...newUser, id: docRef.id });
        successCount++;
      } catch (error) {
        console.error(`Error importing row ${row}:`, error);
        importErrors.push(`Row ${row}: ${error.message}`);
        errorCount++;
      }
    }

    // Report progress
    if (onProgress) {
      onProgress(Math.min(i + batchSize, total), total);
    }
  }

  return {
    successCount,
    errorCount,
    errors: importErrors,
    importedEmployees
  };
}
