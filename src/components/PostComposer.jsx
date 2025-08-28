import { useRef, useState, useCallback } from 'react';
import { createPost } from '../api/posts';
import { useAuth } from '../context/AuthContext';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

import { Image as ImageIcon, Loader2, SmilePlus, X } from 'lucide-react';

const MAX_LEN = 1000;

export default function PostComposer({ onCreated }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const fileRef = useRef(null);

  const remaining = MAX_LEN - text.length;
  const progress = Math.min(100, Math.round((text.length / MAX_LEN) * 100));

  const pick = () => fileRef.current?.click();

  const acceptFile = useCallback((f) => {
    if (!f) return;
    if (!f.type?.startsWith('image/')) {
      toast({ variant: 'destructive', description: 'Please select an image file.' });
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', description: 'Image must be less than 5MB.' });
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }, []);

  const onFileChange = (e) => acceptFile(e.target.files?.[0]);

  const onPaste = (e) => {
    const item = [...(e.clipboardData?.items || [])].find((it) => it.kind === 'file' && it.type.startsWith('image/'));
    if (item) acceptFile(item.getAsFile());
  };

  const onDrop = (e) => {
    e.preventDefault();
    acceptFile(e.dataTransfer?.files?.[0]);
  };

  async function submit(e) {
    e.preventDefault();
    if (!text.trim() && !file) return;
    if (busy) return;

    setBusy(true);
    try {
      // If your API supports images, swap for FormData and send file too
      const { post } = await createPost(text.trim());
      setText('');
      setFile(null);
      setPreview('');
      onCreated?.(post);
      toast({ description: 'Post published.' });
    } catch (err) {
      toast({ variant: 'destructive', description: err?.message || 'Failed to post.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4 bg-card text-card-foreground border-border">
      <form onSubmit={submit} className="space-y-3" onPaste={onPaste} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10 ring-1 ring-border">
            <AvatarImage src={user?.avatarUrl || user?.avatar} />
            <AvatarFallback>{user?.name?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
              placeholder="Share something with DevNexus…"
              className="min-h-[64px] resize-y border-none focus-visible:ring-0 bg-transparent"
              aria-label="Post text"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(e);
              }}
            />

            {preview && (
              <div className="mt-3 relative rounded-lg overflow-hidden border border-border">
                <img src={preview} alt="preview" className="w-full h-auto object-cover" />
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute top-2 right-2 h-8 w-8 rounded-full"
                  onClick={() => { setPreview(''); setFile(null); if (fileRef.current) fileRef.current.value = ''; }}
                  aria-label="Remove image"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <Separator className="my-3" />

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                <Button type="button" variant="ghost" size="sm" onClick={pick} className="gap-2">
                  <ImageIcon className="h-4 w-4" /> Photo
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled className="gap-2">
                  <SmilePlus className="h-4 w-4" /> Emoji
                </Button>
              </div>

              <div className="flex items-center gap-3">
                <Badge variant={remaining < 50 ? 'destructive' : 'secondary'}>{remaining}</Badge>
                <div className="h-2 w-24 rounded bg-muted">
                  <div className={`h-2 rounded ${progress > 90 ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${progress}%` }} />
                </div>
                <Button type="submit" disabled={busy || (!text.trim() && !file)} className="min-w-[90px]">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Post'}
                </Button>
              </div>
            </div>

            <p className="mt-2 text-xs text-muted-foreground">Tip: paste or drag an image here. Press ⌘/Ctrl + Enter to post.</p>
          </div>
        </div>
      </form>
    </Card>
  );
}
