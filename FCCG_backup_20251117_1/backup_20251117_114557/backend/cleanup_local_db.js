// 로컬 DB 비규격 값 정리 스크립트
// node backend/cleanup_local_db.js

const { PrismaClient } = require('@prisma/client');

// 로컬 SQLite DB 사용
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./dev.db'
    }
  }
});

async function cleanupLocalDB() {
  try {
    console.log('🔄 로컬 DB 비규격 값 정리 시작...');
    
    // 1. 경기 유형(eventType) 정규화
    const games = await prisma.game.findMany();
    console.log(`📊 전체 경기 수: ${games.length}개`);
    
    let updatedCount = 0;
    for (const game of games) {
      let newEventType = game.eventType;
      let shouldUpdate = false;
      
      // 비규격 값 정규화
      if (!game.eventType || game.eventType === '') {
        newEventType = '자체';
        shouldUpdate = true;
      } else if (['풋살', 'FRIENDLY', 'FRIENDLY_MATCH', 'friendly', '풋살장'].includes(game.eventType)) {
        newEventType = '매치';
        shouldUpdate = true;
      } else if (['SELF', 'self', '자체훈련'].includes(game.eventType)) {
        newEventType = '자체';
        shouldUpdate = true;
      } else if (['DINNER', 'dinner', '회식모임'].includes(game.eventType)) {
        newEventType = '회식';
        shouldUpdate = true;
      } else if (!['매치', '자체', '회식', '기타'].includes(game.eventType)) {
        newEventType = '기타';
        shouldUpdate = true;
      }
      
      // gameType도 함께 정규화
      let newGameType = game.gameType;
      if (newEventType === '매치') {
        newGameType = 'MATCH';
        shouldUpdate = true;
      } else if (newEventType === '회식' || newEventType === '기타') {
        newGameType = 'OTHER';
        shouldUpdate = true;
      } else if (newEventType === '자체' && game.gameType !== 'SELF') {
        newGameType = 'SELF';
        shouldUpdate = true;
      }
      
      if (shouldUpdate) {
        await prisma.game.update({
          where: { id: game.id },
          data: {
            eventType: newEventType,
            gameType: newGameType
          }
        });
        updatedCount++;
        console.log(`✅ 경기 #${game.id}: "${game.eventType}" → "${newEventType}"`);
      }
    }
    
    console.log(`\n✅ 총 ${updatedCount}개 경기의 eventType 정규화 완료`);
    
    // 2. 정규화 결과 확인
    const eventTypeStats = await prisma.game.groupBy({
      by: ['eventType'],
      _count: true
    });
    
    console.log('\n📊 정규화 후 경기 유형 통계:');
    eventTypeStats.forEach(stat => {
      console.log(`  - ${stat.eventType}: ${stat._count}개`);
    });
    
    console.log('\n✅ 로컬 DB 정리 완료!');
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupLocalDB();

