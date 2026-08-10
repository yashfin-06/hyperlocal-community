import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import { Community } from '../types';
import { Search, MapPin, Users, Plus, ArrowRight } from 'lucide-react';
import { PageLoader, EmptyState } from '../components/Feedback';
import { formatDate } from '../lib/utils';

const CATEGORIES = ['All', 'City', 'Village', 'Neighbourhood', 'Diaspora', 'Culture', 'Other'];

export function CommunitiesPage() {
  const { profile } = useAuth();
  const { navigate } = useRouter();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [myMemberships, setMyMemberships] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      const [{ data: comms }, { data: mems }] = await Promise.all([
        supabase.from('communities').select('*').eq('status', 'approved').order('member_count', { ascending: false }),
        profile
          ? supabase.from('community_members').select('community_id').eq('user_id', profile.id)
          : Promise.resolve({ data: [] }),
      ]);
      setCommunities((comms as Community[]) ?? []);
      setMyMemberships(new Set(((mems ?? []) as { community_id: string }[]).map((m) => m.community_id)));
      setLoading(false);
    }
    load();
  }, [profile]);

  const filtered = communities.filter((c) => {
    const matchSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.city_village.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === 'All' || c.category === catFilter;
    return matchSearch && matchCat;
  });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-900">Communities</h1>
          <p className="text-sm text-ink-500 mt-0.5">Connect with your city, village, or hometown community</p>
        </div>
        <button onClick={() => navigate('/communities/create')} className="btn-primary">
          <Plus size={16} />
          New Community
        </button>
      </div>

      {/* Search + category filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            className="input pl-10"
            placeholder="Search by name or city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              className={`shrink-0 chip transition-colors ${
                catFilter === c
                  ? 'bg-forest-600 text-white'
                  : 'bg-white border border-ink-200 text-ink-600 hover:border-forest-400 hover:text-forest-700'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <PageLoader />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={28} />}
          title="No communities found"
          description="Try a different search or be the first to create one."
          action={
            <button onClick={() => navigate('/communities/create')} className="btn-primary">
              <Plus size={16} /> Create Community
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <CommunityCard
              key={c.id}
              community={c}
              isMember={myMemberships.has(c.id)}
              onClick={() => navigate(`/communities/${c.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CommunityCard({
  community: c,
  isMember,
  onClick,
}: {
  community: Community;
  isMember: boolean;
  onClick: () => void;
}) {
  const catColors: Record<string, string> = {
    City: 'bg-forest-50 text-forest-700',
    Village: 'bg-sand-100 text-sand-700',
    Neighbourhood: 'bg-clay-50 text-clay-700',
    Diaspora: 'bg-ink-100 text-ink-700',
  };
  const catCls = catColors[c.category] ?? 'bg-ink-100 text-ink-600';

  return (
    <button
      onClick={onClick}
      className="card p-5 text-left group hover:shadow-lift hover:-translate-y-0.5 transition-all duration-200 flex flex-col"
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="h-11 w-11 rounded-xl bg-forest-100 text-forest-700 flex items-center justify-center text-lg font-bold shrink-0"
        >
          {c.name.charAt(0).toUpperCase()}
        </div>
        {c.category && (
          <span className={`chip text-[11px] ${catCls}`}>{c.category}</span>
        )}
      </div>
      <h3 className="font-bold text-ink-900 group-hover:text-forest-700 transition-colors">{c.name}</h3>
      <div className="flex items-center gap-1 mt-1 text-xs text-ink-500">
        <MapPin size={11} />
        <span>{c.city_village || 'Location unset'}</span>
      </div>
      {c.description && (
        <p className="text-xs text-ink-500 mt-2 line-clamp-2 flex-1">{c.description}</p>
      )}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-ink-100">
        <div className="flex items-center gap-1 text-xs text-ink-500">
          <Users size={12} />
          <span>{c.member_count.toLocaleString()} members</span>
        </div>
        <div className="flex items-center gap-2">
          {isMember && (
            <span className="chip text-[10px] bg-forest-50 text-forest-700">Joined</span>
          )}
          <ArrowRight size={14} className="text-ink-400 group-hover:text-forest-600 transition-colors" />
        </div>
      </div>
      <p className="text-[10px] text-ink-300 mt-1">Since {formatDate(c.created_at)}</p>
    </button>
  );
}
