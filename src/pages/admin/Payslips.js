import React, { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import { 
  Container, 
  Typography, 
  Paper, 
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Divider,
  Fab,
  CircularProgress,
  Slide
} from '@mui/material';
import { 
  Add,
  Payment,
  Edit,
  Delete,
  MoreVert,
  Download,
  Visibility,
  AttachMoney,
  People,
  CalendarMonth,
  AutoAwesome,
  Settings,
  AccessTime,
  Timeline,
  Calculate,
  Search,
  FilterList,
  CheckBox,
  CheckBoxOutlineBlank,
  Update,
  ArrowForward,
  ArrowBack,
  Close
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, deleteDoc, doc, updateDoc, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { format } from 'date-fns';
import { pdfService } from '../../services/pdfService';
import html2canvas from 'html2canvas';
import {
  generateAttendanceBasedPayslip,
  getAttendanceInsights,
  loadEmployeeAttendanceForMonth,
  calculateMonthlyAttendanceSummary
} from '../../utils/attendanceCalculator';
import {
  generateMonthlyPayslips,
  manualPayslipGeneration,
  initializeEmployeeSalary
} from '../../utils/autoPayslipGenerator';

function Payslips() {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [payslips, setPayslips] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [availableCompanies, setAvailableCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [loading, setLoading] = useState(true);
  const [createDialog, setCreateDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' });
  const [filteredPayslips, setFilteredPayslips] = useState([]);
  
  // Bulk update states
  const [selectedPayslips, setSelectedPayslips] = useState([]);
  const [bulkUpdateLoading, setBulkUpdateLoading] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [removeAllDraftsLoading, setRemoveAllDraftsLoading] = useState(false);
  
  const [attendanceData, setAttendanceData] = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceInsights, setAttendanceInsights] = useState([]);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const payslipsPerPage = 4;
  const [form, setForm] = useState({
    employeeId: '',
    employeeName: '',
    employeeEmail: '',
    month: format(new Date(), 'yyyy-MM'),
    hoursWorked: '',
    hourlyRate: '',
    basicSalary: '',
    allowances: '',
    overtime: '',
    bonus: '',
    grossSalary: '',
    netSalary: '',
    status: 'draft',
    calculationMethod: 'hourly', // 'hourly', 'fixed', or 'attendance'
    paymentMethod: 'GIRO', // 'GIRO', 'IBG', or 'DuitNow'
    message: '', // Message to be displayed on payslip

    // Detailed breakdown fields
    employeeEPF: '',
    employeeEIS: '',
    employeeSOCSO: '',
    employerEPF: '',
    employerEIS: '',
    employerSOCSO: '',
    zakat: '',
    mtdPCB: '',

    // Specific other deductions
    loanDeduction: '',
    insurance: '',
    advanceSalary: '',
    uniformEquipment: '',
    disciplinaryFine: '',
    otherMisc: '',

    autoCalculate: true // Toggle for automatic calculation
  });

  useEffect(() => {
    if (user) {
      loadPayslips();
      loadAvailableCompanies();
    }
  }, [user]);

  useEffect(() => {
    if (selectedCompany) {
      loadEmployeesByCompany(selectedCompany);
    } else {
      loadEmployees();
    }
  }, [selectedCompany]);

  const loadAvailableCompanies = async () => {
    try {
      console.log('🔄 Loading available companies...');
      
      // Load companies from companySettings collection first (like Announcements.js)
      const companySettingsQuery = query(collection(db, 'companySettings'));
      const companySettingsSnapshot = await getDocs(companySettingsQuery);
      const companies = companySettingsSnapshot.docs.map(doc => doc.data().company);
      
      // Also get companies from users collection as fallback
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      const userCompanies = new Set();
      
      usersSnapshot.docs.forEach(doc => {
        const userData = doc.data();
        const company = userData.originalCompanyName || userData.company;
        if (company) userCompanies.add(company);
      });
      
      // Combine and deduplicate companies (same logic as Announcements.js)
      const allCompanies = [...new Set([...companies, ...userCompanies])].sort();
      setAvailableCompanies(allCompanies);
      
      console.log('✅ Loaded companies for payslips:', allCompanies);
    } catch (error) {
      console.error('❌ Error loading companies:', error);
    }
  };


  const loadPayslips = async () => {
    setLoading(true);
    try {
      // Simple query without orderBy to avoid index requirement
      const q = query(collection(db, 'payslips'));
      
      const querySnapshot = await getDocs(q);
      const payslipsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt || Date.now())
      }));
      
      // Sort by createdAt on client side (most recent first)
      const sortedPayslips = payslipsList.sort((a, b) => {
        try {
          return b.createdAt - a.createdAt;
        } catch (error) {
          return 0;
        }
      });
      
      setPayslips(sortedPayslips);
      setFilteredPayslips(sortedPayslips); // Initialize filtered list
    } catch (error) {
      console.error('Error loading payslips:', error);
      setError('Failed to load payslips: ' + error.message);
    }
    setLoading(false);
  };

  const loadEmployees = async () => {
    setEmployeesLoading(true);
    try {
      console.log('🔄 Loading all employees...');
      
      // Query for all users
      const q = query(collection(db, 'users'));
      const querySnapshot = await getDocs(q);
      let employeesList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('📊 Total users found:', employeesList.length);
      
      // Filter by role only (no company filtering for "All Companies" view) - exclude admin
      const filteredEmployees = employeesList.filter(emp => {
        const validRoles = ['user', 'employee'];
        return validRoles.includes(emp.role);
      });
      
      // Sort employees by name for better UX
      const sortedEmployees = filteredEmployees.sort((a, b) => {
        const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim();
        const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim();
        return nameA.localeCompare(nameB);
      });
      
      setEmployees(sortedEmployees);
      console.log('✅ All employees loaded:', sortedEmployees.length);
      
      if (sortedEmployees.length === 0) {
        setError('No employees found. Please check user roles.');
        setTimeout(() => setError(''), 5000);
      } else {
        setError('');
      }
    } catch (error) {
      console.error('❌ Error loading employees:', error);
      setError('Failed to load employees: ' + error.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setEmployeesLoading(false);
    }
  };

  const loadEmployeesByCompany = async (companyName) => {
    setEmployeesLoading(true);
    try {
      console.log('🔄 Loading employees for company:', companyName);
      
      // Query for all users
      const q = query(collection(db, 'users'));
      const querySnapshot = await getDocs(q);
      let employeesList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('📊 Total users found:', employeesList.length);
      
      // Filter by role and company - exclude admin
      const filteredEmployees = employeesList.filter(emp => {
        const validRoles = ['user', 'employee'];
        const hasValidRole = validRoles.includes(emp.role);
        
        // Company filtering
        const empCompany = emp.company || emp.originalCompanyName || 'RUBIX';
        const sameCompany = empCompany.toUpperCase() === companyName.toUpperCase();
        
        return hasValidRole && sameCompany;
      });
      
      console.log('🏢 Employees in company:', filteredEmployees.length);
      
      // Sort employees by name for better UX
      const sortedEmployees = filteredEmployees.sort((a, b) => {
        const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim();
        const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim();
        return nameA.localeCompare(nameB);
      });
      
      setEmployees(sortedEmployees);
      
      if (sortedEmployees.length === 0) {
        setError(`No employees found for company: ${companyName}`);
        setTimeout(() => setError(''), 5000);
      } else {
        console.log('✅ Company employees loaded:', sortedEmployees.map(emp => `${emp.firstName} ${emp.lastName} (${emp.position || 'No Position'})`));
        setError('');
      }
    } catch (error) {
      console.error('❌ Error loading company employees:', error);
      setError('Failed to load company employees: ' + error.message);
      setTimeout(() => setError(''), 5000);
    } finally {
      setEmployeesLoading(false);
    }
  };


  const calculateSalaries = () => {
    let basic = 0;
    
    if (form.calculationMethod === 'hourly') {
      const hours = parseFloat(form.hoursWorked) || 0;
      const rate = parseFloat(form.hourlyRate) || 0;
      basic = hours * rate;
    } else {
      basic = parseFloat(form.basicSalary) || 0;
    }
    
    const allowances = parseFloat(form.allowances) || 0;
    const overtime = parseFloat(form.overtime) || 0;
    const bonus = parseFloat(form.bonus) || 0;

    const gross = basic + allowances + overtime + bonus;
    
    // Auto-calculate EPF, EIS, SOCSO if enabled
    let calculatedValues = {};
    if (form.autoCalculate) {
      const employeeEPF = gross * 0.11; // 11% EPF employee
      const employeeEIS = Math.min(gross * 0.002, 4.15); // 0.2% EIS employee (capped at RM4.15)
      const employeeSOCSO = Math.min(gross * 0.005, 19.75); // 0.5% SOCSO employee (capped at RM19.75)
      const employerEPF = gross * 0.12; // 12% EPF employer
      const employerEIS = Math.min(gross * 0.002, 4.15); // 0.2% EIS employer (capped at RM4.15)
      const employerSOCSO = Math.min(gross * 0.014, 67.75); // 1.4% SOCSO employer (capped at RM67.75)
      
      calculatedValues = {
        employeeEPF: employeeEPF.toFixed(2),
        employeeEIS: employeeEIS.toFixed(2),
        employeeSOCSO: employeeSOCSO.toFixed(2),
        employerEPF: employerEPF.toFixed(2),
        employerEIS: employerEIS.toFixed(2),
        employerSOCSO: employerSOCSO.toFixed(2)
      };
    }
    
    // Calculate total deductions (statutory + specific deductions)
    const empEPF = parseFloat(form.autoCalculate ? calculatedValues.employeeEPF : form.employeeEPF) || 0;
    const empEIS = parseFloat(form.autoCalculate ? calculatedValues.employeeEIS : form.employeeEIS) || 0;
    const empSOCSO = parseFloat(form.autoCalculate ? calculatedValues.employeeSOCSO : form.employeeSOCSO) || 0;
    const zakat = parseFloat(form.zakat) || 0;
    const mtdPCB = parseFloat(form.mtdPCB) || 0;
    
    // Specific other deductions
    const loanDeduction = parseFloat(form.loanDeduction) || 0;
    const insurance = parseFloat(form.insurance) || 0;
    const advanceSalary = parseFloat(form.advanceSalary) || 0;
    const uniformEquipment = parseFloat(form.uniformEquipment) || 0;
    const disciplinaryFine = parseFloat(form.disciplinaryFine) || 0;
    const otherMisc = parseFloat(form.otherMisc) || 0;
    // Remove old deductions field - now using specific deductions only
    
    const totalDeductions = empEPF + empEIS + empSOCSO + zakat + mtdPCB + 
                           loanDeduction + insurance + advanceSalary + uniformEquipment + 
                           disciplinaryFine + otherMisc;
    const net = gross - totalDeductions;

    setForm(prev => ({
      ...prev,
      basicSalary: basic.toFixed(2),
      grossSalary: gross.toFixed(2),
      netSalary: net.toFixed(2),
      // Don't update deductions field to avoid infinite loop - keep manual deductions separate
      ...calculatedValues
    }));
  };

  useEffect(() => {
    calculateSalaries();
  }, [form.calculationMethod, form.hoursWorked, form.hourlyRate, form.basicSalary, form.allowances, form.overtime, form.bonus, form.autoCalculate, form.employeeEPF, form.employeeEIS, form.employeeSOCSO, form.zakat, form.mtdPCB, form.loanDeduction, form.insurance, form.advanceSalary, form.uniformEquipment, form.disciplinaryFine, form.otherMisc]);

  const handleCreatePayslip = async () => {
    if (!form.employeeId || !form.month || !form.basicSalary) {
      setError('Employee, month, and basic salary are required');
      return;
    }

    try {
      const selectedEmployee = employees.find(emp => emp.id === form.employeeId);
      
      const newPayslip = {
        employeeId: form.employeeId,
        employeeName: selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : form.employeeName,
        employeeEmail: selectedEmployee ? selectedEmployee.email : form.employeeEmail,
        month: form.month,
        calculationMethod: form.calculationMethod,
        paymentMethod: form.paymentMethod || 'GIRO',
        message: form.message || '',
        hoursWorked: (form.calculationMethod === 'hourly' || form.calculationMethod === 'attendance') ? parseFloat(form.hoursWorked) : null,
        hourlyRate: (form.calculationMethod === 'hourly' || form.calculationMethod === 'attendance') ? parseFloat(form.hourlyRate) : null,
        basicSalary: parseFloat(form.basicSalary),
        allowances: parseFloat(form.allowances) || 0,
        overtime: parseFloat(form.overtime) || 0,
        bonus: parseFloat(form.bonus) || 0,
        grossSalary: parseFloat(form.grossSalary),
        netSalary: parseFloat(form.netSalary),
        status: form.status,
        createdBy: user.uid,
        createdByName: `${user.firstName} ${user.lastName}`,
        company: selectedEmployee ? (selectedEmployee.originalCompanyName || selectedEmployee.company || 'RUBIX') : (user.company || user.originalCompanyName || 'RUBIX'),

        // Detailed breakdown fields
        employeeEPF: parseFloat(form.employeeEPF) || 0,
        employeeEIS: parseFloat(form.employeeEIS) || 0,
        employeeSOCSO: parseFloat(form.employeeSOCSO) || 0,
        employerEPF: parseFloat(form.employerEPF) || 0,
        employerEIS: parseFloat(form.employerEIS) || 0,
        employerSOCSO: parseFloat(form.employerSOCSO) || 0,
        zakat: parseFloat(form.zakat) || 0,
        mtdPCB: parseFloat(form.mtdPCB) || 0,
        
        // Specific other deductions
        loanDeduction: parseFloat(form.loanDeduction) || 0,
        insurance: parseFloat(form.insurance) || 0,
        advanceSalary: parseFloat(form.advanceSalary) || 0,
        uniformEquipment: parseFloat(form.uniformEquipment) || 0,
        disciplinaryFine: parseFloat(form.disciplinaryFine) || 0,
        otherMisc: parseFloat(form.otherMisc) || 0,
        
        autoCalculate: form.autoCalculate,
        
        // Add attendance data if available
        ...(form.calculationMethod === 'attendance' && attendanceData ? {
          attendanceSummary: attendanceData.summary,
          attendanceInsights: attendanceInsights,
          dataSource: 'attendance-system'
        } : {}),
        
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'payslips'), newPayslip);
      setSuccess('Payslip created successfully');
      setCreateDialog(false);
      resetForm();
      await loadPayslips();
    } catch (error) {
      console.error('Error creating payslip:', error);
      setError('Failed to create payslip: ' + error.message);
    }
  };

  const handleUpdatePayslip = async () => {
    if (!selectedPayslip || !selectedPayslip.id) {
      setError('No payslip selected for update');
      return;
    }
    
    if (!form.employeeId || !form.month || !form.basicSalary) {
      setError('Employee, month, and basic salary are required');
      return;
    }

    try {
      const payslipRef = doc(db, 'payslips', selectedPayslip.id);
      await updateDoc(payslipRef, {
        month: form.month,
        paymentMethod: form.paymentMethod || 'GIRO',
        message: form.message || '',
        basicSalary: parseFloat(form.basicSalary),
        allowances: parseFloat(form.allowances) || 0,
        overtime: parseFloat(form.overtime) || 0,
        bonus: parseFloat(form.bonus) || 0,
        grossSalary: parseFloat(form.grossSalary),
        netSalary: parseFloat(form.netSalary),
        status: form.status,

        // Detailed breakdown fields
        employeeEPF: parseFloat(form.employeeEPF) || 0,
        employeeEIS: parseFloat(form.employeeEIS) || 0,
        employeeSOCSO: parseFloat(form.employeeSOCSO) || 0,
        employerEPF: parseFloat(form.employerEPF) || 0,
        employerEIS: parseFloat(form.employerEIS) || 0,
        employerSOCSO: parseFloat(form.employerSOCSO) || 0,
        zakat: parseFloat(form.zakat) || 0,
        mtdPCB: parseFloat(form.mtdPCB) || 0,
        
        // Specific other deductions
        loanDeduction: parseFloat(form.loanDeduction) || 0,
        insurance: parseFloat(form.insurance) || 0,
        advanceSalary: parseFloat(form.advanceSalary) || 0,
        uniformEquipment: parseFloat(form.uniformEquipment) || 0,
        disciplinaryFine: parseFloat(form.disciplinaryFine) || 0,
        otherMisc: parseFloat(form.otherMisc) || 0,
        
        autoCalculate: form.autoCalculate,
        
        updatedAt: serverTimestamp()
      });

      setSuccess('Payslip updated successfully');
      setEditDialog(false);
      resetForm();
      setSelectedPayslip(null);
      await loadPayslips();
    } catch (error) {
      console.error('Error updating payslip:', error);
      setError('Failed to update payslip: ' + error.message);
    }
  };

  const handleDeletePayslip = async (payslipId) => {
    if (window.confirm('Are you sure you want to delete this payslip?')) {
      try {
        await deleteDoc(doc(db, 'payslips', payslipId));
        setSuccess('Payslip deleted successfully');
        await loadPayslips();
      } catch (error) {
        console.error('Error deleting payslip:', error);
        setError('Failed to delete payslip: ' + error.message);
      }
    }
  };

  const resetForm = () => {
    setForm({
      employeeId: '',
      employeeName: '',
      employeeEmail: '',
      month: format(new Date(), 'yyyy-MM'),
      hoursWorked: '',
      hourlyRate: '',
      basicSalary: '',
      allowances: '',
      overtime: '',
      bonus: '',
      grossSalary: '',
      netSalary: '',
      status: 'draft',
      calculationMethod: 'hourly',
      paymentMethod: 'GIRO',
      message: '',

      // Detailed breakdown fields
      employeeEPF: '',
      employeeEIS: '',
      employeeSOCSO: '',
      employerEPF: '',
      employerEIS: '',
      employerSOCSO: '',
      zakat: '',
      mtdPCB: '',
      
      // Specific other deductions
      loanDeduction: '',
      insurance: '',
      advanceSalary: '',
      uniformEquipment: '',
      disciplinaryFine: '',
      otherMisc: '',
      
      autoCalculate: true
    });
    
    // Reset attendance data
    setAttendanceData(null);
    setAttendanceInsights([]);
    setAttendanceLoading(false);
  };

  const handleMenuClick = (event, payslip) => {
    setAnchorEl(event.currentTarget);
    setSelectedPayslip(payslip);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    // Don't clear selectedPayslip here - it's needed for edit dialog
  };

  const handleEdit = () => {
    if (selectedPayslip && selectedPayslip.id) {
      setForm({
        employeeId: selectedPayslip.employeeId || '',
        employeeName: selectedPayslip.employeeName || '',
        employeeEmail: selectedPayslip.employeeEmail || '',
        month: selectedPayslip.month || '',
        basicSalary: (selectedPayslip.basicSalary || 0).toString(),
        allowances: (selectedPayslip.allowances || 0).toString(),
        overtime: (selectedPayslip.overtime || 0).toString(),
        bonus: (selectedPayslip.bonus || 0).toString(),
        grossSalary: (selectedPayslip.grossSalary || 0).toString(),
        netSalary: (selectedPayslip.netSalary || 0).toString(),
        status: selectedPayslip.status || 'draft',
        calculationMethod: selectedPayslip.calculationMethod || 'hourly',
        paymentMethod: selectedPayslip.paymentMethod || 'GIRO',
        message: selectedPayslip.message || '',
        hoursWorked: (selectedPayslip.hoursWorked || '').toString(),
        hourlyRate: (selectedPayslip.hourlyRate || '').toString(),

        // Detailed breakdown fields
        employeeEPF: (selectedPayslip.employeeEPF || 0).toString(),
        employeeEIS: (selectedPayslip.employeeEIS || 0).toString(),
        employeeSOCSO: (selectedPayslip.employeeSOCSO || 0).toString(),
        employerEPF: (selectedPayslip.employerEPF || 0).toString(),
        employerEIS: (selectedPayslip.employerEIS || 0).toString(),
        employerSOCSO: (selectedPayslip.employerSOCSO || 0).toString(),
        zakat: (selectedPayslip.zakat || 0).toString(),
        mtdPCB: (selectedPayslip.mtdPCB || 0).toString(),
        
        // Specific other deductions
        loanDeduction: (selectedPayslip.loanDeduction || 0).toString(),
        insurance: (selectedPayslip.insurance || 0).toString(),
        advanceSalary: (selectedPayslip.advanceSalary || 0).toString(),
        uniformEquipment: (selectedPayslip.uniformEquipment || 0).toString(),
        disciplinaryFine: (selectedPayslip.disciplinaryFine || 0).toString(),
        otherMisc: (selectedPayslip.otherMisc || 0).toString(),
        
        autoCalculate: selectedPayslip.autoCalculate !== undefined ? selectedPayslip.autoCalculate : true
      });
      setEditDialog(true);
    } else {
      setError('No payslip selected for editing');
      setSelectedPayslip(null);
    }
    handleMenuClose();
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'draft': return 'warning';
      case 'approved': return 'success';
      case 'paid': return 'info';
      default: return 'default';
    }
  };

  const loadImageAsBase64 = (imagePath) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = imagePath;
    });
  };

  const handleDownloadPDF = async () => {
    if (!selectedPayslip) return;

    try {
      setError('');

      // Use the same PDF service that users use for consistent layout
      const success = await pdfService.exportPayslip(selectedPayslip);

      if (success) {
        setSuccess('Payslip PDF downloaded successfully');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError('Failed to generate PDF. Please try again.');
      }

    } catch (error) {
      console.error('Error generating PDF:', error);
      setError('Failed to generate PDF: ' + error.message);
    }

    handleMenuClose();
    setSelectedPayslip(null);
  };


  const loadAttendanceData = async (employeeId, month) => {
    if (!employeeId || !month) return;
    
    setAttendanceLoading(true);
    try {
      const [year, monthNum] = month.split('-');
      const attendanceRecords = await loadEmployeeAttendanceForMonth(
        employeeId, 
        parseInt(year), 
        parseInt(monthNum)
      );
      
      if (attendanceRecords.length > 0) {
        const attendanceSummary = calculateMonthlyAttendanceSummary(attendanceRecords);
        const insights = getAttendanceInsights(attendanceSummary);
        
        setAttendanceData(attendanceSummary);
        setAttendanceInsights(insights);
        
        console.log('📊 Attendance data loaded:', attendanceSummary);
        return attendanceSummary;
      } else {
        setAttendanceData(null);
        setAttendanceInsights([]);
        return null;
      }
    } catch (error) {
      console.error('Error loading attendance data:', error);
      setError('Failed to load attendance data: ' + error.message);
      return null;
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleCalculateFromAttendance = async () => {
    if (!form.employeeId || !form.month) {
      setError('Please select an employee and month first');
      return;
    }

    const selectedEmployee = employees.find(emp => emp.id === form.employeeId);
    if (!selectedEmployee) {
      setError('Selected employee not found');
      return;
    }

    // Check if employee has salary data
    if (!selectedEmployee.salary) {
      setError(`No salary data found for ${selectedEmployee.firstName} ${selectedEmployee.lastName}. Please update employee profile.`);
      return;
    }

    try {
      const [year, monthNum] = form.month.split('-');
      // Calculate based on employee's salary data and attendance
      const attendanceRecords = await loadEmployeeAttendanceForMonth(
        selectedEmployee.id,
        parseInt(year),
        parseInt(monthNum)
      );
      
      let attendanceBasedData = null;
      if (attendanceRecords && attendanceRecords.length > 0) {
        const attendanceSummary = calculateMonthlyAttendanceSummary(attendanceRecords);
        const regularHours = attendanceSummary.totalRegularHours || 0;
        const overtimeHours = attendanceSummary.totalOvertimeHours || 0;
        const hourlyRate = selectedEmployee.salary.hourlyRate || 25;
        
        attendanceBasedData = {
          hoursWorked: regularHours,
          hourlyRate: hourlyRate,
          basicSalary: (regularHours * hourlyRate).toFixed(2),
          allowances: (selectedEmployee.salary.allowances || 0).toFixed(2),
          overtimePay: (overtimeHours * hourlyRate * 1.5).toFixed(2),
          grossSalary: ((regularHours * hourlyRate) + (selectedEmployee.salary.allowances || 0) + (overtimeHours * hourlyRate * 1.5)).toFixed(2),
          netSalary: ((regularHours * hourlyRate) + (selectedEmployee.salary.allowances || 0) + (overtimeHours * hourlyRate * 1.5)).toFixed(2)
        };
      }

      if (attendanceBasedData) {
        setForm(prev => ({
          ...prev,
          calculationMethod: 'attendance',
          hoursWorked: attendanceBasedData.hoursWorked,
          hourlyRate: attendanceBasedData.hourlyRate.toString(),
          basicSalary: attendanceBasedData.basicSalary,
          allowances: attendanceBasedData.allowances,
          deductions: attendanceBasedData.deductions,
          overtime: attendanceBasedData.overtimePay,
          bonus: '0',
          grossSalary: attendanceBasedData.grossSalary,
          netSalary: attendanceBasedData.netSalary
        }));

        // Load attendance data for display
        await loadAttendanceData(form.employeeId, form.month);
        
        setSuccess('Payslip calculated from attendance data!');
        setTimeout(() => setSuccess(''), 5000);
      } else {
        setError('No attendance records found for the selected month');
      }
    } catch (error) {
      console.error('Error calculating from attendance:', error);
      setError('Failed to calculate from attendance: ' + error.message);
    }
  };

  const handleEmployeeChange = async (employeeId) => {
    const selectedEmployee = employees.find(emp => emp.id === employeeId);
    if (selectedEmployee) {
      try {
        // Use salary data from user record
        const salaryData = selectedEmployee.salary || {};
        const basicSalary = salaryData.basicSalary || (salaryData.hourlyRate * 160) || 0;
        const allowances = salaryData.allowances || 0;
        const grossSalary = basicSalary + allowances;
        
        setForm(prev => ({
          ...prev,
          employeeId,
          employeeName: `${selectedEmployee.firstName} ${selectedEmployee.lastName}`,
          employeeEmail: selectedEmployee.email,
          basicSalary: basicSalary.toString(),
          allowances: allowances.toString(),
          hourlyRate: (salaryData.hourlyRate || 25).toString(),
          hoursWorked: '160',
          grossSalary: grossSalary.toString(),
          netSalary: grossSalary.toString(),
          overtime: '0',
          bonus: '0'
        }));
        
        if (salaryData.basicSalary || salaryData.hourlyRate) {
          setSuccess(`Applied salary data for ${selectedEmployee.firstName} ${selectedEmployee.lastName}`);
        } else {
          setSuccess(`Using default values for ${selectedEmployee.firstName} ${selectedEmployee.lastName}. Please update employee salary data.`);
        }
        setTimeout(() => setSuccess(''), 3000);
        
      } catch (error) {
        console.error('Error calculating employee salary:', error);
        
        // Basic fallback
        setForm(prev => ({
          ...prev,
          employeeId,
          employeeName: `${selectedEmployee.firstName} ${selectedEmployee.lastName}`,
          employeeEmail: selectedEmployee.email,
          hourlyRate: '25',
          hoursWorked: '160',
          basicSalary: '4000',
          allowances: '0',
          overtime: '0',
          bonus: '0'
        }));
        
        setError(`Using default salary values for ${selectedEmployee.firstName}. Please update employee profile with salary data.`);
        setTimeout(() => setError(''), 3000);
      }

      // Load attendance data when employee and month are selected
      if (form.month) {
        await loadAttendanceData(employeeId, form.month);
      }
    }
  };

  const handleMonthChange = async (month) => {
    setForm(prev => ({ ...prev, month }));
    
    // Load attendance data when month changes and employee is selected
    if (form.employeeId) {
      await loadAttendanceData(form.employeeId, month);
    }
  };


  // Search and filter functions
  const filterPayslips = (payslips, query, dateFrom, dateTo) => {
    let filtered = [...payslips];

    // Search by employee name or email
    if (query.trim()) {
      const searchTerm = query.toLowerCase().trim();
      filtered = filtered.filter(payslip => 
        payslip.employeeName?.toLowerCase().includes(searchTerm) ||
        payslip.employeeEmail?.toLowerCase().includes(searchTerm)
      );
    }

    // Filter by date range
    if (dateFrom) {
      const fromDate = new Date(dateFrom + '-01');
      filtered = filtered.filter(payslip => {
        const payslipDate = new Date(payslip.month + '-01');
        return payslipDate >= fromDate;
      });
    }

    if (dateTo) {
      const toDate = new Date(dateTo + '-01');
      filtered = filtered.filter(payslip => {
        const payslipDate = new Date(payslip.month + '-01');
        return payslipDate <= toDate;
      });
    }

    return filtered;
  };

  // Update filtered payslips whenever search or date filters change
  useEffect(() => {
    const filtered = filterPayslips(payslips, searchQuery, dateFilter.from, dateFilter.to);
    setFilteredPayslips(filtered);
  }, [payslips, searchQuery, dateFilter]);

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
  };

  const handleDateFilterChange = (field, value) => {
    setDateFilter(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearFilters = () => {
    setSearchQuery('');
    setDateFilter({ from: '', to: '' });
  };

  // Bulk update functions
  const handleSelectAllPayslips = () => {
    const draftPayslipIds = filteredPayslips
      .filter(payslip => payslip.status === 'draft')
      .map(payslip => payslip.id);
    
    if (allDraftsSelected) {
      // If all are selected, deselect all
      setSelectedPayslips([]);
    } else {
      // If not all are selected, select all draft payslips
      setSelectedPayslips(draftPayslipIds);
    }
  };

  const handleSelectPayslip = (payslipId, checked) => {
    if (checked) {
      setSelectedPayslips(prev => [...prev, payslipId]);
    } else {
      setSelectedPayslips(prev => prev.filter(id => id !== payslipId));
    }
  };

  const handleBulkUpdateStatus = async () => {
    if (selectedPayslips.length === 0) {
      setError('Please select payslips to update');
      return;
    }

    const confirmMessage = `Are you sure you want to update ${selectedPayslips.length} payslip(s) from Draft to Approved?`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setBulkUpdateLoading(true);
    try {
      // Update each selected payslip
      const updatePromises = selectedPayslips.map(payslipId => 
        updateDoc(doc(db, 'payslips', payslipId), {
          status: 'approved',
          approvedAt: serverTimestamp(),
          approvedBy: user.uid,
          approvedByName: `${user.firstName} ${user.lastName}`,
          updatedAt: serverTimestamp()
        })
      );

      await Promise.all(updatePromises);
      
      setSuccess(`Successfully updated ${selectedPayslips.length} payslip(s) to Approved status`);
      setSelectedPayslips([]); // Clear selection
      await loadPayslips(); // Refresh the list
    } catch (error) {
      console.error('Error bulk updating payslips:', error);
      setError('Failed to bulk update payslips: ' + error.message);
    } finally {
      setBulkUpdateLoading(false);
    }
  };

  const handleAutoGenerate = async () => {
    if (!window.confirm('This will automatically generate draft payslips for all employees using their salary data from their profiles. Continue?')) {
      return;
    }

    setAutoGenerating(true);
    setError('');
    setSuccess('');

    try {
      console.log('🔄 Starting manual payslip generation...');
      
      const result = await manualPayslipGeneration();
      
      if (result.success) {
        const message = `Successfully generated ${result.created} payslip(s) for ${result.month}. ${result.errors > 0 ? `${result.errors} errors occurred.` : ''}`;
        setSuccess(message);
        
        // Refresh the payslips list
        await loadPayslips();
        
        console.log('✅ Auto-generation completed:', result);
      } else {
        setError(`Failed to generate payslips: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Error in auto-generation:', error);
      setError('Failed to generate payslips: ' + error.message);
    } finally {
      setAutoGenerating(false);
    }
  };

  const handleRemoveAllDrafts = async () => {
    const allDraftPayslips = filteredPayslips.filter(p => p.status === 'draft');
    
    if (allDraftPayslips.length === 0) {
      setError('No draft payslips found to remove');
      return;
    }

    const confirmMessage = `Are you sure you want to permanently delete ALL ${allDraftPayslips.length} draft payslip(s)? This action cannot be undone.`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setRemoveAllDraftsLoading(true);
    try {
      // Delete all draft payslips
      const deletePromises = allDraftPayslips.map(payslip => 
        deleteDoc(doc(db, 'payslips', payslip.id))
      );

      await Promise.all(deletePromises);
      
      setSuccess(`Successfully removed all ${allDraftPayslips.length} draft payslip(s)`);
      setSelectedPayslips([]); // Clear selection
      await loadPayslips(); // Refresh the list
    } catch (error) {
      console.error('Error removing all draft payslips:', error);
      setError('Failed to remove all draft payslips: ' + error.message);
    } finally {
      setRemoveAllDraftsLoading(false);
    }
  };

  const handleBulkDeletePayslips = async () => {
    if (selectedPayslips.length === 0) {
      setError('Please select payslips to delete');
      return;
    }

    const confirmMessage = `Are you sure you want to permanently delete ${selectedPayslips.length} selected payslip(s)? This action cannot be undone.`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setBulkDeleteLoading(true);
    try {
      // Delete each selected payslip
      const deletePromises = selectedPayslips.map(payslipId => 
        deleteDoc(doc(db, 'payslips', payslipId))
      );

      await Promise.all(deletePromises);
      
      setSuccess(`Successfully deleted ${selectedPayslips.length} payslip(s)`);
      setSelectedPayslips([]); // Clear selection
      await loadPayslips(); // Refresh the list
    } catch (error) {
      console.error('Error bulk deleting payslips:', error);
      setError('Failed to bulk delete payslips: ' + error.message);
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  // Check if we have any draft payslips selected
  const hasSelectedDrafts = selectedPayslips.length > 0;
  const draftPayslipsInView = filteredPayslips.filter(p => p.status === 'draft');
  const allDraftsSelected = draftPayslipsInView.length > 0 && draftPayslipsInView.every(p => selectedPayslips.includes(p.id));
  const someDraftsSelected = draftPayslipsInView.some(p => selectedPayslips.includes(p.id));

  // Pagination logic following Leaves.js pattern
  const totalPages = Math.max(1, Math.ceil(filteredPayslips.length / payslipsPerPage));
  
  // Ensure currentPage doesn't exceed available pages
  const safePage = Math.min(currentPage, Math.max(0, totalPages - 1));

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery, dateFilter.from, dateFilter.to]);

  const handleNextPage = () => {
    if (totalPages > 1) {
      const nextPage = (safePage + 1) % totalPages;
      setCurrentPage(nextPage);
    }
  };

  const handlePrevPage = () => {
    if (totalPages > 1) {
      const prevPage = (safePage - 1 + totalPages) % totalPages;
      setCurrentPage(prevPage);
    }
  };

  // Get paginated data
  const getPaginatedPayslips = () => {
    const startIndex = safePage * payslipsPerPage;
    return filteredPayslips.slice(startIndex, startIndex + payslipsPerPage);
  };

  // Get paginated payslips for display
  const paginatedPayslips = getPaginatedPayslips();

  const totalPayslips = payslips.length;
  const draftPayslips = payslips.filter(p => p.status === 'draft').length;
  const approvedPayslips = payslips.filter(p => p.status === 'approved').length;
  const totalSalaryAmount = payslips.reduce((sum, p) => sum + (p.netSalary || 0), 0);
  
  // Filtered statistics
  const filteredDrafts = filteredPayslips.filter(p => p.status === 'draft').length;
  const filteredApproved = filteredPayslips.filter(p => p.status === 'approved').length;
  const filteredSalaryAmount = filteredPayslips.reduce((sum, p) => sum + (p.netSalary || 0), 0);

  return (
    <Container 
      maxWidth="lg" 
      sx={{ 
        py: { xs: 2, sm: 3 },
        // Disable touch gestures on entire container for mobile
        touchAction: isMobile ? 'pan-y' : 'auto',
        userSelect: isMobile ? 'none' : 'auto'
      }}
    >
      {/* Enhanced Welcome Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar 
              sx={{ 
                bgcolor: 'primary.main', 
                mr: 2,
                width: { xs: 48, sm: 56 }, 
                height: { xs: 48, sm: 56 },
                boxShadow: '0 4px 15px rgba(25, 118, 210, 0.3)'
              }}
            >
              <Payment sx={{ fontSize: { xs: 24, sm: 28 } }} />
            </Avatar>
            <Box>
              <Typography 
                variant="h4" 
                sx={{ 
                  fontSize: { xs: '1.75rem', sm: '2.5rem' },
                  fontWeight: 700,
                  background: 'linear-gradient(45deg, #1976d2, #42a5f5)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  mb: 0.5
                }}
              >
                Payslip Management
              </Typography>
              <Typography 
                variant="subtitle1" 
                color="text.secondary" 
                sx={{ 
                  fontSize: { xs: '1rem', sm: '1.125rem' },
                  fontWeight: 500
                }}
              >
                Create and manage employee payslips with automatic generation
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
            <Button
              variant="outlined"
              onClick={handleAutoGenerate}
              startIcon={autoGenerating ? <CircularProgress size={20} /> : <AutoAwesome />}
              disabled={autoGenerating}
              sx={{
                borderRadius: 3,
                fontWeight: 600,
                textTransform: 'none',
                px: 3,
                order: { xs: 3, sm: 1 }
              }}
            >
              {autoGenerating ? 'Generating...' : 'Auto Generate'}
            </Button>
            <Fab 
              color="primary" 
              variant="extended"
              onClick={() => setCreateDialog(true)}
              size={isMobile ? "medium" : "large"}
              sx={{
                position: { xs: 'fixed', sm: 'relative' },
                bottom: { xs: 16, sm: 'auto' },
                right: { xs: 16, sm: 'auto' },
                zIndex: { xs: 1000, sm: 'auto' },
                py: 1.5,
                px: 3,
                borderRadius: 3,
                fontWeight: 600,
                textTransform: 'none',
                boxShadow: '0 4px 15px rgba(25, 118, 210, 0.3)',
                order: { xs: 1, sm: 3 },
                '&:hover': {
                  boxShadow: '0 6px 20px rgba(25, 118, 210, 0.4)',
                  transform: 'translateY(-1px)'
                }
              }}
            >
              <Add sx={{ mr: 1 }} />
              {isMobile ? 'New' : 'Create Payslip'}
            </Fab>
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

      {/* Enhanced Summary Cards */}
      <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mb: { xs: 2, sm: 4 } }}>
        <Grid item xs={6} sm={6} md={3}>
          <Card
            sx={{
              height: '100%',
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              border: '1px solid',
              borderColor: 'divider',
              background: (theme) => theme.palette.mode === 'dark'
                ? 'linear-gradient(135deg, #1a1a1a 0%, #0d2137 100%)'
                : 'linear-gradient(135deg, #ffffff 0%, #e3f2fd 100%)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
                borderColor: 'primary.light'
              }
            }}
          >
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: { xs: 'column', sm: 'row' } }}>
                <Avatar sx={{ 
                  bgcolor: 'primary.main', 
                  mr: { xs: 0, sm: 2 }, 
                  mb: { xs: 1, sm: 0 },
                  width: { xs: 40, sm: 48 },
                  height: { xs: 40, sm: 48 },
                  boxShadow: '0 4px 15px rgba(25, 118, 210, 0.3)'
                }}>  
                  <Payment sx={{ fontSize: { xs: 20, sm: 24 } }} />
                </Avatar>
                <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
                  <Typography 
                    variant="h5" 
                    sx={{ 
                      fontSize: { xs: '1.125rem', sm: '1.5rem' },
                      fontWeight: 600,
                      color: 'primary.main'
                    }}
                  >
                    {totalPayslips}
                  </Typography>
                  <Typography 
                    color="text.secondary" 
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      fontWeight: 500
                    }}
                  >
                    Total Payslips
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6} sm={6} md={3}>
          <Card
            sx={{
              height: '100%',
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              border: '1px solid',
              borderColor: 'divider',
              background: (theme) => theme.palette.mode === 'dark'
                ? 'linear-gradient(135deg, #1a1a1a 0%, #2b1d0d 100%)'
                : 'linear-gradient(135deg, #ffffff 0%, #fff3e0 100%)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
                borderColor: 'warning.light'
              }
            }}
          >
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: { xs: 'column', sm: 'row' } }}>
                <Avatar sx={{ 
                  bgcolor: 'warning.main', 
                  mr: { xs: 0, sm: 2 }, 
                  mb: { xs: 1, sm: 0 },
                  width: { xs: 40, sm: 48 },
                  height: { xs: 40, sm: 48 },
                  boxShadow: '0 4px 15px rgba(237, 108, 2, 0.3)'
                }}>  
                  <Edit sx={{ fontSize: { xs: 20, sm: 24 } }} />
                </Avatar>
                <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
                  <Typography 
                    variant="h5" 
                    sx={{ 
                      fontSize: { xs: '1.125rem', sm: '1.5rem' },
                      fontWeight: 600,
                      color: 'warning.main'
                    }}
                  >
                    {draftPayslips}
                  </Typography>
                  <Typography 
                    color="text.secondary" 
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      fontWeight: 500
                    }}
                  >
                    Draft
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6} sm={6} md={3}>
          <Card
            sx={{
              height: '100%',
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              border: '1px solid',
              borderColor: 'divider',
              background: (theme) => theme.palette.mode === 'dark'
                ? 'linear-gradient(135deg, #1a1a1a 0%, #0d2b0f 100%)'
                : 'linear-gradient(135deg, #ffffff 0%, #e8f5e8 100%)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
                borderColor: 'success.light'
              }
            }}
          >
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: { xs: 'column', sm: 'row' } }}>
                <Avatar sx={{ 
                  bgcolor: 'success.main', 
                  mr: { xs: 0, sm: 2 }, 
                  mb: { xs: 1, sm: 0 },
                  width: { xs: 40, sm: 48 },
                  height: { xs: 40, sm: 48 },
                  boxShadow: '0 4px 15px rgba(46, 125, 50, 0.3)'
                }}>  
                  <Visibility sx={{ fontSize: { xs: 20, sm: 24 } }} />
                </Avatar>
                <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
                  <Typography 
                    variant="h5" 
                    sx={{ 
                      fontSize: { xs: '1.125rem', sm: '1.5rem' },
                      fontWeight: 600,
                      color: 'success.main'
                    }}
                  >
                    {approvedPayslips}
                  </Typography>
                  <Typography 
                    color="text.secondary" 
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      fontWeight: 500
                    }}
                  >
                    Approved
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6} sm={6} md={3}>
          <Card
            sx={{
              height: '100%',
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              border: '1px solid',
              borderColor: 'divider',
              background: (theme) => theme.palette.mode === 'dark'
                ? 'linear-gradient(135deg, #1a1a1a 0%, #0d2935 100%)'
                : 'linear-gradient(135deg, #ffffff 0%, #e1f5fe 100%)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
                borderColor: 'info.light'
              }
            }}
          >
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: { xs: 'column', sm: 'row' } }}>
                <Avatar sx={{ 
                  bgcolor: 'info.main', 
                  mr: { xs: 0, sm: 2 }, 
                  mb: { xs: 1, sm: 0 },
                  width: { xs: 40, sm: 48 },
                  height: { xs: 40, sm: 48 },
                  boxShadow: '0 4px 15px rgba(2, 136, 209, 0.3)'
                }}>  
                  <AttachMoney sx={{ fontSize: { xs: 20, sm: 24 } }} />
                </Avatar>
                <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
                  <Typography 
                    variant="h5" 
                    sx={{ 
                      fontSize: { xs: '1.125rem', sm: '1.5rem' },
                      fontWeight: 600,
                      color: 'info.main'
                    }}
                  >
                    RM {totalSalaryAmount.toFixed(2)}
                  </Typography>
                  <Typography 
                    color="text.secondary" 
                    sx={{ 
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      fontWeight: 500
                    }}
                  >
                    Total Amount
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search and Filter Section */}
      <Paper 
        elevation={0}
        sx={{
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          mb: 3
        }}
      >
        <Box sx={{ p: 3 }}>
          <Typography 
            variant="h6"
            sx={{ 
              fontWeight: 600,
              color: 'primary.main',
              mb: 3,
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <FilterList sx={{ mr: 1 }} />
            Search & Filter
          </Typography>
          
          <Grid container spacing={3}>
            {/* Search Field */}
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search by employee name or email..."
                value={searchQuery}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2
                  }
                }}
              />
            </Grid>
            
            {/* Date Range Filter */}
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="From Month"
                type="month"
                value={dateFilter.from}
                onChange={(e) => handleDateFilterChange('from', e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2
                  }
                }}
              />
            </Grid>
            
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="To Month"
                type="month"
                value={dateFilter.to}
                onChange={(e) => handleDateFilterChange('to', e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2
                  }
                }}
              />
            </Grid>
            
            {/* Clear Filters Button */}
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="outlined"
                onClick={clearFilters}
                sx={{ 
                  height: '56px',
                  borderRadius: 2
                }}
              >
                Clear Filters
              </Button>
            </Grid>
          </Grid>
          
          {/* Filter Results Info */}
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Showing {filteredPayslips.length} of {payslips.length} payslips
              {searchQuery && ` • Search: "${searchQuery}"`}
              {(dateFilter.from || dateFilter.to) && ` • Date filtered`}
              {draftPayslipsInView.length > 0 && ` • ${draftPayslipsInView.length} drafts available`}
              {selectedPayslips.length > 0 && ` • ${selectedPayslips.length} selected`}
            </Typography>
            
            {selectedPayslips.length > 0 && (
              <Chip 
                label={`${selectedPayslips.length} selected`}
                color="primary"
                size="small"
                variant="filled"
              />
            )}
          </Box>
        </Box>
      </Paper>

      {/* Bulk Actions Section */}
      {hasSelectedDrafts && (
        <Paper 
          elevation={0}
          sx={{
            borderRadius: 3,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            border: '2px solid',
            borderColor: 'primary.main',
            overflow: 'hidden',
            mb: 3,
            background: 'linear-gradient(135deg, #e3f2fd 0%, #ffffff 100%)'
          }}
        >
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Update sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" color="primary.main" sx={{ fontWeight: 600 }}>
                  Bulk Actions
                </Typography>
                <Chip 
                  label={`${selectedPayslips.length} selected`}
                  color="primary"
                  size="small"
                  sx={{ ml: 2 }}
                />
              </Box>
              
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {hasSelectedDrafts && (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleBulkUpdateStatus}
                    disabled={bulkUpdateLoading || selectedPayslips.length === 0}
                    startIcon={bulkUpdateLoading ? <CircularProgress size={20} /> : <Update />}
                    sx={{
                      borderRadius: 2,
                      fontWeight: 600,
                      px: 3
                    }}
                  >
                    {bulkUpdateLoading ? 'Updating...' : 'Update to Approved'}
                  </Button>
                )}
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleBulkDeletePayslips}
                  disabled={bulkDeleteLoading || selectedPayslips.length === 0}
                  startIcon={bulkDeleteLoading ? <CircularProgress size={20} /> : <Delete />}
                  sx={{
                    borderRadius: 2,
                    fontWeight: 600,
                    px: 3,
                    borderColor: 'error.main',
                    '&:hover': {
                      borderColor: 'error.dark',
                      backgroundColor: 'error.50'
                    }
                  }}
                >
                  {bulkDeleteLoading ? 'Deleting...' : 'Delete Selected'}
                </Button>
              </Box>
            </Box>
            
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {hasSelectedDrafts ? 
                'Update selected draft payslips to approved status, remove all drafts, or delete selected payslips.' :
                'Remove all draft payslips or permanently delete selected payslips.'
              } These actions cannot be undone.
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Enhanced Payslips Table */}
      <Paper 
        elevation={0}
        sx={{
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          // Disable touch gestures on mobile
          touchAction: 'pan-y pinch-zoom',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none'
        }}
      >
        <Box sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography 
              variant="h6"
              sx={{ 
                fontWeight: 600,
                color: 'primary.main'
              }}
            >
              All Payslips
            </Typography>
            
            {/* Bulk Select Checkbox */}
            {draftPayslipsInView.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                  Select all drafts ({draftPayslipsInView.length}):
                </Typography>
                <IconButton
                  onClick={handleSelectAllPayslips}
                  sx={{ 
                    p: 1,
                    '&:hover': {
                      backgroundColor: 'primary.50'
                    }
                  }}
                >
                  {allDraftsSelected ? (
                    <CheckBox color="primary" />
                  ) : someDraftsSelected ? (
                    <CheckBox 
                      color="primary" 
                      sx={{ 
                        '& .MuiSvgIcon-root': {
                          fontSize: '1.2rem'
                        }
                      }}
                    />
                  ) : (
                    <CheckBoxOutlineBlank />
                  )}
                </IconButton>
                {selectedPayslips.length > 0 && (
                  <Chip 
                    label={`${selectedPayslips.length} selected`}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ ml: 1 }}
                  />
                )}
              </Box>
            )}
          </Box>
        </Box>
        <Divider />
        
{/* Conditional rendering: Cards on mobile, Table on desktop */}
        {isMobile ? (
          /* Mobile Card Layout */
          <Box sx={{ p: 1 }}>
            {paginatedPayslips.map((payslip) => {
              const isSelected = selectedPayslips.includes(payslip.id);
              const isDraft = payslip.status === 'draft';
              
              return (
                <Card 
                  key={payslip.id} 
                  sx={{ 
                    mb: 2, 
                    border: isSelected ? 2 : 1,
                    borderColor: isSelected ? 'primary.main' : 'divider',
                    backgroundColor: isSelected ? 'primary.50' : 'background.paper',
                    touchAction: 'pan-y'
                  }}
                >
                  <CardContent sx={{ p: 2 }}>
                    {/* Header with selection and actions */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {isDraft && (
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectPayslip(payslip.id, !isSelected);
                            }}
                            size="small"
                            sx={{ mr: 1 }}
                          >
                            {isSelected ? (
                              <CheckBox color="primary" />
                            ) : (
                              <CheckBoxOutlineBlank />
                            )}
                          </IconButton>
                        )}
                        <Chip 
                          label={payslip.status.charAt(0).toUpperCase() + payslip.status.slice(1)}
                          color={getStatusColor(payslip.status)}
                          size="small"
                          sx={{ fontSize: '0.75rem' }}
                        />
                      </Box>
                      <IconButton 
                        onClick={(e) => handleMenuClick(e, payslip)}
                        size="small"
                      >
                        <MoreVert />
                      </IconButton>
                    </Box>

                    {/* Employee Info */}
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                        {payslip.employeeName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        {payslip.employeeEmail}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {format(new Date(payslip.month + '-01'), 'MMMM yyyy')}
                      </Typography>
                    </Box>

                    {/* Salary Information */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          Basic Salary:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          RM {payslip.basicSalary.toFixed(2)}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">
                          Gross Salary:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          RM {payslip.grossSalary.toFixed(2)}
                        </Typography>
                      </Box>
                      <Divider />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                          Net Salary:
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                          RM {payslip.netSalary.toFixed(2)}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Footer with creation date */}
                    <Box sx={{ mt: 2, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                      <Typography variant="caption" color="text.secondary">
                        Created: {format(payslip.createdAt, 'dd/MM/yyyy HH:mm')}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
            
            {/* Empty State for Mobile */}
            {filteredPayslips.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Payment sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {payslips.length === 0 ? 'No payslips found' : 'No payslips match your filters'}
                </Typography>
                <Typography variant="body2" color="text.disabled">
                  {payslips.length === 0 
                    ? 'Create your first payslip to get started'
                    : 'Try adjusting your search or filter criteria'
                  }
                </Typography>
                {(searchQuery || dateFilter.from || dateFilter.to) && (
                  <Button
                    variant="outlined"
                    onClick={clearFilters}
                    sx={{ mt: 2 }}
                  >
                    Clear Filters
                  </Button>
                )}
              </Box>
            )}
          </Box>
        ) : (
          /* Desktop Table Layout */
          <TableContainer
            sx={{
              overflowX: 'auto',
              '&::-webkit-scrollbar': {
                display: 'none'
              },
              scrollbarWidth: 'none'
            }}
          >
            <Table sx={{ minWidth: 650 }}>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">Select</TableCell>
                  <TableCell>Employee</TableCell>
                  <TableCell>Month</TableCell>
                  <TableCell>Basic Salary</TableCell>
                  <TableCell>Gross Salary</TableCell>
                  <TableCell>Net Salary</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedPayslips.map((payslip) => {
                  const isSelected = selectedPayslips.includes(payslip.id);
                  const isDraft = payslip.status === 'draft';
                  
                  return (
                  <TableRow key={payslip.id} hover selected={isSelected}>
                    <TableCell padding="checkbox">
                      {isDraft ? (
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectPayslip(payslip.id, !isSelected);
                          }}
                          size="small"
                          sx={{
                            '&:hover': {
                              backgroundColor: isSelected ? 'primary.50' : 'grey.50'
                            }
                          }}
                        >
                          {isSelected ? (
                            <CheckBox color="primary" />
                          ) : (
                            <CheckBoxOutlineBlank />
                          )}
                        </IconButton>
                      ) : (
                        <Box sx={{ 
                          width: 40, 
                          height: 40, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center'
                        }}>
                          <Typography variant="caption" color="text.disabled">
                            —
                          </Typography>
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="subtitle2">
                          {payslip.employeeName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {payslip.employeeEmail}
                        </Typography>
                      </Box>
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2">
                        {format(new Date(payslip.month + '-01'), 'MMM yyyy')}
                      </Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2">
                        RM {payslip.basicSalary.toFixed(2)}
                      </Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2">
                        RM {payslip.grossSalary.toFixed(2)}
                      </Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        RM {payslip.netSalary.toFixed(2)}
                      </Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Chip 
                        label={payslip.status.charAt(0).toUpperCase() + payslip.status.slice(1)}
                        color={getStatusColor(payslip.status)}
                        size="small"
                      />
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2">
                        {format(payslip.createdAt, 'dd/MM/yyyy')}
                      </Typography>
                    </TableCell>
                    
                    <TableCell align="right">
                      <IconButton onClick={(e) => handleMenuClick(e, payslip)}>
                        <MoreVert />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                  );
                })}
                
                {/* Empty State for Desktop */}
                {filteredPayslips.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 6 }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Payment sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                          {payslips.length === 0 ? 'No payslips found' : 'No payslips match your filters'}
                        </Typography>
                        <Typography variant="body2" color="text.disabled">
                          {payslips.length === 0 
                            ? 'Create your first payslip to get started'
                            : 'Try adjusting your search or filter criteria'
                          }
                        </Typography>
                        {(searchQuery || dateFilter.from || dateFilter.to) && (
                          <Button
                            variant="outlined"
                            onClick={clearFilters}
                            sx={{ mt: 2 }}
                          >
                            Clear Filters
                          </Button>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        
        {/* Pagination Controls */}
        {filteredPayslips.length > payslipsPerPage && totalPages > 1 && (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 2,
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'grey.50'
          }}>
            {/* Previous Button */}
            <Button 
              variant="outlined" 
              onClick={handlePrevPage}
              disabled={safePage === 0}
              startIcon={<ArrowBack />}
              size="small"
              sx={{ 
                minWidth: 80,
                fontSize: '0.75rem',
                px: 1.5,
                py: 0.5,
                borderRadius: 2
              }}
            >
              Previous
            </Button>
            
            {/* Page Info - Compact */}
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                Page {safePage + 1} of {totalPages}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                {Math.min((safePage + 1) * payslipsPerPage, filteredPayslips.length)} of {filteredPayslips.length} payslips
              </Typography>
            </Box>
            
            {/* Next Button */}
            <Button 
              variant="outlined" 
              onClick={handleNextPage}
              disabled={safePage === totalPages - 1}
              endIcon={<ArrowForward />}
              size="small"
              sx={{ 
                minWidth: 80,
                fontSize: '0.75rem',
                px: 1.5,
                py: 0.5,
                borderRadius: 2
              }}
            >
              Next
            </Button>
          </Box>
        )}
      </Paper>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEdit}>
          <Edit sx={{ mr: 2 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={handleDownloadPDF}>
          <Download sx={{ mr: 2 }} />
          Download PDF
        </MenuItem>
        <Divider />
        <MenuItem 
          onClick={() => {
            handleDeletePayslip(selectedPayslip?.id);
            handleMenuClose();
          }}
          sx={{ color: 'error.main' }}
        >
          <Delete sx={{ mr: 2 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Create Payslip Dialog */}
      <Dialog 
        open={createDialog} 
        onClose={() => setCreateDialog(false)} 
        maxWidth="md" 
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            height: isMobile ? '100vh' : 'auto',
            maxHeight: isMobile ? '100vh' : '90vh',
            m: isMobile ? 0 : 2,
            borderRadius: isMobile ? 0 : 4,
            bgcolor: 'background.paper',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden'
          }
        }}
        TransitionComponent={Slide}
        TransitionProps={{ direction: 'up', timeout: 500 }}
      >
        <DialogTitle sx={{ 
          position: 'relative', 
          zIndex: 1,
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.85) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
        }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            color: 'text.primary',
            py: 1.5
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Avatar sx={{ 
                bgcolor: 'primary.main', 
                mr: 2,
                width: 48,
                height: 48,
                boxShadow: '0 8px 32px rgba(25, 118, 210, 0.3)'
              }}>
                <Payment sx={{ fontSize: 24, color: 'white' }} />
              </Avatar>
              <Box>
                <Typography 
                  variant="h5" 
                  sx={{ 
                    fontWeight: 700,
                    mb: 0.25,
                    fontSize: '1.5rem'
                  }}
                >
                  Create New Payslip
                </Typography>
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ 
                    fontSize: '0.875rem',
                    opacity: 0.8
                  }}
                >
                  Generate employee salary slip with detailed calculations
                </Typography>
              </Box>
            </Box>
            <IconButton 
              onClick={() => setCreateDialog(false)}
              sx={{ 
                color: 'text.primary',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  transform: 'scale(1.05)'
                },
                transition: 'all 0.2s ease'
              }}
            >
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ 
          bgcolor: 'background.paper',
          m: 2,
          borderRadius: 3,
          overflow: 'auto',
          height: isMobile ? 'calc(100vh - 200px)' : 'auto',
          p: { xs: 2, sm: 3 }
        }}>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* Company Selection */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Company</InputLabel>
                <Select
                  value={selectedCompany}
                  label="Company"
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  MenuProps={{
                    PaperProps: {
                      sx: { maxHeight: 300 }
                    }
                  }}
                >
                  <MenuItem value="">
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <People sx={{ mr: 2, color: 'primary.main' }} />
                      <Typography>All Companies</Typography>
                    </Box>
                  </MenuItem>
                  {availableCompanies.map((companyName) => (
                    <MenuItem key={companyName} value={companyName}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Avatar 
                            sx={{ 
                              mr: 2, 
                              bgcolor: 'secondary.main', 
                              width: 32, 
                              height: 32,
                              fontSize: '0.75rem'
                            }}
                          >
                            {companyName.charAt(0)}
                          </Avatar>
                          <Typography variant="body2">{companyName}</Typography>
                        </Box>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {selectedCompany && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Filtered for: {selectedCompany}
                </Typography>
              )}
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Employee *</InputLabel>
                <Select
                  value={form.employeeId}
                  label="Employee *"
                  onChange={(e) => handleEmployeeChange(e.target.value)}
                  disabled={employeesLoading}
                  MenuProps={{
                    PaperProps: {
                      sx: { maxHeight: 300 }
                    }
                  }}
                >
                  {employeesLoading ? (
                    <MenuItem disabled>
                      <Box sx={{ display: 'flex', alignItems: 'center', py: 2 }}>
                        <CircularProgress size={20} sx={{ mr: 2 }} />
                        <Typography color="text.secondary">
                          Loading employees...
                        </Typography>
                      </Box>
                    </MenuItem>
                  ) : employees.length === 0 ? (
                    <MenuItem disabled>
                      <Box sx={{ display: 'flex', alignItems: 'center', py: 2 }}>
                        <People sx={{ mr: 2, color: 'text.secondary' }} />
                        <Typography color="text.secondary">
                          No employees found. Please check user roles and company settings.
                        </Typography>
                      </Box>
                    </MenuItem>
                  ) : (
                    employees.map((employee) => (
                      <MenuItem key={employee.id} value={employee.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Avatar 
                              sx={{ 
                                mr: 2, 
                                bgcolor: 'primary.main', 
                                width: 32, 
                                height: 32,
                                fontSize: '0.75rem'
                              }}
                            >
                              {(employee.firstName?.[0] || '') + (employee.lastName?.[0] || '')}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {employee.firstName} {employee.lastName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {employee.position || 'No Position'} • {employee.experienceLevel || 'entry'} level
                              </Typography>
                              <Typography variant="caption" color="text.secondary" display="block">
                                {employee.department || 'General'} • {employee.email}
                              </Typography>
                            </Box>
                          </Box>
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                            {employee.salary && (employee.salary.basicSalary || employee.salary.hourlyRate) && (
                              <Chip 
                                icon={<AutoAwesome />}
                                label="Salary Data" 
                                size="small" 
                                color="success" 
                                variant="outlined"
                                sx={{ fontSize: '0.6rem', height: 20 }}
                              />
                            )}
                            <Chip 
                              label={employee.status || 'Active'} 
                              size="small" 
                              color={employee.status === 'inactive' ? 'default' : 'success'}
                              variant="outlined"
                              sx={{ fontSize: '0.6rem', height: 20 }}
                            />
                          </Box>
                        </Box>
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
              {!employeesLoading && employees.length > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Found {employees.length} employee(s){selectedCompany ? ` in ${selectedCompany}` : ' across all companies'}
                </Typography>
              )}
              {employeesLoading && (
                <Typography variant="caption" color="primary.main" sx={{ mt: 0.5, display: 'block' }}>
                  Loading employees...
                </Typography>
              )}
            </Grid>

            {/* Salary Information Display */}
            {form.employeeId && (
              <Grid item xs={12}>
                {(() => {
                  const selectedEmployee = employees.find(emp => emp.id === form.employeeId);
                  if (!selectedEmployee) return null;
                  
                  const hasSalaryData = selectedEmployee.salary && (selectedEmployee.salary.basicSalary || selectedEmployee.salary.hourlyRate);
                  
                  return (
                    <Alert 
                      severity={hasSalaryData ? "success" : "warning"} 
                      icon={<AutoAwesome />}
                      sx={{ 
                        bgcolor: hasSalaryData ? 'success.50' : 'warning.50', 
                        borderColor: hasSalaryData ? 'success.200' : 'warning.200' 
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box>
                          <Typography variant="subtitle2" gutterBottom>
                            {hasSalaryData ? 'Salary Data Found' : 'Missing Salary Data'}
                          </Typography>
                          <Typography variant="body2">
                            {hasSalaryData ? (
                              <>Salary information loaded from employee profile. You can modify any values as needed.</>
                            ) : (
                              <>No salary data found in employee profile. Using default values. Please update employee profile with salary information.</>
                            )}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                          <Chip 
                            icon={<Settings />}
                            label="Editable" 
                            size="small" 
                            color="primary" 
                            variant="outlined"
                          />
                          {hasSalaryData && (
                            <Chip 
                              label="Profile Based"
                              size="small" 
                              color="success"
                              variant="filled"
                            />
                          )}
                        </Box>
                      </Box>
                    </Alert>
                  );
                })()} 
              </Grid>
            )}
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Month"
                type="month"
                fullWidth
                value={form.month}
                onChange={(e) => handleMonthChange(e.target.value)}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Calculation Method</InputLabel>
                <Select
                  value={form.calculationMethod}
                  label="Calculation Method"
                  onChange={(e) => setForm({...form, calculationMethod: e.target.value})}
                >
                  <MenuItem value="hourly">Hourly Rate</MenuItem>
                  <MenuItem value="fixed">Fixed Salary</MenuItem>
                  <MenuItem value="attendance">
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <AccessTime sx={{ mr: 1, fontSize: 18 }} />
                      Attendance-Based
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Payment Method</InputLabel>
                <Select
                  value={form.paymentMethod}
                  label="Payment Method"
                  onChange={(e) => setForm({...form, paymentMethod: e.target.value})}
                >
                  <MenuItem value="GIRO">GIRO</MenuItem>
                  <MenuItem value="IBG">IBG (Interbank GIRO)</MenuItem>
                  <MenuItem value="DuitNow">DuitNow</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Attendance-Based Calculation Button */}
            {form.employeeId && form.month && (
              <Grid item xs={12}>
                <Box sx={{ 
                  p: 2, 
                  bgcolor: 'info.50', 
                  borderRadius: 2, 
                  border: '1px solid', 
                  borderColor: 'info.200'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Timeline sx={{ mr: 1, color: 'info.main' }} />
                      <Typography variant="subtitle2" color="info.main">
                        Attendance Integration
                      </Typography>
                    </Box>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleCalculateFromAttendance}
                      disabled={attendanceLoading || !form.employeeId || !form.month}
                      startIcon={attendanceLoading ? null : <Calculate />}
                      sx={{ minWidth: 140 }}
                    >
                      {attendanceLoading ? 'Loading...' : 'Auto-Calculate'}
                    </Button>
                  </Box>
                  
                  {attendanceData ? (
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Attendance data found for {format(new Date(form.month + '-01'), 'MMM yyyy')}
                      </Typography>
                      <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={6} sm={3}>
                          <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
                            <Typography variant="h6" color="primary.main">
                              {attendanceData.summary.totalRegularHours}h
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Regular Hours
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
                            <Typography variant="h6" color="warning.main">
                              {attendanceData.summary.totalOvertimeHours}h
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Overtime
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
                            <Typography variant="h6" color="success.main">
                              {attendanceData.summary.daysPresent}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Days Present
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Box sx={{ textAlign: 'center', p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
                            <Typography variant="h6" color="info.main">
                              {attendanceData.summary.attendanceRate}%
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Attendance Rate
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>
                      
                      {attendanceInsights.length > 0 && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="caption" color="text.secondary" gutterBottom>
                            Insights:
                          </Typography>
                          {attendanceInsights.map((insight, index) => (
                            <Alert 
                              key={index} 
                              severity={insight.type} 
                              sx={{ mt: 1, py: 0 }}
                              variant="outlined"
                            >
                              <Typography variant="caption">
                                {insight.message}
                              </Typography>
                            </Alert>
                          ))}
                        </Box>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      {attendanceLoading ? 
                        'Loading attendance data...' : 
                        `No attendance records found for ${format(new Date(form.month + '-01'), 'MMM yyyy')}. Manual entry required.`
                      }
                    </Typography>
                  )}
                </Box>
              </Grid>
            )}
            
            {(form.calculationMethod === 'hourly' || form.calculationMethod === 'attendance') && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Hours Worked"
                    type="number"
                    fullWidth
                    value={form.hoursWorked}
                    onChange={(e) => setForm({...form, hoursWorked: e.target.value})}
                    required
                    inputProps={{ min: 0, step: 0.5 }}
                    helperText={form.calculationMethod === 'attendance' ? 
                      'Hours from attendance records' : 
                      'Total hours worked this month'
                    }
                    disabled={form.calculationMethod === 'attendance'}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Hourly Rate (RM)"
                    type="number"
                    fullWidth
                    value={form.hourlyRate}
                    onChange={(e) => setForm({...form, hourlyRate: e.target.value})}
                    required
                    inputProps={{ min: 0, step: 0.01 }}
                    helperText={form.calculationMethod === 'attendance' ? 
                      'Rate from salary template' : 
                      'Rate per hour based on position'
                    }
                    disabled={form.calculationMethod === 'attendance'}
                  />
                </Grid>
              </>
            )}
            
            {form.calculationMethod === 'fixed' && (
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Basic Salary (RM)"
                  type="number"
                  fullWidth
                  value={form.basicSalary}
                  onChange={(e) => setForm({...form, basicSalary: e.target.value})}
                  required
                />
              </Grid>
            )}
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Allowances (RM)"
                type="number"
                fullWidth
                value={form.allowances}
                onChange={(e) => setForm({...form, allowances: e.target.value})}
                helperText={form.calculationMethod === 'attendance' ? 
                  'Auto-calculated from salary template' : 
                  'Monthly allowances'
                }
                disabled={form.calculationMethod === 'attendance'}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Overtime (RM)"
                type="number"
                fullWidth
                value={form.overtime}
                onChange={(e) => setForm({...form, overtime: e.target.value})}
                helperText={form.calculationMethod === 'attendance' ? 
                  'Auto-calculated from attendance records' : 
                  'Additional overtime pay'
                }
                disabled={form.calculationMethod === 'attendance'}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Bonus (RM)"
                type="number"
                fullWidth
                value={form.bonus}
                onChange={(e) => setForm({...form, bonus: e.target.value})}
                helperText="Performance bonuses and incentives"
              />
            </Grid>
            
            {/* Auto-Calculate Toggle */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, bgcolor: 'grey.50', borderRadius: 2, border: '1px solid', borderColor: 'grey.200' }}>
                <Calculate />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Automatic EPF/EIS/SOCSO Calculation
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Toggle to automatically calculate statutory deductions based on gross salary, or manually enter custom amounts
                  </Typography>
                </Box>
                <FormControl>
                  <Select
                    value={form.autoCalculate}
                    onChange={(e) => setForm({...form, autoCalculate: e.target.value})}
                    size="small"
                    sx={{ minWidth: 120 }}
                  >
                    <MenuItem value={true}>Auto Calculate</MenuItem>
                    <MenuItem value={false}>Manual Entry</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Grid>
            
            {/* Detailed Breakdown Section */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 1, color: 'primary.main' }}>
                Detailed Breakdown
              </Typography>
            </Grid>
            
            {/* Employee Contributions */}
            <Grid item xs={12} sm={4}>
              <TextField
                label="Employee EPF (RM)"
                type="number"
                fullWidth
                value={form.employeeEPF}
                onChange={(e) => setForm({...form, employeeEPF: e.target.value})}
                disabled={form.autoCalculate}
                helperText={form.autoCalculate ? "Auto: 11% of gross salary" : "Manual entry"}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="Employee EIS (RM)"
                type="number"
                fullWidth
                value={form.employeeEIS}
                onChange={(e) => setForm({...form, employeeEIS: e.target.value})}
                disabled={form.autoCalculate}
                helperText={form.autoCalculate ? "Auto: 0.2% (max RM4.15)" : "Manual entry"}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="Employee SOCSO (RM)"
                type="number"
                fullWidth
                value={form.employeeSOCSO}
                onChange={(e) => setForm({...form, employeeSOCSO: e.target.value})}
                disabled={form.autoCalculate}
                helperText={form.autoCalculate ? "Auto: 0.5% (max RM19.75)" : "Manual entry"}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            {/* Employer Contributions (Read-only info) */}
            <Grid item xs={12} sm={4}>
              <TextField
                label="Employer EPF (RM)"
                type="number"
                fullWidth
                value={form.employerEPF}
                disabled
                helperText={form.autoCalculate ? "Auto: 12% of gross salary" : "Based on employee EPF"}
                sx={{ '& .MuiInputBase-input': { color: 'text.secondary' } }}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="Employer EIS (RM)"
                type="number"
                fullWidth
                value={form.employerEIS}
                disabled
                helperText={form.autoCalculate ? "Auto: 0.2% (max RM4.15)" : "Based on employee EIS"}
                sx={{ '& .MuiInputBase-input': { color: 'text.secondary' } }}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="Employer SOCSO (RM)"
                type="number"
                fullWidth
                value={form.employerSOCSO}
                disabled
                helperText={form.autoCalculate ? "Auto: 1.4% (max RM67.75)" : "Based on employee SOCSO"}
                sx={{ '& .MuiInputBase-input': { color: 'text.secondary' } }}
              />
            </Grid>
            
            {/* Other Deductions */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Zakat (RM)"
                type="number"
                fullWidth
                value={form.zakat}
                onChange={(e) => setForm({...form, zakat: e.target.value})}
                helperText="Islamic religious tax"
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="MTD/PCB (RM)"
                type="number"
                fullWidth
                value={form.mtdPCB}
                onChange={(e) => setForm({...form, mtdPCB: e.target.value})}
                helperText="Monthly Tax Deduction/PCB"
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            {/* Other Specific Deductions */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: 'primary.main' }}>
                Other Deductions
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="Loan Deduction (RM)"
                type="number"
                fullWidth
                value={form.loanDeduction || ''}
                onChange={(e) => setForm({...form, loanDeduction: e.target.value})}
                helperText="Employee loan repayment"
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="Insurance (RM)"
                type="number"
                fullWidth
                value={form.insurance || ''}
                onChange={(e) => setForm({...form, insurance: e.target.value})}
                helperText="Medical/Life insurance"
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="Advance Salary (RM)"
                type="number"
                fullWidth
                value={form.advanceSalary || ''}
                onChange={(e) => setForm({...form, advanceSalary: e.target.value})}
                helperText="Salary advance deduction"
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="Uniform/Equipment (RM)"
                type="number"
                fullWidth
                value={form.uniformEquipment || ''}
                onChange={(e) => setForm({...form, uniformEquipment: e.target.value})}
                helperText="Uniform or equipment cost"
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="Disciplinary Fine (RM)"
                type="number"
                fullWidth
                value={form.disciplinaryFine || ''}
                onChange={(e) => setForm({...form, disciplinaryFine: e.target.value})}
                helperText="Penalty or fine deduction"
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="Other Misc (RM)"
                type="number"
                fullWidth
                value={form.otherMisc || ''}
                onChange={(e) => setForm({...form, otherMisc: e.target.value})}
                helperText="Other miscellaneous deductions"
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={form.status}
                  label="Status"
                  onChange={(e) => setForm({...form, status: e.target.value})}
                >
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="approved">Approved</MenuItem>
                  <MenuItem value="paid">Paid</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Payment Method</InputLabel>
                <Select
                  value={form.paymentMethod}
                  label="Payment Method"
                  onChange={(e) => setForm({...form, paymentMethod: e.target.value})}
                >
                  <MenuItem value="GIRO">GIRO</MenuItem>
                  <MenuItem value="IBG">IBG (Interbank GIRO)</MenuItem>
                  <MenuItem value="DuitNow">DuitNow</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Gross Salary (RM)"
                fullWidth
                value={form.grossSalary}
                disabled
                helperText="Calculated automatically"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Net Salary (RM)"
                fullWidth
                value={form.netSalary}
                disabled
                helperText="Calculated automatically"
                sx={{ '& .MuiInputBase-input': { fontWeight: 'bold' } }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Message (Optional)"
                fullWidth
                multiline
                rows={3}
                value={form.message}
                onChange={(e) => setForm({...form, message: e.target.value})}
                placeholder="Add a message to be displayed on the payslip (e.g., Thank you for your hard work!)"
                helperText="This message will appear in the Messages section of the payslip PDF"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, justifyContent: 'center' }}>
          <Button
            onClick={() => setCreateDialog(false)}
            variant="outlined"
            size="large"
            sx={{
              borderRadius: 2,
              px: 4,
              py: 1.5,
              fontWeight: 600,
              textTransform: 'none',
              mr: 2
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleCreatePayslip}
            size="large"
            sx={{
              borderRadius: 2,
              px: 4,
              py: 1.5,
              fontWeight: 600,
              textTransform: 'none'
            }}
          >
            Create Payslip
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Payslip Dialog */}
      <Dialog 
        open={editDialog} 
        onClose={() => {
          setEditDialog(false);
          setSelectedPayslip(null);
        }} 
        maxWidth="lg" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            bgcolor: 'background.paper',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden'
          }
        }}
        TransitionComponent={Slide}
        TransitionProps={{ direction: 'up', timeout: 500 }}
      >
        <DialogTitle sx={{ 
          position: 'relative', 
          zIndex: 1,
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.85) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
        }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            color: 'text.primary',
            py: 1.5
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Avatar sx={{ 
                bgcolor: 'primary.main', 
                mr: 2,
                width: 48,
                height: 48,
                boxShadow: '0 8px 32px rgba(25, 118, 210, 0.3)'
              }}>
                <Edit sx={{ fontSize: 24, color: 'white' }} />
              </Avatar>
              <Box>
                <Typography 
                  variant="h5" 
                  sx={{ 
                    fontWeight: 700,
                    mb: 0.25,
                    fontSize: '1.5rem'
                  }}
                >
                  Edit Payslip
                </Typography>
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ 
                    fontSize: '0.875rem',
                    opacity: 0.8
                  }}
                >
                  Update employee salary slip details and calculations
                </Typography>
              </Box>
            </Box>
            <IconButton 
              onClick={() => {
                setEditDialog(false);
                setSelectedPayslip(null);
              }}
              sx={{ 
                color: 'text.primary',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  transform: 'scale(1.05)'
                },
                transition: 'all 0.2s ease'
              }}
            >
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ 
          bgcolor: 'background.paper',
          m: 2,
          borderRadius: 3,
          overflow: 'auto',
          height: isMobile ? 'calc(100vh - 200px)' : 'auto',
          p: { xs: 2, sm: 3 }
        }}>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Employee"
                fullWidth
                value={form.employeeName}
                disabled
                helperText="Employee cannot be changed"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Month"
                type="month"
                fullWidth
                value={form.month}
                onChange={(e) => setForm({...form, month: e.target.value})}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Basic Salary (RM)"
                type="number"
                fullWidth
                value={form.basicSalary}
                onChange={(e) => setForm({...form, basicSalary: e.target.value})}
                required
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Allowances (RM)"
                type="number"
                fullWidth
                value={form.allowances}
                onChange={(e) => setForm({...form, allowances: e.target.value})}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Overtime (RM)"
                type="number"
                fullWidth
                value={form.overtime}
                onChange={(e) => setForm({...form, overtime: e.target.value})}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Bonus (RM)"
                type="number"
                fullWidth
                value={form.bonus}
                onChange={(e) => setForm({...form, bonus: e.target.value})}
              />
            </Grid>
            
            {/* Auto-Calculate Toggle for Edit */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, bgcolor: 'grey.50', borderRadius: 2, border: '1px solid', borderColor: 'grey.200' }}>
                <Calculate />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Automatic EPF/EIS/SOCSO Calculation
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Toggle to automatically calculate statutory deductions based on gross salary, or manually enter custom amounts
                  </Typography>
                </Box>
                <FormControl>
                  <Select
                    value={form.autoCalculate}
                    onChange={(e) => setForm({...form, autoCalculate: e.target.value})}
                    size="small"
                    sx={{ minWidth: 120 }}
                  >
                    <MenuItem value={true}>Auto Calculate</MenuItem>
                    <MenuItem value={false}>Manual Entry</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Grid>
            
            {/* Detailed Breakdown Section for Edit */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mb: 1, color: 'primary.main' }}>
                Detailed Breakdown
              </Typography>
            </Grid>
            
            {/* Employee Contributions */}
            <Grid item xs={12} sm={4}>
              <TextField
                label="Employee EPF (RM)"
                type="number"
                fullWidth
                value={form.employeeEPF}
                onChange={(e) => setForm({...form, employeeEPF: e.target.value})}
                disabled={form.autoCalculate}
                helperText={form.autoCalculate ? "Auto: 11% of gross salary" : "Manual entry"}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="Employee EIS (RM)"
                type="number"
                fullWidth
                value={form.employeeEIS}
                onChange={(e) => setForm({...form, employeeEIS: e.target.value})}
                disabled={form.autoCalculate}
                helperText={form.autoCalculate ? "Auto: 0.2% (max RM4.15)" : "Manual entry"}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="Employee SOCSO (RM)"
                type="number"
                fullWidth
                value={form.employeeSOCSO}
                onChange={(e) => setForm({...form, employeeSOCSO: e.target.value})}
                disabled={form.autoCalculate}
                helperText={form.autoCalculate ? "Auto: 0.5% (max RM19.75)" : "Manual entry"}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            {/* Employer Contributions (Read-only info) */}
            <Grid item xs={12} sm={4}>
              <TextField
                label="Employer EPF (RM)"
                type="number"
                fullWidth
                value={form.employerEPF}
                disabled
                helperText={form.autoCalculate ? "Auto: 12% of gross salary" : "Based on employee EPF"}
                sx={{ '& .MuiInputBase-input': { color: 'text.secondary' } }}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="Employer EIS (RM)"
                type="number"
                fullWidth
                value={form.employerEIS}
                disabled
                helperText={form.autoCalculate ? "Auto: 0.2% (max RM4.15)" : "Based on employee EIS"}
                sx={{ '& .MuiInputBase-input': { color: 'text.secondary' } }}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="Employer SOCSO (RM)"
                type="number"
                fullWidth
                value={form.employerSOCSO}
                disabled
                helperText={form.autoCalculate ? "Auto: 1.4% (max RM67.75)" : "Based on employee SOCSO"}
                sx={{ '& .MuiInputBase-input': { color: 'text.secondary' } }}
              />
            </Grid>
            
            {/* Other Deductions */}
            <Grid item xs={12} sm={6}>
              <TextField
                label="Zakat (RM)"
                type="number"
                fullWidth
                value={form.zakat}
                onChange={(e) => setForm({...form, zakat: e.target.value})}
                helperText="Islamic religious tax"
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="MTD/PCB (RM)"
                type="number"
                fullWidth
                value={form.mtdPCB}
                onChange={(e) => setForm({...form, mtdPCB: e.target.value})}
                helperText="Monthly Tax Deduction/PCB"
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            {/* Other Specific Deductions */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb: 1, color: 'primary.main' }}>
                Other Deductions
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="Loan Deduction (RM)"
                type="number"
                fullWidth
                value={form.loanDeduction || ''}
                onChange={(e) => setForm({...form, loanDeduction: e.target.value})}
                helperText="Employee loan repayment"
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="Insurance (RM)"
                type="number"
                fullWidth
                value={form.insurance || ''}
                onChange={(e) => setForm({...form, insurance: e.target.value})}
                helperText="Medical/Life insurance"
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="Advance Salary (RM)"
                type="number"
                fullWidth
                value={form.advanceSalary || ''}
                onChange={(e) => setForm({...form, advanceSalary: e.target.value})}
                helperText="Salary advance deduction"
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="Uniform/Equipment (RM)"
                type="number"
                fullWidth
                value={form.uniformEquipment || ''}
                onChange={(e) => setForm({...form, uniformEquipment: e.target.value})}
                helperText="Uniform or equipment cost"
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="Disciplinary Fine (RM)"
                type="number"
                fullWidth
                value={form.disciplinaryFine || ''}
                onChange={(e) => setForm({...form, disciplinaryFine: e.target.value})}
                helperText="Penalty or fine deduction"
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                label="Other Misc (RM)"
                type="number"
                fullWidth
                value={form.otherMisc || ''}
                onChange={(e) => setForm({...form, otherMisc: e.target.value})}
                helperText="Other miscellaneous deductions"
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={form.status}
                  label="Status"
                  onChange={(e) => setForm({...form, status: e.target.value})}
                >
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="approved">Approved</MenuItem>
                  <MenuItem value="paid">Paid</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Payment Method</InputLabel>
                <Select
                  value={form.paymentMethod}
                  label="Payment Method"
                  onChange={(e) => setForm({...form, paymentMethod: e.target.value})}
                >
                  <MenuItem value="GIRO">GIRO</MenuItem>
                  <MenuItem value="IBG">IBG (Interbank GIRO)</MenuItem>
                  <MenuItem value="DuitNow">DuitNow</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Gross Salary (RM)"
                fullWidth
                value={form.grossSalary}
                disabled
                helperText="Calculated automatically"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                label="Net Salary (RM)"
                fullWidth
                value={form.netSalary}
                disabled
                helperText="Calculated automatically"
                sx={{ '& .MuiInputBase-input': { fontWeight: 'bold' } }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Message (Optional)"
                fullWidth
                multiline
                rows={3}
                value={form.message}
                onChange={(e) => setForm({...form, message: e.target.value})}
                placeholder="Add a message to be displayed on the payslip (e.g., Thank you for your hard work!)"
                helperText="This message will appear in the Messages section of the payslip PDF"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, justifyContent: 'center' }}>
          <Button
            onClick={() => {
              setEditDialog(false);
              setSelectedPayslip(null);
            }}
            variant="outlined"
            size="large"
            sx={{
              borderRadius: 2,
              px: 4,
              py: 1.5,
              fontWeight: 600,
              textTransform: 'none',
              mr: 2
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleUpdatePayslip}
            size="large"
            sx={{
              borderRadius: 2,
              px: 4,
              py: 1.5,
              fontWeight: 600,
              textTransform: 'none'
            }}
          >
            Update Payslip
          </Button>
        </DialogActions>
      </Dialog>

    </Container>
  );
}

export default Payslips;