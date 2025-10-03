import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// CORRECCIÓN: Usamos llaves {} porque no es una exportación por defecto
import { AuthProvider } from '../context/AuthContext'; 
import ProtectedRoute from '../components/ProtectedRoute';

import Layout from '../components/Layout';
import LoginPage from '../pages/LoginPage';
import NoAutorizado from '../pages/NoAutorizado';

import MarketplacePage from '../pages/MarketplacePage';
import BusinessesPage from '../pages/BusinessesPage';
import ProductsPage from '../pages/ProductsPage';
import CreateProductPage from '../pages/CreateProductPage';
import EditProductPage from '../pages/EditProductPage';
import OrdersPage from '../pages/OrdersPage';
import OrderDetailPage from '../pages/OrderDetailPage';

export default function AppRouter() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Público */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/no-autorizado" element={<NoAutorizado />} />

          {/* Protegido */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<OrdersPage />} />
              <Route path="/ordenes" element={<OrdersPage />} />
              <Route path="/orders/:id" element={<OrderDetailPage />} />
              <Route path="/marketplace" element={<MarketplacePage />} />
              <Route path="/negocios" element={<BusinessesPage />} />
              <Route path="/negocios/:uuidEmpresa/productos" element={<ProductsPage />} />
              <Route path="/negocios/:uuidEmpresa/productos/nuevo" element={<CreateProductPage />} />
              <Route path="/negocios/:uuidEmpresa/productos/:productId/editar" element={<EditProductPage />} />
            </Route>
          </Route>

          <Route path="*" element={<LoginPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}