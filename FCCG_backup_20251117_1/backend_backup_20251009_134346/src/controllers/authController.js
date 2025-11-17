"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.resetPassword = resetPassword;
exports.getProfile = getProfile;
exports.updateProfile = updateProfile;
exports.requireAdmin = requireAdmin;
exports.statsSummary = statsSummary;
exports.getAllMembers = getAllMembers;
exports.deleteTest3User = deleteTest3User;
exports.setAdminByEmail = setAdminByEmail;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'fc-chalggyeo-secret';
function signToken(user) {
    return jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}
// 유저 출석률(참여율) 계산 함수
function getAttendanceRate(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        // 출석률 = 출석(YES) / 전체 출석 기록 * 100 (소수점 반올림)
        const total = yield prisma.attendance.count({ where: { userId } });
        if (total === 0)
            return 0;
        const yes = yield prisma.attendance.count({ where: { userId, status: 'YES' } });
        return Math.round((yes / total) * 100);
    });
}
function register(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { email, password, name, phone } = req.body;
            if (!email || !password || !name)
                return res.status(400).json({ message: '필수 항목 누락' });
            const exists = yield prisma.user.findUnique({ where: { email } });
            if (exists)
                return res.status(409).json({ message: '이미 가입된 이메일입니다.' });
            const hashed = yield bcrypt_1.default.hash(password, 10);
            const user = yield prisma.user.create({
                data: { email, password: hashed, name, phone, role: 'MEMBER' },
            });
            const token = signToken(user);
            const attendance = yield getAttendanceRate(user.id);
            res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, attendance } });
        }
        catch (e) {
            console.error('회원가입 에러:', e);
            res.status(500).json({ message: '회원가입 실패', error: (e === null || e === void 0 ? void 0 : e.message) || String(e) });
        }
    });
}
function login(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { email, password } = req.body;
            if (!email || !password)
                return res.status(400).json({ message: '필수 항목 누락' });
            const user = yield prisma.user.findUnique({ where: { email } });
            if (!user)
                return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
            const valid = yield bcrypt_1.default.compare(password, user.password);
            if (!valid)
                return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
            const token = signToken(user);
            const attendance = yield getAttendanceRate(user.id);
            res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, attendance } });
        }
        catch (e) {
            console.error('로그인 에러:', e);
            res.status(500).json({ message: '로그인 실패', error: (e === null || e === void 0 ? void 0 : e.message) || String(e) });
        }
    });
}
// 비밀번호 재설정(임시, 이메일 인증 미포함)
function resetPassword(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { email, newPassword } = req.body;
            if (!email || !newPassword)
                return res.status(400).json({ message: '필수 항목 누락' });
            const user = yield prisma.user.findUnique({ where: { email } });
            if (!user)
                return res.status(404).json({ message: '존재하지 않는 이메일입니다.' });
            const hashed = yield bcrypt_1.default.hash(newPassword, 10);
            yield prisma.user.update({ where: { email }, data: { password: hashed } });
            res.json({ message: '비밀번호가 재설정되었습니다.' });
        }
        catch (e) {
            res.status(500).json({ message: '비밀번호 재설정 실패', error: (e === null || e === void 0 ? void 0 : e.message) || String(e) });
        }
    });
}
// 내 프로필 조회
function getProfile(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            if (!userId)
                return res.status(401).json({ message: '인증 필요' });
            const user = yield prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, phone: true, avatarUrl: true, role: true } });
            const attendance = yield getAttendanceRate(userId);
            res.json({ user: Object.assign(Object.assign({}, user), { attendance }) });
        }
        catch (e) {
            res.status(500).json({ message: '프로필 조회 실패', error: (e === null || e === void 0 ? void 0 : e.message) || String(e) });
        }
    });
}
// 내 프로필 수정
function updateProfile(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            if (!userId)
                return res.status(401).json({ message: '인증 필요' });
            const { name, phone, avatarUrl } = req.body;
            const user = yield prisma.user.update({ where: { id: userId }, data: { name, phone, avatarUrl } });
            const attendance = yield getAttendanceRate(userId);
            res.json({ user: { id: user.id, email: user.email, name: user.name, phone: user.phone, avatarUrl: user.avatarUrl, role: user.role, attendance } });
        }
        catch (e) {
            res.status(500).json({ message: '프로필 수정 실패', error: (e === null || e === void 0 ? void 0 : e.message) || String(e) });
        }
    });
}
// 관리자 권한 체크 미들웨어 예시 (라우터에서 사용)
function requireAdmin(req, res, next) {
    var _a;
    if (((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) !== 'ADMIN')
        return res.status(403).json({ message: '관리자 권한 필요' });
    next();
}
// 통계 요약 API
function statsSummary(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // 총 멤버 수
            const totalMembers = yield prisma.user.count();
            // 총 경기 수
            const totalGames = yield prisma.schedule.count();
            // 이번 주 경기 (월~일)
            const now = new Date();
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay() + 1); // 월요일
            startOfWeek.setHours(0, 0, 0, 0);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);
            const thisWeekGame = yield prisma.schedule.findFirst({
                where: {
                    date: {
                        gte: startOfWeek,
                        lte: endOfWeek
                    }
                },
                orderBy: { date: 'asc' }
            });
            // 다음주 경기 투표 (다음주 월~일)
            const startOfNextWeek = new Date(endOfWeek);
            startOfNextWeek.setDate(endOfWeek.getDate() + 1);
            startOfNextWeek.setHours(0, 0, 0, 0);
            const endOfNextWeek = new Date(startOfNextWeek);
            endOfNextWeek.setDate(startOfNextWeek.getDate() + 6);
            endOfNextWeek.setHours(23, 59, 59, 999);
            const nextWeekVote = yield prisma.schedule.findFirst({
                where: {
                    date: {
                        gte: startOfNextWeek,
                        lte: endOfNextWeek
                    }
                },
                orderBy: { date: 'asc' }
            });
            res.json({
                totalMembers,
                totalGames,
                thisWeekGame,
                nextWeekVote
            });
        }
        catch (e) {
            res.status(500).json({ message: '통계 요약 조회 실패', error: (e === null || e === void 0 ? void 0 : e.message) || String(e) });
        }
    });
}
// 전체 멤버 리스트 (이름 오름차순)
function getAllMembers(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const members = yield prisma.user.findMany({
                select: { id: true, name: true },
                orderBy: { name: 'asc' }
            });
            res.json({ members });
        }
        catch (e) {
            res.status(500).json({ message: '멤버 목록 조회 실패', error: (e === null || e === void 0 ? void 0 : e.message) || String(e) });
        }
    });
}
// 이름이 '테스트3'인 유저 삭제 (임시)
function deleteTest3User(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const deleted = yield prisma.user.deleteMany({ where: { name: '테스트3' } });
            res.json({ deletedCount: deleted.count });
        }
        catch (e) {
            res.status(500).json({ message: '테스트3 계정 삭제 실패', error: (e === null || e === void 0 ? void 0 : e.message) || String(e) });
        }
    });
}
// 이메일로 유저를 관리자로 지정
function setAdminByEmail(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { email } = req.body;
            if (!email)
                return res.status(400).json({ message: '이메일이 필요합니다.' });
            const user = yield prisma.user.findUnique({ where: { email } });
            if (!user)
                return res.status(404).json({ message: '해당 이메일의 유저가 없습니다.' });
            yield prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
            res.json({ message: '관리자로 지정되었습니다.' });
        }
        catch (e) {
            res.status(500).json({ message: '관리자 지정 실패', error: (e === null || e === void 0 ? void 0 : e.message) || String(e) });
        }
    });
}
