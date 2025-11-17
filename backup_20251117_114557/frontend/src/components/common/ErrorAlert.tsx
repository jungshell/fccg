import { Alert, AlertIcon, AlertTitle, AlertDescription, Box } from '@chakra-ui/react';

interface ErrorAlertProps {
  title?: string;
  message: string;
  status?: 'error' | 'warning' | 'info';
  isClosable?: boolean;
}

export const ErrorAlert = ({ 
  title = '오류', 
  message, 
  status = 'error', 
  isClosable = false 
}: ErrorAlertProps) => {
  return (
    <Alert status={status} borderRadius="md" mb={4}>
      <AlertIcon />
      <Box>
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Box>
    </Alert>
  );
};
