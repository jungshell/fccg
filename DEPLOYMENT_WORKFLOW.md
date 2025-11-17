# 배포 워크플로우 가이드

## 목적
로컬에서 수정을 완료한 후, 배포 요청 시에만 배포되도록 하여 불필요한 배포를 방지합니다.

## 워크플로우

### 1. 개발 브랜치에서 작업
```bash
# 개발 브랜치 생성 및 전환
git checkout -b dev

# 또는 기존 dev 브랜치 사용
git checkout dev
```

### 2. 로컬에서 개발 및 테스트
```bash
cd frontend
npm run dev
```

- 로컬 서버에서 변경사항 즉시 확인
- 모든 수정사항을 로컬에서 완료

### 3. 변경사항 커밋 (dev 브랜치)
```bash
git add .
git commit -m "feat: 변경사항 설명"
git push origin dev
```

### 4. 배포 요청 시 (main 브랜치로 머지)
```bash
# main 브랜치로 전환
git checkout main

# dev 브랜치의 변경사항을 main으로 머지
git merge dev

# main 브랜치에 푸시 (이때만 Vercel이 배포 시작)
git push origin main
```

## Vercel 설정

### 자동 배포 설정
- **Production Branch**: `main` (자동 배포)
- **Preview Branches**: `dev`, `develop` 등 (수동 확인용)

### 배포 제어
1. Vercel 대시보드에서 `main` 브랜치만 Production으로 설정
2. `dev` 브랜치는 Preview로만 배포 (자동 배포 안 됨)

## 디자인 토큰 사용 가이드

### 디자인 토큰 사용
```typescript
import { COLORS, SPACING, PADDING, LAYOUT } from '@/constants/designTokens';

// ❌ 잘못된 방법 (하드코딩)
<Box p={4} bg="#004ea8" />

// ✅ 올바른 방법 (디자인 토큰 사용)
<Box p={PADDING.CARD} bg={COLORS.BRAND_PRIMARY} />
```

### 공통 컴포넌트 사용
```typescript
import { Card, Section, Button } from '@/components/common';

// ❌ 잘못된 방법
<Box bg="white" p={4} borderRadius="lg" boxShadow="md">
  내용
</Box>

// ✅ 올바른 방법
<Card variant="default">
  내용
</Card>
```

## 체크리스트

배포 전 확인사항:
- [ ] 로컬에서 `npm run dev`로 모든 변경사항 확인
- [ ] 로컬에서 `npm run build`로 빌드 오류 확인
- [ ] 디자인 토큰 사용 여부 확인
- [ ] 공통 컴포넌트 사용 여부 확인
- [ ] TypeScript 타입 오류 없음
- [ ] ESLint 오류 없음

## 문제 해결

### 배포가 자동으로 되는 경우
- `main` 브랜치에 직접 push하지 않았는지 확인
- Vercel 설정에서 Production Branch가 `main`인지 확인

### 로컬과 배포 환경이 다른 경우
- `npm run build && npm run preview`로 프로덕션 빌드 테스트
- 환경 변수 차이 확인

