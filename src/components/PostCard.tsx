import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Post, Comment } from '../types';
import { Avatar } from './Avatar';
import {
  Heart, MessageSquare, Share2, Pin, Trash2, Megaphone,
  Send, MoreHorizontal, Flag,
} from 'lucide-react';
import { timeAgo, classNames } from '../lib/utils';

interface Props {
  post: Post;
  canModerate?: boolean;
  onChanged: () => void;
}

export function PostCard({ post, canModerate = false, onChanged }: Props) {
  const { profile } = useAuth();
  const toast = useToast();
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isOwner = post.user_id === profile?.id;

  const toggleLike = async () => {
    if (!profile) return;
    if (post.liked_by_me) {
      await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', profile.id);
    } else {
      await supabase.from('likes').insert({ post_id: post.id, user_id: profile.id });
      // Notify post owner
      if (post.user_id !== profile.id) {
       const { error: notificationError } = await supabase.rpc('create_notification', {
  target_user_id: post.user_id,
  notification_type: 'like',
  notification_content: `${profile.full_name || 'Someone'} liked your post`,
  notification_related_id: post.id,
});

if (notificationError) {
  console.error('NOTIFICATION ERROR:', notificationError);
}
      }
    }
    onChanged();
  };

  const loadComments = async () => {
    setLoadingComments(true);
    const { data } = await supabase
      .from('comments')
      .select('*, profile:profiles!user_id(*)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });
    setComments((data ?? []) as Comment[]);
    setLoadingComments(false);
  };

  const toggleComments = () => {
    if (!showComments) loadComments();
    setShowComments((s) => !s);
  };

  const addComment = async () => {
    if (!profile || !newComment.trim()) return;
    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: post.id, content: newComment.trim() })
      .select('*, profile:profiles!user_id(*)')
      .maybeSingle();
    if (error) { toast('error', error.message); return; }
    if (data) setComments((c) => [...c, data as Comment]);
    setNewComment('');
    if (post.user_id !== profile.id) {
     const { error: notificationError } = await supabase.rpc('create_notification', {
  target_user_id: post.user_id,
  notification_type: 'comment',
  notification_content: `${profile.full_name || 'Someone'} commented on your post`,
  notification_related_id: post.id,
});

if (notificationError) {
  console.error('COMMENT NOTIFICATION ERROR:', notificationError);
}
    }
    onChanged();
  };

  const share = async () => {
    const url = `${window.location.origin}/#/communities/${post.community_id}`;
    const shareData = { text: post.content.slice(0, 100), url };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
    } else {
      navigator.clipboard?.writeText(url);
      toast('success', 'Link copied to clipboard');
    }
  };

  const pin = async () => {
    await supabase.from('posts').update({ pinned: !post.pinned }).eq('id', post.id);
    toast('success', post.pinned ? 'Unpinned' : 'Pinned to top');
    setMenuOpen(false);
    onChanged();
  };

  const remove = async () => {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    await supabase.from('posts').delete().eq('id', post.id);
    toast('success', 'Post deleted');
    onChanged();
  };

  const report = async () => {
    if (!profile) return;
    const { error } = await supabase.from('abuse_reports').insert({
      target_type: 'post',
      target_id: post.id,
      reason: 'Reported via post menu',
    });
    if (error) toast('error', error.message);
    else toast('success', 'Report submitted. Admins will review.');
    setMenuOpen(false);
  };

  return (
    <div className={classNames('card p-5 animate-fade-up', post.pinned && 'ring-2 ring-forest-200')}>
      {post.pinned && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-forest-700 mb-2">
          <Pin size={12} /> Pinned
        </div>
      )}
      <div className="flex items-start gap-3">
        <Avatar name={post.profile?.full_name ?? ''} src={post.profile?.avatar_url} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink-900 text-sm truncate">{post.profile?.full_name || 'Member'}</span>
            {post.type === 'announcement' && (
              <span className="chip text-[10px] bg-clay-100 text-clay-700"><Megaphone size={10} /> Announcement</span>
            )}
            <span className="text-xs text-ink-400">· {timeAgo(post.created_at)}</span>
            <div className="relative ml-auto">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="text-ink-400 hover:text-ink-700 rounded-full p-1 hover:bg-ink-100"
              >
                <MoreHorizontal size={16} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 w-44 card py-1">
                    {canModerate && (
                      <button onClick={pin} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-700 hover:bg-ink-50">
                        <Pin size={14} /> {post.pinned ? 'Unpin' : 'Pin'}
                      </button>
                    )}
                    {!isOwner && (
                      <button onClick={report} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-clay-700 hover:bg-clay-50">
                        <Flag size={14} /> Report
                      </button>
                    )}
                    {(isOwner || canModerate) && (
                      <button onClick={remove} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-clay-700 hover:bg-clay-50">
                        <Trash2 size={14} /> Delete
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          {post.content && (
            <p className="text-sm text-ink-800 mt-1.5 leading-relaxed whitespace-pre-line">{post.content}</p>
          )}
          {post.image_url && (
            <img
              src={post.image_url}
              alt=""
              className="mt-3 rounded-xl max-h-96 w-full object-cover border border-ink-100"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <div className="flex items-center gap-4 mt-3">
            <button
              onClick={toggleLike}
              className={classNames(
                'flex items-center gap-1.5 text-xs font-semibold transition-colors',
                post.liked_by_me ? 'text-clay-600' : 'text-ink-500 hover:text-clay-600',
              )}
            >
              <Heart size={15} className={post.liked_by_me ? 'fill-clay-500 text-clay-500' : ''} />
              {post.like_count ?? 0}
            </button>
            <button
              onClick={toggleComments}
              className="flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-forest-700 transition-colors"
            >
              <MessageSquare size={15} />
              {post.comment_count ?? 0}
            </button>
            <button
              onClick={share}
              className="flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-forest-700 transition-colors"
            >
              <Share2 size={15} />
            </button>
          </div>

          {showComments && (
            <div className="mt-4 pt-3 border-t border-ink-100 space-y-3 animate-fade-up">
              {loadingComments ? (
                <p className="text-xs text-ink-400">Loading…</p>
              ) : (
                <>
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-2">
                      <Avatar name={c.profile?.full_name ?? ''} src={c.profile?.avatar_url} size="xs" />
                      <div className="bg-ink-50 rounded-xl px-3 py-2 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-ink-800">{c.profile?.full_name || 'Member'}</span>
                          <span className="text-[10px] text-ink-400">{timeAgo(c.created_at)}</span>
                        </div>
                        <p className="text-sm text-ink-700 mt-0.5">{c.content}</p>
                      </div>
                    </div>
                  ))}
                  {comments.length === 0 && <p className="text-xs text-ink-400">No comments yet.</p>}
                </>
              )}
              <div className="flex gap-2 items-center">
                <Avatar name={profile?.full_name ?? ''} src={profile?.avatar_url} size="xs" />
                <input
                  className="input flex-1 text-sm py-2"
                  placeholder="Write a comment…"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addComment()}
                />
                <button onClick={addComment} disabled={!newComment.trim()} className="btn-primary p-2.5">
                  <Send size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
