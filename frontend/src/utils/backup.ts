// 백업 및 복구 시스템
import { secureStorage } from './security';
import { performanceUtils } from './performance';

interface BackupData {
  version: string;
  timestamp: number;
  checksum: string;
  data: {
    [key: string]: any;
  };
  metadata: {
    totalSize: number;
    itemCount: number;
    compressionRatio: number;
  };
}

interface BackupConfig {
  autoBackup: boolean;
  backupInterval: number; // milliseconds
  maxBackups: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
}

class BackupManager {
  private config: BackupConfig;
  private backupHistory: BackupData[] = [];
  private isBackingUp: boolean = false;

  constructor(config: Partial<BackupConfig> = {}) {
    this.config = {
      autoBackup: true,
      backupInterval: 24 * 60 * 60 * 1000, // 24시간
      maxBackups: 10,
      compressionEnabled: true,
      encryptionEnabled: true,
      ...config,
    };

    this.loadBackupHistory();
    this.startAutoBackup();
  }

  // 전체 데이터 백업
  async createBackup(description?: string): Promise<BackupData> {
    if (this.isBackingUp) {
      throw new Error('백업이 이미 진행 중입니다.');
    }

    this.isBackingUp = true;
    const startTime = performance.now();

    try {
      console.log('백업 시작...');

      // 모든 localStorage 데이터 수집
      const allData: { [key: string]: any } = {};
      const keys = Object.keys(localStorage);
      
      for (const key of keys) {
        try {
          const value = localStorage.getItem(key);
          if (value) {
            allData[key] = JSON.parse(value);
          }
        } catch (error) {
          console.warn(`백업 중 오류 (${key}):`, error);
        }
      }

      // 백업 데이터 생성
      const backupData: BackupData = {
        version: '1.0.0',
        timestamp: Date.now(),
        checksum: await this.generateChecksum(allData),
        data: allData,
        metadata: {
          totalSize: JSON.stringify(allData).length,
          itemCount: Object.keys(allData).length,
          compressionRatio: 1.0,
        },
      };

      // 데이터 압축
      if (this.config.compressionEnabled) {
        backupData.data = await this.compressData(backupData.data);
        backupData.metadata.compressionRatio = 
          JSON.stringify(backupData.data).length / backupData.metadata.totalSize;
      }

      // 데이터 암호화
      if (this.config.encryptionEnabled) {
        backupData.data = await this.encryptData(backupData.data);
      }

      // 백업 저장
      await this.saveBackup(backupData, description);

      // 백업 히스토리 업데이트
      this.backupHistory.unshift(backupData);
      this.cleanupOldBackups();
      this.saveBackupHistory();

      const duration = performance.now() - startTime;
      console.log(`백업 완료 (${duration.toFixed(2)}ms)`);

      return backupData;

    } catch (error) {
      console.error('백업 실패:', error);
      throw error;
    } finally {
      this.isBackingUp = false;
    }
  }

  // 백업 복원
  async restoreBackup(backupData: BackupData, options?: {
    merge?: boolean;
    overwrite?: boolean;
  }): Promise<void> {
    const startTime = performance.now();
    
    try {
      console.log('백업 복원 시작...');

      let data = backupData.data;

      // 데이터 복호화
      if (this.config.encryptionEnabled) {
        data = await this.decryptData(data);
      }

      // 데이터 압축 해제
      if (this.config.compressionEnabled) {
        data = await this.decompressData(data);
      }

      // 체크섬 검증
      const currentChecksum = await this.generateChecksum(data);
      if (currentChecksum !== backupData.checksum) {
        throw new Error('백업 데이터가 손상되었습니다.');
      }

      // 복원 모드에 따른 처리
      if (options?.overwrite) {
        // 전체 덮어쓰기
        localStorage.clear();
        for (const [key, value] of Object.entries(data)) {
          localStorage.setItem(key, JSON.stringify(value));
        }
      } else if (options?.merge) {
        // 병합 모드
        for (const [key, value] of Object.entries(data)) {
          if (!localStorage.getItem(key)) {
            localStorage.setItem(key, JSON.stringify(value));
          }
        }
      } else {
        // 선택적 복원 (기본값)
        for (const [key, value] of Object.entries(data)) {
          if (this.shouldRestoreKey(key)) {
            localStorage.setItem(key, JSON.stringify(value));
          }
        }
      }

      const duration = performance.now() - startTime;
      console.log(`백업 복원 완료 (${duration.toFixed(2)}ms)`);

    } catch (error) {
      console.error('백업 복원 실패:', error);
      throw error;
    }
  }

  // 백업 내보내기
  async exportBackup(backupData: BackupData): Promise<string> {
    const exportData = {
      ...backupData,
      exportTimestamp: Date.now(),
      exportVersion: '1.0.0',
    };

    return JSON.stringify(exportData, null, 2);
  }

  // 백업 가져오기
  async importBackup(backupString: string): Promise<BackupData> {
    try {
      const backupData = JSON.parse(backupString);
      
      // 버전 호환성 검사
      if (!this.isCompatibleVersion(backupData.version)) {
        throw new Error('호환되지 않는 백업 버전입니다.');
      }

      return backupData;
    } catch (error) {
      console.error('백업 가져오기 실패:', error);
      throw error;
    }
  }

  // 백업 히스토리 조회
  getBackupHistory(): BackupData[] {
    return [...this.backupHistory];
  }

  // 특정 백업 조회
  getBackup(timestamp: number): BackupData | undefined {
    return this.backupHistory.find(backup => backup.timestamp === timestamp);
  }

  // 백업 삭제
  deleteBackup(timestamp: number): boolean {
    const index = this.backupHistory.findIndex(backup => backup.timestamp === timestamp);
    if (index > -1) {
      this.backupHistory.splice(index, 1);
      this.saveBackupHistory();
      return true;
    }
    return false;
  }

  // 백업 설정 변경
  updateConfig(newConfig: Partial<BackupConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
  }

  // 백업 통계
  getBackupStats(): {
    totalBackups: number;
    totalSize: number;
    averageSize: number;
    lastBackup: number | null;
    nextScheduledBackup: number | null;
  } {
    const totalSize = this.backupHistory.reduce((sum, backup) => 
      sum + backup.metadata.totalSize, 0
    );

    return {
      totalBackups: this.backupHistory.length,
      totalSize,
      averageSize: this.backupHistory.length > 0 ? totalSize / this.backupHistory.length : 0,
      lastBackup: this.backupHistory[0]?.timestamp || null,
      nextScheduledBackup: this.getNextScheduledBackup(),
    };
  }

  // 데이터 내보내기
  async exportData(keys?: string[]): Promise<string> {
    const exportKeys = keys || Object.keys(localStorage);
    const exportData: { [key: string]: any } = {};

    for (const key of exportKeys) {
      try {
        const value = localStorage.getItem(key);
        if (value) {
          exportData[key] = JSON.parse(value);
        }
      } catch (error) {
        console.warn(`내보내기 중 오류 (${key}):`, error);
      }
    }

    return JSON.stringify(exportData, null, 2);
  }

  // 데이터 가져오기
  async importData(dataString: string, options?: {
    merge?: boolean;
    overwrite?: boolean;
  }): Promise<void> {
    try {
      const data = JSON.parse(dataString);

      if (options?.overwrite) {
        localStorage.clear();
      }

      for (const [key, value] of Object.entries(data)) {
        if (options?.merge && localStorage.getItem(key)) {
          continue; // 병합 모드에서 기존 데이터 유지
        }
        localStorage.setItem(key, JSON.stringify(value));
      }

      console.log('데이터 가져오기 완료');
    } catch (error) {
      console.error('데이터 가져오기 실패:', error);
      throw error;
    }
  }

  // 체크섬 생성
  private async generateChecksum(data: any): Promise<string> {
    const jsonString = JSON.stringify(data);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(jsonString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // 데이터 압축
  private async compressData(data: any): Promise<any> {
    // 간단한 압축 (실제로는 더 고급 압축 알고리즘 사용)
    const jsonString = JSON.stringify(data);
    return jsonString.replace(/\s+/g, ' ').trim();
  }

  // 데이터 압축 해제
  private async decompressData(data: any): Promise<any> {
    // 압축 해제 로직 (실제로는 압축 알고리즘에 맞게 구현)
    return data;
  }

  // 데이터 암호화
  private async encryptData(data: any): Promise<any> {
    if (this.config.encryptionEnabled) {
      const jsonString = JSON.stringify(data);
      return await secureStorage.setSecureItem('backup_data', jsonString);
    }
    return data;
  }

  // 데이터 복호화
  private async decryptData(data: any): Promise<any> {
    if (this.config.encryptionEnabled) {
      const decrypted = await secureStorage.getSecureItem('backup_data');
      return decrypted ? JSON.parse(decrypted) : data;
    }
    return data;
  }

  // 백업 저장
  private async saveBackup(backupData: BackupData, description?: string): Promise<void> {
    const backupKey = `backup_${backupData.timestamp}`;
    const backupInfo = {
      ...backupData,
      description,
    };

    localStorage.setItem(backupKey, JSON.stringify(backupInfo));
  }

  // 백업 히스토리 로드
  private loadBackupHistory(): void {
    try {
      const keys = Object.keys(localStorage);
      const backupKeys = keys.filter(key => key.startsWith('backup_'));
      
      this.backupHistory = backupKeys
        .map(key => {
          try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : null;
          } catch (error) {
            console.warn(`백업 히스토리 로드 중 오류 (${key}):`, error);
            return null;
          }
        })
        .filter(Boolean)
        .sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('백업 히스토리 로드 실패:', error);
    }
  }

  // 백업 히스토리 저장
  private saveBackupHistory(): void {
    try {
      localStorage.setItem('backup_history', JSON.stringify(this.backupHistory));
    } catch (error) {
      console.error('백업 히스토리 저장 실패:', error);
    }
  }

  // 오래된 백업 정리
  private cleanupOldBackups(): void {
    if (this.backupHistory.length > this.config.maxBackups) {
      const oldBackups = this.backupHistory.splice(this.config.maxBackups);
      
      // 오래된 백업 파일 삭제
      oldBackups.forEach(backup => {
        const backupKey = `backup_${backup.timestamp}`;
        localStorage.removeItem(backupKey);
      });
    }
  }

  // 자동 백업 시작
  private startAutoBackup(): void {
    if (this.config.autoBackup) {
      setInterval(() => {
        this.createBackup('자동 백업').catch(error => {
          console.error('자동 백업 실패:', error);
        });
      }, this.config.backupInterval);
    }
  }

  // 다음 예약된 백업 시간
  private getNextScheduledBackup(): number | null {
    if (!this.config.autoBackup) return null;
    
    const lastBackup = this.backupHistory[0]?.timestamp || 0;
    return lastBackup + this.config.backupInterval;
  }

  // 복원할 키인지 확인
  private shouldRestoreKey(key: string): boolean {
    // 시스템 키는 복원하지 않음
    const systemKeys = ['backup_', 'backup_history', 'session_', 'security_'];
    return !systemKeys.some(systemKey => key.startsWith(systemKey));
  }

  // 버전 호환성 검사
  private isCompatibleVersion(version: string): boolean {
    const currentVersion = '1.0.0';
    const [major1, minor1] = currentVersion.split('.').map(Number);
    const [major2, minor2] = version.split('.').map(Number);
    
    return major1 === major2 && minor1 >= minor2;
  }

  // 설정 저장
  private saveConfig(): void {
    localStorage.setItem('backup_config', JSON.stringify(this.config));
  }
}

// 전역 백업 매니저 인스턴스
export const backupManager = new BackupManager();

// 백업 유틸리티 함수들
export const backupUtils = {
  // 빠른 백업
  quickBackup: async () => {
    return await backupManager.createBackup('빠른 백업');
  },

  // 선택적 백업
  selectiveBackup: async (keys: string[]) => {
    const data = await backupManager.exportData(keys);
    const timestamp = Date.now();
    
    const backupData: BackupData = {
      version: '1.0.0',
      timestamp,
      checksum: await backupManager['generateChecksum'](JSON.parse(data)),
      data: JSON.parse(data),
      metadata: {
        totalSize: data.length,
        itemCount: keys.length,
        compressionRatio: 1.0,
      },
    };

    return backupData;
  },

  // 백업 검증
  validateBackup: async (backupData: BackupData): Promise<boolean> => {
    try {
      const currentChecksum = await backupManager['generateChecksum'](backupData.data);
      return currentChecksum === backupData.checksum;
    } catch (error) {
      console.error('백업 검증 실패:', error);
      return false;
    }
  },

  // 백업 통계
  getStats: () => {
    return backupManager.getBackupStats();
  },

  // 백업 최적화
  optimize: () => {
    const stats = backupManager.getBackupStats();
    
    if (stats.totalSize > 100 * 1024 * 1024) { // 100MB
      console.warn('백업 크기가 큽니다. 오래된 백업을 정리하세요.');
    }
    
    if (stats.totalBackups > 20) {
      console.warn('백업 개수가 많습니다. 오래된 백업을 정리하세요.');
    }
  },
};
