# 배포 가이드

이 문서는 FCCG 애플리케이션을 프로덕션 환경에 배포하기 위한 가이드입니다.

## 📋 배포 전 체크리스트

### 1. 환경 변수 설정

#### 프론트엔드 (Vercel)
- [ ] `VITE_API_BASE_URL`: 프로덕션 API 베이스 URL 설정
  - 예: `https://your-backend-domain.com/api/auth`

#### 백엔드
- [ ] `DATABASE_URL`: Prisma 데이터베이스 연결 문자열
- [ ] `JWT_SECRET`: 강력한 랜덤 문자열 (최소 32자)
- [ ] `PORT`: 서버 포트 (기본값: 4000)
- [ ] `CLOUDINARY_*`: 이미지 업로드 설정 (갤러리 사용 시)
- [ ] `NODE_ENV`: `production`으로 설정

### 2. 데이터베이스 설정

```bash
# 백엔드 디렉토리에서
cd backend

# Prisma 마이그레이션 실행
npx prisma migrate deploy

# Prisma Client 생성
npx prisma generate
```

### 3. CORS 설정 확인

`backend/src/app.ts` 파일에서 프론트엔드 도메인을 허용 목록에 추가:

```typescript
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://your-frontend-domain.vercel.app', // 프로덕션 도메인 추가
  // ... 기타 허용할 도메인
];
```

### 4. 빌드 테스트

#### 프론트엔드
```bash
cd frontend
npm run build
```

#### 백엔드
```bash
cd backend
npm run build
```

### 5. 배포 플랫폼별 설정

#### Vercel (프론트엔드)
- **빌드 명령**: `npm run build`
- **출력 디렉토리**: `dist`
- **환경 변수**: `VITE_API_BASE_URL`

#### 백엔드 (Railway, Render, AWS 등)
- **시작 명령**: `npm start`
- **포트**: 환경 변수 `PORT` 사용
- **Node 버전**: 18.x 이상

## 🚀 배포 단계

### 1단계: 백엔드 배포

1. 백엔드 배포 플랫폼에 프로젝트 연결
2. 환경 변수 설정 (`.env.example` 참고)
3. 데이터베이스 마이그레이션 실행
4. 배포 및 테스트

### 2단계: 프론트엔드 배포

1. Vercel에 프로젝트 연결
2. 환경 변수 설정:
   - `VITE_API_BASE_URL`: 백엔드 API URL
3. 빌드 설정 확인
4. 배포 및 테스트

### 3단계: 연결 확인

1. 브라우저에서 프론트엔드 접속
2. 개발자 도구 콘솔 확인
3. API 호출 테스트
4. 로그인/회원가입 테스트

## 🔍 문제 해결

### API 연결 오류
- 환경 변수 `VITE_API_BASE_URL` 확인
- CORS 설정 확인
- 네트워크 탭에서 실제 요청 URL 확인

### 데이터베이스 오류
- `DATABASE_URL` 확인
- Prisma 마이그레이션 실행 여부 확인
- 데이터베이스 연결 상태 확인

### 빌드 오류
- Node 버전 확인 (18.x 이상)
- 의존성 설치 확인 (`npm install`)
- TypeScript 오류 확인

## 📝 참고 사항

- 로컬 개발: `npm run dev` (프론트엔드, 백엔드 각각)
- 프로덕션: 환경 변수 필수 설정
- 보안: `JWT_SECRET`은 반드시 강력한 값 사용
- 로그: 프로덕션 환경에서 로그 레벨 조정 권장

## 📞 지원

문제가 발생하면 다음을 확인하세요:
1. 환경 변수 설정
2. 데이터베이스 연결
3. CORS 설정
4. 빌드 로그
