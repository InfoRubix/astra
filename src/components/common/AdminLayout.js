import React, { useState, useEffect, Fragment } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  Box, 
  AppBar, 
  Toolbar, 
  Typography, 
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  ListItemButton,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Chip,
  Collapse
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  People,
  EventAvailable,
  Receipt,
  Assignment,
  AccountCircle,
  Logout,
  AdminPanelSettings,
  Notifications,
  Assessment,
  Announcement,
  Payment,
  AccessTime,
  Business,
  Settings,
  PersonAdd,
  ExpandLess,
  ExpandMore,
  Group,
  Approval,
  CampaignOutlined,
  AnalyticsOutlined,
  Feedback,
  WorkOutline,
  DarkMode,
  LightMode
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeMode } from '../../contexts/ThemeContext';
import { collection, query, where, getDocs, writeBatch, doc, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { format } from 'date-fns';

const drawerWidth = 280;
const collapsedDrawerWidth = 64;

/**
 * AdminLayout - Main layout wrapper for the admin dashboard.
 *
 * Provides a responsive sidebar navigation with collapsible sub-menus,
 * an app bar with notification badges and a profile menu, and renders
 * child routes via React Router's <Outlet />.
 *
 * This component has no props; it reads the authenticated user from
 * the AuthContext and fetches pending counts (leaves, claims,
 * forgotten checkouts) and admin notifications from Firestore.
 *
 * @returns {JSX.Element}
 */
function AdminLayout() {
  const { user, logout } = useAuth();
  const { mode, toggleTheme } = useThemeMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [pendingClaims, setPendingClaims] = useState(0);
  const [pendingCheckouts, setPendingCheckouts] = useState(0);
  const [notificationDialog, setNotificationDialog] = useState(false);
  const [allNotifications, setAllNotifications] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('adminSidebarOpen');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  // Submenu state management
  const [openSubmenus, setOpenSubmenus] = useState(() => {
    const saved = localStorage.getItem('adminOpenSubmenus');
    return saved ? JSON.parse(saved) : {
      userManagement: false,
      requestsApprovals: false,
      communications: false,
      companyManagement: false,
      analyticsReports: false
    };
  });

  // Load pending counts and notifications
  const loadAdminCounts = async () => {
    if (!user?.uid) return;
    
    try {
      // Load pending leaves count (all companies)
      const leavesQuery = query(
        collection(db, 'leaves'),
        where('status', '==', 'pending')
      );
      const leavesSnapshot = await getDocs(leavesQuery);
      setPendingLeaves(leavesSnapshot.docs.length);

      // Load pending claims count (all companies)
      const claimsQuery = query(
        collection(db, 'claims'),
        where('status', '==', 'pending')
      );
      const claimsSnapshot = await getDocs(claimsQuery);
      setPendingClaims(claimsSnapshot.docs.length);

      // Load pending forgotten checkout requests count
      const checkoutQuery = query(
        collection(db, 'forgottenCheckoutRequests'),
        where('status', '==', 'pending')
      );
      const checkoutSnapshot = await getDocs(checkoutQuery);
      setPendingCheckouts(checkoutSnapshot.docs.length);

      // Load unread notifications for admin
      try {
        // Query for admin notifications only (from all companies)
        const notificationsQuery = query(
          collection(db, 'notifications'),
          where('isAdminNotification', '==', true)
        );
        const notificationsSnapshot = await getDocs(notificationsQuery);
        const allNotifications = notificationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Filter for admin notifications that are unread AND only pending requests
        const unreadAdminNotifications = allNotifications.filter(n => {
          const isAdmin = n.isAdminNotification === true;
          const isUnread = n.read === false;
          const isPending = n.type === 'pending_approval';
          return isAdmin && isUnread && isPending;
        });
        
        setUnreadCount(unreadAdminNotifications.length);
        
        // Only log if there are unread notifications to avoid spam
        if (unreadAdminNotifications.length > 0) {
          console.log('📊 Admin unread PENDING notifications:', unreadAdminNotifications.length);
        }
        
        // Debug: Show if we have any action notifications that should be ignored
        const actionNotifications = allNotifications.filter(n => 
          n.isAdminNotification === true && 
          (n.type === 'leave_action' || n.type === 'claim_action')
        );
        if (actionNotifications.length > 0) {
          console.log(`🗑️ Found ${actionNotifications.length} old action notifications that will be ignored:`, 
            actionNotifications.map(n => ({ id: n.id, type: n.type, title: n.title }))
          );
        }
        
      } catch (notificationError) {
        console.error('Error loading admin notifications:', notificationError);
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error loading admin counts:', error);
    }
  };

  useEffect(() => {
    if (user?.uid && user?.role === 'admin') {
      loadAdminCounts();
      
      // Reload counts every 10 seconds for faster notification updates
      const interval = setInterval(loadAdminCounts, 10000);
      return () => clearInterval(interval);
    }
  }, [user?.uid, user?.role]);

  // Organized menu structure with submenus
  const menuStructure = [
    { 
      text: 'Dashboard', 
      icon: <Dashboard />, 
      path: '/admin', 
      type: 'single'
    },
    {
      text: 'User Management',
      icon: <Group />,
      type: 'group',
      key: 'userManagement',
      items: [
        { text: 'Admin Company', icon: <PersonAdd />, path: '/admin/admin-company' },
        { text: 'Employees', icon: <People />, path: '/admin/employees' },
        { text: 'Position Management', icon: <WorkOutline />, path: '/admin/position-management' }
      ]
    },
    {
      text: 'Requests & Approvals',
      icon: <Approval />,
      type: 'group',
      key: 'requestsApprovals',
      items: [
        { text: 'Leave Management', icon: <EventAvailable />, path: '/admin/leaves', badge: pendingLeaves > 0 ? pendingLeaves : null },
        { text: 'Claims Management', icon: <Receipt />, path: '/admin/claims', badge: pendingClaims > 0 ? pendingClaims : null },
        { text: 'Forgotten Check-outs', icon: <AccessTime />, path: '/admin/forgotten-checkouts', badge: pendingCheckouts > 0 ? pendingCheckouts : null }
      ]
    },
    {
      text: 'Communications',
      icon: <CampaignOutlined />,
      type: 'group',
      key: 'communications',
      items: [
        { text: 'Feedback', icon: <Feedback />, path: '/admin/feedback' },
        { text: 'Announcements', icon: <Announcement />, path: '/admin/announcements' },
        { text: 'Payslips', icon: <Payment />, path: '/admin/payslips' }
      ]
    },
    {
      text: 'Company Management',
      icon: <Business />,
      type: 'group', 
      key: 'companyManagement',
      items: [
        { text: 'Company Profile', icon: <Business />, path: '/admin/company-profile' },
        { text: 'Company Settings', icon: <Settings />, path: '/admin/company-settings' }
      ]
    },
    {
      text: 'Analytics & Reports',
      icon: <AnalyticsOutlined />,
      type: 'group',
      key: 'analyticsReports',
      items: [
        { text: 'Employee Performance', icon: <Assessment />, path: '/admin/performance' },
        { text: 'Company Performance', icon: <Business />, path: '/admin/company-performance' },
        { text: 'Reports', icon: <Assignment />, path: '/admin/reports' }
      ]
    }
  ];

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleSidebarToggle = () => {
    const newState = !sidebarOpen;
    setSidebarOpen(newState);
    localStorage.setItem('adminSidebarOpen', JSON.stringify(newState));
  };

  // Handle submenu toggle
  const handleSubmenuToggle = (key) => {
    const newState = {
      ...openSubmenus,
      [key]: !openSubmenus[key]
    };
    setOpenSubmenus(newState);
    localStorage.setItem('adminOpenSubmenus', JSON.stringify(newState));
  };

  // Check if any submenu item is active
  const isSubmenuActive = (items) => {
    return items.some(item => location.pathname === item.path);
  };

  // Calculate total badge count for a submenu group
  const getGroupBadgeCount = (items) => {
    return items.reduce((total, item) => {
      return total + (item.badge || 0);
    }, 0);
  };

  // Load all notifications for detail view
  const loadAllNotifications = async () => {
    if (!user?.uid) return;
    
    try {
      console.log('🔍 Loading ALL admin notifications for dialog from all companies');
      
      // Query to get admin notifications from all companies
      const q = query(
        collection(db, 'notifications'),
        where('isAdminNotification', '==', true)
      );
      
      const querySnapshot = await getDocs(q);
      const allNotifications = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log('📋 ALL company notifications loaded for dialog:', allNotifications.length);
      
      // Debug: Show all notifications with key fields
      allNotifications.forEach((n, index) => {
        console.log(`Dialog Notification ${index + 1}:`, {
          id: n.id,
          title: n.title,
          type: n.type,
          isAdminNotification: n.isAdminNotification,
          read: n.read,
          userName: n.userName,
          createdAt: n.createdAt?.toDate ? n.createdAt.toDate().toISOString() : n.createdAt
        });
      });
      
      // Debug: Check what we have before filtering
      console.log('🔍 Before filtering - checking for isAdminNotification===true and type===pending_approval');
      const hasAdminNotifs = allNotifications.filter(n => n.isAdminNotification === true);
      const hasPendingApproval = allNotifications.filter(n => n.type === 'pending_approval');
      console.log('🔍 Notifications with isAdminNotification===true:', hasAdminNotifs.length);
      console.log('🔍 Notifications with type===pending_approval:', hasPendingApproval.length);
      
      // Filter for admin notifications only (pending requests only) and sort by date
      const adminNotifications = allNotifications
        .filter(n => {
          const isAdmin = n.isAdminNotification === true;
          const isPending = n.type === 'pending_approval';
          console.log(`🔍 Notification ${n.id}: isAdminNotification=${n.isAdminNotification} (${isAdmin}), type=${n.type} (${isPending})`);
          return isAdmin && isPending;
        })
        .sort((a, b) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
          return bTime - aTime;
        })
        .slice(0, 50); // Limit to 50 most recent
      
      console.log('🎯 Filtered admin notifications for dialog:', adminNotifications.length);
      console.log('🎯 Filtered notifications details:', adminNotifications);
      
      setAllNotifications(adminNotifications);
      console.log('Loaded admin notifications:', adminNotifications.length, 'notifications');
      console.log('Admin notifications data:', adminNotifications);
      
      // Debug: Check if we have any notifications with titles and messages
      adminNotifications.forEach((notif, index) => {
        console.log(`Admin Notification ${index + 1}:`, {
          id: notif.id,
          title: notif.title,
          message: notif.message,
          type: notif.type,
          isAdminNotification: notif.isAdminNotification,
          userName: notif.userName,
          relatedData: notif.relatedData
        });
      });
    } catch (error) {
      console.error('Error loading admin notifications:', error);
      setAllNotifications([]);
    }
  };

  const handleNotificationClick = async () => {
    // Load all notifications and show dialog
    await loadAllNotifications();
    setNotificationDialog(true);
    
    // Only mark notifications as read if we actually loaded and displayed some
    // Wait for the dialog to open and notifications to be loaded
    setTimeout(async () => {
      if (unreadCount > 0 && allNotifications.length > 0) {
        try {
          // Get all unread admin notifications from all companies
          const q = query(
            collection(db, 'notifications'),
            where('isAdminNotification', '==', true),
            where('read', '==', false)
          );
          
          const querySnapshot = await getDocs(q);
          const unreadAdminNotifications = querySnapshot.docs.map(doc => ({ id: doc.id, docRef: doc, ...doc.data() }));
          
          // Filter for pending requests only (not action notifications)
          const pendingNotifications = unreadAdminNotifications.filter(n => 
            n.type === 'pending_approval'
          );
          
          if (pendingNotifications.length > 0) {
            // Mark all as read using batch
            const batch = writeBatch(db);
            
            pendingNotifications.forEach((notification) => {
              batch.update(doc(db, 'notifications', notification.id), {
                read: true,
                readAt: new Date()
              });
            });
            
            await batch.commit();
            console.log('Marked admin notifications as read:', pendingNotifications.length, 'notifications');
            
            // Reload the count
            setUnreadCount(0);
            
            // Update the loaded notifications to show as read
            setAllNotifications(prev => prev.map(n => ({ ...n, read: true })));
          }
        } catch (error) {
          console.error('Error marking admin notifications as read:', error);
        }
      } else {
        console.log('Not marking notifications as read - no notifications displayed or loaded');
      }
    }, 500); // Give time for notifications to load and display
  };

  // Helper functions for notification display
  const getNotificationIcon = (type) => {
    switch(type) {
      case 'claim_update': return <Receipt />;
      case 'claim_action': return <Receipt />;
      case 'leave_update': return <EventAvailable />;
      case 'leave_action': return <EventAvailable />;
      case 'attendance_update': return <Assignment />;
      case 'pending_approval': return <Notifications />;
      default: return <Notifications />;
    }
  };

  const getNotificationColor = (priority, read) => {
    if (read) return 'default';
    switch(priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'normal': return 'primary';
      default: return 'primary';
    }
  };

  const formatNotificationDate = (timestamp) => {
    try {
      const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
      return format(date, 'MMM dd, yyyy HH:mm');
    } catch (error) {
      return 'Unknown date';
    }
  };

  // Temporary test function to create a sample admin notification
  const createTestNotification = async () => {
    if (!user?.uid || user?.role !== 'admin') return;
    
    try {
      console.log('🧪 Creating test admin notification...');
      
      const testNotification = {
        originalCompanyName: user.originalCompanyName || user.company || 'RUBIX',
        isAdminNotification: true,
        type: 'pending_approval',
        title: 'Test Leave Request Requires Approval',
        message: 'Test Employee submitted a annual leave request for approval testing',
        priority: 'medium',
        read: false,
        createdAt: serverTimestamp(),
        leaveId: 'test-123',
        submittedBy: 'test-user-id',
        userName: 'Test Employee',
        relatedData: {
          employeeName: 'Test Employee',
          employeeEmail: 'test@company.com',
          employeeDepartment: 'IT',
          leaveType: 'annual',
          startDate: '2025-01-15',
          endDate: '2025-01-17',
          totalDays: 3,
          reason: 'Testing notification system',
          appliedDate: new Date().toLocaleDateString(),
          status: 'pending'
        }
      };

      await addDoc(collection(db, 'notifications'), testNotification);
      console.log('✅ Test notification created successfully');
      
      // Reload the counts
      await loadAdminCounts();
    } catch (error) {
      console.error('❌ Error creating test notification:', error);
    }
  };

  // Temporary cleanup function for old action notifications
  const cleanupOldActionNotifications = async () => {
    if (!user?.uid || user?.role !== 'admin') return;
    
    try {
      console.log('🧹 Starting cleanup of old action notifications...');
      
      const q = query(
        collection(db, 'notifications')
      );
      
      const querySnapshot = await getDocs(q);
      const allNotifications = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Find old action notifications that should be removed
      const oldActionNotifications = allNotifications.filter(n => 
        n.isAdminNotification === true && 
        (n.type === 'leave_action' || n.type === 'claim_action')
      );
      
      if (oldActionNotifications.length > 0) {
        console.log(`🗑️ Found ${oldActionNotifications.length} old action notifications to delete`);
        
        // Delete them using batch
        const batch = writeBatch(db);
        oldActionNotifications.forEach((notification) => {
          batch.delete(doc(db, 'notifications', notification.id));
        });
        
        await batch.commit();
        console.log('✅ Cleaned up old action notifications successfully');
        
        // Reload the counts
        await loadAdminCounts();
      } else {
        console.log('✅ No old action notifications found to clean up');
      }
    } catch (error) {
      console.error('❌ Error cleaning up old notifications:', error);
    }
  };

  const drawer = (
    <Box sx={{ 
      height: '100%', 
      background: 'linear-gradient(180deg, #000000 0%, #1a1a1a 100%)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header Section */}
      <Box sx={{ 
        background: 'linear-gradient(135deg, #000000 0%, #333333 100%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Decorative background elements */}
        <Box sx={{
          position: 'absolute',
          top: -20,
          right: -20,
          width: 80,
          height: 80,
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: '50%'
        }} />
        
        <Toolbar sx={{ 
          color: 'white',
          position: 'relative',
          zIndex: 1,
          flexDirection: 'column',
          alignItems: sidebarOpen ? 'flex-start' : 'center',
          py: 3
        }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center',
            mb: sidebarOpen ? 2 : 0,
            width: '100%',
            justifyContent: sidebarOpen ? 'flex-start' : 'center'
          }}>
            <Box sx={{
              width: sidebarOpen ? 48 : 40,
              height: sidebarOpen ? 48 : 40,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #ffffff 0%, #e0e0e0 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mr: sidebarOpen ? 2 : 0,
              boxShadow: '0 4px 12px rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <AdminPanelSettings sx={{ 
                fontSize: sidebarOpen ? 28 : 24, 
                color: '#000000',
                fontWeight: 'bold'
              }} />
            </Box>
            {sidebarOpen && (
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" sx={{ 
                  fontWeight: 700, 
                  color: 'white',
                  fontSize: '1.1rem',
                  letterSpacing: 0.5,
                  mb: 0.5
                }}>
                  Admin Portal
                </Typography>
                <Typography variant="caption" sx={{ 
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                  display: 'block'
                }}>
                  by RUBIX TECHNOLOGY
                </Typography>
              </Box>
            )}
          </Box>
        </Toolbar>
      </Box>

      {/* Navigation Menu */}
      <Box sx={{ flex: 1, py: 2, overflowY: 'auto', overflowX: 'hidden' }}>
        <List sx={{ px: 1 }}>
          {menuStructure.map((section) => (
            <Fragment key={section.text}>
              {section.type === 'single' ? (
                // Single menu item
                <ListItemButton
                  selected={location.pathname === section.path}
                  onClick={() => {
                    navigate(section.path);
                    setMobileOpen(false);
                  }}
                  sx={{ 
                    mx: 1,
                    mb: 0.5,
                    borderRadius: 2,
                    minHeight: 52,
                    justifyContent: sidebarOpen ? 'initial' : 'center', 
                    px: sidebarOpen ? 2.5 : 1.5,
                    color: 'rgba(255, 255, 255, 0.8)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                      opacity: 0,
                      transition: 'opacity 0.3s ease'
                    },
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      color: 'white',
                      transform: 'translateX(4px)',
                      '&::before': {
                        opacity: 1
                      }
                    },
                    '&.Mui-selected': {
                      background: 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)',
                      color: '#000000',
                      boxShadow: '0 4px 12px rgba(255, 255, 255, 0.15)',
                      transform: 'translateX(4px)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #f8f8f8 0%, #e8e8e8 100%)',
                        color: '#000000',
                      },
                      '&::before': {
                        opacity: 0
                      }
                    },
                  }}
                >
                  <ListItemIcon sx={{ 
                    minWidth: 0, 
                    mr: sidebarOpen ? 3 : 'auto', 
                    justifyContent: 'center',
                    color: 'inherit'
                  }}>
                    {section.icon}
                  </ListItemIcon>
                  {sidebarOpen && (
                    <ListItemText 
                      primary={section.text}
                      primaryTypographyProps={{
                        fontWeight: location.pathname === section.path ? 600 : 400,
                        fontSize: '0.9rem'
                      }}
                    />
                  )}
                  {/* Active indicator */}
                  {location.pathname === section.path && (
                    <Box sx={{
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 4,
                      height: '60%',
                      background: 'linear-gradient(180deg, #000000 0%, #333333 100%)',
                      borderRadius: '0 2px 2px 0'
                    }} />
                  )}
                </ListItemButton>
              ) : (
                // Group menu item with submenu
                <>
                  <ListItemButton
                    onClick={() => sidebarOpen ? handleSubmenuToggle(section.key) : null}
                    sx={{ 
                      mx: 1,
                      mb: 0.5,
                      borderRadius: 2,
                      minHeight: 52,
                      justifyContent: sidebarOpen ? 'initial' : 'center', 
                      px: sidebarOpen ? 2.5 : 1.5,
                      color: isSubmenuActive(section.items) ? 'white' : 'rgba(255, 255, 255, 0.8)',
                      backgroundColor: isSubmenuActive(section.items) ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      position: 'relative',
                      overflow: 'hidden',
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        color: 'white',
                        transform: sidebarOpen ? 'translateX(4px)' : 'none',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ 
                      minWidth: 0, 
                      mr: sidebarOpen ? 3 : 'auto', 
                      justifyContent: 'center',
                      color: 'inherit'
                    }}>
                      {(() => {
                        const groupBadgeCount = getGroupBadgeCount(section.items);
                        return groupBadgeCount > 0 && sidebarOpen ? (
                          <Badge 
                            badgeContent={groupBadgeCount} 
                            color="error"
                            sx={{
                              '& .MuiBadge-badge': {
                                background: 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)',
                                color: 'white',
                                fontSize: '0.7rem',
                                minWidth: 16,
                                height: 16
                              }
                            }}
                          >
                            {section.icon}
                          </Badge>
                        ) : (
                          section.icon
                        );
                      })()}
                    </ListItemIcon>
                    {sidebarOpen && (
                      <>
                        <ListItemText 
                          primary={section.text}
                          primaryTypographyProps={{
                            fontWeight: isSubmenuActive(section.items) ? 600 : 400,
                            fontSize: '0.9rem'
                          }}
                        />
                        {openSubmenus[section.key] ? <ExpandLess /> : <ExpandMore />}
                      </>
                    )}
                    {/* Badge for collapsed sidebar */}
                    {(() => {
                      const groupBadgeCount = getGroupBadgeCount(section.items);
                      return groupBadgeCount > 0 && !sidebarOpen ? (
                        <Badge 
                          badgeContent={groupBadgeCount} 
                          color="error" 
                          sx={{ 
                            position: 'absolute', 
                            top: 8, 
                            right: 8,
                            '& .MuiBadge-badge': {
                              background: 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)',
                              color: 'white',
                              fontSize: '0.7rem',
                              minWidth: 16,
                              height: 16
                            }
                          }}
                        />
                      ) : null;
                    })()}
                    {/* Active indicator for group */}
                    {isSubmenuActive(section.items) && (
                      <Box sx={{
                        position: 'absolute',
                        left: 0,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 4,
                        height: '60%',
                        background: 'linear-gradient(180deg, #000000 0%, #333333 100%)',
                        borderRadius: '0 2px 2px 0'
                      }} />
                    )}
                  </ListItemButton>
                  
                  {/* Submenu items */}
                  {sidebarOpen && (
                    <Collapse in={openSubmenus[section.key]} timeout={300}>
                      <List sx={{ pl: 2 }}>
                        {section.items.map((item) => (
                          <ListItemButton
                            key={item.text}
                            selected={location.pathname === item.path}
                            onClick={() => {
                              navigate(item.path);
                              setMobileOpen(false);
                            }}
                            sx={{ 
                              mx: 1,
                              mb: 0.5,
                              borderRadius: 2,
                              minHeight: 44,
                              px: 2,
                              color: 'rgba(255, 255, 255, 0.7)',
                              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              position: 'relative',
                              '&:hover': {
                                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                                color: 'white',
                                transform: 'translateX(8px)',
                              },
                              '&.Mui-selected': {
                                background: 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)',
                                color: '#000000',
                                boxShadow: '0 2px 8px rgba(255, 255, 255, 0.1)',
                                transform: 'translateX(8px)',
                                '&:hover': {
                                  background: 'linear-gradient(135deg, #f8f8f8 0%, #e8e8e8 100%)',
                                  color: '#000000',
                                },
                              },
                            }}
                          >
                            <ListItemIcon sx={{ 
                              minWidth: 32, 
                              mr: 2,
                              color: 'inherit'
                            }}>
                              {item.badge ? (
                                <Badge 
                                  badgeContent={item.badge} 
                                  color="error"
                                  sx={{
                                    '& .MuiBadge-badge': {
                                      background: 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)',
                                      color: 'white',
                                      fontSize: '0.6rem',
                                      minWidth: 14,
                                      height: 14
                                    }
                                  }}
                                >
                                  {item.icon}
                                </Badge>
                              ) : (
                                item.icon
                              )}
                            </ListItemIcon>
                            <ListItemText 
                              primary={item.text}
                              primaryTypographyProps={{
                                fontWeight: location.pathname === item.path ? 600 : 400,
                                fontSize: '0.8rem'
                              }}
                            />
                            {/* Active indicator for submenu item */}
                            {location.pathname === item.path && (
                              <Box sx={{
                                position: 'absolute',
                                left: 0,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: 3,
                                height: '50%',
                                background: 'linear-gradient(180deg, #000000 0%, #333333 100%)',
                                borderRadius: '0 2px 2px 0'
                              }} />
                            )}
                          </ListItemButton>
                        ))}
                      </List>
                    </Collapse>
                  )}
                </>
              )}
            </Fragment>
          ))}
        </List>
      </Box>

      {/* Bottom Branding (for collapsed state) */}
      {!sidebarOpen && (
        <Box sx={{ 
          py: 2, 
          textAlign: 'center',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <Typography variant="caption" sx={{ 
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '0.6rem',
            fontWeight: 500,
            letterSpacing: 0.5,
            writingMode: 'vertical-rl',
            textOrientation: 'mixed'
          }}>
            RUBIX
          </Typography>
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { xs: '100%', sm: `calc(100% - ${sidebarOpen ? drawerWidth : collapsedDrawerWidth}px)` },
          ml: { xs: 0, sm: `${sidebarOpen ? drawerWidth : collapsedDrawerWidth}px` },
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), margin 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: (theme) => theme.zIndex.drawer + 1,
          background: mode === 'dark'
            ? 'linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%)'
            : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
          color: mode === 'dark' ? '#e0e0e0' : '#000000',
          boxShadow: mode === 'dark'
            ? '0 2px 20px rgba(0, 0, 0, 0.3)'
            : '0 2px 20px rgba(0, 0, 0, 0.08)',
          backdropFilter: 'blur(10px)',
          borderBottom: mode === 'dark'
            ? '1px solid rgba(255, 255, 255, 0.08)'
            : '1px solid rgba(0, 0, 0, 0.08)'
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
          <IconButton
            color="inherit"
            aria-label="toggle sidebar"
            onClick={handleSidebarToggle}
            sx={{
              mr: 2,
              display: { xs: 'none', sm: 'block' },
              backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
              '&:hover': {
                backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
                transform: 'scale(1.05)'
              },
              transition: 'all 0.2s ease'
            }}
          >
            <MenuIcon />
          </IconButton>
          
          <IconButton
            color="inherit"
            aria-label="open mobile drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ 
              mr: 2, 
              display: { sm: 'none' },
              backgroundColor: 'rgba(0, 0, 0, 0.04)',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.08)',
                transform: 'scale(1.05)'
              },
              transition: 'all 0.2s ease'
            }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography 
            variant="h6" 
            noWrap 
            component="div" 
            sx={{ 
              flexGrow: 1,
              fontSize: { xs: '1rem', sm: '1.25rem' },
              display: { xs: 'none', sm: 'block' },
              fontWeight: 600,
              color: '#1a1a1a',
              background: mode === 'dark' ? 'linear-gradient(135deg, #e8e8e8 0%, #b0b0b0 100%)' : 'linear-gradient(135deg, #000000 0%, #434343 100%)',
              backgroundClip: 'text',
              '-webkit-background-clip': 'text',
              '-webkit-text-fill-color': 'transparent'
            }}
          >
            {user?.originalCompanyName || 'Company'} - Admin Panel
          </Typography>
          
          <Typography 
            variant="h6" 
            noWrap 
            component="div" 
            sx={{ 
              flexGrow: 1,
              fontSize: '1rem',
              display: { xs: 'block', sm: 'none' },
              fontWeight: 600,
              color: '#1a1a1a'
            }}
          >
            Admin Portal
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
            <IconButton
              color="inherit"
              onClick={toggleTheme}
              title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              sx={{
                backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                '&:hover': {
                  backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
                  transform: 'scale(1.05)'
                },
                transition: 'all 0.2s ease'
              }}
            >
              {mode === 'dark' ? <LightMode /> : <DarkMode />}
            </IconButton>

            <IconButton
              color="inherit"
              onClick={handleNotificationClick}
              title={unreadCount > 0 ? `${unreadCount} unread notifications` : 'No notifications'}
              sx={{
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.08)',
                  transform: 'scale(1.05)'
                },
                transition: 'all 0.2s ease'
              }}
            >
              <Badge 
                badgeContent={unreadCount > 0 ? unreadCount : null} 
                color="error"
                sx={{
                  '& .MuiBadge-badge': {
                    background: 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)',
                    color: 'white',
                    fontSize: '0.75rem',
                    minWidth: 18,
                    height: 18
                  }
                }}
              >
                <Notifications />
              </Badge>
            </IconButton>
            
            <Box 
              sx={{ 
                display: { xs: 'none', md: 'flex' },
                alignItems: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                px: 2,
                py: 1,
                borderRadius: 2,
                border: '1px solid rgba(0, 0, 0, 0.08)'
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: mode === 'dark' ? '#a0a0a0' : '#666666',
                  fontWeight: 500
                }}
              >
                Admin: {user?.firstName}
              </Typography>
            </Box>
            
            <IconButton
              size="large"
              edge="end"
              aria-label="account of current user"
              aria-haspopup="true"
              onClick={handleProfileMenuOpen}
              color="inherit"
              sx={{
                '&:hover': {
                  transform: 'scale(1.05)'
                },
                transition: 'all 0.2s ease'
              }}
            >
              <Avatar sx={{ 
                width: { xs: 32, sm: 36 }, 
                height: { xs: 32, sm: 36 }, 
                background: 'linear-gradient(135deg, #000000 0%, #434343 100%)',
                color: 'white',
                fontWeight: 600,
                fontSize: '0.9rem',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
              }}>
                {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
              </Avatar>
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Navigation Drawer */}
      <Box
        component="nav"
        sx={{ 
          width: { sm: sidebarOpen ? drawerWidth : collapsedDrawerWidth }, 
          flexShrink: { sm: 0 },
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        aria-label="admin navigation menu"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            zIndex: (theme) => theme.zIndex.drawer + 2,
            '& .MuiDrawer-paper': { 
              boxSizing: 'border-box', 
              width: drawerWidth,
              border: 'none',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
              zIndex: (theme) => theme.zIndex.drawer + 2
            },
          }}
        >
          {/* Mobile Drawer - Always show full content */}
          <Box sx={{ 
            height: '100%', 
            background: 'linear-gradient(180deg, #000000 0%, #1a1a1a 100%)',
            display: 'flex',
            flexDirection: 'column',
            paddingTop: '8px'
          }}>
            {/* Header Section - Mobile */}
            <Box sx={{ 
              background: 'linear-gradient(135deg, #000000 0%, #333333 100%)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Decorative background elements */}
              <Box sx={{
                position: 'absolute',
                top: -20,
                right: -20,
                width: 80,
                height: 80,
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '50%'
              }} />
              
              <Toolbar sx={{ 
                color: 'white',
                position: 'relative',
                zIndex: 1,
                flexDirection: 'column',
                alignItems: 'flex-start',
                py: 4,
                mt: 1
              }}>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  mb: 2,
                  width: '100%',
                  justifyContent: 'flex-start'
                }}>
                  <Box sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #ffffff 0%, #e0e0e0 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mr: 2,
                    boxShadow: '0 4px 12px rgba(255, 255, 255, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                  }}>
                    <AdminPanelSettings sx={{ 
                      fontSize: 28, 
                      color: '#000000',
                      fontWeight: 'bold'
                    }} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ 
                      fontWeight: 700, 
                      color: 'white',
                      fontSize: '1.1rem',
                      letterSpacing: 0.5,
                      mb: 0.5
                    }}>
                      Admin Portal
                    </Typography>
                    <Typography variant="caption" sx={{ 
                      color: 'rgba(255, 255, 255, 0.9)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      letterSpacing: 1.2,
                      textTransform: 'uppercase',
                      display: 'block',
                      lineHeight: 1.2
                    }}>
                      by RUBIX TECHNOLOGY
                    </Typography>
                  </Box>
                </Box>
              </Toolbar>
            </Box>

            {/* Navigation Menu - Mobile */}
            <Box sx={{ flex: 1, py: 2, overflowY: 'auto', overflowX: 'hidden' }}>
              <List sx={{ px: 1 }}>
                {menuStructure.map((section) => (
                  <Fragment key={`mobile-${section.text}`}>
                    {section.type === 'single' ? (
                      // Single menu item (mobile)
                      <ListItemButton
                        selected={location.pathname === section.path}
                        onClick={() => {
                          navigate(section.path);
                          setMobileOpen(false);
                        }}
                        sx={{ 
                          mx: 1,
                          mb: 0.5,
                          borderRadius: 2,
                          minHeight: 52,
                          justifyContent: 'initial', 
                          px: 2.5,
                          color: 'rgba(255, 255, 255, 0.8)',
                          transition: 'transform 0.2s ease, background-color 0.2s ease',
                          position: 'relative',
                          overflow: 'hidden',
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
                            opacity: 0,
                            transition: 'opacity 0.2s ease'
                          },
                          '&:hover': {
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                            color: 'white',
                            transform: 'translateX(4px)',
                            '&::before': {
                              opacity: 1
                            }
                          },
                          '&.Mui-selected': {
                            background: 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)',
                            color: '#000000',
                            boxShadow: '0 4px 12px rgba(255, 255, 255, 0.15)',
                            transform: 'translateX(4px)',
                            '&:hover': {
                              background: 'linear-gradient(135deg, #f8f8f8 0%, #e8e8e8 100%)',
                              color: '#000000',
                            },
                            '&::before': {
                              opacity: 0
                            }
                          },
                        }}
                      >
                        <ListItemIcon sx={{ 
                          minWidth: 0, 
                          mr: 3, 
                          justifyContent: 'center',
                          color: 'inherit'
                        }}>
                          {section.icon}
                        </ListItemIcon>
                        <ListItemText 
                          primary={section.text}
                          primaryTypographyProps={{
                            fontWeight: location.pathname === section.path ? 600 : 400,
                            fontSize: '0.9rem'
                          }}
                        />
                        {/* Active indicator */}
                        {location.pathname === section.path && (
                          <Box sx={{
                            position: 'absolute',
                            left: 0,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: 4,
                            height: '60%',
                            background: 'linear-gradient(180deg, #000000 0%, #333333 100%)',
                            borderRadius: '0 2px 2px 0'
                          }} />
                        )}
                      </ListItemButton>
                    ) : (
                      // Group menu item with submenu (mobile)
                      <>
                        <ListItemButton
                          onClick={() => handleSubmenuToggle(section.key)}
                          sx={{ 
                            mx: 1,
                            mb: 0.5,
                            borderRadius: 2,
                            minHeight: 52,
                            justifyContent: 'initial', 
                            px: 2.5,
                            color: isSubmenuActive(section.items) ? 'white' : 'rgba(255, 255, 255, 0.8)',
                            backgroundColor: isSubmenuActive(section.items) ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                            transition: 'transform 0.2s ease, background-color 0.2s ease',
                            position: 'relative',
                            overflow: 'hidden',
                            '&:hover': {
                              backgroundColor: 'rgba(255, 255, 255, 0.08)',
                              color: 'white',
                              transform: 'translateX(4px)',
                            },
                          }}
                        >
                          <ListItemIcon sx={{ 
                            minWidth: 0, 
                            mr: 3, 
                            justifyContent: 'center',
                            color: 'inherit'
                          }}>
                            {(() => {
                              const groupBadgeCount = getGroupBadgeCount(section.items);
                              return groupBadgeCount > 0 ? (
                                <Badge 
                                  badgeContent={groupBadgeCount} 
                                  color="error"
                                  sx={{
                                    '& .MuiBadge-badge': {
                                      background: 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)',
                                      color: 'white',
                                      fontSize: '0.7rem',
                                      minWidth: 16,
                                      height: 16
                                    }
                                  }}
                                >
                                  {section.icon}
                                </Badge>
                              ) : (
                                section.icon
                              );
                            })()}
                          </ListItemIcon>
                          <ListItemText 
                            primary={section.text}
                            primaryTypographyProps={{
                              fontWeight: isSubmenuActive(section.items) ? 600 : 400,
                              fontSize: '0.9rem'
                            }}
                          />
                          {openSubmenus[section.key] ? <ExpandLess /> : <ExpandMore />}
                          {/* Active indicator for group */}
                          {isSubmenuActive(section.items) && (
                            <Box sx={{
                              position: 'absolute',
                              left: 0,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              width: 4,
                              height: '60%',
                              background: 'linear-gradient(180deg, #000000 0%, #333333 100%)',
                              borderRadius: '0 2px 2px 0'
                            }} />
                          )}
                        </ListItemButton>
                        
                        {/* Submenu items (mobile) */}
                        <Collapse in={openSubmenus[section.key]} timeout={300}>
                          <List sx={{ pl: 2 }}>
                            {section.items.map((item) => (
                              <ListItemButton
                                key={item.text}
                                selected={location.pathname === item.path}
                                onClick={() => {
                                  navigate(item.path);
                                  setMobileOpen(false);
                                }}
                                sx={{ 
                                  mx: 1,
                                  mb: 0.5,
                                  borderRadius: 2,
                                  minHeight: 44,
                                  px: 2,
                                  color: 'rgba(255, 255, 255, 0.7)',
                                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                  position: 'relative',
                                  '&:hover': {
                                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                                    color: 'white',
                                    transform: 'translateX(8px)',
                                  },
                                  '&.Mui-selected': {
                                    background: 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)',
                                    color: '#000000',
                                    boxShadow: '0 2px 8px rgba(255, 255, 255, 0.1)',
                                    transform: 'translateX(8px)',
                                    '&:hover': {
                                      background: 'linear-gradient(135deg, #f8f8f8 0%, #e8e8e8 100%)',
                                      color: '#000000',
                                    },
                                  },
                                }}
                              >
                                <ListItemIcon sx={{ 
                                  minWidth: 32, 
                                  mr: 2,
                                  color: 'inherit'
                                }}>
                                  {item.badge ? (
                                    <Badge 
                                      badgeContent={item.badge} 
                                      color="error"
                                      sx={{
                                        '& .MuiBadge-badge': {
                                          background: 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)',
                                          color: 'white',
                                          fontSize: '0.6rem',
                                          minWidth: 14,
                                          height: 14
                                        }
                                      }}
                                    >
                                      {item.icon}
                                    </Badge>
                                  ) : (
                                    item.icon
                                  )}
                                </ListItemIcon>
                                <ListItemText 
                                  primary={item.text}
                                  primaryTypographyProps={{
                                    fontWeight: location.pathname === item.path ? 600 : 400,
                                    fontSize: '0.8rem'
                                  }}
                                />
                                {/* Active indicator for submenu item */}
                                {location.pathname === item.path && (
                                  <Box sx={{
                                    position: 'absolute',
                                    left: 0,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: 3,
                                    height: '50%',
                                    background: 'linear-gradient(180deg, #000000 0%, #333333 100%)',
                                    borderRadius: '0 2px 2px 0'
                                  }} />
                                )}
                              </ListItemButton>
                            ))}
                          </List>
                        </Collapse>
                      </>
                    )}
                  </Fragment>
                ))}
              </List>
            </Box>
          </Box>
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: sidebarOpen ? drawerWidth : collapsedDrawerWidth,
              transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              overflowX: 'hidden',
              border: 'none',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
              borderRight: '1px solid rgba(255, 255, 255, 0.08)',
              zIndex: (theme) => theme.zIndex.drawer + 2
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Profile Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        onClick={handleMenuClose}
      >
        <MenuItem onClick={() => navigate('/admin/profile')}>
          <AccountCircle sx={{ mr: 2 }} />
          Admin Profile
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <Logout sx={{ mr: 2 }} />
          Logout
        </MenuItem>
      </Menu>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          width: { 
            xs: '100%', 
            sm: `calc(100% - ${sidebarOpen ? drawerWidth : collapsedDrawerWidth}px)` 
          },
          mt: { xs: 7, sm: 8 }, // AppBar height
          background: mode === 'dark'
            ? 'linear-gradient(135deg, #121212 0%, #1a1a1a 100%)'
            : 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
          minHeight: '100vh',
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 20% 50%, rgba(0, 0, 0, 0.01) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(0, 0, 0, 0.01) 0%, transparent 50%)',
            pointerEvents: 'none',
            zIndex: 0
          }
        }}
      >
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Outlet />
        </Box>
      </Box>

      {/* Admin Notifications Dialog */}
      <Dialog 
        open={notificationDialog} 
        onClose={() => setNotificationDialog(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { maxHeight: '80vh' }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Notifications sx={{ mr: 1 }} />
              Admin Notifications
            </Box>
            <Typography variant="body2" color="text.secondary">
              {allNotifications.length} total
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {allNotifications.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Notifications sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No notifications found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {unreadCount > 0 ? 
                  `There are ${unreadCount} unread notifications but they couldn't be loaded. Check console for details.` :
                  "You'll see company-wide notifications and alerts here when employees submit requests."
                }
              </Typography>
            </Box>
          ) : (
            <List sx={{ py: 0 }}>
              {allNotifications.map((notification, index) => (
                <React.Fragment key={notification.id}>
                  <ListItem
                    sx={{ 
                      py: 2,
                      px: 3,
                      backgroundColor: notification.read ? 'transparent' : 'action.hover'
                    }}
                  >
                    <ListItemIcon>
                      <Avatar 
                        sx={{ 
                          bgcolor: `${getNotificationColor(notification.priority, notification.read)}.main`,
                          width: 40,
                          height: 40
                        }}
                      >
                        {getNotificationIcon(notification.type)}
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: notification.read ? 'normal' : 'bold' }}>
                            {notification.title || 'No Title'}
                          </Typography>
                          {!notification.read && (
                            <Chip 
                              label="NEW" 
                              size="small" 
                              color={getNotificationColor(notification.priority, false)}
                              sx={{ fontSize: '0.6rem', height: 20 }}
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            {notification.message || 'No Message'}
                          </Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1 }}>
                            {notification.userName && (
                              <Typography variant="caption" color="primary.main" sx={{ fontWeight: 'medium' }}>
                                Employee: {notification.userName}
                              </Typography>
                            )}
                            {notification.actionBy && (
                              <Typography variant="caption" color="secondary.main" sx={{ fontWeight: 'medium' }}>
                                Action by: {notification.actionBy}
                              </Typography>
                            )}
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {formatNotificationDate(notification.createdAt)}
                          </Typography>
                          {notification.relatedData && notification.type === 'pending_approval' && (
                            <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {notification.relatedData.leaveType && (
                                <Chip 
                                  label={`${notification.relatedData.leaveType} - ${notification.relatedData.totalDays} days`}
                                  size="small" 
                                  color="info"
                                />
                              )}
                              {notification.relatedData.category && (
                                <Chip 
                                  label={`${notification.relatedData.category} - ${notification.relatedData.currency || 'MYR'} ${notification.relatedData.amount}`}
                                  size="small" 
                                  color="success"
                                />
                              )}
                              {notification.relatedData.startDate && notification.relatedData.endDate && (
                                <Chip 
                                  label={`${notification.relatedData.startDate} to ${notification.relatedData.endDate}`}
                                  size="small" 
                                  variant="outlined"
                                />
                              )}
                              <Chip 
                                label="Pending Approval" 
                                size="small" 
                                color="warning"
                              />
                            </Box>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < allNotifications.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNotificationDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default AdminLayout;