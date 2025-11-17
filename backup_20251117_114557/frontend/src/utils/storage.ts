import { STORAGE_CONFIG } from './config';

// Storage Keys
export const STORAGE_KEYS = {
  GALLERY_ITEMS: 'galleryItems',
  SITE_SETTINGS: 'siteSettings',
  NOTIFICATION_SETTINGS: 'notificationSettings',
  PLAYERS: 'players',
  ANNOUNCEMENTS: 'announcements',
  USER_PREFERENCES: 'userPreferences',
} as const;

// Storage Utility Functions
export const storage = {
  // Get item from localStorage
  get: <T>(key: string, defaultValue?: T): T | null => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue || null;
    } catch (error) {
      console.error(`Error reading from localStorage: ${key}`, error);
      return defaultValue || null;
    }
  },

  // Set item to localStorage
  set: <T>(key: string, value: T): boolean => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Error writing to localStorage: ${key}`, error);
      return false;
    }
  },

  // Remove item from localStorage
  remove: (key: string): boolean => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Error removing from localStorage: ${key}`, error);
      return false;
    }
  },

  // Clear all localStorage
  clear: (): boolean => {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('Error clearing localStorage', error);
      return false;
    }
  },

  // Check if localStorage is available
  isAvailable: (): boolean => {
    try {
      const test = '__localStorage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  },

  // Get storage usage
  getUsage: (): { used: number; total: number; percentage: number } => {
    try {
      let used = 0;
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          used += localStorage[key].length + key.length;
        }
      }
      const total = STORAGE_CONFIG.maxSize;
      const percentage = (used / total) * 100;
      return { used, total, percentage };
    } catch (error) {
      console.error('Error calculating storage usage', error);
      return { used: 0, total: STORAGE_CONFIG.maxSize, percentage: 0 };
    }
  },

  // Check if storage quota is exceeded
  isQuotaExceeded: (): boolean => {
    const { percentage } = storage.getUsage();
    return percentage > 90; // 90% threshold
  },

  // Cleanup old items to free space
  cleanup: (keepLatest: number = STORAGE_CONFIG.cleanupThreshold): boolean => {
    try {
      const galleryItems = storage.get(STORAGE_KEYS.GALLERY_ITEMS, []);
      if (Array.isArray(galleryItems) && galleryItems.length > keepLatest) {
        const sortedItems = galleryItems.sort((a, b) => {
          const dateA = new Date(a.date || a.uploadDate || 0);
          const dateB = new Date(b.date || b.uploadDate || 0);
          return dateB.getTime() - dateA.getTime();
        });
        const itemsToKeep = sortedItems.slice(0, keepLatest);
        storage.set(STORAGE_KEYS.GALLERY_ITEMS, itemsToKeep);
        console.log(`Cleaned up storage: kept ${itemsToKeep.length} items`);
        return true;
      }
      return true;
    } catch (error) {
      console.error('Error during storage cleanup', error);
      return false;
    }
  },
};

// Type-safe storage helpers
export const typedStorage = {
  getGalleryItems: () => storage.get(STORAGE_KEYS.GALLERY_ITEMS, []),
  setGalleryItems: (items: any[]) => storage.set(STORAGE_KEYS.GALLERY_ITEMS, items),
  
  getSiteSettings: () => storage.get(STORAGE_KEYS.SITE_SETTINGS, {}),
  setSiteSettings: (settings: any) => storage.set(STORAGE_KEYS.SITE_SETTINGS, settings),
  
  getNotificationSettings: () => storage.get(STORAGE_KEYS.NOTIFICATION_SETTINGS, {}),
  setNotificationSettings: (settings: any) => storage.set(STORAGE_KEYS.NOTIFICATION_SETTINGS, settings),
  
  getPlayers: () => storage.get(STORAGE_KEYS.PLAYERS, []),
  setPlayers: (players: any[]) => storage.set(STORAGE_KEYS.PLAYERS, players),
  
  getAnnouncements: () => storage.get(STORAGE_KEYS.ANNOUNCEMENTS, []),
  setAnnouncements: (announcements: any[]) => storage.set(STORAGE_KEYS.ANNOUNCEMENTS, announcements),
  
  getUserPreferences: () => storage.get(STORAGE_KEYS.USER_PREFERENCES, {}),
  setUserPreferences: (preferences: any) => storage.set(STORAGE_KEYS.USER_PREFERENCES, preferences),
};
