"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const client_1 = require("@prisma/client");
const auth_1 = __importDefault(require("./routes/auth"));
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/api/auth', auth_1.default);
app.get('/', (req, res) => {
    res.send('FC CHALGGYEO API 서버 동작 중!');
});
// 에러 핸들러
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: '서버 오류 발생' });
});
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`서버가 ${PORT}번 포트에서 실행 중`);
});
