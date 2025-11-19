# 배포 체크리스트

배포 전 반드시 확인해야 할 사항들을 체크하세요.

## ✅ 필수 환경 변수

### 프론트엔드 (Vercel)
- [ ] `VITE_API_BASE_URL` - 프로덕션 백엔드 API URL
  - 예: `https://your-backend.railway.app/api/auth`

### 백엔드
- [ ] `DATABASE_URL` - Prisma 데이터베이스 연결 문자열
- [ ] `JWT_SECRET` - 강력한 랜덤 문자열 (최소 32자 권장)
- [ ] `PORT` - 서버 포트 (기본값: 4000)
- [ ] `NODE_ENV` - `production`으로 설정

### 선택적 환경 변수 (기능 사용 시)
- [ ] `CLOUDINARY_CLOUD_NAME` - 이미지 업로드 (갤러리)
- [ ] `CLOUDINARY_API_KEY` - 이미지 업로드 (갤러리)
- [ ] `CLOUDINARY_API_SECRET` - 이미지 업로드 (갤러리)
- [ ] `GMAIL_USER` - 이메일 발송
- [ ] `GMAIL_APP_PASSWORD` - 이메일 발송
- [ ] `KAKAO_MAP_API_KEY` - 카카오맵 검색
- [ ] `PUBLIC_DATA_API_KEY` - 공휴일 API
- [ ] `FRONTEND_URL` - CORS 허용 도메인
- [ ] `CORS_ORIGIN` - CORS 허용 도메인

## ✅ 데이터베이스

- [ ] 데이터베이스 생성 완료
- [ ] `DATABASE_URL` 환경 변수 설정
- [ ] Prisma 마이그레이션 실행: `npx prisma migrate deploy`
- [ ] Prisma Client 생성: `npx prisma generate`

## ✅ CORS 설정

- [ ] `backend/src/app.ts`에서 프론트엔드 도메인 추가
- [ ] 환경 변수 `FRONTEND_URL` 또는 `CORS_ORIGIN` 설정

## ✅ 빌드 테스트

- [ ] 프론트엔드 빌드 성공: `cd frontend && npm run build`
- [ ] 백엔드 빌드 성공: `cd backend && npm run build`
- [ ] 빌드 오류 없음 확인

## ✅ 배포 플랫폼 설정

### Vercel (프론트엔드)
- [ ] 프로젝트 연결
- [ ] 빌드 명령: `npm run build`
- [ ] 출력 디렉토리: `dist`
- [ ] 환경 변수 설정 완료

### 백엔드 (Railway/Render/AWS 등)
- [ ] 프로젝트 연결
- [ ] 시작 명령: `npm start`
- [ ] 포트 설정 확인
- [ ] 환경 변수 설정 완료

## ✅ 배포 후 테스트

- [ ] 프론트엔드 접속 확인
- [ ] API 연결 확인 (브라우저 콘솔)
- [ ] 로그인/회원가입 테스트
- [ ] 주요 기능 테스트:
  - [ ] 투표 기능
  - [ ] 경기 관리
  - [ ] 갤러리 업로드
  - [ ] 관리자 페이지

## 📝 참고

- 모든 환경 변수는 `.env.example` 파일 참고
- 상세한 배포 가이드는 `DEPLOYMENT_GUIDE.md` 참고
- 문제 발생 시 배포 플랫폼 로그 확인


