"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const auth_simple_1 = __importDefault(require("../routes/auth_simple"));
const client_1 = require("@prisma/client");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const app = (0, express_1.default)();
app.use(body_parser_1.default.json());
app.use('/api/auth', auth_simple_1.default);
const prisma = new client_1.PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'fc-chalggyeo-secret';
let adminToken;
let adminUser;
beforeAll(async () => {
    // Create an admin user for testing
    adminUser = await prisma.user.create({
        data: {
            email: 'boundary-admin@example.com',
            password: 'password123',
            name: 'Boundary Admin',
            role: 'ADMIN',
        },
    });
    adminToken = jsonwebtoken_1.default.sign({ userId: adminUser.id, email: adminUser.email, role: adminUser.role }, JWT_SECRET, { expiresIn: '1h' });
});
describe('Boundary Tests', () => {
    beforeEach(async () => {
        // Clear test data before each test
        await prisma.attendance.deleteMany();
        await prisma.game.deleteMany();
    });
    afterAll(async () => {
        await prisma.attendance.deleteMany();
        await prisma.game.deleteMany();
        await prisma.user.deleteMany();
        await prisma.$disconnect();
    });
    describe('Input Validation Boundary Tests', () => {
        it('should reject extremely long location names', async () => {
            const longLocation = 'A'.repeat(1000); // 1000 character location name
            const res = await (0, supertest_1.default)(app)
                .post('/api/auth/games')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                date: '2025-10-10T10:00:00Z',
                time: '19:00',
                location: longLocation,
                gameType: 'MATCH',
                eventType: 'TRAINING',
                mercenaryCount: 0,
                memberNames: [],
                selectedMembers: [],
            });
            expect(res.statusCode).toEqual(400);
            expect(res.body).toHaveProperty('error');
        });
        it('should reject negative mercenary count', async () => {
            const res = await (0, supertest_1.default)(app)
                .post('/api/auth/games')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                date: '2025-10-10T10:00:00Z',
                time: '19:00',
                location: 'Test Stadium',
                gameType: 'MATCH',
                eventType: 'TRAINING',
                mercenaryCount: -5,
                memberNames: [],
                selectedMembers: [],
            });
            expect(res.statusCode).toEqual(400);
            expect(res.body).toHaveProperty('error');
        });
        it('should reject extremely high mercenary count', async () => {
            const res = await (0, supertest_1.default)(app)
                .post('/api/auth/games')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                date: '2025-10-10T10:00:00Z',
                time: '19:00',
                location: 'Test Stadium',
                gameType: 'MATCH',
                eventType: 'TRAINING',
                mercenaryCount: 1000,
                memberNames: [],
                selectedMembers: [],
            });
            expect(res.statusCode).toEqual(400);
            expect(res.body).toHaveProperty('error');
        });
        it('should reject invalid date formats', async () => {
            const res = await (0, supertest_1.default)(app)
                .post('/api/auth/games')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                date: 'invalid-date',
                time: '19:00',
                location: 'Test Stadium',
                gameType: 'MATCH',
                eventType: 'TRAINING',
                mercenaryCount: 0,
                memberNames: [],
                selectedMembers: [],
            });
            expect(res.statusCode).toEqual(400);
            expect(res.body).toHaveProperty('error');
        });
        it('should reject invalid game types', async () => {
            const res = await (0, supertest_1.default)(app)
                .post('/api/auth/games')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                date: '2025-10-10T10:00:00Z',
                time: '19:00',
                location: 'Test Stadium',
                gameType: 'INVALID_TYPE',
                eventType: 'TRAINING',
                mercenaryCount: 0,
                memberNames: [],
                selectedMembers: [],
            });
            expect(res.statusCode).toEqual(400);
            expect(res.body).toHaveProperty('error');
        });
        it('should reject invalid event types', async () => {
            const res = await (0, supertest_1.default)(app)
                .post('/api/auth/games')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                date: '2025-10-10T10:00:00Z',
                time: '19:00',
                location: 'Test Stadium',
                gameType: 'MATCH',
                eventType: 'INVALID_EVENT',
                mercenaryCount: 0,
                memberNames: [],
                selectedMembers: [],
            });
            expect(res.statusCode).toEqual(400);
            expect(res.body).toHaveProperty('error');
        });
    });
    describe('Database Constraint Boundary Tests', () => {
        it('should handle duplicate game creation on same date/time', async () => {
            // Create first game
            const firstGame = await (0, supertest_1.default)(app)
                .post('/api/auth/games')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                date: '2025-10-10T10:00:00Z',
                time: '19:00',
                location: 'Test Stadium',
                gameType: 'MATCH',
                eventType: 'TRAINING',
                mercenaryCount: 0,
                memberNames: [],
                selectedMembers: [],
            });
            expect(firstGame.statusCode).toEqual(201);
            // Try to create duplicate game
            const duplicateGame = await (0, supertest_1.default)(app)
                .post('/api/auth/games')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                date: '2025-10-10T10:00:00Z',
                time: '19:00',
                location: 'Test Stadium',
                gameType: 'MATCH',
                eventType: 'TRAINING',
                mercenaryCount: 0,
                memberNames: [],
                selectedMembers: [],
            });
            // Should either succeed (if duplicates are allowed) or fail gracefully
            expect([200, 201, 400, 409]).toContain(duplicateGame.statusCode);
        });
        it('should handle non-existent user IDs in selectedMembers', async () => {
            const res = await (0, supertest_1.default)(app)
                .post('/api/auth/games')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                date: '2025-10-10T10:00:00Z',
                time: '19:00',
                location: 'Test Stadium',
                gameType: 'MATCH',
                eventType: 'TRAINING',
                mercenaryCount: 0,
                memberNames: [],
                selectedMembers: [99999], // Non-existent user ID
            });
            expect(res.statusCode).toEqual(400);
            expect(res.body).toHaveProperty('error');
        });
        it('should handle empty memberNames array', async () => {
            const res = await (0, supertest_1.default)(app)
                .post('/api/auth/games')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                date: '2025-10-10T10:00:00Z',
                time: '19:00',
                location: 'Test Stadium',
                gameType: 'MATCH',
                eventType: 'TRAINING',
                mercenaryCount: 0,
                memberNames: [],
                selectedMembers: [],
            });
            expect(res.statusCode).toEqual(201);
            expect(res.body).toHaveProperty('game');
        });
        it('should handle empty selectedMembers array', async () => {
            const res = await (0, supertest_1.default)(app)
                .post('/api/auth/games')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                date: '2025-10-10T10:00:00Z',
                time: '19:00',
                location: 'Test Stadium',
                gameType: 'MATCH',
                eventType: 'TRAINING',
                mercenaryCount: 0,
                memberNames: ['Guest Player'],
                selectedMembers: [],
            });
            expect(res.statusCode).toEqual(201);
            expect(res.body).toHaveProperty('game');
        });
    });
    describe('Authentication Boundary Tests', () => {
        it('should reject requests without authorization header', async () => {
            const res = await (0, supertest_1.default)(app)
                .post('/api/auth/games')
                .send({
                date: '2025-10-10T10:00:00Z',
                time: '19:00',
                location: 'Test Stadium',
                gameType: 'MATCH',
                eventType: 'TRAINING',
                mercenaryCount: 0,
                memberNames: [],
                selectedMembers: [],
            });
            expect(res.statusCode).toEqual(401);
            expect(res.body).toHaveProperty('error', '토큰이 필요합니다.');
        });
        it('should reject requests with invalid token format', async () => {
            const res = await (0, supertest_1.default)(app)
                .post('/api/auth/games')
                .set('Authorization', 'Bearer invalid-token-format')
                .send({
                date: '2025-10-10T10:00:00Z',
                time: '19:00',
                location: 'Test Stadium',
                gameType: 'MATCH',
                eventType: 'TRAINING',
                mercenaryCount: 0,
                memberNames: [],
                selectedMembers: [],
            });
            expect(res.statusCode).toEqual(401);
            expect(res.body).toHaveProperty('error', '유효하지 않은 토큰입니다.');
        });
        it('should reject requests with expired token', async () => {
            const expiredToken = jsonwebtoken_1.default.sign({ userId: adminUser.id, email: adminUser.email, role: adminUser.role }, JWT_SECRET, { expiresIn: '-1h' } // Expired 1 hour ago
            );
            const res = await (0, supertest_1.default)(app)
                .post('/api/auth/games')
                .set('Authorization', `Bearer ${expiredToken}`)
                .send({
                date: '2025-10-10T10:00:00Z',
                time: '19:00',
                location: 'Test Stadium',
                gameType: 'MATCH',
                eventType: 'TRAINING',
                mercenaryCount: 0,
                memberNames: [],
                selectedMembers: [],
            });
            expect(res.statusCode).toEqual(401);
            expect(res.body).toHaveProperty('error', '유효하지 않은 토큰입니다.');
        });
        it('should reject requests with malformed authorization header', async () => {
            const res = await (0, supertest_1.default)(app)
                .post('/api/auth/games')
                .set('Authorization', 'MalformedHeader')
                .send({
                date: '2025-10-10T10:00:00Z',
                time: '19:00',
                location: 'Test Stadium',
                gameType: 'MATCH',
                eventType: 'TRAINING',
                mercenaryCount: 0,
                memberNames: [],
                selectedMembers: [],
            });
            expect(res.statusCode).toEqual(401);
            expect(res.body).toHaveProperty('error', '토큰이 필요합니다.');
        });
    });
    describe('Performance Boundary Tests', () => {
        it('should handle large number of member names', async () => {
            const largeMemberList = Array.from({ length: 100 }, (_, i) => `Guest Player ${i + 1}`);
            const res = await (0, supertest_1.default)(app)
                .post('/api/auth/games')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                date: '2025-10-10T10:00:00Z',
                time: '19:00',
                location: 'Test Stadium',
                gameType: 'MATCH',
                eventType: 'TRAINING',
                mercenaryCount: 0,
                memberNames: largeMemberList,
                selectedMembers: [],
            });
            expect(res.statusCode).toEqual(201);
            expect(res.body).toHaveProperty('game');
            expect(res.body.game.attendances).toHaveLength(100);
        });
        it('should handle large number of selected members', async () => {
            // Create multiple users for testing
            const users = await Promise.all(Array.from({ length: 50 }, (_, i) => prisma.user.create({
                data: {
                    email: `testuser${i}@example.com`,
                    password: 'password123',
                    name: `Test User ${i}`,
                    role: 'MEMBER',
                },
            })));
            const res = await (0, supertest_1.default)(app)
                .post('/api/auth/games')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                date: '2025-10-10T10:00:00Z',
                time: '19:00',
                location: 'Test Stadium',
                gameType: 'MATCH',
                eventType: 'TRAINING',
                mercenaryCount: 0,
                memberNames: [],
                selectedMembers: users.map(user => user.id),
            });
            expect(res.statusCode).toEqual(201);
            expect(res.body).toHaveProperty('game');
            expect(res.body.game.attendances).toHaveLength(50);
            // Clean up test users
            await prisma.user.deleteMany({
                where: { id: { in: users.map(user => user.id) } }
            });
        });
    });
    describe('Edge Case Tests', () => {
        it('should handle timezone edge cases', async () => {
            const res = await (0, supertest_1.default)(app)
                .post('/api/auth/games')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                date: '2025-10-10T23:59:59Z', // End of day UTC
                time: '19:00',
                location: 'Test Stadium',
                gameType: 'MATCH',
                eventType: 'TRAINING',
                mercenaryCount: 0,
                memberNames: [],
                selectedMembers: [],
            });
            expect(res.statusCode).toEqual(201);
            expect(res.body).toHaveProperty('game');
        });
        it('should handle leap year dates', async () => {
            const res = await (0, supertest_1.default)(app)
                .post('/api/auth/games')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                date: '2024-02-29T10:00:00Z', // Leap year date
                time: '19:00',
                location: 'Test Stadium',
                gameType: 'MATCH',
                eventType: 'TRAINING',
                mercenaryCount: 0,
                memberNames: [],
                selectedMembers: [],
            });
            expect(res.statusCode).toEqual(201);
            expect(res.body).toHaveProperty('game');
        });
        it('should handle special characters in member names', async () => {
            const specialNames = [
                '김철수',
                'John O\'Connor',
                'José María',
                '李小明',
                'Александр',
                'François',
                'Müller',
                'Test@#$%^&*()',
                'Name with spaces',
                'Name-with-dashes',
                'Name_with_underscores'
            ];
            const res = await (0, supertest_1.default)(app)
                .post('/api/auth/games')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                date: '2025-10-10T10:00:00Z',
                time: '19:00',
                location: 'Test Stadium',
                gameType: 'MATCH',
                eventType: 'TRAINING',
                mercenaryCount: 0,
                memberNames: specialNames,
                selectedMembers: [],
            });
            expect(res.statusCode).toEqual(201);
            expect(res.body).toHaveProperty('game');
            expect(res.body.game.attendances).toHaveLength(specialNames.length);
        });
    });
});
