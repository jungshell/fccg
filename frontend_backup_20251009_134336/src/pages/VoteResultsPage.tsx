import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  VStack,
  HStack,
  Flex,
  Text,
  Button,
  Heading,
  SimpleGrid,
  Badge,
  Card,
  CardBody,
  CardHeader,
  useToast,
  Spinner,
  Alert,
  AlertIcon,
  Divider,
  Tooltip
} from '@chakra-ui/react';
import { 
  getUnifiedVoteDataNew,
  getSavedVoteResults,
  aggregateAndSaveVoteResults,
  resumeVoteSession,
  closeVoteSession,
  deleteVoteSession,
  bulkDeleteVoteSessions,
  renumberVoteSessions,
  startWeeklyVote,
  getAdminVoteSessionsSummary
} from '../api/auth';
import VoteCharts from '../components/VoteCharts';

interface VoteSession {
  id: number;
  weekStartDate: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
  isCompleted: boolean;
  voteCount: number;
  createdAt: string;
  updatedAt: string;
}

interface DayVoteResult {
  count: number;
  participants: Array<{
    userId: number;
    userName: string;
    votedAt: string;
  }>;
}

interface VoteResults {
  sessionId: number;
  weekStartDate: string;
  weekRange: string;
  isActive: boolean;
  isCompleted: boolean;
  results: {
    MON: DayVoteResult;
    TUE: DayVoteResult;
    WED: DayVoteResult;
    THU: DayVoteResult;
    FRI: DayVoteResult;
  };
  participants: Array<{
    userId: number;
    userName: string;
    selectedDays: string[];
    votedAt: string;
  }>;
  totalParticipants: number;
  totalVotes: number;
}

interface UnifiedVoteData {
  activeSession: VoteResults | null;
  lastWeekResults: VoteResults | null;
}

export default function VoteResultsPage() {
  const [allVoteSessions, setAllVoteSessions] = useState<VoteSession[]>([]);
  const [selectedVoteSessionId, setSelectedVoteSessionId] = useState<number | null>(null);
  const [selectedVoteResults, setSelectedVoteResults] = useState<VoteResults | null>(null);
  const [sessionDetails, setSessionDetails] = useState<VoteSession | null>(null);
  const [isAggregating, setIsAggregating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [currentPage, setCurrentPage] = useState(1);
  const [unifiedData, setUnifiedData] = useState<any>(null);
  const sessionsPerPage = 4;
  const toast = useToast();

  // 투표 세션 데이터 로드
  const loadVoteSessionsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('투표 세션 데이터 로드 시작...');
      
      // 투표 세션 요약 데이터 로드
      const summaryData = await getAdminVoteSessionsSummary();
      console.log('투표 세션 요약 데이터:', summaryData);
      
      const allSessions: VoteSession[] = summaryData.data?.sessions || [];
      
      // 중복 제거: 같은 주간을 대상으로 하는 세션 중 가장 최신 것만 유지
      const uniqueSessions = allSessions.reduce((acc: VoteSession[], current: VoteSession) => {
        const currentWeekStart = new Date(current.weekStartDate);
        const currentWeekEnd = new Date(currentWeekStart.getTime() + 4 * 24 * 60 * 60 * 1000); // 월-금
        
        // 이미 있는 세션 중 같은 주간을 대상으로 하는 것이 있는지 확인
        const existingSession = acc.find(session => {
          const existingWeekStart = new Date(session.weekStartDate);
          const existingWeekEnd = new Date(existingWeekStart.getTime() + 4 * 24 * 60 * 60 * 1000);
          
          // 같은 주간인지 확인 (시작일이 같으면 같은 주간)
          return existingWeekStart.getTime() === currentWeekStart.getTime();
        });
        
        if (!existingSession) {
          // 같은 주간의 세션이 없으면 추가
          acc.push(current);
        } else {
          // 같은 주간의 세션이 있으면 더 최신 것(더 큰 ID)으로 교체
          if (current.id > existingSession.id) {
            const index = acc.findIndex(s => s.id === existingSession.id);
            acc[index] = current;
          }
        }
        
        return acc;
      }, []);
      
      // weekStartDate 기준으로 내림차순 정렬 (최신 세션이 먼저)
      const sessions: VoteSession[] = uniqueSessions.sort((a: VoteSession, b: VoteSession) => {
        return new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime();
      });
      
      setAllVoteSessions(sessions);

      // 통합 데이터도 로드 (활성 세션 정보용)
      try {
        const unifiedData = await getUnifiedVoteDataNew();
        setUnifiedData(unifiedData);
      } catch (error) {
        console.warn('통합 데이터 로드 실패:', error);
        setUnifiedData(null);
      }

      // 활성 세션 또는 첫 세션 자동 선택
      const activeSession = sessions.find((s: VoteSession) => s.isActive) || sessions[0];
      if (activeSession) {
        console.log('선택된 세션:', activeSession);
        setSelectedVoteSessionId(activeSession.id);
        setSessionDetails(activeSession);

        // 해당 세션의 상세 결과 로드
        const results = await getSavedVoteResults(activeSession.id);
        console.log('세션 상세 결과:', results);
        setSelectedVoteResults(results);
      } else {
        console.log('선택할 수 있는 세션이 없습니다.');
        setError('투표 세션이 없습니다.');
      }
      
    } catch (e) {
      console.error('투표 세션 데이터 로드 실패:', e);
      setError('투표 세션 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVoteSessionsData();
  }, []); // 빈 의존성 배열로 초기 로드만 실행

  // 자동 새로고침 기능 (수정: autoRefresh가 true일 때만 실행)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoRefresh) {
      interval = setInterval(() => {
        console.log('자동 새로고침 실행...');
        loadVoteSessionsData();
        setLastUpdated(new Date());
      }, 30000); // 30초마다 새로고침
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [autoRefresh]);

  // 투표 데이터 변경 이벤트 리스너
  useEffect(() => {
    const handleVoteDataChanged = () => {
      console.log('🔄 관리자 페이지: 투표 데이터 변경 이벤트 수신 - 데이터 새로고침');
      loadVoteSessionsData();
      setLastUpdated(new Date());
    };

    window.addEventListener('voteDataChanged', handleVoteDataChanged);

    return () => {
      window.removeEventListener('voteDataChanged', handleVoteDataChanged);
    };
  }, [loadVoteSessionsData]);

  // 다음주 투표 세션 생성 핸들러
  const createNextWeekVoteSession = async () => {
    try {
      const result = await startWeeklyVote();
      toast({
        title: '투표 세션 생성 완료',
        description: result.message,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // 데이터 새로고침 및 이벤트 발생
      await loadVoteSessionsData();
      window.dispatchEvent(new CustomEvent('voteDataChanged'));
      console.log('✅ 투표 세션 생성 후 이벤트 발생');
    } catch (error: any) {
      console.error('투표 세션 생성 실패:', error);
      toast({
        title: '투표 세션 생성 실패',
        description: error.response?.data?.error || '서버 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // 투표 세션 마감/재개 토글 핸들러
  const toggleVoteSessionStatus = async (sessionId: number) => {
    try {
      // 토큰 확인
      const token = localStorage.getItem('token') || localStorage.getItem('auth_token_backup') || sessionStorage.getItem('token');
      console.log('🔍 투표마감 토큰 확인:', { sessionId, token: token ? '있음' : '없음' });
      
      const session = allVoteSessions.find(s => s.id === sessionId);
      
      if (!session) {
        toast({
          title: '오류',
          description: '세션을 찾을 수 없습니다.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      const isCurrentlyActive = session.isActive;
      
      if (isCurrentlyActive) {
        // 투표 마감 처리
        await closeVoteSession(sessionId);
        toast({
          title: '투표 마감 완료',
          description: '투표가 성공적으로 마감되었습니다.',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        // 투표 재개 처리
        try {
          await resumeVoteSession(sessionId);
          
          toast({
            title: '투표 재개 완료',
            description: '투표가 재개되었습니다.',
            status: 'info',
            duration: 3000,
            isClosable: true,
          });
        } catch (error) {
          console.error('투표 재개 오류:', error);
          toast({
            title: '투표 재개 실패',
            description: error.message || '투표 재개 중 오류가 발생했습니다.',
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
          return;
        }
      }
      
      // 데이터 새로고침 및 이벤트 발생
      loadVoteSessionsData();
      window.dispatchEvent(new CustomEvent('voteDataChanged'));
      console.log('✅ 투표 세션 상태 변경 후 이벤트 발생');
    } catch (error) {
      console.error('투표 세션 상태 변경 실패:', error);
      toast({
        title: '처리 실패',
        description: error instanceof Error ? error.message : '투표 상태 변경 중 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // 기존 투표 세션 마감 핸들러 (하위 호환성 유지)
  const handleCloseVoteSession = async (sessionId: number) => {
    await toggleVoteSessionStatus(sessionId);
  };

  // 투표 세션 삭제 핸들러
  const handleDeleteVoteSession = async (sessionId: number) => {
    if (!confirm('정말로 이 투표 세션을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      await deleteVoteSession(sessionId);
      toast({
        title: '세션 삭제 완료',
        description: '투표 세션이 성공적으로 삭제되었습니다.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // 데이터 새로고침
      loadVoteSessionsData();
      window.dispatchEvent(new CustomEvent('voteDataChanged'));
    } catch (error) {
      console.error('투표 세션 삭제 실패:', error);
      toast({
        title: '삭제 실패',
        description: error instanceof Error ? error.message : '투표 세션 삭제 중 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // 투표 세션 일괄 삭제 핸들러 (10, 11번 제외)
  const handleBulkDeleteVoteSessions = async () => {
    if (!confirm('10번, 11번 세션을 제외한 모든 투표 세션을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      const result = await bulkDeleteVoteSessions();
      toast({
        title: '일괄 삭제 완료',
        description: `${result.deletedCount}개의 투표 세션이 삭제되었습니다.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // 데이터 새로고침
      loadVoteSessionsData();
      window.dispatchEvent(new CustomEvent('voteDataChanged'));
    } catch (error) {
      console.error('투표 세션 일괄 삭제 실패:', error);
      toast({
        title: '일괄 삭제 실패',
        description: error instanceof Error ? error.message : '투표 세션 일괄 삭제 중 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // 투표 세션 ID 재설정 핸들러 (10, 11번을 1, 2번으로)
  const handleRenumberVoteSessions = async () => {
    if (!confirm('10번, 11번 세션을 1번, 2번으로 재설정하시겠습니까?')) {
      return;
    }

    try {
      const result = await renumberVoteSessions();
      toast({
        title: '재설정 완료',
        description: '세션 ID가 1번, 2번으로 재설정되었습니다.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      // 데이터 새로고침
      loadVoteSessionsData();
      window.dispatchEvent(new CustomEvent('voteDataChanged'));
    } catch (error) {
      console.error('투표 세션 재설정 실패:', error);
      toast({
        title: '재설정 실패',
        description: error instanceof Error ? error.message : '투표 세션 재설정 중 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };


  // 세션 선택 핸들러
  const handleSessionSelect = async (session: VoteSession) => {
    setSelectedVoteSessionId(session.id);
    setSessionDetails(session);
    
    try {
      console.log('세션 선택:', session.id);
      const results = await getSavedVoteResults(session.id);
      console.log('선택된 세션 결과:', results);
      setSelectedVoteResults(results);
    } catch (e) {
      console.error('투표 결과 로드 실패:', e);
      setSelectedVoteResults(null);
    }
  };

  // 집계 저장 핸들러
  const handleAggregateSave = async () => {
    if (!selectedVoteSessionId) {
      toast({
        title: '오류',
        description: '선택된 세션이 없습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setIsAggregating(true);
      console.log('집계 저장 시작:', selectedVoteSessionId);
      
      const result = await aggregateAndSaveVoteResults(selectedVoteSessionId);
      console.log('집계 저장 결과:', result);
      
      toast({ 
        title: '집계 저장 완료', 
        description: `세션 ${selectedVoteSessionId}의 집계가 완료되었습니다.`,
        status: 'success', 
        duration: 3000, 
        isClosable: true 
      });
      
      // 데이터 새로고침 및 이벤트 발생
      await loadVoteSessionsData();
      window.dispatchEvent(new CustomEvent('voteDataChanged'));
      console.log('✅ 투표 세션 생성 후 이벤트 발생');
    } catch (e) {
      console.error('집계 저장 실패:', e);
      toast({ 
        title: '집계 저장 실패', 
        description: '세션 집계를 저장하지 못했습니다.', 
        status: 'error', 
        duration: 3000, 
        isClosable: true 
      });
    } finally {
      setIsAggregating(false);
    }
  };


  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minH="400px">
        <VStack spacing={4}>
          <Spinner size="xl" color="blue.500" />
          <Text color="gray.600">투표 세션 데이터를 불러오는 중...</Text>
        </VStack>
      </Box>
    );
  }

  // 오류가 있어도 폴백 데이터를 보여주기 위해 상단 경고만 노출

  return (
    <VStack spacing={6} align="stretch">
      {error && (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <Box>
            <Text fontWeight="bold">오류가 발생했습니다!</Text>
            <Text fontSize="sm">{error}</Text>
          </Box>
        </Alert>
      )}
      {/* 헤더 - 간소화 */}
      <HStack justify="space-between" align="center" mb={4}>
        <Text fontSize="sm" color="gray.500">
          마지막 업데이트: {lastUpdated.toLocaleTimeString('ko-KR')}
        </Text>
        <HStack spacing={2}>
          <Button 
            size="sm" 
            colorScheme={autoRefresh ? "green" : "gray"}
            variant={autoRefresh ? "solid" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
{autoRefresh ? "자동 새로고침 ON" : "자동 새로고침 OFF"}
          </Button>
          <Button 
            size="sm" 
            colorScheme="blue" 
            onClick={() => {
              loadVoteSessionsData();
              setLastUpdated(new Date());
              window.dispatchEvent(new CustomEvent('voteDataChanged'));
              console.log('✅ 수동 새로고침 후 이벤트 발생');
            }}
          >
            새로고침
          </Button>
        </HStack>
      </HStack>

      {/* 투표 세션 통계 - 각각 네모칸으로 1행 */}
      <SimpleGrid columns={{ base: 2, sm: 2, md: 4 }} spacing={4}>
        <Box bg="white" p={4} borderRadius="lg" shadow="sm" border="1px" borderColor="gray.200">
          <HStack justify="space-between" align="center">
            <Text fontSize="sm" color="gray.600">전체 세션</Text>
            <Text fontSize="2xl" fontWeight="bold" color="blue.600">{unifiedData?.stats?.totalSessions || allVoteSessions.length}</Text>
          </HStack>
        </Box>
        <Box bg="white" p={4} borderRadius="lg" shadow="sm" border="1px" borderColor="gray.200">
          <HStack justify="space-between" align="center">
            <Text fontSize="sm" color="gray.600">완료된 세션</Text>
            <Text fontSize="2xl" fontWeight="bold" color="green.600">
              {unifiedData?.stats?.completedSessions || allVoteSessions.filter((s: VoteSession) => s.isCompleted).length}
            </Text>
          </HStack>
        </Box>
        <Box bg="white" p={4} borderRadius="lg" shadow="sm" border="1px" borderColor="gray.200">
          <HStack justify="space-between" align="center">
            <Text fontSize="sm" color="gray.600">진행중 세션</Text>
            <Text fontSize="2xl" fontWeight="bold" color="orange.600">
              {unifiedData?.stats?.activeSessions || allVoteSessions.filter((s: VoteSession) => s.isActive).length}
            </Text>
          </HStack>
        </Box>
        <Box bg="white" p={4} borderRadius="lg" shadow="sm" border="1px" borderColor="gray.200">
          <HStack justify="space-between" align="center">
            <Text fontSize="sm" color="gray.600">총 참여자</Text>
            <Text fontSize="2xl" fontWeight="bold" color="purple.600">
              {unifiedData?.stats?.totalParticipants || allVoteSessions.reduce((sum: number, s: any) => sum + (s.voteCount || 0), 0)}
            </Text>
          </HStack>
        </Box>
      </SimpleGrid>

      {/* 투표 세션 목록 */}
      <Box bg="white" p={6} borderRadius="lg" shadow="sm" border="1px" borderColor="gray.200">
        <HStack justify="space-between" mb={4}>
          <Heading size="md" color="gray.800">투표 세션 목록</Heading>
          <HStack spacing={2}>
          </HStack>
        </HStack>
        {allVoteSessions.length === 0 ? (
          <Box textAlign="center" py={8}>
            <Text color="gray.500" fontSize="lg">투표 세션이 없습니다.</Text>
            <Text color="gray.400" fontSize="sm" mt={2}>
              첫 번째 투표 세션을 생성해보세요.
            </Text>
          </Box>
        ) : (
          <VStack spacing={3} align="stretch">
            {(() => {
              // 페이지네이션 계산
              const totalPages = Math.ceil(allVoteSessions.length / sessionsPerPage);
              const startIndex = (currentPage - 1) * sessionsPerPage;
              const endIndex = startIndex + sessionsPerPage;
              const currentSessions = allVoteSessions.slice(startIndex, endIndex);

              return (
                <>
                  {currentSessions.map((session: VoteSession) => {
              // 날짜 포맷팅 함수 (UTC 기준으로 처리)
              const formatDateWithDay = (dateString: string) => {
                const date = new Date(dateString);
                // UTC 기준으로 날짜 추출
                const year = date.getUTCFullYear();
                const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                const day = String(date.getUTCDate()).padStart(2, '0');
                const days = ['일', '월', '화', '수', '목', '금', '토'];
                const dayName = days[date.getUTCDay()];
                return `${year}. ${month}. ${day}.(${dayName})`;
              };

              // 다음주 일정투표기간 (월-금) - 한국시간 기준
              const voteStartDate = new Date(session.weekStartDate);
              
              // weekStartDate는 이미 다음주 월요일이어야 함
              // 만약 일요일로 저장되어 있다면 월요일로 조정
              const dayOfWeek = voteStartDate.getDay(); // 0: 일요일, 1: 월요일, ..., 6: 토요일
              if (dayOfWeek === 0) {
                // 일요일인 경우 월요일로 조정
                voteStartDate.setDate(voteStartDate.getDate() + 1);
              } else if (dayOfWeek !== 1) {
                // 월요일이 아닌 경우 해당 주의 월요일로 조정
                const daysToMonday = dayOfWeek === 0 ? 1 : 1 - dayOfWeek;
                voteStartDate.setDate(voteStartDate.getDate() + daysToMonday);
              }
              
              const voteEndDate = new Date(voteStartDate.getTime() + 4 * 24 * 60 * 60 * 1000); // 월요일부터 금요일까지 (4일)
              const votePeriod = `${formatDateWithDay(voteStartDate.toISOString())} ~ ${formatDateWithDay(voteEndDate.toISOString())}`;
              
              // 의견수렴기간 (세션의 startTime 사용)
              const opinionStartDate = new Date(session.startTime);
              
              let opinionPeriod: string;
              
              if (session.isActive) {
                // 진행중인 경우 "진행중" 표시
                opinionPeriod = `${formatDateWithDay(opinionStartDate.toISOString())} 00:01 - 진행중`;
              } else {
                // 완료된 경우 실제 투표 마감 시간 표시 (UTC를 한국 시간으로 변환)
                const opinionEndDate = new Date(session.endTime);
                
                // 한국 시간으로 변환 (UTC+9)
                const kstEndDate = new Date(opinionEndDate.getTime() + (9 * 60 * 60 * 1000));
                
                // 안전한 날짜 포맷팅
                const year = kstEndDate.getFullYear();
                const month = String(kstEndDate.getMonth() + 1).padStart(2, '0');
                const day = String(kstEndDate.getDate()).padStart(2, '0');
                const hours = String(kstEndDate.getHours()).padStart(2, '0');
                const minutes = String(kstEndDate.getMinutes()).padStart(2, '0');
                const days = ['일', '월', '화', '수', '목', '금', '토'];
                const dayName = days[kstEndDate.getDay()];
                
                // 디버깅을 위한 로그
                console.log('🔍 의견수렴기간 마감시간 계산:', {
                  originalEndTime: session.endTime,
                  originalEndTimeUTC: opinionEndDate.toISOString(),
                  kstEndDate: kstEndDate,
                  formatted: `${year}. ${month}. ${day}.(${dayName}) ${hours}:${minutes}`
                });
                
                // 최종 시간 표시
                const timeDisplay = `${year}. ${month}. ${day}.(${dayName}) ${hours}:${minutes}`;
                
                opinionPeriod = `${formatDateWithDay(opinionStartDate.toISOString())} 00:01 ~ ${timeDisplay}`;
              }

              // 참여자와 미참자 목록
              const participants = session.participants || [];
              const participantNames = session.participantNames || participants.map(p => p.userName).join(', ');
              const nonParticipantNames = session.nonParticipants || [];
              const participantCount = session.participantCount || session.voteCount || 0;

              // 선택된 세션이거나 현재 진행중인 세션인지 확인
              const isSelected = selectedVoteSessionId === session.id;
              const isActive = session.isActive;
              const showDetailed = isSelected || isActive;

              return (
                <Box 
                  key={session.id} 
                  p={showDetailed ? 4 : 3} 
                  border="1px" 
                  borderColor={isSelected ? "blue.300" : "gray.200"} 
                  borderRadius="md"
                  cursor="pointer"
                  bg={isSelected ? "blue.50" : "white"}
                  _hover={{ bg: isSelected ? "blue.50" : "gray.50" }}
                  onClick={() => handleSessionSelect(session)}
                >
                  {showDetailed ? (
                    // 자세한 정보 표시 (선택된 세션이나 진행중인 세션)
                    <VStack align="stretch" spacing={3}>
                      <HStack justify="space-between">
                        <VStack align="start" spacing={1}>
                          <Text fontWeight="bold" fontSize="lg">
                            세션 #{session.id} - 다음주 일정투표기간 : {votePeriod}
                          </Text>
                          <Text fontSize="sm" color="gray.600">
                            의견수렴기간 : {opinionPeriod}
                          </Text>
                        </VStack>
                        <VStack align="end" spacing={2}>
                          <HStack spacing={2}>
                            <Badge 
                              colorScheme={session.isActive ? "green" : session.isCompleted ? "blue" : "gray"}
                              fontSize="sm"
                              px={3}
                              py={1}
                            >
                              {session.isActive ? '진행중' : session.isCompleted ? '완료' : '대기'}
                            </Badge>
                            {(() => {
                              const now = new Date();
                              const sessionWeekStart = new Date(session.weekStartDate);
                              const daysDiff = Math.floor((sessionWeekStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                              
                              // 다음주 일정투표기간 전주(월-금)인지 확인 (0~6일 전)
                              const isWithinVotePeriod = daysDiff >= 0 && daysDiff <= 6;
                              
                              return isWithinVotePeriod ? (
                                <HStack spacing={2}>
                                  <Button
                                    size="sm"
                                    colorScheme={session.isActive ? "red" : "green"}
                                    variant="solid"
                                    bg={session.isActive ? "#e53e3e" : "#38a169"}
                                    _hover={{ bg: session.isActive ? "#c53030" : "#2f855a" }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleVoteSessionStatus(session.id);
                                    }}
                                  >
                                    {session.isActive ? '투표 마감' : '투표 재개'}
                                  </Button>
                                  {session.id !== 10 && session.id !== 11 && (
                                    <Button
                                      size="sm"
                                      colorScheme="red"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteVoteSession(session.id);
                                      }}
                                    >
                                      삭제
                                    </Button>
                                  )}
                                </HStack>
                              ) : null;
                            })()}
                          </HStack>
                          {isSelected && (
                            <Text fontSize="xs" color="blue.600" fontWeight="bold">
                              선택됨
                            </Text>
                          )}
                        </VStack>
                      </HStack>
                      
                      {/* 참여자/미참자 목록 */}
                      <Box>
                        <Text fontSize="sm" color="gray.600">
                          참여자({participantCount}명): {participantNames || '없음'}
                        </Text>
                        {nonParticipantNames.length > 0 && (
                          <Text fontSize="sm" color="gray.500">
                            미참자({nonParticipantNames.length}명): {nonParticipantNames.join(', ')}
                          </Text>
                        )}
                      </Box>
                    </VStack>
                  ) : (
                    // 간략한 정보 표시 (일반 세션)
                    <HStack justify="space-between" align="center">
                      <VStack align="start" spacing={1}>
                        <Text fontWeight="bold" fontSize="md">
                          세션 #{session.id} - 다음주 일정투표기간 : {votePeriod}
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          의견수렴기간 : {opinionPeriod}
                        </Text>
                      </VStack>
                      <VStack align="end" spacing={1}>
                        <HStack spacing={2}>
                          <Badge 
                            colorScheme={session.isActive ? "green" : session.isCompleted ? "blue" : "gray"}
                            fontSize="xs"
                            px={2}
                            py={1}
                          >
                            {session.isActive ? '진행중' : session.isCompleted ? '완료' : '대기'}
                          </Badge>
                          <Button
                            size="xs"
                            colorScheme={session.isActive ? "red" : "green"}
                            variant="solid"
                            bg={session.isActive ? "#e53e3e" : "#38a169"}
                            _hover={{ bg: session.isActive ? "#c53030" : "#2f855a" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleVoteSessionStatus(session.id);
                            }}
                          >
                            {session.isActive ? '마감' : '재개'}
                          </Button>
                        </HStack>
                        <Text fontSize="xs" color="gray.500">
                          참여자 {participantCount}명
                        </Text>
                      </VStack>
                    </HStack>
                  )}
                </Box>
              );
                  })}
                  
                  {/* 페이지네이션 */}
                  {totalPages > 1 && (
                    <HStack justify="center" spacing={2} mt={4}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        isDisabled={currentPage === 1}
                      >
                        이전
                      </Button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <Button
                          key={page}
                          size="sm"
                          variant={currentPage === page ? "solid" : "outline"}
                          colorScheme={currentPage === page ? "blue" : "gray"}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      ))}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        isDisabled={currentPage === totalPages}
                      >
                        다음
                      </Button>
                    </HStack>
                  )}
                </>
              );
            })()}
          </VStack>
        )}
      </Box>

      {/* 선택된 세션의 상세 결과 - 컴팩트 버전 */}
      {selectedVoteSessionId && sessionDetails && (
        <Box bg="white" p={4} borderRadius="md" shadow="sm" border="1px" borderColor="gray.200">
          <Flex justify="space-between" align="center" mb={3}>
            <Text fontSize="sm" fontWeight="bold" color="gray.700">
              📊 요일별 투표 분포
            </Text>
            <Text fontSize="xs" color="gray.500">
              {(() => {
                const voteWeekStartDate = new Date(sessionDetails.weekStartDate);
                const dayOfWeek = voteWeekStartDate.getDay();
                if (dayOfWeek === 0) {
                  voteWeekStartDate.setDate(voteWeekStartDate.getDate() + 1);
                } else if (dayOfWeek !== 1) {
                  const daysToMonday = dayOfWeek === 0 ? 1 : 1 - dayOfWeek;
                  voteWeekStartDate.setDate(voteWeekStartDate.getDate() + daysToMonday);
                }
                
                const year = voteWeekStartDate.getFullYear();
                const month = String(voteWeekStartDate.getMonth() + 1).padStart(2, '0');
                const day = String(voteWeekStartDate.getDate()).padStart(2, '0');
                const days = ['일', '월', '화', '수', '목', '금', '토'];
                const dayName = days[voteWeekStartDate.getDay()];
                return `${year}. ${month}. ${day}.(${dayName}) 주간`;
              })()}
            </Text>
          </Flex>
          
          {selectedVoteResults ? (
            <VoteCharts 
              key={`vote-charts-${selectedVoteResults.sessionId}-${selectedVoteResults.totalVotes}-${Math.random()}`}
              voteResults={selectedVoteResults} 
            />
          ) : (
            <Box textAlign="center" py={4}>
              <Text color="gray.500" fontSize="sm">상세 결과가 없습니다.</Text>
            </Box>
          )}
        </Box>
      )}
    </VStack>
  );
}
