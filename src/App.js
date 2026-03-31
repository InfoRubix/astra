import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import LoadingSpinner from './components/common/LoadingSpinner';

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';

// User Pages
import UserDashboard from './pages/user/Dashboard';
import UserAttendance from './pages/user/Attendance';
import UserForgottenCheckouts from './pages/user/ForgottenCheckouts';
import UserLeaves from './pages/user/Leaves';
import UserClaims from './pages/user/Claims';
import UserAnnouncements from './pages/user/Announcements';
import UserPayslips from './pages/user/Payslips';
import UserEAForm from './pages/user/EAForm';
import UserProfile from './pages/user/Profile';
import UserSettings from './pages/user/Settings';
import TeamApprovals from './pages/user/TeamApprovals';
import TeamCheckouts from './pages/user/TeamCheckouts';
import TeamClaims from './pages/user/TeamClaims';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminCompany from './pages/admin/AdminCompany';
import AdminEmployees from './pages/admin/Employees';
import AdminLeaves from './pages/admin/Leaves';
import AdminClaims from './pages/admin/Claims';
import AdminFeedback from './pages/admin/Feedback';
import AdminAnnouncements from './pages/admin/Announcements';
import AdminPayslips from './pages/admin/Payslips';
import AdminCompanySettings from './pages/admin/CompanySettings';
import AdminCompanyProfile from './pages/admin/CompanyProfile';
import AdminPerformance from './pages/admin/Performance';
import AdminCompanyPerformance from './pages/admin/CompanyPerformance';
import AdminReports from './pages/admin/Reports';
import AdminForgottenCheckouts from './pages/admin/ForgottenCheckouts';
import AdminPositionManagement from './pages/admin/PositionManagement';

// Company Admin Pages
import CompanyAdminDashboard from './pages/company-admin/Dashboard';
import CompanyAdminEmployees from './pages/company-admin/Employees';
import CompanyAdminBranches from './pages/company-admin/Branches';
import CompanyAdminLeaves from './pages/company-admin/Leaves';
import CompanyAdminClaims from './pages/company-admin/Claims';
import CompanyAdminForgottenCheckouts from './pages/company-admin/ForgottenCheckouts';
import CompanyAdminReports from './pages/company-admin/Reports';
import CompanyAdminAnnouncements from './pages/company-admin/Announcements';
import CompanyAdminCompanyProfile from './pages/company-admin/CompanyProfile';
import CompanyAdminSettings from './pages/company-admin/Settings';

// Branch Admin Pages
import BranchAdminDashboard from './pages/branch-admin/Dashboard';
import BranchAdminEmployees from './pages/branch-admin/Employees';
import BranchAdminLeaves from './pages/branch-admin/Leaves';
import BranchAdminClaims from './pages/branch-admin/Claims';
import BranchAdminForgottenCheckouts from './pages/branch-admin/ForgottenCheckouts';
import BranchAdminReports from './pages/branch-admin/Reports';
import BranchAdminAnnouncements from './pages/branch-admin/Announcements';

// Layout Components
import UserLayout from './components/common/UserLayout';
import AdminLayout from './components/common/AdminLayout';
import CompanyAdminLayout from './components/common/CompanyAdminLayout';
import BranchAdminLayout from './components/common/BranchAdminLayout';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const isAdmin = user?.role === 'admin';
  const isCompanyAdmin = user?.role === 'company_admin';
  const isBranchAdmin = user?.role === 'branch_admin';
  const isUser = user?.role === 'user' || !user?.role;

  return (
    <Routes>
      {/* System Admin Routes */}
      {isAdmin && (
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="admin-company" element={<AdminCompany />} />
          <Route path="employees" element={<AdminEmployees />} />
          <Route path="position-management" element={<AdminPositionManagement />} />
          <Route path="leaves" element={<AdminLeaves />} />
          <Route path="claims" element={<AdminClaims />} />
          <Route path="feedback" element={<AdminFeedback />} />
          <Route path="announcements" element={<AdminAnnouncements />} />
          <Route path="payslips" element={<AdminPayslips />} />
          <Route path="company-settings" element={<AdminCompanySettings />} />
          <Route path="company-profile" element={<AdminCompanyProfile />} />
          <Route path="performance" element={<AdminPerformance />} />
          <Route path="company-performance" element={<AdminCompanyPerformance />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="forgotten-checkouts" element={<AdminForgottenCheckouts />} />
          <Route path="profile" element={<UserProfile />} />
        </Route>
      )}

      {/* Company Admin Routes */}
      {isCompanyAdmin && (
        <Route path="/company-admin" element={<CompanyAdminLayout />}>
          <Route index element={<CompanyAdminDashboard />} />
          <Route path="employees" element={<CompanyAdminEmployees />} />
          <Route path="branches" element={<CompanyAdminBranches />} />
          <Route path="leaves" element={<CompanyAdminLeaves />} />
          <Route path="claims" element={<CompanyAdminClaims />} />
          <Route path="forgotten-checkouts" element={<CompanyAdminForgottenCheckouts />} />
          <Route path="reports" element={<CompanyAdminReports />} />
          <Route path="announcements" element={<CompanyAdminAnnouncements />} />
          <Route path="company-profile" element={<CompanyAdminCompanyProfile />} />
          <Route path="settings" element={<CompanyAdminSettings />} />
          <Route path="profile" element={<UserProfile />} />
        </Route>
      )}

      {/* Branch Admin Routes */}
      {isBranchAdmin && (
        <Route path="/branch-admin" element={<BranchAdminLayout />}>
          <Route index element={<BranchAdminDashboard />} />
          <Route path="employees" element={<BranchAdminEmployees />} />
          <Route path="leaves" element={<BranchAdminLeaves />} />
          <Route path="claims" element={<BranchAdminClaims />} />
          <Route path="forgotten-checkouts" element={<BranchAdminForgottenCheckouts />} />
          <Route path="reports" element={<BranchAdminReports />} />
          <Route path="announcements" element={<BranchAdminAnnouncements />} />
          <Route path="profile" element={<UserProfile />} />
        </Route>
      )}

      {/* User Routes */}
      {isUser && (
        <Route path="/user" element={<UserLayout />}>
        <Route index element={<UserDashboard />} />
        <Route path="attendance" element={<UserAttendance />} />
        <Route path="forgotten-checkouts" element={<UserForgottenCheckouts />} />
        <Route path="leaves" element={<UserLeaves />} />
        <Route path="claims" element={<UserClaims />} />
        <Route path="team-approvals" element={<TeamApprovals />} />
        <Route path="team-checkouts" element={<TeamCheckouts />} />
        <Route path="team-claims" element={<TeamClaims />} />
        <Route path="announcements" element={<UserAnnouncements />} />
        <Route path="payslips" element={<UserPayslips />} />
        <Route path="ea-form" element={<UserEAForm />} />
        <Route path="settings" element={<UserSettings />} />
        <Route path="profile" element={<UserProfile />} />
      </Route>
      )}

      {/* Redirect based on role */}
      <Route 
        path="*" 
        element={
          <Navigate 
            to={
              isAdmin ? "/admin" : 
              isCompanyAdmin ? "/company-admin" : 
              isBranchAdmin ? "/branch-admin" : 
              "/user"
            } 
            replace 
          />
        } 
      />
    </Routes>
  );
}

export default App;