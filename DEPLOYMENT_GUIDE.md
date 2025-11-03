# 배포 가이드 - 사진 및 일정 페이지 문제 해결

## ✅ 완료된 수정 사항

모든 코드 수정과 빌드가 완료되었습니다:

1. **백엔드 CORS 설정 수정** (`backend/src/app.ts`)
   - `cache-control` 헤더 허용 추가
   - CORS 에러 해결

2. **백엔드 갤러리 API 수정** (`backend/src/routes/auth_simple.ts`)
   - 이미지 URL 경로 자동 수정 (`/uploads/` → `/uploads/gallery/`)
   - 정적 파일 서빙 경로 추가

3. **프론트엔드 사진 페이지 수정** (`frontend/src/pages/PhotoGalleryPage.tsx`)
   - 이미지 URL 처리 로직 개선
   - 이미지 로드 에러 핸들링 추가
   - 디버깅 로그 추가

4. **프론트엔드 일정 페이지 수정** (`frontend/src/pages/SchedulePageV2.tsx`)
   - NaN 에러 방지 로직 추가
   - 날짜 유효성 검증 강화

5. **프론트엔드 캘린더 컴포넌트 수정** (`frontend/src/components/NewCalendarV2.tsx`)
   - 날짜 키 유효성 검증 추가
   - NaN 포함 키 필터링

6. **프론트엔드 빌드 완료**
   - 모든 수정사항 반영된 빌드 파일 생성됨

---

## 📋 사용자가 해야 할 작업

### 1단계: Git 커밋 및 푸시

#### 백엔드 코드 커밋
```bash
# 터미널에서 실행
cd /Users/sunginjung/app_builder/on_my_own/FCCGByGemini

# 변경사항 확인
git status

# 백엔드 파일 커밋
git add backend/src/app.ts backend/src/routes/auth_simple.ts
git commit -m "fix: CORS 설정 수정 및 갤러리 이미지 경로 자동 수정"

# 프론트엔드 파일 커밋
git add frontend/src/pages/PhotoGalleryPage.tsx frontend/src/pages/SchedulePageV2.tsx frontend/src/components/NewCalendarV2.tsx
git commit -m "fix: 사진 표시 문제 및 일정 페이지 NaN 에러 수정"

# 프론트엔드 빌드 파일 커밋
git add frontend/dist/
git commit -m "build: 프론트엔드 빌드 파일 업데이트"

# 모든 변경사항 푸시
git push origin main
```

**중요:** 위 명령어를 순서대로 실행하세요. 각 `git commit` 명령은 독립적으로 실행됩니다.

---

### 2단계: Render에 백엔드 배포

1. **Render 웹사이트 접속**
   - 브라우저에서 https://dashboard.render.com 접속
   - 로그인

2. **백엔드 서비스 찾기**
   - 왼쪽 사이드바에서 "Services" 클릭
   - `fccgfirst` 또는 백엔드 서비스 이름 클릭

3. **자동 배포 확인**
   - Render는 Git 푸시를 감지하면 자동으로 배포를 시작합니다
   - 페이지 상단의 "Recent deploys" 섹션에서 배포 상태 확인
   - 배포가 진행 중이면 "Building..." 또는 "Live" 상태 표시

4. **수동 배포 (자동 배포가 안 되는 경우)**
   - 서비스 페이지에서 상단의 "Manual Deploy" 버튼 클릭
   - "Deploy latest commit" 선택
   - 배포 시작됨

5. **배포 완료 확인**
   - 배포가 완료되면 상태가 "Live"로 변경됨
   - 보통 2-5분 소요

---

### 3단계: Vercel에 프론트엔드 배포

1. **Vercel 웹사이트 접속**
   - 브라우저에서 https://vercel.com 접속
   - 로그인

2. **프로젝트 찾기**
   - 대시보드에서 `fccg-inoi` 또는 프로젝트 이름 클릭

3. **자동 배포 확인**
   - Vercel도 Git 푸시를 감지하면 자동 배포합니다
   - "Deployments" 탭에서 최신 배포 상태 확인
   - 배포가 진행 중이면 "Building..." 또는 "Ready" 상태 표시

4. **수동 배포 (자동 배포가 안 되는 경우)**
   - 프로젝트 페이지에서 "Deployments" 탭 클릭
   - 상단의 "Redeploy" 버튼 클릭
   - "Use Existing Build" 또는 "Rebuild" 선택
   - 배포 시작됨

5. **배포 완료 확인**
   - 배포가 완료되면 상태가 "Ready"로 변경됨
   - 보통 1-3분 소요

---

### 4단계: 배포 후 테스트

1. **브라우저 캐시 삭제**
   - Chrome: `Cmd + Shift + Delete` (Mac) 또는 `Ctrl + Shift + Delete` (Windows)
   - "캐시된 이미지 및 파일" 선택
   - "지난 1시간" 또는 "전체 기간" 선택
   - "데이터 삭제" 클릭

2. **강력 새로고침**
   - 사진 페이지로 이동: https://fccg-inoi.vercel.app/gallery/photos
   - `Cmd + Shift + R` (Mac) 또는 `Ctrl + Shift + F5` (Windows)로 강력 새로고침

3. **개발자 도구 확인**
   - `F12` 또는 `Cmd + Option + I` (Mac) / `Ctrl + Shift + I` (Windows)
   - "Console" 탭 열기
   - 다음 로그가 보여야 함:
     - `📸 갤러리 API 응답:`
     - `✅ 이미지 로드 성공:`
   - CORS 에러가 사라져야 함

4. **일정 페이지 테스트**
   - 일정 페이지로 이동: https://fccg-inoi.vercel.app/schedule-v2
   - 페이지가 정상적으로 로드되어야 함
   - 에러가 없어야 함

---

## 🔍 문제 해결

### 배포가 안 될 때

**백엔드 (Render):**
1. Render 대시보드에서 "Logs" 탭 확인
2. 빌드 에러가 있으면 에러 메시지 확인
3. 에러가 있으면 알려주세요

**프론트엔드 (Vercel):**
1. Vercel 대시보드에서 "Deployments" → 최신 배포 클릭
2. "Build Logs" 확인
3. 에러가 있으면 알려주세요

### 여전히 사진이 안 보일 때

1. 브라우저 콘솔 열기 (F12)
2. 다음 확인:
   - CORS 에러가 여전히 있는지
   - `📸 갤러리 API 응답` 로그가 있는지
   - `❌ 이미지 로드 실패` 로그가 있는지
3. 로그 내용을 스크린샷 찍어서 공유해주세요

---

## 📝 변경된 파일 목록

- `backend/src/app.ts` - CORS 설정
- `backend/src/routes/auth_simple.ts` - 갤러리 API 이미지 경로 수정
- `frontend/src/pages/PhotoGalleryPage.tsx` - 이미지 처리 로직
- `frontend/src/pages/SchedulePageV2.tsx` - 날짜 유효성 검증
- `frontend/src/components/NewCalendarV2.tsx` - NaN 에러 방지
- `frontend/dist/` - 빌드 파일들

---

## ✅ 완료 체크리스트

배포 후 아래 항목을 확인하세요:

- [ ] Git 푸시 완료
- [ ] Render 백엔드 배포 완료 (Live 상태)
- [ ] Vercel 프론트엔드 배포 완료 (Ready 상태)
- [ ] 브라우저 캐시 삭제 완료
- [ ] 사진 페이지 접속 확인
- [ ] 개발자 도구 콘솔 확인 (에러 없음)
- [ ] 사진이 정상적으로 표시됨
- [ ] 일정 페이지 정상 작동

모든 항목이 체크되면 문제가 해결된 것입니다! 🎉
