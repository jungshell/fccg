import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  useToast,
  Flex,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  Checkbox,
  Badge,
  Card,
  CardBody,
  Divider,
  IconButton,
  Textarea,
  Grid,
} from '@chakra-ui/react';
import { EditIcon, DeleteIcon } from '@chakra-ui/icons';
import { useAuthStore } from '../store/auth';

interface VoteSessionManagementProps {
  unifiedVoteData: any;
  onRefresh: () => void;
}

const VoteSessionManagement: React.FC<VoteSessionManagementProps> = ({
  unifiedVoteData,
  onRefresh,
}) => {
  const toast = useToast();
  const token = useAuthStore((s) => s.token);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDisabledDaysModalOpen, setIsDisabledDaysModalOpen] = useState(false);
  const [weekStartDate, setWeekStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [disabledDays, setDisabledDays] = useState<Array<{ day: string; reason: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  const activeSession = unifiedVoteData?.activeSession;

  // 다음주 월요일 계산
  useEffect(() => {
    const now = new Date();
    const currentDay = now.getDay();
    const daysUntilMonday = currentDay === 0 ? 1 : (8 - currentDay) % 7;
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + daysUntilMonday);
    nextMonday.setHours(0, 0, 0, 0);
    
    const year = nextMonday.getFullYear();
    const month = String(nextMonday.getMonth() + 1).padStart(2, '0');
    const day = String(nextMonday.getDate()).padStart(2, '0');
    setWeekStartDate(`${year}-${month}-${day}`);

    // 기본 startTime: 이번주 월요일 00:01
    const thisWeekMonday = new Date(now);
    const daysToThisMonday = currentDay === 0 ? -6 : 1 - currentDay;
    thisWeekMonday.setDate(now.getDate() + daysToThisMonday);
    thisWeekMonday.setHours(0, 1, 0, 0);
    setStartTime(thisWeekMonday.toISOString().slice(0, 16));

    // 기본 endTime: 다음주 금요일 17:00
    const nextFriday = new Date(nextMonday);
    nextFriday.setDate(nextMonday.getDate() + 4);
    nextFriday.setHours(17, 0, 0, 0);
    setEndTime(nextFriday.toISOString().slice(0, 16));
  }, []);

  // 활성 세션의 disabledDays 로드
  useEffect(() => {
    if (activeSession?.disabledDays) {
      try {
        // 문자열인 경우 파싱, 배열인 경우 그대로 사용
        const parsed = typeof activeSession.disabledDays === 'string' 
          ? JSON.parse(activeSession.disabledDays) 
          : activeSession.disabledDays;
        setDisabledDays(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        console.warn('disabledDays 파싱 실패:', e);
        setDisabledDays([]);
      }
    } else {
      setDisabledDays([]);
    }
  }, [activeSession]);

  const handleCreateSession = async () => {
    if (!weekStartDate) {
      toast({
        title: '오류',
        description: '주 시작일을 입력해주세요.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsLoading(true);
    try {
      const baseUrl = await import('../constants').then(m => m.ensureApiBaseUrl()).catch(() => '/api/auth');
      const authToken = token || localStorage.getItem('token') || '';
      if (!authToken) {
        throw new Error('인증 토큰이 없습니다. 다시 로그인해주세요.');
      }
      const response = await fetch(`${baseUrl}/admin/vote-sessions/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          weekStartDate,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          disabledDays: disabledDays.length > 0 ? disabledDays : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '세션 생성 실패');
      }

      toast({
        title: '성공',
        description: '투표 세션이 생성되었습니다.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      setIsCreateModalOpen(false);
      onRefresh();
    } catch (error: any) {
      toast({
        title: '오류',
        description: error.message || '세션 생성 중 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateDisabledDays = async () => {
    setIsLoading(true);
    try {
      const baseUrl = await import('../constants').then(m => m.ensureApiBaseUrl()).catch(() => '/api/auth');
      const authToken = token || localStorage.getItem('token') || '';
      if (!authToken) {
        throw new Error('인증 토큰이 없습니다. 다시 로그인해주세요.');
      }
      
      console.log('📤 요일 차단 설정 요청:', {
        url: `${baseUrl}/admin/vote-sessions/active/disabled-days`,
        disabledDays,
        tokenLength: authToken.length
      });
      
      const response = await fetch(`${baseUrl}/admin/vote-sessions/active/disabled-days`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          disabledDays,
        }),
      });

      console.log('📥 응답 상태:', response.status, response.statusText);
      
      const data = await response.json();
      console.log('📥 응답 데이터:', data);

      if (!response.ok) {
        console.error('요일 차단 설정 실패:', data);
        throw new Error(data.error || '설정 업데이트 실패');
      }

      console.log('✅ 요일 차단 설정 성공:', data);
      console.log('업데이트된 disabledDays:', data.voteSession?.disabledDays);

      toast({
        title: '성공',
        description: '요일 차단 설정이 업데이트되었습니다.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      setIsDisabledDaysModalOpen(false);
      
      // 데이터 새로고침 전에 약간의 지연을 두어 DB 업데이트가 완료되도록 함
      setTimeout(() => {
        onRefresh();
      }, 500);
    } catch (error: any) {
      toast({
        title: '오류',
        description: error.message || '설정 업데이트 중 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDayDisabled = (dayKey: string, dayName: string) => {
    const existingIndex = disabledDays.findIndex((d) => d.day === dayKey);
    if (existingIndex >= 0) {
      setDisabledDays(disabledDays.filter((_, i) => i !== existingIndex));
    } else {
      setDisabledDays([...disabledDays, { day: dayKey, reason: `${dayName}요일 차단` }]);
    }
  };

  const updateDayReason = (dayKey: string, reason: string) => {
    setDisabledDays(
      disabledDays.map((d) => (d.day === dayKey ? { ...d, reason } : d))
    );
  };

  const dayMapping = [
    { key: 'MON', name: '월' },
    { key: 'TUE', name: '화' },
    { key: 'WED', name: '수' },
    { key: 'THU', name: '목' },
    { key: 'FRI', name: '금' },
  ];

  return (
    <VStack spacing={4} align="stretch" w="100%">
      <Flex justify="space-between" align="center">
        <Text fontSize="2xl" fontWeight="bold" color="#004ea8">
          📅 투표 세션 관리
        </Text>
        <HStack spacing={2}>
          {activeSession && (
            <Button
              colorScheme="purple"
              size="sm"
              onClick={() => setIsDisabledDaysModalOpen(true)}
            >
              요일 차단 설정
            </Button>
          )}
          <Button
            colorScheme="blue"
            bg="#004ea8"
            _hover={{ bg: '#003d7a' }}
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
          >
            새 세션 생성
          </Button>
        </HStack>
      </Flex>

      {/* 활성 세션 정보 */}
      {activeSession && (
        <Card borderRadius="lg" boxShadow="sm" border="1px solid" borderColor="gray.200">
          <CardBody p={4}>
            <Flex justify="space-between" align="center" mb={3}>
              <HStack spacing={2}>
                <Text fontSize="md" fontWeight="bold" color="gray.800">
                  활성 세션
                </Text>
                <Badge colorScheme="green" fontSize="xs" px={2} py={0.5} borderRadius="full">
                  활성
                </Badge>
              </HStack>
            </Flex>
            {(() => {
              let parsedDisabledDays: Array<{ day: string; reason: string }> = [];
              if (activeSession.disabledDays) {
                try {
                  parsedDisabledDays = typeof activeSession.disabledDays === 'string' 
                    ? JSON.parse(activeSession.disabledDays) 
                    : activeSession.disabledDays;
                  if (!Array.isArray(parsedDisabledDays)) {
                    parsedDisabledDays = [];
                  }
                } catch (e) {
                  parsedDisabledDays = [];
                }
              }
              return (
                <Flex gap={6} align="flex-start" flexWrap="wrap">
                  <Box>
                    <Text color="gray.600" fontWeight="medium" fontSize="xs" mb={0.5}>세션 ID</Text>
                    <Text color="gray.800" fontWeight="semibold" fontSize="sm">#{activeSession.sessionId}</Text>
                  </Box>
                  <Box>
                    <Text color="gray.600" fontWeight="medium" fontSize="xs" mb={0.5}>투표 기간</Text>
                    <Text color="gray.800" fontWeight="semibold" fontSize="sm">
                      {new Date(activeSession.weekStartDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} ~{' '}
                      {new Date(activeSession.endTime).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </Text>
                  </Box>
                  <Box>
                    <Text color="gray.600" fontWeight="medium" fontSize="xs" mb={0.5}>참여자</Text>
                    <Badge colorScheme="blue" fontSize="xs" px={2} py={0.5} borderRadius="full">
                      {activeSession.totalParticipants || 0}명
                    </Badge>
                  </Box>
                  <Box flex="1" minW="200px">
                    <Text color="gray.600" fontWeight="medium" fontSize="xs" mb={0.5}>차단된 요일</Text>
                    {parsedDisabledDays.length > 0 ? (
                      <HStack spacing={1.5} flexWrap="wrap">
                        {parsedDisabledDays.map((d: any) => (
                          <Badge 
                            key={d.day} 
                            colorScheme="red" 
                            fontSize="xs" 
                            px={2} 
                            py={0.5} 
                            borderRadius="full"
                            variant="subtle"
                          >
                            {dayMapping.find((m) => m.key === d.day)?.name || d.day}요일: {d.reason}
                          </Badge>
                        ))}
                      </HStack>
                    ) : (
                      <Text color="gray.400" fontSize="xs">없음</Text>
                    )}
                  </Box>
                </Flex>
              );
            })()}
          </CardBody>
        </Card>
      )}

      {!activeSession && (
        <Card>
          <CardBody>
            <Text color="gray.500" textAlign="center">
              현재 활성 세션이 없습니다.
            </Text>
          </CardBody>
        </Card>
      )}

      {/* 세션 생성 모달 */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>새 투표 세션 생성</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4} align="stretch">
              <FormControl isRequired>
                <FormLabel>주 시작일 (월요일)</FormLabel>
                <Input
                  type="date"
                  value={weekStartDate}
                  onChange={(e) => setWeekStartDate(e.target.value)}
                />
              </FormControl>
              <FormControl>
                <FormLabel>의견수렴 시작일시</FormLabel>
                <Input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </FormControl>
              <FormControl>
                <FormLabel>투표 마감일시</FormLabel>
                <Input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </FormControl>
              <Divider />
              <Text fontWeight="semibold">요일 차단 설정 (선택사항)</Text>
              <VStack spacing={2} align="stretch">
                {dayMapping.map(({ key, name }) => {
                  const disabledDay = disabledDays.find((d) => d.day === key);
                  return (
                    <Box key={key}>
                      <Checkbox
                        isChecked={!!disabledDay}
                        onChange={() => toggleDayDisabled(key, name)}
                      >
                        {name}요일 차단
                      </Checkbox>
                      {disabledDay && (
                        <FormControl mt={2} ml={6}>
                          <FormLabel fontSize="sm">차단 사유</FormLabel>
                          <Input
                            size="sm"
                            value={disabledDay.reason}
                            onChange={(e) => updateDayReason(key, e.target.value)}
                            placeholder="차단 사유를 입력하세요"
                          />
                        </FormControl>
                      )}
                    </Box>
                  );
                })}
              </VStack>
              <HStack spacing={2} justify="flex-end" mt={4}>
                <Button onClick={() => setIsCreateModalOpen(false)}>취소</Button>
                <Button colorScheme="blue" onClick={handleCreateSession} isLoading={isLoading}>
                  생성
                </Button>
              </HStack>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* 요일 차단 설정 모달 */}
      <Modal
        isOpen={isDisabledDaysModalOpen}
        onClose={() => setIsDisabledDaysModalOpen(false)}
        size="lg"
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>요일 차단 설정</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4} align="stretch">
              <Text fontSize="sm" color="gray.600">
                차단된 요일은 투표에서 선택할 수 없으며, 빨간색으로 표시됩니다.
              </Text>
              <VStack spacing={2} align="stretch">
                {dayMapping.map(({ key, name }) => {
                  const disabledDay = disabledDays.find((d) => d.day === key);
                  return (
                    <Box key={key}>
                      <Checkbox
                        isChecked={!!disabledDay}
                        onChange={() => toggleDayDisabled(key, name)}
                      >
                        {name}요일 차단
                      </Checkbox>
                      {disabledDay && (
                        <FormControl mt={2} ml={6}>
                          <FormLabel fontSize="sm">차단 사유</FormLabel>
                          <Input
                            size="sm"
                            value={disabledDay.reason}
                            onChange={(e) => updateDayReason(key, e.target.value)}
                            placeholder="차단 사유를 입력하세요"
                          />
                        </FormControl>
                      )}
                    </Box>
                  );
                })}
              </VStack>
              <HStack spacing={2} justify="flex-end" mt={4}>
                <Button onClick={() => setIsDisabledDaysModalOpen(false)}>취소</Button>
                <Button
                  colorScheme="purple"
                  onClick={handleUpdateDisabledDays}
                  isLoading={isLoading}
                >
                  저장
                </Button>
              </HStack>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </VStack>
  );
};

export default VoteSessionManagement;

