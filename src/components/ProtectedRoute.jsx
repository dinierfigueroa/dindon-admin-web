import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Ruta protegida: espera a que cargue el estado de auth antes de decidir
export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) return null; // o un spinner si prefieres

  return user ? <Outlet /> : <Navigate to="/login" replace />;
}