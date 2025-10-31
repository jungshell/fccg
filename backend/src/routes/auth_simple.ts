import express from 'express';
import { authenticateToken } from '../middlewares/authMiddleware';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 공통 에러 핸들링 함수
const handleError = (error: any, res: any, operation: string) => {
  console.error(`❌ ${operation} 오류:`, error);
  
  // 데이터베이스 연결 오류
  if (error.code === 'P2002') {
    return res.status(409).json({
      success: false,
      error: '데이터 중복 오류가 발생했습니다.',
      message: '이미 존재하는 데이터입니다.'
    });
  }
  
  // 데이터베이스 연결 오류
  if (error.code === 'P1001') {
    return res.status(503).json({
      success: false,
      error: '데이터베이스 연결 오류',
      message: '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
    });
  }
  
  // 일반적인 서버 오류
  return res.status(500).json({
    success: false,
    error: `${operation} 중 오류가 발생했습니다.`,
    message: process.env.NODE_ENV === 'development' ? error.message : '서버에 일시적인 문제가 발생했습니다.'
  });
};

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

// Gmail OAuth 콜백 엔드포인트
router.get('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).send('Authorization code not found');
    }

    // 액세스 토큰과 리프레시 토큰 교환
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GMAIL_CLIENT_ID || '',
        client_secret: process.env.GMAIL_CLIENT_SECRET || '',
        code: code as string,
        grant_type: 'authorization_code',
        redirect_uri: 'http://localhost:4000/auth/google/callback',
      }),
    });

    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      console.error('Token exchange error:', tokenData);
      return res.status(400).send(`Token exchange failed: ${tokenData.error_description}`);
    }

    console.log('✅ Gmail OAuth 인증 성공');
    console.log('Refresh Token:', tokenData.refresh_token);
    
    // 성공 페이지 반환
    res.send(`
      <html>
        <head>
          <title>Gmail API 연결 성공</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .success { color: #4CAF50; font-size: 24px; margin-bottom: 20px; }
            .token { background: #f5f5f5; padding: 10px; margin: 20px 0; word-break: break-all; }
          </style>
        </head>
        <body>
          <div class="success">✅ Gmail API 연결 성공!</div>
          <p>이 창을 닫고 관리자 페이지로 돌아가세요.</p>
          <div class="token">
            <strong>새로운 Refresh Token:</strong><br>
            ${tokenData.refresh_token}
          </div>
          <p><small>이 토큰을 gmail.ts 파일에 업데이트해주세요.</small></p>
          <script>
            setTimeout(() => {
              window.close();
            }, 5000);
          </script>
        </body>
      </html>
    `);
    
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('OAuth callback failed');
  }
});

// 토큰 검증 API
router.get('/verify-token', authenticateToken, (req, res) => {
  res.json({ 
    success: true, 
    message: '토큰이 유효합니다.',
    user: req.user 
  });
});

// 저장된 투표 결과 조회 API
router.get('/saved-vote-results/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    const session = await prisma.voteSession.findUnique({
      where: { id: parseInt(sessionId) },
      include: {
        votes: {
          include: {
            user: true
          }
        }
      }
    });
    
    if (!session) {
      return res.status(404).json({ 
        error: '투표 세션을 찾을 수 없습니다.' 
      });
    }
    
    res.json({
      success: true,
      data: {
        session,
        voteResults: session.votes
      }
    });
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('저장된 투표 결과 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
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


// 회원 추가 API (관리자용)
router.post('/members', async (req, res) => {
  try {
    const { name, email, password, role, status } = req.body;
    
    console.log('회원 추가 요청:', { name, email, role, status });
    
    // 필수 필드 검증
    if (!name || !name.trim()) {
      return res.status(400).json({ error: '이름을 입력해주세요.' });
    }
    
    if (!email || !email.trim()) {
      return res.status(400).json({ error: '이메일 주소를 입력해주세요.' });
    }
    
    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: '올바른 이메일 형식을 입력해주세요.' });
    }

      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
    // 이메일 중복 확인
    const existingUser = await prisma.user.findFirst({
      where: { email }
    });
    
    if (existingUser) {
      await prisma.$disconnect();
      return res.status(400).json({ error: '이미 존재하는 이메일입니다.' });
    }
    
    // 비밀번호 해시화
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password || 'password123', 10);
    
    // 새 회원 생성
    const newMember = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'MEMBER',
        status: status || 'ACTIVE'
      }
    });
    
    await prisma.$disconnect();
    
    console.log('생성된 회원:', newMember);
    
    res.json({
      message: '회원이 성공적으로 추가되었습니다.',
      member: {
        id: newMember.id,
        name: newMember.name,
        email: newMember.email,
        role: newMember.role,
        status: newMember.status,
        createdAt: newMember.createdAt
      }
    });
  } catch (error) {
    console.error('회원 추가 오류:', error);
    res.status(500).json({ error: '회원 추가 중 오류가 발생했습니다.' });
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
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    console.log('🔍 활성 세션 확인:', {
      hasActiveSession: !!activeSession,
      activeSessionId: activeSession?.id,
      activeSessionIsActive: activeSession?.isActive,
      activeSessionWeekStart: activeSession?.weekStartDate
    });

    let whereCondition: any = {};
    
    // 활성 세션이 있으면 자동생성 일정은 표시하지 않음 (투표가 진행 중이므로)
    if (activeSession && activeSession.isActive) {
      console.log('📊 활성 세션 있음 - 자동생성일정 숨김');
      whereCondition = { autoGenerated: false };
    } else {
      console.log('📊 활성 세션 없음 - 자동생성일정 표시');
      // 활성 세션이 없으면 (투표가 마감된 상태) 자동생성 일정도 표시
      // 최근 마감된 세션의 주간에 해당하는 자동생성 게임들을 표시
      const allCompletedSessions = await prisma.voteSession.findMany({
        where: { isCompleted: true },
        orderBy: { id: 'desc' }
      });
      
      // weekStartDate 기준으로 최신 세션 찾기
      const lastCompletedSession = allCompletedSessions
        .sort((a, b) => new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime())[0];
      
      console.log('🔍 마지막 완료된 세션:', {
        hasLastCompletedSession: !!lastCompletedSession,
        lastCompletedSessionId: lastCompletedSession?.id,
        lastCompletedSessionWeekStart: lastCompletedSession?.weekStartDate
      });
      
      if (lastCompletedSession) {
        const weekStart = new Date(lastCompletedSession.weekStartDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6); // 주말까지
        
        console.log('📅 자동생성일정 필터링 범위:', {
          weekStart: weekStart.toLocaleDateString(),
          weekEnd: weekEnd.toLocaleDateString()
        });
      
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
        // 마감된 세션이 없으면 수동 생성된 경기만 표시
        console.log('📊 마감된 세션 없음 - 수동생성일정만 표시');
      whereCondition = { autoGenerated: false };
      }
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
    const { date, time, location, gameType, eventType, memberNames, selectedMembers, mercenaryCount, autoGenerated } = req.body;
    
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
          autoGenerated: autoGenerated || false,
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
        // 경기 생성 시에는 알림 발송하지 않음 (수정 시에만 발송)
        console.log('📧 경기 생성 시 알림 발송 건너뜀 (수정 시에만 발송)');
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

    // 1) 해당 주차의 기존 자동생성일정 정리 후
    const sessionWithWeek = await prisma.voteSession.findUnique({ where: { id: sessionId } });
    if (sessionWithWeek) {
      const weekStart = new Date(sessionWithWeek.weekStartDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const deleted = await prisma.game.deleteMany({
        where: {
          autoGenerated: true,
          date: { gte: weekStart, lte: weekEnd }
        }
      });
      console.log('🧹 자동생성일정 정리:', deleted.count, '개 삭제');

      // 2) 최신 투표 결과로 재생성
      const votes = await prisma.vote.findMany({ 
        where: { voteSessionId: sessionId },
        include: { user: { select: { name: true } } }
      });
      type DayKey = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
      const counts: Record<DayKey, number> = { MON: 0, TUE: 0, WED: 0, THU: 0, FRI: 0, SAT: 0, SUN: 0 };
      const participantsByDay: Record<DayKey, string[]> = { MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: [] };

      for (const v of votes) {
        try {
          const selected: string[] = v.selectedDays ? JSON.parse(v.selectedDays as unknown as string) : [];
          selected.forEach((d) => {
            const key = d as DayKey;
            if (counts[key] !== undefined) {
              counts[key] += 1;
              const participantName = (v as any).user?.name;
              if (participantName && !participantsByDay[key].includes(participantName)) {
                participantsByDay[key].push(participantName);
              }
            }
          });
        } catch (e) {
          console.warn('⚠️ 투표 파싱 오류:', e);
        }
      }

      const max = Math.max(...Object.values(counts));
      console.log('📊 득표 집계:', counts, '최다득표:', max);

      if (max > 0) {
        const topDays = (Object.keys(counts) as DayKey[]).filter((k) => counts[k] === max);
        const dayOffset: Record<DayKey, number> = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5, SUN: 6 };
        const creatorId = votes[0]?.userId ?? 1; // 첫 투표자나 기본 관리자 ID로 설정

        for (const day of topDays) {
          const date = new Date(weekStart);
          date.setDate(weekStart.getDate() + dayOffset[day]);
          // 00:01로 설정 (표준화)
          date.setHours(0, 1, 0, 0);

          await prisma.game.create({
            data: {
              date,
              time: '미정',
              location: '미정',
              eventType: '미정',
              gameType: '미정',
              mercenaryCount: 0,
              memberNames: '[]',
              selectedMembers: JSON.stringify(participantsByDay[day] || []),
              autoGenerated: true,
              confirmed: false,
              createdById: creatorId
            }
          });
          console.log('✅ 자동생성일정 생성:', day, date.toISOString());
        }
      } else {
        console.log('ℹ️ 득표가 없어 자동생성일정 생성 생략');
      }
    }

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

// 중복 투표 세션 정리 API (관리자용)
router.post('/cleanup-duplicate-sessions', authenticateToken, async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // 같은 주간을 대상으로 하는 세션들을 찾기
    const sessions = await prisma.voteSession.findMany({
      orderBy: { id: 'desc' }
    });
    
    // 주간별로 그룹화
    const sessionsByWeek = new Map();
    
    for (const session of sessions) {
      const weekStart = new Date(session.weekStartDate);
      const weekKey = `${weekStart.getFullYear()}-${weekStart.getMonth()}-${weekStart.getDate()}`;
      
      if (!sessionsByWeek.has(weekKey)) {
        sessionsByWeek.set(weekKey, []);
      }
      sessionsByWeek.get(weekKey).push(session);
    }
    
    let deletedCount = 0;
    let keptSessions = [];
    
    // 각 주간별로 가장 최신 세션만 남기고 나머지 삭제
    for (const [weekKey, weekSessions] of sessionsByWeek) {
      if (weekSessions.length > 1) {
        // ID 기준으로 정렬하여 가장 최신 세션 찾기
        weekSessions.sort((a, b) => b.id - a.id);
        const keepSession = weekSessions[0];
        const deleteSessions = weekSessions.slice(1);
        
        // 삭제할 세션들의 관련 투표 데이터도 함께 삭제
        for (const session of deleteSessions) {
          await prisma.vote.deleteMany({
            where: { voteSessionId: session.id }
          });
          
          await prisma.voteSession.delete({
            where: { id: session.id }
          });
          
          deletedCount++;
        }
        
        keptSessions.push(keepSession);
      } else {
        keptSessions.push(weekSessions[0]);
      }
    }
    
    // 세션 ID를 연속적으로 재정렬
    keptSessions.sort((a, b) => new Date(a.weekStartDate).getTime() - new Date(b.weekStartDate).getTime());
    
    for (let i = 0; i < keptSessions.length; i++) {
      const newId = i + 1;
      if (keptSessions[i].id !== newId) {
        await prisma.voteSession.update({
          where: { id: keptSessions[i].id },
          data: { id: newId }
        });
      }
    }
    
    await prisma.$disconnect();
    
    res.status(200).json({
      message: '중복 세션 정리가 완료되었습니다.',
      deletedCount,
      keptSessions: keptSessions.length
    });
  } catch (error) {
    console.error('중복 세션 정리 오류:', error);
    res.status(500).json({
      error: '중복 세션 정리 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

// 투표 세션 삭제 API
router.delete('/vote-sessions/:id', authenticateToken, async (req, res) => {
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

    // 관련된 투표 데이터도 함께 삭제
    await prisma.vote.deleteMany({
      where: { voteSessionId: sessionId }
    });

    // 세션 삭제
    await prisma.voteSession.delete({
      where: { id: sessionId }
    });

    await prisma.$disconnect();
    
    res.status(200).json({ 
      message: '투표 세션이 성공적으로 삭제되었습니다.',
      sessionId: sessionId
    });
  } catch (error) {
    console.error('투표 세션 삭제 오류:', error);
    res.status(500).json({ 
      error: '투표 세션 삭제 중 오류가 발생했습니다.',
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

    // 재개 시 해당 주차 자동생성일정은 제거 (투표 중에는 노출/존재하지 않도록 정리)
    const weekStart = new Date(existingSession.weekStartDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const deleted = await prisma.game.deleteMany({
      where: {
        autoGenerated: true,
        date: { gte: weekStart, lte: weekEnd }
      }
    });
    console.log('🧹 재개 시 자동생성일정 삭제:', deleted.count, '개');

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
    // 다음주 월요일 날짜 계산 (동적으로 계산)
    const now = new Date();
    const nextMonday = new Date(now);
    
    // 현재 요일이 일요일(0)이면 다음 월요일로, 아니면 다음주 월요일로
    if (now.getDay() === 0) {
      nextMonday.setDate(now.getDate() + 1); // 일요일이면 다음날(월요일)
    } else {
      nextMonday.setDate(now.getDate() + (8 - now.getDay()) % 7); // 다른 요일이면 다음주 월요일
    }
    nextMonday.setHours(0, 1, 0, 0); // 월요일 00:01

    // 투표 종료일을 금요일로 설정 (월-금)
    const endTime = new Date(nextMonday);
    endTime.setDate(nextMonday.getDate() + 4); // 금요일
    endTime.setHours(17, 0, 0, 0); // 17:00

    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    // 중복 체크: 같은 주간을 대상으로 하는 세션이 있는지 확인
    const existingSession = await prisma.voteSession.findFirst({
      where: {
        weekStartDate: {
          gte: new Date(nextMonday.getTime() - 7 * 24 * 60 * 60 * 1000), // 7일 전
          lte: new Date(nextMonday.getTime() + 7 * 24 * 60 * 60 * 1000)  // 7일 후
        }
      }
    });

    if (existingSession) {
      await prisma.$disconnect();
      return res.status(400).json({
        error: '이미 해당 주간을 대상으로 하는 투표 세션이 존재합니다.',
        existingSessionId: existingSession.id,
        existingWeekStartDate: existingSession.weekStartDate
      });
    }
    
    // 활성 세션이 있는지 확인
    const activeSession = await prisma.voteSession.findFirst({
      where: {
        isActive: true,
        isCompleted: false
      }
    });
    
    if (activeSession) {
      await prisma.$disconnect();
      return res.status(400).json({
        error: '이미 활성 투표 세션이 존재합니다. 기존 세션을 마감한 후 새 세션을 생성해주세요.',
        activeSessionId: activeSession.id
      });
    }

    // 다음 세션 번호 계산 (연속적인 번호 보장)
    const lastSession = await prisma.voteSession.findFirst({
      orderBy: { id: 'desc' }
    });
    const nextSessionId = (lastSession?.id || 0) + 1;

    const voteSession = await prisma.voteSession.create({
      data: {
        id: nextSessionId,
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
  
  // 자동 세션 생성 스케줄러 활성화
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
      
      // 같은 주간을 대상으로 하는 세션이 있는지 확인
      const existingWeekSession = await prisma.voteSession.findFirst({
        where: {
          weekStartDate: {
            gte: new Date(nextWeekMonday.getTime() - 7 * 24 * 60 * 60 * 1000), // 7일 전
            lte: new Date(nextWeekMonday.getTime() + 7 * 24 * 60 * 60 * 1000)  // 7일 후
          }
        }
      });
      
      if (existingWeekSession) {
        console.log('⚠️ 해당 주간을 대상으로 하는 세션이 이미 존재합니다:', existingWeekSession.id);
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

      // 투표 종료일을 다음주 금요일 17:00으로 설정 (월-금)
      const endTime = new Date(nextWeekMonday);
      endTime.setDate(nextWeekMonday.getDate() + 4); // 금요일
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
  
  // 다음 주기 예약 (7일 후)
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

// 프로필 업데이트 API
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    const { name } = req.body;
    const userId = req.user.userId;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: '이름은 필수입니다.'
      });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { name: name.trim() },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true
      }
    });

    res.json({
      success: true,
      message: '프로필이 성공적으로 업데이트되었습니다.',
      user
    });
  } catch (error) {
    console.error('프로필 업데이트 오류:', error);
    res.status(500).json({
      success: false,
      message: '프로필 업데이트 중 오류가 발생했습니다.'
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
    
    // 전체 회원 목록 조회
    const allUsers = await prisma.user.findMany({
      select: { id: true, name: true }
    });
    
    const sessions = await prisma.voteSession.findMany({
      include: {
        votes: {
          include: {
            user: true,
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
        sessions: sessions.map(session => {
          // 참여자 목록 생성
          const participants = session.votes.map(vote => ({
            userId: vote.userId,
            userName: vote.user?.name || '알 수 없음',
            selectedDays: JSON.parse(vote.selectedDays || '[]'),
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
          voteCount: session.votes.length,
            participantCount: participants.length,
            participantNames: participants.map(p => p.userName),
            participants: participants,
            nonParticipants: nonParticipants,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt
          };
        })
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
router.delete('/members/:id', authenticateToken, async (req, res) => {
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

    // 외래키 제약 조건을 위해 관련 데이터 먼저 삭제
    try {
      await prisma.attendance.deleteMany({ where: { userId: memberId } });
      console.log('✅ Attendance 데이터 삭제 완료');
      await prisma.vote.deleteMany({ where: { userId: memberId } });
      console.log('✅ Vote 데이터 삭제 완료');
      await prisma.game.deleteMany({ where: { createdById: memberId } });
      console.log('✅ Game 데이터 삭제 완료');
      await prisma.schedule.deleteMany({ where: { createdById: memberId } });
      console.log('✅ Schedule 데이터 삭제 완료');
      await prisma.gallery.deleteMany({ where: { uploaderId: memberId } });
      console.log('✅ Gallery 데이터 삭제 완료');
      await prisma.like.deleteMany({ where: { userId: memberId } });
      console.log('✅ Like 데이터 삭제 완료');
      await prisma.comment.deleteMany({ where: { userId: memberId } });
      console.log('✅ Comment 데이터 삭제 완료');
      await prisma.notice.deleteMany({ where: { authorId: memberId } });
      console.log('✅ Notice 데이터 삭제 완료');
    } catch (foreignKeyError) {
      console.log('⚠️ 외래키 관련 데이터 삭제 중 오류 (무시하고 계속):', foreignKeyError.message);
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
    const notificationMessage = `🏆 일정이 확정되었습니다!\n\n📅 날짜: ${formattedDate}\n⏰ 시간: ${game.time}\n📍 장소: ${game.location}\n⚽ 유형: ${game.eventType}\n\n참석 가능하신 분들은 확인해주세요!`;
    
    // 이메일 알림 발송
    await sendEmailNotification(game.attendances, notificationMessage, formattedDate, game);
    
    // 푸시 알림 발송 (향후 구현)
    // await sendPushNotification(game.attendances, notificationMessage);
    
    console.log('✅ 게임 확정 알림 발송 완료');
    
  } catch (error) {
    console.error('❌ 게임 확정 알림 발송 실패:', error);
  }
}

// 이메일 템플릿 생성 함수
        function createGameConfirmationEmail(data) {
          const totalMembers = data.participants.length;
          const manualMembersCount = data.manualMembers ? data.manualMembers.length : 0;
          const totalCount = totalMembers + manualMembersCount + (data.mercenaryCount || 0);
  
  return `
    <style>
      .email-container {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        max-width: 600px;
        margin: 0 auto;
        background-color: #ffffff;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      }
      .header {
        background: linear-gradient(135deg, #3182CE 0%, #2B6CB0 100%);
        color: white;
        padding: 40px 30px;
        text-align: center;
        position: relative;
      }
      .header h1 {
        margin: 0;
        font-size: 24px;
        font-weight: bold;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
      }
      .header p {
        margin: 8px 0 0 0;
        opacity: 0.9;
        font-size: 14px;
      }
      .content {
        padding: 30px 25px;
      }
      .main-title {
        color: #2D3748;
        margin-bottom: 25px;
        font-size: 24px;
        font-weight: bold;
        text-align: center;
      }
      .info-section {
        background-color: #ffffff;
        border: 2px solid #E2E8F0;
        border-radius: 12px;
        padding: 30px;
        margin: 25px 0;
      }
      .info-item {
        margin: 15px 0;
        display: flex;
        align-items: center;
        font-size: 16px;
        padding: 6px 0;
      }
      .info-item .icon {
        font-size: 18px;
        margin-right: 12px;
        min-width: 24px;
      }
      .info-item .label {
        font-weight: bold;
        color: #2D3748;
        margin-right: 8px;
        min-width: 60px;
      }
      .info-item .value {
        color: #4A5568;
        font-size: 16px;
      }
      .info-item .location-container {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .kakao-map-btn {
        background-color: #FEE500;
        color: #3C1E1E;
        border: none;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 12px;
        font-weight: bold;
        cursor: pointer;
        text-decoration: none;
        display: inline-block;
      }
      .participants-section {
        background-color: #F7FAFC;
        border: 2px solid #E2E8F0;
        border-radius: 12px;
        padding: 30px;
        margin: 25px 0;
      }
      .participants-header {
        display: flex;
        align-items: center;
        margin-bottom: 15px;
        font-size: 18px;
        font-weight: bold;
        color: #2D3748;
      }
      .participants-header .icon {
        font-size: 20px;
        margin-right: 10px;
      }
      .participant-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }
      .participant-tag {
        padding: 8px 12px;
        border-radius: 16px;
        font-size: 14px;
        font-weight: 500;
        margin: 3px;
      }
      .participant-tag.member {
        background-color: #3182CE;
        color: white;
      }
      .participant-tag.mercenary {
        background-color: #2D3748;
        color: white;
      }
      .participant-tag.other {
        background-color: #ED8936;
        color: white;
      }
      .footer {
        background-color: #F7FAFC;
        padding: 30px;
        text-align: center;
        border-top: 2px solid #E2E8F0;
      }
      .footer p {
        margin: 5px 0;
        font-size: 14px;
        color: #718096;
      }
      .instruction-text {
        color: #4A5568;
        margin: 20px 0;
        font-size: 14px;
        line-height: 1.5;
        text-align: center;
      }
    </style>
    <div class="email-container">
      <div class="header">
        <h1>📅 일정 확정</h1>
        <p>${data.teamName} 축구팀</p>
      </div>
      <div class="content">
        <div class="main-title">일정이 확정되었습니다!</div>
        
        <div class="info-section">
          <div class="info-item">
            <span class="icon">⚽</span>
            <span class="label">유형:</span>
            <span class="value">${data.gameType}</span>
          </div>
          <div class="info-item">
            <span class="icon">⏰</span>
            <span class="label">일시:</span>
            <span class="value">${data.gameDate} ${data.gameTime}</span>
          </div>
          <div class="info-item">
            <span class="icon">📍</span>
            <span class="label">장소:</span>
            <div class="location-container">
              <span class="value">${data.gameLocation}</span>
              <a href="https://map.kakao.com/link/search/${encodeURIComponent(data.gameLocation)}" target="_blank" class="kakao-map-btn">K</a>
            </div>
          </div>
        </div>

        <div class="participants-section">
          <div class="participants-header">
            <span class="icon">👥</span>
            <span>참석자 정보: ${totalCount}명 (회원 ${totalMembers}명${manualMembersCount > 0 ? ` + 기타 ${manualMembersCount}명` : ''}${data.mercenaryCount > 0 ? ` + 용병 ${data.mercenaryCount}명` : ''})</span>
          </div>
          <div class="participant-list">
            ${data.participants.map(participant => 
              `<span class="participant-tag member">${participant}</span>`
            ).join('')}
            ${data.manualMembers ? data.manualMembers.map(member => 
              `<span class="participant-tag other">${member}</span>`
            ).join('') : ''}
            ${data.mercenaryCount > 0 ? `<span class="participant-tag mercenary">용병 ${data.mercenaryCount}명</span>` : ''}
          </div>
        </div>

        <div class="instruction-text">
          참석 가능하신 분들은 확인해주세요!<br>
          일정이 변경되거나 참석이 어려우신 경우 빠른 시일 내에 연락주세요.
        </div>
      </div>
      <div class="footer">
        <p>${data.teamName} 축구팀 관리 시스템</p>
        <p>이 이메일은 자동으로 발송되었습니다.</p>
      </div>
    </div>
  `;
}

// 테스트 알림 발송 API
router.post('/send-test-notification', authenticateToken, async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    const { recipients, title, message } = req.body;
    
    console.log('🧪 테스트 알림 발송 요청:', { recipients, title, message });
    
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: '수신자 목록이 필요합니다.' });
    }
    
    if (!title || !message) {
      return res.status(400).json({ error: '제목과 내용이 필요합니다.' });
    }
    
    // 수신자 이메일 주소 가져오기
    const userEmails = [];
    for (const userId of recipients) {
      const user = await prisma.user.findUnique({
        where: { id: parseInt(userId) },
        select: { email: true, name: true }
      });
      
      if (user && user.email) {
        userEmails.push({ email: user.email, name: user.name });
      }
    }
    
    if (userEmails.length === 0) {
      return res.status(400).json({ error: '유효한 수신자 이메일이 없습니다.' });
    }
    
    // 이메일 발송
    const result = await sendTestEmailNotification(userEmails, title, message);
    
    res.json({
      message: '테스트 알림이 발송되었습니다.',
      result
    });
    
  } catch (error) {
    console.error('테스트 알림 발송 오류:', error);
    res.status(500).json({ error: '테스트 알림 발송 중 오류가 발생했습니다.' });
  }
});

// 테스트 이메일 발송 함수
async function sendTestEmailNotification(recipients, title, message) {
  try {
    // Gmail 환경변수 확인
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.log('⚠️ Gmail 환경변수가 설정되지 않음 - 이메일 발송 건너뜀');
      console.log('📧 테스트 알림 내용 (콘솔 출력):');
      console.log('='.repeat(50));
      console.log(`제목: ${title}`);
      console.log('내용:');
      console.log(message);
      console.log('='.repeat(50));
      return { success: false, reason: 'Gmail 환경변수 미설정' };
    }

    const nodemailer = require('nodemailer');
    
    // Gmail 설정
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    // 연결 테스트
    await transporter.verify();
    console.log('✅ Gmail SMTP 연결 성공');

    let successCount = 0;
    let failCount = 0;

    // 수신자들에게 이메일 발송
    for (const recipient of recipients) {
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: recipient.email,
        subject: `🧪 ${title}`,
        text: message,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">🏆 FC CHAL-GGYEO</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">테스트 알림</p>
            </div>
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
              <h2 style="color: #333; margin-top: 0;">${title}</h2>
              <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea;">
                <p style="color: #555; line-height: 1.6; margin: 0;">${message}</p>
              </div>
              <div style="margin-top: 20px; padding: 15px; background: #e3f2fd; border-radius: 8px; text-align: center;">
                <p style="margin: 0; color: #1976d2; font-size: 14px;">
                  이 메일은 FC CHAL-GGYEO 알림 시스템 테스트용입니다.
                </p>
              </div>
            </div>
          </div>
        `
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 테스트 이메일 발송 완료: ${recipient.email} (${recipient.name})`);
        successCount++;
      } catch (emailError) {
        console.error(`❌ 테스트 이메일 발송 실패 (${recipient.email}):`, emailError);
        failCount++;
      }
    }

    console.log(`📊 테스트 이메일 발송 결과: 성공 ${successCount}건, 실패 ${failCount}건`);
    return { 
      success: successCount > 0, 
      successCount, 
      failCount,
      total: recipients.length 
    };
    
  } catch (error) {
    console.error('❌ 테스트 이메일 발송 실패:', error);
    return { 
      success: false, 
      error: error.message,
      successCount: 0,
      failCount: recipients.length,
      total: recipients.length
    };
  }
}

// 이메일 알림 발송 함수
async function sendEmailNotification(attendances, message, gameDate, game) {
  try {
    // Gmail 환경변수 확인
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.log('⚠️ Gmail 환경변수가 설정되지 않음 - 이메일 발송 건너뜀');
      console.log('📧 이메일 알림 내용 (콘솔 출력):');
      console.log('='.repeat(50));
      console.log(`제목: 🏆 FC CHAL-GGYEO 일정 확정 - ${gameDate}`);
      console.log('내용:');
      console.log(message);
      console.log('='.repeat(50));
      return { success: false, reason: 'Gmail 환경변수 미설정' };
    }

    const nodemailer = require('nodemailer');
    
    // Gmail 설정 (createTransport 사용)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    // 연결 테스트
    await transporter.verify();
    console.log('✅ Gmail SMTP 연결 성공');

    let successCount = 0;
    let failCount = 0;

    // 참석자들에게 이메일 발송
    for (const attendance of attendances) {
      if (attendance.user.email) {
        const mailOptions = {
          from: process.env.GMAIL_USER,
          to: attendance.user.email,
          subject: `🏆 FC CHAL-GGYEO 일정 확정 - ${gameDate}`,
          text: message,
          html: createGameConfirmationEmail({
            gameDate: gameDate,
            gameTime: message.match(/시간: ([^\n]+)/)?.[1] || '미정',
            gameLocation: message.match(/장소: ([^\n]+)/)?.[1] || '미정',
            gameType: message.match(/유형: ([^\n]+)/)?.[1] || '미정',
            participants: attendances.map(a => a.user.name).filter(Boolean),
            manualMembers: (() => {
              try {
                if (game.memberNames) {
                  const parsed = typeof game.memberNames === 'string' 
                    ? JSON.parse(game.memberNames) 
                    : game.memberNames;
                  return Array.isArray(parsed) ? parsed : [];
                }
                return [];
              } catch (error) {
                console.warn('⚠️ 수기입력 인원정보 파싱 오류:', error);
                return [];
              }
            })(),
            mercenaryCount: game.mercenaryCount || 0,
            teamName: 'FC CHAL-GGYEO'
          })
        };

        try {
        await transporter.sendMail(mailOptions);
        console.log(`📧 이메일 발송 완료: ${attendance.user.email}`);
          successCount++;
        } catch (emailError) {
          console.error(`❌ 이메일 발송 실패 (${attendance.user.email}):`, emailError);
          failCount++;
        }
      }
    }

    console.log(`📊 이메일 발송 결과: 성공 ${successCount}건, 실패 ${failCount}건`);
    return { 
      success: successCount > 0, 
      successCount, 
      failCount,
      total: attendances.length 
    };
    
  } catch (error) {
    console.error('❌ 이메일 발송 실패:', error);
    console.log('📧 이메일 알림 내용 (오류 시 콘솔 출력):');
    console.log('='.repeat(50));
    console.log(`제목: 🏆 FC CHAL-GGYEO 일정 확정 - ${gameDate}`);
    console.log('내용:');
    console.log(message);
    console.log('='.repeat(50));
    return { success: false, error: error.message };
  }
}

// 갤러리 API 라우트들
const path = require('path');
const fs = require('fs');

// 업로드 디렉토리 생성
const uploadDir = path.join(__dirname, '../../uploads/gallery');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 갤러리 아이템 조회 API
router.get('/gallery', authenticateToken, async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const { page = 1, limit = 20, eventType, sortBy = 'latest' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let orderBy = {};
    switch (sortBy) {
      case 'latest':
        orderBy = { createdAt: 'desc' };
        break;
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'likes':
        orderBy = { likes: { _count: 'desc' } };
        break;
      default:
        orderBy = { createdAt: 'desc' };
    }

    const where = {};
    if (eventType && eventType !== 'all') {
      where.tags = {
        some: {
          name: eventType
        }
      };
    }

    const galleryItems = await prisma.gallery.findMany({
      where,
      include: {
        uploader: {
          select: { id: true, name: true, avatarUrl: true }
        },
        likes: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        },
        comments: {
          include: {
            user: {
              select: { id: true, name: true, avatarUrl: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        tags: true
      },
      orderBy,
      skip: offset,
      take: parseInt(limit)
    });

    const totalCount = await prisma.gallery.count({ where });

    // 좋아요 수와 댓글 수 추가
    const itemsWithCounts = galleryItems.map(item => ({
      ...item,
      likesCount: item.likes.length,
      commentsCount: item.comments.length,
      isLiked: item.likes.some(like => like.userId === req.user.userId)
    }));

    res.json({
      success: true,
      data: {
        items: itemsWithCounts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          totalPages: Math.ceil(totalCount / parseInt(limit))
        }
      }
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('갤러리 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '갤러리 조회 중 오류가 발생했습니다.'
    });
  }
});

// 갤러리 아이템 업로드 API (임시로 더미 데이터 생성)
// 실제 파일 업로드 API
router.post('/gallery/upload', authenticateToken, async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    // 사용자 ID 확인
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: '사용자 인증 정보가 없습니다.' 
      });
    }

    // 실제 파일 업로드 처리 (Node.js 내장 모듈 사용)
    const uploadDir = path.join(__dirname, '../../uploads');
    
    // 업로드 디렉토리가 없으면 생성
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // multipart/form-data 파싱 (Node.js 내장 모듈 사용)
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return res.status(400).json({
        success: false,
        error: 'multipart/form-data 형식이 아닙니다.'
      });
    }

    const boundary = contentType.split('boundary=')[1];
    if (!boundary) {
      return res.status(400).json({
        success: false,
        error: 'boundary를 찾을 수 없습니다.'
      });
    }

    let body = Buffer.alloc(0);
    req.on('data', (chunk) => {
      body = Buffer.concat([body, chunk]);
    });

    req.on('end', async () => {
      try {
        const parts = body.toString('binary').split(`--${boundary}`);
        let imageBuffer: Buffer | null = null;
        let filename = '';
        let fields: any = {};

        for (const part of parts) {
          if (part.includes('Content-Disposition: form-data')) {
            const lines = part.split('\r\n');
            const disposition = lines.find(line => line.startsWith('Content-Disposition'));
            
            if (disposition) {
              if (disposition.includes('name="image"')) {
                // 이미지 파일 처리
                const filenameMatch = disposition.match(/filename="([^"]+)"/);
                if (filenameMatch) {
                  filename = filenameMatch[1];
                  
                  // 파일 데이터 추출
                  const fileDataStart = part.indexOf('\r\n\r\n') + 4;
                  const fileDataEnd = part.lastIndexOf('\r\n');
                  const fileData = part.substring(fileDataStart, fileDataEnd);
                  imageBuffer = Buffer.from(fileData, 'binary');
                }
              } else {
                // 폼 필드 처리
                const nameMatch = disposition.match(/name="([^"]+)"/);
                if (nameMatch) {
                  const fieldName = nameMatch[1];
                  const valueStart = part.indexOf('\r\n\r\n') + 4;
                  const valueEnd = part.lastIndexOf('\r\n');
                  const value = part.substring(valueStart, valueEnd);
                  fields[fieldName] = value;
                }
              }
            }
          }
        }

        if (!imageBuffer || !filename) {
          return res.status(400).json({
            success: false,
            error: '이미지 파일이 필요합니다.'
          });
        }

        // 파일 크기 제한 (15MB)
        const maxFileSize = 15 * 1024 * 1024; // 15MB
        if (imageBuffer.length > maxFileSize) {
          return res.status(400).json({
            success: false,
            error: '파일 크기가 너무 큽니다. 15MB 이하의 파일을 업로드해주세요.'
          });
        }

        // 파일 확장자 검증
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
        const fileExtension = path.extname(filename).toLowerCase();
        if (!allowedExtensions.includes(fileExtension)) {
          return res.status(400).json({
            success: false,
            error: '지원하지 않는 파일 형식입니다. JPG, JPEG, PNG, WEBP 파일만 업로드 가능합니다.'
          });
        }

        // 파일 저장
        const timestamp = Date.now();
        const savedFilename = `${timestamp}-${filename}`;
        const filepath = path.join(uploadDir, savedFilename);
        
        fs.writeFileSync(filepath, imageBuffer);
        
        const imageUrl = `http://localhost:4000/uploads/${savedFilename}`;
        const { title, caption, eventType, eventDate, tags } = fields;
        
        // 이벤트 타입 정규화 (깨진 문자열 처리)
        let normalizedEventType = eventType || '기타';
        if (normalizedEventType.includes('ì') || normalizedEventType.includes('자체')) {
          normalizedEventType = '자체';
        }
        
        const galleryItem = await prisma.gallery.create({
          data: {
            title: title || caption || '',
            imageUrl: imageUrl,
            uploaderId: userId,
            eventDate: eventDate ? new Date(eventDate) : null,
            eventType: normalizedEventType,
            tags: {
              create: tags && tags.trim() ? (Array.isArray(tags) ? tags.map(tag => ({ name: tag.trim() })) : tags.split(',').map(tag => ({ name: tag.trim() })).filter(tag => tag.name && tag.name !== '')) : []
            }
          },
          include: {
            uploader: {
              select: { id: true, name: true, avatarUrl: true }
            },
            tags: true,
            likes: true,
            comments: true
          }
        });

        const uploadedItem = {
          ...galleryItem,
          likesCount: 0,
          commentsCount: 0,
          isLiked: false
        };

        res.status(201).json({
          success: true,
          data: [uploadedItem],
          message: '이미지가 업로드되었습니다.'
        });

        await prisma.$disconnect();
      } catch (error) {
        handleError(error, res, '갤러리 업로드');
      }
    });
  } catch (error) {
    handleError(error, res, '갤러리 업로드');
  }
});

// 갤러리 아이템 수정 API
router.put('/gallery/:id', authenticateToken, async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const { id } = req.params;
    const { title, eventDate, eventType, tags } = req.body;
    const userId = req.user.userId;

    // 갤러리 아이템 확인
    const galleryItem = await prisma.gallery.findUnique({
      where: { id: parseInt(id) },
      include: { uploader: true }
    });

    if (!galleryItem) {
      return res.status(404).json({
        success: false,
        error: '갤러리 아이템을 찾을 수 없습니다.'
      });
    }

    // 권한 확인 (업로더 또는 관리자만 수정 가능)
    if (galleryItem.uploaderId !== userId && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        error: '수정 권한이 없습니다.'
      });
    }

    // 기존 태그 삭제
    await prisma.tag.deleteMany({
      where: { galleryId: parseInt(id) }
    });

    // 갤러리 아이템 수정
    const updatedGalleryItem = await prisma.gallery.update({
      where: { id: parseInt(id) },
      data: {
        title: title || galleryItem.title,
        eventDate: eventDate ? new Date(eventDate) : galleryItem.eventDate,
        eventType: eventType || galleryItem.eventType,
        tags: {
          create: tags && tags.length > 0 ? tags.map(tag => ({ name: tag.trim() })).filter(tag => tag.name && tag.name !== '') : []
        }
      },
      include: {
        uploader: {
          select: { id: true, name: true, avatarUrl: true }
        },
        tags: true,
        likes: true,
        comments: true
      }
    });

    res.json({
      success: true,
      data: updatedGalleryItem,
      message: '갤러리 아이템이 수정되었습니다.'
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('갤러리 수정 오류:', error);
    res.status(500).json({
      success: false,
      error: '갤러리 수정 중 오류가 발생했습니다.'
    });
  }
});

// 갤러리 아이템 좋아요/좋아요 취소 API
router.post('/gallery/:id/like', authenticateToken, async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const { id } = req.params;
    const userId = req.user.userId;

    // 기존 좋아요 확인
    const existingLike = await prisma.like.findFirst({
      where: {
        galleryId: parseInt(id),
        userId: userId
      }
    });

    if (existingLike) {
      // 좋아요 취소
      await prisma.like.delete({
        where: { id: existingLike.id }
      });
      
      res.json({
        success: true,
        action: 'unliked',
        message: '좋아요가 취소되었습니다.'
      });
    } else {
      // 좋아요 추가
      await prisma.like.create({
        data: {
          galleryId: parseInt(id),
          userId: userId
        }
      });
      
      res.json({
        success: true,
        action: 'liked',
        message: '좋아요가 추가되었습니다.'
      });
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('좋아요 처리 오류:', error);
    res.status(500).json({
      success: false,
      error: '좋아요 처리 중 오류가 발생했습니다.'
    });
  }
});

// 갤러리 아이템 댓글 추가 API
router.post('/gallery/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '댓글 내용이 필요합니다.'
      });
    }

    const comment = await prisma.comment.create({
      data: {
        galleryId: parseInt(id),
        userId: userId,
        content: content.trim()
      },
      include: {
        user: {
          select: { id: true, name: true, avatarUrl: true }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: comment,
      message: '댓글이 추가되었습니다.'
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('댓글 추가 오류:', error);
    res.status(500).json({
      success: false,
      error: '댓글 추가 중 오류가 발생했습니다.'
    });
  }
});

// 갤러리 아이템 댓글 수정 API
router.put('/gallery/:id/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const { id, commentId } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '댓글 내용이 필요합니다.'
      });
    }

    // 댓글 존재 여부 및 권한 확인
    const existingComment = await prisma.comment.findFirst({
      where: {
        id: parseInt(commentId),
        galleryId: parseInt(id)
      }
    });

    if (!existingComment) {
      return res.status(404).json({
        success: false,
        error: '댓글을 찾을 수 없습니다.'
      });
    }

    // 댓글 작성자 또는 관리자만 수정 가능
    if (existingComment.userId !== userId && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        error: '댓글을 수정할 권한이 없습니다.'
      });
    }

    const updatedComment = await prisma.comment.update({
      where: { id: parseInt(commentId) },
      data: { content: content.trim() },
      include: {
        user: {
          select: { id: true, name: true, avatarUrl: true }
        }
      }
    });

    res.json({
      success: true,
      data: updatedComment,
      message: '댓글이 수정되었습니다.'
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('댓글 수정 오류:', error);
    res.status(500).json({
      success: false,
      error: '댓글 수정 중 오류가 발생했습니다.'
    });
  }
});

// 갤러리 아이템 댓글 삭제 API
router.delete('/gallery/:id/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const { id, commentId } = req.params;
    const userId = req.user.userId;

    // 댓글 존재 여부 및 권한 확인
    const existingComment = await prisma.comment.findFirst({
      where: {
        id: parseInt(commentId),
        galleryId: parseInt(id)
      }
    });

    if (!existingComment) {
      return res.status(404).json({
        success: false,
        error: '댓글을 찾을 수 없습니다.'
      });
    }

    // 댓글 작성자 또는 관리자만 삭제 가능
    if (existingComment.userId !== userId && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        error: '댓글을 삭제할 권한이 없습니다.'
      });
    }

    await prisma.comment.delete({
      where: { id: parseInt(commentId) }
    });

    res.json({
      success: true,
      message: '댓글이 삭제되었습니다.'
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('댓글 삭제 오류:', error);
    res.status(500).json({
      success: false,
      error: '댓글 삭제 중 오류가 발생했습니다.'
    });
  }
});

// 갤러리 아이템 삭제 API
router.delete('/gallery/:id', authenticateToken, async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const { id } = req.params;
    const userId = req.user.userId;

    // 갤러리 아이템 확인
    const galleryItem = await prisma.gallery.findUnique({
      where: { id: parseInt(id) },
      include: { uploader: true }
    });

    if (!galleryItem) {
      return res.status(404).json({
        success: false,
        error: '갤러리 아이템을 찾을 수 없습니다.'
      });
    }

    // 권한 확인 (업로더 또는 관리자만 삭제 가능)
    if (galleryItem.uploaderId !== userId && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        error: '삭제 권한이 없습니다.'
      });
    }

    // 파일 삭제 (로컬 파일인 경우에만)
    if (galleryItem.imageUrl && !galleryItem.imageUrl.startsWith('http')) {
      const filePath = path.join(__dirname, '../../', galleryItem.imageUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // 관련 데이터 먼저 삭제 (댓글, 좋아요, 태그)
    await prisma.comment.deleteMany({
      where: { galleryId: parseInt(id) }
    });
    
    await prisma.like.deleteMany({
      where: { galleryId: parseInt(id) }
    });
    
    await prisma.tag.deleteMany({
      where: { galleryId: parseInt(id) }
    });

    // 데이터베이스에서 갤러리 아이템 삭제
    await prisma.gallery.delete({
      where: { id: parseInt(id) }
    });

    res.json({
      success: true,
      message: '갤러리 아이템이 삭제되었습니다.'
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('갤러리 삭제 오류:', error);
    console.error('오류 상세:', error.message);
    console.error('오류 스택:', error.stack);
    res.status(500).json({
      success: false,
      error: '갤러리 삭제 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

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

// 경기 수정 API
router.put('/games/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { date, time, location, eventType, selectedMembers, mercenaryCount, manualMembers } = req.body;
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    console.log(`✏️ 경기 수정 요청: ${id}`, { date, time, location, eventType });
    
    // 게임 존재 확인
    const existingGame = await prisma.game.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!existingGame) {
      return res.status(404).json({ 
        error: '게임을 찾을 수 없습니다.' 
      });
    }
    
    // 중복 체크 (같은 날짜에 다른 게임이 있는지 확인, 단 자동생성된 게임은 제외)
    if (date) {
      const gameDate = new Date(date);
      const existingGames = await prisma.game.findMany({
        where: {
          id: { not: parseInt(id) },
          date: {
            gte: new Date(gameDate.getFullYear(), gameDate.getMonth(), gameDate.getDate()),
            lt: new Date(gameDate.getFullYear(), gameDate.getMonth(), gameDate.getDate() + 1)
          },
          autoGenerated: false // 자동생성된 게임은 제외
        }
      });
      
      if (existingGames.length > 0) {
        return res.status(400).json({
          error: '같은 날짜에 이미 다른 경기가 있습니다.'
        });
      }
    }
    
    // 게임 정보 업데이트
    const updatedGame = await prisma.game.update({
      where: { id: parseInt(id) },
      data: {
        date: date ? new Date(date) : existingGame.date,
        time: time || existingGame.time,
        location: location || existingGame.location,
        eventType: eventType || existingGame.eventType,
        autoGenerated: false, // 수정 시 자동생성 플래그 해제
        createdById: req.user.userId, // 수정한 사용자로 변경
        updatedAt: new Date()
      }
    });
    
    // 기존 참석자 정보 삭제
    await prisma.attendance.deleteMany({
      where: { gameId: parseInt(id) }
    });
    
    // 새로운 참석자 정보 추가
    if (selectedMembers && selectedMembers.length > 0) {
      for (const memberId of selectedMembers) {
        await prisma.attendance.create({
          data: {
            gameId: parseInt(id),
            userId: memberId,
            status: 'attending'
          }
        });
      }
    }
    
    // 용병 정보 추가
    if (mercenaryCount && mercenaryCount > 0) {
      for (let i = 0; i < mercenaryCount; i++) {
        await prisma.attendance.create({
          data: {
            gameId: parseInt(id),
            userId: null, // 용병은 userId가 null
            status: 'attending',
            isMercenary: true
          }
        });
      }
    }
    
    // 수기 입력 멤버 추가
    if (manualMembers && manualMembers.length > 0) {
      for (const memberName of manualMembers) {
        await prisma.attendance.create({
          data: {
            gameId: parseInt(id),
            userId: null,
            status: 'attending',
            manualName: memberName
          }
        });
      }
    }
    
    console.log(`✅ 경기 수정 완료: ${id}`);
    
    res.json({
      success: true,
      message: '경기가 성공적으로 수정되었습니다.',
      data: updatedGame
    });
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ 경기 수정 오류:', error);
    res.status(500).json({ 
      error: '경기 수정 중 오류가 발생했습니다.' 
    });
  }
});

// 경기 삭제 API
router.delete('/games/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    console.log(`🗑️ 경기 삭제 요청: ${id}`);
    
    // 게임 존재 확인
    const game = await prisma.game.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!game) {
      return res.status(404).json({ 
        error: '게임을 찾을 수 없습니다.' 
      });
    }
    
    // 참석자 정보 먼저 삭제
    await prisma.attendance.deleteMany({
      where: { gameId: parseInt(id) }
    });
    
    // 게임 삭제
    await prisma.game.delete({
      where: { id: parseInt(id) }
    });
    
    console.log(`✅ 경기 삭제 완료: ${id}`);
    
    res.json({
      success: true,
      message: '경기가 성공적으로 삭제되었습니다.'
    });
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ 경기 삭제 오류:', error);
    res.status(500).json({ 
      error: '경기 삭제 중 오류가 발생했습니다.' 
    });
  }
});

// 게임 관련 API 엔드포인트
// 게임 목록 조회
router.get('/games', authenticateToken, async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    const games = await prisma.game.findMany({
      include: {
        createdBy: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        date: 'asc'
      }
    });
    
    res.json(games);
  } catch (error) {
    console.error('❌ 경기 목록 조회 오류:', error);
    res.status(500).json({ error: '경기 목록 조회 중 오류가 발생했습니다.' });
  }
});

// 게임 생성
router.post('/games', authenticateToken, async (req, res) => {
  try {
    const { date, time, location, gameType, eventType, memberNames, selectedMembers, mercenaryCount, autoGenerated } = req.body;
    const userId = req.user.userId;
    
    console.log('🎮 게임 생성 요청:', { date, time, location, eventType, autoGenerated });
    
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // 날짜 형식 변환
    const gameDate = new Date(date);
    
    // 중복 체크 (같은 날짜에 이미 게임이 있는지 확인)
    const existingGame = await prisma.game.findFirst({
      where: {
        date: {
          gte: new Date(gameDate.getFullYear(), gameDate.getMonth(), gameDate.getDate()),
          lt: new Date(gameDate.getFullYear(), gameDate.getMonth(), gameDate.getDate() + 1)
        },
        autoGenerated: false // 자동생성된 게임은 중복 체크에서 제외
      }
    });
    
    if (existingGame && !autoGenerated) {
      return res.status(400).json({ error: '해당 날짜에 이미 경기가 있습니다.' });
    }
    
    // 멤버 이름 배열 처리
    const namesArray = Array.isArray(memberNames) ? memberNames : [];
    const selectedArray = Array.isArray(selectedMembers) ? selectedMembers : [];
    
    const game = await prisma.game.create({
      data: {
        date: gameDate,
        time: time || '미정',
        location: location || '장소 미정',
        gameType: gameType || '미정',
        eventType: eventType || '미정',
        createdById: userId,
        autoGenerated: autoGenerated || false,
        confirmed: true,
        mercenaryCount: mercenaryCount || 0,
        memberNames: JSON.stringify(namesArray),
        selectedMembers: JSON.stringify(selectedArray)
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    
    console.log('✅ 게임 생성 완료:', game);
    res.status(201).json({ success: true, data: game });
  } catch (error) {
    console.error('❌ 경기 생성 오류:', error);
    res.status(500).json({ error: '경기 생성 중 오류가 발생했습니다.' });
  }
});

// 게임 수정
router.put('/games/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { date, time, location, gameType, eventType, memberNames, selectedMembers, mercenaryCount } = req.body;
    const userId = req.user.userId;
    
    console.log('🎮 게임 수정 요청:', { id, date, time, location, eventType });
    
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // 게임 존재 확인
    const existingGame = await prisma.game.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!existingGame) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    
    // 날짜 형식 변환
    const gameDate = new Date(date);
    
    // 중복 체크 (자동생성된 게임은 제외)
    if (!existingGame.autoGenerated) {
      const duplicateGame = await prisma.game.findFirst({
        where: {
          date: {
            gte: new Date(gameDate.getFullYear(), gameDate.getMonth(), gameDate.getDate()),
            lt: new Date(gameDate.getFullYear(), gameDate.getMonth(), gameDate.getDate() + 1)
          },
          autoGenerated: false,
          id: { not: parseInt(id) }
        }
      });
      
      if (duplicateGame) {
        return res.status(400).json({ error: '해당 날짜에 이미 경기가 있습니다.' });
      }
    }
    
    // 멤버 이름 배열 처리
    const namesArray = Array.isArray(memberNames) ? memberNames : [];
    const selectedArray = Array.isArray(selectedMembers) ? selectedMembers : [];
    
    const updatedGame = await prisma.game.update({
      where: { id: parseInt(id) },
      data: {
        date: gameDate,
        time: time || existingGame.time,
        location: location || existingGame.location,
        gameType: gameType || existingGame.gameType,
        eventType: eventType || existingGame.eventType,
        createdById: userId,
        autoGenerated: false, // 수정 시 자동생성 플래그 해제
        confirmed: true,
        mercenaryCount: mercenaryCount || existingGame.mercenaryCount,
        memberNames: JSON.stringify(namesArray),
        selectedMembers: JSON.stringify(selectedArray)
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    
    console.log('✅ 게임 수정 완료:', updatedGame);
    res.json({ success: true, data: updatedGame });
  } catch (error) {
    console.error('❌ 경기 수정 오류:', error);
    res.status(500).json({ error: '경기 수정 중 오류가 발생했습니다.' });
  }
});

// 게임 삭제
router.delete('/games/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🎮 게임 삭제 요청:', { id });
    
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // 게임 존재 확인
    const existingGame = await prisma.game.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!existingGame) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    
    // 관련 출석 기록도 함께 삭제
    await prisma.attendance.deleteMany({
      where: { gameId: parseInt(id) }
    });
    
    // 게임 삭제
    await prisma.game.delete({
      where: { id: parseInt(id) }
    });
    
    console.log('✅ 게임 삭제 완료:', { id });
    res.json({ success: true, message: '경기가 삭제되었습니다.' });
  } catch (error) {
    console.error('❌ 경기 삭제 오류:', error);
    res.status(500).json({ error: '경기 삭제 중 오류가 발생했습니다.' });
  }
});

// 활동 분석 통계 API
router.get('/activity-analysis', authenticateToken, async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    // 현재 날짜 기준으로 이번 달 계산
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    const monthStart = new Date(currentYear, currentMonth - 1, 1);
    const monthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59);

    console.log('📊 활동 분석 데이터 계산:', {
      currentYear,
      currentMonth,
      monthStart: monthStart.toISOString(),
      monthEnd: monthEnd.toISOString()
    });

    // 1. 전체 회원 수
    const totalMembers = await prisma.user.count({
      where: {
        role: { in: ['MEMBER', 'ADMIN', 'SUPER_ADMIN'] },
        status: { in: ['ACTIVE', 'SUSPENDED'] }
      }
    });

    // 2. 이번 달 경기 수 (확정된 경기만)
    const thisMonthGames = await prisma.game.count({
      where: {
        date: {
          gte: monthStart,
          lte: monthEnd
        },
        confirmed: true // 확정된 경기만
      }
    });

    // 3. 이번 달 경기 참여 데이터 (확정된 경기만)
    const thisMonthGameParticipations = await prisma.game.findMany({
      where: {
        date: {
          gte: monthStart,
          lte: monthEnd
        },
        confirmed: true
      },
      select: {
        id: true,
        selectedMembers: true,
        memberNames: true,
        mercenaryCount: true,
        gameType: true
      }
    });

    // 4. 모든 투표 세션 데이터 (이번 달 제한 제거)
    const allVoteSessions = await prisma.voteSession.findMany({
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

    console.log('📊 모든 투표 세션 데이터:', {
      sessionCount: allVoteSessions.length,
      sessions: allVoteSessions.map(s => ({
        id: s.id,
        weekStartDate: s.weekStartDate,
        voteCount: s.votes.length,
        voters: s.votes.map(v => ({ userId: v.userId, userName: v.user.name }))
      }))
    });

    // 5. 회원별 참여 현황 계산
    const allMembers = await prisma.user.findMany({
      where: {
        role: { in: ['MEMBER', 'ADMIN', 'SUPER_ADMIN'] },
        status: { in: ['ACTIVE', 'SUSPENDED'] }
      },
      select: { id: true, name: true, role: true }
    });

        const memberStats = allMembers.map(member => {
          // 경기 참여 계산
          let gameParticipationCount = 0;
          thisMonthGameParticipations.forEach(game => {
            try {
              const selectedMembers = JSON.parse(game.selectedMembers || '[]');
              const memberNames = JSON.parse(game.memberNames || '[]');
              
              if (selectedMembers.includes(member.name) || memberNames.includes(member.name)) {
                gameParticipationCount++;
              }
            } catch (e) {
              console.warn('게임 참여 데이터 파싱 오류:', e);
            }
          });

          // 투표 참여 계산 (모든 세션 기준)
          let voteParticipationCount = 0;
          allVoteSessions.forEach(session => {
            const hasVoted = session.votes.some(vote => vote.userId === member.id);
            if (hasVoted) voteParticipationCount++;
          });

          console.log(`📊 ${member.name} 투표 참여 계산:`, {
            memberId: member.id,
            memberName: member.name,
            totalSessions: allVoteSessions.length,
            voteParticipationCount,
            sessionDetails: allVoteSessions.map(s => ({
              sessionId: s.id,
              weekStartDate: s.weekStartDate,
              hasVoted: s.votes.some(vote => vote.userId === member.id)
            }))
          });

          // 활동점수 계산 (경기 참여 50점, 투표 참여 30점)
          const activityScore = (gameParticipationCount * 50) + (voteParticipationCount * 30);

          console.log(`📊 ${member.name} 활동점수 계산:`, {
            gameParticipationCount,
            voteParticipationCount,
            activityScore,
            gameParticipation: thisMonthGames > 0 ? Math.round((gameParticipationCount / thisMonthGames) * 100) : 0,
            voteParticipation: allVoteSessions.length > 0 ? Math.round((voteParticipationCount / allVoteSessions.length) * 100) : 0
          });

          return {
            id: member.id,
            name: member.name,
            role: member.role,
            gameParticipation: thisMonthGames > 0 ? Math.round((gameParticipationCount / thisMonthGames) * 100) : 0,
            voteParticipation: allVoteSessions.length > 0 ? Math.round((voteParticipationCount / allVoteSessions.length) * 100) : 0,
            activityScore,
            gameParticipationCount,
            voteParticipationCount
          };
        });

    // 활동점수 기준으로 내림차순 정렬
    memberStats.sort((a, b) => b.activityScore - a.activityScore);
    
    console.log('📊 최종 회원 통계 (정렬 후):', memberStats.map(m => ({
      name: m.name,
      activityScore: m.activityScore,
      gameParticipation: m.gameParticipation,
      voteParticipation: m.voteParticipation
    })));

    // 6. 전체 통계 계산
    const totalGameParticipations = memberStats.reduce((sum, member) => sum + (member.gameParticipation > 0 ? 1 : 0), 0);
    const totalVoteParticipations = memberStats.reduce((sum, member) => sum + (member.voteParticipation > 0 ? 1 : 0), 0);
    const activeUsers = memberStats.filter(member => member.activityScore > 0).length;

    const participationRate = totalMembers > 0 ? Math.round((totalGameParticipations / totalMembers) * 100) : 0;
    const voteParticipationRate = totalMembers > 0 ? Math.round((totalVoteParticipations / totalMembers) * 100) : 0;

    // 7. 월별 경기 현황 (최근 6개월)
    const monthlyGameStats = [];
    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(currentYear, currentMonth - 1 - i, 1);
      const targetMonthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const targetMonthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);
      
      const monthGames = await prisma.game.count({
        where: {
          date: {
            gte: targetMonthStart,
            lte: targetMonthEnd
          },
          confirmed: true
        }
      });

      monthlyGameStats.push({
        month: `${targetDate.getMonth() + 1}월`,
        gameCount: monthGames
      });
    }

    // 8. 경기 유형별 분포
    const gameTypeStats = await prisma.game.groupBy({
      by: ['gameType'],
      where: {
        date: {
          gte: monthStart,
          lte: monthEnd
        },
        confirmed: true
      },
      _count: {
        gameType: true
      }
    });

    const gameTypeDistribution = {
      match: gameTypeStats.find(g => g.gameType === 'MATCH')?._count.gameType || 0,
      friendly: gameTypeStats.find(g => g.gameType === 'SELF')?._count.gameType || 0
    };

    const response = {
      success: true,
      data: {
        summary: {
          participationRate,
          voteParticipationRate,
          activeUsers,
          thisMonthGames
        },
        memberStats,
        monthlyGameStats,
        gameTypeDistribution
      }
    };

    console.log('✅ 활동 분석 데이터 생성 완료:', response.data.summary);
    res.json(response);
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ 활동 분석 데이터 생성 오류:', error);
    res.status(500).json({
      success: false,
      error: '활동 분석 데이터 생성 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

// 프로필 조회 API
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 프로필 조회 요청 - userId:', req.user?.userId);
    
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: '사용자 ID가 없습니다.' });
    }

    // 사용자 기본 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        attendance: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    // 투표 참여 상세 정보 계산 (직접 구현)
    const voteSessions = await prisma.voteSession.findMany({
      include: {
        votes: {
          where: { userId: userId }
        }
      },
      orderBy: { weekStartDate: 'desc' }
    });
    
    const totalSessions = voteSessions.length;
    const participatedSessions = voteSessions.filter(session => session.votes.length > 0).length;
    
    const voteDetails = {
      participated: participatedSessions,
      total: totalSessions || 1
    };
    
    // 경기 참여 상세 정보 계산 (직접 구현)
    const games = await prisma.game.findMany({
      where: { confirmed: true },
      include: {
        attendances: {
          where: { userId: userId }
        }
      }
    });
    
    const totalGames = games.length;
    const participatedGames = games.filter(game => game.attendances.length > 0).length;
    
    const gameDetails = {
      participated: participatedGames,
      total: totalGames || 1
    };

    console.log('✅ 프로필 조회 완료:', {
      userId,
      name: user.name,
      voteDetails,
      gameDetails
    });

    res.json({
      ...user,
      voteDetails,
      gameDetails,
      voteAttendance: voteDetails.participated,
      attendance: gameDetails.participated
    });
  } catch (error) {
    console.error('❌ 프로필 조회 오류:', error);
    res.status(500).json({ error: '프로필 조회 중 오류가 발생했습니다.' });
  }
});

// 서버 시작 시 스케줄러 시작
scheduleWeeklyVoteSession();

export default router;
