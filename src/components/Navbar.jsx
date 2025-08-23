import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function NavBar() {
  const { user, logout } = useAuth();
  return (
    <nav style={{ display: 'flex', gap: 12, padding: 12, borderBottom: '1px solid #eee' }}>
      <Link to="/">Feed</Link>
      {user && <Link to={`/u/${user.username}`}>Profile</Link>}
      {user && <Link to={`/settings/profile`}>Edit Profile</Link>}
      <div style={{ marginLeft: 'auto' }}>
        {user ? (
          <button onClick={logout}>Logout</button>
        ) : (
          <>
            <Link to="/login">Login</Link>{" / "}
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}
