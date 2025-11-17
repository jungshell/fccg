# 복원 가이드

## 백업 정보
- 백업 날짜: $(date)
- 백업 파일: MainDashboard.tsx

## 복원 방법
1. 백업 파일을 원래 위치로 복사:
   ```bash
   cp backups/MainDashboard_YYYYMMDD_HHMMSS.tsx frontend/src/pages/MainDashboard.tsx
   ```

2. 또는 git을 사용하여 특정 커밋으로 되돌리기:
   ```bash
   git checkout <커밋해시> -- frontend/src/pages/MainDashboard.tsx
   ```

