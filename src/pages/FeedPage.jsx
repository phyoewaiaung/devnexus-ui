import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { getFeed } from '../api/posts';
import PostComposer from '../components/PostComposer';
import PostCard from '../components/PostCard';
import { useAuth } from '../context/AuthContext';

import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

import {
  Loader2, RefreshCw, AlertCircle, Users, TrendingUp, Home,
  MessageCircle, Heart, Share2, ArrowUp, WifiOff
} from 'lucide-react';

export default function FeedPage() {
  const [posts, setPosts] = useState([]);
  const [feedType, setFeedType] = useState('for-you');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewChip, setShowNewChip] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const { user } = useAuth();
  const observerRef = useRef(null);
  const lastPostElementRef = useRef(null);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const fetchPosts = useCallback(
    async (pageNum = 1, opts = {}) => {
      if (loading) return;
      try {
        setLoading(true);
        setError('');
        const { posts: newPosts, hasMore: more } = await getFeed(pageNum, 10, { type: feedType });
        const withPermissions = newPosts.map((p) => ({
          ...p,
          canDelete: user && p.author?._id === user._id,
        }));
        if (opts.isRefresh || pageNum === 1) {
          setPosts(withPermissions);
          if (!initialLoading && withPermissions.length) {
            setShowNewChip(true);
            window.setTimeout(() => setShowNewChip(false), 2200);
          }
        } else {
          setPosts((prev) => [...prev, ...withPermissions]);
        }
        setHasMore(more);
        setPage(pageNum);
      } catch (err) {
        const msg = err?.message || 'Failed to load posts';
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [user, loading, initialLoading, feedType]
  );

  useEffect(() => { fetchPosts(1, { isRefresh: true }); }, [feedType, user?._id]); // eslint-disable-line

  useEffect(() => {
    if (loading || !hasMore) return;
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) fetchPosts(page + 1);
      },
      { rootMargin: '900px 0px 900px 0px' }
    );

    if (lastPostElementRef.current) observerRef.current.observe(lastPostElementRef.current);
    return () => observerRef.current?.disconnect();
  }, [fetchPosts, hasMore, loading, page]);

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleRefresh = async () => {
    if (offline) return;
    setRefreshing(true);
    await fetchPosts(1, { isRefresh: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePostCreated = (newPost) => {
    setPosts((prev) => [
      {
        ...newPost,
        visibility: newPost.visibility || 'public',
        author: {
          _id: user._id,
          name: user.name,
          username: user.username,
          avatarUrl: user.avatarUrl || user.avatar,
        },
        canDelete: true,
        createdAt: new Date().toISOString(),
        likes: [],
        comments: [],
        likesCount: 0,
        commentsCount: 0,
      },
      ...prev,
    ]);
    setShowNewChip(true);
    window.setTimeout(() => setShowNewChip(false), 1800);
  };


  const Header = (
    <div className="border-b bg-background">
      <div className="max-w-4xl mx-auto px-3 sm:px-4">
        <div className="flex items-center justify-between h-12 sm:h-14">
          <div className="flex items-center gap-2">
            <Home className="w-5 h-5 text-[#3C81D2]" aria-hidden />
            <h1 className="text-base sm:text-lg font-semibold">Home</h1>
            {showNewChip && (
              <Button size="sm" className="ml-2 h-7 px-2 bg-[#3C81D2] hover:bg-[#326CB0]">New posts</Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {offline && <Badge variant="secondary" className="gap-1"><WifiOff className="h-3.5 w-3.5" /> Offline</Badge>}
            <Button onClick={handleRefresh} variant="ghost" className="gap-2" disabled={refreshing || offline}>
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        <Tabs value={feedType} onValueChange={setFeedType} className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="for-you" aria-label="For you feed">For you</TabsTrigger>
            <TabsTrigger value="following" aria-label="Following feed">Following</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );

  const PostSkeleton = () => (
    <Card className="p-4">
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-4 w-1/4 mb-2" />
          <Skeleton className="h-3 w-1/6" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-9/12" />
        <Skeleton className="h-4 w-8/12" />
      </div>
      <Separator className="my-4" />
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    </Card>
  );

  if (error && posts.length === 0) {
    return (
      <div className="min-h-screen bg-muted/20">
        {Header}
        <div className="max-w-2xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
          <Card className="p-6 sm:p-8">
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => fetchPosts(1, { isRefresh: true })} className="gap-2">
                <RefreshCw className="w-4 h-4" /> Try again
              </Button>
              {offline && <Badge variant="secondary" className="gap-1"><WifiOff className="h-3.5 w-3.5" /> Offline</Badge>}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // const totals = useMemo(() => ({
  //   comments: posts.reduce((acc, p) => acc + (p.commentsCount || p.comments?.length || 0), 0),
  //   likes: posts.reduce((acc, p) => acc + (p.likesCount || 0), 0),
  // }), [posts]);

  return (
    <div className="min-h-screen bg-background">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {showNewChip ? 'New posts available' : ''}
      </div>

      {Header}

      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-4 space-y-3 sm:space-y-4">
        {user && <PostComposer onCreated={handlePostCreated} />}

        {user && posts.length === 0 && !initialLoading && !error && (
          <Card className="p-5 sm:p-6 bg-white/80 backdrop-blur-sm border-white/40">
            <div className="flex items-start gap-3">
              <Users className="w-6 h-6 text-[#3C81D2] mt-1" aria-hidden />
              <div>
                <h3 className="text-base font-semibold mb-1">Welcome to the community!</h3>
                <p className="text-muted-foreground mb-3">Share your first post or follow people to fill your feed.</p>
                <Button variant="default" className="gap-2">
                  <TrendingUp className="w-4 h-4" aria-hidden /> Discover People
                </Button>
              </div>
            </div>
          </Card>
        )}

        {initialLoading ? (
          <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => (<PostSkeleton key={i} />))}</div>
        ) : (
          <div className="space-y-4">
            {posts.map((post, index) => (
              <div key={post._id} ref={index === posts.length - 1 ? lastPostElementRef : null}>
                <PostCard post={post} onDeleted={(id) => setPosts((prev) => prev.filter((p) => p._id === id ? false : true))} />
              </div>
            ))}
          </div>
        )}

        {loading && !initialLoading && (
          <div className="flex justify-center py-6 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading more posts…
          </div>
        )}

        {!hasMore && posts.length > 0 && (
          <div className="text-center py-8">
            <Badge variant="secondary" className="px-4 py-2">You’re all caught up</Badge>
          </div>
        )}

        {error && posts.length > 0 && (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between w-full">
              <span>Failed to load more posts.</span>
              <Button variant="link" onClick={() => fetchPosts(page + 1)} className="px-0">Retry</Button>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* {user && posts.length > 5 && (
        <Card className="fixed bottom-4 right-4 hidden lg:block p-3 shadow-lg bg-white/90 backdrop-blur-sm">
          <div className="flex items-center gap-4 text-sm text-foreground">
            <div className="flex items-center gap-1"><MessageCircle className="w-4 h-4" aria-hidden /><span>{totals.comments}</span></div>
            <div className="flex items-center gap-1"><Heart className="w-4 h-4" aria-hidden /><span>{totals.likes}</span></div>
            <div className="flex items-center gap-1"><Share2 className="w-4 h-4" aria-hidden /><span>{posts.length}</span></div>
          </div>
        </Card>
      )} */}

      {showBackToTop && (
        <Button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 shadow-lg rounded-full h-10 w-10 p-0"
          aria-label="Back to top"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
