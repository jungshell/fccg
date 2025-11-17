"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authController = __importStar(require("../controllers/authController"));
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = express_1.default.Router();
// Health check 엔드포인트
router.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'Auth service is running',
        timestamp: new Date().toISOString()
    });
});
// 인증 관련 라우트
router.post('/register', (req, res, next) => {
    console.log('라우터 /register req.body:', JSON.stringify(req.body));
    next();
}, authController.register);
router.post('/login', (req, res, next) => {
    console.log('라우터 /login req.body:', JSON.stringify(req.body));
    next();
}, authController.login);
router.get('/profile', authMiddleware_1.authenticateToken, authController.getProfile);
router.put('/profile', authMiddleware_1.authenticateToken, authController.updateProfile);
// 통계 및 멤버 관리
router.get('/stats-summary', authController.statsSummary);
router.get('/members', authController.getAllMembers);
router.post('/members', authController.createMember); // 임시로 인증 제거
router.delete('/delete-test3', authController.deleteTest3User);
router.post('/delete-user', authController.deleteUserByEmail);
router.post('/set-admin', authController.setAdminByEmail);
router.post('/set-attendance', authController.setAttendanceRate);
router.put('/change-password', authMiddleware_1.authenticateToken, authController.changePassword);
// 회원 관리 API
router.get('/members/search', authMiddleware_1.authenticateToken, authController.searchMembers);
router.put('/members/:id', authMiddleware_1.authenticateToken, authController.updateMember);
router.put('/members/:id/status', authMiddleware_1.authenticateToken, authController.updateMemberStatus);
router.put('/members/:id/password', authMiddleware_1.authenticateToken, authController.resetMemberPassword);
router.delete('/members/:id', authController.deleteMember); // 임시로 인증 제거
router.get('/members/stats', authMiddleware_1.authenticateToken, authController.getMemberStats);
// 경기 관리 라우트
router.post('/games', authMiddleware_1.authenticateToken, authController.createGame);
router.get('/games', (req, res, next) => {
    console.log('GET /api/auth/games 요청 들어옴');
    next();
}, authController.getGames);
router.put('/games/:id', authMiddleware_1.authenticateToken, authController.updateGame);
router.delete('/games/:id', authMiddleware_1.authenticateToken, authController.deleteGame);
// 투표 시스템 라우트
router.post('/vote-sessions', authMiddleware_1.authenticateToken, authController.createVoteSession);
router.get('/vote-sessions/active', authController.getActiveVoteSession);
router.post('/votes', authController.submitVote);
router.post('/votes/revote', authController.submitRevote); // 재투표는 별도 함수 사용
router.get('/vote-sessions/:voteSessionId/results', authController.getVoteResults);
router.post('/votes/reset', authController.resetVoteData);
router.get('/vote-status', authMiddleware_1.authenticateToken, authController.getVoteStatus);
router.get('/holidays/:year', authController.getHolidaysAPI);
router.get('/holidays', authController.getHolidaysAPI);
// 투표 세션 완료 및 새로운 투표 세션 생성
router.post('/vote-sessions/complete', authMiddleware_1.authenticateToken, authController.completeVoteSession);
router.post('/vote-sessions/start-weekly', authMiddleware_1.authenticateToken, authController.startWeeklyVote);
router.post('/vote-sessions/:voteSessionId/force-complete', authMiddleware_1.authenticateToken, authController.forceCompleteVoteSession);
// 일정 자동 생성 라우트
router.post('/schedule/weekly', authMiddleware_1.authenticateToken, authController.createWeeklySchedule);
// 이번주 일정 수동 입력 라우트 (사용하지 않음)
// router.post('/this-week-schedules', authenticateToken, authController.createThisWeekSchedule);
// router.get('/this-week-schedules', authController.getThisWeekSchedules);
// router.put('/this-week-schedules/:id', authenticateToken, authController.updateThisWeekSchedule);
// router.delete('/this-week-schedules/:id', authenticateToken, authController.deleteThisWeekSchedule);
// 장소 검색 라우트
router.get('/search-location', authController.searchLocation);
exports.default = router;
