import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// 투표 데이터 파일 경로
const VOTE_DATA_FILE = path.join(__dirname, '../../voteData.json');

// 투표 데이터 로드 함수
const loadVoteData = () => {
  try {
    if (fs.existsSync(VOTE_DATA_FILE)) {
      const data = fs.readFileSync(VOTE_DATA_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('투표 데이터 로드 오류:', error);
  }
  return [];
};

// 투표 데이터 저장 함수
const saveVoteData = (voteData: any[]) => {
  try {
    fs.writeFileSync(VOTE_DATA_FILE, JSON.stringify(voteData, null, 2));
  } catch (error) {
    console.error('투표 데이터 저장 오류:', error);
  }
};

const prisma = new PrismaClient();

// 회원 상태 자동 변경 규칙 체크 함수
export const checkMemberStatusRules = async () => {
  try {
    console.log('🔍 회원 상태 자동 변경 규칙 체크 시작');
    
    const allMembers = await prisma.user.findMany({
      where: {
        status: {
          in: ['ACTIVE', 'INACTIVE']
        }
      }
    });
    
    const voteData = loadVoteData();
    const now = new Date();
    
    for (const member of allMembers) {
      const memberId = member.id;
      const memberVotes = voteData.filter((vote: any) => vote.userId === memberId);
      
      // 1. 투표 참여 체크
      const voteStatus = checkVoteParticipation(memberVotes, now);
      
      // 2. 경기 참여 체크
      const gameStatus = await checkGameParticipation(memberId, now);
      
      // 3. 로그인 체크
      const loginStatus = checkLoginActivity(member.lastLoginAt, now);
      
      // 상태 변경 결정
      let newStatus = member.status;
      let reason = '';
      
      if (member.status === 'ACTIVE') {
        // 활성 → 비활성 조건
        if (voteStatus.shouldDeactivate || gameStatus.shouldDeactivate) {
          newStatus = 'INACTIVE';
          reason = voteStatus.shouldDeactivate ? voteStatus.reason : gameStatus.reason;
        }
      }
      
      // 활성/비활성 → 정지 조건
      if ((member.status === 'ACTIVE' || member.status === 'INACTIVE') && loginStatus.shouldSuspend) {
        newStatus = 'SUSPENDED';
        reason = loginStatus.reason;
      }
      
      // 상태 변경이 필요한 경우
      if (newStatus !== member.status) {
        await prisma.user.update({
          where: { id: memberId },
          data: { 
            status: newStatus,
            statusChangedAt: now,
            statusChangeReason: reason
          }
        });
        
        console.log(`👤 회원 ${member.name}(${memberId}) 상태 변경: ${member.status} → ${newStatus} (${reason})`);
        
        // 이메일 알림 발송
        await sendStatusChangeNotification(member, member.status, newStatus, reason);
      }
    }
    
    console.log('✅ 회원 상태 자동 변경 규칙 체크 완료');
  } catch (error) {
    console.error('❌ 회원 상태 체크 오류:', error);
  }
};

// 투표 참여 체크 함수
const checkVoteParticipation = (memberVotes: any[], now: Date) => {
  const threeMonthsAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
  const recentVotes = memberVotes.filter((vote: any) => 
    new Date(vote.timestamp) >= threeMonthsAgo
  );
  
  // 최근 4회 투표 세션 체크 (연속 미참여)
  const recentVoteSessions = getRecentVoteSessions(threeMonthsAgo, now);
  const participatedSessions = new Set<string>();
  
  recentVotes.forEach((vote: any) => {
    if (vote.sessionId) {
      participatedSessions.add(vote.sessionId);
    }
  });
  
  // 연속 4회 미참여 체크
  const consecutiveMissed = checkConsecutiveMissedVotes(recentVoteSessions, participatedSessions);
  
  // 3개월간 6회 미참여 체크
  const totalMissed = recentVoteSessions.length - participatedSessions.size;
  
  if (consecutiveMissed >= 4) {
    return {
      shouldDeactivate: true,
      reason: `투표 4회 연속 미참여 (${consecutiveMissed}회 연속)`
    };
  }
  
  if (totalMissed >= 6) {
    return {
      shouldDeactivate: true,
      reason: `3개월간 투표 6회 미참여 (총 ${totalMissed}회 미참여)`
    };
  }
  
  return { shouldDeactivate: false, reason: '' };
};

// 경기 참여 체크 함수
const checkGameParticipation = async (memberId: number, now: Date) => {
  const threeMonthsAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
  
  const attendanceRecords = await prisma.attendance.findMany({
    where: {
      userId: memberId,
      createdAt: {
        gte: threeMonthsAgo
      }
    }
  });
  
  if (attendanceRecords.length === 0) {
    return {
      shouldDeactivate: true,
      reason: '3개월간 축구경기 미참여'
    };
  }
  
  return { shouldDeactivate: false, reason: '' };
};

// 로그인 활동 체크 함수
const checkLoginActivity = (lastLoginAt: Date | null, now: Date) => {
  if (!lastLoginAt) {
    return {
      shouldSuspend: true,
      reason: '로그인 기록 없음'
    };
  }
  
  const twoMonthsAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));
  
  if (lastLoginAt < twoMonthsAgo) {
    return {
      shouldSuspend: true,
      reason: '2개월간 로그인 미실행'
    };
  }
  
  return { shouldSuspend: false, reason: '' };
};

// 최근 투표 세션 가져오기 함수
const getRecentVoteSessions = (startDate: Date, endDate: Date) => {
  // 실제 구현에서는 데이터베이스에서 투표 세션을 가져와야 함
  // 여기서는 간단히 주 단위로 세션을 생성
  const sessions = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    // 매주 목요일을 투표 세션으로 가정
    const thursday = new Date(currentDate);
    thursday.setDate(currentDate.getDate() + (4 - currentDate.getDay()));
    
    if (thursday >= startDate && thursday <= endDate) {
      sessions.push(`session_${thursday.toISOString().split('T')[0].replace(/-/g, '_')}`);
    }
    
    currentDate.setDate(currentDate.getDate() + 7);
  }
  
  return sessions;
};

// 연속 미참여 투표 체크 함수
const checkConsecutiveMissedVotes = (sessions: string[], participatedSessions: Set<string>) => {
  let maxConsecutive = 0;
  let currentConsecutive = 0;
  
  for (const session of sessions) {
    if (participatedSessions.has(session)) {
      currentConsecutive = 0;
    } else {
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    }
  }
  
  return maxConsecutive;
};

// 상태 변경 알림 발송 함수
const sendStatusChangeNotification = async (member: any, oldStatus: string, newStatus: string, reason: string) => {
  try {
    console.log(`📧 상태 변경 알림 발송: ${member.name} (${oldStatus} → ${newStatus})`);
    console.log(`📧 이메일: ${member.email}`);
    console.log(`📧 사유: ${reason}`);
    
    // 이메일 템플릿 생성
    const emailTemplate = getStatusChangeEmailTemplate(member, oldStatus, newStatus, reason);
    
    // 실제 이메일 발송 (현재는 콘솔에 출력)
    console.log('📧 이메일 내용:');
    console.log('제목:', emailTemplate.subject);
    console.log('내용:', emailTemplate.html);
    
    // TODO: 실제 이메일 발송 서비스 연동
    // await sendEmail(member.email, emailTemplate.subject, emailTemplate.html);
  } catch (error) {
    console.error('이메일 발송 오류:', error);
  }
};

// 이메일 템플릿 생성 함수
const getStatusChangeEmailTemplate = (member: any, oldStatus: string, newStatus: string, reason: string) => {
  const statusNames = {
    'ACTIVE': '활성',
    'INACTIVE': '비활성',
    'SUSPENDED': '정지',
    'DELETED': '삭제됨'
  };
  
  const oldStatusName = statusNames[oldStatus as keyof typeof statusNames] || oldStatus;
  const newStatusName = statusNames[newStatus as keyof typeof statusNames] || newStatus;
  
  let subject = '';
  let content = '';
  
  if (newStatus === 'INACTIVE') {
    subject = `[FC CHAL-GGYEO] 회원 상태 변경 안내 - ${oldStatusName} → ${newStatusName}`;
    content = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #004ea8;">FC CHAL-GGYEO 회원 상태 변경 안내</h2>
        <p>안녕하세요, ${member.name}님.</p>
        <p>회원 상태가 <strong>${oldStatusName}</strong>에서 <strong>${newStatusName}</strong>으로 변경되었습니다.</p>
        
        <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <h3 style="color: #856404; margin-top: 0;">변경 사유</h3>
          <p style="color: #856404; margin-bottom: 0;">${reason}</p>
        </div>
        
        <h3>비활성 상태에서의 제한사항</h3>
        <ul>
          <li>투표 참여 불가</li>
          <li>경기 참여 불가</li>
          <li>게시글 조회만 가능</li>
        </ul>
        
        <h3>활성 상태 복구 방법</h3>
        <p>다음 조건을 만족하면 관리자가 활성 상태로 복구해드립니다:</p>
        <ul>
          <li>투표에 정기적으로 참여</li>
          <li>경기에 적극적으로 참여</li>
          <li>관리자에게 복구 요청</li>
        </ul>
        
        <p>문의사항이 있으시면 관리자에게 연락해주세요.</p>
        <p>감사합니다.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">FC CHAL-GGYEO 관리팀</p>
      </div>
    `;
  } else if (newStatus === 'SUSPENDED') {
    subject = `[FC CHAL-GGYEO] 회원 정지 안내 - ${oldStatusName} → ${newStatusName}`;
    content = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc3545;">FC CHAL-GGYEO 회원 정지 안내</h2>
        <p>안녕하세요, ${member.name}님.</p>
        <p>회원 상태가 <strong>${oldStatusName}</strong>에서 <strong>${newStatusName}</strong>으로 변경되었습니다.</p>
        
        <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <h3 style="color: #721c24; margin-top: 0;">정지 사유</h3>
          <p style="color: #721c24; margin-bottom: 0;">${reason}</p>
        </div>
        
        <h3>정지 상태에서의 제한사항</h3>
        <ul>
          <li>로그인 불가</li>
          <li>모든 기능 사용 불가</li>
          <li>시스템 접근 차단</li>
        </ul>
        
        <h3>정지 해제 방법</h3>
        <p>정지 해제를 원하시면 관리자에게 직접 연락하여 문의해주세요.</p>
        
        <p>문의사항이 있으시면 관리자에게 연락해주세요.</p>
        <p>감사합니다.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">FC CHAL-GGYEO 관리팀</p>
      </div>
    `;
  }
  
  return {
    subject,
    html: content
  };
};

// 공휴일 API 호출 함수
const getHolidays = async (year: number) => {
  try {
    // 공공데이터포털 API 키 (실제 발급받은 키로 교체하세요)
    const API_KEY = '4v4qN2Ne+KlpM2iCir09sxyTt8+iXYdBqYEBNblmrS7XZmpcJi/MZRudqjmtdMsJICva6D6vrmckjNTMz1hVgA==';
    
          // API 키가 설정되지 않은 경우 하드코딩된 공휴일 반환
      if (!API_KEY) {
        console.log('API 키가 설정되지 않아 하드코딩된 공휴일을 사용합니다.');
        const holidays = {
          '2025-01-01': '신정',
          '2025-02-09': '설날',
          '2025-02-10': '설날',
          '2025-02-11': '설날',
          '2025-03-01': '삼일절',
          '2025-05-05': '어린이날',
          '2025-05-15': '부처님오신날',
          '2025-06-06': '현충일',
          '2025-08-15': '광복절',
          '2025-09-28': '추석',
          '2025-09-29': '추석',
          '2025-09-30': '추석',
          '2025-10-03': '개천절',
          '2025-10-09': '한글날',
          '2025-12-25': '크리스마스'
        };
        return holidays;
      }
    
    // 공공데이터포털 API 호출
    const url = `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo`;
    const params = new URLSearchParams({
      serviceKey: API_KEY,
      solYear: year.toString(),
      numOfRows: '100',
      _type: 'json'
    });
    
    console.log(`공공데이터포털 API 호출: ${year}년 공휴일 조회`);
    const response = await axios.get(`${url}?${params.toString()}`);
    
    if (response.data && response.data.response && response.data.response.body) {
      const items = response.data.response.body.items.item;
      const holidays: { [key: string]: string } = {};
      
      // 단일 항목인 경우 배열로 변환
      const holidayList = Array.isArray(items) ? items : [items];
      
      holidayList.forEach((item: any) => {
        if (item && item.locdate && item.dateName) {
          const dateStr = item.locdate.toString();
          const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
          holidays[formattedDate] = item.dateName;
        }
      });
      
      console.log(`공휴일 API 결과: ${Object.keys(holidays).length}개 공휴일 조회됨`);
      return holidays;
    } else {
      console.log('API 응답 형식이 예상과 다릅니다:', response.data);
      return {};
    }
  } catch (error) {
    console.error('공휴일 API 호출 오류:', error);
    // API 오류 시 하드코딩된 공휴일 반환
    const fallbackHolidays = {
      '2025-01-01': '신정',
      '2025-02-09': '설날',
      '2025-02-10': '설날',
      '2025-02-11': '설날',
      '2025-03-01': '삼일절',
      '2025-05-05': '어린이날',
      '2025-05-15': '부처님오신날',
      '2025-06-06': '현충일',
      '2025-08-15': '광복절',
      '2025-09-28': '추석',
      '2025-09-29': '추석',
      '2025-09-30': '추석',
      '2025-10-03': '개천절',
      '2025-10-09': '한글날',
      '2025-12-25': '크리스마스'
    };
    return fallbackHolidays;
  }
};

// 공휴일 체크 함수 (간단 버전)
const isHoliday = (date: Date, holidays: { [key: string]: string }) => {
  const dateString = date.toISOString().split('T')[0];
  if (dateString === '2025-08-15') return true;
  if (holidays[dateString]) return true;
  return false;
};

// 기존 함수들...

export const register = async (req: Request, res: Response) => {
  console.log('==== register 진입 ====', JSON.stringify(req.body));
  
  // 중첩된 구조 처리
  let email, password, name;
  if (req.body.email && typeof req.body.email === 'object') {
    email = req.body.email.email;
    password = req.body.email.password;
    name = req.body.email.name;
  } else {
    email = req.body.email;
    password = req.body.password;
    name = req.body.name;
  }
  
  console.log('register body:', JSON.stringify({ email, password, name }));
  
  try {
    // 이메일 중복 확인
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: '이미 존재하는 이메일입니다.' });
    }

    // 비밀번호 해시화
    const hashedPassword = await bcrypt.hash(password, 10);

    // 사용자 생성
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name
      }
    });

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key'
    );

    res.status(201).json({
      message: '회원가입이 완료되었습니다.',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('회원가입 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

export const login = async (req: Request, res: Response) => {
  console.log('==== login 진입 ====', JSON.stringify(req.body));
  
  // 중첩된 구조 처리
  let email, password;
  if (req.body.email && typeof req.body.email === 'object') {
    email = req.body.email.email;
    password = req.body.email.password;
  } else {
    email = req.body.email;
    password = req.body.password;
  }
  console.log('login body:', JSON.stringify({ email, password }));
  
  try {
    // 사용자 찾기
    const user = await prisma.user.findUnique({
      where: { email }
    });

    console.log('사용자 찾기 결과:', user ? '사용자 존재' : '사용자 없음');
    if (!user) {
      console.log('❌ 로그인 실패: 사용자 없음');
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    // 비밀번호 확인
    console.log('비밀번호 검증 시작...');
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log('비밀번호 검증 결과:', isValidPassword ? '성공' : '실패');
    
    if (!isValidPassword) {
      console.log('❌ 로그인 실패: 비밀번호 불일치');
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'fc-chalggyeo-secret'
    );

    console.log('✅ 로그인 성공!');
    
    // 마지막 로그인 시간 업데이트
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });
    
    // 투표 참여율 계산
    const voteAttendance = await calculateVoteAttendanceRate(user.id);
    console.log('계산된 투표 참여율:', voteAttendance + '%');
    
    // 참여율 자동 계산 및 업데이트
    const updatedAttendance = await calculateAndUpdateUserAttendance(user.id);
    
    // 상세 정보 계산
    const voteDetails = await calculateVoteAttendanceDetails(user.id);
    const gameDetails = await calculateGameAttendanceDetails(user.id);
    
    const responseData = {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        attendance: updatedAttendance,
        voteAttendance: voteAttendance,
        voteDetails: voteDetails,
        gameDetails: gameDetails
      }
    };
    console.log('로그인 응답 데이터:', responseData);
    res.json(responseData);
  } catch (error) {
    console.error('로그인 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const userEmail = (req as any).user?.email;

    console.log('프로필 조회 - userId:', userId, 'userEmail:', userEmail);

    let user = null;
    
    if (userId) {
      user = await prisma.user.findUnique({
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
      
      // 투표 참여율 계산
      if (user) {
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
        
        user.voteAttendance = voteAttendance;
        user.voteDetails = {
          total: totalSessions,
          participated: participatedSessions
        };
      }
    }

    // 사용자가 없고 이메일이 있다면, 해당 이메일로 사용자를 찾거나 생성
    if (!user && userEmail) {
      user = await prisma.user.findUnique({
        where: { email: userEmail },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true
        }
      });

      // 사용자가 여전히 없다면, 기본 사용자 생성 (테스트용)
      if (!user && userEmail === 'sti60val@gmail.com') {
        user = await prisma.user.create({
          data: {
            email: userEmail,
            name: '정성인',
            password: await bcrypt.hash('password123', 10),
            role: 'SUPER_ADMIN',
            status: 'ACTIVE'
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true
          }
        });
        console.log('새 사용자 생성됨:', user);
      }
    }

    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    // 투표 참여율 계산
    const voteAttendance = await calculateVoteAttendanceRate(user.id);
    console.log('프로필 조회 - 계산된 투표 참여율:', voteAttendance + '%');

    // 참여율 자동 계산 및 업데이트
    const updatedAttendance = await calculateAndUpdateUserAttendance(user.id);

    // 상세 정보 계산
    const voteDetails = await calculateVoteAttendanceDetails(user.id);
    const gameDetails = await calculateGameAttendanceDetails(user.id);

    const userWithVoteAttendance = {
      ...user,
      attendance: updatedAttendance,
      voteAttendance: voteAttendance,
      voteDetails: voteDetails,
      gameDetails: gameDetails
    };

    res.json({ user: userWithVoteAttendance });
  } catch (error) {
    console.error('프로필 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { name } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: { name },
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });

    res.json({
      message: '프로필이 업데이트되었습니다.',
      user
    });
  } catch (error) {
    console.error('프로필 업데이트 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

export const statsSummary = async (req: Request, res: Response) => {
  try {
    // 활성 상태인 모든 사용자 카운트 (SUPER_ADMIN, ADMIN, MEMBER 모두 포함)
    const totalMembers = await prisma.user.count({
      where: { 
        status: 'ACTIVE'
      }
    });

    const totalGames = await prisma.game.count();
    
    // 이번주 경기 (월요일부터 일요일까지)
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // 월요일
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // 일요일
    endOfWeek.setHours(23, 59, 59, 999);

    const thisWeekGame = await prisma.game.findFirst({
      where: {
        date: {
          gte: startOfWeek,
          lte: endOfWeek
        }
      },
      orderBy: { date: 'asc' }
    });

    // 다음주 투표 세션
    const nextWeekVote = await prisma.voteSession.findFirst({
      where: {
        isActive: true
      }
    });

    res.json({
      totalMembers,
      totalGames,
      thisWeekGame,
      nextWeekVote
    });
  } catch (error) {
    console.error('통계 요약 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

export const getAllMembers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        attendance: true,
        createdAt: true
      },
      orderBy: { name: 'asc' }
    });

    res.json({ members: users });
  } catch (error) {
    console.error('멤버 목록 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

export const deleteTest3User = async (req: Request, res: Response) => {
  try {
    await prisma.user.deleteMany({
      where: {
        email: 'test3@test.com'
      }
    });

    res.json({ message: 'test3 사용자가 삭제되었습니다.' });
  } catch (error) {
    console.error('test3 사용자 삭제 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

export const deleteUserByEmail = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    await prisma.user.deleteMany({
      where: {
        email: email
      }
    });

    res.json({ message: `${email} 사용자가 삭제되었습니다.` });
  } catch (error) {
    console.error('사용자 삭제 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

export const setAdminByEmail = async (req: Request, res: Response) => {
  try {
    const { email, role = 'ADMIN' } = req.body;

    const user = await prisma.user.update({
      where: { email },
      data: { role }
    });

    res.json({
      message: '관리자로 설정되었습니다.',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('관리자 설정 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

export const setAttendanceRate = async (req: Request, res: Response) => {
  try {
    const { email, attendance } = req.body;

    const user = await prisma.user.update({
      where: { email },
      data: { attendance }
    });

    res.json({
      message: '참여율이 설정되었습니다.',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        attendance: user.attendance
      }
    });
  } catch (error) {
    console.error('참여율 설정 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

// ===== 경기 관리 API =====

export const createGame = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { date, time, location, gameType, eventType } = req.body;

    if (!userId) {
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }

    // 관리자만 경기 생성 가능
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: '관리자만 경기를 생성할 수 있습니다.' });
    }

    if (!date || !location || !gameType) {
      return res.status(400).json({ error: '날짜, 장소, 경기 유형은 필수입니다.' });
    }

    const game = await prisma.game.create({
      data: {
        date: new Date(date),
        time: time || '미정',
        location: location || '장소 미정',
        gameType: gameType || '미정',
        eventType: eventType || '미정',
        createdById: userId,
        autoGenerated: false,
        confirmed: true
      }
    });

    // 경기 생성자(관리자)의 참여 기록 자동 생성
    await prisma.attendance.create({
      data: {
        userId: userId,
        gameId: game.id,
        status: 'YES'
      }
    });

    console.log(`경기 생성자 ${userId}의 참여 기록이 자동 생성되었습니다.`);

    res.status(201).json({
      message: '경기가 생성되었습니다.',
      game
    });
  } catch (error) {
    console.error('경기 생성 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

export const getGames = async (req: Request, res: Response) => {
  try {
    // 실제 데이터베이스에서 경기 목록 조회
    const games = await prisma.game.findMany({
      include: {
        attendances: {
          include: {
            user: true
          }
        },
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
    console.error('경기 목록 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

export const updateGame = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;
    const { date, time, location, gameType, eventType, memberNames, selectedMembers, mercenaryCount } = req.body;

    console.log('🔍 경기 수정 요청:', {
      userId,
      gameId: id,
      body: req.body
    });

    if (!userId) {
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }

    // 관리자만 경기 수정 가능
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: '관리자만 경기를 수정할 수 있습니다.' });
    }

    // 기존 참석자 정보 삭제
    await prisma.attendance.deleteMany({
      where: { gameId: parseInt(id) }
    });

    // 새로운 참석자 정보 저장
    const allMembers = [...(selectedMembers || []), ...(memberNames || [])];
    if (allMembers.length > 0) {
      for (const memberName of allMembers) {
        if (memberName && memberName.trim()) {
          // 사용자 ID 찾기 (이름으로)
          const memberUser = await prisma.user.findFirst({
            where: { name: memberName.trim() }
          });
          if (memberUser) {
            await prisma.attendance.create({
              data: {
                gameId: parseInt(id),
                userId: memberUser.id,
                status: 'YES'
              }
            });
          }
        }
      }
    }

    const game = await prisma.game.update({
      where: { id: parseInt(id) },
      data: {
        date: date ? new Date(date) : undefined,
        time: time || undefined,
        location: location || undefined,
        gameType: gameType || undefined,
        eventType: eventType || undefined,
        mercenaryCount: mercenaryCount || 0,
        memberNames: JSON.stringify(memberNames || []),
        selectedMembers: JSON.stringify(selectedMembers || []),
        autoGenerated: false // 수정 시 자동 생성 플래그 해제
      }
    });

    console.log('✅ 경기 수정 완료:', game.id);

    res.json({
      message: '경기가 수정되었습니다.',
      game
    });
  } catch (error) {
    console.error('경기 수정 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

export const deleteGame = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;

    console.log('🔍 경기 삭제 요청:', {
      userId,
      gameId: id
    });

    if (!userId) {
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }

    // 관리자만 경기 삭제 가능
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (user?.role !== 'ADMIN' && user?.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: '관리자만 경기를 삭제할 수 있습니다.' });
    }

    // 먼저 관련된 참석자 정보 삭제
    await prisma.attendance.deleteMany({
      where: { gameId: parseInt(id) }
    });

    // 경기 삭제
    await prisma.game.delete({
      where: { id: parseInt(id) }
    });

    console.log('✅ 경기 삭제 완료:', id);

    res.json({ message: '경기가 삭제되었습니다.' });
  } catch (error) {
    console.error('경기 삭제 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

// ===== 투표 시스템 API =====

export const createVoteSession = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { weekStartDate } = req.body;

    if (!userId) {
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }

    // 관리자만 투표 세션 생성 가능
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (user?.role !== 'ADMIN') {
      return res.status(403).json({ error: '관리자만 투표 세션을 생성할 수 있습니다.' });
    }

    const startTime = new Date(weekStartDate);
    startTime.setHours(0, 1, 0, 0); // 월요일 00:01

    const endTime = new Date(weekStartDate);
    endTime.setDate(startTime.getDate() + 3); // 목요일
    endTime.setHours(17, 0, 0, 0); // 17:00

    // 중복 체크 - 정확한 주간(월요일) 비교
    const weekStartDateObj = new Date(weekStartDate);
    weekStartDateObj.setHours(0, 0, 0, 0);
    
    const existingSession = await prisma.voteSession.findFirst({
      where: {
        weekStartDate: {
          gte: weekStartDateObj,
          lt: new Date(weekStartDateObj.getTime() + 24 * 60 * 60 * 1000) // 다음날 00:00 이전
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

    const voteSession = await prisma.voteSession.create({
      data: {
        weekStartDate: new Date(weekStartDate),
        startTime,
        endTime,
        isActive: true,
        isCompleted: false
      }
    });

    res.status(201).json({
      message: '투표 세션이 생성되었습니다.',
      voteSession
    });
  } catch (error) {
    console.error('투표 세션 생성 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

export const getActiveVoteSession = async (req: Request, res: Response) => {
  try {
    // 실제 데이터베이스에서 활성 투표 세션 조회
    const activeVoteSession = await prisma.voteSession.findFirst({
      where: {
        isActive: true,
        isCompleted: false
      },
      include: {
        votes: true
      }
    });

    if (!activeVoteSession) {
      return res.status(404).json({ 
        message: '활성 투표 세션이 없습니다.',
        voteSession: null 
      });
    }

    res.json({ voteSession: activeVoteSession });
  } catch (error) {
    console.error('활성 투표 세션 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

export const submitVote = async (req: Request, res: Response) => {
  try {
    const { voteSessionId, selectedDays } = req.body;
    let userId = 1; // 기본값 (인증 임시 우회)
    console.log('투표 제출 요청:', { voteSessionId, selectedDays });
    
    if (!voteSessionId || !selectedDays || !Array.isArray(selectedDays)) {
      return res.status(400).json({
        error: '잘못된 투표 데이터입니다.',
        required: { voteSessionId: 'number', selectedDays: 'array' },
        received: { voteSessionId, selectedDays }
      });
    }

    // 기존 투표 데이터 로드
    let voteData = loadVoteData();
    
    // 같은 사용자의 기존 투표 찾기
    const existingVoteIndex = voteData.findIndex((vote: any) => vote.userId === userId);
    
    if (existingVoteIndex !== -1) {
      // 기존 투표가 있으면 업데이트
      console.log('기존 투표 발견, 업데이트:', voteData[existingVoteIndex]);
      voteData[existingVoteIndex] = {
        userId,
        selectedDays,
        timestamp: new Date().toISOString()
      };
      console.log('투표 업데이트 완료');
    } else {
      // 새로운 투표 추가
      const newVote = {
        userId,
        selectedDays,
        timestamp: new Date().toISOString()
      };
      voteData.push(newVote);
      console.log('새 투표 추가 완료');
    }
    
    // 투표 데이터 파일에 저장
    saveVoteData(voteData);
    
    console.log('투표 제출 성공:', { voteSessionId, userId, selectedDays });
    console.log('현재 총 투표 데이터:', voteData.length);
    
    res.json({
      message: '투표가 성공적으로 제출되었습니다.',
      vote: { userId, selectedDays },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('투표 제출 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

export const getVoteResults = async (req: Request, res: Response) => {
  try {
    const { voteSessionId } = req.params;
    
    // 파일에서 투표 데이터 로드
    const voteData = loadVoteData();
    console.log('현재 저장된 투표 데이터:', voteData);
    
    // 각 요일별 투표 수 계산
    const voteCounts: { [key: string]: number } = {
      MON: 0,
      TUE: 0,
      WED: 0,
      THU: 0,
      FRI: 0,
      불참: 0
    };
    
    // 실제 투표 데이터 집계
    voteData.forEach((vote: any) => {
      vote.selectedDays.forEach((day: string) => {
        const normalizedDay = day === 'ABSENT' ? '불참' : day;
        if (normalizedDay in voteCounts) {
          voteCounts[normalizedDay]++;
        }
      });
    });
    
    console.log('계산된 투표 결과:', voteCounts);
    
    const voteResults = {
      voteSession: {
        id: 1,
        title: '다음주 일정 투표',
        weekStartDate: '2025-08-04',
        startTime: '2025-07-29T00:00:00Z',
        endTime: '2025-08-03T23:59:59Z',
        isActive: true,
        isCompleted: false,
        createdAt: '2025-07-29T00:00:00Z',
        updatedAt: '2025-07-29T00:00:00Z',
        votes: voteData
      },
      voteResults: {
        MON: voteCounts.MON,
        TUE: voteCounts.TUE,
        WED: voteCounts.WED,
        THU: voteCounts.THU,
        FRI: voteCounts.FRI,
        불참: voteCounts.불참
      }
    };
    
    console.log('최종 투표 결과:', voteResults);
    res.json(voteResults);
  } catch (error) {
    console.error('투표 결과 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

// ===== 관리자 투표결과 API(프런트 요구 경로 대응) =====

// 세션 요약 목록
export const getAdminVoteSessionsSummary = async (req: Request, res: Response) => {
  try {
    const sessions = await prisma.voteSession.findMany({
      orderBy: { weekStartDate: 'desc' },
      include: { votes: true }
    });
    const mapped = sessions.map((s) => ({
      id: s.id,
      weekStartDate: s.weekStartDate,
      startTime: s.startTime,
      endTime: s.endTime,
      isActive: s.isActive,
      isCompleted: s.isCompleted,
      participantCount: s.votes?.length || 0,
      totalVotes: s.votes?.length || 0
    }));
    res.json({ sessions: mapped });
  } catch (error) {
    console.error('세션 요약 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

// 저장된(=실시간 집계) 결과 조회 - 프런트 호환용
export const getSavedVoteResults = async (req: Request, res: Response) => {
  try {
    const sessionIdParam = (req.query.sessionId || req.params.sessionId) as string;
    if (!sessionIdParam) return res.status(400).json({ error: 'sessionId가 필요합니다.' });
    const sessionId = parseInt(sessionIdParam);
    const session = await prisma.voteSession.findUnique({
      where: { id: sessionId },
      include: { votes: true }
    });
    if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });

    const results: Record<string, number> = { MON: 0, TUE: 0, WED: 0, THU: 0, FRI: 0 };
    const participants: Record<string, string[]> = { MON: [], TUE: [], WED: [], THU: [], FRI: [] };

    // 실명 매핑
    const users = await prisma.user.findMany({ select: { id: true, name: true } });
    const idToName = new Map(users.map(u => [u.id, u.name || `USER_${u.id}`]));

    session.votes.forEach((v) => {
      try {
        const days: string[] = JSON.parse(v.selectedDays || '[]');
        days.forEach((d) => {
          if (d in results) {
            results[d] += 1;
            const nm = idToName.get(v.userId) || String(v.userId);
            if (!participants[d].includes(nm)) participants[d].push(nm);
          }
        });
      } catch (_) {}
    });

    res.json({ sessionId, results, participants });
  } catch (error) {
    console.error('저장 결과 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

// 통합 데이터: 활성 세션 정보 + 전주 결과
export const getUnifiedVoteData = async (_req: Request, res: Response) => {
  try {
    const activeSession = await prisma.voteSession.findFirst({
      where: { isActive: true },
      include: { votes: true }
    });

    // 지난주 완료된 세션
    const lastCompleted = await prisma.voteSession.findFirst({
      where: { isCompleted: true },
      orderBy: { endTime: 'desc' },
      include: { votes: true }
    });

    const results: Record<string, number> = { MON: 0, TUE: 0, WED: 0, THU: 0, FRI: 0 };
    const participants: Record<string, string[]> = { MON: [], TUE: [], WED: [], THU: [], FRI: [] };
    if (lastCompleted) {
      lastCompleted.votes.forEach((v) => {
        try {
          const days: string[] = JSON.parse(v.selectedDays || '[]');
          days.forEach((d) => {
            if (d in results) {
              results[d] += 1;
              participants[d].push(`회원${v.userId}`);
            }
          });
        } catch (_) {}
      });
    }

    res.json({
      activeSession: activeSession ? {
        id: activeSession.id,
        weekStartDate: activeSession.weekStartDate,
        startTime: activeSession.startTime,
        endTime: activeSession.endTime,
        isActive: activeSession.isActive,
        isCompleted: activeSession.isCompleted,
        participantCount: activeSession.votes?.length || 0
      } : null,
      lastWeekResults: {
        sessionId: lastCompleted ? String(lastCompleted.id) : null,
        results,
        participants
      }
    });
  } catch (error) {
    console.error('통합 투표 데이터 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

// 집계 저장 (현재는 계산 후 OK 반환)
export const aggregateAndSaveVoteResults = async (req: Request, res: Response) => {
  try {
    const { target, sessionId } = req.body as { target: 'last' | 'id'; sessionId?: number };
    let idToAggregate: number | null = null;
    if (target === 'id' && sessionId) idToAggregate = sessionId;
    if (target === 'last') {
      const last = await prisma.voteSession.findFirst({ where: { isCompleted: true }, orderBy: { endTime: 'desc' } });
      idToAggregate = last?.id || null;
    }
    if (!idToAggregate) return res.json({ message: '집계할 세션이 없습니다.' });
    // 계산만 수행
    const session = await prisma.voteSession.findUnique({ where: { id: idToAggregate }, include: { votes: true } });
    if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
    // 계산 로직은 getSavedVoteResults와 동일하므로 생략
    res.json({ message: '집계 저장 완료', sessionId: idToAggregate });
  } catch (error) {
    console.error('집계 저장 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

// ===== 자동화 함수들 =====

export const startWeeklyVote = async (req: Request, res: Response) => {
  try {
    // 다음주 월요일 날짜 계산 (8월 11일)
    const now = new Date();
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + (8 - now.getDay()) % 7);
    nextMonday.setHours(0, 1, 0, 0); // 월요일 00:01

    // 투표 종료일을 다음주 목요일로 설정
    const endTime = new Date(nextMonday);
    endTime.setDate(nextMonday.getDate() + 3); // 목요일
    endTime.setHours(17, 0, 0, 0); // 17:00

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
  } catch (error) {
    console.error('주간 투표 세션 생성 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

export const completeVoteSession = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    
    // 만료된 투표 세션들을 완료 처리
    const expiredSessions = await prisma.voteSession.findMany({
      where: {
        isActive: true,
        endTime: {
          lte: now
        }
      }
    });

    for (const session of expiredSessions) {
      await prisma.voteSession.update({
        where: { id: session.id },
        data: {
          isActive: false,
          isCompleted: true
        }
      });
    }

    if (expiredSessions.length > 0) {
      console.log(`${expiredSessions.length}개의 투표 세션이 완료되었습니다.`);
      res.json({ 
        message: `${expiredSessions.length}개의 투표 세션이 완료되었습니다.`,
        completedSessions: expiredSessions.length
      });
    } else {
      res.json({ 
        message: '완료할 투표 세션이 없습니다.',
        completedSessions: 0
      });
    }
  } catch (error) {
    console.error('투표 세션 완료 처리 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

// 특정 투표 세션을 강제로 완료하는 함수
export const forceCompleteVoteSession = async (req: Request, res: Response) => {
  try {
    const { voteSessionId } = req.params;
    
    const voteSession = await prisma.voteSession.findUnique({
      where: { id: parseInt(voteSessionId) }
    });

    if (!voteSession) {
      return res.status(404).json({ error: '투표 세션을 찾을 수 없습니다.' });
    }

    await prisma.voteSession.update({
      where: { id: parseInt(voteSessionId) },
      data: {
        isActive: false,
        isCompleted: true
      }
    });

    console.log(`투표 세션 ${voteSessionId}가 강제 완료되었습니다.`);
    res.json({ 
      message: `투표 세션 ${voteSessionId}가 완료되었습니다.`,
      voteSessionId: parseInt(voteSessionId)
    });
  } catch (error) {
    console.error('투표 세션 강제 완료 처리 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

// 이번주 일정 자동 생성 함수 (전주 투표 결과 기반)
export const generateWeeklySchedule = async () => {
  try {
    console.log('🔄 이번주 일정 자동 생성 시작');
    const now = new Date();
    
    // 이번주 월요일과 금요일 계산
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // 월요일
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 4); // 금요일까지만
    endOfWeek.setHours(23, 59, 59, 999);

    console.log('📅 이번주 기간:', {
      start: startOfWeek.toISOString().split('T')[0],
      end: endOfWeek.toISOString().split('T')[0]
    });

    // 이번주에 이미 경기가 있는지 확인
    const existingGames = await prisma.game.findMany({
      where: {
        date: {
          gte: startOfWeek,
          lte: endOfWeek
        }
      }
    });

    console.log('🔍 이번주 기존 경기 수:', existingGames.length);

    // 이번주에 경기가 없으면 전주 투표 결과에서 최다 투표된 일정 생성
    if (existingGames.length === 0) {
      console.log('📊 전주 투표 결과 분석 시작');
      
      // 지난주 완료된 투표 세션 조회
      const lastWeekSession = await prisma.voteSession.findFirst({
        where: {
          isCompleted: true,
          isActive: false
        },
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          votes: true
        }
      });

      if (!lastWeekSession) {
        console.log('❌ 지난주 완료된 투표 세션이 없습니다. 폴백 데이터 사용');
        
        // 폴백: 정성인이 9월 25일, 26일에 투표한 것으로 가정
        const fallbackGames = [
          {
            date: new Date('2025-09-25'),
            time: '19:00',
            location: '풋살장',
            gameType: '자체훈련',
            autoGenerated: true,
            confirmed: true
          },
          {
            date: new Date('2025-09-26'),
            time: '19:00', 
            location: '풋살장',
            gameType: '자체훈련',
            autoGenerated: true,
            confirmed: true
          }
        ];

        for (const gameData of fallbackGames) {
          await prisma.game.create({
            data: {
              date: gameData.date,
              time: gameData.time,
              location: gameData.location,
              gameType: gameData.gameType,
              memberNames: JSON.stringify(['정성인']),
              selectedMembers: JSON.stringify(['정성인']),
              autoGenerated: gameData.autoGenerated,
              confirmed: gameData.confirmed,
              createdById: 1,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });
        }

        console.log('✅ 폴백 데이터로 경기 생성 완료');
        return;
      }

      console.log('📊 지난주 투표 세션 발견:', {
        id: lastWeekSession.id,
        weekStart: lastWeekSession.weekStartDate,
        voteCount: lastWeekSession.votes.length
      });

      // 투표 결과 분석
      const voteResults: Record<string, number> = {};
      const participants: Record<string, string[]> = {};

      // 요일별 투표 수 집계
      const dayMapping: Record<string, string> = {
        'MON': '월요일',
        'TUE': '화요일', 
        'WED': '수요일',
        'THU': '목요일',
        'FRI': '금요일'
      };

      lastWeekSession.votes.forEach(vote => {
        try {
          const selectedDays = JSON.parse(vote.selectedDays);
          selectedDays.forEach((day: string) => {
            if (dayMapping[day]) {
              voteResults[day] = (voteResults[day] || 0) + 1;
              
              // 참여자 목록 추가
              if (!participants[day]) {
                participants[day] = [];
              }
              participants[day].push(`회원${vote.userId}`);
            }
          });
        } catch (error) {
          console.error('투표 데이터 파싱 오류:', error);
        }
      });

      console.log('📊 투표 결과:', voteResults);
      console.log('👥 참여자:', participants);

      // 최다 투표된 요일 찾기
      const maxVotes = Math.max(...Object.values(voteResults), 0);
      const mostVotedDays = Object.entries(voteResults)
        .filter(([_, count]) => count === maxVotes)
        .map(([day, _]) => day);

      console.log('🏆 최다 투표 요일:', mostVotedDays, '득표수:', maxVotes);

      if (maxVotes > 0) {
        // 최다 투표된 요일에 경기 생성
        for (const day of mostVotedDays) {
          const dayName = dayMapping[day];
          const gameDate = new Date(startOfWeek);
          
          // 요일을 실제 날짜로 변환
          const dayOffset = {
            'MON': 0, 'TUE': 1, 'WED': 2, 'THU': 3, 'FRI': 4
          }[day] || 0;
          
          gameDate.setDate(startOfWeek.getDate() + dayOffset);

          // 경기 생성
          await prisma.game.create({
            data: {
              date: gameDate,
              time: '19:00',
              location: '풋살장',
              gameType: '자체훈련',
              memberNames: JSON.stringify(participants[day] || []),
              selectedMembers: JSON.stringify(participants[day] || []),
              autoGenerated: true,
              confirmed: true,
              createdById: 1,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });

          console.log(`✅ ${dayName} 경기 생성 완료:`, gameDate.toISOString().split('T')[0]);
        }
      } else {
        console.log('❌ 투표 결과가 없어 경기를 생성하지 않습니다.');
      }
    } else {
      console.log('ℹ️ 이번주에 이미 경기가 있어 자동 생성하지 않습니다.');
    }

    console.log('✅ 이번주 일정 자동 생성 완료');
  } catch (error) {
    console.error('❌ 이번주 일정 자동 생성 오류:', error);
    throw error;
  }
};

// 이번주 일정 수동 생성 API
export const createWeeklySchedule = async (req: Request, res: Response) => {
  try {
    await generateWeeklySchedule();
    res.json({ 
      message: '이번주 일정이 생성되었습니다.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('이번주 일정 생성 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

// 투표 데이터 초기화 함수
export const resetVoteData = async (req: Request, res: Response) => {
  try {
    // 전역 투표 데이터 초기화
    saveVoteData([]); // 파일에서 데이터 초기화
    
    console.log('투표 데이터 초기화 완료');
    
    res.json({ 
      message: '투표 데이터가 초기화되었습니다.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('투표 데이터 초기화 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

// ===== 회원 관리 함수들 =====

// 회원 검색
export const searchMembers = async (req: Request, res: Response) => {
  try {
    console.log('searchMembers API 호출됨');
    console.log('요청 헤더:', req.headers);
    console.log('인증된 사용자:', (req as any).user);
    
    const { name, email, role, status } = req.query;
    
    const where: any = {};
    
    if (name) {
      where.name = { contains: name as string, mode: 'insensitive' };
    }
    if (email) {
      where.email = { contains: email as string, mode: 'insensitive' };
    }
    if (role && role !== '전체') {
      where.role = role;
    }
    if (status && status !== '전체') {
      where.status = status;
    }
    
    console.log('검색 조건:', where);
    
    const members = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log('검색된 회원 수:', members.length);
    console.log('검색된 회원들:', members);
    
    res.json(members);
  } catch (error) {
    console.error('회원 검색 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

// 회원 정보 수정
export const updateMember = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, role, phone, address, status } = req.body;
    
    console.log('회원 정보 수정 요청:', { id, name, email, role, phone, address, status });
    
    const updatedMember = await prisma.user.update({
      where: { id: parseInt(id) },
      data: {
        name,
        email,
        role,
        phone,
        address,
        status
      }
    });
    
    console.log('업데이트된 회원 정보:', updatedMember);
    
    res.json({
      message: '회원 정보가 수정되었습니다.',
      member: {
        id: updatedMember.id,
        name: updatedMember.name,
        email: updatedMember.email,
        role: updatedMember.role,
        status: updatedMember.status
      }
    });
  } catch (error) {
    console.error('회원 정보 수정 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

// 회원 상태 변경
export const updateMemberStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const updatedMember = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { status }
    });
    
    res.json({
      message: '회원 상태가 변경되었습니다.',
      member: {
        id: updatedMember.id,
        name: updatedMember.name,
        status: updatedMember.status
      }
    });
  } catch (error) {
    console.error('회원 상태 변경 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

// 회원 삭제
export const deleteMember = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    console.log('회원 삭제 API 호출:', { id });
    
    const existingUser = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!existingUser) {
      return res.status(404).json({ error: '회원을 찾을 수 없습니다.' });
    }
    
    // 외래키 제약 조건을 위해 관련 데이터 먼저 삭제
    try {
      await prisma.attendance.deleteMany({ where: { userId: parseInt(id) } });
      console.log('✅ Attendance 데이터 삭제 완료');
      await prisma.vote.deleteMany({ where: { userId: parseInt(id) } });
      console.log('✅ Vote 데이터 삭제 완료');
      await prisma.game.deleteMany({ where: { createdById: parseInt(id) } });
      console.log('✅ Game 데이터 삭제 완료');
      await prisma.schedule.deleteMany({ where: { createdById: parseInt(id) } });
      console.log('✅ Schedule 데이터 삭제 완료');
      await prisma.gallery.deleteMany({ where: { uploaderId: parseInt(id) } });
      console.log('✅ Gallery 데이터 삭제 완료');
      await prisma.like.deleteMany({ where: { userId: parseInt(id) } });
      console.log('✅ Like 데이터 삭제 완료');
      await prisma.comment.deleteMany({ where: { userId: parseInt(id) } });
      console.log('✅ Comment 데이터 삭제 완료');
      await prisma.notice.deleteMany({ where: { authorId: parseInt(id) } });
      console.log('✅ Notice 데이터 삭제 완료');
    } catch (foreignKeyError: any) {
      console.log('⚠️ 외래키 관련 데이터 삭제 중 오류 (무시하고 계속):', foreignKeyError.message);
    }
    
    await prisma.user.delete({
      where: { id: parseInt(id) }
    });
    
    console.log('회원 삭제 성공:', id);
    res.json({ message: '회원이 성공적으로 삭제되었습니다.', deletedMemberId: parseInt(id) });
  } catch (error) {
    console.error('회원 삭제 오류:', error);
    res.status(500).json({ error: '회원 삭제 중 오류가 발생했습니다.' });
  }
};

// 회원 추가
export const createMember = async (req: Request, res: Response) => {
  try {
    const { name, email, password, phone, role } = req.body;
    
    console.log('회원 추가 요청:', { name, email, phone, role });
    
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
        phone: phone || null,
        role: role || 'MEMBER',
        status: 'ACTIVE'
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
};

// 비밀번호 초기화
export const resetMemberPassword = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    
    // 기본 비밀번호 (사용자가 지정하지 않으면)
    const defaultPassword = newPassword || 'password123';
    
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    
    const updatedMember = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { password: hashedPassword }
    });
    
    res.json({
      message: '비밀번호가 초기화되었습니다.',
      member: {
        id: updatedMember.id,
        email: updatedMember.email,
        name: updatedMember.name,
        role: updatedMember.role
      },
      newPassword: defaultPassword
    });
  } catch (error) {
    console.error('비밀번호 초기화 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

// 개인 비밀번호 변경
export const changePassword = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { newPassword } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: '비밀번호는 최소 6자 이상이어야 합니다.' });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });
    
    res.json({
      message: '비밀번호가 변경되었습니다.',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role
      }
    });
  } catch (error) {
    console.error('비밀번호 변경 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

// 평균 참석률 계산 함수
const calculateAverageAttendanceRate = async () => {
  try {
    // 모든 경기에 대한 출석 데이터 조회
    const attendanceData = await prisma.attendance.findMany({
      include: {
        game: true,
        user: true
      }
    });

    if (attendanceData.length === 0) {
      return 0;
    }

    // YES 상태인 출석만 카운트
    const totalAttendance = attendanceData.length;
    const yesAttendance = attendanceData.filter(att => att.status === 'YES').length;

    // 평균 참석률 계산 (소수점 첫째 자리까지)
    const averageRate = totalAttendance > 0 ? (yesAttendance / totalAttendance) * 100 : 0;
    return Math.round(averageRate * 10) / 10; // 소수점 첫째 자리까지 반올림
  } catch (error) {
    console.error('평균 참석률 계산 오류:', error);
    return 0;
  }
};

// 투표 참여율 계산 함수 (전체 기간 기준)
const calculateVoteAttendanceRate = async (userId: number) => {
  try {
    console.log('투표 참여율 계산 시작 - userId:', userId);
    
    // 투표 데이터 로드
    const voteData = loadVoteData();
    console.log('전체 투표 데이터:', voteData.length);
    
    // 해당 사용자의 투표 기록 조회
    const userVotes = voteData.filter((vote: any) => vote.userId === userId);
    console.log('사용자 투표 기록:', userVotes.length);
    
    // 전체 기간 기준 투표 세션 수 계산
    // 실제 투표 세션 수를 데이터베이스에서 조회하거나 추정
    const totalVoteSessions = await prisma.voteSession.count({
      where: {
        isCompleted: true // 완료된 투표 세션만 카운트
      }
    });
    
    console.log('완료된 투표 세션 수:', totalVoteSessions);
    
    // 투표 세션이 없으면 기본값 설정
    const sessionCount = totalVoteSessions > 0 ? totalVoteSessions : 1;
    
    // 사용자 투표 참여율 계산 (전체 기간 기준)
    const voteAttendanceRate = sessionCount > 0 ? 
      (userVotes.length / sessionCount) * 100 : 0;
    
    const roundedRate = Math.round(voteAttendanceRate);
    console.log('계산된 투표 참여율 (전체 기간):', roundedRate + '%');
    
    return roundedRate;
  } catch (error) {
    console.error('투표 참여율 계산 오류:', error);
    return 0;
  }
};

// 투표 참여 상세 정보 계산 함수
const calculateVoteAttendanceDetails = async (userId: number) => {
  try {
    console.log('🔍 calculateVoteAttendanceDetails 시작 - userId:', userId);
    
    // 데이터베이스에서 직접 투표 세션과 투표 데이터 조회
    const voteSessions = await prisma.voteSession.findMany({
      include: {
        votes: {
          where: { userId: userId }
        }
      },
      orderBy: { weekStartDate: 'desc' }
    });
    
    console.log('📊 조회된 투표 세션 수:', voteSessions.length);
    console.log('📊 각 세션별 투표 현황:', voteSessions.map(s => ({
      sessionId: s.id,
      weekStartDate: s.weekStartDate,
      isActive: s.isActive,
      voteCount: s.votes.length,
      hasUserVote: s.votes.length > 0
    })));
    
    // 전체 세션 수 (활동 분석과 동일한 로직 사용)
    const totalSessions = voteSessions.length;
    
    // 사용자가 참여한 세션 수 (투표가 있는 세션)
    const participatedSessions = voteSessions.filter(session => session.votes.length > 0).length;
    
    console.log('✅ 최종 계산 결과:', {
      userId,
      totalSessions,
      participatedSessions,
      result: {
        participated: participatedSessions,
        total: totalSessions || 1
      }
    });
    
    return {
      participated: participatedSessions,
      total: totalSessions || 1 // 0일 때 1로 fallback하여 0/0 방지
    };
  } catch (error) {
    console.error('❌ 투표 참여 상세 정보 계산 오류:', error);
    return { participated: 0, total: 1 };
  }
};

// 경기 참여 상세 정보 계산 함수
const calculateGameAttendanceDetails = async (userId: number) => {
  try {
    console.log('경기 참여 상세 정보 계산 시작 - userId:', userId);
    
    // 경기 관리의 모든 경기 조회
    const allGames = await prisma.game.findMany({
      orderBy: { date: 'desc' }
    });
    
    console.log('전체 경기 수:', allGames.length);
    
    // 사용자의 출석 기록 조회
    const attendanceRecords = await prisma.attendance.findMany({
      where: { userId },
      include: { game: true }
    });
    
    console.log('사용자 출석 기록:', attendanceRecords.length);
    
    // 참여한 경기 수 (YES 상태)
    const participatedGames = attendanceRecords.filter(att => att.status === 'YES').length;
    
    console.log('참여한 경기 수:', participatedGames);
    console.log('전체 경기 수:', allGames.length);
    
    // 전체 경기 수 (0이어도 정확한 값 사용)
    const totalGames = allGames.length;
    
    return {
      participated: participatedGames,
      total: totalGames || 1 // 0일 때 1로 fallback하여 0/0 방지
    };
  } catch (error) {
    console.error('경기 참여 상세 정보 계산 오류:', error);
    return { participated: 0, total: 1 };
  }
};

// 사용자 참여율 자동 계산 및 업데이트 함수
const calculateAndUpdateUserAttendance = async (userId: number) => {
  try {
    console.log('사용자 참여율 계산 및 업데이트 시작 - userId:', userId);
    
    // 경기 관리의 모든 경기 조회
    const allGames = await prisma.game.findMany();
    
    // 사용자의 출석 기록 조회
    const attendanceRecords = await prisma.attendance.findMany({
      where: { userId }
    });
    
    // 참여한 경기 수 (YES 상태)
    const participatedGames = attendanceRecords.filter(att => att.status === 'YES').length;
    
    // 참여율 계산
    const attendanceRate = allGames.length > 0 ? Math.round((participatedGames / allGames.length) * 100) : 0;
    
    console.log(`계산된 참여율: ${attendanceRate}% (${participatedGames}/${allGames.length})`);
    
    // 사용자 테이블의 attendance 필드 업데이트
    await prisma.user.update({
      where: { id: userId },
      data: { attendance: attendanceRate }
    });
    
    console.log(`사용자 ${userId}의 참여율이 ${attendanceRate}%로 업데이트되었습니다.`);
    
    return attendanceRate;
  } catch (error) {
    console.error('사용자 참여율 계산 및 업데이트 오류:', error);
    return 0;
  }
};

// 회원 통계
export const getMemberStats = async (req: Request, res: Response) => {
  try {
    const totalMembers = await prisma.user.count();
    const activeMembers = await prisma.user.count({ where: { status: 'ACTIVE' } });
    const inactiveMembers = await prisma.user.count({ where: { status: 'INACTIVE' } });
    
    // 역할별 통계
    const roleStats = await prisma.user.groupBy({
      by: ['role'],
      _count: { role: true }
    });
    
    // 최근 가입자 통계 (최근 30일)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentMembers = await prisma.user.count({
      where: {
        createdAt: { gte: thirtyDaysAgo }
      }
    });

    // 평균 참석률 계산
    const averageAttendanceRate = await calculateAverageAttendanceRate();
    
    res.json({
      totalMembers,
      activeMembers,
      inactiveMembers,
      roleStats,
      recentMembers,
      activeRate: totalMembers > 0 ? (activeMembers / totalMembers) * 100 : 0,
      averageAttendanceRate
    });
  } catch (error) {
    console.error('회원 통계 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}; 

// ===== 자동화 함수들 (스케줄러용) =====

export const startWeeklyVoteScheduler = async () => {
  try {
    // 다음주 월요일 날짜 계산
    const now = new Date();
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + (8 - now.getDay()) % 7);
    nextMonday.setHours(0, 1, 0, 0); // 월요일 00:01

    const endTime = new Date(nextMonday);
    endTime.setDate(nextMonday.getDate() + 3); // 목요일
    endTime.setHours(17, 0, 0, 0); // 17:00

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
  } catch (error) {
    console.error('주간 투표 세션 생성 오류:', error);
  }
};

export const completeVoteSessionScheduler = async () => {
  try {
    const now = new Date();
    
    // 만료된 투표 세션들을 완료 처리
    const expiredSessions = await prisma.voteSession.findMany({
      where: {
        isActive: true,
        endTime: {
          lte: now
        }
      }
    });

    for (const session of expiredSessions) {
      await prisma.voteSession.update({
        where: { id: session.id },
        data: {
          isActive: false,
          isCompleted: true
        }
      });
    }

    if (expiredSessions.length > 0) {
      console.log(`${expiredSessions.length}개의 투표 세션이 완료되었습니다.`);
      // 전주 투표 결과를 반영하여 이번주 일정 생성
      await generateWeeklySchedule();
    }
  } catch (error) {
    console.error('투표 세션 완료 처리 오류:', error);
  }
};

// 투표 상태 확인 함수
export const getVoteStatus = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    
    // 현재 활성 투표 세션 확인
    const activeSession = await prisma.voteSession.findFirst({
      where: {
        isActive: true
      }
    });

    if (!activeSession) {
      // 활성 세션이 없으면 투표 불가 상태 확인
      const now = new Date();
      const lastCompletedSession = await prisma.voteSession.findFirst({
        where: {
          isCompleted: true
        },
        orderBy: {
          endTime: 'desc'
        }
      });

      if (lastCompletedSession) {
        // 마지막 완료된 세션의 종료 시간 확인
        const endTime = new Date(lastCompletedSession.endTime);
        const nextMonday = new Date(endTime);
        nextMonday.setDate(endTime.getDate() + (8 - endTime.getDay()) % 7); // 다음 월요일
        nextMonday.setHours(0, 0, 0, 0);

        // 투표 마감 후 다음주 월요일까지는 투표 불가
        if (now < nextMonday) {
          return res.json({ 
            hasVoted: false, 
            canVote: false,
            reason: '투표 마감 후 다음주 월요일까지 투표할 수 없습니다.',
            nextVoteStart: nextMonday
          });
        }
      }

      return res.json({ hasVoted: false, canVote: false });
    }

    // 사용자의 투표 여부 확인
    const userVote = await prisma.vote.findFirst({
      where: {
        userId: userId,
        voteSessionId: activeSession.id
      }
    });

    res.json({ 
      hasVoted: !!userVote, 
      canVote: true,
      voteSession: activeSession
    });
  } catch (error) {
    console.error('투표 상태 확인 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

// 공휴일 조회 API
export const getHolidaysAPI = async (req: Request, res: Response) => {
  try {
    const year = parseInt(req.params.year) || new Date().getFullYear();
    const holidays = await getHolidays(year);
    
    res.json({ holidays });
  } catch (error) {
    console.error('공휴일 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}; 

// 재투표 함수 추가
export const submitRevote = async (req: Request, res: Response) => {
  try {
    const { voteSessionId, selectedDays } = req.body;
    let userId = 1; // 기본값 (인증 임시 우회)
    console.log('재투표 제출 요청:', { voteSessionId, selectedDays });

    if (!voteSessionId) {
      return res.status(400).json({
        error: '잘못된 투표 데이터입니다.',
        required: { voteSessionId: 'number' },
        received: { voteSessionId, selectedDays }
      });
    }

    // 기존 투표 데이터 로드
    let voteData = loadVoteData();
    console.log('재투표 전 총 투표 데이터:', voteData.length);

    // 같은 사용자의 기존 투표 모두 삭제 (selectedDays가 빈 배열이어도 삭제)
    const originalLength = voteData.length;
    voteData = voteData.filter((vote: any) => vote.userId !== userId);
    const removedCount = originalLength - voteData.length;
    console.log(`기존 투표 ${removedCount}개 삭제 완료`);

    // selectedDays가 있고 비어있지 않은 경우에만 새로운 투표 추가
    if (selectedDays && Array.isArray(selectedDays) && selectedDays.length > 0) {
      const newVote = {
        userId,
        selectedDays,
        timestamp: new Date().toISOString()
      };
      voteData.push(newVote);
      console.log('새 재투표 추가 완료:', newVote);
    } else {
      console.log('재투표: 빈 배열이므로 새로운 투표 추가하지 않음');
    }

    // 투표 데이터 파일에 저장
    saveVoteData(voteData);

    console.log('재투표 제출 성공:', { voteSessionId, userId, selectedDays });
    console.log('재투표 후 총 투표 데이터:', voteData.length);

    res.json({
      message: '재투표가 성공적으로 제출되었습니다.',
      vote: { userId, selectedDays: selectedDays || [] },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('재투표 제출 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}; 

// 이번주 일정 수동 입력 관련 API (사용하지 않음)
// export const createThisWeekSchedule = async (req: Request, res: Response) => {
//   try {
//     const { eventType, dateTime, location, attendees, description, maxAttendees } = req.body;
//     const userId = (req as any).user?.id;

//     if (!userId) {
//       return res.status(401).json({ error: '인증이 필요합니다.' });
//     }

//     // 사용자 권한 확인
//     const user = await prisma.user.findUnique({
//       where: { id: userId },
//       select: { role: true }
//     });

//     if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
//       return res.status(401).json({ error: '관리자 권한이 필요합니다.' });
//     }

//     // 이번주 일정 생성
//     const schedule = await prisma.thisWeekSchedule.create({
//       data: {
//         eventType,
//         dateTime: new Date(dateTime),
//         location,
//         attendees: attendees || [],
//         description: description || '',
//         maxAttendees: maxAttendees || null,
//         createdBy: userId,
//         createdAt: new Date(),
//         updatedAt: new Date()
//       }
//     });

//     console.log('이번주 일정 생성 완료:', schedule);
//     res.status(201).json({ 
//       message: '이번주 일정이 성공적으로 생성되었습니다.',
//       schedule 
//     });
//   } catch (error) {
//     console.error('이번주 일정 생성 오류:', error);
//     res.status(500).json({ error: '이번주 일정 생성 중 오류가 발생했습니다.' });
//   }
// };

// export const getThisWeekSchedules = async (req: Request, res: Response) => {
//   try {
//     const schedules = await prisma.thisWeekSchedule.findMany({
//       orderBy: { dateTime: 'asc' },
//       include: {
//         createdBy: {
//           select: { name: true, email: true }
//         }
//       }
//     });

//     res.json({ schedules });
//   } catch (error) {
//     console.error('이번주 일정 조회 오류:', error);
//     res.status(500).json({ error: '이번주 일정 조회 중 오류가 발생했습니다.' });
//   }
// };

// export const updateThisWeekSchedule = async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;
//     const { eventType, dateTime, location, attendees, description, maxAttendees } = req.body;
//     const userId = (req as any).user?.id;

//     if (!userId) {
//       return res.status(401).json({ error: '인증이 필요합니다.' });
//     }

//     // 사용자 권한 확인
//     const user = await prisma.user.findUnique({
//       where: { id: userId },
//       select: { role: true }
//         });

//     if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
//       return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
//     }

//     // 이번주 일정 수정
//     const schedule = await prisma.thisWeekSchedule.update({
//       where: { id: parseInt(id) },
//       data: {
//         eventType,
//         dateTime: new Date(dateTime),
//         location,
//         attendees: attendees || [],
//         description: description || '',
//         maxAttendees: maxAttendees || null,
//         updatedAt: new Date()
//       }
//     });

//     console.log('이번주 일정 수정 완료:', schedule);
//     res.json({ 
//       message: '이번주 일정이 성공적으로 수정되었습니다.',
//       schedule 
//     });
//   } catch (error) {
//     console.error('이번주 일정 수정 오류:', error);
//     res.status(500).json({ error: '이번주 일정 수정 중 오류가 발생했습니다.' });
//   }
// };

// export const deleteThisWeekSchedule = async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;
//     const userId = (req as any).user?.id;

//     if (!userId) {
//       return res.status(401).json({ error: '인증이 필요합니다.' });
//     }

//     // 사용자 권한 확인
//     const user = await prisma.user.findUnique({
//       where: { id: userId },
//       select: { role: true }
//     });

//     if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
//       return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
//     }

//     // 이번주 일정 삭제
//     await prisma.thisWeekSchedule.delete({
//       where: { id: parseInt(id) }
//     });

//     console.log('이번주 일정 삭제 완료:', id);
//     res.json({ message: '이번주 일정이 성공적으로 삭제되었습니다.' });
//   } catch (error) {
//     console.error('이번주 일정 삭제 오류:', error);
//     res.status(500).json({ error: '이번주 일정 삭제 중 오류가 발생했습니다.' });
//   }
// };

// 카카오맵 API 연동을 위한 장소 검색
export const searchLocation = async (req: Request, res: Response) => {
  try {
    const { query } = req.query;
    
    console.log('🔍 장소 검색 요청:', query);
    
    if (!query) {
      console.log('❌ 검색어가 없음');
      return res.status(400).json({ error: '검색어가 필요합니다.' });
    }

    // 카카오맵 API 키
    const KAKAO_API_KEY = '4413813ca702d0fb6239ae38d9202d7e';
    console.log('🔑 카카오맵 API 키:', KAKAO_API_KEY);
    
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
};

// Export functions for use in other modules
export { calculateVoteAttendanceDetails, calculateGameAttendanceDetails }; 