import React from 'react';
import styled from 'styled-components';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import { Flex } from '@chakra-ui/react';

// 한국어 설정
dayjs.locale('ko');

// 타입 정의
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
  maxCount?: number;
  isMax?: boolean;
}

interface CalendarProps {
  gameDataForCalendar: Record<string, GameData>;
  allDates: VoteData[];
  onGameClick: (gameData: GameData) => void;
}

// 스타일 컴포넌트
const CalendarContainer = styled.div`
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  font-family: 'Roboto', sans-serif;
`;

const CalendarHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 0 16px;
`;

const MonthYearText = styled.h2`
  font-size: 24px;
  font-weight: 500;
  color: #1976d2;
  margin: 0;
`;

const NavigationButton = styled.button`
  background: transparent;
  color: #666;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
  
  &:hover {
    background: #f5f5f5;
    border-color: #bbb;
  }
`;

const CalendarGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  background: #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
`;

const DayHeader = styled.div<{ isSunday: boolean; isSaturday: boolean }>`
  background: #f5f5f5;
  padding: 8px 8px;
  text-align: center;
  font-weight: 500;
  color: ${props => props.isSunday ? '#e53e3e' : props.isSaturday ? '#3182ce' : '#666'};
  font-size: 14px;
`;

const DayCell = styled.div<{ isCurrentMonth: boolean; isToday: boolean; hasGame: boolean }>`
  background: ${props => props.isCurrentMonth ? 'white' : '#f9f9f9'};
  min-height: 80px;
  padding: 8px;
  position: relative;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background: ${props => props.isCurrentMonth ? '#f5f5f5' : '#f0f0f0'};
  }
  
  ${props => props.isToday && `
    background: #e3f2fd;
    &:hover {
      background: #bbdefb;
    }
  `}
  
  ${props => props.hasGame && `
    background: #f8fafc;
    border: 2px solid #3b82f6;
    border-radius: 8px;
  `}
`;

const DateNumber = styled.div<{ isSunday: boolean; isSaturday: boolean; isHoliday?: boolean }>`
  font-size: 16px;
  font-weight: 500;
  color: ${props => {
    if (props.isHoliday) return '#e53e3e'; // 공휴일은 빨간색
    if (props.isSunday) return '#e53e3e'; // 일요일은 빨간색
    if (props.isSaturday) return '#3182ce'; // 토요일은 파란색
    return '#333'; // 평일은 검은색
  }};
  margin-bottom: 4px;
  text-align: right;
`;

const GameInfoBox = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  background: #f8fafc;
  border: 2px solid #3b82f6;
  border-radius: 8px;
  padding: 6px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: stretch;
  z-index: 10;
`;

const GameTypeBadge = styled.span`
  background: #3b82f6;
  color: white;
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 6px;
  font-weight: bold;
  align-self: flex-start;
`;

const GameCountBadge = styled.span`
  background: #10b981;
  color: white;
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 6px;
  font-weight: bold;
  align-self: flex-end;
`;

const GameTimeText = styled.div`
  text-align: center;
  font-size: 10px;
  color: #374151;
  font-weight: 500;
  margin: 2px 0;
`;

const GameLocationText = styled.div`
  font-size: 9px;
  color: #6b7280;
  text-align: center;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const VoteGauge = styled.div<{ voteCount: number; maxVotes: number }>`
  width: 100%;
  height: 14px;
  background: #f3f4f6;
  border-radius: 7px;
  overflow: hidden;
  margin-top: 8px;
  border: 2px solid #d1d5db;
  position: relative;
  
  &::after {
    content: '';
    display: block;
    height: 100%;
    width: ${props => props.maxVotes > 0 ? (props.voteCount / props.maxVotes) * 100 : 0}%;
    background: ${props => props.voteCount > 0 ? '#8b5cf6' : '#c4b5fd'};
    transition: width 0.3s ease;
    border-radius: 7px;
  }
`;

const VoteCountPill = styled.div<{ isMax: boolean }>`
  background: ${props => props.isMax ? '#8b5cf6' : '#c4b5fd'};
  color: white;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: bold;
  text-align: center;
  margin-top: 8px;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);
  border: 1px solid ${props => props.isMax ? '#7c3aed' : '#a78bfa'};
`;

const HolidayName = styled.span`
  font-size: 10px;
  color: #e53e3e;
  margin-left: 4px;
  font-weight: 400;
  white-space: nowrap;
`;

// 공휴일 정의 (2025년부터)
const holidays: { [date: string]: string } = {
  '2025-01-01': '신정',
  '2025-01-28': '설날연휴',
  '2025-01-29': '설날',
  '2025-01-30': '설날연휴',
  '2025-03-01': '삼일절',
  '2025-05-05': '어린이날',
  '2025-05-06': '어린이날 대체공휴일',
  '2025-06-06': '현충일',
  '2025-08-15': '광복절',
  '2025-10-03': '개천절',
  '2025-10-09': '한글날',
  '2025-10-21': '추석연휴',
  '2025-10-22': '추석',
  '2025-10-23': '추석연휴',
  '2025-12-25': '성탄절',
};

const NewCalendar: React.FC<CalendarProps> = ({
  gameDataForCalendar,
  allDates,
  onGameClick
}) => {
  const [currentDate, setCurrentDate] = React.useState(dayjs());
  
  // 디버깅: 데이터 확인
  console.log('🔍 NewCalendar - allDates:', allDates.length, '개, gameDataForCalendar:', Object.keys(gameDataForCalendar).length, '개');
  
  const startOfMonth = currentDate.startOf('month');
  const endOfMonth = currentDate.endOf('month');
  const startOfCalendar = startOfMonth.startOf('week');
  const endOfCalendar = endOfMonth.endOf('week');
  
  const days = [];
  let day = startOfCalendar;
  
  // 요일 헤더
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  
  while (day.isBefore(endOfCalendar) || day.isSame(endOfCalendar, 'day')) {
    const isCurrentMonth = day.month() === currentDate.month();
    const isToday = day.isSame(currentDate, 'day');
    const dateString = day.format('YYYY-MM-DD');
    
    // 해당 날짜에 경기 정보가 있는지 확인 (날짜 형식 통일)
    let hasGame = false;
    let gameData = null;
    
    // ISO 형식과 YYYY-MM-DD 형식 모두 확인
    const isoDateString = day.toISOString().split('T')[0];
    const shortDateString = day.format('YYYY-MM-DD');
    
    // gameDataForCalendar에서 경기 데이터 찾기
    for (const [key, value] of Object.entries(gameDataForCalendar)) {
      let keyDate = key;
      
      // ISO 형식인 경우 YYYY-MM-DD로 변환
      if (key.includes('T')) {
        keyDate = key.split('T')[0];
      }
      
      if (keyDate === dateString || keyDate === isoDateString || keyDate === shortDateString) {
        hasGame = true;
        gameData = value;
        console.log(`🔍 경기 데이터 매칭 성공: ${dateString} ↔ ${key} → ${value.eventType}`);
        break;
      }
    }
    
    // 디버깅: 경기 데이터 확인
    if (hasGame) {
      console.log(`🔍 날짜 ${dateString}: 경기 정보 발견!`, gameData);
    }
    
    // 공휴일 확인
    const isHoliday = holidays[dateString] !== undefined;
    const holidayName = holidays[dateString];
    
    // 해당 날짜에 투표 정보가 있는지 확인
    const voteData = allDates.find(date => {
      // 날짜 형식 통일
      const voteDateString = dayjs(date.voteDate).format('YYYY-MM-DD');
      const isMatch = voteDateString === dateString;
      
      // 디버깅: 투표 데이터 매칭 확인
      if (allDates.length > 0) {
        console.log(`🔍 날짜 매칭 확인: ${dateString} vs ${voteDateString} = ${isMatch}`);
      }
      
      return isMatch;
    });
    
    days.push({
      date: day.toDate(),
      day: day.date(),
      isCurrentMonth,
      isToday,
      hasGame,
      gameData,
      voteData,
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
        
        {days.map((dayInfo, index) => (
          <DayCell
            key={index}
            isCurrentMonth={dayInfo.isCurrentMonth}
            isToday={dayInfo.isToday}
            hasGame={dayInfo.hasGame}
          >
            <Flex justifyContent="space-between" alignItems="center" width="100%" px="4px">
              {dayInfo.isHoliday && dayInfo.holidayName && (
                <HolidayName>{dayInfo.holidayName}</HolidayName>
              )}
              <DateNumber 
                isSunday={dayjs(dayInfo.date).day() === 0}
                isSaturday={dayjs(dayInfo.date).day() === 6}
                isHoliday={dayInfo.isHoliday}
              >
                {dayInfo.day}
              </DateNumber>
            </Flex>
            
            {/* 경기 정보 표시 */}
            {dayInfo.hasGame && dayInfo.gameData && (
              <GameInfoBox
                onClick={() => onGameClick(dayInfo.gameData!)}
              >
                <GameTypeBadge>{dayInfo.gameData.eventType}</GameTypeBadge>
                <GameCountBadge>{dayInfo.gameData.count}명</GameCountBadge>
                <GameTimeText>🕐 {dayInfo.gameData.time}</GameTimeText>
                <GameLocationText>📍 {dayInfo.gameData.location}</GameLocationText>
              </GameInfoBox>
            )}
            
            {/* 다음주 투표일에만 게이지 표시 */}
            {!dayInfo.hasGame && dayInfo.isCurrentMonth && dayInfo.voteData && (
              <>
                <VoteCountPill isMax={dayInfo.voteData.isMax || false}>
                  {dayInfo.voteData.count || 0}명
                </VoteCountPill>
                <VoteGauge
                  voteCount={dayInfo.voteData.count || 0}
                  maxVotes={dayInfo.voteData.maxCount || 1}
                />
              </>
            )}
            
            {/* 디버깅용 텍스트 삭제됨 */}
          </DayCell>
        ))}
      </CalendarGrid>
    </CalendarContainer>
  );
};

export default NewCalendar;
