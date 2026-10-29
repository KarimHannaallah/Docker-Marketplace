import { Route, Routes } from 'react-router-dom';
import { AdminRoute, ProtectedRoute } from './auth/RouteGuards';
import { Layout } from './components/Layout';
import { Admin } from './pages/Admin';
import { Cart } from './pages/Cart';
import { Catalog } from './pages/Catalog';
import { Checkout } from './pages/Checkout';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { NotFound } from './pages/NotFound';
import { OrderDetail } from './pages/OrderDetail';
import { Orders } from './pages/Orders';
import { ProductDetail } from './pages/ProductDetail';
import { Profile } from './pages/Profile';
import { Register } from './pages/Register';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Pages publiques */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Pages réservées aux utilisateurs connectés (sinon redirection vers /login) */}
        <Route element={<ProtectedRoute />}>
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/catalog/:id" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/profile" element={<Profile />} />

          {/* Réservé aux ADMIN (sinon redirection vers /) */}
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<Admin />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
