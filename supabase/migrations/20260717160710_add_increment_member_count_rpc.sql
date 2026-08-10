/*
# Add increment_member_count RPC

## Overview
Adds a SECURITY DEFINER function to atomically increment a community's member_count
by 1. Used when a user joins a community. Keeps the denormalized count in sync without
exposing communities to unrestricted writes.

## New Functions
- `increment_member_count(cid uuid)` — increments `communities.member_count` by 1 for
  the given community id. Returns void.

## Security
- SECURITY DEFINER so it can run with elevated privileges for the atomic update.
- No arguments beyond the community id; safe to expose via RPC.
*/

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
