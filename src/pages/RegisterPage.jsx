import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: '', username: '', email: '', password: '',
    bio: '', avatarUrl: '',
    skills: '', // comma separated
    website: '', github: '', twitter: '', linkedin: ''
  });
  const [err, setErr] = useState('');
  const nav = useNavigate();
  const { register } = useAuth();

  const onChange = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      await register({
        name: form.name,
        username: form.username,
        email: form.email,
        password: form.password,
        bio: form.bio,
        avatarUrl: form.avatarUrl,
        skills: form.skills, // backend will split
        socialLinks: {
          website: form.website,
          github: form.github,
          twitter: form.twitter,
          linkedin: form.linkedin
        }
      });
      alert('Registered! Now log in.');
      nav('/login');
    } catch (e) {
      setErr(e.message || 'Register failed');
    }
  };

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10 }}>
      <h2>Create account</h2>

      <input placeholder="name" value={form.name} onChange={onChange('name')} />
      <input placeholder="username" value={form.username} onChange={onChange('username')} />
      <input placeholder="email" value={form.email} onChange={onChange('email')} />
      <input type="password" placeholder="password" value={form.password} onChange={onChange('password')} />

      <textarea rows={3} placeholder="bio" value={form.bio} onChange={onChange('bio')} />
      <input placeholder="avatar URL" value={form.avatarUrl} onChange={onChange('avatarUrl')} />
      <input placeholder="skills (comma separated)" value={form.skills} onChange={onChange('skills')} />

      <fieldset style={{ border: '1px solid #eee', padding: 8 }}>
        <legend>Social Links (optional)</legend>
        <input placeholder="website" value={form.website} onChange={onChange('website')} />
        <input placeholder="github" value={form.github} onChange={onChange('github')} />
        <input placeholder="twitter" value={form.twitter} onChange={onChange('twitter')} />
        <input placeholder="linkedin" value={form.linkedin} onChange={onChange('linkedin')} />
      </fieldset>

      {err && <div style={{ color: 'red' }}>{err}</div>}
      <button>Create account</button>
    </form>
  );
}
