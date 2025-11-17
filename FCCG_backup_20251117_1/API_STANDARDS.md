# FCCG API 표준 및 문서

## 📋 **API 기본 규칙**

### **1. 기본 URL 구조**
- **Base URL**: `http://localhost:4000/api/auth`
- **모든 API는 `/api/auth` 접두사 사용**

### **2. 인증 방식**
- **JWT Bearer Token** 사용
- **Header**: `Authorization: Bearer <token>`
- **토큰 저장**: `localStorage.getItem('token')`

### **3. 응답 형식**
```json
{
  "message": "성공 메시지",
  "data": { ... },
  "error": "오류 메시지 (오류 시)"
}
```

## 🔐 **인증 관련 API**

### **POST /api/auth/login**
- **기능**: 사용자 로그인
- **요청**: `{ email, password }`
- **응답**: `{ token, user }`

### **POST /api/auth/register**
- **기능**: 회원가입
- **요청**: `{ name, email, password, phone?, role? }`
- **응답**: `{ message, user }`

### **GET /api/auth/profile**
- **기능**: 프로필 조회
- **인증**: 필요
- **응답**: `{ user }`

### **PUT /api/auth/change-password**
- **기능**: 비밀번호 변경
- **인증**: 필요
- **요청**: `{ newPassword }`
- **응답**: `{ message }`

## 👥 **회원 관리 API**

### **GET /api/auth/members**
- **기능**: 회원 목록 조회
- **인증**: 필요
- **응답**: `{ members }`

### **GET /api/auth/members/stats**
- **기능**: 회원 통계 조회
- **인증**: 필요
- **응답**: `{ totalMembers, thisWeekGames, nextWeekVotes }`

### **PUT /api/auth/members/:id**
- **기능**: 회원 정보 수정
- **인증**: 필요
- **요청**: `{ name?, email?, phone?, role? }`
- **응답**: `{ message, member }`

### **PUT /api/auth/members/:id/status**
- **기능**: 회원 상태 수정
- **인증**: 필요
- **요청**: `{ status, reason? }`
- **응답**: `{ message }`

## ⚽ **경기 관리 API**

### **GET /api/auth/games**
- **기능**: 경기 목록 조회
- **인증**: 필요
- **응답**: `{ games }`

### **POST /api/auth/games**
- **기능**: 경기 생성
- **인증**: 필요
- **요청**: `{ date, time, location, gameType, eventType }`
- **응답**: `{ message, game }`

### **PUT /api/auth/games/:id**
- **기능**: 경기 수정
- **인증**: 필요
- **요청**: `{ date?, time?, location?, gameType?, eventType? }`
- **응답**: `{ message, game }`

### **DELETE /api/auth/games/:id**
- **기능**: 경기 삭제
- **인증**: 필요
- **응답**: `{ message }`

### **GET /api/auth/search-location**
- **기능**: 장소 검색
- **인증**: 필요
- **요청**: `?query=검색어`
- **응답**: `{ documents }`

## 🗳️ **투표 시스템 API**

### **POST /api/auth/votes**
- **기능**: 투표 제출
- **인증**: 필요
- **요청**: `{ voteSessionId, selectedDays }`
- **응답**: `{ message, vote }`

### **DELETE /api/auth/votes/:userId**
- **기능**: 특정 사용자 투표 삭제
- **인증**: 필요
- **응답**: `{ message, deletedCount }`

### **DELETE /api/auth/votes/reset**
- **기능**: 현재 사용자 모든 투표 삭제
- **인증**: 필요
- **응답**: `{ message, deletedCount }`

### **GET /api/auth/votes/unified**
- **기능**: 통합 투표 데이터 조회
- **인증**: 필요
- **응답**: `{ activeSession, lastWeekResults }`

### **GET /api/auth/admin/vote-sessions/results**
- **기능**: 관리자 투표결과 조회
- **인증**: 필요 (관리자)
- **응답**: `{ sessions, summary }`

### **GET /api/auth/votes/results**
- **기능**: 투표 결과 조회
- **인증**: 필요
- **요청**: `?sessionId=세션ID`
- **응답**: `{ results }`

### **POST /api/auth/votes/aggregate/save**
- **기능**: 투표 집계 저장
- **인증**: 필요
- **요청**: `{ target, sessionId? }`
- **응답**: `{ message }`

## 🔧 **기타 API**

### **GET /api/auth/health**
- **기능**: 헬스체크
- **응답**: `{ status: "ok", timestamp }`

### **GET /api/auth/votes/test**
- **기능**: 투표 API 테스트
- **응답**: `{ message, timestamp }`

## 📝 **프론트엔드 API 호출 규칙**

### **1. API 함수 사용**
```typescript
// ✅ 올바른 방법
import { submitVote, getGames } from '../api/auth';

// ❌ 잘못된 방법
fetch('/api/votes', ...)  // 직접 fetch 사용 금지
```

### **2. 에러 처리**
```typescript
try {
  const result = await submitVote(sessionId, selectedDays);
  // 성공 처리
} catch (error) {
  console.error('API 호출 실패:', error);
  // 에러 처리
}
```

### **3. 토큰 관리**
```typescript
// 토큰은 API 함수 내부에서 자동 처리
// 직접 토큰을 전달하지 않음
```

## 🚨 **중요 규칙**

1. **모든 API는 `/api/auth` 접두사 사용**
2. **인증이 필요한 API는 JWT 토큰 필수**
3. **프론트엔드에서는 직접 fetch 사용 금지**
4. **API 함수는 `frontend/src/api/auth.ts`에서 관리**
5. **백엔드 API는 `backend/src/routes/auth_simple.ts`에서 관리**
6. **새로운 API 추가 시 반드시 프론트엔드와 백엔드 동시 구현**

## 🔄 **API 수정 시 체크리스트**

- [ ] 백엔드 API 엔드포인트 구현
- [ ] 프론트엔드 API 함수 구현
- [ ] 인증 토큰 처리 확인
- [ ] 에러 처리 구현
- [ ] API 문서 업데이트
- [ ] 테스트 확인
