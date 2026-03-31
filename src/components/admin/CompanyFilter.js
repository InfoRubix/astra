import React, { useState } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Typography
} from '@mui/material';
import { Business } from '@mui/icons-material';

/**
 * CompanyFilter - A dropdown select component that filters data by company.
 *
 * Extracts unique company names from the provided data array, counts
 * the number of records per company, and renders an MUI Select with
 * badge chips showing the record count next to each company name.
 *
 * @param {Object} props
 * @param {string} props.selectedCompany - The currently selected company name (empty string for "All").
 * @param {Function} props.onCompanyChange - Callback invoked with the new company value when selection changes.
 * @param {Array<Object>} [props.data=[]] - Array of data objects; each should have a `company` or `originalCompanyName` field.
 * @param {boolean} [props.showAll=true] - Whether to show the "All Companies" option in the dropdown.
 * @returns {JSX.Element}
 */
function CompanyFilter({ selectedCompany, onCompanyChange, data = [], showAll = true }) {
  // Helper function to get company consistently (same as Employees.js)
  const getItemCompany = (item) => {
    return item.company || item.originalCompanyName || 'RUBIX';
  };

  // Calculate company stats from data and get unique companies
  const getCompanyStats = () => {
    const companyCount = {};
    
    console.log('CompanyFilter - Processing data:', data.length, 'items');
    
    data.forEach(item => {
      const company = getItemCompany(item);
      companyCount[company] = (companyCount[company] || 0) + 1;
      console.log(`CompanyFilter - Found employee in company: ${company}`);
    });

    console.log('CompanyFilter - Final company stats:', companyCount);
    return companyCount;
  };

  const companyStats = getCompanyStats();
  const availableCompanies = Object.keys(companyStats).sort();

  return (
    <Box>
      <FormControl fullWidth size="small" sx={{ minWidth: 200 }}>
        <InputLabel>Filter by Company</InputLabel>
        <Select
          value={selectedCompany || ''}
          onChange={(e) => onCompanyChange(e.target.value)}
          label="Filter by Company"
          startAdornment={<Business sx={{ mr: 1, color: 'text.secondary' }} />}
        >
          {showAll && (
            <MenuItem value="">
              <em>All Companies</em>
            </MenuItem>
          )}
          {availableCompanies.map((company) => (
            <MenuItem key={company} value={company}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <Typography>{company}</Typography>
                <Chip 
                  label={companyStats[company] || 0} 
                  size="small" 
                  color="primary" 
                  sx={{ ml: 1 }}
                />
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}

export default CompanyFilter;