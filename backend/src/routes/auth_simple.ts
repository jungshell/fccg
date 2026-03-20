import express from 'express';
import { authenticateToken } from '../middlewares/authMiddleware';
import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import { authLimiter } from '../middlewares/security';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { 
  getKoreaTime, 
  getThisWeekMonday, 
  getNextWeekMonday, 
  getWeekFriday,
  parseVoteDays,
  convertKoreanDateToDayCode
} from '../utils/voteUtils';
import {
  deactivateExpiredSessions,
  ensureSingleActiveSession,
  getActiveSession,
  validateAndFixSessionState
} from '../utils/voteSessionManager';

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

// Cloudinary 설정
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

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
  } catch (error) {
    console.error('저장된 투표 결과 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 로그인 API (Rate Limiting 적용)
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        error: '이메일과 비밀번호를 입력해주세요.' 
      });
    }

    console.log('🔍 로그인 시도:', { email, passwordLength: password?.length });
    
    // 사용자 조회
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() } // 이메일 소문자 변환 및 공백 제거
    });

    if (!user) {
      console.log('❌ 사용자 없음:', email);
      return res.status(401).json({ 
        error: '이메일 또는 비밀번호가 올바르지 않습니다.' 
      });
    }

    console.log('✅ 사용자 발견:', user.email, '비밀번호 해시 존재:', !!user.password);

    // 비밀번호 확인 (bcrypt로 해시 비교)
    // 비밀번호 해시가 없으면 오류
    if (!user.password) {
      console.log('❌ 사용자 비밀번호 해시 없음');
      return res.status(401).json({ 
        error: '비밀번호가 설정되지 않았습니다. 관리자에게 문의해주세요. (관리자 : 강병우, 정성인)' 
      });
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('🔍 비밀번호 검증 결과:', isPasswordValid);
    
    if (!isPasswordValid) {
      console.log('❌ 비밀번호 불일치');
      return res.status(401).json({ 
        error: '이메일 또는 비밀번호가 올바르지 않습니다.' 
      });
    }

    // 로그인 기록 업데이트 (마지막 로그인 시간, 로그인 횟수)
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          loginCount: { increment: 1 }
        }
      });
    } catch (e) {
      console.warn('⚠️ 로그인 기록 업데이트 실패:', e);
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
    // 현재 사용자 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });

    if (!user) {
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
  } catch (error) {
    console.error('토큰 갱신 오류:', error);
    res.status(500).json({ 
      error: '토큰 갱신 중 오류가 발생했습니다.' 
    });
  }
});


// convertKoreanDateToDayCode는 voteUtils에서 import하여 사용

// 투표 생성 API
router.post('/votes', async (req, res) => {
  try {
    const { selectedDays } = req.body;
    
    // 입력 검증
    if (!selectedDays || !Array.isArray(selectedDays) || selectedDays.length === 0) {
      return res.status(400).json({ 
        error: '선택된 날짜가 필요합니다.' 
      });
    }
    
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

      // 세션 상태 검증 및 자동 수정
      await validateAndFixSessionState();
      
      // 활성 투표 세션 찾기 (안전한 조회)
      const voteSession = await getActiveSession(false);

      if (!voteSession) {
        return res.status(404).json({ 
          error: '활성 투표 세션을 찾을 수 없습니다.' 
        });
      }

      // disabledDays 체크
      let disabledDaysArray: Array<{ day: string; reason: string }> = [];
      const voteSessionWithDisabledDays = voteSession as any;
      if (voteSessionWithDisabledDays.disabledDays) {
        try {
          disabledDaysArray = JSON.parse(voteSessionWithDisabledDays.disabledDays);
        } catch (e) {
          console.warn('disabledDays 파싱 실패:', voteSessionWithDisabledDays.disabledDays);
        }
      }

      // 차단된 요일이 선택되었는지 확인
      const disabledDayKeys = disabledDaysArray.map((d) => d.day);
      const hasDisabledDay = convertedSelectedDays.some((day: string) => disabledDayKeys.includes(day));
      
      if (hasDisabledDay) {
        const disabledDay = disabledDaysArray.find((d) => convertedSelectedDays.includes(d.day));
        return res.status(400).json({
          error: disabledDay?.reason || '선택할 수 없는 요일이 포함되어 있습니다.'
        });
      }

      // 트랜잭션으로 기존 투표 삭제 및 새 투표 생성
      const result = await prisma.$transaction(async (tx) => {
      // 기존 투표 삭제 (재투표 방지)
        await tx.vote.deleteMany({
        where: { 
          userId: userId,
          voteSessionId: voteSession.id
        }
      });

      // 새 투표 생성
        const vote = await tx.vote.create({
        data: {
          userId: userId,
          voteSessionId: voteSession.id,
          selectedDays: JSON.stringify(convertedSelectedDays)
        }
        });

        return vote;
      });

      res.json({
        message: '투표가 성공적으로 저장되었습니다.',
        vote: result
      });

    } catch (jwtError) {
      return res.status(401).json({ 
        error: '유효하지 않은 토큰입니다.' 
      });
    }
  } catch (error: any) {
    console.error('투표 생성 오류:', error);
    handleError(error, res, '투표 생성');
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

      
      // 현재 사용자의 모든 투표 삭제
      const deletedVotes = await prisma.vote.deleteMany({
        where: { userId: userId }
      });

      res.json({
        message: '모든 투표 데이터가 삭제되었습니다.',
        deletedCount: deletedVotes.count
      });

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


// 회원/경기 데이터 통합 조회 API (GET)
router.get('/members', async (req, res) => {
  try {
    
    // 1. 회원 목록 조회
    const members = await prisma.user.findMany({
      where: { 
        role: { in: ['MEMBER', 'ADMIN', 'SUPER_ADMIN'] },
        status: { in: ['ACTIVE', 'SUSPENDED'] }
      },
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
      },
      orderBy: { name: 'asc' }
    });
    
    console.log('📊 /members API - 조회된 회원 수:', members.length);
    console.log('📊 /members API - 회원 목록:', members.map(m => ({ id: m.id, name: m.name, role: m.role, status: m.status })));
    
    // 2. 경기 목록 조회
    const activeSession = await prisma.voteSession.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });
    
    let whereCondition: any = {};
    
    // 활성 세션이 있으면 자동생성 일정은 표시하지 않음
    if (activeSession && activeSession.isActive) {
      whereCondition = { autoGenerated: false };
    }
    
    const games = await prisma.game.findMany({
      where: whereCondition,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { date: 'asc' }
    });
    
    // 3. 경기 데이터 가공
const processedGames = games.map(game => {
  // 총원 계산용 변수
  let totalCount = 0;
  let allParticipantNames: string[] = [];

  // 1) selectedMembers 파싱
  let selectedMembers: string[] = [];
  try {
    if (typeof game.selectedMembers === 'string') {
      selectedMembers = JSON.parse(game.selectedMembers);
    } else if (Array.isArray(game.selectedMembers)) {
      selectedMembers = game.selectedMembers;
    }
  } catch (e) {
    console.error('selectedMembers 파싱 오류:', e);
  }

  // 실제 회원명만 남기고 중복 제거
  const actualMemberNames = members.map(m => m.name);
  const uniqueSelected = [...new Set(
    selectedMembers.filter(n => typeof n === 'string' && actualMemberNames.includes(n))
  )];
  totalCount += uniqueSelected.length;
  allParticipantNames.push(...uniqueSelected);

  // 2) memberNames 파싱
  let memberNames: string[] = [];
  try {
    if (typeof game.memberNames === 'string') {
      memberNames = JSON.parse(game.memberNames);
    } else if (Array.isArray(game.memberNames)) {
      memberNames = game.memberNames;
    }
  } catch (e) {
    console.error('memberNames 파싱 오류:', e);
  }

  // 공백/용병/중복 제외
  const uniqueManual = memberNames.filter(n => {
    if (typeof n !== 'string') return false;
    const t = n.trim();
    if (!t) return false;
    if (t.startsWith('용병')) return false; // 용병은 별도 카운트
    if (allParticipantNames.includes(t)) return false; // 회원과 중복 금지
    return true;
  });
  totalCount += uniqueManual.length;
  allParticipantNames.push(...uniqueManual);

  // 3) 용병 수
  totalCount += (game.mercenaryCount || 0);

  return {
    ...game,
    memberNames,
    selectedMembers,
    allParticipantNames,
    totalParticipantCount: totalCount
  };
});
    
    // 4. 통계 계산
    const totalMembers = members.length;
    const activeMembers = members.filter(m => m.status === 'ACTIVE').length;
    const totalGames = processedGames.length;
    
    res.json({
      members,
      games: processedGames,
      totalMembers,
      activeMembers,
      totalGames,
      thisWeekGames: processedGames.filter(g => {
        const gameDate = new Date(g.date);
        const now = new Date();
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay() + 1));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return gameDate >= weekStart && gameDate <= weekEnd;
      }).length,
      nextWeekVotes: activeSession ? 1 : 0
    });
  } catch (error) {
    console.error('회원/경기 데이터 조회 오류:', error);
    handleError(error, res, '회원/경기 데이터 조회');
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

      
    // 이메일 중복 확인
    const existingUser = await prisma.user.findFirst({
      where: { email }
    });
    
    if (existingUser) {
      return res.status(400).json({ error: '이미 존재하는 이메일입니다.' });
    }
    
    // 비밀번호 해시화
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

// 회원가입 API (Rate Limiting 및 비밀번호 해시화 적용)
router.post('/register', authLimiter, async (req, res) => {
  try {
    console.log('🔍 회원가입 요청 받음:', {
      body: req.body,
      rawBody: JSON.stringify(req.body),
      headers: req.headers,
      contentType: req.headers['content-type'],
      bodyType: typeof req.body,
      bodyKeys: Object.keys(req.body || {}),
      bodyIsEmpty: !req.body || Object.keys(req.body).length === 0
    });
    
    // req.body가 비어있는 경우 처리
    if (!req.body || Object.keys(req.body).length === 0) {
      console.error('❌ 요청 본문이 비어있습니다.');
      return res.status(400).json({ 
        error: '요청 데이터가 없습니다. Content-Type이 application/json인지 확인해주세요.' 
      });
    }
    
    const { name, email, password, phone } = req.body;
    
    console.log('🔍 파싱된 데이터:', { 
      name, 
      email, 
      password: password ? '***' : undefined, 
      phone,
      nameType: typeof name,
      emailType: typeof email,
      passwordType: typeof password
    });
    
    // 필수 필드 검증
    if (!name || (typeof name === 'string' && !name.trim())) {
      console.log('❌ 이름 검증 실패:', name);
      return res.status(400).json({ 
        error: '이름을 입력해주세요.' 
      });
    }
    
    if (!email || (typeof email === 'string' && !email.trim())) {
      console.log('❌ 이메일 검증 실패:', email);
      return res.status(400).json({ 
        error: '이메일을 입력해주세요.' 
      });
    }
    
    if (!password || (typeof password === 'string' && !password.trim())) {
      console.log('❌ 비밀번호 검증 실패:', password ? '***' : undefined);
      return res.status(400).json({ 
        error: '비밀번호를 입력해주세요.' 
      });
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: '올바른 이메일 형식을 입력해주세요.' 
      });
    }

    // 비밀번호 길이 검증
    if (password.length < 6) {
      return res.status(400).json({ 
        error: '비밀번호는 최소 6자 이상이어야 합니다.' 
      });
    }
    
    // 이메일 중복 확인
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (existingUser) {
      return res.status(400).json({ 
        error: '이미 존재하는 이메일입니다.' 
      });
    }

    // 비밀번호 해시화
    const hashedPassword = await bcrypt.hash(password, 10);

    // 사용자 생성 (phone은 선택사항)
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword, // 해시화된 비밀번호 저장
        phone: phone && phone.trim() ? phone.trim() : null,
        role: 'MEMBER'
      }
    });

    // JWT 토큰 생성 (로그인과 동일하게)
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'fc-chalggyeo-secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: '회원가입 성공',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone
      }
    });

  } catch (error: any) {
    console.error('❌ 회원가입 오류 발생:', error);
    console.error('❌ 에러 스택:', error?.stack);
    console.error('❌ 에러 메시지:', error?.message);
    console.error('❌ 에러 이름:', error?.name);
    console.error('❌ 전체 에러 객체:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    res.status(500).json({ 
      error: '서버 오류가 발생했습니다.',
      message: process.env.NODE_ENV === 'development' ? error?.message : undefined,
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
});

// ===== 경기 관리 API =====

// 경기 목록 조회 API
router.get('/games', async (req, res) => {
  try {
    const includeAutoGenerated =
      req.query.includeAutoGenerated === 'true' || req.query.includeAutoGenerated === '1';
    
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

    // 관리자 화면에서는 자동생성 일정까지 포함하되,
    // 지난 과거(미확정) 자동생성 일정은 숨겨서 오래된 노이즈를 제거
    if (includeAutoGenerated) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const games = await prisma.game.findMany({
        where: {
          OR: [
            { autoGenerated: false },
            {
              AND: [
                { autoGenerated: true },
                { confirmed: true }
              ]
            },
            {
              AND: [
                { autoGenerated: true },
                { date: { gte: today } }
              ]
            }
          ]
        },
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

      console.log('📋 관리자 경기 조회(includeAutoGenerated):', {
        totalGames: games.length,
        autoGenerated: games.filter(g => g.autoGenerated).length,
        manual: games.filter(g => !g.autoGenerated).length,
        hiddenPastAutoGeneratedBefore: today.toISOString()
      });

      return res.json(games);
    }
    
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
  } catch (error) {
    console.error('경기 목록 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 경기 생성 API
router.post('/games', async (req, res) => {
  try {
    const { date, time, location, locationAddress, gameType, eventType, memberNames, selectedMembers, mercenaryCount, autoGenerated } = req.body;
    
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
          locationAddress: locationAddress || null,
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

      // 참석자 정보 생성 (N+1 문제 해결: 배치 쿼리 사용)
      const allMembers = [...selectedArray, ...namesArray];
      if (allMembers.length > 0) {
        // 모든 회원명을 한 번에 조회
        const uniqueMemberNames = [...new Set(allMembers.map(m => m?.trim()).filter(Boolean))];
        const memberUsers = await prisma.user.findMany({
          where: {
            name: { in: uniqueMemberNames }
          },
          select: { id: true, name: true }
            });
        
        // 이름으로 매핑
        const nameToUserMap = new Map(memberUsers.map(u => [u.name, u.id]));
        
        // 배치로 참석자 생성
        const attendanceData = uniqueMemberNames
          .filter(name => nameToUserMap.has(name))
          .map(name => ({
                  gameId: game.id,
            userId: nameToUserMap.get(name)!,
            status: 'YES' as const
          }));
        
        if (attendanceData.length > 0) {
          await prisma.attendance.createMany({
            data: attendanceData
          });
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
    const { date, time, location, locationAddress, gameType, eventType, memberNames, selectedMembers, mercenaryCount } = req.body;
    const userId = (req as any).user?.userId;

      
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

      // 새 참석자 생성 (N+1 문제 해결: 배치 쿼리 사용)
      const allMemberNames = [...selectedArray, ...namesArray]
        .filter((name): name is string => typeof name === 'string' && !!name.trim())
        .map(name => name.trim());
      
      if (allMemberNames.length > 0) {
        const uniqueMemberNames = [...new Set(allMemberNames)];
        const memberUsers = await prisma.user.findMany({
          where: {
            name: { in: uniqueMemberNames }
          },
          select: { id: true, name: true }
        });
        
        const nameToUserMap = new Map(memberUsers.map(u => [u.name, u.id]));
        const attendanceData = uniqueMemberNames
          .filter(name => nameToUserMap.has(name))
          .map(name => ({
            gameId: parseInt(id),
            userId: nameToUserMap.get(name)!,
            status: 'YES' as const
          }));
        
        if (attendanceData.length > 0) {
          await prisma.attendance.createMany({
            data: attendanceData
          });
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
          locationAddress: locationAddress !== undefined ? locationAddress : undefined,
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
    
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ error: '유효한 검색어가 필요합니다.' });
    }

    // 검색어 길이 제한
    if (query.length > 100) {
      return res.status(400).json({ error: '검색어는 100자 이하여야 합니다.' });
    }

    // 카카오맵 API 키 확인 (여러 환경변수 이름 지원)
    const kakaoApiKey = process.env.KAKAO_API_KEY || 
                        process.env.KAKAO_MAP_API_KEY || 
                        '4413813ca702d0fb6239ae38d9202d7e';
    
    console.log('🔍 장소 검색 요청:', query);
    console.log('🔑 카카오맵 API 키 사용:', kakaoApiKey ? '설정됨' : '없음');
    
    // 실제 카카오맵 API 호출
    const queryString = typeof query === 'string' ? query : String(query || '');
    const response = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(queryString)}&size=10`, {
      headers: {
        'Authorization': `KakaoAK ${kakaoApiKey}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ 카카오맵 API 오류:', response.status, errorText);
      throw new Error(`카카오맵 API 오류: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ 카카오맵 API 응답 성공:', response.status);
    console.log('📊 검색 결과 수:', data.documents?.length || 0);
    
    res.json({
      documents: data.documents || []
    });
    
  } catch (error: any) {
    console.error('❌ 장소 검색 오류:', error);
    
    // 오류 시 빈 결과 반환 (더미 데이터 대신)
    res.status(500).json({ 
      error: '장소 검색 중 오류가 발생했습니다.',
      documents: []
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
    
    // 1. 만료된 세션 자동 비활성화 (일정투표기간이 지난 세션)
    const adminCurrentTime = new Date();
    const adminKoreaTime = new Date(adminCurrentTime.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    
    // 모든 활성 세션 조회
    const activeSessions = await prisma.voteSession.findMany({
      where: { isActive: true }
    });
    
    // 일정투표기간(weekStartDate+4일)이 지난 세션 비활성화
    for (const session of activeSessions) {
      const weekStart = new Date(session.weekStartDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 4); // 금요일
      weekEnd.setHours(23, 59, 59, 999);
      
      // 일정투표기간이 지났으면 비활성화
      if (weekEnd < adminKoreaTime) {
        await prisma.voteSession.update({
          where: { id: session.id },
          data: { 
            isActive: false,
            isCompleted: true
          }
        });
        console.log(`✅ 만료된 세션 비활성화: ${session.id} (주간: ${weekStart.toLocaleDateString('ko-KR')})`);
      }
    }
    
    // 2. 활성 세션은 무조건 1건만 유지
    const remainingActiveSessions = await prisma.voteSession.findMany({
      where: { isActive: true },
      orderBy: { id: 'desc' }
    });
    
    // 활성 세션이 2개 이상이면 가장 오래된 것만 남기고 나머지 비활성화
    if (remainingActiveSessions.length > 1) {
      const sessionsToDeactivate = remainingActiveSessions.slice(1); // 첫 번째 제외한 나머지
      for (const session of sessionsToDeactivate) {
        await prisma.voteSession.update({
          where: { id: session.id },
          data: { 
            isActive: false,
            isCompleted: true
          }
        });
        console.log(`✅ 중복 활성 세션 비활성화: ${session.id}`);
      }
    }
    
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
      return res.status(404).json({ 
        error: '투표 세션을 찾을 수 없습니다.' 
      });
    }
    
    // 요일별 투표 결과 집계
    const dayVotes: any = {
      MON: { count: 0, participants: [] },
      TUE: { count: 0, participants: [] },
      WED: { count: 0, participants: [] },
      THU: { count: 0, participants: [] },
      FRI: { count: 0, participants: [] },
      '불참': { count: 0, participants: [] }
    };
    
    // 각 투표를 분석하여 요일별 집계
    session.votes.forEach(vote => {
      let selectedDays = [];
      try {
        selectedDays = JSON.parse(vote.selectedDays || '[]');
      } catch (e) {
        console.warn(`투표 ${vote.id}의 selectedDays 파싱 실패:`, vote.selectedDays);
        selectedDays = [];
      }
      selectedDays.forEach((day: string) => {
        // 요일 코드를 직접 사용 (MON, TUE, WED, THU, FRI) 또는 '불참'
        const dayKey = day;
        
        if (dayKey === '불참') {
          dayVotes['불참'].count++;
          dayVotes['불참'].participants.push({
            userId: vote.userId,
            userName: vote.user.name,
            votedAt: vote.createdAt
          });
        } else if (dayKey && dayVotes[dayKey as keyof typeof dayVotes]) {
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
    const allParticipants = session.votes.map(vote => {
      let selectedDays = [];
      try {
        selectedDays = JSON.parse(vote.selectedDays || '[]');
      } catch (e) {
        selectedDays = [];
      }
      return {
        userId: vote.userId,
        userName: vote.user.name,
        selectedDays: selectedDays,
        votedAt: vote.createdAt
      };
    });
    
    // weekRange 계산
    const weekStart = new Date(session.weekStartDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekRange = `${formatDateWithDay(weekStart)} ~ ${formatDateWithDay(weekEnd)}`;
    
    res.json({
      sessionId: session.id,
      weekStartDate: session.weekStartDate,
      weekRange: weekRange,
      isActive: session.isActive,
      isCompleted: session.isCompleted,
      results: dayVotes,
      participants: allParticipants,
      totalParticipants: allParticipants.length,
      totalVotes: session.votes.length
    });
    
  } catch (error) {
    console.error('투표 결과 조회 오류:', error);
    handleError(error, res, '투표 결과 조회');
  }
});

router.get('/votes/unified', async (req, res) => {
  try {
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
    
    // 이번주 월요일 계산 (한국시간 기준)
    const currentTime = new Date();
    const koreaTime = new Date(currentTime.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const currentDay = koreaTime.getDay(); // 0: 일요일, 1: 월요일, ..., 6: 토요일
    
    let daysUntilMonday;
    if (currentDay === 0) { // 일요일
      daysUntilMonday = -6; // 지난 월요일
    } else if (currentDay === 1) { // 월요일
      daysUntilMonday = 0; // 오늘
    } else {
      daysUntilMonday = 1 - currentDay; // 이번주 월요일
    }
    
    const thisWeekMonday = new Date(koreaTime);
    thisWeekMonday.setDate(koreaTime.getDate() + daysUntilMonday);
    thisWeekMonday.setHours(0, 0, 0, 0);
    
    // 이번주 금요일 계산
    const thisWeekFriday = new Date(thisWeekMonday);
    thisWeekFriday.setDate(thisWeekMonday.getDate() + 4);
    thisWeekFriday.setHours(23, 59, 59, 999);
    
    console.log('🔍 이번주 월요일 주간 범위:', {
      thisWeekMonday: thisWeekMonday.toISOString(),
      thisWeekFriday: thisWeekFriday.toISOString()
    });
    
    // 이번주 월요일 주간에 해당하는 완료된 세션 조회
    const lastWeekSession = await prisma.voteSession.findFirst({
      where: { 
        isCompleted: true,
        weekStartDate: {
          gte: thisWeekMonday,
          lte: thisWeekFriday
        },
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
    
    console.log('🔍 이번주 주간 완료 세션:', {
      found: !!lastWeekSession,
      sessionId: lastWeekSession?.id,
      weekStartDate: lastWeekSession?.weekStartDate,
      voteCount: lastWeekSession?.votes.length
    });
    
    // 활성 세션 데이터 가공
    let processedActiveSession = null;
    if (activeSession) {
      const dayVotes: any = {
        MON: { count: 0, participants: [] },
        TUE: { count: 0, participants: [] },
        WED: { count: 0, participants: [] },
        THU: { count: 0, participants: [] },
        FRI: { count: 0, participants: [] },
        '불참': { count: 0, participants: [] }
      };
      
      activeSession.votes.forEach(vote => {
        let selectedDays = [];
        try {
          selectedDays = JSON.parse(vote.selectedDays || '[]');
        } catch (e) {
          console.warn(`투표 ${vote.id}의 selectedDays 파싱 실패:`, vote.selectedDays);
          selectedDays = [];
        }
        selectedDays.forEach((day: string) => {
          // 요일 코드를 직접 사용 (MON, TUE, WED, THU, FRI) 또는 '불참'
          const dayKey = day;
          
          if (dayKey === '불참') {
            dayVotes['불참'].count++;
            dayVotes['불참'].participants.push({
              userId: vote.userId,
              userName: vote.user.name,
              votedAt: vote.createdAt
            });
          } else if (dayKey && dayVotes[dayKey as keyof typeof dayVotes]) {
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
        sessionId: activeSession.id,
        weekStartDate: activeSession.weekStartDate,
        startTime: activeSession.startTime,
        endTime: activeSession.endTime,
        weekRange: `${formatDateWithDay(activeSession.weekStartDate)} ~ ${formatDateWithDay(new Date(activeSession.weekStartDate.getTime() + 4 * 24 * 60 * 60 * 1000))}`,
        isActive: activeSession.isActive,
        isCompleted: activeSession.isCompleted,
        results: dayVotes,
        participants: activeSession.votes.map(vote => {
          let selectedDays = [];
          try {
            selectedDays = JSON.parse(vote.selectedDays || '[]');
          } catch (e) {
            console.warn(`투표 ${vote.id}의 selectedDays 파싱 실패:`, vote.selectedDays);
            selectedDays = [];
          }
          return {
            userId: vote.userId,
            userName: vote.user.name,
            selectedDays: selectedDays,
            votedAt: vote.createdAt
          };
        }),
        totalParticipants: activeSession.votes.length
      };
      
      console.log('🔍 백엔드 processedActiveSession.results 키:', Object.keys(processedActiveSession.results));
      console.log('🔍 백엔드 processedActiveSession.results 불참:', processedActiveSession.results['불참']);
    }
    
    // 지난주 세션 데이터 가공
    // activeSession이 isCompleted: true이고 isActive: false인 경우, 이를 lastWeekResults로도 사용
    let processedLastWeekSession = null;
    let sessionToProcess = lastWeekSession;
    
    // activeSession이 완료된 세션이고, 이번주 주간에 해당하면 이를 우선 사용
    if (activeSession && activeSession.isCompleted && !activeSession.isActive) {
      const activeWeekStart = new Date(activeSession.weekStartDate);
      const activeWeekStartNormalized = new Date(activeWeekStart.getFullYear(), activeWeekStart.getMonth(), activeWeekStart.getDate());
      const thisWeekMondayNormalized = new Date(thisWeekMonday.getFullYear(), thisWeekMonday.getMonth(), thisWeekMonday.getDate());
      
      // activeSession의 weekStartDate가 이번주 월요일과 정확히 일치하는지 확인
      if (activeWeekStartNormalized.getTime() === thisWeekMondayNormalized.getTime()) {
        console.log('✅ activeSession이 완료된 이번주 세션이므로 lastWeekResults로 사용:', {
          activeSessionId: activeSession.id,
          weekStartDate: activeSession.weekStartDate,
          thisWeekMonday: thisWeekMonday.toISOString().split('T')[0]
        });
        sessionToProcess = activeSession;
      } else {
        console.log('⚠️ activeSession이 이번주 데이터가 아님:', {
          activeSessionWeekStart: activeWeekStartNormalized.toISOString().split('T')[0],
          thisWeekMonday: thisWeekMondayNormalized.toISOString().split('T')[0]
        });
      }
    }
    
    // sessionToProcess가 없고 lastWeekSession도 없으면, activeSession이 완료된 세션이면 그것을 사용
    if (!sessionToProcess && activeSession && activeSession.isCompleted && !activeSession.isActive) {
      console.log('✅ lastWeekSession이 없으므로 activeSession을 lastWeekResults로 사용:', {
        activeSessionId: activeSession.id,
        weekStartDate: activeSession.weekStartDate
      });
      sessionToProcess = activeSession;
    }
    
    if (sessionToProcess) {
      const dayVotes: any = {
        MON: { count: 0, participants: [] },
        TUE: { count: 0, participants: [] },
        WED: { count: 0, participants: [] },
        THU: { count: 0, participants: [] },
        FRI: { count: 0, participants: [] },
        '불참': { count: 0, participants: [] }
      };
      
      sessionToProcess.votes.forEach(vote => {
        let selectedDays = [];
        try {
          selectedDays = JSON.parse(vote.selectedDays || '[]');
        } catch (e) {
          console.warn(`투표 ${vote.id}의 selectedDays 파싱 실패:`, vote.selectedDays);
          selectedDays = [];
        }
        selectedDays.forEach((day: string) => {
          // 요일 코드를 직접 사용 (MON, TUE, WED, THU, FRI) 또는 '불참'
          const dayKey = day;
          
          if (dayKey === '불참') {
            dayVotes['불참'].count++;
            dayVotes['불참'].participants.push({
              userId: vote.userId,
              userName: vote.user.name,
              votedAt: vote.createdAt
            });
          } else if (dayKey && dayVotes[dayKey as keyof typeof dayVotes]) {
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
        sessionId: sessionToProcess.id,
        weekStartDate: sessionToProcess.weekStartDate,
        startTime: sessionToProcess.startTime,
        endTime: sessionToProcess.endTime,
        isActive: sessionToProcess.isActive,
        isCompleted: sessionToProcess.isCompleted,
        weekRange: `${formatDateWithDay(sessionToProcess.weekStartDate)} ~ ${formatDateWithDay(new Date(sessionToProcess.weekStartDate.getTime() + 6 * 24 * 60 * 60 * 1000))}`,
        results: dayVotes,
        participants: sessionToProcess.votes.map(vote => {
          let selectedDays = [];
          try {
            selectedDays = JSON.parse(vote.selectedDays || '[]');
          } catch (e) {
            console.warn(`투표 ${vote.id}의 selectedDays 파싱 실패:`, vote.selectedDays);
            selectedDays = [];
          }
          return {
            userId: vote.userId,
            userName: vote.user.name,
            selectedDays: selectedDays,
            votedAt: vote.createdAt
          };
        }),
        totalParticipants: sessionToProcess.votes.length
      };
    }
    
    console.log('🔍 백엔드 응답 전 activeSession 확인:', {
      hasActiveSession: !!processedActiveSession,
      resultsKeys: processedActiveSession?.results ? Object.keys(processedActiveSession.results) : [],
      hasAbsent: processedActiveSession?.results ? '불참' in processedActiveSession.results : false,
      absentCount: processedActiveSession?.results?.['불참']?.count
    });
    
    res.json({
      activeSession: processedActiveSession,
      lastWeekResults: processedLastWeekSession || { sessionId: null, results: {}, participants: {} }
    });
    
  } catch (error) {
    console.error('통합 투표 데이터 조회 오류:', error);
    handleError(error, res, '통합 투표 데이터 조회');
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
    
    
    // 세션 존재 확인
    const session = await prisma.voteSession.findUnique({
      where: { id: parseInt(sessionId) },
      include: {
        votes: {
          include: { user: { select: { name: true } } }
        }
      }
    });
    
    if (!session) {
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
    
    // 자동생성 일정 로직 추가 (투표 마감과 동일한 로직)
    const weekStart = new Date(session.weekStartDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    // 기존 자동생성일정 정리
    const deleted = await prisma.game.deleteMany({
      where: {
        autoGenerated: true,
        date: { gte: weekStart, lte: weekEnd }
      }
    });
    console.log('🧹 자동생성일정 정리:', deleted.count, '개 삭제');
    
    // 최신 투표 결과로 재생성
    type DayKey = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
    const counts: Record<DayKey, number> = { MON: 0, TUE: 0, WED: 0, THU: 0, FRI: 0, SAT: 0, SUN: 0 };
    const participantsByDay: Record<DayKey, string[]> = { MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: [] };
    
    for (const v of session.votes) {
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
      const creatorId = session.votes[0]?.userId ?? 1;
      
      for (const day of topDays) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + dayOffset[day]);
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

    
    // 경기 존재 확인
    const existingGame = await prisma.game.findUnique({
      where: { id: gameId }
    });

    if (!existingGame) {
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

    
    // 세션 존재 확인
    const existingSession = await prisma.voteSession.findUnique({
      where: { id: sessionId }
    });

    if (!existingSession) {
      return res.status(404).json({ 
        error: '투표 세션을 찾을 수 없습니다.' 
      });
    }

    // 세션 마감 처리 (현재 시간을 endTime으로 설정 - 순수 UTC로 저장)
    const currentTime = new Date();
    const utcTime = new Date(currentTime.getTime() - (9 * 60 * 60 * 1000)); // 한국 시간에서 9시간 빼서 순수 UTC로 저장
    
    console.log('🔍 투표 마감 처리:', {
      sessionId,
      currentTime: currentTime.toISOString(),
      currentTimeKST: new Date(currentTime.getTime() + (9 * 60 * 60 * 1000)).toISOString(),
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

      // 현재 주차보다 이전에 생성된 자동 일정 정리 (가장 최신 주차만 유지)
      const removedOldGames = await prisma.game.deleteMany({
        where: {
          autoGenerated: true,
          date: { lt: weekStart }
        }
      });
      if (removedOldGames.count > 0) {
        console.log('🧹 이전 주차 자동생성일정 정리:', removedOldGames.count, '개 삭제');
      }

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
    
    // 세션 번호 재정렬 (가장 오래된 세션이 1번)
    await reorderSessionNumbers(prisma);
    
    
    res.status(200).json({
      message: '중복 세션 정리 및 번호 재정렬이 완료되었습니다.',
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

// 세션 번호 재정렬 함수 (가장 오래된 세션이 1번, 최신순으로 오름차순)
async function reorderSessionNumbers(prisma: any) {
  try {
    // 모든 세션을 weekStartDate 기준 오름차순 정렬 (가장 오래된 것이 첫 번째)
    const allSessions = await prisma.voteSession.findMany({
      orderBy: { weekStartDate: 'asc' }
    });

    if (allSessions.length === 0) {
      return;
    }

    console.log('🔄 세션 번호 재정렬 시작:', allSessions.length, '개 세션');

    // 모든 세션을 임시 ID로 매핑하여 재정렬
    // Prisma는 autoincrement ID를 직접 변경할 수 없으므로, 
    // 임시 테이블을 사용하거나 raw SQL로 처리해야 합니다.
    // 대신 모든 세션과 관련 투표 데이터를 백업한 후 재생성하는 방법을 사용합니다.
    
    // 방법: 모든 세션 데이터를 메모리에 저장하고 삭제 후 재생성
    const sessionData = await Promise.all(
      allSessions.map(async (session: any) => {
        const votes = await prisma.vote.findMany({
          where: { voteSessionId: session.id }
        });
        return {
          weekStartDate: session.weekStartDate,
          startTime: session.startTime,
          endTime: session.endTime,
          isActive: session.isActive,
          isCompleted: session.isCompleted,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          votes: votes.map((v: any) => ({
            userId: v.userId,
            selectedDays: v.selectedDays,
            createdAt: v.createdAt,
            updatedAt: v.updatedAt
          }))
        };
      })
    );

    // 모든 투표 데이터 삭제 (세션 삭제 시 자동 삭제되지만 명시적으로)
    await prisma.vote.deleteMany({});
    
    // 모든 세션 삭제
    await prisma.voteSession.deleteMany({});

    // 시퀀스 리셋 (PostgreSQL)
    await prisma.$executeRaw`ALTER SEQUENCE "VoteSession_id_seq" RESTART WITH 1`;

    // 세션을 순서대로 재생성 (가장 오래된 것이 1번)
    for (let i = 0; i < sessionData.length; i++) {
      const data = sessionData[i];
      const newSession = await prisma.voteSession.create({
        data: {
          weekStartDate: data.weekStartDate,
          startTime: data.startTime,
          endTime: data.endTime,
          isActive: data.isActive,
          isCompleted: data.isCompleted,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        }
      });

      // 관련 투표 데이터 재생성
      for (const vote of data.votes) {
        await prisma.vote.create({
          data: {
            userId: vote.userId,
            voteSessionId: newSession.id,
            selectedDays: vote.selectedDays,
            createdAt: vote.createdAt,
            updatedAt: vote.updatedAt
          }
        });
      }
    }

    console.log('✅ 세션 번호 재정렬 완료: 가장 오래된 세션이 1번으로 설정됨');
  } catch (error) {
    console.error('❌ 세션 번호 재정렬 오류:', error);
    throw error;
  }
}

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

    
    // 세션 존재 확인
    const existingSession = await prisma.voteSession.findUnique({
      where: { id: sessionId }
    });

    if (!existingSession) {
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

    // 세션 삭제 후 번호 재정렬 (가장 오래된 세션이 1번)
    await reorderSessionNumbers(prisma);

    
    res.status(200).json({ 
      message: '투표 세션이 성공적으로 삭제되었습니다. 세션 번호가 재정렬되었습니다.',
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

    
    // 세션 존재 확인
    const existingSession = await prisma.voteSession.findUnique({
      where: { id: sessionId }
    });

    if (!existingSession) {
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

// 통합 투표 데이터 API - 모든 페이지에서 사용 (메인 API)
router.get('/unified-vote-data', async (req, res) => {
  try {
    // 세션 상태 검증 및 자동 수정
    await validateAndFixSessionState();
    
    // 날짜 계산 (유틸리티 함수 사용)
    const koreaTime = getKoreaTime();
    const thisWeekMonday = getThisWeekMonday(koreaTime);
    const thisWeekFriday = getWeekFriday(thisWeekMonday);
    const nextWeekMonday = getNextWeekMonday(koreaTime);
    const nextWeekFriday = getWeekFriday(nextWeekMonday);
    
    // 활성 세션 조회 (안전한 조회)
    let activeSession = await getActiveSession(true);
    
    // 활성 세션이 없으면 다음주 세션(완료된 세션 포함) 조회
    // "다음주 일정투표" 패널은 다음주 세션을 사용해야 함
    if (!activeSession) {
      const nextWeekSession = await prisma.voteSession.findFirst({
        where: {
          weekStartDate: {
            gte: nextWeekMonday,
            lte: nextWeekFriday
          },
          votes: {
            some: {}
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
        orderBy: { id: 'desc' }
      });
      
      if (nextWeekSession) {
        console.log('✅ 다음주 세션 조회 (완료된 세션 포함):', {
          sessionId: nextWeekSession.id,
          weekStartDate: nextWeekSession.weekStartDate,
          isCompleted: nextWeekSession.isCompleted,
          isActive: nextWeekSession.isActive
        });
        activeSession = nextWeekSession;
      }
    }
    
    // activeSession은 그대로 사용 (필터링 제거)
    // "다음주 일정투표" 패널은 activeSession을 사용하므로 필터링하지 않음
    let filteredActiveSession = activeSession;

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

    // 활성 세션 데이터 가공
    let processedActiveSession = null;
    if (filteredActiveSession && filteredActiveSession.votes) {
      const participants = filteredActiveSession.votes.map(vote => {
        const selectedDays = parseVoteDays(vote.selectedDays);
        return {
          userId: vote.userId,
          userName: vote.user.name,
          selectedDays: selectedDays,
          votedAt: vote.createdAt
        };
      });

      // 요일별 투표 결과 계산
      const results: any = {
        MON: { count: 0, participants: [] },
        TUE: { count: 0, participants: [] },
        WED: { count: 0, participants: [] },
        THU: { count: 0, participants: [] },
        FRI: { count: 0, participants: [] },
        '불참': { count: 0, participants: [] }
      };

      participants.forEach(participant => {
        const selectedDaysArray = Array.isArray(participant.selectedDays) 
          ? participant.selectedDays 
          : parseVoteDays(participant.selectedDays);
        
          selectedDaysArray.forEach(day => {
            // '불참' 키 처리
            if (day === '불참') {
              results['불참'].count++;
              results['불참'].participants.push({
                userId: participant.userId,
                userName: participant.userName,
                votedAt: participant.votedAt
              });
            } else {
              // 한국어 날짜 형식을 영어 요일로 변환
              const dayKey = convertKoreanDateToDayCode(day);
              
              if (dayKey && results[dayKey as keyof typeof results]) {
                results[dayKey as keyof typeof results].count++;
                results[dayKey as keyof typeof results].participants.push({
                  userId: participant.userId,
                  userName: participant.userName,
                  votedAt: participant.votedAt
                });
              }
            }
          });
      });

      // disabledDays 파싱
      let disabledDaysArray: Array<{ day: string; reason: string }> = [];
      const filteredActiveSessionWithDisabledDays = filteredActiveSession as any;
      if (filteredActiveSessionWithDisabledDays.disabledDays) {
        try {
          disabledDaysArray = JSON.parse(filteredActiveSessionWithDisabledDays.disabledDays);
        } catch (e) {
          console.warn('disabledDays 파싱 실패:', filteredActiveSessionWithDisabledDays.disabledDays);
        }
      }

      processedActiveSession = {
        sessionId: filteredActiveSession.id,
        weekStartDate: filteredActiveSession.weekStartDate,
        startTime: filteredActiveSession.startTime,
        endTime: filteredActiveSession.endTime,
        isActive: filteredActiveSession.isActive,
        isCompleted: filteredActiveSession.isCompleted,
        participants,
        results,
        disabledDays: disabledDaysArray,
        totalParticipants: participants.length,
        totalVotes: participants.reduce((sum, p) => {
          const days = Array.isArray(p.selectedDays) ? p.selectedDays : [];
          return sum + days.length;
        }, 0)
      };
    }

    // 모든 세션 데이터 가공 (관리자 페이지용)
    const processedSessions = allSessions.map(session => {
      const participants = session.votes.map(vote => {
        const selectedDays = parseVoteDays(vote.selectedDays);
        return {
          userId: vote.userId,
          userName: vote.user.name,
          selectedDays: selectedDays,
          votedAt: vote.createdAt
        };
      });

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
        totalVotes: participants.reduce((sum, p) => {
          const days = Array.isArray(p.selectedDays) ? p.selectedDays : [];
          return sum + days.length;
        }, 0)
      };
    });

    // 이번주 월요일과 일치하는 완료된 세션 조회 (이번주 일정용)
    // 세션 #3 (이번주 월-금 투표기간)의 결과를 가져옴
    const thisWeekMondayNormalized = new Date(thisWeekMonday.getFullYear(), thisWeekMonday.getMonth(), thisWeekMonday.getDate());
    const thisWeekFridayNormalized = new Date(thisWeekFriday.getFullYear(), thisWeekFriday.getMonth(), thisWeekFriday.getDate());
    
    const lastCompletedSession = await prisma.voteSession.findFirst({
      where: { 
        isCompleted: true,
        weekStartDate: {
          gte: thisWeekMondayNormalized,
          lte: thisWeekFridayNormalized
        },
        votes: {
          some: {}
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
    
    console.log('🔍 이번주 일정용 세션 조회:', {
      thisWeekMonday: thisWeekMondayNormalized.toISOString().split('T')[0],
      thisWeekFriday: thisWeekFridayNormalized.toISOString().split('T')[0],
      foundSession: lastCompletedSession ? {
        id: lastCompletedSession.id,
        weekStartDate: lastCompletedSession.weekStartDate,
        isCompleted: lastCompletedSession.isCompleted,
        voteCount: lastCompletedSession.votes.length
      } : null
    });
    
    // 7. lastWeekResults 생성
    let lastWeekResults = null;
    if (lastCompletedSession) {
      const dayVotes: any = {
        MON: { count: 0, participants: [] },
        TUE: { count: 0, participants: [] },
        WED: { count: 0, participants: [] },
        THU: { count: 0, participants: [] },
        FRI: { count: 0, participants: [] },
        '불참': { count: 0, participants: [] }
      };
      
      const participants = lastCompletedSession.votes.map(vote => ({
        userId: vote.userId,
        userName: vote.user.name,
        selectedDays: parseVoteDays(vote.selectedDays),
        votedAt: vote.createdAt
      }));
      
      lastCompletedSession.votes.forEach(vote => {
        const selectedDaysArray = parseVoteDays(vote.selectedDays);
        
          selectedDaysArray.forEach((day: string) => {
            // '불참' 키 처리
            if (day === '불참') {
              dayVotes['불참'].count++;
              dayVotes['불참'].participants.push({
                userId: vote.userId,
                userName: vote.user.name,
                votedAt: vote.createdAt
              });
            } else {
              const dayKey = convertKoreanDateToDayCode(day);
              if (dayKey && dayVotes[dayKey as keyof typeof dayVotes]) {
                dayVotes[dayKey as keyof typeof dayVotes].count++;
                dayVotes[dayKey as keyof typeof dayVotes].participants.push({
                  userId: vote.userId,
                  userName: vote.user.name,
                  votedAt: vote.createdAt
                });
              }
            }
          });
      });
      
      lastWeekResults = {
        sessionId: lastCompletedSession.id,
        weekStartDate: lastCompletedSession.weekStartDate,
        startTime: lastCompletedSession.startTime,
        endTime: lastCompletedSession.endTime,
        isActive: lastCompletedSession.isActive,
        isCompleted: lastCompletedSession.isCompleted,
        totalParticipants: lastCompletedSession.votes.length,
        participants,
        results: dayVotes
      };
    }
    
    // 8. 통계 계산
    const stats = {
      totalSessions: allSessions.length,
      completedSessions: allSessions.filter(s => s.isCompleted).length,
      activeSessions: allSessions.filter(s => s.isActive).length,
      totalParticipants: allSessions.reduce((sum, s) => sum + s.votes.length, 0)
    };

    const response = {
      activeSession: processedActiveSession,
      lastWeekResults: lastWeekResults,
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
  } catch (error: any) {
    console.error('❌ 통합 투표 데이터 조회 오류:', error);
    console.error('❌ 에러 스택:', error?.stack);
    console.error('❌ 에러 메시지:', error?.message);
    console.error('❌ 에러 전체:', JSON.stringify(error, null, 2));
    handleError(error, res, '통합 투표 데이터 조회');
  }
});

// 주간 투표 세션 자동 생성 API
router.post('/start-weekly-vote', async (req, res) => {
  try {
    // 다음주 월요일 날짜 계산 (동적으로 계산)
    const currentTime = new Date();
    const nextMonday = new Date(currentTime);
    
    // 현재 요일이 일요일(0)이면 다음 월요일로, 아니면 다음주 월요일로
    if (currentTime.getDay() === 0) {
      nextMonday.setDate(currentTime.getDate() + 1); // 일요일이면 다음날(월요일)
    } else {
      nextMonday.setDate(currentTime.getDate() + (8 - currentTime.getDay()) % 7); // 다른 요일이면 다음주 월요일
    }
    nextMonday.setHours(0, 1, 0, 0); // 월요일 00:01

    // 투표 종료일을 금요일로 설정 (월-금)
    const endTime = new Date(nextMonday);
    endTime.setDate(nextMonday.getDate() + 4); // 금요일
    endTime.setHours(17, 0, 0, 0); // 17:00

    // 중복 체크 - 정확한 주간(월요일) 비교
    const nextMondayDateOnly = new Date(
      nextMonday.getFullYear(),
      nextMonday.getMonth(),
      nextMonday.getDate()
    );
    nextMondayDateOnly.setHours(0, 0, 0, 0);
    
    const existingSession = await prisma.voteSession.findFirst({
      where: {
        weekStartDate: {
          gte: nextMondayDateOnly,
          lt: new Date(nextMondayDateOnly.getTime() + 24 * 60 * 60 * 1000) // 다음날 00:00 이전
        }
      }
    });

    if (existingSession) {
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
  } catch (error) {
    console.error('주간 투표 세션 생성 오류:', error);
    handleError(error, res, '주간 투표 세션 생성');
  }
});

// 관리자용 수동 투표 세션 생성 API
router.post('/admin/vote-sessions/create', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: '관리자만 투표 세션을 생성할 수 있습니다.' });
    }

    const { weekStartDate, startTime, endTime, disabledDays } = req.body;

    if (!weekStartDate) {
      return res.status(400).json({ error: 'weekStartDate는 필수입니다.' });
    }

    const weekStart = new Date(weekStartDate);
    weekStart.setHours(0, 0, 0, 0);

    // 중복 체크
    const existingSession = await prisma.voteSession.findFirst({
      where: {
        weekStartDate: {
          gte: weekStart,
          lt: new Date(weekStart.getTime() + 24 * 60 * 60 * 1000)
        }
      }
    });

    if (existingSession) {
      return res.status(400).json({
        error: '이미 해당 주간을 대상으로 하는 투표 세션이 존재합니다.',
        existingSessionId: existingSession.id
      });
    }

    // 활성 세션이 있으면 비활성화
    const activeSession = await prisma.voteSession.findFirst({
      where: {
        isActive: true,
        isCompleted: false
      }
    });

    if (activeSession) {
      await prisma.voteSession.update({
        where: { id: activeSession.id },
        data: { isActive: false }
      });
    }

    // 기본값 계산
    const defaultStartTime = new Date(weekStart);
    defaultStartTime.setDate(weekStart.getDate() - 7); // 이번주 월요일
    defaultStartTime.setHours(0, 1, 0, 0); // 00:01

    const defaultEndTime = new Date(weekStart);
    defaultEndTime.setDate(weekStart.getDate() + 4); // 금요일
    defaultEndTime.setHours(17, 0, 0, 0); // 17:00

    const voteSession = await prisma.voteSession.create({
      data: {
        weekStartDate: weekStart,
        startTime: startTime ? new Date(startTime) : defaultStartTime,
        endTime: endTime ? new Date(endTime) : defaultEndTime,
        isActive: true,
        isCompleted: false,
        disabledDays: disabledDays ? JSON.stringify(disabledDays) : '[]'
      } as any
    });

    res.json({
      message: '투표 세션이 생성되었습니다.',
      voteSession
    });
  } catch (error) {
    console.error('수동 투표 세션 생성 오류:', error);
    handleError(error, res, '수동 투표 세션 생성');
  }
});

// 활성 세션의 disabledDays 설정 API
router.put('/admin/vote-sessions/active/disabled-days', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: '관리자만 설정할 수 있습니다.' });
    }

    const { disabledDays } = req.body;

    if (!Array.isArray(disabledDays)) {
      return res.status(400).json({ error: 'disabledDays는 배열이어야 합니다.' });
    }

    const activeSession = await prisma.voteSession.findFirst({
      where: {
        isActive: true,
        isCompleted: false
      }
    });

    if (!activeSession) {
      return res.status(404).json({ error: '활성 투표 세션이 없습니다.' });
    }

    const updatedSession = await prisma.voteSession.update({
      where: { id: activeSession.id },
      data: {
        disabledDays: JSON.stringify(disabledDays)
      } as any
    });

    res.json({
      message: 'disabledDays가 업데이트되었습니다.',
      voteSession: updatedSession
    });
  } catch (error) {
    console.error('disabledDays 설정 오류:', error);
    handleError(error, res, 'disabledDays 설정');
  }
});

// 자동 투표 세션 생성 스케줄러 (매주 월요일 00:01) - 수정: 무한 루프 방지
const scheduleWeeklyVoteSession = () => {
  const currentTime = new Date();
    const koreaTime = new Date(currentTime.getTime() + (9 * 60 * 60 * 1000)); // UTC+9 (한국시간)
  
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
      
      // 기존 활성 세션이 있는지 확인
      const existingSession = await prisma.voteSession.findFirst({
        where: {
          isActive: true,
          isCompleted: false
        }
      });
      
      if (existingSession) {
        console.log('⚠️ 이미 활성 투표 세션이 존재합니다:', existingSession.id);
        return;
      }
      
      // 다음주 월요일 날짜 계산 (한국시간 기준)
      const nextWeekMonday = new Date(nextMonday);
      nextWeekMonday.setDate(nextMonday.getDate() + 7);
      
      // 중복 체크 - 정확한 주간(월요일) 비교
      const nextWeekMondayDateOnly = new Date(
        nextWeekMonday.getFullYear(),
        nextWeekMonday.getMonth(),
        nextWeekMonday.getDate()
      );
      nextWeekMondayDateOnly.setHours(0, 0, 0, 0);
      
      const existingWeekSession = await prisma.voteSession.findFirst({
        where: {
          weekStartDate: {
            gte: nextWeekMondayDateOnly,
            lt: new Date(nextWeekMondayDateOnly.getTime() + 24 * 60 * 60 * 1000)
          }
        }
      });
      
      if (existingWeekSession) {
        console.log('⚠️ 해당 주간을 대상으로 하는 세션이 이미 존재합니다:', existingWeekSession.id);
        return;
      }

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
    
    const { newPassword } = req.body;
    const userId = req.user?.userId;
    
    console.log('🔐 비밀번호 변경 요청:', { userId, newPasswordLength: newPassword?.length });
    
    if (!userId) {
      console.log('❌ 사용자 ID 없음');
      return res.status(401).json({
        success: false,
        message: '인증이 필요합니다.'
      });
    }
    
    if (!newPassword || newPassword.length < 6) {
      console.log('❌ 비밀번호 길이 부족:', newPassword?.length);
      return res.status(400).json({
        success: false,
        message: '비밀번호는 6자 이상이어야 합니다.'
      });
    }

    // 기존 사용자 정보 확인
    const currentUser = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!currentUser) {
      console.log('❌ 사용자 없음:', userId);
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }
    
    console.log('✅ 사용자 발견:', currentUser.email, '기존 비밀번호 해시 존재:', !!currentUser.password);

    // 새 비밀번호 해시 생성
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log('✅ 새 비밀번호 해시 생성 완료:', hashedPassword.substring(0, 30) + '...');
    
    // 비밀번호 업데이트
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });
    
    console.log('✅ 비밀번호 변경 완료:', updatedUser.email);
    
    // 저장 확인: 실제 DB에서 다시 조회하여 검증
    const verifyUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true }
    });
    
    if (verifyUser && verifyUser.password) {
      const verifyMatch = await bcrypt.compare(newPassword, verifyUser.password);
      console.log('🔍 저장된 비밀번호 검증 결과:', verifyMatch ? '✅ 성공' : '❌ 실패');
      if (!verifyMatch) {
        console.error('❌ 비밀번호 저장 후 검증 실패! 저장이 제대로 되지 않았습니다.');
      }
    }

    res.json({
      success: true,
      message: '비밀번호가 성공적으로 변경되었습니다.'
    });
    
  } catch (error) {
    console.error('❌ 비밀번호 변경 오류:', error);
    res.status(500).json({
      success: false,
      message: '비밀번호 변경 중 오류가 발생했습니다.'
    });
  }
});

const generateTempPassword = (length = 10) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const smallTalkRules = [
  {
    keywords: ['안녕', '안뇽', '하이', 'hello', 'hi', 'ㅎㅇ'],
    replies: [
      '안녕하세요! 운동 준비 잘 하고 계시죠? 일정이나 투표가 궁금하면 언제든 물어보세요 😊',
      '안녕하세요! 오늘도 즐거운 축구 되시길 바랄게요 ⚽️'
    ]
  },
  {
    keywords: ['고마워', '감사', 'thanks', 'thx'],
    replies: [
      '별말씀을요! 도움이 필요하면 언제든 불러주세요 🙌',
      '언제든 도움이 필요하면 챗봇을 찾아주세요!'
    ]
  },
  {
    keywords: ['누구', '이름', '정체', '챗봇'],
    replies: [
      '저는 FC CHAL-GGYEO 도우미에요. 일정과 홈페이지 사용법을 안내해드리고 있어요!',
      'FC CHAL-GGYEO 홈페이지 안내 챗봇입니다. 일정/투표/이용법을 도와드려요.'
    ]
  },
  {
    keywords: ['잘가', '바이', 'bye', 'ㅂㅇ'],
    replies: [
      '다음에 또 만나요! ⚽️',
      '좋은 하루 보내세요!'
    ]
  }
];

const chatbotFaqs = [
  {
    keywords: ['로그인', '로그아웃', '계정'],
    answer:
      '① 상단 우측 "로그인" 버튼 클릭 → ② 이메일/비밀번호 입력 → ③ 로그인 유지가 필요하면 브라우저 저장을 허용하세요. 로그아웃은 동일 위치의 메뉴에서 할 수 있습니다.'
  },
  {
    keywords: ['비밀번호', '변경', '초기화', '잊어버'],
    answer:
      '내 비밀번호를 바꾸려면 로그인 후 우측 상단 프로필 → "비밀번호 변경" 선택 → 새 비밀번호를 입력해 저장하세요. 비밀번호를 잊었다면 관리자에게 초기화를 요청해 주세요.'
  },
  {
    keywords: ['프로필', '이름', '정보 수정'],
    answer:
      '프로필 변경: 로그인 후 우측 상단 이름 클릭 → "내 정보"에서 이름·연락처를 수정하고 저장하면 됩니다. 변경 내용은 즉시 적용돼요.'
  },
  {
    keywords: ['일정', '확인', '캘린더', '스케줄'],
    answer:
      '이번 주 확정 일정은 메인 대시보드 상단 카드와 일정 페이지 캘린더에서 모두 볼 수 있습니다. 보라색은 확정 경기, 연한 보라색은 투표 중인 날짜입니다.'
  },
  {
    keywords: ['투표', '참여', '다음주', '경기', '불참'],
    answer:
      '다음 주 경기 투표는 메인 대시보드 또는 일정 페이지의 "다음주 경기 투표하기" 카드에서 진행됩니다. 로그인 → 가능한 요일 선택 → 제출하면 참여 완료, 다시 투표 시 "재투표" 버튼을 사용하세요.'
  },
  {
    keywords: ['출석', '참석률', '활동점수'],
    answer:
      '출석·활동 점수는 관리자 페이지 통계에 따라 자동 계산됩니다. 내 참석률을 확인하고 싶다면 관리자에게 문의하거나 추후 제공될 마이페이지를 참고해주세요. (관리자 : 강병우, 정성인)'
  },
  {
    keywords: ['사진', '업로드', '갤러리', '좋아요', '댓글'],
    answer:
      '사진 페이지 우측 상단 "+ 업로드" 버튼으로 이미지를 올릴 수 있습니다(로그인 필요). 썸네일 하단의 하트/말풍선 아이콘으로 좋아요와 댓글을 남길 수 있어요.'
  },
  {
    keywords: ['동영상', '유튜브', '영상'],
    answer:
      '동영상 갤러리는 FC CHAL-GGYEO 유튜브 재생목록과 연동됩니다. 새 영상이 올라오면 자동 동기화되며, 재생 버튼을 누르면 페이지 내에서 바로 시청 가능합니다.'
  },
  {
    keywords: ['알림', '공지', '푸시'],
    answer:
      '푸시 알림을 받고 싶다면 크롬/엣지에서 로그인 후 상단 안내에 따라 알림 권한을 허용하세요. 일정 업데이트나 투표 알림을 브라우저로 즉시 받게 됩니다.'
  },
  {
    keywords: ['모바일', '앱', '바탕화면', '설치'],
    answer:
      '모바일 크롬/사파리에서 주소창의 공유 또는 메뉴 아이콘 → "홈 화면에 추가"를 선택하면 앱처럼 실행되는 PWA를 설치할 수 있습니다.'
  },
  {
    keywords: ['문의', '관리자', '도움'],
    answer:
      '홈페이지 우측 하단 챗봇으로 손쉽게 질문할 수 있으며, 추가 문의는 관리자 페이지 연락처 또는 기존 단톡방을 사용해주세요. 오류 스크린샷을 함께 전달하면 더 빠르게 처리됩니다.'
  }
];

const matchFaqAnswer = (question: string) => {
  const cleaned = question.toLowerCase();
  for (const faq of chatbotFaqs) {
    if (faq.keywords.some((keyword) => cleaned.includes(keyword))) {
      return faq.answer;
    }
  }
  return null;
};

const matchSmallTalk = (question: string) => {
  const cleaned = question.toLowerCase();
  for (const rule of smallTalkRules) {
    if (rule.keywords.some((keyword) => cleaned.includes(keyword))) {
      const replies = rule.replies;
      return replies[Math.floor(Math.random() * replies.length)];
    }
  }
  return null;
};

const buildScheduleAnswer = async () => {
  const now = new Date();

  const nextGame = await prisma.game.findFirst({
    where: {
      date: {
        gte: now
      }
    },
    orderBy: { date: 'asc' },
    select: {
      date: true,
      location: true,
      gameType: true,
      eventType: true
    }
  });

  const activeVote = await prisma.voteSession.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    include: {
      votes: {
        select: {
          userId: true
        }
      }
    }
  });

  const parts: string[] = [];
  if (nextGame) {
    parts.push(
      `다음 경기: ${nextGame.date.toLocaleDateString('ko-KR')} ${nextGame.date.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
      })} ${nextGame.location || ''} (${nextGame.gameType || nextGame.eventType || '경기'})`
    );
  } else {
    parts.push('다음으로 확정된 경기가 아직 없습니다.');
  }

  if (activeVote) {
    parts.push(
      `현재 다음 주 투표가 진행 중입니다. 참여자 ${activeVote.votes.length}명, 투표 기간은 ${new Date(
        activeVote.startTime
      ).toLocaleDateString('ko-KR')} ~ ${new Date(activeVote.endTime).toLocaleDateString('ko-KR')} 입니다.`
    );
  } else {
    parts.push('지금은 진행 중인 투표가 없습니다.');
  }

  parts.push('상세 일정은 일정 페이지에서 요일별로 확인할 수 있어요.');
  return parts.join('\n');
};

// 관리자용 비밀번호 초기화 API
router.post('/members/:id/reset-password', authenticateToken, async (req, res) => {
  try {
    console.log('🔐 비밀번호 초기화 요청 수신:', {
      requesterId: req.user?.userId,
      requesterRole: req.user?.role,
      targetMemberId: req.params?.id
    });
    
    const requesterRole = req.user?.role;
    if (!requesterRole || !['ADMIN', 'SUPER_ADMIN'].includes(requesterRole)) {
      console.warn('⚠️ 비밀번호 초기화 권한 부족:', requesterRole);
      return res.status(403).json({
        success: false,
        message: '비밀번호 초기화 권한이 없습니다.'
      });
    }

    const memberId = parseInt(req.params.id, 10);
    if (Number.isNaN(memberId)) {
      return res.status(400).json({
        success: false,
        message: '유효한 회원 ID가 필요합니다.'
      });
    }

    const { newPassword } = req.body || {};
    const passwordToSet =
      typeof newPassword === 'string' && newPassword.trim().length >= 6
        ? newPassword.trim()
        : generateTempPassword();

    const hashedPassword = await bcrypt.hash(passwordToSet, 10);

    const updatedMember = await prisma.user.update({
      where: { id: memberId },
      data: { password: hashedPassword },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true
      }
    });

    res.json({
      success: true,
      message: '비밀번호가 초기화되었습니다.',
      member: updatedMember,
      newPassword: passwordToSet
    });
    console.log('✅ 비밀번호 초기화 완료:', {
      memberId,
      memberEmail: updatedMember.email,
      requesterId: req.user?.userId
    });
  } catch (error) {
    console.error('비밀번호 초기화 오류:', error);
    res.status(500).json({
      success: false,
      message: '비밀번호 초기화 중 오류가 발생했습니다.'
    });
  }
});

// 규칙 기반 챗봇 API
router.post('/chatbot/query', async (req, res) => {
  try {
    const question = (req.body?.question || '').trim();
    if (!question) {
      return res.status(400).json({
        success: false,
        message: '질문 내용을 입력해주세요.'
      });
    }

    const lowered = question.toLowerCase();

    const smallTalk = matchSmallTalk(question);
    if (smallTalk) {
      return res.json({
        success: true,
        intent: 'smalltalk',
        answer: smallTalk
      });
    }

    if (['일정', '경기', '스케줄', '투표', '참석', '다음주'].some((keyword) => lowered.includes(keyword))) {
      const answer = await buildScheduleAnswer();
      return res.json({
        success: true,
        intent: 'schedule',
        answer
      });
    }

    const faqAnswer = matchFaqAnswer(question);
    if (faqAnswer) {
      return res.json({
        success: true,
        intent: 'faq',
        answer: faqAnswer
      });
    }

    return res.json({
      success: true,
      intent: 'fallback',
      answer:
        '아직 학습되지 않은 질문이에요. 일정이나 홈페이지 이용 방법을 물어보면 더 잘 답할 수 있어요. 자세한 내용은 관리자에게 문의해주세요! (관리자 : 강병우, 정성인)'
    });
  } catch (error) {
    console.error('챗봇 API 오류:', error);
    res.status(500).json({
      success: false,
      message: '챗봇 답변 생성 중 오류가 발생했습니다.'
    });
  }
});

// 프로필 업데이트 API
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    
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

// 통합 투표 데이터 API (DEPRECATED - /unified-vote-data 사용 권장)
router.get('/votes/unified', async (req, res) => {
  try {
    console.warn('⚠️ /votes/unified는 deprecated되었습니다. /unified-vote-data를 사용해주세요.');
    
    // 세션 상태 검증 및 자동 수정
    await validateAndFixSessionState();
    
    // 활성 투표 세션 조회 (안전한 조회)
    const activeSession = await getActiveSession(true);
    
    // 날짜 계산 (유틸리티 함수 사용)
    const koreaTime = getKoreaTime();
    const thisWeekMonday = getThisWeekMonday(koreaTime);
    const thisWeekFriday = getWeekFriday(thisWeekMonday);
    
    console.log('🔍 이번주 월요일 주간 범위:', {
      thisWeekMonday: thisWeekMonday.toISOString(),
      thisWeekFriday: thisWeekFriday.toISOString()
    });
    
    // 이번주 월요일 주간에 해당하는 완료된 세션 조회
    const lastWeekSession = await prisma.voteSession.findFirst({
      where: { 
        isCompleted: true,
        weekStartDate: {
          gte: thisWeekMonday,
          lte: thisWeekFriday
        },
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
    
    console.log('🔍 이번주 주간 완료 세션:', {
      found: !!lastWeekSession,
      sessionId: lastWeekSession?.id,
      weekStartDate: lastWeekSession?.weekStartDate,
      voteCount: lastWeekSession?.votes.length
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
        const selectedDays = parseVoteDays(vote.selectedDays);
        selectedDays.forEach((day: string) => {
          const dayKey = convertKoreanDateToDayCode(day);
          if (dayKey && dayVotes[dayKey as keyof typeof dayVotes]) {
            dayVotes[dayKey as keyof typeof dayVotes].count++;
            dayVotes[dayKey as keyof typeof dayVotes].participants.push({
              userId: vote.userId,
              userName: vote.user?.name || '알 수 없음'
            });
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
        const selectedDays = parseVoteDays(vote.selectedDays);
        selectedDays.forEach((day: string) => {
          const dayKey = convertKoreanDateToDayCode(day);
          if (dayKey && dayVotes[dayKey as keyof typeof dayVotes]) {
            dayVotes[dayKey as keyof typeof dayVotes].count++;
            dayVotes[dayKey as keyof typeof dayVotes].participants.push({
              userId: vote.userId,
              userName: vote.user?.name || '알 수 없음'
            });
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
    // 세션 상태 검증 및 자동 수정
    await validateAndFixSessionState();
    
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
    
    const mappedSessions = sessions.map(session => {
      // 참여자 목록 생성
      const participants = session.votes.map(vote => {
        const selectedDays = parseVoteDays(vote.selectedDays);
        return {
          userId: vote.userId,
          userName: vote.user?.name || '알 수 없음',
          selectedDays: selectedDays,
          votedAt: vote.createdAt
        };
      });
      
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
    });

    res.json({
      success: true,
      data: {
        totalSessions,
        completedSessions,
        activeSessions,
        totalParticipants,
        sessions: mappedSessions
      }
    });
  } catch (error: any) {
    console.error('❌ 투표 세션 요약 조회 오류:', error);
    console.error('❌ 에러 스택:', error?.stack);
    console.error('❌ 에러 메시지:', error?.message);
    handleError(error, res, '투표 세션 요약 조회');
  }
});

// 회원 삭제 API
router.delete('/members/:id', authenticateToken, async (req, res) => {
  try {
    
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
    
    let notificationAttendances = Array.isArray(game.attendances) ? [...game.attendances] : [];

    // 참석자 relation이 비어있는 경우 selectedMembers/memberNames 기반으로 이메일 수신 대상을 보정
    if (notificationAttendances.length === 0) {
      const parsedSelectedMembers = (() => {
        try {
          const raw = game.selectedMembers;
          if (!raw) return [];
          if (Array.isArray(raw)) return raw.filter(Boolean);
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
        } catch {
          return [];
        }
      })();

      const parsedManualMembers = (() => {
        try {
          const raw = game.memberNames;
          if (!raw) return [];
          if (Array.isArray(raw)) return raw.filter(Boolean);
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
        } catch {
          return [];
        }
      })();

      const candidateNames = [...new Set([...parsedSelectedMembers, ...parsedManualMembers])]
        .map((name: string) => (typeof name === 'string' ? name.trim() : ''))
        .filter((name: string) => name.length > 0);

      if (candidateNames.length > 0) {
        const users = await prisma.user.findMany({
          where: {
            name: { in: candidateNames }
          },
          select: {
            id: true,
            name: true,
            email: true
          }
        });

        notificationAttendances = users
          .filter((user: any) => !!user.email)
          .map((user: any) => ({ user }));

        console.log('📧 참석자 relation 없음 - 이름 기반 수신자 보정:', {
          candidateNamesCount: candidateNames.length,
          resolvedUsers: notificationAttendances.length
        });
      }
    }

    // 이메일 알림 발송
    await sendEmailNotification(notificationAttendances, notificationMessage, formattedDate, game);
    
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

// 발송 대상자 리스트 확인 API
router.get('/notification-recipients', authenticateToken, async (req, res) => {
  try {
    const { target, gameIds } = req.query;
    
    // 전체 회원 목록 가져오기
    const allUsers = await prisma.user.findMany({
      where: { 
        role: { in: ['MEMBER', 'ADMIN', 'SUPER_ADMIN'] },
        status: { in: ['ACTIVE', 'SUSPENDED'] }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true
      },
      orderBy: { name: 'asc' }
    });
    
    let recipients: number[] = [];
    let recipientDetails: any[] = [];
    
    if (target === 'all') {
      recipients = allUsers.map(u => u.id);
      recipientDetails = allUsers.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        hasEmail: !!u.email
      }));
    } else if (target === 'participating') {
      // 참가 예정 회원
      const gameIdArray = gameIds
        ? (Array.isArray(gameIds) ? gameIds : [gameIds])
            .map(id => parseInt(String(id), 10))
            .filter(id => !Number.isNaN(id))
        : [];
      const attendances = await prisma.attendance.findMany({
        where: {
          gameId: { in: gameIdArray },
          status: 'CONFIRMED'
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              status: true
            }
          }
        }
      });
      
      const participantIds = new Set(attendances.map(a => a.userId));
      recipients = Array.from(participantIds);
      recipientDetails = Array.from(participantIds).map(id => {
        const user = allUsers.find(u => u.id === id);
        return user ? {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          hasEmail: !!user.email
        } : null;
      }).filter(Boolean);
    } else if (target === 'admin') {
      recipients = allUsers.filter(u => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN').map(u => u.id);
      recipientDetails = allUsers
        .filter(u => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN')
        .map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          status: u.status,
          hasEmail: !!u.email
        }));
    }
    
    res.json({
      target,
      totalUsers: allUsers.length,
      recipientsCount: recipients.length,
      recipientsWithEmail: recipientDetails.filter(r => r.hasEmail).length,
      recipientsWithoutEmail: recipientDetails.filter(r => !r.hasEmail).length,
      recipients: recipientDetails,
      allUsers: allUsers.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status
      }))
    });
    
  } catch (error) {
    console.error('발송 대상자 리스트 조회 오류:', error);
    res.status(500).json({ error: '발송 대상자 리스트 조회 중 오류가 발생했습니다.', message: error.message });
  }
});

// 테스트 알림 발송 API
router.post('/send-test-notification', authenticateToken, async (req, res) => {
  try {
    
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
    const userDetails = [];
    for (const userId of recipients) {
      const user = await prisma.user.findUnique({
        where: { id: parseInt(userId) },
        select: { id: true, email: true, name: true, role: true, status: true }
      });
      
      userDetails.push({
        id: user?.id,
        name: user?.name,
        email: user?.email,
        role: user?.role,
        status: user?.status,
        hasEmail: !!user?.email
      });
      
      if (user && user.email) {
        userEmails.push({ email: user.email, name: user.name });
      }
    }
    
    console.log('📧 발송 대상자 상세 정보:', JSON.stringify(userDetails, null, 2));
    console.log('📧 이메일이 있는 발송 대상자 수:', userEmails.length, '/', recipients.length);
    console.log('📧 이메일이 있는 발송 대상자 목록:', userEmails.map(u => `${u.name}(${u.email})`));
    console.log('📧 이메일이 없는 발송 대상자:', userDetails.filter(u => !u.hasEmail).map(u => `${u.name}(ID: ${u.id}, 역할: ${u.role})`));
    
    if (userEmails.length === 0) {
      console.error('❌ 유효한 수신자 이메일이 없습니다.');
      return res.status(400).json({ 
        error: '유효한 수신자 이메일이 없습니다.',
        details: userDetails 
      });
    }
    
    // 이메일 발송
    const useRaw = req.body.useRaw || false;
    console.log('📧 이메일 발송 시작 - 대상자:', userEmails.map(u => `${u.name}(${u.email})`));
    const result = await sendTestEmailNotification(userEmails, title, message, useRaw);
    
    console.log('📧 이메일 발송 완료 - 결과:', {
      successCount: result.successCount,
      failCount: result.failCount,
      total: result.total
    });

    if (!result.success) {
      return res.status(503).json({
        error: '테스트 알림 발송 실패',
        reason: result.reason || result.error || '이메일 환경설정 또는 SMTP 상태를 확인해주세요.',
        result
      });
    }
    
    res.json({
      message: '테스트 알림이 발송되었습니다.',
      result,
      sentTo: userEmails.map(u => ({ name: u.name, email: u.email }))
    });
    
  } catch (error) {
    console.error('테스트 알림 발송 오류:', error);
    res.status(500).json({ error: '테스트 알림 발송 중 오류가 발생했습니다.' });
  }
});

// 테스트 이메일 발송 함수
async function sendTestEmailNotification(recipients, title, message, useRaw = false) {
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
    console.log(`📧 총 ${recipients.length}명에게 이메일 발송 시작...`);
    for (const recipient of recipients) {
      console.log(`📧 발송 중: ${recipient.name} (${recipient.email})`);
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: recipient.email,
        subject: title.startsWith('🧪') ? title : title, // 테스트 제목이 아니면 그대로 사용
        text: message,
        html: useRaw ? message : `
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
            </div>
          </div>
        `
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ 이메일 발송 완료: ${recipient.email} (${recipient.name})`);
        successCount++;
      } catch (emailError) {
        console.error(`❌ 이메일 발송 실패: ${recipient.email} (${recipient.name})`, emailError.message);
        failCount++;
      }
    }
    console.log(`📧 이메일 발송 완료 - 성공: ${successCount}건, 실패: ${failCount}건`);

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

// 갤러리 아이템 조회 API (공개 접근 가능, 인증 토큰이 있으면 좋아요 상태 확인)
router.get('/gallery', async (req, res) => {
  // CORS 헤더 명시적 설정
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  try {
    // 인증 토큰이 있으면 사용자 ID 추출
    let currentUserId = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fc-chalggyeo-secret');
        currentUserId = decoded.userId;
      } catch (err) {
        // 토큰이 유효하지 않으면 무시 (공개 접근 허용)
        console.log('토큰 검증 실패 (무시):', err.message);
      }
    }
    // req.user가 있으면 우선 사용
    if (req.user?.userId) {
      currentUserId = req.user.userId;
    }

    const { page = '1', limit = '20', eventType, sortBy = 'latest' } = req.query;
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : 1;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : 20;
    const offset = (pageNum - 1) * limitNum;

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

    const where: any = {};
    if (eventType && eventType !== 'all' && typeof eventType === 'string') {
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
      take: limitNum
    });

    const totalCount = await prisma.gallery.count({ where });

    // 좋아요 수와 댓글 수 추가
    
    // 백엔드 URL 추출 (절대 URL 생성용)
    const backendUrl = process.env.NODE_ENV === 'production' 
      ? (process.env.BACKEND_URL || 'https://fccgfirst.onrender.com')
      : `http://localhost:${process.env.PORT || 4000}`;
    
    const itemsWithCounts = galleryItems.map(item => {
      // imageUrl 경로 수정 및 절대 URL 변환
      let fixedImageUrl = item.imageUrl;
      
      // 상대 경로인 경우 절대 URL로 변환
      if (fixedImageUrl && !fixedImageUrl.startsWith('http') && !fixedImageUrl.startsWith('//') && !fixedImageUrl.startsWith('data:')) {
        // uploads/gallery/ 또는 /uploads/gallery/ 형식 처리
        if (fixedImageUrl.startsWith('/')) {
          fixedImageUrl = `${backendUrl}${fixedImageUrl}`;
        } else {
          fixedImageUrl = `${backendUrl}/${fixedImageUrl}`;
        }
      }
      
      // /uploads/를 /uploads/gallery/로 변경 (절대 URL인 경우)
      if (fixedImageUrl && fixedImageUrl.includes('/uploads/') && !fixedImageUrl.includes('/uploads/gallery/')) {
        fixedImageUrl = fixedImageUrl.replace('/uploads/', '/uploads/gallery/');
      }
      
      return {
        ...item,
        imageUrl: fixedImageUrl,
        likesCount: item.likes.length,
        commentsCount: item.comments.length,
        viewCount: item.viewCount ?? 0,
        clickCount: item.clickCount ?? item.viewCount ?? 0,
        isLiked: currentUserId ? item.likes.some(like => like.userId === currentUserId) : false
      };
    });

    res.json({
      success: true,
      data: {
        items: itemsWithCounts,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limitNum)
        }
      }
    });
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

    // 사용자 ID 확인
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: '사용자 인증 정보가 없습니다.' 
      });
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

        // Cloudinary에 이미지 업로드
        const timestamp = Date.now();
        const savedFilename = `${timestamp}-${path.parse(filename).name}`;
        
        let imageUrl: string;
        
        try {
          // Base64로 변환하여 Cloudinary에 업로드
          const base64Image = `data:image/${fileExtension.replace('.', '')};base64,${imageBuffer.toString('base64')}`;
          
          const uploadResult = await cloudinary.uploader.upload(base64Image, {
            folder: 'fccg/gallery',
            public_id: savedFilename,
            overwrite: false,
            resource_type: 'image'
          });
          
          imageUrl = uploadResult.secure_url;
          console.log('✅ Cloudinary 업로드 성공:', imageUrl);
        } catch (cloudinaryError: any) {
          console.error('❌ Cloudinary 업로드 실패:', cloudinaryError);
          return res.status(500).json({
            success: false,
            error: '이미지 업로드에 실패했습니다. 잠시 후 다시 시도해주세요.'
          });
        }
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

  } catch (error) {
    console.error('갤러리 수정 오류:', error);
    res.status(500).json({
      success: false,
      error: '갤러리 수정 중 오류가 발생했습니다.'
    });
  }
});

// 갤러리 아이템 클릭(조회수) 기록 API
router.post('/gallery/:id/view', async (req, res) => {
  try {
    const galleryId = parseInt(req.params.id);
    if (isNaN(galleryId)) {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 갤러리 ID입니다.'
      });
    }

    const updated = await prisma.gallery.update({
      where: { id: galleryId },
      data: { 
        viewCount: { increment: 1 },
        clickCount: { increment: 1 }
      },
      select: { id: true, viewCount: true, clickCount: true }
    });

    res.json({
      success: true,
      data: updated
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: '갤러리 아이템을 찾을 수 없습니다.'
      });
    }
    console.error('갤러리 조회수 업데이트 오류:', error);
    handleError(error, res, '갤러리 조회수 업데이트');
  }
});

// 갤러리 아이템 좋아요/좋아요 취소 API
router.post('/gallery/:id/like', authenticateToken, async (req, res) => {
  try {
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
  } catch (error) {
    console.error('좋아요 처리 오류:', error);
    handleError(error, res, '좋아요 처리');
  }
});

// 갤러리 아이템 댓글 추가 API
router.post('/gallery/:id/comments', authenticateToken, async (req, res) => {
  try {
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
  } catch (error) {
    console.error('댓글 추가 오류:', error);
    handleError(error, res, '댓글 추가');
  }
});

// 갤러리 아이템 댓글 수정 API
router.put('/gallery/:id/comments/:commentId', authenticateToken, async (req, res) => {
  try {
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
  } catch (error) {
    console.error('댓글 수정 오류:', error);
    handleError(error, res, '댓글 수정');
  }
});

// 갤러리 아이템 댓글 삭제 API
router.delete('/gallery/:id/comments/:commentId', authenticateToken, async (req, res) => {
  try {
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
  } catch (error) {
    console.error('댓글 삭제 오류:', error);
    handleError(error, res, '댓글 삭제');
  }
});

// 갤러리 아이템 삭제 API
router.delete('/gallery/:id', authenticateToken, async (req, res) => {
  try {

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

// 동영상 조회수 여러 개 조회 API
router.get('/videos/view-stats', async (req, res) => {
  try {
    const idsParam = req.query.ids;
    if (!idsParam) {
      return res.json({ success: true, data: {} });
    }

    const idsArray = Array.isArray(idsParam) ? idsParam : String(idsParam).split(',');
    const videoKeys = Array.from(
      new Set(idsArray.map(id => String(id).trim()).filter(id => id.length > 0))
    );

    if (videoKeys.length === 0) {
      return res.json({ success: true, data: {} });
    }

    const stats = await prisma.videoViewStat.findMany({
      where: { videoKey: { in: videoKeys } }
    });

    const result: Record<string, number> = {};
    stats.forEach(stat => {
      result[stat.videoKey] = stat.viewCount;
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('동영상 조회수 조회 오류:', error);
    handleError(error, res, '동영상 조회수 조회');
  }
});

// 동영상 조회수 증가 API
router.post('/videos/:videoKey/view', async (req, res) => {
  try {
    const { videoKey } = req.params;
    if (!videoKey || !videoKey.trim()) {
      return res.status(400).json({
        success: false,
        error: '유효한 동영상 ID가 필요합니다.'
      });
    }

    const updated = await prisma.videoViewStat.upsert({
      where: { videoKey },
      update: { 
        viewCount: { increment: 1 },
        lastViewedAt: new Date()
      },
      create: {
        videoKey,
        viewCount: 1,
        lastViewedAt: new Date()
      },
      select: {
        videoKey: true,
        viewCount: true
      }
    });

    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error('동영상 조회수 증가 오류:', error);
    handleError(error, res, '동영상 조회수 증가');
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
    const { date, time, location, locationAddress, eventType, selectedMembers, mercenaryCount, manualMembers } = req.body;
    
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
        locationAddress: locationAddress !== undefined ? locationAddress : existingGame.locationAddress,
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
    
    // 용병 정보는 mercenaryCount 필드에 저장 (Attendance 모델에는 용병 필드가 없으므로 별도 처리 불필요)
    // 수기 입력 멤버는 memberNames 필드에 저장 (Attendance 모델에는 manualName 필드가 없으므로 별도 처리 불필요)
    
    console.log(`✅ 경기 수정 완료: ${id}`);
    
    res.json({
      success: true,
      message: '경기가 성공적으로 수정되었습니다.',
      data: updatedGame
    });
    
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
    const { date, time, location, locationAddress, gameType, eventType, memberNames, selectedMembers, mercenaryCount, autoGenerated } = req.body;
    const userId = req.user.userId;
    
    console.log('🎮 게임 생성 요청:', { date, time, location, eventType, autoGenerated });
    
    
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
        locationAddress: locationAddress || null,
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
    const { date, time, location, locationAddress, gameType, eventType, memberNames, selectedMembers, mercenaryCount } = req.body;
    const userId = req.user.userId;
    
    console.log('🎮 게임 수정 요청:', { id, date, time, location, eventType });
    
    
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
        locationAddress: locationAddress !== undefined ? locationAddress : existingGame.locationAddress,
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

    // 현재 날짜 기준으로 이번 달 계산
    const currentTime = new Date();
    const currentYear = currentTime.getFullYear();
    const currentMonth = currentTime.getMonth() + 1; // 1-12
    const monthStart = new Date(currentYear, currentMonth - 1, 1);
    // 이번 달의 마지막 날 계산: 다음 달 1일에서 1일 빼기
    const monthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

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
        gameType: true,
        attendances: {
          select: {
            userId: true,
            user: { select: { id: true, name: true } }
          }
        }
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
              // 1) 출석(attendance) 기반 참여 우선
              const attendedByAttendance = Array.isArray(game.attendances)
                ? game.attendances.some((a: any) => {
                    if (a?.userId && a.userId === member.id) return true;
                    const byUserName = a?.user?.name && a.user.name === member.name;
                    return !!byUserName;
                  })
                : false;

              // 2) 과거 데이터 호환: selectedMembers/memberNames 기반
              const attendedByLegacy = selectedMembers.includes(member.name) || memberNames.includes(member.name);

              if (attendedByAttendance || attendedByLegacy) {
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
            loginCount: 0,
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
      const targetMonthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999);
      
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

    console.log('✅ 활동 분석 데이터 생성 완료:', {
      summary: response.data.summary,
      memberStatsCount: memberStats.length,
      monthlyGameStatsCount: monthlyGameStats.length,
      gameTypeDistribution: response.data.gameTypeDistribution,
      totalMembers,
      thisMonthGames,
      firstMemberSample: memberStats.length > 0 ? memberStats[0] : null
    });
    res.json(response);
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

    const memberSince = user.createdAt;

    // 투표 참여 상세 정보 계산 (직접 구현)
    const voteSessions = await prisma.voteSession.findMany({
      where: {
        weekStartDate: {
          gte: memberSince
        }
      },
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
      total: totalSessions
    };
    
    // 경기 참여 상세 정보 계산 (직접 구현)
    const games = await prisma.game.findMany({
      where: { 
        confirmed: true,
        date: {
          gte: memberSince
        }
      },
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
      total: totalGames
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
    handleError(error, res, '프로필 조회');
  }
});

// 서버 시작 시 스케줄러 시작
// scheduleWeeklyVoteSession(); // 비활성화 - app.ts의 cron 스케줄러만 사용

// 데이터 정규화 API (관리자 전용)
router.post('/normalize-data', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });
    
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN')) {
      return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    }
    
    console.log('🔄 데이터 정규화 시작...');
    
    // 1. 경기 유형(eventType) 정규화
    const games = await prisma.game.findMany();
    let updatedCount = 0;
    
    for (const game of games) {
      let newEventType = game.eventType;
      let newGameType = game.gameType;
      let shouldUpdate = false;
      
      // 비규격 eventType 정규화
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
      
      // gameType 정규화
      if (newEventType === '매치' && game.gameType !== 'MATCH') {
        newGameType = 'MATCH';
        shouldUpdate = true;
      } else if ((newEventType === '회식' || newEventType === '기타') && game.gameType !== 'OTHER') {
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
    
    // 2. 갤러리 eventType 정규화
    const galleryItems = await prisma.gallery.findMany();
    let galleryUpdatedCount = 0;
    
    for (const item of galleryItems) {
      let newEventType = item.eventType;
      
      if (!item.eventType || item.eventType === '') {
        newEventType = '기타';
      } else if (['풋살', 'FRIENDLY'].includes(item.eventType)) {
        newEventType = '매치';
      } else if (['SELF', 'self'].includes(item.eventType)) {
        newEventType = '자체';
      } else if (['DINNER', 'dinner'].includes(item.eventType)) {
        newEventType = '회식';
      } else if (!['매치', '자체', '회식', '기타'].includes(item.eventType)) {
        newEventType = '기타';
      }
      
      if (item.eventType !== newEventType) {
        await prisma.gallery.update({
          where: { id: item.id },
          data: { eventType: newEventType }
        });
        galleryUpdatedCount++;
      }
    }
    
    // 통계
    const eventTypeStats = await prisma.game.groupBy({
      by: ['eventType'],
      _count: true
    });
    
    console.log('✅ 데이터 정규화 완료');
    
    res.json({
      success: true,
      message: '데이터 정규화가 완료되었습니다.',
      stats: {
        gamesUpdated: updatedCount,
        galleryUpdated: galleryUpdatedCount,
        eventTypeDistribution: eventTypeStats
      }
    });
    
  } catch (error) {
    console.error('❌ 데이터 정규화 오류:', error);
    res.status(500).json({
      success: false,
      error: '데이터 정규화 중 오류가 발생했습니다.',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// 투표 알림 테스트 발송 API (테스트용 - 인증 없이 사용 가능)
router.post('/send-vote-notification-test', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: '이메일 주소가 필요합니다.' });
    }

    // 최신 투표 세션 가져오기
    const latestSession = await prisma.voteSession.findFirst({
      orderBy: { id: 'desc' },
      include: {
        votes: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    });

    if (!latestSession) {
      return res.status(404).json({ error: '활성화된 투표 세션이 없습니다.' });
    }

    // 투표 기간 계산
    const start = new Date(latestSession.weekStartDate || latestSession.startTime || Date.now());
    const startMonday = new Date(start);
    startMonday.setDate(startMonday.getDate() - ((startMonday.getDay() + 6) % 7));
    startMonday.setHours(0, 1, 0, 0);
    const endFriday = new Date(startMonday.getTime() + 4 * 24 * 60 * 60 * 1000);
    endFriday.setHours(23, 59, 59, 0);

    // 마감 계산 (목요일 17:00)
    const now = new Date();
    const currentDay = now.getDay();
    let daysUntilThursday = 0;
    if (currentDay <= 4) {
      daysUntilThursday = 4 - currentDay;
    } else {
      daysUntilThursday = 11 - currentDay;
    }
    const nextThursday = new Date(now);
    nextThursday.setDate(now.getDate() + daysUntilThursday);
    nextThursday.setHours(17, 0, 0, 0);

    // 날짜 포맷팅
    const days = ['일','월','화','수','목','금','토'];
    const startStr = `${startMonday.getFullYear()}. ${String(startMonday.getMonth()+1).padStart(2,'0')}. ${String(startMonday.getDate()).padStart(2,'0')}.(${days[startMonday.getDay()]})`;
    const endStr = startMonday.getFullYear() === endFriday.getFullYear() 
      ? `${String(endFriday.getMonth()+1).padStart(2,'0')}. ${String(endFriday.getDate()).padStart(2,'0')}.(${days[endFriday.getDay()]})`
      : `${endFriday.getFullYear()}. ${String(endFriday.getMonth()+1).padStart(2,'0')}. ${String(endFriday.getDate()).padStart(2,'0')}.(${days[endFriday.getDay()]})`;

    // 참여자 및 미참여자 계산
    const participants = latestSession.votes.map(v => ({ id: v.userId, name: v.user.name }));
    const allUsers = await prisma.user.findMany({
      select: { id: true, name: true }
    });
    const totalMembers = allUsers.length;
    const nonParticipants = allUsers.filter(user => 
      !participants.some(p => p.id === user.id)
    );

    const hoursUntilDeadline = Math.max(0, Math.ceil((nextThursday.getTime() - now.getTime()) / (1000 * 60 * 60)));

    // 프리뷰와 동일한 HTML 생성
    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 400px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; border-radius: 15px; color: white;">
        <div style="background: rgba(255, 255, 255, 0.1); padding: 30px; border-radius: 10px; margin-bottom: 30px;">
          <h2 style="margin: 0 0 20px 0; font-size: 20px; fontWeight: 800; text-align: center;">🗳️ 투표 알림</h2>
          
          <div style="background: rgba(255, 255, 255, 0.2); padding: 20px; border-radius: 8px; margin-top: 20px">
            <div style="margin-bottom: 15px; padding: 15px; background: rgba(255, 255, 255, 0.1); border-radius: 8px;">
              <div style="font-size: 14px; margin-bottom: 8px;">
                📅 투표 기간<br />
                ${startStr} ~ ${endStr}
              </div>
              <div style="font-size: 14px; margin-bottom: 5px;">
                👥 전체 회원: ${totalMembers}명
              </div>
              <div style="font-size: 14px; margin-bottom: 5px;">
                ✅ 투표 참여: ${participants.length}명
              </div>
              ${participants.length > 0 ? `
              <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;">
                ${participants.map(p => `
                  <span style="display: inline-block; padding: 2px 6px; background: #fff; color: #333; border-radius: 9999px; font-size: 10px; font-weight: 600; opacity: 0.9;">${p.name}</span>
                `).join('')}
              </div>
              ` : ''}
              <div style="font-size: 14px; margin-bottom: 5px;">
                ❌ 투표 미참여: ${nonParticipants.length}명
              </div>
              ${nonParticipants.length > 0 ? `
              <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;">
                ${nonParticipants.map(user => `
                  <span style="display: inline-block; padding: 2px 6px; background: rgba(255,255,255,0.85); color: #333; border-radius: 9999px; font-size: 10px; font-weight: 600;">${user.name}</span>
                `).join('')}
              </div>
              ` : ''}
              <div style="font-size: 14px;">
                ⏰ 마감까지: ${hoursUntilDeadline}시간
              </div>
            </div>
          </div>
        </div>
        
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="display: inline-block; background: rgba(255, 255, 255, 0.2); padding: 15px 25px; border-radius: 25px;">
            <span style="font-size: 14px; opacity: 0.9;">발송 시간: ${now.toLocaleString('ko-KR')}</span>
          </div>
        </div>
        
        <div style="text-align: center; font-size: 14px; opacity: 0.7;">
          <p style="margin: 0;">이 이메일은 자동으로 발송되었습니다.</p>
          <p style="margin: 5px 0 0 0;">FC CHAL GGYEO 관리 시스템</p>
        </div>
      </div>
    `;

    // 이메일 발송
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return res.status(500).json({ error: 'Gmail 환경변수가 설정되지 않았습니다.' });
    }

    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    await transporter.verify();
    console.log('✅ Gmail SMTP 연결 성공');

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: '🗳️ 투표 독려 알림',
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
    console.log(`📧 투표 알림 이메일 발송 완료: ${email}`);

    res.json({
      message: '투표 알림이 성공적으로 발송되었습니다.',
      email: email
    });

  } catch (error) {
    console.error('투표 알림 발송 오류:', error);
    res.status(500).json({ error: '투표 알림 발송 중 오류가 발생했습니다.', message: error.message });
  }
});

// 경기 알림 테스트 발송 API (테스트용 - 인증 없이 사용 가능)
router.post('/send-game-notification-test', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: '이메일 주소가 필요합니다.' });
    }

    // 미래 경기 가져오기
    const now = new Date();
    const futureGames = await prisma.game.findMany({
      where: {
        date: { gte: now }
      },
      include: {
        attendances: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      },
      orderBy: { date: 'asc' },
      take: 3
    });

    if (futureGames.length === 0) {
      return res.status(404).json({ error: '발송할 미래 경기가 없습니다.' });
    }

    // HTML 생성 (프리뷰와 동일한 형식)
    const items = futureGames.map((game: any) => {
      const names: string[] = game.attendances
        .filter((a: any) => a.user)
        .map((a: any) => a.user.name)
        .filter(Boolean);
      const merc = game.mercenaryCount || 0;
      const dateStr = new Date(game.date).toLocaleDateString('ko-KR', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        weekday: 'long' 
      });
      
      // location에서 세부 장소 제거 (마지막 공백 이후 부분 제거)
      const locationBase = game.location && game.location.includes(' ') 
        ? game.location.substring(0, game.location.lastIndexOf(' ')) 
        : game.location;
      
      return `
        <div style="margin-bottom: 15px; padding: 15px; background: rgba(255, 255, 255, 0.1); border-radius: 8px;">
          <div style="font-size: 14px; margin-bottom: 5px;">🏆 ${game.eventType || '자체'}</div>
          <div style="font-size: 14px; margin-bottom: 5px;">📅 ${dateStr} ${game.time ? `⏰ ${game.time}` : ''}</div>
          <div style="font-size: 14px; margin-bottom: 5px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: ${game.locationAddress ? '4px' : '0'};">
              📍 ${game.location || '장소 미정'}
              ${game.location && locationBase ? `<a href="https://map.kakao.com/link/search/${encodeURIComponent(locationBase)}" target="_blank" style="display:inline-block;background:#FFD700;color:#0066CC;text-decoration:none;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:700;margin-left:8px;">K</a>` : ''}
            </div>
            ${game.locationAddress ? `<div style="font-size: 12px; opacity: 0.9; padding-left: 24px;">${game.locationAddress}</div>` : ''}
          </div>
          <div style="font-size: 14px; margin-bottom: 5px;">👥 참가자: ${names.length + merc}명</div>
          ${(names.length > 0 || merc > 0) ? `<div style="font-size: 14px; margin-bottom: 5px; opacity: 0.9; display: flex; flex-wrap: wrap; gap: 4px;">${names.map(n => `<span style="background:#3182CE;color:#fff;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:500;">${n}</span>`).join('')}${merc > 0 ? `<span style="background:#2D3748;color:#fff;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:500;">용병 ${merc}명</span>` : ''}</div>` : ''}
        </div>`;
    }).join('');

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; border-radius: 15px; color: white;">
        <div style="background: rgba(255, 255, 255, 0.1); padding: 30px; border-radius: 10px; margin-bottom: 30px;">
          <h2 style="margin: 0 0 20px 0; font-size: 24px; text-align: center;">⚽ 경기 알림</h2>
          <p style="margin: 0 0 20px 0; font-size: 18px; line-height: 1.6; text-align: center;">확정된 경기 일정을 회원들에게 알립니다.</p>
          <div style="background: rgba(255, 255, 255, 0.2); padding: 20px; border-radius: 8px; margin-top: 20px;">
            <h3 style="margin: 0 0 15px 0; font-size: 20px; text-align: center;">다음 경기 일정</h3>
            ${items}
          </div>
        </div>
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="display: inline-block; background: rgba(255, 255, 255, 0.2); padding: 15px 25px; border-radius: 25px;">
            <span style="font-size: 14px; opacity: 0.9;">발송 시간: ${new Date().toLocaleString('ko-KR')}</span>
          </div>
        </div>
        <div style="text-align: center; font-size: 14px; opacity: 0.7;">
          <p style="margin: 0;">이 이메일은 자동으로 발송되었습니다.</p>
          <p style="margin: 5px 0 0 0;">FC CHAL GGYEO 관리 시스템</p>
        </div>
      </div>
    `;

    // 이메일 발송
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return res.status(500).json({ error: 'Gmail 환경변수가 설정되지 않았습니다.' });
    }

    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });

    await transporter.verify();
    console.log('✅ Gmail SMTP 연결 성공');

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: '⚽ 경기 알림',
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
    console.log(`📧 경기 알림 이메일 발송 완료: ${email}`);

    res.json({
      message: '경기 알림이 성공적으로 발송되었습니다.',
      email: email,
      gamesCount: futureGames.length
    });

  } catch (error) {
    console.error('경기 알림 발송 오류:', error);
    res.status(500).json({ error: '경기 알림 발송 중 오류가 발생했습니다.', message: error.message });
  }
});

export default router;
