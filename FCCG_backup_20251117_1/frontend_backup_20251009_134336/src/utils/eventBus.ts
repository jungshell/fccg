/**
 * 전역 이벤트 버스 시스템
 * 페이지 간 데이터 동기화를 위한 이벤트 관리
 */

export interface EventData {
  type: string;
  payload?: any;
  timestamp: number;
}

class EventBus {
  private listeners: Map<string, Function[]> = new Map();

  /**
   * 이벤트 리스너 등록
   */
  on(eventType: string, callback: Function): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(callback);
  }

  /**
   * 이벤트 리스너 제거
   */
  off(eventType: string, callback: Function): void {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * 이벤트 발생
   */
  emit(eventType: string, payload?: any): void {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      const eventData: EventData = {
        type: eventType,
        payload,
        timestamp: Date.now()
      };
      
      callbacks.forEach(callback => {
        try {
          callback(eventData);
        } catch (error) {
          console.error(`이벤트 처리 오류 (${eventType}):`, error);
        }
      });
    }
  }

  /**
   * 모든 리스너 제거
   */
  clear(): void {
    this.listeners.clear();
  }
}

// 전역 이벤트 버스 인스턴스
export const eventBus = new EventBus();

// 이벤트 타입 상수
export const EVENT_TYPES = {
  // 투표 관련
  VOTE_SESSION_CREATED: 'vote_session_created',
  VOTE_SESSION_CLOSED: 'vote_session_closed',
  VOTE_SUBMITTED: 'vote_submitted',
  VOTE_DELETED: 'vote_deleted',
  
  // 경기 관련
  GAME_CREATED: 'game_created',
  GAME_UPDATED: 'game_updated',
  GAME_DELETED: 'game_deleted',
  GAME_CONFIRMED: 'game_confirmed',
  AUTO_GAME_GENERATED: 'auto_game_generated',
  
  // 회원 관련
  MEMBER_ADDED: 'member_added',
  MEMBER_UPDATED: 'member_updated',
  MEMBER_STATUS_CHANGED: 'member_status_changed',
  
  // 데이터 동기화
  DATA_REFRESH_NEEDED: 'data_refresh_needed',
  SYNC_COMPLETE: 'sync_complete',
  
  // 알림 관련
  NOTIFICATION_SENT: 'notification_sent',
  ALERT_SHOW: 'alert_show',
  
  // 로딩 상태
  LOADING_START: 'loading_start',
  LOADING_END: 'loading_end'
} as const;

// 편의 함수들
export const emitVoteSessionCreated = (sessionData: any) => {
  eventBus.emit(EVENT_TYPES.VOTE_SESSION_CREATED, sessionData);
};

export const emitVoteSubmitted = (voteData: any) => {
  eventBus.emit(EVENT_TYPES.VOTE_SUBMITTED, voteData);
};

export const emitGameConfirmed = (gameData: any) => {
  eventBus.emit(EVENT_TYPES.GAME_CONFIRMED, gameData);
};

export const emitMemberAdded = (memberData: any) => {
  eventBus.emit(EVENT_TYPES.MEMBER_ADDED, memberData);
};

export const emitDataRefreshNeeded = (dataType: string) => {
  eventBus.emit(EVENT_TYPES.DATA_REFRESH_NEEDED, { dataType });
};

export const emitLoadingStart = (operation: string) => {
  eventBus.emit(EVENT_TYPES.LOADING_START, { operation });
};

export const emitLoadingEnd = (operation: string) => {
  eventBus.emit(EVENT_TYPES.LOADING_END, { operation });
};

export const emitAlert = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
  eventBus.emit(EVENT_TYPES.ALERT_SHOW, { message, type });
};

export default eventBus;
