import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import { useToast } from '../components/Toast';
import { Community, CommunityMember, Post, CommunityEvent } from '../types';
import { PageLoader, EmptyState } from '../components/Feedback';
import { Avatar } from '../components/Avatar';
import { PostCard } from '../components/PostCard';
import { CreatePostCard } from '../components/CreatePostCard';
import { EventCard } from '../components/EventCard';
import {
  ArrowLeft, Users, MapPin, Calendar, MessageSquare, BookOpen,
  Shield, UserPlus, LogOut,
} from 'lucide-react';
import { formatDate, classNames } from '../lib/utils';

type Tab = 'feed' | 'events' | 'members' | 'about';

export function CommunityDetailPage({ communityId }: { communityId: string }) {
  const { profile } = useAuth();
  const { navigate } = useRouter();
  const toast = useToast();
  const [community, setCommunity] = useState<Community | null>(null);
  const [membership, setMembership] = useState<CommunityMember | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('feed');
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: c }, { data: m }] = await Promise.all([
      supabase.from('communities').select('*').eq('id', communityId).maybeSingle(),
      profile
        ? supabase
            .from('community_members')
            .select('*, profile:profiles(*)')
            .eq('community_id', communityId)
            .eq('user_id', profile.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    setCommunity(c as Community | null);
    setMembership(m as CommunityMember | null);

    if (c && (c as Community).status === 'approved') {
      const [{ data: p }, { data: e }, { data: mems }] = await Promise.all([
        supabase
          .from('posts')
          .select('*, profile:profiles!user_id(*)')
          .eq('community_id', communityId)
          .order('pinned', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('events')
          .select('*, profile:profiles!user_id(*)')
          .eq('community_id', communityId)
          .order('event_date', { ascending: true }),
        supabase
          .from('community_members')
          .select('*, profile:profiles!user_id(*)')
          .eq('community_id', communityId)
          .eq('status', 'approved')
          .order('joined_at', { ascending: false }),
      ]);
      // Enrich posts with like + comment counts
      const postList = (p ?? []) as Post[];
      if (postList.length) {
        const postIds = postList.map((x) => x.id);
        const [{ data: likes }, { data: myLikes }, { data: comments }] = await Promise.all([
          supabase.from('likes').select('post_id').in('post_id', postIds),
          profile
            ? supabase.from('likes').select('post_id').in('post_id', postIds).eq('user_id', profile.id)
            : Promise.resolve({ data: [] }),
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
      setEvents((e ?? []) as CommunityEvent[]);
      setMembers((mems ?? []) as CommunityMember[]);
    }
    setLoading(false);
  }, [communityId, profile]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const isMember = membership?.status === 'approved';
  const isModerator = membership?.role === 'moderator';

  const join = async () => {
    if (!profile) return;
    const { error } = await supabase.from('community_members').insert({
      community_id: communityId,
      user_id: profile.id,
      role: 'member',
      status: 'approved',
    });
    if (error) toast('error', error.message);
    else {
      await supabase.rpc('increment_member_count', { cid: communityId });
      toast('success', `You joined ${community?.name}`);
      setRefreshKey((k) => k + 1);
    }
  };

  const leave = async () => {
    if (!profile) return;
    const { error } = await supabase
      .from('community_members')
      .delete()
      .eq('community_id', communityId)
      .eq('user_id', profile.id);
    if (error) toast('error', error.message);
    else {
      const c = community;
      if (c) supabase.from('communities').update({ member_count: Math.max(0, c.member_count - 1) }).eq('id', communityId);
      toast('success', `You left ${community?.name}`);
      setRefreshKey((k) => k + 1);
    }
  };

  if (loading) return <PageLoader />;
  if (!community) return <EmptyState icon={<Users size={28} />} title="Community not found" />;
  if (community.status !== 'approved' && community.created_by !== profile?.id && profile?.role !== 'admin') {
    return (
      <EmptyState
        icon={<Shield size={28} />}
        title="Pending approval"
        description="This community is awaiting admin approval. Check back soon."
      />
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof MessageSquare }[] = [
    { id: 'feed', label: 'Feed', icon: MessageSquare },
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'about', label: 'About', icon: BookOpen },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate('/communities')} className="btn-ghost mb-4 -ml-2">
        <ArrowLeft size={16} />
        Back
      </button>

      {/* Header */}
      <div className="card overflow-hidden mb-6">
        <div className="h-24 bg-gradient-to-br from-forest-600 to-forest-800 relative">
          <div
            className="absolute inset-0 opacity-30"
            style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.4) 0, transparent 40%)' }}
          />
        </div>
        <div className="px-6 pb-5 -mt-10">
          <div className="h-16 w-16 rounded-2xl bg-white shadow-lift flex items-center justify-center text-2xl font-bold text-forest-700 ring-4 ring-white">
            {community.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex items-start justify-between gap-4 mt-3">
            <div>
              <h1 className="text-xl font-extrabold text-ink-900">{community.name}</h1>
              <div className="flex items-center gap-3 mt-1 text-xs text-ink-500">
                <span className="flex items-center gap-1"><MapPin size={11} />{community.city_village}</span>
                <span className="flex items-center gap-1"><Users size={11} />{community.member_count.toLocaleString()} members</span>
                <span>Since {formatDate(community.created_at)}</span>
              </div>
            </div>
            {isMember ? (
              <div className="flex gap-2">
                {isModerator && (
                  <button onClick={() => navigate(`/communities/${communityId}/moderate`)} className="btn-secondary text-sm">
                    <Shield size={14} /> Moderate
                  </button>
                )}
                <button onClick={leave} className="btn-secondary text-sm">
                  <LogOut size={14} /> Leave
                </button>
              </div>
            ) : (
              <button onClick={join} className="btn-primary">
                <UserPlus size={16} /> Join
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-ink-100">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={classNames(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px',
              tab === t.id
                ? 'border-forest-600 text-forest-700'
                : 'border-transparent text-ink-500 hover:text-ink-800',
            )}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'feed' && (
        <div className="space-y-4">
          {isMember ? (
            <CreatePostCard communityId={communityId} onPosted={() => setRefreshKey((k) => k + 1)} />
          ) : (
            <div className="card p-4 text-center text-sm text-ink-500">
              Join this community to share posts and announcements.
            </div>
          )}
          {posts.length === 0 ? (
            <EmptyState icon={<MessageSquare size={28} />} title="No posts yet" description="Be the first to share something with this community." />
          ) : (
            posts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                canModerate={isModerator}
                onChanged={() => setRefreshKey((k) => k + 1)}
              />
            ))
          )}
        </div>
      )}

      {tab === 'events' && (
        <div className="space-y-4">
          {isMember && (
            <CreateEventButton communityId={communityId} />
          )}
          {events.length === 0 ? (
            <EmptyState icon={<Calendar size={28} />} title="No events scheduled" />
          ) : (
            events.map((e) => <EventCard key={e.id} event={e} onChanged={() => setRefreshKey((k) => k + 1)} />)
          )}
        </div>
      )}

      {tab === 'members' && (
        <div className="card divide-y divide-ink-100">
          {members.length === 0 ? (
            <EmptyState icon={<Users size={28} />} title="No members yet" />
          ) : (
            members.map((m) => (
              <div key={m.user_id} className="flex items-center gap-3 p-4">
                <Avatar name={m.profile?.full_name ?? ''} src={m.profile?.avatar_url} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink-900 truncate">{m.profile?.full_name || 'Member'}</p>
                  <p className="text-xs text-ink-500 truncate">{m.profile?.hometown || m.profile?.current_city}</p>
                </div>
                {m.role === 'moderator' && (
                  <span className="chip bg-forest-50 text-forest-700"><Shield size={11} /> Moderator</span>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'about' && (
        <div className="card p-6 space-y-5">
          <div>
            <h3 className="text-sm font-bold text-ink-700 mb-1.5">Description</h3>
            <p className="text-sm text-ink-600 leading-relaxed">{community.description || 'No description provided.'}</p>
          </div>
          {community.category && (
            <div>
              <h3 className="text-sm font-bold text-ink-700 mb-1.5">Category</h3>
              <span className="chip bg-sand-100 text-sand-700">{community.category}</span>
            </div>
          )}
          <div>
            <h3 className="text-sm font-bold text-ink-700 mb-1.5">Community rules</h3>
            <p className="text-sm text-ink-600 leading-relaxed whitespace-pre-line">{community.rules || 'No specific rules set.'}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateEventButton({ communityId }: { communityId: string }) {
  const { navigate } = useRouter();
  return (
    <button onClick={() => navigate(`/communities/${communityId}/events/create`)} className="btn-primary w-full">
      <Calendar size={16} /> Create Event
    </button>
  );
}
