import { Routes, Route } from 'react-router-dom';
import PrivateRoute from './components/PrivateRoute';

import FeedPage from './pages/FeedPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import NavBar from './components/Navbar';
import EditProfilePage from './pages/EditProfilePage';

export default function App() {
  return (
    <>
      <NavBar />
      <div style={{ maxWidth: 640, margin: '16px auto', padding: '0 12px' }}>
        <Routes>
          <Route path="/" element={<FeedPage />} />
          <Route path="/u/:username" element={<ProfilePage />} />
          <Route element={<PrivateRoute />}>
            <Route path="/settings/profile" element={<EditProfilePage />} />
          </Route>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Example protected routes */}
          <Route element={<PrivateRoute />}>
            {/* put /edit-profile or /compose here if you want to protect them */}
          </Route>

          <Route path="*" element={<div>Not found</div>} />
        </Routes>
      </div>
    </>
  );
}
