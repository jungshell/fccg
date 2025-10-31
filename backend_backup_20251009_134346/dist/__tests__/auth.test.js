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
describe('Authentication API Tests', () => {
    let testUser;
    let authToken;
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
    describe('POST /api/auth/login', () => {
        it('should login with valid credentials', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/api/auth/login')
                .send({
                email: 'test@example.com',
                password: 'testpassword',
            });
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('user');
            expect(response.body.user.email).toBe('test@example.com');
        });
        it('should reject invalid credentials', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/api/auth/login')
                .send({
                email: 'test@example.com',
                password: 'wrongpassword',
            });
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error');
        });
        it('should reject non-existent user', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/api/auth/login')
                .send({
                email: 'nonexistent@example.com',
                password: 'testpassword',
            });
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error');
        });
        it('should require email and password', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/api/auth/login')
                .send({});
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });
    });
    describe('POST /api/auth/register', () => {
        it('should register a new user', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/api/auth/register')
                .send({
                email: 'newuser@example.com',
                password: 'newpassword',
                name: 'New User',
            });
            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('user');
            expect(response.body.user.email).toBe('newuser@example.com');
        });
        it('should reject duplicate email', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/api/auth/register')
                .send({
                email: 'test@example.com',
                password: 'testpassword',
                name: 'Test User',
            });
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });
        it('should require all fields', async () => {
            const response = await (0, supertest_1.default)(app)
                .post('/api/auth/register')
                .send({
                email: 'incomplete@example.com',
            });
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });
    });
    describe('GET /api/auth/profile', () => {
        it('should return user profile with valid token', async () => {
            const response = await (0, supertest_1.default)(app)
                .get('/api/auth/profile')
                .set('Authorization', `Bearer ${authToken}`);
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('user');
            expect(response.body.user.email).toBe('test@example.com');
        });
        it('should reject request without token', async () => {
            const response = await (0, supertest_1.default)(app)
                .get('/api/auth/profile');
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error');
        });
        it('should reject request with invalid token', async () => {
            const response = await (0, supertest_1.default)(app)
                .get('/api/auth/profile')
                .set('Authorization', 'Bearer invalidtoken');
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('error');
        });
    });
});
