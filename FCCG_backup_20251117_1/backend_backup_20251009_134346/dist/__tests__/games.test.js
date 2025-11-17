"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth_simple_1 = __importDefault(require("../routes/auth_simple"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use('/api/auth', auth_simple_1.default);
const prisma = new client_1.PrismaClient();
describe('Games API Tests', () => {
    let testUser;
    let authToken;
    let testGame;
    beforeAll(async () => {
        // 테스트 사용자 생성
        const hashedPassword = await bcryptjs_1.default.hash('testpassword', 10);
        testUser = await prisma.user.create({
            data: {
                email: 'test@example.com',
                password: hashedPassword,
                name: 'Test User',
                role: 'MEMBER',
                status: 'ACTIVE',
            },
        });
        // JWT 토큰 생성
        authToken = jsonwebtoken_1.default.sign({ userId: testUser.id, email: testUser.email, role: testUser.role }, process.env.JWT_SECRET || 'fc-chalggyeo-secret', { expiresIn: '24h' });
    });
    describe('POST /api/auth/games', () => {
        it('should create a new game', async () => {
            const gameData = {
                date: '2024-01-15T10:00:00Z',
                time: '19:00',
                location: 'Test Stadium',
                gameType: 'SELF',
                eventType: 'TRAINING',
                memberNames: ['Test Member'],
                selectedMembers: [testUser.id],
                mercenaryCount: 2,
            };
            const response = await (0, supertest_1.default)(app)
                .post('/api/auth/games')
                .set('Authorization', `Bearer ${authToken}`)
                .send(gameData);
            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('game');
            expect(response.body.game.location).toBe('Test Stadium');
            expect(response.body.game.mercenaryCount).toBe(2);
            testGame = response.body.game;
        });
        it('should reject game creation without authentication', async () => {
            const gameData = {
                date: '2024-01-15T10:00:00Z',
                location: 'Test Stadium',
            };
            const response = await (0, supertest_1.default)(app)
                .post('/api/auth/games')
                .send(gameData);
            expect(response.status).toBe(401);
        });
        it('should require date and location', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/api/auth/games')
                .set('Authorization', `Bearer ${authToken}`)
                .send({});
            expect(response.status).toBe(400);
        });
    });
    describe('GET /api/auth/games', () => {
        it('should return games list', async () => {
            const response = await (0, supertest_1.default)(app)
                .get('/api/auth/games')
                .set('Authorization', `Bearer ${authToken}`);
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('games');
            expect(Array.isArray(response.body.games)).toBe(true);
        });
        it('should reject request without authentication', async () => {
            const response = await (0, supertest_1.default)(app)
                .get('/api/auth/games');
            expect(response.status).toBe(401);
        });
    });
    describe('PUT /api/auth/games/:id', () => {
        it('should update an existing game', async () => {
            if (!testGame) {
                // 게임이 없으면 생성
                const gameData = {
                    date: '2024-01-15T10:00:00Z',
                    time: '19:00',
                    location: 'Test Stadium',
                    gameType: 'SELF',
                    eventType: 'TRAINING',
                    memberNames: ['Test Member'],
                    selectedMembers: [testUser.id],
                    mercenaryCount: 2,
                };
                const createResponse = await (0, supertest_1.default)(app)
                    .post('/api/auth/games')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(gameData);
                testGame = createResponse.body.game;
            }
            const updateData = {
                time: '20:00',
                location: 'Updated Stadium',
                mercenaryCount: 3,
            };
            const response = await (0, supertest_1.default)(app)
                .put(`/api/auth/games/${testGame.id}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData);
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('game');
            expect(response.body.game.location).toBe('Updated Stadium');
            expect(response.body.game.mercenaryCount).toBe(3);
        });
        it('should reject update without authentication', async () => {
            if (!testGame)
                return;
            const updateData = {
                location: 'Updated Stadium',
            };
            const response = await (0, supertest_1.default)(app)
                .put(`/api/auth/games/${testGame.id}`)
                .send(updateData);
            expect(response.status).toBe(401);
        });
        it('should reject update of non-existent game', async () => {
            const updateData = {
                location: 'Updated Stadium',
            };
            const response = await (0, supertest_1.default)(app)
                .put('/api/auth/games/99999')
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData);
            expect(response.status).toBe(404);
        });
    });
    describe('DELETE /api/auth/games/:id', () => {
        it('should delete an existing game', async () => {
            if (!testGame)
                return;
            const response = await (0, supertest_1.default)(app)
                .delete(`/api/auth/games/${testGame.id}`)
                .set('Authorization', `Bearer ${authToken}`);
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('message');
        });
        it('should reject delete without authentication', async () => {
            const response = await (0, supertest_1.default)(app)
                .delete('/api/auth/games/1');
            expect(response.status).toBe(401);
        });
        it('should reject delete of non-existent game', async () => {
            const response = await (0, supertest_1.default)(app)
                .delete('/api/auth/games/99999')
                .set('Authorization', `Bearer ${authToken}`);
            expect(response.status).toBe(404);
        });
    });
});
