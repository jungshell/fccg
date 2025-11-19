# 🆓 무료 Keepalive 설정 가이드

Render 무료 플랜의 Sleep 문제를 해결하기 위한 **완전 무료** 방안입니다.

## ✅ 완료된 작업

### 1. Rate Limiter 예외 처리
- `/health` 및 `/api/auth/health` 엔드포인트를 rate limit에서 제외
- 헬스체크 요청이 429 에러를 받지 않도록 수정

### 2. GitHub Actions Keepalive 최적화
- 호출 주기: 10분 → **5분**으로 단축
- 엔드포인트: `/api/auth/health` → `/health`로 변경 (rate limit 제외)

## 📋 사용자가 해야 할 작업

### Render Dashboard 설정 변경

1. **Render Dashboard 접속**
   - https://dashboard.render.com 접속
   - `fccgfirst` 서비스 선택

2. **Settings 탭 이동**
   - 좌측 메뉴에서 **Settings** 클릭

3. **Health Check Path 변경**
   - **Health Check Path** 필드 찾기
   - 현재 값: `/api/auth/health` (또는 다른 경로)
   - **새 값으로 변경**: `/health`
   - **Save Changes** 클릭

4. **Health Check Interval 확인 (선택사항)**
   - 기본값: 60초
   - 이 값은 변경하지 않아도 됩니다 (5분마다 GitHub Actions가 깨우므로)

## 🔍 작동 원리

1. **GitHub Actions**: 5분마다 `/health` 엔드포인트 호출
2. **Render Health Check**: 60초마다 `/health` 엔드포인트 호출
3. **Rate Limit 제외**: 헬스체크 요청은 제한 없이 통과
4. **결과**: 인스턴스가 Sleep 되지 않고 계속 활성 상태 유지

## ⚠️ 주의사항

- **초기 응답 지연**: 인스턴스가 완전히 Sleep 된 경우, 첫 요청 시 5~10초 지연 가능
- **GitHub Actions 제한**: 무료 플랜은 월 2,000분 제한 (5분마다 실행 시 월 8,640회 = 충분)
- **Render 무료 플랜 제한**: 15분간 요청이 없으면 Sleep 가능 (하지만 5분마다 ping으로 방지)

## 📊 예상 효과

- ✅ **429 에러 해결**: 헬스체크가 rate limit에 걸리지 않음
- ✅ **Sleep 방지**: 5분마다 ping으로 인스턴스 유지
- ✅ **비용**: 완전 무료
- ⚠️ **초기 지연**: 완전히 Sleep 된 경우 최대 5~10초 지연 가능 (하지만 거의 발생하지 않음)

## 🔄 추가 최적화 (선택사항)

### 외부 무료 Cron 서비스 활용

GitHub Actions와 함께 사용하면 더 안정적입니다:

1. **cron-job.org** (무료)
   - 회원가입 후 새 Cron Job 생성
   - URL: `https://fccgfirst.onrender.com/health`
   - Schedule: `*/5 * * * *` (5분마다)
   - Method: GET

2. **UptimeRobot** (무료 플랜)
   - 50개 모니터링, 5분 간격
   - HTTP(S) 모니터링 추가
   - URL: `https://fccgfirst.onrender.com/health`

## 🚀 배포 후 확인

1. **GitHub Actions 로그 확인**
   - GitHub 레포지토리 → Actions 탭
   - "Render Keepalive" 워크플로우가 5분마다 실행되는지 확인

2. **Render Events 확인**
   - Render Dashboard → Events 탭
   - "Instance failed" 에러가 사라졌는지 확인

3. **API 테스트**
   - 브라우저에서 `https://fccgfirst.onrender.com/health` 접속
   - 정상 응답 확인

