import { CssBaseline, GlobalStyles } from '@mui/material';
import { createTheme, StyledEngineProvider, ThemeProvider } from '@mui/material/styles';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import './style.css';

const theme = createTheme({
  palette: {
    primary: { main: '#126650' },
    background: { default: '#f2f6f7' },
    text: { primary: '#172941', secondary: '#43556a' },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: 'system-ui, sans-serif',
    button: { textTransform: 'none', fontWeight: 600 },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <StyledEngineProvider enableCssLayer>
      <GlobalStyles styles="@layer theme, base, mui, components, utilities;" />
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </StyledEngineProvider>
  </StrictMode>,
);
