/**
 * 투표 세션 관리 유틸리티
 * 세션 생성, 검증, 자동 비활성화 등 안정적인 세션 관리
 */

import { PrismaClient } from '@prisma/client';
import { getKoreaTime, getThisWeekMonday, getNextWeekMonday, getWeekFriday, isSessionExpired } from './voteUtils';

const prisma = new PrismaClient();

/**
 * 만료된 세션 자동 비활성화
 */
export async function deactivateExpiredSessions(): Promise<number> {
  try {
    const koreaTime = getKoreaTime();
    const activeSessions = await prisma.voteSession.findMany({
      where: { isActive: true }
    });
    
    let deactivatedCount = 0;
    
    for (const session of activeSessions) {
      if (isSessionExpired(session)) {
        await prisma.voteSession.update({
          where: { id: session.id },
          data: { isActive: false, isCompleted: true }
        });
        console.log(`✅ 만료된 세션 비활성화: ${session.id}`);
        deactivatedCount++;
      }
    }
    
    return deactivatedCount;
  } catch (error) {
    console.error('❌ 만료된 세션 비활성화 오류:', error);
    throw error;
  }
}

/**
 * 중복 활성 세션 처리 (가장 최신 세션만 활성 유지)
 */
export async function ensureSingleActiveSession(): Promise<void> {
  try {
    const activeSessions = await prisma.voteSession.findMany({
      where: { isActive: true },
      orderBy: { id: 'desc' }
    });
    
    if (activeSessions.length > 1) {
      const sessionsToDeactivate = activeSessions.slice(1);
      for (const session of sessionsToDeactivate) {
        await prisma.voteSession.update({
          where: { id: session.id },
          data: { isActive: false, isCompleted: true }
        });
        console.log(`✅ 중복 활성 세션 비활성화: ${session.id}`);
      }
    }
  } catch (error) {
    console.error('❌ 중복 활성 세션 처리 오류:', error);
    throw error;
  }
}

/**
 * 활성 세션 조회 (안전한 조회)
 */
export async function getActiveSession(includeVotes: boolean = true) {
  try {
    // 먼저 만료된 세션 비활성화
    await deactivateExpiredSessions();
    
    // 중복 활성 세션 처리
    await ensureSingleActiveSession();
    
    // 활성 세션 조회
    const activeSession = await prisma.voteSession.findFirst({
      where: { 
        isActive: true,
        isCompleted: false
      },
      include: includeVotes ? {
        votes: {
          include: {
            user: {
              select: { id: true, name: true }
            }
          }
        }
      } : undefined,
      orderBy: { createdAt: 'desc' }
    });
    
    return activeSession;
  } catch (error) {
    console.error('❌ 활성 세션 조회 오류:', error);
    throw error;
  }
}

/**
 * 다음주 세션 생성 (안전한 생성)
 */
export async function createNextWeekSession(): Promise<any> {
  try {
    const koreaTime = getKoreaTime();
    const thisWeekMonday = getThisWeekMonday(koreaTime);
    const nextWeekMonday = getNextWeekMonday(koreaTime);
    const nextWeekFriday = getWeekFriday(nextWeekMonday);
    
    // 의견수렴기간 시작일은 이번주 월요일 00:01
    const discussionStartTime = new Date(thisWeekMonday);
    discussionStartTime.setHours(0, 1, 0, 0);
    
    // 기존 활성 세션이 있는지 확인
    const activeSession = await prisma.voteSession.findFirst({
      where: {
        isActive: true,
        isCompleted: false,
      },
    });
    
    if (activeSession) {
      console.log(`⚠️ 기존 활성 세션이 있습니다: ${activeSession.id}. 새로운 세션을 생성하지 않습니다.`);
      return activeSession;
    }
    
    // 비활성 세션 중 다음주 월요일에 해당하는 세션이 있는지 확인
    const existingInactiveSession = await prisma.voteSession.findFirst({
      where: {
        isActive: false,
        isCompleted: false,
        weekStartDate: nextWeekMonday,
      },
    });
    
    if (existingInactiveSession) {
      // 비활성 세션이 있으면 활성화
      const updatedSession = await prisma.voteSession.update({
        where: { id: existingInactiveSession.id },
        data: {
          isActive: true,
          startTime: discussionStartTime,
          endTime: nextWeekFriday,
        },
      });
      console.log(`✅ 기존 비활성 세션 ${existingInactiveSession.id}를 활성화했습니다.`);
      return updatedSession;
    }
    
    // 새로운 투표 세션 생성
    const newSession = await prisma.voteSession.create({
      data: {
        weekStartDate: nextWeekMonday,
        startTime: discussionStartTime,
        endTime: nextWeekFriday,
        isActive: true,
        isCompleted: false,
      },
    });
    
    console.log(`🎉 새로운 투표 세션 생성 완료: ${newSession.id} (${newSession.weekStartDate.toLocaleDateString('ko-KR')})`);
    
    return newSession;
  } catch (error) {
    console.error('❌ 다음주 세션 생성 오류:', error);
    throw error;
  }
}

/**
 * 세션 상태 검증 및 자동 수정
 */
export async function validateAndFixSessionState(): Promise<void> {
  try {
    // 만료된 세션 비활성화
    await deactivateExpiredSessions();
    
    // 중복 활성 세션 처리
    await ensureSingleActiveSession();
    
    console.log('✅ 세션 상태 검증 완료');
  } catch (error) {
    console.error('❌ 세션 상태 검증 오류:', error);
    throw error;
  }
}

