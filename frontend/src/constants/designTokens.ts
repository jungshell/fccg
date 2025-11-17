/**
 * 디자인 토큰 상수
 * 모든 디자인 값은 여기서 관리하여 일관성 유지
 */

// 색상
export const COLORS = {
  // 메인 브랜드 색상
  BRAND_PRIMARY: '#004ea8',
  BRAND_PRIMARY_HOVER: '#00397a',
  BRAND_PRIMARY_DARK: '#003d85',
  
  // 상태 색상
  SUCCESS: '#22c55e',
  WARNING: '#f59e0b',
  ERROR: '#ef4444',
  INFO: '#3b82f6',
  
  // 투표 관련
  VOTE_ACTIVE: '#9333ea', // purple.500
  VOTE_CLOSED: '#ef4444', // red.500
  
  // 텍스트 색상
  TEXT_PRIMARY: '#1f2937',
  TEXT_SECONDARY: '#6b7280',
  TEXT_DISABLED: '#9ca3af',
  
  // 배경 색상
  BG_WHITE: '#ffffff',
  BG_GRAY_50: '#f9fafb',
  BG_GRAY_100: '#f3f4f6',
  
  // 보더 색상
  BORDER_GRAY_200: '#e5e7eb',
  BORDER_GRAY_300: '#d1d5db',
} as const;

// 간격 (Spacing)
export const SPACING = {
  // 작은 간격
  XS: 0.5, // 2px
  SM: 1,   // 4px
  MD: 2,   // 8px
  LG: 3,   // 12px
  XL: 4,   // 16px
  
  // 큰 간격
  XXL: 6,  // 24px
  XXXL: 8, // 32px
  
  // 반응형 간격
  RESPONSIVE: {
    SMALL: { base: 1, md: 2 },
    MEDIUM: { base: 2, md: 4 },
    LARGE: { base: 4, md: 6 },
    XLARGE: { base: 6, md: 8 },
  },
} as const;

// 패딩
export const PADDING = {
  // 카드/박스 패딩
  CARD: { base: 2, md: 3 },
  CARD_COMPACT: { base: 2, md: 2.67 },
  CARD_TIGHT: { base: 1.5, md: 2 },
  
  // 섹션 패딩
  SECTION: { base: 4, md: 6, lg: 8 },
  SECTION_COMPACT: { base: 2, md: 3 },
  
  // 헤더 패딩
  HEADER: { base: 2, md: 4, lg: 6 },
  HEADER_LOGO: { base: 4, md: 6, lg: 8 },
} as const;

// 마진
export const MARGIN = {
  // 작은 마진
  XS: 0.5,
  SM: 1,
  MD: 2,
  LG: 3,
  XL: 4,
  
  // 섹션 마진
  SECTION: { base: 2, md: 3 },
  SECTION_LARGE: { base: 4, md: 6 },
} as const;

// 폰트 크기
export const FONT_SIZE = {
  XS: 'xs',
  SM: 'sm',
  MD: 'md',
  LG: 'lg',
  XL: 'xl',
  '2XL': '2xl',
  '3XL': '3xl',
} as const;

// 폰트 굵기
export const FONT_WEIGHT = {
  NORMAL: 'normal',
  MEDIUM: 500,
  SEMIBOLD: 600,
  BOLD: 'bold',
} as const;

// 보더 반경
export const BORDER_RADIUS = {
  SM: 'sm',
  MD: 'md',
  LG: 'lg',
  XL: 'xl',
  FULL: 'full',
} as const;

// 그림자
export const SHADOW = {
  SM: 'sm',
  MD: 'md',
  LG: 'lg',
  XL: 'xl',
} as const;

// 높이
export const HEIGHT = {
  HEADER: '60px',
  HEADER_COMPACT: '50px',
  BANNER_COMPACT: 'auto', // 내용에 맞춤
} as const;

// 너비
export const WIDTH = {
  FULL: '100%',
  FULL_VW: '100vw',
  CONTAINER: { base: '100%', lg: '1400px' },
  SIDEBAR: { base: '100%', lg: '400px' },
} as const;

// 간격 (Gap)
export const GAP = {
  SMALL: { base: 2, md: 3 },
  MEDIUM: { base: 4, md: 6 },
  LARGE: { base: 6, md: 8 },
} as const;

// VStack 간격
export const VSTACK_SPACING = {
  TIGHT: { base: 1, md: 1.5 },
  NORMAL: { base: 2, md: 3 },
  LOOSE: { base: 4, md: 6 },
} as const;

// HStack 간격
export const HSTACK_SPACING = {
  TIGHT: 1,
  NORMAL: 2,
  LOOSE: 4,
} as const;

// 버튼 크기
export const BUTTON_SIZE = {
  SM: 'sm',
  MD: 'md',
  LG: 'lg',
} as const;

// 아이콘 크기
export const ICON_SIZE = {
  SM: '16px',
  MD: '20px',
  LG: '24px',
  XL: '32px',
} as const;

// Z-Index
export const Z_INDEX = {
  HEADER: 100,
  MODAL: 1400,
  TOOLTIP: 1800,
} as const;

// 반응형 브레이크포인트
export const BREAKPOINTS = {
  SM: '30em',
  MD: '48em',
  LG: '62em',
  XL: '80em',
  '2XL': '96em',
} as const;

// 레이아웃 상수
export const LAYOUT = {
  // 홈페이지
  HOME: {
    TOP_PADDING: '18mm',
    MAIN_GAP: 8,
    MAIN_PADDING: { base: 2, md: 8, lg: 24 },
    QUOTE_CARD: {
      MIN_HEIGHT: '433px',
      MAX_WIDTH: { base: '100%', md: '420px' },
    },
    VIDEO_CARD: {
      MIN_HEIGHT: { base: '180px', md: '300px', lg: '400px' },
    },
    BANNER: {
      PADDING: 2,
      SPACING: { base: 1.33, md: 1.33 },
      MARGIN_BOTTOM: 0.5,
      MARGIN_TOP: 0.5,
    },
  },
  
  // 일정 페이지
  SCHEDULE: {
    SECTION_PADDING: { base: 2, md: 3 },
    SECTION_MARGIN: { base: 2, md: 3 },
    ITEM_SPACING: { base: 1, md: 1.5 },
    SECTION_GAP: { base: 2, md: 3 },
  },
  
  // 헤더
  HEADER: {
    PADDING: { base: 2, md: 4, lg: 6 },
    LOGO_PADDING: { base: 4, md: 6, lg: 8 },
    BUTTON_SPACING: 2,
  },
} as const;

// 타입 정의
export type SpacingValue = typeof SPACING[keyof typeof SPACING];
export type ColorValue = typeof COLORS[keyof typeof COLORS];
export type PaddingValue = typeof PADDING[keyof typeof PADDING];

