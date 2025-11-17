# ☁️ Cloudinary 설정 가이드

이 가이드는 Cloudinary를 사용하여 이미지를 무료로 저장하고 관리하는 방법을 설명합니다.

## 📋 1단계: Cloudinary 계정 생성 (약 2분)

1. **Cloudinary 웹사이트 접속**
   - https://cloudinary.com 접속
   - "Sign Up for Free" 클릭

2. **회원가입**
   - 이메일 주소 입력
   - 비밀번호 설정
   - 이메일 인증 완료

3. **대시보드 접속**
   - 로그인 후 Dashboard로 이동
   - 화면 중앙에 **"Cloud Name"**, **"API Key"**, **"API Secret"**이 표시됩니다

---

## 🔑 2단계: 환경 변수 확인 (Cloudinary 대시보드에서)

Cloudinary 대시보드에서 다음 정보를 복사하세요:

### Dashboard에서 확인할 수 있는 정보:
1. **Cloud Name** (예: `dabc123xyz`)
2. **API Key** (예: `123456789012345`)
3. **API Secret** (예: `abcdefghijklmnopqrstuvwxyz123456`)

⚠️ **중요**: API Secret은 한 번만 표시되므로 **반드시 복사해서 안전한 곳에 저장**하세요!

---

## ⚙️ 3단계: Render에 환경 변수 설정

### Render 대시보드에서 설정:

1. **Render 대시보드 접속**
   - https://dashboard.render.com 접속
   - 로그인

2. **백엔드 서비스 선택**
   - `fccgfirst` 서비스 클릭

3. **Environment 탭 클릭**
   - 왼쪽 사이드바에서 "Environment" 클릭

4. **환경 변수 추가**
   다음 3개의 환경 변수를 추가하세요:

   #### 변수 1: CLOUDINARY_CLOUD_NAME
   - **Key**: `CLOUDINARY_CLOUD_NAME`
   - **Value**: Cloudinary 대시보드의 "Cloud Name" 값
   - **"Add"** 클릭

   #### 변수 2: CLOUDINARY_API_KEY
   - **Key**: `CLOUDINARY_API_KEY`
   - **Value**: Cloudinary 대시보드의 "API Key" 값
   - **"Add"** 클릭

   #### 변수 3: CLOUDINARY_API_SECRET
   - **Key**: `CLOUDINARY_API_SECRET`
   - **Value**: Cloudinary 대시보드의 "API Secret" 값
   - **"Add"** 클릭

5. **저장 및 재배포**
   - 모든 환경 변수를 추가한 후
   - Render가 자동으로 재배포를 시작합니다 (약 2-5분 소요)

---

## 🧪 4단계: 로컬 개발 환경 설정 (선택사항)

로컬에서 테스트하려면 `.env` 파일에 다음을 추가하세요:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

## ✅ 5단계: 설정 확인

1. **Render 배포 완료 확인**
   - Render 대시보드에서 배포 상태가 "Live"인지 확인

2. **사진 업로드 테스트**
   - 프론트엔드에서 새 사진 업로드 시도
   - 이미지가 Cloudinary에 저장되고 표시되어야 합니다

3. **Cloudinary 대시보드에서 확인**
   - Cloudinary 대시보드 → Media Library
   - `fccg/gallery` 폴더에 업로드된 이미지 확인 가능

---

## 🎯 Cloudinary 무료 플랜 제한사항

### 무료 플랜 제공량:
- ✅ **저장 공간**: 25GB
- ✅ **월간 트래픽**: 25GB
- ✅ **이미지 변환**: 무제한
- ✅ **자동 최적화**: 지원

### 용량 초과 시:
- 알림 이메일 발송
- 추가 용량 구매 필요 (유료 플랜으로 업그레이드)

---

## 🔧 문제 해결

### 문제 1: "Invalid API credentials" 에러
**원인**: 환경 변수가 잘못 설정됨  
**해결**: Render의 Environment Variables에서 값 재확인

### 문제 2: 이미지 업로드 실패
**원인**: API Secret이 잘못 입력됨  
**해결**: Cloudinary 대시보드에서 API Secret 재확인 (Settings → Security)

### 문제 3: 이미지가 표시되지 않음
**원인**: CORS 설정 문제  
**해결**: 이미 Cloudinary URL은 CORS가 자동으로 처리되므로 문제 없어야 함

---

## 📚 추가 리소스

- **Cloudinary 문서**: https://cloudinary.com/documentation
- **Node.js SDK 가이드**: https://cloudinary.com/documentation/node_integration

---

## 🎉 완료!

환경 변수 설정이 완료되면:
1. Render가 자동으로 재배포됩니다
2. 새로 업로드한 이미지는 Cloudinary에 저장됩니다
3. Render 서버 재시작과 관계없이 이미지가 유지됩니다

