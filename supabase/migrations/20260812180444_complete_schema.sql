-- ============================================================
-- Rooted — Hyperlocal Community Platform
-- Complete Supabase SQL Schema (consolidated, executable)
-- ============================================================

-- ============ PROFILES ============
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  hometown text DEFAULT '',
  current_city text DEFAULT '',
  avatar_url text DEFAULT '',
  bio text DEFAULT '',
  role text NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============ COMMUNITIES ============
CREATE TABLE IF NOT EXISTS communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city_village text NOT NULL DEFAULT '',
  description text DEFAULT '',
  category text DEFAULT '',
  rules text DEFAULT '',
  member_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "communities_select_approved" ON communities;
CREATE POLICY "communities_select_approved" ON communities FOR SELECT
  TO authenticated USING (
    status = 'approved'
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "communities_insert_own" ON communities;
CREATE POLICY "communities_insert_own" ON communities FOR INSERT
  TO authenticated WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "communities_update_own_or_admin" ON communities;
CREATE POLICY "communities_update_own_or_admin" ON communities FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (created_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "communities_delete_own_or_admin" ON communities;
CREATE POLICY "communities_delete_own_or_admin" ON communities FOR DELETE
  TO authenticated USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ============ COMMUNITY MEMBERS ============
CREATE TABLE IF NOT EXISTS community_members (
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'approved',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, user_id)
);
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_select_in_community" ON community_members;
CREATE POLICY "members_select_in_community" ON community_members FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM communities c WHERE c.id = community_id AND c.status = 'approved')
    OR user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "members_insert_own" ON community_members;
CREATE POLICY "members_insert_own" ON community_members FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "members_update_own_or_mod" ON community_members;
CREATE POLICY "members_update_own_or_mod" ON community_members FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM community_members m
      WHERE m.community_id = community_members.community_id
        AND m.user_id = auth.uid() AND m.role = 'moderator'
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM community_members m
      WHERE m.community_id = community_members.community_id
        AND m.user_id = auth.uid() AND m.role = 'moderator'
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "members_delete_own_or_mod" ON community_members;
CREATE POLICY "members_delete_own_or_mod" ON community_members FOR DELETE
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM community_members m
      WHERE m.community_id = community_members.community_id
        AND m.user_id = auth.uid() AND m.role = 'moderator'
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============ POSTS ============
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  image_url text DEFAULT '',
  type text NOT NULL DEFAULT 'post',
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posts_select_in_community" ON posts;
CREATE POLICY "posts_select_in_community" ON posts FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM communities c WHERE c.id = community_id AND c.status = 'approved')
  );

DROP POLICY IF EXISTS "posts_insert_member" ON posts;
CREATE POLICY "posts_insert_member" ON posts FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM community_members m
      WHERE m.community_id = posts.community_id AND m.user_id = auth.uid() AND m.status = 'approved'
    )
  );

DROP POLICY IF EXISTS "posts_update_own_or_mod" ON posts;
CREATE POLICY "posts_update_own_or_mod" ON posts FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM community_members m
      WHERE m.community_id = posts.community_id AND m.user_id = auth.uid() AND m.role = 'moderator'
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM community_members m
      WHERE m.community_id = posts.community_id AND m.user_id = auth.uid() AND m.role = 'moderator'
    )
  );

DROP POLICY IF EXISTS "posts_delete_own_or_mod" ON posts;
CREATE POLICY "posts_delete_own_or_mod" ON posts FOR DELETE
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM community_members m
      WHERE m.community_id = posts.community_id AND m.user_id = auth.uid() AND m.role = 'moderator'
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============ COMMENTS ============
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments_select_in_community" ON comments;
CREATE POLICY "comments_select_in_community" ON comments FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM posts p
      JOIN communities c ON c.id = p.community_id
      WHERE p.id = comments.post_id AND c.status = 'approved'
    )
  );

DROP POLICY IF EXISTS "comments_insert_member" ON comments;
CREATE POLICY "comments_insert_member" ON comments FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM posts p
      JOIN community_members m ON m.community_id = p.community_id
      WHERE p.id = comments.post_id AND m.user_id = auth.uid() AND m.status = 'approved'
    )
  );

DROP POLICY IF EXISTS "comments_delete_own_or_mod" ON comments;
CREATE POLICY "comments_delete_own_or_mod" ON comments FOR DELETE
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM posts p
      JOIN community_members m ON m.community_id = p.community_id
      WHERE p.id = comments.post_id AND m.user_id = auth.uid() AND m.role = 'moderator'
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============ LIKES ============
CREATE TABLE IF NOT EXISTS likes (
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "likes_select_all" ON likes;
CREATE POLICY "likes_select_all" ON likes FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "likes_insert_own_member" ON likes;
CREATE POLICY "likes_insert_own_member" ON likes FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM posts p
      JOIN community_members m ON m.community_id = p.community_id
      WHERE p.id = likes.post_id AND m.user_id = auth.uid() AND m.status = 'approved'
    )
  );

DROP POLICY IF EXISTS "likes_delete_own" ON likes;
CREATE POLICY "likes_delete_own" ON likes FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- ============ EVENTS ============
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text DEFAULT '',
  location text DEFAULT '',
  event_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events_select_in_community" ON events;
CREATE POLICY "events_select_in_community" ON events FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM communities c WHERE c.id = community_id AND c.status = 'approved')
  );

DROP POLICY IF EXISTS "events_insert_member" ON events;
CREATE POLICY "events_insert_member" ON events FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM community_members m
      WHERE m.community_id = events.community_id AND m.user_id = auth.uid() AND m.status = 'approved'
    )
  );

DROP POLICY IF EXISTS "events_delete_own_or_mod" ON events;
CREATE POLICY "events_delete_own_or_mod" ON events FOR DELETE
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM community_members m
      WHERE m.community_id = events.community_id AND m.user_id = auth.uid() AND m.role = 'moderator'
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============ EVENT PARTICIPANTS ============
CREATE TABLE IF NOT EXISTS event_participants (
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participants_select_in_community" ON event_participants;
CREATE POLICY "participants_select_in_community" ON event_participants FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN communities c ON c.id = e.community_id
      WHERE e.id = event_participants.event_id AND c.status = 'approved'
    )
  );

DROP POLICY IF EXISTS "participants_insert_own_member" ON event_participants;
CREATE POLICY "participants_insert_own_member" ON event_participants FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM events e
      JOIN community_members m ON m.community_id = e.community_id
      WHERE e.id = event_participants.event_id AND m.user_id = auth.uid() AND m.status = 'approved'
    )
  );

DROP POLICY IF EXISTS "participants_delete_own" ON event_participants;
CREATE POLICY "participants_delete_own" ON event_participants FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- ============ NOTIFICATIONS ============
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  related_id uuid,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
CREATE POLICY "notifications_insert_own" ON notifications FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_delete_own" ON notifications FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- ============ ABUSE REPORTS ============
CREATE TABLE IF NOT EXISTS abuse_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL DEFAULT '',
  target_id uuid NOT NULL,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE abuse_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_select_own_or_admin" ON abuse_reports;
CREATE POLICY "reports_select_own_or_admin" ON abuse_reports FOR SELECT
  TO authenticated USING (
    reporter_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "reports_insert_own" ON abuse_reports;
CREATE POLICY "reports_insert_own" ON abuse_reports FOR INSERT
  TO authenticated WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "reports_update_admin" ON abuse_reports;
CREATE POLICY "reports_update_admin" ON abuse_reports FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ============ LISTINGS (Marketplace) ============
CREATE TABLE IF NOT EXISTS listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  description text DEFAULT '',
  price numeric(10,2) NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'other',
  condition text NOT NULL DEFAULT 'good',
  image_url text DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listings_select_member" ON listings;
CREATE POLICY "listings_select_member" ON listings FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM communities c WHERE c.id = listings.community_id AND c.status = 'approved')
  );

DROP POLICY IF EXISTS "listings_insert_member" ON listings;
CREATE POLICY "listings_insert_member" ON listings FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM community_members m
      WHERE m.community_id = listings.community_id AND m.user_id = auth.uid() AND m.status = 'approved'
    )
  );

DROP POLICY IF EXISTS "listings_update_own_or_mod" ON listings;
CREATE POLICY "listings_update_own_or_mod" ON listings FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM community_members m
      WHERE m.community_id = listings.community_id AND m.user_id = auth.uid() AND m.role = 'moderator'
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "listings_delete_own_or_mod" ON listings;
CREATE POLICY "listings_delete_own_or_mod" ON listings FOR DELETE
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM community_members m
      WHERE m.community_id = listings.community_id AND m.user_id = auth.uid() AND m.role = 'moderator'
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============ RECOMMENDATIONS ============
CREATE TABLE IF NOT EXISTS recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  body text DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  type text NOT NULL DEFAULT 'recommendation',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recs_select_member" ON recommendations;
CREATE POLICY "recs_select_member" ON recommendations FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM communities c WHERE c.id = recommendations.community_id AND c.status = 'approved')
  );

DROP POLICY IF EXISTS "recs_insert_member" ON recommendations;
CREATE POLICY "recs_insert_member" ON recommendations FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM community_members m
      WHERE m.community_id = recommendations.community_id AND m.user_id = auth.uid() AND m.status = 'approved'
    )
  );

DROP POLICY IF EXISTS "recs_delete_own_or_mod" ON recommendations;
CREATE POLICY "recs_delete_own_or_mod" ON recommendations FOR DELETE
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM community_members m
      WHERE m.community_id = recommendations.community_id AND m.user_id = auth.uid() AND m.role = 'moderator'
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============ ALERTS (Safety) ============
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  body text DEFAULT '',
  urgency text NOT NULL DEFAULT 'medium',
  category text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alerts_select_member" ON alerts;
CREATE POLICY "alerts_select_member" ON alerts FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM communities c WHERE c.id = alerts.community_id AND c.status = 'approved')
  );

DROP POLICY IF EXISTS "alerts_insert_member" ON alerts;
CREATE POLICY "alerts_insert_member" ON alerts FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM community_members m
      WHERE m.community_id = alerts.community_id AND m.user_id = auth.uid() AND m.status = 'approved'
    )
  );

DROP POLICY IF EXISTS "alerts_delete_own_or_mod" ON alerts;
CREATE POLICY "alerts_delete_own_or_mod" ON alerts FOR DELETE
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM community_members m
      WHERE m.community_id = alerts.community_id AND m.user_id = auth.uid() AND m.role = 'moderator'
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============ POLLS ============
CREATE TABLE IF NOT EXISTS polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  question text NOT NULL DEFAULT '',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  closes_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "polls_select_member" ON polls;
CREATE POLICY "polls_select_member" ON polls FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM communities c WHERE c.id = polls.community_id AND c.status = 'approved')
  );

DROP POLICY IF EXISTS "polls_insert_member" ON polls;
CREATE POLICY "polls_insert_member" ON polls FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM community_members m
      WHERE m.community_id = polls.community_id AND m.user_id = auth.uid() AND m.status = 'approved'
    )
  );

DROP POLICY IF EXISTS "polls_delete_own_or_mod" ON polls;
CREATE POLICY "polls_delete_own_or_mod" ON polls FOR DELETE
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM community_members m
      WHERE m.community_id = polls.community_id AND m.user_id = auth.uid() AND m.role = 'moderator'
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============ POLL VOTES ============
CREATE TABLE IF NOT EXISTS poll_votes (
  poll_id uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  option_index integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "votes_select_member" ON poll_votes;
CREATE POLICY "votes_select_member" ON poll_votes FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM polls p
      JOIN communities c ON c.id = p.community_id
      WHERE p.id = poll_votes.poll_id AND c.status = 'approved'
    )
  );

DROP POLICY IF EXISTS "votes_insert_own_member" ON poll_votes;
CREATE POLICY "votes_insert_own_member" ON poll_votes FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM polls p
      JOIN community_members m ON m.community_id = p.community_id
      WHERE p.id = poll_votes.poll_id AND m.user_id = auth.uid() AND m.status = 'approved'
    )
  );

DROP POLICY IF EXISTS "votes_update_own" ON poll_votes;
CREATE POLICY "votes_update_own" ON poll_votes FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "votes_delete_own" ON poll_votes;
CREATE POLICY "votes_delete_own" ON poll_votes FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- ============ CONVERSATIONS (Direct Messages) ============
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conv_order CHECK (user_a <> user_b)
);
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conv_select_participant" ON conversations;
CREATE POLICY "conv_select_participant" ON conversations FOR SELECT
  TO authenticated USING (user_a = auth.uid() OR user_b = auth.uid());

DROP POLICY IF EXISTS "conv_insert_participant" ON conversations;
CREATE POLICY "conv_insert_participant" ON conversations FOR INSERT
  TO authenticated WITH CHECK (user_a = auth.uid() OR user_b = auth.uid());

DROP POLICY IF EXISTS "conv_update_participant" ON conversations;
CREATE POLICY "conv_update_participant" ON conversations FOR UPDATE
  TO authenticated USING (user_a = auth.uid() OR user_b = auth.uid())
  WITH CHECK (user_a = auth.uid() OR user_b = auth.uid());

DROP POLICY IF EXISTS "conv_delete_participant" ON conversations;
CREATE POLICY "conv_delete_participant" ON conversations FOR DELETE
  TO authenticated USING (user_a = auth.uid() OR user_b = auth.uid());

-- ============ MESSAGES ============
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "msg_select_participant" ON messages;
CREATE POLICY "msg_select_participant" ON messages FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
  );

DROP POLICY IF EXISTS "msg_insert_participant" ON messages;
CREATE POLICY "msg_insert_participant" ON messages FOR INSERT
  TO authenticated WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
  );

DROP POLICY IF EXISTS "msg_update_participant" ON messages;
CREATE POLICY "msg_update_participant" ON messages FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
  );

DROP POLICY IF EXISTS "msg_delete_sender" ON messages;
CREATE POLICY "msg_delete_sender" ON messages FOR DELETE
  TO authenticated USING (sender_id = auth.uid());

-- ============ CONTENT CATEGORIES (Admin-managed) ============
CREATE TABLE IF NOT EXISTS content_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE content_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_select_all" ON content_categories;
CREATE POLICY "categories_select_all" ON content_categories FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "categories_insert_admin" ON content_categories;
CREATE POLICY "categories_insert_admin" ON content_categories FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "categories_update_admin" ON content_categories;
CREATE POLICY "categories_update_admin" ON content_categories FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "categories_delete_admin" ON content_categories;
CREATE POLICY "categories_delete_admin" ON content_categories FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_communities_status        ON communities(status);
CREATE INDEX IF NOT EXISTS idx_communities_city           ON communities(city_village);
CREATE INDEX IF NOT EXISTS idx_posts_community_created    ON posts(community_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_created      ON comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_likes_post                 ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_events_community_date      ON events(community_id, event_date);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_members_user                ON community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_community           ON community_members(community_id);
CREATE INDEX IF NOT EXISTS idx_listings_community          ON listings(community_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_status             ON listings(status);
CREATE INDEX IF NOT EXISTS idx_recs_community              ON recommendations(community_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_community            ON alerts(community_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_polls_community             ON polls(community_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_votes_poll                  ON poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_conv_users                 ON conversations(user_a, user_b);
CREATE INDEX IF NOT EXISTS idx_conv_last                   ON conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_msg_conv                    ON messages(conversation_id, created_at DESC);

-- ============ TRIGGERS ============
-- Auto-create a profile row when a new auth.user signs up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, hometown, current_city)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'hometown', ''),
    COALESCE(NEW.raw_user_meta_data->>'current_city', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ FUNCTIONS / RPCs ============
-- Atomically increment a community's member_count by 1 (called on member approval).
CREATE OR REPLACE FUNCTION public.increment_member_count(cid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.communities SET member_count = member_count + 1 WHERE id = cid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_member_count(uuid) TO authenticated;

-- Get or create a 1:1 DM conversation between the current user and another user.
-- Uses canonical (user_a < user_b) ordering to prevent duplicate threads.
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(other_user uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  conv_id uuid;
  a uuid := auth.uid();
  b uuid := other_user;
  first_user uuid;
  second_user uuid;
BEGIN
  IF a IS NULL OR b IS NULL OR a = b THEN
    RAISE EXCEPTION 'Invalid conversation participants';
  END IF;
  IF a < b THEN
    first_user := a; second_user := b;
  ELSE
    first_user := b; second_user := a;
  END IF;
  SELECT id INTO conv_id FROM public.conversations
  WHERE user_a = first_user AND user_b = second_user;
  IF conv_id IS NULL THEN
    INSERT INTO public.conversations (user_a, user_b) VALUES (first_user, second_user)
    RETURNING id INTO conv_id;
  END IF;
  RETURN conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(uuid) TO authenticated;

-- ============ SEED DATA ============
INSERT INTO content_categories (name, description) VALUES
  ('City', 'Urban community'),
  ('Village', 'Rural community'),
  ('Neighbourhood', 'Local neighbourhood'),
  ('Diaspora', 'Diaspora community'),
  ('Culture', 'Cultural community'),
  ('Other', 'Other type')
ON CONFLICT (name) DO NOTHING;
