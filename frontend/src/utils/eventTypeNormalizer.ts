// 경기 유형 정규화 유틸리티
// 비규격 값을 규격 값으로 변환

export type NormalizedEventType = '매치' | '자체' | '회식' | '기타';

/**
 * 비규격 eventType을 규격 값으로 정규화
 */
export function normalizeEventType(eventType: string | null | undefined): NormalizedEventType {
  if (!eventType || eventType.trim() === '') {
    return '자체';
  }
  
  const normalized = eventType.trim();
  
  // 이미 규격 값이면 그대로 반환
  if (['매치', '자체', '회식', '기타'].includes(normalized)) {
    return normalized as NormalizedEventType;
  }
  
  // 비규격 값 정규화
  if (['풋살', 'FRIENDLY', 'FRIENDLY_MATCH', 'friendly', '풋살장', 'MATCH'].includes(normalized)) {
    return '매치';
  }
  
  if (['SELF', 'self', '자체훈련'].includes(normalized)) {
    return '자체';
  }
  
  if (['DINNER', 'dinner', '회식모임'].includes(normalized)) {
    return '회식';
  }
  
  // 알 수 없는 값은 기타로 처리
  return '기타';
}

/**
 * eventType 표시용 텍스트 반환 (항상 규격 값만 반환)
 */
export function getEventTypeDisplay(eventType: string | null | undefined): string {
  return normalizeEventType(eventType);
}

