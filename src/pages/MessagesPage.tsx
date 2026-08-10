import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import { useToast } from '../components/Toast';
import { Conversation, Message, Profile } from '../types';
import { PageLoader, EmptyState } from '../components/Feedback';
import { Avatar } from '../components/Avatar';
import { Modal } from '../components/Modal';
import { Send, MessageCircle, Plus, ArrowLeft, Search } from 'lucide-react';
import { timeAgo, classNames } from '../lib/utils';

export function MessagesPage({ conversationId }: { conversationId?: string }) {
  const { profile } = useAuth();
  const { navigate } = useRouter();
  const toast = useToast();
  const [conversations, setConversations] = useState<(Conversation & { other_profile?: Profile; last_message?: Message })[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data: convs } = await supabase.from('conversations').select('*').or(`user_a.eq.${profile.id},user_b.eq.${profile.id}`).order('last_message_at', { ascending: false });
    const convList = (convs ?? []) as Conversation[];
    if (convList.length) {
      const otherIds = convList.map((c) => (c.user_a === profile.id ? c.user_b : c.user_a));
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', otherIds);
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));
      const convIds = convList.map((c) => c.id);
      const { data: lastMsgs } = await supabase.from('messages').select('*').in('conversation_id', convIds).order('created_at', { ascending: false });
      const lastMsgMap = new Map<string, Message>();
      (lastMsgs ?? []).forEach((m: any) => { if (!lastMsgMap.has(m.conversation_id)) lastMsgMap.set(m.conversation_id, m as Message); });
      convList.forEach((c) => {
        c.other_profile = profileMap.get(c.user_a === profile.id ? c.user_b : c.user_a);
        c.last_message = lastMsgMap.get(c.id);
      });
    }
    setConversations(convList);
    setLoading(false);
  }, [profile]);

  const loadMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true);
    const { data: msgs } = await supabase.from('messages').select('*').eq('conversation_id', convId).order('created_at', { ascending: true });
    setMessages((msgs ?? []) as Message[]);
    setLoadingMsgs(false);
    // Mark as read
    if (profile) {
      await supabase.from('messages').update({ read: true }).eq('conversation_id', convId).neq('sender_id', profile.id);
    }
  }, [profile]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (conversationId) {
      const conv = conversations.find((c) => c.id === conversationId);
      if (conv) { setActiveConv(conv); loadMessages(conversationId); }
    } else {
      setActiveConv(null);
      setMessages([]);
    }
  }, [conversationId, conversations, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!profile || !activeConv || !newMessage.trim()) return;
    const content = newMessage.trim();
    setNewMessage('');
    const { data, error } = await supabase.from('messages').insert({ conversation_id: activeConv.id, content }).select('*').maybeSingle();
    if (error) { toast('error', error.message); setNewMessage(content); return; }
    if (data) setMessages((m) => [...m, data as Message]);
    await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', activeConv.id);
    loadConversations();
  };

  const searchUsers = async (q: string) => {
    setSearchQuery(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    const { data } = await supabase.from('profiles').select('*').ilike('full_name', `%${q}%`).limit(10);
    setSearchResults((data ?? []).filter((p: Profile) => p.id !== profile?.id) as Profile[]);
  };

  const startConversation = async (otherId: string) => {
    const { data, error } = await supabase.rpc('get_or_create_conversation', { other_user: otherId });
    if (error) { toast('error', error.message); return; }
    setShowNew(false);
    setSearchQuery('');
    setSearchResults([]);
    await loadConversations();
    navigate(`/messages/${data}`);
  };

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold text-ink-900">Messages</h1>
        <button onClick={() => setShowNew(true)} className="btn-primary"><Plus size={16} /> New Message</button>
      </div>

      <div className="grid md:grid-cols-3 gap-4 h-[calc(100vh-220px)] min-h-[400px]">
        {/* Conversation list */}
        <div className={classNames('card overflow-y-auto scrollbar-thin', activeConv ? 'hidden md:block' : '')}>
          {conversations.length === 0 ? (
            <EmptyState icon={<MessageCircle size={28} />} title="No conversations" description="Start a new message to chat with a neighbor." />
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => navigate(`/messages/${c.id}`)}
                className={classNames('w-full flex items-center gap-3 p-4 border-b border-ink-50 hover:bg-ink-50 transition-colors text-left', activeConv?.id === c.id && 'bg-forest-50')}
              >
                <Avatar name={c.other_profile?.full_name ?? ''} src={c.other_profile?.avatar_url} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink-900 text-sm truncate">{c.other_profile?.full_name || 'Neighbor'}</p>
                  <p className="text-xs text-ink-500 truncate">{c.last_message?.content || 'No messages yet'}</p>
                </div>
                {c.last_message && <span className="text-[10px] text-ink-400 shrink-0">{timeAgo(c.last_message.created_at)}</span>}
              </button>
            ))
          )}
        </div>

        {/* Message thread */}
        <div className={classNames('md:col-span-2 card flex flex-col', !activeConv ? 'hidden md:flex' : '')}>
          {activeConv ? (
            <>
              <div className="flex items-center gap-3 p-4 border-b border-ink-100">
                <button onClick={() => navigate('/messages')} className="md:hidden btn-ghost p-1"><ArrowLeft size={18} /></button>
                <Avatar name={activeConv.other_profile?.full_name ?? ''} src={activeConv.other_profile?.avatar_url} size="sm" />
                <div>
                  <p className="font-semibold text-ink-900 text-sm">{activeConv.other_profile?.full_name || 'Neighbor'}</p>
                  <p className="text-xs text-ink-500">{activeConv.other_profile?.hometown || activeConv.other_profile?.current_city}</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
                {loadingMsgs ? (
                  <p className="text-sm text-ink-400 text-center">Loading…</p>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-ink-400 text-center py-8">No messages yet. Say hello!</p>
                ) : (
                  messages.map((m) => {
                    const isMe = m.sender_id === profile?.id;
                    return (
                      <div key={m.id} className={classNames('flex', isMe ? 'justify-end' : 'justify-start')}>
                        <div className={classNames('max-w-[75%] rounded-2xl px-4 py-2.5', isMe ? 'bg-forest-600 text-white' : 'bg-ink-100 text-ink-900')}>
                          <p className="text-sm whitespace-pre-line">{m.content}</p>
                          <p className={classNames('text-[10px] mt-1', isMe ? 'text-forest-100' : 'text-ink-400')}>{timeAgo(m.created_at)}</p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="p-3 border-t border-ink-100 flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="Type a message…"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
                />
                <button onClick={send} disabled={!newMessage.trim()} className="btn-primary p-2.5"><Send size={16} /></button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-ink-400">
              <div className="text-center">
                <MessageCircle size={40} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">Select a conversation to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showNew && (
        <Modal open onClose={() => setShowNew(false)} title="New Message" size="sm">
          <div className="space-y-4">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input className="input pl-10" placeholder="Search by name…" value={searchQuery} onChange={(e) => searchUsers(e.target.value)} autoFocus />
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-thin">
              {searchResults.map((p) => (
                <button key={p.id} onClick={() => startConversation(p.id)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-ink-50 transition-colors text-left">
                  <Avatar name={p.full_name} src={p.avatar_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink-900 text-sm truncate">{p.full_name || 'Neighbor'}</p>
                    <p className="text-xs text-ink-500 truncate">{p.hometown || p.current_city}</p>
                  </div>
                </button>
              ))}
              {searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                <p className="text-sm text-ink-400 text-center py-4">No neighbors found.</p>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
