// User related types
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin' | 'superadmin';
  profile?: UserProfile;
  createdAt: string;
  lastLogin?: string;
}

export interface UserProfile {
  name: string;
  phone?: string;
  position?: string;
  jerseyNumber?: number;
  joinDate?: string;
  preferredPosition?: string;
  skillRating?: number;
  attendanceRate?: number;
  isActive: boolean;
  notes?: string;
}

// Game related types
export interface Game {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  opponent?: string;
  type: 'match' | 'practice' | 'dinner' | 'other';
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
  participants: string[];
  votes: Vote[];
  createdAt: string;
  updatedAt: string;
}

export interface Vote {
  userId: string;
  username: string;
  vote: 'yes' | 'no' | 'maybe';
  createdAt: string;
}

// Gallery related types
export interface GalleryItem {
  id: string;
  type: 'photo' | 'video';
  src: string;
  thumbnail?: string;
  title: string;
  date: string;
  author: string;
  authorId: string;
  likes: number;
  comments: number;
  isLiked: boolean;
  eventType: '매치' | '자체' | '회식' | '기타';
  tags: string[];
  description?: string;
  commentsList: Comment[];
  uploadDate: string;
  fileSize?: number;
  isGroup?: boolean;
  groupPhotos?: PhotoItem[];
  groupId?: string;
}

export interface PhotoItem {
  id: string;
  src: string;
  thumbnail?: string;
  likes: number;
  isLiked: boolean;
  comments: Comment[];
  fileSize?: number;
}

export interface Comment {
  id: string;
  content: string;
  author: string;
  authorId: string;
  createdAt: string;
  isEditing?: boolean;
}

// Admin related types
export interface SiteSettings {
  teamName: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  foundedYear: number;
  teamMotto: string;
  logo?: string;
}

export interface NotificationSettings {
  gameReminders: {
    enabled: boolean;
    timing: number; // hours before game
    targetAudience: 'all' | 'participants' | 'admins';
  };
  voteReminders: {
    enabled: boolean;
    timing: number; // hours before deadline
    targetAudience: 'all' | 'non-voters' | 'admins';
  };
  newMembers: {
    enabled: boolean;
    targetAudience: 'all' | 'admins';
  };
  gameResults: {
    enabled: boolean;
    targetAudience: 'all' | 'participants' | 'admins';
  };
}

export interface Player extends UserProfile {
  id: string;
  userId: string;
  joinDate: string;
  preferredPosition: string;
  skillRating: number;
  attendanceRate: number;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'general' | 'important' | 'urgent';
  startDate: string;
  endDate?: string;
  isActive: boolean;
  isPinned: boolean;
  author: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

// Statistics types
export interface MemberStats {
  totalMembers: number;
  activeMembers: number;
  newMembersThisMonth: number;
  adminCount: number;
  superAdminCount: number;
  memberDetails: MemberDetail[];
}

export interface MemberDetail {
  id: string;
  name: string;
  role: string;
  joinDate: string;
  lastActivity: string;
  gameCount: number;
  attendanceRate: number;
  isActive: boolean;
}

export interface GameStats {
  totalGames: number;
  thisYearGames: number;
  thisMonthGames: number;
  lastMonthGames: number;
  nextMonthGames: number;
  gameTypes: Record<string, number>;
  monthlyTrends: MonthlyTrend[];
}

export interface MonthlyTrend {
  month: string;
  games: number;
  participants: number;
  averageAttendance: number;
}

export interface ActivityAnalysis {
  topParticipants: TopParticipant[];
  highlights: string[];
  improvementPoints: string[];
  monthlySummary: MonthlySummary;
}

export interface TopParticipant {
  userId: string;
  name: string;
  gamesAttended: number;
  attendanceRate: number;
  totalLikes: number;
  totalComments: number;
}

export interface MonthlySummary {
  month: string;
  totalGames: number;
  totalParticipants: number;
  averageAttendance: number;
  newMembers: number;
  activeUsers: number;
  highlights: string[];
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Form types
export interface UploadFormData {
  title: string;
  files: File[];
  eventType: string;
  description?: string;
}

export interface EditFormData {
  title: string;
  eventType: string;
  description?: string;
}

// Filter and sort types
export type FilterType = 'all' | 'photo' | 'video';
export type SortType = 'latest' | 'oldest' | 'popular' | 'title';
export type EventType = '매치' | '자체' | '회식' | '기타';

// UI state types
export interface UIState {
  isLoading: boolean;
  error: string | null;
  success: string | null;
  modal: {
    isOpen: boolean;
    type: string | null;
    data: any;
  };
}

// Theme types
export interface Theme {
  colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
  };
}

// Utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type Required<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
