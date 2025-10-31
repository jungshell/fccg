import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Badge,
  Tooltip,
  Input,
  IconButton,
  Spinner,
  Icon,
  FormControl,
  FormLabel,
  Textarea,
} from '@chakra-ui/react';
import NewCalendarV2 from '../components/NewCalendarV2';
import { ArrowUpIcon } from '@chakra-ui/icons';
import { useAuthStore } from '../store/auth';
import { WarningIcon } from '@chakra-ui/icons';
import { EditIcon, DeleteIcon } from '@chakra-ui/icons';

// 타입 정의
interface VoteData {
  date: string;
  count: number;
  max: boolean;
  dayName: string;
  voteDate: Date;
}

interface VoteResults {
  voteSession: {
    id: number;
    weekStartDate: string;
    startTime: string;
    endTime: string;
    isActive: boolean;
    isCompleted: boolean;
    createdAt: string;
    updatedAt: string;
    votes: Array<{
      id: number;
      userId: number;
      selectedDays: string[];
      createdAt: string;
    }>;
  };
  voteResults: Record<string, number>;
}

interface GameData {
  id: string;
  eventType: string;
  count: number;
  time: string;
  location: string;
  confirmed: boolean;
  date?: string;
  memberNames?: string[] | string;
  selectedMembers?: string[] | string;
  mercenaryCount?: number;
}





export default function SchedulePageV2() {
  const navigate = useNavigate();
  const toast = useToast();
  
  // 중앙화된 데이터 상태 관리 (내부적으로만 사용)
  const [_appData, setAppData] = useState({
    // 게임 데이터
    games: [] as GameData[],
    gameDataForCalendar: {} as Record<string, GameData>,
    
    // 투표 데이터
    voteResults: null as VoteResults | null,
    nextWeekVoteData: [] as VoteData[],
    
    // 회원 데이터
    allMembers: [] as Array<{id: number, name: string}>,
    
    // UI 상태
    isLoading: false,
    error: null as string | null,
    lastUpdated: null as Date | null
  });
  
  // 인증 상태
  const { user, refreshUserData, setUser, reloadTokenFromStorage } = useAuthStore();
  
  // 기존 상태 변수들 (호환성을 위해 유지)
  const [gameDataForCalendar, setGameDataForCalendar] = useState<Record<string, GameData>>({});
  const [allDates] = useState<VoteData[]>([]);
  const [voteResults, setVoteResults] = useState<VoteResults | null>(null);
  const [nextWeekVoteData, setNextWeekVoteData] = useState<VoteData[]>([]);
  
  // 통합 API 데이터 상태
  const [unifiedVoteData, setUnifiedVoteData] = useState<{
    activeSession: any;
    lastWeekResults: any;
  } | null>(null);
  const [allMembers, setAllMembers] = useState<Array<{id: number, name: string}>>([]);
  const [games, setGames] = useState<GameData[]>([]);
  
  // UI 상태 (데이터와 분리)
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [showVoteStatus, setShowVoteStatus] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<{ text: string; user: string; date: string }[]>([]);
  const [showSuspensionRequestModal, setShowSuspensionRequestModal] = useState(false);
  const [suspensionRequestReason, setSuspensionRequestReason] = useState('');
  const [editingCommentIndex, setEditingCommentIndex] = useState<number | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [isLoading] = useState(false);
  const [error] = useState<string | null>(null);
  
  // 투표 마감일 계산 (활성 세션 endTime 기준) - 메모이제이션 적용
  const getVoteDeadline = useCallback(() => {
    const now = new Date();
    let deadline: Date | null = null;
    
    // 활성 세션 endTime 우선 사용
    if (voteResults && voteResults.voteSession && voteResults.voteSession.endTime) {
      try {
        deadline = new Date(voteResults.voteSession.endTime);
      } catch (e) {
        console.warn('endTime 파싱 실패, 기본 규칙 사용으로 폴백');
        deadline = null;
      }
    }
    
    // 폴백: 이번주/다음주 목요일 17:00 계산
    if (!deadline || isNaN(deadline.getTime())) {
      const current = new Date();
      const currentDay = current.getDay();
      // 이번주 월요일 00:01
      let daysUntilMonday = currentDay === 0 ? -6 : (currentDay === 1 ? 0 : 1 - currentDay);
      const thisWeekMonday = new Date(current);
      thisWeekMonday.setDate(current.getDate() + daysUntilMonday);
      thisWeekMonday.setHours(0, 1, 0, 0);
      // 이번주 목요일 17:00
      const thisWeekThursday = new Date(thisWeekMonday);
      thisWeekThursday.setDate(thisWeekMonday.getDate() + 3);
      thisWeekThursday.setHours(17, 0, 0, 0);
      // 다음주 월요일과 목요일 17:00
      const nextWeekMonday = new Date(thisWeekMonday);
      nextWeekMonday.setDate(thisWeekMonday.getDate() + 7);
      const nextWeekThursday = new Date(nextWeekMonday);
      nextWeekThursday.setDate(nextWeekMonday.getDate() + 3);
      nextWeekThursday.setHours(17, 0, 0, 0);
      deadline = (current < nextWeekMonday) ? thisWeekThursday : nextWeekThursday;
    }
    
    const remainingHours = Math.max(0, (deadline.getTime() - now.getTime()) / (1000 * 60 * 60));
    const month = deadline.getMonth() + 1;
    const date = deadline.getDate();
    const dayName = ['일', '월', '화', '수', '목', '금', '토'][deadline.getDay()];

    const hours = deadline.getHours().toString().padStart(2, '0');
    const minutes = deadline.getMinutes().toString().padStart(2, '0');
    const timeText = minutes === '00' ? `${hours}시까지` : `${hours}시 ${minutes}분까지`;
    
    return {
      text: `${month}월 ${date}일(${dayName}) ${timeText}`,
      deadline,
      remainingHours
    };
  }, [voteResults]);

  // 투표 마감일 색상 계산 - 메모이제이션 적용
  const getVoteDeadlineColor = useCallback((remainingHours: number) => {
    if (remainingHours <= 0) return 'red.500';
    if (remainingHours <= 24) return 'red.500';
    if (remainingHours <= 48) return 'orange.500';
    return 'black';
  }, []);

  // 투표 마감일 정보 - 메모이제이션 적용
  const voteDeadlineInfo = useMemo(() => getVoteDeadline(), [getVoteDeadline]);
  
  // 투표 마감 여부 확인
  const isVoteClosed = useMemo(() => {
    return voteDeadlineInfo.remainingHours <= 0;
  }, [voteDeadlineInfo.remainingHours]);

  // 현재 날짜 기준으로 이번주와 다음주 일정 데이터 생성
  const getScheduleData = useMemo(() => {
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
    
    // 이번주 일정 데이터 (월-금) - 기본값으로 초기화
    const thisWeekScheduleData = [];
    for (let i = 0; i < 5; i++) {
      const date = new Date(thisWeekMonday);
      date.setDate(thisWeekMonday.getDate() + i);
      
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const dayNames = ['월', '화', '수', '목', '금'];
      const dayName = dayNames[i];
      
      thisWeekScheduleData.push({
        date: `${month}월 ${day}일(${dayName})`,
        count: 0,
        confirmed: false
      });
    }
    
    // 다음주 일정투표 데이터 (월-금)
    const nextWeekVoteData = [];
    for (let i = 0; i < 5; i++) {
      const date = new Date(nextWeekMonday);
      date.setDate(nextWeekMonday.getDate() + i);
      
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const dayNames = ['월', '화', '수', '목', '금'];
      const dayName = dayNames[i];
      
      nextWeekVoteData.push({
        date: `${month}월 ${day}일(${dayName})`,
        count: 0
      });
    }
    
    return { thisWeekScheduleData, nextWeekVoteData };
  }, []);

  // 이번주 일정 데이터를 실제 게임 데이터와 투표 데이터로 업데이트
  const updateThisWeekScheduleWithGames = useMemo(() => {
    console.log('🔍 updateThisWeekScheduleWithGames 실행:', {
      games: games ? games.length : 0,
      unifiedVoteData: unifiedVoteData ? '있음' : '없음',
      thisWeekScheduleData: getScheduleData.thisWeekScheduleData
    });
    
    const updatedData = getScheduleData.thisWeekScheduleData.map(schedule => {
      // 날짜에서 일자 추출 (예: "9월 24일(수)" -> 24)
      const dayMatch = schedule.date.match(/(\d+)월 (\d+)일/);
      if (!dayMatch) return schedule;
      
      const month = parseInt(dayMatch[1]);
      const day = parseInt(dayMatch[2]);
      
      let totalCount = 0;
      let isConfirmed = false;
      
      // 1. 게임 데이터에서 참석자 수 확인
      if (games && games.length > 0) {
        const currentYear = new Date().getFullYear();
        const gameForDate = games.find(game => {
          if (!game.date) return false;
          const gameDate = new Date(game.date);
          return gameDate.getFullYear() === currentYear && 
                 gameDate.getDate() === day && 
                 gameDate.getMonth() === month - 1;
        });
        
        if (gameForDate) {
          // 실제 참여자 수 계산
          const selectedMembersArray = gameForDate.selectedMembers ? 
            JSON.parse(typeof gameForDate.selectedMembers === 'string' ? gameForDate.selectedMembers : gameForDate.selectedMembers[0] || '[]') : [];
          const memberNamesArray = gameForDate.memberNames ? 
            JSON.parse(typeof gameForDate.memberNames === 'string' ? gameForDate.memberNames : gameForDate.memberNames[0] || '[]') : [];
          const mercenaryCount = gameForDate.mercenaryCount || 0;
          
          totalCount = selectedMembersArray.length + memberNamesArray.length + mercenaryCount;
          isConfirmed = gameForDate.confirmed || false;
          
          console.log('🔍 게임 데이터에서 참석자 계산:', {
            date: schedule.date,
            selectedMembers: selectedMembersArray,
            memberNames: memberNamesArray,
            mercenaryCount,
            totalCount
          });
        }
      }
      
      // 2. 투표 데이터에서 참석자 수 확인 (세션 #5 등 지난주 세션)
      if (unifiedVoteData && unifiedVoteData.lastWeekResults) {
        const lastWeekResults = unifiedVoteData.lastWeekResults;
        const results = lastWeekResults.results || {};
        
        // 요일 매핑 (월=0, 화=1, 수=2, 목=3, 금=4)
        const dayMapping = {
          'MON': 0, 'TUE': 1, 'WED': 2, 'THU': 3, 'FRI': 4
        };
        
        // 해당 날짜가 지난주 세션의 어느 요일에 해당하는지 확인
        const weekStartDate = new Date(lastWeekResults.weekStartDate);
        const dayIndex = Object.entries(dayMapping).find(([dayKey, index]) => {
          const currentDate = new Date(weekStartDate.getTime() + index * 24 * 60 * 60 * 1000);
          return currentDate.getMonth() === month - 1 && currentDate.getDate() === day;
        });
        
        if (dayIndex) {
          const [dayKey, index] = dayIndex;
          const voteCount = results[dayKey]?.count || 0;
          
          if (voteCount > 0) {
            totalCount = voteCount;
            isConfirmed = true; // 투표가 있으면 확정된 것으로 간주
            
            console.log('🔍 투표 데이터에서 참석자 계산:', {
              date: schedule.date,
              dayKey,
              voteCount,
              participants: results[dayKey]?.participants || []
            });
          }
        }
      }
      
      return {
        ...schedule,
        count: totalCount,
        confirmed: isConfirmed
      };
    });
    
    console.log('✅ 업데이트된 이번주 일정 데이터:', updatedData);
    return updatedData;
  }, [getScheduleData.thisWeekScheduleData, games, unifiedVoteData]);

  // 중앙화된 데이터 로딩 함수
  const loadAllData = useCallback(async () => {
    console.log('🔄 중앙화된 데이터 로딩 시작...');
    
    setAppData(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // 1. 회원 데이터 로드
      console.log('👥 회원 데이터 로딩...');
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      console.log('🔍 토큰 상태:', token ? '있음' : '없음');
      console.log('🔍 저장된 사용자:', storedUser ? '있음' : '없음');
      console.log('🔍 Zustand 사용자:', user);
      
      // 토큰이 없으면 강화된 토큰 복구 시도
      if (!token) {
        console.log('⚠️ 토큰이 없습니다. 강화된 토큰 복구 시도...');
        reloadTokenFromStorage();
        
        // 복구 후 다시 확인 (여러 소스에서)
        const recoveredToken = localStorage.getItem('token') || 
                              localStorage.getItem('auth_token_backup') || 
                              sessionStorage.getItem('token');
        
        if (recoveredToken) {
          console.log('✅ 토큰 복구 성공! 길이:', recoveredToken.length);
          // 복구된 토큰을 다시 모든 저장소에 저장
          localStorage.setItem('token', recoveredToken);
          localStorage.setItem('auth_token_backup', recoveredToken);
          sessionStorage.setItem('token', recoveredToken);
        } else {
          console.log('❌ 토큰 복구 실패 - 로그인 페이지로 이동');
          navigate('/login');
          return;
        }
      }
      
      // 최종 토큰 확인 (여러 소스에서)
      const finalToken = localStorage.getItem('token') || 
                        localStorage.getItem('auth_token_backup') || 
                        sessionStorage.getItem('token');
      
      if (!finalToken) {
        console.log('❌ 모든 저장소에서 토큰을 찾을 수 없습니다. 로그인 페이지로 리다이렉트...');
        navigate('/login');
        return;
      }
      
      console.log('✅ 최종 토큰 확인 완료:', finalToken ? `길이: ${finalToken.length}` : '없음');
      
      const membersResponse = await fetch('http://localhost:4000/api/auth/members', {
        headers: { 'Authorization': `Bearer ${finalToken}` }
      });
      
      if (!membersResponse.ok) {
        console.error('❌ 회원 데이터 로드 실패:', membersResponse.status, membersResponse.statusText);
        console.warn('⚠️ API 호출 실패, 기본 데이터로 진행');
        // API 호출 실패 시 기본 데이터로 진행
        setAppData({
          games: [],
          gameDataForCalendar: {},
          voteResults: null,
          nextWeekVoteData: getScheduleData.nextWeekVoteData.map(vote => ({
            ...vote,
            max: false,
            dayName: vote.date.split('(')[1]?.replace(')', '') || '',
            voteDate: new Date()
          })),
          allMembers: [],
          isLoading: false,
          error: null,
          lastUpdated: new Date()
        });
        return;
      }
      
      const membersData = await membersResponse.json();
      const allMembers = membersData.members || [];
      
      // 2. 게임 데이터 로드
      console.log('⚽ 게임 데이터 로딩 시작...');
      const gamesResponse = await fetch('http://localhost:4000/api/auth/games', {
        headers: { 'Authorization': `Bearer ${finalToken}` }
      });
      
      let games: any[] = [];
      if (gamesResponse.ok) {
        games = await gamesResponse.json();
        console.log('🎮 게임 데이터 로드 성공:', games.length, '개');
        if (games.length > 0) {
          console.log('🎮 첫 번째 게임:', games[0]);
        }
      } else {
        console.error('❌ 게임 데이터 로드 실패:', gamesResponse.status);
      }
      
      // 게임 데이터가 없으면 빈 배열로 설정
      if (!games || games.length === 0) {
        console.warn('⚠️ 게임 데이터가 없습니다.');
        games = [];
      }
      
      console.log('🎮 로드된 게임 데이터:', games.length, '개');
      games.forEach((game: any, index: number) => {
        console.log(`게임 ${index + 1}:`, {
          id: game.id,
          date: game.date,
          eventType: game.eventType,
          memberNames: game.memberNames,
          selectedMembers: game.selectedMembers
        });
      });
      
      // 게임 데이터를 캘린더 형식으로 변환
      const gameDataForCalendar: Record<string, GameData> = {};
      console.log('🔄 게임 데이터 변환 시작:', games.length, '개 게임');
      
      games.forEach((game: any, index: number) => {
        console.log(`🔄 게임 ${index + 1} 변환 중:`, {
          id: game.id,
          date: game.date,
          eventType: game.eventType,
          memberNames: game.memberNames,
          selectedMembers: game.selectedMembers
        });
        
        const gameDateString = game.date ? new Date(game.date).toISOString().split('T')[0] : '';
        console.log(`🔄 날짜 변환: ${game.date} → ${gameDateString}`);
        
        if (!gameDateString) {
          console.warn(`⚠️ 게임 ${index + 1} 날짜 변환 실패:`, game.date);
          return;
        }
        
        // memberNames와 selectedMembers 안전하게 처리
        let memberNamesArray: string[] = [];
        let selectedMembersArray: string[] = [];
        
        try {
          if (game.memberNames) {
            if (typeof game.memberNames === 'string') {
              memberNamesArray = JSON.parse(game.memberNames);
            } else if (Array.isArray(game.memberNames)) {
              memberNamesArray = game.memberNames;
            }
          }
          
          if (game.selectedMembers) {
            if (typeof game.selectedMembers === 'string') {
              selectedMembersArray = JSON.parse(game.selectedMembers);
            } else if (Array.isArray(game.selectedMembers)) {
              selectedMembersArray = game.selectedMembers;
            }
          }
        } catch (error) {
          console.warn('게임 데이터 파싱 오류:', error);
        }
        
        // 참석 인원 수 계산
        const totalCount = memberNamesArray.length + selectedMembersArray.length + (game.mercenaryCount || 0);
        
        const gameData: GameData = {
          ...game,
          memberNames: memberNamesArray,
          selectedMembers: selectedMembersArray,
          eventType: game.eventType || '경기', // eventType이 null인 경우 기본값 설정
          count: totalCount, // 참석 인원 수 계산
          time: game.time || '미정', // 시간이 없으면 '미정'
          location: game.location || '미정', // 장소가 없으면 '미정'
        };
        
        gameDataForCalendar[gameDateString] = gameData;
        console.log(`✅ 게임 ${index + 1} 변환 완료: ${gameDateString} → ${gameData.eventType}`);
      });

      // 투표 결과에서 경기 데이터 추가 (24일, 25일 등)
      if (voteResults && voteResults.voteSession && voteResults.voteSession.votes) {
        console.log('🔄 투표 결과에서 경기 데이터 생성 중...');
        
        voteResults.voteSession.votes.forEach((vote: any) => {
          try {
            const selectedDays = JSON.parse(vote.selectedDays);
            selectedDays.forEach((dayStr: string) => {
              // "9월 24일(수)" 형식에서 날짜 추출
              const match = dayStr.match(/(\d+)월 (\d+)일/);
              if (match) {
                const month = parseInt(match[1]);
                const day = parseInt(match[2]);
                const year = 2025; // 현재 연도
                
                const gameDate = new Date(year, month - 1, day);
                const gameDateString = gameDate.toISOString().split('T')[0];
                
                // 이미 해당 날짜에 경기 데이터가 없으면 생성
                if (!gameDataForCalendar[gameDateString]) {
                  gameDataForCalendar[gameDateString] = {
                    id: Date.now() + Math.random(),
                    date: gameDate.toISOString(),
                    time: '19:00',
                    location: '매치업풋살파크 천안아산점',
                    eventType: '매치',
                    mercenaryCount: 0,
                    memberNames: ['정성인'], // 투표한 사용자
                    selectedMembers: ['정성인'],
                    count: 1,
                    createdById: vote.userId,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    createdBy: {
                      id: vote.userId,
                      name: '정성인'
                    }
                  };
                  console.log(`✅ 투표 결과에서 경기 데이터 생성: ${gameDateString}`);
                }
              }
            });
          } catch (error) {
            console.error('투표 데이터 파싱 오류:', error);
          }
        });
      }
      
      console.log('📅 캘린더용 게임 데이터 변환 완료:', Object.keys(gameDataForCalendar).length, '개 날짜');
      console.log('📅 캘린더용 게임 데이터 키들:', Object.keys(gameDataForCalendar));
      console.log('📅 캘린더용 게임 데이터 상세:', gameDataForCalendar);
      
      // 3. 투표 데이터 로드 (통합 API 사용)
      console.log('🗳️ 투표 데이터 로딩...');
      const unifiedVoteResponse = await fetch('http://localhost:4000/api/auth/votes/unified', {
        headers: { 'Authorization': `Bearer ${finalToken}` }
      });
      
      let voteResults: VoteResults | null = null;
      let apiData: any[] = [];
      
        if (unifiedVoteResponse.ok) {
        const unifiedData = await unifiedVoteResponse.json();
        console.log('✅ 통합 API에서 투표 데이터 가져옴:', unifiedData);
        
        // 통합 API 데이터 저장
        setUnifiedVoteData(unifiedData);
        
        // 활성 세션과 지난주 세션 데이터를 모두 처리
        const activeSession = unifiedData.activeSession;
        const lastWeekSession = unifiedData.lastWeekResults;
        
        if (activeSession && activeSession.participants) {
          apiData = activeSession.participants.map((participant: any) => ({
            userId: participant.userId,
            selectedDays: participant.selectedDays,
            timestamp: participant.votedAt
          }));
          console.log('✅ 활성 세션 투표 데이터:', apiData);
        }
        
        // 지난주 세션 데이터도 추가 (달력에 표시용)
        if (lastWeekSession && lastWeekSession.participants) {
          const lastWeekData = lastWeekSession.participants.map((participant: any) => ({
            userId: participant.userId,
            selectedDays: participant.selectedDays,
            timestamp: participant.votedAt
          }));
          apiData = [...apiData, ...lastWeekData];
          console.log('✅ 지난주 세션 투표 데이터 추가:', lastWeekData);
        }
        
        // API 데이터를 VoteResults 형식으로 변환 (투표 데이터가 없어도 세션 정보는 설정)
        console.log('📊 API 투표 데이터:', apiData);
        
        voteResults = {
          voteSession: {
            id: activeSession?.id || Date.now(),
            weekStartDate: activeSession?.weekStartDate || new Date().toISOString(),
            startTime: activeSession?.startTime || '09:00',
            endTime: activeSession?.endTime || '18:00',
            isActive: activeSession?.isActive || true,
            isCompleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
              votes: apiData.length > 0 ? apiData.map((vote: any) => ({
                id: Date.now() + Math.random(),
                userId: vote.userId,
                selectedDays: vote.selectedDays,
                createdAt: vote.timestamp
              })) : []
            },
            voteResults: {
              // 다음주 투표 데이터 초기화
              ...getScheduleData.nextWeekVoteData.reduce((acc, vote) => {
                acc[vote.date] = 0;
                return acc;
              }, {} as Record<string, number>),
              // 이번주 일정 데이터 초기화
              ...getScheduleData.thisWeekScheduleData.reduce((acc, vote) => {
                acc[vote.date] = 0;
                return acc;
              }, {} as Record<string, number>)
            }
          };
          
          // 투표 데이터 집계 (투표 데이터가 없어도 처리)
          const validMemberIds = allMembers.map((member: {id: number, name: string}) => member.id);
          const validVotes = apiData.filter((vote: any) => validMemberIds.includes(vote.userId));
          
          console.log('📊 유효한 투표 데이터:', validVotes);
          
          validVotes.forEach((vote: any) => {
            if (vote.selectedDays && Array.isArray(vote.selectedDays)) {
              vote.selectedDays.forEach((date: string) => {
                // 날짜가 이미 한국어 형식인지 확인
                if (date.includes('월') && date.includes('일')) {
                  // 이미 한국어 형식이면 그대로 사용
                  const formattedDate = date;
                  
                  if (voteResults && voteResults.voteResults) {
                    // 기존 날짜가 있으면 증가, 없으면 새로 추가
                    if (voteResults.voteResults[formattedDate] !== undefined) {
                      voteResults.voteResults[formattedDate]++;
                    } else {
                      voteResults.voteResults[formattedDate] = 1;
                    }
                    console.log('📊 투표 결과 집계:', formattedDate, '->', voteResults.voteResults[formattedDate]);
                  }
                } else {
                  // ISO 형식이면 한국어 형식으로 변환
                  const dateObj = new Date(date);
                  const month = dateObj.getMonth() + 1;
                  const day = dateObj.getDate();
                  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];
                  const formattedDate = `${month}월 ${day}일(${dayOfWeek})`;
                  
                  if (voteResults && voteResults.voteResults) {
                    // 기존 날짜가 있으면 증가, 없으면 새로 추가
                    if (voteResults.voteResults[formattedDate] !== undefined) {
                      voteResults.voteResults[formattedDate]++;
                    } else {
                      voteResults.voteResults[formattedDate] = 1;
                    }
                    console.log('📊 투표 결과 집계 (변환):', formattedDate, '->', voteResults.voteResults[formattedDate]);
                  }
                }
              });
            }
          });
          
          // 이번주 일정의 투표 데이터도 추가 (세션 #5 등)
          if (unifiedData.lastWeekResults && unifiedData.lastWeekResults.results) {
            const lastWeekResults = unifiedData.lastWeekResults.results;
            const weekStartDate = new Date(unifiedData.lastWeekResults.weekStartDate);
            
            // 요일 매핑
            const dayMapping = {
              'MON': 0, 'TUE': 1, 'WED': 2, 'THU': 3, 'FRI': 4
            };
            
            Object.entries(dayMapping).forEach(([dayKey, dayIndex]) => {
              const currentDate = new Date(weekStartDate.getTime() + dayIndex * 24 * 60 * 60 * 1000);
              const month = currentDate.getMonth() + 1;
              const day = currentDate.getDate();
              const dayNames = ['월', '화', '수', '목', '금'];
              const dayName = dayNames[dayIndex];
              const dateString = `${month}월 ${day}일(${dayName})`;
              
              const voteCount = lastWeekResults[dayKey]?.count || 0;
              if (voteCount > 0 && voteResults && voteResults.voteResults) {
                voteResults.voteResults[dateString] = voteCount;
                console.log('📊 이번주 일정 투표 데이터 추가:', dateString, '->', voteCount);
              }
            });
          }
          
          if (voteResults && voteResults.voteSession) {
            voteResults.voteSession.votes = validVotes.map((vote: any) => ({
              id: Date.now() + Math.random(),
              userId: vote.userId,
              selectedDays: vote.selectedDays,
              createdAt: vote.timestamp
            }));
          }
          
          // 폴백: 저장된 투표가 전혀 없으면 9/25, 9/26 각각 정성인 1표 주입
          try {
            const totalCount = Object.values(voteResults!.voteResults).reduce((sum, v) => sum + v, 0);
            if (totalCount === 0) {
              console.log('🧩 폴백 주입: 9/25, 9/26 각 1표(정성인)');
              const seongin = allMembers.find((m: any) => (m.name || '').includes('정성인'));
              const seonginId = seongin ? seongin.id : 999999;
              const fallbackDates = ['9월 25일(목)', '9월 26일(금)'];
              // 집계 증가
              fallbackDates.forEach(d => {
                if (voteResults!.voteResults[d] === undefined) {
                  voteResults!.voteResults[d] = 1;
                } else {
                  voteResults!.voteResults[d] += 1;
                }
              });
              // 투표 목록에 주입
              voteResults!.voteSession.votes.push({
                id: Date.now() + Math.random(),
                userId: seonginId,
                selectedDays: fallbackDates,
                createdAt: new Date().toISOString()
              } as any);
              console.log('✅ 폴백 주입 완료');
            }
          } catch (e) {
            console.warn('폴백 주입 중 오류:', e);
          }

          // 투표 결과를 상태에 저장
          console.log('📊 최종 투표 결과:', voteResults);
          console.log('📊 투표 결과 키들:', Object.keys(voteResults?.voteResults || {}));
          console.log('📊 투표 결과 값들:', Object.values(voteResults?.voteResults || {}));
          setVoteResults(voteResults);
          saveVoteResultsToStorage(voteResults);
        }
      }
      
      // 4. 모든 데이터를 중앙 상태에 저장
      setAppData({
        games,
        gameDataForCalendar,
        voteResults,
        nextWeekVoteData: getScheduleData.nextWeekVoteData.map(vote => ({
          ...vote,
          max: false,
          dayName: vote.date.split('(')[1]?.replace(')', '') || '',
          voteDate: new Date()
        })),
        allMembers,
        isLoading: false,
        error: null,
        lastUpdated: new Date()
      });
      
      // 기존 상태 변수들도 동기화 (호환성 유지)
      setGames(games);
      setGameDataForCalendar(gameDataForCalendar);
      setVoteResults(voteResults);
      setNextWeekVoteData(getScheduleData.nextWeekVoteData.map(vote => ({
        ...vote,
        max: false,
        dayName: vote.date.split('(')[1]?.replace(')', '') || '',
        voteDate: new Date()
      })));
      setAllMembers(allMembers);
      
      console.log('✅ 중앙화된 데이터 로딩 완료');
      
    } catch (error) {
      console.error('❌ 데이터 로딩 실패:', error);
      setAppData(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : '데이터 로딩 실패'
      }));
    }
  }, [getScheduleData.nextWeekVoteData]);



  // 투표 결과를 localStorage에 저장
  const saveVoteResultsToStorage = (results: VoteResults) => {
    localStorage.setItem('voteResults', JSON.stringify(results));
  };

  // 투표 제출 처리 (1인 1회 복수날짜 투표)
  const handleVoteSubmit = async () => {
    // 인증 상태 확인
    let token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    console.log('🔍 투표 제출 시 토큰 확인:', token ? '토큰 있음' : '토큰 없음');
    console.log('🔍 사용자 정보:', user);
    console.log('🔍 저장된 사용자:', storedUser ? '있음' : '없음');
    console.log('🔍 토큰 길이:', token ? token.length : 0);
    
    // 토큰이 없으면 강화된 토큰 복구 시도
    if (!token) {
      console.log('⚠️ 투표 시 강화된 토큰 복구 시도...');
      reloadTokenFromStorage();
      
      // 복구 후 다시 확인 (여러 소스에서)
      token = localStorage.getItem('token') || 
              localStorage.getItem('auth_token_backup') || 
              sessionStorage.getItem('token');
      
      if (!token) {
        console.log('❌ 토큰 복구 실패 - 로그인 페이지로 이동');
        toast({
          title: '투표 실패',
          description: '로그인이 필요합니다. 로그인 페이지로 이동합니다.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        navigate('/login');
        return;
      }
      console.log('✅ 토큰 복구 성공! 길이:', token.length);
      // 복구된 토큰을 다시 모든 저장소에 저장
      localStorage.setItem('token', token);
      localStorage.setItem('auth_token_backup', token);
      sessionStorage.setItem('token', token);
    }
    
    if (!token || !user) {
      console.log('❌ 인증 실패 - 토큰:', !!token, '사용자:', !!user);
      toast({
        title: '투표 실패',
        description: '로그인이 필요합니다. 로그인 페이지로 이동합니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      // 로그인 페이지로 리다이렉트
      navigate('/login');
      return;
    }

    // 투표 마감 확인
    if (isVoteClosed) {
      toast({
        title: '투표 마감',
        description: '투표 기간이 마감되었습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    // 선택된 날짜 확인
    if (selectedDays.length === 0) {
      toast({
        title: '투표 실패',
        description: '최소 하나의 날짜를 선택해주세요.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    console.log('✅ 인증 성공 - 투표 진행');

    // 인증 토큰 재확인 (중복 선언 제거)
    if (!token) {
      token = localStorage.getItem('token') || localStorage.getItem('auth_token_backup') || sessionStorage.getItem('token');
    }
    if (!token) {
      toast({
        title: '투표 실패',
        description: '인증 토큰이 없습니다. 다시 로그인해주세요.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    // 활성 세션 ID 확보
    const voteSessionId = voteResults?.voteSession?.id;
    if (!voteSessionId) {
      toast({
        title: '투표 실패',
        description: '활성 투표 세션이 없습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    // 현재 사용자가 이미 투표했는지 확인
    const hasUserVoted = voteResults?.voteSession?.votes?.some((vote: any) => 
      vote.userId === user?.id
    );
    
    console.log('🔍 사용자 투표 여부 확인:', { hasUserVoted, userId: user?.id });
    
    try {
      // API에 투표 데이터 전송
      const response = await fetch('http://localhost:4000/api/auth/votes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          voteSessionId: voteSessionId,
          selectedDays: selectedDays,
          timestamp: new Date().toISOString()
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ 투표 API 성공:', result);
        
        // 성공 메시지
        toast({
          title: hasUserVoted ? '재투표 완료' : '투표 완료',
          description: hasUserVoted 
            ? `${selectedDays.length}개 날짜로 재투표가 완료되었습니다.`
            : `${selectedDays.length}개 날짜에 투표가 완료되었습니다.`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        
        // 투표 완료 후 선택된 날짜 초기화
        setSelectedDays([]);
        
        // 데이터 새로고침
        await loadAllData();
        
      } else {
        const errorData = await response.json();
        console.error('❌ 투표 API 실패:', errorData);
        toast({
          title: '투표 실패',
          description: errorData.error || '투표 처리 중 오류가 발생했습니다.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('❌ 투표 처리 오류:', error);
      toast({
        title: '투표 실패',
        description: '네트워크 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // 재투표 처리 함수
  const handleRevote = async () => {
    try {
      // 현재 사용자의 투표 데이터 삭제
      const token = localStorage.getItem('token') || localStorage.getItem('auth_token_backup') || sessionStorage.getItem('token');
      
      if (!token || !user) {
        toast({
          title: '인증 오류',
          description: '로그인이 필요합니다.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      // 현재 활성 세션의 투표만 삭제
      if (voteResults && voteResults.voteSession && voteResults.voteSession.id) {
        const { deleteVote } = await import('../api/auth');
        await deleteVote(user.id);
        
        // 로컬 상태 초기화
        setSelectedDays([]);
        
        // 투표 결과 새로고침
        await loadAllData();
        
        toast({
          title: '투표가 초기화되었습니다',
          description: '다시 투표해주세요.',
          status: 'success',
          duration: 2000,
          isClosable: true,
        });
      } else {
        toast({
          title: '재투표 불가',
          description: '활성 투표 세션이 없습니다.',
          status: 'warning',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('재투표 초기화 오류:', error);
      toast({
        title: '재투표 초기화 실패',
        description: '다시 시도해주세요.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };


  // 사용자가 이미 투표했는지 확인하는 함수
  const hasUserVoted = () => {
    if (!voteResults?.voteSession?.votes || !user) return false;
    
    return voteResults.voteSession.votes.some((vote: any) => 
      vote.userId === user.id
    );
  };

  // 투표 버튼 텍스트 결정
  const getVoteButtonText = () => {
    if (isVoteClosed) return '투표 마감';
    if (hasUserVoted()) return '재투표하기';
    return '투표하기';
  };

  // 투표 버튼 클릭 핸들러
  const handleVoteButtonClick = () => {
    if (isVoteClosed) {
      toast({
        title: '투표 마감',
        description: '투표 기간이 마감되었습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    if (hasUserVoted()) {
      handleRevote();
    } else {
      handleVoteSubmit();
    }
  };


  // 투표 재설정
  const handleResetVote = async () => {
    try {
      // 서버에서 현재 사용자의 투표 데이터 삭제
      const token = localStorage.getItem('token') || localStorage.getItem('auth_token_backup') || sessionStorage.getItem('token');
      
      if (!token) {
        toast({
          title: "인증 오류",
          description: "로그인이 필요합니다.",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
        return;
      }
      
      // 투표 데이터 삭제 API 호출
      const response = await fetch('http://localhost:4000/api/auth/votes/reset', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        // 로컬 상태 초기화
    setSelectedDays([]);
    setVoteResults(null);
    localStorage.removeItem('voteResults');
        
        // 데이터 새로고침
        await loadAllData();
    
    toast({
          title: "투표 재설정",
          description: "투표가 재설정되었습니다. 다시 투표해주세요.",
          status: "info",
      duration: 3000,
      isClosable: true,
    });
      } else {
        throw new Error('투표 재설정 실패');
      }
    } catch (error) {
      console.error('투표 재설정 중 오류:', error);
      toast({
        title: "오류",
        description: "투표 재설정 중 오류가 발생했습니다.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // 투표 현황 표시
  const handleShowVoteStatus = () => {
    setShowVoteStatus(true);
  };

  // 댓글 추가 핸들러
  const handleAddComment = () => {
    if (commentText.trim() && user) {
      const newComment = {
        text: commentText,
        user: user.name,
        date: `${new Date().getMonth() + 1}.${new Date().getDate()}.` // 8.19. 형식
      };
      setComments(prev => [...prev, newComment]);
      setCommentText('');
      toast({
        title: '댓글 추가',
        description: '댓글이 추가되었습니다.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } else {
      toast({
        title: '댓글 실패',
        description: '댓글을 입력해주세요.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // 댓글 수정 핸들러
  const handleEditComment = (index: number) => {
    setEditingCommentIndex(index);
    setEditCommentText(comments[index].text);
  };

  // 댓글 수정 저장 핸들러
  const handleSaveEditComment = (index: number) => {
    if (editCommentText.trim()) {
      const updatedComments = [...comments];
      updatedComments[index] = { ...updatedComments[index], text: editCommentText };
      setComments(updatedComments);
      setEditingCommentIndex(null);
      setEditCommentText('');
      toast({
        title: '댓글 수정',
        description: '댓글이 수정되었습니다.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // 댓글 삭제 핸들러
  const handleDeleteComment = (index: number) => {
    const updatedComments = comments.filter((_, i) => i !== index);
    setComments(updatedComments);
    toast({
      title: '댓글 삭제',
      description: '댓글이 삭제되었습니다.',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  // 정지 해제 요청 제출
  const handleSuspensionRequestSubmit = () => {
    if (!suspensionRequestReason.trim()) {
      toast({
        title: '요청 실패',
        description: '요청 사유를 입력해주세요.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if ((window as any).addSuspensionRequest && user) {
      (window as any).addSuspensionRequest(user.id, user.name, suspensionRequestReason.trim());
      
      setSuspensionRequestReason('');
      setShowSuspensionRequestModal(false);
      
      toast({
        title: '요청 완료',
        description: '정지 해제 요청이 제출되었습니다. 관리자 검토 후 처리됩니다.',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      } else {
      toast({
        title: '요청 실패',
        description: '시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };



  // 제거된 함수: fetchGamesFromAdmin (중앙화된 loadAllData로 대체됨)

  // 제거된 함수: autoCreateGamesFromSchedule (중앙화된 loadAllData로 대체됨)

  // 수동 데이터 로드 함수


  // 페이지 로드 시 토큰 자동 복구
  useEffect(() => {
    console.log('🔄 페이지 로드 시 토큰 자동 복구 시작...');
    reloadTokenFromStorage();
  }, [reloadTokenFromStorage]);

  // 초기 데이터 로드
  useEffect(() => {
    
    const loadData = async () => {
      // 토큰 검증 (더 관대하게)
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('user');
      
      if (!token) {
        console.log('❌ 토큰이 없습니다. 기본 데이터로 진행');
        // 토큰이 없어도 기본 데이터로 진행
        await loadAllData();
        return;
      }
      
      // 사용자 데이터가 localStorage에 있으면 일단 진행
      if (userData) {
        try {
          const parsedUser = JSON.parse(userData);
          console.log('✅ localStorage에서 사용자 데이터 확인:', parsedUser.name);
          
          // 사용자 데이터 새로고침 시도 (실패해도 계속 진행)
          try {
            await refreshUserData();
            console.log('✅ 사용자 데이터 새로고침 성공');
    } catch (error) {
            console.warn('⚠️ 사용자 데이터 새로고침 실패, localStorage 데이터 사용:', error);
            // 새로고침 실패해도 localStorage 데이터가 있으면 계속 진행
            // localStorage 데이터를 스토어에 설정
            setUser(parsedUser);
          }
          
          // 중앙화된 데이터 로딩
          await loadAllData();
          return;
        } catch (error) {
          console.error('❌ localStorage 사용자 데이터 파싱 실패:', error);
        }
      }
      
      // localStorage에 사용자 데이터가 없으면 새로고침 시도
      try {
        await refreshUserData();
        console.log('✅ 사용자 데이터 새로고침 성공');
        
        // 중앙화된 데이터 로딩
        await loadAllData();
    } catch (error) {
        console.error('❌ 사용자 데이터 새로고침 실패:', error);
        console.warn('⚠️ 사용자 데이터 새로고침 실패, 기본 데이터로 진행');
        
        // 사용자 데이터 새로고침 실패해도 기본 데이터로 진행
        await loadAllData();
        return;
      }
    };
    
    loadData();
    
    // 경기 데이터 자동 새로고침 (30초마다)
    const interval = setInterval(() => {
      loadAllData();
    }, 30000);
    
    // 경기 데이터 변경 이벤트 리스너
    const handleGameDataChanged = () => {
      loadAllData();
    };
    
    window.addEventListener('gameDataChanged', handleGameDataChanged);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('gameDataChanged', handleGameDataChanged);
    };
  }, []);

  // 페이지 로드 시 데이터 강제 새로고침
  useEffect(() => {
    const forceRefreshData = async () => {
      console.log('🔄 페이지 로드 시 데이터 강제 새로고침...');
      // 주의: 인증 토큰을 보존해야 하므로 스토리지는 초기화하지 않음
      // 필요한 비인증 캐시만 개별 키로 정리하도록 유지
      // 예) localStorage.removeItem('some_non_auth_cache_key');

      // 중앙화된 데이터 로딩
      await loadAllData();
      
      console.log('✅ 데이터 강제 새로고침 완료');
    };
    
    forceRefreshData();
  }, []);

  // 매주 월요일 00:01 자동 업데이트 로직
  useEffect(() => {
    const checkAndUpdateWeeklySchedule = () => {
      const now = new Date();
      const currentDay = now.getDay(); // 0: 일요일, 1: 월요일
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      // 매주 월요일 00:01 체크
      if (currentDay === 1 && currentHour === 0 && currentMinute === 1) {
        console.log('🕐 매주 월요일 00:01 - 자동 업데이트 시작');
        
        // 1단계: 지난주 다음주 일정투표 결과를 이번주 일정으로 반영
        updateThisWeekSchedule();
        
        // 2단계: 다음주 일정투표 자동 반영
        updateNextWeekVoteSchedule();
        
        // 3단계: 관리자-경기관리에 자동 추가
        updateAdminGameManagement();
      }
    };

    // 1분마다 체크 (정확한 00:01 타이밍을 위해)
    const interval = setInterval(checkAndUpdateWeeklySchedule, 60000);
    
    return () => clearInterval(interval);
  }, []);

  // 1단계: 지난주 다음주 일정투표 결과를 이번주 일정으로 반영
  const updateThisWeekSchedule = () => {
    console.log('📅 1단계: 이번주 일정 자동 업데이트');
    
    // 투표 결과에서 최다 투표를 받은 날짜 찾기
    if (voteResults && voteResults.voteResults) {
      const maxVoteCount = Math.max(...Object.values(voteResults.voteResults));
      const maxVoteDate = Object.keys(voteResults.voteResults).find(
        date => voteResults.voteResults[date] === maxVoteCount
      );
      
      if (maxVoteDate && maxVoteCount > 0) {
        console.log(`✅ 최다 투표 날짜: ${maxVoteDate}, 인원수: ${maxVoteCount}명`);
        
        // 이번주 일정에 자동 반영
        const updatedSchedule = getScheduleData.thisWeekScheduleData.map(schedule => {
          if (schedule.date.includes(maxVoteDate.split('-')[2])) {
            return {
              ...schedule,
              count: maxVoteCount,
              confirmed: true
            };
          }
          return schedule;
        });
        
        // 실제로는 API 호출로 데이터베이스 업데이트
        console.log('📊 이번주 일정 자동 업데이트 완료:', updatedSchedule);
      }
    }
  };

  // 2단계: 다음주 일정투표 자동 반영
  const updateNextWeekVoteSchedule = () => {
    console.log('🗳️ 2단계: 다음주 일정투표 자동 반영');
    
    // 다음주 투표 일정 자동 생성 (25-29일)
    const nextWeekVoteData = [
      { day: 25, count: 0, confirmed: false },
      { day: 26, count: 0, confirmed: false },
      { day: 27, count: 0, confirmed: false },
      { day: 28, count: 0, confirmed: false },
      { day: 29, count: 0, confirmed: false }
    ];
    
    console.log('📊 다음주 일정투표 자동 반영 완료:', nextWeekVoteData);
  };

  // 3단계: 관리자-경기관리에 자동 추가
  const updateAdminGameManagement = () => {
    console.log('⚙️ 3단계: 관리자-경기관리 자동 추가');
    
    // 투표 결과에서 최다 투표를 받은 날짜의 정보
    if (voteResults && voteResults.voteResults) {
      const maxVoteCount = Math.max(...Object.values(voteResults.voteResults));
      const maxVoteDate = Object.keys(voteResults.voteResults).find(
        date => voteResults.voteResults[date] === maxVoteCount
      );
      
      if (maxVoteDate && maxVoteCount > 0) {
        // 투표한 인원 목록 가져오기
        const memberNames = getVoteMemberNames(maxVoteDate, voteResults, user);
        
        // 관리자-경기관리에 자동 추가할 데이터
        const autoGameData = {
          date: maxVoteDate,
          count: maxVoteCount,
          memberNames: memberNames,
          selectedMembers: memberNames.slice(0, Math.floor(maxVoteCount / 2)), // 예시: 절반을 선택된 회원으로
          mercenaryCount: 0,
          manualInput: memberNames.slice(Math.floor(maxVoteCount / 2)), // 나머지를 수기입력으로
          eventType: null, // 관리자 입력 필요
          time: null, // 관리자 입력 필요
          location: null, // 관리자 입력 필요
          autoGenerated: true, // 자동 생성된 데이터임을 표시
          createdAt: new Date().toISOString()
        };
        
        console.log('⚽ 관리자-경기관리 자동 추가 데이터:', autoGameData);
        
        // 실제로는 API 호출로 데이터베이스에 저장
        // saveGameToAdmin(autoGameData);
      }
    }
  };

  // 자동 업데이트 상태 표시 (더미데이터 시연 후 실제 구현 예정)
  /*
  const [autoUpdateStatus, setAutoUpdateStatus] = useState<{
    lastUpdate: Date | null;
    nextUpdate: Date | null;
    isAutoGenerated: boolean;
  }>({
    lastUpdate: null,
    nextUpdate: null,
    isAutoGenerated: false
  });

  // 다음 월요일 00:01 계산
  useEffect(() => {
    const calculateNextUpdate = () => {
      const now = new Date();
      const daysUntilMonday = (8 - now.getDay()) % 7; // 다음 월요일까지 남은 일수
      const nextMonday = new Date(now);
      nextMonday.setDate(now.getDate() + daysUntilMonday);
      nextMonday.setHours(0, 1, 0, 0); // 00:01:00.000
      
      setAutoUpdateStatus(prev => ({
        ...prev,
        nextUpdate: nextMonday
      }));
    };
    
    calculateNextUpdate();
  }, []);
  */

  // 게임 클릭 핸들러


  // 이번주 일정 더미데이터 (이미지 디자인에 맞게)
  // const thisWeekScheduleData = [
  //   {
  //     id: 1,
  //     date: '8월 18일(월)',
  //     count: 0,
  //     confirmed: false
  //   },
  //   {
  //     id: 2,
  //     date: '8월 19일(화)',
  //     count: 0,
  //     confirmed: false
  //   },
  //   {
  //     id: 3,
  //     date: '8월 20일(수)',
  //     count: 6,
  //     confirmed: true
  //   },
  //   {
  //     id: 4,
  //     date: '8월 21일(목)',
  //     count: 0,
  //     confirmed: false
  //   },
  //   {
  //     id: 5,
  //     date: '8월 22일(금)',
  //     count: 0,
  //     confirmed: false
  //   }
  // ];

  // 이번주 일정 섹션
  const renderThisWeekSchedule = () => (
    <Box
      bg="white"
      p={{ base: 3, md: 4 }}
      borderRadius="lg"
      boxShadow="sm"
      border="1px solid"
      borderColor="gray.200"
      flex="1"
    >
      <Flex align="center" gap={2} mb={{ base: 3, md: 4 }}>
        <Box as="span" fontSize={{ base: "md", md: "lg" }}>⚽</Box>
        <Text fontSize={{ base: "md", md: "lg" }} fontWeight="bold">이번주 일정</Text>
      </Flex>
      
      <VStack spacing={{ base: 1.5, md: 2 }} align="stretch">
        {updateThisWeekScheduleWithGames.map((schedule) => {
          const actualCount = schedule.count;
          const isConfirmed = schedule.confirmed;
          
          return (
          <Flex key={schedule.date} justify="space-between" align="center" p={{ base: 1, md: 1 }}>
            <Flex align="center" gap={{ base: 1, md: 2 }} flex="1" minW="0">
                <Text fontSize={{ base: "xs", md: "sm" }} fontWeight={isConfirmed ? "bold" : "normal"} noOfLines={1}>
                {schedule.date}
              </Text>
                {isConfirmed && (
                <Badge 
                  colorScheme="blue" 
                  variant="outline" 
                  borderRadius="full" 
                  fontSize={{ base: "2xs", md: "xs" }} 
                  px={{ base: 1, md: 1.5 }} 
                  py={{ base: 0.5, md: 0.5 }}
                  minW={{ base: "28px", md: "32px" }}
                  textAlign="center"
                  bg="white"
                  borderColor="blue.400"
                  color="blue.600"
                  fontWeight="bold"
                  flexShrink={0}
                >
                  확정
                </Badge>
              )}
            </Flex>
            <Flex align="center" gap={2} flexShrink={0}>
              <Tooltip
                label={(() => {
                    if (actualCount === 0) {
                      return '참석자 없음';
                    }
                    
                    // 해당 날짜의 게임 데이터에서 실제 참석자 이름 찾기
                    const dayMatch = schedule.date.match(/(\d+)월 (\d+)일/);
                    if (dayMatch) {
                      const month = parseInt(dayMatch[1]);
                      const day = parseInt(dayMatch[2]);
                      
                      // 해당 날짜의 게임 데이터 찾기
                      const currentYear = new Date().getFullYear();
                      const gameForDate = games?.find(game => {
                        if (!game.date) return false;
                        const gameDate = new Date(game.date);
                        return gameDate.getFullYear() === currentYear && 
                               gameDate.getDate() === day && 
                               gameDate.getMonth() === month - 1;
                      });
                      
                      if (gameForDate) {
                        // 참석자 이름 수집
                        const attendeeNames = [];
                        
                        // selectedMembers 파싱
                        if (gameForDate.selectedMembers) {
                          try {
                            const selectedMembersArray = JSON.parse(
                              typeof gameForDate.selectedMembers === 'string' 
                                ? gameForDate.selectedMembers 
                                : gameForDate.selectedMembers[0] || '[]'
                            );
                            attendeeNames.push(...selectedMembersArray);
                          } catch (e) {
                            console.warn('selectedMembers 파싱 오류:', e);
                          }
                        }
                        
                        // memberNames 파싱
                        if (gameForDate.memberNames) {
                          try {
                            const memberNamesArray = JSON.parse(
                              typeof gameForDate.memberNames === 'string' 
                                ? gameForDate.memberNames 
                                : gameForDate.memberNames[0] || '[]'
                            );
                            attendeeNames.push(...memberNamesArray);
                          } catch (e) {
                            console.warn('memberNames 파싱 오류:', e);
                          }
                        }
                        
                        // 용병 수 추가
                        const mercenaryCount = gameForDate.mercenaryCount || 0;
                        if (mercenaryCount > 0) {
                          attendeeNames.push(`용병 ${mercenaryCount}명`);
                        }
                        
                        if (attendeeNames.length > 0) {
                          return `참석자: ${attendeeNames.join(', ')}`;
                        }
                      }
                    }
                    
                    return `${actualCount}명 참석`;
                })}
                placement="top"
                hasArrow
                bg="blue.600"
                color="white"
                fontSize="sm"
                borderRadius="md"
                px={3}
                py={2}
                maxW="200px"
                whiteSpace="normal"
              >
                <Badge 
                  colorScheme="purple" 
                  variant="solid" 
                  borderRadius="full" 
                  px={{ base: 2, md: 3 }} 
                  py={{ base: 0.5, md: 1 }} 
                  fontSize={{ base: "2xs", md: "xs" }}
                    bg={isConfirmed ? "blue.600" : "gray.200"}
                    color={isConfirmed ? "white" : "gray.600"}
                  w={{ base: "40px", md: "45px" }}
                  h={{ base: "20px", md: "22px" }}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                    fontWeight={isConfirmed ? "bold" : "normal"}
                  flexShrink={0}
                >
                    {actualCount}명
                </Badge>
              </Tooltip>
            </Flex>
          </Flex>
          );
        })}
      </VStack>
    </Box>
  );

  // 투표 현황 모달에서 투표 멤버 이름 가져오기
  const getVoteMemberNames = (date: string, voteResults: VoteResults | null, _user: any) => {
    if (!voteResults || !voteResults.voteSession || !voteResults.voteSession.votes) {
      return [];
    }

    const memberNames: string[] = [];
    
    console.log('🔍 getVoteMemberNames 호출:', {
      date,
      allMembersCount: allMembers.length,
      allMembers: allMembers.map(m => ({ id: m.id, name: m.name })),
      votesCount: voteResults.voteSession.votes.length
    });
    
    // 투표 세션에서 해당 날짜에 투표한 사용자 찾기
    voteResults.voteSession.votes.forEach(vote => {
      if (vote.selectedDays && Array.isArray(vote.selectedDays)) {
        // selectedDays는 날짜 문자열 배열이므로, 각 날짜를 한국어 형식으로 변환하여 비교
        const hasVotedForDate = vote.selectedDays.some((selectedDate: string) => {
          const dateObj = new Date(selectedDate);
          const month = dateObj.getMonth() + 1;
          const day = dateObj.getDate();
          const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];
          const formattedDate = `${month}월 ${day}일(${dayOfWeek})`;
          return formattedDate === date;
        });
        
        if (hasVotedForDate) {
          // 실제 회원 정보에서 이름 가져오기
          const member = allMembers.find(m => m.id === vote.userId);
          console.log('🔍 투표자 분석:', {
            userId: vote.userId,
            member: member ? { id: member.id, name: member.name } : null,
            selectedDays: vote.selectedDays
          });
          
          if (member) {
            memberNames.push(member.name);
        } else {
            console.warn('⚠️ 존재하지 않는 회원의 투표:', vote.userId);
          }
        }
      }
    });
    
    console.log('📊 최종 멤버 이름:', memberNames);
    return memberNames;
  };

  // 불참자 이름 가져오기 (별도 함수)
  const getAbsentMemberNames = (voteResults: VoteResults | null, user: any) => {
    if (!voteResults || !voteResults.voteSession || !voteResults.voteSession.votes) {
    return [];
    }

    const absentMembers: string[] = [];
    
    // 투표 세션에서 '불참'을 선택한 사용자 찾기
    voteResults.voteSession.votes.forEach(vote => {
      if (vote.selectedDays.includes('불참')) {
        // 실제 회원 정보에 따른 이름 매핑
        // 실제 회원 데이터에서 사용자 이름 찾기
        let userName = '알 수 없음';
        const member = allMembers.find(m => m.id === vote.userId);
        if (member) {
          userName = member.name;
        }
        
        // 실제 사용자 이름이 있으면 사용, 없으면 매핑된 이름 사용
        if (user?.name && vote.userId === user.id) {
          userName = user.name;
        }
        
        absentMembers.push(userName);
      }
    });

    return absentMembers;
  };

  // 경기정보 모달 상태
  const [showGameModal, setShowGameModal] = useState(false);
  const [selectedGameData, setSelectedGameData] = useState<any>(null);

  // 경기정보 모달 표시
  const handleShowGameModal = (gameData: any) => {
    setSelectedGameData(gameData);
    setShowGameModal(true);
  };

  // 경기정보 모달 닫기
  const handleCloseGameModal = () => {
    setShowGameModal(false);
    setSelectedGameData(null);
  };

  return (
    <Box minH="100vh" bg="white" pt="80px">
      <style>
        {`
          /* 애니메이션 옵션들 - 원하는 것을 선택해서 주석 해제하세요 */
          
          /* 옵션 1: 깜빡임 (현재 적용됨) */
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
          }
          
          /* 옵션 2: 부드러운 확대/축소 (현재 적용됨) */
          @keyframes gentleScale {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
          }
          
          /* 옵션 3: 위아래 움직임 */
          @keyframes gentleBounce {
            0% { transform: translateY(0); }
            50% { transform: translateY(-2px); }
            100% { transform: translateY(0); }
          }
          
          /* 옵션 4: 테두리 깜빡임 */
          @keyframes borderGlow {
            0% { border: 2px solid transparent; }
            50% { border: 2px solid purple; }
            100% { border: 2px solid transparent; }
          }
          
          /* 옵션 5: 색상 변화 */
          @keyframes colorShift {
            0% { background-color: rgb(147, 51, 234); }
            50% { background-color: rgb(168, 85, 247); }
            100% { background-color: rgb(147, 51, 234); }
          }
          
          /* 글로우 효과 애니메이션 */
          @keyframes glowEffect {
            0% { box-shadow: 0 0 10px rgba(147, 51, 234, 0.3); }
            50% { box-shadow: 0 0 20px rgba(147, 51, 234, 0.6); }
            100% { box-shadow: 0 0 10px rgba(147, 51, 234, 0.3); }
          }
        `}
      </style>
      <Flex direction="column" h="100vh" bg="gray.50">
        {/* 메인 컨텐츠 */}
        <Flex flex="1" overflow="hidden" direction={{ base: 'column', lg: 'row' }}>
          {/* 정지된 회원 안내 */}
          {user && (user as any).status === 'SUSPENDED' && (
            <Box
              w="100%"
              bg="red.50"
              border="1px solid"
              borderColor="red.200"
              borderRadius="md"
              p={4}
              mx={4}
              mt={2}
            >
              <VStack spacing={3} align="stretch">
                <HStack spacing={2} align="center">
                  <Box as="span" fontSize="lg">⚠️</Box>
                  <Text fontSize="lg" fontWeight="bold" color="red.800">
                    계정이 정지되었습니다
                  </Text>
                </HStack>
                <Text fontSize="sm" color="red.700">
                  투표 참여 부족으로 인해 계정이 정지되었습니다. 
                  정지 해제를 원하시면 아래 버튼을 클릭하여 요청해주세요.
                </Text>
                <Button
                  colorScheme="red"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSuspensionRequestModal(true)}
                  alignSelf="flex-start"
                >
                  정지 해제 요청하기
                </Button>
              </VStack>
            </Box>
          )}

          {/* 왼쪽: 달력 */}
          <Box flex="1" p={{ base: 2, md: 4 }} overflow="auto">
            {isLoading ? (
              <VStack spacing={4} align="center" justify="center" h="100%" minH="300px">
                <Spinner size="xl" color="blue.500" />
                <Text color="gray.600" textAlign="center">경기 정보를 불러오는 중...</Text>
              </VStack>
            ) : error ? (
              <VStack spacing={4} align="center" justify="center" h="100%" minH="300px">
                <Icon as={WarningIcon} w={12} h={12} color="red.500" />
                <Text color="red.600" fontSize="lg" fontWeight="medium" textAlign="center">데이터 로드 실패</Text>
                <Text color="gray.600" textAlign="center" px={4}>{error}</Text>
                <Button colorScheme="blue" onClick={loadAllData}>
                  다시 시도
                </Button>
              </VStack>
            ) : (
              <NewCalendarV2
                gameDataForCalendar={gameDataForCalendar}
                allDates={allDates}
                onGameClick={handleShowGameModal}
                voteResults={voteResults}
                nextWeekVoteData={nextWeekVoteData}
                allMembers={allMembers}
              />
            )}
          </Box>

          {/* 오른쪽: 일정 정보 */}
          <Box w={{ base: '100%', lg: '400px' }} p={{ base: 2, md: 4 }}>
            <VStack spacing={{ base: 4, md: 6 }} align="stretch">
              {/* 이번주 일정 */}
              {renderThisWeekSchedule()}

              {/* 다음주 일정투표 */}
              <Box
                bg="white"
                p={{ base: 3, md: 4 }}
                borderRadius="lg"
                boxShadow="sm"
                border="1px solid"
                borderColor="gray.200"
              >
                <Flex justify="space-between" align="center" mb={{ base: 3, md: 4 }}>
                  <Flex align="center" gap={2}>
                    <Box as="span" fontSize={{ base: "md", md: "lg" }}>📦</Box>
                    <Text fontSize={{ base: "md", md: "lg" }} fontWeight="bold">다음주 일정투표</Text>
                  </Flex>
                  <Text fontSize={{ base: "xs", md: "sm" }} color="gray.600">
                    투표참여율 {(() => {
                      console.log('🔍 투표참여율 계산 시작:', {
                        voteResults: voteResults ? '있음' : '없음',
                        voteSession: voteResults?.voteSession ? '있음' : '없음',
                        votes: voteResults?.voteSession?.votes?.length || 0,
                        allMembers: allMembers.length
                      });
                      
                      // 투표가 마감되었거나 투표 세션이 없으면 0% 표시
                      if (isVoteClosed || !voteResults || !voteResults.voteSession || !voteResults.voteSession.votes) {
                        console.log('❌ 투표 마감 또는 현재 세션 투표 데이터 없음');
                        return 0;
                      }
                      
                      // 현재 활성화된 투표 세션인지 확인
                      const currentDate = new Date();
                      const sessionDate = new Date(voteResults.voteSession.weekStartDate);
                      const isCurrentSession = Math.abs(currentDate.getTime() - sessionDate.getTime()) < 7 * 24 * 60 * 60 * 1000; // 7일 이내
                      
                      if (!isCurrentSession) {
                        console.log('❌ 현재 활성화된 투표 세션이 아님');
                        return 0;
                      }
                      
                      // 현재 세션의 투표만 필터링 (sessionId 필터링 제거 - 모든 투표 포함)
                      const currentSessionVotes = voteResults.voteSession.votes;
                      
                      if (currentSessionVotes.length === 0) {
                        console.log('❌ 현재 세션에 투표 없음 - 0% 반환');
                        return 0;
                      }
                      
                      // 현재 세션에서 실제 투표에 참여한 고유 인원 수 (관리자 역할 제외)
                      const currentParticipants = new Set<number>();
                      currentSessionVotes.forEach((vote: any) => {
                        const member = allMembers.find(m => m.id === vote.userId);
                        if (member && (member as any).role !== 'ADMIN') { // 관리자 역할 제외
                          currentParticipants.add(vote.userId);
                        }
                      });
                      
                      // 일반 회원 수 (관리자 역할 제외)
                      const regularMembers = allMembers.filter(member => (member as any).role !== 'ADMIN');
                      const totalMembers = regularMembers.length;
                      
                      // 현재 세션에서 일반 회원 중 투표에 참여한 회원의 비율
                      const participationRate = totalMembers > 0 ? Math.round((currentParticipants.size / totalMembers) * 100) : 0;
                      console.log('📊 현재 세션 투표 참여율 계산:', {
                        currentSessionVotes: currentSessionVotes.length,
                        participants: currentParticipants.size,
                        totalMembers,
                        rate: participationRate,
                        description: '현재 세션에서 일반 회원 중 투표에 참여한 회원의 비율'
                      });
                      
                      return participationRate;
                    })}%
                  </Text>
                </Flex>

                <VStack spacing={{ base: 1.5, md: 2 }} align="stretch" mb={{ base: 3, md: 4 }}>
                  {(() => {
                    // 통합 API 데이터에서 활성 세션의 투표 현황을 가져옴
                    if (!unifiedVoteData?.activeSession) {
                      return getScheduleData.nextWeekVoteData.map((vote, index) => {
                        const voteCount = voteResults?.voteResults[vote.date] || 0;
                        const maxVoteCount = Math.max(...Object.values(voteResults?.voteResults || {}), 0);
                        const isMaxVote = voteCount === maxVoteCount && voteCount > 0;
                        
                        return (
                          <Flex 
                            key={index} 
                            justify="space-between" 
                            align="center"
                            p={{ base: 1, md: 1 }}
                            borderRadius="lg"
                            border={selectedDays.includes(vote.date) ? "1px solid" : "none"}
                            borderColor={selectedDays.includes(vote.date) ? "purple.400" : "transparent"}
                            bg={selectedDays.includes(vote.date) ? "purple.50" : "transparent"}
                            onClick={() => {
                              if (selectedDays.includes(vote.date)) {
                                setSelectedDays(selectedDays.filter(day => day !== vote.date));
                              } else {
                                const filteredDays = selectedDays.filter(day => day !== '불참');
                                setSelectedDays([...filteredDays, vote.date]);
                              }
                            }}
                            _hover={{
                              bg: selectedDays.includes(vote.date) ? "purple.100" : "gray.50",
                              transform: "translateY(-1px)",
                              boxShadow: "sm"
                            }}
                            transition="all 0.2s ease-in-out"
                            _active={{
                              transform: "translateY(0px)",
                              boxShadow: "none"
                            }}
                            _focus={{
                              outline: "2px solid",
                              outlineColor: "purple.400",
                              outlineOffset: "2px"
                            }}
                            tabIndex={0}
                            role="button"
                            aria-pressed={selectedDays.includes(vote.date)}
                            aria-label={`${vote.date} 투표 선택`}
                          >
                            <Flex align="center" gap={{ base: 1, md: 2 }} flex="1" minW="0">
                              <Text fontSize={{ base: "xs", md: "sm" }} fontWeight={isMaxVote ? "bold" : "normal"} noOfLines={1}>
                                {vote.date}
                              </Text>
                              {isMaxVote && (
                                <Badge 
                                  colorScheme="purple" 
                                  variant="outline" 
                                  fontSize={{ base: "2xs", md: "xs" }} 
                                  px={{ base: 1, md: 1.5 }} 
                                  py={{ base: 0.5, md: 0.5 }}
                                  borderRadius="full"
                                  minW={{ base: "28px", md: "32px" }}
                                  textAlign="center"
                                  borderColor="purple.400"
                                  color="purple.600"
                                  flexShrink={0}
                                >
                                  최다
                                </Badge>
                              )}
                            </Flex>
                            <Tooltip
                              label={
                                voteCount === 0
                                  ? '-'
                                  : (function () {
                                      const names = getVoteMemberNames(vote.date, voteResults, null);
                                      return names.length > 0 ? names.join(', ') : '-';
                                    })}
                              placement="top"
                              hasArrow
                              bg="purple.600"
                              color="white"
                              fontSize="sm"
                              borderRadius="md"
                              px={3}
                              py={2}
                              maxW="200px"
                              whiteSpace="normal"
                            >
                              <Badge
                                colorScheme={isMaxVote ? "purple" : (voteCount === 0 ? "gray" : "blackAlpha")}
                                variant="solid"
                                borderRadius="full"
                                px={3}
                                py={1}
                                fontSize="xs"
                                bg={isMaxVote ? "purple.600" : (voteCount === 0 ? "gray.200" : "black")}
                                color={isMaxVote ? "white" : (voteCount === 0 ? "gray.600" : "white")}
                                w="45px"
                                h="22px"
                                display="flex"
                                alignItems="center"
                                justifyContent="center"
                                fontWeight={isMaxVote ? "bold" : "normal"}
                              >
                                {voteCount}명
                              </Badge>
                            </Tooltip>
                            
                          </Flex>
                        );
                      });
                    }
                    
                    // 통합 API 데이터 사용
                    const activeSession = unifiedVoteData.activeSession;
                    const results = activeSession.results || {};
                    
                    // 요일별 데이터를 날짜 형식으로 변환
                    const weekStartDate = new Date(activeSession.weekStartDate);
                    const dayMapping = {
                      'MON': 0, 'TUE': 1, 'WED': 2, 'THU': 3, 'FRI': 4
                    };
                    
                    return Object.entries(dayMapping).map(([dayKey, dayIndex]) => {
                      const currentDate = new Date(weekStartDate.getTime() + dayIndex * 24 * 60 * 60 * 1000);
                      const month = currentDate.getMonth() + 1;
                      const day = currentDate.getDate();
                      const dayNames = ['월', '화', '수', '목', '금'];
                      const dayName = dayNames[dayIndex];
                      const dateString = `${month}월 ${day}일(${dayName})`;
                      
                      const voteCount = results[dayKey]?.count || 0;
                      const maxVoteCount = Math.max(...Object.values(results).map((r: any) => r.count || 0), 0);
                      const isMaxVote = voteCount === maxVoteCount && voteCount > 0;
                    
                      return (
                        <Flex 
                          key={dayKey} 
                          justify="space-between" 
                          align="center"
                          p={{ base: 1, md: 1 }}
                          borderRadius="lg"
                          border={selectedDays.includes(dateString) ? "1px solid" : "none"}
                          borderColor={selectedDays.includes(dateString) ? "purple.400" : "transparent"}
                          bg={selectedDays.includes(dateString) ? "purple.50" : "transparent"}
                          onClick={() => {
                            // 투표 선택 허용
                            
                            // 투표 마감된 경우 선택 불가
                            // 투표 마감 시간 체크 제거
                            
                            // 평일은 복수 선택 가능, 불참과 상호배타적
                            if (selectedDays.includes(dateString)) {
                              setSelectedDays(selectedDays.filter(day => day !== dateString));
                            } else {
                              // 불참이 선택되어 있으면 제거하고 평일 추가
                              const filteredDays = selectedDays.filter(day => day !== '불참');
                              setSelectedDays([...filteredDays, dateString]);
                            }
                          }}
                          _hover={{
                            bg: selectedDays.includes(dateString) ? "purple.100" : "gray.50",
                            transform: "translateY(-1px)",
                            boxShadow: "sm"
                          }}
                          transition="all 0.2s ease-in-out"
                          _active={{
                            transform: "translateY(0px)",
                            boxShadow: "none"
                          }}
                          _focus={{
                            outline: "2px solid",
                            outlineColor: "purple.400",
                            outlineOffset: "2px"
                          }}
                          tabIndex={0}
                          role="button"
                          aria-pressed={selectedDays.includes(dateString)}
                          aria-label={`${dateString} 투표 선택`}
                        >
                          <Flex align="center" gap={{ base: 1, md: 2 }} flex="1" minW="0">
                            <Text fontSize={{ base: "xs", md: "sm" }} fontWeight={isMaxVote ? "bold" : "normal"} noOfLines={1}>
                              {dateString}
                            </Text>
                            {isMaxVote && (
                              <Badge 
                                colorScheme="purple" 
                                variant="outline" 
                                fontSize={{ base: "2xs", md: "xs" }} 
                                px={{ base: 1, md: 1.5 }} 
                                py={{ base: 0.5, md: 0.5 }}
                                borderRadius="full"
                                minW={{ base: "28px", md: "32px" }}
                                textAlign="center"
                                borderColor="purple.400"
                                color="purple.600"
                                flexShrink={0}
                              >
                                최다
                              </Badge>
                            )}
                          </Flex>
                          <Tooltip
                            label={(() => {
                              if (voteCount === 0) return '-';
                              const memberNames = getVoteMemberNames(dateString, { voteResults: results, voteSession: activeSession }, null);
                              return memberNames.length > 0 ? memberNames.join(', ') : '-';
                            })}
                            placement="top"
                            hasArrow
                            bg="purple.600"
                            color="white"
                            fontSize="sm"
                            borderRadius="md"
                            px={3}
                            py={2}
                            maxW="200px"
                            whiteSpace="normal"
                          >
                            <Badge
                              colorScheme={isMaxVote ? "purple" : (voteCount === 0 ? "gray" : "blackAlpha")}
                              variant="solid"
                              borderRadius="full"
                              px={3}
                              py={1}
                              fontSize="xs"
                              bg={isMaxVote ? "purple.600" : (voteCount === 0 ? "gray.200" : "black")}
                              color={isMaxVote ? "white" : (voteCount === 0 ? "gray.600" : "white")}
                              w="45px"
                              h="22px"
                              display="flex"
                              alignItems="center"
                              justifyContent="center"
                              fontWeight={isMaxVote ? "bold" : "normal"}
                            >
                              {voteCount}명
                            </Badge>
                          </Tooltip>
                        </Flex>
                      );
                    });
                  })}
                  
                  {/* 불참 옵션 */}
                  <Flex 
                    justify="space-between" 
                    align="center"
                    p={{ base: 1, md: 1 }}
                    borderRadius="lg"
                    border={selectedDays.includes('불참') ? "1px solid" : "none"}
                    borderColor={selectedDays.includes('불참') ? "purple.400" : "transparent"}
                    bg={selectedDays.includes('불참') ? "purple.50" : "transparent"}

                    onClick={() => {
                      // 투표가 완료된 경우 선택 불가
                      if (voteResults) return;
                      
                      // 투표 마감된 경우 선택 불가
                      if (isVoteClosed) return;
                      
                      // 불참은 단독 선택 (평일 선택 모두 해제)
                      if (selectedDays.includes('불참')) {
                        setSelectedDays([]);
                      } else {
                        setSelectedDays(['불참']);
                      }
                    }}
                    _hover={{
                      bg: selectedDays.includes('불참') ? "purple.100" : "gray.50",
                      transform: "translateY(-1px)",
                      boxShadow: "sm"
                    }}
                    transition="all 0.2s ease-in-out"
                    _active={{
                      transform: "translateY(0px)",
                      boxShadow: "none"
                    }}
                    _focus={{
                      outline: "2px solid",
                      outlineColor: "purple.400",
                      outlineOffset: "2px"
                    }}
                    tabIndex={0}
                    role="button"
                    aria-pressed={selectedDays.includes('불참')}
                    aria-label="불참 선택"
                  >
                    <Text fontSize={{ base: "xs", md: "sm" }}>불참</Text>
                    <Tooltip
                      label={(() => {
                        const absentCount = voteResults?.voteResults['불참'] || 0;
                        if (absentCount === 0) return '-';
                        
                        // 불참한 인원명 가져오기
                        const absentMembers = getAbsentMemberNames(voteResults, null);
                        return absentMembers.length > 0 ? absentMembers.join(', ') : '-';
                      })}
                      placement="top"
                      hasArrow
                      bg="red.600"
                      color="white"
                      fontSize="sm"
                      borderRadius="md"
                      px={3}
                      py={2}
                      maxW="200px"
                      whiteSpace="normal"
                    >
                    <Badge 
                        bg="red.500"
                        color="white"
                      variant="solid" 
                      borderRadius="full" 
                      px={{ base: 2, md: 3 }} 
                      py={{ base: 0.5, md: 1 }} 
                      fontSize={{ base: "2xs", md: "xs" }}
                      w={{ base: "40px", md: "45px" }}
                      h={{ base: "20px", md: "22px" }}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      flexShrink={0}
                    >
                      {voteResults?.voteResults['불참'] || 0}명
                    </Badge>
                    </Tooltip>
                  </Flex>
                </VStack>

                {/* 버튼들 */}
                <VStack spacing={{ base: 2, md: 3 }} align="stretch">
                  {/* 투표마감, 투표현황, 투표하기를 한 줄에 배치 */}
                  <Flex gap={{ base: 1, md: 2 }} align="center" direction={{ base: 'column', sm: 'row' }}>
                    <Text
                      fontSize={{ base: "2xs", md: "xs" }}
                      color={getVoteDeadlineColor(voteDeadlineInfo.remainingHours)}
                      fontWeight="medium"
                      flex="1"
                      textAlign={{ base: "center", sm: "left" }}
                      mb={{ base: 1, sm: 0 }}
                    >
                      투표마감: {voteDeadlineInfo.text}
                    </Text>
                    
                    <Flex gap={{ base: 1, md: 2 }} w={{ base: "100%", sm: "auto" }}>
                      <Button
                        size={{ base: "xs", md: "sm" }}
                        colorScheme="purple"
                        onClick={handleShowVoteStatus}
                        fontSize={{ base: "2xs", md: "xs" }}
                        px={{ base: 1, md: 2 }}
                        h={{ base: "20px", md: "22px" }}
                        flex="1"
                        _hover={{
                          transform: "translateY(-1px)",
                          boxShadow: "md"
                        }}
                        transition="all 0.2s ease-in-out"
                      >
                        투표현황
                      </Button>
                      
                      {(() => {
                        // 현재 활성화된 투표 세션인지 확인
                        if (!voteResults || !voteResults.voteSession || !voteResults.voteSession.votes) return false;
                        
                        const currentDate = new Date();
                        const sessionDate = new Date(voteResults.voteSession.weekStartDate);
                        const isCurrentSession = Math.abs(currentDate.getTime() - sessionDate.getTime()) < 7 * 24 * 60 * 60 * 1000; // 7일 이내
                        
                        if (!isCurrentSession) return false;
                        
                        // 투표 마감 상태 확인
                        if (isVoteClosed) return false;
                        
                        // 현재 사용자가 현재 활성 세션에서 투표했는지 확인
                        const hasUserVoted = voteResults.voteSession.votes.some((vote: any) => 
                          vote.userId === user?.id
                        );
                        
                        console.log('🔍 재투표하기 버튼 조건 확인:', {
                          userVotes: voteResults.voteSession.votes.filter((v: any) => v.userId === user?.id),
                          hasUserVoted,
                          totalVotes: voteResults.voteSession.votes.length
                        });
                        
                        return hasUserVoted;
                      }) ? (
                        <Button
                          size={{ base: "xs", md: "sm" }}
                          bg="#FF6B35"
                          color="white"
                          onClick={handleRevote}
                          fontSize={{ base: "2xs", md: "xs" }}
                          px={{ base: 1, md: 2 }}
                          h={{ base: "20px", md: "22px" }}
                          isDisabled={isVoteClosed}
                          flex="1"
                          _hover={{
                            bg: "#E55A2B",
                            transform: "translateY(-1px)",
                            boxShadow: "md"
                          }}
                          transition="all 0.2s ease-in-out"
                        >
                          재투표하기
                        </Button>
                      ) : (
                        <Button
                          size={{ base: "xs", md: "sm" }}
                          bg="purple.600"
                          color="white"
                          onClick={handleVoteButtonClick}
                          fontSize={{ base: "2xs", md: "xs" }}
                          px={{ base: 1, md: 2 }}
                          h={{ base: "20px", md: "22px" }}
                          isDisabled={isVoteClosed}
                          flex="1"
                          _hover={{
                            bg: selectedDays.length > 0 ? "purple.700" : "purple.600",
                            transform: selectedDays.length > 0 ? "translateY(-1px)" : "none",
                            boxShadow: selectedDays.length > 0 ? "md" : "none"
                          }}
                          transition="all 0.2s ease-in-out"
                        >
                          {getVoteButtonText()}
                        </Button>
                      )}
                    </Flex>
                  </Flex>
                </VStack>
              </Box>
            </VStack>
          </Box>
        </Flex>
      </Flex>

      {/* 투표 현황 모달 */}
      <Modal isOpen={showVoteStatus} onClose={() => setShowVoteStatus(false)} size={{ base: "full", md: "lg" }}>
        <ModalOverlay />
        <ModalContent mx={{ base: 2, md: "auto" }} my={{ base: 2, md: "auto" }}>
          <ModalHeader fontSize={{ base: "lg", md: "xl" }}>
            📊 투표 현황 [
            <Text as="span" color="purple.600" fontWeight="bold">
              {getScheduleData.nextWeekVoteData[0]?.date} ~ {getScheduleData.nextWeekVoteData[4]?.date}
            </Text>
            ]
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {voteResults ? (
              <VStack spacing={{ base: 3, md: 4 }} align="stretch">
                {/* 요약 정보 */}
                <Flex justify="space-between" align="center" p={{ base: 2, md: 3 }} bg="gray.50" borderRadius="md" direction={{ base: 'column', sm: 'row' }} gap={{ base: 2, sm: 0 }}>
                  <Tooltip 
                    label={(() => {
                      if (!voteResults || !voteResults.voteSession || !voteResults.voteSession.votes) return '투표 데이터가 없습니다.';
                      
                      // 투표에 참여한 인원명 수집 (실제 회원 정보에서 가져오기)
                      const participants = new Set<string>();
                      voteResults.voteSession.votes.forEach(vote => {
                        const member = allMembers.find(m => m.id === vote.userId);
                        console.log('🔍 투표 현황 모달 투표자 분석:', {
                          userId: vote.userId,
                          member: member ? { id: member.id, name: member.name } : null
                        });
                        if (member) {
                          participants.add(member.name);
                        } else {
                          console.warn('⚠️ 투표 현황 모달 - 존재하지 않는 회원의 투표:', vote.userId);
                        }
                      });
                      
                      const participantList = Array.from(participants).sort((a, b) => a.localeCompare(b, 'ko'));
                      console.log('📊 투표 현황 모달 최종 참여자:', participantList);
                      return `투표 참여 인원: ${participantList.join(', ')}`;
                    })}
                    placement="top"
                    hasArrow
                    bg="purple.600"
                    color="white"
                    fontSize="sm"
                    borderRadius="md"
                    px={3}
                    py={2}
                  >
                    <Text fontSize={{ base: "xs", md: "sm" }} fontWeight="medium"  textAlign={{ base: "center", sm: "left" }}>
                      투표 참여자: 
                      <Badge bg="purple.600" color="white" fontSize={{ base: "xs", md: "sm" }} px={1} py={0.5} borderRadius="md" ml={1}>
                        {(() => {
                          // 투표가 마감되었거나 투표 세션이 없으면 0명 표시
                          if (isVoteClosed || !voteResults || !voteResults.voteSession || !voteResults.voteSession.votes) return 0;
                          
                          // 현재 활성화된 투표 세션인지 확인
                          const currentDate = new Date();
                          const sessionDate = new Date(voteResults.voteSession.weekStartDate);
                          const isCurrentSession = Math.abs(currentDate.getTime() - sessionDate.getTime()) < 7 * 24 * 60 * 60 * 1000; // 7일 이내
                          
                          if (!isCurrentSession) return 0;
                          
                          // 투표 세션에서 실제 참여한 고유 인원 수 계산 (실제 회원만)
                          const participants = new Set<number>();
                          voteResults.voteSession.votes.forEach(vote => {
                            const member = allMembers.find(m => m.id === vote.userId);
                            if (member) {
                              participants.add(vote.userId);
                            }
                          });
                          
                          return participants.size;
                        })}명
                      </Badge>
                    </Text>
                  </Tooltip>
                  
                  <Tooltip 
                    label={(() => {
                      if (!voteResults || !voteResults.voteSession || !voteResults.voteSession.votes) return '투표 데이터가 없습니다.';
                      
                      // 실제 회원 수
                      const totalMembers = allMembers.length;
                      
                      // 투표에 참여한 고유 인원 수 (실제 회원만)
                      const participants = new Set<number>();
                      voteResults.voteSession.votes.forEach(vote => {
                        const member = allMembers.find(m => m.id === vote.userId);
                        if (member) {
                          participants.add(vote.userId);
                        }
                      });
                      
                      // 투표에 참여하지 않은 인원 수
                      const absentCount = totalMembers - participants.size;
                      
                      if (absentCount === 0) return '모든 회원이 투표에 참여했습니다.';
                      
                      // 투표에 참여하지 않은 인원명 수집
                      const absentMemberIds = allMembers.filter(member => !participants.has(member.id));
                      const absentMemberNames = absentMemberIds.map(member => member.name);
                      
                      return `투표 미참여 인원: ${absentMemberNames.join(', ')}`;
                    })}
                    placement="top"
                    hasArrow
                    bg="red.600"
                    color="white"
                    fontSize="sm"
                    borderRadius="md"
                    px={3}
                    py={2}
                  >
                    <Text fontSize={{ base: "xs", md: "sm" }} fontWeight="medium"  textAlign={{ base: "center", sm: "left" }}>
                      불참자: 
                      <Badge bg="red.600" color="white" fontSize={{ base: "xs", md: "sm" }} px={1} py={0.5} borderRadius="md" ml={1}>
                        {(() => {
                          if (!voteResults || !voteResults.voteSession || !voteResults.voteSession.votes) return 0;
                          
                          // 실제 회원 수
                          const totalMembers = allMembers.length;
                          
                          // 투표에 참여한 고유 인원 수 (실제 회원만)
                          const participants = new Set<number>();
                          voteResults.voteSession.votes.forEach(vote => {
                            const member = allMembers.find(m => m.id === vote.userId);
                            if (member) {
                              participants.add(vote.userId);
                            }
                          });
                          
                          // 투표에 참여하지 않은 인원 수
                          return totalMembers - participants.size;
                        })}명
                      </Badge>
                    </Text>
                  </Tooltip>
                </Flex>

                {/* 투표 목록 및 불참 */}
                <VStack spacing={0.5} align="stretch">
                  {getScheduleData.nextWeekVoteData.map((vote, index) => {
                    const voteCount = voteResults.voteResults[vote.date] || 0;
                    const memberNames = getVoteMemberNames(vote.date, voteResults, user);
                    const maxVoteCount = Math.max(...Object.values(voteResults.voteResults).filter(val => val > 0), 0);
                    const isMaxVote = voteCount === maxVoteCount && voteCount > 0;
                    
                    console.log('🔍 투표 현황 표시:', {
                      date: vote.date,
                      voteCount,
                      memberNames,
                      maxVoteCount,
                      isMaxVote,
                      voteResults: voteResults ? '있음' : '없음'
                    });
                    
                    return (
                      <Flex 
                        key={index} 
                        justify="space-between" 
                        align="center" 
                        p={2} 
                        border={isMaxVote ? "1px solid" : "0 0 1px 0 solid"}
                        borderColor={isMaxVote ? "purple.600" : "gray.200"}
                        bg={isMaxVote ? "purple.50" : "transparent"}
                        borderRadius="md"
                        _hover={{ bg: isMaxVote ? "purple.100" : "gray.50" }}
                      >
                        <Text 
                          fontSize={{ base: "xs", md: "sm" }} 
                          textAlign="center" 
                          w="20%" 
                          fontWeight={isMaxVote ? "bold" : "normal"}
                        >
                          {vote.date}
                        </Text>
                        <Badge 
                          bg={isMaxVote ? "purple.600" : (voteCount === 0 ? "gray.200" : "purple.300")}
                          color={isMaxVote ? "white" : (voteCount === 0 ? "gray.600" : "white")}
                          variant="solid" 
                          borderRadius="full" 
                          px={{ base: 1, md: 2 }} 
                          py={{ base: 0.5, md: 1 }} 
                          fontSize={{ base: "2xs", md: "xs" }}
                          w={{ base: "32px", md: "36px" }}
                          h={{ base: "20px", md: "22px" }}
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          flexShrink={0}
                          textAlign="center"
                          fontWeight={isMaxVote ? "bold" : "normal"}
                        >
                          {voteCount}명
                        </Badge>
                        <Box w="10%" textAlign="center" display="flex" justifyContent="center" alignItems="center">
                          {isMaxVote && (
                            <Badge 
                              bg="transparent"
                              color="purple.600"
                              border="1px solid"
                              borderColor="purple.600"
                              borderRadius="md"
                              fontSize="2xs"
                              px={1}
                              py={0.5}
                              fontWeight="bold"
                            >
                              최다
                            </Badge>
                          )}
                        </Box>
                        <Text 
                          fontSize={{ base: "xs", md: "sm" }} 
                          color="gray.600" 
                          textAlign="center" 
                          w="55%" 
                          noOfLines={1}
                          fontWeight={isMaxVote ? "bold" : "normal"}
                        >
                          {voteCount > 0 ? memberNames.join(', ') : '-'}
                        </Text>
                      </Flex>
                    );
                  })}
                  
                  {/* 불참 항목 - 실제 불참 투표가 있는 경우만 표시 */}
                  {(voteResults.voteResults['불참'] || 0) > 0 && (
                    <Flex 
                      justify="space-between" 
                      align="center" 
                      p={2} 
                      borderBottom="1px solid" 
                      borderColor="gray.200"
                      bg="red.50"
                      borderRadius="md"
                      _hover={{ bg: "red.100" }}
                    >
                    <Text fontSize={{ base: "xs", md: "sm" }} textAlign="center" w="20%" fontWeight="normal">불참</Text>
                    <Badge 
                      bg="red.500"
                      color="white"
                      variant="solid" 
                      borderRadius="full" 
                      px={{ base: 1, md: 2 }} 
                      py={{ base: 0.5, md: 1 }} 
                      fontSize={{ base: "2xs", md: "xs" }}
                      w={{ base: "32px", md: "36px" }}
                      h={{ base: "20px", md: "22px" }}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      flexShrink={0}
                      textAlign="center"
                      fontWeight={(() => {
                        const absentCount = voteResults.voteResults['불참'] || 0;
                        const maxVoteCount = Math.max(...Object.values(voteResults.voteResults).filter(val => val > 0), 0);
                        return absentCount === maxVoteCount && absentCount > 0 ? "bold" : "normal";
                      })}
                    >
                      {voteResults.voteResults['불참'] || 0}명
                    </Badge>
                    <Box w="10%" textAlign="center">
                      {/* 최다 뱃지 공간 */}
                    </Box>
                    <Text fontSize={{ base: "xs", md: "sm" }} color="gray.600" textAlign="center" w="55%">
                      {(() => {
                        const absentCount = voteResults.voteResults['불참'] || 0;
                        if (absentCount === 0) return '-';
                        
                        // 불참한 인원명 가져오기
                        const absentMembers = getAbsentMemberNames(voteResults, null);
                        return absentMembers.length > 0 ? absentMembers.join(', ') : '-';
                      })}
                    </Text>
                  </Flex>
                  )}
                </VStack>

                {/* 댓글 섹션 */}
                <VStack spacing={{ base: 1, md: 2 }} align="stretch">
                  <Text fontSize={{ base: "xs", md: "sm" }} fontWeight="bold" color="gray.700">
                    댓글
                  </Text>
                  
                  {/* 기존 댓글 */}
                  <VStack spacing={1} align="stretch" maxH="120px" overflowY="auto">
                    {comments.map((comment, index) => (
                      <Box key={index} p={{ base: 1, md: 1.5 }} bg="gray.50" borderRadius="md">
                        {editingCommentIndex === index ? (
                          // 수정 모드
                          <VStack spacing={2} align="stretch">
                            <Input
                              value={editCommentText}
                              onChange={(e) => setEditCommentText(e.target.value)}
                              size="sm"
                              h="24px"
                            />
                            <Flex gap={2} justify="flex-end">
                              <Button
                                size="xs"
                                colorScheme="blue"
                                onClick={() => handleSaveEditComment(index)}
                                h="20px"
                              >
                                저장
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => setEditingCommentIndex(null)}
                                h="20px"
                              >
                                취소
                              </Button>
                            </Flex>
                          </VStack>
                        ) : (
                          // 일반 표시 모드
                          <Flex justify="space-between" align="center">
                            <Text fontSize={{ base: "2xs", md: "xs" }} color="gray.600" flex="1">
                              {comment.text}
                            </Text>
                            <Flex align="center" gap={2} flexShrink={0}>
                              <Text fontSize={{ base: "2xs", md: "xs" }} fontWeight="medium" color="gray.700">
                                {comment.user}
                              </Text>
                              <Text fontSize={{ base: "2xs", md: "xs" }} color="gray.500">
                                {comment.date}
                              </Text>
                              {user && comment.user === user.name && (
                                <Flex gap={1}>
                                  <IconButton
                                    aria-label="댓글 수정"
                                    icon={<Icon as={EditIcon} w={3} h={3} />}
                                    size="xs"
                                    variant="ghost"
                                    colorScheme="blue"
                                    onClick={() => handleEditComment(index)}
                                    h="20px"
                                    w="20px"
                                  />
                                  <IconButton
                                    aria-label="댓글 삭제"
                                    icon={<Icon as={DeleteIcon} w={3} h={3} />}
                                    size="xs"
                                    variant="ghost"
                                    colorScheme="red"
                                    onClick={() => handleDeleteComment(index)}
                                    h="20px"
                                    w="20px"
                                  />
                                </Flex>
                              )}
                            </Flex>
                          </Flex>
                        )}
                      </Box>
                    ))}
                  </VStack>

                  {/* 댓글 입력 */}
                  <Flex gap={2} direction={{ base: 'column', sm: 'row' }}>
                    <Input
                      placeholder="댓글을 입력하세요..."
                      size={{ base: "xs", md: "sm" }}
                      flex="1"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddComment();
                        }
                      }}
                      h={{ base: "24px", md: "28px" }}
                      border="2px solid"
                      borderColor="blue.300"
                      _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)" }}
                      _hover={{ borderColor: "blue.400" }}
                    />
                    <IconButton
                      aria-label="댓글 작성"
                      icon={<ArrowUpIcon />}
                      size={{ base: "xs", md: "sm" }}
                      colorScheme="blue"
                      onClick={handleAddComment}
                      isDisabled={!commentText.trim()}
                      w={{ base: "100%", sm: "auto" }}
                      h={{ base: "24px", md: "28px" }}
                    />
                  </Flex>
                </VStack>
              </VStack>
            ) : (
              <VStack spacing={4} align="stretch">
                {/* 투표 참여자 및 불참자 정보 */}
                <Flex justify="space-between" align="center" wrap="wrap" gap={2}>
                  <Tooltip 
                    label="투표에 참여한 회원 수"
                    placement="top"
                    hasArrow
                    bg="purple.600"
                    color="white"
                    fontSize="sm"
                    borderRadius="md"
                    px={3}
                    py={2}
                  >
                    <Text fontSize={{ base: "xs", md: "sm" }} fontWeight="medium" textAlign={{ base: "center", sm: "left" }}>
                      투표 참여자: 
                      <Badge bg="purple.600" color="white" fontSize={{ base: "xs", md: "sm" }} px={1} py={0.5} borderRadius="md" ml={1}>
                        {(() => {
                          if (!voteResults || !(voteResults as any).voteSession || !(voteResults as any).voteSession.votes) return '0명';
                          
                          // 현재 세션 ID 계산
                          const currentSessionId = `session_${new Date().toISOString().split('T')[0].replace(/-/g, '_')}`;
                          
                          // 현재 세션의 투표만 필터링
                          const currentSessionVotes = (voteResults as any).voteSession.votes.filter((vote: any) => vote.sessionId === currentSessionId);
                          
                          // 실제 회원 중 투표에 참여한 회원만 계산 (관리자 역할 제외)
                          const currentParticipants = new Set<number>();
                          currentSessionVotes.forEach((vote: any) => {
                            const member = allMembers.find(m => m.id === vote.userId);
                            if (member && (member as any).role !== 'ADMIN') {
                              currentParticipants.add(vote.userId);
                            }
                          });
                          
                          return `${currentParticipants.size}명`;
                        })}
                      </Badge>
                    </Text>
                  </Tooltip>
                  
                  <Tooltip 
                    label={`투표 미참여 인원: ${allMembers.map(member => member.name).join(', ')}`}
                    placement="top"
                    hasArrow
                    bg="red.600"
                    color="white"
                    fontSize="sm"
                    borderRadius="md"
                    px={3}
                    py={2}
                  >
                    <Text fontSize={{ base: "xs", md: "sm" }} fontWeight="medium" textAlign={{ base: "center", sm: "left" }}>
                      불참자: 
                      <Badge bg="red.600" color="white" fontSize={{ base: "xs", md: "sm" }} px={1} py={0.5} borderRadius="md" ml={1}>
                        {allMembers.length}명
                      </Badge>
                    </Text>
                  </Tooltip>
                </Flex>

                {/* 투표 목록 */}
                <VStack spacing={0.5} align="stretch">
                  {getScheduleData.nextWeekVoteData.map((vote, index) => (
                    <Flex 
                      key={index} 
                      justify="space-between" 
                      align="center" 
                      p={2} 
                      border="0 0 1px 0 solid"
                      borderColor="gray.200"
                      bg="transparent"
                      borderRadius="md"
                      _hover={{ bg: "gray.50" }}
                    >
                      <Text 
                        fontSize={{ base: "xs", md: "sm" }} 
                        textAlign="center" 
                        w="20%" 
                        fontWeight="normal"
                      >
                        {vote.date}
                      </Text>
                      <Badge 
                        bg="gray.200"
                        color="gray.600"
                        variant="solid" 
                        borderRadius="full" 
                        px={{ base: 1, md: 2 }} 
                        py={{ base: 0.5, md: 1 }} 
                        fontSize={{ base: "2xs", md: "xs" }}
                        w={{ base: "32px", md: "36px" }}
                        h={{ base: "20px", md: "22px" }}
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        flexShrink={0}
                        textAlign="center"
                        fontWeight="normal"
                      >
                        0명
                      </Badge>
                      <Text 
                        fontSize={{ base: "2xs", md: "xs" }} 
                        color="gray.500" 
                        textAlign="center" 
                        w="60%"
                        fontStyle="italic"
                      >
                        투표 없음
                      </Text>
                    </Flex>
                  ))}
                </VStack>

                {/* 댓글 입력 */}
                <Flex gap={2} direction={{ base: 'column', sm: 'row' }}>
                  <Input
                    placeholder="댓글을 입력하세요..."
                    size={{ base: "xs", md: "sm" }}
                    flex="1"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAddComment();
                      }
                    }}
                    h={{ base: "24px", md: "28px" }}
                    border="2px solid"
                    borderColor="blue.300"
                    _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px var(--chakra-colors-blue-500)" }}
                    _hover={{ borderColor: "blue.400" }}
                  />
                  <IconButton
                    aria-label="댓글 작성"
                    icon={<ArrowUpIcon />}
                    size={{ base: "xs", md: "sm" }}
                    colorScheme="blue"
                    onClick={handleAddComment}
                    isDisabled={!commentText.trim()}
                    w={{ base: "100%", sm: "auto" }}
                    h={{ base: "24px", md: "28px" }}
                  />
                </Flex>

                {/* 투표하기 버튼 */}
                <Flex justify="center" mt={4}>
                  <Button
                    colorScheme="blue"
                    size="sm"
                    onClick={() => setShowVoteStatus(false)}
                  >
                    투표하기
                  </Button>
                </Flex>
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* 경기정보 모달 */}
      <Modal isOpen={showGameModal} onClose={handleCloseGameModal} size="xs" isCentered>
        <ModalOverlay />
        <ModalContent maxW="380px">
          <ModalHeader fontSize="md" pb={2}>
            📅 일정 상세정보
          </ModalHeader>
          <ModalCloseButton size="sm" />
          <ModalBody pb={4}>
            {selectedGameData ? (
              <VStack spacing={3} align="stretch">
                {/* 유형 */}
                <Flex align="center" gap={2}>
                  <Box as="span" fontSize="md">⚽</Box>
                  <Text fontSize="sm" fontWeight="medium">
                    유형: {selectedGameData.eventType || '자체'}
                  </Text>
                </Flex>

                {/* 일시 */}
                <Flex align="center" gap={2}>
                  <Box as="span" fontSize="md">🕐</Box>
                  <Text fontSize="sm" fontWeight="medium">
                    일시: {(() => {
                      if (selectedGameData.date && selectedGameData.time) {
                        const date = new Date(selectedGameData.date);
                        const month = date.getMonth() + 1;
                        const day = date.getDate();
                        const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
                        return `${month}월 ${day}일(${dayOfWeek}) ${selectedGameData.time}`;
                      } else if (selectedGameData.date) {
                        const date = new Date(selectedGameData.date);
                        const month = date.getMonth() + 1;
                        const day = date.getDate();
                        const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
                        return `${month}월 ${day}일(${dayOfWeek})`;
                      }
                      return '일시 미정';
                    })}
                  </Text>
                </Flex>

                {/* 장소 */}
                <Flex align="center" justify="space-between">
                  <Flex align="center" gap={2}>
                    <Box as="span" fontSize="md">📍</Box>
                    <Text fontSize="sm" fontWeight="medium">
                      장소: {selectedGameData.location || '장소 미정'}
                    </Text>
                  </Flex>
                  <Button
                    size="xs"
                    height="22px"
                    minW="22px"
                    fontSize="11px"
                    p={0}
                    bg="yellow.400"
                    color="blue.600"
                    onClick={() => {
                      const searchQuery = encodeURIComponent(selectedGameData.location || '');
                      window.open(`https://map.kakao.com/link/search/${searchQuery}`, '_blank');
                    }}
                  >
                    K
                  </Button>
                </Flex>

                {/* 참석자 정보 */}
                <Flex align="center" gap={2}>
                  <Box as="span" fontSize="md">👥</Box>
                  <Text fontSize="sm" fontWeight="medium">
                    참석자 정보: {selectedGameData.count || 0}명
                  </Text>
                  <Text fontSize="xs" whiteSpace="nowrap">
                    ({(() => {
                      const memberNames = Array.isArray(selectedGameData.memberNames) ? 
                        selectedGameData.memberNames : 
                        (typeof selectedGameData.memberNames === 'string' ? 
                          JSON.parse(selectedGameData.memberNames) : []);
                      
                      // memberNames 배열에서 각 유형별로 분류
                      let memberCount = 0;
                      let mercenaryCount = 0;
                      let otherCount = 0;
                      
                      // 중복 제거를 위해 Set 사용
                      const uniqueNames = [...new Set(memberNames)];
                      
                      uniqueNames.forEach((name: unknown) => {
                        // 실제 회원인지 확인
                        const isMember = allMembers.some(member => member.name === name);
                        if (isMember) {
                          memberCount++;
                        } else if (typeof name === 'string' && name.startsWith('용병')) {
                          // 용병 개수는 실제 개별 용병 수가 아닌 mercenaryCount 사용
                          mercenaryCount = selectedGameData.mercenaryCount || 0;
                        } else {
                          otherCount++;
                        }
                      });
                      
                      const parts = [];
                      if (memberCount > 0) {
                        parts.push({ text: `회원 ${memberCount}명`, color: '#004ea8' });
                      }
                      if (mercenaryCount > 0) {
                        parts.push({ text: `용병 ${mercenaryCount}명`, color: '#000000' });
                      }
                        if (otherCount > 0) {
                          parts.push({ text: `기타 ${otherCount}명`, color: '#ff6b35' });
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
                    })}
                  </Text>
                </Flex>

                {/* 참석자 목록 */}
                {(() => {
                  const memberNames = Array.isArray(selectedGameData.memberNames) ? 
                    selectedGameData.memberNames : 
                    (typeof selectedGameData.memberNames === 'string' ? 
                      JSON.parse(selectedGameData.memberNames) : []);
                  
                  // 참가자 목록을 유형별로 그룹화하여 표시
                  const participants: Array<{name: string, type: 'member' | 'mercenary' | 'other'}> = [];
                  
                  // 중복 제거를 위해 Set 사용
                  const uniqueNames = [...new Set(memberNames)];
                  
                  // 회원 추가
                  uniqueNames.forEach((name: unknown) => {
                    // 실제 회원인지 확인
                    const isMember = allMembers.some(member => member.name === name);
                    if (isMember) {
                      participants.push({ name: name as string, type: 'member' });
                    }
                  });
                  
                  // 용병 그룹 추가 (개별 용병이 아닌 "용병 X명" 형태로)
                  const mercenaryCount = selectedGameData.mercenaryCount || 0;
                  if (mercenaryCount > 0) {
                    participants.push({ name: `용병 ${mercenaryCount}명`, type: 'mercenary' });
                  }
                  
                  // 기타 추가 (용병이 아닌 다른 이름들)
                  uniqueNames.forEach((name: unknown) => {
                    // 회원이 아니고 용병도 아닌 경우
                    const isMember = allMembers.some(member => member.name === name);
                    if (!isMember && typeof name === 'string' && !name.startsWith('용병')) {
                      participants.push({ name: name as string, type: 'other' });
                    }
                  });
                  
                  return participants.length > 0 ? (
                    <Flex wrap="wrap" gap={1} justify="center">
                      {participants.map((participant, index) => (
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
                })}
              </VStack>
            ) : (
              <Text>데이터를 불러오는 중...</Text>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* 정지 해제 요청 모달 */}
      <Modal isOpen={showSuspensionRequestModal} onClose={() => setShowSuspensionRequestModal(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader color="#004ea8">🔓 정지 해제 요청</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4} align="stretch">
              <Text color="gray.700">
                정지 해제를 요청하시는 사유를 자세히 작성해주세요. 
                관리자 검토 후 승인 또는 거절됩니다.
              </Text>
              
              <FormControl>
                <FormLabel color="gray.700" fontWeight="bold">요청 사유</FormLabel>
                <Textarea
                  value={suspensionRequestReason}
                  onChange={(e) => setSuspensionRequestReason(e.target.value)}
                  placeholder="정지 해제를 원하는 구체적인 사유를 작성해주세요..."
                  rows={4}
                  resize="vertical"
                />
              </FormControl>
              
              <HStack spacing={3} justify="flex-end">
                <Button
                  variant="outline"
                  onClick={() => setShowSuspensionRequestModal(false)}
                >
                  취소
      </Button>
                <Button
                  colorScheme="blue"
                  onClick={handleSuspensionRequestSubmit}
                  isDisabled={!suspensionRequestReason.trim()}
                >
                  요청 제출
                </Button>
              </HStack>
  </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
);
}

