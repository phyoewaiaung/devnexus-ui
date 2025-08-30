// src/components/PrivateRoute.jsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function PrivateRoute() {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) return null;

  return user
    ? <Outlet />
    : <Navigate to="/login" replace state={{ from: location }} />;
}
