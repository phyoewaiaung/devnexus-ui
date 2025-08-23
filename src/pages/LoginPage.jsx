import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [usernameOrEmail, setU] = useState('');
  const [password, setP] = useState('');
  const [err, setErr] = useState('');
  const nav = useNavigate();
  const { login } = useAuth();

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      await login(usernameOrEmail, password);
      nav('/');
    } catch (e) {
      setErr(e.message || 'Login failed');
    }
  };

  return (
    <form onSubmit={onSubmit} style={{ display:'grid', gap:10 }}>
      <h2>Login</h2>
      <input placeholder="username or email" value={usernameOrEmail} onChange={e=>setU(e.target.value)} />
      <input type="password" placeholder="password" value={password} onChange={e=>setP(e.target.value)} />
      {err && <div style={{ color:'red' }}>{err}</div>}
      <button>Login</button>
    </form>
  );
}
