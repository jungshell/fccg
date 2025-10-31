// 보안 유틸리티
import { trackUserBehavior } from './analytics';

// 암호화 키 관리
class EncryptionManager {
  private static instance: EncryptionManager;
  private masterKey: string | null = null;
  private sessionKey: string | null = null;

  private constructor() {
    this.initializeKeys();
  }

  static getInstance(): EncryptionManager {
    if (!EncryptionManager.instance) {
      EncryptionManager.instance = new EncryptionManager();
    }
    return EncryptionManager.instance;
  }

  private async initializeKeys() {
    // 마스터 키 생성 (브라우저별 고유)
    const deviceId = await this.getDeviceId();
    this.masterKey = await this.generateKey(deviceId);
    
    // 세션 키 생성
    this.sessionKey = await this.generateKey(Date.now().toString());
  }

  // 디바이스 ID 생성
  private async getDeviceId(): Promise<string> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Device fingerprint', 2, 2);
    }
    
    const fingerprint = canvas.toDataURL();
    const userAgent = navigator.userAgent;
    const screenInfo = `${screen.width}x${screen.height}x${screen.colorDepth}`;
    
    const combined = `${fingerprint}-${userAgent}-${screenInfo}`;
    return await this.sha256(combined);
  }

  // SHA-256 해시
  private async sha256(message: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // 암호화 키 생성
  private async generateKey(seed: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(seed);
    const key = await crypto.subtle.importKey(
      'raw',
      data,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: encoder.encode('fc-cg-salt'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      key,
      256
    );
    
    return Array.from(new Uint8Array(derivedBits))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // 데이터 암호화
  async encrypt(data: string, keyType: 'master' | 'session' = 'session'): Promise<string> {
    const key = keyType === 'master' ? this.masterKey : this.sessionKey;
    if (!key) throw new Error('암호화 키가 초기화되지 않았습니다.');

    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    
    // 랜덤 IV 생성
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // 암호화 키 생성
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(key),
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    
    // 데이터 암호화
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      dataBuffer
    );
    
    // IV와 암호화된 데이터를 Base64로 인코딩
    const encryptedArray = new Uint8Array(encryptedBuffer);
    const combined = new Uint8Array(iv.length + encryptedArray.length);
    combined.set(iv);
    combined.set(encryptedArray, iv.length);
    
    return btoa(String.fromCharCode(...combined));
  }

  // 데이터 복호화
  async decrypt(encryptedData: string, keyType: 'master' | 'session' = 'session'): Promise<string> {
    const key = keyType === 'master' ? this.masterKey : this.sessionKey;
    if (!key) throw new Error('암호화 키가 초기화되지 않았습니다.');

    try {
      const encoder = new TextEncoder();
      const combined = new Uint8Array(
        atob(encryptedData).split('').map(char => char.charCodeAt(0))
      );
      
      // IV 추출 (처음 12바이트)
      const iv = combined.slice(0, 12);
      const encryptedArray = combined.slice(12);
      
      // 복호화 키 생성
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(key),
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );
      
      // 데이터 복호화
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        encryptedArray
      );
      
      return new TextDecoder().decode(decryptedBuffer);
    } catch (error) {
      console.error('복호화 실패:', error);
      throw new Error('데이터 복호화에 실패했습니다.');
    }
  }

  // 세션 키 갱신
  async rotateSessionKey(): Promise<void> {
    this.sessionKey = await this.generateKey(Date.now().toString());
  }
}

// 보안 저장소
class SecureStorage {
  private encryptionManager = EncryptionManager.getInstance();

  // 민감한 데이터 저장
  async setSecureItem(key: string, value: any): Promise<void> {
    try {
      const encryptedValue = await this.encryptionManager.encrypt(JSON.stringify(value));
      localStorage.setItem(`secure_${key}`, encryptedValue);
    } catch (error) {
      console.error('보안 저장 실패:', error);
      throw error;
    }
  }

  // 민감한 데이터 조회
  async getSecureItem<T>(key: string): Promise<T | null> {
    try {
      const encryptedValue = localStorage.getItem(`secure_${key}`);
      if (!encryptedValue) return null;
      
      const decryptedValue = await this.encryptionManager.decrypt(encryptedValue);
      return JSON.parse(decryptedValue);
    } catch (error) {
      console.error('보안 조회 실패:', error);
      return null;
    }
  }

  // 민감한 데이터 삭제
  removeSecureItem(key: string): void {
    localStorage.removeItem(`secure_${key}`);
  }

  // 모든 보안 데이터 삭제
  clearSecureStorage(): void {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('secure_')) {
        localStorage.removeItem(key);
      }
    });
  }
}

// CSRF 토큰 관리
class CSRFProtection {
  private static token: string | null = null;

  // CSRF 토큰 생성
  static generateToken(): string {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    this.token = token;
    return token;
  }

  // CSRF 토큰 검증
  static validateToken(token: string): boolean {
    return this.token === token;
  }

  // CSRF 토큰 가져오기
  static getToken(): string | null {
    return this.token;
  }
}

// 세션 관리
class SessionManager {
  private static instance: SessionManager;
  private sessionTimeout: number = 30 * 60 * 1000; // 30분
  private lastActivity: number = Date.now();

  private constructor() {
    this.startActivityMonitoring();
  }

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  // 세션 시작
  startSession(): void {
    this.lastActivity = Date.now();
    this.setSessionData('startTime', Date.now());
    this.setSessionData('lastActivity', this.lastActivity);
  }

  // 세션 갱신
  refreshSession(): void {
    this.lastActivity = Date.now();
    this.setSessionData('lastActivity', this.lastActivity);
  }

  // 세션 만료 확인
  isSessionExpired(): boolean {
    const now = Date.now();
    return (now - this.lastActivity) > this.sessionTimeout;
  }

  // 세션 종료
  endSession(): void {
    this.clearSessionData();
    this.lastActivity = 0;
  }

  // 자동 로그아웃 설정
  setAutoLogout(enabled: boolean, timeout?: number): void {
    if (timeout) {
      this.sessionTimeout = timeout;
    }
    
    this.setSessionData('autoLogout', enabled);
    this.setSessionData('sessionTimeout', this.sessionTimeout);
  }

  // 활동 모니터링 시작
  private startActivityMonitoring(): void {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    const updateActivity = () => {
      this.refreshSession();
    };

    events.forEach(event => {
      document.addEventListener(event, updateActivity, true);
    });

    // 주기적으로 세션 만료 확인
    setInterval(() => {
      if (this.isSessionExpired()) {
        this.handleSessionExpired();
      }
    }, 60000); // 1분마다 확인
  }

  // 세션 만료 처리
  private handleSessionExpired(): void {
    const autoLogout = this.getSessionData('autoLogout');
    
    if (autoLogout) {
      // 자동 로그아웃
      this.endSession();
      window.location.href = '/login?expired=true';
    } else {
      // 경고 표시
      this.showSessionWarning();
    }
  }

  // 세션 만료 경고
  private showSessionWarning(): void {
    const warning = document.createElement('div');
    warning.id = 'session-warning';
    warning.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff6b6b;
        color: white;
        padding: 15px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        max-width: 300px;
      ">
        <h4 style="margin: 0 0 10px 0;">세션 만료 경고</h4>
        <p style="margin: 0 0 15px 0;">세션이 곧 만료됩니다. 계속 사용하려면 클릭하세요.</p>
        <button onclick="this.parentElement.remove()" style="
          background: white;
          color: #ff6b6b;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        ">확인</button>
      </div>
    `;
    
    document.body.appendChild(warning);
    
    // 10초 후 자동 제거
    setTimeout(() => {
      if (warning.parentElement) {
        warning.parentElement.removeChild(warning);
      }
    }, 10000);
  }

  // 세션 데이터 관리
  private setSessionData(key: string, value: any): void {
    sessionStorage.setItem(`session_${key}`, JSON.stringify(value));
  }

  private getSessionData(key: string): any {
    const value = sessionStorage.getItem(`session_${key}`);
    return value ? JSON.parse(value) : null;
  }

  private clearSessionData(): void {
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
      if (key.startsWith('session_')) {
        sessionStorage.removeItem(key);
      }
    });
  }
}

// 입력 검증
class InputValidation {
  // XSS 방지
  static sanitizeInput(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  // SQL 인젝션 방지 (간단한 버전)
  static validateSQLInput(input: string): boolean {
    const sqlPattern = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i;
    return !sqlPattern.test(input);
  }

  // 이메일 검증
  static validateEmail(email: string): boolean {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email);
  }

  // 비밀번호 강도 검증
  static validatePassword(password: string): {
    isValid: boolean;
    strength: 'weak' | 'medium' | 'strong';
    issues: string[];
  } {
    const issues: string[] = [];
    let score = 0;

    if (password.length < 8) {
      issues.push('비밀번호는 최소 8자 이상이어야 합니다.');
    } else {
      score += 1;
    }

    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score < 3) {
      issues.push('대문자, 소문자, 숫자, 특수문자를 포함해야 합니다.');
    }

    const strength = score < 3 ? 'weak' : score < 4 ? 'medium' : 'strong';
    const isValid = issues.length === 0;

    return { isValid, strength, issues };
  }
}

// 보안 이벤트 추적
class SecurityEventTracker {
  static trackSecurityEvent(event: string, details?: any): void {
    // 보안 이벤트 로깅
    console.warn(`보안 이벤트: ${event}`, details);
    
    // Google Analytics에 보안 이벤트 전송
    trackUserBehavior.error('security', event);
    
    // 로컬에 보안 로그 저장
    this.logSecurityEvent(event, details);
  }

  private static logSecurityEvent(event: string, details?: any): void {
    try {
      const logs = JSON.parse(localStorage.getItem('security_logs') || '[]');
      logs.push({
        timestamp: new Date().toISOString(),
        event,
        details,
        userAgent: navigator.userAgent,
        url: window.location.href,
      });
      
      // 최근 100개만 유지
      if (logs.length > 100) {
        logs.splice(0, logs.length - 100);
      }
      
      localStorage.setItem('security_logs', JSON.stringify(logs));
    } catch (error) {
      console.error('보안 로그 저장 실패:', error);
    }
  }
}

// 보안 유틸리티 내보내기
export const secureStorage = new SecureStorage();
export const sessionManager = SessionManager.getInstance();
export const csrfProtection = CSRFProtection;
export const inputValidation = InputValidation;
export const securityEventTracker = SecurityEventTracker;
