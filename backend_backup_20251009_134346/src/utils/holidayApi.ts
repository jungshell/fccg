import axios from 'axios';

// 공공데이터포털 API 설정
const PUBLIC_DATA_API_KEY = process.env.PUBLIC_DATA_API_KEY || 'your_api_key_here';
const HOLIDAY_API_URL = 'http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService';

interface HolidayResponse {
  response: {
    body: {
      items: {
        item: Array<{
          dateName: string;
          locdate: string;
          isHoliday: string;
        }>;
      };
    };
  };
}

// 특정 연도의 공휴일 조회
export const getHolidaysByYear = async (year: string): Promise<string[]> => {
  try {
    console.log(`🗓️ ${year}년 공휴일 조회 시작`);
    
    const response = await axios.get<HolidayResponse>(HOLIDAY_API_URL + '/getRestDeInfo', {
      params: {
        serviceKey: PUBLIC_DATA_API_KEY,
        solYear: year,
        _type: 'json',
        numOfRows: 50
      },
      timeout: 10000
    });

    const holidays = response.data.response.body.items.item
      .filter(item => item.isHoliday === 'Y')
      .map(item => {
        // YYYYMMDD 형식을 YYYY-MM-DD로 변환
        const dateStr = item.locdate.toString();
        return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
      });

    console.log(`✅ ${year}년 공휴일 ${holidays.length}개 조회 완료:`, holidays);
    return holidays;
  } catch (error) {
    console.error(`❌ ${year}년 공휴일 조회 실패:`, error);
    
    // API 실패 시 기본 공휴일 반환 (백업)
    return getDefaultHolidays(year);
  }
};

// 여러 연도의 공휴일 조회
export const getHolidaysByYears = async (years: string[]): Promise<{ [year: string]: string[] }> => {
  const result: { [year: string]: string[] } = {};
  
  for (const year of years) {
    result[year] = await getHolidaysByYear(year);
  }
  
  return result;
};

// 특정 날짜가 공휴일인지 확인
export const isHoliday = async (date: string): Promise<boolean> => {
  const year = date.substring(0, 4);
  const holidays = await getHolidaysByYear(year);
  return holidays.includes(date);
};

// 주어진 날짜 범위에서 공휴일이 아닌 평일만 필터링
export const getWeekdaysOnly = async (dates: string[]): Promise<string[]> => {
  const result: string[] = [];
  
  for (const date of dates) {
    const dayOfWeek = new Date(date).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // 일요일(0) 또는 토요일(6)
    const isHolidayDate = await isHoliday(date);
    
    if (!isWeekend && !isHolidayDate) {
      result.push(date);
    }
  }
  
  return result;
};

// 다음 주 월-금 날짜 생성 (공휴일 제외)
export const getNextWeekWeekdays = async (startDate?: Date): Promise<string[]> => {
  const baseDate = startDate || new Date();
  const nextWeekStart = new Date(baseDate);
  
  // 다음 주 월요일 찾기
  const daysUntilMonday = (8 - baseDate.getDay()) % 7;
  if (daysUntilMonday === 0) daysUntilMonday = 7; // 오늘이 월요일이면 다음 주 월요일
  nextWeekStart.setDate(baseDate.getDate() + daysUntilMonday);
  
  const weekdays: string[] = [];
  
  // 월요일부터 금요일까지 (5일)
  for (let i = 0; i < 5; i++) {
    const currentDate = new Date(nextWeekStart);
    currentDate.setDate(nextWeekStart.getDate() + i);
    
    const dateString = currentDate.toISOString().split('T')[0];
    weekdays.push(dateString);
  }
  
  // 공휴일 제외하고 반환
  return await getWeekdaysOnly(weekdays);
};

// 날짜 포맷팅 (YYYY-MM-DD → M월 D일(요일))
export const formatDateKorean = (dateString: string): string => {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = dayNames[date.getDay()];
  
  return `${month}월 ${day}일(${dayName})`;
};

// API 실패 시 사용할 기본 공휴일 데이터
const getDefaultHolidays = (year: string): string[] => {
  const defaultHolidays: { [year: string]: string[] } = {
    "2024": [
      "2024-01-01", "2024-02-09", "2024-02-10", "2024-02-11", "2024-02-12",
      "2024-03-01", "2024-04-10", "2024-05-05", "2024-05-15", "2024-06-06",
      "2024-08-15", "2024-09-16", "2024-09-17", "2024-09-18", "2024-10-03",
      "2024-10-09", "2024-12-25"
    ],
    "2025": [
      "2025-01-01", "2025-01-28", "2025-01-29", "2025-01-30", "2025-03-01",
      "2025-05-05", "2025-05-15", "2025-06-06", "2025-08-15", "2025-10-03",
      "2025-10-05", "2025-10-06", "2025-10-07", "2025-10-08", "2025-10-09",
      "2025-12-25"
    ],
    "2026": [
      "2026-01-01", "2026-02-16", "2026-02-17", "2026-02-18", "2026-03-01",
      "2026-05-05", "2026-05-15", "2026-06-06", "2026-08-15", "2026-10-03",
      "2026-12-25"
    ]
  };
  
  return defaultHolidays[year] || [];
};

// 디버깅용: 공휴일 정보 출력
export const logHolidayInfo = async (dates: string[]): Promise<void> => {
  console.log('📅 날짜별 공휴일 정보:');
  for (const date of dates) {
    const isHolidayDate = await isHoliday(date);
    const dayOfWeek = new Date(date).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const status = isHolidayDate ? '공휴일' : isWeekend ? '주말' : '평일';
    
    console.log(`  ${formatDateKorean(date)}: ${status}`);
  }
};
