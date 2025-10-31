/**
 * 알림 템플릿 시스템
 * 다양한 알림 타입별 HTML 템플릿 관리
 */

export interface NotificationTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface GameNotificationData {
  gameDate: string;
  gameTime: string;
  gameLocation: string;
  gameType: string;
  participants: string[];
  teamName?: string;
}

export interface VoteNotificationData {
  votePeriod: string;
  voteDeadline: string;
  participants: string[];
  teamName?: string;
}

export interface MemberNotificationData {
  memberName: string;
  memberEmail: string;
  teamName?: string;
}

// 기본 스타일
const baseStyles = `
  <style>
    .email-container {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #3182CE 0%, #2B6CB0 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: bold;
    }
    .header p {
      margin: 5px 0 0 0;
      opacity: 0.9;
      font-size: 14px;
    }
    .content {
      padding: 30px 20px;
    }
    .info-box {
      background-color: #F7FAFC;
      border-left: 4px solid #3182CE;
      padding: 20px;
      margin: 20px 0;
      border-radius: 0 8px 8px 0;
    }
    .info-item {
      margin: 10px 0;
      display: flex;
      align-items: center;
    }
    .info-item strong {
      min-width: 80px;
      color: #2D3748;
    }
    .participants {
      background-color: #EDF2F7;
      padding: 15px;
      border-radius: 6px;
      margin: 15px 0;
    }
    .participants h4 {
      margin: 0 0 10px 0;
      color: #2D3748;
      font-size: 14px;
    }
    .participant-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .participant-tag {
      background-color: #3182CE;
      color: white;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 12px;
    }
    .footer {
      background-color: #F7FAFC;
      padding: 20px;
      text-align: center;
      border-top: 1px solid #E2E8F0;
    }
    .footer p {
      margin: 0;
      font-size: 12px;
      color: #718096;
    }
    .cta-button {
      display: inline-block;
      background-color: #3182CE;
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: bold;
      margin: 20px 0;
    }
    .cta-button:hover {
      background-color: #2B6CB0;
    }
  </style>
`;

// 경기 확정 알림 템플릿
export const gameConfirmationTemplate = (data: GameNotificationData): NotificationTemplate => {
  const teamName = data.teamName || 'FC CHAL-GGYEO';
  
  return {
    subject: `🏆 ${teamName} 경기 일정 확정 - ${data.gameDate}`,
    html: `
      ${baseStyles}
      <div class="email-container">
        <div class="header">
          <h1>🏆 경기 일정 확정</h1>
          <p>${teamName} 축구팀</p>
        </div>
        <div class="content">
          <h2 style="color: #2D3748; margin-bottom: 20px;">경기 일정이 확정되었습니다!</h2>
          
          <div class="info-box">
            <div class="info-item">
              <strong>📅 날짜:</strong>
              <span>${data.gameDate}</span>
            </div>
            <div class="info-item">
              <strong>⏰ 시간:</strong>
              <span>${data.gameTime}</span>
            </div>
            <div class="info-item">
              <strong>📍 장소:</strong>
              <span>${data.gameLocation}</span>
            </div>
            <div class="info-item">
              <strong>⚽ 유형:</strong>
              <span>${data.gameType}</span>
            </div>
          </div>

          ${data.participants.length > 0 ? `
            <div class="participants">
              <h4>👥 참석 예정자</h4>
              <div class="participant-list">
                ${data.participants.map(participant => 
                  `<span class="participant-tag">${participant}</span>`
                ).join('')}
              </div>
            </div>
          ` : ''}

          <p style="color: #4A5568; margin: 20px 0;">
            참석 가능하신 분들은 확인해주세요! 
            일정이 변경되거나 참석이 어려우신 경우 빠른 시일 내에 연락주세요.
          </p>

          <a href="#" class="cta-button">일정 확인하기</a>
        </div>
        <div class="footer">
          <p>${teamName} 축구팀 관리 시스템</p>
          <p>이 이메일은 자동으로 발송되었습니다.</p>
        </div>
      </div>
    `,
    text: `
🏆 ${teamName} 경기 일정 확정

경기 일정이 확정되었습니다!

📅 날짜: ${data.gameDate}
⏰ 시간: ${data.gameTime}
📍 장소: ${data.gameLocation}
⚽ 유형: ${data.gameType}

${data.participants.length > 0 ? `👥 참석 예정자: ${data.participants.join(', ')}` : ''}

참석 가능하신 분들은 확인해주세요!

---
${teamName} 축구팀 관리 시스템
    `.trim()
  };
};

// 투표 알림 템플릿
export const voteReminderTemplate = (data: VoteNotificationData): NotificationTemplate => {
  const teamName = data.teamName || 'FC CHAL-GGYEO';
  
  return {
    subject: `🗳️ ${teamName} 다음주 일정 투표 - ${data.votePeriod}`,
    html: `
      ${baseStyles}
      <div class="email-container">
        <div class="header">
          <h1>🗳️ 일정 투표</h1>
          <p>${teamName} 축구팀</p>
        </div>
        <div class="content">
          <h2 style="color: #2D3748; margin-bottom: 20px;">다음주 일정 투표가 시작되었습니다!</h2>
          
          <div class="info-box">
            <div class="info-item">
              <strong>📅 투표 기간:</strong>
              <span>${data.votePeriod}</span>
            </div>
            <div class="info-item">
              <strong>⏰ 마감 시간:</strong>
              <span>${data.voteDeadline}</span>
            </div>
          </div>

          <p style="color: #4A5568; margin: 20px 0;">
            다음주 경기 일정에 대한 의견을 들려주세요. 
            가능한 요일과 시간을 선택해주시면 최적의 일정을 잡을 수 있습니다.
          </p>

          <a href="#" class="cta-button">투표하기</a>
        </div>
        <div class="footer">
          <p>${teamName} 축구팀 관리 시스템</p>
          <p>이 이메일은 자동으로 발송되었습니다.</p>
        </div>
      </div>
    `,
    text: `
🗳️ ${teamName} 다음주 일정 투표

다음주 일정 투표가 시작되었습니다!

📅 투표 기간: ${data.votePeriod}
⏰ 마감 시간: ${data.voteDeadline}

다음주 경기 일정에 대한 의견을 들려주세요.

---
${teamName} 축구팀 관리 시스템
    `.trim()
  };
};

// 신규 회원 알림 템플릿
export const newMemberTemplate = (data: MemberNotificationData): NotificationTemplate => {
  const teamName = data.teamName || 'FC CHAL-GGYEO';
  
  return {
    subject: `👋 ${teamName} 신규 회원 가입 - ${data.memberName}`,
    html: `
      ${baseStyles}
      <div class="email-container">
        <div class="header">
          <h1>👋 신규 회원 가입</h1>
          <p>${teamName} 축구팀</p>
        </div>
        <div class="content">
          <h2 style="color: #2D3748; margin-bottom: 20px;">새로운 회원이 가입했습니다!</h2>
          
          <div class="info-box">
            <div class="info-item">
              <strong>👤 이름:</strong>
              <span>${data.memberName}</span>
            </div>
            <div class="info-item">
              <strong>📧 이메일:</strong>
              <span>${data.memberEmail}</span>
            </div>
          </div>

          <p style="color: #4A5568; margin: 20px 0;">
            새로운 팀원을 환영해주세요! 
            함께 즐거운 축구를 즐겨보시기 바랍니다.
          </p>

          <a href="#" class="cta-button">팀 페이지 보기</a>
        </div>
        <div class="footer">
          <p>${teamName} 축구팀 관리 시스템</p>
          <p>이 이메일은 자동으로 발송되었습니다.</p>
        </div>
      </div>
    `,
    text: `
👋 ${teamName} 신규 회원 가입

새로운 회원이 가입했습니다!

👤 이름: ${data.memberName}
📧 이메일: ${data.memberEmail}

새로운 팀원을 환영해주세요!

---
${teamName} 축구팀 관리 시스템
    `.trim()
  };
};

// 경기 리마인더 템플릿
export const gameReminderTemplate = (data: GameNotificationData & { hoursBefore: number }): NotificationTemplate => {
  const teamName = data.teamName || 'FC CHAL-GGYEO';
  
  return {
    subject: `⚽ ${teamName} 경기 ${data.hoursBefore}시간 전 - ${data.gameDate}`,
    html: `
      ${baseStyles}
      <div class="email-container">
        <div class="header">
          <h1>⚽ 경기 리마인더</h1>
          <p>${teamName} 축구팀</p>
        </div>
        <div class="content">
          <h2 style="color: #2D3748; margin-bottom: 20px;">경기 ${data.hoursBefore}시간 전입니다!</h2>
          
          <div class="info-box">
            <div class="info-item">
              <strong>📅 날짜:</strong>
              <span>${data.gameDate}</span>
            </div>
            <div class="info-item">
              <strong>⏰ 시간:</strong>
              <span>${data.gameTime}</span>
            </div>
            <div class="info-item">
              <strong>📍 장소:</strong>
              <span>${data.gameLocation}</span>
            </div>
            <div class="info-item">
              <strong>⚽ 유형:</strong>
              <span>${data.gameType}</span>
            </div>
          </div>

          <p style="color: #4A5568; margin: 20px 0;">
            경기 준비를 잊지 마세요! 
            충분한 시간을 두고 경기장에 도착해주세요.
          </p>

          <a href="#" class="cta-button">경기 정보 보기</a>
        </div>
        <div class="footer">
          <p>${teamName} 축구팀 관리 시스템</p>
          <p>이 이메일은 자동으로 발송되었습니다.</p>
        </div>
      </div>
    `,
    text: `
⚽ ${teamName} 경기 ${data.hoursBefore}시간 전

경기 ${data.hoursBefore}시간 전입니다!

📅 날짜: ${data.gameDate}
⏰ 시간: ${data.gameTime}
📍 장소: ${data.gameLocation}
⚽ 유형: ${data.gameType}

경기 준비를 잊지 마세요!

---
${teamName} 축구팀 관리 시스템
    `.trim()
  };
};

// 템플릿 팩토리 함수
export const createNotificationTemplate = (
  type: 'game_confirmation' | 'vote_reminder' | 'new_member' | 'game_reminder',
  data: any
): NotificationTemplate => {
  switch (type) {
    case 'game_confirmation':
      return gameConfirmationTemplate(data);
    case 'vote_reminder':
      return voteReminderTemplate(data);
    case 'new_member':
      return newMemberTemplate(data);
    case 'game_reminder':
      return gameReminderTemplate(data);
    default:
      throw new Error(`Unknown notification type: ${type}`);
  }
};

