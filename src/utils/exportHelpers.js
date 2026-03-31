/**
 * Data Export Helpers
 *
 * Provides CSV export functionality for attendance, leave, and claims data.
 * Uses only built-in JavaScript — no external dependencies.
 */

import {
  parseTimestamp,
  getCheckInTime,
  getCheckOutTime
} from './attendanceHelpers';

// ---------------------------------------------------------------------------
// Generic CSV helpers
// ---------------------------------------------------------------------------

/**
 * Escape a single cell value for CSV.
 * Wraps the value in double-quotes when it contains commas, double-quotes,
 * newlines, or leading/trailing whitespace.  Internal double-quotes are
 * doubled as per RFC 4180.
 */
function escapeCSVCell(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);

  // If the value contains a comma, double-quote, newline, or has
  // leading/trailing whitespace we must quote it.
  if (
    str.includes(',') ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r') ||
    str !== str.trim()
  ) {
    return '"' + str.replace(/"/g, '""') + '"';
  }

  return str;
}

/**
 * Format a Date (or Firestore Timestamp / date string) as YYYY-MM-DD HH:mm.
 * Returns an empty string when the value cannot be parsed.
 */
function formatDateTimeForExport(value) {
  const date = parseTimestamp(value);
  if (!date) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Format a Date (or Firestore Timestamp / date string) as YYYY-MM-DD.
 * Returns an empty string when the value cannot be parsed.
 */
function formatDateForExport(value) {
  const date = parseTimestamp(value);
  if (!date) {
    // If parseTimestamp fails, check if it is already a plain date string
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Trigger a file download in the browser for the given content.
 */
function triggerDownload(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  // Clean up
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Export an array of objects to a CSV file and trigger a browser download.
 *
 * @param {Object[]} data       - Array of objects to export.
 * @param {Object[]} columns    - Column definitions.
 *   Each column: { field: string, headerName: string, formatter?: (value, row) => string }
 * @param {string}   filename   - File name without extension.
 */
export function exportToCSV(data, columns, filename) {
  if (!data || data.length === 0) {
    console.warn('exportToCSV: No data to export.');
    return;
  }

  if (!columns || columns.length === 0) {
    console.warn('exportToCSV: No columns defined.');
    return;
  }

  // Build header row
  const headerRow = columns.map((col) => escapeCSVCell(col.headerName)).join(',');

  // Build data rows
  const dataRows = data.map((row) => {
    return columns
      .map((col) => {
        const rawValue = row[col.field];
        const value = col.formatter ? col.formatter(rawValue, row) : rawValue;
        return escapeCSVCell(value);
      })
      .join(',');
  });

  // Add BOM for proper UTF-8 handling in Excel
  const BOM = '\uFEFF';
  const csvContent = BOM + [headerRow, ...dataRows].join('\r\n');

  triggerDownload(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;');
}

/**
 * Pre-configured export for attendance records.
 *
 * @param {Object[]} records    - Attendance records from Firestore.
 * @param {{ startDate?: string, endDate?: string }} dateRange
 *   Optional date range used in the filename.
 */
export function exportAttendanceReport(records, dateRange = {}) {
  const columns = [
    {
      field: 'userName',
      headerName: 'Name'
    },
    {
      field: 'date',
      headerName: 'Date',
      formatter: (value) => formatDateForExport(value) || value || ''
    },
    {
      field: 'checkInTime',
      headerName: 'Check-In',
      formatter: (_value, row) => formatDateTimeForExport(getCheckInTime(row))
    },
    {
      field: 'checkOutTime',
      headerName: 'Check-Out',
      formatter: (_value, row) => formatDateTimeForExport(getCheckOutTime(row))
    },
    {
      field: 'workingHours',
      headerName: 'Working Hours',
      formatter: (value) => {
        if (value === null || value === undefined) return '';
        return Number(value).toFixed(2);
      }
    },
    {
      field: 'status',
      headerName: 'Status',
      formatter: (value) => {
        if (!value) return '';
        // Capitalize first letter
        return value.charAt(0).toUpperCase() + value.slice(1);
      }
    },
    {
      field: 'location',
      headerName: 'Location',
      formatter: (value) => {
        if (!value) return '';
        // Location might be an object with lat/lng or a string
        if (typeof value === 'object') {
          if (value.address) return value.address;
          if (value.lat !== undefined && value.lng !== undefined) {
            return `${value.lat}, ${value.lng}`;
          }
          return JSON.stringify(value);
        }
        return value;
      }
    }
  ];

  let filename = 'attendance_report';
  if (dateRange.startDate && dateRange.endDate) {
    filename += `_${dateRange.startDate}_to_${dateRange.endDate}`;
  } else if (dateRange.startDate) {
    filename += `_from_${dateRange.startDate}`;
  } else if (dateRange.endDate) {
    filename += `_until_${dateRange.endDate}`;
  }

  exportToCSV(records, columns, filename);
}

/**
 * Pre-configured export for leave records.
 *
 * @param {Object[]} records - Leave records from Firestore.
 */
export function exportLeaveReport(records) {
  const columns = [
    {
      field: 'userName',
      headerName: 'Employee'
    },
    {
      field: 'leaveType',
      headerName: 'Leave Type',
      formatter: (value) => {
        if (!value) return '';
        // Convert camelCase to title case (e.g. "annual" -> "Annual")
        return value.charAt(0).toUpperCase() + value.slice(1);
      }
    },
    {
      field: 'startDate',
      headerName: 'Start Date',
      formatter: (value) => formatDateForExport(value)
    },
    {
      field: 'endDate',
      headerName: 'End Date',
      formatter: (value) => formatDateForExport(value)
    },
    {
      field: 'totalDays',
      headerName: 'Days',
      formatter: (value) => {
        if (value === null || value === undefined) return '';
        return String(value);
      }
    },
    {
      field: 'status',
      headerName: 'Status',
      formatter: (value) => {
        if (!value) return '';
        return value.charAt(0).toUpperCase() + value.slice(1);
      }
    },
    {
      field: 'approvedBy',
      headerName: 'Approved By',
      formatter: (value) => value || ''
    }
  ];

  exportToCSV(records, columns, 'leave_report');
}

/**
 * Pre-configured export for claims records.
 *
 * @param {Object[]} records - Claims records from Firestore.
 */
export function exportClaimReport(records) {
  const columns = [
    {
      field: 'userName',
      headerName: 'Employee'
    },
    {
      field: 'claimType',
      headerName: 'Claim Type',
      formatter: (value) => {
        if (!value) return '';
        return value.charAt(0).toUpperCase() + value.slice(1);
      }
    },
    {
      field: 'amount',
      headerName: 'Amount',
      formatter: (value, row) => {
        if (value === null || value === undefined) return '';
        const currency = row.currency || 'MYR';
        return `${currency} ${Number(value).toFixed(2)}`;
      }
    },
    {
      field: 'claimDate',
      headerName: 'Date',
      formatter: (value) => formatDateForExport(value)
    },
    {
      field: 'status',
      headerName: 'Status',
      formatter: (value) => {
        if (!value) return '';
        return value.charAt(0).toUpperCase() + value.slice(1);
      }
    },
    {
      field: 'description',
      headerName: 'Description',
      formatter: (value) => value || ''
    }
  ];

  exportToCSV(records, columns, 'claims_report');
}
