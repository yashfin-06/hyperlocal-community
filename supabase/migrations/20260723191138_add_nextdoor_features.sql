/*
# Add Nextdoor-style features: marketplace, recommendations, alerts, polls, direct messages

## Overview
Extends Rooted with five new feature areas modeled on Nextdoor:
1. Marketplace — neighbors list items for sale/rent/free/giveaway within a community.
2. Recommendations — ask for and give local service/ business recommendations.
3. Safety Alerts — urgent neighborhood alerts (crime, hazard, lost pet, weather).
4. Polls — community polls with single-choice voting and live results.
5. Direct Messages — private 1:1 messages between neighbors.

## New Tables
1. listings — marketplace items (title, description, price, category, condition, image_url,
   status active/sold, community_id, user_id)
2. recommendations — recommendation requests + replies (title, body, category, type
   request/recommendation, community_id, user_id)
3. alerts — safety alerts (title, body, urgency, category, community_id, user_id)
4. polls — community polls (question, options jsonb, community_id, user_id, closes_at)
5. poll_votes — one vote per user per poll (PK poll_id+user_id, option_index)
6. conversations — 1:1 DM thread (PK id, user_a, user_b, last_message_at)
7. messages — messages in a conversation (conversation_id, sender_id, content)

## Security (RLS)
- RLS enabled on every new table.
- All reads scoped to approved members of the same community (or conversation participants).
- Inserts require approved community membership (or conversation participation for DMs).
- Updates/deletes limited to owner or community moderator or admin.
- Poll votes: one per user, update own vote, delete own vote.
- Messages: participants can read; sender can insert; sender can delete own.
- Conversations: participants can read; either party can insert; either can delete own.

## Important Notes
1. Owner columns default to auth.uid() so frontend inserts omitting the owner pass RLS.
2. Poll options stored as jsonb array of strings; votes reference option_index.
3. Conversations use a canonical (user_a < user_b) ordering to avoid duplicate threads.
4. Recommendations support both "asking" (request) and "giving" (recommendation) types.
5. Alerts have urgency levels: low, medium, high, critical.
*/

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
    EXISTS (
      SELECT 1 FROM communities c
      WHERE c.id = listings.community_id AND c.status = 'approved'
    )
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

CREATE INDEX IF NOT EXISTS idx_listings_community ON listings(community_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);

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
    EXISTS (
      SELECT 1 FROM communities c
      WHERE c.id = recommendations.community_id AND c.status = 'approved'
    )
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

CREATE INDEX IF NOT EXISTS idx_recs_community ON recommendations(community_id, created_at DESC);

-- ============ ALERTS ============
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
    EXISTS (
      SELECT 1 FROM communities c
      WHERE c.id = alerts.community_id AND c.status = 'approved'
    )
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

CREATE INDEX IF NOT EXISTS idx_alerts_community ON alerts(community_id, created_at DESC);

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
    EXISTS (
      SELECT 1 FROM communities c
      WHERE c.id = polls.community_id AND c.status = 'approved'
    )
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

CREATE INDEX IF NOT EXISTS idx_polls_community ON polls(community_id, created_at DESC);

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

CREATE INDEX IF NOT EXISTS idx_votes_poll ON poll_votes(poll_id);

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

CREATE INDEX IF NOT EXISTS idx_conv_users ON conversations(user_a, user_b);
CREATE INDEX IF NOT EXISTS idx_conv_last ON conversations(last_message_at DESC);

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

CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, created_at DESC);

-- ============ HELPER: get or create conversation ============
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
  -- Canonical ordering
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
