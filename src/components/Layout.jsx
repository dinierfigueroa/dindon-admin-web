// src/components/Layout.jsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box, CssBaseline } from '@mui/material';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <CssBaseline />
      {/* El Sidebar ocupa su propio ancho; NO agregamos margin-left al main */}
      <Sidebar />

      <Box
        component="main"
        sx={{
          flex: 1,           // que el contenido use todo el espacio restante
          p: 3,
          bgcolor: '#f4f6f8'
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}