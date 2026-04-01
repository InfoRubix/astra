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
  AccessTime,
  EventAvailable,
  Receipt,
  AccountCircle,
  Logout,
  Notifications,
  Business,
  Announcement,
  Schedule,
  ExpandLess,
  ExpandMore,
  QueryBuilder,
  HelpOutline,
  Person,
  SupervisorAccount,
  Settings,
  Description,
  DarkMode,
  LightMode
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeMode } from '../../contexts/ThemeContext';
import { collection, query, where, getDocs, writeBatch, doc, orderBy, limit } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { format } from 'date-fns';
import { isLeader } from '../../utils/positionHierarchy';

const drawerWidth = 240;
const collapsedDrawerWidth = 64;

/**
 * UserLayout - Main layout wrapper for the employee (user) portal.
 *
 * Provides a responsive sidebar navigation with collapsible sub-menus
 * (time management, requests, information, settings, and conditional
 * team approvals for leaders), an app bar with notification badges
 * and a profile menu, and renders child routes via <Outlet />.
 *
 * Dynamically shows a "Team Approvals" section when the current user
 * holds a leadership position in the company hierarchy.
 *
 * This component has no props; user data and leader status are
 * determined from AuthContext and Firestore.
 *
 * @returns {JSX.Element}
 */
function UserLayout() {
  const { user, logout } = useAuth();
  const { mode, toggleTheme } = useThemeMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationDialog, setNotificationDialog] = useState(false);
  const [allNotifications, setAllNotifications] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('userSidebarOpen');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [expandedSections, setExpandedSections] = useState(() => {
    const saved = localStorage.getItem('userExpandedSections');
    return saved ? JSON.parse(saved) : { teamApprovals: false, settings: false };
  });
  const [userIsLeader, setUserIsLeader] = useState(false);
  const [allUsers, setAllUsers] = useState([]);

  const baseMenuSections = [
    {
      title: 'Dashboard',
      icon: <Dashboard />,
      items: [
        { text: 'Dashboard', icon: <Dashboard />, path: '/user' }
      ]
    },
    {
      title: 'Time Management',
      icon: <QueryBuilder />,
      items: [
        { text: 'Attendance', icon: <AccessTime />, path: '/user/attendance' },
        { text: 'Forgotten Check-outs', icon: <Schedule />, path: '/user/forgotten-checkouts' }
      ]
    },
    {
      title: 'Requests',
      icon: <HelpOutline />,
      items: [
        { text: 'Leaves', icon: <EventAvailable />, path: '/user/leaves' },
        { text: 'Claims', icon: <Receipt />, path: '/user/claims' }
      ]
    },
    {
      title: 'Information',
      icon: <Business />,
      items: [
        { text: 'Announcements', icon: <Announcement />, path: '/user/announcements' },
        { text: 'Payslips', icon: <Business />, path: '/user/payslips' },
        { text: 'EA Form', icon: <Description />, path: '/user/ea-form' }
      ]
    },
    {
      title: 'Settings',
      icon: <Settings />,
      type: 'group',
      key: 'settings',
      items: [
        { text: 'Profile', icon: <AccountCircle />, path: '/user/profile' },
        { text: 'Notifications', icon: <Notifications />, path: '/user/settings' }
      ]
    }
  ];

  // Add Team Approvals for leaders with dropdown structure
  const menuSections = userIsLeader
    ? [
        ...baseMenuSections.slice(0, 3), // Dashboard, Time Management, Requests
        {
          title: 'Team Approvals',
          icon: <SupervisorAccount />,
          type: 'group',
          key: 'teamApprovals',
          items: [
            { text: 'Leave Requests', icon: <EventAvailable />, path: '/user/team-approvals' },
            { text: 'Forgotten Checkouts', icon: <Schedule />, path: '/user/team-checkouts' },
            { text: 'Claim Expenses', icon: <Receipt />, path: '/user/team-claims' }
          ]
        },
        ...baseMenuSections.slice(3) // Information, Account
      ]
    : baseMenuSections;

  // Load unread notification count
  const loadUnreadCount = async () => {
    if (!user?.uid) return;
    
    try {
      console.log('Loading user notifications for userId:', user.uid);
      
      // Try simple query first
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', user.uid)
      );
      
      const querySnapshot = await getDocs(q);
      const allUserNotifications = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      console.log('All user notifications loaded:', allUserNotifications.length);
      
      // Filter for unread notifications
      const unreadNotifications = allUserNotifications.filter(n => n.read === false);
      
      console.log('User unread notifications found:', unreadNotifications.length, 'notifications');
      console.log('User unread notifications data:', unreadNotifications);
      
      // Debug: Check if we have any notifications with titles and messages
      unreadNotifications.forEach((notif, index) => {
        console.log(`User Notification ${index + 1}:`, {
          id: notif.id,
          title: notif.title,
          message: notif.message,
          type: notif.type,
          userId: notif.userId,
          relatedData: notif.relatedData
        });
      });
      
      setUnreadCount(unreadNotifications.length);
    } catch (error) {
      console.error('Error loading user notifications:', error);
      setUnreadCount(0);
    }
  };

  // Load all notifications for detail view
  const loadAllNotifications = async () => {
    if (!user?.uid) return;
    
    try {
      console.log('Loading all user notifications for userId:', user.uid);
      
      // Simple query to avoid index issues
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', user.uid)
      );
      
      const querySnapshot = await getDocs(q);
      const allNotifications = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort manually by createdAt and limit
      const sortedNotifications = allNotifications
        .sort((a, b) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
          return bTime - aTime;
        })
        .slice(0, 20);
      
      setAllNotifications(sortedNotifications);
      console.log('Loaded all user notifications:', sortedNotifications.length, 'notifications');
      console.log('User notifications detail data:', sortedNotifications);
    } catch (error) {
      console.error('Error loading all user notifications:', error);
      setAllNotifications([]);
    }
  };

  // Helper functions for submenu management
  const toggleSection = (key) => {
    setExpandedSections(prev => {
      const newState = {
        ...prev,
        [key]: !prev[key]
      };
      localStorage.setItem('userExpandedSections', JSON.stringify(newState));
      return newState;
    });
  };

  const isSubmenuActive = (items) => {
    return items.some(item => location.pathname === item.path);
  };

  // Save sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('userSidebarOpen', JSON.stringify(sidebarOpen));
  }, [sidebarOpen]);

  // Check if user is a leader
  useEffect(() => {
    const checkLeaderStatus = async () => {
      if (!user?.uid) return;

      try {
        // Query only same-company users (respects Firestore rules)
        const userCompany = user.company || user.originalCompanyName || '';
        const usersQuery = userCompany
          ? query(collection(db, 'users'), where('company', '==', userCompany))
          : query(collection(db, 'users'));
        const usersSnapshot = await getDocs(usersQuery);
        const users = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAllUsers(users);

        // Only check if user has a position
        if (user?.position && users.length > 0) {
          const leaderStatus = isLeader(user, users);
          setUserIsLeader(leaderStatus);
        } else {
          setUserIsLeader(false);
        }
      } catch (error) {
        console.error('Error checking leader status:', error);
        setUserIsLeader(false);
      }
    };

    checkLeaderStatus();
  }, [user?.uid, user?.position]);

  useEffect(() => {
    if (user?.uid) {
      loadUnreadCount();

      // Reload notification count every 30 seconds
      const interval = setInterval(loadUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user?.uid]);

  const handleNotificationClick = async () => {
    // Load all notifications and show dialog
    await loadAllNotifications();
    setNotificationDialog(true);
    
    // If there are unread notifications, mark them as read
    if (unreadCount > 0) {
      try {
        // Get all user notifications using simple query
        const q = query(
          collection(db, 'notifications'),
          where('userId', '==', user.uid)
        );
        
        const querySnapshot = await getDocs(q);
        const allUserNotifications = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Filter for unread notifications
        const unreadNotifications = allUserNotifications.filter(n => n.read === false);
        
        if (unreadNotifications.length > 0) {
          // Mark all as read using batch
          const batch = writeBatch(db);
          
          unreadNotifications.forEach((notification) => {
            batch.update(doc(db, 'notifications', notification.id), {
              read: true,
              readAt: new Date()
            });
          });
          
          await batch.commit();
          console.log('Marked user notifications as read:', unreadNotifications.length, 'notifications');
          
          // Reload the count
          setUnreadCount(0);
          
          // Update the loaded notifications to show as read
          setAllNotifications(prev => prev.map(n => ({ ...n, read: true })));
        }
      } catch (error) {
        console.error('Error marking user notifications as read:', error);
      }
    }
  };

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

  // Helper functions for notification display
  const getNotificationIcon = (type) => {
    switch(type) {
      case 'claim_update': return <Receipt />;
      case 'leave_update': return <EventAvailable />;
      case 'attendance_update': return <AccessTime />;
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
      return format(date, 'dd/MM/yyyy HH:mm');
    } catch (error) {
      return 'Unknown date';
    }
  };

  const handleSidebarToggle = () => {
    const newState = !sidebarOpen;
    setSidebarOpen(newState);
    localStorage.setItem('userSidebarOpen', JSON.stringify(newState));
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
              <Business sx={{ 
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
                  letterSpacing: 0.5
                }}>
                  Employee Portal
                </Typography>
              </Box>
            )}
          </Box>
          
          {/* Brand Footer */}
          {sidebarOpen && (
            <Box sx={{ 
              width: '100%',
              textAlign: 'center',
              mt: 1
            }}>
              <Typography variant="caption" sx={{ 
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: '0.7rem',
                fontWeight: 500,
                letterSpacing: 1,
                textTransform: 'uppercase'
              }}>
                by ASTRA
              </Typography>
            </Box>
          )}
        </Toolbar>
      </Box>

      {/* Navigation Menu */}
      <Box sx={{ flex: 1, py: 2, overflowY: 'auto', overflowX: 'hidden' }}>
        <List sx={{ px: 1 }}>
          {menuSections.map((section) => (
            <Fragment key={section.title}>
              {section.type === 'group' ? (
                // Group menu item with submenu (dropdown)
                <>
                  <ListItemButton
                    onClick={() => sidebarOpen ? toggleSection(section.key) : null}
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
                      {section.icon}
                    </ListItemIcon>
                    {sidebarOpen && (
                      <>
                        <ListItemText
                          primary={section.title}
                          primaryTypographyProps={{
                            fontWeight: isSubmenuActive(section.items) ? 600 : 400,
                            fontSize: '0.9rem'
                          }}
                        />
                        {expandedSections[section.key] ? <ExpandLess /> : <ExpandMore />}
                      </>
                    )}
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
                    <Collapse in={expandedSections[section.key]} timeout={300}>
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
                              {item.icon}
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
              ) : (
                // Single menu items (flatten items for non-group sections)
                section.items.map((item) => (
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
                      {item.icon}
                    </ListItemIcon>
                    {sidebarOpen && (
                      <ListItemText
                        primary={item.text}
                        primaryTypographyProps={{
                          fontWeight: location.pathname === item.path ? 600 : 400,
                          fontSize: '0.9rem'
                        }}
                      />
                    )}
                    {/* Active indicator */}
                    {location.pathname === item.path && (
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
                ))
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
            {user?.originalCompanyName || 'Attendance Management System'}
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
            Employee Portal
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
                Welcome, {user?.firstName}
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
        aria-label="navigation menu"
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
            flexDirection: 'column'
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
                py: 3
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
                    <Business sx={{ 
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
                      letterSpacing: 0.5
                    }}>
                      Employee Portal
                    </Typography>
                  </Box>
                </Box>
                
                {/* Brand Footer - Mobile */}
                <Box sx={{ 
                  width: '100%',
                  textAlign: 'center',
                  mt: 1
                }}>
                  <Typography variant="caption" sx={{ 
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontSize: '0.7rem',
                    fontWeight: 500,
                    letterSpacing: 1,
                    textTransform: 'uppercase'
                  }}>
                    by ASTRA
                  </Typography>
                </Box>
              </Toolbar>
            </Box>

            {/* Navigation Menu - Mobile */}
            <Box sx={{ flex: 1, py: 2, overflowY: 'auto', overflowX: 'hidden' }}>
              <List sx={{ px: 1 }}>
                {menuSections.map((section) => (
                  <Fragment key={`mobile-${section.title}`}>
                    {section.type === 'group' ? (
                      // Group menu item with submenu (mobile)
                      <>
                        <ListItemButton
                          onClick={() => toggleSection(section.key)}
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
                            {section.icon}
                          </ListItemIcon>
                          <ListItemText
                            primary={section.title}
                            primaryTypographyProps={{
                              fontWeight: isSubmenuActive(section.items) ? 600 : 400,
                              fontSize: '0.9rem'
                            }}
                          />
                          {expandedSections[section.key] ? <ExpandLess /> : <ExpandMore />}
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
                        <Collapse in={expandedSections[section.key]} timeout={300}>
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
                                  {item.icon}
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
                    ) : (
                      // Single menu items (mobile)
                      section.items.map((item) => (
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
                            {item.icon}
                          </ListItemIcon>
                          <ListItemText
                            primary={item.text}
                            primaryTypographyProps={{
                              fontWeight: location.pathname === item.path ? 600 : 400,
                              fontSize: '0.9rem'
                            }}
                          />
                          {/* Active indicator */}
                          {location.pathname === item.path && (
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
                      ))
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
        <MenuItem onClick={() => navigate('/user/profile')}>
          <AccountCircle sx={{ mr: 2 }} />
          Profile
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

      {/* Notifications Dialog */}
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
              Notifications
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
                No notifications yet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                You'll see notifications here when admins approve or reject your requests
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
                          <Typography variant="caption" color="text.secondary">
                            {formatNotificationDate(notification.createdAt)}
                          </Typography>
                          {notification.relatedData && (
                            <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {notification.relatedData.claimType && (
                                <Chip label={notification.relatedData.claimType} size="small" variant="outlined" />
                              )}
                              {notification.relatedData.category && (
                                <Chip label={notification.relatedData.category} size="small" variant="outlined" />
                              )}
                              {notification.relatedData.leaveType && (
                                <Chip label={notification.relatedData.leaveType} size="small" variant="outlined" />
                              )}
                              {notification.relatedData.amount && (
                                <Chip
                                  label={`${notification.relatedData.currency || 'MYR'} ${notification.relatedData.amount}`}
                                  size="small"
                                  variant="outlined"
                                  color="primary"
                                />
                              )}
                              {notification.relatedData.totalDays && (
                                <Chip
                                  label={`${notification.relatedData.totalDays} days`}
                                  size="small"
                                  variant="outlined"
                                  color="info"
                                />
                              )}
                              {notification.relatedData.startDate && notification.relatedData.endDate && (
                                <Chip
                                  label={`${(() => {
                                    try {
                                      const start = notification.relatedData.startDate?.toDate ?
                                        notification.relatedData.startDate.toDate() :
                                        new Date(notification.relatedData.startDate);
                                      const end = notification.relatedData.endDate?.toDate ?
                                        notification.relatedData.endDate.toDate() :
                                        new Date(notification.relatedData.endDate);
                                      return `${format(start, 'dd/MM')} - ${format(end, 'dd/MM')}`;
                                    } catch {
                                      return 'Date range';
                                    }
                                  })()}`}
                                  size="small"
                                  variant="outlined"
                                  color="default"
                                />
                              )}
                              {notification.relatedData.approvedBy && (
                                <Chip
                                  label={`By: ${notification.relatedData.approvedBy}`}
                                  size="small"
                                  variant="outlined"
                                  color="secondary"
                                />
                              )}
                              {notification.relatedData.reason && (
                                <Chip
                                  label={`Note: ${notification.relatedData.reason.length > 20 ? notification.relatedData.reason.substring(0, 20) + '...' : notification.relatedData.reason}`}
                                  size="small"
                                  variant="outlined"
                                  color="warning"
                                />
                              )}
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

export default UserLayout;