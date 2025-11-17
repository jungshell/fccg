import { extendTheme, type ThemeConfig } from '@chakra-ui/react';

// 테마 설정
const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

// 커스텀 색상 팔레트
const colors = {
  brand: {
    50: '#e6f3ff',
    100: '#b3d9ff',
    200: '#80bfff',
    300: '#4da6ff',
    400: '#1a8cff',
    500: '#004ea8', // 메인 브랜드 색상
    600: '#003d85',
    700: '#002c62',
    800: '#001b3f',
    900: '#000a1c',
  },
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },
};

// 커스텀 컴포넌트 스타일
const components = {
  Button: {
    baseStyle: {
      fontWeight: 'semibold',
      borderRadius: 'lg',
      _focus: {
        boxShadow: 'outline',
      },
    },
    variants: {
      solid: {
        bg: 'brand.500',
        color: 'white',
        _hover: {
          bg: 'brand.600',
        },
        _active: {
          bg: 'brand.700',
        },
      },
      outline: {
        border: '2px solid',
        borderColor: 'brand.500',
        color: 'brand.500',
        _hover: {
          bg: 'brand.50',
        },
      },
      ghost: {
        color: 'brand.500',
        _hover: {
          bg: 'brand.50',
        },
      },
    },
    sizes: {
      sm: {
        fontSize: 'sm',
        px: 3,
        py: 2,
      },
      md: {
        fontSize: 'md',
        px: 4,
        py: 2,
      },
      lg: {
        fontSize: 'lg',
        px: 6,
        py: 3,
      },
    },
  },
  Card: {
    baseStyle: {
      container: {
        bg: 'white',
        borderRadius: 'xl',
        boxShadow: 'sm',
        border: '1px solid',
        borderColor: 'gray.200',
      },
    },
  },
  Input: {
    baseStyle: {
      field: {
        borderRadius: 'lg',
        border: '2px solid',
        borderColor: 'gray.200',
        _hover: {
          borderColor: 'brand.300',
        },
        _focus: {
          borderColor: 'brand.500',
          boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)',
        },
      },
    },
  },
  Modal: {
    baseStyle: {
      dialog: {
        borderRadius: 'xl',
        bg: 'white',
      },
      header: {
        borderBottom: '1px solid',
        borderColor: 'gray.200',
      },
      body: {
        py: 6,
      },
      footer: {
        borderTop: '1px solid',
        borderColor: 'gray.200',
      },
    },
  },
  Badge: {
    baseStyle: {
      borderRadius: 'full',
      fontWeight: 'semibold',
      textTransform: 'none',
    },
    variants: {
      solid: {
        bg: 'brand.500',
        color: 'white',
      },
      outline: {
        border: '1px solid',
        borderColor: 'brand.500',
        color: 'brand.500',
      },
    },
  },
  Table: {
    baseStyle: {
      table: {
        borderCollapse: 'separate',
        borderSpacing: 0,
      },
      th: {
        bg: 'gray.50',
        fontWeight: 'semibold',
        textTransform: 'none',
        letterSpacing: 'normal',
        borderBottom: '1px solid',
        borderColor: 'gray.200',
        _dark: {
          bg: 'gray.700',
          borderColor: 'gray.600',
        },
      },
      td: {
        borderBottom: '1px solid',
        borderColor: 'gray.100',
        _dark: {
          borderColor: 'gray.700',
        },
      },
    },
  },
};

// 커스텀 스타일
const styles = {
  global: {
    body: {
      bg: 'gray.50',
      color: 'gray.900',
      transition: 'background-color 0.2s ease-in-out',
    },
    '*::selection': {
      bg: 'brand.200',
      color: 'brand.900',
    },
    '*::-webkit-scrollbar': {
      width: '8px',
      height: '8px',
    },
    '*::-webkit-scrollbar-track': {
      bg: 'gray.100',
      borderRadius: '4px',
    },
    '*::-webkit-scrollbar-thumb': {
      bg: 'gray.300',
      borderRadius: '4px',
      '&:hover': {
        bg: 'gray.400',
      },
    },
  },
};

// 애니메이션
const animations = {
  fadeIn: {
    '@keyframes fadeIn': {
      '0%': { opacity: 0, transform: 'translateY(10px)' },
      '100%': { opacity: 1, transform: 'translateY(0)' },
    },
  },
  slideIn: {
    '@keyframes slideIn': {
      '0%': { transform: 'translateX(-100%)' },
      '100%': { transform: 'translateX(0)' },
    },
  },
  pulse: {
    '@keyframes pulse': {
      '0%, 100%': { opacity: 1 },
      '50%': { opacity: 0.5 },
    },
  },
  bounce: {
    '@keyframes bounce': {
      '0%, 20%, 53%, 80%, 100%': { transform: 'translate3d(0,0,0)' },
      '40%, 43%': { transform: 'translate3d(0,-30px,0)' },
      '70%': { transform: 'translate3d(0,-15px,0)' },
      '90%': { transform: 'translate3d(0,-4px,0)' },
    },
  },
};

// 테마 확장
const theme = extendTheme({
  config,
  colors,
  components,
  styles,
  animations,
  fonts: {
    heading: 'Inter, system-ui, sans-serif',
    body: 'Inter, system-ui, sans-serif',
  },
  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
    '5xl': '3rem',
    '6xl': '3.75rem',
  },
  fontWeights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeights: {
    normal: 'normal',
    none: 1,
    shorter: 1.25,
    short: 1.375,
    base: 1.5,
    tall: 1.625,
    taller: '2',
  },
  space: {
    px: '1px',
    0.5: '0.125rem',
    1: '0.25rem',
    1.5: '0.375rem',
    2: '0.5rem',
    2.5: '0.625rem',
    3: '0.75rem',
    3.5: '0.875rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    7: '1.75rem',
    8: '2rem',
    9: '2.25rem',
    10: '2.5rem',
    12: '3rem',
    14: '3.5rem',
    16: '4rem',
    20: '5rem',
    24: '6rem',
    28: '7rem',
    32: '8rem',
    36: '9rem',
    40: '10rem',
    44: '11rem',
    48: '12rem',
    52: '13rem',
    56: '14rem',
    60: '15rem',
    64: '16rem',
    72: '18rem',
    80: '20rem',
    96: '24rem',
  },
  breakpoints: {
    sm: '30em',
    md: '48em',
    lg: '62em',
    xl: '80em',
    '2xl': '96em',
  },
  zIndices: {
    hide: -1,
    auto: 'auto',
    base: 0,
    docked: 10,
    dropdown: 1000,
    sticky: 1100,
    banner: 1200,
    overlay: 1300,
    modal: 1400,
    popover: 1500,
    skipLink: 1600,
    toast: 1700,
    tooltip: 1800,
  },
});

export default theme;
