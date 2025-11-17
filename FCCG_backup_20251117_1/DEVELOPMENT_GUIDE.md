# 개발 가이드

## 🎯 목표
로컬 개발과 프로덕션 배포에서 **동일한 결과**를 보장합니다.
- 하드코딩 없음
- 환경별 자동 감지
- API 연동 일관성 보장

---

## 📋 개발 환경 설정

### 1. 로컬 개발 환경

#### 필수 파일: `frontend/public/app-config.json`
```json
{
  "API_BASE_URL": "/api/auth"
}
```

이 파일은 **로컬 개발 전용**입니다.
- Vite 프록시가 `/api`를 `http://localhost:4000`으로 전달
- Git에 커밋되어도 프로덕션에 영향 없음

#### 백엔드 서버 실행
```bash
cd backend
npm run dev
```
백엔드는 `http://localhost:4000`에서 실행됩니다.

#### 프론트엔드 개발 서버 실행
```bash
cd frontend
npm run dev
```
프론트엔드는 `http://localhost:5173`에서 실행됩니다.

---

## 🚀 배포 전 체크리스트

### 로컬에서 테스트 완료 후 배포

#### ✅ 필수 확인 사항

1. **API 호출 테스트**
   - [ ] 로그인/로그아웃 정상 작동
   - [ ] 멤버 데이터 로드 정상
   - [ ] 경기 데이터 로드 정상
   - [ ] 투표 기능 정상 작동
   - [ ] 사진/동영상 갤러리 정상 작동

2. **콘솔 에러 확인**
   - [ ] 개발자 도구(F12) → Console 탭에서 에러 없음
   - [ ] Network 탭에서 API 호출 성공 확인

3. **빌드 테스트**
   ```bash
   cd frontend
   npm run build
   npm run preview
   ```
   - [ ] 빌드 성공
   - [ ] 프리뷰에서 모든 기능 정상 작동

4. **환경 변수 확인**
   - [ ] Vercel에 `VITE_API_BASE_URL` 환경 변수 설정됨
   - [ ] 값: `https://fccgfirst.onrender.com/api/auth`

---

## 🔧 환경 변수 설정

### 로컬 개발
**자동 설정됨** - `app-config.json` 사용

### 프로덕션 (Vercel)
1. Vercel 대시보드 접속
2. 프로젝트 → Settings → Environment Variables
3. 다음 환경 변수 추가:
   ```
   KEY: VITE_API_BASE_URL
   VALUE: https://fccgfirst.onrender.com/api/auth
   Environment: Production, Preview
   ```

---

## 📁 파일 구조

```
frontend/
├── public/
│   └── app-config.json          # 로컬 개발용 (Git 커밋됨)
├── src/
│   ├── config/
│   │   ├── api.ts               # API 설정 관리 (하드코딩 없음)
│   │   └── runtime.ts           # 런타임 설정 로드
│   └── constants/
│       └── index.ts              # API 엔드포인트 정의
```

---

## 🔍 API BASE URL 우선순위

1. **빌드 타임 환경 변수** (`VITE_API_BASE_URL`)
   - 프로덕션 배포 시 Vercel에서 주입
   - 최우선 사용

2. **런타임 설정** (`app-config.json` 또는 `window.__APP_CONFIG__`)
   - 로컬 개발 시 사용
   - 빌드 타임 값이 없을 때만 사용

3. **로컬 기본값** (`/api/auth`)
   - localhost에서만 자동 사용
   - Vite 프록시 활용

---

## ⚠️ 주의사항

### ❌ 하지 말아야 할 것
- API URL 하드코딩
- 환경별로 다른 로직 사용
- `app-config.json`을 프로덕션 URL로 변경

### ✅ 해야 할 것
- `getApiBaseUrl()` 함수 사용 (하드코딩 없음)
- 로컬에서 모든 기능 테스트 후 배포
- 배포 전 빌드 테스트 (`npm run build && npm run preview`)

---

## 🐛 문제 해결

### 로컬에서 API 호출 실패
1. 백엔드 서버 실행 확인 (`http://localhost:4000`)
2. `app-config.json` 확인 (`/api/auth`로 설정)
3. 브라우저 콘솔에서 에러 메시지 확인

### 프로덕션에서 API 호출 실패
1. Vercel 환경 변수 확인 (`VITE_API_BASE_URL`)
2. 배포 로그 확인 (환경 변수 주입 여부)
3. 브라우저 콘솔에서 실제 API URL 확인

---

## 📝 변경 이력

- 2025-11-10: 환경별 자동 감지 시스템 구축
- 2025-11-10: 하드코딩 제거 및 동적 API URL 관리

