# 매주 월요일 자동 작업 수동 실행 가이드

이 문서는 매주 월요일 00:01에 자동으로 실행되는 작업을 수동으로 테스트하는 방법을 설명합니다.

## 🔧 수동 실행 API

**엔드포인트**: `POST /api/admin/run-weekly-scheduler`

**인증**: 관리자 권한 필요

**요청 예시**:

### cURL 명령어:
```bash
curl -X POST https://fccgfirst.onrender.com/api/admin/run-weekly-scheduler \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### JavaScript (브라우저 콘솔 또는 관리자 페이지):
```javascript
const token = localStorage.getItem('token'); // 또는 세션에서 가져오기
fetch('https://fccgfirst.onrender.com/api/admin/run-weekly-scheduler', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
})
.then(res => res.json())
.then(data => {
  console.log('✅ 수동 실행 결과:', data);
})
.catch(error => {
  console.error('❌ 오류:', error);
});
```

## 📋 실행 결과

성공 시 다음과 같은 응답을 받습니다:

```json
{
  "success": true,
  "message": "자동 작업이 성공적으로 완료되었습니다.",
  "timestamp": "2025-11-03T04:30:00.000Z",
  "details": {
    "success": true,
    "message": "자동 작업이 성공적으로 완료되었습니다.",
    "sessionCreated": true,
    "sessionId": 6,
    "gamesCreated": 2
  }
}
```

## ✅ 확인 사항

수동 실행 후 다음을 확인하세요:

1. **관리자 페이지 → 투표 결과**
   - 새로 생성된 세션이 표시되는지 확인
   - 세션의 투표 기간이 올바른지 확인

2. **일정 페이지**
   - 자동 생성된 경기가 표시되는지 확인
   - 경기 정보(날짜, 참가자)가 올바른지 확인

3. **Render 로그**
   - 실행 과정의 상세 로그 확인
   - 오류가 없는지 확인

## ⚠️ 주의사항

1. **중복 실행**: 같은 주간에 대해 여러 번 실행하면 이미 존재하는 세션은 생성되지 않습니다.
2. **관리자 권한**: 반드시 관리자 권한이 있는 계정으로 로그인해야 합니다.
3. **데이터베이스**: 실행 중 데이터베이스 연결이 끊기면 오류가 발생할 수 있습니다.

## 🔄 실행 후 삭제 (선택사항)

테스트가 완료되면 이 API는 그대로 두어도 됩니다. 필요하다면 나중에 제거할 수 있습니다.

**제거 방법**:
- `backend/src/app.ts`에서 `/api/admin/run-weekly-scheduler` 엔드포인트 코드 삭제

