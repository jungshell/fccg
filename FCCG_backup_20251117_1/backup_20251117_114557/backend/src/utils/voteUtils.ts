/**
 * 투표 관련 유틸리티 함수
 * 날짜 계산, 세션 검증 등 공통 로직 통합
 */

/**
 * 한국 시간 기준 현재 시간 반환
 */
export function getKoreaTime(): Date {
  const currentTime = new Date();
  return new Date(currentTime.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
}

/**
 * 이번주 월요일 계산 (한국시간 기준)
 */
export function getThisWeekMonday(koreaTime?: Date): Date {
  const korea = koreaTime || getKoreaTime();
  const currentDay = korea.getDay(); // 0: 일요일, 1: 월요일, ..., 6: 토요일
  
  let daysUntilMonday: number;
  if (currentDay === 0) {
    daysUntilMonday = -6; // 지난 월요일
  } else if (currentDay === 1) {
    daysUntilMonday = 0; // 오늘
  } else {
    daysUntilMonday = 1 - currentDay; // 이번주 월요일
  }
  
  const thisWeekMonday = new Date(korea);
  thisWeekMonday.setDate(korea.getDate() + daysUntilMonday);
  thisWeekMonday.setHours(0, 0, 0, 0);
  
  return thisWeekMonday;
}

/**
 * 다음주 월요일 계산
 */
export function getNextWeekMonday(koreaTime?: Date): Date {
  const thisWeekMonday = getThisWeekMonday(koreaTime);
  const nextWeekMonday = new Date(thisWeekMonday);
  nextWeekMonday.setDate(thisWeekMonday.getDate() + 7);
  nextWeekMonday.setHours(0, 0, 0, 0);
  return nextWeekMonday;
}

/**
 * 주간 금요일 계산 (월요일 기준 +4일)
 */
export function getWeekFriday(weekMonday: Date): Date {
  const friday = new Date(weekMonday);
  friday.setDate(weekMonday.getDate() + 4);
  friday.setHours(23, 59, 59, 999);
  return friday;
}

/**
 * 세션이 만료되었는지 확인
 */
export function isSessionExpired(session: { weekStartDate: Date; endTime?: Date }): boolean {
  const koreaTime = getKoreaTime();
  const weekEnd = session.endTime || getWeekFriday(new Date(session.weekStartDate));
  return weekEnd < koreaTime;
}

/**
 * 세션이 활성 상태인지 확인
 */
export function isSessionActive(session: { 
  isActive: boolean; 
  isCompleted: boolean; 
  weekStartDate: Date;
  endTime?: Date;
}): boolean {
  if (!session.isActive || session.isCompleted) {
    return false;
  }
  
  // 만료된 세션은 비활성
  if (isSessionExpired(session)) {
    return false;
  }
  
  return true;
}

/**
 * 투표 데이터 파싱 (안전한 JSON 파싱)
 */
export function parseVoteDays(selectedDays: string | string[] | null | undefined): string[] {
  if (!selectedDays) {
    return [];
  }
  
  if (Array.isArray(selectedDays)) {
    return selectedDays.filter(day => typeof day === 'string' && day.length > 0);
  }
  
  if (typeof selectedDays === 'string') {
    try {
      const parsed = JSON.parse(selectedDays);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('투표 데이터 파싱 실패:', selectedDays, e);
      return [];
    }
  }
  
  return [];
}

/**
 * 한국어 날짜를 영어 요일 코드로 변환
 */
export function convertKoreanDateToDayCode(koreanDate: string): string {
  if (koreanDate.includes('월)')) return 'MON';
  if (koreanDate.includes('화)')) return 'TUE';
  if (koreanDate.includes('수)')) return 'WED';
  if (koreanDate.includes('목)')) return 'THU';
  if (koreanDate.includes('금)')) return 'FRI';
  return koreanDate; // 이미 영어 코드인 경우 그대로 반환
}

