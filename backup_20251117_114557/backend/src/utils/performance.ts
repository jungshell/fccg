/**
 * 성능 최적화 유틸리티
 * 기존 기능에 영향 없이 성능만 개선
 */

/**
 * 배치 쿼리로 N+1 문제 해결
 * 여러 사용자 ID로 한 번에 조회
 */
export async function batchFetchUsers(prisma: any, userIds: number[]) {
  if (userIds.length === 0) return [];
  
  const users = await prisma.user.findMany({
    where: {
      id: { in: userIds }
    },
    select: {
      id: true,
      name: true,
      email: true
    }
  });
  
  // Map으로 변환하여 빠른 조회
  const userMap = new Map(users.map(u => [u.id, u]));
  return userMap;
}

/**
 * 페이지네이션 헬퍼
 */
export function getPaginationParams(page?: string, limit?: string) {
  const pageNum = Math.max(1, parseInt(page || '1', 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit || '20', 10))); // 최대 100개
  const skip = (pageNum - 1) * limitNum;
  
  return {
    page: pageNum,
    limit: limitNum,
    skip
  };
}

