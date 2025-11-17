# 🔍 Vercel 환경 변수 확인 방법

## 📋 접속 및 확인 절차

### 1단계: Vercel 대시보드 접속
1. https://vercel.com 접속
2. 로그인

### 2단계: 프로젝트 선택
1. 대시보드에서 **"fccg"** 또는 **"fccg-inoi"** 프로젝트 클릭
2. 프로젝트 상세 페이지로 이동

### 3단계: 환경 변수 설정 페이지 접속
1. 상단 메뉴에서 **"Settings"** 클릭
2. 왼쪽 사이드바에서 **"Environment Variables"** 클릭

### 4단계: 환경 변수 확인

#### ✅ 필수 환경 변수:

```
KEY: VITE_API_BASE_URL
VALUE: https://fccgfirst.onrender.com/api/auth
```

**⚠️ 중요:**
- 이 값이 **반드시** 설정되어 있어야 합니다
- 프론트엔드가 백엔드 API를 호출할 때 사용됩니다

---

## 🔧 환경 변수가 없거나 잘못된 경우

### 추가/수정 방법:

1. **"Add New"** 또는 **"+ Add"** 버튼 클릭
2. KEY에 `VITE_API_BASE_URL` 입력
3. VALUE에 `https://fccgfirst.onrender.com/api/auth` 입력
4. 환경 선택:
   - ✅ Production
   - ✅ Preview  
   - ✅ Development (선택사항)
5. **"Save"** 클릭

### 수정 방법:
- 기존 환경 변수 옆 **연필 아이콘(편집)** 클릭
- VALUE 수정
- **"Save"** 클릭

---

## ✅ 확인 체크리스트

- [ ] VITE_API_BASE_URL이 설정되어 있는가?
- [ ] VALUE가 `https://fccgfirst.onrender.com/api/auth`인가?
- [ ] Production 환경에 적용되어 있는가?
- [ ] Preview 환경에도 설정되어 있는가? (권장)

---

## 🔄 환경 변수 변경 후

환경 변수를 추가/수정한 후:
1. **자동으로 재배포**됩니다 (몇 분 소요)
2. 배포 완료 후 프론트엔드가 새 환경 변수를 사용합니다

---

## 🆘 확인이 안 될 때

### 방법 1: 브라우저 콘솔 확인
1. 배포된 사이트 접속: https://fccg-inoi.vercel.app
2. F12 (개발자 도구) 열기
3. Console 탭에서 API 호출 확인
4. Network 탭에서 실제 API URL 확인

### 방법 2: Vercel 로그 확인
1. Vercel 대시보드 → 프로젝트
2. **"Deployments"** 탭
3. 최신 배포 클릭
4. **"Functions"** 또는 **"Runtime Logs"** 확인

---

## 📸 확인 방법 요약

**단계별:**
```
Vercel.com 
  → 프로젝트 선택 
  → Settings 
  → Environment Variables
  → VITE_API_BASE_URL 확인
```

**빠른 접근:**
- 직접 URL: `https://vercel.com/[your-team]/[project]/settings/environment-variables`
