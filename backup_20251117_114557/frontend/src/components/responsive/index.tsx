import React from 'react';
import {
  Box,
  Flex,
  Grid,
  GridItem,
  useBreakpointValue,
  type BoxProps,
  type FlexProps,
  type GridProps,
} from '@chakra-ui/react';

// 반응형 컨테이너
interface ResponsiveContainerProps extends BoxProps {
  children: React.ReactNode;
  maxW?: string;
  padding?: string;
}

export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  maxW = 'container.xl',
  padding = { base: 4, md: 6, lg: 8 },
  ...props
}) => {
  return (
    <Box
      maxW={maxW}
      mx="auto"
      px={padding}
      {...props}
    >
      {children}
    </Box>
  );
};

// 반응형 그리드
interface ResponsiveGridProps extends GridProps {
  children: React.ReactNode;
  columns?: { base: number; md: number; lg: number };
  gap?: string;
}

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  columns = { base: 1, md: 2, lg: 3 },
  gap = { base: 4, md: 6 },
  ...props
}) => {
  return (
    <Grid
      templateColumns={{
        base: `repeat(${columns.base}, 1fr)`,
        md: `repeat(${columns.md}, 1fr)`,
        lg: `repeat(${columns.lg}, 1fr)`,
      }}
      gap={gap}
      {...props}
    >
      {children}
    </Grid>
  );
};

// 반응형 카드 그리드
interface CardGridProps extends GridProps {
  children: React.ReactNode;
  minChildWidth?: string;
  spacing?: string;
}

export const CardGrid: React.FC<CardGridProps> = ({
  children,
  minChildWidth = { base: '280px', md: '320px' },
  spacing = { base: 4, md: 6 },
  ...props
}) => {
  return (
    <Grid
      templateColumns={{
        base: 'repeat(auto-fit, minmax(280px, 1fr))',
        md: 'repeat(auto-fit, minmax(320px, 1fr))',
      }}
      gap={spacing}
      {...props}
    >
      {children}
    </Grid>
  );
};

// 반응형 사이드바 레이아웃
interface SidebarLayoutProps extends FlexProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  sidebarWidth?: string;
  reverse?: boolean;
}

export const SidebarLayout: React.FC<SidebarLayoutProps> = ({
  children,
  sidebar,
  sidebarWidth = { base: '100%', md: '300px', lg: '350px' },
  reverse = false,
  ...props
}) => {
  const isMobile = useBreakpointValue({ base: true, md: false });

  if (isMobile) {
    return (
      <Flex direction="column" {...props}>
        {reverse ? (
          <>
            <Box mb={4}>{children}</Box>
            <Box>{sidebar}</Box>
          </>
        ) : (
          <>
            <Box mb={4}>{sidebar}</Box>
            <Box>{children}</Box>
          </>
        )}
      </Flex>
    );
  }

  return (
    <Flex
      direction={reverse ? 'row-reverse' : 'row'}
      gap={6}
      {...props}
    >
      <Box
        w={sidebarWidth}
        flexShrink={0}
      >
        {sidebar}
      </Box>
      <Box flex={1}>
        {children}
      </Box>
    </Flex>
  );
};

// 반응형 네비게이션
interface ResponsiveNavProps extends FlexProps {
  children: React.ReactNode;
  mobileMenu?: React.ReactNode;
  isOpen?: boolean;
  onToggle?: () => void;
}

export const ResponsiveNav: React.FC<ResponsiveNavProps> = ({
  children,
  mobileMenu,
  isOpen = false,
  onToggle,
  ...props
}) => {
  const isMobile = useBreakpointValue({ base: true, md: false });

  if (isMobile) {
    return (
      <Box>
        <Flex
          justify="space-between"
          align="center"
          {...props}
        >
          {children}
          {mobileMenu}
        </Flex>
      </Box>
    );
  }

  return (
    <Flex
      justify="space-between"
      align="center"
      {...props}
    >
      {children}
    </Flex>
  );
};

// 반응형 테이블
interface ResponsiveTableProps extends BoxProps {
  children: React.ReactNode;
  mobileView?: 'stack' | 'scroll' | 'cards';
}

export const ResponsiveTable: React.FC<ResponsiveTableProps> = ({
  children,
  mobileView = 'scroll',
  ...props
}) => {
  const isMobile = useBreakpointValue({ base: true, md: false });

  if (isMobile && mobileView === 'scroll') {
    return (
      <Box
        overflowX="auto"
        css={{
          '&::-webkit-scrollbar': {
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'var(--chakra-colors-gray-100)',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'var(--chakra-colors-gray-300)',
            borderRadius: '4px',
          },
        }}
        {...props}
      >
        {children}
      </Box>
    );
  }

  return <Box {...props}>{children}</Box>;
};

// 반응형 이미지
interface ResponsiveImageProps extends BoxProps {
  src: string;
  alt: string;
  aspectRatio?: number;
  objectFit?: 'cover' | 'contain' | 'fill';
}

export const ResponsiveImage: React.FC<ResponsiveImageProps> = ({
  src,
  alt,
  aspectRatio = 16 / 9,
  objectFit = 'cover',
  ...props
}) => {
  return (
    <Box
      position="relative"
      width="100%"
      height="auto"
      {...props}
    >
      <Box
        as="img"
        src={src}
        alt={alt}
        width="100%"
        height="auto"
        objectFit={objectFit}
        borderRadius="lg"
        loading="lazy"
      />
    </Box>
  );
};

// 반응형 텍스트
interface ResponsiveTextProps extends BoxProps {
  children: React.ReactNode;
  fontSize?: { base: string; md: string; lg: string };
  lineHeight?: { base: string; md: string; lg: string };
}

export const ResponsiveText: React.FC<ResponsiveTextProps> = ({
  children,
  fontSize = { base: 'sm', md: 'md', lg: 'lg' },
  lineHeight = { base: 'short', md: 'base', lg: 'tall' },
  ...props
}) => {
  return (
    <Box
      fontSize={fontSize}
      lineHeight={lineHeight}
      {...props}
    >
      {children}
    </Box>
  );
};

// 반응형 버튼 그룹
interface ResponsiveButtonGroupProps extends FlexProps {
  children: React.ReactNode;
  orientation?: 'horizontal' | 'vertical';
  spacing?: string;
}

export const ResponsiveButtonGroup: React.FC<ResponsiveButtonGroupProps> = ({
  children,
  orientation = 'horizontal',
  spacing = { base: 2, md: 3 },
  ...props
}) => {
  const isMobile = useBreakpointValue({ base: true, md: false });

  return (
    <Flex
      direction={isMobile ? 'column' : orientation === 'horizontal' ? 'row' : 'column'}
      gap={spacing}
      {...props}
    >
      {children}
    </Flex>
  );
};

// 반응형 모달
interface ResponsiveModalProps extends BoxProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  size?: { base: string; md: string; lg: string };
}

export const ResponsiveModal: React.FC<ResponsiveModalProps> = ({
  children,
  isOpen,
  onClose,
  size = { base: 'full', md: 'md', lg: 'lg' },
  ...props
}) => {
  return (
    <Box
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      bg="rgba(0, 0, 0, 0.5)"
      zIndex={1400}
      display={isOpen ? 'flex' : 'none'}
      alignItems="center"
      justifyContent="center"
      p={{ base: 4, md: 6 }}
      onClick={onClose}
      {...props}
    >
      <Box
        bg="white"
        borderRadius="xl"
        maxW={size}
        w="100%"
        maxH="90vh"
        overflow="auto"
        onClick={(e) => e.stopPropagation()}
        _dark={{ bg: 'gray.800' }}
      >
        {children}
      </Box>
    </Box>
  );
};

// 반응형 푸터
interface ResponsiveFooterProps extends FlexProps {
  children: React.ReactNode;
  columns?: { base: number; md: number; lg: number };
}

export const ResponsiveFooter: React.FC<ResponsiveFooterProps> = ({
  children,
  columns = { base: 1, md: 2, lg: 4 },
  ...props
}) => {
  return (
    <Grid
      templateColumns={{
        base: `repeat(${columns.base}, 1fr)`,
        md: `repeat(${columns.md}, 1fr)`,
        lg: `repeat(${columns.lg}, 1fr)`,
      }}
      gap={{ base: 6, md: 8 }}
      {...props}
    >
      {children}
    </Grid>
  );
};

// 반응형 히어로 섹션
interface HeroSectionProps extends BoxProps {
  children: React.ReactNode;
  background?: string;
  minHeight?: string;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  children,
  background = 'linear-gradient(135deg, brand.500 0%, brand.600 100%)',
  minHeight = { base: '60vh', md: '70vh', lg: '80vh' },
  ...props
}) => {
  return (
    <Box
      bg={background}
      minH={minHeight}
      display="flex"
      alignItems="center"
      justifyContent="center"
      color="white"
      position="relative"
      overflow="hidden"
      {...props}
    >
      <ResponsiveContainer>
        {children}
      </ResponsiveContainer>
    </Box>
  );
};

// 반응형 섹션
interface SectionProps extends BoxProps {
  children: React.ReactNode;
  padding?: string;
  background?: string;
}

export const Section: React.FC<SectionProps> = ({
  children,
  padding = { base: 8, md: 12, lg: 16 },
  background,
  ...props
}) => {
  return (
    <Box
      py={padding}
      bg={background}
      {...props}
    >
      <ResponsiveContainer>
        {children}
      </ResponsiveContainer>
    </Box>
  );
};
