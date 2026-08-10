import { useAuth } from './context/AuthContext';
import { useRouter, matchRoute } from './context/RouterContext';
import { AuthPage } from './pages/AuthPage';
import { AppLayout } from './components/AppLayout';
import { FeedPage } from './pages/FeedPage';
import { CommunitiesPage } from './pages/CommunitiesPage';
import { CreateCommunityPage } from './pages/CreateCommunityPage';
import { CommunityDetailPage } from './pages/CommunityDetailPage';
import { CreateEventPage } from './pages/CreateEventPage';
import { EventsPage } from './pages/EventsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { ModeratorPage } from './pages/ModeratorPage';
import { AdminPage } from './pages/AdminPage';
import { MarketplacePage } from './pages/MarketplacePage';
import { RecommendationsPage } from './pages/RecommendationsPage';
import { AlertsPage } from './pages/AlertsPage';
import { PollsPage } from './pages/PollsPage';
import { MessagesPage } from './pages/MessagesPage';
import { PageLoader } from './components/Feedback';

function AppRoutes() {
  const { path, navigate } = useRouter();
  const { profile, loading } = useAuth();

  if (loading) return <PageLoader label="Loading Rooted…" />;

  if (!profile) {
    return <AuthPage />;
  }

  if (path === '/' || path === '') {
    navigate('/feed');
    return <PageLoader />;
  }

  let page: React.ReactNode;
  let m: { params: Record<string, string> } | null;

  if ((m = matchRoute('/feed', path))) page = <FeedPage />;
  else if ((m = matchRoute('/communities', path))) page = <CommunitiesPage />;
  else if ((m = matchRoute('/communities/create', path))) page = <CreateCommunityPage />;
  else if ((m = matchRoute('/communities/:id/moderate', path))) page = <ModeratorPage communityId={m.params.id} />;
  else if ((m = matchRoute('/communities/:id/events/create', path))) page = <CreateEventPage communityId={m.params.id} />;
  else if ((m = matchRoute('/communities/:id', path))) page = <CommunityDetailPage communityId={m.params.id} />;
  else if ((m = matchRoute('/events', path))) page = <EventsPage />;
  else if ((m = matchRoute('/marketplace', path))) page = <MarketplacePage />;
  else if ((m = matchRoute('/recommendations', path))) page = <RecommendationsPage />;
  else if ((m = matchRoute('/alerts', path))) page = <AlertsPage />;
  else if ((m = matchRoute('/polls', path))) page = <PollsPage />;
  else if ((m = matchRoute('/messages/:id', path))) page = <MessagesPage conversationId={m.params.id} />;
  else if ((m = matchRoute('/messages', path))) page = <MessagesPage />;
  else if ((m = matchRoute('/notifications', path))) page = <NotificationsPage />;
  else if ((m = matchRoute('/profile', path))) page = <ProfilePage />;
  else if ((m = matchRoute('/admin', path))) page = <AdminPage />;
  else {
    page = (
      <div className="text-center py-20">
        <p className="text-lg font-bold text-ink-900">Page not found</p>
        <button onClick={() => navigate('/feed')} className="btn-primary mt-4">Go to Feed</button>
      </div>
    );
  }

  return <AppLayout>{page}</AppLayout>;
}

export default function App() {
  return <AppRoutes />;
}
