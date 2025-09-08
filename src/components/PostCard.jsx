import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import copy from 'copy-to-clipboard';
import { toast } from 'sonner';

import { useAuth } from '@/context/AuthContext';
import { toggleLike, addComment, deletePost } from '../api/posts';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

import {
  Heart, MessageSquare, Trash2, MoreHorizontal, Loader2, User as UserIcon,
  Share2, Link as LinkIcon, CornerDownRight, PencilLine
} from 'lucide-react';

// ✅ new reusable renderer
import RichPostBody from '@/components/RichPostBody';

/* ---------------------- utils ---------------------- */
const k = (n) => { if (n == null) return 0; if (n < 1000) return n; if (n < 10000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'; if (n < 1_000_000) return Math.round(n / 1000) + 'k'; return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'; };
const relativeTime = (ts) => { if (!ts) return ''; const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }); const d = new Date(ts).getTime(); const now = Date.now(); const diff = Math.floor((d - now) / 1000); const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]]; for (const [u, s] of units) { const v = Math.round(diff / s); if (Math.abs(v) >= 1) return rtf.format(v, u); } return 'just now'; };
const fullDateTitle = (ts) => { try { return new Date(ts || 0).toLocaleString(); } catch { return ''; } };

/* ---------------------- Threaded comments ---------------------- */
function CommentItem({ comment, level = 0, onReply }) {
  const [showReply, setShowReply] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    if (!text.trim() || busy) return;
    try {
      setBusy(true);
      const value = text;
      setText('');
      await onReply(value, comment._id);
      setShowReply(false);
    } catch (e) {
      toast.error(e?.message || 'Failed to reply');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex items-start gap-3">
      <Avatar className="h-8 w-8">
        {comment.author?.avatarUrl ? <AvatarImage src={comment.author.avatarUrl} /> : null}
        <AvatarFallback><UserIcon className="h-4 w-4 text-muted-foreground" /></AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="rounded-2xl bg-muted/40 border border-border px-3 py-2">
          <div className="flex items-center gap-2">
            <Link to={`/u/${comment.author?.username || 'user'}`} className="font-medium text-sm hover:underline">@{comment.author?.username || 'user'}</Link>
            {comment.createdAt && (
              <span className="text-xs text-muted-foreground" title={fullDateTitle(comment.createdAt)}>{relativeTime(comment.createdAt)}</span>
            )}
          </div>
          <div className="mt-1 text-sm whitespace-pre-wrap break-words">{comment.text}</div>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <button type="button" className="hover:underline">Like</button>
            <button type="button" className="hover:underline inline-flex items-center gap-1" onClick={() => setShowReply(v => !v)}>
              <CornerDownRight className="h-3.5 w-3.5" /> Reply
            </button>
          </div>
        </div>

        {showReply && (
          <form onSubmit={submit} className="mt-2 ml-6 flex items-end gap-2">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a reply…" className="min-h-[40px] resize-y" aria-label="Reply"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(e); } }} />
            <Button type="submit" size="sm" disabled={busy || !text.trim()} className="min-w-[84px]">
              {busy ? (<span className="inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Send</span>) : 'Send'}
            </Button>
          </form>
        )}

        {/* children */}
        {Array.isArray(comment.replies) && comment.replies.length > 0 && (
          <ul className="mt-3 ml-6 space-y-3">
            {comment.replies.map((child) => (
              <CommentItem key={child._id} comment={child} level={level + 1} onReply={onReply} />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

function buildThread(flat = []) {
  // Build a nested tree from flat comments [{_id, parentId, ...}]
  const byId = new Map();
  flat.forEach((c) => byId.set(c._id, { ...c, replies: [] }));
  const roots = [];
  flat.forEach((c) => {
    const node = byId.get(c._id);
    if (c.parentId && byId.has(c.parentId)) {
      byId.get(c.parentId).replies.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function CommentThread({ comments, onAdd, focusRef }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    const value = text;
    setText('');
    try {
      await onAdd(value, null);
    } catch (e) {
      toast.error(e?.message || 'Failed to comment');
      setText(value);
    } finally {
      setBusy(false);
    }
  };

  const tree = useMemo(() => buildThread(comments || []), [comments]);

  return (
    <div className="mt-3">
      <form onSubmit={submit} className="flex items-end gap-2">
        <Textarea ref={focusRef} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a comment…" className="min-h-[44px] resize-y" aria-label="Comment"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} />
        <Button type="submit" disabled={busy || !text.trim()} className="min-w-[96px]">
          {busy ? (<span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Send</span>) : 'Send'}
        </Button>
      </form>

      {tree.length > 0 && (
        <ul className="mt-4 space-y-3">
          {tree.map((c) => (
            <CommentItem key={c._id} comment={c} onReply={(text, parentId) => onAdd(text, parentId)} />
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------------- PostCard ---------------------- */
export default function PostCard({ post, onDeleted, postDetailStatus = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  // likes (controlled from prop but synced internal)
  const initialLikes = post.likesCount ?? (Array.isArray(post.likes) ? post.likes.length : 0) ?? 0;
  const initialLiked = Boolean(post.likedByMe ?? (Array.isArray(post.likes) && user?._id ? post.likes.includes(user._id) : false));

  const [likes, setLikes] = useState(initialLikes);
  const [liked, setLiked] = useState(initialLiked);
  const [err, setErr] = useState('');
  const [busyLike, setBusyLike] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);

  const [expanded, setExpanded] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [comments, setComments] = useState(post.comments || []);

  const commentInputRef = useRef(null);
  const cardRef = useRef(null);

  // Sync if parent updates the post reference
  useEffect(() => {
    setLikes(post.likesCount ?? (Array.isArray(post.likes) ? post.likes.length : 0) ?? 0);
    setLiked(Boolean(post.likedByMe ?? (Array.isArray(post.likes) && user?._id ? post.likes.includes(user._id) : false)));
    setComments(post.comments || []);
  }, [post, user?._id]);

  const safeUsername = post.author?.username || 'unknown';
  const safeName = post.author?.name || 'Unknown';
  const avatar = post.author?.avatarUrl;

  const createdAtLabel = useMemo(() => relativeTime(post.createdAt), [post.createdAt]);
  const createdAtTitle = useMemo(() => fullDateTitle(post.createdAt), [post.createdAt]);

  const imageUrl = post.image?.url || post.imageUrl || null;
  const langBadges = useMemo(() => Array.isArray(post.languages) ? post.languages : [], [post.languages]);
  const tagBadges = useMemo(() => Array.isArray(post.tags) ? post.tags : [], [post.tags]);

  const like = useCallback(async () => {
    if (busyLike) return;
    if (!user) { toast('Please log in to like posts'); navigate('/login'); return; }
    setBusyLike(true); setErr('');
    const prev = { liked, likes };
    const nextLiked = !liked;
    setLiked(nextLiked); setLikes(n => Math.max(0, n + (nextLiked ? 1 : -1)));
    try {
      const r = await toggleLike(post._id);
      if (typeof r?.likesCount === 'number') setLikes(r.likesCount);
      if (typeof r?.liked === 'boolean') setLiked(r.liked);
      if (typeof r?.likedByMe === 'boolean') setLiked(r.likedByMe);
    } catch (e) {
      setLiked(prev.liked); setLikes(prev.likes);
      setErr(e.message || 'Failed to like post.'); toast.error('Failed to like post.');
    } finally { setBusyLike(false); }
  }, [busyLike, liked, post._id, user, navigate]);

  const postDetail = useCallback(() => {
    navigate(`/p/${post._id}`);
  }, [navigate, post._id]);

  const copyLink = () => {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const url = `${origin}/p/${post._id}`;
      copy(url);
      toast.success('Link copied');
    } catch { toast.error('Failed to copy link'); }
  };

  const add = async (text, parentId = null) => {
    const optimistic = {
      _id: `tmp-${Date.now()}`,
      parentId: parentId || undefined,
      author: { username: user?.username || 'you', avatarUrl: user?.avatarUrl },
      text,
      createdAt: Date.now(),
    };
    setComments((c) => [...c, optimistic]);
    try {
      const r = await addComment(post._id, text.trim(), parentId || undefined);
      // Expect API to return the whole updated flat list
      setComments(Array.isArray(r?.comments) ? r.comments : (prev) => prev);
    } catch (e) {
      toast.error(e?.message || 'Failed to add comment');
      setComments((cs) => cs.filter((x) => x._id !== optimistic._id));
      throw e;
    }
  };

  const remove = async () => {
    if (busyDelete) return;
    setBusyDelete(true); setErr('');
    try { await deletePost(post._id); onDeleted?.(post._id); toast.success('Post deleted'); }
    catch (e) { setErr(e.message || 'Failed to delete post.'); toast.error('Delete failed.'); setBusyDelete(false); }
  };

  const onCardKeyDown = (e) => {
    const k = e.key.toLowerCase();
    if (k === 'l') { e.preventDefault(); like(); }
    if (k === 'c') { e.preventDefault(); commentInputRef.current?.focus(); }
  };

  const focusComment = () => {
    commentInputRef.current?.focus();
    // try to scroll into view nicely
    commentInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const commentsCount = (post.commentsCount ?? comments?.length) || 0;

  return (
    <Card ref={cardRef} tabIndex={0} onKeyDown={onCardKeyDown} className="bg-card text-card-foreground border-border shadow-sm hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-primary/40">
      <TooltipProvider>
        <CardHeader className="p-4 pb-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-10 w-10 ring-1 ring-border">
                {avatar ? <AvatarImage src={avatar} /> : null}
                <AvatarFallback><UserIcon className="h-5 w-5 text-muted-foreground" /></AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link to={`/u/${safeUsername}`} className="font-semibold hover:underline truncate" title={`${safeName} @${safeUsername}`}>{safeName}</Link>
                  <span className="text-muted-foreground truncate">@{safeUsername}</span>

                  {/* languages and tags */}
                  {langBadges.map((l) => (
                    <Badge key={`lang-${l}`} variant="secondary" className="ml-1">{l}</Badge>
                  ))}
                  {tagBadges.map((t) => (
                    <Badge key={`tag-${t}`} className="ml-1">#{t}</Badge>
                  ))}
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
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Post options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={copyLink}><LinkIcon className="h-4 w-4 mr-2" /> Copy link</DropdownMenuItem>
                {!postDetailStatus && (
                  <DropdownMenuItem onClick={postDetail}><PencilLine className="h-4 w-4 mr-2" /> Open detail</DropdownMenuItem>
                )}
                {post.canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="w-full text-left text-red-600 flex items-center px-2 py-1.5 rounded-sm hover:bg-red-50 dark:hover:bg-red-500/10">
                          <Trash2 className="h-4 w-4 mr-2" />Delete
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

          {imageUrl && (
            <div className="mt-3 overflow-hidden rounded-lg border border-border">
              <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
                <DialogTrigger asChild>
                  <img src={imageUrl} alt="Post media" className="w-full h-auto object-cover cursor-zoom-in" loading="lazy" />
                </DialogTrigger>
                <DialogContent className="max-w-4xl p-0">
                  <DialogHeader className="px-4 py-2"><DialogTitle>Media</DialogTitle></DialogHeader>
                  <img src={imageUrl} alt="Post media large" className="w-full h-auto object-contain" />
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* stats row */}
          <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="relative inline-flex items-center">
                <Heart
                  className={clsx('h-4 w-4 transition-transform', liked ? 'text-red-600 scale-110' : undefined)}
                  fill={liked ? 'currentColor' : 'none'}
                  stroke={liked ? 'none' : 'currentColor'}
                />
                {liked && (
                  <span className="absolute -inset-1 animate-ping rounded-full" aria-hidden />
                )}
              </span>
              <span>{k(likes)}</span>
            </div>
            {commentsCount > 0 && (
              <div className="flex items-center gap-3">
                <span>{k(commentsCount)} comments</span>
              </div>
            )}
          </div>

          {/* actions */}
          <div className="mt-2">
            <div className="flex flex-wrap items-center gap-2 w-full">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={liked ? 'default' : 'outline'}
                    size="sm"
                    onClick={like}
                    disabled={busyLike}
                    className={clsx('flex-1 min-w-[112px] gap-2 transition-transform active:scale-[0.98]', liked && 'bg-red-600 hover:bg-red-700 text-white')}
                    aria-pressed={liked}
                    aria-label={liked ? 'Unlike post' : 'Like post'}
                  >
                    {busyLike ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                      <Heart className={clsx('h-4 w-4', liked && 'text-white')} fill={liked ? 'currentColor' : 'none'} stroke={liked ? 'none' : 'currentColor'} />
                    )}
                    Like
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Press L to like</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1 min-w-[112px] gap-2" aria-label="Add a comment" onClick={focusComment}>
                    <MessageSquare className="h-4 w-4" /> Comment
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Press C to comment</TooltipContent>
              </Tooltip>

              <Button variant="outline" size="sm" className="flex-1 min-w-[112px] gap-2" disabled>
                <Share2 className="h-4 w-4" /> Share
              </Button>
            </div>
          </div>

          {err && (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200" aria-live="polite">
              {err}
            </div>
          )}

          <Separator className="my-4" />

          <CommentThread comments={comments} onAdd={add} focusRef={commentInputRef} />
        </CardContent>
      </TooltipProvider>
    </Card>
  );
}

function PostText({ text, expanded, onToggle }) {
  const MAX_CHARS = 1500; const needsClamp = (text || '').length > MAX_CHARS;
  return (
    <div className="text-foreground/90">
      {needsClamp ? (
        <div>
          <div className={clsx('whitespace-pre-wrap', !expanded && 'line-clamp-4')}>
            <RichPostBody raw={text} />
          </div>
          <button type="button" onClick={onToggle} className="mt-1 text-sm font-medium text-primary hover:opacity-80">
            {expanded ? 'See less' : 'See more'}
          </button>
        </div>
      ) : (
        <div className="whitespace-pre-wrap"><RichPostBody raw={text} /></div>
      )}
    </div>
  );
}
