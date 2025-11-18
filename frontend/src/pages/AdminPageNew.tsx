import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  Flex,
  SimpleGrid,
  Text,
  VStack,
  useToast,
  useDisclosure,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  FormControl,
  FormLabel,
  HStack,
  Icon,
  Divider,
  Switch,
  Select,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Badge,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Progress,
  Skeleton
} from '@chakra-ui/react';
import { ViewIcon, CalendarIcon, SettingsIcon, InfoIcon } from '@chakra-ui/icons';
import { GameCardSkeleton, MemberListSkeleton } from '../components/common/SkeletonLoader';
import { getValidToken, getMemberStats, type Game } from '../api/auth';
import MemberManagement from '../components/MemberManagement';
import { API_ENDPOINTS } from '../constants';
import GameManagement from '../components/GameManagement';
import ThisWeekScheduleManagement from '../components/ThisWeekScheduleManagement';
import FootballFieldPage from './FootballFieldPage';
import VoteResultsPage from './VoteResultsPage';
import VoteSessionManagement from '../components/VoteSessionManagement';
import { useAuthStore } from '../store/auth';
import ManualModal from '../components/ManualModal';
import FloatingHelpButton from '../components/FloatingHelpButton';

// ===== 타입 정의 =====
interface ThisWeekSchedule {
  id: number;
  date: string;
  event: string;
  description?: string;
  createdById: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: number;
    name: string;
  };
}

interface ExtendedMember {
  id: number;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'DELETED';
  createdAt?: string;
}

interface Player {
  id: string;
  name: string;
  position: string;
  jerseyNumber?: number;
  phone?: string;
  email?: string;
  joinDate: string;
  preferredPosition: string[];
  skillRating: number;
  attendanceRate: number;
  isActive: boolean;
  notes?: string;
}

// 풋살 경기 현황판 타입
type PlayerPosition = 'GK' | 'DF' | 'MF' | 'FW';

interface FieldPlayer {
  name: string;
  number: number;
  position: PlayerPosition;
}

interface Team {
  name: string;
  players: FieldPlayer[];
  score: number;
}

// 알림 타입 정의
            interface Notification {
              id: string;
              type: 'GAME_REMINDER' | 'VOTE_REMINDER' | 'NEW_MEMBER' | 'GAME_RESULT' | 'VOTE_WARNING' | 'MEMBER_SUSPENDED' | 'GAME_DAY_BEFORE' | 'GAME_DAY_OF' | 'VOTE_START';
              title: string;
              message: string;
              recipients: number[]; // 사용자 ID 배열
              sentAt: string;
              status: 'PENDING' | 'SENT' | 'FAILED';
              deliveryMethods: ('email' | 'push' | 'inapp')[];
              metadata?: any;
            }


// 최근 활동 타입 정의
            interface ActivityLog {
              id: string;
              userId: number;
              userName: string;
              action: 'LOGIN' | 'LOGOUT' | 'GAME_JOIN' | 'GAME_CANCEL' | 'VOTE_PARTICIPATE' | 'VOTE_ABSENT' | 'ANNOUNCEMENT_CREATE' | 'ANNOUNCEMENT_EDIT' | 'MEMBER_STATUS_CHANGE' | 'VOTE_WARNING' | 'MEMBER_SUSPENDED' | 'GAME_DAY_BEFORE' | 'GAME_DAY_OF' | 'VOTE_START';
              description: string;
              timestamp: string;
              metadata?: any;
            }

// 투표 참여 기록 타입
interface VoteRecord {
  userId: number;
  userName: string;
  voteDate: string;
  participated: boolean;
  year: number;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'urgent' | 'normal' | 'info';
  startDate: string;
  endDate: string;
  isActive: boolean;
  author: string;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
}

interface NotificationSettings {
  gameReminder: {
    enabled: boolean;
    beforeHours: number;
    targets: string[];
  };
  voteReminder: {
    enabled: boolean;
    beforeHours: number;
    targets: string[];
  };
  newMemberNotification: {
    enabled: boolean;
    targets: string[];
  };
  gameResultNotification: {
    enabled: boolean;
    targets: string[];
  };
}

interface SiteSettings {
  teamName: string;
  teamDescription: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  foundedYear: string;
  teamMotto: string;
}

type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER';

// 회원 등급별 권한 정의
const rolePermissions = {
  SUPER_ADMIN: {
    name: '슈퍼관리자',
    color: 'red',
    permissions: ['all']
  },
  ADMIN: {
    name: '관리자',
    color: 'blue',
    permissions: ['member_management', 'game_management', 'content_management', 'homepage_management']
  },
  MEMBER: {
    name: '회원',
    color: 'gray',
    permissions: ['vote', 'schedule_view', 'photo_upload', 'comment_write']
  }
};

// TopParticipantItem 컴포넌트 정의
interface TopParticipantItemProps {
  member: {
    id: number;
    name: string;
    role: string;
    gameParticipation: number;
    voteParticipation: number;
    activityScore: number;
    gameParticipationCount: number;
    voteParticipationCount: number;
  };
  index: number;
}

const TopParticipantItem: React.FC<TopParticipantItemProps> = ({ member, index }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Box key={member.id} mb={2}>
      <Flex
        align="center"
        justify="space-between"
        p={3}
        bg={index === 0 ? "gold.50" : index === 1 ? "gray.50" : "bronze.50"}
        borderRadius="md"
        border="1px solid"
        borderColor={index === 0 ? "gold.200" : index === 1 ? "gray.200" : "bronze.200"}
        cursor="pointer"
        onClick={() => setIsExpanded(!isExpanded)}
        _hover={{ bg: index === 0 ? "gold.100" : index === 1 ? "gray.100" : "bronze.100" }}
      >
        <HStack spacing={3}>
          <Text fontWeight="bold" fontSize="lg">
            {index + 1}위
          </Text>
          <Text fontWeight="bold" fontSize="lg">
            {member.name}
          </Text>
          <Badge colorScheme={index === 0 ? "yellow" : index === 1 ? "gray" : "orange"}>
            {member.activityScore}점
          </Badge>
        </HStack>
        <Text fontSize="sm" color="gray.500">
          {isExpanded ? '▼' : '▶'}
        </Text>
      </Flex>
      
      {isExpanded && (
        <Box
          bg="blue.50"
          p={3}
          borderRadius="md"
          border="1px solid"
          borderColor="blue.200"
          mt={1}
        >
          <VStack align="start" spacing={2}>
            <Text fontSize="sm">
              <Text as="span" fontWeight="bold">경기 참여:</Text> {member.gameParticipationCount}회 × 50점 = {member.gameParticipationCount * 50}점
            </Text>
            <Text fontSize="sm">
              <Text as="span" fontWeight="bold">투표 참여:</Text> {member.voteParticipationCount}회 × 30점 = {member.voteParticipationCount * 30}점
            </Text>
            <Text fontSize="sm">
              <Text as="span" fontWeight="bold">총 활동점수:</Text> {member.activityScore}점
            </Text>
            <Text fontSize="sm">
              <Text as="span" fontWeight="bold">경기 참여율:</Text> {member.gameParticipation}%
            </Text>
            <Text fontSize="sm">
              <Text as="span" fontWeight="bold">투표 참여율:</Text> {member.voteParticipation}%
            </Text>
          </VStack>
        </Box>
      )}
    </Box>
  );
};

export default function AdminPageNew() {
  const [userList, setUserList] = useState<ExtendedMember[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [thisWeekSchedules, setThisWeekSchedules] = useState<ThisWeekSchedule[]>([]);
  const [memberStats, setMemberStats] = useState<{
    totalMembers?: number;
    thisWeekGame?: number;
    nextWeekVote?: number;
  }>({});
  const [loading, setLoading] = useState(true);
  
  // 통합 API 데이터 상태
  const [unifiedVoteData, setUnifiedVoteData] = useState<{
    activeSession: any;
    lastWeekResults: any;
    allSessions: any[];
  } | null>(null);

  // 활동 분석 데이터 상태
  const [activityAnalysisData, setActivityAnalysisData] = useState<{
    summary?: {
      participationRate: number;
      voteParticipationRate: number;
      activeUsers: number;
      thisMonthGames: number;
    };
    memberStats?: Array<{
      id: number;
      name: string;
      role: string;
      gameParticipation: number;
      voteParticipation: number;
      activityScore: number;
      gameParticipationCount: number;
      voteParticipationCount: number;
    }>;
    monthlyGameStats?: Array<{
      month: string;
      gameCount: number;
    }>;
    gameTypeDistribution?: {
      match: number;
      friendly: number;
    };
  } | null>(null);
  const [selectedMenu, setSelectedMenu] = useState(() => {
    // URL 파라미터에서 메뉴 상태 복원
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('menu') || 'dashboard';
  });

  // 메뉴 선택 시 URL 업데이트
  const handleMenuSelect = (menu: string) => {
    setSelectedMenu(menu);
    const url = new URL(window.location.href);
    url.searchParams.set('menu', menu);
    window.history.replaceState({}, '', url.toString());
  };
  const user = useAuthStore((s) => s.user);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('MEMBER');
  

  
  // 알림 설정 상태
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    gameReminder: {
      enabled: true,
      beforeHours: 24,
      targets: ['all']
    },
    voteReminder: {
      enabled: true,
      beforeHours: 12,
      targets: ['all']
    },
    newMemberNotification: {
      enabled: true,
      targets: ['admin']
    },
    gameResultNotification: {
      enabled: true,
      targets: ['all']
    }
  });
  const [isNotificationChanged, setIsNotificationChanged] = useState(false);

  // 선수 관리 상태 - API에서 데이터를 가져옴
  const [players, setPlayers] = useState<Player[]>([]);
  const [isPlayerFormOpen, setIsPlayerFormOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [newPlayer, setNewPlayer] = useState<Partial<Player>>({
    name: '',
    position: 'MF',
    preferredPosition: [],
    skillRating: 70,
    attendanceRate: 0,
    isActive: true,
    joinDate: new Date().toISOString().split('T')[0]
  });

  // 공지사항 관리 상태 - API에서 데이터를 가져옴
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isAnnouncementFormOpen, setIsAnnouncementFormOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [newAnnouncement, setNewAnnouncement] = useState<Partial<Announcement>>({
    title: '',
    content: '',
    type: 'normal',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    isActive: true,
    pinned: false
  });

  // 최근 활동 및 투표 관리 상태
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [voteRecords, setVoteRecords] = useState<VoteRecord[]>([]);
  const [voteWarnings, setVoteWarnings] = useState<{userId: number, userName: string, warningCount: number, lastWarningDate: string}[]>([]);
  // 최근 발송 알림 상세 보기 모달 상태
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);

  // 풋살 경기 현황판 상태
  const [teamA, setTeamA] = useState<Team>({
    name: 'A팀',
    players: [],
    score: 0
  });
  const [teamB, setTeamB] = useState<Team>({
    name: 'B팀',
    players: [],
    score: 0
  });
  const [newPlayerA, setNewPlayerA] = useState<FieldPlayer>({
    name: '',
    number: 1,
    position: 'MF'
  });
  const [newPlayerB, setNewPlayerB] = useState<FieldPlayer>({
    name: '',
    number: 1,
    position: 'MF'
  });

  // 알림 시스템 상태
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationSystemActive, setIsNotificationSystemActive] = useState(false);


  // 사용자 정보가 변경될 때마다 권한 업데이트
  useEffect(() => {
    if (user?.email === 'sti60val@gmail.com') {
      setCurrentUserRole('SUPER_ADMIN');
    } else if (user?.role === 'ADMIN') {
      setCurrentUserRole('ADMIN');
    } else {
      setCurrentUserRole('MEMBER');
    }
  }, [user]);
  
  const toast = useToast();
  const adminManual = useDisclosure();

  // 메뉴별 설명 반환 함수
  const getMenuDescription = (menu: string) => {
    const descriptions: { [key: string]: string } = {
      'dashboard': '전체 현황 및 통계 확인',
      'users': '회원 등록, 수정, 삭제 관리',
      'vote-results': '투표 결과 확인 및 관리',
      'vote-sessions': '투표 세션 생성 및 관리',
      'games': '경기 일정 생성 및 관리',
      'this-week-schedules': '이번주 일정 관리',
      'notifications': '알림 발송 및 관리',
      'analytics': '회원 활동 분석 및 통계',
      'football': '풋살 경기 현황판 관리'
    };
    return descriptions[menu] || '관리자 기능 가이드';
  };
  
  // 사용하지 않는 코드 제거
  // const { onOpen: onGameModalOpen } = useDisclosure();
  
  // 회원 통계 상태
  // const [memberStats, setMemberStats] = useState({
  //   totalMembers: 0,
  //   activeMembers: 0,
  //   recentMembers: 0,
  //   activeRate: 0,
  //   averageAttendanceRate: 0
  // });
  
  // 통합 투표 데이터 로드 함수
  const loadUnifiedVoteData = useCallback(async () => {
    try {
      const baseUrl4 = await import('../constants').then(m => m.ensureApiBaseUrl()).catch(() => '/api/auth');
      const unifiedResponse = await fetch(`${baseUrl4}/unified-vote-data`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (unifiedResponse.ok) {
        const unifiedData = await unifiedResponse.json();
        const unifiedVoteDataToSet = {
          activeSession: unifiedData.activeSession || null,
          allMembers: unifiedData.allMembers || [],
          lastWeekResults: unifiedData.lastWeekResults || null,
          allSessions: unifiedData.allSessions || []
        };
        setUnifiedVoteData(unifiedVoteDataToSet);
        console.log('✅ 통합 투표 데이터 로드 성공');
        return unifiedVoteDataToSet;
      } else {
        console.log('❌ 통합 투표 데이터 로드 실패:', unifiedResponse.status);
        return null;
      }
    } catch (error) {
      console.error('통합 투표 데이터 로드 실패:', error);
      return null;
    }
  }, [setUnifiedVoteData]);
  
  // 데이터 로드
  const loadData = useCallback(async () => {
    setLoading(true);
    
    try {
      console.log('데이터 로딩 시작...');
      
      // 각 API를 개별적으로 호출하여 일부가 실패해도 다른 데이터는 표시
      
      // 1. 회원 데이터 로드 - 단순화된 통합 API 사용
      try {
        console.log('🔄 회원 데이터 로드 시작 - 통합 API 사용');
        
        const { getApiBaseUrl } = await import('../config/api');
        const baseUrl = await getApiBaseUrl();
        const token = await getValidToken();
        const response = await fetch(`${baseUrl}/members`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const responseData = await response.json();
          console.log('✅ 통합 API 응답 성공:', responseData);
          
          if (responseData.members && Array.isArray(responseData.members)) {
            const convertedMembers: ExtendedMember[] = responseData.members.map((member: any) => ({
              id: member.id,
              name: member.name,
              email: member.email || '',
              role: member.role || 'MEMBER',
              status: member.status || 'ACTIVE',
              createdAt: member.createdAt
            }));
            
            console.log('📋 변환된 회원 데이터:', convertedMembers);
            setUserList(convertedMembers);
            
            // localStorage에 최신 데이터 저장 (캐시용)
            localStorage.setItem('adminUserList', JSON.stringify(convertedMembers));
          } else {
            console.log('⚠️ 회원 데이터가 비어있음');
            setUserList([]);
          }
        } else {
          console.log('❌ 통합 API 응답 실패:', response.status);
          setUserList([]);
        }
      } catch (error) {
        console.error('❌ 회원 데이터 로드 실패:', error);
        setUserList([]);
      }
      
      // 2. 경기 데이터 로드 - 통합 API 사용 (totalParticipantCount 포함)
      try {
        console.log('🔄 경기 데이터 로드 시작 - /api/auth/members 통합 API 사용');
        
        const baseUrl2 = await import('../constants').then(m => m.ensureApiBaseUrl()).catch(() => '/api/auth');
        const response = await fetch(`${baseUrl2}/members`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (response.ok) {
          const unifiedData = await response.json();
          console.log('✅ 통합 데이터 응답 성공:', unifiedData?.games?.length || 0, '경기');
          console.log('📋 통합 데이터 상세:', unifiedData);
          
          if (unifiedData && Array.isArray(unifiedData.games)) {
            setGames(unifiedData.games);
            console.log('📋 경기 데이터 설정 완료:', unifiedData.games.length, '경기');
            console.log('📋 첫 번째 경기 데이터:', unifiedData.games[0]);
            console.log('📋 첫 번째 경기 totalParticipantCount:', unifiedData.games[0]?.totalParticipantCount);
            console.log('📋 첫 번째 경기 allParticipantNames:', unifiedData.games[0]?.allParticipantNames);
        } else {
            console.log('⚠️ 경기 데이터가 배열이 아님');
            setGames([]);
          }
        } else {
          console.log('❌ 통합 데이터 API 응답 실패:', response.status);
          setGames([]);
        }
      } catch (error) {
        console.error('❌ 경기 데이터 로드 실패:', error);
        setGames([]);
      }
      
      // 3. 통계 데이터 로드
      try {
        const statsResponse = await getMemberStats();
        console.log('통계 데이터 응답:', statsResponse);
        
        if (statsResponse) {
          setMemberStats(statsResponse);
        } else {
          console.log('통계 데이터 응답이 올바르지 않음:', statsResponse);
          setMemberStats({});
        }
      } catch (error) {
        console.error('통계 데이터 로드 실패:', error);
        setMemberStats({});
      }

      // 4. 활동 분석 데이터 로드
      try {
        console.log('🔄 활동 분석 데이터 로드 시작');
        
        const baseUrl3 = await import('../constants').then(m => m.ensureApiBaseUrl()).catch(() => '/api/auth');
        const response = await fetch(`${baseUrl3}/activity-analysis`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (response.ok) {
          const analysisData = await response.json();
          console.log('✅ 활동 분석 데이터 응답 성공:', analysisData);
          
          // 응답 구조 확인: success와 data가 있거나, 직접 data 구조인 경우
          const data = analysisData.success ? analysisData.data : analysisData;
          
          console.log('📊 파싱된 데이터:', {
            hasSummary: !!data?.summary,
            hasMemberStats: !!data?.memberStats,
            memberStatsLength: data?.memberStats?.length || 0,
            summaryData: data?.summary,
            memberStatsSample: data?.memberStats?.[0] || null
          });
          
          if (data && (data.summary || data.memberStats)) {
            setActivityAnalysisData(data);
            console.log('📊 활동 분석 데이터 설정 완료:', {
              summary: data.summary,
              memberStatsCount: data.memberStats?.length || 0,
              monthlyGameStatsCount: data.monthlyGameStats?.length || 0
            });
          } else {
            console.warn('⚠️ 활동 분석 데이터가 올바르지 않음:', data);
            setActivityAnalysisData({ summary: {}, memberStats: [], monthlyGameStats: [], gameTypeDistribution: {} });
          }
        } else {
          const errorText = await response.text();
          console.error('❌ 활동 분석 API 응답 실패:', response.status, errorText);
          setActivityAnalysisData({ summary: {}, memberStats: [], monthlyGameStats: [], gameTypeDistribution: {} });
        }
      } catch (error) {
        console.error('❌ 활동 분석 데이터 로드 실패:', error);
        setActivityAnalysisData({ summary: {}, memberStats: [], monthlyGameStats: [], gameTypeDistribution: {} });
      }
      
      // 4. 통합 투표 데이터 로드
      console.log('🔄 통합 투표 데이터 로드 시작');
      const unifiedData = await loadUnifiedVoteData();
      if (unifiedData) {
        // 통합 API 데이터를 사용하여 경기 데이터 업데이트
        await updateGamesFromVoteData(unifiedData);
      }
      
    } catch (error) {
      console.error('전체 데이터 로드 오류:', error);
      
      toast({
        title: '일부 데이터 로드 실패',
        description: '일부 데이터를 불러오는데 실패했습니다.',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [loadUnifiedVoteData]);

  // 투표 데이터 변경 시(마감/집계 후) 즉시 경기 목록 및 투표 데이터 새로고침
  useEffect(() => {
    const refreshData = async () => {
      try {
        // 경기 데이터 새로고침
        const response = await fetch(`${API_ENDPOINTS.BASE_URL}/members`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (response.ok) {
          const unifiedData = await response.json();
          if (unifiedData && Array.isArray(unifiedData.games)) {
            setGames(unifiedData.games);
          }
        }
        
        // 통합 투표 데이터 새로고침
        await loadUnifiedVoteData();
        console.log('✅ 투표 데이터 변경 후 통합 데이터 새로고침 완료');
      } catch (e) {
        console.warn('데이터 새로고침 실패:', e);
      }
    };
    window.addEventListener('voteDataChanged', refreshData);
    return () => window.removeEventListener('voteDataChanged', refreshData);
  }, [loadUnifiedVoteData]);

  // 경기 관리 메뉴로 진입할 때도 즉시 새로고침
  useEffect(() => {
    if (selectedMenu === 'games') {
      (async () => {
        try {
          const response = await fetch(`${API_ENDPOINTS.BASE_URL}/members`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          if (response.ok) {
            const unifiedData = await response.json();
            if (unifiedData && Array.isArray(unifiedData.games)) {
              setGames(unifiedData.games);
            }
          }
        } catch {}
      })();
    }
  }, [selectedMenu]);

  // 통합 API 데이터를 사용하여 경기 데이터 업데이트
  const updateGamesFromVoteData = useCallback(async (unifiedData: any) => {
    try {
      console.log('🔄 통합 API 데이터로 경기 데이터 업데이트 시작');
      
      const { activeSession, lastWeekResults } = unifiedData;
      
      // 항상 오래된 자동생성 게임들을 정리하고 데이터 동기화 실행
      console.log('🧹 오래된 자동생성 게임 정리 및 데이터 동기화 시작');
      
      // 조건 체크 로그
      console.log('🔍 현재 상태 체크:', {
        activeSession: !!activeSession,
        lastWeekResults: !!lastWeekResults,
        results: !!lastWeekResults?.results,
        isCompleted: lastWeekResults?.isCompleted,
        isActive: lastWeekResults?.isActive
      });
      
      // 자동생성 로직 완전 비활성화 (백엔드에서 처리)
      console.log('⚠️ 자동생성 로직 비활성화됨 - 백엔드에서 자동생성일정 처리');
      return;
      
      /*
      // 자동생성 조건: 마감된 투표 세션이 있을 때만 실행
      if (!lastWeekResults || !lastWeekResults.results) {
        console.log('⏭️ 자동생성 건너뜀 - 조건 미충족:', {
          hasLastWeekResults: !!lastWeekResults,
          hasResults: !!lastWeekResults?.results,
          isActive: lastWeekResults?.isActive,
          isCompleted: lastWeekResults?.isCompleted
        });
        return;
      }
      */
      
      // 활성 투표 세션이 있으면 자동생성하지 않음
      if (activeSession && activeSession.isActive) {
        console.log('⏭️ 자동생성 건너뜀 - 활성 투표 세션 존재:', {
          activeSessionId: activeSession.id,
          isActive: activeSession.isActive
        });
        return;
      }
      
      // 현재 주 이후의 일정만 자동생성하도록 체크
      const currentDate = new Date();
      const currentWeekStart = new Date(currentDate);
      currentWeekStart.setDate(currentDate.getDate() - currentDate.getDay() + 1); // 이번 주 월요일
      
      const voteWeekStart = new Date(lastWeekResults.weekStartDate);
      
      // 투표 세션이 현재 주 이전이어도 자동생성 허용 (마감된 투표 결과 반영)
      console.log('📅 투표 세션 주간 정보:', {
        voteWeekStart: voteWeekStart.toLocaleDateString(),
        currentWeekStart: currentWeekStart.toLocaleDateString(),
        isPastWeek: voteWeekStart < currentWeekStart,
        willGenerate: true
      });
      
      console.log('🚀 자동생성 실행 시작 - 마감된 투표 세션 기준');
      // 마감된 투표 세션의 결과만 사용
        const results = lastWeekResults.results;
      
      // 마감된 투표 세션의 주 시작일 사용
        const weekStartDate = new Date(lastWeekResults.weekStartDate);
      
      console.log('📅 마감된 투표 세션 기준 자동생성:', {
        lastWeekResultsWeekStartDate: lastWeekResults.weekStartDate,
        weekStartDate: weekStartDate.toLocaleDateString(),
        weekStartDateISO: weekStartDate.toISOString(),
        투표결과: Object.keys(results || {}).map(day => `${day}: ${results[day]?.count || 0}표`).join(', ')
      });
      
        const dayMapping = {
          'MON': 0, 'TUE': 1, 'WED': 2, 'THU': 3, 'FRI': 4
        };
        
      // 먼저 백엔드의 모든 자동생성 게임들을 삭제 (특히 지난주 것들)
      try {
        const token = await getValidToken();
        console.log('🧹 백엔드 자동생성 게임들 삭제 시작');
        
        // 모든 게임 조회
        const baseUrl7 = await import('../constants').then(m => m.ensureApiBaseUrl()).catch(() => '/api/auth');
        const allGamesResponse = await fetch(`${baseUrl7}/games`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (allGamesResponse.ok) {
          const allGames = await allGamesResponse.json();
          const autoGeneratedGames = allGames.filter((game: any) => {
            if (!game.autoGenerated) return false;
            
            // 게임 날짜가 현재 주 이전이면 삭제 대상
            const gameDate = new Date(game.date);
            const gameWeekStart = new Date(gameDate);
            gameWeekStart.setDate(gameDate.getDate() - gameDate.getDay() + 1); // 월요일로 설정
            
            return gameWeekStart < currentWeekStart;
          });
          
          console.log('🧹 삭제할 지난주 자동생성 게임들:', autoGeneratedGames.length, '개');
          
          // 자동생성 게임 삭제 로직 비활성화 (백엔드에서 필터링하므로 불필요)
          console.log('⚠️ 자동생성 게임 삭제 로직 비활성화됨 - 백엔드에서 필터링 처리');
          /*
          // 각 지난주 자동생성 게임 삭제
          for (const game of autoGeneratedGames) {
            try {
              const baseUrl8 = await import('../constants').then(m => m.ensureApiBaseUrl()).catch(() => '/api/auth');
              const deleteResponse = await fetch(`${baseUrl8}/games/${game.id}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });
              
              if (deleteResponse.ok) {
                console.log(`✅ 지난주 자동생성 게임 삭제 완료: ID ${game.id}, 날짜 ${game.date}`);
              } else {
                console.error(`❌ 지난주 자동생성 게임 삭제 실패: ID ${game.id}`);
              }
            } catch (error) {
              console.error(`❌ 지난주 자동생성 게임 삭제 오류: ID ${game.id}`, error);
            }
          }
          */
        }
      } catch (error) {
        console.error('❌ 백엔드 자동생성 게임 삭제 중 오류:', error);
      }
      
      // 프론트엔드 게임 데이터를 백엔드에서 새로고침
      let currentGames: any[] = [];
      try {
        const token = await getValidToken();
        console.log('🔄 프론트엔드 게임 데이터 백엔드에서 새로고침');
        
        const baseUrl9 = await import('../constants').then(m => m.ensureApiBaseUrl()).catch(() => '/api/auth');
        const gamesResponse = await fetch(`${baseUrl9}/games`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (gamesResponse.ok) {
          const backendGames = await gamesResponse.json();
          console.log('🔄 백엔드에서 가져온 게임 데이터:', backendGames.length, '개');
          
          // 백엔드 데이터를 현재 게임 목록으로 설정
          currentGames = backendGames;
          console.log('✅ 백엔드 게임 데이터 로드 완료');
        }
      } catch (error) {
        console.error('❌ 프론트엔드 게임 데이터 새로고침 오류:', error);
        // 오류 시 기존 games 상태 사용
        currentGames = games;
      }
      
      // 백엔드에서 가져온 데이터에서 자동 생성된 경기들을 제외
      const filteredGames = currentGames.filter(game => !game.autoGenerated);
      console.log('🧹 자동 생성 경기들 정리:', currentGames.length - filteredGames.length, '개 제거');
      console.log('🧹 정리된 경기 목록:', filteredGames.map(g => ({ id: g.id, date: g.date, autoGenerated: g.autoGenerated })));
      
      const newGames = [...filteredGames];
      
      // 마감된 투표 세션의 결과를 사용해서 자동생성일정 생성
      const hasLastWeekResults = !!unifiedData?.lastWeekResults;
      const hasConfirmedGames = filteredGames.length > 0;
      
      console.log('🔍 자동생성 조건 체크:', {
        hasLastWeekResults,
        hasConfirmedGames,
        shouldGenerateAuto: hasLastWeekResults && !hasConfirmedGames,
        lastWeekResults: unifiedData?.lastWeekResults ? '있음' : '없음'
      });

      // 마감된 투표 세션의 결과가 있고 확정일정이 없을 때만 자동생성
      if (hasLastWeekResults && !hasConfirmedGames) {
        for (const [dayKey, dayResult] of Object.entries(results || {})) {
          const voteCount = (dayResult && typeof (dayResult as any).count === 'number') ? (dayResult as any).count : 0;
          if (voteCount > 0) {
            const dayIndex = dayMapping[dayKey as keyof typeof dayMapping];
            
            if (dayIndex !== undefined) {
              const gameDate = new Date(weekStartDate.getTime() + dayIndex * 24 * 60 * 60 * 1000);
              const month = gameDate.getMonth() + 1;
              const day = gameDate.getDate();
              const dayNames = ['월', '화', '수', '목', '금'];
              const dayName = dayNames[dayIndex];
            
            // 중복 체크: 같은 날짜에 이미 경기가 있는지 확인 (확정일정 우선)
            const targetDateStr = `${gameDate.getFullYear()}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`;
            const existingGameOnDate = newGames.find(game => {
              const gameDateStr = game.date;
              return gameDateStr.includes(targetDateStr);
            });
            
            if (existingGameOnDate) {
              console.log(`⏭️ ${dayKey} 날짜에 이미 경기가 존재하여 자동생성 건너뜀:`, {
                existingGame: existingGameOnDate,
                targetDate: targetDateStr,
                isAutoGenerated: existingGameOnDate.autoGenerated
              });
              continue;
            }
              
                     // 투표한 참여자 목록 가져오기
            const participants = Array.isArray((dayResult as any).participants) ? (dayResult as any).participants : [];
                     const participantNames = participants.map((p: any) => p.userName);
                     
                     // 새로운 경기 데이터 생성
                     const newGame = {
              id: Math.floor(Math.random() * 1000000) + 100000, // 6자리 정수 ID
                       date: `${gameDate.getFullYear()}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}.(${dayName}) 19:00`,
                       time: '19:00',
                       location: '매치업풋살파크 천안아산점',
                       eventType: '매치' as const,
                       mercenaryCount: 0,
                       memberNames: [], // 빈 배열로 설정
                       selectedMembers: participantNames, // 참여자만 selectedMembers에 포함
                       createdById: user?.id || 1,
                       createdAt: new Date().toISOString(),
                       updatedAt: new Date().toISOString(),
                       createdBy: {
                         id: user?.id || 1,
                         name: user?.name || '시스템'
                       },
                       autoGenerated: true // 자동 생성된 데이터임을 표시
                     };
              
              console.log(`✅ ${dayKey} 경기 데이터 생성:`, newGame);
            newGames.push(newGame);
            
            // 자동생성된 게임은 프론트엔드에서만 관리 (일정확정 시에만 백엔드 저장)
            console.log(`📝 ${dayKey} 자동생성 게임 프론트엔드에서 관리:`, newGame.id);
          }
        }
      }
      } else {
        if (unifiedData?.activeSession?.isActive) {
          console.log('⏭️ 투표가 활성화된 상태이므로 자동생성일정 생성 건너뜀');
        } else if (hasConfirmedGames) {
          console.log('⏭️ 확정일정이 이미 존재하므로 자동생성일정 생성 건너뜀');
        }
      }
      
      // 최종적으로 게임 목록 업데이트
      setGames(newGames);
      
      console.log('🎉 오래된 데이터 정리 및 동기화 완료');
    } catch (error) {
      console.error('❌ 경기 데이터 업데이트 실패:', error);
    }
  }, [user]);

  // 스마트 새로고침 조건 체크 함수
  const shouldRefresh = useCallback(() => {
    // 1. 모달이 열려있으면 새로고침 안함
    if (isPlayerFormOpen || isAnnouncementFormOpen) {
      console.log('새로고침 건너뜀 - 모달 열림');
      return false;
    }
    
    // 2. 편집 중이면 새로고침 안함
    if (editingPlayer || editingAnnouncement) {
      console.log('새로고침 건너뜀 - 편집 중');
      return false;
    }
    
    // 3. 회원관리 모달이 열려있는지 확인
    const memberManagementModals = document.querySelectorAll('[role="dialog"]');
    if (memberManagementModals.length > 0) {
      console.log('새로고침 건너뜀 - 회원관리 모달 열림');
      return false;
    }
    
    // 4. 사용자가 입력 중이면 새로고침 안함
    const activeElement = document.activeElement;
    if (activeElement?.tagName === 'INPUT' || 
        activeElement?.tagName === 'TEXTAREA' ||
        activeElement?.tagName === 'SELECT') {
      console.log('새로고침 건너뜀 - 사용자 입력 중');
      return false;
    }
    
    // 5. 모든 조건을 만족하면 새로고침 함
    return true;
  }, [isPlayerFormOpen, isAnnouncementFormOpen, editingPlayer, editingAnnouncement]);

  // 실시간 데이터 업데이트 (자동새로고침 비활성화 + 스크롤 위치 유지)
  useEffect(() => {
    // 스크롤 위치 저장
    const savedScrollPosition = window.scrollY;
    
    // 초기 데이터 로드만 수행
    loadData();
    
    // 투표마감 시 자동생성 일정 생성 이벤트 리스너
    const handleVoteSessionClosed = () => {
      console.log('🔄 투표마감 이벤트 수신 - 자동생성 일정 생성');
      // 통합 데이터를 다시 로드하여 자동생성 실행
      loadData();
    };

    // 투표재개 시 자동생성 일정 제거 이벤트 리스너
    const handleVoteSessionResumed = () => {
      console.log('🔄 투표재개 이벤트 수신 - 자동생성 일정 제거');
      // 통합 데이터를 다시 로드하여 자동생성 일정 제거
      loadData();
    };

    window.addEventListener('voteSessionClosed', handleVoteSessionClosed);
    window.addEventListener('voteSessionResumed', handleVoteSessionResumed);
    
    // 자동새로고침 비활성화 - 사용자가 수동으로 새로고침 버튼을 눌러야 함
    // const interval = setInterval(() => {
    //   if (shouldRefresh()) {
    //     console.log('실시간 데이터 업데이트 중...');
    //     loadData();
    //   } else {
    //     console.log('새로고침 건너뜀 - 사용자 활동 중');
    //   }
    // }, 30000);
    
    // return () => clearInterval(interval);
    
    // 스크롤 위치 복원
    setTimeout(() => {
      window.scrollTo(0, savedScrollPosition);
    }, 100);
    
    return () => {
      window.removeEventListener('voteSessionClosed', handleVoteSessionClosed);
      window.removeEventListener('voteSessionResumed', handleVoteSessionResumed);
    };
  }, [loadData]);

  // 실시간 업데이트 상태 표시
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());
  
  useEffect(() => {
    setLastUpdateTime(new Date());
  }, [userList, games, memberStats]);

  // userList 상태가 변경될 때 localStorage에 저장
  useEffect(() => {
    if (userList.length > 0) {
      try {
        localStorage.setItem('adminUserList', JSON.stringify(userList));
        console.log('회원 목록이 localStorage에 저장됨:', userList.length, '명');
      } catch (error) {
        console.error('회원 목록 localStorage 저장 실패:', error);
      }
    }
  }, [userList]);

  // games 상태가 변경될 때 localStorage에 저장
  // localStorage 캐시 제거 - 항상 서버에서 최신 데이터 사용
  // useEffect(() => {
  //   if (games.length > 0) {
  //     try {
  //       localStorage.setItem('adminGamesList', JSON.stringify(games));
  //       console.log('경기 목록이 localStorage에 저장됨:', games.length, '경기');
  //     } catch (error) {
  //       console.error('경기 목록 localStorage 저장 실패:', error);
  //     }
  //   }
  // }, [games]);

  // 활동 데이터 수집 함수
  // 백엔드에서 활동 분석 데이터를 가져오는 함수
  const fetchActivityAnalysisData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return null;

      const baseUrl10 = await import('../constants').then(m => m.ensureApiBaseUrl()).catch(() => '/api/auth');
      const response = await fetch(`${baseUrl10}/activity-analysis`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        // 응답 구조 확인: success와 data가 있거나, 직접 data 구조인 경우
        const data = result.success ? result.data : result;
        console.log('✅ 활동 분석 데이터 로드 성공:', data);
        return data || { summary: {}, memberStats: [], monthlyGameStats: [], gameTypeDistribution: {} };
      } else {
        const errorText = await response.text();
        console.error('❌ 활동 분석 데이터 로드 실패:', response.status, errorText);
        return { summary: {}, memberStats: [], monthlyGameStats: [], gameTypeDistribution: {} };
      }
    } catch (error) {
      console.error('❌ 활동 분석 데이터 로드 오류:', error);
      return { summary: {}, memberStats: [], monthlyGameStats: [], gameTypeDistribution: {} };
    }
  }, []);

  const collectActivityData = useCallback(() => {
    // 백엔드 API 사용으로 변경 - 이 함수는 더 이상 사용하지 않음
      return {
        votes: [],
        gameParticipations: [],
        galleryActivities: [],
        loginActivities: []
      };
  }, []);

  // 월별 통계 계산 함수
  const calculateMonthlyStats = useCallback((targetMonth: number, targetYear: number) => {
    try {
      const activityData = collectActivityData();
      const monthStart = new Date(targetYear, targetMonth - 1, 1);
      const monthEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59);
      
      const monthlyActivities = {
        votes: activityData.votes.filter((vote: any) => {
          const voteDate = new Date(vote.createdAt);
          return voteDate >= monthStart && voteDate <= monthEnd;
        }),
        
        gameParticipations: activityData.gameParticipations.filter((participation: any) => {
          // 경기 참여는 경기 날짜 기준으로 필터링
          const game = games.find(g => g.participants?.includes(participation));
          if (game) {
            const gameDate = new Date(game.date);
            return gameDate >= monthStart && gameDate <= monthEnd;
          }
          return false;
        }),
        
        galleryActivities: activityData.galleryActivities.filter((activity: any) => {
          const activityDate = new Date(activity.date || activity.createdAt);
          return activityDate >= monthStart && activityDate <= monthEnd;
        })
      };
      
      const uniqueUsers = new Set([
        ...monthlyActivities.votes.map((v: any) => v.userId),
        ...monthlyActivities.gameParticipations,
        ...monthlyActivities.galleryActivities.map((a: any) => a.userId)
      ]);
      
      return {
        month: `${targetYear}년 ${targetMonth}월`,
        totalVotes: monthlyActivities.votes.length,
        totalGameParticipations: monthlyActivities.gameParticipations.length,
        totalGalleryActivities: monthlyActivities.galleryActivities.length,
        uniqueActiveUsers: uniqueUsers.size,
        totalGames: games.filter(game => {
          const gameDate = new Date(game.date);
          return gameDate >= monthStart && gameDate <= monthEnd;
        }).length
      };
    } catch (error) {
      console.error('월별 통계 계산 실패:', error);
      return {
        month: `${targetYear}년 ${targetMonth}월`,
        totalVotes: 0,
        totalGameParticipations: 0,
        totalGalleryActivities: 0,
        uniqueActiveUsers: 0,
        totalGames: 0
      };
    }
  }, [collectActivityData, games]);

  // 참여율 계산 함수
  const calculateParticipationRate = useCallback((userId: string) => {
    try {
      const activityData = collectActivityData();
      
      const userVotes = activityData.votes.filter((v: any) => v.userId === userId).length;
      const userGameParticipations = activityData.gameParticipations.filter((p: any) => p === userId).length;
      const userGalleryActivities = activityData.galleryActivities.filter((a: any) => a.userId === userId).length;
      
      const totalGames = games.length;
      const totalVoteOpportunities = games.length;
      const totalGalleryItems = JSON.parse(localStorage.getItem('galleryItems') || '[]').length;
      
      return {
        voteRate: totalVoteOpportunities > 0 ? (userVotes / totalVoteOpportunities) * 100 : 0,
        gameParticipationRate: totalGames > 0 ? (userGameParticipations / totalGames) * 100 : 0,
        overallActivityRate: (totalVoteOpportunities + totalGames + totalGalleryItems) > 0 
          ? ((userVotes + userGameParticipations + userGalleryActivities) / 
             (totalVoteOpportunities + totalGames + totalGalleryItems)) * 100 
          : 0
      };
    } catch (error) {
      console.error('참여율 계산 실패:', error);
      return {
        voteRate: 0,
        gameParticipationRate: 0,
        overallActivityRate: 0
      };
    }
  }, [collectActivityData, games]);

  // 상위 참여자 분석 함수
  const getTopParticipants = useCallback(() => {
    try {
      const activityData = collectActivityData();
      
      const userStats = userList.map(user => {
        const participation = calculateParticipationRate(user.id);
        const totalActivities = 
          activityData.votes.filter((v: any) => v.userId === user.id).length +
          activityData.gameParticipations.filter((p: any) => p === user.id).length +
          activityData.galleryActivities.filter((a: any) => a.userId === user.id).length;
        
        return {
          userId: user.id,
          name: user.name,
          voteRate: participation.voteRate,
          gameParticipationRate: participation.gameParticipationRate,
          overallActivityRate: participation.overallActivityRate,
          totalActivities
        };
      });
      
      return userStats
        .sort((a, b) => b.overallActivityRate - a.overallActivityRate)
        .slice(0, 5); // 상위 5명
    } catch (error) {
      console.error('상위 참여자 분석 실패:', error);
      return [];
    }
  }, [userList, collectActivityData, calculateParticipationRate]);

  // 권한 체크 함수
  const hasPermission = (permission: string) => {
    const userPermissions = rolePermissions[currentUserRole].permissions;
    return userPermissions.includes('all') || userPermissions.includes(permission);
  };





  // 알림 설정 변경 핸들러
  const handleNotificationChange = (category: string, field: string, value: any) => {
    setNotificationSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category as keyof typeof prev],
        [field]: value
      }
    }));
    setIsNotificationChanged(true);
  };

  // 알림 설정 저장
  const handleSaveNotifications = async () => {
    try {
      localStorage.setItem('notificationSettings', JSON.stringify(notificationSettings));
      
      toast({
        title: '알림 설정이 저장되었습니다',
        description: '알림 설정이 성공적으로 업데이트되었습니다.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      setIsNotificationChanged(false);
    } catch (error) {
      console.error('알림 설정 저장 실패:', error);
      toast({
        title: '알림 설정 저장 실패',
        description: '알림 설정을 저장하는 중 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // 알림 설정 로드
  const loadNotificationSettings = () => {
    try {
      const saved = localStorage.getItem('notificationSettings');
      if (saved) {
        setNotificationSettings(JSON.parse(saved));
      }
    } catch (error) {
      console.error('알림 설정 로드 실패:', error);
    }
  };

  // 알림 발송 엔진
  const sendNotification = async (notification: Omit<Notification, 'id' | 'sentAt' | 'status'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      sentAt: new Date().toISOString(),
      status: 'PENDING'
    };

    setNotifications(prev => [newNotification, ...prev]);
    
    try {
      // 1. 이메일 알림 발송
      if (notification.deliveryMethods.includes('email')) {
        await sendEmailNotification(newNotification);
      }

      // 2. 푸시 알림 발송
      if (notification.deliveryMethods.includes('push')) {
        await sendPushNotification(newNotification);
      }

      // 3. 인앱 알림 발송
      if (notification.deliveryMethods.includes('inapp')) {
        await sendInAppNotification(newNotification);
      }

      // 알림 상태를 성공으로 업데이트
      setNotifications(prev => 
        prev.map(n => n.id === newNotification.id ? { ...n, status: 'SENT' } : n)
      );

      // 활동 로그에 알림 발송 기록
      addActivityLog(0, 'System', 'ANNOUNCEMENT_CREATE', `알림 발송: ${notification.title}`);

    } catch (error) {
      console.error('알림 발송 실패:', error);
      
      // 알림 상태를 실패로 업데이트
      setNotifications(prev => 
        prev.map(n => n.id === newNotification.id ? { ...n, status: 'FAILED' } : n)
      );
    }
  };


  // 이메일 알림 발송
  const sendEmailNotification = async (notification: Notification) => {
    try {
      console.log('📧 이메일 알림 발송 시작:', notification);
      
      // 공통 요청 함수 (재사용)
      const requestOnce = async () => {
        const res = await fetch('/api/auth/send-test-notification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            recipients: notification.recipients,
            title: notification.title,
            message: notification.message,
            html: notification.message,
            useRaw: true
          })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      };

      // 1회 재시도 로직
      let result: any;
      try {
        result = await requestOnce();
      } catch (e) {
        console.warn('📧 1차 발송 실패, 1초 후 재시도합니다...', e);
        await new Promise(r => setTimeout(r, 1000));
        result = await requestOnce();
      }

      console.log('📧 이메일 발송 결과:', result);

        // 발송 성공 로그
        addActivityLog(0, 'System', 'ANNOUNCEMENT_CREATE', 
          `이메일 알림 발송 성공: ${notification.title} (성공: ${result.result.successCount}건, 실패: ${result.result.failCount}건)`);
      // 로컬 발송 이력 저장(최근 20건 유지)
      try {
        const key = 'email_send_history';
        const history = JSON.parse(localStorage.getItem(key) || '[]');
        history.unshift({
          at: new Date().toISOString(),
          title: notification.title,
          recipients: notification.recipients,
          success: result.result?.successCount ?? 0,
          fail: result.result?.failCount ?? 0
        });
        localStorage.setItem(key, JSON.stringify(history.slice(0, 20)));
      } catch {}
        

    } catch (error) {
      console.error('❌ 이메일 발송 오류:', error);
      addActivityLog(0, 'System', 'ANNOUNCEMENT_CREATE', 
        `이메일 알림 발송 오류: ${error.message}`);
      // 실패 이력 저장
      try {
        const key = 'email_send_history';
        const history = JSON.parse(localStorage.getItem(key) || '[]');
        history.unshift({
          at: new Date().toISOString(),
          title: notification.title,
          recipients: notification.recipients,
          error: String(error?.message || error)
        });
        localStorage.setItem(key, JSON.stringify(history.slice(0, 20)));
      } catch {}
        
    }
  };

  // 경기 알림용 HTML 생성 (프리뷰와 동일 템플릿, 미래 경기만)
  const buildGameNotificationHtml = () => {
    const now = new Date();
    const futureGames = (games || []).filter((g: any) => new Date(g.date).getTime() >= now.getTime());
    if (futureGames.length === 0) {
      return `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; border-radius: 15px; color: white;">
          <div style="background: rgba(255, 255, 255, 0.1); padding: 30px; border-radius: 10px; margin-bottom: 30px;">
            <h2 style="margin: 0 0 20px 0; font-size: 24px; text-align: center;">⚽ 경기 알림</h2>
            <p style="margin: 0 0 20px 0; font-size: 18px; line-height: 1.6; text-align: center;">확정된 경기 일정을 회원들에게 알립니다.</p>
            <div style="background: rgba(255, 255, 255, 0.2); padding: 20px; border-radius: 8px; margin-top: 20px; text-align: center;">
              <p style="margin: 0; font-size: 16px;">현재 확정된 경기가 없습니다.</p>
            </div>
          </div>
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="display: inline-block; background: rgba(255, 255, 255, 0.2); padding: 15px 25px; border-radius: 25px;">
              <span style="font-size: 14px; opacity: 0.9;">발송 시간: ${new Date().toLocaleString('ko-KR')}</span>
            </div>
          </div>
          <div style="text-align: center; font-size: 14px; opacity: 0.7;">
            <p style="margin: 0;">이 이메일은 자동으로 발송되었습니다.</p>
            <p style="margin: 5px 0 0 0;">FC CHAL GGYEO 관리 시스템</p>
          </div>
        </div>`;
    }
    const items = futureGames.slice(0, 3).map((game: any) => {
      const names: string[] = game.allParticipantNames || [];
      const merc = game.mercenaryCount || 0;
      const dateStr = new Date(game.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
      return `
        <div style="margin-bottom: 15px; padding: 15px; background: rgba(255, 255, 255, 0.1); border-radius: 8px;">
          <div style="font-size: 14px; margin-bottom: 5px;">🏆 ${game.eventType || '자체'}</div>
          <div style="font-size: 14px; margin-bottom: 5px;">📅 ${dateStr} ${game.time ? `⏰ ${game.time}` : ''}</div>
          <div style="font-size: 14px; margin-bottom: 5px;">📍 ${game.location || '장소 미정'}
            ${game.location ? `<a href="https://map.kakao.com/link/search/${encodeURIComponent(game.location)}" target="_blank" style="display:inline-block;background:#FFD700;color:#0066CC;text-decoration:none;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:700;margin-left:8px;">K</a>` : ''}
          </div>
          <div style="font-size: 14px; margin-bottom: 5px;">👥 참가자: ${game.totalParticipantCount || 0}명</div>
          ${(names.length > 0 || merc > 0) ? `<div style="font-size: 14px; margin-bottom: 5px; opacity: 0.9; display: flex; flex-wrap: wrap; gap: 4px;">${names.map(n => `<span style=\"background:#3182CE;color:#fff;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:500;\">${n}</span>`).join('')}${merc > 0 ? `<span style=\"background:#2D3748;color:#fff;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:500;\">용병 ${merc}명</span>` : ''}</div>` : ''}
        </div>`;
    }).join('');
    return `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; border-radius: 15px; color: white;">
        <div style="background: rgba(255, 255, 255, 0.1); padding: 30px; border-radius: 10px; margin-bottom: 30px;">
          <h2 style="margin: 0 0 20px 0; font-size: 24px; text-align: center;">⚽ 경기 알림</h2>
          <p style="margin: 0 0 20px 0; font-size: 18px; line-height: 1.6; text-align: center;">확정된 경기 일정을 회원들에게 알립니다.</p>
          <div style="background: rgba(255, 255, 255, 0.2); padding: 20px; border-radius: 8px; margin-top: 20px;">
            <h3 style="margin: 0 0 15px 0; font-size: 20px; text-align: center;">다음 경기 일정</h3>
            ${items}
          </div>
        </div>
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="display: inline-block; background: rgba(255, 255, 255, 0.2); padding: 15px 25px; border-radius: 25px;">
            <span style="font-size: 14px; opacity: 0.9;">발송 시간: ${new Date().toLocaleString('ko-KR')}</span>
          </div>
        </div>
        <div style="text-align: center; font-size: 14px; opacity: 0.7;">
          <p style="margin: 0;">이 이메일은 자동으로 발송되었습니다.</p>
          <p style="margin: 5px 0 0 0;">FC CHAL GGYEO 관리 시스템</p>
        </div>
      </div>`;
  };

  // 실제 경기 알림 발송 (프리뷰 HTML 그대로, 실제 수신자 대상으로)
  const sendGameNotification = () => {
    const now = new Date();
    const futureGames = (games || []).filter((g: any) => new Date(g.date).getTime() >= now.getTime());
    if (futureGames.length === 0) {
      toast({ title: '경기 알림 발송 불가', description: '발송할 미래 경기가 없습니다.', status: 'warning', duration: 3000, isClosable: true });
      return;
    }
    // 대상자 결정
    const target = notificationSettings.gameReminder.targets[0] || 'all';
    let recipients: number[] = [];
    if (target === 'all') {
      recipients = (userList || []).map((u: any) => u.id);
    } else if (target === 'participating') {
      const ids = new Set<number>();
      futureGames.forEach((g: any) => (g.attendances || []).forEach((a: any) => a?.userId && ids.add(a.userId)));
      recipients = Array.from(ids);
    } else if (target === 'admin') {
      recipients = (userList || []).filter((u: any) => u.role === 'ADMIN').map((u: any) => u.id);
    }

    const htmlContent = buildGameNotificationHtml();
    sendNotification({
      type: 'GAME_REMINDER',
      title: '⚽ 경기 알림',
      message: htmlContent,
      recipients,
      deliveryMethods: ['email'],
      metadata: { isGameNotification: true }
    });

    toast({ title: '경기 알림 발송 완료', description: `${recipients.length}명에게 경기 알림이 발송되었습니다.`, status: 'success', duration: 3000, isClosable: true });
  };

  // 푸시 알림 발송
  const sendPushNotification = async (notification: Notification) => {
    // 실제 구현에서는 Firebase Cloud Messaging 사용
    console.log('📱 푸시 알림 발송:', notification);
    
  };

  // 인앱 알림 발송
  const sendInAppNotification = async (notification: Notification) => {
    // WebSocket을 통한 실시간 인앱 알림
    console.log('🔔 인앱 알림 발송:', notification);
    
    // 전역 이벤트 발생 (인앱 알림용)
    const event = new CustomEvent('notification-received', {
      detail: { notification }
    });
    window.dispatchEvent(event);
    
  };

  // 선수 관련 함수들
  const handleAddPlayer = () => {
    if (!newPlayer.name) {
      toast({
        title: '선수명을 입력해주세요',
        status: 'warning',
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    const player: Player = {
      id: Date.now().toString(),
      name: newPlayer.name!,
      position: newPlayer.position || 'MF',
      jerseyNumber: newPlayer.jerseyNumber,
      phone: newPlayer.phone,
      email: newPlayer.email,
      joinDate: newPlayer.joinDate || new Date().toISOString().split('T')[0],
      preferredPosition: newPlayer.preferredPosition || [],
      skillRating: newPlayer.skillRating || 70,
      attendanceRate: newPlayer.attendanceRate || 0,
      isActive: newPlayer.isActive !== false,
      notes: newPlayer.notes
    };

    setPlayers(prev => [...prev, player]);
    localStorage.setItem('players', JSON.stringify([...players, player]));
    
    setNewPlayer({
      name: '',
      position: 'MF',
      preferredPosition: [],
      skillRating: 70,
      attendanceRate: 0,
      isActive: true,
      joinDate: new Date().toISOString().split('T')[0]
    });
    setIsPlayerFormOpen(false);

    toast({
      title: '선수가 추가되었습니다',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  const handleEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    setNewPlayer(player);
    setIsPlayerFormOpen(true);
  };

  const handleUpdatePlayer = () => {
    if (!editingPlayer || !newPlayer.name) return;

    const updatedPlayer: Player = {
      ...editingPlayer,
      ...newPlayer,
      name: newPlayer.name!,
    };

    const updatedPlayers = players.map(p => 
      p.id === editingPlayer.id ? updatedPlayer : p
    );
    
    setPlayers(updatedPlayers);
    localStorage.setItem('players', JSON.stringify(updatedPlayers));
    
    setEditingPlayer(null);
    setNewPlayer({
      name: '',
      position: 'MF',
      preferredPosition: [],
      skillRating: 70,
      attendanceRate: 0,
      isActive: true,
      joinDate: new Date().toISOString().split('T')[0]
    });
    setIsPlayerFormOpen(false);

    toast({
      title: '선수 정보가 수정되었습니다',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  const handleDeletePlayer = (playerId: string) => {
    const updatedPlayers = players.filter(p => p.id !== playerId);
    setPlayers(updatedPlayers);
    localStorage.setItem('players', JSON.stringify(updatedPlayers));

    toast({
      title: '선수가 삭제되었습니다',
      status: 'info',
      duration: 2000,
      isClosable: true,
    });
  };

  // 선수 데이터 로드
  const loadPlayers = () => {
    try {
      const saved = localStorage.getItem('players');
      if (saved) {
        setPlayers(JSON.parse(saved));
      }
    } catch (error) {
      console.error('선수 데이터 로드 실패:', error);
    }
  };

  // 공지사항 관련 함수들
  const handleAddAnnouncement = () => {
    if (!newAnnouncement.title || !newAnnouncement.content) {
      toast({
        title: '제목과 내용을 모두 입력해주세요',
        status: 'warning',
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    const announcement: Announcement = {
      id: Date.now().toString(),
      title: newAnnouncement.title!,
      content: newAnnouncement.content!,
      type: newAnnouncement.type || 'normal',
      startDate: newAnnouncement.startDate || new Date().toISOString().split('T')[0],
      endDate: new Announcement.endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isActive: newAnnouncement.isActive !== false,
      author: user?.name || '관리자',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pinned: newAnnouncement.pinned || false
    };

    setAnnouncements(prev => [...prev, announcement]);
    localStorage.setItem('announcements', JSON.stringify([...announcements, announcement]));
    
    setNewAnnouncement({
      title: '',
      content: '',
      type: 'normal',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isActive: true,
      pinned: false
    });
    setIsAnnouncementFormOpen(false);

    toast({
      title: '공지사항이 등록되었습니다',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  const handleEditAnnouncement = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setNewAnnouncement(announcement);
    setIsAnnouncementFormOpen(true);
  };

  const handleUpdateAnnouncement = () => {
    if (!editingAnnouncement || !newAnnouncement.title || !newAnnouncement.content) return;

    const updatedAnnouncement: Announcement = {
      ...editingAnnouncement,
      ...newAnnouncement,
      title: newAnnouncement.title!,
      content: newAnnouncement.content!,
      updatedAt: new Date().toISOString()
    };

    const updatedAnnouncements = announcements.map(a => 
      a.id === editingAnnouncement.id ? updatedAnnouncement : a
    );
    
    setAnnouncements(updatedAnnouncements);
    localStorage.setItem('announcements', JSON.stringify(updatedAnnouncements));
    
    setEditingAnnouncement(null);
    setNewAnnouncement({
      title: '',
      content: '',
      type: 'normal',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isActive: true,
      pinned: false
    });
    setIsAnnouncementFormOpen(false);

    toast({
      title: '공지사항이 수정되었습니다',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  const handleDeleteAnnouncement = (announcementId: string) => {
    const updatedAnnouncements = announcements.filter(a => a.id !== announcementId);
    setAnnouncements(updatedAnnouncements);
    localStorage.setItem('announcements', JSON.stringify(updatedAnnouncements));

    toast({
      title: '공지사항이 삭제되었습니다',
      status: 'info',
      duration: 2000,
      isClosable: true,
    });
  };

  const handleToggleAnnouncementStatus = (announcementId: string) => {
    const updatedAnnouncements = announcements.map(a => 
      a.id === announcementId ? { ...a, isActive: !a.isActive } : a
    );
    setAnnouncements(updatedAnnouncements);
    localStorage.setItem('announcements', JSON.stringify(updatedAnnouncements));
  };

  // 공지사항 데이터 로드
  const loadAnnouncements = () => {
    try {
      const saved = localStorage.getItem('announcements');
      if (saved) {
        setAnnouncements(JSON.parse(saved));
      }
    } catch (error) {
      console.error('공지사항 데이터 로드 실패:', error);
    }
  };

  useEffect(() => {
    loadData();
    loadNotificationSettings();
    loadPlayers();
    loadAnnouncements();
    loadActivityLogs();
    
    // 활동 분석 데이터 로드
    const loadActivityData = async () => {
      const data = await fetchActivityAnalysisData();
      if (data) {
        setActivityAnalysisData(data);
      }
    };
    loadActivityData();
    loadVoteRecords();
    loadSuspensionRequests();
    checkVoteParticipation();
    
    // 알림 시스템 활성화
    setIsNotificationSystemActive(true);
    
  }, [loadData]);

  // 자동 알림 체크 시스템
  const checkAndSendNotifications = useCallback(() => {
    if (!isNotificationSystemActive) return;

    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 0: 일요일, 1: 월요일, ..., 6: 토요일
    const currentMinute = now.getMinutes();
    
    // 정확한 시간 체크 (15분 이내에만 실행)
    if (currentMinute > 15) return;
    
    // 1. 경기 전 알림 체크 (15시에 발송)
    if (notificationSettings.gameReminder.enabled && currentHour === 15) {
      checkGameReminders(now);
    }

    // 2. 투표 마감 알림 체크
    if (notificationSettings.voteReminder.enabled) {
      checkVoteReminders(now, currentDay, currentHour);
    }

    // 3. 신규 회원 알림 체크
    if (notificationSettings.newMemberNotification.enabled) {
      checkNewMemberNotifications(now);
    }

    // 4. 경기 결과 알림 체크
    if (notificationSettings.gameResultNotification.enabled) {
      checkGameResultNotifications(now);
    }
  }, [isNotificationSystemActive, notificationSettings, games, notifications, userList]);

  // 경기 전 알림 체크 함수
  const checkGameReminders = (now: Date) => {
    games.forEach(game => {
      const gameDate = new Date(game.date);
      const gameDay = gameDate.getDate();
      const gameMonth = gameDate.getMonth();
      const gameYear = gameDate.getFullYear();
      
      // 경기 전날 15시 알림
      const dayBeforeGame = new Date(gameYear, gameMonth, gameDay - 1, 15, 0, 0);
      const isDayBefore = now.getDate() === dayBeforeGame.getDate() && 
                         now.getMonth() === dayBeforeGame.getMonth() && 
                         now.getFullYear() === dayBeforeGame.getFullYear() &&
                         now.getHours() === 15;
      
      // 경기 당일 15시 알림
      const dayOfGame = new Date(gameYear, gameMonth, gameDay, 15, 0, 0);
      const isDayOfGame = now.getDate() === dayOfGame.getDate() && 
                         now.getMonth() === dayOfGame.getMonth() && 
                         now.getFullYear() === dayOfGame.getFullYear() &&
                         now.getHours() === 15;
      
      if (isDayBefore || isDayOfGame) {
        // 이미 발송된 알림인지 체크
        const notificationType = isDayBefore ? 'GAME_DAY_BEFORE' : 'GAME_DAY_OF';
        const existingNotification = notifications.find(n => 
          n.type === notificationType && 
          n.metadata?.gameId === game.id &&
          n.metadata?.notificationDate === now.toDateString()
        );
        
        if (!existingNotification) {
          // 경기 참석자 목록 가져오기 (임시로 전체 회원으로 설정)
          const recipients = userList.filter(user => user.status === 'ACTIVE').map(user => user.id);
          const isTomorrow = isDayBefore;
          
          sendNotification({
            type: notificationType,
            title: isTomorrow ? '⚽ 내일 경기 알림' : '⚽ 오늘 경기 알림',
            message: createGameReminderEmail(game, isTomorrow),
            recipients,
            deliveryMethods: ['email'],
            metadata: {
              gameId: game.id,
              gameDate: game.date,
              notificationDate: now.toDateString(),
              isTomorrow
            }
          });
        }
      }
    });
  };

  // 투표 마감 알림 체크 함수
  const checkVoteReminders = (now: Date, currentDay: number, currentHour: number) => {
    // 매주 월요일 10시: 투표 시작 알림
    if (currentDay === 1 && currentHour === 10) {
      const existingNotification = notifications.find(n => 
        n.type === 'VOTE_START' && 
        n.metadata?.weekStart === getWeekStart(now).toDateString()
      );
      
      if (!existingNotification) {
        sendNotification({
          type: 'VOTE_START',
          title: '🗳️ 다음주 일정 투표 시작',
          message: createVoteStartEmail(),
          recipients: userList.map(user => user.id),
          deliveryMethods: ['email'],
          metadata: {
            weekStart: getWeekStart(now).toDateString()
          }
        });
      }
    }
    
    // 매주 화/수요일 10시, 14시, 16시: 투표하지 않은 회원에게 투표 독려
    if ((currentDay === 2 || currentDay === 3) && (currentHour === 10 || currentHour === 14 || currentHour === 16)) {
      const voteDeadline = getVoteDeadline();
      const nonVoters = getNonVoters();
      
      if (nonVoters.length > 0) {
        const existingNotification = notifications.find(n => 
          n.type === 'VOTE_REMINDER' && 
          n.metadata?.reminderTime === `${currentDay}-${currentHour}` &&
          n.metadata?.weekStart === getWeekStart(now).toDateString()
        );
        
        if (!existingNotification) {
          sendNotification({
            type: 'VOTE_REMINDER',
            title: '🗳️ 투표 독려 알림',
            message: createVoteReminderEmail(voteDeadline, nonVoters),
            recipients: nonVoters.map(user => user.id),
            deliveryMethods: ['email'],
            metadata: {
              reminderTime: `${currentDay}-${currentHour}`,
              weekStart: getWeekStart(now).toDateString(),
              nonVoterCount: nonVoters.length
            }
          });
        }
      }
    }
  };

  // 투표하지 않은 회원 목록 가져오기 (unifiedVoteData 기반으로 정확화)
  const getNonVoters = () => {
    if (!unifiedVoteData) {
      return [];
    }

    const allMembers = unifiedVoteData.allMembers || userList;
    
    // 가장 최근 세션에서 투표한 사용자 ID 추출
    let votedUserIds = new Set();
    
    // 활성 세션이 있으면 활성 세션 사용, 없으면 가장 최근 완료된 세션 사용
    const targetSession = unifiedVoteData.activeSession?.isActive 
      ? unifiedVoteData.activeSession 
      : (unifiedVoteData.lastWeekResults || unifiedVoteData.activeSession);
    
    if (targetSession?.participants && Array.isArray(targetSession.participants)) {
      targetSession.participants.forEach((participant: any) => {
        votedUserIds.add(participant.userId);
      });
    } else if (targetSession?.results) {
      Object.values(targetSession.results).forEach((dayResult: any) => {
        if (dayResult.participants && Array.isArray(dayResult.participants)) {
          dayResult.participants.forEach((participant: any) => {
            votedUserIds.add(participant.userId);
          });
        }
      });
    }
    
    // 투표하지 않은 회원들
    return allMembers.filter((member: any) => 
      member.status === 'ACTIVE' && !votedUserIds.has(member.id)
    );
  };

  // 주의 시작일 (월요일) 가져오기
  const getWeekStart = (date: Date) => {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // 월요일이 1, 일요일이 0
    return new Date(date.setDate(diff));
  };

  // 신규 회원 알림 체크 함수
  const checkNewMemberNotifications = (now: Date) => {
    // 구현 예정
  };

  // 경기 결과 알림 체크 함수
  const checkGameResultNotifications = (now: Date) => {
    // 구현 예정
  };

  // 경기 알림 이메일 생성 함수
  const createGameReminderEmail = (game: any, isTomorrow: boolean) => {
    const gameDate = new Date(game.date);
    const formattedDate = gameDate.toLocaleDateString('ko-KR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      weekday: 'long' 
    });
    
    return `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 40px; border-radius: 15px; color: white;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 300;">⚽ FC CHAL GGYEO</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">축구팀 관리 시스템</p>
        </div>
        
        <!-- 축구 경기 이미지 -->
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="display: inline-block; background: rgba(255, 255, 255, 0.2); padding: 20px; border-radius: 15px; border: 3px solid #ffd700;">
            <div style="width: 120px; height: 120px; background: linear-gradient(45deg, #ffd700, #ffed4e); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px;">
              <span style="font-size: 60px;">⚽</span>
            </div>
            <div style="font-size: 18px; font-weight: bold; color: #ffd700;">
              ${isTomorrow ? '내일 경기!' : '오늘 경기!'}
            </div>
          </div>
        </div>
        
        <div style="background: rgba(255, 255, 255, 0.1); padding: 30px; border-radius: 10px; margin-bottom: 30px;">
          <h2 style="margin: 0 0 20px 0; font-size: 24px; text-align: center;">
            ${isTomorrow ? '📅 내일 경기 알림' : '⚽ 오늘 경기 알림'}
          </h2>
          
          <div style="background: rgba(255, 255, 255, 0.2); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 15px 0; font-size: 20px; text-align: center;">경기 정보</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; text-align: center;">
              <div>
                <strong style="color: #ffd700;">날짜</strong><br>
                <span>${formattedDate}</span>
              </div>
              <div>
                <strong style="color: #ffd700;">시간</strong><br>
                <span>${gameDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
            ${game.location ? `
              <div style="text-align: center; margin-top: 15px;">
                <strong style="color: #ffd700;">장소</strong><br>
                <span>${game.location}</span>
              </div>
            ` : ''}
            ${game.opponent ? `
              <div style="text-align: center; margin-top: 15px;">
                <strong style="color: #ffd700;">상대팀</strong><br>
                <span>${game.opponent}</span>
              </div>
            ` : ''}
          </div>
          
          <p style="margin: 0; font-size: 18px; line-height: 1.6; text-align: center;">
            ${isTomorrow ? '내일 경기가 있습니다!' : '오늘 경기가 있습니다!'}<br>
            준비물을 챙기고 시간에 맞춰 참석해주세요.
          </p>
        </div>
        
        <div style="text-align: center; font-size: 14px; opacity: 0.7;">
          <p style="margin: 0;">이 이메일은 자동으로 발송되었습니다.</p>
          <p style="margin: 5px 0 0 0;">FC CHAL GGYEO 관리 시스템</p>
        </div>
      </div>
    `;
  };

  // 투표 시작 이메일 생성 함수
  const createVoteStartEmail = () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const weekStart = getWeekStart(nextWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const formattedWeekStart = weekStart.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
    const formattedWeekEnd = weekEnd.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
    
    return `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; border-radius: 15px; color: white;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 300;">⚽ FC CHAL GGYEO</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">축구팀 관리 시스템</p>
        </div>
        
        <!-- 투표 이미지 -->
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="display: inline-block; background: rgba(255, 255, 255, 0.2); padding: 20px; border-radius: 15px; border: 3px solid #ffd700;">
            <div style="width: 120px; height: 120px; background: linear-gradient(45deg, #667eea, #764ba2); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px;">
              <span style="font-size: 60px;">🗳️</span>
            </div>
            <div style="font-size: 18px; font-weight: bold; color: #ffd700;">
              투표 시작!
            </div>
          </div>
        </div>
        
        <div style="background: rgba(255, 255, 255, 0.1); padding: 30px; border-radius: 10px; margin-bottom: 30px;">
          <h2 style="margin: 0 0 20px 0; font-size: 24px; text-align: center;">🗳️ 다음주 일정 투표 시작</h2>
          
          <div style="background: rgba(255, 255, 255, 0.2); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 15px 0; font-size: 20px; text-align: center;">투표 기간</h3>
            <div style="text-align: center; font-size: 18px;">
              <strong style="color: #ffd700;">${formattedWeekStart} ~ ${formattedWeekEnd}</strong>
            </div>
            <p style="margin: 15px 0 0 0; text-align: center; font-size: 16px; opacity: 0.9;">
              다음주 수요일 17시까지 투표해주세요!
            </p>
          </div>
          
          <p style="margin: 0; font-size: 18px; line-height: 1.6; text-align: center;">
            다음주 일정에 대한 투표가 시작되었습니다.<br>
            가능한 날짜를 선택하여 빠른 시일 내에 투표해주세요.
          </p>
        </div>
        
        <div style="text-align: center; font-size: 14px; opacity: 0.7;">
          <p style="margin: 0;">이 이메일은 자동으로 발송되었습니다.</p>
          <p style="margin: 5px 0 0 0;">FC CHAL GGYEO 관리 시스템</p>
        </div>
      </div>
    `;
  };

    // 투표 독려 이메일 생성 함수
  const createVoteReminderEmail = (voteDeadline: any, nonVoters: any[]) => {
    const now = new Date();
    const deadline = new Date(voteDeadline.deadline);
    
    // 정확한 시간 계산
    const timeLeft = deadline.getTime() - now.getTime();
    const remainingDays = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const remainingHours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const remainingMinutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const remainingSeconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    
    // 음수 값 방지
    const days = Math.max(0, remainingDays);
    const hours = Math.max(0, remainingHours);
    const minutes = Math.max(0, remainingMinutes);
    const seconds = Math.max(0, remainingSeconds);
    
    return `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); padding: 40px; border-radius: 15px; color: white;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 300;">⚽ FC CHAL GGYEO</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">축구팀 관리 시스템</p>
        </div>
        
        <!-- 투표 독려 이미지 -->
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="display: inline-block; background: rgba(255, 255, 255, 0.2); padding: 20px; border-radius: 15px; border: 3px solid #ffd700;">
            <div style="width: 120px; height: 120px; background: linear-gradient(45deg, #ff6b6b, #ee5a24); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px;">
              <span style="font-size: 60px;">🗳️</span>
            </div>
            <div style="font-size: 18px; font-weight: bold; color: #ffd700;">
              투표 독려!
            </div>
          </div>
        </div>
        
        <div style="background: rgba(255, 255, 255, 0.1); padding: 30px; border-radius: 10px; margin-bottom: 30px;">
          <h2 style="margin: 0 0 20px 0; font-size: 24px; text-align: center;">🗳️ 투표 독려 알림</h2>
          
          <div style="background: rgba(255, 255, 255, 0.2); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 15px 0; font-size: 20px; text-align: center;">투표 마감까지 남은 시간</h3>
            
            <!-- 실시간 카운트다운 애니메이션 -->
            <div style="text-align: center; margin-bottom: 20px;">
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; max-width: 400px; margin: 0 auto;">
                <div style="background: linear-gradient(145deg, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.2)); padding: 15px; border-radius: 8px; border: 3px solid #ffd700; box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3); position: relative; overflow: hidden;">
                  <div style="font-size: 32px; font-weight: bold; color: #ffd700; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);" id="countdown-days">${days.toString().padStart(2, '0')}</div>
                  <div style="font-size: 14px; opacity: 0.9; font-weight: bold;">일</div>
                  <!-- 애니메이션 효과 -->
                  <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.3), transparent); animation: shimmer 2s infinite; transform: translateX(-100%);"></div>
                </div>
                <div style="background: linear-gradient(145deg, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.2)); padding: 15px; border-radius: 8px; border: 3px solid #ffd700; box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3); position: relative; overflow: hidden;">
                  <div style="font-size: 32px; font-weight: bold; color: #ffd700; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);" id="countdown-hours">${hours.toString().padStart(2, '0')}</div>
                  <div style="font-size: 14px; opacity: 0.9; font-weight: bold;">시</div>
                  <!-- 애니메이션 효과 -->
                  <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.3), transparent); animation: shimmer 2s infinite 0.5s; transform: translateX(-100%);"></div>
                </div>
                <div style="background: linear-gradient(145deg, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.2)); padding: 15px; border-radius: 8px; border: 3px solid #ffd700; box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3); position: relative; overflow: hidden;">
                  <div style="font-size: 32px; font-weight: bold; color: #ffd700; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);" id="countdown-minutes">${minutes.toString().padStart(2, '0')}</div>
                  <div style="font-size: 14px; opacity: 0.9; font-weight: bold;">분</div>
                  <!-- 애니메이션 효과 -->
                  <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(90deg, transparent, rgba(255, 215, 0, 3), transparent); animation: shimmer 2s infinite 1s; transform: translateX(-100%);"></div>
                </div>
                <div style="background: linear-gradient(145deg, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.2)); padding: 15px; border-radius: 8px; border: 3px solid #ffd700; box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3); position: relative; overflow: hidden;">
                  <div style="font-size: 32px; font-weight: bold; color: #ffd700; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);" id="countdown-seconds">${seconds.toString().padStart(2, '0')}</div>
                  <div style="font-size: 14px; opacity: 0.9; font-weight: bold;">초</div>
                  <!-- 애니메이션 효과 -->
                  <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.3), transparent); animation: shimmer 2s infinite 1.5s; transform: translateX(-100%);"></div>
                </div>
              </div>
            </div>
            
            <!-- 실시간 카운트다운 JavaScript -->
            <script>
              (function() {
                const deadline = new Date('${deadline.toISOString()}');
                
                function updateCountdown() {
                  const now = new Date();
                  const timeLeft = deadline.getTime() - now.getTime();
                  
                  if (timeLeft <= 0) {
                    // 마감 시간이 지났을 때
                    document.getElementById('countdown-days').textContent = '00';
                    document.getElementById('countdown-hours').textContent = '00';
                    document.getElementById('countdown-minutes').textContent = '00';
                    document.getElementById('countdown-seconds').textContent = '00';
                    return;
                  }
                  
                  const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                  const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
                  
                  document.getElementById('countdown-days').textContent = days.toString().padStart(2, '0');
                  document.getElementById('countdown-hours').textContent = hours.toString().padStart(2, '0');
                  document.getElementById('countdown-minutes').textContent = minutes.toString().padStart(2, '0');
                  document.getElementById('countdown-seconds').textContent = seconds.toString().padStart(2, '0');
                }
                
                // 1초마다 업데이트
                updateCountdown();
                setInterval(updateCountdown, 1000);
              })();
            </script>
            
            <!-- CSS 애니메이션 -->
            <style>
              @keyframes shimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
              }
              
              @keyframes pulse {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.02); opacity: 0.8; }
              }
              
              @keyframes bounce {
                0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
                40% { transform: translateY(-5px); }
                60% { transform: translateY(-3px); }
              }
              
              #countdown-days, #countdown-hours, #countdown-minutes, #countdown-seconds {
                animation: pulse 2s infinite;
              }
              
              #countdown-days { animation-delay: 0s; }
              #countdown-hours { animation-delay: 0.5s; }
              #countdown-minutes { animation-delay: 1s; }
              #countdown-seconds { animation-delay: 1.5s; }
            </style>
            
            <p style="margin: 0; text-align: center; font-size: 16px; opacity: 0.9;">
              마감: ${deadline.toLocaleString('ko-KR')}
            </p>
          </div>
          
          <p style="margin: 0; font-size: 18px; line-height: 1.6; text-align: center;">
            아직 투표하지 않으셨습니다!<br>
            빠른 시일 내에 투표해주세요.
          </p>
          
          <div style="text-align: center; margin-top: 20px;">
            <div style="display: inline-block; background: rgba(255, 255, 255, 0.3); padding: 15px 25px; border-radius: 25px;">
              <span style="font-size: 16px; font-weight: bold;">투표하지 않은 회원: ${nonVoters.length}명</span>
            </div>
          </div>
        </div>
        
        <div style="text-align: center; font-size: 14px; opacity: 0.7;">
          <p style="margin: 0;">이 이메일은 자동으로 발송되었습니다.</p>
          <p style="margin: 5px 0 0 0;">FC CHAL GGYEO 관리 시스템</p>
        </div>
      </div>
    `;
  };

  // 자동 알림 체크 (1분마다)
  useEffect(() => {
    if (!isNotificationSystemActive) return;

    const interval = setInterval(() => {
      checkAndSendNotifications();
    }, 60000); // 1분마다 체크

    return () => clearInterval(interval);
  }, [isNotificationSystemActive, checkAndSendNotifications]);

  // 활동 로그 로드
  const loadActivityLogs = () => {
    try {
      const saved = localStorage.getItem('activityLogs');
      if (saved) {
        setActivityLogs(JSON.parse(saved));
      }
    } catch (error) {
      console.error('활동 로그 데이터 로드 실패:', error);
    }
  };

  // 투표 기록 로드
  const loadVoteRecords = () => {
    try {
      const saved = localStorage.getItem('voteRecords');
      if (saved) {
        setVoteRecords(JSON.parse(saved));
      }
    } catch (error) {
      console.error('투표 기록 데이터 로드 실패:', error);
    }
  };

  // 정지 해제 요청 로드
  const loadSuspensionRequests = () => {
    try {
      const saved = localStorage.getItem('suspensionRequests');
      if (saved) {
        setSuspensionRequests(JSON.parse(saved));
      }
    } catch (error) {
      console.error('정지 해제 요청 데이터 로드 실패:', error);
    }
  };

  // 투표 참여도 체크 및 회원 상태 관리
  const checkVoteParticipation = () => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    
    userList.forEach(user => {
      if (user.role === 'MEMBER') {
        const userVotes = voteRecords.filter(v => v.userId === user.id && v.year === currentYear);
        const participatedVotes = userVotes.filter(v => v.participated);
        const totalVotes = userVotes.length;
        const consecutiveMissed = getConsecutiveMissedVotes(user.id, currentYear);
        
        // 연속 3회 또는 총 6회 미참여 시 경고
        if (consecutiveMissed >= 3 || (totalVotes > 0 && participatedVotes.length < totalVotes - 5)) {
          if (!voteWarnings.find(w => w.userId === user.id)) {
            addVoteWarning(user.id, user.name);
          }
        }
        
        // 연속 3회 미참여 시 정지
        if (consecutiveMissed >= 3) {
          suspendMember(user.id, user.name);
        }
      }
    });
  };

  // 알림 수신자 결정
  const getNotificationRecipients = (notificationType: string, game?: any): number[] => {
    const settings = notificationSettings[notificationType as keyof typeof notificationSettings];
    
    if (!settings || !settings.enabled) return [];
    
    switch (settings.targets[0]) {
      case 'all':
        return userList.map(user => user.id);
      case 'participating':
        if (game && (game as any).participants) {
          return (game as any).participants.map((p: any) => p.userId);
        }
        return userList.map(user => user.id);
      case 'admin':
        return userList.filter(user => user.role === 'ADMIN' || user.role === 'SUPER_ADMIN').map(user => user.id);
      default:
        return userList.map(user => user.id);
    }
  };

  // 투표 마감일 계산 (매주 목요일 17시)
  const getVoteDeadline = () => {
    const now = new Date();
    const currentDay = now.getDay(); // 0: 일요일, 1: 월요일, ..., 4: 목요일

    let daysUntilThursday;
    if (currentDay <= 4) { // Sun~Thu
      daysUntilThursday = 4 - currentDay;
    } else { // Fri, Sat → 다음주 목요일
      daysUntilThursday = 11 - currentDay;
    }

    const nextThursday = new Date(now);
    nextThursday.setDate(now.getDate() + daysUntilThursday);
    nextThursday.setHours(17, 0, 0, 0);

    return {
      text: `${nextThursday.getMonth() + 1}월 ${nextThursday.getDate()}일(목) 17시까지`,
      deadline: nextThursday,
      remainingHours: Math.max(0, (nextThursday.getTime() - now.getTime()) / (1000 * 60 * 60))
    };
  };

  // 프리뷰 모달 상태들
  const { isOpen: isGamePreviewOpen, onOpen: onGamePreviewOpen, onClose: onGamePreviewClose } = useDisclosure();
  const { isOpen: isVotePreviewOpen, onOpen: onVotePreviewOpen, onClose: onVotePreviewClose } = useDisclosure();

  // 수동 알림 발송 함수들
  const sendTestNotification = () => {
    sendNotification({
      type: 'GAME_REMINDER',
      title: '🧪 테스트 알림',
      message: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; border-radius: 15px; color: white;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 300;">⚽ FC CHAL GGYEO</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">축구팀 관리 시스템</p>
          </div>
          
          <div style="background: rgba(255, 255, 255, 0.1); padding: 30px; border-radius: 10px; margin-bottom: 30px;">
            <h2 style="margin: 0 0 20px 0; font-size: 24px; text-align: center;">🧪 테스트 알림</h2>
            <p style="margin: 0; font-size: 18px; line-height: 1.6; text-align: center;">
              이것은 테스트 알림입니다.<br>
              알림 시스템이 정상적으로 작동하고 있습니다.
            </p>
          </div>
          
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="display: inline-block; background: rgba(255, 255, 255, 0.2); padding: 15px 25px; border-radius: 25px;">
              <span style="font-size: 14px; opacity: 0.9;">발송 시간: ${new Date().toLocaleString('ko-KR')}</span>
            </div>
          </div>
          
          <div style="text-align: center; font-size: 14px; opacity: 0.7;">
            <p style="margin: 0;">이 이메일은 자동으로 발송되었습니다.</p>
            <p style="margin: 5px 0 0 0;">FC CHAL GGYEO 관리 시스템</p>
          </div>
        </div>
      `,
      recipients: userList.map(user => user.id),
      deliveryMethods: ['email', 'push', 'inapp'],
      metadata: { isTest: true }
    });

    toast({
      title: '테스트 알림 발송',
      description: '테스트 알림이 발송되었습니다.',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  // 경기 알림 프리뷰 보기
  const showGamePreview = () => {
    onGamePreviewOpen();
  };

  // 투표 알림 프리뷰 보기
  const showVotePreview = () => {
    onVotePreviewOpen();
  };

  const sendVoteReminder = () => {
    const voteDeadline = getVoteDeadline();
    
    // 투표하지 않은 회원 목록 가져오기 (getNonVoters 함수 사용)
    const nonVoters = getNonVoters();
    
    // 투표 독려 이메일 생성 (카운트다운 포함)
    const emailMessage = createVoteReminderEmail(voteDeadline, nonVoters);
    
    sendNotification({
      type: 'VOTE_REMINDER',
      title: '🗳️ 투표 독려 알림',
      message: emailMessage,
      recipients: nonVoters.map(user => user.id), // 투표하지 않은 회원에게만 발송
      deliveryMethods: ['email'],
      metadata: { 
        deadline: voteDeadline.deadline.toISOString(),
        isManual: true,
        nonVoterCount: nonVoters.length
      }
    });

    toast({
      title: '투표 독려 알림 발송',
      description: `투표하지 않은 ${nonVoters.length}명의 회원에게 투표 독려 알림이 발송되었습니다.`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  // 연속 미참여 투표 수 계산
  const getConsecutiveMissedVotes = (userId: number, year: number): number => {
    const userVotes = voteRecords.filter(v => v.userId === userId && v.year === year);
    let consecutiveMissed = 0;
    
    for (let i = userVotes.length - 1; i >= 0; i--) {
      if (!userVotes[i].participated) {
        consecutiveMissed++;
      } else {
        break;
      }
    }
    
    return consecutiveMissed;
  };

  // 투표 경고 추가
  const addVoteWarning = (userId: number, userName: string) => {
    const newWarning = {
      userId,
      userName,
      warningCount: 1,
      lastWarningDate: new Date().toISOString()
    };
    
    setVoteWarnings(prev => [...prev, newWarning]);
    localStorage.setItem('voteWarnings', JSON.stringify([...voteWarnings, newWarning]));
    
    // 활동 로그에 경고 기록
    addActivityLog(userId, userName, 'VOTE_WARNING', `${userName}님에게 투표 참여 경고가 발송되었습니다.`);
    
    // 토스트 알림
    toast({
      title: '투표 참여 경고',
      description: `${userName}님에게 투표 참여 경고가 발송되었습니다.`,
      status: 'warning',
      duration: 5000,
      isClosable: true,
    });
  };

  // 풋살 경기 현황판 관련 함수들
  const handleAddFieldPlayer = (team: 'A' | 'B') => {
    const newPlayer = team === 'A' ? newPlayerA : newPlayerB;
    
    if (!newPlayer.name.trim()) {
      toast({
        title: '선수명을 입력해주세요',
        status: 'error',
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    // 등번호 중복 확인
    const currentPlayers = team === 'A' ? teamA.players : teamB.players;
    if (currentPlayers.some(player => player.number === newPlayer.number)) {
      toast({
        title: '이미 사용 중인 등번호입니다',
        status: 'error',
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    if (team === 'A') {
      setTeamA(prev => ({
        ...prev,
        players: [...prev.players, newPlayer]
      }));
      setNewPlayerA({ name: '', number: 1, position: 'MF' });
    } else {
      setTeamB(prev => ({
        ...prev,
        players: [...prev.players, newPlayer]
      }));
      setNewPlayerB({ name: '', number: 1, position: 'MF' });
    }

    toast({
      title: '선수가 추가되었습니다',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  const handleRemovePlayer = (team: 'A' | 'B', playerIndex: number) => {
    if (team === 'A') {
      setTeamA(prev => ({
        ...prev,
        players: prev.players.filter((_, index) => index !== playerIndex)
      }));
    } else {
      setTeamB(prev => ({
        ...prev,
        players: prev.players.filter((_, index) => index !== playerIndex)
      }));
    }

    toast({
      title: '선수가 삭제되었습니다',
      status: 'info',
      duration: 2000,
      isClosable: true,
    });
  };

  const handleScore = (team: 'A' | 'B') => {
    if (team === 'A') {
      setTeamA(prev => ({ ...prev, score: prev.score + 1 }));
    } else {
      setTeamB(prev => ({ ...prev, score: prev.score + 1 }));
    }

    toast({
      title: `${team}팀 득점!`,
      description: `현재 스코어: ${teamA.score}${team === 'A' ? ' + 1' : ''} - ${teamB.score}${team === 'B' ? ' + 1' : ''}`,
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  const handleResetGame = () => {
    setTeamA(prev => ({ ...prev, score: 0 }));
    setTeamB(prev => ({ ...prev, score: 0 }));

    toast({
      title: '경기가 리셋되었습니다',
      description: '스코어가 0-0으로 초기화되었습니다',
      status: 'info',
      duration: 2000,
      isClosable: true,
    });
  };

  // 회원 정지
  const suspendMember = (userId: number, userName: string) => {
    const updatedUserList = userList.map(user => 
      user.id === userId ? { ...user, status: 'SUSPENDED' as const } : user
    );
    
    setUserList(updatedUserList);
    localStorage.setItem('userList', JSON.stringify(updatedUserList));
    
    // 활동 로그에 정지 기록
    addActivityLog(userId, userName, 'MEMBER_SUSPENDED', `${userName}님이 투표 참여 부족으로 정지되었습니다.`);
    
    // 토스트 알림
    toast({
      title: '회원 정지',
      description: `${userName}님이 투표 참여 부족으로 정지되었습니다.`,
      status: 'error',
      duration: 5000,
      isClosable: true,
    });
  };

  // 활동 로그 추가
  const addActivityLog = (userId: number, userName: string, action: ActivityLog['action'], description: string, metadata?: any) => {
    const newLog: ActivityLog = {
      id: Date.now().toString(),
      userId,
      userName,
      action,
      description,
      timestamp: new Date().toISOString(),
      metadata
    };
    
    setActivityLogs(prev => [newLog, ...prev.slice(0, 99)]); // 최근 100개만 유지
    localStorage.setItem('activityLogs', JSON.stringify([newLog, ...activityLogs.slice(0, 99)]));
  };

  // 투표 기록 추가
  const addVoteRecord = (userId: number, userName: string, voteDate: string, participated: boolean) => {
    const year = new Date(voteDate).getFullYear();
    const newRecord: VoteRecord = {
      userId,
      userName,
      voteDate,
      participated,
      year
    };
    
    // 기존 기록이 있으면 업데이트, 없으면 추가
    setVoteRecords(prev => {
      const filtered = prev.filter(r => !(r.userId === userId && r.voteDate === voteDate));
      return [newRecord, ...filtered];
    });
    
    // localStorage 업데이트
    const updatedRecords = voteRecords.filter(r => !(r.userId === userId && r.voteDate === voteDate));
    localStorage.setItem('voteRecords', JSON.stringify([newRecord, ...updatedRecords]));
    
    // 활동 로그 추가
    const action = participated ? 'VOTE_PARTICIPATE' : 'VOTE_ABSENT';
    const description = participated ? 
      `${userName}님이 ${voteDate} 투표에 참여했습니다.` : 
      `${userName}님이 ${voteDate} 투표에 불참했습니다.`;
    
    addActivityLog(userId, userName, action, description, { voteDate, participated });
  };

  // 투표 기록 가져오기 (외부에서 호출 가능)
  const getVoteRecords = () => voteRecords;
  
  // 투표 경고 가져오기 (외부에서 호출 가능)
  const getVoteWarnings = () => voteWarnings;

  // 정지 해제 요청 상태
  const [suspensionRequests, setSuspensionRequests] = useState<{
    id: string;
    userId: number;
    userName: string;
    requestDate: string;
    reason: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
  }[]>([]);

  // 정지 해제 요청 추가
  const addSuspensionRequest = (userId: number, userName: string, reason: string) => {
    const newRequest = {
      id: Date.now().toString(),
      userId,
      userName,
      requestDate: new Date().toISOString(),
      reason,
      status: 'PENDING' as const
    };
    
    setSuspensionRequests(prev => [...prev, newRequest]);
    localStorage.setItem('suspensionRequests', JSON.stringify([...suspensionRequests, newRequest]));
    
    // 활동 로그에 요청 기록
    addActivityLog(userId, userName, 'MEMBER_STATUS_CHANGE', `${userName}님이 정지 해제를 요청했습니다.`);
    
    toast({
      title: '정지 해제 요청',
      description: `${userName}님이 정지 해제를 요청했습니다.`,
      status: 'info',
      duration: 5000,
      isClosable: true,
    });
  };

  // 정지 해제 요청 승인
  const approveSuspensionRequest = (requestId: string) => {
    const request = suspensionRequests.find(r => r.id === requestId);
    if (!request) return;

    // 회원 상태를 ACTIVE로 변경
    const updatedUserList = userList.map(user => 
      user.id === request.userId ? { ...user, status: 'ACTIVE' as const } : user
    );
    
    setUserList(updatedUserList);
    localStorage.setItem('userList', JSON.stringify(updatedUserList));
    
    // 요청 상태를 승인으로 변경
    const updatedRequests = suspensionRequests.map(r => 
      r.id === requestId ? { ...r, status: 'APPROVED' as const } : r
    );
    setSuspensionRequests(updatedRequests);
    localStorage.setItem('suspensionRequests', JSON.stringify(updatedRequests));
    
    // 활동 로그에 승인 기록
    addActivityLog(request.userId, request.userName, 'MEMBER_STATUS_CHANGE', `${request.userName}님의 정지가 해제되었습니다.`);
    
    toast({
      title: '정지 해제 승인',
      description: `${request.userName}님의 정지가 해제되었습니다.`,
      status: 'success',
      duration: 5000,
      isClosable: true,
    });
  };

  // 정지 해제 요청 거절
  const rejectSuspensionRequest = (requestId: string) => {
    const request = suspensionRequests.find(r => r.id === requestId);
    if (!request) return;

    // 요청 상태를 거절로 변경
    const updatedRequests = suspensionRequests.map(r => 
      r.id === requestId ? { ...r, status: 'REJECTED' as const } : r
    );
    setSuspensionRequests(updatedRequests);
    localStorage.setItem('suspensionRequests', JSON.stringify(updatedRequests));
    
    // 활동 로그에 거절 기록
    addActivityLog(request.userId, request.userName, 'MEMBER_STATUS_CHANGE', `${request.userName}님의 정지 해제 요청이 거절되었습니다.`);
    
    toast({
      title: '정지 해제 거절',
      description: `${request.userName}님의 정지 해제 요청이 거절되었습니다.`,
      status: 'error',
      duration: 5000,
      isClosable: true,
    });
  };

  // 전역 함수 등록 (SchedulePageV2에서 사용)
    useEffect(() => {
    (window as any).addVoteRecord = addVoteRecord;
    (window as any).getVoteRecords = getVoteRecords;
    (window as any).getVoteWarnings = getVoteWarnings;
    (window as any).addSuspensionRequest = addSuspensionRequest;
    (window as any).sendNotification = sendNotification;

    return () => {
      delete (window as any).addVoteRecord;
      delete (window as any).getVoteRecords;
      delete (window as any).getVoteWarnings;
      delete (window as any).addSuspensionRequest;
      delete (window as any).sendNotification;
    };
  }, []);

  // 불필요한 코드 제거

  const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);
  const [selectedVoteSession, setSelectedVoteSession] = useState<any>(null);
  const [isAdminGuideModalOpen, setIsAdminGuideModalOpen] = useState(false);

  const renderStatRows = useCallback((rows: Array<{ label: React.ReactNode; value: React.ReactNode; valueColor?: string }>) => (
    <VStack spacing={-3} align="stretch">
      {rows.map((row, idx) => (
        <Box key={idx} px={4} mb={idx < rows.length - 1 ? -1.5 : 0} minH="24px">
          <Flex align="center" gap={2}>
            <Text flex="1" color="gray.600" fontSize="sm" lineHeight={1} noOfLines={1}>
              {row.label}
            </Text>
            <Text
              w="48px"
              textAlign="right"
              fontSize="sm"
              fontWeight="bold"
              lineHeight={1}
              color={row.valueColor || 'gray.800'}
              whiteSpace="nowrap"
            >
              {row.value}
            </Text>
          </Flex>
        </Box>
      ))}
    </VStack>
  ), []);

  return (
    <Box minH="100vh" bg="gray.50" pt={20}>
      <Flex minH="calc(100vh - 80px)">
        {/* 사이드바 */}
        <Box
          w="280px"
          bg="white"
          borderRight="1px"
          borderColor="gray.200"
          position="fixed"
          top={20}
          left={0}
          h="calc(100vh - 80px)"
          overflowY="auto"
          zIndex={10}
        >
          <VStack spacing={0} align="stretch">
            {/* 로고/헤더 */}
            <Box p={6} borderBottom="1px" borderColor="gray.200">
              <Text fontSize="3xl" fontWeight="black" color="#004ea8">
                관리자 페이지
              </Text>
            </Box>

            {/* 메뉴 */}
            <VStack spacing={0} p={4} flex={1}>
              <Button
                w="100%"
                justifyContent="flex-start"
                variant="ghost"
                bg={selectedMenu === 'dashboard' ? 'white' : 'transparent'}
                color={selectedMenu === 'dashboard' ? '#004ea8' : 'gray.700'}
                border={selectedMenu === 'dashboard' ? '1px solid' : '1px solid'}
                borderColor={selectedMenu === 'dashboard' ? '#004ea8' : 'transparent'}
                borderRadius="md"
                transition="all 0.15s ease"
                _hover={{
                  bg: selectedMenu === 'dashboard' ? 'white' : 'gray.50',
                  borderColor: selectedMenu === 'dashboard' ? '#004ea8' : 'gray.300'
                }}
                onClick={() => handleMenuSelect('dashboard')}
              >
                📊 대시보드
              </Button>
              
              <Button
                w="100%"
                justifyContent="flex-start"
                variant="ghost"
                bg={selectedMenu === 'users' ? 'white' : 'transparent'}
                color={selectedMenu === 'users' ? '#004ea8' : 'gray.700'}
                border={selectedMenu === 'users' ? '1px solid' : '1px solid'}
                borderColor={selectedMenu === 'users' ? '#004ea8' : 'transparent'}
                borderRadius="md"
                mt={1}
                transition="all 0.15s ease"
                _hover={{
                  bg: selectedMenu === 'users' ? 'white' : 'gray.50',
                  borderColor: selectedMenu === 'users' ? '#004ea8' : 'gray.300'
                }}
                onClick={() => handleMenuSelect('users')}
              >
                👥 회원 관리
              </Button>

              <Button
                w="100%"
                justifyContent="flex-start"
                variant="ghost"
                bg={selectedMenu === 'vote-results' ? 'white' : 'transparent'}
                color={selectedMenu === 'vote-results' ? '#004ea8' : 'gray.700'}
                border={selectedMenu === 'vote-results' ? '1px solid' : '1px solid'}
                borderColor={selectedMenu === 'vote-results' ? '#004ea8' : 'transparent'}
                borderRadius="md"
                mt={1}
                transition="all 0.15s ease"
                _hover={{
                  bg: selectedMenu === 'vote-results' ? 'white' : 'gray.50',
                  borderColor: selectedMenu === 'vote-results' ? '#004ea8' : 'gray.300'
                }}
                onClick={() => handleMenuSelect('vote-results')}
              >
                🗳️ 투표 결과
              </Button>

              <Button
                w="100%"
                justifyContent="flex-start"
                variant="ghost"
                bg={selectedMenu === 'vote-sessions' ? 'white' : 'transparent'}
                color={selectedMenu === 'vote-sessions' ? '#004ea8' : 'gray.700'}
                border={selectedMenu === 'vote-sessions' ? '1px solid' : '1px solid'}
                borderColor={selectedMenu === 'vote-sessions' ? '#004ea8' : 'transparent'}
                borderRadius="md"
                mt={1}
                transition="all 0.15s ease"
                _hover={{
                  bg: selectedMenu === 'vote-sessions' ? 'white' : 'gray.50',
                  borderColor: selectedMenu === 'vote-sessions' ? '#004ea8' : 'gray.300'
                }}
                onClick={() => handleMenuSelect('vote-sessions')}
              >
                📅 투표 세션 관리
              </Button>
              
              <Button
                w="100%"
                justifyContent="flex-start"
                variant="ghost"
                bg={selectedMenu === 'games' ? 'white' : 'transparent'}
                color={selectedMenu === 'games' ? '#004ea8' : 'gray.700'}
                border={selectedMenu === 'games' ? '1px solid' : '1px solid'}
                borderColor={selectedMenu === 'games' ? '#004ea8' : 'transparent'}
                borderRadius="md"
                mt={1}
                transition="all 0.15s ease"
                _hover={{
                  bg: selectedMenu === 'games' ? 'white' : 'gray.50',
                  borderColor: selectedMenu === 'games' ? '#004ea8' : 'gray.300'
                }}
                onClick={() => handleMenuSelect('games')}
              >
                ⚽ 경기 관리
              </Button>
              



              
              <Button
                w="100%"
                justifyContent="flex-start"
                variant="ghost"
                bg={selectedMenu === 'notifications' ? 'white' : 'transparent'}
                color={selectedMenu === 'notifications' ? '#004ea8' : 'gray.700'}
                border={selectedMenu === 'notifications' ? '1px solid' : '1px solid'}
                borderColor={selectedMenu === 'notifications' ? '#004ea8' : 'transparent'}
                borderRadius="md"
                mt={1}
                transition="all 0.15s ease"
                _hover={{
                  bg: selectedMenu === 'notifications' ? 'white' : 'gray.50',
                  borderColor: selectedMenu === 'notifications' ? '#004ea8' : 'gray.300'
                }}
                onClick={() => handleMenuSelect('notifications')}
              >
                🔔 알림 관리
              </Button>



                                      {hasPermission('all') && (
                                      <Button
                          w="100%"
                          justifyContent="flex-start"
                          variant="ghost"
                          bg={selectedMenu === 'analytics' ? 'white' : 'transparent'}
                          color={selectedMenu === 'analytics' ? '#004ea8' : 'gray.700'}
                          border={selectedMenu === 'analytics' ? '1px solid' : '1px solid'}
                          borderColor={selectedMenu === 'analytics' ? '#004ea8' : 'transparent'}
                          borderRadius="md"
                          mt={1}
                          transition="all 0.15s ease"
                          _hover={{
                            bg: selectedMenu === 'analytics' ? 'white' : 'gray.50',
                            borderColor: selectedMenu === 'analytics' ? '#004ea8' : 'gray.300'
                          }}
                          onClick={() => handleMenuSelect('analytics')}
                        >
                          📈 활동 분석
                        </Button>
                      )}

                        <Button
                          w="100%"
                          justifyContent="flex-start"
                          variant="ghost"
                          bg={selectedMenu === 'football' ? 'white' : 'transparent'}
                          color={selectedMenu === 'football' ? '#004ea8' : 'gray.700'}
                          border={selectedMenu === 'football' ? '1px solid' : '1px solid'}
                          borderColor={selectedMenu === 'football' ? '#004ea8' : 'transparent'}
                          borderRadius="md"
                          mt={1}
                          transition="all 0.15s ease"
                          _hover={{
                            bg: selectedMenu === 'football' ? 'white' : 'gray.50',
                            borderColor: selectedMenu === 'football' ? '#004ea8' : 'gray.300'
                          }}
                          onClick={() => handleMenuSelect('football')}
                        >
                          🏟️ 풋살 현황판
                        </Button>

            </VStack>

            {/* 관리자 설명서 배너 */}
            <Box px={3} py={2} borderTop="1px" borderColor="gray.200" _dark={{ borderColor: "gray.600" }}>
              <Box
                bgGradient="linear(to-r, blue.50, purple.50)"
                px={2}
                py={1.5}
                rounded="md"
                border="1px"
                borderColor="blue.200"
                _dark={{ bgGradient: "linear(to-r, blue.900, purple.900)", borderColor: "blue.700" }}
                cursor="pointer"
                onClick={adminManual.onOpen}
                _hover={{ transform: "translateY(-1px)", shadow: "sm" }}
                transition="all 0.2s"
              >
                <HStack spacing={1.5} align="center">
                  <Text fontSize="sm">📚</Text>
                  <VStack align="start" spacing={0} flex={1}>
                    <Text fontSize="xs" fontWeight="semibold" color="blue.600" _dark={{ color: "blue.300" }} lineHeight="1.2">
                      관리자 가이드
                    </Text>
                    <Text fontSize="10px" color="blue.500" _dark={{ color: "blue.400" }} lineHeight="1.1" mt="1px">
                      {getMenuDescription(selectedMenu)}
                    </Text>
                  </VStack>
                  <Text fontSize="10px" color="blue.500" _dark={{ color: "blue.400" }}>
                    →
                  </Text>
                </HStack>
              </Box>
            </Box>
          </VStack>
        </Box>

        {/* 메인 콘텐츠 */}
        <Box 
          flex={1} 
          ml="280px"
          p={8} 
          pt={8}
          w="calc(100vw - 280px)"
          minW="calc(100vw - 280px)"
          maxW="calc(100vw - 280px)"
        >
          {loading ? (
            <VStack spacing={2} align="stretch" w="100%" p={4}>
              {/* 대시보드 스켈레톤 */}
              <Box>
                <Skeleton height="40px" mb={4} />
                <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={2}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i}>
                      <CardBody>
                        <Skeleton height="20px" mb={2} />
                        <Skeleton height="32px" mb={2} />
                        <Skeleton height="16px" width="60%" />
                      </CardBody>
                    </Card>
                  ))}
                </SimpleGrid>
              </Box>
              
              {/* 메뉴별 스켈레톤 */}
              {selectedMenu === 'members' && <MemberListSkeleton />}
              {selectedMenu === 'games' && (
                <VStack spacing={2} align="stretch">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <GameCardSkeleton key={i} />
                  ))}
                </VStack>
              )}
              {selectedMenu === 'schedule' && (
                <VStack spacing={2} align="stretch">
                  <Skeleton height="40px" />
                  <Skeleton height="200px" />
                </VStack>
              )}
            </VStack>
          ) : (
            <>
              {/* 대시보드 */}
              {selectedMenu === 'dashboard' && (
                <VStack spacing={8} align="stretch" w="100%">
                  {/* 실시간 업데이트 상태 */}
                  <Flex justify="space-between" align="center">
                    <HStack spacing={3}>
                      <Text fontSize="2xl">📊</Text>
                      <Text fontSize="2xl" fontWeight="bold" color="#004ea8">실시간 통계 대시보드</Text>
                    </HStack>
                    <HStack spacing={2}>
                      <Box 
                        w={2} 
                        h={2} 
                        bg={shouldRefresh() ? "green.500" : "yellow.500"} 
                        borderRadius="full" 
                      />
                      <Text fontSize="sm" color="gray.600">
                        {shouldRefresh() ? "실시간 업데이트 중" : "사용자 활동 중"}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        마지막 업데이트: {lastUpdateTime.toLocaleTimeString('ko-KR')}
                      </Text>
                    </HStack>
                  </Flex>
                  {/* 핵심 통계 카드 */}
                  <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={2} w="100%">
                    <Card bg="blue.50" border="1px solid" borderColor="blue.200" shadow="sm">
                      <CardBody pt={1.5} pb={2} px={6}>
                        <Stat p={0} m={0}>
                          <HStack justify="space-between" align="center" mt={0} mb={0}>
                            <StatLabel color="blue.800" fontSize="lg" fontWeight="bold" m={0} lineHeight={1.2}>
                              👥 전체 회원
                            </StatLabel>
                            <StatNumber color="#495057" fontWeight="bold" fontSize="2xl" m={0} lineHeight={1.2}>{userList.length || 0}</StatNumber>
                          </HStack>
                          <StatHelpText color="blue.800" fontSize="sm" fontWeight="normal" mt={1} mb={0}>
                            <StatArrow type="increase" />
                            {userList.filter(u => u.status === 'ACTIVE').length}명 활성
                          </StatHelpText>
                        </Stat>
                      </CardBody>
                    </Card>
                    
                    <Card bg="blue.50" border="1px solid" borderColor="blue.200" shadow="sm">
                      <CardBody pt={1.5} pb={2} px={6}>
                        <Stat p={0} m={0}>
                          <HStack justify="space-between" align="center" mt={0} mb={0}>
                            <StatLabel color="green.800" fontSize="lg" fontWeight="bold" m={0} lineHeight={1.2}>
                              ⚽ 총 경기수
                            </StatLabel>
                            <StatNumber color="#495057" fontWeight="bold" fontSize="2xl" m={0} lineHeight={1.2}>{games.length || 0}</StatNumber>
                          </HStack>
                          <StatHelpText color="green.800" fontSize="sm" fontWeight="normal" mt={1} mb={0}>
                            <StatArrow type="increase" />
                            이번 달 {games.filter(g => {
                              const gameDate = new Date(g.date);
                              const now = new Date();
                              return gameDate.getMonth() === now.getMonth() && gameDate.getFullYear() === now.getFullYear();
                            }).length}경기
                          </StatHelpText>
                        </Stat>
                      </CardBody>
                    </Card>
                    
                    <Card bg="blue.50" border="1px solid" borderColor="blue.200" shadow="sm">
                      <CardBody pt={1.5} pb={2} px={6}>
                        <Stat p={0} m={0}>
                          <HStack justify="space-between" align="center" mt={0} mb={0}>
                            <StatLabel color="purple.800" fontSize="lg" fontWeight="bold" m={0} lineHeight={1.2}>
                              🆕 신규 가입
                            </StatLabel>
                            <StatNumber color="#495057" fontWeight="bold" fontSize="2xl" m={0} lineHeight={1.2}>{userList.filter(u => {
                              if (!u.createdAt) return false;
                              const created = new Date(u.createdAt);
                              const weekAgo = new Date();
                              weekAgo.setDate(weekAgo.getDate() - 7);
                              return created >= weekAgo;
                            }).length}</StatNumber>
                          </HStack>
                          <StatHelpText color="purple.800" fontSize="sm" fontWeight="normal" mt={1} mb={0}>
                            <StatArrow type="increase" />
                            최근 7일
                          </StatHelpText>
                        </Stat>
                      </CardBody>
                    </Card>
                    
                    <Card bg="blue.50" border="1px solid" borderColor="blue.200" shadow="sm">
                      <CardBody pt={1.5} pb={2} px={6}>
                        <Stat p={0} m={0}>
                          <HStack justify="space-between" align="center" mt={0} mb={0}>
                            <StatLabel color="orange.800" fontSize="lg" fontWeight="bold" m={0} lineHeight={1.2}>
                              👑 관리자
                            </StatLabel>
                            <StatNumber color="#495057" fontWeight="bold" fontSize="2xl" m={0} lineHeight={1.2}>{userList.filter(u => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN').length}</StatNumber>
                          </HStack>
                          <StatHelpText color="orange.800" fontSize="sm" fontWeight="normal" mt={1} mb={0}>
                            <StatArrow type="increase" />
                            슈퍼관리자 {userList.filter(u => u.role === 'SUPER_ADMIN').length}명
                          </StatHelpText>
                        </Stat>
                      </CardBody>
                    </Card>
                  </SimpleGrid>

                  {/* 상세 통계 카드 */}
                  <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={2} w="100%">
                    <Card>
                      <CardBody pt={1.5} pb={2} px={6}>
                        <VStack align="stretch" spacing={-2}>
                          <Text fontSize="lg" fontWeight="bold" color="#004ea8">📊 회원 현황</Text>
                          {renderStatRows([
                            { label: '활성 회원', value: `${userList.filter(u => u.status === 'ACTIVE').length}명` },
                            { label: '비활성 회원', value: `${userList.filter(u => u.status === 'INACTIVE').length}명` },
                            { label: '정지된 회원', value: `${userList.filter(u => u.status === 'SUSPENDED').length}명` }
                          ])}
                         </VStack>
                       </CardBody>
                     </Card>

                    <Card>
                      <CardBody pt={1.5} pb={2} px={6}>
                        <VStack align="stretch" spacing={-2}>
                          <Text fontSize="lg" fontWeight="bold" color="#004ea8">🏆 경기 통계</Text>
                          {renderStatRows([
                            {
                              label: '이번 달 경기',
                              value: `${games.filter(g => {
                                const gameDate = new Date(g.date);
                                const now = new Date();
                                return gameDate.getMonth() === now.getMonth() && gameDate.getFullYear() === now.getFullYear();
                              }).length}회`
                            },
                            {
                              label: '지난 달 경기',
                              value: `${games.filter(g => {
                                const gameDate = new Date(g.date);
                                const now = new Date();
                                const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
                                return gameDate.getMonth() === lastMonth.getMonth() && gameDate.getFullYear() === lastMonth.getFullYear();
                              }).length}회`
                            },
                            {
                              label: '올해 총 경기',
                              value: `${games.filter(g => {
                                const gameDate = new Date(g.date);
                                const now = new Date();
                                return gameDate.getFullYear() === now.getFullYear();
                              }).length}회`
                            }
                          ])}
                         </VStack>
                       </CardBody>
                     </Card>

                    <Card>
                      <CardBody pt={1.5} pb={2} px={6}>
                        <VStack align="stretch" spacing={-2}>
                          <Text fontSize="lg" fontWeight="bold" color="#004ea8">👥 권한별 현황</Text>
                          {renderStatRows([
                            {
                              label: '슈퍼관리자',
                              value: `${userList.filter(u => u.role === 'SUPER_ADMIN').length}명`,
                              valueColor: '#e53e3e'
                            },
                            {
                              label: '관리자',
                              value: `${userList.filter(u => u.role === 'ADMIN').length}명`,
                              valueColor: '#3182ce'
                            },
                            {
                              label: '일반 회원',
                              value: `${userList.filter(u => u.role === 'MEMBER').length}명`,
                              valueColor: '#4a5568'
                            }
                          ])}
                         </VStack>
                       </CardBody>
                     </Card>

                    <Card>
                      <CardBody pt={1.5} pb={2} px={6}>
                        <VStack align="stretch" spacing={-2}>
                          <Text fontSize="lg" fontWeight="bold" color="#004ea8">⚠️ 투표 경고 현황</Text>
                          {voteWarnings.length === 0 ? (
                            <Text color="gray.600" fontSize="sm" pl={4} mt={2} lineHeight={1.2}>경고가 없습니다.</Text>
                          ) : (
                            <VStack spacing={-3} align="stretch">
                              {voteWarnings.map((warning) => (
                                <Flex key={warning.userId} justify="space-between" align="center" px={4} mb={-1.5}>
                                  <VStack align="flex-start" spacing={-1}>
                                    <Text color="gray.700" fontWeight="medium" lineHeight={1}>{warning.userName}</Text>
                                    <Text color="gray.500" fontSize="xs" lineHeight={1}>
                                      경고일: {new Date(warning.lastWarningDate).toLocaleDateString('ko-KR')}
                                    </Text>
                                  </VStack>
                                  <Badge colorScheme="orange" size="sm">
                                    경고 {warning.warningCount}회
                                  </Badge>
                                </Flex>
                              ))}
                            </VStack>
                          )}
                        </VStack>
                      </CardBody>
                    </Card>
                  </SimpleGrid>

                  {/* 최근 활동 */}
                  <Card w="100%">
                    <CardBody pt={1.5} pb={2} px={6}>
                      <VStack align="stretch" spacing={-2}>
                        <HStack justify="space-between" align="center">
                          <Text fontSize="xl" fontWeight="bold" color="#004ea8">📊 최근 활동</Text>
                          <HStack spacing={2}>
                            <Button
                              size="sm"
                              colorScheme="blue"
                              variant="solid"
                              onClick={() => setIsNotificationModalOpen(true)}
                            >
                              최근 발송 알림 상세 보기
                            </Button>
                            <Button
                              size="sm"
                              colorScheme="blue"
                              variant="outline"
                              onClick={() => setActivityLogs([])}
                            >
                              로그 초기화
                            </Button>
                          </HStack>
                        </HStack>
                        
                        {activityLogs.length === 0 ? (
                        <Text color="gray.600" px={4} lineHeight={0.95}>아직 활동 내역이 없습니다.</Text>
                        ) : (
                          <VStack spacing={-3} align="stretch" maxH="400px" overflowY="auto">
                            {activityLogs.slice(0, 20).map((log, idx) => (
                              <Box
                                key={log.id}
                                px={4}
                                py={2}
                                mb={idx < activityLogs.slice(0, 20).length - 1 ? -1.5 : 0}
                                border="1px solid"
                                borderColor="gray.200"
                                borderRadius="md"
                                bg="gray.50"
                              >
                                <HStack justify="space-between" align="flex-start">
                                  <VStack align="flex-start" spacing={-1.5} flex={1}>
                                    <HStack spacing={2}>
                                      <Badge
                                        colorScheme={
                                          log.action === 'MEMBER_SUSPENDED' ? 'red' :
                                          log.action === 'VOTE_WARNING' ? 'orange' :
                                          log.action === 'LOGIN' ? 'green' :
                                          log.action === 'VOTE_PARTICIPATE' ? 'blue' :
                                          'gray'
                                        }
                                        size="sm"
                                      >
                                        {log.action === 'LOGIN' ? '로그인' :
                                         log.action === 'LOGOUT' ? '로그아웃' :
                                         log.action === 'GAME_JOIN' ? '경기참여' :
                                         log.action === 'GAME_CANCEL' ? '경기취소' :
                                         log.action === 'VOTE_PARTICIPATE' ? '투표참여' :
                                         log.action === 'VOTE_ABSENT' ? '투표불참' :
                                         log.action === 'ANNOUNCEMENT_CREATE' ? '공지작성' :
                                         log.action === 'ANNOUNCEMENT_EDIT' ? '공지수정' :
                                         log.action === 'MEMBER_STATUS_CHANGE' ? '상태변경' :
                                         log.action === 'VOTE_WARNING' ? '투표경고' :
                                         log.action === 'MEMBER_SUSPENDED' ? '회원정지' : '기타'}
                                      </Badge>
                                      <Text fontSize="sm" color="gray.500" lineHeight={0.95}>
                                        {new Date(log.timestamp).toLocaleString('ko-KR')}
                                      </Text>
                                    </HStack>
                                    <Text fontSize="sm" fontWeight="medium" lineHeight={0.95}>
                                      {log.userName}
                                    </Text>
                                    <Text fontSize="sm" color="gray.700" lineHeight={0.95}>
                                      {log.description}
                                    </Text>
                                  </VStack>
                                </HStack>
                              </Box>
                            ))}
                          </VStack>
                        )}
                      </VStack>
                    </CardBody>
                  </Card>
                  {/* 최근 발송 알림 상세 보기 모달 */}
                  {isNotificationModalOpen ? (
                    <Modal isOpen={isNotificationModalOpen} onClose={() => setIsNotificationModalOpen(false)} size="xl">
                      <ModalOverlay />
                      <ModalContent>
                        <ModalHeader>최근 발송 알림 상세</ModalHeader>
                        <ModalCloseButton />
                        <ModalBody>
                          {(() => {
                            // 표시 대상 준비: 우선 알림 상태(notifications), 없으면 최근 활동 로그에서 유사 항목 추출
                            const ACTIONS = ['ANNOUNCEMENT_CREATE', 'VOTE_WARNING', 'GAME_DAY_BEFORE', 'GAME_DAY_OF', 'VOTE_START'] as const;
                            const displayList = (notifications && notifications.length > 0)
                              ? notifications
                              : (activityLogs || [])
                                  .filter(l => (ACTIONS as readonly string[]).includes(l.action))
                                  .slice(0, 50)
                                  .map((l) => ({
                                    id: l.id,
                                    title: l.description || '알림',
                                    message: l.metadata?.message || l.description || '',
                                    recipients: [],
                                    sentAt: l.timestamp,
                                    status: 'SENT' as const,
                                    deliveryMethods: ['inapp'] as const
                                  }));

                            if (!displayList || displayList.length === 0) {
                              return <Text color="gray.600">최근 발송된 알림이 없습니다.</Text>;
                            }

                            return (
                              <VStack align="stretch" spacing={3} maxH="60vh" overflowY="auto">
                                {displayList.map((n) => (
                                <Box key={n.id} p={3} border="1px solid" borderColor="gray.200" borderRadius="md" bg="white">
                                  <VStack align="stretch" spacing={2}>
                                    <HStack justify="space-between">
                                      <Badge colorScheme={n.status === 'SENT' ? 'green' : n.status === 'FAILED' ? 'red' : 'blue'}>{n.status}</Badge>
                                      <Text fontSize="xs" color="gray.500">{new Date(n.sentAt).toLocaleString('ko-KR')}</Text>
                                    </HStack>
                                    <Text fontSize="md" fontWeight="bold">{n.title}</Text>
                                    <Text fontSize="sm" whiteSpace="pre-wrap" color="gray.700">{n.message}</Text>
                                    <HStack spacing={2} flexWrap="wrap">
                                      {(n.deliveryMethods || []).map((m) => (
                                        <Badge key={m} colorScheme={m === 'email' ? 'purple' : m === 'push' ? 'orange' : 'blue'}>{m}</Badge>
                                      ))}
                                    </HStack>
                                    <Box>
                                        <Text fontSize="xs" color="gray.500">수신자(ID): {(n.recipients || []).join(', ') || '없음'}</Text>
                                    </Box>
                                  </VStack>
                                </Box>
                                ))}
                              </VStack>
                            );
                          })()}
                        </ModalBody>
                        <ModalFooter>
                          <Button onClick={() => setIsNotificationModalOpen(false)}>닫기</Button>
                        </ModalFooter>
                      </ModalContent>
                    </Modal>
                  ) : null}

                  {/* 정지 해제 요청 관리 */}
                  <Card w="100%">
                    <CardBody pt={1.5} pb={2} px={6}>
                      <VStack align="stretch" spacing={-2}>
                        <HStack justify="space-between" align="center">
                          <Text fontSize="xl" fontWeight="bold" color="#004ea8">🔓 정지 해제 요청 관리</Text>
                          <Badge colorScheme="red" size="lg">
                            {suspensionRequests.filter(r => r.status === 'PENDING').length}건 대기
                          </Badge>
                        </HStack>
                        
                        {suspensionRequests.length === 0 ? (
                          <Text color="gray.600" px={4} lineHeight={0.95}>정지 해제 요청이 없습니다.</Text>
                        ) : (
                          <VStack spacing={-3} align="stretch" maxH="400px" overflowY="auto">
                            {suspensionRequests
                              .filter(r => r.status === 'PENDING')
                              .map((request, idx, filteredArray) => (
                                <Box
                                  key={request.id}
                                  px={4}
                                  py={2}
                                  mb={idx < filteredArray.length - 1 ? -1.5 : 0}
                                  border="1px solid"
                                  borderColor="orange.200"
                                  borderRadius="md"
                                  bg="orange.50"
                                >
                                  <VStack align="stretch" spacing={-1.5}>
                                    <HStack justify="space-between" align="center">
                                      <Text fontSize="lg" fontWeight="bold" color="orange.800" lineHeight={0.95}>
                                        {request.userName}
                                      </Text>
                                      <Badge colorScheme="orange" size="sm">
                                        대기중
                                      </Badge>
                                    </HStack>
                                    
                                    <Text fontSize="sm" color="gray.700" lineHeight={0.95}>
                                      <strong>요청 사유:</strong> {request.reason}
                                    </Text>
                                    
                                    <Text fontSize="xs" color="gray.500" lineHeight={0.95}>
                                      요청일: {new Date(request.requestDate).toLocaleDateString('ko-KR')}
                                    </Text>
                                    
                                    <HStack spacing={2} justify="flex-end" mt={1}>
                                      <Button
                                        size="sm"
                                        colorScheme="green"
                                        onClick={() => approveSuspensionRequest(request.id)}
                                      >
                                        승인
                                      </Button>
                                      <Button
                                        size="sm"
                                        colorScheme="red"
                                        variant="outline"
                                        onClick={() => rejectSuspensionRequest(request.id)}
                                      >
                                        거절
                                      </Button>
                                    </HStack>
                                  </VStack>
                                </Box>
                              ))}
                            
                            {/* 처리된 요청들 */}
                            {suspensionRequests.filter(r => r.status !== 'PENDING').length > 0 && (
                              <>
                                <Divider />
                                <Text fontSize="md" fontWeight="bold" color="gray.600" px={4} lineHeight={0.95}>
                                  처리된 요청
                                </Text>
                                {suspensionRequests
                                  .filter(r => r.status !== 'PENDING')
                                  .map((request, idx, filteredArray) => (
                                    <Box
                                      key={request.id}
                                      px={4}
                                      py={2}
                                      mb={idx < filteredArray.length - 1 ? -1.5 : 0}
                                      border="1px solid"
                                      borderColor={request.status === 'APPROVED' ? 'green.200' : 'red.200'}
                                      borderRadius="md"
                                      bg={request.status === 'APPROVED' ? 'green.50' : 'red.50'}
                                    >
                                      <HStack justify="space-between" align="center">
                                        <VStack align="flex-start" spacing={-1.5} flex={1}>
                                          <HStack spacing={2}>
                                            <Text fontSize="sm" fontWeight="medium" lineHeight={0.95}>
                                              {request.userName}
                                            </Text>
                                            <Badge
                                              colorScheme={request.status === 'APPROVED' ? 'green' : 'red'}
                                              size="sm"
                                            >
                                              {request.status === 'APPROVED' ? '승인됨' : '거절됨'}
                                            </Badge>
                                          </HStack>
                                          <Text fontSize="xs" color="gray.500" lineHeight={0.95}>
                                            {new Date(request.requestDate).toLocaleDateString('ko-KR')}
                                          </Text>
                                        </VStack>
                                      </HStack>
                                    </Box>
                                  ))}
                              </>
                            )}
                          </VStack>
                        )}
                      </VStack>
                    </CardBody>
                  </Card>
                </VStack>
              )}

              {/* 회원 관리 */}
              {selectedMenu === 'users' && hasPermission('member_management') && (
                <Box w="100%">
                          <MemberManagement 
          userList={userList} 
          onUserListChange={(users: ExtendedMember[]) => setUserList(users)} 
        />
                </Box>
              )}
              
              {/* 경기 관리 */}
              {selectedMenu === 'games' && hasPermission('game_management') && (
                <Box w="100%">
                          <GameManagement 
          games={games} 
          onGamesChange={setGames}
          userList={userList}
          onGameUpdate={(updatedGame) => {
            // 게임 업데이트 시 목록 갱신
            setGames(prevGames => 
              prevGames.map(game => 
                game.id === updatedGame.id ? updatedGame : game
              )
            );
          }}
          onGameDataChanged={() => {
            // SchedulePageV2에 경기 데이터 변경 알림
            // 페이지 새로고침이나 이벤트를 통해 동기화
            window.dispatchEvent(new CustomEvent('gameDataChanged'));
          }}
        />
                </Box>
              )}

              {/* 투표결과 */}
              {selectedMenu === 'vote-results' && (
                <Box w="100%">
                  <VoteResultsPage />
                </Box>
              )}

              {/* 투표 세션 관리 */}
              {selectedMenu === 'vote-sessions' && (
                <VoteSessionManagement 
                  unifiedVoteData={unifiedVoteData}
                  onRefresh={loadUnifiedVoteData}
                />
              )}
              
              {/* 이번주 일정 */}
              {selectedMenu === 'this-week-schedules' && hasPermission('game_management') && (
                <Box w="100%">
                  <ThisWeekScheduleManagement 
                    schedules={thisWeekSchedules} 
                    onSchedulesChange={setThisWeekSchedules} 
                  />
                </Box>
              )}



              {/* 알림 관리 */}
              {selectedMenu === 'notifications' && hasPermission('all') && (
                <VStack spacing={8} align="stretch" w="100%">
                  <Flex justify="space-between" align="center">
                    <HStack spacing={3}>
                    <Text fontSize="2xl">🔔</Text>
                    <Text fontSize="2xl" fontWeight="bold" color="#004ea8">알림 관리</Text>
                  </HStack>
                    <Button
                      colorScheme="blue"
                      bg="#004ea8"
                      _hover={{ bg: '#003d7a' }}
                      onClick={handleSaveNotifications}
                      isDisabled={!isNotificationChanged}
                    >
                      알림 설정 저장
                    </Button>
                  </Flex>

                  {/* 알림 시스템 상태 */}
                  <Card w="100%">
                    <CardBody py={2} px={4}>
                      <VStack spacing={2} align="stretch">
                        <HStack justify="space-between" align="center">
                          <Text fontSize="lg" fontWeight="bold" color="#004ea8">📊 알림 시스템 상태</Text>
                          <Switch
                            isChecked={isNotificationSystemActive}
                            onChange={(e) => setIsNotificationSystemActive(e.target.checked)}
                            colorScheme="green"
                          />
                        </HStack>
                        
                        <HStack spacing={4}>
                          <Badge colorScheme={isNotificationSystemActive ? 'green' : 'red'} size="lg">
                            {isNotificationSystemActive ? '활성화' : '비활성화'}
                          </Badge>
                          <Text fontSize="sm" color="gray.600">
                            {isNotificationSystemActive ? '자동 알림이 활성화되어 있습니다' : '자동 알림이 비활성화되어 있습니다'}
                          </Text>
                        </HStack>
                      </VStack>
                    </CardBody>
                  </Card>

                  <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={2} w="100%">
                    {/* 경기 알림 설정 */}
                    <Card>
                      <CardBody pt={2} pb={5} px={4}>
                        <VStack spacing={2} align="stretch" mt={0} mb={0}>
                          <HStack spacing={3} mt={0}>
                            <Icon as={CalendarIcon} color="#004ea8" boxSize={5} />
                            <Text fontSize="lg" fontWeight="bold" color="#004ea8">경기 알림</Text>
                            <Badge colorScheme={notificationSettings.gameReminder.enabled ? 'green' : 'gray'}>
                              {notificationSettings.gameReminder.enabled ? '활성' : '비활성'}
                            </Badge>
                          </HStack>
                          <Divider />
                          
                          <FormControl display="flex" alignItems="center">
                            <FormLabel mb="0" color="gray.700" fontWeight="bold">경기 알림 활성화</FormLabel>
                            <Switch
                              isChecked={notificationSettings.gameReminder.enabled}
                              onChange={(e) => handleNotificationChange('gameReminder', 'enabled', e.target.checked)}
                              colorScheme="blue"
                            />
                          </FormControl>

                          {notificationSettings.gameReminder.enabled && (
                            <>
                              <FormControl>
                                <FormLabel color="gray.700" fontWeight="bold">알림 전송 시간</FormLabel>
                                <HStack>
                                  <NumberInput
                                    value={notificationSettings.gameReminder.beforeHours}
                                    onChange={(_, value) => handleNotificationChange('gameReminder', 'beforeHours', value)}
                                    min={1}
                                    max={168}
                                    w="120px"
                                  >
                                    <NumberInputField />
                                    <NumberInputStepper>
                                      <NumberIncrementStepper />
                                      <NumberDecrementStepper />
                                    </NumberInputStepper>
                                  </NumberInput>
                                  <Text color="gray.600">시간 전</Text>
                                </HStack>
                              </FormControl>

                              <FormControl>
                                <FormLabel color="gray.700" fontWeight="bold">알림 대상</FormLabel>
                                <Select
                                  value={notificationSettings.gameReminder.targets[0]}
                                  onChange={(e) => handleNotificationChange('gameReminder', 'targets', [e.target.value])}
                                  focusBorderColor="#004ea8"
                                >
                                  <option value="all">전체 회원</option>
                                  <option value="participating">참가 회원만</option>
                                  <option value="admin">관리자만</option>
                                </Select>
                              </FormControl>
            </>
          )}
                          
                          {/* 수동 발송 버튼 */}
                          <Divider />
                          <VStack spacing={2} align="stretch" mb={0}>
                            <Text fontSize="md" fontWeight="bold" color="gray.700">수동 발송</Text>
                              <HStack spacing={2}>
                                <Button
                                  colorScheme="gray"
                                  size="md"
                                  onClick={showGamePreview}
                                  leftIcon={<Icon as={ViewIcon} />}
                                >
                                  프리뷰 보기
                                </Button>
                <Button
                  colorScheme="green"
                  size="md"
                  onClick={sendGameNotification}
                  isDisabled={!isNotificationSystemActive}
                  leftIcon={<Icon as={InfoIcon} />}
                >
                  경기 알림 발송
                </Button>
                              </HStack>
                          </VStack>
                        </VStack>
                      </CardBody>
                    </Card>

                    {/* 투표 알림 설정 */}
                    <Card>
                      <CardBody pt={2} pb={5} px={4}>
                        <VStack spacing={2} align="stretch" mt={0} mb={0}>
                          <HStack spacing={3} mt={0}>
                            <Icon as={ViewIcon} color="#004ea8" boxSize={5} />
                            <Text fontSize="lg" fontWeight="bold" color="#004ea8">투표 알림</Text>
                            <Badge colorScheme={notificationSettings.voteReminder.enabled ? 'green' : 'gray'}>
                              {notificationSettings.voteReminder.enabled ? '활성' : '비활성'}
                            </Badge>
                          </HStack>
                          <Divider />

                          <FormControl display="flex" alignItems="center">
                            <FormLabel mb="0" color="gray.700" fontWeight="bold">투표 알림 활성화</FormLabel>
                            <Switch
                              isChecked={notificationSettings.voteReminder.enabled}
                              onChange={(e) => handleNotificationChange('voteReminder', 'enabled', e.target.checked)}
                              colorScheme="blue"
                            />
                          </FormControl>

                          {notificationSettings.voteReminder.enabled && (
                            <>
                              <FormControl>
                                <FormLabel color="gray.700" fontWeight="bold">알림 전송 시간</FormLabel>
                                <HStack>
                                  <NumberInput
                                    value={notificationSettings.voteReminder.beforeHours}
                                    onChange={(_, value) => handleNotificationChange('voteReminder', 'beforeHours', value)}
                                    min={1}
                                    max={72}
                                    w="120px"
                                  >
                                    <NumberInputField />
                                    <NumberInputStepper>
                                      <NumberIncrementStepper />
                                      <NumberDecrementStepper />
                                    </NumberInputStepper>
                                  </NumberInput>
                                  <Text color="gray.600">시간 전</Text>
                                </HStack>
                              </FormControl>

                              <FormControl>
                                <FormLabel color="gray.700" fontWeight="bold">알림 대상</FormLabel>
                                <Select
                                  value={notificationSettings.voteReminder.targets[0]}
                                  onChange={(e) => handleNotificationChange('voteReminder', 'targets', [e.target.value])}
                                  focusBorderColor="#004ea8"
                                >
                                  <option value="all">전체 회원</option>
                                  <option value="admin">관리자만</option>
                                </Select>
                              </FormControl>
                            </>
                          )}
                          
                          {/* 수동 발송 버튼 */}
                          <Divider />
                          <VStack spacing={2} align="stretch" mb={0}>
                            <Text fontSize="md" fontWeight="bold" color="gray.700">수동 발송</Text>
                              <HStack spacing={2}>
                                <Button
                                  colorScheme="gray"
                                  size="md"
                                  onClick={showVotePreview}
                                  leftIcon={<Icon as={ViewIcon} />}
                                >
                                  프리뷰 보기
                                </Button>
                                <Button
                                  colorScheme="purple"
                                  size="md"
                                  onClick={sendVoteReminder}
                                  isDisabled={!isNotificationSystemActive}
                                  leftIcon={<Icon as={ViewIcon} />}
                                >
                                  투표 알림 발송
                                </Button>
                              </HStack>
                          </VStack>
                        </VStack>
                      </CardBody>
                    </Card>
                  </SimpleGrid>



                  {/* 알림 설정 요약 */}
                  <Card w="100%">
                    <CardBody py={2} px={4}>
                      <VStack spacing={2} align="stretch">
                        <Text fontSize="lg" fontWeight="bold" color="#004ea8">📋 알림 설정 요약</Text>
                        <Divider />
                        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={2}>
                          <Box>
                            <Text fontSize="sm" color="gray.600" fontWeight="bold">경기 알림</Text>
                            <Text>
                              {notificationSettings.gameReminder.enabled 
                                ? `활성 - ${notificationSettings.gameReminder.beforeHours}시간 전 알림` 
                                : '비활성'}
                            </Text>
                          </Box>
                          <Box>
                            <Text fontSize="sm" color="gray.600" fontWeight="bold">투표 알림</Text>
                            <Text>
                              {notificationSettings.voteReminder.enabled 
                                ? `활성 - ${notificationSettings.voteReminder.beforeHours}시간 전 알림` 
                                : '비활성'}
                            </Text>
                          </Box>
                        </SimpleGrid>
                      </VStack>
                    </CardBody>
                  </Card>
                </VStack>
              )}










              {/* 활동 분석 */}
              {selectedMenu === 'analytics' && hasPermission('all') && (
                <VStack spacing={8} align="stretch" w="100%">
                  <HStack spacing={3}>
                    <Text fontSize="2xl">📈</Text>
                    <Text fontSize="2xl" fontWeight="bold" color="#004ea8">활동 분석</Text>
                  </HStack>

                  {/* 월간 활동 요약 */}
                  <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={2} w="100%">
                    <Card bg="blue.50" border="1px solid" borderColor="blue.200" shadow="sm">
                      <CardBody pt={1.5} pb={2} px={6}>
                        <Stat p={0} m={0}>
                          <HStack justify="space-between" align="center" mt={0} mb={0}>
                            <StatLabel color="blue.800" fontSize="lg" fontWeight="bold" m={0} lineHeight={1.2}>
                              📊 이번 달 참가율
                            </StatLabel>
                            <StatNumber color="gray.700" fontSize="2xl" fontWeight="bold" m={0} lineHeight={1.2}>
                              {activityAnalysisData?.summary.participationRate || 0}%
                            </StatNumber>
                          </HStack>
                          <StatHelpText color="blue.600" fontSize="sm" mt={1} mb={0}>
                            <StatArrow type="increase" />
                            실제 참여 데이터 기준
                          </StatHelpText>
                        </Stat>
                      </CardBody>
                    </Card>
                    
                    <Card bg="cyan.50" border="1px solid" borderColor="cyan.200" shadow="sm">
                      <CardBody pt={1.5} pb={2} px={6}>
                        <Stat p={0} m={0}>
                          <HStack justify="space-between" align="center" mt={0} mb={0}>
                            <StatLabel color="cyan.800" fontSize="lg" fontWeight="bold" m={0} lineHeight={1.2}>
                              🗳️ 투표 참여율
                            </StatLabel>
                            <StatNumber color="gray.700" fontSize="2xl" fontWeight="bold" m={0} lineHeight={1.2}>
                              {activityAnalysisData?.summary.voteParticipationRate || 0}%
                            </StatNumber>
                          </HStack>
                          <StatHelpText color="cyan.600" fontSize="sm" mt={1} mb={0}>
                            <StatArrow type="increase" />
                            실제 투표 데이터 기준
                          </StatHelpText>
                        </Stat>
                      </CardBody>
                    </Card>
                    
                    <Card bg="pink.50" border="1px solid" borderColor="pink.200" shadow="sm">
                      <CardBody pt={1.5} pb={2} px={6}>
                        <Stat p={0} m={0}>
                          <HStack justify="space-between" align="center" mt={0} mb={0}>
                            <StatLabel color="pink.800" fontSize="lg" fontWeight="bold" m={0} lineHeight={1.2}>
                              👥 활성 사용자
                            </StatLabel>
                            <StatNumber color="gray.700" fontSize="2xl" fontWeight="bold" m={0} lineHeight={1.2}>
                              {activityAnalysisData?.summary.activeUsers || 0}
                            </StatNumber>
                          </HStack>
                          <StatHelpText color="pink.600" fontSize="sm" mt={1} mb={0}>
                            <StatArrow type="increase" />
                            이번 달 활동 기준
                          </StatHelpText>
                        </Stat>
                      </CardBody>
                    </Card>
                    
                    <Card bg="yellow.50" border="1px solid" borderColor="yellow.200" shadow="sm">
                      <CardBody pt={1.5} pb={2} px={6}>
                        <Stat p={0} m={0}>
                          <HStack justify="space-between" align="center" mt={0} mb={0}>
                            <StatLabel color="yellow.800" fontSize="lg" fontWeight="bold" m={0} lineHeight={1.2}>
                              ⚽ 이번 달 경기수
                            </StatLabel>
                            <StatNumber color="gray.700" fontSize="2xl" fontWeight="bold" m={0} lineHeight={1.2}>
                              {activityAnalysisData?.summary.thisMonthGames || 0}
                            </StatNumber>
                          </HStack>
                          <StatHelpText color="yellow.600" fontSize="sm" mt={1} mb={0}>
                            <StatArrow type="increase" />
                            실제 경기 데이터 기준
                          </StatHelpText>
                        </Stat>
                      </CardBody>
                    </Card>
                  </SimpleGrid>

                  <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={2} w="100%">
                    {/* 회원별 참여 현황 */}
                    <Card>
                      <CardBody pt={1.5} pb={2} px={6}>
                        <VStack spacing={2} align="stretch">
                          <Text fontSize="lg" fontWeight="bold" color="#004ea8">👥 회원별 참여 현황</Text>
                          <Divider />
                          
                          <TableContainer maxH="400px" overflowY="auto">
                            <Table size="sm" variant="simple">
                              <Thead position="sticky" top={0} bg="white" zIndex={1}>
                                <Tr>
                                  <Th>회원명</Th>
                                  <Th>경기 참여</Th>
                                  <Th>투표 참여</Th>
                                  <Th>활동점수</Th>
                                </Tr>
                              </Thead>
                              <Tbody>
                                {activityAnalysisData?.memberStats && activityAnalysisData.memberStats.length > 0 ? (
                                  activityAnalysisData.memberStats.map((member) => (
                                    <Tr key={member.id}>
                                      <Td fontWeight="bold">
                                        {member.name}
                                        <Badge 
                                          ml={2} 
                                          size="sm"
                                          colorScheme={
                                            member.role === 'SUPER_ADMIN' ? 'red' :
                                            member.role === 'ADMIN' ? 'blue' : 'gray'
                                          }
                                        >
                                          {member.role === 'SUPER_ADMIN' ? '슈퍼관리자' :
                                           member.role === 'ADMIN' ? '관리자' : '회원'}
                                        </Badge>
                                      </Td>
                                      <Td>
                                        <Progress 
                                        value={member.gameParticipation} 
                                          colorScheme="green"
                                          size="sm"
                                          w="60px"
                                        />
                                      <Text fontSize="xs" mt={1}>{member.gameParticipation}%</Text>
                                      </Td>
                                      <Td>
                                        <Progress 
                                        value={member.voteParticipation} 
                                          colorScheme="blue"
                                          size="sm"
                                          w="60px"
                                        />
                                      <Text fontSize="xs" mt={1}>{member.voteParticipation}%</Text>
                                      </Td>
                                      <Td>
                                        <Badge 
                                          colorScheme={
                                          member.activityScore >= 80 ? 'green' :
                                          member.activityScore >= 60 ? 'yellow' : 'red'
                                          }
                                        >
                                        {member.activityScore}점
                                        </Badge>
                                      </Td>
                                    </Tr>
                                  ))
                                ) : (
                                  <Tr>
                                    <Td colSpan={4} textAlign="center" py={8}>
                                      <Text color="gray.500">회원 데이터가 없습니다.</Text>
                                    </Td>
                                  </Tr>
                                )}
                              </Tbody>
                            </Table>
                          </TableContainer>
                          
                          {userList.length === 0 && (
                            <Flex justify="center" py={8}>
                              <Text color="gray.500">회원 데이터가 없습니다.</Text>
      </Flex>
                          )}
                        </VStack>
                      </CardBody>
                    </Card>

                    {/* 월별 경기 현황 */}
                    <Card>
                      <CardBody pt={1.5} pb={2} px={6}>
                        <VStack spacing={2} align="stretch">
                          <Text fontSize="lg" fontWeight="bold" color="#004ea8">📅 월별 경기 현황</Text>
                          <Divider />
                          
                          <VStack spacing={3} align="stretch">
                            {activityAnalysisData?.monthlyGameStats && activityAnalysisData.monthlyGameStats.length > 0 ? (
                              activityAnalysisData.monthlyGameStats.map((monthData, index) => {
                                const gameCount = monthData.gameCount;
                                const maxGames = 8; // 월 최대 경기수 가정
                                
                                return (
                                  <Box key={index}>
                                    <Flex justify="space-between" align="center" mb={1}>
                                      <Text fontSize="sm" fontWeight="bold">
                                        {monthData.month}
                                      </Text>
                                      <Text fontSize="sm" color="gray.600">
                                        {gameCount}경기
                                      </Text>
                                    </Flex>
                                    <Progress 
                                      value={gameCount > 0 ? (gameCount / maxGames) * 100 : 0}
                                      colorScheme="blue"
                                      size="sm"
                                      bg="gray.100"
                                    />
                                  </Box>
                                );
                              })
                            ) : (
                              <Text color="gray.500" textAlign="center" py={4}>월별 경기 데이터가 없습니다.</Text>
                            )}
                          </VStack>
                          
                          <Divider />
                          <Box>
                            <Text fontSize="sm" color="gray.600" mb={2}>경기 유형별 분포</Text>
                            <VStack spacing={1} align="stretch">
                              <Flex justify="space-between">
                                <Text fontSize="sm">매치 경기</Text>
                                <Badge colorScheme="red" variant="subtle">
                                  {activityAnalysisData?.gameTypeDistribution.match || 0}회
                                </Badge>
                              </Flex>
                              <Flex justify="space-between">
                                <Text fontSize="sm">자체 경기</Text>
                                <Badge colorScheme="blue" variant="subtle">
                                  {activityAnalysisData?.gameTypeDistribution.friendly || 0}회
                                </Badge>
                              </Flex>
                            </VStack>
                          </Box>
                        </VStack>
                      </CardBody>
                    </Card>
                  </SimpleGrid>

                  {/* 상세 분석 리포트 */}
                  <Card w="100%">
                    <CardBody py={2} px={4}>
                      <VStack spacing={6} align="stretch">
                        <Text fontSize="lg" fontWeight="bold" color="#004ea8">📊 상세 분석 리포트</Text>
                        <Divider />
                        
                        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={2}>
                          <Box>
                            <Text fontSize="md" fontWeight="bold" mb={3}>👑 최고 참여자</Text>
                            <VStack spacing={1} align="stretch">
                              {activityAnalysisData?.memberStats && activityAnalysisData.memberStats.length > 0 ? (
                                activityAnalysisData.memberStats.slice(0, 3).map((member, index) => (
                                  <TopParticipantItem key={member.id} member={member} index={index} />
                                ))
                              ) : (
                                <Text fontSize="sm" color="gray.500">데이터가 없습니다.</Text>
                              )}
                            </VStack>
                          </Box>
                          
                          <Box>
                            <Text fontSize="md" fontWeight="bold" mb={3}>⚽ 이번 달 하이라이트</Text>
                            <VStack spacing={1} align="stretch">
                              <Text fontSize="sm">• 총 {games.filter(g => {
                                const gameDate = new Date(g.date);
                                const now = new Date();
                                return gameDate.getMonth() === now.getMonth();
                              }).length}경기 진행</Text>
                              <Text fontSize="sm">• 평균 참가인원: {Math.floor(Math.random() * 5) + 15}명</Text>
                              <Text fontSize="sm">• 신규 가입자: {userList.filter(u => {
                                if (!u.createdAt) return false;
                                const created = new Date(u.createdAt);
                                const now = new Date();
                                return created.getMonth() === now.getMonth();
                              }).length}명</Text>
                              <Text fontSize="sm">• 팀 활동성: 
                                <Badge colorScheme="green" ml={2}>매우 높음</Badge>
                              </Text>
                            </VStack>
                          </Box>
                          
                          <Box>
                            <Text fontSize="md" fontWeight="bold" mb={3}>🏆 상위 참여자</Text>
                            <VStack spacing={1} align="stretch">
                              {activityAnalysisData?.memberStats && activityAnalysisData.memberStats.length > 0 ? (
                                activityAnalysisData.memberStats.slice(0, 3).map((member, index) => (
                                  <Flex key={member.id} justify="space-between" align="center">
                                    <HStack>
                                      <Badge 
                                        colorScheme={
                                          index === 0 ? 'yellow' : 
                                          index === 1 ? 'gray' : 'orange'
                                        }
                                        size="sm"
                                      >
                                        {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                                      </Badge>
                                      <Text fontSize="sm" fontWeight="bold">{member.name}</Text>
                                    </HStack>
                                    <Text fontSize="sm" color="gray.600">
                                      {Math.round((member.gameParticipation + member.voteParticipation) / 2)}%
                                    </Text>
                                  </Flex>
                                ))
                              ) : (
                                <Text fontSize="sm" color="gray.500">데이터가 없습니다.</Text>
                              )}
                            </VStack>
                          </Box>
                          
                          <Box>
                            <Text fontSize="md" fontWeight="bold" mb={3}>📈 개선 포인트</Text>
                            <VStack spacing={1} align="stretch">
                              <Text fontSize="sm">• 투표 참여율 향상 필요</Text>
                              <Text fontSize="sm">• 신규 회원 온보딩 강화</Text>
                              <Text fontSize="sm">• 경기 후 피드백 수집</Text>
                              <Text fontSize="sm">• 팀 내 소통 활성화</Text>
                            </VStack>
                          </Box>
                        </SimpleGrid>
                      </VStack>
                    </CardBody>
                                    </Card>
                </VStack>
              )}

              {/* 풋살 경기 현황판 */}
              {selectedMenu === 'football' && hasPermission('all') && (
                <Box w="100%">
                  <FootballFieldPage memberList={userList} games={games} />
                </Box>
              )}


            </>
          )}
        </Box>
      </Flex>

      {/* 경기 알림 프리뷰 모달 */}
      <Modal isOpen={isGamePreviewOpen} onClose={onGamePreviewClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>경기 알림 프리뷰</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Box 
              p={4} 
              border="1px solid" 
              borderColor="gray.200" 
              borderRadius="md"
              bg="white"
            >
                      <div 
                        style={{
                          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                          maxWidth: "600px",
                          margin: "0 auto",
                          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                          padding: "40px",
                          borderRadius: "15px",
                          color: "white"
                        }}
                      >
                        <div style={{ background: "rgba(255, 255, 255, 0.1)", padding: "30px", borderRadius: "10px", marginBottom: "30px" }}>
                          <h2 style={{ margin: "0 0 20px 0", fontSize: "24px", textAlign: "center" }}>⚽ 경기 알림</h2>
                          <p style={{ margin: "0 0 20px 0", fontSize: "18px", lineHeight: "1.6", textAlign: "center" }}>
                            확정된 경기 일정을 회원들에게 알립니다.
                          </p>
                          
                          {/* 실제 경기 데이터 표시 (미래 경기만 프리뷰) */}
                          {(() => {
                            const now = new Date();
                            const futureGames = (games || []).filter(g => {
                              const d = new Date(g.date);
                              return d.getTime() >= now.getTime();
                            });
                            return futureGames.length > 0 ? (
                            <div style={{ background: "rgba(255, 255, 255, 0.2)", padding: "20px", borderRadius: "8px", marginTop: "20px" }}>
                              <h3 style={{ margin: "0 0 15px 0", fontSize: "20px", textAlign: "center" }}>다음 경기 일정</h3>
                              {futureGames.slice(0, 3).map((game, index) => (
                                <div key={index} style={{ marginBottom: "15px", padding: "15px", background: "rgba(255, 255, 255, 0.1)", borderRadius: "8px" }}>
                                  {/* 첫번째줄: 경기유형 */}
                                  <div style={{ fontSize: "14px", marginBottom: "5px" }}>
                                    🏆 {(() => {
                                      const eventType = game.eventType || '자체';
                                      if (['풋살', 'FRIENDLY', 'FRIENDLY_MATCH'].includes(eventType)) return '매치';
                                      if (!['매치', '자체', '회식', '기타'].includes(eventType)) return '기타';
                                      return eventType;
                                    })()}
                                  </div>
                                  {/* 두번째줄: 일시 */}
                                  <div style={{ fontSize: "14px", marginBottom: "5px" }}>
                                    📅 {new Date(game.date).toLocaleDateString('ko-KR', { 
                                      year: 'numeric', 
                                      month: 'long', 
                                      day: 'numeric',
                                      weekday: 'long'
                                    })} {game.time ? `⏰ ${game.time}` : ''}
                                  </div>
                                  {/* 세번째줄: 장소 */}
                                  <div style={{ fontSize: "14px", marginBottom: "5px", display: "flex", alignItems: "center", gap: "10px" }}>
                                    📍 {game.location || '장소 미정'}
                                    {game.location && (
                                      <button 
                                        style={{
                                          background: "#FFD700",
                                          border: "none",
                                          borderRadius: "4px",
                                          color: "#0066CC",
                                          padding: "4px 8px",
                                          fontSize: "12px",
                                          cursor: "pointer",
                                          fontWeight: "bold"
                                        }}
                                        onClick={() => window.open(`https://map.kakao.com/link/search/${encodeURIComponent(game.location)}`, '_blank')}
                                      >
                                        K
                                      </button>
                                    )}
                                  </div>
                                  {/* 네번째줄: 참가자 인원수 */}
                                  <div style={{ fontSize: "14px", marginBottom: "5px" }}>
                                    👥 참가자: {game.totalParticipantCount || 0}명
                                  </div>
                                  {/* 다섯번째줄: 참가인원 이름 나열 (pill 형식) */}
                                  {game.allParticipantNames && game.allParticipantNames.length > 0 && (
                                    <div style={{ fontSize: "14px", marginBottom: "5px", opacity: "0.9", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                                      {game.allParticipantNames.map((name, index) => (
                                        <span 
                                          key={index}
                                          style={{
                                            background: "#3182CE",
                                            color: "white",
                                            padding: "2px 8px",
                                            borderRadius: "12px",
                                            fontSize: "12px",
                                            fontWeight: "500"
                                          }}
                                        >
                                          {name}
                                        </span>
                                      ))}
                                      {game.mercenaryCount > 0 && (
                                        <span 
                                          style={{
                                            background: "#2D3748",
                                            color: "white",
                                            padding: "2px 8px",
                                            borderRadius: "12px",
                                            fontSize: "12px",
                                            fontWeight: "500"
                                          }}
                                        >
                                          용병 {game.mercenaryCount}명
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                            ) : (
                            <div style={{ background: "rgba(255, 255, 255, 0.2)", padding: "20px", borderRadius: "8px", marginTop: "20px", textAlign: "center" }}>
                              <p style={{ margin: "0", fontSize: "16px" }}>현재 확정된 경기가 없습니다.</p>
                            </div>
                            );
                          })()}
                        </div>
                
                <div style={{ textAlign: "center", marginBottom: "30px" }}>
                  <div style={{ display: "inline-block", background: "rgba(255, 255, 255, 0.2)", padding: "15px 25px", borderRadius: "25px" }}>
                    <span style={{ fontSize: "14px", opacity: "0.9" }}>발송 시간: {new Date().toLocaleString('ko-KR')}</span>
                  </div>
                </div>
                
                <div style={{ textAlign: "center", fontSize: "14px", opacity: "0.7" }}>
                  <p style={{ margin: "0" }}>이 이메일은 자동으로 발송되었습니다.</p>
                  <p style={{ margin: "5px 0 0 0" }}>FC CHAL GGYEO 관리 시스템</p>
                </div>
              </div>
            </Box>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" onClick={onGamePreviewClose}>닫기</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 관리자 가이드 모달 */}
      <ManualModal isOpen={adminManual.isOpen} onClose={adminManual.onClose} variant="admin" />

      {/* 투표 알림 프리뷰 모달 */}
      <Modal isOpen={isVotePreviewOpen} onClose={onVotePreviewClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>투표 알림 프리뷰</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Box 
              p={4} 
              border="1px solid" 
              borderColor="gray.200" 
              borderRadius="md"
              bg="white"
            >
                      <div 
                        style={{
                          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                          maxWidth: "600px",
                          margin: "0 auto",
                          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                          padding: "40px",
                          borderRadius: "15px",
                          color: "white"
                        }}
                      >
                        <div style={{ background: "rgba(255, 255, 255, 0.1)", padding: "30px", borderRadius: "10px", marginBottom: "30px" }}>
                          <h2 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: 800, textAlign: "center" }}>🗳️ 투표 알림</h2>
                          
                          {/* 실제 투표 데이터 표시 */}
                          {(() => {
                            const sessions = Array.isArray(unifiedVoteData?.allSessions) ? unifiedVoteData.allSessions : [];
                            // 1순위: 가장 최신 세션 (ID가 가장 큰 세션), 2순위: activeSession, 3순위: lastWeekResults, 4순위: 첫 번째 세션
                            const latestSession = sessions.length > 0 ? sessions[0] : null; // allSessions는 id desc로 정렬되어 있음
                            // 최신 세션을 우선적으로 선택
                            const session = latestSession || sessions[0] || null;
                            if (!session) return (
                              <div style={{ background: "rgba(255, 255, 255, 0.2)", padding: "20px", borderRadius: "8px", marginTop: "20px", textAlign: "center" }}>
                                <p style={{ margin: "0", fontSize: "16px" }}>현재 활성화된 투표 세션이 없습니다.</p>
                              </div>
                            );
                            const start = new Date(session.weekStartDate || session.startTime || session.voteStartDate || Date.now());
                            // 월요일 00:01 보정
                            const startMonday = new Date(start);
                            startMonday.setDate(startMonday.getDate() - ((startMonday.getDay() + 6) % 7));
                            startMonday.setHours(0, 1, 0, 0);
                            // 투표 기간 표시용: 월-금 (금요일 23:59:59까지)
                            // 월요일 기준 +4일 = 금요일
                            const endFriday = new Date(startMonday.getTime() + 4 * 24 * 60 * 60 * 1000);
                            endFriday.setHours(23, 59, 59, 0);
                            
                            // 마감 계산용: 매주 목요일 17:00
                            // 현재 시점에서 다음 목요일 17:00 계산
                            const now = new Date();
                            const currentDay = now.getDay(); // 0=일, 1=월, ..., 4=목, 5=금, 6=토
                            let daysUntilThursday = 0;
                            
                            if (currentDay <= 4) { // 일~목
                              daysUntilThursday = 4 - currentDay;
                            } else { // 금~토
                              daysUntilThursday = 11 - currentDay; // 다음주 목요일
                            }
                            
                            const nextThursday = new Date(now);
                            nextThursday.setDate(now.getDate() + daysUntilThursday);
                            nextThursday.setHours(17, 0, 0, 0);
                            
                            // 표시용 종료일은 금요일, 마감 계산은 목요일 17:00
                            const endSafe = endFriday; // 표시는 금요일까지
                            const deadlineForCalculation = nextThursday; // 마감은 목요일 17:00
                            // 요일 표기 (같은 해면 두 번째 연도 생략)
                            const days = ['일','월','화','수','목','금','토'];
                            const startStr = `${startMonday.getFullYear()}. ${String(startMonday.getMonth()+1).padStart(2,'0')}. ${String(startMonday.getDate()).padStart(2,'0')}.(${days[startMonday.getDay()]})`;
                            const endStr = startMonday.getFullYear() === endSafe.getFullYear() 
                              ? `${String(endSafe.getMonth()+1).padStart(2,'0')}. ${String(endSafe.getDate()).padStart(2,'0')}.(${days[endSafe.getDay()]})`
                              : `${endSafe.getFullYear()}. ${String(endSafe.getMonth()+1).padStart(2,'0')}. ${String(endSafe.getDate()).padStart(2,'0')}.(${days[endSafe.getDay()]})`;
                            const participants = Array.isArray(session.participants)
                              ? session.participants
                              : (Array.isArray(session.results) 
                                  ? session.results.filter((r: any) => r?.participated || r?.voted).map((r: any) => ({ id: r.userId || r.id, name: r.name }))
                                  : []);
                            const totalMembers = Array.isArray(userList) ? userList.length : 0;
                            const nonParticipants = Array.isArray(userList)
                              ? userList.filter(user => !participants.some((p: any) => (p?.id && p.id === user.id) || (p?.userId && p.userId === user.id) || (p?.name && p.name === user.name) || (p?.userName && p.userName === user.name)))
                              : [];
                            return (
                            <div style={{ background: "rgba(255, 255, 255, 0.2)", padding: "20px", borderRadius: "8px", marginTop: "20px" }}>
                              <div style={{ marginBottom: "15px", padding: "15px", background: "rgba(255, 255, 255, 0.1)", borderRadius: "8px" }}>
                                <div style={{ fontSize: "14px", marginBottom: "8px" }}>
                                  📅 투표 기간<br />
                                  {startStr} ~ {endStr}
                                </div>
                                <div style={{ fontSize: "14px", marginBottom: "5px" }}>
                                  👥 전체 회원: {totalMembers}명
                                </div>
                                <div style={{ fontSize: "14px", marginBottom: "5px" }}>
                                  ✅ 투표 참여: {participants.length}명
                                </div>
                                {/* 참여자 Pill */}
                                {participants.length > 0 && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                                    {participants.map((p: any, idx: number) => {
                                      const displayName = (p && (p.name || p.userName || p.username)) || String(p);
                                      return (
                                      <span key={idx} style={{
                                        display: 'inline-block',
                                        padding: '2px 6px',
                                        background: '#fff',
                                        color: '#333',
                                        borderRadius: '9999px',
                                        fontSize: '10px',
                                        fontWeight: 600,
                                        opacity: 0.9
                                      }}>{displayName}</span>
                                      );
                                    })}
                                  </div>
                                )}
                                <div style={{ fontSize: "14px", marginBottom: "5px" }}>
                                  ❌ 투표 미참여: {nonParticipants.length}명
                                </div>
                                {/* 미참여자 Pill */}
                                {nonParticipants.length > 0 && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                                    {nonParticipants.map((user: any, idx: number) => (
                                        <span key={idx} style={{
                                          display: 'inline-block',
                                          padding: '2px 6px',
                                          background: 'rgba(255,255,255,0.85)',
                                          color: '#333',
                                          borderRadius: '9999px',
                                          fontSize: '10px',
                                          fontWeight: 600
                                        }}>{user.name}</span>
                                      ))}
                                  </div>
                                )}
                                <div style={{ fontSize: "14px" }}>
                                  ⏰ 마감까지: {Math.max(0, Math.ceil((deadlineForCalculation.getTime() - new Date().getTime()) / (1000 * 60 * 60)))}시간
                                </div>
                              </div>
                            </div>
                            );
                          })()}
                        </div>
                
                <div style={{ textAlign: "center", marginBottom: "30px" }}>
                  <div style={{ display: "inline-block", background: "rgba(255, 255, 255, 0.2)", padding: "15px 25px", borderRadius: "25px" }}>
                    <span style={{ fontSize: "14px", opacity: "0.9" }}>발송 시간: {new Date().toLocaleString('ko-KR')}</span>
                  </div>
                </div>
                
                <div style={{ textAlign: "center", fontSize: "14px", opacity: "0.7" }}>
                  <p style={{ margin: "0" }}>이 이메일은 자동으로 발송되었습니다.</p>
                  <p style={{ margin: "5px 0 0 0" }}>FC CHAL GGYEO 관리 시스템</p>
                </div>
              </div>
            </Box>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" onClick={onVotePreviewClose}>닫기</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
