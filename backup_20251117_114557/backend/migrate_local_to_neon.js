// 로컬 DB 데이터를 Neon PostgreSQL로 마이그레이션하는 스크립트
// 사용법: node backend/migrate_local_to_neon.js

const { PrismaClient } = require('@prisma/client');

// 로컬 SQLite DB에서 데이터 읽기
const localPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./dev.db'
    }
  }
});

// Neon PostgreSQL DB에 데이터 쓰기
const neonPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL // Neon PostgreSQL URL
    }
  }
});

/**
 * eventType 정규화 함수
 */
function normalizeEventType(eventType) {
  if (!eventType || eventType.trim() === '') {
    return '자체';
  }
  
  const normalized = eventType.trim();
  
  if (['매치', '자체', '회식', '기타'].includes(normalized)) {
    return normalized;
  }
  
  if (['풋살', 'FRIENDLY', 'FRIENDLY_MATCH', 'friendly', '풋살장', 'MATCH'].includes(normalized)) {
    return '매치';
  }
  
  if (['SELF', 'self', '자체훈련'].includes(normalized)) {
    return '자체';
  }
  
  if (['DINNER', 'dinner', '회식모임'].includes(normalized)) {
    return '회식';
  }
  
  return '기타';
}

function normalizeGameType(gameType, eventType) {
  const normalizedEventType = normalizeEventType(eventType);
  
  if (normalizedEventType === '매치') {
    return 'MATCH';
  } else if (normalizedEventType === '회식' || normalizedEventType === '기타') {
    return 'OTHER';
  } else {
    return 'SELF';
  }
}

async function migrateData() {
  try {
    console.log('🔄 데이터 마이그레이션 시작...\n');
    
    // 1. 사용자 데이터 마이그레이션
    console.log('📝 1단계: 사용자 데이터 마이그레이션');
    const localUsers = await localPrisma.user.findMany();
    console.log(`  - 로컬 사용자: ${localUsers.length}명`);
    
    for (const user of localUsers) {
      try {
        await neonPrisma.user.upsert({
          where: { email: user.email },
          update: {
            name: user.name,
            role: user.role,
            status: user.status,
            attendance: user.attendance,
          },
          create: {
            id: user.id,
            email: user.email,
            password: user.password,
            name: user.name,
            role: user.role,
            status: user.status,
            attendance: user.attendance,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          }
        });
      } catch (error) {
        console.error(`  ❌ 사용자 ${user.email} 마이그레이션 실패:`, error.message);
      }
    }
    console.log('  ✅ 사용자 데이터 마이그레이션 완료\n');
    
    // 2. 투표 세션 데이터 마이그레이션
    console.log('📝 2단계: 투표 세션 데이터 마이그레이션');
    const localSessions = await localPrisma.voteSession.findMany({
      orderBy: { id: 'asc' }
    });
    console.log(`  - 로컬 투표 세션: ${localSessions.length}개`);
    
    for (const session of localSessions) {
      try {
        await neonPrisma.voteSession.upsert({
          where: { id: session.id },
          update: {
            weekStartDate: session.weekStartDate,
            startTime: session.startTime,
            endTime: session.endTime,
            isActive: session.isActive,
            isCompleted: session.isCompleted,
          },
          create: {
            id: session.id,
            weekStartDate: session.weekStartDate,
            startTime: session.startTime,
            endTime: session.endTime,
            isActive: session.isActive,
            isCompleted: session.isCompleted,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
          }
        });
      } catch (error) {
        console.error(`  ❌ 투표 세션 #${session.id} 마이그레이션 실패:`, error.message);
      }
    }
    console.log('  ✅ 투표 세션 데이터 마이그레이션 완료\n');
    
    // 3. 투표 데이터 마이그레이션
    console.log('📝 3단계: 투표 데이터 마이그레이션');
    const localVotes = await localPrisma.vote.findMany({
      orderBy: { id: 'asc' }
    });
    console.log(`  - 로컬 투표: ${localVotes.length}개`);
    
    for (const vote of localVotes) {
      try {
        await neonPrisma.vote.upsert({
          where: { id: vote.id },
          update: {
            selectedDays: vote.selectedDays,
          },
          create: {
            id: vote.id,
            userId: vote.userId,
            voteSessionId: vote.voteSessionId,
            selectedDays: vote.selectedDays,
            createdAt: vote.createdAt,
            updatedAt: vote.updatedAt,
          }
        });
      } catch (error) {
        console.error(`  ❌ 투표 #${vote.id} 마이그레이션 실패:`, error.message);
      }
    }
    console.log('  ✅ 투표 데이터 마이그레이션 완료\n');
    
    // 4. 경기 데이터 마이그레이션 (정규화 포함)
    console.log('📝 4단계: 경기 데이터 마이그레이션 (정규화 포함)');
    const localGames = await localPrisma.game.findMany({
      orderBy: { id: 'asc' }
    });
    console.log(`  - 로컬 경기: ${localGames.length}개`);
    
    let normalizedCount = 0;
    for (const game of localGames) {
      const normalizedEventType = normalizeEventType(game.eventType);
      const normalizedGameType = normalizeGameType(game.gameType, game.eventType);
      
      if (game.eventType !== normalizedEventType || game.gameType !== normalizedGameType) {
        normalizedCount++;
        console.log(`  🔄 경기 #${game.id}: "${game.eventType}" → "${normalizedEventType}"`);
      }
      
      try {
        await neonPrisma.game.upsert({
          where: { id: game.id },
          update: {
            date: game.date,
            time: game.time,
            location: game.location,
            gameType: normalizedGameType,
            eventType: normalizedEventType,
            memberNames: game.memberNames,
            selectedMembers: game.selectedMembers,
            mercenaryCount: game.mercenaryCount,
            autoGenerated: game.autoGenerated,
            confirmed: game.confirmed,
          },
          create: {
            id: game.id,
            date: game.date,
            time: game.time,
            location: game.location,
            gameType: normalizedGameType,
            eventType: normalizedEventType,
            memberNames: game.memberNames,
            selectedMembers: game.selectedMembers,
            mercenaryCount: game.mercenaryCount,
            autoGenerated: game.autoGenerated,
            confirmed: game.confirmed,
            createdById: game.createdById,
            createdAt: game.createdAt,
            updatedAt: game.updatedAt,
          }
        });
      } catch (error) {
        console.error(`  ❌ 경기 #${game.id} 마이그레이션 실패:`, error.message);
      }
    }
    console.log(`  ✅ 경기 데이터 마이그레이션 완료 (${normalizedCount}개 정규화됨)\n`);
    
    // 5. 갤러리 데이터 마이그레이션
    console.log('📝 5단계: 갤러리 데이터 마이그레이션');
    const localGalleryItems = await localPrisma.gallery.findMany({
      orderBy: { id: 'asc' }
    });
    console.log(`  - 로컬 갤러리 아이템: ${localGalleryItems.length}개`);
    
    for (const item of localGalleryItems) {
      try {
        await neonPrisma.gallery.upsert({
          where: { id: item.id },
          update: {
            title: item.title,
            description: item.description,
            imageUrl: item.imageUrl,
            eventDate: item.eventDate,
            eventType: normalizeEventType(item.eventType),
          },
          create: {
            id: item.id,
            title: item.title,
            description: item.description,
            imageUrl: item.imageUrl,
            eventDate: item.eventDate,
            eventType: normalizeEventType(item.eventType),
            uploaderId: item.uploaderId,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          }
        });
      } catch (error) {
        console.error(`  ❌ 갤러리 아이템 #${item.id} 마이그레이션 실패:`, error.message);
      }
    }
    console.log('  ✅ 갤러리 데이터 마이그레이션 완료\n');
    
    console.log('✅ 전체 데이터 마이그레이션 완료!');
    
  } catch (error) {
    console.error('❌ 마이그레이션 오류:', error);
  } finally {
    await localPrisma.$disconnect();
    await neonPrisma.$disconnect();
  }
}

// DATABASE_URL 환경변수 확인
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('neon')) {
  console.error('❌ Neon PostgreSQL DATABASE_URL이 설정되지 않았습니다.');
  console.error('   .env 파일에 DATABASE_URL을 설정하거나 환경변수로 전달하세요.');
  process.exit(1);
}

migrateData();

