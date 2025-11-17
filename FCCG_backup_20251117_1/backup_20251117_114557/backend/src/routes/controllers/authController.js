"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchLocation = exports.deleteThisWeekSchedule = exports.updateThisWeekSchedule = exports.getThisWeekSchedules = exports.createThisWeekSchedule = exports.submitRevote = exports.getHolidaysAPI = exports.getVoteStatus = exports.completeVoteSessionScheduler = exports.startWeeklyVoteScheduler = exports.getMemberStats = exports.changePassword = exports.resetMemberPassword = exports.deleteMember = exports.updateMemberStatus = exports.updateMember = exports.searchMembers = exports.resetVoteData = exports.createWeeklySchedule = exports.generateWeeklySchedule = exports.forceCompleteVoteSession = exports.completeVoteSession = exports.startWeeklyVote = exports.getVoteResults = exports.submitVote = exports.getActiveVoteSession = exports.createVoteSession = exports.deleteGame = exports.updateGame = exports.getGames = exports.createGame = exports.setAttendanceRate = exports.setAdminByEmail = exports.deleteUserByEmail = exports.deleteTest3User = exports.getAllMembers = exports.statsSummary = exports.updateProfile = exports.getProfile = exports.login = exports.register = void 0;
const client_1 = require("@prisma/client");
const bcrypt_1 = require("bcrypt");
const jsonwebtoken_1 = require("jsonwebtoken");
const axios_1 = require("axios");
const fs_1 = require("fs");
const path_1 = require("path");
// 투표 데이터 파일 경로
const VOTE_DATA_FILE = path_1.default.join(__dirname, '../../voteData.json');
// 투표 데이터 로드 함수
const loadVoteData = () => {
    try {
        if (fs_1.default.existsSync(VOTE_DATA_FILE)) {
            const data = fs_1.default.readFileSync(VOTE_DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    }
    catch (error) {
        console.error('투표 데이터 로드 오류:', error);
    }
    return [];
};
// 투표 데이터 저장 함수
const saveVoteData = (voteData) => {
    try {
        fs_1.default.writeFileSync(VOTE_DATA_FILE, JSON.stringify(voteData, null, 2));
    }
    catch (error) {
        console.error('투표 데이터 저장 오류:', error);
    }
};
const prisma = new client_1.PrismaClient();
// 공휴일 API 호출 함수
const getHolidays = async (year) => {
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
        const response = await axios_1.default.get(`${url}?${params.toString()}`);
        if (response.data && response.data.response && response.data.response.body) {
            const items = response.data.response.body.items.item;
            const holidays = {};
            // 단일 항목인 경우 배열로 변환
            const holidayList = Array.isArray(items) ? items : [items];
            holidayList.forEach((item) => {
                if (item && item.locdate && item.dateName) {
                    const dateStr = item.locdate.toString();
                    const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
                    holidays[formattedDate] = item.dateName;
                }
            });
            console.log(`공휴일 API 결과: ${Object.keys(holidays).length}개 공휴일 조회됨`);
            return holidays;
        }
        else {
            console.log('API 응답 형식이 예상과 다릅니다:', response.data);
            return {};
        }
    }
    catch (error) {
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
const isHoliday = (date, holidays) => {
    const dateString = date.toISOString().split('T')[0];
    if (dateString === '2025-08-15')
        return true;
    if (holidays[dateString])
        return true;
    return false;
};
// 기존 함수들...
const register = async (req, res) => {
    console.log('==== register 진입 ====', JSON.stringify(req.body));
    // 중첩된 구조 처리
    let email, password, name;
    if (req.body.email && typeof req.body.email === 'object') {
        email = req.body.email.email;
        password = req.body.email.password;
        name = req.body.email.name;
    }
    else {
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
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        // 사용자 생성
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name
            }
        });
        // JWT 토큰 생성
        const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '7d' });
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
    }
    catch (error) {
        console.error('회원가입 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.register = register;
const login = async (req, res) => {
    console.log('==== login 진입 ====', JSON.stringify(req.body));
    // 중첩된 구조 처리
    let email, password;
    if (req.body.email && typeof req.body.email === 'object') {
        email = req.body.email.email;
        password = req.body.email.password;
    }
    else {
        email = req.body.email;
        password = req.body.password;
    }
    console.log('login body:', JSON.stringify({ email, password }));
    try {
        // 사용자 찾기
        const user = await prisma.user.findUnique({
            where: { email }
        });
        if (!user) {
            return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
        }
        // 비밀번호 확인
        const isValidPassword = await bcrypt_1.default.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
        }
        // JWT 토큰 생성
        const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'fc-chalggyeo-secret', { expiresIn: '7d' });
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                attendance: user.attendance
            }
        });
    }
    catch (error) {
        console.error('로그인 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.login = login;
const getProfile = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const userEmail = req.user?.email;
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
                    status: true
                }
            });
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
                        password: await bcrypt_1.default.hash('password123', 10),
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
        res.json({ user });
    }
    catch (error) {
        console.error('프로필 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.getProfile = getProfile;
const updateProfile = async (req, res) => {
    try {
        const userId = req.user?.userId;
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
    }
    catch (error) {
        console.error('프로필 업데이트 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.updateProfile = updateProfile;
const statsSummary = async (req, res) => {
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
    }
    catch (error) {
        console.error('통계 요약 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.statsSummary = statsSummary;
const getAllMembers = async (req, res) => {
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
    }
    catch (error) {
        console.error('멤버 목록 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.getAllMembers = getAllMembers;
const deleteTest3User = async (req, res) => {
    try {
        await prisma.user.deleteMany({
            where: {
                email: 'test3@test.com'
            }
        });
        res.json({ message: 'test3 사용자가 삭제되었습니다.' });
    }
    catch (error) {
        console.error('test3 사용자 삭제 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.deleteTest3User = deleteTest3User;
const deleteUserByEmail = async (req, res) => {
    try {
        const { email } = req.body;
        await prisma.user.deleteMany({
            where: {
                email: email
            }
        });
        res.json({ message: `${email} 사용자가 삭제되었습니다.` });
    }
    catch (error) {
        console.error('사용자 삭제 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.deleteUserByEmail = deleteUserByEmail;
const setAdminByEmail = async (req, res) => {
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
    }
    catch (error) {
        console.error('관리자 설정 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.setAdminByEmail = setAdminByEmail;
const setAttendanceRate = async (req, res) => {
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
    }
    catch (error) {
        console.error('참여율 설정 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.setAttendanceRate = setAttendanceRate;
// ===== 경기 관리 API =====
const createGame = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { date, location, eventType, mercenaryCount, memberNames, createdById } = req.body;
        if (!userId) {
            return res.status(401).json({ error: '인증이 필요합니다.' });
        }
        // 관리자만 경기 생성 가능
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        if (user?.role !== 'ADMIN') {
            return res.status(403).json({ error: '관리자만 경기를 생성할 수 있습니다.' });
        }
        if (!date || !location) {
            return res.status(400).json({ error: '날짜와 장소는 필수입니다.' });
        }
        const game = await prisma.game.create({
            data: {
                date: new Date(date),
                location,
                eventType: eventType || '자체',
                mercenaryCount: mercenaryCount || 0,
                memberNames: JSON.stringify(memberNames || []),
                createdById: createdById || userId
            }
        });
        // 참석자 정보 저장 (memberNames가 있는 경우)
        if (memberNames && memberNames.length > 0) {
            for (const memberName of memberNames) {
                if (memberName.trim()) {
                    // 사용자 ID 찾기 (이름으로)
                    const user = await prisma.user.findFirst({
                        where: { name: memberName.trim() }
                    });
                    if (user) {
                        await prisma.attendance.create({
                            data: {
                                gameId: game.id,
                                userId: user.id,
                                status: 'YES'
                            }
                        });
                    }
                }
            }
        }
        res.status(201).json({
            message: '경기가 생성되었습니다.',
            game
        });
    }
    catch (error) {
        console.error('경기 생성 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.createGame = createGame;
const getGames = async (req, res) => {
    try {
        // 실제 데이터베이스에서 경기 목록 조회
        const games = await prisma.game.findMany({
            include: {
                attendances: {
                    include: {
                        user: true
                    }
                }
            },
            orderBy: {
                date: 'asc'
            }
        });
        res.json({ games });
    }
    catch (error) {
        console.error('경기 목록 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.getGames = getGames;
const updateGame = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;
        const { date, location, eventType, mercenaryCount, memberNames } = req.body;
        if (!userId) {
            return res.status(401).json({ error: '인증이 필요합니다.' });
        }
        // 관리자만 경기 수정 가능
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        if (user?.role !== 'ADMIN') {
            return res.status(403).json({ error: '관리자만 경기를 수정할 수 있습니다.' });
        }
        const game = await prisma.game.update({
            where: { id: parseInt(id) },
            data: {
                date: date ? new Date(date) : undefined,
                location,
                eventType: eventType || '자체',
                mercenaryCount: mercenaryCount || 0,
                memberNames: JSON.stringify(memberNames || [])
            }
        });
        // 기존 참석자 정보 삭제
        await prisma.attendance.deleteMany({
            where: { gameId: parseInt(id) }
        });
        // 새로운 참석자 정보 저장 (memberNames가 있는 경우)
        if (memberNames && memberNames.length > 0) {
            for (const memberName of memberNames) {
                if (memberName.trim()) {
                    // 사용자 ID 찾기 (이름으로)
                    const user = await prisma.user.findFirst({
                        where: { name: memberName.trim() }
                    });
                    if (user) {
                        await prisma.attendance.create({
                            data: {
                                gameId: parseInt(id),
                                userId: user.id,
                                status: 'YES'
                            }
                        });
                    }
                }
            }
        }
        res.json({
            message: '경기가 수정되었습니다.',
            game
        });
    }
    catch (error) {
        console.error('경기 수정 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.updateGame = updateGame;
const deleteGame = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;
        if (!userId) {
            return res.status(401).json({ error: '인증이 필요합니다.' });
        }
        // 관리자만 경기 삭제 가능
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        if (user?.role !== 'ADMIN') {
            return res.status(403).json({ error: '관리자만 경기를 삭제할 수 있습니다.' });
        }
        await prisma.game.delete({
            where: { id: parseInt(id) }
        });
        res.json({ message: '경기가 삭제되었습니다.' });
    }
    catch (error) {
        console.error('경기 삭제 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.deleteGame = deleteGame;
// ===== 투표 시스템 API =====
const createVoteSession = async (req, res) => {
    try {
        const userId = req.user?.userId;
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
        endTime.setDate(startTime.getDate() + 2); // 수요일
        endTime.setHours(12, 0, 0, 0); // 12:00
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
    }
    catch (error) {
        console.error('투표 세션 생성 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.createVoteSession = createVoteSession;
const getActiveVoteSession = async (req, res) => {
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
    }
    catch (error) {
        console.error('활성 투표 세션 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.getActiveVoteSession = getActiveVoteSession;
const submitVote = async (req, res) => {
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
        const existingVoteIndex = voteData.findIndex((vote) => vote.userId === userId);
        if (existingVoteIndex !== -1) {
            // 기존 투표가 있으면 업데이트
            console.log('기존 투표 발견, 업데이트:', voteData[existingVoteIndex]);
            voteData[existingVoteIndex] = {
                userId,
                selectedDays,
                timestamp: new Date().toISOString()
            };
            console.log('투표 업데이트 완료');
        }
        else {
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
    }
    catch (error) {
        console.error('투표 제출 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.submitVote = submitVote;
const getVoteResults = async (req, res) => {
    try {
        const { voteSessionId } = req.params;
        // 파일에서 투표 데이터 로드
        const voteData = loadVoteData();
        console.log('현재 저장된 투표 데이터:', voteData);
        // 각 요일별 투표 수 계산
        const voteCounts = {
            MON: 0,
            TUE: 0,
            WED: 0,
            THU: 0,
            FRI: 0,
            불참: 0
        };
        // 실제 투표 데이터 집계
        voteData.forEach((vote) => {
            vote.selectedDays.forEach((day) => {
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
    }
    catch (error) {
        console.error('투표 결과 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.getVoteResults = getVoteResults;
// ===== 자동화 함수들 =====
const startWeeklyVote = async (req, res) => {
    try {
        // 다음주 월요일 날짜 계산 (8월 11일)
        const now = new Date();
        const nextMonday = new Date(now);
        nextMonday.setDate(now.getDate() + (8 - now.getDay()) % 7);
        nextMonday.setHours(0, 1, 0, 0); // 월요일 00:01
        // 투표 종료일을 다음주 목요일 17:00으로 설정 (규칙 통일)
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
    }
    catch (error) {
        console.error('주간 투표 세션 생성 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.startWeeklyVote = startWeeklyVote;
const completeVoteSession = async (req, res) => {
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
        }
        else {
            res.json({
                message: '완료할 투표 세션이 없습니다.',
                completedSessions: 0
            });
        }
    }
    catch (error) {
        console.error('투표 세션 완료 처리 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.completeVoteSession = completeVoteSession;
// 특정 투표 세션을 강제로 완료하는 함수
const forceCompleteVoteSession = async (req, res) => {
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
    }
    catch (error) {
        console.error('투표 세션 강제 완료 처리 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.forceCompleteVoteSession = forceCompleteVoteSession;
// 이번주 일정 자동 생성 함수 (전주 투표 결과 기반)
const generateWeeklySchedule = async () => {
    try {
        const now = new Date();
        // 이번주 월요일과 금요일 계산 (8월 4일-8일)
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay() + 1); // 월요일
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 4); // 금요일까지만
        endOfWeek.setHours(23, 59, 59, 999);
        // 이번주에 이미 경기가 있는지 확인
        const existingGames = await prisma.game.findMany({
            where: {
                date: {
                    gte: startOfWeek,
                    lte: endOfWeek
                }
            }
        });
        // 이번주에 경기가 없으면 전주 투표 결과에서 최다 투표된 일정 생성
        if (existingGames.length === 0) {
            // 전주 투표 세션 조회 (7월 28일-8월 1일)
            const lastWeekStart = new Date(startOfWeek);
            lastWeekStart.setDate(startOfWeek.getDate() - 7); // 전주 월요일
            const lastWeekEnd = new Date(lastWeekStart);
            lastWeekEnd.setDate(lastWeekStart.getDate() + 4); // 전주 금요일
            const lastWeekVoteSession = await prisma.voteSession.findFirst({
                where: {
                    weekStartDate: {
                        gte: lastWeekStart,
                        lte: lastWeekEnd
                    },
                    isCompleted: true
                },
                include: {
                    votes: true
                }
            });
            if (lastWeekVoteSession && lastWeekVoteSession.votes.length > 0) {
                // 투표 결과 분석하여 최다 투표된 요일 찾기
                const voteCounts = {};
                const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
                lastWeekVoteSession.votes.forEach(vote => {
                    try {
                        const selectedDays = JSON.parse(vote.selectedDays);
                        if (Array.isArray(selectedDays)) {
                            selectedDays.forEach(day => {
                                if (dayNames.includes(day)) {
                                    voteCounts[day] = (voteCounts[day] || 0) + 1;
                                }
                            });
                        }
                    }
                    catch (error) {
                        console.error('투표 데이터 파싱 오류:', error);
                    }
                });
                // 최다 투표된 요일 찾기
                let maxVoteDay = 'FRI'; // 기본값을 금요일로 변경 (8월 8일)
                let maxVotes = 0;
                Object.entries(voteCounts).forEach(([day, count]) => {
                    if (count > maxVotes) {
                        maxVotes = count;
                        maxVoteDay = day;
                    }
                });
                // 최다 투표된 요일에 경기 생성 (위치와 시간은 빈 값으로 설정)
                const dayIndex = dayNames.indexOf(maxVoteDay);
                if (dayIndex !== -1) {
                    const gameDate = new Date(startOfWeek);
                    gameDate.setDate(startOfWeek.getDate() + dayIndex);
                    gameDate.setHours(0, 0, 0, 0); // 시간은 00:00으로 설정
                    // 기본 사용자 ID (관리자)
                    const adminUser = await prisma.user.findFirst({
                        where: { role: 'SUPER_ADMIN' }
                    });
                    if (adminUser) {
                        await prisma.game.create({
                            data: {
                                date: gameDate,
                                location: '', // 위치는 빈 값으로 설정
                                eventType: '자체',
                                createdById: adminUser.id
                            }
                        });
                        console.log(`이번주 ${maxVoteDay}요일 경기가 전주 투표 결과에 따라 자동 생성되었습니다.`);
                    }
                }
            }
            else {
                // 전주 투표 결과가 없으면 기본 금요일(8월 8일) 경기 생성
                const friday = new Date(startOfWeek);
                friday.setDate(startOfWeek.getDate() + 4); // 금요일 (8월 8일)
                friday.setHours(0, 0, 0, 0); // 시간은 00:00으로 설정
                const adminUser = await prisma.user.findFirst({
                    where: { role: 'SUPER_ADMIN' }
                });
                if (adminUser) {
                    await prisma.game.create({
                        data: {
                            date: friday,
                            location: '', // 위치는 빈 값으로 설정
                            eventType: '자체',
                            createdById: adminUser.id
                        }
                    });
                    console.log('전주 투표 결과가 없어 기본 금요일(8월 8일) 경기가 생성되었습니다.');
                }
            }
        }
    }
    catch (error) {
        console.error('이번주 일정 자동 생성 오류:', error);
    }
};
exports.generateWeeklySchedule = generateWeeklySchedule;
// 이번주 일정 수동 생성 API
const createWeeklySchedule = async (req, res) => {
    try {
        await (0, exports.generateWeeklySchedule)();
        res.json({
            message: '이번주 일정이 생성되었습니다.',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('이번주 일정 생성 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.createWeeklySchedule = createWeeklySchedule;
// 투표 데이터 초기화 함수
const resetVoteData = async (req, res) => {
    try {
        // 전역 투표 데이터 초기화
        saveVoteData([]); // 파일에서 데이터 초기화
        console.log('투표 데이터 초기화 완료');
        res.json({
            message: '투표 데이터가 초기화되었습니다.',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('투표 데이터 초기화 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.resetVoteData = resetVoteData;
// ===== 회원 관리 함수들 =====
// 회원 검색
const searchMembers = async (req, res) => {
    try {
        console.log('searchMembers API 호출됨');
        console.log('요청 헤더:', req.headers);
        console.log('인증된 사용자:', req.user);
        const { name, email, role, status } = req.query;
        const where = {};
        if (name) {
            where.name = { contains: name, mode: 'insensitive' };
        }
        if (email) {
            where.email = { contains: email, mode: 'insensitive' };
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
    }
    catch (error) {
        console.error('회원 검색 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.searchMembers = searchMembers;
// 회원 정보 수정
const updateMember = async (req, res) => {
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
    }
    catch (error) {
        console.error('회원 정보 수정 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.updateMember = updateMember;
// 회원 상태 변경
const updateMemberStatus = async (req, res) => {
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
    }
    catch (error) {
        console.error('회원 상태 변경 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.updateMemberStatus = updateMemberStatus;
// 회원 삭제
const deleteMember = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.user.delete({
            where: { id: parseInt(id) }
        });
        res.json({ message: '회원이 삭제되었습니다.' });
    }
    catch (error) {
        console.error('회원 삭제 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.deleteMember = deleteMember;
// 비밀번호 초기화
const resetMemberPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;
        // 기본 비밀번호 (사용자가 지정하지 않으면)
        const defaultPassword = newPassword || 'password123';
        const hashedPassword = await bcrypt_1.default.hash(defaultPassword, 10);
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
    }
    catch (error) {
        console.error('비밀번호 초기화 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.resetMemberPassword = resetMemberPassword;
// 개인 비밀번호 변경
const changePassword = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { newPassword } = req.body;
        if (!userId) {
            return res.status(401).json({ error: '인증이 필요합니다.' });
        }
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: '비밀번호는 최소 6자 이상이어야 합니다.' });
        }
        const hashedPassword = await bcrypt_1.default.hash(newPassword, 10);
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
    }
    catch (error) {
        console.error('비밀번호 변경 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.changePassword = changePassword;
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
    }
    catch (error) {
        console.error('평균 참석률 계산 오류:', error);
        return 0;
    }
};
// 회원 통계
const getMemberStats = async (req, res) => {
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
    }
    catch (error) {
        console.error('회원 통계 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.getMemberStats = getMemberStats;
// ===== 자동화 함수들 (스케줄러용) =====
const startWeeklyVoteScheduler = async () => {
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
    }
    catch (error) {
        console.error('주간 투표 세션 생성 오류:', error);
    }
};
exports.startWeeklyVoteScheduler = startWeeklyVoteScheduler;
const completeVoteSessionScheduler = async () => {
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
        }
    }
    catch (error) {
        console.error('투표 세션 완료 처리 오류:', error);
    }
};
exports.completeVoteSessionScheduler = completeVoteSessionScheduler;
// 투표 상태 확인 함수
const getVoteStatus = async (req, res) => {
    try {
        const userId = req.user.userId;
        // 현재 활성 투표 세션 확인
        const activeSession = await prisma.voteSession.findFirst({
            where: {
                isActive: true
            }
        });
        if (!activeSession) {
            return res.json({ hasVoted: false });
        }
        // 사용자의 투표 여부 확인
        const userVote = await prisma.vote.findFirst({
            where: {
                userId: userId,
                voteSessionId: activeSession.id
            }
        });
        res.json({ hasVoted: !!userVote });
    }
    catch (error) {
        console.error('투표 상태 확인 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.getVoteStatus = getVoteStatus;
// 공휴일 조회 API
const getHolidaysAPI = async (req, res) => {
    try {
        const year = parseInt(req.params.year) || new Date().getFullYear();
        const holidays = await getHolidays(year);
        res.json({ holidays });
    }
    catch (error) {
        console.error('공휴일 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.getHolidaysAPI = getHolidaysAPI;
// 재투표 함수 추가
const submitRevote = async (req, res) => {
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
        voteData = voteData.filter((vote) => vote.userId !== userId);
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
        }
        else {
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
    }
    catch (error) {
        console.error('재투표 제출 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
};
exports.submitRevote = submitRevote;
// 이번주 일정 수동 입력 관련 API
const createThisWeekSchedule = async (req, res) => {
    try {
        const { eventType, dateTime, location, attendees, description, maxAttendees } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: '인증이 필요합니다.' });
        }
        // 사용자 권한 확인
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true }
        });
        if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
            return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
        }
        // 이번주 일정 생성
        const schedule = await prisma.thisWeekSchedule.create({
            data: {
                eventType,
                dateTime: new Date(dateTime),
                location,
                attendees: attendees || [],
                description: description || '',
                maxAttendees: maxAttendees || null,
                createdBy: userId,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        });
        console.log('이번주 일정 생성 완료:', schedule);
        res.status(201).json({
            message: '이번주 일정이 성공적으로 생성되었습니다.',
            schedule
        });
    }
    catch (error) {
        console.error('이번주 일정 생성 오류:', error);
        res.status(500).json({ error: '이번주 일정 생성 중 오류가 발생했습니다.' });
    }
};
exports.createThisWeekSchedule = createThisWeekSchedule;
const getThisWeekSchedules = async (req, res) => {
    try {
        const schedules = await prisma.thisWeekSchedule.findMany({
            orderBy: { dateTime: 'asc' },
            include: {
                createdBy: {
                    select: { name: true, email: true }
                }
            }
        });
        res.json({ schedules });
    }
    catch (error) {
        console.error('이번주 일정 조회 오류:', error);
        res.status(500).json({ error: '이번주 일정 조회 중 오류가 발생했습니다.' });
    }
};
exports.getThisWeekSchedules = getThisWeekSchedules;
const updateThisWeekSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        const { eventType, dateTime, location, attendees, description, maxAttendees } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: '인증이 필요합니다.' });
        }
        // 사용자 권한 확인
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true }
        });
        if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
            return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
        }
        // 이번주 일정 수정
        const schedule = await prisma.thisWeekSchedule.update({
            where: { id: parseInt(id) },
            data: {
                eventType,
                dateTime: new Date(dateTime),
                location,
                attendees: attendees || [],
                description: description || '',
                maxAttendees: maxAttendees || null,
                updatedAt: new Date()
            }
        });
        console.log('이번주 일정 수정 완료:', schedule);
        res.json({
            message: '이번주 일정이 성공적으로 수정되었습니다.',
            schedule
        });
    }
    catch (error) {
        console.error('이번주 일정 수정 오류:', error);
        res.status(500).json({ error: '이번주 일정 수정 중 오류가 발생했습니다.' });
    }
};
exports.updateThisWeekSchedule = updateThisWeekSchedule;
const deleteThisWeekSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: '인증이 필요합니다.' });
        }
        // 사용자 권한 확인
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true }
        });
        if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
            return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
        }
        // 이번주 일정 삭제
        await prisma.thisWeekSchedule.delete({
            where: { id: parseInt(id) }
        });
        console.log('이번주 일정 삭제 완료:', id);
        res.json({ message: '이번주 일정이 성공적으로 삭제되었습니다.' });
    }
    catch (error) {
        console.error('이번주 일정 삭제 오류:', error);
        res.status(500).json({ error: '이번주 일정 삭제 중 오류가 발생했습니다.' });
    }
};
exports.deleteThisWeekSchedule = deleteThisWeekSchedule;
// 카카오맵 API 연동을 위한 장소 검색
const searchLocation = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ error: '검색어가 필요합니다.' });
        }
        // 카카오맵 API 키
        const KAKAO_API_KEY = '4413813ca702d0fb6239ae38d9202d7e';
        // 카카오맵 API 호출
        const response = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query.toString())}&size=10`, {
            headers: {
                'Authorization': `KakaoAK ${KAKAO_API_KEY}`
            }
        });
        if (!response.ok) {
            throw new Error('카카오맵 API 호출 실패');
        }
        const data = await response.json();
        res.json(data);
    }
    catch (error) {
        console.error('장소 검색 오류:', error);
        res.status(500).json({ error: '장소 검색 중 오류가 발생했습니다.' });
    }
};
exports.searchLocation = searchLocation;
