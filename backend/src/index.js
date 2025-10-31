"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5050;
app.use((0, cors_1.default)({ origin: process.env.CORS_ORIGIN || '*' }));
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json());
app.use('/api/auth', auth_routes_1.default);
app.get('/', (req, res) => {
    res.send('FC CHALGGYEO API 서버 동작 중!');
});
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: '서버 오류 발생', detail: err === null || err === void 0 ? void 0 : err.message, stack: err === null || err === void 0 ? void 0 : err.stack });
});
app.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT}`);
});
