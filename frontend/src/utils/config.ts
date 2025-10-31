// Application Configuration
export const APP_CONFIG = {
  name: 'FCCG',
  version: '1.0.0',
  description: '축구팀 관리 시스템',
} as const;

// YouTube API Configuration
export const YOUTUBE_CONFIG = {
  apiKey: import.meta.env.VITE_YOUTUBE_API_KEY || '',
  playlistId: import.meta.env.VITE_YOUTUBE_PLAYLIST_ID || 'PLQ5o2f7efzlZ-RDG64h4Oj_5pXt0g6q3b',
} as const;

// Storage Configuration
export const STORAGE_CONFIG = {
  maxSize: 5 * 1024 * 1024, // 5MB
  maxFilesPerUpload: 10,
  maxFileSize: 0.5 * 1024 * 1024, // 0.5MB
  cleanupThreshold: 20, // Keep latest 20 items
} as const;

// UI Configuration
export const UI_CONFIG = {
  colors: {
    primary: '#004ea8',
    success: '#38A169',
    warning: '#DD6B20',
    error: '#E53E3E',
  },
  breakpoints: {
    mobile: '320px',
    tablet: '768px',
    desktop: '1200px',
  },
} as const;

// Feature Flags
export const FEATURES = {
  enableImageCompression: true,
  enableAutoCleanup: true,
  enableAnalytics: false,
  enableNotifications: true,
} as const;
