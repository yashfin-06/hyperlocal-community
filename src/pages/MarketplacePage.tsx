import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import { useToast } from '../components/Toast';
import { Listing, Community, ListingCategory, ListingCondition } from '../types';
import { PageLoader, EmptyState } from '../components/Feedback';
import { Avatar } from '../components/Avatar';
import { Modal } from '../components/Modal';
import { ShoppingBag, Plus, Search, IndianRupee, Trash2, MessageSquare } from 'lucide-react';
import { timeAgo, classNames } from '../lib/utils';

const CATEGORIES: { value: ListingCategory; label: string }[] = [
  { value: 'for_sale', label: 'For Sale' },
  { value: 'rental', label: 'Rental' },
  { value: 'free', label: 'Free' },
  { value: 'services', label: 'Services' },
  { value: 'lost_found', label: 'Lost & Found' },
  { value: 'other', label: 'Other' },
];

const CONDITIONS: { value: ListingCondition; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
];

export function MarketplacePage() {
  const { profile } = useAuth();
  const { navigate } = useRouter();
  const toast = useToast();
  const [listings, setListings] = useState<Listing[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<ListingCategory | 'all'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data: mems } = await supabase
      .from('community_members')
      .select('community_id')
      .eq('user_id', profile.id)
      .eq('status', 'approved');
    const communityIds = ((mems ?? []) as { community_id: string }[]).map((m) => m.community_id);
    if (communityIds.length === 0) {
      setListings([]);
      setCommunities([]);
      setLoading(false);
      return;
    }
    const [{ data: l }, { data: comms }] = await Promise.all([
      supabase.from('listings').select('*, profile:profiles!user_id(*)').in('community_id', communityIds).eq('status', 'active').order('created_at', { ascending: false }),
      supabase.from('communities').select('*').in('id', communityIds),
    ]);
    setListings((l ?? []) as Listing[]);
    setCommunities((comms ?? []) as Community[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const filtered = listings.filter((l) => {
    const matchSearch = !search || l.title.toLowerCase().includes(search.toLowerCase()) || l.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === 'all' || l.category === catFilter;
    return matchSearch && matchCat;
  });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-900">Marketplace</h1>
          <p className="text-sm text-ink-500 mt-0.5">Buy, sell, and share within your communities</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={16} /> New Listing
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input className="input pl-10" placeholder="Search listings…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button onClick={() => setCatFilter('all')} className={classNames('shrink-0 chip', catFilter === 'all' ? 'bg-forest-600 text-white' : 'bg-white border border-ink-200 text-ink-600 hover:border-forest-400')}>All</button>
          {CATEGORIES.map((c) => (
            <button key={c.value} onClick={() => setCatFilter(c.value)} className={classNames('shrink-0 chip', catFilter === c.value ? 'bg-forest-600 text-white' : 'bg-white border border-ink-200 text-ink-600 hover:border-forest-400')}>{c.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <PageLoader />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<ShoppingBag size={28} />} title="No listings yet" description="Be the first to list something in your community." action={<button onClick={() => setShowCreate(true)} className="btn-primary"><Plus size={16} /> New Listing</button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((l) => (
            <ListingCard key={l.id} listing={l} isOwner={l.user_id === profile?.id} onDelete={async () => {
              await supabase.from('listings').delete().eq('id', l.id);
              toast('success', 'Listing removed');
              setRefreshKey((k) => k + 1);
            }} onMessage={l.user_id !== profile?.id ? async () => {
              const { data } = await supabase.rpc('get_or_create_conversation', { other_user: l.user_id });
              if (data) navigate(`/messages/${data}`);
            } : undefined} />
          ))}
        </div>
      )}

      {showCreate && communities.length > 0 && (
        <CreateListingModal communities={communities} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); setRefreshKey((k) => k + 1); }} />
      )}
    </div>
  );
}

function ListingCard({ listing: l, isOwner, onDelete, onMessage }: { listing: Listing; isOwner: boolean; onDelete: () => void; onMessage?: () => void }) {
  const cat = CATEGORIES.find((c) => c.value === l.category);
  return (
    <div className="card overflow-hidden group hover:shadow-lift hover:-translate-y-0.5 transition-all duration-200">
      {l.image_url ? (
        <img src={l.image_url} alt={l.title} className="h-40 w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      ) : (
        <div className="h-40 w-full bg-sand-100 flex items-center justify-center text-sand-400">
          <ShoppingBag size={36} />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-bold text-ink-900 text-sm line-clamp-1">{l.title}</h3>
          {cat && <span className="chip text-[10px] bg-sand-100 text-sand-700 shrink-0">{cat.label}</span>}
        </div>
        {l.description && <p className="text-xs text-ink-500 line-clamp-2 mt-1">{l.description}</p>}
        <div className="flex items-center justify-between mt-3">
          <div>
            {l.price > 0 ? (
              <span className="flex items-center font-bold text-forest-700"><IndianRupee size={13} />{l.price.toLocaleString('en-IN')}</span>
            ) : (
              <span className="font-bold text-forest-700 text-sm">Free</span>
            )}
            <span className="text-[10px] text-ink-400 ml-1.5 capitalize">· {l.condition.replace('_', ' ')}</span>
          </div>
          <div className="flex gap-1">
            {onMessage && <button onClick={onMessage} className="p-1.5 rounded-lg text-ink-500 hover:bg-forest-50 hover:text-forest-700" title="Message"><MessageSquare size={14} /></button>}
            {isOwner && <button onClick={onDelete} className="p-1.5 rounded-lg text-ink-400 hover:bg-clay-50 hover:text-clay-600" title="Delete"><Trash2 size={14} /></button>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-ink-100">
          <Avatar name={l.profile?.full_name ?? ''} src={l.profile?.avatar_url} size="xs" />
          <span className="text-[10px] text-ink-500">{l.profile?.full_name || 'Neighbor'} · {timeAgo(l.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

function CreateListingModal({ communities, onClose, onCreated }: { communities: Community[]; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ community_id: communities[0]?.id ?? '', title: '', description: '', price: '', category: 'for_sale' as ListingCategory, condition: 'good' as ListingCondition, image_url: '' });

  const submit = async () => {
    if (!form.title.trim() || !form.community_id) { toast('error', 'Title and community are required'); return; }
    setSaving(true);
    const { error } = await supabase.from('listings').insert({
      community_id: form.community_id,
      title: form.title.trim(),
      description: form.description.trim(),
      price: form.price ? parseFloat(form.price) : 0,
      category: form.category,
      condition: form.condition,
      image_url: form.image_url.trim(),
    });
    if (error) toast('error', error.message);
    else { toast('success', 'Listing created!'); onCreated(); }
    setSaving(false);
  };

  return (
    <Modal open onClose={onClose} title="New Listing" size="md" footer={<><button onClick={onClose} className="btn-secondary">Cancel</button><button onClick={submit} disabled={saving} className="btn-primary">{saving ? 'Posting…' : 'Post Listing'}</button></>}>
      <div className="space-y-4">
        <div>
          <label className="label">Community *</label>
          <select className="input" value={form.community_id} onChange={(e) => setForm((f) => ({ ...f, community_id: e.target.value }))}>
            {communities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Title *</label>
          <input className="input" placeholder="e.g. Wooden dining table" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ListingCategory }))}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Condition</label>
            <select className="input" value={form.condition} onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value as ListingCondition }))}>
              {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Price (₹) — 0 for free</label>
          <input type="number" min="0" className="input" placeholder="0" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input min-h-[80px] resize-y" placeholder="Describe the item…" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </div>
        <div>
          <label className="label">Image URL</label>
          <input className="input" placeholder="https://…" value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} />
        </div>
      </div>
    </Modal>
  );
}
