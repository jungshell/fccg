/**
 * 모니터링 및 에러 추적 유틸리티
 */

interface ErrorLog {
  timestamp: Date;
  level: 'error' | 'warn' | 'info';
  message: string;
  stack?: string;
  context?: Record<string, any>;
  userId?: number;
}

class MonitoringService {
  private errorLogs: ErrorLog[] = [];
  private readonly maxLogs = 1000; // 최대 로그 수

  /**
   * 에러 로깅
   */
  logError(error: Error | string, context?: Record<string, any>, userId?: number) {
    const errorLog: ErrorLog = {
      timestamp: new Date(),
      level: 'error',
      message: typeof error === 'string' ? error : error.message,
      stack: typeof error === 'object' && error.stack ? error.stack : undefined,
      context,
      userId
    };

    this.errorLogs.unshift(errorLog);
    
    // 최대 로그 수 제한
    if (this.errorLogs.length > this.maxLogs) {
      this.errorLogs = this.errorLogs.slice(0, this.maxLogs);
    }

    // 콘솔 출력
    console.error('❌ [ERROR]', errorLog.message, context || '');
    
    // 프로덕션 환경에서는 외부 서비스로 전송 가능
    if (process.env.NODE_ENV === 'production') {
      this.sendToExternalService(errorLog);
    }
  }

  /**
   * 경고 로깅
   */
  logWarning(message: string, context?: Record<string, any>) {
    const warningLog: ErrorLog = {
      timestamp: new Date(),
      level: 'warn',
      message,
      context
    };

    this.errorLogs.unshift(warningLog);
    
    if (this.errorLogs.length > this.maxLogs) {
      this.errorLogs = this.errorLogs.slice(0, this.maxLogs);
    }

    console.warn('⚠️ [WARN]', message, context || '');
  }

  /**
   * 정보 로깅
   */
  logInfo(message: string, context?: Record<string, any>) {
    const infoLog: ErrorLog = {
      timestamp: new Date(),
      level: 'info',
      message,
      context
    };

    console.log('ℹ️ [INFO]', message, context || '');
  }

  /**
   * 최근 에러 로그 조회
   */
  getRecentErrors(limit: number = 50): ErrorLog[] {
    return this.errorLogs
      .filter(log => log.level === 'error')
      .slice(0, limit);
  }

  /**
   * 에러 통계
   */
  getErrorStats() {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentErrors = this.errorLogs.filter(
      log => log.timestamp >= last24Hours && log.level === 'error'
    );

    return {
      totalErrors: this.errorLogs.filter(log => log.level === 'error').length,
      last24Hours: recentErrors.length,
      recentErrors: recentErrors.slice(0, 10)
    };
  }

  /**
   * 외부 모니터링 서비스로 전송 (선택사항)
   */
  private async sendToExternalService(errorLog: ErrorLog) {
    // Sentry, LogRocket, Datadog 등으로 전송 가능
    // 현재는 로그만 남김
    if (process.env.SENTRY_DSN) {
      // Sentry 연동 예시
      // Sentry.captureException(new Error(errorLog.message), {
      //   extra: errorLog.context,
      //   user: errorLog.userId ? { id: errorLog.userId } : undefined
      // });
    }
  }

  /**
   * 헬스체크 정보
   */
  getHealthStatus() {
    const stats = this.getErrorStats();
    const isHealthy = stats.last24Hours < 100; // 24시간 내 100개 미만이면 정상

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      errorStats: stats,
      timestamp: new Date().toISOString()
    };
  }
}

// 싱글톤 인스턴스
export const monitoring = new MonitoringService();

// 전역 에러 핸들러
process.on('uncaughtException', (error) => {
  monitoring.logError(error, { type: 'uncaughtException' });
});

process.on('unhandledRejection', (reason, promise) => {
  monitoring.logError(
    reason instanceof Error ? reason : new Error(String(reason)),
    { type: 'unhandledRejection', promise: promise.toString() }
  );
});

