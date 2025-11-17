import { Button as ChakraButton, ButtonProps } from '@chakra-ui/react';
import { COLORS, BUTTON_SIZE } from '../../constants/designTokens';

interface CustomButtonProps extends ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
}

/**
 * 공통 버튼 컴포넌트
 * 일관된 스타일을 위해 사용
 */
export const Button = ({ 
  variant = 'primary',
  size = BUTTON_SIZE.SM,
  children,
  ...props 
}: CustomButtonProps) => {
  const variantStyles = {
    primary: {
      bg: COLORS.BRAND_PRIMARY,
      color: 'white',
      _hover: { bg: COLORS.BRAND_PRIMARY_HOVER },
    },
    secondary: {
      bg: COLORS.TEXT_SECONDARY,
      color: 'white',
      _hover: { bg: COLORS.TEXT_PRIMARY },
    },
    outline: {
      border: '1px solid',
      borderColor: COLORS.BRAND_PRIMARY,
      color: COLORS.BRAND_PRIMARY,
      bg: 'transparent',
      _hover: { bg: COLORS.BG_GRAY_50 },
    },
    ghost: {
      bg: 'transparent',
      color: COLORS.BRAND_PRIMARY,
      _hover: { bg: COLORS.BG_GRAY_50 },
    },
  };

  return (
    <ChakraButton
      size={size}
      {...variantStyles[variant]}
      {...props}
    >
      {children}
    </ChakraButton>
  );
};

