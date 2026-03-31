import React from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Paper,
  Typography
} from '@mui/material';
import { CalendarMonth } from '@mui/icons-material';

/**
 * Month and Year Selector Component
 *
 * Provides dropdowns for selecting specific month (1-12) and year
 * Used in reports for filtering data by specific month/year
 *
 * @param {Object} props
 * @param {number} props.selectedMonth - Selected month (1-12)
 * @param {number} props.selectedYear - Selected year
 * @param {Function} props.onMonthChange - Callback when month changes
 * @param {Function} props.onYearChange - Callback when year changes
 * @param {boolean} props.disabled - Whether selectors are disabled
 */
function MonthYearSelector({
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
  disabled = false
}) {
  // Generate list of months
  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];

  // Generate list of years (current year and past 5 years)
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = 0; i <= 5; i++) {
    years.push(currentYear - i);
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        bgcolor: 'primary.50',
        border: '1px solid',
        borderColor: 'primary.100',
        borderRadius: 2
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <CalendarMonth sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main' }}>
          Select Month & Year
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {/* Month Selector */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small" disabled={disabled}>
            <InputLabel id="month-select-label">Month</InputLabel>
            <Select
              labelId="month-select-label"
              id="month-select"
              value={selectedMonth}
              label="Month"
              onChange={(e) => onMonthChange(e.target.value)}
              sx={{
                bgcolor: 'background.paper',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main'
                }
              }}
            >
              {months.map((month) => (
                <MenuItem key={month.value} value={month.value}>
                  {month.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Year Selector */}
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth size="small" disabled={disabled}>
            <InputLabel id="year-select-label">Year</InputLabel>
            <Select
              labelId="year-select-label"
              id="year-select"
              value={selectedYear}
              label="Year"
              onChange={(e) => onYearChange(e.target.value)}
              sx={{
                bgcolor: 'background.paper',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main'
                }
              }}
            >
              {years.map((year) => (
                <MenuItem key={year} value={year}>
                  {year}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {/* Display Selected Period */}
      <Box
        sx={{
          mt: 2,
          p: 1.5,
          bgcolor: 'background.paper',
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'primary.200'
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
          Selected Period:
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 600, color: 'primary.main' }}>
          {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
        </Typography>
      </Box>
    </Paper>
  );
}

export default MonthYearSelector;
