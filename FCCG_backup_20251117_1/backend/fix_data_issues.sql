-- 데이터 문제 해결 스크립트
-- Neon SQL Editor에서 실행하세요

-- 1. 경기 유형(eventType) 정규화
-- "풋살", "FRIENDLY" 등 비규격 값을 규격 값으로 변환
UPDATE "Game"
SET "eventType" = CASE
  WHEN "eventType" IN ('풋살', 'FRIENDLY', 'FRIENDLY_MATCH', 'friendly') THEN '매치'
  WHEN "eventType" IN ('SELF', 'self', '자체훈련') THEN '자체'
  WHEN "eventType" IN ('DINNER', 'dinner', '회식모임') THEN '회식'
  WHEN "eventType" IS NULL OR "eventType" = '' THEN '자체'
  WHEN "eventType" NOT IN ('매치', '자체', '회식', '기타') THEN '기타'
  ELSE "eventType"
END
WHERE "eventType" IS NOT NULL 
  AND "eventType" NOT IN ('매치', '자체', '회식', '기타');

-- 2. gameType도 정규화 (eventType에 맞춰서)
UPDATE "Game"
SET "gameType" = CASE
  WHEN "eventType" = '매치' THEN 'MATCH'
  WHEN "eventType" = '회식' THEN 'OTHER'
  WHEN "eventType" = '기타' THEN 'OTHER'
  ELSE 'SELF'
END
WHERE "gameType" NOT IN ('MATCH', 'SELF', 'OTHER', 'FRIENDLY')
   OR "gameType" IS NULL;

-- 3. 확인 쿼리
SELECT 
  "eventType",
  COUNT(*) as count
FROM "Game"
GROUP BY "eventType"
ORDER BY count DESC;

-- 4. 투표 세션 확인
SELECT 
  id,
  "weekStartDate",
  "isActive",
  "isCompleted",
  "createdAt"
FROM "VoteSession"
ORDER BY id;

-- 5. 투표 데이터 확인
SELECT 
  v.id,
  v."voteSessionId",
  vs."weekStartDate",
  v."selectedDays",
  u.name as user_name
FROM "Vote" v
JOIN "VoteSession" vs ON v."voteSessionId" = vs.id
JOIN "User" u ON v."userId" = u.id
ORDER BY v.id;

