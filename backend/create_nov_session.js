// 11월 3-7일 세션 생성 스크립트
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createNovemberSession() {
  try {
    // 11월 3일 월요일 (2025-11-03 00:00:00 UTC → 2025-11-03 09:00:00 KST)
    const weekStartDate = new Date('2025-11-03T00:00:00.000Z');
    
    // 의견수렴기간 시작: 10월 27일 월요일 00:01 (한국시간)
    const startTime = new Date('2025-10-27T00:00:00.000Z');
    
    // 투표 마감일: 11월 7일 금요일 17:00 (한국시간)
    const endTime = new Date('2025-11-07T08:00:00.000Z'); // UTC로 변환 (한국시간 -9시간)
    
    // 기존 세션 확인
    const existing = await prisma.voteSession.findFirst({
      where: {
        weekStartDate: {
          gte: new Date(weekStartDate.getTime() - 7 * 24 * 60 * 60 * 1000),
          lte: new Date(weekStartDate.getTime() + 7 * 24 * 60 * 60 * 1000)
        }
      }
    });
    
    if (existing) {
      console.log('⚠️ 이미 11월 3일 주간 세션이 존재합니다:', existing.id);
      await prisma.$disconnect();
      return;
    }
    
    // 활성 세션 확인
    const activeSession = await prisma.voteSession.findFirst({
      where: { isActive: true }
    });
    
    if (activeSession) {
      console.log('⚠️ 이미 활성 세션이 존재합니다:', activeSession.id);
      // 기존 활성 세션 비활성화
      await prisma.voteSession.update({
        where: { id: activeSession.id },
        data: { isActive: false, isCompleted: true }
      });
      console.log('✅ 기존 활성 세션 비활성화:', activeSession.id);
    }
    
    // 다음 세션 ID 찾기
    const lastSession = await prisma.voteSession.findFirst({
      orderBy: { id: 'desc' }
    });
    const nextSessionId = (lastSession?.id || 0) + 1;
    
    // 새 세션 생성
    const session = await prisma.voteSession.create({
      data: {
        id: nextSessionId,
        weekStartDate: weekStartDate,
        startTime: startTime,
        endTime: endTime,
        isActive: true,
        isCompleted: false
      }
    });
    
    console.log('✅ 11월 3-7일 세션 생성 완료:', {
      id: session.id,
      weekStartDate: session.weekStartDate,
      isActive: session.isActive
    });
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ 세션 생성 실패:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

createNovemberSession();

