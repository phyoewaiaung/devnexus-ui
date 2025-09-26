// src/pages/CreatePostPage.jsx
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

import PostComposer from '../components/PostComposer';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';

import { ArrowLeft, AlertCircle, WifiOff } from 'lucide-react';

export default function CreatePostPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [offline, setOffline] = useState(!navigator.onLine);

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

  const handleCreated = (post) => {
    // Navigate home; FeedPage can optionally show a "new posts" chip
    navigate('/', { replace: true, state: { justPosted: post?._id || true } });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/70 backdrop-blur border-b">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 h-12 sm:h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-base sm:text-lg font-semibold">Create post</h1>
          </div>

          <div className="flex items-center gap-2">
            {offline && (
              <Badge variant="secondary" className="gap-1">
                <WifiOff className="h-3.5 w-3.5" /> Offline
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Offline banner */}
      {offline && (
        <div className="max-w-3xl mx-auto px-3 sm:px-4 pt-3">
          <Alert className="mb-3">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You’re offline. You can still write, but posting requires a connection.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Composer */}
      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-4 space-y-3">
        <PostComposer onCreated={handleCreated} />

        {/* Small footer helper */}
        <Card className="p-3 sm:p-4">
          <p className="text-xs text-muted-foreground">
            Posting as <span className="font-medium">
              {user?.name || user?.username || 'Guest'}
            </span>.{' '}
            <Link to="/" className="underline hover:no-underline">
              Back to feed
            </Link>
          </p>
        </Card>
      </main>
    </div>
  );
}
