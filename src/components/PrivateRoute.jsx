import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PrivateRoute() {
  const { user, ready } = useAuth();
  if (!ready) return null; // or a small loader
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
