import React from 'react';
import {
  Box,
  usePrefersReducedMotion,
  type BoxProps,
} from '@chakra-ui/react';

// 애니메이션 키프레임
const fadeIn = `
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const slideInLeft = `
  from { opacity: 0; transform: translateX(-100%); }
  to { opacity: 1; transform: translateX(0); }
`;

const slideInRight = `
  from { opacity: 0; transform: translateX(100%); }
  to { opacity: 1; transform: translateX(0); }
`;

const scaleIn = `
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
`;

const bounce = `
  0%, 20%, 53%, 80%, 100% { transform: translate3d(0,0,0); }
  40%, 43% { transform: translate3d(0,-30px,0); }
  70% { transform: translate3d(0,-15px,0); }
  90% { transform: translate3d(0,-4px,0); }
`;

const pulse = `
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

const spin = `
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const shimmer = `
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
`;

// 애니메이션 컴포넌트들
interface AnimationProps extends BoxProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  infinite?: boolean;
}

export const FadeIn: React.FC<AnimationProps> = ({
  children,
  delay = 0,
  duration = 0.6,
  infinite = false,
  ...props
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  
  const animation = prefersReducedMotion
    ? undefined
    : `fadeIn ${duration}s ease-out ${delay}s ${infinite ? 'infinite' : 'forwards'}`;

  return (
    <Box
      animation={animation}
      opacity={prefersReducedMotion ? 1 : 0}
      {...props}
    >
      {children}
    </Box>
  );
};

export const SlideInLeft: React.FC<AnimationProps> = ({
  children,
  delay = 0,
  duration = 0.6,
  infinite = false,
  ...props
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  
  const animation = prefersReducedMotion
    ? undefined
    : `slideInLeft ${duration}s ease-out ${delay}s ${infinite ? 'infinite' : 'forwards'}`;

  return (
    <Box
      animation={animation}
      opacity={prefersReducedMotion ? 1 : 0}
      {...props}
    >
      {children}
    </Box>
  );
};

export const SlideInRight: React.FC<AnimationProps> = ({
  children,
  delay = 0,
  duration = 0.6,
  infinite = false,
  ...props
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  
  const animation = prefersReducedMotion
    ? undefined
    : `slideInRight ${duration}s ease-out ${delay}s ${infinite ? 'infinite' : 'forwards'}`;

  return (
    <Box
      animation={animation}
      opacity={prefersReducedMotion ? 1 : 0}
      {...props}
    >
      {children}
    </Box>
  );
};

export const ScaleIn: React.FC<AnimationProps> = ({
  children,
  delay = 0,
  duration = 0.6,
  infinite = false,
  ...props
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  
  const animation = prefersReducedMotion
    ? undefined
    : `scaleIn ${duration}s ease-out ${delay}s ${infinite ? 'infinite' : 'forwards'}`;

  return (
    <Box
      animation={animation}
      opacity={prefersReducedMotion ? 1 : 0}
      {...props}
    >
      {children}
    </Box>
  );
};

export const Bounce: React.FC<AnimationProps> = ({
  children,
  delay = 0,
  duration = 1,
  infinite = false,
  ...props
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  
  const animation = prefersReducedMotion
    ? undefined
    : `bounce ${duration}s ease-in-out ${delay}s ${infinite ? 'infinite' : 'forwards'}`;

  return (
    <Box
      animation={animation}
      {...props}
    >
      {children}
    </Box>
  );
};

export const Pulse: React.FC<AnimationProps> = ({
  children,
  delay = 0,
  duration = 2,
  infinite = true,
  ...props
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  
  const animation = prefersReducedMotion
    ? undefined
    : `pulse ${duration}s ease-in-out ${delay}s ${infinite ? 'infinite' : 'forwards'}`;

  return (
    <Box
      animation={animation}
      {...props}
    >
      {children}
    </Box>
  );
};

export const Spin: React.FC<AnimationProps> = ({
  children,
  delay = 0,
  duration = 1,
  infinite = true,
  ...props
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  
  const animation = prefersReducedMotion
    ? undefined
    : `spin ${duration}s linear ${delay}s ${infinite ? 'infinite' : 'forwards'}`;

  return (
    <Box
      animation={animation}
      {...props}
    >
      {children}
    </Box>
  );
};

export const Shimmer: React.FC<AnimationProps> = ({
  children,
  delay = 0,
  duration = 2,
  infinite = true,
  ...props
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  
  const animation = prefersReducedMotion
    ? undefined
    : `shimmer ${duration}s ease-in-out ${delay}s ${infinite ? 'infinite' : 'forwards'}`;

  return (
    <Box
      animation={animation}
      background="linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)"
      backgroundSize="200px 100%"
      {...props}
    >
      {children}
    </Box>
  );
};

// 스태거 애니메이션
interface StaggerProps extends BoxProps {
  children: React.ReactNode[];
  staggerDelay?: number;
  animation?: 'fadeIn' | 'slideInLeft' | 'slideInRight' | 'scaleIn';
}

export const StaggerContainer: React.FC<StaggerProps> = ({
  children,
  staggerDelay = 0.1,
  animation = 'fadeIn',
  ...props
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  
  if (prefersReducedMotion) {
    return <Box {...props}>{children}</Box>;
  }

  return (
    <Box {...props}>
      {children.map((child, index) => {
        const delay = index * staggerDelay;
        
        switch (animation) {
          case 'slideInLeft':
            return (
              <SlideInLeft key={index} delay={delay}>
                {child}
              </SlideInLeft>
            );
          case 'slideInRight':
            return (
              <SlideInRight key={index} delay={delay}>
                {child}
              </SlideInRight>
            );
          case 'scaleIn':
            return (
              <ScaleIn key={index} delay={delay}>
                {child}
              </ScaleIn>
            );
          default:
            return (
              <FadeIn key={index} delay={delay}>
                {child}
              </FadeIn>
            );
        }
      })}
    </Box>
  );
};

// 페이지 전환 애니메이션
interface PageTransitionProps extends BoxProps {
  children: React.ReactNode;
  isVisible: boolean;
}

export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  isVisible,
  ...props
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  
  if (prefersReducedMotion) {
    return (
      <Box
        opacity={isVisible ? 1 : 0}
        transition="opacity 0.3s ease-in-out"
        {...props}
      >
        {children}
      </Box>
    );
  }

  return (
    <Box
      animation={isVisible ? 'fadeIn 0.6s ease-out forwards' : undefined}
      opacity={isVisible ? 1 : 0}
      transform={isVisible ? 'translateY(0)' : 'translateY(20px)'}
      transition="opacity 0.3s ease-in-out, transform 0.3s ease-in-out"
      {...props}
    >
      {children}
    </Box>
  );
};

// 로딩 스피너
interface LoadingSpinnerProps extends BoxProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'brand.500',
  ...props
}) => {
  const sizeMap = {
    sm: '16px',
    md: '24px',
    lg: '32px',
  };

  return (
    <Spin duration={1} infinite {...props}>
      <Box
        w={sizeMap[size]}
        h={sizeMap[size]}
        border="2px solid"
        borderColor="gray.200"
        borderTopColor={color}
        borderRadius="full"
      />
    </Spin>
  );
};

// 스켈레톤 로딩
interface SkeletonProps extends BoxProps {
  height?: string;
  width?: string;
  isLoaded?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  height = '20px',
  width = '100%',
  isLoaded = false,
  children,
  ...props
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  
  if (isLoaded) {
    return <Box {...props}>{children}</Box>;
  }

  return (
    <Box
      h={height}
      w={width}
      bg="gray.200"
      borderRadius="md"
      position="relative"
      overflow="hidden"
      _dark={{ bg: 'gray.700' }}
      {...props}
    >
      {!prefersReducedMotion && (
        <Shimmer
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          duration={1.5}
        />
      )}
    </Box>
  );
};

// 호버 효과
interface HoverEffectProps extends BoxProps {
  children: React.ReactNode;
  effect?: 'lift' | 'glow' | 'scale';
}

export const HoverEffect: React.FC<HoverEffectProps> = ({
  children,
  effect = 'lift',
  ...props
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  
  const hoverStyles = {
    lift: {
      transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
      _hover: {
        transform: 'translateY(-4px)',
        boxShadow: 'lg',
      },
    },
    glow: {
      transition: 'box-shadow 0.2s ease-in-out',
      _hover: {
        boxShadow: '0 0 20px rgba(0, 78, 168, 0.3)',
      },
    },
    scale: {
      transition: 'transform 0.2s ease-in-out',
      _hover: {
        transform: 'scale(1.05)',
      },
    },
  };

  if (prefersReducedMotion) {
    return <Box {...props}>{children}</Box>;
  }

  return (
    <Box {...hoverStyles[effect]} {...props}>
      {children}
    </Box>
  );
};
