import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Contexto Auth
import { AuthProvider } from '../context/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';

// Layout principal (sidebar, etc.)
import Layout from '../components/Layout';

// Páginas públicas
import LoginPage from '../pages/LoginPage';
import NoAutorizado from '../pages/NoAutorizado';

// Páginas del admin
import OrdersPage from '../pages/OrdersPage';
import OrderDetailPage from '../pages/OrderDetailPage';
import MarketplacePage from '../pages/MarketplacePage';
import BusinessesPage from '../pages/BusinessesPage';
import ProductsPage from '../pages/ProductsPage';
import CreateProductPage from '../pages/CreateProductPage';
import EditProductPage from '../pages/EditProductPage';

export default function AppRouter() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Públicas */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/no-autorizado" element={<NoAutorizado />} />

          {/* Protegidas */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              {/* Órdenes */}
              <Route path="/ordenes" element={<OrdersPage />} />
              <Route path="/ordenes/:id" element={<OrderDetailPage />} />

              {/* Otras secciones */}
              <Route path="/marketplace" element={<MarketplacePage />} />
              <Route path="/negocios" element={<BusinessesPage />} />
              <Route path="/negocios/:uuidEmpresa/productos" element={<ProductsPage />} />
              <Route path="/productos/nuevo" element={<CreateProductPage />} />
              <Route path="/productos/:productId/editar" element={<EditProductPage />} />

              {/* Ruta por defecto del dashboard */}
              <Route path="*" element={<OrdersPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}