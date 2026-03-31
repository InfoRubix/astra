import React, { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import { 
  Container, 
  Typography, 
  Paper, 
  Box,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Avatar,
  Alert,
  Divider,
  FormControl,
  InputLabel,
  Select,
  LinearProgress,
  CircularProgress,
  InputAdornment,
  Stack,
  Slide,
  Fab
} from '@mui/material';
import CompanyFilter from '../../components/admin/CompanyFilter';
import { 
  TrendingUp,
  TrendingDown,
  Schedule,
  AccessTime,
  CheckCircle,
  Warning,
  PersonSearch,
  Search,
  Clear,
  Download,
  Timeline as TimelineIcon,
  Assessment,
  EmojiEvents,
  Close,
  Analytics,
  ArrowForward,
  ArrowBack,
  Add
} from '@mui/icons-material';
import { 
  BarChart as RechartsBarChart, 
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer
} from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { format, subDays, subMonths, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { collection, getDocs, query, where, addDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { pdfService } from '../../services/pdfService';
import { getRawCheckIn, getRawCheckOut } from '../../utils/attendanceHelpers';

function Performance() {
  const { user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [loading, setLoading] = useState(true);
  const [attendanceData, setAttendanceData] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [attendanceFilter, setAttendanceFilter] = useState('all');
  const [sortBy, setSortBy] = useState('attendance');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [detailDialog, setDetailDialog] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [holidayDialog, setHolidayDialog] = useState(false);
  const [holidayForm, setHolidayForm] = useState({
    date: '',
    name: '',
    type: 'replacement'
  });
  const [currentPage, setCurrentPage] = useState(0);
  const employeesPerPage = 4;
  const [individualReportLoading, setIndividualReportLoading] = useState(false);

  // Helper function to get employee's company consistently
  const getEmployeeCompany = (employee) => {
    return employee.company || employee.originalCompanyName || 'RUBIX';
  };

  useEffect(() => {
    if (user) {
      loadAttendanceData();
    }
  }, [user, selectedPeriod, selectedDepartment, selectedCompany]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery, selectedDepartment, selectedCompany, attendanceFilter, sortBy, sortOrder]);

  // Filter and search functionality
  const getFilteredAndSortedData = () => {
    let filteredData = attendanceData;

    // Filter by company
    if (selectedCompany) {
      filteredData = filteredData.filter(emp => getEmployeeCompany(emp) === selectedCompany);
    }

    // Filter by department
    if (selectedDepartment !== 'all') {
      filteredData = filteredData.filter(emp => emp.department === selectedDepartment);
    }

    // Filter by attendance rate
    if (attendanceFilter !== 'all') {
      if (attendanceFilter === 'excellent') {
        filteredData = filteredData.filter(emp => emp.attendanceRate >= 95);
      } else if (attendanceFilter === 'good') {
        filteredData = filteredData.filter(emp => emp.attendanceRate >= 85 && emp.attendanceRate < 95);
      } else if (attendanceFilter === 'average') {
        filteredData = filteredData.filter(emp => emp.attendanceRate >= 70 && emp.attendanceRate < 85);
      } else if (attendanceFilter === 'poor') {
        filteredData = filteredData.filter(emp => emp.attendanceRate < 70);
      }
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filteredData = filteredData.filter(emp => 
        emp.name.toLowerCase().includes(query) ||
        emp.email.toLowerCase().includes(query) ||
        emp.department.toLowerCase().includes(query)
      );
    }

    // Sort data
    filteredData.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'department':
          aValue = a.department.toLowerCase();
          bValue = b.department.toLowerCase();
          break;
        case 'attendance':
        default:
          aValue = a.attendanceRate;
          bValue = b.attendanceRate;
          break;
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filteredData;
  };

  const filteredAttendanceData = getFilteredAndSortedData();

  // Get paginated data
  const getPaginatedData = () => {
    const startIndex = safePage * employeesPerPage;
    return filteredAttendanceData.slice(startIndex, startIndex + employeesPerPage);
  };

  const totalPages = Math.max(1, Math.ceil(filteredAttendanceData.length / employeesPerPage));

  // Ensure currentPage doesn't exceed available pages
  const safePage = Math.min(currentPage, Math.max(0, totalPages - 1));

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

  const paginatedAttendanceData = getPaginatedData();

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedDepartment('all');
    setSelectedCompany('');
    setAttendanceFilter('all');
    setSortBy('attendance');
    setSortOrder('desc');
    setCurrentPage(0); // Reset to first page when clearing filters
  };

  const loadAttendanceData = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log('🔄 Loading attendance data...');
      
      // Load all employees (exclude admins, company-admin, and branch-admin)
      const usersQuery = query(
        collection(db, 'users')
      );
      const usersSnapshot = await getDocs(usersQuery);
      const allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const employees = allUsers.filter(u => 
        u.role !== 'admin' && 
        u.role !== 'company_admin' && 
        u.role !== 'branch_admin'
      );
      
      console.log('👥 Total employees found:', employees.length);
      
      // Get unique departments
      const deptSet = new Set(employees.map(emp => emp.department || 'General'));
      const departmentsList = [...deptSet].filter(dept => dept && dept.trim());
      setDepartments(departmentsList.length > 0 ? departmentsList : ['General']);
      console.log('🏢 Departments found:', departmentsList);

      // Load attendance data
      const attendanceQuery = query(
        collection(db, 'attendance')
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);
      const attendanceRecords = attendanceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log('📅 Attendance records loaded:', attendanceRecords.length);

      // Load leave data
      const leavesQuery = query(
        collection(db, 'leaves')
      );
      const leavesSnapshot = await getDocs(leavesQuery);
      const leaveRecords = leavesSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        // Ensure date fields are properly converted
        appliedDate: doc.data().appliedDate?.toDate ? doc.data().appliedDate.toDate() : 
                     doc.data().appliedDate ? new Date(doc.data().appliedDate) : new Date(),
        startDate: doc.data().startDate?.toDate ? doc.data().startDate.toDate() : 
                   doc.data().startDate ? new Date(doc.data().startDate) : new Date(),
        endDate: doc.data().endDate?.toDate ? doc.data().endDate.toDate() : 
                 doc.data().endDate ? new Date(doc.data().endDate) : new Date()
      }));
      console.log('🏖️ Leave records loaded:', leaveRecords.length);

      // Load claims data
      const claimsQuery = query(
        collection(db, 'claims')
      );
      const claimsSnapshot = await getDocs(claimsQuery);
      const claimsRecords = claimsSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        // Ensure date fields are properly converted
        submittedDate: doc.data().submittedDate?.toDate ? doc.data().submittedDate.toDate() : 
                       doc.data().submittedDate ? new Date(doc.data().submittedDate) : new Date(),
        amount: parseFloat(doc.data().amount) || 0
      }));
      console.log('💰 Claims records loaded:', claimsRecords.length);

      // Load company settings to get working days for each company
      const companySettingsQuery = query(
        collection(db, 'companySettings')
      );
      const companySettingsSnapshot = await getDocs(companySettingsQuery);
      const companySettings = {};
      companySettingsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        companySettings[data.company] = {
          workDays: data.workDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          isActive: data.isActive !== false
        };
      });
      console.log('🏢 Company settings loaded:', Object.keys(companySettings).length);

      // Load custom holidays from Firestore (replacement holidays marked by admin)
      const loadCustomHolidays = async () => {
        try {
          const customHolidaysQuery = query(collection(db, 'customHolidays'));
          const customHolidaysSnapshot = await getDocs(customHolidaysQuery);
          return customHolidaysSnapshot.docs.map(doc => ({
            id: doc.id,
            date: doc.data().date.toDate ? doc.data().date.toDate() : new Date(doc.data().date),
            name: doc.data().name,
            type: doc.data().type || 'replacement'
          }));
        } catch (error) {
          console.warn('Failed to load custom holidays:', error);
          return [];
        }
      };

      // Function to get Malaysian public holidays
      const getMalaysianHolidays = async (year) => {
        try {
          // Try to fetch from API first
          const response = await fetch(`https://date.nager.at/Api/v3/PublicHolidays/${year}/MY`);
          if (response.ok) {
            const holidays = await response.json();
            return holidays.map(holiday => ({
              date: new Date(holiday.date),
              name: holiday.name,
              type: 'national'
            }));
          }
          return [];
        } catch (error) {
          console.warn('Failed to load public holidays from API:', error);
          return [];
        }
      };

      // Complete Malaysian public holidays for 2025 (fallback)
      const getDefaultMalaysianHolidays = () => {
        return [
          // Fixed National Holidays
          { date: new Date('2025-01-01'), name: 'New Year\'s Day', type: 'national' },
          { date: new Date('2025-05-01'), name: 'Labour Day', type: 'national' },
          { date: new Date('2025-08-31'), name: 'National Day', type: 'national' },
          { date: new Date('2025-09-16'), name: 'Malaysia Day', type: 'national' },
          { date: new Date('2025-12-25'), name: 'Christmas Day', type: 'national' },
          
          // Chinese New Year 2025 (January 29-30)
          { date: new Date('2025-01-29'), name: 'Chinese New Year', type: 'national' },
          { date: new Date('2025-01-30'), name: 'Chinese New Year Holiday', type: 'national' },
          
          // Islamic Holidays 2025 (estimated dates - may vary)
          { date: new Date('2025-03-30'), name: 'Hari Raya Aidilfitri', type: 'national' },
          { date: new Date('2025-03-31'), name: 'Hari Raya Aidilfitri Holiday', type: 'national' },
          { date: new Date('2025-06-07'), name: 'Hari Raya Haji', type: 'national' },
          { date: new Date('2025-06-28'), name: 'Awal Muharram (Islamic New Year)', type: 'national' },
          { date: new Date('2025-09-05'), name: 'Maulidur Rasul', type: 'national' },
          
          // Buddhist/Hindu Holidays
          { date: new Date('2025-05-12'), name: 'Wesak Day', type: 'national' },
          { date: new Date('2025-10-20'), name: 'Deepavali', type: 'national' }, // Added Deepavali
          
          // Royal Holidays
          { date: new Date('2025-06-09'), name: 'Yang di-Pertuan Agong\'s Birthday', type: 'national' },
          
          // Replacement Holidays (Cuti Ganti)
          { date: new Date('2025-09-01'), name: 'Replacement Holiday (National Day)', type: 'replacement' }
        ];
      };

      // Get all holidays (API + default + custom)
      const currentYear = new Date().getFullYear();
      const apiHolidays = await getMalaysianHolidays(currentYear);
      const defaultHolidays = getDefaultMalaysianHolidays();
      const customHolidays = await loadCustomHolidays();
      
      // Combine all holidays, prioritizing custom and API over defaults
      const allHolidays = [
        ...customHolidays, // Admin-marked replacement holidays
        ...apiHolidays,    // API holidays (if available)
        ...defaultHolidays // Default holidays (fallback)
      ];
      
      // Remove duplicates based on date
      const uniqueHolidays = [];
      const seenDates = new Set();
      
      allHolidays.forEach(holiday => {
        const dateKey = holiday.date.toDateString();
        if (!seenDates.has(dateKey)) {
          seenDates.add(dateKey);
          uniqueHolidays.push(holiday);
        }
      });
      
      console.log('🏛️ Total holidays loaded:', uniqueHolidays.length);
      console.log('📅 Holiday breakdown:', {
        custom: customHolidays.length,
        api: apiHolidays.length,
        default: defaultHolidays.length,
        unique: uniqueHolidays.length
      });

      // Helper function to check if a date is a public holiday
      const isPublicHoliday = (date) => {
        return uniqueHolidays.some(holiday => 
          holiday.date.getFullYear() === date.getFullYear() &&
          holiday.date.getMonth() === date.getMonth() &&
          holiday.date.getDate() === date.getDate()
        );
      };

      // Helper function to get holiday info for a date
      const getHolidayInfo = (date) => {
        return uniqueHolidays.find(holiday => 
          holiday.date.getFullYear() === date.getFullYear() &&
          holiday.date.getMonth() === date.getMonth() &&
          holiday.date.getDate() === date.getDate()
        );
      };

      // Helper function to calculate working days for a company based on their work schedule (excluding public holidays)
      const calculateWorkingDays = (companyName, startDate, endDate) => {
        const companyWorkDays = companySettings[companyName]?.workDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
        
        const dayMap = {
          'sunday': 0,
          'monday': 1,
          'tuesday': 2,
          'wednesday': 3,
          'thursday': 4,
          'friday': 5,
          'saturday': 6
        };
        
        const workDayNumbers = companyWorkDays.map(day => dayMap[day.toLowerCase()]);
        
        let workingDays = 0;
        const currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
          const dayOfWeek = currentDate.getDay();
          // Count as working day if it's a scheduled work day AND not a public holiday
          if (workDayNumbers.includes(dayOfWeek) && !isPublicHoliday(currentDate)) {
            workingDays++;
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        return workingDays;
      };

      // Calculate date range based on selected period
      const endDate = new Date();
      let startDate;
      
      switch (selectedPeriod) {
        case 'week':
          startDate = subDays(endDate, 7);
          break;
        case 'quarter':
          startDate = subMonths(endDate, 3);
          break;
        case 'year':
          startDate = subMonths(endDate, 12);
          break;
        default: // month
          startDate = startOfMonth(endDate);
      }

      // Calculate attendance metrics for each employee
      const attendanceMetrics = employees.map(employee => {
        // Get employee's company for working days calculation
        const employeeCompany = getEmployeeCompany(employee);
        const totalWorkingDays = calculateWorkingDays(employeeCompany, startDate, endDate);
        
        // Filter data by date range with better error handling
        const employeeAttendance = attendanceRecords.filter(record => {
          try {
            if (record.userId !== employee.id) return false;
            
            let recordDate;
            if (record.dateString) {
              recordDate = new Date(record.dateString);
            } else if (record.date) {
              recordDate = record.date.toDate ? record.date.toDate() : new Date(record.date);
            } else if (record.createdAt) {
              recordDate = record.createdAt.toDate ? record.createdAt.toDate() : new Date(record.createdAt);
            } else {
              return false;
            }
            
            return recordDate >= startDate && recordDate <= endDate;
          } catch (error) {
            console.warn('Error filtering attendance record:', error);
            return false;
          }
        });

        const employeeLeaves = leaveRecords.filter(record => {
          try {
            if (record.userId !== employee.id) return false;
            return record.appliedDate >= startDate && record.appliedDate <= endDate;
          } catch (error) {
            console.warn('Error filtering leave record:', error);
            return false;
          }
        });

        const employeeClaims = claimsRecords.filter(record => {
          try {
            if (record.userId !== employee.id) return false;
            return record.submittedDate >= startDate && record.submittedDate <= endDate;
          } catch (error) {
            console.warn('Error filtering claims record:', error);
            return false;
          }
        });

        // Calculate metrics with validation
        const presentDays = employeeAttendance.length;
        const attendanceRate = totalWorkingDays > 0 ? Math.round((presentDays / totalWorkingDays) * 100) : 0;
        
        const totalLeaves = employeeLeaves.length;
        const approvedLeaves = employeeLeaves.filter(l => l.status === 'approved').length;
        const leaveRatio = totalWorkingDays > 0 ? Math.round((approvedLeaves / totalWorkingDays) * 100) : 0;

        const totalClaims = employeeClaims.reduce((sum, claim) => {
          const amount = parseFloat(claim.amount) || 0;
          return sum + amount;
        }, 0);
        const approvedClaims = employeeClaims.filter(c => c.status === 'approved').reduce((sum, claim) => {
          const amount = parseFloat(claim.amount) || 0;
          return sum + amount;
        }, 0);
        
        // Log first few employees for debugging
        if (employee.id === employees[0]?.id || employee.id === employees[1]?.id) {
          console.log(`📄 Employee ${employee.firstName} ${employee.lastName}:`, {
            presentDays,
            attendanceRate: attendanceRate + '%',
            totalLeaves,
            approvedLeaves,
            totalClaims: totalClaims.toFixed(2),
            attendanceRecords: employeeAttendance.length,
            leaveRecords: employeeLeaves.length
          });
        }

        // Determine attendance status and color
        let attendanceStatus = 'Poor';
        let statusColor = 'error';
        if (attendanceRate >= 95) {
          attendanceStatus = 'Excellent';
          statusColor = 'success';
        } else if (attendanceRate >= 85) {
          attendanceStatus = 'Good';
          statusColor = 'info';
        } else if (attendanceRate >= 70) {
          attendanceStatus = 'Average';
          statusColor = 'warning';
        }

        // Calculate trends (comparing with previous period)
        const prevStartDate = selectedPeriod === 'week' ? subDays(startDate, 7) :
                             selectedPeriod === 'quarter' ? subMonths(startDate, 3) :
                             selectedPeriod === 'year' ? subMonths(startDate, 12) :
                             subMonths(startDate, 1);
        
        const prevTotalWorkingDays = calculateWorkingDays(employeeCompany, prevStartDate, new Date(startDate.getTime() - 1));
        
        const prevAttendance = attendanceRecords.filter(record => {
          try {
            if (record.userId !== employee.id) return false;
            
            let recordDate;
            if (record.dateString) {
              recordDate = new Date(record.dateString);
            } else if (record.date) {
              recordDate = record.date.toDate ? record.date.toDate() : new Date(record.date);
            } else if (record.createdAt) {
              recordDate = record.createdAt.toDate ? record.createdAt.toDate() : new Date(record.createdAt);
            } else {
              return false;
            }
            
            return recordDate >= prevStartDate && recordDate < startDate;
          } catch (error) {
            return false;
          }
        }).length;

        const prevAttendanceRate = prevTotalWorkingDays > 0 ? Math.round((prevAttendance / prevTotalWorkingDays) * 100) : 0;
        const attendanceTrend = attendanceRate - prevAttendanceRate;

        return {
          id: employee.id,
          name: `${employee.firstName || 'Unknown'} ${employee.lastName || 'User'}`,
          email: employee.email || 'No email',
          department: employee.department || 'General',
          company: getEmployeeCompany(employee),
          avatar: `${(employee.firstName?.[0] || 'U')}${(employee.lastName?.[0] || 'U')}`,
          position: employee.position || 'Staff',
          
          // Attendance metrics
          attendanceRate,
          presentDays,
          totalWorkingDays,
          absentDays: Math.max(0, totalWorkingDays - presentDays),
          attendanceStatus,
          statusColor,
          
          // Leave info (minimal)
          totalLeaves,
          approvedLeaves,
          
          // Trends
          attendanceTrend,
          
          // Data quality flags
          hasData: presentDays > 0,
          dataQuality: presentDays > 0 ? 'complete' : 'limited'
        };
      });

      // Sort by attendance rate (highest first)
      attendanceMetrics.sort((a, b) => b.attendanceRate - a.attendanceRate);
      
      // Validate and set attendance data
      if (attendanceMetrics.length === 0) {
        console.warn('⚠️ No attendance metrics calculated');
        setError('No employee attendance data available. Please ensure there are users with role "user" or "employee".');
      } else {
        // Check if we have meaningful data
        const employeesWithData = attendanceMetrics.filter(emp => emp.presentDays > 0);
        if (employeesWithData.length === 0) {
          setError('Attendance data loaded but no attendance records found. Showing base analysis.');
          setTimeout(() => setError(''), 8000);
        } else {
          setError(''); // Clear any previous errors
          console.log(`📈 ${employeesWithData.length} employees have actual attendance data`);
        }
      }

      setAttendanceData(attendanceMetrics);
      console.log('✅ Attendance data calculated for', attendanceMetrics.length, 'employees');
      
      if (attendanceMetrics.length > 0) {
        console.log('📊 Sample attendance data:', attendanceMetrics.slice(0, 3).map(emp => ({
          name: emp.name,
          department: emp.department,
          attendanceRate: emp.attendanceRate,
          presentDays: emp.presentDays,
          attendanceStatus: emp.attendanceStatus
        })));
        
        const avgAttendance = Math.round(attendanceMetrics.reduce((sum, emp) => sum + emp.attendanceRate, 0) / attendanceMetrics.length);
        const excellentAttendance = attendanceMetrics.filter(emp => emp.attendanceRate >= 95).length;
        console.log('📈 Overall stats - Avg Attendance:', avgAttendance + '%', 'Excellent Attendance:', excellentAttendance);
      } else {
        console.warn('⚠️ No attendance data calculated. Check if employees have attendance records.');
        setError('No attendance data available. Employees may not have attendance records yet.');
      }

    } catch (error) {
      console.error('❌ Error loading attendance data:', error);
      setError('Failed to load attendance data: ' + error.message);
    }
    
    setLoading(false);
  };

  const handleDialogClose = (employee) => {
    setDetailDialog(false);
    setSelectedEmployee(employee);
  };

  const handleViewDetails = (employee) => {
    setSelectedEmployee(employee);
    setDetailDialog(true);
  };

  // Holiday management functions
  const handleAddHoliday = async () => {
    if (!holidayForm.date || !holidayForm.name) {
      setError('Please fill in both date and holiday name');
      return;
    }

    try {
      await addDoc(collection(db, 'customHolidays'), {
        date: new Date(holidayForm.date),
        name: holidayForm.name,
        type: holidayForm.type,
        createdBy: user.uid,
        createdByName: `${user.firstName} ${user.lastName}`,
        createdAt: new Date()
      });

      setSuccess(`Holiday "${holidayForm.name}" added successfully`);
      setHolidayDialog(false);
      setHolidayForm({ date: '', name: '', type: 'replacement' });
      
      // Reload attendance data to reflect the new holiday
      await loadAttendanceData();
    } catch (error) {
      console.error('Error adding holiday:', error);
      setError('Failed to add holiday: ' + error.message);
    }
  };

  const resetHolidayForm = () => {
    setHolidayForm({ date: '', name: '', type: 'replacement' });
  };

  // Generate individual attendance report for selected employee
  const handleGenerateIndividualReport = async (employee) => {
    setIndividualReportLoading(true);
    setError('');
    
    try {
      // Load individual staff attendance details for the selected period
      const loadIndividualAttendanceDetails = async () => {
        const endDate = new Date();
        let startDate;
        
        switch (selectedPeriod) {
          case 'week':
            startDate = subDays(endDate, 7);
            break;
          case 'quarter':
            startDate = subMonths(endDate, 3);
            break;
          case 'year':
            startDate = subMonths(endDate, 12);
            break;
          default: // month
            startDate = startOfMonth(endDate);
        }

        // Load attendance records for this specific employee
        const attendanceQuery = query(
          collection(db, 'attendance'),
          where('userId', '==', employee.id)
        );
        const attendanceSnapshot = await getDocs(attendanceQuery);
        const attendanceRecords = attendanceSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(record => {
            try {
              let recordDate;
              if (record.dateString) {
                recordDate = new Date(record.dateString);
              } else if (record.date) {
                recordDate = record.date.toDate ? record.date.toDate() : new Date(record.date);
              } else if (record.createdAt) {
                recordDate = record.createdAt.toDate ? record.createdAt.toDate() : new Date(record.createdAt);
              } else {
                return false;
              }
              
              return recordDate >= startDate && recordDate <= endDate;
            } catch (error) {
              console.warn('Error filtering attendance record:', error);
              return false;
            }
          })
          .map(record => ({
            userName: employee.name,
            dateString: record.dateString,
            checkInTime: getRawCheckIn(record),
            checkOutTime: getRawCheckOut(record),
            ...record
          }))
          .sort((a, b) => {
            // Sort by date in chronological order (oldest to newest)
            try {
              let dateA, dateB;
              
              // Get date from dateString first (most reliable), then fallback to other date fields
              if (a.dateString) {
                dateA = new Date(a.dateString);
              } else if (a.checkInTime) {
                dateA = new Date(a.checkInTime.toDate());
              } else if (a.date) {
                dateA = a.date.toDate ? a.date.toDate() : new Date(a.date);
              } else {
                dateA = new Date(0); // Fallback to epoch
              }
              
              if (b.dateString) {
                dateB = new Date(b.dateString);
              } else if (b.checkInTime) {
                dateB = new Date(b.checkInTime.toDate());
              } else if (b.date) {
                dateB = b.date.toDate ? b.date.toDate() : new Date(b.date);
              } else {
                dateB = new Date(0); // Fallback to epoch
              }
              
              return dateA - dateB; // Chronological order (oldest first)
            } catch (error) {
              console.warn('Error sorting attendance records by date:', error);
              return 0; // Keep original order if sorting fails
            }
          });

        return attendanceRecords;
      };

      const individualAttendanceDetails = await loadIndividualAttendanceDetails();
      console.log('Loaded individual attendance details:', individualAttendanceDetails.length, 'records for', employee.name);

      const additionalData = {
        companyName: getEmployeeCompany(employee),
        generatedBy: `${user.firstName} ${user.lastName}`,
        employeeName: employee.name,
        department: employee.department,
        position: employee.position
      };

      // Create a custom PDF with individual employee header info
      const customPdfData = {
        title: `Individual Attendance Report - ${employee.name}`,
        data: individualAttendanceDetails,
        columns: [
          { key: 'userName', header: 'Staff Name', width: 2.5 },
          { key: 'date', header: 'Date', width: 1.5, formatter: (record) => {
            if (record.checkInTime) {
              return new Date(record.checkInTime.toDate()).toLocaleDateString('en-GB');
            }
            return record.dateString ? new Date(record.dateString).toLocaleDateString('en-GB') : 'N/A';
          }},
          { key: 'checkInTime', header: 'Check In Time', width: 1.8, formatter: (record) => {
            if (record.checkInTime) {
              return new Date(record.checkInTime.toDate()).toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit'
              });
            }
            return 'Not recorded';
          }},
          { key: 'checkOutTime', header: 'Check Out Time', width: 1.8, formatter: (record) => {
            if (record.checkOutTime) {
              return new Date(record.checkOutTime.toDate()).toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit'
              });
            }
            return 'Not recorded';
          }},
          { key: 'workingHours', header: 'Working Hours', width: 1.4, formatter: (record) => {
            if (record.checkInTime && record.checkOutTime) {
              const checkIn = new Date(record.checkInTime.toDate());
              const checkOut = new Date(record.checkOutTime.toDate());
              const diffMs = checkOut - checkIn;
              const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
              const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
              return `${diffHours}h ${diffMinutes}m`;
            }
            return 'N/A';
          }}
        ],
        filters: {
          'Period': selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1),
          'Employee': employee.name,
          'Department': employee.department,
          'Position': employee.position || 'Staff'
        },
        orientation: 'landscape',
        filename: `individual_attendance_${employee.name.replace(/\s+/g, '_')}_${selectedPeriod}`,
        additionalInfo: {
          totalCount: individualAttendanceDetails.length,
          generatedBy: additionalData.generatedBy,
          company: additionalData.companyName,
          employeeDetails: {
            name: employee.name,
            department: employee.department,
            position: employee.position,
            attendanceRate: `${employee.attendanceRate}%`,
            presentDays: employee.presentDays,
            totalWorkingDays: employee.totalWorkingDays
          }
        }
      };

      const success = await pdfService.createProfessionalPDF(customPdfData);
      
      if (success) {
        setSuccess(`✅ Individual attendance report for ${employee.name} generated successfully!`);
      } else {
        setError(`❌ Failed to generate individual attendance report for ${employee.name}`);
      }
    } catch (error) {
      console.error('Individual report generation error:', error);
      setError(`❌ Individual report generation error: ${error.message}`);
    }
    setIndividualReportLoading(false);
    
    // Clear message after 5 seconds
    setTimeout(() => {
      setError('');
      setSuccess('');
    }, 5000);
  };

  // Generate attendance performance summary by department
  const getDepartmentAttendanceData = () => {
    return departments.map(dept => {
      const deptEmployees = attendanceData.filter(emp => emp.department === dept);
      const avgAttendance = deptEmployees.length > 0 ? 
        Math.round(deptEmployees.reduce((sum, emp) => sum + emp.attendanceRate, 0) / deptEmployees.length) : 0;
      
      return {
        department: dept,
        attendance: avgAttendance,
        employees: deptEmployees.length,
        excellent: deptEmployees.filter(emp => emp.attendanceRate >= 95).length,
        good: deptEmployees.filter(emp => emp.attendanceRate >= 85 && emp.attendanceRate < 95).length,
        poor: deptEmployees.filter(emp => emp.attendanceRate < 70).length
      };
    });
  };

  const getAttendanceIcon = (status) => {
    switch (status) {
      case 'Excellent': return <CheckCircle />;
      case 'Good': return <Schedule />;
      case 'Average': return <AccessTime />;
      default: return <Warning />;
    }
  };

  const getTrendIcon = (trend) => {
    if (trend > 0) return <TrendingUp color="success" />;
    if (trend < 0) return <TrendingDown color="error" />;
    return <TimelineIcon color="action" />;
  };

  // Summary statistics (based on all data, not filtered)
  const avgAttendanceRate = attendanceData.length > 0 ? 
    Math.round(attendanceData.reduce((sum, emp) => sum + emp.attendanceRate, 0) / attendanceData.length) : 0;
  const excellentAttendance = attendanceData.filter(emp => emp.attendanceRate >= 95).length;
  const goodAttendance = attendanceData.filter(emp => emp.attendanceRate >= 85 && emp.attendanceRate < 95).length;
  const poorAttendance = attendanceData.filter(emp => emp.attendanceRate < 70).length;
  const totalPresent = attendanceData.reduce((sum, emp) => sum + emp.presentDays, 0);
  const totalAbsent = attendanceData.reduce((sum, emp) => sum + emp.absentDays, 0);

  // Filtered summary statistics
  const filteredAvgAttendance = filteredAttendanceData.length > 0 ? 
    Math.round(filteredAttendanceData.reduce((sum, emp) => sum + emp.attendanceRate, 0) / filteredAttendanceData.length) : 0;
  const filteredExcellent = filteredAttendanceData.filter(emp => emp.attendanceRate >= 95).length;
  const filteredPoor = filteredAttendanceData.filter(emp => emp.attendanceRate < 70).length;

  // Performance metrics for summary cards
  const avgPerformanceScore = avgAttendanceRate; // Using attendance rate as performance score
  const topPerformers = excellentAttendance; // Number of employees with excellent attendance

  // Chart data for department comparison
  const departmentData = getDepartmentAttendanceData();

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
      <Box sx={{ mb: { xs: 2, sm: 4 } }}>
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'flex-start', md: 'center' }, 
          mb: 2, 
          gap: { xs: 2, md: 0 },
          justifyContent: { md: 'space-between' }
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', width: { xs: '100%', md: 'auto' } }}>
            <Avatar 
              sx={{ 
                bgcolor: 'primary.main', 
                mr: 2,
                width: { xs: 40, sm: 56 }, 
                height: { xs: 40, sm: 56 },
                boxShadow: '0 4px 15px rgba(25, 118, 210, 0.3)'
              }}
            >
              <Analytics sx={{ fontSize: { xs: 20, sm: 28 } }} />
            </Avatar>
            <Box>
              <Typography 
                variant="h4" 
                sx={{ 
                  fontSize: { xs: '1.5rem', sm: '2.5rem' },
                  fontWeight: 700,
                  background: 'linear-gradient(45deg, #1976d2, #42a5f5)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  mb: 0.5,
                  lineHeight: 1.2
                }}
              >
                Individual Attendance Analytics
              </Typography>
              <Typography 
                variant="subtitle1" 
                color="text.secondary" 
                sx={{ 
                  fontSize: { xs: '0.875rem', sm: '1.125rem' },
                  fontWeight: 500,
                  display: { xs: 'none', sm: 'block' }
                }}
              >
                Track and analyze individual employee attendance performance
              </Typography>
            </Box>
          </Box>
          {!loading && (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: { xs: 'column', md: 'row' },
              gap: { xs: 1.5, md: 2 }, 
              alignItems: { xs: 'stretch', md: 'center' },
              width: { xs: '100%', md: 'auto' }
            }}>
              <Fab 
                color="secondary" 
                variant="extended"
                onClick={() => setHolidayDialog(true)}
                size={isMobile ? "small" : "medium"}
                sx={{
                  py: { xs: 1, md: 1.5 },
                  px: { xs: 2, md: 3 },
                  borderRadius: { xs: 2, md: 3 },
                  fontWeight: 600,
                  textTransform: 'none',
                  fontSize: { xs: '0.75rem', md: '0.875rem' },
                  boxShadow: '0 4px 15px rgba(156, 39, 176, 0.3)',
                  mr: { xs: 0, md: 2 },
                  mb: { xs: 1, md: 0 },
                  '&:hover': {
                    boxShadow: '0 6px 20px rgba(156, 39, 176, 0.4)',
                    transform: 'translateY(-1px)'
                  }
                }}
              >
                <Add sx={{ mr: { xs: 0.5, md: 1 }, fontSize: { xs: 18, md: 20 } }} />
                <Box sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  {isMobile ? 'Holiday' : 'Add Holiday'}
                </Box>
              </Fab>
              
              <Fab 
                color="primary" 
                variant="extended"
                onClick={() => {}} // Add export functionality
                size={isMobile ? "small" : "medium"}
                sx={{
                  position: { xs: 'fixed', md: 'relative' },
                  bottom: { xs: 16, md: 'auto' },
                  right: { xs: 16, md: 'auto' },
                  zIndex: { xs: 1000, md: 'auto' },
                  py: { xs: 1, md: 1.5 },
                  px: { xs: 2, md: 3 },
                  borderRadius: { xs: 2, md: 3 },
                  fontWeight: 600,
                  textTransform: 'none',
                  fontSize: { xs: '0.75rem', md: '0.875rem' },
                  boxShadow: '0 4px 15px rgba(25, 118, 210, 0.3)',
                  minWidth: { xs: 'auto', md: 'auto' },
                  width: { xs: 'auto', md: 'auto' },
                  display: { xs: 'flex', md: 'flex' },
                  '&:hover': {
                    boxShadow: '0 6px 20px rgba(25, 118, 210, 0.4)',
                    transform: 'translateY(-1px)'
                  }
                }}
              >
                <Download sx={{ mr: { xs: 0.5, md: 1 }, fontSize: { xs: 18, md: 20 } }} />
                <Box sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  {isMobile ? 'Export' : 'Export All'}
                </Box>
              </Fab>
            </Box>
          )}
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

      {/* Search and Filter Controls */}
      <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 3 } }}>
          {/* Search Bar */}
          <TextField
            placeholder="Search by name, email, or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            fullWidth
            size={isMobile ? "small" : "medium"}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton onClick={() => setSearchQuery('')} size="small">
                    <Clear />
                  </IconButton>
                </InputAdornment>
              )
            }}
          />

          {/* Filter Controls */}
          {isMobile ? (
            // Mobile: Stacked layout
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Period</InputLabel>
                  <Select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    label="Period"
                  >
                    <MenuItem value="week">Week</MenuItem>
                    <MenuItem value="month">Month</MenuItem>
                    <MenuItem value="quarter">Quarter</MenuItem>
                    <MenuItem value="year">Year</MenuItem>
                  </Select>
                </FormControl>
                
                <FormControl size="small" fullWidth>
                  <InputLabel>Department</InputLabel>
                  <Select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    label="Department"
                  >
                    <MenuItem value="all">All</MenuItem>
                    {departments.map(dept => (
                      <MenuItem key={dept} value={dept}>{dept}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              
              <Box sx={{ display: 'flex', gap: 1 }}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Attendance</InputLabel>
                  <Select
                    value={attendanceFilter}
                    onChange={(e) => setAttendanceFilter(e.target.value)}
                    label="Attendance"
                  >
                    <MenuItem value="all">All</MenuItem>
                    <MenuItem value="excellent">Excellent</MenuItem>
                    <MenuItem value="good">Good</MenuItem>
                    <MenuItem value="average">Average</MenuItem>
                    <MenuItem value="poor">Poor</MenuItem>
                  </Select>
                </FormControl>

                <FormControl size="small" fullWidth>
                  <InputLabel>Sort By</InputLabel>
                  <Select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    label="Sort By"
                  >
                    <MenuItem value="attendance">Rate</MenuItem>
                    <MenuItem value="name">Name</MenuItem>
                    <MenuItem value="department">Dept</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              
              <Button 
                variant="outlined" 
                startIcon={<Clear />}
                onClick={clearFilters}
                disabled={!searchQuery && selectedDepartment === 'all' && !selectedCompany && attendanceFilter === 'all'}
                fullWidth
                size="small"
              >
                Clear Filters
              </Button>
            </Box>
          ) : (
            // Desktop: Horizontal layout
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <CompanyFilter 
                selectedCompany={selectedCompany}
                onCompanyChange={setSelectedCompany}
                data={attendanceData}
              />
              
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Period</InputLabel>
                <Select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  label="Period"
                >
                  <MenuItem value="week">This Week</MenuItem>
                  <MenuItem value="month">This Month</MenuItem>
                  <MenuItem value="quarter">This Quarter</MenuItem>
                  <MenuItem value="year">This Year</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Department</InputLabel>
                <Select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  label="Department"
                >
                  <MenuItem value="all">All Departments</MenuItem>
                  {departments.map(dept => (
                    <MenuItem key={dept} value={dept}>{dept}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Attendance</InputLabel>
                <Select
                  value={attendanceFilter}
                  onChange={(e) => setAttendanceFilter(e.target.value)}
                  label="Attendance"
                >
                  <MenuItem value="all">All Levels</MenuItem>
                  <MenuItem value="excellent">Excellent (95%+)</MenuItem>
                  <MenuItem value="good">Good (85-94%)</MenuItem>
                  <MenuItem value="average">Average (70-84%)</MenuItem>
                  <MenuItem value="poor">Poor (&lt;70%)</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  label="Sort By"
                >
                  <MenuItem value="attendance">Attendance Rate</MenuItem>
                  <MenuItem value="name">Name</MenuItem>
                  <MenuItem value="department">Department</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 100 }}>
                <InputLabel>Order</InputLabel>
                <Select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  label="Order"
                >
                  <MenuItem value="desc">High to Low</MenuItem>
                  <MenuItem value="asc">Low to High</MenuItem>
                </Select>
              </FormControl>
              
              <Button 
                variant="outlined" 
                startIcon={<Clear />}
                onClick={clearFilters}
                disabled={!searchQuery && selectedDepartment === 'all' && !selectedCompany && attendanceFilter === 'all'}
              >
                Clear Filters
              </Button>
            </Box>
          )}

          {/* Results Summary */}
          {(searchQuery || selectedDepartment !== 'all' || selectedCompany || attendanceFilter !== 'all') && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, pt: 1, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="body2" color="text.secondary">
                Showing {filteredAttendanceData.length} of {attendanceData.length} employees
              </Typography>
              {filteredAttendanceData.length > 0 && (
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Chip 
                    label={`Avg: ${filteredAvgAttendance}%`} 
                    color="primary" 
                    size="small" 
                  />
                  <Chip 
                    label={`Excellent: ${filteredExcellent}`} 
                    color="success" 
                    size="small" 
                  />
                  <Chip 
                    label={`Need Attention: ${filteredPoor}`} 
                    color="warning" 
                    size="small" 
                  />
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress size={60} />
        </Box>
      ) : (
        <>
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
                    ? 'linear-gradient(135deg, #1a1a1a 0%, #1f0d2b 100%)'
                    : 'linear-gradient(135deg, #ffffff 0%, #f3e5f5 100%)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
                    borderColor: 'secondary.light'
                  }
                }}
              >
                <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: { xs: 'column', sm: 'row' } }}>
                    <Avatar sx={{ 
                      bgcolor: 'secondary.main', 
                      mr: { xs: 0, sm: 2 }, 
                      mb: { xs: 1, sm: 0 },
                      width: { xs: 40, sm: 48 },
                      height: { xs: 40, sm: 48 },
                      boxShadow: '0 4px 15px rgba(156, 39, 176, 0.3)'
                    }}>  
                      <Assessment sx={{ fontSize: { xs: 20, sm: 24 } }} />
                    </Avatar>
                    <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
                      <Typography 
                        variant="h5" 
                        sx={{ 
                          fontSize: { xs: '1.125rem', sm: '1.5rem' },
                          fontWeight: 600,
                          color: 'secondary.main'
                        }}
                      >
                        {avgPerformanceScore}%
                      </Typography>
                      <Typography 
                        color="text.secondary" 
                        sx={{ 
                          fontSize: { xs: '0.75rem', sm: '0.875rem' },
                          fontWeight: 500
                        }}
                      >
                        Avg Performance
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
                      <EmojiEvents sx={{ fontSize: { xs: 20, sm: 24 } }} />
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
                        {topPerformers}
                      </Typography>
                      <Typography 
                        color="text.secondary" 
                        sx={{ 
                          fontSize: { xs: '0.75rem', sm: '0.875rem' },
                          fontWeight: 500
                        }}
                      >
                        Top Performers
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
                      <Schedule sx={{ fontSize: { xs: 20, sm: 24 } }} />
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
                        {avgAttendanceRate}%
                      </Typography>
                      <Typography 
                        color="text.secondary" 
                        sx={{ 
                          fontSize: { xs: '0.75rem', sm: '0.875rem' },
                          fontWeight: 500
                        }}
                      >
                        Avg Attendance
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
                      boxShadow: '0 4px 15px rgba(255, 152, 0, 0.3)'
                    }}>  
                      <Warning sx={{ fontSize: { xs: 20, sm: 24 } }} />
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
                        {poorAttendance}
                      </Typography>
                      <Typography 
                        color="text.secondary" 
                        sx={{ 
                          fontSize: { xs: '0.75rem', sm: '0.875rem' },
                          fontWeight: 500
                        }}
                      >
                        Poor Attendance
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Charts */}
          <Grid container spacing={3} sx={{ mb: 4 }}>

            <Grid item xs={12} md={8}>
              <Card sx={{ borderRadius: 3, boxShadow: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                    Department Attendance Comparison
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsBarChart data={departmentData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="department" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip formatter={(value) => [`${value}%`, '']} />
                      <Legend />
                      <Bar dataKey="attendance" fill="#2196f3" name="Average Attendance %" />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card sx={{ borderRadius: 3, boxShadow: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                    Attendance Distribution
                  </Typography>
                  <>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" gutterBottom>Excellent (95%+)</Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={attendanceData.length > 0 ? (excellentAttendance / attendanceData.length) * 100 : 0} 
                        color="success"
                        sx={{ mb: 1 }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {excellentAttendance} employees
                      </Typography>
                    </Box>
                    
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" gutterBottom>Good (85-94%)</Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={attendanceData.length > 0 ? (goodAttendance / attendanceData.length) * 100 : 0} 
                        color="info"
                        sx={{ mb: 1 }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {goodAttendance} employees
                      </Typography>
                    </Box>
                    
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" gutterBottom>Average (70-84%)</Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={attendanceData.length > 0 ? 
                          (attendanceData.filter(emp => emp.attendanceRate >= 70 && emp.attendanceRate < 85).length / attendanceData.length) * 100 : 0} 
                        color="warning"
                        sx={{ mb: 1 }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {attendanceData.filter(emp => emp.attendanceRate >= 70 && emp.attendanceRate < 85).length} employees
                      </Typography>
                    </Box>
                    
                    <Box>
                      <Typography variant="body2" gutterBottom>Poor (&lt;70%)</Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={attendanceData.length > 0 ? (poorAttendance / attendanceData.length) * 100 : 0} 
                        color="error"
                      />
                      <Typography variant="caption" color="text.secondary">
                        {poorAttendance} employees
                      </Typography>
                    </Box>
                  </>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Enhanced Performance Section */}
          <Paper sx={{ 
            borderRadius: 3, 
            boxShadow: 3, 
            overflow: 'hidden',
            // Disable touch gestures on mobile
            touchAction: 'pan-y pinch-zoom',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none'
          }}>
            <Box sx={{ p: { xs: 2, sm: 3 } }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Individual Attendance ({filteredAttendanceData.length} employees)
                {filteredAttendanceData.length !== attendanceData.length && (
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                    (filtered from {attendanceData.length} total)
                  </Typography>
                )}
              </Typography>
            </Box>
            <Divider />
            
            {isMobile ? (
              // Mobile: Card-based view
              <Box sx={{ p: 2 }}>
                {paginatedAttendanceData.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <PersonSearch sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No employees found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {searchQuery ? 
                        `No employees match "${searchQuery}". Try adjusting your search terms.` :
                        'Try adjusting your filters to see more results.'
                      }
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: 2,
                    // Disable touch gestures
                    touchAction: 'pan-y',
                    userSelect: 'none'
                  }}>
                    {paginatedAttendanceData.map((employee, index) => (
                      <Card 
                        key={employee.id}
                        sx={{
                          cursor: 'pointer',
                          '&:hover': { 
                            boxShadow: 4,
                            transform: 'translateY(-1px)',
                            transition: 'all 0.2s ease-in-out'
                          },
                          transition: 'all 0.2s ease-in-out'
                        }}
                        onClick={() => handleViewDetails(employee)}
                      >
                        <CardContent sx={{ py: 2 }}>
                          {/* Employee Header */}
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <Avatar sx={{ mr: 2, bgcolor: `${employee.statusColor}.main`, width: 48, height: 48 }}>
                              {employee.avatar}
                            </Avatar>
                            <Box sx={{ flexGrow: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                  {employee.name}
                                </Typography>
                                {employee.dataQuality === 'limited' && (
                                  <Chip 
                                    label="Limited" 
                                    size="small" 
                                    color="warning" 
                                    variant="outlined"
                                    sx={{ fontSize: '0.6rem', height: 18 }}
                                  />
                                )}
                              </Box>
                              <Typography variant="body2" color="text.secondary">
                                {employee.department} • {employee.position || 'No Position'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {employee.email}
                              </Typography>
                            </Box>
                            <Box sx={{ textAlign: 'center' }}>
                              <Typography 
                                variant="h4" 
                                color="primary.main" 
                                sx={{ fontWeight: 700, mb: 0.5 }}
                              >
                                {employee.attendanceRate}%
                              </Typography>
                              <Chip 
                                icon={getAttendanceIcon(employee.attendanceStatus)}
                                label={employee.attendanceStatus}
                                color={employee.statusColor}
                                size="small"
                              />
                            </Box>
                          </Box>
                          
                          {/* Employee Metrics */}
                          <Box sx={{ 
                            display: 'grid', 
                            gridTemplateColumns: '1fr 1fr 1fr', 
                            gap: 1,
                            mt: 2,
                            pt: 2,
                            borderTop: 1,
                            borderColor: 'divider'
                          }}>
                            <Box sx={{ textAlign: 'center' }}>
                              <Typography variant="body2" color="text.secondary">
                                Present
                              </Typography>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'success.main' }}>
                                {employee.presentDays}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                of {employee.totalWorkingDays}
                              </Typography>
                            </Box>
                            <Box sx={{ textAlign: 'center' }}>
                              <Typography variant="body2" color="text.secondary">
                                Absent
                              </Typography>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'error.main' }}>
                                {employee.absentDays}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                days
                              </Typography>
                            </Box>
                            <Box sx={{ textAlign: 'center' }}>
                              <Typography variant="body2" color="text.secondary">
                                Trend
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 0.5 }}>
                                {getTrendIcon(employee.attendanceTrend)}
                                <Typography variant="caption" sx={{ ml: 0.5, fontWeight: 600 }}>
                                  {employee.attendanceTrend > 0 ? '+' : ''}{employee.attendanceTrend}%
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                          
                          <Typography variant="caption" color="primary.main" sx={{ display: 'block', textAlign: 'center', mt: 1, fontWeight: 500 }}>
                            Tap to view detailed analytics
                          </Typography>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                )}
                
                {/* Mobile Pagination */}
                {filteredAttendanceData.length > employeesPerPage && totalPages > 1 && (
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mt: 3,
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
                        {Math.min((safePage + 1) * employeesPerPage, filteredAttendanceData.length)} of {filteredAttendanceData.length} employees
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
              </Box>
            ) : (
              // Desktop: Table view
              <>
                <TableContainer
                  sx={{
                    // Disable horizontal scrolling and touch gestures on mobile
                    overflowX: isMobile ? 'hidden' : 'auto',
                    touchAction: 'pan-y',
                    '&::-webkit-scrollbar': {
                      display: 'none'
                    },
                    scrollbarWidth: 'none'
                  }}
                >
                  <Table
                    sx={{
                      // Prevent table from being too wide on mobile
                      minWidth: isMobile ? 'unset' : 650,
                      touchAction: 'pan-y'
                    }}
                  >
                    <TableHead>
                      <TableRow>
                        <TableCell>Employee</TableCell>
                        <TableCell align="center">Attendance Rate</TableCell>
                        <TableCell align="center">Status</TableCell>
                        <TableCell align="center">Present Days</TableCell>
                        <TableCell align="center">Absent Days</TableCell>
                        <TableCell align="center">Trend</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedAttendanceData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}>
                            <PersonSearch sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary" gutterBottom>
                              No employees found
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {searchQuery ? 
                                `No employees match "${searchQuery}". Try adjusting your search terms.` :
                                'Try adjusting your filters to see more results.'
                              }
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedAttendanceData.map((employee, index) => (
                        <TableRow 
                          key={employee.id} 
                          hover
                          onClick={() => handleViewDetails(employee)}
                          sx={{ 
                            cursor: 'pointer',
                            '&:hover': { 
                              backgroundColor: 'action.hover' 
                            },
                          }}
                        >
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Avatar sx={{ mr: 2, bgcolor: `${employee.statusColor}.main` }}>
                                {employee.avatar}
                              </Avatar>
                              <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="subtitle2">
                                    {employee.name}
                                  </Typography>
                                  {employee.dataQuality === 'limited' && (
                                    <Chip 
                                      label="Limited Data" 
                                      size="small" 
                                      color="warning" 
                                      variant="outlined"
                                      sx={{ fontSize: '0.6rem', height: 18 }}
                                    />
                                  )}
                                </Box>
                                <Typography variant="body2" color="text.secondary">
                                  {employee.department} • {employee.position || 'No Position'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {employee.email}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Typography variant="h6" color="primary">
                                {employee.attendanceRate}%
                              </Typography>
                            </Box>
                          </TableCell>
                          
                          <TableCell align="center">
                            <Chip 
                              icon={getAttendanceIcon(employee.attendanceStatus)}
                              label={employee.attendanceStatus}
                              color={employee.statusColor}
                              size="small"
                            />
                          </TableCell>
                          
                          <TableCell align="center">
                            <Typography variant="body2" fontWeight="600">
                              {employee.presentDays}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              out of {employee.totalWorkingDays}
                            </Typography>
                          </TableCell>
                          
                          <TableCell align="center">
                            <Typography variant="body2" fontWeight="600" color="error.main">
                              {employee.absentDays}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              absent days
                            </Typography>
                          </TableCell>
                          
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {getTrendIcon(employee.attendanceTrend)}
                              <Typography variant="caption" sx={{ ml: 0.5 }}>
                                {employee.attendanceTrend > 0 ? '+' : ''}{employee.attendanceTrend}%
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                
              </>
            )}
          </Paper>

          {/* Desktop Pagination */}
          {!isMobile && filteredAttendanceData.length > employeesPerPage && totalPages > 1 && (
            <Paper elevation={1} sx={{ mt: 2, p: 3, borderRadius: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Showing {safePage * employeesPerPage + 1} to{' '}
                  {Math.min((safePage + 1) * employeesPerPage, filteredAttendanceData.length)} of{' '}
                  {filteredAttendanceData.length} employees
                </Typography>
                
                {/* Navigation Controls */}
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 2,
                  touchAction: 'manipulation'
                }}>
                  <Button 
                    variant="outlined" 
                    onClick={handlePrevPage}
                    disabled={safePage === 0}
                    startIcon={<ArrowBack />}
                    size="small"
                  >
                    Previous
                  </Button>
                  
                  {/* Page Numbers */}
                  <Box sx={{ 
                    display: 'flex', 
                    gap: 1, 
                    alignItems: 'center',
                    touchAction: 'manipulation'
                  }}>
                    {Array.from({ length: Math.min(totalPages, 5) }).map((_, index) => {
                      // Show first 2, current, and last 2 pages when there are many pages
                      let pageIndex;
                      if (totalPages <= 5) {
                        pageIndex = index;
                      } else {
                        if (index < 2) {
                          pageIndex = index;
                        } else if (index === 2) {
                          pageIndex = Math.max(2, Math.min(safePage, totalPages - 3));
                        } else {
                          pageIndex = totalPages - (5 - index);
                        }
                      }
                      
                      const isCurrentPage = pageIndex === safePage;
                      
                      return (
                        <Button
                          key={pageIndex}
                          variant={isCurrentPage ? "contained" : "outlined"}
                          onClick={() => setCurrentPage(pageIndex)}
                          size="small"
                          sx={{ 
                            minWidth: 40,
                            height: 32,
                            fontWeight: isCurrentPage ? 600 : 400
                          }}
                        >
                          {pageIndex + 1}
                        </Button>
                      );
                    })}
                  </Box>
                  
                  <Button 
                    variant="outlined" 
                    onClick={handleNextPage}
                    disabled={safePage === totalPages - 1}
                    endIcon={<ArrowForward />}
                    size="small"
                  >
                    Next
                  </Button>
                </Box>
              </Box>
            </Paper>
          )}


          {/* Enhanced Employee Detail Dialog */}
          <Dialog 
            open={detailDialog} 
            onClose={handleDialogClose}
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
            <DialogTitle sx={{ position: 'relative', zIndex: 1 }}>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                color: 'text.primary',
                py: 2
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar sx={{ 
                    bgcolor: 'primary.main', 
                    mr: 3,
                    width: 60,
                    height: 60
                  }}>
                    <Analytics sx={{ fontSize: 30, color: 'white' }} />
                  </Avatar>
                  <Box>
                    <Typography 
                      variant="h4" 
                      sx={{ 
                        fontWeight: 700,
                        mb: 0.5
                      }}
                    >
                      {selectedEmployee?.name}
                    </Typography>
                    <Typography 
                      variant="subtitle1" 
                      color="text.secondary"
                      sx={{ 
                        fontSize: '1.1rem'
                      }}
                    >
                      Individual Attendance Analytics
                    </Typography>
                  </Box>
                </Box>
                <IconButton 
                  onClick={handleDialogClose}
                  sx={{ 
                    color: 'text.primary',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    }
                  }}
                >
                  <Close />
                </IconButton>
              </Box>
            </DialogTitle>
            
            <DialogContent sx={{ 
              bgcolor: 'background.paper',
              m: 2,
              borderRadius: 3
            }}>
              {selectedEmployee && (
                <>
                  {/* Header Stats Cards */}
                  <Box sx={{ mb: 3, mt: 2 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={6} sm={3}>
                        <Card sx={{ 
                          bgcolor: 'background.paper',
                          borderRadius: 2,
                          boxShadow: 2,
                          border: '1px solid rgba(0,0,0,0.1)'
                        }}>
                          <CardContent sx={{ textAlign: 'center', py: 2 }}>
                            <Avatar sx={{ bgcolor: 'primary.main', mx: 'auto', mb: 1, width: 40, height: 40 }}>
                              <Assessment sx={{ fontSize: 20 }} />
                            </Avatar>
                            <Typography variant="h5" fontWeight="bold" color="text.primary">
                              {selectedEmployee.attendanceRate}%
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Attendance Rate
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                      
                      <Grid item xs={6} sm={3}>
                        <Card sx={{ 
                          bgcolor: 'background.paper',
                          borderRadius: 2,
                          boxShadow: 2,
                          border: '1px solid rgba(0,0,0,0.1)'
                        }}>
                          <CardContent sx={{ textAlign: 'center', py: 2 }}>
                            <Avatar sx={{ bgcolor: 'success.main', mx: 'auto', mb: 1, width: 40, height: 40 }}>
                              <CheckCircle sx={{ fontSize: 20 }} />
                            </Avatar>
                            <Typography variant="h5" fontWeight="bold" color="text.primary">
                              {selectedEmployee.presentDays}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Present Days
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                      
                      <Grid item xs={6} sm={3}>
                        <Card sx={{ 
                          bgcolor: 'background.paper',
                          borderRadius: 2,
                          boxShadow: 2,
                          border: '1px solid rgba(0,0,0,0.1)'
                        }}>
                          <CardContent sx={{ textAlign: 'center', py: 2 }}>
                            <Avatar sx={{ bgcolor: 'error.main', mx: 'auto', mb: 1, width: 40, height: 40 }}>
                              <Warning sx={{ fontSize: 20 }} />
                            </Avatar>
                            <Typography variant="h5" fontWeight="bold" color="text.primary">
                              {selectedEmployee.absentDays}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Absent Days
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                      
                      <Grid item xs={6} sm={3}>
                        <Card sx={{ 
                          bgcolor: 'background.paper',
                          borderRadius: 2,
                          boxShadow: 2,
                          border: '1px solid rgba(0,0,0,0.1)'
                        }}>
                          <CardContent sx={{ textAlign: 'center', py: 2 }}>
                            <Avatar sx={{ bgcolor: selectedEmployee.statusColor + '.main', mx: 'auto', mb: 1, width: 40, height: 40 }}>
                              {getAttendanceIcon(selectedEmployee.attendanceStatus)}
                            </Avatar>
                            <Typography variant="h6" fontWeight="bold" color="text.primary">
                              {selectedEmployee.attendanceStatus}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Status
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    </Grid>
                  </Box>

                  {/* Detailed Analytics */}
                  <Grid container spacing={{ xs: 2, sm: 4 }}>
                    {/* Performance Breakdown */}
                    <Grid item xs={12} md={6}>
                      <Card sx={{ 
                        borderRadius: 2, 
                        boxShadow: 2,
                        bgcolor: 'background.paper',
                        border: '1px solid rgba(0,0,0,0.1)'
                      }}>
                        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                            <Analytics sx={{ color: 'primary.main', mr: 1, fontSize: 28 }} />
                            <Typography variant="h6" fontWeight="600">
                              Attendance Analytics
                            </Typography>
                          </Box>
                          
                          <Stack spacing={2.5}>
                            <Box sx={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              p: 2,
                              bgcolor: 'rgba(255, 255, 255, 0.7)',
                              borderRadius: 2,
                              border: '1px solid rgba(0,0,0,0.05)'
                            }}>
                              <Typography color="text.primary" fontWeight="500">
                                Department
                              </Typography>
                              <Chip 
                                label={selectedEmployee.department} 
                                color="primary" 
                                sx={{ fontWeight: 600 }}
                              />
                            </Box>
                            
                            <Box sx={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              p: 2,
                              bgcolor: 'rgba(255, 255, 255, 0.7)',
                              borderRadius: 2,
                              border: '1px solid rgba(0,0,0,0.05)'
                            }}>
                              <Typography color="text.primary" fontWeight="500">
                                Position
                              </Typography>
                              <Chip 
                                label={selectedEmployee.position || 'No Position'} 
                                color="secondary" 
                                sx={{ fontWeight: 600 }}
                              />
                            </Box>
                            
                            <Box sx={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              p: 2,
                              bgcolor: 'rgba(255, 255, 255, 0.7)',
                              borderRadius: 2,
                              border: '1px solid rgba(0,0,0,0.05)'
                            }}>
                              <Typography color="text.primary" fontWeight="500">
                                Total Working Days
                              </Typography>
                              <Chip 
                                label={selectedEmployee.totalWorkingDays} 
                                color="info" 
                                sx={{ fontWeight: 600 }}
                              />
                            </Box>
                            
                            <Box sx={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              p: 2,
                              bgcolor: 'rgba(255, 255, 255, 0.7)',
                              borderRadius: 2,
                              border: '1px solid rgba(0,0,0,0.05)'
                            }}>
                              <Typography color="text.primary" fontWeight="500">
                                Email
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {selectedEmployee.email}
                              </Typography>
                            </Box>
                          </Stack>
                        </CardContent>
                      </Card>
                    </Grid>
                    
                    {/* Performance Trend and Status */}
                    <Grid item xs={12} md={6}>
                      <Card sx={{ 
                        borderRadius: 2, 
                        boxShadow: 2,
                        bgcolor: 'background.paper',
                        border: '1px solid rgba(0,0,0,0.1)'
                      }}>
                        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                            <EmojiEvents sx={{ color: 'primary.main', mr: 1, fontSize: 28 }} />
                            <Typography variant="h6" fontWeight="600">
                              Performance Status
                            </Typography>
                          </Box>
                          
                          <Grid container spacing={{ xs: 1, sm: 3 }} sx={{ mb: 3 }}>
                            <Grid item xs={12}>
                              <Box sx={{ 
                                textAlign: 'center',
                                p: { xs: 2, sm: 3 },
                                bgcolor: 'rgba(255, 255, 255, 0.8)',
                                borderRadius: 2,
                                border: `2px solid ${selectedEmployee.statusColor === 'success' ? '#4caf50' : selectedEmployee.statusColor === 'warning' ? '#ff9800' : selectedEmployee.statusColor === 'error' ? '#f44336' : '#2196f3'}`,
                                mb: 2
                              }}>
                                <Typography variant="h3" color={`${selectedEmployee.statusColor}.main`} fontWeight="bold">
                                  {selectedEmployee.attendanceRate}%
                                </Typography>
                                <Typography variant="h6" color="text.primary" sx={{ fontWeight: 500, mt: 1 }}>
                                  {selectedEmployee.attendanceStatus}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  Current Status
                                </Typography>
                              </Box>
                            </Grid>
                          </Grid>
                          
                          {/* Performance Trend */}
                          <Box sx={{ 
                            textAlign: 'center',
                            p: 2,
                            bgcolor: 'rgba(255, 255, 255, 0.8)',
                            borderRadius: 2,
                            border: '1px solid rgba(0,0,0,0.1)'
                          }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                              {getTrendIcon(selectedEmployee.attendanceTrend)}
                              <Typography variant="h6" sx={{ ml: 1, fontWeight: 600 }}>
                                Trend: {selectedEmployee.attendanceTrend > 0 ? '+' : ''}{selectedEmployee.attendanceTrend}%
                              </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                              {selectedEmployee.attendanceTrend > 0 ? 'Improving' : selectedEmployee.attendanceTrend < 0 ? 'Declining' : 'Stable'} compared to previous period
                            </Typography>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </>
              )}
            </DialogContent>
            
            <DialogActions sx={{ p: 3, justifyContent: 'space-between', gap: 2 }}>
              <Button 
                variant="contained"
                startIcon={individualReportLoading ? <CircularProgress size={16} color="inherit" /> : <Download />}
                onClick={() => handleGenerateIndividualReport(selectedEmployee)}
                disabled={individualReportLoading || !selectedEmployee}
                size="large"
                sx={{
                  borderRadius: 2,
                  px: 4,
                  py: 1.5,
                  fontWeight: 600,
                  textTransform: 'none',
                  bgcolor: 'secondary.main',
                  '&:hover': {
                    bgcolor: 'secondary.dark',
                  }
                }}
              >
                {individualReportLoading ? 'Generating...' : 'Generate Individual Report'}
              </Button>
              
              <Button 
                onClick={handleDialogClose}
                variant="outlined"
                size="large"
                sx={{
                  borderRadius: 2,
                  px: 4,
                  py: 1.5,
                  fontWeight: 600,
                  textTransform: 'none'
                }}
              >
                Close Details
              </Button>
            </DialogActions>
          </Dialog>

          {/* Holiday Management Dialog */}
          <Dialog 
            open={holidayDialog} 
            onClose={() => {
              setHolidayDialog(false);
              resetHolidayForm();
            }}
            maxWidth="sm"
            fullWidth
            PaperProps={{
              sx: {
                borderRadius: 3,
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              }
            }}
          >
            <DialogTitle sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              pb: 1,
              borderBottom: 1,
              borderColor: 'divider'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar sx={{ mr: 2, bgcolor: 'secondary.main' }}>
                  <Add />
                </Avatar>
                <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
                  Add Replacement Holiday
                </Typography>
              </Box>
              <IconButton 
                onClick={() => {
                  setHolidayDialog(false);
                  resetHolidayForm();
                }}
              >
                <Close />
              </IconButton>
            </DialogTitle>
            
            <DialogContent sx={{ p: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Mark replacement holidays (cuti ganti) that are not automatically detected. These will be excluded from working days calculations.
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    label="Holiday Date"
                    type="date"
                    fullWidth
                    value={holidayForm.date}
                    onChange={(e) => setHolidayForm({...holidayForm, date: e.target.value})}
                    InputLabelProps={{ shrink: true }}
                    required
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    label="Holiday Name"
                    fullWidth
                    value={holidayForm.name}
                    onChange={(e) => setHolidayForm({...holidayForm, name: e.target.value})}
                    placeholder="e.g., Cuti Ganti for Malaysia Day"
                    required
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Holiday Type</InputLabel>
                    <Select
                      value={holidayForm.type}
                      onChange={(e) => setHolidayForm({...holidayForm, type: e.target.value})}
                      label="Holiday Type"
                    >
                      <MenuItem value="replacement">Replacement Holiday (Cuti Ganti)</MenuItem>
                      <MenuItem value="special">Special Holiday</MenuItem>
                      <MenuItem value="company">Company Holiday</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </DialogContent>
            
            <DialogActions sx={{ p: 3, gap: 2, borderTop: 1, borderColor: 'divider' }}>
              <Button 
                onClick={() => {
                  setHolidayDialog(false);
                  resetHolidayForm();
                }}
                sx={{ fontWeight: 600, textTransform: 'none' }}
              >
                Cancel
              </Button>
              <Button 
                variant="contained" 
                onClick={handleAddHoliday}
                sx={{ 
                  fontWeight: 600, 
                  textTransform: 'none',
                  px: 4
                }}
              >
                Add Holiday
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </Container>
  );
}

export default Performance;