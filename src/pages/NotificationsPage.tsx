import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Notification } from '../types';
import { PageLoader, EmptyState } from '../components/Feedback';
import { Bell, Heart, MessageSquare, Calendar, UserPlus, AlertCircle } from 'lucide-react';
import { timeAgo, classNames } from '../lib/utils';

const typeIcon: Record<string, typeof Bell> = {
  like: Heart,
  comment: MessageSquare,
  event: Calendar,
  member: UserPlus,
  system: Bell,
  report: AlertCircle,
};

export function NotificationsPage() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });
    setNotifications((data ?? []) as Notification[]);
    // Mark all as read
    await supabase.from('notifications').update({ read: true }).eq('user_id', profile.id).eq('read', false);
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-ink-900">Notifications</h1>
        <p className="text-sm text-ink-500 mt-0.5">Recent activity from your communities</p>
      </div>
      {notifications.length === 0 ? (
        <EmptyState icon={<Bell size={28} />} title="No notifications yet" description="Interact with posts and events to start receiving updates." />
      ) : (
        <div className="card divide-y divide-ink-100">
          {notifications.map((n) => {
            const Icon = typeIcon[n.type] ?? Bell;
            return (
              <div key={n.id} className={classNames('flex items-start gap-3 p-4', !n.read && 'bg-forest-50/50')}>
                <div className="h-9 w-9 rounded-full bg-ink-100 text-ink-600 flex items-center justify-center shrink-0">
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink-800">{n.content}</p>
                  <p className="text-xs text-ink-400 mt-0.5">{timeAgo(n.created_at)}</p>
                </div>
                {!n.read && <span className="h-2 w-2 rounded-full bg-clay-500 mt-1.5 shrink-0" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
