"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const galleryController_1 = require("../controllers/galleryController");
const router = (0, express_1.Router)();
// 좋아요 토글
router.post('/:galleryId/like', authMiddleware_1.authenticateToken, galleryController_1.toggleLike);
// 좋아요 목록/수
router.get('/:galleryId/likes', galleryController_1.getLikes);
// 댓글 작성
router.post('/:galleryId/comment', authMiddleware_1.authenticateToken, galleryController_1.addComment);
// 댓글 목록
router.get('/:galleryId/comments', galleryController_1.getComments);
// 댓글 삭제
router.delete('/comment/:commentId', authMiddleware_1.authenticateToken, galleryController_1.deleteComment);
// YouTube videoId로 galleryId 반환
router.post('/get-or-create', galleryController_1.getOrCreateGalleryId);
exports.default = router;
