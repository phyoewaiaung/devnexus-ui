import { useEffect, useState } from 'react';
import { getFeed } from '../api/posts';
import PostComposer from '../components/PostComposer';
import PostCard from '../components/PostCard';
import { useAuth } from '../context/AuthContext';

export default function FeedPage() {
  const [posts, setPosts] = useState([]);
  const [page] = useState(1);
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      const { posts } = await getFeed(page, 10);
      setPosts(posts.map(p => ({
        ...p,
        canDelete: user && p.author?._id === user._id
      })));
    })();
  }, [page, user]);

  return (
    <div className="feed" style={{ display: 'grid', gap: 12 }}>
      {user && <PostComposer onCreated={(p) => setPosts([{
        ...p, author: { name: user.name, username: user.username }, canDelete: true
      }, ...posts])} />}
      {posts.map(p => (
        <PostCard key={p._id} post={p} onDeleted={(id) => setPosts(posts.filter(x => x._id !== id))} />
      ))}
    </div>
  );
}
