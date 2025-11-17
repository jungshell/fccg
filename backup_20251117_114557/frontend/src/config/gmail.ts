// Gmail API 설정 (환경변수로 주입)
export const gmailConfig = {
  clientId: import.meta.env.VITE_GMAIL_CLIENT_ID || '',
  clientSecret: import.meta.env.VITE_GMAIL_CLIENT_SECRET || '',
  refreshToken: import.meta.env.VITE_GMAIL_REFRESH_TOKEN || '',
  userEmail: import.meta.env.VITE_GMAIL_USER_EMAIL || ''
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
