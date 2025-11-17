# FCCG - 축구팀 관리 시스템

축구팀의 일정, 갤러리, 회원관리를 위한 종합 관리 시스템입니다.

## 🚀 주요 기능

### 📅 일정 관리
- 경기 일정 등록 및 관리
- 투표 시스템
- 달력 뷰
- 알림 기능

### 📸 갤러리
- **사진 갤러리**: 사진 업로드, 그룹핑, 다운로드
- **동영상 갤러리**: YouTube 재생목록 자동 동기화
- 좋아요, 댓글 기능
- 이벤트 타입별 분류 (매치, 자체, 회식, 기타)

### 👥 회원 관리
- 회원 등록 및 프로필 관리
- 권한 관리 (일반회원, 관리자, 슈퍼관리자)
- 로그인/로그아웃

### 🔧 관리자 기능
- 실시간 통계 대시보드
- 사이트 설정 관리
- 일정 알림 관리
- 선수 관리
- 활동 분석 및 리포팅
- 공지사항 관리

## 🛠 기술 스택

- **Frontend**: React 18 + TypeScript
- **UI Framework**: Chakra UI
- **Routing**: React Router DOM
- **State Management**: Zustand
- **Build Tool**: Vite
- **Linting**: ESLint + TypeScript ESLint
- **Code Formatting**: Prettier

## 📦 설치 및 실행

### 필수 요구사항
- Node.js 18+ 
- npm 또는 yarn

### 설치
```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 결과 미리보기
npm run preview
```

## 🔧 개발 도구

### 코드 품질
```bash
# 린팅
npm run lint

# 린팅 자동 수정
npm run lint:fix

# 타입 체크
npm run type-check

# 코드 포맷팅
npm run format
```

### 빌드 최적화
```bash
# 번들 분석
npm run build:analyze

# 캐시 정리
npm run clean
```

## 📁 프로젝트 구조

```
src/
├── components/          # 재사용 가능한 컴포넌트
│   ├── Header.tsx      # 헤더 네비게이션
│   └── ...
├── pages/              # 페이지 컴포넌트
│   ├── MainDashboard.tsx
│   ├── SchedulePageV2.tsx
│   ├── PhotoGalleryPage.tsx
│   ├── VideoGalleryPage.tsx
│   ├── AdminPageNew.tsx
│   └── ...
├── store/              # 상태 관리
│   └── auth.ts
├── api/                # API 관련
│   └── auth.ts
├── utils/              # 유틸리티 함수
└── App.tsx             # 메인 앱 컴포넌트
```

## 🎨 디자인 시스템

### 색상 팔레트
- **Primary Blue**: `#004ea8` (메인 브랜드 컬러)
- **Success Green**: `#38A169` (성공, 완료 상태)
- **Warning Orange**: `#DD6B20` (경고, 투표 필요)
- **Error Red**: `#E53E3E` (오류, 투표 전)

### 컴포넌트 스타일
- 일관된 간격과 패딩
- 반응형 디자인
- 접근성 고려
- 모던하고 깔끔한 UI

## 🔐 권한 시스템

### 사용자 역할
1. **일반회원**: 기본 기능 사용
2. **관리자**: 갤러리 관리, 일정 관리
3. **슈퍼관리자**: 모든 기능 접근

### 기능별 권한
- **업로드**: 로그인한 모든 사용자
- **편집/삭제**: 업로더, 관리자, 슈퍼관리자
- **관리자 페이지**: 관리자, 슈퍼관리자

## 📱 반응형 지원

- **Desktop**: 1200px+
- **Tablet**: 768px - 1199px
- **Mobile**: 320px - 767px

## 🚀 성능 최적화

- **Code Splitting**: 라우트별 청크 분할
- **Lazy Loading**: 컴포넌트 지연 로딩
- **Image Optimization**: 자동 이미지 압축
- **Bundle Optimization**: 번들 크기 최적화
- **Caching**: localStorage 활용

## 🔧 환경 설정

### 환경 변수
```env
VITE_YOUTUBE_API_KEY=your_youtube_api_key
VITE_YOUTUBE_PLAYLIST_ID=your_playlist_id
```

### localStorage 키
- `galleryItems`: 갤러리 아이템
- `siteSettings`: 사이트 설정
- `notificationSettings`: 알림 설정
- `players`: 선수 정보
- `announcements`: 공지사항

## 📝 개발 가이드라인

### 코드 스타일
- TypeScript 엄격 모드 사용
- 함수형 컴포넌트와 Hooks 활용
- 의미있는 변수명과 함수명
- 주석 작성 (복잡한 로직)

### 컴포넌트 설계
- 단일 책임 원칙
- Props 인터페이스 정의
- 재사용 가능한 컴포넌트 설계
- 접근성 고려

### 상태 관리
- 로컬 상태: useState
- 전역 상태: Zustand
- 서버 상태: 직접 API 호출

## 🐛 문제 해결

### 일반적인 문제
1. **빌드 오류**: `npm run clean` 후 재설치
2. **타입 오류**: `npm run type-check` 실행
3. **린팅 오류**: `npm run lint:fix` 실행

### 성능 이슈
- 이미지 크기 최적화
- 불필요한 리렌더링 방지
- 메모리 누수 방지

## 📄 라이선스

이 프로젝트는 내부 사용을 위한 축구팀 관리 시스템입니다.

## 🤝 기여

프로젝트 개선을 위한 제안이나 버그 리포트는 언제든 환영합니다.

---

**FCCG Team** - 축구팀 관리 시스템
