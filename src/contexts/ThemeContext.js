import React, { createContext, useContext, useState, useMemo } from 'react';
import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const ThemeContext = createContext();

export function useThemeMode() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeContextProvider');
  }
  return context;
}

export function ThemeContextProvider({ children }) {
  const [mode, setMode] = useState(() => {
    try {
      const saved = localStorage.getItem('themeMode');
      return saved === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  const toggleTheme = () => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem('themeMode', next);
      } catch {}
      return next;
    });
  };

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          ...(mode === 'light'
            ? {
                primary: { main: '#1976d2', light: '#42a5f5', dark: '#1565c0' },
                secondary: { main: '#dc004e' },
                background: { default: '#f5f5f5', paper: '#ffffff' },
              }
            : {
                primary: { main: '#90caf9', light: '#e3f2fd', dark: '#42a5f5' },
                secondary: { main: '#f48fb1' },
                background: { default: '#0a0a0a', paper: '#141414' },
                text: {
                  primary: '#e8e8e8',
                  secondary: '#a0a0a0',
                },
                divider: 'rgba(255,255,255,0.08)',
                success: { main: '#66bb6a', light: '#81c784', dark: '#388e3c' },
                error: { main: '#f44336', light: '#e57373', dark: '#d32f2f' },
                warning: { main: '#ffa726', light: '#ffb74d', dark: '#f57c00' },
                info: { main: '#29b6f6', light: '#4fc3f7', dark: '#0288d1' },
                // Override grey so grey.50, grey.100 etc work in dark mode
                grey: {
                  50: '#1a1a1a',
                  100: '#1e1e1e',
                  200: '#2a2a2a',
                  300: '#3a3a3a',
                  400: '#4a4a4a',
                  500: '#6a6a6a',
                  600: '#8a8a8a',
                  700: '#aaa',
                  800: '#ccc',
                  900: '#eee',
                },
                action: {
                  hover: 'rgba(255,255,255,0.05)',
                  selected: 'rgba(255,255,255,0.08)',
                  disabledBackground: 'rgba(255,255,255,0.12)',
                },
              }),
        },
        typography: {
          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
        },
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              body: {
                backgroundColor: mode === 'dark' ? '#0a0a0a' : '#f5f5f5',
                color: mode === 'dark' ? '#e8e8e8' : '#333',
                // Override common hardcoded backgrounds globally
                ...(mode === 'dark' && {
                  '& .MuiPaper-root': {
                    backgroundImage: 'none',
                  },
                }),
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: mode === 'dark' ? {
                backgroundImage: 'none',
                backgroundColor: '#141414',
                borderColor: 'rgba(255,255,255,0.08)',
              } : {},
            },
          },
          MuiCard: {
            styleOverrides: {
              root: mode === 'dark' ? {
                backgroundImage: 'none',
                backgroundColor: '#141414',
                borderColor: 'rgba(255,255,255,0.08)',
              } : {},
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: mode === 'dark' ? {
                backgroundImage: 'none',
                backgroundColor: '#0f0f0f',
              } : {},
            },
          },
          MuiDialog: {
            styleOverrides: {
              paper: mode === 'dark' ? {
                backgroundImage: 'none',
                backgroundColor: '#1a1a1a',
              } : {},
            },
          },
          MuiTableCell: {
            styleOverrides: {
              root: mode === 'dark' ? {
                borderBottomColor: 'rgba(255,255,255,0.06)',
              } : {},
              head: mode === 'dark' ? {
                backgroundColor: '#1a1a1a',
                color: '#e8e8e8',
              } : {},
            },
          },
          MuiTableRow: {
            styleOverrides: {
              root: mode === 'dark' ? {
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.03) !important',
                },
                '&.Mui-selected': {
                  backgroundColor: 'rgba(144,202,249,0.08)',
                },
              } : {},
            },
          },
          MuiChip: {
            styleOverrides: {
              root: mode === 'dark' ? {
                borderColor: 'rgba(255,255,255,0.15)',
              } : {},
              filled: mode === 'dark' ? {
                backgroundColor: 'rgba(255,255,255,0.08)',
              } : {},
            },
          },
          MuiAlert: {
            styleOverrides: {
              root: mode === 'dark' ? {
                backgroundColor: 'rgba(255,255,255,0.05)',
              } : {},
              standardSuccess: mode === 'dark' ? {
                backgroundColor: 'rgba(102,187,106,0.1)',
                color: '#81c784',
              } : {},
              standardError: mode === 'dark' ? {
                backgroundColor: 'rgba(244,67,54,0.1)',
                color: '#e57373',
              } : {},
              standardWarning: mode === 'dark' ? {
                backgroundColor: 'rgba(255,167,38,0.1)',
                color: '#ffb74d',
              } : {},
              standardInfo: mode === 'dark' ? {
                backgroundColor: 'rgba(41,182,246,0.1)',
                color: '#4fc3f7',
              } : {},
            },
          },
          MuiTextField: {
            styleOverrides: {
              root: mode === 'dark' ? {
                '& .MuiOutlinedInput-root': {
                  '& fieldset': {
                    borderColor: 'rgba(255,255,255,0.15)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(255,255,255,0.3)',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: '#a0a0a0',
                },
              } : {},
            },
          },
          MuiSelect: {
            styleOverrides: {
              root: mode === 'dark' ? {
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(255,255,255,0.15)',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(255,255,255,0.3)',
                },
              } : {},
            },
          },
          MuiDivider: {
            styleOverrides: {
              root: mode === 'dark' ? {
                borderColor: 'rgba(255,255,255,0.06)',
              } : {},
            },
          },
          MuiLinearProgress: {
            styleOverrides: {
              root: mode === 'dark' ? {
                backgroundColor: 'rgba(255,255,255,0.08)',
              } : {},
            },
          },
          MuiSkeleton: {
            styleOverrides: {
              root: mode === 'dark' ? {
                backgroundColor: 'rgba(255,255,255,0.08)',
              } : {},
            },
          },
          MuiAvatar: {
            styleOverrides: {
              root: mode === 'dark' ? {
                backgroundColor: 'rgba(255,255,255,0.1)',
              } : {},
            },
          },
          MuiListItemButton: {
            styleOverrides: {
              root: mode === 'dark' ? {
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.05)',
                },
                '&.Mui-selected': {
                  backgroundColor: 'rgba(144,202,249,0.12)',
                  '&:hover': {
                    backgroundColor: 'rgba(144,202,249,0.18)',
                  },
                },
              } : {},
            },
          },
          MuiMenu: {
            styleOverrides: {
              paper: mode === 'dark' ? {
                backgroundImage: 'none',
                backgroundColor: '#1a1a1a',
                border: '1px solid rgba(255,255,255,0.08)',
              } : {},
            },
          },
          MuiPopover: {
            styleOverrides: {
              paper: mode === 'dark' ? {
                backgroundImage: 'none',
                backgroundColor: '#1a1a1a',
              } : {},
            },
          },
          MuiButton: {
            styleOverrides: {
              outlined: mode === 'dark' ? {
                borderColor: 'rgba(255,255,255,0.2)',
                '&:hover': {
                  borderColor: 'rgba(255,255,255,0.4)',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                },
              } : {},
            },
          },
          MuiFab: {
            styleOverrides: {
              root: mode === 'dark' ? {
                backgroundColor: '#90caf9',
                color: '#0a0a0a',
                '&:hover': {
                  backgroundColor: '#42a5f5',
                },
              } : {},
            },
          },
          MuiTab: {
            styleOverrides: {
              root: mode === 'dark' ? {
                color: '#a0a0a0',
                '&.Mui-selected': {
                  color: '#90caf9',
                },
              } : {},
            },
          },
          MuiTabs: {
            styleOverrides: {
              indicator: mode === 'dark' ? {
                backgroundColor: '#90caf9',
              } : {},
            },
          },
          MuiSwitch: {
            styleOverrides: {
              track: mode === 'dark' ? {
                backgroundColor: 'rgba(255,255,255,0.2)',
              } : {},
            },
          },
          MuiAccordion: {
            styleOverrides: {
              root: mode === 'dark' ? {
                backgroundImage: 'none',
                backgroundColor: '#141414',
                '&:before': {
                  backgroundColor: 'rgba(255,255,255,0.06)',
                },
              } : {},
            },
          },
          MuiTooltip: {
            styleOverrides: {
              tooltip: mode === 'dark' ? {
                backgroundColor: '#2a2a2a',
                border: '1px solid rgba(255,255,255,0.1)',
              } : {},
            },
          },
        },
      }),
    [mode]
  );

  const contextValue = useMemo(() => ({ mode, toggleTheme }), [mode]);

  return (
    <ThemeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}

export default ThemeContext;
