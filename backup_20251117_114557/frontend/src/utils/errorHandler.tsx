import React from 'react';
import { AppError, ValidationError } from '../types/common';
import { getErrorMessage, ERROR_MESSAGES } from './errorMessages';
import { logger } from './logger';

// 에러 타입 정의
export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: number;
  additionalData?: Record<string, any>;
}

// 에러 처리 클래스
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: AppError[] = [];

  private constructor() {}

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  // 에러 로깅
  public logError(error: any, context?: ErrorContext): AppError {
    const appError: AppError = {
      code: this.getErrorCode(error),
      message: getErrorMessage(error),
      details: this.getErrorDetails(error),
      timestamp: new Date().toISOString(),
    };

    // 에러 로그에 추가
    this.errorLog.push(appError);

    // 콘솔에 로깅
    console.error('Error occurred:', {
      error: appError,
      context,
      stack: error?.stack,
    });

    // 외부 로깅 서비스에 전송 (예: Sentry, LogRocket 등)
    this.sendToExternalLogger(appError, context);

    return appError;
  }

  // 에러 코드 추출
  private getErrorCode(error: any): string {
    if (error?.code) return error.code;
    if (error?.response?.status) return error.response.status.toString();
    if (error?.name) return error.name;
    return 'UNKNOWN_ERROR';
  }

  // 에러 세부사항 추출
  private getErrorDetails(error: any): any {
    const details: any = {};

    if (error?.response?.data) {
      details.responseData = error.response.data;
    }

    if (error?.config) {
      details.requestConfig = {
        url: error.config.url,
        method: error.config.method,
        headers: error.config.headers,
      };
    }

    if (error?.stack) {
      details.stack = error.stack;
    }

    return details;
  }

  // 외부 로깅 서비스에 전송
  private sendToExternalLogger(error: AppError, context?: ErrorContext): void {
    try {
      // 실제 프로덕션에서는 Sentry, LogRocket 등의 서비스 사용
      if (process.env.NODE_ENV === 'production') {
        // 예시: Sentry.captureException(error);
        logger.error('External logging would be sent here', { error, context });
      }
    } catch (loggingError) {
      console.error('Failed to send error to external logger:', loggingError);
    }
  }

  // 유효성 검사 에러 처리
  public handleValidationError(errors: ValidationError[]): AppError {
    const appError: AppError = {
      code: 'VALIDATION_ERROR',
      message: ERROR_MESSAGES.VALIDATION.REQUIRED,
      details: { validationErrors: errors },
      timestamp: new Date().toISOString(),
    };

    this.errorLog.push(appError);
    return appError;
  }

  // 네트워크 에러 처리
  public handleNetworkError(error: any, context?: ErrorContext): AppError {
    const appError: AppError = {
      code: this.getNetworkErrorCode(error),
      message: this.getNetworkErrorMessage(error),
      details: this.getErrorDetails(error),
      timestamp: new Date().toISOString(),
    };

    this.errorLog.push(appError);
    return appError;
  }

  // 네트워크 에러 코드 추출
  private getNetworkErrorCode(error: any): string {
    if (error?.response?.status) {
      return error.response.status.toString();
    }
    if (error?.code === 'NETWORK_ERROR') {
      return 'NETWORK_ERROR';
    }
    if (error?.code === 'TIMEOUT') {
      return 'TIMEOUT';
    }
    return 'NETWORK_ERROR';
  }

  // 네트워크 에러 메시지 추출
  private getNetworkErrorMessage(error: any): string {
    if (error?.response?.status) {
      switch (error.response.status) {
        case 400:
          return ERROR_MESSAGES.NETWORK.BAD_REQUEST;
        case 401:
          return ERROR_MESSAGES.NETWORK.UNAUTHORIZED;
        case 403:
          return ERROR_MESSAGES.NETWORK.FORBIDDEN;
        case 404:
          return ERROR_MESSAGES.NETWORK.NOT_FOUND;
        case 500:
        case 502:
        case 503:
        case 504:
          return ERROR_MESSAGES.NETWORK.SERVER_ERROR;
        default:
          return ERROR_MESSAGES.NETWORK.SERVER_ERROR;
      }
    }
    if (error?.code === 'NETWORK_ERROR') {
      return ERROR_MESSAGES.NETWORK.CONNECTION_FAILED;
    }
    if (error?.code === 'TIMEOUT') {
      return ERROR_MESSAGES.NETWORK.TIMEOUT;
    }
    return ERROR_MESSAGES.NETWORK.CONNECTION_FAILED;
  }

  // API 에러 처리
  public handleApiError(error: any, context?: ErrorContext): AppError {
    const appError: AppError = {
      code: this.getApiErrorCode(error),
      message: this.getApiErrorMessage(error),
      details: this.getErrorDetails(error),
      timestamp: new Date().toISOString(),
    };

    this.errorLog.push(appError);
    return appError;
  }

  // API 에러 코드 추출
  private getApiErrorCode(error: any): string {
    if (error?.response?.data?.code) {
      return error.response.data.code;
    }
    if (error?.response?.status) {
      return error.response.status.toString();
    }
    return 'API_ERROR';
  }

  // API 에러 메시지 추출
  private getApiErrorMessage(error: any): string {
    if (error?.response?.data?.message) {
      return error.response.data.message;
    }
    if (error?.response?.data?.error) {
      return error.response.data.error;
    }
    return getErrorMessage(error);
  }

  // 에러 로그 조회
  public getErrorLog(): AppError[] {
    return [...this.errorLog];
  }

  // 에러 로그 초기화
  public clearErrorLog(): void {
    this.errorLog = [];
  }

  // 특정 에러 필터링
  public getErrorsByCode(code: string): AppError[] {
    return this.errorLog.filter(error => error.code === code);
  }

  // 최근 에러 조회
  public getRecentErrors(count: number = 10): AppError[] {
    return this.errorLog.slice(-count);
  }

  // 에러 통계
  public getErrorStats(): {
    total: number;
    byCode: Record<string, number>;
    byTime: Record<string, number>;
  } {
    const stats = {
      total: this.errorLog.length,
      byCode: {} as Record<string, number>,
      byTime: {} as Record<string, number>,
    };

    this.errorLog.forEach(error => {
      // 코드별 통계
      stats.byCode[error.code] = (stats.byCode[error.code] || 0) + 1;

      // 시간별 통계 (시간 단위)
      const hour = new Date(error.timestamp).getHours();
      const timeKey = `${hour}:00`;
      stats.byTime[timeKey] = (stats.byTime[timeKey] || 0) + 1;
    });

    return stats;
  }
}

// 전역 에러 핸들러 인스턴스
export const errorHandler = ErrorHandler.getInstance();

// 에러 처리 유틸리티 함수들
export const handleError = (error: any, context?: ErrorContext): AppError => {
  return errorHandler.logError(error, context);
};

export const handleValidationError = (errors: ValidationError[]): AppError => {
  return errorHandler.handleValidationError(errors);
};

export const handleNetworkError = (error: any, context?: ErrorContext): AppError => {
  return errorHandler.handleNetworkError(error, context);
};

export const handleApiError = (error: any, context?: ErrorContext): AppError => {
  return errorHandler.handleApiError(error, context);
};

// React 컴포넌트용 에러 바운더리
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ComponentType<{ error: AppError }> },
  { hasError: boolean; error: AppError | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any): { hasError: boolean; error: AppError } {
    const appError = errorHandler.logError(error, {
      component: 'ErrorBoundary',
      action: 'componentDidCatch',
    });

    return { hasError: true, error: appError };
  }

  componentDidCatch(error: any, errorInfo: any): void {
    errorHandler.logError(error, {
      component: 'ErrorBoundary',
      action: 'componentDidCatch',
      additionalData: { errorInfo },
    });
  }

  render(): React.ReactNode {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error} />;
    }

    return this.props.children;
  }
}

// 기본 에러 폴백 컴포넌트
const DefaultErrorFallback: React.FC<{ error: AppError }> = ({ error }) => {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h2>오류가 발생했습니다</h2>
      <p>{error.message}</p>
      <button onClick={() => window.location.reload()}>
        페이지 새로고침
      </button>
    </div>
  );
};

// 비동기 함수 에러 처리 래퍼
export const withErrorHandling = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context?: ErrorContext
) => {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      const appError = errorHandler.logError(error, context);
      throw appError;
    }
  };
};

// 동기 함수 에러 처리 래퍼
export const withSyncErrorHandling = <T extends any[], R>(
  fn: (...args: T) => R,
  context?: ErrorContext
) => {
  return (...args: T): R => {
    try {
      return fn(...args);
    } catch (error) {
      const appError = errorHandler.logError(error, context);
      throw appError;
    }
  };
};

