import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import { Post } from '../types';
import { PostCard } from '../components/PostCard';
import { PageLoader, EmptyState } from '../components/Feedback';
import { Newspaper, Users, PlusCircle } from 'lucide-react';

export function FeedPage() {
  const { profile } = useAuth();
  const { navigate } = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    // Get communities I'm a member of
    const { data: mems } = await supabase
      .from('community_members')
      .select('community_id')
      .eq('user_id', profile.id)
      .eq('status', 'approved');
    const communityIds = ((mems ?? []) as { community_id: string }[]).map((m) => m.community_id);

    if (communityIds.length === 0) {
      setPosts([]);
      setLoading(false);
      return;
    }

    const { data: p } = await supabase
      .from('posts')
      .select('*, profile:profiles!user_id(*)')
      .in('community_id', communityIds)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);

    const postList = (p ?? []) as Post[];
    if (postList.length) {
      const postIds = postList.map((x) => x.id);
      const [{ data: likes }, { data: myLikes }, { data: comments }] = await Promise.all([
        supabase.from('likes').select('post_id').in('post_id', postIds),
        supabase.from('likes').select('post_id').in('post_id', postIds).eq('user_id', profile.id),
        supabase.from('comments').select('post_id').in('post_id', postIds),
      ]);
      const likeMap = new Map<string, number>();
      (likes ?? []).forEach((l: any) => likeMap.set(l.post_id, (likeMap.get(l.post_id) ?? 0) + 1));
      const myLikeSet = new Set((myLikes ?? []).map((l: any) => l.post_id));
      const commentMap = new Map<string, number>();
      (comments ?? []).forEach((c: any) => commentMap.set(c.post_id, (commentMap.get(c.post_id) ?? 0) + 1));
      postList.forEach((p) => {
        p.like_count = likeMap.get(p.id) ?? 0;
        p.liked_by_me = myLikeSet.has(p.id);
        p.comment_count = commentMap.get(p.id) ?? 0;
      });
    }
    setPosts(postList);
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (loading) return <PageLoader />;

  if (posts.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <EmptyState
          icon={<Newspaper size={28} />}
          title="Your feed is empty"
          description="Join a community to start seeing posts and updates here."
          action={
            <div className="flex gap-2">
              <button onClick={() => navigate('/communities')} className="btn-primary">
                <Users size={16} /> Browse Communities
              </button>
              <button onClick={() => navigate('/communities/create')} className="btn-secondary">
                <PlusCircle size={16} /> Create One
              </button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-ink-900">Your Feed</h1>
        <p className="text-sm text-ink-500 mt-0.5">Latest posts from communities you've joined</p>
      </div>
      <div className="space-y-4">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} onChanged={() => setRefreshKey((k) => k + 1)} />
        ))}
      </div>
    </div>
  );
}
