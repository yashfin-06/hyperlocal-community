import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { CommunityEvent } from '../types';
import { EventCard } from '../components/EventCard';
import { PageLoader, EmptyState } from '../components/Feedback';
import { Calendar } from 'lucide-react';

export function EventsPage() {
  const { profile } = useAuth();
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [loading, setLoading] = useState(true);
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
      setEvents([]);
      setLoading(false);
      return;
    }
    const { data: e } = await supabase
      .from('events')
      .select('*, profile:profiles!user_id(*)')
      .in('community_id', communityIds)
      .order('event_date', { ascending: true });
    setEvents((e ?? []) as CommunityEvent[]);
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (loading) return <PageLoader />;

  const upcoming = events.filter((e) => !e.event_date || new Date(e.event_date) >= new Date());
  const past = events.filter((e) => e.event_date && new Date(e.event_date) < new Date());

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-ink-900">Events</h1>
        <p className="text-sm text-ink-500 mt-0.5">Gatherings from your communities</p>
      </div>
      {events.length === 0 ? (
        <EmptyState icon={<Calendar size={28} />} title="No events yet" description="Join a community and create events to see them here." />
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wide text-ink-400 mb-3">Upcoming</h2>
              <div className="space-y-4">
                {upcoming.map((e) => <EventCard key={e.id} event={e} onChanged={() => setRefreshKey((k) => k + 1)} />)}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wide text-ink-400 mb-3">Past</h2>
              <div className="space-y-4 opacity-75">
                {past.map((e) => <EventCard key={e.id} event={e} onChanged={() => setRefreshKey((k) => k + 1)} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
