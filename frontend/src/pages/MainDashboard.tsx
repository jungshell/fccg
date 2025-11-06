import { Box, Flex, Text, SimpleGrid, Stack, IconButton, Modal, ModalOverlay, ModalContent, ModalBody, ModalCloseButton, useDisclosure, Spinner, Alert, AlertIcon, VStack, Button, Badge, Tooltip } from '@chakra-ui/react';
import ManualModal from '../components/ManualModal';
import FloatingHelpButton from '../components/FloatingHelpButton';
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/auth';
import type { StatsSummary } from '../api/auth';
import type { Member } from '../api/auth';
import { getUnifiedVoteDataNew } from '../api/auth';
import { eventBus, EVENT_TYPES } from '../utils/eventBus';
import { API_ENDPOINTS } from '../constants';

import YouTube from 'react-youtube';

const quotes = [
  { quote: '축구는 단순하다. 하지만 단순한 것이 가장 어렵다.', quoteEn: 'Football is simple, but the hardest thing is to play simple.', author: '요한 크루이프', authorEn: 'Johan Cruyff' },
  { quote: '나는 축구를 할 때 행복하다.', quoteEn: 'I am happy when I play football.', author: '리오넬 메시', authorEn: 'Lionel Messi' },
  { quote: '승리는 가장 중요한 것이 아니다. 유일한 것이다.', quoteEn: 'Victory is not the most important thing, it is the only thing.', author: '아르센 벵거', authorEn: 'Arsène Wenger' },
  { quote: '나는 실패를 두려워하지 않는다.', quoteEn: 'I am not afraid to fail.', author: '크리스티아누 호날두', authorEn: 'Cristiano Ronaldo' },
  { quote: '축구는 실수의 게임이다.', quoteEn: 'Football is a game of mistakes.', author: '알렉스 퍼거슨', authorEn: 'Alex Ferguson' },
  { quote: '축구는 머리로 하는 스포츠다. 공은 발이 아니라 머리로 찬다.', quoteEn: 'Football is played with the head. Your feet are just the tools.', author: '지네딘 지단', authorEn: 'Zinedine Zidane' },
  { quote: '축구는 팀 스포츠다. 혼자서는 아무것도 할 수 없다.', quoteEn: 'Football is a team sport. You can do nothing alone.', author: '펠레', authorEn: 'Pelé' },
  { quote: '축구는 인생이다.', quoteEn: 'Football is life.', author: '디에고 마라도나', authorEn: 'Diego Maradona' },
  { quote: '축구는 전쟁이 아니다. 즐기는 것이다.', quoteEn: 'Football is not war. It is to be enjoyed.', author: '요하네스 크루이프', authorEn: 'Johannes Cruijff' },
  { quote: '축구는 예술이다.', quoteEn: 'Football is art.', author: '호나우지뉴', authorEn: 'Ronaldinho' },
  { quote: '축구는 모든 것을 준다.', quoteEn: 'Football gives you everything.', author: '호베르투 바조', authorEn: 'Roberto Baggio' },
  { quote: '축구는 나의 열정이다.', quoteEn: 'Football is my passion.', author: '루이스 수아레스', authorEn: 'Luis Suárez' },
  { quote: '축구는 나의 삶이다.', quoteEn: 'Football is my life.', author: '로베르토 카를로스', authorEn: 'Roberto Carlos' },
  { quote: '축구는 나를 성장시켰다.', quoteEn: 'Football made me grow.', author: '손흥민', authorEn: 'Heung-min Son' },
  { quote: '축구는 나에게 자유를 준다.', quoteEn: 'Football gives me freedom.', author: '네이마르', authorEn: 'Neymar' },
  { quote: '축구는 나에게 꿈을 준다.', quoteEn: 'Football gives me dreams.', author: '카카', authorEn: 'Kaká' },
  { quote: '축구는 나에게 가족이다.', quoteEn: 'Football is family to me.', author: '클롭', authorEn: 'Jürgen Klopp' },
  { quote: '축구는 나에게 모든 것이다.', quoteEn: 'Football is everything to me.', author: '무리뉴', authorEn: 'José Mourinho' },
  { quote: '축구는 나에게 기쁨이다.', quoteEn: 'Football is joy to me.', author: '히딩크', authorEn: 'Guus Hiddink' },
  { quote: '축구는 나에게 도전이다.', quoteEn: 'Football is a challenge to me.', author: '박지성', authorEn: 'Ji-sung Park' },
  { quote: '축구는 나에게 영광이다.', quoteEn: 'Football is glory to me.', author: '이강인', authorEn: 'Kang-in Lee' },
];

// 폴백 비디오는 API에서 가져오지 못할 때만 사용
const fallbackVideos = [
  { id: 'AAftIIK3MOg', title: '2025.07.17.(목) / 매치' },
  { id: 'wbKuojsQZfA', title: '2025.07.03.(목) / 매치 1' },
  { id: 'bH9uYBOuQ3E', title: '2025.06.25.(수) / 매치 2' },
];

// 더미 데이터 제거됨 - 실제 API 데이터만 사용

export default function MainDashboard() {
  // 로그인 상태 확인
  const { user } = useAuthStore();
  
  // 통계 상태 - 기본값으로 초기화
  const [stats, setStats] = useState<StatsSummary>({
    totalMembers: 0,
    totalGames: 0,
    thisWeekGames: 0,
    nextWeekVotes: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 투표 현황 상태
  const [voteData, setVoteData] = useState<any[]>([]);
  const [voteSummary, setVoteSummary] = useState({
    totalMembers: 0,
    votedMembers: 0,
    voteRate: 0,
    votedMemberNames: [] as string[],
    mostVotedDate: '',
    mostVotedCount: 0,
    userVoted: false
  });

  // 통합 투표 데이터 로드 함수
  const loadUnifiedVoteData = useCallback(async () => {
    try {
      const data = await getUnifiedVoteDataNew();
      setUnifiedVoteData(data);
      console.log('🏠 홈 화면 통합 투표 데이터 로드:', data);
    } catch (error) {
      console.error('홈 화면 통합 투표 데이터 로드 오류:', error);
    }
  }, []);

  // 더미 데이터 제거됨 - 실제 API 데이터만 사용



  // 실시간 멤버 데이터 업데이트를 위한 상태
  const [realTimeMembers, setRealTimeMembers] = useState<Member[]>([]); // 빈 배열로 시작
  const [realTimeMemberCount, setRealTimeMemberCount] = useState<number>(0); // 0명으로 시작
  
  // 실시간 경기 데이터 업데이트를 위한 상태
  const [realTimeGameCount, setRealTimeGameCount] = useState<number>(0);
  const [realTimeGames, setRealTimeGames] = useState<any[]>([]);
  const [thisWeekGame, setThisWeekGame] = useState<any>(null);
  const [nextWeekVote, setNextWeekVote] = useState<any>(null);
  
  // 통합 투표 데이터 상태
  const [unifiedVoteData, setUnifiedVoteData] = useState<any>(null);
  const memberManual = useDisclosure();

  // 🔄 이벤트 시스템 리스너 설정
  useEffect(() => {
    // 회원 추가 이벤트 리스너
    const handleMemberAdded = (eventData: any) => {
      console.log('🏠 홈화면: 새 회원 추가 이벤트 수신:', eventData.payload);
      // 실시간 회원 수 업데이트
      setRealTimeMemberCount(prev => prev + 1);
      // 통계 데이터 새로고침
      loadUnifiedVoteData();
    };

    // 데이터 새로고침 이벤트 리스너
    const handleDataRefresh = (eventData: any) => {
      console.log('🏠 홈화면: 데이터 새로고침 이벤트 수신:', eventData.payload);
      if (eventData.payload.dataType === 'members' || eventData.payload.dataType === 'all') {
        loadUnifiedVoteData();
      }
    };

    // 이벤트 리스너 등록
    eventBus.on(EVENT_TYPES.MEMBER_ADDED, handleMemberAdded);
    eventBus.on(EVENT_TYPES.DATA_REFRESH_NEEDED, handleDataRefresh);

    // 컴포넌트 언마운트 시 리스너 제거
    return () => {
      eventBus.off(EVENT_TYPES.MEMBER_ADDED, handleMemberAdded);
      eventBus.off(EVENT_TYPES.DATA_REFRESH_NEEDED, handleDataRefresh);
    };
  }, [loadUnifiedVoteData]);

  // 하단 정보 메모이제이션
  const bottomInfoData = useMemo(() => [
    {
      icon: '👥',
      title: '총 멤버',
      value: `${realTimeMemberCount}명`
    },
    {
      icon: '📅',
      title: '이번주 경기',
      value: thisWeekGame && thisWeekGame.date && thisWeekGame.title 
        ? `${new Date(thisWeekGame.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })} ${thisWeekGame.title}` 
        : '없음'
    },
    {
      icon: '🏆',
      title: '총 경기수',
      value: `${realTimeGameCount}회`
    },
    {
      icon: '📝',
      title: '다음주 경기 투표하기',
      value: (() => {
        const now = new Date();
        const currentDay = now.getDay(); // 0: 일요일, 1: 월요일, ..., 6: 토요일
        
        // 이번주 월요일 계산
        let daysUntilMonday;
        if (currentDay === 0) { // 일요일
          daysUntilMonday = -6; // 지난 월요일
        } else if (currentDay === 1) { // 월요일
          daysUntilMonday = 0; // 오늘
        } else {
          daysUntilMonday = 1 - currentDay; // 이번주 월요일
        }
        
        const thisWeekMonday = new Date(now);
        thisWeekMonday.setDate(now.getDate() + daysUntilMonday);
        
        // 다음주 월요일 계산
        const nextWeekMonday = new Date(thisWeekMonday);
        nextWeekMonday.setDate(thisWeekMonday.getDate() + 7);
        
        // 다음주 금요일 계산
        const nextWeekFriday = new Date(nextWeekMonday);
        nextWeekFriday.setDate(nextWeekMonday.getDate() + 4);
        
        const startMonth = nextWeekMonday.getMonth() + 1;
        const startDay = nextWeekMonday.getDate();
        const startDayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][nextWeekMonday.getDay()];
        
        const endMonth = nextWeekFriday.getMonth() + 1;
        const endDay = nextWeekFriday.getDate();
        const endDayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][nextWeekFriday.getDay()];
        
        if (startMonth === endMonth) {
          return `${startMonth}월 ${startDay}일(${startDayOfWeek}) ~ ${endDay}일(${endDayOfWeek})`;
        } else {
          return `${startMonth}월 ${startDay}일(${startDayOfWeek}) ~ ${endMonth}월 ${endDay}일(${endDayOfWeek})`;
        }
      })(),
      voteStatus: (() => {
        // 투표 상태 확인 로직 (모달과 일치)
        const now = new Date();
        
        // 9월 21일 00:00 이후에는 원래 규칙 적용
        const cutoffDate = new Date();
        cutoffDate.setDate(21);
        cutoffDate.setMonth(8); // 9월 (0부터 시작)
        cutoffDate.setHours(0, 0, 0, 0); // 21일 00:00
        
        let deadline: Date;
        
        if (now >= cutoffDate) {
          // 원래 규칙: 매주 목요일 17시까지
          const currentDay = now.getDay(); // 0: 일요일, 1: 월요일, ..., 6: 토요일
          const daysUntilThursday = (4 - currentDay + 7) % 7; // 목요일까지 남은 일수
          
          deadline = new Date(now);
          deadline.setDate(now.getDate() + daysUntilThursday);
          deadline.setHours(17, 0, 0, 0); // 목요일 17:00
        } else {
          // 임시로 9월 21일 23:50까지
          deadline = new Date();
          deadline.setDate(21);
          deadline.setMonth(8); // 9월 (0부터 시작)
          deadline.setHours(23, 50, 0, 0); // 21일 23:50
        }
        
        const isVoteOpen = now < deadline;
        return isVoteOpen ? 'pending' : 'completed';
      })()
    }
  ], [realTimeMemberCount, thisWeekGame, realTimeGameCount]);

  // 실시간 멤버 데이터 fetch 함수
  const fetchRealTimeMembers = useCallback(async () => {
    try {
      console.log('🔄 MainDashboard - 회원 데이터 로드 시작');
      
      const response = await fetch(`${API_ENDPOINTS.BASE_URL}/members`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
      const data = await response.json();
        console.log('✅ MainDashboard - 회원 데이터 응답 성공:', data.members?.length || 0, '명');
      
      if (data.members && data.members.length > 0) {
        // 활성 및 정지 상태 회원만 카운트 (비활성, 삭제됨 제외)
        const activeMembers = data.members.filter((member: Member) => 
          member.status === 'ACTIVE' || member.status === 'SUSPENDED'
        );
        
          console.log('📋 MainDashboard - 활성 회원:', activeMembers.length, '명');
        setRealTimeMembers(activeMembers);
        setRealTimeMemberCount(activeMembers.length);
      } else {
          console.log('⚠️ MainDashboard - 회원 데이터가 비어있음');
          setRealTimeMembers([]);
          setRealTimeMemberCount(0);
        }
      } else {
        console.log('❌ MainDashboard - 회원 데이터 API 응답 실패:', response.status);
        setRealTimeMembers([]);
        setRealTimeMemberCount(0);
      }
    } catch (error) {
      console.error('❌ MainDashboard - 회원 데이터 fetch 실패:', error);
      setRealTimeMembers([]);
      setRealTimeMemberCount(0);
    }
  }, []);

  // 투표 현황 데이터 fetch 함수 (통합 API 사용)
  const fetchVoteData = useCallback(async () => {
    try {
      console.log('🔄 MainDashboard - 통합 투표 데이터 로드 시작');
      
      // 통합 API에서 투표 데이터 가져오기
      const unifiedData = await fetch(`${API_ENDPOINTS.BASE_URL}/votes/unified`, {
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('token') || localStorage.getItem('auth_token_backup') || ''}` 
        }
      });
      
      let data: any[] = [];
      
      if (unifiedData.ok) {
        const result = await unifiedData.json();
        console.log('✅ MainDashboard - 통합 투표 데이터 로드 성공:', result);
        
        if (result.activeSession && result.activeSession.votes) {
          data = result.activeSession.votes;
        }
      } else {
        // 폴백: localStorage에서 복원
        const stored = localStorage.getItem('voteResults');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            console.log('✅ MainDashboard - localStorage 폴백 투표 데이터:', parsed);
            
            if (parsed.voteSession && parsed.voteSession.votes && Array.isArray(parsed.voteSession.votes)) {
              data = parsed.voteSession.votes;
            }
          } catch (error) {
            console.error('❌ MainDashboard - localStorage 투표 데이터 파싱 오류:', error);
          }
        }
      }
      
      console.log('📊 MainDashboard - 최종 투표 데이터:', data?.length || 0, '개');
      setVoteData(data || []);
        
        // 투표 현황 요약 계산 (실제 회원 정보 기준)
        const totalMembers = realTimeMembers.length;
        
        // 실제 회원 중에서만 투표한 인원 계산
        const memberIds = realTimeMembers.map(member => member.id);
        const participants = new Set<number>();
        data.forEach((vote: any) => {
          if (memberIds.includes(vote.userId)) {
            participants.add(vote.userId);
          }
        });
        
        // 투표한 회원 이름들 (실제 회원 정보에서 가져오기)
        const votedMemberNames = Array.from(participants).map((userId: number) => {
          const member = realTimeMembers.find(m => m.id === userId);
          return member ? member.name : `회원${userId}`;
        }).filter(Boolean);
        
        console.log('🔍 MainDashboard 투표 데이터 분석:', {
          totalMembers,
          memberIds,
          dataLength: data.length,
          participants: Array.from(participants),
          votedMemberNames
        });
        
        // 최다 투표일 계산 (실제 회원의 투표만)
        const dateVoteCount: { [key: string]: number } = {};
        data.forEach((vote: any) => {
          if (memberIds.includes(vote.userId) && vote.selectedDays && Array.isArray(vote.selectedDays)) {
            vote.selectedDays.forEach((date: string) => {
              if (date !== '불참') { // 불참은 제외
                // 날짜 형식 처리: "9월 24일(수)" 형태인지 확인
                let formattedDate = date;
                
                // 이미 한국어 형식인 경우 그대로 사용
                if (date.includes('월') && date.includes('일')) {
                  formattedDate = date;
                } else {
                  // ISO 형식인 경우 변환
                  try {
                    const dateObj = new Date(date);
                    if (!isNaN(dateObj.getTime())) {
                      const month = dateObj.getMonth() + 1;
                      const day = dateObj.getDate();
                      const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];
                      formattedDate = `${month}월 ${day}일(${dayOfWeek})`;
                    }
                  } catch (error) {
                    console.error('날짜 파싱 오류:', error, '원본 날짜:', date);
                    formattedDate = date; // 파싱 실패 시 원본 사용
                  }
                }
                
                dateVoteCount[formattedDate] = (dateVoteCount[formattedDate] || 0) + 1;
              }
            });
          }
        });
        
        let mostVotedDates: string[] = [];
        let mostVotedCount = 0;
        Object.entries(dateVoteCount).forEach(([date, count]) => {
          if (count > mostVotedCount) {
            mostVotedCount = count;
            mostVotedDates = [date];
          } else if (count === mostVotedCount && count > 0) {
            mostVotedDates.push(date);
          }
        });
        
        // 최다투표일을 문자열로 변환
        let mostVotedDate = '';
        if (mostVotedDates.length > 1) {
          // 동일 투표자수가 있는 복수의 날짜가 있는 경우 - 각 날짜별 줄바꿈
          mostVotedDate = mostVotedDates.join('\n');
        } else if (mostVotedDates.length === 1) {
          mostVotedDate = mostVotedDates[0];
        }
        
        console.log('📊 MainDashboard 최다투표일 분석:', {
          dateVoteCount,
          mostVotedDates,
          mostVotedCount,
          mostVotedDate
        });
        
        // 사용자 투표 여부 확인
        const currentUserId = user?.id;
        const userVoted = data.some((vote: any) => vote.userId === currentUserId);
        
        const summary = {
          totalMembers: totalMembers,
          votedMembers: participants.size, // 실제 회원 중 실제 참여한 인원 수
          voteRate: totalMembers > 0 ? Math.round((participants.size / totalMembers) * 100) : 0,
          votedMemberNames: votedMemberNames,
          mostVotedDate: mostVotedDate,
          mostVotedCount: mostVotedCount,
          userVoted: userVoted
        };
        
        console.log('📊 MainDashboard - 투표 현황 요약:', summary);
        setVoteSummary(summary);
    } catch (error) {
      console.error('❌ MainDashboard - 투표 데이터 fetch 실패:', error);
      setVoteData([]);
      setVoteSummary({
        totalMembers: 0,
        votedMembers: 0,
        voteRate: 0,
        votedMemberNames: [],
        mostVotedDate: '',
        mostVotedCount: 0,
        userVoted: false
      });
    }
  }, [realTimeMembers]);

  // 실시간 경기 데이터 fetch 함수
  const fetchRealTimeGames = useCallback(async () => {
    try {
      console.log('🔄 MainDashboard - 경기 데이터 로드 시작');
      
      const response = await fetch(`${API_ENDPOINTS.BASE_URL}/members`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ MainDashboard - 경기 데이터 응답 성공:', data.games?.length || 0, '경기');
        
        if (data.games && data.games.length > 0) {
          setRealTimeGames(data.games);
          setRealTimeGameCount(data.games.length);
        
        // 이번주 경기 찾기 (이번주 월요일~금요일)
        const today = new Date();
        const currentDay = today.getDay(); // 0: 일요일, 1: 월요일, ..., 6: 토요일
        
        // 이번주 월요일 계산
        let daysUntilMonday;
        if (currentDay === 0) { // 일요일
          daysUntilMonday = -6; // 지난 월요일
        } else if (currentDay === 1) { // 월요일
          daysUntilMonday = 0; // 오늘
        } else {
          daysUntilMonday = 1 - currentDay; // 이번주 월요일
        }
        
        const thisWeekMonday = new Date(today);
        thisWeekMonday.setDate(today.getDate() + daysUntilMonday);
        thisWeekMonday.setHours(0, 0, 0, 0);
        
        // 이번주 금요일 계산
        const thisWeekFriday = new Date(thisWeekMonday);
        thisWeekFriday.setDate(thisWeekMonday.getDate() + 4); // 월요일 + 4일 = 금요일
        thisWeekFriday.setHours(23, 59, 59, 999);
        
        const thisWeekGames = data.games.filter((game: any) => {
          const gameDate = new Date(game.date);
          return gameDate >= thisWeekMonday && gameDate <= thisWeekFriday;
        });
        
        if (thisWeekGames.length > 0) {
          // 가장 가까운 경기를 찾되, 시간이 설정된 경기를 우선으로
          const sortedGames = thisWeekGames.sort((a: any, b: any) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateA.getTime() - dateB.getTime();
          });
          
          const nextGame = sortedGames[0];
          console.log('✅ MainDashboard - 이번주 경기 설정:', nextGame);
          setThisWeekGame({
            ...nextGame, // 모든 게임 정보를 포함
            date: nextGame.date,
            title: nextGame.eventType || '매치',
            description: `${nextGame.location}에서 진행`
          });
        } else {
          setThisWeekGame(null);
        }
        
        // 다음주 투표 정보 설정 (다음주 월요일 ~ 금요일)
        const nextWeekMonday = new Date(today);
        // 다음주 월요일 계산: 현재 요일이 월요일(1)이면 7일 후, 아니면 다음 월요일까지의 일수
        const daysUntilMondayNext = currentDay === 1 ? 7 : (8 - currentDay) % 7;
        nextWeekMonday.setDate(today.getDate() + daysUntilMondayNext);
        
        const nextWeekFriday = new Date(nextWeekMonday);
        nextWeekFriday.setDate(nextWeekMonday.getDate() + 4);
        
        console.log('다음주 투표 날짜 계산:', {
          today: today.toLocaleString(),
          currentDay,
          daysUntilMonday: daysUntilMondayNext,
          nextWeekMonday: nextWeekMonday.toLocaleString(),
          nextWeekFriday: nextWeekFriday.toLocaleString()
        });
        
        const formatDate = (date: Date) => {
          const month = date.getMonth() + 1;
          const day = date.getDate();
          const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
          const weekday = weekdays[date.getDay()];
          return `${month}월 ${day}일(${weekday})`;
        };
        
        setNextWeekVote({
          date: nextWeekMonday.toISOString(),
          title: '투표 진행중',
          description: '다음주 경기 일정 투표',
          deadline: `${formatDate(nextWeekMonday)} ~ ${formatDate(nextWeekFriday)}`
        });
        
        } else {
          console.log('⚠️ MainDashboard - 경기 데이터가 비어있음');
          setRealTimeGameCount(0);
          setThisWeekGame(null);
          setNextWeekVote(null);
        }
      } else {
        console.log('❌ MainDashboard - 경기 데이터 API 응답 실패:', response.status);
        setRealTimeGameCount(0);
        setThisWeekGame(null);
        setNextWeekVote(null);
      }
    } catch (error) {
      console.error('❌ MainDashboard - 경기 데이터 fetch 실패:', error);
      setRealTimeGameCount(0);
      setThisWeekGame(null);
      setNextWeekVote(null);
    }
  }, []);

  // 멤버 데이터 가져오기 함수
  const fetchMembers = useCallback(async () => {
    try {
      const response = await fetch(`${API_ENDPOINTS.BASE_URL}/members`);
      if (response.ok) {
        const data = await response.json();
        if (data.members && Array.isArray(data.members)) {
          setRealTimeMembers(data.members);
          setRealTimeMemberCount(data.members.length);
          console.log('실제 멤버 데이터 로드됨:', data.members.length, '명');
        }
      }
    } catch (error) {
      console.error('멤버 데이터 가져오기 오류:', error);
    }
  }, []);

  // 초기 로딩 시 실시간 데이터 fetch
  useEffect(() => {
    setLoading(true);
    setError(null);
    
    // 통계 데이터, 멤버 데이터, 경기 데이터, 투표 데이터를 모두 fetch
    Promise.all([
      // 통계 API 호출
      fetch(`${API_ENDPOINTS.BASE_URL}/members/stats`)
        .then(res => res.json())
        .catch(() => null),
      // 멤버 데이터 가져오기
      fetchMembers(),
      // 경기 데이터 가져오기
      fetchRealTimeGames(),
      // 통합 투표 데이터 가져오기
      loadUnifiedVoteData()
    ]).then(([statsData]) => {
      if (statsData && !statsData.error) {
        setStats({
          totalMembers: statsData.totalMembers || 0,
          totalGames: 0, // 이 필드는 현재 API에 없음
          thisWeekGames: statsData.thisWeekGames || 0,
          nextWeekVotes: statsData.nextWeekVotes || 0
        });
      } else {
        // API 실패 시 기본값 사용
        setStats({
          totalMembers: 0,
          totalGames: 0,
          thisWeekGames: 0,
          nextWeekVotes: 0
        });
      }
      setLoading(false);
    }).catch((error) => {
      console.error('데이터 로딩 실패:', error);
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
      setStats({
        totalMembers: 0,
        totalGames: 0,
        thisWeekGames: 0,
        nextWeekVotes: 0
      });
      setLoading(false);
    });
  }, [fetchRealTimeGames]);



  // 주기적으로 멤버 데이터와 경기 데이터 업데이트 (1분마다)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRealTimeMembers();
      fetchRealTimeGames();
      fetchVoteData();
      loadUnifiedVoteData(); // 통합 투표 데이터도 함께 업데이트
    }, 1 * 60 * 1000); // 1분

    return () => clearInterval(interval);
  }, [fetchRealTimeMembers, fetchRealTimeGames, fetchVoteData, loadUnifiedVoteData]);

  // 투표 데이터 변경 이벤트 리스너
  useEffect(() => {
    const handleVoteDataChanged = () => {
      console.log('🏠 홈 화면: 투표 데이터 변경 이벤트 수신');
      loadUnifiedVoteData();
    };

    window.addEventListener('voteDataChanged', handleVoteDataChanged);
    // 경기/회원 변경 이벤트도 즉시 반영
    const handleGamesChanged = () => {
      console.log('🏠 홈 화면: 경기 변경 이벤트 수신');
      fetchRealTimeGames();
      loadUnifiedVoteData();
    };
    const handleMembersChanged = () => {
      console.log('🏠 홈 화면: 회원 변경 이벤트 수신');
      fetchRealTimeMembers();
      loadUnifiedVoteData();
    };
    window.addEventListener('gamesChanged', handleGamesChanged);
    window.addEventListener('membersChanged', handleMembersChanged);
    return () => {
      window.removeEventListener('voteDataChanged', handleVoteDataChanged);
      window.removeEventListener('gamesChanged', handleGamesChanged);
      window.removeEventListener('membersChanged', handleMembersChanged);
    };
  }, [loadUnifiedVoteData]);

  // 페이지 포커스 시에도 데이터 새로고침
  useEffect(() => {
    const handleFocus = () => {
      fetchRealTimeMembers();
      fetchRealTimeGames();
      fetchVoteData();
      loadUnifiedVoteData(); // 통합 투표 데이터도 함께 새로고침
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchRealTimeMembers, fetchRealTimeGames, fetchVoteData, loadUnifiedVoteData]);

  // 명언 랜덤 선택
  const randomQuote = useMemo(() => {
    if (!quotes || quotes.length === 0) {
      return { quote: '축구는 단순하다. 하지만 단순한 것이 가장 어렵다.', quoteEn: 'Football is simple, but the hardest thing is to play simple.', author: '요한 크루이프', authorEn: 'Johan Cruyff' };
    }
    return quotes[Math.floor(Math.random() * quotes.length)] || quotes[0];
  }, []);

  // 유튜브 영상 fetch (최신 3개 자동)
  const YT_API_KEY = 'AIzaSyC7M5KrtdL8ChfVCX0M2CZfg7GWGaExMTk';
  const PLAYLIST_ID = 'PLQ5o2f7efzlZ-RDG64h4Oj_5pXt0g6q3b';
  const [youtubeVideos, setYoutubeVideos] = useState(fallbackVideos);
  useEffect(() => {
    fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=5&playlistId=${PLAYLIST_ID}&key=${YT_API_KEY}`)
      .then(res => res.json())
      .then((data: { items?: { snippet: { resourceId: { videoId: string }, title: string } }[] }) => {
        if (data.items && data.items.length > 0) {
          const validVideos = data.items
            .map((item) => ({
              id: item.snippet.resourceId.videoId,
              title: item.snippet.title,
            }))
            .filter((v) => !!v.id)
            .slice(0, 3);
          if (validVideos.length === 3) {
            setYoutubeVideos(validVideos);
          } else {
            setYoutubeVideos([...validVideos, ...fallbackVideos].slice(0, 3));
          }
        } else {
          setYoutubeVideos(fallbackVideos);
        }
      })
      .catch(() => setYoutubeVideos(fallbackVideos));
  }, []);

  // 유튜브 IFrame Player는 외부 라이브러리로 동작하며, 최신화 fetch만 사용합니다.

  const [videoIdx, setVideoIdx] = useState<number>(0);
  const currentVideo = useMemo(() => {
    const video = youtubeVideos?.[videoIdx] || fallbackVideos?.[0] || { id: 'AAftIIK3MOg', title: '기본 영상' };
    return {
      id: video?.id || 'AAftIIK3MOg',
      title: video?.title || '기본 영상'
    };
  }, [youtubeVideos, videoIdx]);
  // 동영상 인덱스 이동 (최신화된 리스트에 맞게)
  const handlePrev = () => setVideoIdx((idx: number) => (idx === 0 ? youtubeVideos.length - 1 : idx - 1));
  const handleNext = () => setVideoIdx((idx: number) => (idx === youtubeVideos.length - 1 ? 0 : idx + 1));

  // 상세 모달 상태
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [modalIdx, setModalIdx] = useState<number | null>(null);

  // 경기 데이터를 날짜별로 분류하는 함수
  const getGameStatsByPeriod = useCallback(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    
    let thisMonthCount = 0;
    let lastMonthCount = 0;
    let thisYearCount = 0;
    let lastYearCount = 0;
    let currentMonthAllYearsCount = 0; // 현재 월의 모든 연도 경기수
    
    realTimeGames.forEach(game => {
      const gameDate = new Date(game.date);
      const gameYear = gameDate.getFullYear();
      const gameMonth = gameDate.getMonth() + 1;
      
      // 이번달 경기수 (올해만)
      if (gameYear === currentYear && gameMonth === currentMonth) {
        thisMonthCount++;
      }
      
      // 현재 월의 모든 연도 경기수 (예: 9월 전체)
      if (gameMonth === currentMonth) {
        currentMonthAllYearsCount++;
      }
      
      // 지난달 경기수
      if (gameYear === lastYear && gameMonth === lastMonth) {
        lastMonthCount++;
      }
      
      // 올해 경기수
      if (gameYear === currentYear) {
        thisYearCount++;
      }
      
      // 작년 경기수 (2026년이 되면 표시)
      if (gameYear === currentYear - 1) {
        lastYearCount++;
      }
    });
    
    return {
      thisMonth: thisMonthCount,
      currentMonthAllYears: currentMonthAllYearsCount, // 현재 월의 모든 연도 경기수
      lastMonth: lastMonthCount,
      thisYear: thisYearCount,
      lastYear: lastYearCount,
      total: realTimeGameCount
    };
  }, [realTimeGames, realTimeGameCount]);
  // 멤버 리스트 상태
  const [membersLoading, setMembersLoading] = useState(false);

  // 모달 열릴 때 멤버 리스트 fetch
  useEffect(() => {
    if (isOpen && modalIdx === 0) {
      setMembersLoading(true);
      // 직접 API 호출 (인증 토큰 포함)
              fetch(`${API_ENDPOINTS.BASE_URL}/members`, {
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
              })
        .then(res => res.json())
        .then((data) => {
          if (data.members && data.members.length > 0) {
            setRealTimeMembers(data.members);
            setRealTimeMemberCount(data.members.length);
          } else {
            // API 실패 시 빈 배열 사용
            setRealTimeMembers([]);
            setRealTimeMemberCount(0);
          }
          setMembersLoading(false);
        })
        .catch(() => {
          console.log('멤버 API 실패, 빈 데이터 사용');
          setRealTimeMembers([]);
          setRealTimeMemberCount(0);
          setMembersLoading(false);
        });
    }
  }, [isOpen, modalIdx]);

  // 투표 모달 열릴 때 투표 데이터 fetch
  useEffect(() => {
    if (isOpen && modalIdx === 3) { // 다음주 경기 투표하기 모달
      fetchVoteData();
      loadUnifiedVoteData(); // 통합 투표 데이터도 함께 로드
    }
  }, [isOpen, modalIdx, fetchVoteData, loadUnifiedVoteData]);

  // 상세 내용 생성 함수
  function getDetailContent(idx: number) {
    if (!stats) return null;
    switch (idx) {
      case 0:
        return (
          <Box>
            <Box textAlign="center" mb={2}>
              <Text fontSize="2xl" fontWeight="bold" display="inline-block" verticalAlign="middle" mr={2}>👥</Text>
              <Text fontSize="xl" fontWeight="bold" display="inline-block" verticalAlign="middle">총 멤버: {realTimeMemberCount}명</Text>
            </Box>

            {membersLoading ? (
              <Text color="gray.500">멤버 목록을 불러오는 중...</Text>
            ) : (
              <Box maxH="200px" overflowY="auto" mt={2} display="flex" flexWrap="wrap" gap={2} justifyContent="center">
                {realTimeMembers.length > 0 ? realTimeMembers
                  .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'))
                  .map((m) => (
                    <Box 
                      key={m.id} 
                      px={3} 
                      py={1} 
                      borderRadius="full" 
                      bg="#2563eb" 
                      color="white" 
                      fontWeight="medium" 
                      fontSize="xs" 
                      mr={2} 
                      mb={2} 
                      display="inline-block"
                      boxShadow="0 1px 3px rgba(0,0,0,0.1)"
                      _hover={{ 
                        transform: 'translateY(-1px)', 
                        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {m.name}
                    </Box>
                  )) : (
                  <Text color="gray.500">멤버 데이터를 불러오는 중...</Text>
                )}
              </Box>
            )}
          </Box>
        );
      case 1:
        return (
          <Box>
             <Box textAlign="center" mb={4}>
               <Text fontSize="xl" fontWeight="bold" color="gray.800">
                 📅 이번주 경기
            </Text>
              </Box>
             {thisWeekGame ? (
               <VStack spacing={3} align="stretch">
                 {/* 유형 */}
                 <Flex align="center" gap={2}>
                   <Box as="span" fontSize="md">⚽</Box>
                   <Text fontSize="sm" fontWeight="medium">
                     유형: {(() => {
                       const eventType = thisWeekGame.eventType || '자체';
                       if (['풋살', 'FRIENDLY', 'FRIENDLY_MATCH'].includes(eventType)) return '매치';
                       if (!['매치', '자체', '회식', '기타'].includes(eventType)) return '기타';
                       return eventType;
                     })()}
                   </Text>
                 </Flex>

                 {/* 일시 */}
                 <Flex align="center" gap={2}>
                   <Box as="span" fontSize="md">🕐</Box>
                   <Text fontSize="sm" fontWeight="medium">
                     일시: {(() => {
                       if (thisWeekGame.date && thisWeekGame.time) {
                         const date = new Date(thisWeekGame.date);
                         const month = date.getMonth() + 1;
                         const day = date.getDate();
                         const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
                         return `${month}월 ${day}일(${dayOfWeek}) ${thisWeekGame.time}`;
                       } else if (thisWeekGame.date) {
                         const date = new Date(thisWeekGame.date);
                         const month = date.getMonth() + 1;
                         const day = date.getDate();
                         const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
                         return `${month}월 ${day}일(${dayOfWeek})`;
                       }
                       return '일시 미정';
                     })()}
                   </Text>
                 </Flex>

                 {/* 장소 */}
                 <Flex align="center" justify="space-between">
                   <Flex align="center" gap={2}>
                     <Box as="span" fontSize="md">📍</Box>
                     <Text fontSize="sm" fontWeight="medium">
                       장소: {thisWeekGame.location || '장소 미정'}
                     </Text>
                   </Flex>
                   {thisWeekGame.location && (
                     <Button
                       size="xs"
                       height="22px"
                       minW="22px"
                       fontSize="11px"
                       p={0}
                       bg="yellow.400"
                       color="blue.600"
                       onClick={() => {
                         const searchQuery = encodeURIComponent(thisWeekGame.location || '');
                         window.open(`https://map.kakao.com/link/search/${searchQuery}`, '_blank');
                       }}
                     >
                       K
                     </Button>
                   )}
                 </Flex>

                 {/* 참석자 정보 */}
                 <Flex align="center" gap={2}>
                   <Box as="span" fontSize="md">👥</Box>
                   <Text fontSize="sm" fontWeight="medium">
                     참석자 정보: {(() => {
                       const selectedMembers = Array.isArray(thisWeekGame.selectedMembers) ? 
                         thisWeekGame.selectedMembers : 
                         (typeof thisWeekGame.selectedMembers === 'string' ? 
                           JSON.parse(thisWeekGame.selectedMembers) : []);
                       const memberNames = Array.isArray(thisWeekGame.memberNames) ? 
                         thisWeekGame.memberNames : 
                         (typeof thisWeekGame.memberNames === 'string' ? 
                           JSON.parse(thisWeekGame.memberNames) : []);
                       const mercenaryCount = thisWeekGame.mercenaryCount || 0;
                       
                       const totalCount = selectedMembers.length + memberNames.length + mercenaryCount;
                       return totalCount;
                     })()}명
                   </Text>
                   <Text fontSize="xs" whiteSpace="nowrap">
                     ({(() => {
                       const selectedMembers = Array.isArray(thisWeekGame.selectedMembers) ? 
                         thisWeekGame.selectedMembers : 
                         (typeof thisWeekGame.selectedMembers === 'string' ? 
                           JSON.parse(thisWeekGame.selectedMembers) : []);
                       const memberNames = Array.isArray(thisWeekGame.memberNames) ? 
                         thisWeekGame.memberNames : 
                         (typeof thisWeekGame.memberNames === 'string' ? 
                           JSON.parse(thisWeekGame.memberNames) : []);
                       
                       const parts = [];
                       if (selectedMembers && selectedMembers.length > 0) {
                         parts.push({ text: `회원 ${selectedMembers.length}명`, color: '#004ea8' });
                       }
                       if (memberNames && memberNames.length > 0) {
                         parts.push({ text: `수기입력 ${memberNames.length}명`, color: '#ff6b35' });
                       }
                       if (thisWeekGame.mercenaryCount && thisWeekGame.mercenaryCount > 0) {
                         parts.push({ text: `용병 ${thisWeekGame.mercenaryCount}명`, color: '#000000' });
                       }
                       
                       return parts.length > 0 ? (
                         <span>
                           {parts.map((part, index) => (
                             <span
                               key={index}
                               style={{
                                 color: part.color,
                                 fontWeight: '500'
                               }}
                             >
                               {part.text}{index < parts.length - 1 ? ' + ' : ''}
                             </span>
                           ))}
                         </span>
                       ) : '참석자 없음';
                     })()})
                   </Text>
                 </Flex>

                 {/* 참석자 목록 */}
                 {(() => {
                   const selectedMembers = Array.isArray(thisWeekGame.selectedMembers) ? 
                     thisWeekGame.selectedMembers : 
                     (typeof thisWeekGame.selectedMembers === 'string' ? 
                       JSON.parse(thisWeekGame.selectedMembers) : []);
                   const memberNames = Array.isArray(thisWeekGame.memberNames) ? 
                     thisWeekGame.memberNames : 
                     (typeof thisWeekGame.memberNames === 'string' ? 
                       JSON.parse(thisWeekGame.memberNames) : []);
                   const mercenaryCount = thisWeekGame.mercenaryCount || 0;
                   
                   const allParticipants: Array<{name: string, type: 'member' | 'mercenary' | 'other'}> = [];
                   
                   // 회원 추가
                   if (selectedMembers && selectedMembers.length > 0) {
                     selectedMembers.forEach((name: string) => {
                       allParticipants.push({ name, type: 'member' });
                     });
                   }
                   
                   // 수기입력 인원 추가
                   if (memberNames && memberNames.length > 0) {
                     memberNames.forEach((name: string) => {
                       allParticipants.push({ name, type: 'other' });
                     });
                   }
                   
                   // 용병 추가 (단일 뱃지로)
                   if (mercenaryCount > 0) {
                     allParticipants.push({ name: `용병 ${mercenaryCount}명`, type: 'mercenary' });
                   }
                   
                   
                   return allParticipants.length > 0 ? (
                     <Flex wrap="wrap" gap={1} justify="center">
                       {allParticipants.map((participant, index) => (
                         <Badge
                           key={index}
                           bg={
                             participant.type === 'member' ? '#004ea8' : 
                             participant.type === 'mercenary' ? '#000000' : 
                             '#ff6b35'
                           }
                           color="white"
                           variant="solid"
                           borderRadius="full"
                           px={2}
                           py={0.5}
                           fontSize="xs"
                         >
                           {participant.name}
                         </Badge>
                       ))}
                     </Flex>
                   ) : null;
                 })()}
               </VStack>
             ) : (
               <Text textAlign="center" color="gray.500">
                 이번주 경기가 없습니다.
               </Text>
            )}
          </Box>
        );
      case 2:
        const gameStats = getGameStatsByPeriod();
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
        
        return (
          <Box>
            <Box textAlign="center" mb={6}>
              <Text fontSize="xl" fontWeight="bold" color="gray.800">
                🏆 경기 통계
              </Text>
            </Box>
            
            {/* 미니멀 카드 레이아웃 */}
            <Box>
              {/* 이번달 경기수 카드 */}
              <Box 
                bg="white" 
                p={4} 
                borderRadius="lg" 
                boxShadow="0 2px 8px rgba(0,0,0,0.08)"
                border="1px solid"
                borderColor="gray.100"
                mb={3}
                transition="all 0.3s ease"
                _hover={{
                  transform: "translateY(-2px)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.12)"
                }}
              >
                <Flex align="center" justify="space-between">
                  <Box flex="0 0 auto" textAlign="center" mr={4}>
                    <Text fontSize="2xl" mb={1}>📅</Text>
                    <Text fontSize="xs" color="gray.500" fontWeight="medium">
                      THIS MONTH
                    </Text>
                  </Box>
                  <Box flex="1" textAlign="center">
                    <Text fontSize="3xl" fontWeight="bold" color="purple.600" mb={1}>
                      {gameStats.thisMonth}
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      {monthNames[currentMonth - 1]} 경기수
                    </Text>
                  </Box>
                </Flex>
              </Box>

              {/* 지난달 경기수 카드 */}
              <Box 
                bg="white" 
                p={4} 
                borderRadius="lg" 
                boxShadow="0 2px 8px rgba(0,0,0,0.08)"
                border="1px solid"
                borderColor="gray.100"
                mb={3}
                transition="all 0.3s ease"
                _hover={{
                  transform: "translateY(-2px)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.12)"
                }}
              >
                <Flex align="center" justify="space-between">
                  <Box flex="0 0 auto" textAlign="center" mr={4}>
                    <Text fontSize="2xl" mb={1}>📆</Text>
                    <Text fontSize="xs" color="gray.500" fontWeight="medium">
                      LAST MONTH
                    </Text>
                  </Box>
                  <Box flex="1" textAlign="center">
                    <Text fontSize="3xl" fontWeight="bold" color="orange.600" mb={1}>
                      {gameStats.lastMonth}
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      {currentMonth === 1 ? '12월' : monthNames[currentMonth - 2]} 경기수
                    </Text>
                  </Box>
                </Flex>
              </Box>

              {/* 올해 경기수 카드 */}
              <Box 
                bg="white" 
                p={4} 
                borderRadius="lg" 
                boxShadow="0 2px 8px rgba(0,0,0,0.08)"
                border="1px solid"
                borderColor="gray.100"
                mb={3}
                transition="all 0.3s ease"
                _hover={{
                  transform: "translateY(-2px)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.12)"
                }}
              >
                <Flex align="center" justify="space-between">
                  <Box flex="0 0 auto" textAlign="center" mr={4}>
                    <Text fontSize="2xl" mb={1}>🎯</Text>
                    <Text fontSize="xs" color="gray.500" fontWeight="medium">
                      THIS YEAR
                    </Text>
                  </Box>
                  <Box flex="1" textAlign="center">
                    <Text fontSize="3xl" fontWeight="bold" color="green.600" mb={1}>
                      {gameStats.thisYear}
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      {currentYear}년 경기수
                    </Text>
                  </Box>
                </Flex>
              </Box>

              {/* 작년 경기수 카드 (2026년이 되면 표시) */}
              {currentYear >= 2026 && (
                <Box 
                  bg="white" 
                  p={4} 
                  borderRadius="lg" 
                  boxShadow="0 2px 8px rgba(0,0,0,0.08)"
                  border="1px solid"
                  borderColor="gray.100"
                  mb={3}
                  transition="all 0.3s ease"
                  _hover={{
                    transform: "translateY(-2px)",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.12)"
                  }}
                >
                  <Flex align="center" justify="space-between">
                    <Box flex="0 0 auto" textAlign="center" mr={4}>
                      <Text fontSize="2xl" mb={1}>📊</Text>
                      <Text fontSize="xs" color="gray.500" fontWeight="medium">
                        LAST YEAR
                      </Text>
                    </Box>
                    <Box flex="1" textAlign="center">
                      <Text fontSize="3xl" fontWeight="bold" color="teal.600" mb={1}>
                        {gameStats.lastYear}
                      </Text>
                      <Text fontSize="sm" color="gray.600">
                        {currentYear - 1}년 경기수
                      </Text>
                    </Box>
                  </Flex>
                </Box>
              )}

              {/* 총 경기수 카드 */}
              <Box 
                bg="white" 
                p={4} 
                borderRadius="lg" 
                boxShadow="0 2px 8px rgba(0,0,0,0.08)"
                border="1px solid"
                borderColor="gray.100"
                transition="all 0.3s ease"
                _hover={{
                  transform: "translateY(-2px)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.12)"
                }}
              >
                <Flex align="center" justify="space-between">
                  <Box flex="0 0 auto" textAlign="center" mr={4}>
                    <Text fontSize="2xl" mb={1}>🏆</Text>
                    <Text fontSize="xs" color="gray.500" fontWeight="medium">
                      TOTAL
                    </Text>
                  </Box>
                  <Box flex="1" textAlign="center">
                    <Text fontSize="3xl" fontWeight="bold" color="blue.600" mb={1}>
                      {gameStats.total}
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      총 경기수
                    </Text>
                  </Box>
                </Flex>
              </Box>
            </Box>
          </Box>
        );
      case 3:
        return (
          <Box>
            <Box textAlign="center" mb={4}>
              <Text fontSize="2xl" fontWeight="bold" color="#004ea8">
                📝 다음주 경기 투표
            </Text>
            </Box>
            {unifiedVoteData?.activeSession ? (
              <Box>
                {/* 투표 기간 */}
                <Box bg="blue.50" p={4} borderRadius="lg" mb={4} position="relative">
                  <Flex align="center" mb={3}>
                    <Text fontSize="lg" mr={2}>🗓️</Text>
                    <Text fontSize="lg" fontWeight="bold">투표 기간</Text>
                  </Flex>
              <Box textAlign="center">
                    <Text fontSize="md" color="gray.700" fontWeight="medium">
                      {(() => {
                        if (!unifiedVoteData?.activeSession) return '투표 세션이 없습니다.';
                        const session = unifiedVoteData.activeSession;
                        const weekStartDate = new Date(session.weekStartDate);
                        const weekEndDate = new Date(weekStartDate.getTime() + 4 * 24 * 60 * 60 * 1000); // 금요일
                        
                        const formatDate = (date: Date) => {
                          const month = date.getMonth() + 1;
                          const day = date.getDate();
                          const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
                          return `${month}월 ${day}일(${dayOfWeek})`;
                        };
                        
                        return `${formatDate(weekStartDate)} ~ ${formatDate(weekEndDate)}`;
                      })()}
                    </Text>
              </Box>
                  {/* 투표 상태 pill */}
                  <Box position="absolute" top={3} right={3}>
                    {(() => {
                      if (!unifiedVoteData?.activeSession) return null;
                      const session = unifiedVoteData.activeSession;
                      const isVoteClosed = !session.isActive;
                      return (
                        <Badge 
                          bg={isVoteClosed ? "red.500" : "purple.500"} 
                          color="white" 
                          fontSize="xs" 
                          px={2} 
                          py={1} 
                          borderRadius="full"
                        >
                          {isVoteClosed ? "투표종료" : "투표 중"}
                        </Badge>
                      );
                    })()}
                  </Box>
                </Box>
                
                {/* 투표 현황 요약 */}
                <Box bg="gray.50" p={3} borderRadius="lg" mb={4}>
                  <Flex align="center" mb={3}>
                    <Text fontSize="lg" mr={2}>📊</Text>
                    <Text fontSize="lg" fontWeight="bold">투표 현황 요약</Text>
                  </Flex>
                  <Flex direction={{ base: 'column', md: 'row' }} gap={3}>
                    <Box flex={0.4} bg="white" p={3} borderRadius="md">
                      <Text fontSize="sm" color="gray.600" mb={2}>투표 참여</Text>
                      <Tooltip
                        label={(() => {
                          if (!unifiedVoteData?.activeSession) return '투표 세션이 없습니다.';
                          
                          const session = unifiedVoteData.activeSession;
                          const participants = session.participants || [];
                          const allMembers = unifiedVoteData.allMembers || [];
                          
                          // 참여자 이름들
                          const participantNames = participants.map((p: any) => p.userName).join(', ');
                          
                          // 미참여자 이름들
                          const participantIds = participants.map((p: any) => p.userId);
                          const nonParticipantNames = allMembers
                            .filter((member: any) => !participantIds.includes(member.id))
                            .map((member: any) => member.name);
                          
                          return `참여자: ${participantNames}\n미참여자: ${nonParticipantNames.join(', ')}`;
                        })()}
                        placement="top"
                        hasArrow
                        bg="blue.600"
                        color="white"
                        fontSize="sm"
                        whiteSpace="pre-line"
                      >
                        <Text fontSize="md" fontWeight="bold" color="blue.600" cursor="default" textAlign="center">
                          {unifiedVoteData?.activeSession?.totalParticipants || 0}/{unifiedVoteData?.allMembers?.length || 0}명
                        </Text>
                      </Tooltip>
                    </Box>
                    <Box flex={0.6} bg="white" p={3} borderRadius="md">
                      <Text fontSize="sm" color="gray.600" mb={2}>최다투표일</Text>
                      {(() => {
                        if (!unifiedVoteData?.activeSession?.results) {
                          return <Text fontSize="md" fontWeight="bold" color="green.600">투표 없음</Text>;
                        }
                        
                        const results = unifiedVoteData.activeSession.results;
                        const session = unifiedVoteData.activeSession;
                        const weekStartDate = new Date(session.weekStartDate);
                        
                        const days = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
                        const dayNames = ['월', '화', '수', '목', '금'];
                        
                        // 최대 투표 수 찾기
                        let maxVotes = 0;
                        days.forEach(day => {
                          const dayResult = results[day];
                          const voteCount = dayResult ? dayResult.count || 0 : 0;
                          if (voteCount > maxVotes) {
                            maxVotes = voteCount;
                          }
                        });
                        
                        if (maxVotes === 0) {
                          return <Text fontSize="md" fontWeight="bold" color="green.600">투표 없음</Text>;
                        }
                        
                        // 최대 투표 수를 가진 모든 날짜 찾기
                        const maxVoteDays = [];
                        days.forEach(day => {
                          const dayResult = results[day];
                          const voteCount = dayResult ? dayResult.count || 0 : 0;
                          if (voteCount === maxVotes) {
                            const dayIndex = days.indexOf(day);
                            const dayName = dayNames[dayIndex];
                            
                            // 해당 요일의 실제 날짜 계산
                            const actualDate = new Date(weekStartDate);
                            actualDate.setDate(weekStartDate.getDate() + dayIndex);
                            
                            const month = actualDate.getMonth() + 1;
                            const dayNum = actualDate.getDate();
                            
                            maxVoteDays.push(`${month}월 ${dayNum}일(${dayName})`);
                          }
                        });
                        
                        return (
                          <Flex direction="row" gap={2} align="center">
                            <Box flex={0.7}>
                              <Text fontSize="md" fontWeight="bold" color="green.600" whiteSpace="pre-line">
                                {maxVoteDays.join('\n')}
                              </Text>
                            </Box>
                            <Box flex={0.3} textAlign="center">
                              <Badge bg="green.600" color="white" fontSize="xs" px={2} py={1} borderRadius="full">
                                {maxVotes}명
                              </Badge>
                            </Box>
                          </Flex>
                        );
                      })()}
                    </Box>
                  </Flex>
                </Box>
              </Box>
            ) : (
              <Text textAlign="center" color="gray.500">
                다음주 투표 정보가 없습니다.
              </Text>
            )}
          </Box>
        );
      default:
        return null;
    }
  }






  return (
    <Box minH="100vh" bg="#f7f9fb" w="100vw" minW="100vw" pt="18mm">
      {/* 메인 컨텐츠 */}
      <Flex direction={{ base: 'column', md: 'row' }} gap={8} px={{ base: 2, md: 8, lg: 24 }} py={10} w="full" maxW="100vw" align="stretch">
        {/* 명언 카드 */}
        <Box flex={1} bg="white" p={{ base: 4, md: 8 }} borderRadius="lg" boxShadow="md" display="flex" flexDirection="column" justifyContent="center" minH="433px" maxW={{ base: '100%', md: '420px' }}>
          <Text fontSize="5xl" color="#004ea8" fontWeight="bold" mb={4}>&ldquo;</Text>
          <Text fontSize="xl" fontWeight="bold" mb={2}>{randomQuote?.quoteEn || ''}</Text>
          <Text fontSize="md" color="gray.500" mb={1}>- {randomQuote?.authorEn || ''}</Text>
          <Text fontSize="lg" color="gray.700" mb={2}>{randomQuote?.quote || ''}</Text>
          <Text fontWeight="bold" color="gray.600" mb={1}>{randomQuote?.author || ''}</Text>
        </Box>
        {/* 유튜브 슬라이드 */}
        <Box
          flex={2}
          bg="white"
          p={4}
          borderRadius="lg"
          boxShadow="md"
          display="flex"
          alignItems="center"
          justifyContent="center"
          minH={{ base: '180px', md: '320px', lg: '433px' }}
          w="100%"
          position="relative"
        >
          <IconButton icon={<ChevronLeftIcon />} aria-label="이전" position="absolute" left={2} top="50%" transform="translateY(-50%)" onClick={handlePrev} zIndex={2} bg="white" boxShadow="md"/>
          <Box
            w="full"
            h="full"
            position="relative"
            borderRadius="lg"
            overflow="hidden"
            boxShadow="sm"
            bg="black"
            aspectRatio={{ base: '16/9', md: '16/7' }}
            minH={{ base: '180px', md: '320px' }}
            display="block"
          >
            {/* 영상 제목 왼쪽 위에 예쁘게 노출 */}
            <Box position="absolute" top={3} left={3} bg="rgba(0,0,0,0.55)" color="white" px={4} py={2} borderRadius="lg" fontWeight="bold" fontSize="md" zIndex={3} boxShadow="md" maxW="80%" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">
              {currentVideo.title}
            </Box>
            <YouTube
              key={currentVideo.id}
              videoId={currentVideo.id}
              opts={{
                width: '100%',
                height: '100%',
                playerVars: {
                  autoplay: 1,
                  mute: 1,
                  rel: 0,
                },
              }}
              style={{
                position: 'absolute',
                width: '125%',
                height: '125%',
                borderRadius: 12,
                background: 'black',
                left: '-12.5%',
                top: '-12.5%',
              }}
              className="yt-iframe"
              onEnd={() => setVideoIdx(idx => (idx + 1) % youtubeVideos.length)}
            />
          </Box>
          <IconButton icon={<ChevronRightIcon />} aria-label="다음" position="absolute" right={2} top="50%" transform="translateY(-50%)" onClick={handleNext} zIndex={2} bg="white" boxShadow="md"/>
        </Box>
      </Flex>

      {/* 에러 상태 */}
      {error && (
        <Alert status="error" mb={6} mx={{ base: 2, md: 8, lg: 24 }}>
          <AlertIcon />
          {error}
        </Alert>
      )}

      {/* 하단 통계 카드 */}
      <SimpleGrid columns={[1, 2, 4]} spacing={6} mb={8} px={{ base: 2, md: 8, lg: 24 }} w="full" maxW="100vw">
        {loading ? (
          <>
            {bottomInfoData.map((info, idx) => (
              <Box
                key={idx}
                bg="white"
                p={8}
                borderRadius="lg"
                boxShadow="md"
                textAlign="center"
                minW={0}
              >
                <Stack direction="row" align="center" justify="center" spacing={2} mb={2}>
                  <Text fontSize="2xl">{info.icon}</Text>
                  <Text fontWeight="bold" fontSize="lg">{info.title}</Text>
                </Stack>
                <Flex align="center" justify="center">
                  <Spinner size="md" color="blue.500" mr={2} />
                  <Text color="gray.500">로딩 중...</Text>
                </Flex>
              </Box>
            ))}
          </>
        ) : stats && (
          <>
            {bottomInfoData.map((info, idx) => (
              <Box
                key={idx}
                bg="white"
                p={8}
                borderRadius="lg"
                boxShadow="md"
                textAlign="center"
                minW={0}
                cursor="pointer"
                _hover={{ boxShadow: 'xl', transform: 'translateY(-2px)', transition: 'all 0.15s' }}
                onClick={() => { setModalIdx(idx); onOpen(); }}
                position="relative"
              >
                {/* 투표 상태 뱃지 - 오른쪽 상단 (로그인 여부와 관계없이 표시) */}
                {info.title === '다음주 경기 투표하기' && (
                  <Box position="absolute" top={2} right={2}>
                    {(() => {
                      // 실제 투표 세션 데이터 사용
                      if (!unifiedVoteData?.activeSession) {
                        return (
                          <Badge colorScheme="gray" variant="solid" fontSize="xs">
                            세션 없음
                          </Badge>
                        );
                      }
                      
                      const session = unifiedVoteData.activeSession;
                      const isVoteClosed = !session.isActive;
                      
                      if (isVoteClosed) {
                        return (
                          <Badge
                            bg="red.500"
                            color="white"
                            px={1}
                            py={0}
                            borderRadius="sm"
                            fontSize="10px"
                            fontWeight="bold"
                            boxShadow="sm"
                          >
                            투표종료
                          </Badge>
                        );
                      } else {
                        return (
                          <Badge
                            bg="purple.500"
                            color="white"
                            px={1}
                            py={0}
                            borderRadius="sm"
                            fontSize="10px"
                            fontWeight="bold"
                            boxShadow="sm"
                          >
                            투표 중
                          </Badge>
                        );
                      }
                    })()}
                  </Box>
                )}
            <Stack direction="row" align="center" justify="center" spacing={2} mb={2}>
                  <Text fontSize="2xl">{info.icon}</Text>
                  <Text fontWeight="bold" fontSize="lg">{info.title}</Text>
                </Stack>
                <Text color="#004ea8" fontSize="lg" fontWeight="normal" mt={2}>
                  {info.value}
                </Text>
              </Box>
            ))}
          </>
        )}
      </SimpleGrid>
      {/* 상세 모달 */}
              <Modal isOpen={isOpen} onClose={onClose} isCentered size="sm">
        <ModalOverlay />
          <ModalContent maxW="400px">
          <ModalCloseButton />
            <ModalBody px={4} py={6}>
            {modalIdx === 0 && (
              <Box>
                <Box textAlign="center" mb={2}>
                  <Text fontSize="2xl" fontWeight="bold" display="inline-block" verticalAlign="middle" mr={2}>👥</Text>
                  <Text fontSize="xl" fontWeight="bold" display="inline-block" verticalAlign="middle">총 멤버: {realTimeMemberCount}명</Text>
                </Box>
                {membersLoading ? (
                  <Text color="gray.500" textAlign="center">멤버 데이터를 불러오는 중...</Text>
                ) : realTimeMembers && realTimeMembers.length > 0 ? (
                  <Box maxH="200px" overflowY="auto" mt={2} display="flex" flexWrap="wrap" gap={2} justifyContent="center">
                    {realTimeMembers
                      .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'))
                      .map((m) => (
                        <Box 
                          key={m.id} 
                          px={3} 
                          py={1} 
                          borderRadius="full" 
                          bg="#004ea8" 
                          color="white" 
                          fontWeight="medium" 
                          fontSize="xs" 
                          mr={2} 
                          mb={2} 
                          display="inline-block"
                          boxShadow="0 1px 3px rgba(0,0,0,0.1)"
                          _hover={{ 
                            transform: 'translateY(-1px)', 
                            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {m.name}
                        </Box>
                      ))}
                  </Box>
                ) : (
                  <Text color="gray.500" textAlign="center">멤버 데이터를 불러오는 중...</Text>
                )}
              </Box>
            )}
            {modalIdx !== 0 && modalIdx !== null && getDetailContent(modalIdx)}
          </ModalBody>
        </ModalContent>
      </Modal>

      <FloatingHelpButton onClick={memberManual.onOpen} storageKey="main" />
      <ManualModal isOpen={memberManual.isOpen} onClose={memberManual.onClose} variant="member" />

    </Box>
  );
} 