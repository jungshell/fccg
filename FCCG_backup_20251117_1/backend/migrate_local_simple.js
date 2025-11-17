// 간단한 SQLite 데이터 마이그레이션 스크립트
// SQLite를 직접 읽어서 Neon PostgreSQL로 마이그레이션

const sqlite3 = require('sqlite3').verbose();
const { PrismaClient } = require('@prisma/client');
const path = require('path');

// SQLite DB 경로
const sqliteDbPath = path.join(__dirname, 'dev.db');

// Neon PostgreSQL 클라이언트
const neonPrisma = new PrismaClient();

// DATABASE_URL 확인
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('neon')) {
  console.error('❌ Neon PostgreSQL DATABASE_URL이 설정되지 않았습니다.');
  process.exit(1);
}

async function migrateFromSQLite() {
  return new Promise((resolve, reject) => {
    console.log('🔄 SQLite 데이터 읽기 시작...');
    
    const db = new sqlite3.Database(sqliteDbPath, (err) => {
      if (err) {
        console.error('❌ SQLite DB 열기 실패:', err);
        reject(err);
        return;
      }
      console.log('✅ SQLite DB 연결 성공');
    });
    
    // User 데이터 마이그레이션
    db.all('SELECT * FROM User', async (err, users) => {
      if (err) {
        console.error('❌ User 데이터 읽기 실패:', err);
        db.close();
        reject(err);
        return;
      }
      
      console.log(`📝 ${users.length}명의 사용자 데이터 발견`);
      
      for (const user of users) {
        try {
          await neonPrisma.user.upsert({
            where: { email: user.email },
            update: {
              name: user.name,
              password: user.password,
              role: user.role,
              status: user.status,
              attendance: user.attendance,
              phone: user.phone,
              avatarUrl: user.avatarUrl,
              address: user.address
            },
            create: {
              id: user.id,
              email: user.email,
              name: user.name,
              password: user.password,
              role: user.role,
              status: user.status,
              attendance: user.attendance,
              phone: user.phone,
              avatarUrl: user.avatarUrl,
              address: user.address,
              createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
              updatedAt: user.updatedAt ? new Date(user.updatedAt) : new Date()
            }
          });
          console.log(`✅ User upserted: ${user.email}`);
        } catch (error) {
          console.error(`❌ User 마이그레이션 실패 (${user.email}):`, error.message);
        }
      }
      
      // VoteSession 데이터 마이그레이션
      db.all('SELECT * FROM VoteSession', async (err, sessions) => {
        if (err) {
          console.error('❌ VoteSession 데이터 읽기 실패:', err);
        } else {
          console.log(`📝 ${sessions.length}개의 투표 세션 데이터 발견`);
          
          for (const session of sessions) {
            try {
              await neonPrisma.voteSession.upsert({
                where: { id: session.id },
                update: {
                  weekStartDate: new Date(session.weekStartDate),
                  startTime: new Date(session.startTime),
                  endTime: new Date(session.endTime),
                  isActive: session.isActive === 1,
                  isCompleted: session.isCompleted === 1
                },
                create: {
                  id: session.id,
                  weekStartDate: new Date(session.weekStartDate),
                  startTime: new Date(session.startTime),
                  endTime: new Date(session.endTime),
                  isActive: session.isActive === 1,
                  isCompleted: session.isCompleted === 1,
                  createdAt: session.createdAt ? new Date(session.createdAt) : new Date(),
                  updatedAt: session.updatedAt ? new Date(session.updatedAt) : new Date()
                }
              });
              console.log(`✅ VoteSession upserted: ${session.id}`);
            } catch (error) {
              console.error(`❌ VoteSession 마이그레이션 실패 (${session.id}):`, error.message);
            }
          }
        }
        
        // Vote 데이터 마이그레이션
        db.all('SELECT * FROM Vote', async (err, votes) => {
          if (err) {
            console.error('❌ Vote 데이터 읽기 실패:', err);
          } else {
            console.log(`📝 ${votes.length}개의 투표 데이터 발견`);
            
            for (const vote of votes) {
              try {
                await neonPrisma.vote.upsert({
                  where: { id: vote.id },
                  update: {
                    userId: vote.userId,
                    voteSessionId: vote.voteSessionId,
                    selectedDays: vote.selectedDays
                  },
                  create: {
                    id: vote.id,
                    userId: vote.userId,
                    voteSessionId: vote.voteSessionId,
                    selectedDays: vote.selectedDays,
                    createdAt: vote.createdAt ? new Date(vote.createdAt) : new Date(),
                    updatedAt: vote.updatedAt ? new Date(vote.updatedAt) : new Date()
                  }
                });
                console.log(`✅ Vote upserted: ${vote.id}`);
              } catch (error) {
                console.error(`❌ Vote 마이그레이션 실패 (${vote.id}):`, error.message);
              }
            }
          }
          
          // Game 데이터 마이그레이션
          db.all('SELECT * FROM Game', async (err, games) => {
            if (err) {
              console.error('❌ Game 데이터 읽기 실패:', err);
            } else {
              console.log(`📝 ${games.length}개의 경기 데이터 발견`);
              
              for (const game of games) {
                try {
                  // eventType 정규화
                  let eventType = game.eventType || '자체';
                  if (['풋살', 'FRIENDLY', 'FRIENDLY_MATCH'].includes(eventType)) eventType = '매치';
                  else if (!['매치', '자체', '회식', '기타'].includes(eventType)) eventType = '기타';
                  
                  await neonPrisma.game.upsert({
                    where: { id: game.id },
                    update: {
                      date: new Date(game.date),
                      time: game.time,
                      location: game.location,
                      gameType: game.gameType,
                      eventType: eventType,
                      mercenaryCount: game.mercenaryCount || 0,
                      memberNames: game.memberNames,
                      selectedMembers: game.selectedMembers,
                      autoGenerated: game.autoGenerated === 1,
                      confirmed: game.confirmed === 1,
                      createdById: game.createdById || 1
                    },
                    create: {
                      id: game.id,
                      date: new Date(game.date),
                      time: game.time,
                      location: game.location,
                      gameType: game.gameType,
                      eventType: eventType,
                      mercenaryCount: game.mercenaryCount || 0,
                      memberNames: game.memberNames,
                      selectedMembers: game.selectedMembers,
                      autoGenerated: game.autoGenerated === 1,
                      confirmed: game.confirmed === 1,
                      createdById: game.createdById || 1,
                      createdAt: game.createdAt ? new Date(game.createdAt) : new Date(),
                      updatedAt: game.updatedAt ? new Date(game.updatedAt) : new Date()
                    }
                  });
                  console.log(`✅ Game upserted: ${game.id} (EventType: ${eventType})`);
                } catch (error) {
                  console.error(`❌ Game 마이그레이션 실패 (${game.id}):`, error.message);
                }
              }
            }
            
            // Gallery 데이터 마이그레이션
            db.all('SELECT * FROM Gallery', async (err, galleryItems) => {
              if (err) {
                console.error('❌ Gallery 데이터 읽기 실패:', err);
              } else {
                console.log(`📝 ${galleryItems.length}개의 갤러리 데이터 발견`);
                
                for (const item of galleryItems) {
                  try {
                    // eventType 정규화
                    let eventType = item.eventType || '기타';
                    if (['풋살', 'FRIENDLY'].includes(eventType)) eventType = '매치';
                    else if (!['매치', '자체', '회식', '기타'].includes(eventType)) eventType = '기타';
                    
                    await neonPrisma.gallery.upsert({
                      where: { id: item.id },
                      update: {
                        title: item.title,
                        description: item.description,
                        imageUrl: item.imageUrl,
                        videoUrl: item.videoUrl,
                        uploaderId: item.uploaderId,
                        eventDate: item.eventDate ? new Date(item.eventDate) : null,
                        eventType: eventType,
                        likesCount: item.likesCount || 0,
                        commentsCount: item.commentsCount || 0,
                        tags: item.tags,
                        location: item.location
                      },
                      create: {
                        id: item.id,
                        title: item.title,
                        description: item.description,
                        imageUrl: item.imageUrl,
                        videoUrl: item.videoUrl,
                        uploaderId: item.uploaderId,
                        eventDate: item.eventDate ? new Date(item.eventDate) : null,
                        eventType: eventType,
                        likesCount: item.likesCount || 0,
                        commentsCount: item.commentsCount || 0,
                        tags: item.tags,
                        location: item.location,
                        createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
                        updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date()
                      }
                    });
                    console.log(`✅ Gallery upserted: ${item.id} (EventType: ${eventType})`);
                  } catch (error) {
                    console.error(`❌ Gallery 마이그레이션 실패 (${item.id}):`, error.message);
                  }
                }
              }
              
              // 완료
              db.close((err) => {
                if (err) {
                  console.error('❌ SQLite DB 닫기 실패:', err);
                } else {
                  console.log('✅ SQLite DB 닫기 완료');
                }
              });
              
              await neonPrisma.$disconnect();
              console.log('🎉 모든 데이터 마이그레이션 완료!');
              resolve();
            });
          });
        });
      });
    });
  });
}

// 실행
migrateFromSQLite().catch((error) => {
  console.error('❌ 마이그레이션 실패:', error);
  process.exit(1);
});

