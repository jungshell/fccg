import { 
  Box, 
  Flex, 
  Text, 
  HStack, 
  VStack, 
  Button, 
  Avatar, 
  SimpleGrid, 
  Table, 
  Thead, 
  Tbody, 
  Tr, 
  Th, 
  Td, 
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  FormControl,
  FormLabel,
  Input,
  Select,
  useToast,
  Spinner,
  Badge,
  Alert,
  AlertIcon,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Divider,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Tooltip
} from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { API_ENDPOINTS } from '../constants';
import { 
  EditIcon, 
  DeleteIcon, 
  AddIcon, 
  ViewIcon,
  StarIcon,
  SettingsIcon,
  CalendarIcon,
  RepeatIcon
} from '@chakra-ui/icons';
import { 
  getAllMembers, 
  getGames, 
  createGame, 
  updateGame, 
  deleteGame,
  resetMemberPassword,
  getMemberStats,
  createWeeklySchedule,
  getAdminVoteSessionsSummary,
  getSavedVoteResults,
  aggregateAndSaveVoteResults,
  getUnifiedVoteData,
  type Game,
  type Member
} from '../api/auth';
import { useAuthStore } from '../store/auth';
import VoteResultsPage from './VoteResultsPage';

// Member 타입 확장
interface ExtendedMember extends Member {
  role?: UserRole;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'DELETED';
  createdAt?: string;
}

// 회원 등급 타입 정의
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

export default function AdminPage() {
  const [selectedMenu, setSelectedMenu] = useState('dashboard');
  const [userList, setUserList] = useState<ExtendedMember[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const user = useAuthStore((s) => s.user);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('MEMBER');

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
  
  // 모달 상태들
  const { isOpen: isGameModalOpen, onOpen: onGameModalOpen, onClose: onGameModalClose } = useDisclosure();
  const { isOpen: isRoleModalOpen, onOpen: onRoleModalOpen, onClose: onRoleModalClose } = useDisclosure();
  
  // 폼 상태들
  const [gameForm, setGameForm] = useState({
    date: '',
    time: '',
    location: '',
    gameType: 'SELF' as 'SELF' | 'MATCH',
    eventType: '매치' as '매치' | '회식' | '자체'
  });
  const [editingGameId, setEditingGameId] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<ExtendedMember | null>(null);
  const [newUserRole, setNewUserRole] = useState<UserRole>('MEMBER');

  // 투표결과 탭 상태
  const [voteSessionsSummary, setVoteSessionsSummary] = useState<any[]>([]);
  const [selectedVoteSessionId, setSelectedVoteSessionId] = useState<number | null>(null);
  const [selectedVoteResults, setSelectedVoteResults] = useState<any | null>(null);
  const [isAggregating, setIsAggregating] = useState(false);
  const [allVoteSessions, setAllVoteSessions] = useState<any[]>([]);
  const [sessionDetails, setSessionDetails] = useState<any>(null);

  // 회원 검색 및 필터링 상태
  const [memberSearch, setMemberSearch] = useState({
    name: '',
    email: '',
    role: '',
    status: ''
  });
    const [memberStats, setMemberStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    recentMembers: 0,
    activeRate: 0,
    averageAttendanceRate: 0
  });


  const [filteredUserList, setFilteredUserList] = useState<ExtendedMember[]>([]);

  // 데이터 로드
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('데이터 로드 시작...');
      
      const membersData = await getAllMembers();
      const gamesData = await getGames();
      const memberStatsData = await getMemberStats();
      
      console.log('API 응답:', { membersData, gamesData, memberStatsData });

      // 통합 투표 데이터 호출 (단일 소스)
      try {
        const unifiedVoteData = await getUnifiedVoteData();
        console.log('✅ 관리자 페이지 - 통합 투표 데이터 로드:', unifiedVoteData);
        
        // 전주 투표결과를 전역 변수에 저장 (호환성 유지)
        (window as any).lastWeekVote = unifiedVoteData.lastWeekResults;
        
        // 활성 세션 정보도 저장
        (window as any).activeVoteSession = unifiedVoteData.activeSession;
        
      } catch (e) {
        console.error('통합 투표 데이터 로드 실패', e);
        // 폴백: 기존 API 사용
        try {
          const token = localStorage.getItem('token') || localStorage.getItem('auth_token_backup') || '';
          const res = await fetch('/api/auth/votes/last-week/results', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const lastWeekVote = await res.json();
            (window as any).lastWeekVote = lastWeekVote;
          }
        } catch (fallbackError) {
          console.error('폴백 API도 실패:', fallbackError);
        }
      }

      // 관리자용 투표 세션 요약 로드
      try {
        const summary = await getAdminVoteSessionsSummary();
        setVoteSessionsSummary(summary.sessions || []);
      } catch (e) {
        console.error('투표 세션 요약 로드 실패', e);
      }
      
      setUserList(membersData.data);
      setGames(gamesData.games);
      calculateMemberStats(membersData.data);
      applyMemberFilters(membersData.data);
      
      console.log('상태 업데이트 완료:', { 
        userList: membersData.data?.length, 
        games: gamesData.games?.length,
        selectedMenu 
      });
      
      // 평균 참석률 업데이트
      if (memberStatsData.averageAttendanceRate !== undefined) {
        setMemberStats(prev => ({
          ...prev,
          averageAttendanceRate: memberStatsData.averageAttendanceRate
        }));
      }
    } catch (error) {
      console.error('데이터 로드 오류:', error);
      toast({
        title: '데이터 로드 실패',
        description: '데이터를 불러오지 못했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // 회원 통계 계산 및 필터링
  const calculateMemberStats = (members: ExtendedMember[]) => {
    const total = members.length;
    const active = members.filter(m => m.status === 'ACTIVE').length;
    const recent = members.filter(m => {
      const createdAt = new Date(m.createdAt || Date.now());
      const today = new Date();
      const thirtyDaysAgo = new Date(today.setDate(today.getDate() - 30));
      return createdAt >= thirtyDaysAgo;
    }).length;

    setMemberStats({
      totalMembers: total,
      activeMembers: active,
      recentMembers: recent,
      activeRate: total > 0 ? (active / total) * 100 : 0,
      averageAttendanceRate: 0 // 초기값, 백엔드에서 실제 데이터를 가져올 예정
    });
  };

  const applyMemberFilters = (members: ExtendedMember[]) => {
    let filtered = [...members];

    if (memberSearch.name) {
      filtered = filtered.filter(user => user.name.toLowerCase().includes(memberSearch.name.toLowerCase()));
    }
    if (memberSearch.email) {
      filtered = filtered.filter(user => user.email.toLowerCase().includes(memberSearch.email.toLowerCase()));
    }
    if (memberSearch.role) {
      filtered = filtered.filter(user => user.role === memberSearch.role);
    }
    if (memberSearch.status) {
      filtered = filtered.filter(user => user.status === memberSearch.status);
    }

    setFilteredUserList(filtered);
  };

  const handleMemberSearch = () => {
    applyMemberFilters(userList);
  };

  const handleMemberSearchReset = () => {
    setMemberSearch({ name: '', email: '', role: '', status: '' });
    applyMemberFilters(userList);
  };

  const handleMemberEdit = (user: ExtendedMember) => {
    setSelectedUser(user);
    setNewUserRole(user.role || 'MEMBER');
    onRoleModalOpen();
  };

  // 회원 정보 수정
  const handleMemberUpdate = async () => {
    if (!selectedUser) return;

    try {
      console.log('회원 정보 수정 요청:', {
        id: selectedUser.id,
        name: selectedUser.name,
        email: selectedUser.email,
        role: newUserRole,
        status: selectedUser.status
      });

      // 실제 API 호출
      const requestBody = {
        name: selectedUser.name,
        email: selectedUser.email,
        role: newUserRole,
        status: selectedUser.status
      };
      
      const apiUrl = `${API_ENDPOINTS.BASE_URL}/members/${selectedUser.id}`;
      console.log('API 요청 URL:', apiUrl);
      console.log('API 요청 헤더:', {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      });
      console.log('API 요청 본문:', requestBody);
      
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(requestBody)
      });

      console.log('API 응답 상태:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API 오류 응답:', errorText);
        throw new Error(`회원 정보 수정 실패: ${response.status}`);
      }

      const result = await response.json();
      console.log('API 성공 응답:', result);

      // 성공 시 데이터 다시 로드
      await loadData();
      
      // 강제로 상태 업데이트 - 더 확실한 방법
      setTimeout(async () => {
        try {
          const freshData = await getAllMembers();
          console.log('새로고침된 데이터:', freshData.data);
          setUserList(freshData.data);
          setFilteredUserList(freshData.data);
          calculateMemberStats(freshData.data);
          
          // 추가로 한 번 더 새로고침
          setTimeout(async () => {
            try {
              const finalData = await getAllMembers();
              console.log('최종 새로고침된 데이터:', finalData.data);
              setUserList(finalData.data);
              setFilteredUserList(finalData.data);
              calculateMemberStats(finalData.data);
            } catch (error) {
              console.error('최종 새로고침 오류:', error);
            }
          }, 200);
        } catch (error) {
          console.error('새로고침 오류:', error);
        }
      }, 100);
      
      toast({
        title: '회원 정보 수정 완료',
        description: `${selectedUser.name}의 정보가 수정되었습니다.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      onRoleModalClose();
      setSelectedUser(null);
    } catch (error) {
      console.error('회원 정보 수정 오류:', error);
      toast({
        title: '회원 정보 수정 실패',
        description: '회원 정보 수정 중 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleMemberDelete = async (user: ExtendedMember) => {
    if (!confirm('정말로 이 회원을 삭제하시겠습니까?')) return;

    try {
      // 실제 API 호출로 변경 필요
      setUserList(prev => prev.filter(u => u.id !== user.id));
      setFilteredUserList(prev => prev.filter(u => u.id !== user.id));
      
      toast({
        title: '회원 삭제 완료',
        description: `${user.name} 회원이 삭제되었습니다.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('회원 삭제 오류:', error);
      toast({
        title: '회원 삭제 실패',
        description: '회원 삭제 중 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handlePasswordReset = async () => {
    if (!selectedUser) return;
    
    if (window.confirm(`${selectedUser.name}의 비밀번호를 초기화하시겠습니까?\n초기화된 비밀번호: password123`)) {
      try {
        await resetMemberPassword(selectedUser.id);
        toast({
          title: '비밀번호 초기화 완료',
          description: `${selectedUser.name}의 비밀번호가 초기화되었습니다.\n새 비밀번호: password123\n회원은 로그인 후 개인 설정에서 비밀번호를 변경할 수 있습니다.`,
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
      } catch (error) {
        console.error('비밀번호 초기화 오류:', error);
        toast({
          title: '비밀번호 초기화 실패',
          description: '비밀번호 초기화 중 오류가 발생했습니다.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    }
  };

  // 권한 체크 함수
  const hasPermission = (permission: string) => {
    const userPermissions = rolePermissions[currentUserRole].permissions;
    return userPermissions.includes('all') || userPermissions.includes(permission);
  };

  // 경기 등록/수정
  const handleGameSubmit = async () => {
    if (!gameForm.date || !gameForm.time || !gameForm.location) {
      toast({
        title: '입력 오류',
        description: '모든 필드를 입력해주세요.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      const dateTime = `${gameForm.date}T${gameForm.time}`;
      
      if (editingGameId) {
        await updateGame(editingGameId, dateTime, gameForm.location, gameForm.gameType);
        toast({
          title: '경기 수정 완료',
          description: '경기가 성공적으로 수정되었습니다.',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        await createGame(dateTime, gameForm.location, gameForm.gameType);
        toast({
          title: '경기 등록 완료',
          description: '경기가 성공적으로 등록되었습니다.',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      }
      
      onGameModalClose();
      resetGameForm();
      loadData();
    } catch (error) {
      console.error('경기 등록/수정 오류:', error);
      toast({
        title: '경기 등록/수정 실패',
        description: '경기 등록/수정 중 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // 경기 삭제
  const handleGameDelete = async (gameId: number) => {
    if (!confirm('정말로 이 경기를 삭제하시겠습니까?')) return;

    try {
      await deleteGame(gameId);
      toast({
        title: '경기 삭제 완료',
        description: '경기가 성공적으로 삭제되었습니다.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      loadData();
    } catch (error) {
      console.error('경기 삭제 오류:', error);
      toast({
        title: '경기 삭제 실패',
        description: '경기 삭제 중 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };



  // 경기 수정 모달 열기
  const handleGameEdit = (game: Game) => {
    const gameDate = new Date(game.date);
    setGameForm({
      date: gameDate.toISOString().slice(0, 10),
      time: gameDate.toTimeString().slice(0, 5),
      location: game.location,
      gameType: game.gameType,
      eventType: game.eventType || '매치'
    });
    setEditingGameId(game.id);
    onGameModalOpen();
  };

  // 경기 등록 모달 열기
  const handleGameAdd = () => {
    resetGameForm();
    setEditingGameId(null);
    onGameModalOpen();
  };



  // 경기 폼 초기화
  const resetGameForm = () => {
    setGameForm({
      date: '',
      time: '',
      location: '',
      gameType: 'SELF',
      eventType: '매치'
    });
    setEditingGameId(null);
  };

  // 이번주 일정 생성 함수
  const handleCreateWeeklySchedule = async () => {
    try {
      setLoading(true);
      await createWeeklySchedule();
      toast({
        title: '이번주 일정 생성 완료',
        description: '전주 투표 결과에 따라 이번주 일정이 생성되었습니다.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      // 데이터 새로고침
      loadData();
    } catch (error) {
      console.error('이번주 일정 생성 오류:', error);
      toast({
        title: '이번주 일정 생성 실패',
        description: '일정 생성 중 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Flex w="full" minH="100vh" bg="#f7f9fb" maxW="100vw" px={{ base: 2, md: 8, lg: 24 }} pt="18mm" justify="center" align="center">
        <Spinner size="xl" color="blue.500" />
      </Flex>
    );
  }

  return (
    <Box minH="100vh" bg="#f7f9fb" w="100vw" minW="100vw">
      <Flex h="100vh">
      {/* 사이드 메뉴 */}
        <Box w={{ base: '60px', md: '220px' }} bg="white" boxShadow="md" p={4} flexShrink={0}>
        <VStack align="stretch" spacing={6}>
          <HStack spacing={3} mb={8}>
            <Avatar size="sm" name="FC CG" bg="#004ea8" color="white" />
            <Text fontWeight="bold" fontSize="lg" color="#004ea8" display={{ base: 'none', md: 'block' }}>FC CG</Text>
          </HStack>
            
            <Tooltip 
              label="전체 통계 및 요약 정보 확인" 
              placement="right" 
              hasArrow
              bg="gray.700"
              color="white"
              fontSize="sm"
            >
              <Button 
                variant={selectedMenu==='dashboard'?'solid':'ghost'} 
                colorScheme="blue" 
                onClick={()=>setSelectedMenu('dashboard')}
                leftIcon={<ViewIcon />}
              >
                <Text display={{ base: 'none', md: 'block' }}>대시보드</Text>
              </Button>
            </Tooltip>
            
            {hasPermission('member_management') && (
              <Tooltip 
                label="회원 정보 조회, 수정, 삭제 및 권한 관리" 
                placement="right" 
                hasArrow
                bg="gray.700"
                color="white"
                fontSize="sm"
              >
                <Button 
                  variant={selectedMenu==='users'?'solid':'ghost'} 
                  colorScheme="blue" 
                  onClick={()=>setSelectedMenu('users')}
                  leftIcon={<ViewIcon />}
                >
                  <Text display={{ base: 'none', md: 'block' }}>회원 관리</Text>
                </Button>
              </Tooltip>
            )}
            
            {hasPermission('game_management') && (
              <Tooltip 
                label="경기 일정 생성, 수정, 삭제 및 관리" 
                placement="right" 
                hasArrow
                bg="gray.700"
                color="white"
                fontSize="sm"
              >
                <Button 
                  variant={selectedMenu==='games'?'solid':'ghost'} 
                  colorScheme="blue" 
                  onClick={()=>setSelectedMenu('games')}
                  leftIcon={<CalendarIcon />}
                >
                  <Text display={{ base: 'none', md: 'block' }}>경기 관리</Text>
                </Button>
              </Tooltip>
            )}
            
            {hasPermission('game_management') && (
              <Tooltip 
                label="이번주 경기 일정 및 투표 결과 관리" 
                placement="right" 
                hasArrow
                bg="gray.700"
                color="white"
                fontSize="sm"
              >
                <Button 
                  variant={selectedMenu==='this-week-schedules'?'solid':'ghost'} 
                  colorScheme="blue" 
                  onClick={()=>setSelectedMenu('this-week-schedules')}
                  leftIcon={<CalendarIcon />}
                >
                  <Text display={{ base: 'none', md: 'block' }}>이번주 일정</Text>
                </Button>
              </Tooltip>
            )}
            
            {hasPermission('content_management') && (
              <Tooltip 
                label="갤러리, 공지사항 등 콘텐츠 관리" 
                placement="right" 
                hasArrow
                bg="gray.700"
                color="white"
                fontSize="sm"
              >
                <Button 
                  variant={selectedMenu==='contents'?'solid':'ghost'} 
                  colorScheme="blue" 
                  onClick={()=>setSelectedMenu('contents')}
                  leftIcon={<ViewIcon />}
                >
                  <Text display={{ base: 'none', md: 'block' }}>콘텐츠 관리</Text>
                </Button>
              </Tooltip>
            )}
            
            {hasPermission('homepage_management') && (
              <Tooltip 
                label="홈페이지 설정 및 시스템 관리" 
                placement="right" 
                hasArrow
                bg="gray.700"
                color="white"
                fontSize="sm"
              >
                <Button 
                  variant={selectedMenu==='settings'?'solid':'ghost'} 
                  colorScheme="blue" 
                  onClick={()=>setSelectedMenu('settings')}
                  leftIcon={<SettingsIcon />}
                >
                  <Text display={{ base: 'none', md: 'block' }}>홈페이지 관리</Text>
                </Button>
              </Tooltip>
            )}
            {/* 투표결과 탭 버튼 - 무조건 표시 */}
            <Box mb={2} p={2} bg="red.100" borderRadius="md" border="2px solid red" w="full">
              <Button 
                variant={selectedMenu==='vote-results'?'solid':'ghost'} 
                colorScheme="red" 
                onClick={()=>setSelectedMenu('vote-results')} 
                leftIcon={<ViewIcon />}
                w="full"
                justifyContent="flex-start"
                size="lg"
                fontWeight="bold"
                bg={selectedMenu==='vote-results'?'red.500':'transparent'}
                color={selectedMenu==='vote-results'?'white':'red.600'}
                _hover={{ bg: 'red.200' }}
                minH="50px"
              >
                투표결과
              </Button>
            </Box>
          </VStack>
      </Box>

      {/* 메인 컨텐츠 */}
          <Box flex={1} p={{ base: 4, md: 8 }} pt={{ base: 16, md: 24 }} overflowY="auto">

        {/* 대시보드 - 라이트모드 복원됨 */}
        {selectedMenu==='dashboard' && (
            <VStack spacing={6} align="stretch">
              {/* 통계 카드 - 라이트모드 */}
              <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
                <Card bg="gradient(to-r, blue.500, blue.600)" color="white" shadow="lg">
                  <CardBody p={6}>
                    <Stat>
                      <StatLabel color="blue.100" fontSize="lg" fontWeight="semibold">총 회원수</StatLabel>
                      <StatNumber color="white" fontWeight="bold" fontSize="3xl" textShadow="2px 2px 4px rgba(0,0,0,0.3)">{userList.length}명</StatNumber>
                      <StatHelpText color="blue.200" fontSize="md" fontWeight="medium">
                        <StatArrow type="increase" />
                        23.36%
                      </StatHelpText>
                    </Stat>
                  </CardBody>
                </Card>
                
                <Card bg="gradient(to-r, green.500, green.600)" color="white" shadow="lg">
                  <CardBody p={6}>
                    <Stat>
                      <StatLabel color="green.100" fontSize="lg" fontWeight="semibold">총 경기수</StatLabel>
                      <StatNumber color="white" fontWeight="bold" fontSize="3xl" textShadow="2px 2px 4px rgba(0,0,0,0.3)">{games.length}경기</StatNumber>
                      <StatHelpText color="green.200" fontSize="md" fontWeight="medium">
                        <StatArrow type="increase" />
                        12.5%
                      </StatHelpText>
                    </Stat>
                  </CardBody>
                </Card>
                
                <Card bg="gradient(to-r, purple.500, purple.600)" color="white" shadow="lg">
                  <CardBody p={6}>
                    <Stat>
                      <StatLabel color="purple.100" fontSize="lg" fontWeight="semibold">이번달 참석률</StatLabel>
                      <StatNumber color="white" fontWeight="bold" fontSize="3xl" textShadow="2px 2px 4px rgba(0,0,0,0.3)">{memberStats.averageAttendanceRate.toFixed(1)}%</StatNumber>
                      <StatHelpText color="purple.200" fontSize="md" fontWeight="medium">
                        <StatArrow type="increase" />
                        2.1%
                      </StatHelpText>
                    </Stat>
                  </CardBody>
                </Card>
          </SimpleGrid>

              {/* 권한별 기능 안내 */}
              <Card>
                <CardHeader>
                  <Heading size="md">권한별 기능 안내</Heading>
                </CardHeader>
                <CardBody>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                    <VStack align="stretch" spacing={4}>
                      <HStack>
                        <StarIcon color="red.500" />
                        <Text fontWeight="bold">슈퍼관리자</Text>
                      </HStack>
                      <Text fontSize="sm" color="gray.600">
                        모든 기능에 대한 완전한 접근 권한을 가집니다.
                      </Text>
                    </VStack>
                    
                    <VStack align="stretch" spacing={4}>
                      <HStack>
                        <StarIcon color="blue.500" />
                        <Text fontWeight="bold">관리자</Text>
                      </HStack>
                      <Text fontSize="sm" color="gray.600">
                        회원 관리, 경기 관리, 콘텐츠 관리, 홈페이지 관리 권한을 가집니다.
                      </Text>
                    </VStack>
                    
                    <VStack align="stretch" spacing={4}>
                      <HStack>
                        <StarIcon color="gray.500" />
                        <Text fontWeight="bold">일반 회원</Text>
                      </HStack>
                      <Text fontSize="sm" color="gray.600">
                        투표, 일정 조회, 사진 업로드, 댓글 작성 권한을 가집니다.
                      </Text>
                    </VStack>
                  </SimpleGrid>
                </CardBody>
              </Card>

              {/* 최근 활동 */}
              <Card>
                <CardHeader>
                  <Heading size="md">최근 활동</Heading>
                </CardHeader>
                <CardBody>
                  <VStack spacing={4} align="stretch">
                    <HStack justify="space-between">
                      <Text fontSize="sm">새로운 회원 가입</Text>
                      <Badge colorScheme="green">+{memberStats.recentMembers || 0}</Badge>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontSize="sm">이번주 경기</Text>
                      <Badge colorScheme="blue">{games.filter(g => {
                        const gameDate = new Date(g.date);
                        const now = new Date();
                        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
                        const weekEnd = new Date(weekStart);
                        weekEnd.setDate(weekStart.getDate() + 6);
                        return gameDate >= weekStart && gameDate <= weekEnd;
                      }).length}경기</Badge>
                    </HStack>
                    <HStack justify="space-between">
                      <Text fontSize="sm">시스템 상태</Text>
                      <Badge colorScheme="green">정상</Badge>
                    </HStack>
                  </VStack>
                </CardBody>
              </Card>
                <Card>
                <CardBody>
                  <Tabs>
                    <TabList>
                      <Tab>회원</Tab>
                      <Tab>관리자</Tab>
                      <Tab>슈퍼관리자</Tab>
                    </TabList>
                    <TabPanels>
                      <TabPanel>
                        <VStack align="stretch" spacing={3}>
                          <HStack><StarIcon color="green.500" /><Text>투표 참여</Text></HStack>
                          <HStack><StarIcon color="green.500" /><Text>일정 확인</Text></HStack>
                          <HStack><StarIcon color="green.500" /><Text>사진 업로드</Text></HStack>
                          <HStack><StarIcon color="green.500" /><Text>댓글 작성</Text></HStack>
                        </VStack>
                      </TabPanel>
                      <TabPanel>
                        <VStack align="stretch" spacing={3}>
                          <HStack><StarIcon color="green.500" /><Text>회원의 모든 권한</Text></HStack>
                          <HStack><StarIcon color="green.500" /><Text>회원 관리</Text></HStack>
                          <HStack><StarIcon color="green.500" /><Text>경기 관리</Text></HStack>
                          <HStack><StarIcon color="green.500" /><Text>콘텐츠 관리</Text></HStack>
                          <HStack><StarIcon color="green.500" /><Text>홈페이지 관리</Text></HStack>
                        </VStack>
                      </TabPanel>
                      <TabPanel>
                        <VStack align="stretch" spacing={3}>
                          <HStack><StarIcon color="green.500" /><Text>관리자의 모든 권한</Text></HStack>
                          <HStack><StarIcon color="red.500" /><Text>관리자 선정</Text></HStack>
                          <HStack><StarIcon color="red.500" /><Text>시스템 설정</Text></HStack>
                          <HStack><StarIcon color="red.500" /><Text>최고 권한</Text></HStack>
                        </VStack>
                      </TabPanel>
                    </TabPanels>
                  </Tabs>
                </CardBody>
              </Card>
            </VStack>
        )}

        {/* 투표결과 탭 - 새로운 페이지 */}
        {selectedMenu==='vote-results' && (
          <Box>
            <Heading size="xl" mb={4} color="purple.600">투표결과 관리</Heading>
            <VoteResultsPage />
          </Box>
        )}

        {/* 기존 투표결과 탭 (백업용) */}
        {selectedMenu==='vote-results-old' && (
          <Card>
            <CardHeader>
              <HStack justify="space-between">
                <Heading size="md">투표결과</Heading>
                <HStack>
                  <Button 
                    size="sm" 
                    colorScheme="green" 
                    isLoading={isAggregating}
                    onClick={async ()=>{
                      try {
                        setIsAggregating(true);
                        await aggregateAndSaveVoteResults('last');
                        toast({ title: '집계 저장 완료', status: 'success', duration: 2000, isClosable: true });
                        const summary = await getAdminVoteSessionsSummary();
                        setVoteSessionsSummary(summary.sessions || []);
                        if (selectedVoteSessionId) {
                          const saved = await getSavedVoteResults(selectedVoteSessionId);
                          setSelectedVoteResults(saved);
                        }
                      } catch (e) {
                        console.error(e);
                        toast({ title: '집계 저장 실패', status: 'error', duration: 2500, isClosable: true });
                      } finally {
                        setIsAggregating(false);
                      }
                    }}
                  >
                    전주 집계 저장
                  </Button>
                </HStack>
              </HStack>
            </CardHeader>
            <CardBody>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                <Box>
                  <Heading size="sm" mb={3}>세션 목록</Heading>
                  <Table size="sm" variant="simple">
                    <Thead>
                      <Tr>
                        <Th>주차(월요일)</Th>
                        <Th>상태</Th>
                        <Th isNumeric>참여수</Th>
                        <Th>보기</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {voteSessionsSummary.map((s: any)=> (
                        <Tr key={s.id} {...(selectedVoteSessionId===s.id ? { bg: 'gray.50' } : {})}>
                          <Td>{new Date(s.weekStartDate).toLocaleDateString('ko-KR')}</Td>
                          <Td>
                            <Badge colorScheme={s.isCompleted? 'green': s.isActive? 'blue': 'gray'}>
                              {s.isCompleted? '완료': s.isActive? '진행중': '종료'}
                            </Badge>
                          </Td>
                          <Td isNumeric>{s.totalVotes ?? '-'}</Td>
                          <Td>
                            <Button size="xs" onClick={async ()=>{
                              setSelectedVoteSessionId(s.id);
                              try {
                                const data = await getSavedVoteResults(s.id);
                                setSelectedVoteResults(data);
                              } catch (e) {
                                console.error('세션 결과 조회 실패', e);
                                setSelectedVoteResults(null);
                                toast({ title: '세션 결과 조회 실패', status: 'error', duration: 2000, isClosable: true });
                              }
                            }}>상세</Button>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
                <Box>
                  <Heading size="sm" mb={3}>세션 상세</Heading>
                  {!selectedVoteResults ? (
                    <Text color="gray.500">좌측에서 세션을 선택하세요.</Text>
                  ) : (
                    <VStack align="stretch" spacing={3}>
                      <HStack><Badge>세션 ID</Badge><Text>{selectedVoteSessionId}</Text></HStack>
                      <Divider />
                      {(() => {
                        const results = selectedVoteResults.results || selectedVoteResults.voteResults || {};
                        const participants = selectedVoteResults.participants || {};
                        const days = ['MON','TUE','WED','THU','FRI'];
                        const dayLabel: any = { MON:'월', TUE:'화', WED:'수', THU:'목', FRI:'금' };
                        return (
                          <VStack align="stretch" spacing={2}>
                            {days.map(d => (
                              <HStack key={d} justify="space-between">
                                <Text>{dayLabel[d]}요일</Text>
                                <HStack>
                                  <Badge colorScheme="blue">득표 {results[d] || 0}표</Badge>
                                  <Tooltip label={(participants[d]||[]).join(', ') || '참여자 없음'}>
                                    <Badge>참여자 {(participants[d]||[]).length}명</Badge>
                                  </Tooltip>
                                </HStack>
                              </HStack>
                            ))}
                          </VStack>
                        );
                      })()}
                    </VStack>
                  )}
                </Box>
              </SimpleGrid>
            </CardBody>
          </Card>
        )}

        {/* 회원 관리 */}
          {selectedMenu==='users' && hasPermission('member_management') && (
            <VStack spacing={6} align="stretch">
              {/* 검색 및 필터 */}
              <Card>
                <CardHeader>
                  <Heading size="md">회원 검색</Heading>
                </CardHeader>
                <CardBody>
                  <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
                    <FormControl>
                      <FormLabel>이름</FormLabel>
                      <Input 
                        placeholder="이름으로 검색" 
                        value={memberSearch.name || ''}
                        onChange={(e) => setMemberSearch(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>이메일</FormLabel>
                      <Input 
                        placeholder="이메일로 검색" 
                        value={memberSearch.email || ''}
                        onChange={(e) => setMemberSearch(prev => ({ ...prev, email: e.target.value }))}
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>권한</FormLabel>
                      <Select 
                        value={memberSearch.role || ''}
                        onChange={(e) => setMemberSearch(prev => ({ ...prev, role: e.target.value }))}
                      >
                        <option value="">전체</option>
                        <option value="MEMBER">회원</option>
                        <option value="ADMIN">관리자</option>
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel>상태</FormLabel>
                      <Select 
                        value={memberSearch.status || ''}
                        onChange={(e) => setMemberSearch(prev => ({ ...prev, status: e.target.value }))}
                      >
                        <option value="">전체</option>
                        <option value="ACTIVE">활성</option>
                        <option value="INACTIVE">비활성</option>
                        <option value="SUSPENDED">정지</option>
                      </Select>
                    </FormControl>
                  </SimpleGrid>
                  <HStack mt={4} justify="space-between">
                    <Button colorScheme="blue" onClick={handleMemberSearch}>
                      검색
                    </Button>
                    <Button variant="ghost" onClick={handleMemberSearchReset}>
                      초기화
                    </Button>
                  </HStack>
                </CardBody>
              </Card>

              {/* 회원 통계 */}
              <Card>
                <CardHeader>
                  <Heading size="md">회원 통계</Heading>
                </CardHeader>
                <CardBody>
                  <SimpleGrid columns={{ base: 2, md: 4 }} spacing={6}>
                    <Stat>
                      <StatLabel>총 회원수</StatLabel>
                      <StatNumber>{memberStats.totalMembers || 0}</StatNumber>
                      <StatHelpText>
                        <StatArrow type="increase" />
                        12.5%
                      </StatHelpText>
                    </Stat>
                    <Stat>
                      <StatLabel>활성 회원</StatLabel>
                      <StatNumber>{memberStats.activeMembers || 0}</StatNumber>
                      <StatHelpText>
                        활성률: {memberStats.activeRate?.toFixed(1) || 0}%
                      </StatHelpText>
                    </Stat>
                    <Stat>
                      <StatLabel>최근 가입자</StatLabel>
                      <StatNumber>{memberStats.recentMembers || 0}</StatNumber>
                      <StatHelpText>
                        최근 30일
                      </StatHelpText>
                    </Stat>
                    <Stat>
                      <StatLabel>평균 참석률</StatLabel>
                      <StatNumber>{memberStats.averageAttendanceRate.toFixed(1)}%</StatNumber>
                      <StatHelpText>
                        <StatArrow type="increase" />
                        5.2%
                      </StatHelpText>
                    </Stat>
                  </SimpleGrid>
                </CardBody>
              </Card>

              {/* 회원 목록 - 라이트모드 복원됨 */}
              <Card>
                <CardHeader>
                  <HStack justify="space-between">
                    <Heading size="md" color="blue.600">회원 목록 (라이트모드)</Heading>
                    <Text fontSize="sm" color="blue.500">
                      총 {filteredUserList.length}명
                    </Text>
                  </HStack>
                </CardHeader>
                <CardBody>
            <Table variant="simple">
              <Thead>
                <Tr bg="blue.600">
                  <Th color="white">이름</Th>
                  <Th color="white">이메일</Th>
                  <Th color="white">권한</Th>
                  <Th color="white">상태</Th>
                  <Th color="white">가입일</Th>
                  <Th color="white">관리</Th>
                </Tr>
              </Thead>
              <Tbody>
                      {filteredUserList.map((user, index) => (
                  <Tr key={user.id} bg={index % 2 === 0 ? "white" : "gray.50"}>
                          <Td color="gray.800">{user.name}</Td>
                          <Td color="gray.800">{user.email}</Td>
                          <Td>
                            <Badge colorScheme={rolePermissions[user.role || 'MEMBER'].color}>
                              {rolePermissions[user.role || 'MEMBER'].name}
                            </Badge>
                          </Td>
                          <Td>
                            <Badge 
                              colorScheme={
                                user.status === 'ACTIVE' ? 'green' : 
                                user.status === 'INACTIVE' ? 'yellow' : 
                                user.status === 'SUSPENDED' ? 'red' : 'gray'
                              }
                            >
                              {user.status === 'ACTIVE' ? '활성' : 
                               user.status === 'INACTIVE' ? '비활성' : 
                               user.status === 'SUSPENDED' ? '정지' : '삭제'}
                            </Badge>
                          </Td>
                          <Td color="gray.800">{new Date(user.createdAt || Date.now()).toLocaleDateString()}</Td>
                          <Td>
                            <HStack spacing={2}>
                              <Tooltip 
                                label="회원 정보 수정" 
                                placement="top" 
                                hasArrow
                                bg="blue.600"
                                color="white"
                                fontSize="sm"
                              >
                                <IconButton 
                                  size="sm" 
                                  icon={<EditIcon />} 
                                  aria-label="수정" 
                                  onClick={() => handleMemberEdit(user)}
                                />
                              </Tooltip>
                              <Tooltip 
                                label="회원 삭제" 
                                placement="top" 
                                hasArrow
                                bg="red.600"
                                color="white"
                                fontSize="sm"
                              >
                                <IconButton 
                                  size="sm" 
                                  icon={<DeleteIcon />} 
                                  aria-label="삭제" 
                                  colorScheme="red"
                                  onClick={() => handleMemberDelete(user)}
                                />
                              </Tooltip>
                            </HStack>
                          </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
                </CardBody>
              </Card>
            </VStack>
        )}

        {/* 경기 관리 */}
          {selectedMenu==='games' && (
            <Card>
              <CardHeader>
                <HStack justify="space-between">
                  <Heading size="md">경기 관리</Heading>
                  <Text fontSize="sm" color="gray.500">
                    디버그: selectedMenu={selectedMenu}, games={games.length}, hasPermission={hasPermission('game_management').toString()}
                  </Text>
                  <HStack spacing={2}>
                    {hasPermission('game_management') && (
                      <>
                        <Button 
                          leftIcon={<RepeatIcon />} 
                          colorScheme="green" 
                          onClick={handleCreateWeeklySchedule}
                          isLoading={loading}
                        >
                          이번주 일정 생성
                        </Button>
                        <Button leftIcon={<AddIcon />} colorScheme="blue" onClick={handleGameAdd}>
                          경기 등록
                        </Button>
                      </>
                    )}
                  </HStack>
                </HStack>
              </CardHeader>
              <CardBody>
                {/* 전주 투표결과 패널 */}
                <Box mb={6} p={4} bg="gray.50" borderRadius="md" border="1px" borderColor="gray.200">
                  <Heading size="sm" mb={3}>전주 투표결과</Heading>
                  {(() => {
                    const data = (window as any).lastWeekVote;
                    if (!data || !data.results) {
                      return <Text color="gray.500">데이터 없음</Text>;
                    }
                    const days = ['MON','TUE','WED','THU','FRI'];
                    const dayLabel: any = { MON:'월', TUE:'화', WED:'수', THU:'목', FRI:'금' };
                    return (
                      <VStack align="stretch" spacing={2}>
                        {days.map(d => (
                          <HStack key={d} justify="space-between">
                            <Text fontSize="sm">{dayLabel[d]}요일</Text>
                            <HStack spacing={3}>
                              <Badge colorScheme="blue">득표 {data.results[d] || 0}표</Badge>
                              <Tooltip label={(data.participants[d]||[]).join(', ') || '참여자 없음'}>
                                <Badge colorScheme="gray">참여자 {(data.participants[d]||[]).length}명</Badge>
                              </Tooltip>
                            </HStack>
                          </HStack>
                        ))}
                      </VStack>
                    );
                  })()}
                </Box>
                {loading ? (
                  <Box textAlign="center" py={8}>
                    <Spinner size="lg" />
                    <Text mt={4}>경기 데이터를 불러오는 중...</Text>
                  </Box>
                ) : games.length === 0 ? (
                  <Box textAlign="center" py={8}>
                    <Text color="gray.500">등록된 경기가 없습니다.</Text>
                    {hasPermission('game_management') && (
                      <Button 
                        mt={4} 
                        colorScheme="blue" 
                        onClick={handleGameAdd}
                      >
                        첫 경기 등록하기
                      </Button>
                    )}
                  </Box>
                ) : (
                  <Table variant="simple">
                    <Thead>
                      <Tr>
                        <Th>날짜</Th>
                        <Th>시간</Th>
                        <Th>장소</Th>
                        <Th>경기 유형</Th>
                        <Th>이벤트 유형</Th>
                        {hasPermission('game_management') && <Th>관리</Th>}
                      </Tr>
                    </Thead>
                    <Tbody>
                      {games.map(game => {
                        const gameDate = new Date(game.date);
                        return (
                          <Tr key={game.id}>
                            <Td>{gameDate.toLocaleDateString('ko-KR')}</Td>
                            <Td>{gameDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</Td>
                            <Td>{game.location}</Td>
                            <Td>
                              <Badge colorScheme={game.gameType === 'SELF' ? 'blue' : 'green'}>
                                {game.gameType === 'SELF' ? '자체' : '매치'}
                              </Badge>
                            </Td>
                            <Td>
                              <Badge 
                                colorScheme={
                                  game.eventType === '매치' ? 'green' : 
                                  game.eventType === '회식' ? 'red' : 
                                  game.eventType === '자체' ? 'blue' : 'gray'
                                }
                              >
                                {game.eventType || '매치'}
                              </Badge>
                            </Td>
                            {hasPermission('game_management') && (
                              <Td>
                                <HStack spacing={2}>
                                  <Tooltip 
                                    label="경기 정보 수정" 
                                    placement="top" 
                                    hasArrow
                                    bg="gray.700"
                                    color="white"
                                    fontSize="sm"
                                  >
                                    <IconButton 
                                      size="sm" 
                                      icon={<EditIcon />} 
                                      aria-label="수정" 
                                      onClick={() => handleGameEdit(game)}
                                    />
                                  </Tooltip>
                                  <Tooltip 
                                    label="경기 삭제" 
                                    placement="top" 
                                    hasArrow
                                    bg="red.600"
                                    color="white"
                                    fontSize="sm"
                                  >
                                    <IconButton 
                                      size="sm" 
                                      icon={<DeleteIcon />} 
                                      aria-label="삭제" 
                                      colorScheme="red"
                                      onClick={() => handleGameDelete(game.id)}
                                    />
                                  </Tooltip>
                                </HStack>
                              </Td>
                            )}
                          </Tr>
                        );
                      })}
                    </Tbody>
                  </Table>
                )}
              </CardBody>
            </Card>
          )}

          {/* 콘텐츠 관리 */}
          {selectedMenu==='contents' && hasPermission('content_management') && (
            <Card>
              <CardHeader>
                <Heading size="md">콘텐츠 관리</Heading>
              </CardHeader>
              <CardBody>
                <Tabs>
                  <TabList>
                    <Tab>갤러리</Tab>
                    <Tab>게시물</Tab>
                    <Tab>댓글</Tab>
                  </TabList>
                  <TabPanels>
                    <TabPanel>
                      <Text>갤러리 관리 기능이 여기에 표시됩니다.</Text>
                    </TabPanel>
                    <TabPanel>
                      <Text>게시물 관리 기능이 여기에 표시됩니다.</Text>
                    </TabPanel>
                    <TabPanel>
                      <Text>댓글 관리 기능이 여기에 표시됩니다.</Text>
                    </TabPanel>
                  </TabPanels>
                </Tabs>
              </CardBody>
            </Card>
          )}

          {/* 홈페이지 관리 */}
          {selectedMenu==='settings' && hasPermission('homepage_management') && (
            <Card>
              <CardHeader>
                <Heading size="md">홈페이지 관리</Heading>
              </CardHeader>
              <CardBody>
                <VStack spacing={6} align="stretch">
                  <FormControl>
                    <FormLabel>사이트 제목</FormLabel>
                    <Input placeholder="FC CG" />
                  </FormControl>
                  <FormControl>
                    <FormLabel>사이트 설명</FormLabel>
                    <Input placeholder="FC CG 공식 웹사이트" />
                  </FormControl>
                  <FormControl>
                    <FormLabel>투표 마감시간</FormLabel>
                    <Input type="time" defaultValue="14:00" />
                  </FormControl>
                  <FormControl>
                    <FormLabel>알림 설정</FormLabel>
                    <Select>
                      <option value="email">이메일</option>
                      <option value="sms">SMS</option>
                      <option value="both">모두</option>
                    </Select>
                  </FormControl>
                </VStack>
              </CardBody>
            </Card>
        )}
      </Box>
      </Flex>

      {/* 경기 등록/수정 모달 */}
      <Modal isOpen={isGameModalOpen} onClose={onGameModalClose} isCentered size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{editingGameId ? '경기 수정' : '경기 등록'}</ModalHeader>
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>날짜</FormLabel>
                <Input
                  type="date"
                  value={gameForm.date}
                  onChange={e => setGameForm(prev => ({ ...prev, date: e.target.value }))}
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>시간</FormLabel>
                <Input
                  type="time"
                  value={gameForm.time}
                  onChange={e => setGameForm(prev => ({ ...prev, time: e.target.value }))}
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>장소</FormLabel>
                <Input
                  value={gameForm.location}
                  onChange={e => setGameForm(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="경기 장소를 입력하세요"
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>경기 유형</FormLabel>
                <Select
                  value={gameForm.gameType}
                  onChange={e => setGameForm(prev => ({ ...prev, gameType: e.target.value as 'SELF' | 'MATCH' }))}
                >
                  <option value="SELF">자체 경기</option>
                  <option value="MATCH">매치 경기</option>
                </Select>
              </FormControl>
              <FormControl isRequired>
                <FormLabel>이벤트 유형</FormLabel>
                <Select
                  value={gameForm.eventType}
                  onChange={e => setGameForm(prev => ({ ...prev, eventType: e.target.value as '매치' | '회식' | '자체' }))}
                >
                  <option value="매치">매치</option>
                  <option value="회식">회식</option>
                  <option value="자체">자체</option>
                </Select>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onGameModalClose}>
              취소
            </Button>
            <Button colorScheme="blue" onClick={handleGameSubmit}>
              {editingGameId ? '수정' : '등록'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 회원 정보 수정 모달 */}
      <Modal isOpen={isRoleModalOpen} onClose={onRoleModalClose} isCentered size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>회원 정보 수정 - {selectedUser?.name}</ModalHeader>
          <ModalBody>
            <VStack spacing={3}>
              {/* 기본 정보 섹션 */}
              <HStack spacing={4} w="full">
                <FormControl flex={1}>
                  <FormLabel fontSize="sm">이름</FormLabel>
                  <Input
                    size="sm"
                    value={selectedUser?.name || ''}
                    onChange={e => setSelectedUser(prev => prev ? { ...prev, name: e.target.value } : null)}
                  />
                </FormControl>
                <FormControl flex={1}>
                  <FormLabel fontSize="sm">이메일</FormLabel>
                  <Input
                    size="sm"
                    value={selectedUser?.email || ''}
                    onChange={e => setSelectedUser(prev => prev ? { ...prev, email: e.target.value } : null)}
                  />
                </FormControl>
              </HStack>
              
              {/* 권한 및 상태 섹션 */}
              <HStack spacing={4} w="full">
                <FormControl flex={1}>
                  <FormLabel fontSize="sm">권한</FormLabel>
                  <Select
                    size="sm"
                    value={newUserRole}
                    onChange={e => setNewUserRole(e.target.value as UserRole)}
                  >
                    <option value="MEMBER">회원</option>
                    <option value="ADMIN">관리자</option>
                    {currentUserRole === 'SUPER_ADMIN' && (
                      <option value="SUPER_ADMIN">슈퍼관리자</option>
                    )}
                  </Select>
                </FormControl>
                <FormControl flex={1}>
                  <FormLabel fontSize="sm">상태</FormLabel>
                  <Select
                    size="sm"
                    value={selectedUser?.status || 'ACTIVE'}
                    onChange={e => setSelectedUser(prev => prev ? { ...prev, status: e.target.value as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'DELETED' } : null)}
                  >
                    <option value="ACTIVE">활성</option>
                    <option value="INACTIVE">비활성</option>
                    <option value="SUSPENDED">정지</option>
                    <option value="DELETED">삭제</option>
                  </Select>
                </FormControl>
              </HStack>
              
              {/* 권한 안내 - 컴팩트하게 */}
              <Alert status="info" size="sm">
                <AlertIcon />
                <Text fontSize="xs">
                  {rolePermissions[newUserRole].name}: {rolePermissions[newUserRole].permissions.join(', ')}
                </Text>
              </Alert>
              
              {/* 비밀번호 관리 섹션 */}
              <Box w="full" pt={2}>
                <HStack justify="space-between" align="center" mb={2}>
                  <Text fontSize="sm" fontWeight="bold">비밀번호 관리</Text>
                  <Tooltip 
                    label="비밀번호를 기본값(password123)으로 초기화" 
                    placement="top" 
                    hasArrow
                    bg="orange.500"
                    color="white"
                    fontSize="sm"
                  >
                    <Button
                      colorScheme="orange"
                      size="xs"
                      onClick={handlePasswordReset}
                      leftIcon={<RepeatIcon />}
                    >
                      초기화
                    </Button>
                  </Tooltip>
                </HStack>
                <Text fontSize="xs" color="gray.600">
                  초기화 시 기본 비밀번호(password123)로 설정됩니다.
                </Text>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onRoleModalClose} size="sm">
              취소
            </Button>
            <Button colorScheme="blue" onClick={handleMemberUpdate} size="sm">
              정보 수정
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
} 