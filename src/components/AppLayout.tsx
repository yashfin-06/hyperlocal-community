import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import { Logo } from '../components/Logo';
import { Avatar } from '../components/Avatar';
import {
  Home, Users, Bell, User, ChevronDown, Calendar,
  Menu, X, PlusCircle, LogOut, Shield, MessageCircle,
  ShoppingBag, ThumbsUp, AlertTriangle, BarChart3, MoreHorizontal,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { classNames } from '../lib/utils';

const mainNav = [
  { label: 'Feed', icon: Home, href: '/feed' },
  { label: 'Communities', icon: Users, href: '/communities' },
  { label: 'Events', icon: Calendar, href: '/events' },
];

const moreNav = [
  { label: 'Marketplace', icon: ShoppingBag, href: '/marketplace' },
  { label: 'Recommendations', icon: ThumbsUp, href: '/recommendations' },
  { label: 'Alerts', icon: AlertTriangle, href: '/alerts' },
  { label: 'Polls', icon: BarChart3, href: '/polls' },
];

const allNav = [...mainNav, ...moreNav];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const { path, navigate } = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [unreadMsgs, setUnreadMsgs] = useState(0);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('read', false)
      .then(({ count }) => setUnread(count ?? 0));
    // Unread messages count
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('read', false)
      .neq('sender_id', profile.id)
      .then(({ count }) => setUnreadMsgs(count ?? 0));
  }, [profile, path]);

  const active = (href: string) => path.startsWith(href);
  const isMoreActive = moreNav.some((n) => active(n.href));

  return (
    <div className="min-h-screen bg-sand-50">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-ink-100 shadow-soft">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex h-16 items-center justify-between gap-2">
          <button onClick={() => navigate('/feed')} className="flex-shrink-0">
            <Logo size="sm" />
          </button>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {mainNav.map((n) => (
              <button
                key={n.href}
                onClick={() => navigate(n.href)}
                className={classNames(
                  'flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-semibold transition-all duration-200',
                  active(n.href)
                    ? 'bg-forest-50 text-forest-700'
                    : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
                )}
              >
                <n.icon size={16} />
                {n.label}
              </button>
            ))}
            {/* More dropdown */}
            <div className="relative">
              <button
                onClick={() => setMoreOpen((o) => !o)}
                className={classNames(
                  'flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-semibold transition-all duration-200',
                  isMoreActive
                    ? 'bg-forest-50 text-forest-700'
                    : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
                )}
              >
                <MoreHorizontal size={16} />
                More
                <ChevronDown size={12} className={moreOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
              </button>
              {moreOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMoreOpen(false)} />
                  <div className="absolute left-0 top-full mt-2 z-20 w-52 card py-1">
                    {moreNav.map((n) => (
                      <button
                        key={n.href}
                        onClick={() => { navigate(n.href); setMoreOpen(false); }}
                        className={classNames(
                          'w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold transition-colors text-left',
                          active(n.href) ? 'text-forest-700 bg-forest-50' : 'text-ink-700 hover:bg-ink-50',
                        )}
                      >
                        <n.icon size={16} className="text-ink-500" />
                        {n.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </nav>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigate('/communities/create')}
              className="hidden lg:flex btn-primary gap-2 px-4 py-2 text-sm"
            >
              <PlusCircle size={16} />
              New Community
            </button>

            {/* Messages */}
            <button
              onClick={() => navigate('/messages')}
              className={classNames(
                'relative rounded-full h-10 w-10 flex items-center justify-center transition-colors',
                active('/messages')
                  ? 'bg-forest-50 text-forest-700'
                  : 'text-ink-600 hover:bg-ink-100',
              )}
              aria-label="Messages"
            >
              <MessageCircle size={20} />
              {unreadMsgs > 0 && (
                <span className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-forest-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadMsgs > 9 ? '9+' : unreadMsgs}
                </span>
              )}
            </button>

            {/* Notifications */}
            <button
              onClick={() => navigate('/notifications')}
              className={classNames(
                'relative rounded-full h-10 w-10 flex items-center justify-center transition-colors',
                active('/notifications')
                  ? 'bg-forest-50 text-forest-700'
                  : 'text-ink-600 hover:bg-ink-100',
              )}
              aria-label="Notifications"
            >
              <Bell size={20} />
              {unread > 0 && (
                <span className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-clay-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            {/* Profile dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen((o) => !o)}
                className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-ink-100 transition-colors"
              >
                <Avatar name={profile?.full_name ?? ''} src={profile?.avatar_url} size="sm" />
                <ChevronDown size={14} className="text-ink-400" />
              </button>
              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 z-20 w-52 card py-1 divide-y divide-ink-100">
                    <div className="px-4 py-3">
                      <p className="text-sm font-semibold text-ink-900 truncate">{profile?.full_name || 'User'}</p>
                      <p className="text-xs text-ink-400 truncate">{profile?.hometown || 'No hometown set'}</p>
                    </div>
                    <div className="py-1">
                      {[
                        { label: 'My Profile', icon: User, href: '/profile' },
                        ...(profile?.role === 'admin'
                          ? [{ label: 'Admin Dashboard', icon: Shield, href: '/admin' }]
                          : []),
                      ].map((item) => (
                        <button
                          key={item.href}
                          onClick={() => { navigate(item.href); setProfileOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-ink-700 hover:bg-ink-50 transition-colors"
                        >
                          <item.icon size={16} className="text-ink-500" />
                          {item.label}
                        </button>
                      ))}
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => { signOut(); setProfileOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-clay-700 hover:bg-clay-50 transition-colors"
                      >
                        <LogOut size={16} />
                        Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden rounded-full h-10 w-10 flex items-center justify-center text-ink-700 hover:bg-ink-100"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Menu"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {menuOpen && (
          <div className="md:hidden border-t border-ink-100 bg-white px-4 py-3 space-y-1 max-h-[70vh] overflow-y-auto">
            {allNav.map((n) => (
              <button
                key={n.href}
                onClick={() => { navigate(n.href); setMenuOpen(false); }}
                className={classNames(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                  active(n.href) ? 'bg-forest-50 text-forest-700' : 'text-ink-600 hover:bg-ink-50',
                )}
              >
                <n.icon size={18} />
                {n.label}
              </button>
            ))}
            <button
              onClick={() => { navigate('/messages'); setMenuOpen(false); }}
              className={classNames(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                active('/messages') ? 'bg-forest-50 text-forest-700' : 'text-ink-600 hover:bg-ink-50',
              )}
            >
              <MessageCircle size={18} />
              Messages
            </button>
            <button
              onClick={() => { navigate('/communities/create'); setMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-forest-700 hover:bg-forest-50 transition-colors"
            >
              <PlusCircle size={18} />
              New Community
            </button>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>
    </div>
  );
}
