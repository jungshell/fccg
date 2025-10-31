# 🔐 Gmail API 연동 설정 가이드

## 📋 개요
이 가이드는 FC CHAL GGYEO 알림 시스템에 Gmail API를 연동하는 방법을 설명합니다.

## 🚀 1단계: 인증 테스트

### 1.1 인증 테스트 HTML 파일 실행
```bash
# 브라우저에서 다음 파일을 열기
open gmail-auth-test.html
```

### 1.2 인증 과정
1. **"Gmail API 인증 시작"** 버튼 클릭
2. Google 계정으로 로그인
3. 권한 허용
4. 리디렉션된 URL에서 인증 코드 복사
5. **"토큰 교환"** 버튼 클릭하여 토큰 획득

## ⚙️ 2단계: 설정 파일 업데이트

### 2.1 Gmail 설정 파일 수정
`src/config/gmail.ts` 파일을 열고 다음 정보를 업데이트:

```typescript
export const gmailConfig = {
  clientId: "30815124714-vh2l31gnoks0364cdikglcvc2oame3j0.apps.googleusercontent.com",
  clientSecret: "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",
  refreshToken: "YOUR_ACTUAL_REFRESH_TOKEN_HERE", // 인증 테스트에서 획득한 토큰
  userEmail: "your-actual-email@gmail.com"        // 본인의 실제 Gmail 주소
};
```

### 2.2 환경 변수 설정 (선택사항)
프로덕션 환경에서는 환경 변수를 사용하는 것을 권장합니다:

```bash
# .env 파일 생성
VITE_GMAIL_CLIENT_ID=your-client-id
VITE_GMAIL_CLIENT_SECRET=your-client-secret
VITE_GMAIL_REFRESH_TOKEN=your-refresh-token
VITE_GMAIL_USER_EMAIL=your-email@gmail.com
```

## 🧪 3단계: 테스트 및 검증

### 3.1 개발 서버 실행
```bash
npm run dev
```

### 3.2 관리자 페이지 접속
1. `http://localhost:5173/admin` 접속
2. "알림 관리" 메뉴 선택
3. Gmail API 연결 상태 확인

### 3.3 테스트 이메일 발송
1. "테스트 알림 발송" 버튼 클릭
2. 이메일 발송 결과 확인
3. 콘솔에서 로그 확인

## 🔧 4단계: 문제 해결

### 4.1 일반적인 오류들

#### "Gmail 설정이 불완전합니다"
- `src/config/gmail.ts` 파일의 모든 필드가 올바르게 설정되었는지 확인
- `refreshToken`과 `userEmail`이 실제 값으로 설정되었는지 확인

#### "액세스 토큰을 가져올 수 없습니다"
- `refreshToken`이 올바른지 확인
- Google Cloud Console에서 Gmail API가 활성화되었는지 확인
- OAuth 동의 화면에서 올바른 범위가 설정되었는지 확인

#### "이메일 발송 실패"
- 수신자 이메일 주소가 올바른지 확인
- Gmail API 할당량을 초과하지 않았는지 확인
- 네트워크 연결 상태 확인

### 4.2 Gmail API 할당량
- **일일 사용량**: 1,000,000,000 quota units
- **이메일 발송**: 100 quota units/건
- **하루 최대**: 약 1,000만 건

## 📧 5단계: 이메일 템플릿 커스터마이징

### 5.1 HTML 이메일 템플릿 예시
```typescript
const emailTemplate = {
  gameReminder: {
    subject: "⚽ 경기 알림",
    body: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #004ea8;">⚽ 경기 알림</h2>
        <p>안녕하세요, FC CHAL GGYEO 회원 여러분!</p>
        <p><strong>${gameDate}</strong> 경기가 <strong>${hoursBefore}시간 후</strong>에 시작됩니다.</p>
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3>경기 정보</h3>
          <p>📅 날짜: ${gameDate}</p>
          <p>⏰ 시간: ${gameTime}</p>
          <p>📍 장소: ${gameLocation}</p>
        </div>
        <p>참가 가능 여부를 빠른 시일 내에 알려주세요.</p>
        <hr style="margin: 20px 0;">
        <p style="font-size: 12px; color: #666;">
          이 이메일은 FC CHAL GGYEO 알림 시스템에서 자동으로 발송되었습니다.
        </p>
      </div>
    `
  }
};
```

## 🔒 6단계: 보안 고려사항

### 6.1 민감한 정보 보호
- `clientSecret`과 `refreshToken`을 절대 공개 저장소에 커밋하지 마세요
- 프로덕션 환경에서는 환경 변수 사용을 권장합니다

### 6.2 토큰 관리
- `refreshToken`은 영구적으로 유효하지만, 필요시 Google 계정에서 앱 권한을 취소할 수 있습니다
- 정기적으로 토큰 유효성을 확인하고 필요시 갱신하세요

## 📚 7단계: 추가 리소스

### 7.1 공식 문서
- [Gmail API 공식 문서](https://developers.google.com/gmail/api)
- [OAuth 2.0 가이드](https://developers.google.com/identity/protocols/oauth2)
- [Gmail API 할당량](https://developers.google.com/gmail/api/reference/quota)

### 7.2 유용한 도구
- [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
- [Gmail API Explorer](https://developers.google.com/gmail/api/v1/reference/)

## 🎯 다음 단계

Gmail API 연동이 완료되면:
1. **Firebase FCM 연동** (푸시 알림)
2. **도메인 설정** 및 CORS 구성
3. **프로덕션 배포** 준비

---

## 📞 지원

문제가 발생하거나 추가 도움이 필요한 경우:
1. 브라우저 콘솔의 오류 메시지 확인
2. Gmail API 할당량 상태 확인
3. Google Cloud Console에서 API 상태 확인

**🎉 Gmail API 연동이 완료되면 실시간 이메일 알림을 받을 수 있습니다!**
