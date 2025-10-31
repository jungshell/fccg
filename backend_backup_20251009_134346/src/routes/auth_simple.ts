import express from 'express';
import * as authController from '../controllers/authController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = express.Router();

// 날짜 형식 변환 함수
const formatDateWithDay = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = dayNames[date.getDay()];
  
  return `${year}. ${month}. ${day}.(${dayName})`;
};

// Health check 엔드포인트
router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Auth service is running',
    timestamp: new Date().toISOString()
  });
});

// 로그인 API
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        error: '이메일과 비밀번호를 입력해주세요.' 
      });
    }

    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // 사용자 조회
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ 
        error: '이메일 또는 비밀번호가 올바르지 않습니다.' 
      });
    }

    // 비밀번호 확인 (bcrypt로 해시 비교)
    const bcrypt = require('bcrypt');
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        error: '이메일 또는 비밀번호가 올바르지 않습니다.' 
      });
    }

    // JWT 토큰 생성 (간단한 예시)
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        name: user.name 
      },
      process.env.JWT_SECRET || 'fc-chalggyeo-secret',
      { expiresIn: '24h' }
    );

    res.json({
      message: '로그인 성공',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('로그인 오류:', error);
    res.status(500).json({ 
      error: '서버 오류가 발생했습니다.' 
    });
  }
});

// 토큰 갱신 API
router.post('/refresh-token', authenticateToken, async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // 현재 사용자 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });

    if (!user) {
      await prisma.$disconnect();
      return res.status(404).json({ 
        error: '사용자를 찾을 수 없습니다.' 
      });
    }

    // 새 JWT 토큰 생성
    const jwt = require('jsonwebtoken');
    const newToken = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        name: user.name,
        role: user.role
      },
      process.env.JWT_SECRET || 'fc-chalggyeo-secret',
      { expiresIn: '24h' }
    );

    console.log('✅ 토큰 갱신 성공:', {
      userId: user.id,
      name: user.name,
      newTokenLength: newToken.length
    });

    res.json({
      message: '토큰 갱신 성공',
      token: newToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('토큰 갱신 오류:', error);
    res.status(500).json({ 
      error: '토큰 갱신 중 오류가 발생했습니다.' 
    });
  }
});

// 비밀번호 변경 API
router.put('/change-password', async (req, res) => {
  try {
    const { newPassword } = req.body;
    
    if (!newPassword) {
      return res.status(400).json({ 
        error: '새 비밀번호를 입력해주세요.' 
      });
    }

    // JWT 토큰에서 사용자 ID 추출
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: '인증 토큰이 필요합니다.' 
      });
    }

    const token = authHeader.substring(7);
    const jwt = require('jsonwebtoken');
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fc-chalggyeo-secret');
      const userId = decoded.userId;

      const { PrismaClient } = require('@prisma/client');
      const bcrypt = require('bcrypt');
      const prisma = new PrismaClient();
      
      // 사용자 조회
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return res.status(404).json({ 
          error: '사용자를 찾을 수 없습니다.' 
        });
      }

      // 새 비밀번호를 해시화하여 업데이트
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword }
      });

      res.json({
        message: '비밀번호가 성공적으로 변경되었습니다.'
      });

      await prisma.$disconnect();
    } catch (jwtError) {
      return res.status(401).json({ 
        error: '유효하지 않은 토큰입니다.' 
      });
    }
  } catch (error) {
    console.error('비밀번호 변경 오류:', error);
    res.status(500).json({ 
      error: '서버 오류가 발생했습니다.' 
    });
  }
});

// 한글 날짜를 영어 요일 코드로 변환하는 함수
const convertKoreanDateToDayCode = (dateStr: string): string => {
  // "10월 13일(월)" 형식을 "MON"으로 변환
  const dayMapping: { [key: string]: string } = {
    '월': 'MON',
    '화': 'TUE', 
    '수': 'WED',
    '목': 'THU',
    '금': 'FRI'
  };
  
  const match = dateStr.match(/\(([월화수목금])\)/);
  if (match) {
    return dayMapping[match[1]] || dateStr;
  }
  
  // 이미 영어 요일 코드인 경우 그대로 반환
  if (['MON', 'TUE', 'WED', 'THU', 'FRI'].includes(dateStr)) {
    return dateStr;
  }
  
  return dateStr;
};

// 투표 생성 API
router.post('/votes', async (req, res) => {
  try {
    const { selectedDays } = req.body;
    
    // selectedDays를 영어 요일 코드로 변환
    const convertedSelectedDays = selectedDays.map((day: string) => convertKoreanDateToDayCode(day));
    console.log('📊 투표 데이터 변환:', { original: selectedDays, converted: convertedSelectedDays });
    
    // JWT 토큰에서 사용자 ID 추출
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: '인증 토큰이 필요합니다.' 
      });
    }

    const token = authHeader.substring(7);
    const jwt = require('jsonwebtoken');
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fc-chalggyeo-secret');
      const userId = decoded.userId;

      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      // 활성 투표 세션 찾기
      const voteSession = await prisma.voteSession.findFirst({
        where: { 
          isActive: true,
          isCompleted: false
        }
      });

      if (!voteSession) {
        await prisma.$disconnect();
        return res.status(404).json({ 
          error: '활성 투표 세션을 찾을 수 없습니다.' 
        });
      }

      // 기존 투표 삭제 (재투표 방지)
      await prisma.vote.deleteMany({
        where: { 
          userId: userId,
          voteSessionId: voteSession.id
        }
      });

      // 새 투표 생성
      const vote = await prisma.vote.create({
        data: {
          userId: userId,
          voteSessionId: voteSession.id,
          selectedDays: JSON.stringify(convertedSelectedDays)
        }
      });

      res.json({
        message: '투표가 성공적으로 저장되었습니다.',
        vote: vote
      });

      await prisma.$disconnect();
    } catch (jwtError) {
      return res.status(401).json({ 
        error: '유효하지 않은 토큰입니다.' 
      });
    }
  } catch (error) {
    console.error('투표 생성 오류:', error);
    res.status(500).json({ 
      error: '서버 오류가 발생했습니다.' 
    });
  }
});

// 투표 삭제 API
router.delete('/votes/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // JWT 토큰에서 사용자 ID 추출
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: '인증 토큰이 필요합니다.' 
      });
    }

    const token = authHeader.substring(7);
    const jwt = require('jsonwebtoken');
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fc-chalggyeo-secret');
      const currentUserId = decoded.userId;

      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      // 현재 사용자의 투표만 삭제 가능하도록 확인
      if (parseInt(userId) !== currentUserId) {
        return res.status(403).json({ 
          error: '자신의 투표만 삭제할 수 있습니다.' 
        });
      }

      // 현재 활성 세션의 투표만 삭제
      const activeSession = await prisma.voteSession.findFirst({
        where: { isActive: true }
      });

      if (!activeSession) {
        return res.status(404).json({ 
          error: '활성 투표 세션이 없습니다.' 
        });
      }

      const deletedVotes = await prisma.vote.deleteMany({
        where: { 
          userId: parseInt(userId),
          voteSessionId: activeSession.id
        }
      });

      res.json({
        message: '투표가 성공적으로 삭제되었습니다.',
        deletedCount: deletedVotes.count
      });

      await prisma.$disconnect();
    } catch (jwtError) {
      return res.status(401).json({ 
        error: '유효하지 않은 토큰입니다.' 
      });
    }
  } catch (error) {
    console.error('투표 삭제 오류:', error);
    res.status(500).json({ 
      error: '서버 오류가 발생했습니다.' 
    });
  }
});

// 투표 리셋 API (전체 투표 데이터 삭제)
router.delete('/votes/reset', async (req, res) => {
  try {
    // JWT 토큰에서 사용자 ID 추출
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: '인증 토큰이 필요합니다.' 
      });
    }

    const token = authHeader.substring(7);
    const jwt = require('jsonwebtoken');
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fc-chalggyeo-secret');
      const userId = decoded.userId;

      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      // 현재 사용자의 모든 투표 삭제
      const deletedVotes = await prisma.vote.deleteMany({
        where: { userId: userId }
      });

      res.json({
        message: '모든 투표 데이터가 삭제되었습니다.',
        deletedCount: deletedVotes.count
      });

      await prisma.$disconnect();
    } catch (jwtError) {
      return res.status(401).json({ 
        error: '유효하지 않은 토큰입니다.' 
      });
    }
  } catch (error) {
    console.error('투표 리셋 오류:', error);
    res.status(500).json({ 
      error: '서버 오류가 발생했습니다.' 
    });
  }
});

// 프로필 조회 API
router.get('/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: '인증 토큰이 필요합니다.' 
      });
    }

    const token = authHeader.substring(7);
    const jwt = require('jsonwebtoken');
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fc-chalggyeo-secret');
      const userId = decoded.userId;

      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          attendance: true
        }
      });

      if (!user) {
        return res.status(404).json({ 
          error: '사용자를 찾을 수 없습니다.' 
        });
      }

      // 투표 참여율 계산
      const voteSessions = await prisma.voteSession.findMany({
        where: { isCompleted: true },
        include: {
          votes: {
            where: { userId: userId }
          }
        }
      });
      
      const totalSessions = voteSessions.length;
      const participatedSessions = voteSessions.filter(session => session.votes.length > 0).length;
      const voteAttendance = totalSessions > 0 ? Math.round((participatedSessions / totalSessions) * 100) : 0;
      
      const userWithStats = {
        ...user,
        voteAttendance: voteAttendance,
        voteDetails: {
          total: totalSessions,
          participated: participatedSessions
        }
      };

      res.json(userWithStats);

      await prisma.$disconnect();
    } catch (jwtError) {
      return res.status(401).json({ 
        error: '유효하지 않은 토큰입니다.' 
      });
    }
  } catch (error) {
    console.error('프로필 조회 오류:', error);
    res.status(500).json({ 
      error: '서버 오류가 발생했습니다.' 
    });
  }
});

// 회원가입 API
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ 
        error: '모든 필드를 입력해주세요.' 
      });
    }

    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // 이메일 중복 확인
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ 
        error: '이미 존재하는 이메일입니다.' 
      });
    }

    // 사용자 생성
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password, // 실제로는 해시화해야 함
        role: 'MEMBER'
      }
    });

    res.status(201).json({
      message: '회원가입 성공',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('회원가입 오류:', error);
    res.status(500).json({ 
      error: '서버 오류가 발생했습니다.' 
    });
  }
});

// ===== 경기 관리 API =====

// 경기 목록 조회 API
router.get('/games', async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // 활성 투표 세션 조회 (현재 주)
    const activeSession = await prisma.voteSession.findFirst({
      where: { isCompleted: false },
      orderBy: { createdAt: 'desc' }
    });

    let whereCondition: any = {};
    
    // 활성 세션이 있으면 자동생성 일정은 해당 주만 표시
    if (activeSession) {
      const weekStart = new Date(activeSession.weekStartDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6); // 주말까지
      
      whereCondition = {
        OR: [
          { autoGenerated: false }, // 수동 생성된 경기는 항상 표시
          {
            AND: [
              { autoGenerated: true },
              { date: { gte: weekStart } },
              { date: { lte: weekEnd } }
            ]
          }
        ]
      };
    } else {
      // 활성 세션이 없으면 자동생성 일정은 표시하지 않음
      whereCondition = { autoGenerated: false };
    }
    
    const games = await prisma.game.findMany({
      where: whereCondition,
      include: {
        attendances: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        },
        createdBy: {
          select: { id: true, name: true }
        }
      },
      orderBy: { date: 'asc' }
    });

    console.log('🔍 경기 목록 필터링:', {
      activeSession: activeSession ? activeSession.weekStartDate : '없음',
      totalGames: games.length,
      autoGenerated: games.filter(g => g.autoGenerated).length
    });

    res.json(games);
    await prisma.$disconnect();
  } catch (error) {
    console.error('경기 목록 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 경기 생성 API
router.post('/games', async (req, res) => {
  try {
    const { date, time, location, gameType, eventType, memberNames, selectedMembers, mercenaryCount } = req.body;
    
    // JWT 토큰에서 사용자 ID 추출
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: '인증 토큰이 필요합니다.' 
      });
    }

    const token = authHeader.substring(7);
    const jwt = require('jsonwebtoken');
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fc-chalggyeo-secret');
      const userId = decoded.userId;

      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      if (!date || !location || !gameType) {
        return res.status(400).json({ error: '날짜, 장소, 경기 유형은 필수입니다.' });
      }

      // 참석자 정보 파싱
      const namesArray = Array.isArray(memberNames) ? memberNames : (memberNames ? JSON.parse(memberNames) : []);
      const selectedArray = Array.isArray(selectedMembers) ? selectedMembers : (selectedMembers ? JSON.parse(selectedMembers) : []);

      console.log('🔍 게임 생성 데이터:', {
        date,
        time,
        location,
        eventType,
        mercenaryCount,
        selectedMembers: selectedArray,
        memberNames: namesArray
      });

      // 날짜 타임존 보정 - 로컬 정오 기준으로 고정
      const gameDate = new Date(date);
      gameDate.setHours(12, 0, 0, 0); // 정오로 설정하여 타임존 오차 방지
      
      const game = await prisma.game.create({
        data: {
          date: gameDate,
          time: time || '미정',
          location: location || '장소 미정',
          gameType: gameType || '미정',
          eventType: eventType || '미정',
          createdById: userId,
          autoGenerated: false,
          confirmed: true,
          mercenaryCount: mercenaryCount || 0,
          memberNames: JSON.stringify(namesArray || []),
          selectedMembers: JSON.stringify(selectedArray || [])
        },
        include: {
          attendances: {
            include: {
              user: {
                select: { id: true, name: true, email: true }
              }
            }
          }
        }
      });

      // 참석자 정보 생성
      const allMembers = [...selectedArray, ...namesArray];
      if (allMembers.length > 0) {
        for (const memberName of allMembers) {
          if (memberName && memberName.trim()) {
            const memberUser = await prisma.user.findFirst({
              where: { name: memberName.trim() }
            });
            if (memberUser) {
              await prisma.attendance.create({
                data: {
                  gameId: game.id,
                  userId: memberUser.id,
                  status: 'YES'
                }
              });
            }
          }
        }
      }

      // 최신 게임 정보 조회 (참석자 정보 포함)
      const updatedGame = await prisma.game.findUnique({
        where: { id: game.id },
        include: {
          attendances: {
            include: {
              user: {
                select: { id: true, name: true, email: true }
              }
            }
          }
        }
      });

      // 자동생성 일정 정리 (같은 주의 다른 자동생성 일정들 삭제)
      if (time && location && eventType && 
          (time !== '미정' && location !== '미정' && eventType !== '미정')) {
        console.log('🎯 새로 생성된 게임이 확정됨 - 자동생성 일정 정리 시작');
        await deleteOtherAutoGeneratedGames(prisma, updatedGame.id, updatedGame.date);
        await sendGameConfirmationNotification(updatedGame);
      }

      res.status(201).json({
        message: '경기가 생성되었습니다.',
        game: updatedGame,
        autoGeneratedGamesDeleted: time && location && eventType && 
          (time !== '미정' && location !== '미정' && eventType !== '미정')
      });

      await prisma.$disconnect();
    } catch (jwtError) {
      return res.status(401).json({ 
        error: '유효하지 않은 토큰입니다.' 
      });
    }
  } catch (error) {
    console.error('경기 생성 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 경기 수정 API
router.put('/games/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { date, time, location, gameType, eventType, memberNames, selectedMembers, mercenaryCount } = req.body;
    const userId = (req as any).user?.userId;

      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      // 기존 게임 정보 조회
      const existingGame = await prisma.game.findUnique({
        where: { id: parseInt(id) },
        include: {
          attendances: {
            include: {
              user: {
                select: { id: true, name: true, email: true }
              }
            }
          }
        }
      });

      if (!existingGame) {
        await prisma.$disconnect();
        return res.status(404).json({ 
          error: '경기를 찾을 수 없습니다.',
          gameId: parseInt(id)
        });
      }

      // 참석자 정보 갱신 (문자열/배열 모두 수용)
      const namesArray = Array.isArray(memberNames) ? memberNames : (memberNames ? JSON.parse(memberNames) : []);
      const selectedArray = Array.isArray(selectedMembers) ? selectedMembers : (selectedMembers ? JSON.parse(selectedMembers) : []);

      // 기존 참석자 제거
      await prisma.attendance.deleteMany({ where: { gameId: parseInt(id) } });

      // 새 참석자 생성 (회원명으로 userId 매핑)
      for (const name of [...selectedArray, ...namesArray]) {
        if (typeof name === 'string' && name.trim()) {
          const user = await prisma.user.findFirst({ where: { name: name.trim() } });
          if (user) {
            await prisma.attendance.create({
              data: { gameId: parseInt(id), userId: user.id, status: 'YES' }
            });
          }
        }
      }

      console.log('🔍 게임 수정 데이터:', {
        gameId: parseInt(id),
        mercenaryCount,
        selectedMembers: selectedArray,
        memberNames: namesArray,
        eventType,
        time,
        location
      });

      // 날짜 타임존 보정 - 로컬 정오 기준으로 고정
      let gameDate = undefined;
      if (date) {
        gameDate = new Date(date);
        gameDate.setHours(12, 0, 0, 0); // 정오로 설정하여 타임존 오차 방지
      }

      const game = await prisma.game.update({
        where: { id: parseInt(id) },
        data: {
          date: gameDate,
          time: time || undefined,
          location: location || undefined,
          gameType: gameType || undefined,
          eventType: eventType || undefined,
          mercenaryCount: mercenaryCount || 0,
          memberNames: JSON.stringify(namesArray || []),
          selectedMembers: JSON.stringify(selectedArray || []),
          autoGenerated: false, // 수정 시 항상 자동생성 플래그 해제
          updatedAt: new Date()
        },
        include: {
          attendances: {
            include: {
              user: {
                select: { id: true, name: true, email: true }
              }
            }
          }
        }
      });

      // 자동생성된 게임이 확정된 경우 처리
      if (existingGame?.autoGenerated && time && location && eventType && 
          (time !== '미정' && location !== '미정' && eventType !== '미정')) {
        
        console.log('🎯 자동생성된 게임이 확정됨 - 처리 시작');
        
        // 같은 주의 다른 자동생성된 게임들 삭제
        await deleteOtherAutoGeneratedGames(prisma, game.id, game.date);
        
        // 게임 확정 알림 발송
        await sendGameConfirmationNotification(game);
      }

      res.json({
        message: '경기가 수정되었습니다.',
        game,
        autoGeneratedGamesDeleted: existingGame?.autoGenerated && time && location && eventType &&
          (time !== '미정' && location !== '미정' && eventType !== '미정')
      });

      await prisma.$disconnect();
  } catch (error) {
    console.error('경기 수정 오류:', error);
    console.error('오류 상세:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ 
      error: '서버 오류가 발생했습니다.',
      details: error.message 
    });
  }
});


// 장소 검색 API
router.get('/search-location', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: '검색어가 필요합니다.' });
    }

    // 카카오맵 API 키 확인
    const kakaoApiKey = process.env.KAKAO_MAP_API_KEY;
    
    if (!kakaoApiKey) {
      console.log('⚠️ 카카오맵 API 키가 설정되지 않음 - 더미 데이터 반환');
      
      // 더미 데이터 반환 (개발용)
      const mockResults = [
        {
          place_name: `매치업풋살파크 천안아산점`,
          address_name: '충청남도 천안시 동남구',
          x: '127.123456',
          y: '36.789012'
        },
        {
          place_name: `풋살장 ${query}`,
          address_name: '서울특별시 강남구',
          x: '127.027619',
          y: '37.497953'
        },
        {
          place_name: `체육관 ${query}`,
          address_name: '서울특별시 서초구',
          x: '127.032668',
          y: '37.500000'
        }
      ];

      return res.json({
        documents: mockResults
      });
    }

    // 실제 카카오맵 API 호출
    const response = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`, {
      headers: {
        'Authorization': `KakaoAK ${kakaoApiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`카카오맵 API 오류: ${response.status}`);
    }

    const data = await response.json();
    
    res.json({
      documents: data.documents || []
    });
    
  } catch (error) {
    console.error('장소 검색 오류:', error);
    
    // 오류 시에도 더미 데이터 반환
    const fallbackResults = [
      {
        place_name: `매치업풋살파크 천안아산점`,
        address_name: '충청남도 천안시 동남구',
        x: '127.123456',
        y: '36.789012'
      },
      {
        place_name: `풋살장 ${req.query.query}`,
        address_name: '서울특별시 강남구',
        x: '127.027619',
        y: '37.497953'
      }
    ];

    res.json({
      documents: fallbackResults
    });
  }
});

// 투표 테스트 엔드포인트
router.get('/votes/test', (req, res) => {
  res.status(200).json({ 
    message: '투표 API 테스트 성공',
    timestamp: new Date().toISOString()
  });
});

// 관리자 투표결과 API
router.get('/admin/vote-sessions/results', async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // 전체 회원 목록 조회
    const allUsers = await prisma.user.findMany({
      select: { id: true, name: true }
    });
    
    // 모든 투표 세션 조회 (최신순)
    const sessions = await prisma.voteSession.findMany({
      orderBy: { weekStartDate: 'desc' },
      include: { 
        votes: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });
    
    // 세션 데이터 가공
    const processedSessions = sessions.map(session => {
      const participantCount = session.votes.length;
      const uniqueParticipants = new Set(session.votes.map(vote => vote.userId)).size;
      
      // 참여자 목록 생성
      const participants = session.votes.map(vote => ({
        userId: vote.userId,
        userName: vote.user.name,
        selectedDays: JSON.parse(vote.selectedDays),
        votedAt: vote.createdAt
      }));
      
      // 미참자 목록 생성
      const participantUserIds = new Set(participants.map(p => p.userId));
      const nonParticipants = allUsers
        .filter(user => !participantUserIds.has(user.id))
        .map(user => user.name);
      
      return {
        id: session.id,
        weekStartDate: session.weekStartDate,
        startTime: session.startTime,
        endTime: session.endTime,
        isActive: session.isActive,
        isCompleted: session.isCompleted,
        participantCount: uniqueParticipants,
        totalVotes: participantCount,
        weekRange: `${formatDateWithDay(session.weekStartDate)} ~ ${formatDateWithDay(new Date(session.weekStartDate.getTime() + 6 * 24 * 60 * 60 * 1000))}`,
        participants: participants,
        nonParticipants: nonParticipants
      };
    });
    
    await prisma.$disconnect();
    
    res.json({ 
      sessions: processedSessions,
      totalSessions: processedSessions.length,
      activeSessions: processedSessions.filter(s => s.isActive).length,
      completedSessions: processedSessions.filter(s => s.isCompleted).length
    });
    
  } catch (error) {
    console.error('투표 세션 요약 조회 오류:', error);
    res.status(500).json({ 
      error: '서버 오류가 발생했습니다.',
      message: error.message 
    });
  }
});

router.get('/votes/results', async (req, res) => {
  try {
    const { sessionId } = req.query;
    
    if (!sessionId) {
      return res.status(400).json({ 
        error: 'sessionId 파라미터가 필요합니다.' 
      });
    }
    
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // 특정 세션의 투표 결과 조회
    const session = await prisma.voteSession.findUnique({
      where: { id: parseInt(sessionId as string) },
      include: {
        votes: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });
    
    if (!session) {
      await prisma.$disconnect();
      return res.status(404).json({ 
        error: '투표 세션을 찾을 수 없습니다.' 
      });
    }
    
    // 요일별 투표 결과 집계
    const dayVotes = {
      MON: { count: 0, participants: [] },
      TUE: { count: 0, participants: [] },
      WED: { count: 0, participants: [] },
      THU: { count: 0, participants: [] },
      FRI: { count: 0, participants: [] }
    };
    
    // 각 투표를 분석하여 요일별 집계
    session.votes.forEach(vote => {
      const selectedDays = JSON.parse(vote.selectedDays);
      selectedDays.forEach((day: string) => {
        // 요일 코드를 직접 사용 (MON, TUE, WED, THU, FRI)
        const dayKey = day;
        
        if (dayKey && dayVotes[dayKey as keyof typeof dayVotes]) {
          dayVotes[dayKey as keyof typeof dayVotes].count++;
          dayVotes[dayKey as keyof typeof dayVotes].participants.push({
            userId: vote.userId,
            userName: vote.user.name,
            votedAt: vote.createdAt
          });
        }
      });
    });
    
    // 전체 참여자 목록
    const allParticipants = session.votes.map(vote => ({
      userId: vote.userId,
      userName: vote.user.name,
      selectedDays: JSON.parse(vote.selectedDays),
      votedAt: vote.createdAt
    }));
    
    await prisma.$disconnect();
    
    res.json({
      sessionId: session.id,
      weekStartDate: session.weekStartDate,
      weekRange: `${formatDateWithDay(session.weekStartDate)} ~ ${formatDateWithDay(new Date(session.weekStartDate.getTime() + 6 * 24 * 60 * 60 * 1000))}`,
      isActive: session.isActive,
      isCompleted: session.isCompleted,
      results: dayVotes,
      participants: allParticipants,
      totalParticipants: allParticipants.length,
      totalVotes: session.votes.length
    });
    
  } catch (error) {
    console.error('투표 결과 조회 오류:', error);
    res.status(500).json({ 
      error: '서버 오류가 발생했습니다.',
      message: error.message 
    });
  }
});

router.get('/votes/unified', async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // 현재 세션 조회 (활성/비활성 모두 포함, 최신 세션 우선)
    const activeSession = await prisma.voteSession.findFirst({
      where: { 
        OR: [
          { isActive: true },
          { isActive: false, isCompleted: false }, // 마감되었지만 완료되지 않은 세션
          { isActive: false, isCompleted: true } // 마감되고 완료된 세션도 포함
        ]
      },
      orderBy: { createdAt: 'desc' }, // 최신 세션 우선
      include: {
        votes: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: { weekStartDate: 'desc' }
    });
    
    // 지난주 완료된 세션 조회 (투표 데이터가 있는 가장 최근 완료된 세션)
    const lastWeekSession = await prisma.voteSession.findFirst({
      where: { 
        isCompleted: true,
        votes: {
          some: {} // 투표 데이터가 있는 세션만
        }
      },
      include: {
        votes: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: { weekStartDate: 'desc' }
    });
    
    // 활성 세션 데이터 가공
    let processedActiveSession = null;
    if (activeSession) {
      const dayVotes = {
        MON: { count: 0, participants: [] },
        TUE: { count: 0, participants: [] },
        WED: { count: 0, participants: [] },
        THU: { count: 0, participants: [] },
        FRI: { count: 0, participants: [] }
      };
      
      activeSession.votes.forEach(vote => {
        const selectedDays = JSON.parse(vote.selectedDays);
        selectedDays.forEach((day: string) => {
          // 요일 코드를 직접 사용 (MON, TUE, WED, THU, FRI)
          const dayKey = day;
          
          if (dayKey && dayVotes[dayKey as keyof typeof dayVotes]) {
            dayVotes[dayKey as keyof typeof dayVotes].count++;
            dayVotes[dayKey as keyof typeof dayVotes].participants.push({
              userId: vote.userId,
              userName: vote.user.name,
              votedAt: vote.createdAt
            });
          }
        });
      });
      
      processedActiveSession = {
        id: activeSession.id,
        weekStartDate: activeSession.weekStartDate,
        startTime: activeSession.startTime,
        endTime: activeSession.endTime,
        weekRange: `${formatDateWithDay(activeSession.weekStartDate)} ~ ${formatDateWithDay(new Date(activeSession.weekStartDate.getTime() + 4 * 24 * 60 * 60 * 1000))}`,
        isActive: activeSession.isActive,
        results: dayVotes,
        participants: activeSession.votes.map(vote => ({
          userId: vote.userId,
          userName: vote.user.name,
          selectedDays: JSON.parse(vote.selectedDays),
          votedAt: vote.createdAt
        })),
        totalParticipants: activeSession.votes.length
      };
    }
    
    // 지난주 세션 데이터 가공
    let processedLastWeekSession = null;
    if (lastWeekSession) {
      const dayVotes = {
        MON: { count: 0, participants: [] },
        TUE: { count: 0, participants: [] },
        WED: { count: 0, participants: [] },
        THU: { count: 0, participants: [] },
        FRI: { count: 0, participants: [] }
      };
      
      lastWeekSession.votes.forEach(vote => {
        const selectedDays = JSON.parse(vote.selectedDays);
        selectedDays.forEach((day: string) => {
          // 요일 코드를 직접 사용 (MON, TUE, WED, THU, FRI)
          const dayKey = day;
          
          if (dayKey && dayVotes[dayKey as keyof typeof dayVotes]) {
            dayVotes[dayKey as keyof typeof dayVotes].count++;
            dayVotes[dayKey as keyof typeof dayVotes].participants.push({
              userId: vote.userId,
              userName: vote.user.name,
              votedAt: vote.createdAt
            });
          }
        });
      });
      
      processedLastWeekSession = {
        sessionId: lastWeekSession.id,
        weekStartDate: lastWeekSession.weekStartDate,
        weekRange: `${formatDateWithDay(lastWeekSession.weekStartDate)} ~ ${formatDateWithDay(new Date(lastWeekSession.weekStartDate.getTime() + 6 * 24 * 60 * 60 * 1000))}`,
        results: dayVotes,
        participants: lastWeekSession.votes.map(vote => ({
          userId: vote.userId,
          userName: vote.user.name,
          selectedDays: JSON.parse(vote.selectedDays),
          votedAt: vote.createdAt
        })),
        totalParticipants: lastWeekSession.votes.length
      };
    }
    
    await prisma.$disconnect();
    
    res.json({
      activeSession: processedActiveSession,
      lastWeekResults: processedLastWeekSession || { sessionId: null, results: {}, participants: {} }
    });
    
  } catch (error) {
    console.error('통합 투표 데이터 조회 오류:', error);
    res.status(500).json({ 
      error: '서버 오류가 발생했습니다.',
      message: error.message 
    });
  }
});

router.post('/votes/aggregate/save', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ 
        error: 'sessionId가 필요합니다.' 
      });
    }
    
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // 세션 존재 확인
    const session = await prisma.voteSession.findUnique({
      where: { id: parseInt(sessionId) }
    });
    
    if (!session) {
      await prisma.$disconnect();
      return res.status(404).json({ 
        error: '투표 세션을 찾을 수 없습니다.' 
      });
    }
    
    // 세션을 완료 상태로 업데이트
    const updatedSession = await prisma.voteSession.update({
      where: { id: parseInt(sessionId) },
      data: { 
        isCompleted: true,
        isActive: false,
        updatedAt: new Date()
      }
    });
    
    // voteData.json 파일에 결과 저장 (기존 로직과 호환)
    const fs = require('fs');
    const path = require('path');
    
    try {
      const voteDataPath = path.join(__dirname, '../../voteData.json');
      let voteData = {};
      
      // 기존 파일이 있으면 읽기
      if (fs.existsSync(voteDataPath)) {
        const fileContent = fs.readFileSync(voteDataPath, 'utf8');
        voteData = JSON.parse(fileContent);
      }
      
      // 새로운 세션 결과 추가
      voteData[`session_${sessionId}`] = {
        sessionId: parseInt(sessionId),
        weekStartDate: session.weekStartDate,
        completedAt: new Date().toISOString(),
        isCompleted: true
      };
      
      // 파일에 저장
      fs.writeFileSync(voteDataPath, JSON.stringify(voteData, null, 2));
      
    } catch (fileError) {
      console.warn('voteData.json 저장 실패:', fileError);
      // 파일 저장 실패해도 DB 업데이트는 성공으로 처리
    }
    
    await prisma.$disconnect();
    
    res.json({ 
      message: '집계 저장 완료', 
      sessionId: parseInt(sessionId),
      completedAt: updatedSession.updatedAt
    });
    
  } catch (error) {
    console.error('투표 결과 집계 저장 오류:', error);
    res.status(500).json({ 
      error: '서버 오류가 발생했습니다.',
      message: error.message 
    });
  }
});

// 경기 삭제 API
router.delete('/games/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const gameId = parseInt(id);
    
    if (isNaN(gameId)) {
      return res.status(400).json({ 
        error: '유효하지 않은 경기 ID입니다.' 
      });
    }

    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // 경기 존재 확인
    const existingGame = await prisma.game.findUnique({
      where: { id: gameId }
    });

    if (!existingGame) {
      await prisma.$disconnect();
      return res.status(404).json({ 
        error: '경기를 찾을 수 없습니다.' 
      });
    }

    // 먼저 관련된 참석자 정보 삭제 (외래키 제약 조건 방지)
    await prisma.attendance.deleteMany({
      where: { gameId: gameId }
    });

    // 경기 삭제
    await prisma.game.delete({
      where: { id: gameId }
    });

    await prisma.$disconnect();
    
    res.status(200).json({ 
      message: '경기가 성공적으로 삭제되었습니다.',
      deletedGameId: gameId
    });
  } catch (error) {
    console.error('경기 삭제 오류:', error);
    res.status(500).json({ 
      error: '경기 삭제 중 오류가 발생했습니다.',
      message: error.message 
    });
  }
});

// 투표 세션 마감 API
router.post('/vote-sessions/:id/close', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const sessionId = parseInt(id);
    
    if (isNaN(sessionId)) {
      return res.status(400).json({ 
        error: '유효하지 않은 세션 ID입니다.' 
      });
    }

    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // 세션 존재 확인
    const existingSession = await prisma.voteSession.findUnique({
      where: { id: sessionId }
    });

    if (!existingSession) {
      await prisma.$disconnect();
      return res.status(404).json({ 
        error: '투표 세션을 찾을 수 없습니다.' 
      });
    }

    // 세션 마감 처리 (현재 시간을 endTime으로 설정 - 순수 UTC로 저장)
    const now = new Date();
    const utcTime = new Date(now.getTime() - (9 * 60 * 60 * 1000)); // 한국 시간에서 9시간 빼서 순수 UTC로 저장
    
    console.log('🔍 투표 마감 처리:', {
      sessionId,
      currentTime: now.toISOString(),
      currentTimeKST: new Date(now.getTime() + (9 * 60 * 60 * 1000)).toISOString(),
      utcTime: utcTime.toISOString()
    });
    
    await prisma.voteSession.update({
      where: { id: sessionId },
      data: { 
        isActive: false,
        isCompleted: true,
        endTime: utcTime // 순수 UTC 시간으로 실제 투표 마감 시간 설정
      }
    });

    await prisma.$disconnect();
    
    res.status(200).json({ 
      message: '투표 세션이 성공적으로 마감되었습니다.',
      sessionId: sessionId
    });
  } catch (error) {
    console.error('투표 세션 마감 오류:', error);
    res.status(500).json({ 
      error: '투표 세션 마감 중 오류가 발생했습니다.',
      message: error.message 
    });
  }
});

// 투표 세션 재개 API
router.post('/vote-sessions/:id/resume', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const sessionId = parseInt(id);
    
    if (isNaN(sessionId)) {
      return res.status(400).json({ 
        error: '유효하지 않은 세션 ID입니다.' 
      });
    }

    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // 세션 존재 확인
    const existingSession = await prisma.voteSession.findUnique({
      where: { id: sessionId }
    });

    if (!existingSession) {
      await prisma.$disconnect();
      return res.status(404).json({ 
        error: '투표 세션을 찾을 수 없습니다.' 
      });
    }

    // 세션 재개 처리 (endTime을 원래 투표 마감일로 복원)
    const originalEndTime = new Date(existingSession.weekStartDate);
    originalEndTime.setDate(originalEndTime.getDate() + 4); // 금요일
    originalEndTime.setHours(17, 0, 0, 0); // 17:00
    
    await prisma.voteSession.update({
      where: { id: sessionId },
      data: { 
        isActive: true,
        isCompleted: false,
        endTime: originalEndTime // 원래 투표 마감일로 복원
      }
    });

    await prisma.$disconnect();
    
    console.log('✅ 투표 세션 재개 성공:', {
      sessionId,
      isActive: true,
      isCompleted: false
    });
    
    res.status(200).json({ 
      message: '투표가 재개되었습니다.',
      sessionId: sessionId
    });
  } catch (error) {
    console.error('투표 세션 재개 오류:', error);
    res.status(500).json({ 
      error: '투표 세션 재개 중 오류가 발생했습니다.',
      message: error.message 
    });
  }
});

// 통합 투표 데이터 API - 모든 페이지에서 사용
router.get('/unified-vote-data', async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    // 1. 현재 세션 조회 (활성/비활성 모두 포함, 최신 세션 우선)
    const activeSession = await prisma.voteSession.findFirst({
      where: { 
        OR: [
          { isActive: true },
          { isActive: false, isCompleted: false }, // 마감되었지만 완료되지 않은 세션
          { isActive: false, isCompleted: true } // 마감되고 완료된 세션도 포함
        ]
      },
      orderBy: { createdAt: 'desc' }, // 최신 세션 우선
      include: {
        votes: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: { id: 'desc' }
    });

    // 2. 모든 세션 조회 (관리자 페이지용)
    const allSessions = await prisma.voteSession.findMany({
      include: {
        votes: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: { id: 'desc' }
    });

    // 3. 전체 회원 조회
    const allMembers = await prisma.user.findMany({
      where: { 
        role: { in: ['MEMBER', 'ADMIN', 'SUPER_ADMIN'] },
        status: { in: ['ACTIVE', 'SUSPENDED'] }
      },
      select: { id: true, name: true, status: true }
    });

    // 4. 활성 세션 데이터 가공
    let processedActiveSession = null;
    if (activeSession) {
      const participants = activeSession.votes.map(vote => ({
        userId: vote.userId,
        userName: vote.user.name,
        selectedDays: vote.selectedDays,
        votedAt: vote.createdAt
      }));

      // 요일별 투표 결과 계산
      const results = {
        MON: { count: 0, participants: [] },
        TUE: { count: 0, participants: [] },
        WED: { count: 0, participants: [] },
        THU: { count: 0, participants: [] },
        FRI: { count: 0, participants: [] }
      };

      participants.forEach(participant => {
        let selectedDaysArray = participant.selectedDays;
        
        // selectedDays가 문자열인 경우 JSON 파싱
        if (typeof selectedDaysArray === 'string') {
          try {
            selectedDaysArray = JSON.parse(selectedDaysArray);
          } catch (e) {
            console.error('selectedDays 파싱 오류:', e);
            selectedDaysArray = [];
          }
        }
        
        if (selectedDaysArray && Array.isArray(selectedDaysArray)) {
          selectedDaysArray.forEach(day => {
            // 한국어 날짜 형식을 영어 요일로 변환
            let dayKey = day;
            if (day.includes('월)')) dayKey = 'MON';
            else if (day.includes('화)')) dayKey = 'TUE';
            else if (day.includes('수)')) dayKey = 'WED';
            else if (day.includes('목)')) dayKey = 'THU';
            else if (day.includes('금)')) dayKey = 'FRI';
            
            console.log('🔍 투표 데이터 처리:', { day, dayKey, participant: participant.userName });
            
            if (results[dayKey]) {
              results[dayKey].count++;
              results[dayKey].participants.push({
                userId: participant.userId,
                userName: participant.userName,
                votedAt: participant.votedAt
              });
            }
          });
        }
      });

      processedActiveSession = {
        sessionId: activeSession.id,
        weekStartDate: activeSession.weekStartDate,
        startTime: activeSession.startTime,
        endTime: activeSession.endTime,
        isActive: activeSession.isActive,
        isCompleted: activeSession.isCompleted,
        participants,
        results,
        totalParticipants: participants.length,
        totalVotes: participants.reduce((sum, p) => sum + p.selectedDays.length, 0)
      };
    }

    // 5. 모든 세션 데이터 가공 (관리자 페이지용)
    const processedSessions = allSessions.map(session => {
      const participants = session.votes.map(vote => ({
        userId: vote.userId,
        userName: vote.user.name,
        selectedDays: vote.selectedDays,
        votedAt: vote.createdAt
      }));

      const nonParticipants = allMembers
        .filter(member => !participants.some(p => p.userId === member.id))
        .map(member => member.name);

      return {
        id: session.id,
        weekStartDate: session.weekStartDate,
        startTime: session.startTime,
        endTime: session.endTime,
        isActive: session.isActive,
        isCompleted: session.isCompleted,
        participants,
        nonParticipants,
        participantCount: participants.length,
        totalVotes: participants.reduce((sum, p) => sum + p.selectedDays.length, 0)
      };
    });

    // 6. 통계 계산
    const stats = {
      totalSessions: allSessions.length,
      completedSessions: allSessions.filter(s => s.isCompleted).length,
      activeSessions: allSessions.filter(s => s.isActive).length,
      totalParticipants: allSessions.reduce((sum, s) => sum + s.votes.length, 0)
    };

    const response = {
      activeSession: processedActiveSession,
      allSessions: processedSessions,
      allMembers,
      stats,
      lastUpdated: new Date().toISOString()
    };

    console.log('통합 투표 데이터 조회 완료:', {
      activeSession: processedActiveSession ? '있음' : '없음',
      totalSessions: allSessions.length,
      totalMembers: allMembers.length
    });

    res.json(response);
    await prisma.$disconnect();
  } catch (error) {
    console.error('통합 투표 데이터 조회 오류:', error);
    res.status(500).json({ 
      error: '서버 오류가 발생했습니다.',
      message: error.message 
    });
  }
});

// 주간 투표 세션 자동 생성 API
router.post('/start-weekly-vote', async (req, res) => {
  try {
    // 다음주 월요일 날짜 계산
    const now = new Date();
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + (8 - now.getDay()) % 7);
    nextMonday.setHours(0, 1, 0, 0); // 월요일 00:01

    // 투표 종료일을 다음주 목요일로 설정
    const endTime = new Date(nextMonday);
    endTime.setDate(nextMonday.getDate() + 3); // 목요일
    endTime.setHours(17, 0, 0, 0); // 17:00

    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const voteSession = await prisma.voteSession.create({
      data: {
        weekStartDate: nextMonday,
        startTime: nextMonday,
        endTime,
        isActive: true,
        isCompleted: false
      }
    });

    console.log('주간 투표 세션이 생성되었습니다:', voteSession.id);
    
    res.json({ 
      message: '새로운 주간 투표 세션이 생성되었습니다.',
      voteSessionId: voteSession.id,
      weekStartDate: nextMonday,
      endTime
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('주간 투표 세션 생성 오류:', error);
    res.status(500).json({ 
      error: '서버 오류가 발생했습니다.',
      message: error.message 
    });
  }
});

// 자동 투표 세션 생성 스케줄러 (매주 월요일 00:01) - 수정: 무한 루프 방지
const scheduleWeeklyVoteSession = () => {
  const now = new Date();
  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9 (한국시간)
  
  // 다음 월요일 00:01 계산
  const nextMonday = new Date(koreaTime);
  const daysUntilMonday = (8 - koreaTime.getDay()) % 7; // 월요일까지 남은 일수
  nextMonday.setDate(koreaTime.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 1, 0, 0); // 00:01
  
  const timeUntilNextMonday = nextMonday.getTime() - koreaTime.getTime();
  
  console.log('🗓️ 다음 월요일 자동 투표 세션 생성 예약:', nextMonday.toLocaleString('ko-KR'));
  
  setTimeout(async () => {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      // 기존 활성 세션이 있는지 확인
      const existingSession = await prisma.voteSession.findFirst({
        where: {
          isActive: true,
          isCompleted: false
        }
      });
      
      if (existingSession) {
        console.log('⚠️ 이미 활성 투표 세션이 존재합니다:', existingSession.id);
        await prisma.$disconnect();
        return;
      }
      
      // 다음주 월요일 날짜 계산 (한국시간 기준)
      const nextWeekMonday = new Date(nextMonday);
      nextWeekMonday.setDate(nextMonday.getDate() + 7);

      // 의견수렴기간 시작일을 이번주 월요일 00:01로 설정
      const thisWeekMonday = new Date(nextMonday);
      thisWeekMonday.setDate(nextMonday.getDate() - 7);
      thisWeekMonday.setHours(0, 1, 0, 0); // 00:01

      // 투표 종료일을 다음주 목요일 17:00으로 설정
      const endTime = new Date(nextWeekMonday);
      endTime.setDate(nextWeekMonday.getDate() + 3); // 목요일
      endTime.setHours(17, 0, 0, 0); // 17:00

      const voteSession = await prisma.voteSession.create({
        data: {
          weekStartDate: nextWeekMonday,
          startTime: thisWeekMonday, // 이번주 월요일 00:01
          endTime,
          isActive: true,
          isCompleted: false
        }
      });
      
      console.log('✅ 자동 투표 세션 생성 완료:', voteSession.id, '다음주:', nextWeekMonday.toLocaleDateString('ko-KR'));
      
      await prisma.$disconnect();
      
    } catch (error) {
      console.error('❌ 자동 투표 세션 생성 실패:', error);
    }
  }, timeUntilNextMonday);
  
  // 다음 주기 예약 (7일 후) - setTimeout 밖으로 이동
  setTimeout(() => {
    scheduleWeeklyVoteSession();
  }, 7 * 24 * 60 * 60 * 1000); // 7일 후
};

// 회원 수정 API
router.put('/members/:id', authenticateToken, async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    const memberId = parseInt(req.params.id);
    const { name, email, role, status } = req.body;
    
    if (isNaN(memberId)) {
      return res.status(400).json({
        success: false,
        message: '유효하지 않은 회원 ID입니다.'
      });
    }

    const updatedMember = await prisma.user.update({
      where: { id: memberId },
      data: {
        name,
        email,
        role,
        status
      }
    });

    res.json({
      success: true,
      message: '회원 정보가 성공적으로 수정되었습니다.',
      member: updatedMember
    });
  } catch (error) {
    console.error('회원 수정 오류:', error);
    res.status(500).json({
      success: false,
      message: '회원 정보 수정 중 오류가 발생했습니다.'
    });
  }
});

// 비밀번호 변경 API
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const bcrypt = require('bcrypt');
    
    const { newPassword } = req.body;
    const userId = req.user.userId;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: '비밀번호는 6자 이상이어야 합니다.'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.json({
      success: true,
      message: '비밀번호가 성공적으로 변경되었습니다.'
    });
  } catch (error) {
    console.error('비밀번호 변경 오류:', error);
    res.status(500).json({
      success: false,
      message: '비밀번호 변경 중 오류가 발생했습니다.'
    });
  }
});

// 통합 투표 데이터 API
router.get('/votes/unified', async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // 활성 투표 세션 조회
    const activeSession = await prisma.voteSession.findFirst({
      where: { isActive: true },
      include: {
        votes: {
          include: {
            voteSession: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // 지난 주 완료된 세션 조회
    const lastWeekSession = await prisma.voteSession.findFirst({
      where: { 
        isCompleted: true,
        votes: {
          some: {} // 투표 데이터가 있는 세션만
        }
      },
      include: {
        votes: {
          include: {
            voteSession: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // 모든 세션 조회
    const allSessions = await prisma.voteSession.findMany({
      include: {
        votes: {
          include: {
            voteSession: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // 활성 세션 데이터 처리
    let activeSessionData = null;
    if (activeSession) {
      const dayVotes = {
        MON: { count: 0, participants: [] },
        TUE: { count: 0, participants: [] },
        WED: { count: 0, participants: [] },
        THU: { count: 0, participants: [] },
        FRI: { count: 0, participants: [] }
      };
      
      activeSession.votes.forEach(vote => {
        const selectedDays = JSON.parse(vote.selectedDays);
        selectedDays.forEach((day: string) => {
          const dayKey = day;
          if (dayKey && dayVotes[dayKey as keyof typeof dayVotes]) {
            dayVotes[dayKey as keyof typeof dayVotes].count++;
            dayVotes[dayKey as keyof typeof dayVotes].participants.push(vote.userId);
          }
        });
      });
      
      activeSessionData = {
        sessionId: activeSession.id,
        weekStartDate: activeSession.weekStartDate,
        startTime: activeSession.startTime,
        endTime: activeSession.endTime,
        isActive: activeSession.isActive,
        isCompleted: activeSession.isCompleted,
        totalParticipants: activeSession.votes.length,
        results: dayVotes,
        votes: activeSession.votes
      };
    }
    
    // 지난 주 세션 데이터 처리
    let lastWeekResults = null;
    if (lastWeekSession) {
      const dayVotes = {
        MON: { count: 0, participants: [] },
        TUE: { count: 0, participants: [] },
        WED: { count: 0, participants: [] },
        THU: { count: 0, participants: [] },
        FRI: { count: 0, participants: [] }
      };
      
      lastWeekSession.votes.forEach(vote => {
        const selectedDays = JSON.parse(vote.selectedDays);
        selectedDays.forEach((day: string) => {
          const dayKey = day;
          if (dayKey && dayVotes[dayKey as keyof typeof dayVotes]) {
            dayVotes[dayKey as keyof typeof dayVotes].count++;
            dayVotes[dayKey as keyof typeof dayVotes].participants.push(vote.userId);
          }
        });
      });
      
      lastWeekResults = {
        sessionId: lastWeekSession.id,
        weekStartDate: lastWeekSession.weekStartDate,
        startTime: lastWeekSession.startTime,
        endTime: lastWeekSession.endTime,
        isActive: lastWeekSession.isActive,
        isCompleted: lastWeekSession.isCompleted,
        totalParticipants: lastWeekSession.votes.length,
        results: dayVotes
      };
    }
    
    res.json({
      success: true,
      activeSession: activeSessionData,
      lastWeekResults: lastWeekResults,
      allSessions: allSessions.map(session => ({
        id: session.id,
        weekStartDate: session.weekStartDate,
        startTime: session.startTime,
        endTime: session.endTime,
        isActive: session.isActive,
        isCompleted: session.isCompleted,
        voteCount: session.votes.length,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
      }))
    });
  } catch (error) {
    console.error('통합 투표 데이터 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '통합 투표 데이터 조회 중 오류가 발생했습니다.'
    });
  }
});

// 투표 세션 요약 API
router.get('/votes/sessions/summary', async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    const sessions = await prisma.voteSession.findMany({
      include: {
        votes: {
          include: {
            voteSession: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(s => s.isCompleted).length;
    const activeSessions = sessions.filter(s => s.isActive).length;
    const totalParticipants = sessions.reduce((sum, session) => {
      return sum + session.votes.length;
    }, 0);
    
    res.json({
      success: true,
      data: {
        totalSessions,
        completedSessions,
        activeSessions,
        totalParticipants,
        sessions: sessions.map(session => ({
          id: session.id,
          weekStartDate: session.weekStartDate,
          startTime: session.startTime,
          endTime: session.endTime,
          isActive: session.isActive,
          isCompleted: session.isCompleted,
          voteCount: session.votes.length,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt
        }))
      }
    });
  } catch (error) {
    console.error('투표 세션 요약 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '투표 세션 요약 조회 중 오류가 발생했습니다.'
    });
  }
});

// 회원 삭제 API
router.delete('/members/:id', async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    const memberId = parseInt(req.params.id);
    
    if (isNaN(memberId)) {
      return res.status(400).json({
        success: false,
        message: '유효하지 않은 회원 ID입니다.'
      });
    }

    // 회원 존재 여부 확인
    const member = await prisma.user.findUnique({
      where: { id: memberId }
    });

    if (!member) {
      await prisma.$disconnect();
      return res.status(404).json({
        success: false,
        message: '해당 회원을 찾을 수 없습니다.'
      });
    }

    // 회원 삭제
    await prisma.user.delete({
      where: { id: memberId }
    });

    await prisma.$disconnect();

    res.json({
      success: true,
      message: '회원이 성공적으로 삭제되었습니다.'
    });
  } catch (error) {
    console.error('회원 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '회원 삭제 중 오류가 발생했습니다.',
      error: error.message
    });
  }
});

// 게임 확정 알림 발송 함수
async function sendGameConfirmationNotification(game) {
  try {
    console.log('📧 게임 확정 알림 발송 시작:', {
      gameId: game.id,
      date: game.date,
      time: game.time,
      location: game.location,
      eventType: game.eventType
    });

    // 날짜 포맷팅
    const gameDate = new Date(game.date);
    const year = gameDate.getFullYear();
    const month = String(gameDate.getMonth() + 1).padStart(2, '0');
    const day = String(gameDate.getDate()).padStart(2, '0');
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[gameDate.getDay()];
    
    const formattedDate = `${year}.${month}.${day}.(${weekday})`;
    
    // 알림 메시지 생성
    const notificationMessage = `🏆 경기 일정이 확정되었습니다!\n\n📅 날짜: ${formattedDate}\n⏰ 시간: ${game.time}\n📍 장소: ${game.location}\n⚽ 유형: ${game.eventType}\n\n참석 가능하신 분들은 확인해주세요!`;
    
    // 이메일 알림 발송
    await sendEmailNotification(game.attendances, notificationMessage, formattedDate);
    
    // 푸시 알림 발송 (향후 구현)
    // await sendPushNotification(game.attendances, notificationMessage);
    
    console.log('✅ 게임 확정 알림 발송 완료');
    
  } catch (error) {
    console.error('❌ 게임 확정 알림 발송 실패:', error);
  }
}

// 이메일 알림 발송 함수
async function sendEmailNotification(attendances, message, gameDate) {
  try {
    // Gmail 환경변수 확인
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.log('⚠️ Gmail 환경변수가 설정되지 않음 - 이메일 발송 건너뜀');
      console.log('📧 이메일 알림 내용 (콘솔 출력):');
      console.log('='.repeat(50));
      console.log(`제목: 🏆 FC CHAL-GGYEO 경기 일정 확정 - ${gameDate}`);
      console.log('내용:');
      console.log(message);
      console.log('='.repeat(50));
      return;
    }

    const nodemailer = require('nodemailer');
    
    // Gmail 설정
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    // 참석자들에게 이메일 발송
    for (const attendance of attendances) {
      if (attendance.user.email) {
        const mailOptions = {
          from: process.env.GMAIL_USER,
          to: attendance.user.email,
          subject: `🏆 FC CHAL-GGYEO 경기 일정 확정 - ${gameDate}`,
          text: message,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #3182CE;">🏆 FC CHAL-GGYEO</h2>
              <h3 style="color: #2D3748;">경기 일정이 확정되었습니다!</h3>
              <div style="background-color: #F7FAFC; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 10px 0;"><strong>📅 날짜:</strong> ${gameDate}</p>
                <p style="margin: 10px 0;"><strong>⏰ 시간:</strong> ${message.match(/시간: ([^\n]+)/)?.[1] || '미정'}</p>
                <p style="margin: 10px 0;"><strong>📍 장소:</strong> ${message.match(/장소: ([^\n]+)/)?.[1] || '미정'}</p>
                <p style="margin: 10px 0;"><strong>⚽ 유형:</strong> ${message.match(/유형: ([^\n]+)/)?.[1] || '미정'}</p>
              </div>
              <p style="color: #4A5568;">참석 가능하신 분들은 확인해주세요!</p>
              <hr style="margin: 20px 0; border: none; border-top: 1px solid #E2E8F0;">
              <p style="font-size: 12px; color: #718096;">FC CHAL-GGYEO 축구팀 관리 시스템</p>
            </div>
          `
        };

        await transporter.sendMail(mailOptions);
        console.log(`📧 이메일 발송 완료: ${attendance.user.email}`);
      }
    }
    
  } catch (error) {
    console.error('❌ 이메일 발송 실패:', error);
    console.log('📧 이메일 알림 내용 (오류 시 콘솔 출력):');
    console.log('='.repeat(50));
    console.log(`제목: 🏆 FC CHAL-GGYEO 경기 일정 확정 - ${gameDate}`);
    console.log('내용:');
    console.log(message);
    console.log('='.repeat(50));
  }
}

// 같은 주의 다른 자동생성된 게임들 삭제 함수
async function deleteOtherAutoGeneratedGames(prisma, confirmedGameId, confirmedGameDate) {
  try {
    
    // 확정된 게임의 주간 범위 계산 (월요일~일요일)
    const gameDate = new Date(confirmedGameDate);
    const dayOfWeek = gameDate.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const weekStart = new Date(gameDate);
    weekStart.setDate(gameDate.getDate() + daysToMonday);
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    console.log('🗑️ 같은 주의 다른 자동생성된 게임들 삭제:', {
      confirmedGameId,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString()
    });
    
    // 같은 주의 다른 자동생성된 게임들 조회
    const otherAutoGames = await prisma.game.findMany({
      where: {
        id: { not: confirmedGameId },
        autoGenerated: true,
        date: {
          gte: weekStart,
          lte: weekEnd
        }
      }
    });
    
    console.log(`🔍 삭제할 게임들: ${otherAutoGames.length}개`);
    
    // 다른 자동생성된 게임들 삭제 (참석자 정보도 함께 삭제)
    for (const game of otherAutoGames) {
      // 먼저 참석자 정보 삭제
      await prisma.attendance.deleteMany({
        where: { gameId: game.id }
      });
      
      // 게임 삭제
      await prisma.game.delete({
        where: { id: game.id }
      });
      console.log(`🗑️ 게임 삭제 완료: ${game.id} (${game.date})`);
    }
    
    console.log('✅ 같은 주의 다른 자동생성된 게임들 삭제 완료');
    
  } catch (error) {
    console.error('❌ 다른 자동생성된 게임들 삭제 실패:', error);
    console.error('삭제 오류 상세:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
  }
}

// 서버 시작 시 스케줄러 시작
scheduleWeeklyVoteSession();

export default router;
