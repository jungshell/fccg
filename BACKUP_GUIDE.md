# 💾 데이터베이스 백업 가이드

> FC CHAL-GGYEO 시스템 데이터베이스 백업 및 복원 가이드

---

## 📋 백업 시스템 개요

### 자동 백업

- **주기**: 매일 오전 3시 (한국시간)
- **방식**: GitHub Actions를 통한 자동 실행
- **보관 기간**: 30일
- **저장 위치**: GitHub Actions Artifacts

### 수동 백업

- **방법**: GitHub Actions 워크플로우 수동 실행
- **또는**: 로컬에서 스크립트 직접 실행

---

## 🔄 자동 백업 설정

### GitHub Actions 설정

1. **저장소 Secrets 설정**
   - GitHub 저장소 → Settings → Secrets and variables → Actions
   - `DATABASE_URL` 추가 (Neon PostgreSQL 연결 문자열)

2. **워크플로우 확인**
   - `.github/workflows/database-backup.yml` 파일 확인
   - 매일 오전 3시 자동 실행 설정됨

3. **백업 확인**
   - GitHub → Actions 탭
   - "Database Backup" 워크플로우 확인
   - Artifacts에서 백업 파일 다운로드 가능

---

## 🛠️ 수동 백업 실행

### 방법 1: GitHub Actions 수동 실행

1. GitHub 저장소 → Actions 탭
2. "Database Backup" 워크플로우 선택
3. "Run workflow" 버튼 클릭
4. 백업 완료 후 Artifacts에서 다운로드

### 방법 2: 로컬 스크립트 실행

```bash
# 1. 프로젝트 디렉토리로 이동
cd backend

# 2. 환경 변수 설정
export DATABASE_URL="postgresql://..."

# 3. PostgreSQL 클라이언트 설치 (필요시)
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql-client

# 4. 백업 스크립트 실행
node scripts/backup-database.js
```

**백업 파일 위치**: `backend/backups/backup-YYYY-MM-DD-*.sql`

---

## 📥 백업 복원

### PostgreSQL 데이터베이스 복원

```bash
# 1. 백업 파일 다운로드
# GitHub Actions Artifacts에서 다운로드

# 2. 데이터베이스 연결 정보 확인
# DATABASE_URL 환경 변수 또는 Neon 대시보드에서 확인

# 3. 복원 실행
PGPASSWORD="your_password" pg_restore \
  -h your_host \
  -p 5432 \
  -U your_user \
  -d your_database \
  -c \  # 기존 데이터 삭제 후 복원
  backup-file.sql
```

### 주의사항

⚠️ **복원 시 기존 데이터가 삭제됩니다!**
- 복원 전 현재 데이터베이스 백업 권장
- 프로덕션 환경에서는 신중하게 진행

---

## 🔍 백업 상태 확인

### GitHub Actions에서 확인

1. GitHub 저장소 → Actions 탭
2. "Database Backup" 워크플로우 클릭
3. 최근 실행 기록 확인
4. 성공/실패 상태 확인

### 로컬 백업 파일 확인

```bash
# 백업 디렉토리 확인
ls -lh backend/backups/

# 백업 파일 크기 확인
du -sh backend/backups/*
```

---

## ⚙️ 백업 설정 커스터마이징

### 백업 주기 변경

`.github/workflows/database-backup.yml` 파일 수정:

```yaml
schedule:
  # 매일 오전 3시 (한국시간)
  - cron: '0 18 * * *'  # UTC 18:00 = KST 03:00
  
  # 주 1회 (매주 월요일 오전 3시)
  # - cron: '0 18 * * 1'
  
  # 하루 2회 (오전 3시, 오후 3시)
  # - cron: '0 18,6 * * *'
```

### 보관 기간 변경

`backend/scripts/backup-database.js` 파일 수정:

```javascript
// 30일 → 60일로 변경
const thirtyDaysAgo = 60 * 24 * 60 * 60 * 1000;
```

---

## 🚨 백업 실패 시 대응

### 문제 진단

1. **GitHub Actions 로그 확인**
   - Actions 탭 → 실패한 워크플로우 → 로그 확인
   - 에러 메시지 확인

2. **일반적인 원인**
   - `DATABASE_URL` Secrets 미설정
   - 데이터베이스 연결 실패
   - PostgreSQL 클라이언트 미설치

### 해결 방법

1. **DATABASE_URL 확인**
   ```bash
   # GitHub Secrets에 올바른 값이 설정되어 있는지 확인
   ```

2. **수동 백업 실행**
   - 로컬에서 스크립트 직접 실행
   - 또는 GitHub Actions 수동 실행

3. **데이터베이스 연결 확인**
   ```bash
   # 연결 테스트
   psql $DATABASE_URL -c "SELECT 1;"
   ```

---

## 📊 백업 모니터링

### 정기 확인 사항

- [ ] 매주 백업 성공 여부 확인
- [ ] 백업 파일 크기 확인 (비정상적으로 작으면 문제 가능)
- [ ] 백업 파일 다운로드 테스트
- [ ] 복원 테스트 (분기별 권장)

---

## ✅ 백업 체크리스트

### 초기 설정

- [x] GitHub Actions 워크플로우 생성
- [x] DATABASE_URL Secrets 설정
- [x] 백업 스크립트 작성
- [ ] 첫 백업 성공 확인

### 정기 점검

- [ ] 주 1회 백업 상태 확인
- [ ] 월 1회 백업 파일 다운로드 테스트
- [ ] 분기별 복원 테스트

---

**마지막 업데이트**: 2025.11.20

