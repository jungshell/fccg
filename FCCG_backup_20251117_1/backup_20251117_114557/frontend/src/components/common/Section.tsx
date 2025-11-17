import { Box, BoxProps, VStack, VStackProps } from '@chakra-ui/react';
import { PADDING, VSTACK_SPACING, COLORS } from '../../constants/designTokens';

interface SectionProps extends BoxProps {
  variant?: 'default' | 'compact';
  spacing?: 'tight' | 'normal' | 'loose';
}

/**
 * 공통 섹션 컴포넌트
 * 일관된 패딩과 간격을 위해 사용
 */
export const Section = ({ 
  variant = 'default',
  spacing = 'normal',
  children,
  ...props 
}: SectionProps) => {
  const padding = variant === 'compact' 
    ? PADDING.SECTION_COMPACT 
    : PADDING.SECTION;

  return (
    <Box
      bg={COLORS.BG_WHITE}
      p={padding}
      borderRadius="lg"
      boxShadow="sm"
      border="1px solid"
      borderColor={COLORS.BORDER_GRAY_200}
      {...props}
    >
      {children}
    </Box>
  );
};

interface SectionStackProps extends VStackProps {
  spacing?: 'tight' | 'normal' | 'loose';
}

/**
 * 섹션 내부 VStack 컴포넌트
 */
export const SectionStack = ({ 
  spacing = 'normal',
  ...props 
}: SectionStackProps) => {
  const spacingValue = VSTACK_SPACING[spacing.toUpperCase() as keyof typeof VSTACK_SPACING];
  
  return (
    <VStack spacing={spacingValue} align="stretch" {...props} />
  );
};

