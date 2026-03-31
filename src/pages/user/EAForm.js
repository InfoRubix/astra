import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  Grid,
  Card,
  CardContent,
  Button,
  Avatar,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  Description,
  Download,
  Info,
  AccountBalance,
  Receipt,
  CalendarToday,
  Person,
  Business
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { eaFormService } from '../../services/eaFormService';

function EAForm() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear() - 1); // Default to last year
  const [eaFormData, setEAFormData] = useState(null);

  // Generate list of years (current year and past 5 years)
  const years = [];
  const currentYear = new Date().getFullYear();
  for (let i = 0; i <= 5; i++) {
    years.push(currentYear - i);
  }

  useEffect(() => {
    if (user && selectedYear) {
      loadEAForm();
    }
  }, [user, selectedYear]);

  const loadEAForm = async () => {
    setLoading(true);
    setError('');
    try {
      // Try to get existing EA Form
      const existingForm = await eaFormService.getEAForm(user.uid, selectedYear);

      if (existingForm) {
        console.log('✅ EA Form found:', existingForm);
        setEAFormData(existingForm);
      } else {
        console.log('ℹ️ No EA Form found for this year');
        setEAFormData(null);
      }
    } catch (err) {
      console.error('❌ Error loading EA Form:', err);
      setError('Failed to load EA Form. Please try again.');
    }
    setLoading(false);
  };

  const handleGenerateEAForm = async () => {
    setGenerating(true);
    setError('');
    setSuccess('');
    try {
      console.log(`🔄 Generating EA Form for ${selectedYear}...`);

      // Calculate EA Form data
      const formData = await eaFormService.calculateEAFormData(user.uid, selectedYear);

      // Save to Firestore
      await eaFormService.saveEAForm(formData);

      setEAFormData(formData);
      setSuccess(`EA Form for ${selectedYear} has been generated successfully!`);
    } catch (err) {
      console.error('❌ Error generating EA Form:', err);
      setError(err.message || 'Failed to generate EA Form. Please try again.');
    }
    setGenerating(false);
  };

  const handleDownloadPDF = async () => {
    if (!eaFormData) return;

    try {
      setSuccess('');
      await eaFormService.downloadEAFormPDF(eaFormData);
      setSuccess('EA Form PDF downloaded successfully!');
    } catch (err) {
      console.error('❌ Error downloading PDF:', err);
      setError('Failed to download PDF. Please try again.');
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar
            sx={{
              bgcolor: 'primary.main',
              width: 56,
              height: 56,
              mr: 2
            }}
          >
            <Description sx={{ fontSize: 32 }} />
          </Avatar>
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(45deg, #1976d2, #42a5f5)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              EA Form (Borang EA)
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Annual Tax Return / Penyata Cukai Tahunan
            </Typography>
          </Box>
        </Box>
        <Box
          sx={{
            width: 60,
            height: 4,
            bgcolor: 'primary.main',
            borderRadius: 2,
            opacity: 0.8
          }}
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {/* Info Alert */}
      <Alert severity="info" icon={<Info />} sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>What is EA Form?</strong> The EA Form (Borang EA) is an annual statement provided by employers
          showing your income and statutory deductions for the year. You need this document to file your income tax
          with LHDN (Lembaga Hasil Dalam Negeri Malaysia).
        </Typography>
      </Alert>

      {/* Year Selector */}
      <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Select Tax Year</InputLabel>
              <Select
                value={selectedYear}
                label="Select Tax Year"
                onChange={(e) => setSelectedYear(e.target.value)}
                disabled={loading || generating}
              >
                {years.map((year) => (
                  <MenuItem key={year} value={year}>
                    {year}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            {!eaFormData ? (
              <Button
                variant="contained"
                color="primary"
                fullWidth
                onClick={handleGenerateEAForm}
                disabled={loading || generating}
                startIcon={generating ? <CircularProgress size={20} /> : <Receipt />}
              >
                {generating ? 'Generating...' : 'Generate EA Form'}
              </Button>
            ) : (
              <Button
                variant="contained"
                color="success"
                fullWidth
                onClick={handleDownloadPDF}
                startIcon={<Download />}
              >
                Download PDF
              </Button>
            )}
          </Grid>
        </Grid>
      </Paper>

      {/* Loading State */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {/* EA Form Display */}
      {!loading && eaFormData && (
        <>
          {/* Employee & Employer Info */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%', borderRadius: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Person sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Employee Information
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="body2">
                      <strong>Name:</strong> {eaFormData.employee.name}
                    </Typography>
                    <Typography variant="body2">
                      <strong>IC Number:</strong> {eaFormData.employee.icNumber}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Position:</strong> {eaFormData.employee.position}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Department:</strong> {eaFormData.employee.department}
                    </Typography>
                    <Typography variant="body2">
                      <strong>EPF Number:</strong> {eaFormData.employee.epfNumber}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Tax Number:</strong> {eaFormData.employee.taxNumber}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card sx={{ height: '100%', borderRadius: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Business sx={{ mr: 1, color: 'success.main' }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Employer Information
                    </Typography>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="body2">
                      <strong>Company:</strong> {eaFormData.employer.name}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Address:</strong> {eaFormData.employer.address.line1 || 'N/A'}
                    </Typography>
                    {eaFormData.employer.address.line2 && (
                      <Typography variant="body2" sx={{ pl: 8 }}>
                        {eaFormData.employer.address.line2}
                      </Typography>
                    )}
                    <Typography variant="body2" sx={{ pl: eaFormData.employer.address.line2 ? 8 : 0 }}>
                      {eaFormData.employer.address.postcode} {eaFormData.employer.address.city}, {eaFormData.employer.address.state}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Tax Number:</strong> {eaFormData.employer.taxNumber}
                    </Typography>
                    <Typography variant="body2">
                      <strong>EPF Number:</strong> {eaFormData.employer.epfNumber}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Income Summary */}
          <Card sx={{ mb: 3, borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AccountBalance sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Income Summary
                </Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={3}>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 2, bgcolor: 'success.50', textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      Gross Income
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: 'success.main' }}>
                      RM {eaFormData.income.totalIncome.toFixed(2)}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 2, bgcolor: 'error.50', textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      Total Deductions
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: 'error.main' }}>
                      RM {eaFormData.employeeDeductions.total.toFixed(2)}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 2, bgcolor: 'primary.50', textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      Net Income
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
                      RM {eaFormData.netIncome.toFixed(2)}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Statutory Deductions */}
          <Card sx={{ mb: 3, borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Statutory Deductions
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Type</strong></TableCell>
                      <TableCell align="right"><strong>Employee</strong></TableCell>
                      <TableCell align="right"><strong>Employer</strong></TableCell>
                      <TableCell align="right"><strong>Total</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>EPF (KWSP)</TableCell>
                      <TableCell align="right">RM {eaFormData.employeeDeductions.epf.toFixed(2)}</TableCell>
                      <TableCell align="right">RM {eaFormData.employerContributions.epf.toFixed(2)}</TableCell>
                      <TableCell align="right">
                        RM {(eaFormData.employeeDeductions.epf + eaFormData.employerContributions.epf).toFixed(2)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>SOCSO (PERKESO)</TableCell>
                      <TableCell align="right">RM {eaFormData.employeeDeductions.socso.toFixed(2)}</TableCell>
                      <TableCell align="right">RM {eaFormData.employerContributions.socso.toFixed(2)}</TableCell>
                      <TableCell align="right">
                        RM {(eaFormData.employeeDeductions.socso + eaFormData.employerContributions.socso).toFixed(2)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>EIS (SIP)</TableCell>
                      <TableCell align="right">RM {eaFormData.employeeDeductions.eis.toFixed(2)}</TableCell>
                      <TableCell align="right">RM {eaFormData.employerContributions.eis.toFixed(2)}</TableCell>
                      <TableCell align="right">
                        RM {(eaFormData.employeeDeductions.eis + eaFormData.employerContributions.eis).toFixed(2)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Zakat</TableCell>
                      <TableCell align="right">RM {eaFormData.employeeDeductions.zakat.toFixed(2)}</TableCell>
                      <TableCell align="right">-</TableCell>
                      <TableCell align="right">RM {eaFormData.employeeDeductions.zakat.toFixed(2)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>PCB (MTD)</TableCell>
                      <TableCell align="right">RM {eaFormData.employeeDeductions.pcb.toFixed(2)}</TableCell>
                      <TableCell align="right">-</TableCell>
                      <TableCell align="right">RM {eaFormData.employeeDeductions.pcb.toFixed(2)}</TableCell>
                    </TableRow>
                    <TableRow sx={{ bgcolor: 'grey.100' }}>
                      <TableCell><strong>TOTAL</strong></TableCell>
                      <TableCell align="right"><strong>RM {eaFormData.employeeDeductions.total.toFixed(2)}</strong></TableCell>
                      <TableCell align="right"><strong>RM {eaFormData.employerContributions.total.toFixed(2)}</strong></TableCell>
                      <TableCell align="right"><strong>RM {(eaFormData.employeeDeductions.total + eaFormData.employerContributions.total).toFixed(2)}</strong></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* Download Button */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<Download />}
              onClick={handleDownloadPDF}
              sx={{ px: 6, py: 1.5 }}
            >
              Download EA Form PDF
            </Button>
          </Box>
        </>
      )}

      {/* No Data State */}
      {!loading && !eaFormData && (
        <Paper
          sx={{
            p: 6,
            textAlign: 'center',
            bgcolor: 'grey.50',
            borderRadius: 2
          }}
        >
          <Description sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No EA Form Available
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Click "Generate EA Form" button above to create your EA Form for {selectedYear}.
          </Typography>
        </Paper>
      )}
    </Container>
  );
}

export default EAForm;
