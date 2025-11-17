"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// 테스트 전후 데이터베이스 정리
beforeAll(async () => {
    // 테스트 데이터베이스 연결 확인
    await prisma.$connect();
});
afterAll(async () => {
    // 테스트 완료 후 데이터베이스 연결 해제
    await prisma.$disconnect();
});
beforeEach(async () => {
    // 각 테스트 전에 데이터 정리
    try {
        await prisma.attendance.deleteMany();
        await prisma.vote.deleteMany();
        await prisma.voteSession.deleteMany();
        await prisma.game.deleteMany();
        await prisma.user.deleteMany();
    }
    catch (error) {
        console.log('Setup cleanup error (expected in some cases):', error);
    }
});
// Simple test to verify setup works
describe('Test Setup', () => {
    it('should connect to database', async () => {
        expect(prisma).toBeDefined();
    });
});
