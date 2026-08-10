/*
# Create hyperlocal community platform schema

## Overview
Full data model for a hyperlocal community platform: users connect with hometown /
city / village communities, share posts & announcements, organize events, and receive
notifications. Supports three roles: regular user, community moderator, platform admin.

## New Tables
1. profiles — extends auth.users (full_name, hometown, current_city, avatar_url, bio, role)
2. communities — city/village community (name, city_village, description, category, rules,
   member_count, status pending/approved/rejected, created_by, created_at)
3. community_members — membership + moderator role per community (PK community_id+user_id)
4. posts — text/image posts & announcements (community_id, user_id, content, image_url,
   type post/announcement, pinned)
5. comments — comments on posts
6. likes — likes on posts (PK post_id+user_id)
7. events — community events (title, description, location, event_date)
8. event_participants — who is attending (PK event_id+user_id)
9. notifications — user-facing notifications (type, content, related_id, read)
10. abuse_reports — reports against posts/comments/users (target_type, target_id, reason, status)

## Security (RLS)
- RLS enabled on every table.
- Profiles: authenticated read all, insert/update own.
- Communities: read approved (or own, or admin); insert own; update/delete own or admin.
- Community members: read if community approved or own or admin; insert own; update/delete
  own or moderator-of-community or admin.
- Posts: read if community approved; insert if approved member; update/delete own or
  moderator-of-community or admin (delete).
- Comments: read if community approved; insert if approved member; delete own or moderator
  or admin.
- Likes: read all; insert if approved member; delete own.
- Events: read if community approved; insert if approved member; delete own or moderator
  or admin.
- Event participants: read if community approved; insert if approved member; delete own.
- Notifications: full CRUD on own rows.
- Abuse reports: read own or admin; insert own; update admin.

## Important Notes
1. Owner columns default to auth.uid() so frontend inserts omitting the owner pass RLS.
2. member_count maintained by the application (incremented on join).
3. Platform admins identified by profiles.role = 'admin' via EXISTS subqueries in policies.
4. Email confirmation stays OFF.
*/

-- Profiles
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

-- Communities
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

-- Community members
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

-- Posts
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

-- Comments
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

-- Likes
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

-- Events
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

-- Event participants
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

-- Notifications
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

-- Abuse reports
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_communities_status ON communities(status);
CREATE INDEX IF NOT EXISTS idx_communities_city ON communities(city_village);
CREATE INDEX IF NOT EXISTS idx_posts_community_created ON posts(community_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_events_community_date ON events(community_id, event_date);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_members_user ON community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_community ON community_members(community_id);

-- Auto-create profile on signup
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
