import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import AuthProvider from '../context/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';

import Layout from '../components/Layout';
import LoginPage from '../pages/LoginPage';
import NoAutorizado from '../pages/NoAutorizado';

// Tus páginas
import MarketplacePage from '../pages/MarketplacePage';
import BusinessesPage from '../pages/BusinessesPage';
import ProductsPage from '../pages/ProductsPage';
import CreateProductPage from '../pages/CreateProductPage';
import EditProductPage from '../pages/EditProductPage';
import OrdersPage from '../pages/OrdersPage'; // Importamos la página de Órdenes

export default function AppRouter() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Público */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/no-autorizado" element={<NoAutorizado />} />

          {/* Todo lo demás exige estar logueado */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              {/* --- RUTA AÑADIDA Y ESTABLECIDA COMO PRINCIPAL --- */}
              <Route path="/" element={<OrdersPage />} />
              <Route path="/ordenes" element={<OrdersPage />} />

              <Route path="/marketplace" element={<MarketplacePage />} />
              <Route path="/negocios" element={<BusinessesPage />} />

              {/* Productos */}
              <Route path="/negocios/:uuidEmpresa/productos" element={<ProductsPage />} />
              <Route path="/negocios/:uuidEmpresa/productos/nuevo" element={<CreateProductPage />} />
              <Route path="/negocios/:uuidEmpresa/productos/:productId/editar" element={<EditProductPage />} />
            </Route>
          </Route>

          {/* Fallback: si no matchea, mándalo al login */}
          <Route path="*" element={<LoginPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}