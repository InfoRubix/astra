import React, { useState } from 'react';
import { 
  Container, 
  TextField, 
  Button, 
  Typography, 
  Box,
  Alert,
  Link,
  Card,
  InputAdornment,
  CircularProgress,
  Divider
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { 
  LockReset, 
  Email as EmailIcon, 
  ArrowBack, 
  Business as BusinessIcon,
  Send as SendIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeMode } from '../../contexts/ThemeContext';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();
  const { mode } = useThemeMode();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!email) {
      return setError('Please enter your email address');
    }
    
    setLoading(true);
    
    try {
      console.log('=== PASSWORD RESET DEBUG START ===');
      console.log('Attempting password reset for email:', email);
      console.log('Email trimmed:', email.trim());
      console.log('Email validation:', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()));
      
      const result = await resetPassword(email.trim());
      console.log('Password reset result:', result);
      console.log('Result success:', result.success);
      console.log('Result error:', result.error);
      console.log('=== PASSWORD RESET DEBUG END ===');
      
      if (result.success) {
        setSuccess('Password reset email sent! Check your inbox and spam folder.');
        console.log('SUCCESS: Password reset email sent successfully');
      } else {
        const errorMessage = result.error || 'Unknown error occurred';
        setError(`Failed to send reset email: ${errorMessage}`);
        console.error('ERROR: Password reset failed:', errorMessage);
        
        // Additional error context
        if (errorMessage.includes('user-not-found')) {
          setError('No account found with this email address. Please check your email or contact admin.');
        } else if (errorMessage.includes('too-many-requests')) {
          setError('Too many reset attempts. Please wait a few minutes before trying again.');
        } else if (errorMessage.includes('invalid-email')) {
          setError('Please enter a valid email address.');
        }
      }
    } catch (error) {
      console.error('CATCH ERROR: Exception during password reset:', error);
      setError(`Unexpected error: ${error.message}`);
    }
    
    setLoading(false);
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
              py: 4,
              px: 3,
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
                <LockReset sx={{ fontSize: 28, color: mode === 'dark' ? '#e8e8e8' : '#000000' }} />
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
                Forgot Password
              </Typography>
              
              <Typography variant="body2" sx={{ 
                color: 'rgba(255, 255, 255, 0.8)',
                fontWeight: 500,
                mb: 1
              }}>
                Password Recovery
              </Typography>
              
              {/* Branding */}
              <Typography variant="caption" sx={{
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: '0.7rem',
                fontWeight: 600,
                letterSpacing: 1.2,
                textTransform: 'uppercase'
              }}>
                by ASTRA
              </Typography>
            </Box>
            
            {/* Form Section */}
            <Box sx={{ p: 3 }}>
              <Typography variant="body2" sx={{
                textAlign: 'center',
                mb: 2,
                color: mode === 'dark' ? '#aaaaaa' : '#666666',
                lineHeight: 1.6
              }}>
                Enter your email address and we'll send you a link to reset your password.
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
              
              {success && (
                <Alert 
                  severity="success" 
                  sx={{ 
                    mb: 2,
                    borderRadius: 2,
                    fontSize: '0.875rem',
                    '& .MuiAlert-icon': {
                      color: '#2e7d32'
                    }
                  }}
                >
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    {success}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Check your spam folder if you don't receive the email.
                  </Typography>
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
                        <EmailIcon sx={{ color: 'rgba(0, 0, 0, 0.5)' }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    mb: 2,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      backgroundColor: 'rgba(0, 0, 0, 0.02)',
                      '&:hover': {
                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                      },
                      '&.Mui-focused': {
                        backgroundColor: 'rgba(0, 0, 0, 0.02)',
                        boxShadow: '0 0 0 2px rgba(0, 0, 0, 0.1)',
                      }
                    }
                  }}
                />
                
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                  sx={{
                    mt: 1,
                    mb: 2,
                    py: 1.2,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #000000 0%, #333333 100%)',
                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
                    fontSize: '1rem',
                    fontWeight: 600,
                    textTransform: 'none',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #1a1a1a 0%, #404040 100%)',
                      boxShadow: '0 6px 20px rgba(0, 0, 0, 0.3)',
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
                  {loading ? 'Sending...' : 'Send Reset Email'}
                </Button>
                
                <Divider sx={{ my: 2 }} />
                
                <Box textAlign="center">
                  <Link 
                    component={RouterLink} 
                    to="/login" 
                    variant="body2"
                    sx={{
                      color: mode === 'dark' ? '#aaaaaa' : '#666666',
                      textDecoration: 'none',
                      fontWeight: 500,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.5,
                      '&:hover': {
                        color: mode === 'dark' ? '#e8e8e8' : '#000000',
                        textDecoration: 'underline'
                      },
                      transition: 'color 0.3s ease'
                    }}
                  >
                    <ArrowBack sx={{ fontSize: 16 }} />
                    Back to Login
                  </Link>
                </Box>
              </Box>
            </Box>
          </Card>
          
          {/* Instructions Card - Compact */}
          <Card sx={{
            mt: 3,
            maxWidth: 400,
            mx: 'auto',
            background: mode === 'dark' ? 'rgba(26, 26, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 2
          }}>
            <Box sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" sx={{
                fontWeight: 600,
                mb: 2,
                color: mode === 'dark' ? '#e8e8e8' : '#1a1a1a',
                textAlign: 'center'
              }}>
                What happens next?
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <Box sx={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #000000 0%, #333333 100%)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    mt: 0.1
                  }}>
                    1
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Check your email inbox (and spam folder)
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <Box sx={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #000000 0%, #333333 100%)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    mt: 0.1
                  }}>
                    2
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Click the password reset link in the email
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <Box sx={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #000000 0%, #333333 100%)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    mt: 0.1
                  }}>
                    3
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Create your new password and sign in
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Card>
        </Box>
      </Container>
    </Box>
  );
}

export default ForgotPassword;