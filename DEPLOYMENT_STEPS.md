# 🚀 배포 단계별 가이드 (사용자 작업만)

## ✅ 완료된 작업
- [x] 코드 변경사항 Git에 추가
- [x] Git 커밋 완료
- [x] 배포 가이드 작성 완료

---

## 📝 사용자가 해야 할 작업

### 1️⃣ GitHub에 푸시 (필수)

터미널에서 다음 명령어 실행:
```bash
cd /Users/sunginjung/app_builder/on_my_own/FCCGByGemini
git push origin main
```

**만약 오류가 발생하면:**
- 토큰 인증이 필요할 수 있습니다
- GitHub Personal Access Token을 사용하세요

---

### 2️⃣ Render (백엔드) 배포

#### 방법 A: 자동 배포 (권장)
- GitHub 푸시 후 자동으로 배포됩니다
- Render 대시보드에서 배포 상태만 확인하면 됩니다

#### 방법 B: 수동 배포
1. https://dashboard.render.com 접속
2. 기존 백엔드 서비스 선택
3. "Manual Deploy" → "Deploy latest commit" 클릭
4. 배포 완료 대기 (2-5분)

#### 환경 변수 확인 (이미 설정되어 있다면 스킵)
Render 대시보드 → 서비스 → "Environment" 탭에서 확인:
- `DATABASE_URL` ✅
- `JWT_SECRET` ✅
- `NODE_ENV=production` ✅
- `PORT=10000` ✅

---

### 3️⃣ Vercel (프론트엔드) 배포

#### 방법 A: 자동 배포 (권장)
- GitHub 푸시 후 자동으로 배포됩니다
- Vercel 대시보드에서 배포 상태만 확인하면 됩니다

#### 방법 B: 수동 배포
1. https://vercel.com 접속
2. 기존 프로젝트 선택
3. "Deployments" 탭 → "Redeploy" 클릭
4. 배포 완료 대기 (1-3분)

#### 환경 변수 확인 (이미 설정되어 있다면 스킵)
Vercel 대시보드 → 프로젝트 → "Settings" → "Environment Variables"에서 확인:
- `VITE_API_BASE_URL` = Render 백엔드 URL (예: `https://your-backend.onrender.com`)

---

### 4️⃣ 배포 확인 (5분 소요)

#### 백엔드 확인
1. Render 대시보드에서 배포 상태가 "Live"인지 확인
2. 백엔드 URL로 접속하여 정상 응답 확인

#### 프론트엔드 확인
1. Vercel 대시보드에서 배포 상태가 "Ready"인지 확인
2. 프론트엔드 URL로 접속하여 페이지 로드 확인
3. 로그인 테스트
4. 투표 세션 관리 기능 테스트

---

## ⚠️ 문제 발생 시

### GitHub 푸시 실패
```bash
# 토큰 재설정 (필요시)
git push origin main
# 토큰 입력 프롬프트가 나오면 GitHub Personal Access Token 입력
```

### 배포 실패
- Render/Vercel 대시보드의 "Logs" 탭에서 에러 확인
- 에러 메시지를 복사하여 알려주시면 해결 방법 안내

### 환경 변수 누락
- Render/Vercel 대시보드에서 환경 변수 추가 후 재배포

---

## 📌 체크리스트

배포 전:
- [ ] Git 푸시 완료

배포 중:
- [ ] Render 배포 시작 (자동 또는 수동)
- [ ] Vercel 배포 시작 (자동 또는 수동)

배포 후:
- [ ] 백엔드 URL 접속 확인
- [ ] 프론트엔드 URL 접속 확인
- [ ] 로그인 기능 테스트
- [ ] 투표 세션 관리 기능 테스트

---

**예상 소요 시간**: 5-10분

