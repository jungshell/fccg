/**
 * 구조화된 로깅 시스템
 * 기존 console.log와 호환되면서 구조화된 로깅 제공
 */

import winston from 'winston';

// 로그 레벨 설정
const logLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

// Winston 로거 생성
export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'fccg-backend' },
  transports: [
    // 콘솔 출력 (기존 console.log와 호환)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let msg = `${timestamp} [${level}]: ${message}`;
          if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
          }
          return msg;
        })
      )
    })
  ]
});

// 프로덕션 환경에서는 파일 로깅 추가
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error'
  }));
  logger.add(new winston.transports.File({
    filename: 'logs/combined.log'
  }));
}

// 기존 console.log와 호환되는 헬퍼 함수
export const log = {
  info: (message: string, ...args: any[]) => logger.info(message, ...args),
  error: (message: string, ...args: any[]) => logger.error(message, ...args),
  warn: (message: string, ...args: any[]) => logger.warn(message, ...args),
  debug: (message: string, ...args: any[]) => logger.debug(message, ...args),
};

