# 🚀 배포 가이드 - 로컬과 프로덕션 차이점 완전 정복

## 😤 왜 로컬에서는 잘 되는데 배포하면 안 될까?

로컬과 프로덕션 환경은 **완전히 다른 세상**입니다:

### 1. 환경 변수의 차이
- **로컬**: `.env` 파일에서 자동 로드
- **프로덕션**: 플랫폼별로 수동 설정 필요 (Vercel/Render)

### 2. 데이터베이스의 차이
- **로컬**: SQLite (`file:./dev.db`)
- **프로덕션**: PostgreSQL (Neon 등)

### 3. API URL의 차이
- **로컬**: `http://localhost:4000`
- **프로덕션**: `https://your-backend.onrender.com`

### 4. 빌드 과정의 차이
- **로컬**: 실시간 컴파일 (ts-node-dev)
- **프로덕션**: 빌드 후 실행 (TypeScript → JavaScript)

## ✅ 배포 전 **반드시** 확인할 것들

### 1단계: 환경 변수 설정 확인

#### Vercel (프론트엔드)
```
VITE_API_BASE_URL = https://your-backend.onrender.com/api/auth
```

#### Render (백엔드)
```
DATABASE_URL = postgresql://... (Neon 연결 문자열)
JWT_SECRET = 동일한 키여야 함 (로컬과 프로덕션)
FRONTEND_URL = https://your-frontend.vercel.app
BACKEND_URL = https://your-backend.onrender.com
PORT = 4000 (또는 Render가 지정한 포트)
NODE_ENV = production
```

### 2단계: API 엔드포인트 확인

모든 하드코딩된 `localhost`를 찾아서 제거:
```bash
# 프로젝트 전체에서 localhost 검색
grep -r "localhost" frontend/src backend/src
```

### 3단계: 데이터베이스 동기화

프로덕션 DB에 스키마 적용:
```bash
cd backend
npx prisma migrate deploy
```

프로덕션 DB에 초기 데이터 삽입:
```sql
-- insert_data_postgresql.sql 실행
```

### 4단계: CORS 설정 확인

`backend/src/app.ts`에서 프로덕션 도메인 허용 확인:
```typescript
const allowedOrigins = [
  'https://your-frontend.vercel.app'
];
```

## 🛠️ 배포 후 문제 발생 시 체크리스트

### 문제 1: "로그인이 안 돼"
1. ✅ JWT_SECRET이 로컬과 프로덕션에서 동일한가?
2. ✅ 비밀번호 해시가 DB에 올바르게 저장되었는가?
3. ✅ 백엔드 로그에서 토큰 검증 오류 확인

### 문제 2: "데이터가 안 나와"
1. ✅ DATABASE_URL이 올바른가?
2. ✅ DB 연결이 정상인가? (Render 로그 확인)
3. ✅ 테이블과 데이터가 존재하는가?

### 문제 3: "API 호출이 실패해"
1. ✅ VITE_API_BASE_URL이 올바른가?
2. ✅ CORS 오류인가? (브라우저 콘솔 확인)
3. ✅ 백엔드가 실행 중인가? (Render 상태 확인)

### 문제 4: "빌드가 실패해"
1. ✅ TypeScript 에러가 있는가?
2. ✅ 환경 변수가 빌드 타임에 필요한가?
3. ✅ 의존성이 설치되었는가?

## 💡 앞으로 이런 일을 방지하려면

### 자동화 스크립트 사용

배포 전 검증 스크립트를 실행:
```bash
npm run pre-deploy
```

이 스크립트가:
- 환경 변수 확인
- API 엔드포인트 검증
- 빌드 테스트
- 데이터베이스 연결 테스트

를 자동으로 수행합니다.

## 🎯 핵심 정리

**로컬에서 잘 되는 것 ≠ 프로덕션에서 잘 되는 것**

항상 다음을 확인:
1. 환경 변수
2. 데이터베이스
3. API URL
4. CORS 설정
5. 빌드 에러

이 5가지만 확인하면 90%의 문제를 해결할 수 있습니다.

