"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const holidayApi_1 = require("../utils/holidayApi");
const router = express_1.default.Router();
// 특정 연도의 공휴일 조회
router.get('/year/:year', async (req, res) => {
    try {
        const { year } = req.params;
        if (!year || year.length !== 4) {
            return res.status(400).json({
                success: false,
                error: '올바른 연도 형식이 아닙니다. (YYYY)'
            });
        }
        console.log(`🗓️ ${year}년 공휴일 조회 요청`);
        const holidays = await (0, holidayApi_1.getHolidaysByYear)(year);
        res.json({
            success: true,
            data: {
                year,
                holidays: Object.keys(holidays), // 날짜 목록
                holidayMap: holidays, // 날짜와 이름 매핑
                count: Object.keys(holidays).length,
                message: `${year}년 공휴일 ${Object.keys(holidays).length}개를 조회했습니다.`
            }
        });
    }
    catch (error) {
        console.error('공휴일 조회 실패:', error);
        res.status(500).json({
            success: false,
            error: '공휴일 조회 중 오류가 발생했습니다.'
        });
    }
});
// 여러 연도의 공휴일 조회
router.post('/years', async (req, res) => {
    try {
        const { years } = req.body;
        if (!Array.isArray(years)) {
            return res.status(400).json({
                success: false,
                error: 'years는 배열이어야 합니다.'
            });
        }
        console.log('🗓️ 여러 연도 공휴일 조회 요청:', years);
        const holidays = await (0, holidayApi_1.getHolidaysByYears)(years);
        // 모든 연도의 공휴일을 하나의 맵으로 통합
        const mergedHolidayMap = {};
        Object.values(holidays).forEach(yearMap => {
            Object.assign(mergedHolidayMap, yearMap);
        });
        res.json({
            success: true,
            data: {
                holidays, // 연도별 공휴일 맵
                holidayMap: mergedHolidayMap, // 통합된 공휴일 맵
                totalCount: Object.keys(mergedHolidayMap).length,
                message: `${years.length}개 연도의 공휴일을 조회했습니다.`
            }
        });
    }
    catch (error) {
        console.error('여러 연도 공휴일 조회 실패:', error);
        res.status(500).json({
            success: false,
            error: '여러 연도 공휴일 조회 중 오류가 발생했습니다.'
        });
    }
});
// 특정 날짜가 공휴일인지 확인
router.get('/check/:date', async (req, res) => {
    try {
        const { date } = req.params;
        // YYYY-MM-DD 형식 검증
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
            return res.status(400).json({
                success: false,
                error: '올바른 날짜 형식이 아닙니다. (YYYY-MM-DD)'
            });
        }
        console.log(`🗓️ 공휴일 확인 요청: ${date}`);
        const isHolidayDate = await (0, holidayApi_1.isHoliday)(date);
        res.json({
            success: true,
            data: {
                date,
                isHoliday: isHolidayDate,
                formattedDate: (0, holidayApi_1.formatDateKorean)(date),
                message: `${(0, holidayApi_1.formatDateKorean)(date)}는 ${isHolidayDate ? '공휴일' : '평일'}입니다.`
            }
        });
    }
    catch (error) {
        console.error('공휴일 확인 실패:', error);
        res.status(500).json({
            success: false,
            error: '공휴일 확인 중 오류가 발생했습니다.'
        });
    }
});
// 다음 주 평일 일정 생성 (공휴일 제외)
router.post('/next-week-weekdays', async (req, res) => {
    try {
        console.log('📅 다음 주 평일 일정 생성 요청');
        const { startDate } = req.body;
        const baseDate = startDate ? new Date(startDate) : undefined;
        // 다음 주 월-금 날짜 생성 (공휴일 제외)
        const weekdays = await (0, holidayApi_1.getNextWeekWeekdays)(baseDate);
        console.log('🗓️ 생성된 평일 목록:');
        weekdays.forEach(date => {
            console.log(`  ${(0, holidayApi_1.formatDateKorean)(date)}`);
        });
        // 공휴일 정보 로깅
        await (0, holidayApi_1.logHolidayInfo)(weekdays);
        res.json({
            success: true,
            data: {
                weekdays,
                count: weekdays.length,
                formattedDates: weekdays.map(holidayApi_1.formatDateKorean),
                message: `${weekdays.length}개의 평일이 생성되었습니다.`
            }
        });
    }
    catch (error) {
        console.error('일정 생성 실패:', error);
        res.status(500).json({
            success: false,
            error: '일정 생성 중 오류가 발생했습니다.'
        });
    }
});
// 특정 날짜 범위의 평일 필터링
router.post('/filter-weekdays', async (req, res) => {
    try {
        const { dates } = req.body;
        if (!Array.isArray(dates)) {
            return res.status(400).json({
                success: false,
                error: 'dates는 배열이어야 합니다.'
            });
        }
        console.log('📅 날짜 필터링 요청:', dates);
        const weekdays = await (0, holidayApi_1.getWeekdaysOnly)(dates);
        console.log('✅ 필터링된 평일:', weekdays);
        await (0, holidayApi_1.logHolidayInfo)(dates);
        res.json({
            success: true,
            data: {
                originalDates: dates,
                weekdays,
                excludedCount: dates.length - weekdays.length,
                formattedDates: weekdays.map(holidayApi_1.formatDateKorean),
                message: `${weekdays.length}개의 평일이 필터링되었습니다. (${dates.length - weekdays.length}개 제외)`
            }
        });
    }
    catch (error) {
        console.error('날짜 필터링 실패:', error);
        res.status(500).json({
            success: false,
            error: '날짜 필터링 중 오류가 발생했습니다.'
        });
    }
});
exports.default = router;
