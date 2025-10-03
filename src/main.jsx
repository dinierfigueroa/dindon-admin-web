import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
// --- ¡NUEVO! Imports para el tema de MUI ---
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// --- ¡NUEVO! Creamos nuestro tema personalizado ---
const theme = createTheme({
  palette: {
    primary: {
      main: '#2196f3', // Tu color principal
    },
    // Opcional: puedes definir más colores si quieres
    // secondary: {
    //   main: '#f50057',
    // },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* --- ¡NUEVO! Envolvemos la App en el ThemeProvider --- */}
    <ThemeProvider theme={theme}>
      <CssBaseline /> {/* Normaliza los estilos CSS para consistencia */}
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)