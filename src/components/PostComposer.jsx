import { useState } from 'react';
import { createPost } from '../api/posts';

export default function PostComposer({ onCreated }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const { post } = await createPost(text.trim());
      setText('');
      onCreated?.(post);
    } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 8, border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
      <textarea rows={3} placeholder="Share something..." value={text} onChange={e => setText(e.target.value)} />
      <button disabled={busy}>Post</button>
    </form>
  );
}
