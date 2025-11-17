import React, { useState, useEffect } from 'react';
import {
  Box,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  CloseButton,
  useColorModeValue,
  Slide
} from '@chakra-ui/react';
import { eventBus, EVENT_TYPES } from '../utils/eventBus';

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  timestamp: number;
}

const GlobalNotification: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  useEffect(() => {
    const handleAlert = (eventData: any) => {
      const { message, type } = eventData.payload;
      const notification: Notification = {
        id: Date.now().toString(),
        message,
        type,
        timestamp: Date.now()
      };

      setNotifications(prev => [...prev, notification]);

      // 5초 후 자동 제거
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== notification.id));
      }, 5000);
    };

    eventBus.on(EVENT_TYPES.ALERT_SHOW, handleAlert);

    return () => {
      eventBus.off(EVENT_TYPES.ALERT_SHOW, handleAlert);
    };
  }, []);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  if (notifications.length === 0) return null;

  return (
    <Box
      position="fixed"
      top="20px"
      right="20px"
      zIndex={9999}
      maxW="400px"
      w="100%"
    >
      {notifications.map((notification) => (
        <Slide key={notification.id} in={true} direction="right">
          <Alert
            status={notification.type}
            variant="left-accent"
            bg={bgColor}
            borderColor={borderColor}
            mb={2}
            borderRadius="md"
            boxShadow="lg"
          >
            <AlertIcon />
            <Box flex="1">
              <AlertDescription fontSize="sm">
                {notification.message}
              </AlertDescription>
            </Box>
            <CloseButton
              size="sm"
              onClick={() => removeNotification(notification.id)}
            />
          </Alert>
        </Slide>
      ))}
    </Box>
  );
};

export default GlobalNotification;

