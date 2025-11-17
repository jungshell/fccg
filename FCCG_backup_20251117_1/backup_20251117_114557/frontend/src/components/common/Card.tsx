import { Box, BoxProps } from '@chakra-ui/react';
import { PADDING, BORDER_RADIUS, SHADOW, COLORS } from '../../constants/designTokens';

interface CardProps extends BoxProps {
  variant?: 'default' | 'compact' | 'tight';
  clickable?: boolean;
}

/**
 * 공통 카드 컴포넌트
 * 일관된 스타일을 위해 사용
 */
export const Card = ({ 
  variant = 'default', 
  clickable = false,
  children, 
  ...props 
}: CardProps) => {
  const padding = variant === 'compact' 
    ? PADDING.CARD_COMPACT 
    : variant === 'tight' 
    ? PADDING.CARD_TIGHT 
    : PADDING.CARD;

  return (
    <Box
      bg={COLORS.BG_WHITE}
      p={padding}
      borderRadius={BORDER_RADIUS.LG}
      boxShadow={SHADOW.MD}
      border="1px solid"
      borderColor={COLORS.BORDER_GRAY_200}
      cursor={clickable ? 'pointer' : 'default'}
      _hover={clickable ? {
        boxShadow: SHADOW.XL,
        transform: 'translateY(-2px)',
        transition: 'all 0.15s'
      } : {}}
      {...props}
    >
      {children}
    </Box>
  );
};

