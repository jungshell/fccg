import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  IconButton,
  Badge,
  useToast,
  SlideFade,
  Icon,
} from '@chakra-ui/react';
import { FiX, FiBell, FiMail, FiSmartphone } from 'react-icons/fi';

interface InAppNotificationProps {
  notification: {
    id: string;
    type: string;
    title: string;
    message: string;
    timestamp: string;
  };
  onClose: (id: string) => void;
}

const InAppNotification: React.FC<InAppNotificationProps> = ({ notification, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);
  const toast = useToast();

  useEffect(() => {
    // 10초 후 자동으로 사라짐
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose(notification.id), 300);
    }, 10000);

    return () => clearTimeout(timer);
  }, [notification.id, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose(notification.id), 300);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'GAME_REMINDER':
        return FiBell;
      case 'VOTE_REMINDER':
        return FiMail;
      case 'NEW_MEMBER':
        return FiSmartphone;
      default:
        return FiBell;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'GAME_REMINDER':
        return 'blue';
      case 'VOTE_REMINDER':
        return 'purple';
      case 'NEW_MEMBER':
        return 'green';
      case 'GAME_RESULT':
        return 'orange';
      default:
        return 'gray';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'GAME_REMINDER':
        return '경기알림';
      case 'VOTE_REMINDER':
        return '투표알림';
      case 'NEW_MEMBER':
        return '신규회원';
      case 'GAME_RESULT':
        return '경기결과';
      default:
        return '알림';
    }
  };

  if (!isVisible) return null;

  return (
    <SlideFade in={isVisible} offsetY="20px">
      <Box
        position="fixed"
        top="20px"
        right="20px"
        zIndex={9999}
        w="400px"
        maxW="90vw"
        bg="white"
        border="1px solid"
        borderColor="gray.200"
        borderRadius="lg"
        boxShadow="lg"
        p={4}
        _hover={{ boxShadow: 'xl' }}
        transition="all 0.2s"
      >
        <VStack spacing={3} align="stretch">
          <HStack justify="space-between" align="flex-start">
            <HStack spacing={2} flex={1}>
              <Icon
                as={getTypeIcon(notification.type)}
                color={`${getTypeColor(notification.type)}.500`}
                boxSize={5}
              />
              <Badge
                colorScheme={getTypeColor(notification.type)}
                size="sm"
                variant="subtle"
              >
                {getTypeLabel(notification.type)}
              </Badge>
            </HStack>
            <IconButton
              aria-label="알림 닫기"
              icon={<FiX />}
              size="sm"
              variant="ghost"
              onClick={handleClose}
              color="gray.500"
              _hover={{ bg: 'gray.100' }}
            />
          </HStack>

          <VStack spacing={2} align="stretch">
            <Text fontSize="md" fontWeight="bold" color="gray.800">
              {notification.title}
            </Text>
            <Text fontSize="sm" color="gray.600" lineHeight="1.4">
              {notification.message}
            </Text>
            <Text fontSize="xs" color="gray.400">
              {new Date(notification.timestamp).toLocaleString('ko-KR')}
            </Text>
          </VStack>
        </VStack>
      </Box>
    </SlideFade>
  );
};

export default InAppNotification;
