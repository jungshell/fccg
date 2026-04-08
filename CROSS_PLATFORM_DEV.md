# Cross-Platform Development Guide

## 목표
- macOS/Windows 어디서든 동일한 방식으로 실행
- 로컬에서 빌드/검증/디버그 재현 가능

## 권장 환경
- Node.js 18.x 또는 20.x (LTS)
- npm 10+
- Git 최신 버전

## 1) 공통 초기 설정
- 저장소 클론 후 루트(`fccg`)에서 아래 순서로 실행

```bash
cd backend
npm ci
npm run setup:local

cd ../frontend
npm ci
```

## 2) 환경 변수

### backend/.env
- `DATABASE_URL` 반드시 설정
- `JWT_SECRET` 설정
- `FRONTEND_URL`, `CORS_ORIGIN` 설정

### frontend/.env
- `VITE_API_BASE_URL` 설정 (예: `http://localhost:4000/api/auth`)

## 3) Prisma (OS별 엔진)
- `backend/prisma/schema.prisma`의 `binaryTargets`에
  - `native`
  - `darwin-arm64`
  - `windows`
  - `debian-openssl-3.0.x`
  가 포함되어 있어 macOS/Windows/배포 환경에서 공통 사용 가능

## 4) 실행

### backend
```bash
cd backend
npm run dev
```

### frontend
```bash
cd frontend
npm run dev
```

## 5) 검증
```bash
# frontend
npm run lint
npm run type-check

# backend
npm run build
```

## 6) Windows 주의사항
- PowerShell/Terminal에서 경로에 공백이 있으면 따옴표 사용
- 권한 이슈가 있는 경우 `npm ci` 재실행 후 다시 시도

## 7) macOS 주의사항
- Xcode Command Line Tools 설치 권장
- `DATABASE_URL` 미설정 시 Prisma가 즉시 실패하므로 `.env` 먼저 확인

## 8) 배포 훅(실배포)
- GitHub Actions `Deploy to Production` 워크플로우는 아래 시크릿 필요
  - `RENDER_DEPLOY_HOOK_URL`
  - `VERCEL_DEPLOY_HOOK_URL`
- 워크플로우는 품질 체크 통과 후 Render/Vercel 배포 훅을 호출
