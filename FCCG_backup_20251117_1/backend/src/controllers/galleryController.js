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
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleLike = toggleLike;
exports.getLikes = getLikes;
exports.addComment = addComment;
exports.getComments = getComments;
exports.deleteComment = deleteComment;
exports.getOrCreateGalleryId = getOrCreateGalleryId;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// 좋아요 토글 (이미 눌렀으면 취소, 아니면 추가)
function toggleLike(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        const galleryId = Number(req.params.galleryId);
        if (!userId)
            return res.status(401).json({ message: '인증 필요' });
        if (!galleryId)
            return res.status(400).json({ message: 'galleryId 필요' });
        try {
            const existing = yield prisma.like.findFirst({ where: { userId, galleryId } });
            if (existing) {
                yield prisma.like.delete({ where: { id: existing.id } });
                return res.json({ liked: false });
            }
            else {
                yield prisma.like.create({ data: { userId, galleryId } });
                return res.json({ liked: true });
            }
        }
        catch (e) {
            res.status(500).json({ message: '좋아요 처리 실패', error: e });
        }
    });
}
// 좋아요 목록/수
function getLikes(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const galleryId = Number(req.params.galleryId);
        if (!galleryId)
            return res.status(400).json({ message: 'galleryId 필요' });
        try {
            const likes = yield prisma.like.findMany({ where: { galleryId }, include: { user: { select: { id: true, name: true } } } });
            res.json({ count: likes.length, users: likes.map(l => l.user) });
        }
        catch (e) {
            res.status(500).json({ message: '좋아요 목록 조회 실패', error: e });
        }
    });
}
// 댓글 작성
function addComment(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        const galleryId = Number(req.params.galleryId);
        const { content } = req.body;
        if (!userId)
            return res.status(401).json({ message: '인증 필요' });
        if (!galleryId || !content)
            return res.status(400).json({ message: 'galleryId, content 필요' });
        try {
            const comment = yield prisma.comment.create({ data: { userId, galleryId, content } });
            res.status(201).json(comment);
        }
        catch (e) {
            res.status(500).json({ message: '댓글 작성 실패', error: e });
        }
    });
}
// 댓글 목록
function getComments(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const galleryId = Number(req.params.galleryId);
        if (!galleryId)
            return res.status(400).json({ message: 'galleryId 필요' });
        try {
            const comments = yield prisma.comment.findMany({
                where: { galleryId },
                include: { user: { select: { id: true, name: true } } },
                orderBy: { createdAt: 'asc' }
            });
            res.json(comments);
        }
        catch (e) {
            res.status(500).json({ message: '댓글 목록 조회 실패', error: e });
        }
    });
}
// 댓글 삭제 (본인만)
function deleteComment(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        const commentId = Number(req.params.commentId);
        if (!userId)
            return res.status(401).json({ message: '인증 필요' });
        if (!commentId)
            return res.status(400).json({ message: 'commentId 필요' });
        try {
            const comment = yield prisma.comment.findUnique({ where: { id: commentId } });
            if (!comment)
                return res.status(404).json({ message: '댓글 없음' });
            if (comment.userId !== userId)
                return res.status(403).json({ message: '본인 댓글만 삭제 가능' });
            yield prisma.comment.delete({ where: { id: commentId } });
            res.json({ deleted: true });
        }
        catch (e) {
            res.status(500).json({ message: '댓글 삭제 실패', error: e });
        }
    });
}
// YouTube videoId로 galleryId 반환 (없으면 자동 등록)
function getOrCreateGalleryId(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const { videoId, title } = req.body;
        if (!videoId)
            return res.status(400).json({ message: 'videoId 필요' });
        try {
            let gallery = yield prisma.gallery.findFirst({ where: { videoUrl: videoId } });
            if (!gallery) {
                // uploaderId는 임시로 1번(관리자)로 지정, 실제 서비스에서는 로그인 유저로 대체 필요
                gallery = yield prisma.gallery.create({
                    data: {
                        title: title || videoId,
                        imageUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
                        videoUrl: videoId,
                        uploaderId: 1,
                    },
                });
            }
            res.json({ galleryId: gallery.id });
        }
        catch (e) {
            res.status(500).json({ message: 'galleryId 생성/조회 실패', error: e });
        }
    });
}
