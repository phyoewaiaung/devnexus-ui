import { useMemo, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toggleLike, addComment, deletePost } from '../api/posts';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

import {
  Heart, MessageSquare, Trash2, MoreHorizontal, Loader2,
  User as UserIcon, Share2, Bookmark, Link as LinkIcon,
} from 'lucide-react';

import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

/* ---------------------- utils ---------------------- */
const k = (n) => {
  if (n == null) return 0;
  if (n < 1000) return n;
  if (n < 10000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  if (n < 1_000_000) return Math.round(n / 1000) + 'k';
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
};

const relativeTime = (ts) => {
  if (!ts) return '';
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const d = new Date(ts).getTime();
  const now = Date.now();
  const diff = Math.floor((d - now) / 1000);
  const units = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['week', 60 * 60 * 24 * 7],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
    ['second', 1],
  ];
  for (const [u, s] of units) {
    const v = Math.round(diff / s);
    if (Math.abs(v) >= 1) return rtf.format(v, u);
  }
  return 'just now';
};

const fullDateTitle = (ts) => {
  try { return new Date(ts).toLocaleString(); } catch { return ''; }
};

/* ---------------------- text render ---------------------- */
function renderRichText(raw) {
  if (!raw) return null;
  const codeRe = /```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0; let m;
  while ((m = codeRe.exec(raw))) {
    const [full, lang, code] = m;
    if (m.index > lastIndex) parts.push({ type: 'text', value: raw.slice(lastIndex, m.index) });
    parts.push({ type: 'code', lang: lang || 'text', value: code });
    lastIndex = m.index + full.length;
  }
  if (lastIndex < raw.length) parts.push({ type: 'text', value: raw.slice(lastIndex) });

  const renderText = (text) => {
    const inlineCodeRe = /`([^`]+)`/g;
    const urlRe = /(https?:\/\/[^\s]+)|(www\.[^\s]+\.[^\s]+)/gi;
    const mentionRe = /(^|\s)@([a-zA-Z0-9_]{2,})/g;
    const tagRe = /(^|\s)#([\p{L}0-9_]{2,})/gu;

    const nodes = []; let idx = 0;
    const pushPlain = (s) => s && nodes.push(s);

    let last = 0; let mm;
    while ((mm = inlineCodeRe.exec(text))) {
      const [full, code] = mm;
      if (mm.index > last) pushPlain(text.slice(last, mm.index));
      nodes.push(<code key={`ic-${idx++}`} className="rounded bg-muted px-1 py-0.5 text-[0.9em] font-mono">{code}</code>);
      last = mm.index + full.length;
    }
    if (last < text.length) pushPlain(text.slice(last));

    const linkified = nodes.flatMap((n) => {
      if (typeof n !== 'string') return [n];
      const chunk = n; const bits = []; let i = 0;
      const re = new RegExp(`${urlRe.source}|${mentionRe.source}|${tagRe.source}`, 'giu');
      let r;
      while ((r = re.exec(chunk))) {
        if (r.index > i) bits.push(chunk.slice(i, r.index));
        const [match] = r;
        if (r[1] || r[2]) {
          const url = match.startsWith('http') ? match : `https://${match}`;
          bits.push(<a key={`u-${idx++}`} href={url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{match}</a>);
        } else if (r[3] || r[4]) {
          const handle = r[4];
          bits.push(<Link key={`m-${idx++}`} to={`/u/${handle}`} className="text-primary hover:underline">@{handle}</Link>);
        } else if (r[5] || r[6]) {
          const tag = r[6];
          bits.push(<Link key={`t-${idx++}`} to={`/?tag=${encodeURIComponent(tag)}`} className="text-primary hover:underline">#{tag}</Link>);
        }
        i = re.lastIndex;
      }
      if (i < chunk.length) bits.push(chunk.slice(i));
      return bits;
    });

    return <p className="whitespace-pre-wrap leading-relaxed text-foreground/90">{linkified}</p>;
  };

  return parts.map((p, i) =>
    p.type === 'code'
      ? (
        <pre key={`cb-${i}`} className="mt-2 overflow-x-auto rounded-lg border border-border bg-muted p-3 text-sm">
          <code className="font-mono whitespace-pre">{p.value}</code>
        </pre>
      )
      : <div key={`tx-${i}`}>{renderText(p.value)}</div>
  );
}

/* ---------------------- component ---------------------- */
export default function PostCard({ post, onDeleted }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  // initialize from server-provided fields (with fallbacks)
  const initialLiked = Boolean(post.likedByMe ?? post.likes?.includes?.(user?._id));
  const initialLikes = post.likesCount ?? post.likes?.length ?? 0;

  const [likes, setLikes] = useState(initialLikes);
  const [liked, setLiked] = useState(initialLiked);
  const [text, setText] = useState('');
  const [comments, setComments] = useState(post.comments || []);
  const [busyLike, setBusyLike] = useState(false);
  const [busySend, setBusySend] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const [err, setErr] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const safeUsername = post.author?.username || 'unknown';
  const safeName = post.author?.name || 'Unknown';
  const avatar = post.author?.avatarUrl;
  const createdAtLabel = useMemo(() => relativeTime(post.createdAt), [post.createdAt]);
  const createdAtTitle = useMemo(() => fullDateTitle(post.createdAt), [post.createdAt]);
  const textareaRef = useRef(null);

  const like = useCallback(async () => {
    if (busyLike) return;
    if (!user) {
      toast('Please log in to like posts');
      navigate('/login');
      return;
    }

    setBusyLike(true);
    setErr('');

    const prev = { liked, likes };
    const nextLiked = !liked;

    // optimistic
    setLiked(nextLiked);
    setLikes((n) => Math.max(0, n + (nextLiked ? 1 : -1)));

    try {
      const r = await toggleLike(post._id);
      // reconcile if API returns authoritative fields
      if (typeof r?.likesCount === 'number') setLikes(r.likesCount);
      if (typeof r?.likedByMe === 'boolean') setLiked(r.likedByMe);
    } catch (e) {
      // rollback
      setLiked(prev.liked);
      setLikes(prev.likes);
      setErr(e.message || 'Failed to like post.');
      toast.error('Failed to like post.');
    } finally {
      setBusyLike(false);
    }
  }, [busyLike, liked, post._id, user, navigate]);

  const onCardKeyDown = (e) => {
    if (e.key.toLowerCase() === 'l') { e.preventDefault(); like(); }
    if (e.key.toLowerCase() === 'c') { e.preventDefault(); textareaRef.current?.focus(); }
  };

  const onComposerKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); }
  };

  const submitComment = async () => {
    if (!text.trim() || busySend) return;
    setBusySend(true);
    setErr('');
    const optimistic = { author: { username: 'you', avatarUrl: null }, text, createdAt: Date.now() };
    setComments((c) => [...c, optimistic]);
    setText('');

    try {
      const r = await addComment(post._id, optimistic.text.trim());
      setComments(r.comments || []);
      toast('Comment added');
    } catch (e) {
      setErr(e.message || 'Failed to add comment.');
      setComments((c) => c.slice(0, -1));
      setText(optimistic.text);
      textareaRef.current?.focus();
      toast.error('Failed to add comment.');
    } finally {
      setBusySend(false);
    }
  };

  const remove = async () => {
    if (busyDelete) return;
    setBusyDelete(true);
    setErr('');
    try {
      await deletePost(post._id);
      onDeleted?.(post._id);
      toast.success('Post deleted');
    } catch (e) {
      setErr(e.message || 'Failed to delete post.');
      toast.error('Delete failed.');
      setBusyDelete(false);
    }
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/p/${post._id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  return (
    <Card
      tabIndex={0}
      onKeyDown={onCardKeyDown}
      className="bg-card text-card-foreground border-border shadow-sm hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      <CardHeader className="p-4 pb-0">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-10 w-10 ring-1 ring-border">
              {avatar ? <AvatarImage src={avatar} /> : null}
              <AvatarFallback>
                <UserIcon className="h-5 w-5 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Link
                  to={`/u/${safeUsername}`}
                  className="font-semibold text-foreground hover:underline truncate"
                  title={`${safeName} @${safeUsername}`}
                >
                  {safeName}
                </Link>
                <span className="text-muted-foreground truncate">@{safeUsername}</span>
                {post.topic && <Badge variant="secondary" className="ml-1">{post.topic}</Badge>}
              </div>
              <div className="text-xs text-muted-foreground" title={createdAtTitle}>{createdAtLabel}</div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Post options">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Post options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={copyLink} className="justify-between">
                <span className="inline-flex items-center"><LinkIcon className="h-4 w-4 mr-2" /> Copy link</span>
              </DropdownMenuItem>
              <DropdownMenuItem disabled><Bookmark className="h-4 w-4 mr-2" /> Save (soon)</DropdownMenuItem>
              <DropdownMenuItem disabled><Share2 className="h-4 w-4 mr-2" /> Share (soon)</DropdownMenuItem>
              {post.canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="w-full text-left text-red-600 flex items-center px-2 py-1.5 rounded-sm hover:bg-red-50 dark:hover:bg-red-500/10">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this post?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={remove} className="bg-red-600 hover:bg-red-700" disabled={busyDelete}>
                          {busyDelete ? (<Loader2 className="h-4 w-4 animate-spin mr-2" />) : null}
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-3" onDoubleClick={like}>
        {post.text && (
          <PostText text={post.text} expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
        )}

        {post.imageUrl && (
          <div className="mt-3 overflow-hidden rounded-lg border border-border">
            <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
              <DialogTrigger asChild>
                <img src={post.imageUrl} alt="Post media" className="w-full h-auto object-cover cursor-zoom-in" loading="lazy" />
              </DialogTrigger>
              <DialogContent className="max-w-4xl p-0">
                <img src={post.imageUrl} alt="Post media large" className="w-full h-auto object-contain" />
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* stats row */}
        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Heart
              className={`h-4 w-4 ${liked ? 'text-red-600' : ''}`}
              fill={liked ? 'currentColor' : 'none'}
              stroke={liked ? 'none' : 'currentColor'}
            />
            <span>{k(likes)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span>{k(comments?.length || 0)} comments</span>
          </div>
        </div>

        {/* actions */}
        <div className="mt-2">
          <div className="flex flex-wrap items-center gap-2 w-full">
            <Button
              variant={liked ? 'default' : 'outline'}
              size="sm"
              onClick={like}
              disabled={busyLike}
              className={`flex-1 min-w-[112px] gap-2 transition-transform active:scale-[0.98] ${liked ? 'bg-red-600 hover:bg-red-700 text-white' : ''}`}
              aria-pressed={liked}
              aria-label={liked ? 'Unlike post' : 'Like post'}
            >
              {busyLike ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Heart
                  className={`h-4 w-4 ${liked ? 'text-white' : ''}`}
                  fill={liked ? 'currentColor' : 'none'}
                  stroke={liked ? 'none' : 'currentColor'}
                />
              )}
              Like
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="flex-1 min-w-[112px] gap-2"
              onClick={() => textareaRef.current?.focus()}
              aria-label="Add a comment"
            >
              <MessageSquare className="h-4 w-4" />
              Comment
            </Button>

            <Button variant="outline" size="sm" className="flex-1 min-w-[112px] gap-2" disabled>
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>
        </div>

        {err && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200" aria-live="polite">
            {err}
          </div>
        )}

        <Separator className="my-4" />

        <form onSubmit={(e) => { e.preventDefault(); submitComment(); }} className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onComposerKeyDown}
            placeholder="Write a comment…"
            className="min-h-[44px] resize-y"
            aria-label="Comment"
          />
          <Button type="submit" disabled={busySend || !text.trim()} className="min-w-[96px]">
            {busySend ? (<span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Send</span>) : 'Send'}
          </Button>
        </form>

        {comments?.length > 0 && (
          <div className="mt-4 space-y-3">
            {comments.map((c, i) => (<CommentItem key={i} c={c} />))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PostText({ text, expanded, onToggle }) {
  const MAX_CHARS = 220;
  const needsClamp = text.length > MAX_CHARS;

  return (
    <div className="text-foreground/90">
      {needsClamp ? (
        <div>
          <div className={`whitespace-pre-wrap ${expanded ? '' : 'line-clamp-4'}`}>{renderRichText(text)}</div>
          <button type="button" onClick={onToggle} className="mt-1 text-sm font-medium text-primary hover:opacity-80">
            {expanded ? 'See less' : 'See more'}
          </button>
        </div>
      ) : (
        <div className="whitespace-pre-wrap">{renderRichText(text)}</div>
      )}
    </div>
  );
}

function CommentItem({ c }) {
  return (
    <div className="flex items-start gap-3">
      <Avatar className="h-8 w-8">
        {c.author?.avatarUrl ? <AvatarImage src={c.author.avatarUrl} /> : null}
        <AvatarFallback><UserIcon className="h-4 w-4 text-muted-foreground" /></AvatarFallback>
      </Avatar>
      <div className="flex-1 rounded-2xl bg-muted/40 border border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Link to={`/u/${c.author?.username || 'user'}`} className="font-medium text-sm text-foreground hover:underline">
            @{c.author?.username || 'user'}
          </Link>
          {c.createdAt && (
            <span className="text-xs text-muted-foreground" title={fullDateTitle(c.createdAt)}>
              {relativeTime(c.createdAt)}
            </span>
          )}
        </div>
        <div className="mt-1 text-sm text-foreground/90 whitespace-pre-wrap">{c.text}</div>
      </div>
    </div>
  );
}
