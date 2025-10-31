// Gmail API 설정 (백업본) - 민감정보 제거됨
export const gmailConfig = {
  clientId: '',
  clientSecret: '',
  refreshToken: '',
  userEmail: ''
};

export interface GmailConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  userEmail: string;
}

// 설정을 가져오는 함수
export const getGmailConfig = (): GmailConfig => {
  // 브라우저 환경에서는 직접 설정된 값을 사용
  return gmailConfig;
};

// 설정 유효성 검사
export const validateGmailConfig = (config: GmailConfig): boolean => {
  return !!(config.clientId && config.clientSecret && config.refreshToken && config.userEmail);
};
