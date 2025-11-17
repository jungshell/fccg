"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.comparePassword = comparePassword;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
/**
 * 비밀번호를 해시합니다.
 */
async function hashPassword(password) {
    const salt = await bcryptjs_1.default.genSalt(10);
    return bcryptjs_1.default.hash(password, salt);
}
/**
 * 비밀번호와 해시를 비교합니다.
 */
async function comparePassword(password, hash) {
    return bcryptjs_1.default.compare(password, hash);
}
