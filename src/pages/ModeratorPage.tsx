import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import { useToast } from '../components/Toast';
import { Community, CommunityMember, Post, Comment } from '../types';
import { PageLoader, EmptyState } from '../components/Feedback';
import { Avatar } from '../components/Avatar';
import { Shield, Users, MessageSquare, Pin, Trash2, Check, X, ArrowLeft, BookOpen, Save } from 'lucide-react';
import { timeAgo, classNames } from '../lib/utils';

type Tab = 'requests' | 'posts' | 'members' | 'rules';

export function ModeratorPage({ communityId }: { communityId: string }) {
  const { profile } = useAuth();
  const { navigate } = useRouter();
  const toast = useToast();
  const [community, setCommunity] = useState<Community | null>(null);
  const [membership, setMembership] = useState<CommunityMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('requests');
  const [pending, setPending] = useState<(CommunityMember & { profile?: any })[]>([]);
  const [members, setMembers] = useState<(CommunityMember & { profile?: any })[]>([]);
  const [posts, setPosts] = useState<(Post & { profile?: any })[]>([]);
  const [rulesDraft, setRulesDraft] = useState('');
  const [savingRules, setSavingRules] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: c }, { data: m }] = await Promise.all([
      supabase.from('communities').select('*').eq('id', communityId).maybeSingle(),
      supabase.from('community_members').select('*').eq('community_id', communityId).eq('user_id', profile.id).maybeSingle(),
    ]);
    setCommunity(c as Community | null);
    setMembership(m as CommunityMember | null);
    setRulesDraft((c as Community | null)?.rules ?? '');

    if ((m as CommunityMember | null)?.role === 'moderator' || profile.role === 'admin') {
      const [{ data: pend }, { data: mems }, { data: p }] = await Promise.all([
        supabase.from('community_members').select('*, profile:profiles!user_id(*)').eq('community_id', communityId).eq('status', 'pending'),
        supabase.from('community_members').select('*, profile:profiles!user_id(*)').eq('community_id', communityId).eq('status', 'approved').order('joined_at', { ascending: false }),
        supabase.from('posts').select('*, profile:profiles!user_id(*)').eq('community_id', communityId).order('created_at', { ascending: false }),
      ]);
      setPending((pend ?? []) as any);
      setMembers((mems ?? []) as any);
      setPosts((p ?? []) as any);
    }
    setLoading(false);
  }, [communityId, profile]);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (loading) return <PageLoader />;
  if (!community) return <EmptyState icon={<Shield size={28} />} title="Community not found" />;
  const canMod = membership?.role === 'moderator' || profile?.role === 'admin';
  if (!canMod) return <EmptyState icon={<Shield size={28} />} title="Moderators only" description="You don't have moderator access to this community." />;

  const approveMember = async (uid: string) => {
    const { error } = await supabase
      .from('community_members')
      .update({ status: 'approved' })
      .eq('community_id', communityId).eq('user_id', uid);
    if (error) toast('error', error.message);
    else {
      toast('success', 'Member approved');
      await supabase.rpc('increment_member_count', { cid: communityId });
      setRefreshKey((k) => k + 1);
    }
  };

  const rejectMember = async (uid: string) => {
    const { error } = await supabase
      .from('community_members')
      .delete()
      .eq('community_id', communityId).eq('user_id', uid);
    if (error) toast('error', error.message);
    else { toast('success', 'Request rejected'); setRefreshKey((k) => k + 1); }
  };

  const makeMod = async (uid: string, make: boolean) => {
    const { error } = await supabase
      .from('community_members')
      .update({ role: make ? 'moderator' : 'member' })
      .eq('community_id', communityId).eq('user_id', uid);
    if (error) toast('error', error.message);
    else { toast('success', make ? 'Promoted to moderator' : 'Demoted to member'); setRefreshKey((k) => k + 1); }
  };

  const removeMember = async (uid: string) => {
    if (!confirm('Remove this member from the community?')) return;
    const { error } = await supabase
      .from('community_members')
      .delete()
      .eq('community_id', communityId).eq('user_id', uid);
    if (error) toast('error', error.message);
    else {
      const c = community;
      if (c) supabase.from('communities').update({ member_count: Math.max(0, c.member_count - 1) }).eq('id', communityId);
      toast('success', 'Member removed');
      setRefreshKey((k) => k + 1);
    }
  };

  const togglePin = async (postId: string, pinned: boolean) => {
    await supabase.from('posts').update({ pinned: !pinned }).eq('id', postId);
    toast('success', !pinned ? 'Pinned' : 'Unpinned');
    setRefreshKey((k) => k + 1);
  };

  const deletePost = async (postId: string) => {
    if (!confirm('Delete this post?')) return;
    await supabase.from('posts').delete().eq('id', postId);
    toast('success', 'Post deleted');
    setRefreshKey((k) => k + 1);
  };

  const saveRules = async () => {
    setSavingRules(true);
    const { error } = await supabase.from('communities').update({ rules: rulesDraft }).eq('id', communityId);
    if (error) toast('error', error.message);
    else toast('success', 'Rules updated');
    setSavingRules(false);
  };

  const tabs: { id: Tab; label: string; icon: typeof Users; count?: number }[] = [
    { id: 'requests', label: 'Requests', icon: Users, count: pending.length },
    { id: 'posts', label: 'Posts', icon: MessageSquare, count: posts.length },
    { id: 'members', label: 'Members', icon: Users, count: members.length },
    { id: 'rules', label: 'Rules', icon: BookOpen },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate(`/communities/${communityId}`)} className="btn-ghost mb-4 -ml-2">
        <ArrowLeft size={16} /> Back to community
      </button>

      <div className="card p-5 mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Shield size={18} className="text-forest-600" />
          <h1 className="text-lg font-extrabold text-ink-900">Moderate: {community.name}</h1>
        </div>
        <p className="text-sm text-ink-500">Manage members, posts, comments, and community rules.</p>
      </div>

      <div className="flex gap-1 mb-5 border-b border-ink-100">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={classNames(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px',
              tab === t.id ? 'border-forest-600 text-forest-700' : 'border-transparent text-ink-500 hover:text-ink-800',
            )}
          >
            <t.icon size={15} />
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="ml-1 chip text-[10px] bg-clay-100 text-clay-700">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'requests' && (
        <div className="space-y-3">
          {pending.length === 0 ? (
            <EmptyState icon={<Check size={28} />} title="No pending requests" description="All membership requests have been handled." />
          ) : (
            pending.map((m) => (
              <div key={m.user_id} className="card p-4 flex items-center gap-3">
                <Avatar name={m.profile?.full_name ?? ''} src={m.profile?.avatar_url} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink-900 text-sm truncate">{m.profile?.full_name || 'Member'}</p>
                  <p className="text-xs text-ink-500 truncate">Requested {timeAgo(m.joined_at)}</p>
                </div>
                <button onClick={() => approveMember(m.user_id)} className="btn-primary text-sm py-1.5 px-3"><Check size={14} /></button>
                <button onClick={() => rejectMember(m.user_id)} className="btn-secondary text-sm py-1.5 px-3"><X size={14} /></button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'posts' && (
        <div className="space-y-3">
          {posts.length === 0 ? (
            <EmptyState icon={<MessageSquare size={28} />} title="No posts" />
          ) : (
            posts.map((p) => (
              <ModeratePostCard
                key={p.id}
                post={p}
                onTogglePin={() => togglePin(p.id, p.pinned)}
                onDelete={() => deletePost(p.id)}
              />
            ))
          )}
        </div>
      )}

      {tab === 'members' && (
        <div className="space-y-3">
          {members.length === 0 ? (
            <EmptyState icon={<Users size={28} />} title="No members" />
          ) : (
            members.map((m) => (
              <div key={m.user_id} className="card p-4 flex items-center gap-3">
                <Avatar name={m.profile?.full_name ?? ''} src={m.profile?.avatar_url} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink-900 text-sm truncate">{m.profile?.full_name || 'Member'}</p>
                  <p className="text-xs text-ink-500 truncate">{m.profile?.hometown || m.profile?.current_city}</p>
                </div>
                {m.role === 'moderator' ? (
                  <button onClick={() => makeMod(m.user_id, false)} className="chip bg-forest-50 text-forest-700 hover:bg-forest-100 cursor-pointer">
                    <Shield size={11} /> Moderator
                  </button>
                ) : (
                  <button onClick={() => makeMod(m.user_id, true)} className="chip bg-ink-100 text-ink-600 hover:bg-forest-50 hover:text-forest-700 cursor-pointer">
                    Make mod
                  </button>
                )}
                {m.user_id !== profile?.id && (
                  <button onClick={() => removeMember(m.user_id)} className="p-1.5 rounded-lg text-ink-400 hover:bg-clay-50 hover:text-clay-600">
                    <X size={14} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'rules' && (
        <div className="card p-6">
          <h3 className="text-sm font-bold text-ink-700 mb-2 flex items-center gap-2">
            <BookOpen size={16} /> Community Rules & Guidelines
          </h3>
          <p className="text-xs text-ink-500 mb-4">Set the guidelines that all members must follow. These are visible on the community's About page.</p>
          <textarea
            className="input min-h-[180px] resize-y"
            placeholder="1. Be respectful&#10;2. Share only local content&#10;3. No spam or self-promotion&#10;4. Report inappropriate content"
            value={rulesDraft}
            onChange={(e) => setRulesDraft(e.target.value)}
          />
          <div className="flex justify-end mt-4">
            <button onClick={saveRules} disabled={savingRules} className="btn-primary">
              {savingRules ? <span className="animate-pulse">Saving…</span> : <><Save size={16} /> Save Rules</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ModeratePostCard({
  post: p,
  onTogglePin,
  onDelete,
}: {
  post: Post & { profile?: any };
  onTogglePin: () => void;
  onDelete: () => void;
}) {
  const toast = useToast();
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<(Comment & { profile?: any })[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);

  const loadComments = async () => {
    setLoadingComments(true);
    const { data } = await supabase
      .from('comments')
      .select('*, profile:profiles!user_id(*)')
      .eq('post_id', p.id)
      .order('created_at', { ascending: true });
    setComments((data ?? []) as any);
    setLoadingComments(false);
  };

  const toggleComments = () => {
    if (!showComments) loadComments();
    setShowComments((s) => !s);
  };

  const deleteComment = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) toast('error', error.message);
    else {
      toast('success', 'Comment deleted');
      setComments((cs) => cs.filter((c) => c.id !== commentId));
    }
  };

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Avatar name={p.profile?.full_name ?? ''} src={p.profile?.avatar_url} size="xs" />
        <span className="text-xs font-semibold text-ink-800">{p.profile?.full_name || 'Member'}</span>
        <span className="text-xs text-ink-400">· {timeAgo(p.created_at)}</span>
        {p.pinned && <span className="chip text-[10px] bg-forest-50 text-forest-700"><Pin size={10} /> Pinned</span>}
        <div className="ml-auto flex gap-1">
          <button onClick={onTogglePin} className="p-1.5 rounded-lg text-ink-500 hover:bg-ink-100 hover:text-forest-700" title="Pin">
            <Pin size={14} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg text-ink-500 hover:bg-clay-50 hover:text-clay-600" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <p className="text-sm text-ink-700 whitespace-pre-line">{p.content}</p>
      {p.image_url && (
        <img src={p.image_url} alt="" className="mt-2 rounded-lg max-h-48 w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      )}
      <button
        onClick={toggleComments}
        className="mt-2 text-xs font-semibold text-ink-500 hover:text-forest-700 transition-colors flex items-center gap-1"
      >
        <MessageSquare size={12} />
        {showComments ? 'Hide comments' : 'Moderate comments'}
      </button>
      {showComments && (
        <div className="mt-3 pt-3 border-t border-ink-100 space-y-2">
          {loadingComments ? (
            <p className="text-xs text-ink-400">Loading…</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-ink-400">No comments on this post.</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex items-start gap-2">
                <Avatar name={c.profile?.full_name ?? ''} src={c.profile?.avatar_url} size="xs" />
                <div className="bg-ink-50 rounded-xl px-3 py-2 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-ink-800">{c.profile?.full_name || 'Member'}</span>
                    <span className="text-[10px] text-ink-400">{timeAgo(c.created_at)}</span>
                  </div>
                  <p className="text-sm text-ink-700 mt-0.5">{c.content}</p>
                </div>
                <button onClick={() => deleteComment(c.id)} className="p-1.5 rounded-lg text-ink-400 hover:bg-clay-50 hover:text-clay-600 shrink-0" title="Delete comment">
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
