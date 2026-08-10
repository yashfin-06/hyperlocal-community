import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { CommunityEvent } from '../types';
import { Calendar, MapPin, Users, Check, Trash2 } from 'lucide-react';
import { formatDateTime, timeAgo, classNames } from '../lib/utils';
import { Avatar } from './Avatar';

interface Props {
  event: CommunityEvent;
  onChanged: () => void;
}

export function EventCard({ event, onChanged }: Props) {
  const { profile } = useAuth();
  const toast = useToast();
  const [participantCount, setParticipantCount] = useState(event.participant_count ?? 0);
  const [joined, setJoined] = useState(event.joined_by_me ?? false);
  const isOwner = event.user_id === profile?.id;

  useEffect(() => {
    if (!profile) return;
    Promise.all([
      supabase.from('event_participants').select('event_id', { count: 'exact', head: true }).eq('event_id', event.id),
      supabase.from('event_participants').select('event_id').eq('event_id', event.id).eq('user_id', profile.id).maybeSingle(),
    ]).then(([{ count }, { data }]) => {
      setParticipantCount(count ?? 0);
      setJoined(!!data);
    });
  }, [event.id, profile]);

  const toggleJoin = async () => {
    if (!profile) return;
    if (joined) {
      await supabase.from('event_participants').delete().eq('event_id', event.id).eq('user_id', profile.id);
      setJoined(false);
      setParticipantCount((c) => Math.max(0, c - 1));
    } else {
      await supabase.from('event_participants').insert({ event_id: event.id, user_id: profile.id });
      setJoined(true);
      setParticipantCount((c) => c + 1);
      if (event.user_id !== profile.id) {
        await supabase.from('notifications').insert({
          user_id: event.user_id,
          type: 'event',
          content: `${profile.full_name || 'Someone'} joined your event: ${event.title}`,
          related_id: event.id,
        });
      }
    }
  };

  const remove = async () => {
    if (!confirm('Delete this event?')) return;
    await supabase.from('events').delete().eq('id', event.id);
    toast('success', 'Event deleted');
    onChanged();
  };

  return (
    <div className="card p-5 animate-fade-up">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl bg-forest-50 text-forest-700 flex flex-col items-center justify-center shrink-0">
          <Calendar size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-ink-900">{event.title}</h3>
            {isOwner && (
              <button onClick={remove} className="text-ink-400 hover:text-clay-600 p-1 rounded hover:bg-clay-50 transition-colors">
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-ink-500">
            <span className="flex items-center gap-1"><Calendar size={11} />{formatDateTime(event.event_date)}</span>
            {event.location && (
              <span className="flex items-center gap-1"><MapPin size={11} />{event.location}</span>
            )}
            <span className="flex items-center gap-1"><Users size={11} />{participantCount} attending</span>
          </div>
          {event.description && (
            <p className="text-sm text-ink-700 mt-2.5 leading-relaxed">{event.description}</p>
          )}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-ink-100">
            <div className="flex items-center gap-2 text-xs text-ink-500">
              <Avatar name={event.profile?.full_name ?? ''} src={event.profile?.avatar_url} size="xs" />
              <span>by {event.profile?.full_name || 'Member'}</span>
              <span className="text-ink-300">· {timeAgo(event.created_at)}</span>
            </div>
            <button
              onClick={toggleJoin}
              className={classNames(
                'btn text-sm py-1.5 px-4',
                joined ? 'bg-forest-50 text-forest-700 hover:bg-forest-100' : 'btn-primary',
              )}
            >
              {joined ? <><Check size={14} /> Going</> : 'Join Event'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
