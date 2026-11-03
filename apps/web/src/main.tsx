import React from 'react';
import ReactDOM from 'react-dom/client';
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-600.css';
import '@fontsource/source-sans-3/latin-700.css';
import '@fontsource/lora/latin-400.css';
import '@fontsource/lora/latin-500.css';
import '@fontsource/lora/latin-600.css';
import '@fontsource/lora/latin-700.css';
import App from './App';
import './styles.css';

const theme = createTheme({
  palette: {
    primary: { main: '#244d43' },
    background: { default: '#f7f8f5', paper: '#ffffff' },
    text: { primary: '#263a32', secondary: '#7c857f' },
  },
  typography: {
    fontFamily: '"DM Sans", sans-serif',
    button: { textTransform: 'none', fontWeight: 600, fontSize: 13 },
  },
  shape: { borderRadius: 9 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 8, minHeight: 39, padding: '8px 15px' } },
    },
    MuiTextField: { defaultProps: { size: 'small', fullWidth: true, variant: 'outlined' } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { fontSize: 13, background: '#fff', borderRadius: 8 },
        notchedOutline: { borderColor: '#dfe4de' },
        input: { padding: '11px 13px' },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { fontSize: 13 } } },
    MuiTooltip: {
      defaultProps: { describeChild: true },
      styleOverrides: { tooltip: { fontSize: 12 } },
    },
  },
});
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
