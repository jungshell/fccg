import React, { useState, useEffect } from 'react';
import styled, { keyframes, css } from 'styled-components';
import dayjs from 'dayjs';
import { Flex, Badge, Tooltip } from '@chakra-ui/react';
import { useAuthStore } from '../store/auth';
import { API_ENDPOINTS } from '../constants';

// 공휴일 체크 함수 (날짜 문자열에서 공휴일 확인)
const isHolidayDate = (dateString: string, holidayMap: Record<string, string>): boolean => {
  // YYYY-MM-DD 형식으로 변환하여 확인
  const date = new Date(dateString);
  const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return holidayMap[formattedDate] !== undefined;
};

// 애니메이션 정의
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const gaugeFill = keyframes`
  0% { 
    width: 0%; 
    background: #a78bfa;
    opacity: 0.7;
  }
  100% { 
    width: 100%;
    background: #7c3aed;
    opacity: 1;
  }
`;

const gaugePulse = keyframes`
  0%, 100% { 
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.4);
  }
  50% { 
    transform: scale(1.02);
    box-shadow: 0 0 0 4px rgba(124, 58, 237, 0.1);
  }
`;

// 스타일 컴포넌트
const CalendarContainer = styled.div`
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  padding: 16px;
  max-width: 100%;
  min-width: 989px;
  width: 989px;
  height: auto;
  overflow: visible;
  
  @media (max-width: 1024px) {
    min-width: 800px;
    width: 800px;
    height: auto;
    padding: 16px;
  }
  
  @media (max-width: 768px) {
    min-width: 100%;
    width: 100%;
    height: auto;
    padding: 16px;
  }
`;

const CalendarHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`;

const MonthYearText = styled.h2`
  font-size: 20px;
  font-weight: bold;
  color: #1a202c;
  margin: 0;
`;

const NavigationButton = styled.button`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
  }
  
  &:active {
    transform: scale(0.98);
  }
`;

const CalendarGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0;
  background: #e2e8f0;
  border-radius: 12px;
  overflow: visible;
  width: 100%;
  height: auto;
  min-height: 500px;
  
  @media (max-width: 1024px) {
    height: auto;
    min-height: 400px;
  }
  
  @media (max-width: 768px) {
    height: auto;
    min-height: 400px;
  }
`;

const DayHeader = styled.div.withConfig({
  shouldForwardProp: (prop) => !['isSunday', 'isSaturday'].includes(prop),
})<{ isSunday: boolean; isSaturday: boolean }>`
  background: white;
  color: ${props => props.isSunday ? '#c53030' : props.isSaturday ? '#2b6cb0' : '#4a5568'};
  padding: 10px 8px;
  text-align: center;
  font-weight: bold;
  font-size: 13px;
  border-bottom: 0.5px solid #e2e8f0;
  border-right: 0.5px solid #e2e8f0;
  
  &:nth-child(7) {
    border-right: none;
  }
`;

const DayCell = styled.div.withConfig({
  shouldForwardProp: (prop) => !['isCurrentMonth', 'isToday', 'hasGame', 'hasVote', 'isVoteGroupStart', 'isVoteGroupEnd'].includes(prop),
})<{ 
  isCurrentMonth: boolean; 
  isToday: boolean; 
  hasGame: boolean;
  hasVote: boolean;
  isVoteGroupStart?: boolean;
  isVoteGroupEnd?: boolean;
}>`
  background: ${props => {
    if (props.hasVote) return 'white';
    return props.isCurrentMonth ? 'white' : '#f7fafc';
  }};
  border-right: 0.5px solid #e2e8f0;
  border-bottom: 0.5px solid #e2e8f0;
  min-height: 100px;
  padding: 8px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  transition: all 0.2s ease;
  
  // 투표일인 경우 다른 날짜와 같은 테두리 색상 적용
  ${props => props.hasVote && `
    border: 0.5px solid #e2e8f0;
    border-radius: 0;
  `}
  
  &:hover {
    background: ${props => {
      if (props.hasVote) return '#f7fafc';
      return props.isCurrentMonth ? '#f7fafc' : '#edf2f7';
    }};
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  // 모든 날짜 셀의 크기를 동일하게 고정
  width: 100%;
  height: auto;
  min-height: 100px;
  max-height: none;
  box-sizing: border-box;
  
  // 마지막 열의 오른쪽 테두리 제거
  &:nth-child(7n) {
    border-right: none;
  }
`;

const DateNumber = styled.div.withConfig({
  shouldForwardProp: (prop) => !['isSunday', 'isSaturday', 'isHoliday', 'isToday', 'isCurrentMonth'].includes(prop),
})<{ 
  isSunday: boolean; 
  isSaturday: boolean; 
  isHoliday: boolean;
  isToday: boolean;
  isCurrentMonth: boolean;
}>`
  font-size: 15px;
  font-weight: bold;
  color: ${props => {
    if (props.isHoliday) return '#e53e3e';
    if (!props.isCurrentMonth) {
      // 비당월 일요일, 토요일도 흐리게 처리
      if (props.isSunday || props.isSaturday) return 'rgba(160, 174, 192, 0.6)';
      return 'rgba(160, 174, 192, 0.8)';
    }
    if (props.isSunday) return '#e53e3e';
    if (props.isSaturday) return '#3182ce';
    return '#2d3748';
  }};
  text-align: right;
  margin-bottom: 8px;
  position: absolute;
  top: 8px;
  right: 8px;
`;

const HolidayName = styled.span`
  font-size: 10px;
  color: #e53e3e;
  font-weight: bold;
  position: absolute;
  top: 8px;
  left: 8px;
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const GameTypeBadge = styled.span<{ eventType: string }>`
  font-size: 11px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 6px;
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  
  // 유형별 다른 스타일 적용
  ${props => {
    switch (props.eventType) {
      case '매치':
        return `
          color: #2563eb;
          background: rgba(37, 99, 235, 0.1);
          border: 1px solid rgba(37, 99, 235, 0.3);
        `;
      case '자체':
        return `
          color: #059669;
          background: rgba(5, 150, 105, 0.1);
          border: 1px solid rgba(5, 150, 105, 0.3);
        `;
      case '회식':
        return `
          color: #dc2626;
          background: rgba(220, 38, 38, 0.1);
          border: 1px solid rgba(220, 38, 38, 0.3);
        `;
      default:
        return `
          color: #6b7280;
          background: rgba(107, 114, 128, 0.1);
          border: 1px solid rgba(107, 114, 128, 0.3);
        `;
    }
  }}
`;

const GameInfoBox = styled.div`
  background: white;
  color: #2d3748;
  border: 1px solid #3182ce;
  border-radius: 8px;
  padding: 5px 8px;
  margin-top: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  animation: ${fadeIn} 0.5s ease-out;
  box-shadow: 0 2px 8px rgba(49, 130, 206, 0.2);
  
  // 세로 길이 조정 (더 컴팩트하게)
  min-height: 46px;
  
  // 가로세로 중앙정렬
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  
  &:hover {
    transform: scale(1.02);
    box-shadow: 0 4px 16px rgba(49, 130, 206, 0.3);
    border-color: #2b6cb0;
  }
  
  // 내용을 최대한 축소
  font-size: 9px;
  line-height: 1.2;
  
  // 텍스트가 넘치지 않도록 처리
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const GameCountBadge = styled.div`
  font-size: 10px;
  font-weight: bold;
  margin-bottom: 3px;
  text-align: center;
  color: #2d3748;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
`;

const GameTimeText = styled.div`
  font-size: 9px;
  color: #4a5568;
  margin-bottom: 2px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
`;

const GameLocationText = styled.div`
  font-size: 9px;
  color: #4a5568;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
`;

const VoteContainer = styled.div`
  margin-top: auto;
  margin-bottom: 5px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
`;

const VoteGauge = styled.div<{ percentage: number }>`
  height: 15px;
  width: 100%;
  background: #e0e7ff;
  border-radius: 7px;
  overflow: hidden;
  position: relative;
  border: 1px solid #c4b5fd;
  transition: all 0.3s ease;
  
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 0%;
    background: ${props => props.percentage >= 80 ? '#7c3aed' : '#a78bfa'};
    border-radius: 7px;
    animation: ${props => props.percentage > 0 ? css`${gaugeFill} 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards` : 'none'};
    transition: all 0.3s ease;
  }
  
  &:hover {
    border-color: #7c3aed;
    box-shadow: 0 0 8px rgba(124, 58, 237, 0.3);
  }
  
  &:hover::after {
    background: #7c3aed;
    transform: scaleY(1.05);
  }
`;

// 공휴일 데이터 (기본값, API에서 가져온 데이터로 교체됨)
const defaultHolidays: Record<string, string> = {
  '2025-01-01': '신정',
  '2025-02-09': '설날',
  '2025-02-10': '설날',
  '2025-02-11': '설날',
  '2025-03-01': '삼일절',
  '2025-05-05': '어린이날',
  '2025-05-15': '부처님오신날',
  '2025-06-06': '현충일',
  '2025-08-15': '광복절',
  '2025-09-28': '추석',
  '2025-09-29': '추석',
  '2025-09-30': '추석',
  '2025-10-03': '개천절',
  '2025-10-09': '한글날',
  '2025-12-25': '크리스마스'
};

interface GameData {
  id: string;
  eventType: string;
  count: number;
  time: string;
  location: string;
  confirmed: boolean;
}

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

interface CalendarProps {
  gameDataForCalendar: Record<string, GameData>;
  allDates: VoteData[];
  onGameClick: (gameData: GameData) => void;
  voteResults?: VoteResults | null;
  nextWeekVoteData?: VoteData[];
  allMembers?: Array<{id: number, name: string}>;
  unifiedVoteData?: any;
}

// 투표 인원명을 가져오는 함수
const getVoteMemberNames = (dateString: string, unifiedVoteData: any, _currentUser: { id: number; name: string } | null, allMembers: Array<{id: number, name: string}> = []): string[] => {
  console.log('🔍 getVoteMemberNames 호출:', {
    dateString,
    hasUnifiedVoteData: !!unifiedVoteData,
    hasActiveSession: !!unifiedVoteData?.activeSession,
    hasResults: !!unifiedVoteData?.activeSession?.results,
    allMembersCount: allMembers?.length || 0
  });
  
  if (!unifiedVoteData?.activeSession?.results) {
    console.log('❌ unifiedVoteData 또는 results가 없습니다.');
    return [];
  }

  const memberNames: string[] = [];
  
  // YYYY-MM-DD 형식을 요일로 변환
  const dateObj = dayjs(dateString);
  const dayOfWeek = dateObj.day(); // 0: 일요일, 1: 월요일, ..., 6: 토요일
  const dayKeys = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const dayKey = dayKeys[dayOfWeek];
  
  console.log(`🔍 투표 멤버 이름 찾기: ${dateString} -> ${dayKey}`);
  console.log('🔍 results 구조:', unifiedVoteData.activeSession.results);
  
  // 통합 API의 results에서 해당 요일의 참여자 찾기
  const dayResult = unifiedVoteData.activeSession.results[dayKey];
  console.log(`🔍 ${dayKey} 결과:`, dayResult);
  
  if (dayResult && dayResult.participants) {
    console.log(`🔍 ${dayKey} 참여자들:`, dayResult.participants);
    dayResult.participants.forEach((participant: any) => {
      memberNames.push(participant.userName);
      console.log(`✅ 멤버 이름 추가: ${participant.userName}`);
    });
  } else {
    console.log(`❌ ${dayKey}에 참여자 데이터가 없습니다.`);
  }
  
  console.log(`📊 ${dateString}에 투표한 멤버들:`, memberNames);

  // 가나다 순으로 정렬
  return memberNames.sort((a, b) => a.localeCompare(b, 'ko'));
};

const NewCalendarV2: React.FC<CalendarProps> = ({
  gameDataForCalendar,
  allDates,
  onGameClick,
  voteResults,
  nextWeekVoteData,
  allMembers = [],
  unifiedVoteData
}) => {
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [holidays, setHolidays] = useState<Record<string, string>>(defaultHolidays);
  const { user } = useAuthStore();
  
  // 공휴일 데이터 가져오기
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const currentYear = currentDate.year();
        const nextYear = currentYear + 1;
        
        // 올해와 내년 공휴일 조회
        const response = await fetch(`${API_ENDPOINTS.BASE_URL.replace('/api/auth', '')}/api/holiday/years`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ years: [currentYear.toString(), nextYear.toString()] }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data.holidayMap) {
            // API 응답에서 통합된 공휴일 맵 사용
            setHolidays(data.data.holidayMap);
            console.log('✅ 공휴일 데이터 로드 완료:', Object.keys(data.data.holidayMap).length, '개');
          } else if (data.success && data.data.holidays) {
            // 연도별 공휴일 맵이 있는 경우 통합
            const holidayMap: Record<string, string> = {};
            Object.values(data.data.holidays).forEach((yearMap: any) => {
              Object.assign(holidayMap, yearMap);
            });
            setHolidays(holidayMap);
            console.log('✅ 공휴일 데이터 로드 완료:', Object.keys(holidayMap).length, '개');
          }
        }
      } catch (error) {
        console.error('❌ 공휴일 데이터 로드 실패:', error);
        // 기본 공휴일 사용
        setHolidays(defaultHolidays);
      }
    };
    
    fetchHolidays();
  }, [currentDate.year()]);
  
  // 디버깅: 데이터 확인
  console.log('🔍 NewCalendarV2 - allDates:', allDates?.length || 0, '개, gameDataForCalendar:', Object.keys(gameDataForCalendar || {}).length, '개');
  console.log('🔍 투표 결과:', voteResults);
  console.log('🔍 다음주 투표 데이터:', nextWeekVoteData);
  console.log('🔍 현재 로그인한 사용자:', user);
  console.log('🔍 전체 회원 정보:', allMembers);
  
  if (voteResults && voteResults.voteResults) {
    console.log('🔍 투표 결과 키들:', Object.keys(voteResults.voteResults));
    console.log('🔍 투표 결과 값들:', Object.values(voteResults.voteResults));
  }
  
  const startOfMonth = currentDate.startOf('month');
  const endOfMonth = currentDate.endOf('month');
  const startOfCalendar = startOfMonth.startOf('week');
  const endOfCalendar = endOfMonth.endOf('week');
  
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const days: Array<{
    date: Date;
    day: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    hasGame: boolean;
    gameData: GameData | null;
    hasVote: boolean;
    voteData: VoteData | undefined;
    voteCount: number;
    isHoliday: boolean;
    holidayName: string | undefined;
  }> = [];
  
  let day = startOfCalendar;
  
  while (day.isBefore(endOfCalendar) || day.isSame(endOfCalendar, 'day')) {
    const isCurrentMonth = day.month() === currentDate.month();
    const isToday = day.isSame(dayjs(), 'day');
    const dateString = day.format('YYYY-MM-DD');
    
    // 공휴일 확인
    const isHoliday = holidays[dateString] !== undefined;
    const holidayName = holidays[dateString];
    
    // 디버깅: 공휴일 확인
    if (isHoliday) {
      console.log(`🔍 공휴일 발견: ${dateString} - ${holidayName}`);
    }
    
    // 경기 정보 확인 (날짜 형식 통일)
    let hasGame = false;
    let gameData = null;
    
    // gameDataForCalendar에서 경기 데이터 찾기
    console.log(`🔍 ${dateString} 날짜에 대한 게임 데이터 검색 중...`);
    console.log(`🔍 현재 gameDataForCalendar 키들:`, Object.keys(gameDataForCalendar || {}));
    
    // gameDataForCalendar가 유효한지 확인
    if (!gameDataForCalendar || typeof gameDataForCalendar !== 'object') {
      console.warn('⚠️ gameDataForCalendar가 유효하지 않음:', gameDataForCalendar);
    } else {
      for (const [key, value] of Object.entries(gameDataForCalendar)) {
        // 유효하지 않은 키(NaN 포함)는 건너뛰기
        if (!key || typeof key !== 'string' || key.includes('NaN') || !/^\d{4}-\d{2}-\d{2}/.test(key.split('T')[0])) {
          console.warn('⚠️ 유효하지 않은 gameDataForCalendar 키 건너뜀:', key);
          continue;
        }
        
        // value가 유효한지 확인
        if (!value || typeof value !== 'object') {
          console.warn('⚠️ gameDataForCalendar의 값이 유효하지 않음:', key, value);
          continue;
        }
      
      let keyDate = key;
      
      // ISO 형식인 경우 YYYY-MM-DD로 변환
      if (key.includes('T')) {
        keyDate = key.split('T')[0];
      }
      
      // 날짜 형식 검증
      if (!/^\d{4}-\d{2}-\d{2}$/.test(keyDate)) {
        console.warn('⚠️ 유효하지 않은 날짜 형식 키 건너뜀:', keyDate);
        continue;
      }
      
      console.log(`🔍 키 비교: ${keyDate} === ${dateString} ?`, keyDate === dateString);
      
      if (keyDate === dateString) {
        hasGame = true;
        gameData = value;
        console.log(`🔍 경기 데이터 매칭 성공: ${dateString} ↔ ${key} → ${value?.eventType || '알 수 없음'}`);
        break;
      }
      }
    }
    
    // 투표 정보 확인
    const voteData = allDates.find(date => {
      const voteDateString = dayjs(date.voteDate).format('YYYY-MM-DD');
      return voteDateString === dateString;
    });
    
    const hasVote = voteData !== undefined;
    
    // 통합 API에서 해당 날짜의 투표 수 찾기
    let voteCount = 0;
    if (unifiedVoteData?.activeSession?.results) {
      const dayOfWeek = day.day(); // 0: 일요일, 1: 월요일, ..., 6: 토요일
      const dayKeys = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const dayKey = dayKeys[dayOfWeek];
      
      const dayResult = unifiedVoteData.activeSession.results[dayKey];
      if (dayResult && dayResult.count) {
        voteCount = dayResult.count;
        console.log(`✅ 통합 API에서 투표 수 매칭 성공: ${dateString} → ${dayKey} = ${voteCount}명`);
      }
    }
    
    // 다음주 투표일 확인 (동적 계산)
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
    
    // 다음주 투표일 범위 계산 (월-금) - 경계 포함 처리
    const startOfNextWeek = new Date(nextWeekMonday);
    startOfNextWeek.setHours(0, 0, 0, 0); // 월요일 00:00:00
    const endOfNextWeek = new Date(nextWeekMonday);
    endOfNextWeek.setDate(nextWeekMonday.getDate() + 4); // 금요일
    endOfNextWeek.setHours(23, 59, 59, 999); // 금요일 23:59:59.999

    const isNextWeekVoteDay = day.toDate().getTime() >= startOfNextWeek.getTime() && 
                              day.toDate().getTime() <= endOfNextWeek.getTime() && 
                              day.day() >= 1 && day.day() <= 5; // 월요일(1)부터 금요일(5)까지
    
    // 투표 데이터가 있는 경우 로그 출력
    if (hasVote || isNextWeekVoteDay) {
      console.log(`🔍 투표 데이터: ${dateString}, hasVote: ${hasVote}, isNextWeekVoteDay: ${isNextWeekVoteDay}, voteCount: ${voteCount}`);
    }

    // 확정된 경기 주(월~금) 전체 게이지/인원 pill 숨김 처리
    let showVoteForThisDay = (hasVote || isNextWeekVoteDay);

    // 현재 날짜가 속한 주의 월요일/금요일 계산
    const jsDate = day.toDate();
    const dow = jsDate.getDay(); // 0~6
    const daysToMonday = dow === 0 ? -6 : 1 - dow;
    const weekStart = new Date(jsDate);
    weekStart.setDate(jsDate.getDate() + daysToMonday);
    weekStart.setHours(0,0,0,0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 4); // 금요일
    weekEnd.setHours(23,59,59,999);

    // 해당 주에 확정된 게임이 하나라도 있는지 검사
    let weekHasConfirmed = false;
    if (gameDataForCalendar && typeof gameDataForCalendar === 'object') {
      for (const [key, value] of Object.entries(gameDataForCalendar)) {
        // 유효하지 않은 키(NaN 포함)는 건너뛰기
        if (!key || typeof key !== 'string' || key.includes('NaN') || !/^\d{4}-\d{2}-\d{2}/.test(key.split('T')[0])) {
          continue;
        }
        
        const gd = value as any;
        if (!gd || typeof gd !== 'object' || !gd.date) continue;
        
        const gameISO = gd.date as string | undefined;
        if (!gameISO || typeof gameISO !== 'string' || gameISO.includes('NaN')) {
          continue;
        }
        
        // 날짜 유효성 검증
        try {
          const gdDate = new Date(gameISO);
          if (isNaN(gdDate.getTime())) {
            console.warn('⚠️ 유효하지 않은 게임 날짜:', gameISO);
            continue;
          }
          
          if (gdDate >= weekStart && gdDate <= weekEnd && gd?.confirmed) {
            weekHasConfirmed = true;
            break;
          }
        } catch (error) {
          console.warn('⚠️ 날짜 파싱 오류:', error, '게임 데이터:', gd);
          continue;
        }
      }
    }

    if (weekHasConfirmed) {
      showVoteForThisDay = false;
      voteCount = 0;
    }
    
    days.push({
      date: day.toDate(),
      day: day.date(),
      isCurrentMonth,
      isToday,
      hasGame,
      gameData,
      hasVote: showVoteForThisDay,
      voteData,
      voteCount,
      isHoliday,
      holidayName
    });
    
    day = day.add(1, 'day');
  }
  
  const goToPreviousMonth = () => {
    const newDate = dayjs(currentDate).subtract(1, 'month');
    setCurrentDate(newDate);
  };

  const goToNextMonth = () => {
    const newDate = dayjs(currentDate).add(1, 'month');
    setCurrentDate(newDate);
  };

  // 게이지바 비율 계산 함수 (통합 API 구조)
  const calculateGaugePercentage = (voteCount: number) => {
    if (voteCount === 0) return 0;
    
    // 최대 투표 인원 찾기
    const maxVoteCount = getMaxVoteCount();
    
    // 최대 투표 인원이 0이면 100% 반환
    if (maxVoteCount === 0) return 100;
    
    // 비율 계산 (최대 투표 인원 대비)
    const percentage = Math.round((voteCount / maxVoteCount) * 100);
    return Math.min(percentage, 100); // 최대 100%로 제한
  };

  // 최대 투표 수 계산 함수 (통합 API 구조)
  const getMaxVoteCount = () => {
    if (!unifiedVoteData?.activeSession?.results) return 0;
    const results = unifiedVoteData.activeSession.results;
    return Math.max(
      results.MON?.count || 0,
      results.TUE?.count || 0,
      results.WED?.count || 0,
      results.THU?.count || 0,
      results.FRI?.count || 0
    );
  };

  return (
    <CalendarContainer>
      <CalendarHeader>
        <NavigationButton onClick={goToPreviousMonth}>
          ◀ 이전
        </NavigationButton>
        <MonthYearText>
          {currentDate.format('YYYY년 M월')}
        </MonthYearText>
        <NavigationButton onClick={goToNextMonth}>
          다음 ▶
        </NavigationButton>
      </CalendarHeader>
      
      <CalendarGrid>
        {dayNames.map((dayName, index) => (
          <DayHeader 
            key={dayName} 
            isSunday={index === 0}
            isSaturday={index === 6}
          >
            {dayName}
          </DayHeader>
        ))}
        
        {days.map((dayInfo, index) => {
          // 투표 구간 하드코딩 제거: 월 경계와 무관하게 표시
          const isVoteGroupStart = false;
          const isVoteGroupEnd = false;

          return (
            <DayCell
              key={index}
              isCurrentMonth={dayInfo.isCurrentMonth}
              isToday={dayInfo.isToday}
              hasGame={dayInfo.hasGame}
              hasVote={dayInfo.hasVote}
              isVoteGroupStart={isVoteGroupStart}
              isVoteGroupEnd={isVoteGroupEnd}
            >
              <Flex justifyContent="space-between" alignItems="center" width="100%" mb="8px">
                {dayInfo.isHoliday && dayInfo.holidayName && (
                  <HolidayName>{dayInfo.holidayName}</HolidayName>
                )}
                {dayInfo.hasGame && dayInfo.gameData && (
                  <GameTypeBadge eventType={dayInfo.gameData.eventType}>{dayInfo.gameData.eventType}</GameTypeBadge>
                )}
                <DateNumber 
                  isSunday={dayjs(dayInfo.date).day() === 0}
                  isSaturday={dayjs(dayInfo.date).day() === 6}
                  isHoliday={dayInfo.isHoliday}
                  isToday={dayInfo.isToday}
                  isCurrentMonth={dayInfo.isCurrentMonth}
                >
                  {dayInfo.day}
                </DateNumber>
              </Flex>
              
              {/* 경기 정보 표시 (8월 18-22일 더미데이터만 제외) */}
              {dayInfo.hasGame && dayInfo.gameData && 
               dayInfo.gameData.date && // 날짜가 있는지 확인
               !(dayjs(dayInfo.date).month() === 7 && 
                 (dayjs(dayInfo.date).date() >= 18 && dayjs(dayInfo.date).date() <= 22)) && (
                <GameInfoBox
                  onClick={() => {
                    if (dayInfo.gameData && dayInfo.gameData.date) {
                      onGameClick(dayInfo.gameData);
                    }
                  }}
                >
                  {/* 공휴일이 아닌 경우에만 인원수 pill 표시 */}
                  {!isHolidayDate(dayjs(dayInfo.date).format('M월 D일'), holidays) && (
                    <GameCountBadge>
                      ⚽ {dayInfo.gameData.count}명
                    </GameCountBadge>
                  )}
                  <GameTimeText>
                    🕐 {dayInfo.gameData.time}
                  </GameTimeText>
                  <GameLocationText>
                    📍 {dayInfo.gameData.location}
                  </GameLocationText>
                </GameInfoBox>
              )}
              
              {/* 투표 게이지 표시 - 다음주 일정투표(동적) (월 경계 무시하고 표시) */}
              {dayInfo.hasVote && !isHolidayDate(dayjs(dayInfo.date).format('M월 D일')) && (
                <Tooltip 
                  label={(() => {
                    // 통합 API 데이터에서 직접 투표자 이름 찾기
                    let memberNames: string[] = [];
                    
                    // voteResults가 있고 통합 API 데이터 구조를 사용하는 경우
                    if (voteResults && voteResults.voteSession && voteResults.voteSession.votes) {
                      const dateString = dayjs(dayInfo.date).format('YYYY-MM-DD');
                      memberNames = getVoteMemberNames(dateString, unifiedVoteData, user, allMembers);
                    }
                    
                    console.log('🔍 캘린더 툴팁:', {
                      date: dayjs(dayInfo.date).format('YYYY-MM-DD'),
                      voteCount: dayInfo.voteCount,
                      memberNames,
                      allMembers: allMembers?.length || 0
                    });
                    
                    // 강제표시 로직 제거 - 실제 데이터에서만 가져오기
                    
                    return memberNames.length > 0 
                      ? memberNames.join(', ')
                      : '아직 투표한 인원이 없습니다.';
                  })()}
                  placement="top"
                  hasArrow
                  bg="purple.600"
                  color="white"
                  fontSize="sm"
                  borderRadius="md"
                  px={3}
                  py={2}
                >
                  <VoteContainer>
                    <Badge 
                      colorScheme={dayInfo.voteCount > 0 ? "purple" : "gray"}
                      variant="outline" 
                      borderRadius="full" 
                      px={3} 
                      py={1} 
                      fontSize="xs"
                      w="45px"
                      h="22px"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      fontWeight={dayInfo.voteCount > 0 && dayInfo.voteCount === getMaxVoteCount() ? "bold" : "normal"}
                      mx="auto"
                      borderWidth="0.3px"
                      bg={dayInfo.voteCount > 0 ? "purple.50" : "gray.50"}
                      borderColor={dayInfo.voteCount > 0 ? "purple.400" : "gray.300"}
                      color={dayInfo.voteCount > 0 ? "purple.700" : "gray.600"}
                    >
                      {dayInfo.voteCount}명
                    </Badge>
                    <VoteGauge percentage={calculateGaugePercentage(dayInfo.voteCount)} />
                  </VoteContainer>
                </Tooltip>
              )}
              
              {/* (중복 표기를 방지하기 위해 예비 블록 제거) */}
            </DayCell>
          );
        })}
      </CalendarGrid>
    </CalendarContainer>
  );
};

export default NewCalendarV2;
