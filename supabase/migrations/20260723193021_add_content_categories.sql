/*
# Add content categories table for admin management
## Overview
Platform admins can manage a set of content categories/tags that users can
pick from when creating communities. This table stores the canonical list.
## Security
- RLS enabled. Anyone authenticated can read (for dropdowns).
- Only admins can insert/update/delete.
*/
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

-- Seed default categories
INSERT INTO content_categories (name, description) VALUES
('City', 'Urban community'),
('Village', 'Rural community'),
('Neighbourhood', 'Local neighbourhood'),
('Diaspora', 'Diaspora community'),
('Culture', 'Cultural community'),
('Other', 'Other type')
ON CONFLICT (name) DO NOTHING;
