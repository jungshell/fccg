# FCCG 배포 가이드

## 📋 목차
1. [사전 준비사항](#사전-준비사항)
2. [GitHub에 코드 업로드](#github에-코드-업로드)
3. [백엔드 배포 (Render)](#백엔드-배포-render)
4. [프론트엔드 배포 (Vercel)](#프론트엔드-배포-vercel)
5. [환경 변수 설정](#환경-변수-설정)
6. [배포 후 확인사항](#배포-후-확인사항)
7. [문제 해결](#문제-해결)

---

## 사전 준비사항

### ✅ 확인해야 할 사항
- [ ] 로컬에서 모든 기능이 정상 작동하는지 확인
- [ ] 백엔드 서버가 정상 실행되는지 확인 (`npm run dev`)
- [ ] 프론트엔드가 정상 실행되는지 확인 (`npm run dev`)
- [ ] 데이터베이스 마이그레이션이 완료되었는지 확인
- [ ] 환경 변수 파일(.env)이 준비되었는지 확인

### 📦 필요한 계정
- GitHub 계정
- Render 계정 (백엔드 배포용)
- Vercel 계정 (프론트엔드 배포용)

---

## GitHub에 코드 업로드

### 1단계: 현재 변경사항 확인
```bash
cd /Users/sunginjung/app_builder/on_my_own/FCCGByGemini
git status
```

### 2단계: 변경사항 스테이징
```bash
git add .
```

### 3단계: 커밋 메시지 작성 및 커밋
```bash
git commit -m "feat: 투표 세션 관리 기능 추가 (공휴일 자동 표시, 요일 차단, 수동 세션 생성)"
```

### 4단계: GitHub에 푸시
```bash
git push origin main
```

**주의사항:**
- 만약 `git push`가 실패하면 `git pull origin main`을 먼저 실행하여 원격 저장소의 최신 변경사항을 가져옵니다.
- 충돌이 발생하면 해결 후 다시 커밋하고 푸시합니다.

---

## 백엔드 배포 (Render)

### 1단계: Render 대시보드 접속
1. https://dashboard.render.com 접속
2. 로그인 후 기존 백엔드 서비스 선택 (또는 새로 생성)

### 2단계: 서비스 설정 확인/수정

#### 환경 설정
- **Build Command**: `cd backend && npm install && npx prisma generate`
- **Start Command**: `cd backend && npm start`
- **Root Directory**: `backend` (또는 프로젝트 루트에 따라 조정)

#### 환경 변수 확인
다음 환경 변수들이 설정되어 있는지 확인:

```
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=your-jwt-secret-key
PORT=10000
```

**중요:** `DATABASE_URL`은 Render의 PostgreSQL 데이터베이스 URL이어야 합니다.

### 3단계: GitHub 연결 확인
- **Repository**: 올바른 GitHub 저장소가 연결되어 있는지 확인
- **Branch**: `main` 브랜치가 선택되어 있는지 확인
- **Auto-Deploy**: `Yes`로 설정되어 있으면 GitHub 푸시 시 자동 배포됩니다.

### 4단계: 수동 배포 (필요시)
1. Render 대시보드에서 "Manual Deploy" 클릭
2. "Deploy latest commit" 선택
3. 배포 진행 상황 확인

### 5단계: 배포 로그 확인
- 배포가 완료될 때까지 대기 (보통 2-5분)
- 로그에서 에러가 없는지 확인
- 배포 성공 시 백엔드 URL 확인 (예: `https://your-backend.onrender.com`)

---

## 프론트엔드 배포 (Vercel)

### 1단계: Vercel 대시보드 접속
1. https://vercel.com 접속
2. 로그인 후 기존 프로젝트 선택 (또는 새로 생성)

### 2단계: 프로젝트 설정 확인/수정

#### 빌드 설정
- **Framework Preset**: Vite
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### 3단계: 환경 변수 설정
Vercel 대시보드에서 다음 환경 변수를 설정:

```
VITE_API_BASE_URL=https://your-backend.onrender.com
```

**중요:** `VITE_API_BASE_URL`은 Render에서 배포한 백엔드 URL이어야 합니다.

### 4단계: GitHub 연결 확인
- **Repository**: 올바른 GitHub 저장소가 연결되어 있는지 확인
- **Branch**: `main` 브랜치가 선택되어 있는지 확인
- **Auto-Deploy**: 활성화되어 있으면 GitHub 푸시 시 자동 배포됩니다.

### 5단계: 수동 배포 (필요시)
1. Vercel 대시보드에서 "Deployments" 탭 클릭
2. "Redeploy" 버튼 클릭
3. 배포 진행 상황 확인

### 6단계: 배포 확인
- 배포가 완료될 때까지 대기 (보통 1-3분)
- 배포 성공 시 프론트엔드 URL 확인 (예: `https://your-app.vercel.app`)

---

## 환경 변수 설정

### 백엔드 (Render) 환경 변수

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `NODE_ENV` | 환경 모드 | `production` |
| `DATABASE_URL` | PostgreSQL 연결 URL | `postgresql://user:pass@host:5432/dbname` |
| `JWT_SECRET` | JWT 토큰 암호화 키 | `your-secret-key-here` |
| `PORT` | 서버 포트 | `10000` |

**설정 방법:**
1. Render 대시보드 → 서비스 선택 → "Environment" 탭
2. 각 변수를 추가하고 값 입력
3. "Save Changes" 클릭
4. 서비스 재배포 (자동 또는 수동)

### 프론트엔드 (Vercel) 환경 변수

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `VITE_API_BASE_URL` | 백엔드 API URL | `https://your-backend.onrender.com` |

**설정 방법:**
1. Vercel 대시보드 → 프로젝트 선택 → "Settings" → "Environment Variables"
2. 변수 추가: `VITE_API_BASE_URL`
3. 값 입력: Render 백엔드 URL
4. "Save" 클릭
5. 프로젝트 재배포

---

## 배포 후 확인사항

### 1. 백엔드 확인
- [ ] Render 대시보드에서 배포 상태가 "Live"인지 확인
- [ ] 백엔드 URL로 접속 시 정상 응답 확인
- [ ] API 엔드포인트 테스트 (예: `/api/auth/health` 또는 `/api/auth/members`)

### 2. 프론트엔드 확인
- [ ] Vercel 대시보드에서 배포 상태가 "Ready"인지 확인
- [ ] 프론트엔드 URL로 접속하여 페이지가 정상 로드되는지 확인
- [ ] 로그인 기능 테스트
- [ ] 주요 기능 테스트 (일정 확인, 투표, 갤러리 등)

### 3. 통합 확인
- [ ] 프론트엔드에서 백엔드 API 호출이 정상 작동하는지 확인
- [ ] 데이터베이스 연결이 정상인지 확인
- [ ] 투표 세션 관리 기능이 정상 작동하는지 확인
- [ ] 공휴일 및 요일 차단 기능이 정상 작동하는지 확인

---

## 문제 해결

### 백엔드 배포 실패

**문제: 빌드 실패**
```
해결 방법:
1. Render 로그에서 에러 메시지 확인
2. package.json의 의존성 확인
3. Node.js 버전 확인 (Render에서 설정)
4. Prisma 마이그레이션 확인
```

**문제: 데이터베이스 연결 실패**
```
해결 방법:
1. DATABASE_URL 환경 변수가 올바른지 확인
2. Render PostgreSQL 데이터베이스가 활성화되어 있는지 확인
3. 데이터베이스 연결 풀 설정 확인
```

**문제: 401/403 오류**
```
해결 방법:
1. JWT_SECRET 환경 변수가 설정되어 있는지 확인
2. 토큰 만료 시간 확인
3. CORS 설정 확인
```

### 프론트엔드 배포 실패

**문제: 빌드 실패**
```
해결 방법:
1. Vercel 빌드 로그에서 에러 메시지 확인
2. TypeScript 타입 오류 확인
3. 의존성 버전 충돌 확인
4. 환경 변수 누락 확인
```

**문제: API 호출 실패**
```
해결 방법:
1. VITE_API_BASE_URL 환경 변수가 올바른지 확인
2. 백엔드 CORS 설정 확인
3. 네트워크 탭에서 실제 요청 URL 확인
```

**문제: 페이지가 로드되지 않음**
```
해결 방법:
1. 브라우저 콘솔에서 에러 확인
2. Vercel 배포 로그 확인
3. 라우팅 설정 확인
```

### 일반적인 문제

**문제: 환경 변수가 적용되지 않음**
```
해결 방법:
1. 환경 변수 저장 후 프로젝트 재배포 필수
2. Vercel의 경우 환경 변수 변경 후 자동 재배포
3. Render의 경우 수동 재배포 필요할 수 있음
```

**문제: 데이터베이스 마이그레이션 오류**
```
해결 방법:
1. Render에서 "Shell" 탭 열기
2. 다음 명령어 실행:
cd backend
   npx prisma migrate deploy
```

---

## 배포 체크리스트

### 배포 전
- [ ] 로컬에서 모든 기능 테스트 완료
- [ ] Git에 모든 변경사항 커밋 및 푸시
- [ ] 환경 변수 목록 작성 완료
- [ ] 백업 완료

### 배포 중
- [ ] GitHub에 코드 푸시 완료
- [ ] Render 백엔드 배포 시작
- [ ] Vercel 프론트엔드 배포 시작
- [ ] 환경 변수 설정 완료

### 배포 후
- [ ] 백엔드 배포 성공 확인
- [ ] 프론트엔드 배포 성공 확인
- [ ] 로그인 기능 테스트
- [ ] 주요 기능 테스트
- [ ] 투표 세션 관리 기능 테스트
- [ ] 공휴일 및 요일 차단 기능 테스트

---

## 추가 참고사항

### 자동 배포 설정
- **GitHub 푸시 시 자동 배포**: Render와 Vercel 모두 기본적으로 활성화되어 있습니다.
- **특정 브랜치만 배포**: 설정에서 특정 브랜치만 선택할 수 있습니다.

### 성능 최적화
- **백엔드**: Render의 무료 플랜은 15분 동안 요청이 없으면 슬리프 모드로 전환됩니다. 첫 요청 시 약간의 지연이 있을 수 있습니다.
- **프론트엔드**: Vercel은 CDN을 사용하므로 전 세계 어디서나 빠른 로딩 속도를 제공합니다.

### 보안
- **환경 변수**: 절대 GitHub에 커밋하지 마세요. `.env` 파일은 `.gitignore`에 포함되어 있어야 합니다.
- **JWT_SECRET**: 강력한 랜덤 문자열을 사용하세요.
- **CORS**: 프로덕션 환경에서는 특정 도메인만 허용하도록 설정하세요.

---

## 지원

문제가 발생하면:
1. 배포 로그 확인 (Render/Vercel 대시보드)
2. 브라우저 콘솔 확인 (F12)
3. 네트워크 탭에서 API 요청 확인
4. 데이터베이스 연결 상태 확인

---

**마지막 업데이트**: 2025년 11월 18일
