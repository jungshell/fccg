# 투표 참여율 개선 단계적 배포 운영안

## 1) 기능 플래그

- `FEATURE_VOTE_REMINDER_AUTOMATION`: 미참여자 이메일 리마인드 자동 발송
- `FEATURE_QUICK_VOTE_ACTIONS`: 일정 페이지 원클릭 투표(지난주 복사/빠른 선택)
- `FEATURE_PARTICIPATION_KPI_DASHBOARD`: 관리자 참여율 KPI 카드

## 2) 배포 순서

1. 운영자 계정에서만 기능 확인 (플래그 ON, 공지 없이 내부 검증)
2. 전체 사용자 오픈 (리마인드 발송량/오류 로그 모니터링)
3. 2주 단위 KPI 회고 후 유지/확장 결정

## 3) 2주 회고 체크리스트

- 주간 참여율 증감(%p)
- 미참여자 수 변화
- 마감 6시간 전 미참여자 비율
- 리마인드 발송 대비 투표 전환율
- 운영자 수동 개입 횟수(수기 안내/문의 응대)

## 4) 롤백 기준

- 리마인드 발송 오류율 10% 초과 시 `FEATURE_VOTE_REMINDER_AUTOMATION=false`
- 투표 UX 오류 증가 시 `FEATURE_QUICK_VOTE_ACTIONS=false`
- 대시보드 데이터 불일치 발생 시 `FEATURE_PARTICIPATION_KPI_DASHBOARD=false`

