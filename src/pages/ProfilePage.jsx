// src/pages/ProfilePage.jsx
import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getPublicProfile, followUser, unfollowUser } from '../api/users';
import { getPostsByUser } from '../api/posts';
import PostCard from '../components/PostCard';

export default function ProfilePage() {
  const { username } = useParams();
  const { user: me } = useAuth();

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [error, setError] = useState('');

  const isMe = useMemo(() => !!me && me.username === username, [me, username]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setError('');
      setLoadingProfile(true);
      setLoadingPosts(true);
      try {
        const [{ user }, postsResp] = await Promise.all([
          getPublicProfile(username),
          getPostsByUser(username),
        ]);

        if (!alive) return;

        setProfile(user || null);
        // mark deletable if current user authored it
        const mapped = (postsResp.posts || []).map((p) => ({
          ...p,
          canDelete: me && p.author?._id === me._id,
        }));
        setPosts(mapped);
      } catch (e) {
        if (!alive) return;
        setError(e.message || 'Failed to load profile.');
      } finally {
        if (!alive) return;
        setLoadingProfile(false);
        setLoadingPosts(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [username, me]);

  const onFollow = async () => {
    try {
      await followUser(username);
      setProfile((prev) =>
        prev ? { ...prev, followersCount: (prev.followersCount || 0) + 1 } : prev
      );
    } catch (e) {
      alert(e.message || 'Failed to follow');
    }
  };

  const onUnfollow = async () => {
    try {
      await unfollowUser(username);
      setProfile((prev) =>
        prev
          ? { ...prev, followersCount: Math.max((prev.followersCount || 1) - 1, 0) }
          : prev
      );
    } catch (e) {
      alert(e.message || 'Failed to unfollow');
    }
  };

  if (loadingProfile) return null;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;
  if (!profile) return <div>Profile not found.</div>;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Header card */}
      <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={`${profile.username} avatar`}
              style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: '#f3f3f3',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 700,
              }}
            >
              {profile.name?.[0]?.toUpperCase() || profile.username?.[0]?.toUpperCase() || '?'}
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0 }}>{profile.name}</h2>
              <span style={{ color: '#666' }}>@{profile.username}</span>
            </div>
            <div style={{ fontSize: 12, color: '#777', marginTop: 4 }}>
              roles: {(profile.roles || []).join(', ') || 'user'}
            </div>
          </div>

          {/* Actions */}
          {isMe ? (
            <Link to="/settings/profile">
              <button>Edit Profile</button>
            </Link>
          ) : me ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onFollow}>Follow</button>
              <button onClick={onUnfollow}>Unfollow</button>
            </div>
          ) : null}
        </div>

        {/* Bio */}
        {profile.bio && <p style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{profile.bio}</p>}

        {/* Skills */}
        {Array.isArray(profile.skills) && profile.skills.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {profile.skills.map((s, i) => (
              <span
                key={i}
                style={{
                  padding: '2px 8px',
                  border: '1px solid #ddd',
                  borderRadius: 999,
                  fontSize: 12,
                }}
              >
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Social Links */}
        {profile.socialLinks &&
          (profile.socialLinks.website ||
            profile.socialLinks.github ||
            profile.socialLinks.twitter ||
            profile.socialLinks.linkedin) && (
            <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
              {profile.socialLinks.website && (
                <a href={profile.socialLinks.website} target="_blank" rel="noreferrer">
                  website
                </a>
              )}
              {profile.socialLinks.github && (
                <a href={profile.socialLinks.github} target="_blank" rel="noreferrer">
                  github
                </a>
              )}
              {profile.socialLinks.twitter && (
                <a href={profile.socialLinks.twitter} target="_blank" rel="noreferrer">
                  twitter
                </a>
              )}
              {profile.socialLinks.linkedin && (
                <a href={profile.socialLinks.linkedin} target="_blank" rel="noreferrer">
                  linkedin
                </a>
              )}
            </div>
          )}

        {/* Follower counts */}
        <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
          <span>Followers: {profile.followersCount || 0}</span>
          <span>Following: {profile.followingCount || 0}</span>
        </div>
      </div>

      {/* Posts */}
      <div style={{ display: 'grid', gap: 12 }}>
        {loadingPosts ? null : posts.length === 0 ? (
          <div style={{ color: '#666' }}>No posts yet.</div>
        ) : (
          posts.map((p) => (
            <PostCard
              key={p._id}
              post={p}
              onDeleted={(id) => setPosts((prev) => prev.filter((x) => x._id !== id))}
            />
          ))
        )}
      </div>
    </div>
  );
}
