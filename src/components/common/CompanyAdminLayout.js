import React, { useState, useEffect, Fragment } from 'react';
import { 
  Box, 
  CssBaseline, 
  Drawer, 
  AppBar, 
  Toolbar, 
  List, 
  Typography, 
  IconButton, 
  ListItem, 
  ListItemButton, 
  ListItemIcon, 
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Badge,
  Collapse
} from '@mui/material';
import { 
  Menu as MenuIcon,
  Dashboard,
  People,
  Business,
  EventAvailable,
  Receipt,
  Assessment,
  Announcement,
  Settings,
  AccountCircle,
  Logout,
  AdminPanelSettings,
  AccessTime,
  CorporateFare,
  ExpandLess,
  ExpandMore,
  Group,
  Approval,
  CampaignOutlined,
  DarkMode,
  LightMode
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeMode } from '../../contexts/ThemeContext';
import { Navigate, useNavigate, useLocation, Outlet } from 'react-router-dom';

const drawerWidth = 280;
const collapsedDrawerWidth = 64;

/**
 * CompanyAdminLayout - Layout wrapper for company-level admin dashboards.
 *
 * Renders a responsive sidebar with collapsible sub-menus scoped to
 * the company admin role (people management, requests, reports, settings),
 * an app bar with a profile menu, and child routes via <Outlet />.
 *
 * Redirects to /login if the current user is not a company_admin.
 * No external props are required; user data is read from AuthContext.
 *
 * @returns {JSX.Element}
 */
function CompanyAdminLayout() {
  const { user, logout } = useAuth();
  const { mode, toggleTheme } = useThemeMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('companyAdminSidebarOpen');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Submenu state management
  const [openSubmenus, setOpenSubmenus] = useState(() => {
    const saved = localStorage.getItem('companyAdminOpenSubmenus');
    return saved ? JSON.parse(saved) : {
      peopleManagement: false,
      requests: false,
      reportsComms: false,
      settings: false
    };
  });

  // Check if user is company admin
  if (!user || user.role !== 'company_admin') {
    return <Navigate to="/login" replace />;
  }

  // Organized menu structure with submenus for Company Admin
  const menuStructure = [
    { 
      text: 'Dashboard', 
      icon: <Dashboard />, 
      path: '/company-admin', 
      type: 'single'
    },
    {
      text: 'People Management',
      icon: <Group />,
      type: 'group',
      key: 'peopleManagement',
      items: [
        { text: 'All Employees', icon: <People />, path: '/company-admin/employees' },
        { text: 'Branch Management', icon: <Business />, path: '/company-admin/branches' }
      ]
    },
    {
      text: 'Requests',
      icon: <Approval />,
      type: 'group',
      key: 'requests',
      items: [
        { text: 'Leave Management', icon: <EventAvailable />, path: '/company-admin/leaves' },
        { text: 'Claims Management', icon: <Receipt />, path: '/company-admin/claims' },
        { text: 'Forgotten Check-outs', icon: <AccessTime />, path: '/company-admin/forgotten-checkouts' }
      ]
    },
    {
      text: 'Reports & Communication',
      icon: <CampaignOutlined />,
      type: 'group',
      key: 'reportsComms',
      items: [
        { text: 'Company Reports', icon: <Assessment />, path: '/company-admin/reports' },
        { text: 'Announcements', icon: <Announcement />, path: '/company-admin/announcements' }
      ]
    },
    {
      text: 'Settings',
      icon: <Settings />,
      type: 'group',
      key: 'settings',
      items: [
        { text: 'Company Profile', icon: <CorporateFare />, path: '/company-admin/company-profile' },
        { text: 'Company Settings', icon: <Settings />, path: '/company-admin/settings' }
      ]
    }
  ];

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleSidebarToggle = () => {
    const newState = !sidebarOpen;
    setSidebarOpen(newState);
    localStorage.setItem('companyAdminSidebarOpen', JSON.stringify(newState));
  };

  // Handle submenu toggle
  const handleSubmenuToggle = (key) => {
    const newState = {
      ...openSubmenus,
      [key]: !openSubmenus[key]
    };
    setOpenSubmenus(newState);
    localStorage.setItem('companyAdminOpenSubmenus', JSON.stringify(newState));
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

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
    handleProfileMenuClose();
  };

  const drawer = (
    <Box sx={{ 
      height: '100%', 
      background: 'linear-gradient(180deg, #000000 0%, #1a1a1a 100%)',
      display: 'flex',
      flexDirection: 'column',
      paddingTop: '8px'
    }}>
      {/* Header Section */}
      <Box sx={{ 
        px: sidebarOpen ? 3 : 2, 
        py: 3, 
        textAlign: sidebarOpen ? 'left' : 'center',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        minHeight: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: sidebarOpen ? 'flex-start' : 'center'
      }}>
        {sidebarOpen ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <AdminPanelSettings sx={{ 
              color: '#ffffff', 
              fontSize: '2rem',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
            }} />
            <Box>
              <Typography variant="h6" sx={{ 
                color: '#ffffff', 
                fontWeight: 700,
                fontSize: '1.1rem',
                lineHeight: 1.2
              }}>
                Company Admin
              </Typography>
              <Typography variant="caption" sx={{ 
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '0.75rem',
                fontWeight: 500
              }}>
                {user.company}
              </Typography>
            </Box>
          </Box>
        ) : (
          <AdminPanelSettings sx={{ 
            color: '#ffffff', 
            fontSize: '1.8rem',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
          }} />
        )}
      </Box>

      {/* Navigation Items */}
      <Box sx={{ flex: 1, py: 1 }}>
        <List sx={{ px: 1 }}>
          {menuStructure.map((section) => (
            <Fragment key={section.text}>
              {section.type === 'single' ? (
                // Single menu item
                <ListItem disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    onClick={() => navigate(section.path)}
                    sx={{
                      minHeight: 48,
                      borderRadius: 2,
                      mx: 1,
                      px: sidebarOpen ? 2 : 1.5,
                      position: 'relative',
                      overflow: 'hidden',
                      color: location.pathname === section.path ? '#000000' : 'rgba(255, 255, 255, 0.8)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 3,
                        background: 'linear-gradient(180deg, #ffffff 0%, #f0f0f0 100%)',
                        opacity: location.pathname === section.path ? 1 : 0,
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
                      ...(location.pathname === section.path && {
                        background: 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)',
                        color: '#000000',
                        boxShadow: '0 4px 12px rgba(255, 255, 255, 0.15)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)',
                        }
                      })
                    }}
                  >
                    <ListItemIcon sx={{ 
                      color: 'inherit',
                      minWidth: sidebarOpen ? 40 : 'auto',
                      mr: sidebarOpen ? 2 : 0,
                      justifyContent: 'center'
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
                </ListItem>
              ) : (
                // Group menu item with submenu
                <>
                  <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton
                      onClick={() => sidebarOpen ? handleSubmenuToggle(section.key) : null}
                      sx={{
                        minHeight: 48,
                        borderRadius: 2,
                        mx: 1,
                        px: sidebarOpen ? 2 : 1.5,
                        position: 'relative',
                        overflow: 'hidden',
                        color: isSubmenuActive(section.items) ? 'white' : 'rgba(255, 255, 255, 0.8)',
                        backgroundColor: isSubmenuActive(section.items) ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&:hover': {
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          color: 'white',
                          transform: sidebarOpen ? 'translateX(4px)' : 'none',
                        },
                      }}
                    >
                      <ListItemIcon sx={{ 
                        color: 'inherit',
                        minWidth: sidebarOpen ? 40 : 'auto',
                        mr: sidebarOpen ? 2 : 0,
                        justifyContent: 'center'
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
                  </ListItem>
                  
                  {/* Submenu items */}
                  {sidebarOpen && (
                    <Collapse in={openSubmenus[section.key]} timeout={300}>
                      <List sx={{ pl: 2 }}>
                        {section.items.map((item) => (
                          <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                            <ListItemButton
                              onClick={() => navigate(item.path)}
                              sx={{
                                minHeight: 44,
                                borderRadius: 2,
                                mx: 1,
                                px: 2,
                                position: 'relative',
                                color: 'rgba(255, 255, 255, 0.7)',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                '&:hover': {
                                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                                  color: 'white',
                                  transform: 'translateX(8px)',
                                },
                                ...(location.pathname === item.path && {
                                  background: 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)',
                                  color: '#000000',
                                  boxShadow: '0 2px 8px rgba(255, 255, 255, 0.1)',
                                  transform: 'translateX(8px)',
                                  '&:hover': {
                                    background: 'linear-gradient(135deg, #f8f8f8 0%, #e8e8e8 100%)',
                                    color: '#000000',
                                  }
                                })
                              }}
                            >
                              <ListItemIcon sx={{ 
                                color: 'inherit',
                                minWidth: 32,
                                mr: 2
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
                          </ListItem>
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
            {user.company}
          </Typography>
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
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
            edge="start"
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
            aria-label="open drawer"
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
              fontWeight: 600,
              fontSize: '1.1rem'
            }}
          >
            {user.company} - Company Administration
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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

            <Box
              sx={{
                display: { xs: 'none', md: 'flex' },
                alignItems: 'center',
                backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                px: 2,
                py: 1,
                borderRadius: 2,
                border: mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)'
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : '#666666',
                  fontWeight: 500
                }}
              >
                Company Admin: {user?.firstName}
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

      <Menu
        id="profile-menu"
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleProfileMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={() => { navigate('/company-admin/profile'); handleProfileMenuClose(); }}>
          <ListItemIcon>
            <AccountCircle fontSize="small" />
          </ListItemIcon>
          My Profile
        </MenuItem>
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>

      <Box
        component="nav"
        sx={{ width: { sm: sidebarOpen ? drawerWidth : collapsedDrawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="navigation menu"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
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
            {/* Mobile Header */}
            <Box sx={{ 
              px: 3, 
              py: 3, 
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              minHeight: 80,
              display: 'flex',
              alignItems: 'center'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <AdminPanelSettings sx={{ 
                  color: '#ffffff', 
                  fontSize: '2rem',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                }} />
                <Box>
                  <Typography variant="h6" sx={{ 
                    color: '#ffffff', 
                    fontWeight: 700,
                    fontSize: '1.1rem',
                    lineHeight: 1.2
                  }}>
                    Company Admin
                  </Typography>
                  <Typography variant="caption" sx={{ 
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '0.75rem',
                    fontWeight: 500
                  }}>
                    {user.company}
                  </Typography>
                </Box>
              </Box>
            </Box>
            
            {/* Mobile Menu Items */}
            <Box sx={{ flex: 1, py: 1 }}>
              <List sx={{ px: 1 }}>
                {menuStructure.map((section) => (
                  <Fragment key={`mobile-${section.text}`}>
                    {section.type === 'single' ? (
                      // Single menu item (mobile)
                      <ListItem disablePadding sx={{ mb: 0.5 }}>
                        <ListItemButton
                          onClick={() => {
                            navigate(section.path);
                            handleDrawerToggle();
                          }}
                          sx={{
                            minHeight: 48,
                            borderRadius: 2,
                            mx: 1,
                            px: 2,
                            position: 'relative',
                            overflow: 'hidden',
                            color: location.pathname === section.path ? '#000000' : 'rgba(255, 255, 255, 0.8)',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            '&:hover': {
                              backgroundColor: 'rgba(255, 255, 255, 0.08)',
                              color: 'white',
                              transform: 'translateX(4px)',
                            },
                            ...(location.pathname === section.path && {
                              background: 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)',
                              color: '#000000',
                              boxShadow: '0 4px 12px rgba(255, 255, 255, 0.15)',
                              '&:hover': {
                                background: 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)',
                              }
                            })
                          }}
                        >
                          <ListItemIcon sx={{ 
                            color: 'inherit',
                            minWidth: 40,
                            mr: 2
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
                      </ListItem>
                    ) : (
                      // Group menu item with submenu (mobile)
                      <>
                        <ListItem disablePadding sx={{ mb: 0.5 }}>
                          <ListItemButton
                            onClick={() => handleSubmenuToggle(section.key)}
                            sx={{
                              minHeight: 48,
                              borderRadius: 2,
                              mx: 1,
                              px: 2,
                              position: 'relative',
                              overflow: 'hidden',
                              color: isSubmenuActive(section.items) ? 'white' : 'rgba(255, 255, 255, 0.8)',
                              backgroundColor: isSubmenuActive(section.items) ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                              '&:hover': {
                                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                color: 'white',
                                transform: 'translateX(4px)',
                              },
                            }}
                          >
                            <ListItemIcon sx={{ 
                              color: 'inherit',
                              minWidth: 40,
                              mr: 2
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
                        </ListItem>
                        
                        {/* Submenu items (mobile) */}
                        <Collapse in={openSubmenus[section.key]} timeout={300}>
                          <List sx={{ pl: 2 }}>
                            {section.items.map((item) => (
                              <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                                <ListItemButton
                                  onClick={() => {
                                    navigate(item.path);
                                    handleDrawerToggle();
                                  }}
                                  sx={{
                                    minHeight: 44,
                                    borderRadius: 2,
                                    mx: 1,
                                    px: 2,
                                    position: 'relative',
                                    color: 'rgba(255, 255, 255, 0.7)',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    '&:hover': {
                                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                                      color: 'white',
                                      transform: 'translateX(8px)',
                                    },
                                    ...(location.pathname === item.path && {
                                      background: 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)',
                                      color: '#000000',
                                      boxShadow: '0 2px 8px rgba(255, 255, 255, 0.1)',
                                      transform: 'translateX(8px)',
                                      '&:hover': {
                                        background: 'linear-gradient(135deg, #f8f8f8 0%, #e8e8e8 100%)',
                                        color: '#000000',
                                      }
                                    })
                                  }}
                                >
                                  <ListItemIcon sx={{ 
                                    color: 'inherit',
                                    minWidth: 32,
                                    mr: 2
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
                              </ListItem>
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
              borderRight: '1px solid rgba(255, 255, 255, 0.08)'
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{ 
          flexGrow: 1, 
          p: 3, 
          width: { sm: `calc(100% - ${sidebarOpen ? drawerWidth : collapsedDrawerWidth}px)` },
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          mt: '64px',
          minHeight: '100vh',
          backgroundColor: mode === 'dark' ? '#121212' : '#fafafa'
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}

export default CompanyAdminLayout;