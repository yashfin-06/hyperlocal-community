import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import { useToast } from '../components/Toast';
import { Recommendation, Community, RecommendationType, RecommendationCategory } from '../types';
import { PageLoader, EmptyState } from '../components/Feedback';
import { Avatar } from '../components/Avatar';
import { Modal } from '../components/Modal';
import { ThumbsUp, Plus, Search, Trash2, HelpCircle, MessageSquare } from 'lucide-react';
import { timeAgo, classNames } from '../lib/utils';

const CATEGORIES: { value: RecommendationCategory; label: string }[] = [
  { value: 'plumber', label: 'Plumber' },
  { value: 'electrician', label: 'Electrician' },
  { value: 'tutor', label: 'Tutor' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'general', label: 'General' },
];

export function RecommendationsPage() {
  const { profile } = useAuth();
  const { navigate } = useRouter();
  const toast = useToast();
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<RecommendationType | 'all'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data: mems } = await supabase.from('community_members').select('community_id').eq('user_id', profile.id).eq('status', 'approved');
    const communityIds = ((mems ?? []) as { community_id: string }[]).map((m) => m.community_id);
    if (communityIds.length === 0) { setRecs([]); setCommunities([]); setLoading(false); return; }
    const [{ data: r }, { data: comms }] = await Promise.all([
      supabase.from('recommendations').select('*, profile:profiles!user_id(*)').in('community_id', communityIds).order('created_at', { ascending: false }),
      supabase.from('communities').select('*').in('id', communityIds),
    ]);
    setRecs((r ?? []) as Recommendation[]);
    setCommunities((comms ?? []) as Community[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const filtered = recs.filter((r) => {
    const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.body.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || r.type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-900">Recommendations</h1>
          <p className="text-sm text-ink-500 mt-0.5">Ask for and share local service recommendations</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={16} /> New Post</button>
      </div>

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input className="input pl-10" placeholder="Search recommendations…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {[{ v: 'all', l: 'All' }, { v: 'request', l: 'Asking' }, { v: 'recommendation', l: 'Recommending' }].map((t) => (
            <button key={t.v} onClick={() => setTypeFilter(t.v as any)} className={classNames('shrink-0 chip', typeFilter === t.v ? 'bg-forest-600 text-white' : 'bg-white border border-ink-200 text-ink-600 hover:border-forest-400')}>{t.l}</button>
          ))}
        </div>
      </div>

      {loading ? <PageLoader /> : filtered.length === 0 ? (
        <EmptyState icon={<ThumbsUp size={28} />} title="No recommendations yet" description="Ask for a plumber, tutor, or restaurant — or recommend one you love." action={<button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={16} /> New Post</button>} />
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => (
            <div key={r.id} className="card p-5 animate-fade-up">
              <div className="flex items-start gap-3">
                <div className={classNames('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', r.type === 'request' ? 'bg-clay-50 text-clay-600' : 'bg-forest-50 text-forest-600')}>
                  {r.type === 'request' ? <HelpCircle size={18} /> : <ThumbsUp size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-ink-900">{r.title}</h3>
                    <span className={classNames('chip text-[10px]', r.type === 'request' ? 'bg-clay-100 text-clay-700' : 'bg-forest-100 text-forest-700')}>
                      {r.type === 'request' ? 'Asking' : 'Recommendation'}
                    </span>
                    {r.category !== 'general' && <span className="chip text-[10px] bg-sand-100 text-sand-700 capitalize">{r.category}</span>}
                  </div>
                  {r.body && <p className="text-sm text-ink-700 mt-2 leading-relaxed whitespace-pre-line">{r.body}</p>}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-ink-100">
                    <div className="flex items-center gap-2 text-xs text-ink-500">
                      <Avatar name={r.profile?.full_name ?? ''} src={r.profile?.avatar_url} size="xs" />
                      <span>{r.profile?.full_name || 'Neighbor'} · {timeAgo(r.created_at)}</span>
                    </div>
                    <div className="flex gap-1">
                      {r.user_id !== profile?.id && (
                        <button onClick={async () => {
                          const { data } = await supabase.rpc('get_or_create_conversation', { other_user: r.user_id });
                          if (data) navigate(`/messages/${data}`);
                        }} className="p-1.5 rounded-lg text-ink-500 hover:bg-forest-50 hover:text-forest-700"><MessageSquare size={14} /></button>
                      )}
                      {r.user_id === profile?.id && (
                        <button onClick={async () => {
                          await supabase.from('recommendations').delete().eq('id', r.id);
                          toast('success', 'Deleted'); setRefreshKey((k) => k + 1);
                        }} className="p-1.5 rounded-lg text-ink-400 hover:bg-clay-50 hover:text-clay-600"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && communities.length > 0 && (
        <CreateRecModal communities={communities} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); setRefreshKey((k) => k + 1); }} />
      )}
    </div>
  );
}

function CreateRecModal({ communities, onClose, onCreated }: { communities: Community[]; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ community_id: communities[0]?.id ?? '', title: '', body: '', category: 'general' as RecommendationCategory, type: 'request' as RecommendationType });

  const submit = async () => {
    if (!form.title.trim() || !form.community_id) { toast('error', 'Title and community are required'); return; }
    setSaving(true);
    const { error } = await supabase.from('recommendations').insert({
      community_id: form.community_id,
      title: form.title.trim(),
      body: form.body.trim(),
      category: form.category,
      type: form.type,
    });
    if (error) toast('error', error.message);
    else { toast('success', 'Posted!'); onCreated(); }
    setSaving(false);
  };

  return (
    <Modal open onClose={onClose} title="New Recommendation Post" size="md" footer={<><button onClick={onClose} className="btn-secondary">Cancel</button><button onClick={submit} disabled={saving} className="btn-primary">{saving ? 'Posting…' : 'Post'}</button></>}>
      <div className="space-y-4">
        <div>
          <label className="label">Community *</label>
          <select className="input" value={form.community_id} onChange={(e) => setForm((f) => ({ ...f, community_id: e.target.value }))}>
            {communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as RecommendationType }))}>
              <option value="request">Asking for a recommendation</option>
              <option value="recommendation">Recommending a business</option>
            </select>
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as RecommendationCategory }))}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Title *</label>
          <input className="input" placeholder={form.type === 'request' ? 'e.g. Need a reliable plumber in Kochi' : 'e.g. Great tutor for math classes'} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </div>
        <div>
          <label className="label">Details</label>
          <textarea className="input min-h-[80px] resize-y" placeholder="Share more details…" value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
        </div>
      </div>
    </Modal>
  );
}
