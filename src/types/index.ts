export type UserRole = 'user' | 'moderator' | 'admin';

export interface Profile {
  id: string;
  full_name: string;
  hometown: string;
  current_city: string;
  avatar_url: string;
  bio: string;
  role: UserRole;
  created_at: string;
}

export type CommunityStatus = 'pending' | 'approved' | 'rejected';

export interface Community {
  id: string;
  name: string;
  city_village: string;
  description: string;
  category: string;
  rules: string;
  member_count: number;
  status: CommunityStatus;
  created_by: string;
  created_at: string;
}

export type MemberRole = 'member' | 'moderator';
export type MemberStatus = 'pending' | 'approved';

export interface CommunityMember {
  community_id: string;
  user_id: string;
  role: MemberRole;
  status: MemberStatus;
  joined_at: string;
  profile?: Profile;
}

export type PostType = 'post' | 'announcement';

export interface Post {
  id: string;
  community_id: string;
  user_id: string;
  content: string;
  image_url: string;
  type: PostType;
  pinned: boolean;
  created_at: string;
  profile?: Profile;
  like_count?: number;
  comment_count?: number;
  liked_by_me?: boolean;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: Profile;
}

export interface Like {
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface CommunityEvent {
  id: string;
  community_id: string;
  user_id: string;
  title: string;
  description: string;
  location: string;
  event_date: string | null;
  created_at: string;
  profile?: Profile;
  participant_count?: number;
  joined_by_me?: boolean;
}

export interface EventParticipant {
  event_id: string;
  user_id: string;
  joined_at: string;
}

export type NotificationType = 'comment' | 'like' | 'event' | 'member' | 'system' | 'report';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  content: string;
  related_id: string | null;
  read: boolean;
  created_at: string;
}

export type AbuseTargetType = 'post' | 'comment' | 'user';
export type ReportStatus = 'open' | 'resolved' | 'dismissed';

export interface AbuseReport {
  id: string;
  reporter_id: string;
  target_type: AbuseTargetType;
  target_id: string;
  reason: string;
  status: ReportStatus;
  created_at: string;
  reporter?: Profile;
}

// ============ Nextdoor-style features ============

export type ListingCategory = 'for_sale' | 'rental' | 'free' | 'services' | 'lost_found' | 'other';
export type ListingCondition = 'new' | 'like_new' | 'good' | 'fair' | 'poor';
export type ListingStatus = 'active' | 'sold' | 'removed';

export interface Listing {
  id: string;
  community_id: string;
  user_id: string;
  title: string;
  description: string;
  price: number;
  category: ListingCategory;
  condition: ListingCondition;
  image_url: string;
  status: ListingStatus;
  created_at: string;
  profile?: Profile;
}

export type RecommendationType = 'request' | 'recommendation';
export type RecommendationCategory = 'plumber' | 'electrician' | 'tutor' | 'doctor' | 'restaurant' | 'general';

export interface Recommendation {
  id: string;
  community_id: string;
  user_id: string;
  title: string;
  body: string;
  category: RecommendationCategory;
  type: RecommendationType;
  created_at: string;
  profile?: Profile;
}

export type AlertUrgency = 'low' | 'medium' | 'high' | 'critical';
export type AlertCategory = 'crime' | 'hazard' | 'lost_pet' | 'weather' | 'traffic' | 'general';

export interface Alert {
  id: string;
  community_id: string;
  user_id: string;
  title: string;
  body: string;
  urgency: AlertUrgency;
  category: AlertCategory;
  created_at: string;
  profile?: Profile;
}

export interface Poll {
  id: string;
  community_id: string;
  user_id: string;
  question: string;
  options: string[];
  closes_at: string | null;
  created_at: string;
  profile?: Profile;
  votes?: number[];
  my_vote?: number | null;
  total_votes?: number;
}

export interface PollVote {
  poll_id: string;
  user_id: string;
  option_index: number;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_a: string;
  user_b: string;
  last_message_at: string;
  created_at: string;
  other_profile?: Profile;
  last_message?: Message;
  unread_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

export interface ContentCategory {
  id: string;
  name: string;
  description: string;
  created_at: string;
}
