// src/pages/EditProfilePage.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMe, updateMe, uploadAvatar } from '../api/users';

export default function EditProfilePage() {
  const [form, setForm] = useState({
    name: '',
    bio: '',
    skills: '', // comma separated
    website: '',
    github: '',
    twitter: '',
    linkedin: '',
  });
  const [avatarPreview, setAvatarPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const nav = useNavigate();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { user } = await getMe();
        if (!alive) return;
        setForm({
          name: user.name || '',
          bio: user.bio || '',
          skills: Array.isArray(user.skills) ? user.skills.join(', ') : (user.skills || ''),
          website: user.socialLinks?.website || '',
          github: user.socialLinks?.github || '',
          twitter: user.socialLinks?.twitter || '',
          linkedin: user.socialLinks?.linkedin || '',
        });
        setAvatarPreview(user.avatarUrl || '');
      } catch (e) {
        if (!alive) return;
        setErr(e.message || 'Failed to load profile');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const onChange = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // quick local preview
      const localURL = URL.createObjectURL(file);
      setAvatarPreview(localURL);
      // upload to backend (returns { avatarUrl })
      const { avatarUrl } = await uploadAvatar(file);
      setAvatarPreview(avatarUrl);
    } catch (error) {
      setErr(error.message || 'Avatar upload failed');
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setSaving(true);
    try {
      await updateMe({
        name: form.name,
        bio: form.bio,
        skills: form.skills, // backend will split strings by comma
        socialLinks: {
          website: form.website,
          github: form.github,
          twitter: form.twitter,
          linkedin: form.linkedin,
        },
      });
      nav(-1); // go back
    } catch (error) {
      setErr(error.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
      <h2>Edit profile</h2>

      {/* Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            overflow: 'hidden',
            background: '#f3f3f3',
            flex: '0 0 auto',
          }}
        >
          {avatarPreview ? (
            <img
              src={avatarPreview}
              alt="avatar"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'grid',
                placeItems: 'center',
                color: '#999',
                fontSize: 12,
              }}
            >
              no avatar
            </div>
          )}
        </div>
        <label style={{ display: 'inline-block' }}>
          <input type="file" accept="image/*" onChange={onAvatarChange} />
        </label>
      </div>

      {/* Basics */}
      <input
        placeholder="name"
        value={form.name}
        onChange={onChange('name')}
      />

      <textarea
        rows={3}
        placeholder="bio"
        value={form.bio}
        onChange={onChange('bio')}
      />

      {/* Skills */}
      <input
        placeholder="skills (comma separated)"
        value={form.skills}
        onChange={onChange('skills')}
      />

      {/* Social links */}
      <fieldset style={{ border: '1px solid #eee', padding: 8, borderRadius: 8 }}>
        <legend>Social Links</legend>
        <input
          placeholder="website"
          value={form.website}
          onChange={onChange('website')}
          style={{ display: 'block', width: '100%', marginBottom: 8 }}
        />
        <input
          placeholder="github"
          value={form.github}
          onChange={onChange('github')}
          style={{ display: 'block', width: '100%', marginBottom: 8 }}
        />
        <input
          placeholder="twitter"
          value={form.twitter}
          onChange={onChange('twitter')}
          style={{ display: 'block', width: '100%', marginBottom: 8 }}
        />
        <input
          placeholder="linkedin"
          value={form.linkedin}
          onChange={onChange('linkedin')}
          style={{ display: 'block', width: '100%' }}
        />
      </fieldset>

      {err && <div style={{ color: 'red' }}>{err}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={() => nav(-1)} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}
