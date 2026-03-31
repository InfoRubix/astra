import React, { useState } from 'react';
import { 
  Container, 
  Paper, 
  TextField, 
  Button, 
  Typography, 
  Box,
  Alert,
  Link,
  IconButton,
  InputAdornment,
  CircularProgress,
  Divider,
  Card
} from '@mui/material';
import { 
  Visibility,
  VisibilityOff,
  Email as EmailIcon,
  Lock as LockIcon,
  Business as BusinessIcon,
  LoginOutlined as LoginIcon
} from '@mui/icons-material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeMode } from '../../contexts/ThemeContext';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { mode } = useThemeMode();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Sanitize email before login
    const sanitizedEmail = email.trim().toLowerCase();
    console.log('🔐 Login attempt with email:', sanitizedEmail);

    const result = await login(sanitizedEmail, password);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  const handleTogglePassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #000000 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background decorative elements */}
      <Box sx={{
        position: 'absolute',
        top: -100,
        left: -100,
        width: 300,
        height: 300,
        background: 'radial-gradient(circle, rgba(255, 255, 255, 0.02) 0%, transparent 70%)',
        borderRadius: '50%'
      }} />
      <Box sx={{
        position: 'absolute',
        bottom: -150,
        right: -150,
        width: 400,
        height: 400,
        background: 'radial-gradient(circle, rgba(255, 255, 255, 0.01) 0%, transparent 70%)',
        borderRadius: '50%'
      }} />
      
      <Container component="main" maxWidth="xs">
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Card
            elevation={0}
            sx={{
              background: mode === 'dark' ? 'linear-gradient(135deg, #1a1a1a 0%, #141414 100%)' : 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
              borderRadius: 3,
              boxShadow: '0 15px 40px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              maxWidth: 400,
              mx: 'auto'
            }}
          >
            {/* Header Section */}
            <Box sx={{
              background: 'linear-gradient(135deg, #000000 0%, #333333 100%)',
              color: 'white',
              py: { xs: 3, sm: 4 },
              px: { xs: 2, sm: 3 },
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Decorative background */}
              <Box sx={{
                position: 'absolute',
                top: -30,
                right: -30,
                width: 100,
                height: 100,
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '50%'
              }} />
              
              {/* Logo/Icon */}
              <Box sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 60,
                height: 60,
                borderRadius: 2,
                background: mode === 'dark' ? 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)' : 'linear-gradient(135deg, #ffffff 0%, #e0e0e0 100%)',
                mb: 2,
                boxShadow: '0 6px 16px rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                position: 'relative',
                zIndex: 1
              }}>
                <BusinessIcon sx={{ fontSize: 28, color: mode === 'dark' ? '#e8e8e8' : '#000000' }} />
              </Box>
              
              <Typography variant="h5" sx={{ 
                fontWeight: 700, 
                mb: 0.5,
                background: 'linear-gradient(135deg, #ffffff 0%, #e0e0e0 100%)',
                backgroundClip: 'text',
                '-webkit-background-clip': 'text',
                '-webkit-text-fill-color': 'transparent',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                letterSpacing: 0.5
              }}>
                Attendance System
              </Typography>
              
              <Typography variant="body2" sx={{ 
                color: 'rgba(255, 255, 255, 0.8)',
                fontWeight: 500,
                mb: 1,
                display: { xs: 'block', sm: 'block' }
              }}>
                Employee Portal Access
              </Typography>
              
              {/* RUBIX Branding */}
              <Typography variant="caption" sx={{
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: '0.7rem',
                fontWeight: 600,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                display: { xs: 'block', sm: 'block' }
              }}>
                by RUBIX TECHNOLOGY
              </Typography>
            </Box>
            
            {/* Form Section */}
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" sx={{
                fontWeight: 600,
                textAlign: 'center',
                mb: 2,
                color: mode === 'dark' ? '#e8e8e8' : '#1a1a1a'
              }}>
                Sign In to Continue
              </Typography>
              
              {error && (
                <Alert 
                  severity="error" 
                  sx={{ 
                    mb: 2,
                    borderRadius: 2,
                    fontSize: '0.875rem',
                    '& .MuiAlert-icon': {
                      color: '#d32f2f'
                    }
                  }}
                >
                  {error}
                </Alert>
              )}
              
              <Box component="form" onSubmit={handleSubmit}>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="email"
                  label="Email Address"
                  name="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon sx={{ color: mode === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    mb: 1.5,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      '&:hover': {
                        backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                      },
                      '&.Mui-focused': {
                        backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                        boxShadow: mode === 'dark' ? '0 0 0 2px rgba(144, 202, 249, 0.3)' : '0 0 0 2px rgba(0, 0, 0, 0.1)',
                      }
                    }
                  }}
                />
                
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  name="password"
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon sx={{ color: mode === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle password visibility"
                          onClick={handleTogglePassword}
                          edge="end"
                          disabled={loading}
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    mb: 2,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                      '&:hover': {
                        backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                      },
                      '&.Mui-focused': {
                        backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                        boxShadow: mode === 'dark' ? '0 0 0 2px rgba(144, 202, 249, 0.3)' : '0 0 0 2px rgba(0, 0, 0, 0.1)',
                      }
                    }
                  }}
                />
                
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <LoginIcon />}
                  sx={{
                    mt: 1,
                    mb: 2,
                    py: 1.2,
                    borderRadius: 2,
                    background: mode === 'dark' ? 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)' : 'linear-gradient(135deg, #000000 0%, #333333 100%)',
                    color: '#ffffff',
                    boxShadow: mode === 'dark' ? '0 4px 15px rgba(25, 118, 210, 0.3)' : '0 4px 15px rgba(0, 0, 0, 0.2)',
                    fontSize: '1rem',
                    fontWeight: 600,
                    textTransform: 'none',
                    '&:hover': {
                      background: mode === 'dark' ? 'linear-gradient(135deg, #1e88e5 0%, #1976d2 100%)' : 'linear-gradient(135deg, #1a1a1a 0%, #404040 100%)',
                      boxShadow: mode === 'dark' ? '0 6px 20px rgba(25, 118, 210, 0.4)' : '0 6px 20px rgba(0, 0, 0, 0.3)',
                      transform: 'translateY(-1px)'
                    },
                    '&:active': {
                      transform: 'translateY(0px)',
                    },
                    '&:disabled': {
                      background: 'rgba(0, 0, 0, 0.3)',
                      color: 'rgba(255, 255, 255, 0.5)'
                    },
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                >
                  {loading ? 'Signing In...' : 'Sign In'}
                </Button>
                
                <Divider sx={{ my: 2 }} />
                
                <Box textAlign="center">
                  <Link 
                    component={RouterLink} 
                    to="/forgot-password" 
                    variant="body2"
                    sx={{
                      color: mode === 'dark' ? '#aaaaaa' : '#666666',
                      textDecoration: 'none',
                      fontWeight: 500,
                      '&:hover': {
                        color: mode === 'dark' ? '#e8e8e8' : '#000000',
                        textDecoration: 'underline'
                      },
                      transition: 'color 0.3s ease'
                    }}
                  >
                    Forgot your password?
                  </Link>
                </Box>
              </Box>
            </Box>
          </Card>
        </Box>
      </Container>
    </Box>
  );
}

export default Login;