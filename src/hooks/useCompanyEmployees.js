import { useState, useEffect } from 'react';
import { userService } from '../services/dataService';

export const useCompanyEmployees = (company) => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');

  useEffect(() => {
    if (!company) {
      setLoading(false);
      return;
    }

    const fetchEmployees = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('🔍 Fetching employees for company:', company);
        const companyEmployees = await userService.getUsersByCompany(company);
        
        // Sort employees by firstName on client side
        const sortedEmployees = companyEmployees.sort((a, b) => {
          const nameA = a.firstName?.toLowerCase() || '';
          const nameB = b.firstName?.toLowerCase() || '';
          return nameA.localeCompare(nameB);
        });
        
        console.log('👥 Found employees:', sortedEmployees.length);
        setEmployees(sortedEmployees);
        setFilteredEmployees(sortedEmployees);

      } catch (err) {
        console.error('Error fetching company employees:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, [company]);

  // Filter employees based on search term, department, and branch
  useEffect(() => {
    let filtered = employees;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(employee => 
        `${employee.firstName} ${employee.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.employeeId?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply department filter
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(employee => employee.department === departmentFilter);
    }

    // Apply branch filter
    if (branchFilter !== 'all') {
      filtered = filtered.filter(employee => employee.branchName === branchFilter);
    }

    setFilteredEmployees(filtered);
  }, [employees, searchTerm, departmentFilter, branchFilter]);

  // Get unique departments
  const departments = [...new Set(employees.map(emp => emp.department).filter(Boolean))];
  
  // Get unique branches
  const branches = [...new Set(employees.map(emp => emp.branchName).filter(Boolean))];

  return {
    employees: filteredEmployees,
    allEmployees: employees,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    departmentFilter,
    setDepartmentFilter,
    branchFilter,
    setBranchFilter,
    departments,
    branches,
    totalCount: employees.length,
    filteredCount: filteredEmployees.length
  };
};