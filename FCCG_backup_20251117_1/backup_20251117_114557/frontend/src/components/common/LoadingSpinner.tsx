import { Flex, Spinner, Text } from '@chakra-ui/react';
import { UI_CONSTANTS } from '../../constants';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
}

export const LoadingSpinner = ({ 
  message = '로딩 중...', 
  size = 'md', 
  color = UI_CONSTANTS.COLORS.PRIMARY 
}: LoadingSpinnerProps) => {
  return (
    <Flex align="center" justify="center" direction="column" py={8}>
      <Spinner size={size} color={color} mb={2} />
      <Text color="gray.500" fontSize="sm">
        {message}
      </Text>
    </Flex>
  );
};
