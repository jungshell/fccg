import React from 'react';
import {
  Box,
  Button,
  Text,
  VStack,
  HStack,
  Icon,
  useColorModeValue,
  SlideFade,
  Badge,
} from '@chakra-ui/react';
import { DownloadIcon, CloseIcon, BellIcon, RepeatIcon } from '@chakra-ui/icons';
import { usePWA } from '../hooks/usePWA';

interface PWAInstallPromptProps {
  onClose?: () => void;
  showNotification?: boolean;
}

export const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({
  onClose,
  showNotification = true,
}) => {
  const {
    isInstallable,
    isInstalled,
    isOnline,
    isServiceWorkerReady,
    isPushSupported,
    installApp,
    requestNotificationPermission,
    subscribeToPushNotifications,
    syncOfflineData,
  } = usePWA();

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'white');

  // 설치 가능하고 아직 설치되지 않은 경우에만 표시
  if (!isInstallable || isInstalled) {
    return null;
  }

  return (
    <SlideFade in={isInstallable} offsetY="20px">
      <Box
        position="fixed"
        bottom={4}
        left={4}
        right={4}
        bg={bgColor}
        border="1px solid"
        borderColor={borderColor}
        borderRadius="lg"
        boxShadow="lg"
        p={4}
        zIndex={1000}
        maxW="400px"
        mx="auto"
      >
        <VStack spacing={3} align="stretch">
          {/* 헤더 */}
          <HStack justify="space-between" align="center">
            <HStack spacing={2}>
              <Icon as={DownloadIcon} color="blue.500" />
              <Text fontWeight="bold" color={textColor}>
                FC CG 앱 설치
              </Text>
            </HStack>
            {onClose && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onClose}
                aria-label="닫기"
              >
                <Icon as={CloseIcon} />
              </Button>
            )}
          </HStack>

          {/* 설명 */}
          <Text fontSize="sm" color={textColor} opacity={0.8}>
            홈 화면에 FC CG 앱을 설치하여 더 빠르고 편리하게 사용하세요.
          </Text>

          {/* 상태 표시 */}
          <HStack spacing={2} wrap="wrap">
            <Badge
              colorScheme={isOnline ? 'green' : 'red'}
              variant="subtle"
              fontSize="xs"
            >
              {isOnline ? '온라인' : '오프라인'}
            </Badge>
            {isServiceWorkerReady && (
              <Badge colorScheme="blue" variant="subtle" fontSize="xs">
                오프라인 지원
              </Badge>
            )}
            {isPushSupported && (
              <Badge colorScheme="purple" variant="subtle" fontSize="xs">
                푸시 알림
              </Badge>
            )}
          </HStack>

          {/* 액션 버튼들 */}
          <VStack spacing={2}>
            <Button
              colorScheme="blue"
              size="sm"
              width="full"
              onClick={installApp}
              leftIcon={<DownloadIcon />}
            >
              앱 설치하기
            </Button>

            <HStack spacing={2} width="full">
              {isPushSupported && (
                <Button
                  variant="outline"
                  size="sm"
                  flex={1}
                  onClick={requestNotificationPermission}
                  leftIcon={<BellIcon />}
                >
                  알림 설정
                </Button>
              )}
              
              {isServiceWorkerReady && (
                <Button
                  variant="outline"
                  size="sm"
                  flex={1}
                  onClick={syncOfflineData}
                  leftIcon={<RepeatIcon />}
                >
                  동기화
                </Button>
              )}
            </HStack>
          </VStack>

          {/* 추가 정보 */}
          <Box
            bg={useColorModeValue('gray.50', 'gray.700')}
            p={3}
            borderRadius="md"
            fontSize="xs"
            color={textColor}
            opacity={0.7}
          >
            <Text fontWeight="bold" mb={1}>
              설치 후 사용 가능한 기능:
            </Text>
            <VStack align="start" spacing={1}>
              <Text>• 홈 화면에서 바로 실행</Text>
              <Text>• 오프라인에서도 기본 기능 사용</Text>
              <Text>• 푸시 알림으로 실시간 업데이트</Text>
              <Text>• 네이티브 앱과 같은 경험</Text>
            </VStack>
          </Box>
        </VStack>
      </Box>
    </SlideFade>
  );
};

// PWA 상태 표시 컴포넌트
export const PWAStatus: React.FC = () => {
  const {
    isInstalled,
    isOnline,
    isServiceWorkerReady,
    isPushSupported,
    checkForUpdates,
  } = usePWA();

  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  if (!isInstalled) {
    return null;
  }

  return (
    <Box
      position="fixed"
      top={4}
      right={4}
      bg={bgColor}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="md"
      p={2}
      zIndex={999}
      boxShadow="sm"
    >
      <HStack spacing={2}>
        <Badge
          colorScheme={isOnline ? 'green' : 'red'}
          variant="subtle"
          fontSize="xs"
        >
          {isOnline ? '온라인' : '오프라인'}
        </Badge>
        
        {isServiceWorkerReady && (
          <Badge colorScheme="blue" variant="subtle" fontSize="xs">
            SW
          </Badge>
        )}
        
        {isPushSupported && (
          <Badge colorScheme="purple" variant="subtle" fontSize="xs">
            푸시
          </Badge>
        )}
        
        <Button
          size="xs"
          variant="ghost"
          onClick={checkForUpdates}
          aria-label="업데이트 확인"
        >
          <Icon as={RepeatIcon} />
        </Button>
      </HStack>
    </Box>
  );
};
