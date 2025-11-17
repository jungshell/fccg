import { STORAGE_CONFIG } from './config';

// Date formatting utilities
export const dateUtils = {
  // Format date to Korean format (YYYY.MM.DD.(요일))
  formatKoreanDate: (date: Date | string): string => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[d.getDay()];
    return `${year}.${month}.${day}.(${weekday})`;
  },

  // Format date to short format (MM.DD)
  formatShortDate: (date: Date | string): string => {
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${month}.${day}`;
  },

  // Get current month name in Korean
  getCurrentMonthKorean: (): string => {
    const months = [
      '1월', '2월', '3월', '4월', '5월', '6월',
      '7월', '8월', '9월', '10월', '11월', '12월'
    ];
    return months[new Date().getMonth()];
  },

  // Check if date is today
  isToday: (date: Date | string): boolean => {
    const today = new Date();
    const checkDate = new Date(date);
    return today.toDateString() === checkDate.toDateString();
  },

  // Get date difference in days
  getDaysDifference: (date1: Date | string, date2: Date | string): number => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },
};

// File utilities
export const fileUtils = {
  // Convert file to base64
  fileToBase64: (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  // Compress image using Canvas API
  compressImage: (file: File, maxSize: number = STORAGE_CONFIG.maxFileSize): Promise<File> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = document.createElement('img');

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        const maxDimension = 1200;
        
        if (width > height && width > maxDimension) {
          height = (height * maxDimension) / width;
          width = maxDimension;
        } else if (height > maxDimension) {
          width = (width * maxDimension) / height;
          height = maxDimension;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          file.type,
          0.8 // Quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  },

  // Get file size in human readable format
  formatFileSize: (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  // Check if file is image
  isImage: (file: File): boolean => {
    return file.type.startsWith('image/');
  },

  // Check if file is video
  isVideo: (file: File): boolean => {
    return file.type.startsWith('video/');
  },

  // Get supported image formats
  getSupportedImageFormats: (): string[] => {
    return ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  },
};

// String utilities
export const stringUtils = {
  // Extract event type from title
  extractEventType: (title: string): string => {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('매치') || lowerTitle.includes('match')) return '매치';
    if (lowerTitle.includes('자체') || lowerTitle.includes('practice')) return '자체';
    if (lowerTitle.includes('회식') || lowerTitle.includes('dinner')) return '회식';
    return '기타';
  },

  // Truncate text with ellipsis
  truncate: (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  },

  // Capitalize first letter
  capitalize: (text: string): string => {
    return text.charAt(0).toUpperCase() + text.slice(1);
  },

  // Generate random ID
  generateId: (): string => {
    return Math.random().toString(36).substr(2, 9);
  },

  // Remove special characters
  removeSpecialChars: (text: string): string => {
    return text.replace(/[^a-zA-Z0-9가-힣\s]/g, '');
  },
};

// Array utilities
export const arrayUtils = {
  // Group array by key
  groupBy: <T>(array: T[], key: keyof T): Record<string, T[]> => {
    return array.reduce((groups, item) => {
      const groupKey = String(item[key]);
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  },

  // Remove duplicates from array
  removeDuplicates: <T>(array: T[], key?: keyof T): T[] => {
    if (key) {
      const seen = new Set();
      return array.filter(item => {
        const value = item[key];
        if (seen.has(value)) {
          return false;
        }
        seen.add(value);
        return true;
      });
    }
    return [...new Set(array)];
  },

  // Sort array by date
  sortByDate: <T>(array: T[], dateKey: keyof T, ascending: boolean = false): T[] => {
    return [...array].sort((a, b) => {
      const dateA = new Date(a[dateKey] as any).getTime();
      const dateB = new Date(b[dateKey] as any).getTime();
      return ascending ? dateA - dateB : dateB - dateA;
    });
  },

  // Chunk array into smaller arrays
  chunk: <T>(array: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  },
};

// Validation utilities
export const validationUtils = {
  // Validate email format
  isValidEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  // Validate phone number format
  isValidPhone: (phone: string): boolean => {
    const phoneRegex = /^[0-9]{2,3}-[0-9]{3,4}-[0-9]{4}$/;
    return phoneRegex.test(phone);
  },

  // Validate file size
  isValidFileSize: (file: File, maxSize: number = STORAGE_CONFIG.maxFileSize): boolean => {
    return file.size <= maxSize;
  },

  // Validate file type
  isValidFileType: (file: File, allowedTypes: string[]): boolean => {
    return allowedTypes.includes(file.type);
  },

  // Validate required fields
  validateRequired: (obj: Record<string, any>, requiredFields: string[]): string[] => {
    const missingFields: string[] = [];
    requiredFields.forEach(field => {
      if (!obj[field] || (typeof obj[field] === 'string' && obj[field].trim() === '')) {
        missingFields.push(field);
      }
    });
    return missingFields;
  },
};
