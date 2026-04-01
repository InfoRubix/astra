import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Avatar
} from '@mui/material';
import { Business } from '@mui/icons-material';

/**
 * CompanyStatsCard - A card component that displays record counts grouped by company.
 *
 * Calculates how many records belong to each company from the provided
 * data array and renders a summary card with colored chips for each
 * company's count and a total at the bottom.
 *
 * @param {Object} props
 * @param {Array<Object>} [props.data=[]] - Array of data objects; each should have a `company` or `originalCompanyName` field.
 * @param {string} [props.title="Companies"] - Title displayed at the top of the card.
 * @returns {JSX.Element}
 */
function CompanyStatsCard({ data = [], title = "Companies" }) {
  // Helper function to get company consistently (same as Employees.js)
  const getItemCompany = (item) => {
    return item.company || item.originalCompanyName || '';
  };

  // Calculate company stats from data
  const calculateCompanyStats = () => {
    const companyCount = {};
    const colors = ['primary', 'secondary', 'success', 'error', 'warning', 'info'];
    
    data.forEach(item => {
      const company = getItemCompany(item);
      companyCount[company] = (companyCount[company] || 0) + 1;
    });

    // Convert to array with colors
    return Object.entries(companyCount).map(([name, count], index) => ({
      name,
      count,
      color: colors[index % colors.length]
    }));
  };

  const companyStats = calculateCompanyStats();

  if (companyStats.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>{title}</Typography>
          <Typography variant="body2" color="text.secondary">
            No company data available
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Business color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6">{title}</Typography>
        </Box>
        
        {companyStats.map((company, index) => (
          <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {company.name}
            </Typography>
            <Chip 
              label={company.count} 
              color={company.color} 
              size="small"
              sx={{ minWidth: 40 }}
            />
          </Box>
        ))}
        
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">
            Total: {companyStats.reduce((sum, company) => sum + company.count, 0)} records
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

export default CompanyStatsCard;