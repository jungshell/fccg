export interface GmailConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  userEmail: string;
}

export interface EmailMessage {
  to: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
}

export class GmailAPI {
  private accessToken: string | null = null;
  private refreshToken: string;
  private clientId: string;
  private clientSecret: string;
  private userEmail: string;
  private tokenExpiry: number = 0;

  constructor(config: GmailConfig) {
    this.refreshToken = config.refreshToken;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.userEmail = config.userEmail;
  }

  /**
   * 액세스 토큰을 갱신합니다.
   */
  private async refreshAccessToken(): Promise<void> {
    try {
      console.log('🔄 액세스 토큰 갱신 중...');
      
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`토큰 갱신 실패: ${response.status} - ${errorText}`);
      }

      const tokens = await response.json();
      this.accessToken = tokens.access_token;
      this.tokenExpiry = Date.now() + (tokens.expires_in * 1000);
      
      console.log('✅ 액세스 토큰 갱신 완료');
    } catch (error) {
      console.error('❌ 액세스 토큰 갱신 실패:', error);
      throw error;
    }
  }

  /**
   * 토큰이 유효한지 확인하고 필요시 갱신합니다.
   */
  private async ensureValidToken(): Promise<void> {
    const now = Date.now();
    const bufferTime = 5 * 60 * 1000; // 5분 버퍼

    if (!this.accessToken || now >= (this.tokenExpiry - bufferTime)) {
      await this.refreshAccessToken();
    }
  }

  /**
   * 이메일 메시지를 Base64로 인코딩합니다.
   */
  private createEmailMessage(message: EmailMessage): string {
    // 제목을 UTF-8로 인코딩하여 처리
    const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(message.subject)))}?=`;
    
    const emailLines = [
      `To: ${message.to.join(', ')}`,
      `Subject: ${encodedSubject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      message.isHtml ? message.body : `<html><body>${message.body}</body></html>`
    ];

    const email = emailLines.join('\r\n');
    
    // UTF-8 문자를 올바르게 Base64로 인코딩
    const utf8Bytes = new TextEncoder().encode(email);
    let binaryString = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
      binaryString += String.fromCharCode(utf8Bytes[i]);
    }
    
    const base64String = btoa(binaryString);
    
    // URL 안전 문자로 변환
    return base64String
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * 단일 이메일을 발송합니다.
   */
  async sendEmail(message: EmailMessage): Promise<boolean> {
    try {
      await this.ensureValidToken();

      if (!this.accessToken) {
        throw new Error('액세스 토큰을 가져올 수 없습니다.');
      }

      const rawMessage = this.createEmailMessage(message);
      
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/${this.userEmail}/messages/send`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            raw: rawMessage
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gmail API 오류: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ 이메일 발송 성공:', result.id);
      return true;

    } catch (error) {
      console.error('❌ 이메일 발송 실패:', error);
      return false;
    }
  }

  /**
   * 여러 수신자에게 이메일을 발송합니다.
   */
  async sendBulkEmail(messages: EmailMessage[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const message of messages) {
      try {
        const result = await this.sendEmail(message);
        if (result) {
          success++;
        } else {
          failed++;
        }
        
        // Gmail API 할당량을 고려하여 약간의 지연
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error('❌ 이메일 발송 중 오류:', error);
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * Gmail API 연결 상태를 확인합니다.
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.ensureValidToken();
      
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/${this.userEmail}/profile`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
          },
        }
      );

      return response.ok;
    } catch (error) {
      console.error('❌ Gmail API 연결 테스트 실패:', error);
      return false;
    }
  }

  /**
   * 현재 설정된 사용자 이메일을 반환합니다.
   */
  getUserEmail(): string {
    return this.userEmail;
  }

  /**
   * 토큰 상태를 확인합니다.
   */
  getTokenStatus(): { hasAccessToken: boolean; expiresIn: number } {
    if (!this.accessToken || !this.tokenExpiry) {
      return { hasAccessToken: false, expiresIn: 0 };
    }

    const expiresIn = Math.max(0, this.tokenExpiry - Date.now());
    return { hasAccessToken: true, expiresIn };
  }
}
