import { toggleLike, addComment, deletePost } from '../api/posts';
import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function PostCard({ post, onDeleted }) {
  const [likes, setLikes] = useState(post.likesCount);
  const [text, setText] = useState('');
  const [comments, setComments] = useState(post.comments || []);

  const like = async () => {
    const r = await toggleLike(post._id);
    setLikes(r.likesCount);
  };

  const comment = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const r = await addComment(post._id, text.trim());
    setComments(r.comments);
    setText('');
  };

  const remove = async () => {
    if (!confirm('Delete this post?')) return;
    await deletePost(post._id);
    onDeleted?.(post._id);
  };

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <Link to={`/u/${post.author?.username || 'unknown'}`}>
            <strong>{post.author?.name}</strong> @{post.author?.username}
          </Link>
        </div>
        {post.canDelete && <button onClick={remove}>Delete</button>}
      </div>
      <p style={{ whiteSpace: 'pre-wrap' }}>{post.text}</p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={like}>Like ({likes})</button>
      </div>
      <form onSubmit={comment} style={{ marginTop: 8, display: 'flex', gap: 6 }}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Add a comment..." style={{ flex: 1 }} />
        <button>Send</button>
      </form>
      {comments?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {comments.map((c, i) => (
            <div key={i} style={{ fontSize: 14, padding: '6px 0', borderTop: '1px solid #f0f0f0' }}>
              <strong>@{c.author?.username || 'user'}</strong>: {c.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
