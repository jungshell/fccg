import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import authRoutes from './routes/auth_simple';
import holidayRoutes from './routes/holiday';
import { calculateVoteAttendanceDetails, calculateGameAttendanceDetails, checkMemberStatusRules } from './controllers/authController';
import * as authController from './controllers/authController';
import bodyParser from 'body-parser';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const app = express();
const PORT = process.env.PORT || 4000;
const prisma = new PrismaClient();

console.log('서버 시작');

// JWT 인증 미들웨어
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: '액세스 토큰이 필요합니다.' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fc-chalggyeo-secret', (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ message: '유효하지 않은 토큰입니다.' });
    }
    req.user = user;
    next();
  });
};

// 미들웨어 - CORS 설정 (프로덕션 환경 포함)
const corsOptions = {
  origin: function (origin: string | undefined, callback: Function) {
    // 허용할 도메인 목록
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://fccg-inoi.vercel.app',
      process.env.FRONTEND_URL,
      process.env.CORS_ORIGIN
    ].filter(Boolean);
    
    // origin이 없거나 (같은 도메인 요청) 허용 목록에 있으면 허용
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // 개발 환경에서는 모든 origin 허용
      if (process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        console.log('⚠️ CORS 차단:', origin, '허용 목록:', allowedOrigins);
        callback(new Error('CORS 정책에 의해 차단되었습니다.'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'cache-control', 'Cache-Control'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
};

app.use(cors(corsOptions));
// app.use(express.json()); // 기존 코드 주석 처리
app.use(bodyParser.json({ limit: '50mb' })); // body-parser로 대체, 업로드용 크기 제한 증가
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' })); // multipart/form-data 지원

// 정적 파일 서빙 (업로드된 이미지)
app.use('/uploads', express.static('uploads'));
// 갤러리 이미지를 위한 별도 경로
app.use('/uploads/gallery', express.static('uploads/gallery'));

// 라우트 - authRoutes 사용 (직접 구현한 API보다 먼저 등록)
console.log('authRoutes 등록 시작');
app.use('/api/auth', authRoutes);
console.log('authRoutes 등록 완료');

// 공휴일 API 라우트 등록
console.log('holidayRoutes 등록 시작');
app.use('/api/holiday', holidayRoutes);
console.log('holidayRoutes 등록 완료');

// Gmail OAuth 콜백 엔드포인트 (직접 등록)
app.get('/auth/google/callback', async (req, res) => {
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

// 안전망 라우트 제거: authRoutes에서 모든 경로를 처리

// 라우트는 모두 authRoutes에서 처리 (중복 등록 제거)

// 통합 회원 및 경기 정보 조회 API
app.get('/api/auth/members', async (req, res) => {
  try {
    console.log('🔍 통합 API 호출 - 회원 및 경기 정보 조회');
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // 모든 회원 조회 (완전한 정보 포함)
    const members = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        attendance: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        statusChangedAt: true,
        statusChangeReason: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // 활성 투표 세션 조회
    const activeSession = await prisma.voteSession.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    console.log('🔍 통합 API - 활성 세션 확인:', {
      hasActiveSession: !!activeSession,
      activeSessionId: activeSession?.id,
      activeSessionIsActive: activeSession?.isActive,
      activeSessionWeekStart: activeSession?.weekStartDate
    });

    // 경기 조회 조건 설정
    let gameWhereCondition: any = {};
    
    // 활성 세션이 있으면 자동생성 일정은 표시하지 않음 (투표가 진행 중이므로)
    if (activeSession && activeSession.isActive) {
      console.log('📊 통합 API - 활성 세션 있음 - 자동생성일정 숨김');
      gameWhereCondition = { autoGenerated: false };
    } else {
      console.log('📊 통합 API - 활성 세션 없음 - 자동생성일정 표시');
      // 활성 세션이 없으면 (투표가 마감된 상태) 자동생성 일정도 표시
      // 최근 마감된 세션의 주간에 해당하는 자동생성 게임들을 표시
      const allCompletedSessions = await prisma.voteSession.findMany({
        where: { isCompleted: true },
        orderBy: { id: 'desc' }
      });
      
      // weekStartDate 기준으로 최신 세션 찾기
      const lastCompletedSession = allCompletedSessions
        .sort((a, b) => new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime())[0];
      
      console.log('🔍 통합 API - 마지막 완료된 세션:', {
        hasLastCompletedSession: !!lastCompletedSession,
        lastCompletedSessionId: lastCompletedSession?.id,
        lastCompletedSessionWeekStart: lastCompletedSession?.weekStartDate
      });
      
      if (lastCompletedSession) {
        const weekStart = new Date(lastCompletedSession.weekStartDate);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6); // 주말까지
        
        console.log('📅 통합 API - 자동생성일정 필터링 범위:', {
          weekStart: weekStart.toLocaleDateString(),
          weekEnd: weekEnd.toLocaleDateString()
        });
        
        gameWhereCondition = {
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
        console.log('📊 통합 API - 마감된 세션 없음 - 수동생성일정만 표시');
        gameWhereCondition = { autoGenerated: false };
      }
    }

    // 경기 조회
    const games = await prisma.game.findMany({
      where: gameWhereCondition,
      select: {
        id: true,
        date: true,
        time: true,
        location: true,
        gameType: true,
        eventType: true,
        mercenaryCount: true,
        memberNames: true,
        selectedMembers: true,
        autoGenerated: true,
        confirmed: true,
        createdById: true,
        createdBy: {
          select: {
            id: true,
            name: true
          }
        },
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        date: 'asc'
      }
    });

        // 각 경기에 대해 전체 참가자 수 계산
        const gamesWithTotalCount = games.map(game => {
          let totalCount = 0;
          let allParticipantNames = [];
          let uniqueSelectedMembers = [];
          let uniqueMemberNames = [];

          // selectedMembers 파싱 (주요 참가자)
          try {
            const selectedMembers = typeof game.selectedMembers === 'string' 
              ? JSON.parse(game.selectedMembers) 
              : game.selectedMembers || [];
            
            // 실제 회원 목록과 매칭하여 중복 제거
            const actualMemberNames = members.map(m => m.name);
            uniqueSelectedMembers = selectedMembers.filter(name => 
              actualMemberNames.includes(name)
            );
            
            // 중복 제거 (같은 이름이 여러 번 나올 경우)
            uniqueSelectedMembers = [...new Set(uniqueSelectedMembers)];
            totalCount += uniqueSelectedMembers.length;
            allParticipantNames = [...allParticipantNames, ...uniqueSelectedMembers];
          } catch (error) {
            console.warn('⚠️ selectedMembers 파싱 오류:', error);
          }

          // memberNames 파싱 (추가 참가자 - 중복 제거)
          try {
            const memberNames = typeof game.memberNames === 'string' 
              ? JSON.parse(game.memberNames) 
              : game.memberNames || [];
            
            // selectedMembers에 없는 이름만 추가
            uniqueMemberNames = memberNames.filter(name => 
              !allParticipantNames.includes(name)
            );
            totalCount += uniqueMemberNames.length;
            allParticipantNames = [...allParticipantNames, ...uniqueMemberNames];
          } catch (error) {
            console.warn('⚠️ memberNames 파싱 오류:', error);
          }

          // mercenaryCount 추가
          totalCount += game.mercenaryCount || 0;

      console.log(`🔍 경기 ${game.id} 참가자 계산:`, {
        selectedMembers: game.selectedMembers,
        memberNames: game.memberNames,
        mercenaryCount: game.mercenaryCount,
        totalCount,
        allParticipantNames,
        uniqueSelectedMembers,
        uniqueMemberNames,
        actualMemberNames: members.map(m => m.name)
      });

      return {
        ...game,
        totalParticipantCount: totalCount,
        allParticipantNames: allParticipantNames
      };
    });
    
    console.log('🔍 경기 목록 필터링:', {
      activeSession: activeSession ? activeSession.weekStartDate : '없음',
      isActive: activeSession ? activeSession.isActive : false,
      totalGames: gamesWithTotalCount.length,
      autoGenerated: gamesWithTotalCount.filter(g => g.autoGenerated).length
    });
    
    console.log('✅ 통합 데이터 조회 성공:', members.length, '명 회원,', gamesWithTotalCount.length, '경기');
    console.log('📋 첫 번째 회원 데이터:', {
      id: members[0]?.id,
      name: members[0]?.name,
      email: members[0]?.email,
      createdAt: members[0]?.createdAt
    });
    
    const response = { 
      members,
      games: gamesWithTotalCount,
      totalMembers: members.length,
      totalGames: gamesWithTotalCount.length,
      activeMembers: members.filter(m => m.status === 'ACTIVE').length
    };
    
    console.log('📤 응답 데이터 구조:', {
      membersCount: response.members.length,
      gamesCount: response.games.length,
      firstMemberFields: Object.keys(response.members[0] || {}),
      firstGameFields: Object.keys(response.games[0] || {}),
      firstGameData: response.games[0]
    });
    
    res.json(response);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ 통합 데이터 조회 API 오류:', error);
    res.status(500).json({ error: '데이터를 가져오는 중 오류가 발생했습니다.' });
  }
});

// 중복/직접 라우트 제거: 통합 및 결과 API는 모두 authRoutes에서 처리

// 프로필 조회 API
app.get('/api/auth/profile', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    console.log('🔍 직접 등록된 /api/auth/profile 호출됨, userId:', userId);
    
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // 사용자 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        avatarUrl: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    if (!user) {
      await prisma.$disconnect();
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    
    // 투표 참여 상세 정보 계산 (직접 구현)
    const fs = require('fs');
    const path = require('path');
    const voteDataPath = path.join(process.cwd(), 'voteData.json');
    
    let voteData = [];
    if (fs.existsSync(voteDataPath)) {
      const data = fs.readFileSync(voteDataPath, 'utf8');
      voteData = JSON.parse(data);
    }
    
    // 주간 투표 창(월 00:01 ~ 목 17:00) 계산 - 매주 동일 규칙
    const currentTime = new Date();
    const currentWeekStart = new Date(currentTime);
    // getDay(): 일0 월1 ... 토6 → 이번주 월요일로 이동
    const dow = currentWeekStart.getDay();
    const deltaToMonday = dow === 0 ? -6 : (1 - dow);
    currentWeekStart.setDate(currentWeekStart.getDate() + deltaToMonday);
    currentWeekStart.setHours(0, 1, 0, 0); // 월요일 00:01
    
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekStart.getDate() + 3); // 목요일
    currentWeekEnd.setHours(17, 0, 0, 0); // 목요일 17:00
    
    // 현재 날짜가 목요일 17:00 이후라면 다음 주 투표 창으로 확장
    if (currentTime > currentWeekEnd) {
      // 다음 주 월요일부터 목요일까지로 확장
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
      currentWeekEnd.setDate(currentWeekEnd.getDate() + 7);
    }
    
    // 활성 투표 세션 확인 (현재 주 또는 다음 주)
    const activeVoteSessions = new Set(voteData.map((vote: any) => vote.sessionId));
    const userVotes = voteData.filter((vote: any) => vote.userId === userId);
    
    // 사용자가 이번 주 투표 창 내에서 투표했는지 확인
    const recentUserVotes = userVotes.filter((vote: any) => {
      const voteDate = new Date(vote.timestamp);
      return voteDate >= currentWeekStart && voteDate < currentWeekEnd;
    });
    
    console.log('투표 데이터 계산:', {
      userId,
      totalVotes: voteData.length,
      userVotes: userVotes.length,
      recentUserVotes: recentUserVotes.length,
      activeSessions: Array.from(activeVoteSessions),
      weekRange: `${currentWeekStart.toISOString().split('T')[0]} ~ ${currentWeekEnd.toISOString().split('T')[0]}`
    });
    
    // 헤더 투표율 계산 - DB 기준으로 정확히 계산
    const prismaClient = new PrismaClient();
    const totalVoteSessions = await prismaClient.voteSession.count();
    const participatedSessions = await prismaClient.vote.count({ where: { userId } });
    
    // 세션 상세 정보 조회 (투표율 근거 제공)
    const allSessions = await prismaClient.voteSession.findMany({
      orderBy: { createdAt: 'desc' },
      include: { votes: { where: { userId } } }
    });
    
    const sessionDetails = allSessions.map((session: any) => ({
      id: session.id,
      weekStartDate: session.weekStartDate,
      isActive: session.isActive,
      isCompleted: session.isCompleted,
      userParticipated: session.votes.length > 0,
      createdAt: session.createdAt
    }));
    
    const voteDetails = {
      total: totalVoteSessions,
      participated: participatedSessions,
      missed: Math.max(0, totalVoteSessions - participatedSessions),
      sessions: sessionDetails
    };
    
    // 디버그 로그 (전체 투표 세션 기준)
    console.log('전체 투표 세션 기준(DB):', { 
      totalVoteSessions, 
      participatedSessions,
      sessionDetails: sessionDetails.map((s: any) => ({
        id: s.id,
        weekStart: s.weekStartDate,
        participated: s.userParticipated,
        status: s.isActive ? 'active' : (s.isCompleted ? 'completed' : 'pending')
      }))
    });
    
    // 헤더 투표율: 전체 투표 세션 중 참여한 비율
    const voteAttendance = totalVoteSessions > 0 ? Math.round((participatedSessions / totalVoteSessions) * 100) : 0;
    
    // 경기 참여 상세 정보 계산 (확정된 경기만 분모로 사용)
    const allGames = await prisma.game.findMany({ where: { confirmed: true } });
    
    // 사용자의 실제 출석 기록 조회 (해당 경기도 확정된 것만 카운트)
    const attendanceRecords = await prisma.attendance.findMany({
      where: { userId: user.id },
      include: { game: true }
    });
    
    // 참여한 경기 수: 출석 YES 이면서 해당 경기가 확정된 경우만
    const participatedGames = attendanceRecords.filter(att => att.status === 'YES' && att.game?.confirmed).length;
    
    console.log('투표율 계산:', {
      total: voteDetails.total,
      participated: voteDetails.participated,
      voteAttendance
    });
    
    // 경기 참여 상세 정보 계산
    const gameDetails = {
      total: allGames.length,
      participated: participatedGames,
      missed: Math.max(0, allGames.length - participatedGames)
    };
    
    // 경기 참여율 계산
    const gameAttendance = gameDetails.total > 0 ? 
      Math.round((gameDetails.participated / gameDetails.total) * 100) : 0;
    
    console.log('경기 참여율 계산:', {
      totalGames: allGames.length,
      participatedGames,
      gameAttendance,
      attendanceRecords: attendanceRecords.length,
      userId: user.id
    });
    
    const profileData = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      voteAttendance,
      attendance: gameAttendance,
      voteDetails,
      gameDetails
    };
    
    console.log('✅ 프로필 조회 성공:', profileData);
    res.json(profileData);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ 프로필 조회 오류:', error);
    res.status(500).json({ error: '프로필을 가져오는 중 오류가 발생했습니다.' });
  }
});

// 투표 데이터 로드 함수
function loadVoteData() {
  try {
    const fs = require('fs');
    const path = require('path');
    const voteDataPath = path.join(process.cwd(), 'backend/voteData.json');
    
    console.log('투표 데이터 파일 경로:', voteDataPath);
    
    if (fs.existsSync(voteDataPath)) {
      const data = fs.readFileSync(voteDataPath, 'utf8');
      const parsedData = JSON.parse(data);
      console.log('투표 데이터 로드 성공:', parsedData.length, '개');
      return parsedData;
    } else {
      console.log('투표 데이터 파일이 존재하지 않음:', voteDataPath);
      return [];
    }
  } catch (error) {
    console.error('투표 데이터 파일 읽기 오류:', error);
    return [];
  }
}

// 투표 데이터 API
app.get('/api/votes', (req, res) => {
  try {
    console.log('🔍 투표 데이터 API 호출됨');
    const fs = require('fs');
    const path = require('path');
    const voteDataPath = path.join(process.cwd(), 'voteData.json');
    
    console.log('투표 데이터 파일 경로:', voteDataPath);
    
    if (fs.existsSync(voteDataPath)) {
      const data = fs.readFileSync(voteDataPath, 'utf8');
      const parsedData = JSON.parse(data);
      console.log('투표 데이터 로드 성공:', parsedData.length, '개');
      res.json(parsedData);
    } else {
      console.log('투표 데이터 파일이 존재하지 않음:', voteDataPath);
      res.json([]);
    }
  } catch (error) {
    console.error('투표 데이터 로드 오류:', error);
    res.status(500).json({ error: '투표 데이터를 불러올 수 없습니다.' });
  }
});

// 멤버 통계 API
app.get('/api/auth/members/stats', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }
    
    // 전체 멤버 수
    const totalMembers = await prisma.user.count({
      where: { status: 'ACTIVE' }
    });
    
    // 활성 멤버 수
    const activeMembers = await prisma.user.count({
      where: { status: 'ACTIVE' }
    });
    
    // 이번 주 경기 수
    const currentTime = new Date();
    const startOfWeek = new Date(currentTime);
    startOfWeek.setDate(currentTime.getDate() - currentTime.getDay() + 1); // 월요일
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // 일요일
    
    const thisWeekGames = await prisma.game.count({
      where: {
        date: {
          gte: startOfWeek,
          lte: endOfWeek
        }
      }
    });
    
    // 다음 주 투표 세션
    const nextWeekVote = await prisma.voteSession.findFirst({
      where: {
        isActive: true
      }
    });
    
    const stats = {
      totalMembers,
      activeMembers,
      thisWeekGames,
      nextWeekVote: nextWeekVote ? {
        id: nextWeekVote.id,
        weekStartDate: nextWeekVote.weekStartDate,
        endTime: nextWeekVote.endTime,
        isActive: nextWeekVote.isActive
      } : null
    };
    
    console.log('📊 멤버 통계 조회:', stats);
    res.json(stats);
    
  } catch (error) {
    console.error('❌ 멤버 통계 조회 오류:', error);
    res.status(500).json({ error: '통계 조회 중 오류가 발생했습니다.' });
  }
});

// 멤버 통계 API (admin 경로)
app.get('/api/auth/admin/member-stats', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }
    
    // 전체 멤버 수
    const totalMembers = await prisma.user.count({
      where: { status: 'ACTIVE' }
    });
    
    // 활성 멤버 수
    const activeMembers = await prisma.user.count({
      where: { status: 'ACTIVE' }
    });
    
    // 이번 주 경기 수
    const currentTime = new Date();
    const startOfWeek = new Date(currentTime);
    startOfWeek.setDate(currentTime.getDate() - currentTime.getDay() + 1); // 월요일
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // 일요일
    
    const thisWeekGames = await prisma.game.count({
      where: {
        date: {
          gte: startOfWeek,
          lte: endOfWeek
        }
      }
    });
    
    // 다음 주 투표 세션
    const nextWeekVote = await prisma.voteSession.findFirst({
      where: {
        isActive: true
      }
    });
    
    const stats = {
      totalMembers,
      activeMembers,
      thisWeekGames,
      nextWeekVote: nextWeekVote ? {
        id: nextWeekVote.id,
        weekStartDate: nextWeekVote.weekStartDate,
        endTime: nextWeekVote.endTime,
        isActive: nextWeekVote.isActive
      } : null
    };
    
    console.log('📊 멤버 통계 조회 (admin):', stats);
    res.json(stats);
    
  } catch (error) {
    console.error('❌ 멤버 통계 조회 오류 (admin):', error);
    res.status(500).json({ error: '통계 조회 중 오류가 발생했습니다.' });
  }
});

// 회원 추가 API (관리자용)
app.post('/api/auth/members', authenticateToken, async (req, res) => {
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

// 투표 재설정 API (인증 필요)
app.delete('/api/votes/reset', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    
    console.log('🗑️ 투표 재설정 API 호출됨:', { userId });
    
    if (!userId) {
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }
    
    // 투표 데이터 파일에서 해당 사용자의 투표 삭제
    const fs = require('fs');
    const path = require('path');
    const voteDataPath = path.join(process.cwd(), 'voteData.json');
    
    let voteData = [];
    if (fs.existsSync(voteDataPath)) {
      const data = fs.readFileSync(voteDataPath, 'utf8');
      voteData = JSON.parse(data);
    }
    
    // 해당 사용자의 투표 데이터 삭제
    const originalLength = voteData.length;
    voteData = voteData.filter(vote => vote.userId !== userId);
    const deletedCount = originalLength - voteData.length;
    
    // 파일에 저장
    fs.writeFileSync(voteDataPath, JSON.stringify(voteData, null, 2));
    
    console.log('✅ 투표 재설정 성공:', { userId, deletedCount });
    res.json({ message: '투표가 재설정되었습니다.', deletedCount });
    
  } catch (error) {
    console.error('❌ 투표 재설정 오류:', error);
    res.status(500).json({ error: '투표 재설정 중 오류가 발생했습니다.' });
  }
});

// 투표 제출 API (인증 필요) - 데이터베이스 저장
app.post('/api/votes', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const { selectedDays, timestamp } = req.body;
    
    console.log('🗳️ 투표 제출 API 호출됨:', {
      userId,
      selectedDays,
      timestamp,
      userFromToken: (req as any).user
    });
    
    if (!userId) {
      console.log('❌ 투표 제출 실패: userId 없음');
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }
    
    if (!selectedDays || !Array.isArray(selectedDays)) {
      return res.status(400).json({ error: '선택된 날짜가 필요합니다.' });
    }
    
    console.log('🗳️ 투표 제출:', { userId, selectedDays, timestamp });
    
    const prismaClient = new PrismaClient();
    
    // 1. 현재 활성 투표 세션 찾기
    const activeSession = await prismaClient.voteSession.findFirst({
      where: {
        isActive: true,
        isCompleted: false
      }
    });
    
    if (!activeSession) {
      await prismaClient.$disconnect();
      return res.status(400).json({ error: '활성 투표 세션이 없습니다.' });
    }
    
    // 2. 기존 투표가 있는지 확인
    const existingVote = await prismaClient.vote.findFirst({
      where: {
        userId: userId,
        voteSessionId: activeSession.id
      }
    });
    
    let voteResult;
    if (existingVote) {
      // 기존 투표 업데이트
      voteResult = await prismaClient.vote.update({
        where: { id: existingVote.id },
        data: {
          selectedDays: JSON.stringify(selectedDays),
          updatedAt: new Date()
        }
      });
      console.log('✅ 기존 투표 업데이트:', voteResult);
    } else {
      // 새로운 투표 생성
      voteResult = await prismaClient.vote.create({
        data: {
          userId: userId,
          voteSessionId: activeSession.id,
          selectedDays: JSON.stringify(selectedDays),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      console.log('✅ 새로운 투표 생성:', voteResult);
    }
    
    // 3. 파일에도 백업 저장 (호환성 유지)
    const fs = require('fs');
    const path = require('path');
    const voteDataPath = path.join(process.cwd(), 'voteData.json');
    
    let voteData = [];
    if (fs.existsSync(voteDataPath)) {
      const data = fs.readFileSync(voteDataPath, 'utf8');
      voteData = JSON.parse(data);
    }
    
    // 기존 투표 제거 후 새 투표 추가
    voteData = voteData.filter((vote: any) => vote.userId !== userId);
    voteData.push({
      id: voteResult.id,
      userId: userId,
      selectedDays: selectedDays,
      timestamp: voteResult.createdAt.toISOString(),
      sessionId: activeSession.id
    });
    
    fs.writeFileSync(voteDataPath, JSON.stringify(voteData, null, 2));
    
    await prismaClient.$disconnect();
    
    console.log('✅ 투표 데이터 저장 성공 (DB + 파일):', voteResult);
    res.json({ 
      message: '투표가 성공적으로 저장되었습니다.', 
      vote: {
        id: voteResult.id,
        userId: userId,
        selectedDays: selectedDays,
        sessionId: activeSession.id,
        isUpdate: !!existingVote
      }
    });
    
  } catch (error) {
    console.error('❌ 투표 제출 오류:', error);
    res.status(500).json({ error: '투표 제출 중 오류가 발생했습니다.' });
  }
});

console.log('긴급 수정: 직접 API 등록 완료');

// authRoutes 테스트
app.get('/api/auth-test', (req, res) => {
  res.json({ message: 'authRoutes 테스트 성공!', timestamp: new Date().toISOString() });
});
console.log('✅ authRoutes 테스트 라우트 등록 완료: /api/auth-test');

// 중복된 API 제거 - authRoutes에서 제공됨

// 중복된 회원 추가 API 제거 - authRoutes에서 제공됨

// 중복된 회원 수정 API 제거 - authRoutes에서 제공됨

// 중복된 회원 삭제 API 제거 - authRoutes에서 제공됨

// 중복된 비밀번호 초기화 API 제거 - authRoutes에서 제공됨

// 중복된 긴급 회원 관리 API 제거 - authRoutes에서 제공됨

// 주석 처리된 중복 API 제거됨

// 카카오맵 장소 검색 API - 직접 등록
app.get('/api/auth/search-location', async (req, res) => {
  try {
    const { query } = req.query;
    
    console.log('🔍 장소 검색 요청:', query);
    
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      console.log('❌ 유효하지 않은 검색어:', query);
      return res.status(400).json({ error: '유효한 검색어가 필요합니다.' });
    }
    
    // 검색어 길이 제한 (너무 긴 요청 방지)
    if (query.length > 100) {
      console.log('❌ 검색어가 너무 김:', query.length);
      return res.status(400).json({ error: '검색어는 100자 이하여야 합니다.' });
    }

    // 카카오맵 API 키 (환경변수에서 읽기, 없으면 기본값 사용)
    const KAKAO_API_KEY = process.env.KAKAO_API_KEY || '4413813ca702d0fb6239ae38d9202d7e';
    
    if (!KAKAO_API_KEY) {
      console.log('❌ 카카오맵 API 키가 설정되지 않음');
      return res.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });
    }
    
    console.log('🌐 카카오맵 API 호출 시작...');
    console.log('📡 요청 URL:', 'https://dapi.kakao.com/v2/local/search/keyword.json');
    console.log('📝 검색어:', query.toString());
    
    // 카카오맵 API 호출
    const response = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
      headers: {
        'Authorization': `KakaoAK ${KAKAO_API_KEY}`
      },
      params: {
        query: query.toString(),
        size: 10
      }
    });

    console.log('✅ 카카오맵 API 응답 성공:', response.status);
    console.log('📊 검색 결과 수:', response.data.documents?.length || 0);
    
    res.json(response.data);
  } catch (error: any) {
    console.error('❌ 장소 검색 오류:', error);
    if (error.response) {
      console.error('🚫 API 응답 오류:', error.response.status, error.response.data);
    }
    res.status(500).json({ error: '장소 검색 중 오류가 발생했습니다.' });
  }
});

// 경기 관리 API
// 중복된 경기 생성 API 제거 - authRoutes에서 제공됨

// 게임 조회/수정/삭제는 authRoutes(auth_simple)에서만 처리 (중복 제거)

// 중복된 경기 삭제/자동생성 API 제거 - authRoutes에서 제공됨

// 중복된 경기 수정 API 제거 - authRoutes에서 제공됨

// 비밀번호 변경 API는 authController에서 처리

// 중복된 프로필 수정 API 제거 - authRoutes에서 제공됨

// 로그인 라우트 - authRoutes로 이동됨
// app.post('/api/auth/login', ...

// 자동화 기능 제거됨 - 수동 관리로 전환

// 자동화 기능 제거됨 - 수동 관리로 전환

// 대시보드 통계 API 추가
// 중복된 통계 API 제거 - authRoutes에서 제공됨

// 중복된 API 제거됨 - /api/auth/members로 통합

// 중복된 통합 API 제거 - authRoutes에서 제공됨

// 중복된 프로필 API 제거 - authRoutes에서 제공됨


// 투표 데이터 API
// 중복된 투표 데이터 API 제거 - authRoutes에서 제공됨

// 회원 상태 자동 체크 API
app.post('/api/admin/check-member-status', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user?.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    }
    
    const { checkMemberStatusRules } = require('./controllers/authController');
    await checkMemberStatusRules();
    
    res.json({ message: '회원 상태 체크가 완료되었습니다.' });
  } catch (error) {
    console.error('회원 상태 체크 API 오류:', error);
    res.status(500).json({ error: '회원 상태 체크 중 오류가 발생했습니다.' });
  }
});
console.log('✅ 회원 상태 체크 API 등록 완료: /api/admin/check-member-status');


// 간단한 테스트 API
app.get('/api/test', (req, res) => {
  res.json({ message: '테스트 API가 작동합니다!', timestamp: new Date().toISOString() });
});
console.log('✅ 테스트 API 등록 완료: /api/test');

// 로그인 API 직접 구현
// 중복된 로그인/회원가입 API 제거 - authRoutes에서 제공됨

// 자동화 기능 제거됨 - 수동 관리로 전환

console.log('✅ 회원 상태 자동 체크 스케줄러 설정 완료: 매일 오전 9시');

// 매주 월요일 00:01 자동 작업 스케줄러
// 1. 다음주 투표 세션 생성
// 2. 지난주 투표결과를 이번주 일정에 반영
cron.schedule('1 0 * * 1', async () => {
  try {
    console.log('🔄 매주 월요일 00:01 자동 작업 시작...');
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // 현재 시간 (한국시간 기준)
    const currentTime = new Date();
    const koreaTime = new Date(currentTime.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    
    // 1. 다음주 월요일 계산 (다음주 투표 세션 생성용)
    const nextWeekMonday = new Date(koreaTime);
    nextWeekMonday.setDate(koreaTime.getDate() + 7);
    const daysUntilMonday = (8 - nextWeekMonday.getDay()) % 7;
    nextWeekMonday.setDate(nextWeekMonday.getDate() + daysUntilMonday);
    nextWeekMonday.setHours(0, 1, 0, 0);
    
    // 다음주 금요일 계산 (투표 마감일)
    const nextWeekFriday = new Date(nextWeekMonday);
    nextWeekFriday.setDate(nextWeekMonday.getDate() + 4);
    nextWeekFriday.setHours(17, 0, 0, 0);
    
    // 이번주 월요일 계산 (의견수렴기간 시작일)
    const thisWeekMonday = new Date(koreaTime);
    const daysUntilThisMonday = (8 - thisWeekMonday.getDay()) % 7;
    if (daysUntilThisMonday !== 0) {
      thisWeekMonday.setDate(thisWeekMonday.getDate() - (7 - daysUntilThisMonday));
    }
    thisWeekMonday.setHours(0, 1, 0, 0);
    
    // 중복 체크
    const existingSession = await prisma.voteSession.findFirst({
      where: {
        weekStartDate: {
          gte: new Date(nextWeekMonday.getTime() - 7 * 24 * 60 * 60 * 1000),
          lte: new Date(nextWeekMonday.getTime() + 7 * 24 * 60 * 60 * 1000)
        }
      }
    });
    
    if (!existingSession) {
      // 다음주 투표 세션 생성
      const newVoteSession = await prisma.voteSession.create({
        data: {
          weekStartDate: nextWeekMonday,
          startTime: thisWeekMonday,
          endTime: nextWeekFriday,
          isActive: true,
          isCompleted: false
        }
      });
          console.log('✅ 다음주 투표 세션 자동 생성 완료:', newVoteSession.id, '주간:', nextWeekMonday.toLocaleDateString('ko-KR'));
    } else {
      console.log('⚠️ 이미 해당 주간의 투표 세션이 존재합니다:', existingSession.id);
    }
    
    // 2. 지난주 투표결과를 이번주 일정에 반영 (자동생성 경기 생성)
    const lastWeekMonday = new Date(thisWeekMonday);
    lastWeekMonday.setDate(thisWeekMonday.getDate() - 7);
    const lastWeekFriday = new Date(lastWeekMonday);
    lastWeekFriday.setDate(lastWeekMonday.getDate() + 4);
    lastWeekFriday.setHours(23, 59, 59, 999);
    
    // 지난주 완료된 세션 찾기
    const lastWeekSession = await prisma.voteSession.findFirst({
      where: {
        isCompleted: true,
        weekStartDate: {
          gte: lastWeekMonday,
          lte: lastWeekFriday
        },
        votes: { some: {} }
      },
      include: {
        votes: {
          include: { user: { select: { name: true } } }
        }
      },
      orderBy: { weekStartDate: 'desc' }
    });
    
    if (lastWeekSession && lastWeekSession.votes.length > 0) {
      const weekStart = new Date(lastWeekSession.weekStartDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      // 기존 자동생성일정 정리
      const deleted = await prisma.game.deleteMany({
        where: {
          autoGenerated: true,
          date: { gte: weekStart, lte: weekEnd }
        }
      });
      console.log('🧹 지난주 자동생성일정 정리:', deleted.count, '개 삭제');
      
      // 투표 결과 집계
      type DayKey = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
      const counts: Record<DayKey, number> = { MON: 0, TUE: 0, WED: 0, THU: 0, FRI: 0, SAT: 0, SUN: 0 };
      const participantsByDay: Record<DayKey, string[]> = { MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: [] };
      
      for (const v of lastWeekSession.votes) {
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
      
      if (max > 0) {
        const topDays = (Object.keys(counts) as DayKey[]).filter((k) => counts[k] === max);
        const dayOffset: Record<DayKey, number> = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5, SUN: 6 };
        const creatorId = lastWeekSession.votes[0]?.userId ?? 1;
        
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
          console.log('✅ 지난주 투표결과 반영 자동생성일정:', day, date.toISOString().split('T')[0]);
        }
      }
    } else {
      console.log('ℹ️ 지난주 완료된 투표 세션이 없습니다.');
    }
    
    await prisma.$disconnect();
    console.log('✅ 매주 월요일 00:01 자동 작업 완료');
  } catch (error) {
    console.error('❌ 매주 월요일 자동 작업 오류:', error);
  }
}, {
  timezone: 'Asia/Seoul'
});

console.log('✅ 매주 월요일 00:01 자동 작업 스케줄러 설정 완료');

// 중복된 경기 수정/삭제 API 제거됨 (auth_simple 사용)

app.listen(PORT, () => {
  console.log(`서버가 ${PORT}번 포트에서 실행 중`);
});
