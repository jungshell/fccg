import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Flex,
  Text,
  HStack,
  VStack,
  Button,
  Input,
  Badge,
  IconButton,
  Image,
  SimpleGrid,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Select,
  useToast,
  Textarea,
  FormControl,
  FormLabel,
  AspectRatio,
  Center,
  Tooltip,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  Card,
  CardBody
} from '@chakra-ui/react';
import { AiFillHeart, AiOutlineHeart, AiOutlineShareAlt, AiOutlineMore } from 'react-icons/ai';
import { FiDownload } from 'react-icons/fi';
import { ViewIcon, AddIcon, AttachmentIcon, ArrowUpIcon } from '@chakra-ui/icons';
import { EditIcon, DeleteIcon, CheckIcon, CloseIcon } from '@chakra-ui/icons';
import { useAuthStore } from '../store/auth';
import { API_ENDPOINTS } from '../constants';

// 타입 정의
interface InstagramPost {
  id: number;
  type: 'photo' | 'video';
  src: string;
  multiplePhotos?: string[];
  caption: string;
  author: {
    id: number;
    name: string;
    avatar: string;
  };
  createdAt: string;
  eventDate: string;
  eventType: string;
  likes: number;
  likedBy: Array<{id: number, name: string}>;
  isLiked: boolean;
  comments: Comment[];
  tags: string[];
  location: string;
  views: number;
}

interface Comment {
  id: number;
  author: {
    id: number;
    name: string;
    avatar: string;
  };
  content: string;
  createdAt: string;
  likes: number;
  isLiked: boolean;
  replies?: Comment[];
}

// 하드코딩된 더미 데이터 제거 - 실제 API에서만 데이터를 가져옵니다

export default function PhotoGalleryPage() {
  const { user } = useAuthStore();
  const [instagramPosts, setInstagramPosts] = useState<InstagramPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<InstagramPost | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hoveredImageIndex, setHoveredImageIndex] = useState<Record<number, number>>({});
  const [imageAspectRatios, setImageAspectRatios] = useState<Record<number, number>>({});
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [selectedDownloadImages, setSelectedDownloadImages] = useState<number[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewFull, setPreviewFull] = useState(false);
  const [sortBy, setSortBy] = useState<'upload' | 'event' | 'likes' | 'comments'>('upload');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<InstagramPost | null>(null);
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true); // 초기 로드 상태 추적
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  // 행사유형별 색상 정의 (일정페이지 달력과 동일)
  const getEventTypeColor = (eventType: string) => {
    switch (eventType) {
      case '매치':
        return 'blue.500';     // 파란색 - 매치
      case '자체':
        return 'green.500';    // 초록색 - 자체
      case '회식':
        return 'red.500';      // 빨간색 - 회식
      case '기타':
        return 'gray.500';     // 회색 - 기타
      default:
        return 'gray.500';     // 기본 회색
    }
  };

  // 갤러리 데이터 로드 함수
  const loadGalleryData = async () => {
    try {
      const response = await fetch(`${API_ENDPOINTS.BASE_URL}/gallery`);

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // API 데이터를 InstagramPost 형식으로 변환
          const convertedPosts = data.data.items.map((item: any) => ({
            id: item.id,
            type: 'photo',
            src: item.imageUrl,
            caption: item.title,
            author: {
              id: item.uploader.id,
              name: item.uploader.name,
              avatar: item.uploader.avatarUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=100&q=80'
            },
            createdAt: item.createdAt,
            eventDate: item.eventDate ? item.eventDate.split('T')[0] : item.createdAt.split('T')[0],
            eventType: item.eventType || '기타',
            likes: item.likesCount,
            likedBy: item.likes ? item.likes.map((like: any) => like.user?.name || like.user?.name || '') : [],
            isLiked: item.isLiked,
            comments: item.comments ? item.comments.map((comment: any) => ({
              id: comment.id,
              author: {
                id: comment.user?.id || 0,
                name: comment.user?.name || '알 수 없음'
              },
              content: comment.content,
              createdAt: comment.createdAt
            })) : [],
            tags: item.tags ? item.tags.map((tag: any) => tag.name) : [],
            location: '구장',
            views: 0
          }));
          
          setInstagramPosts(convertedPosts);
          setIsInitialLoad(false);
        }
      } else {
        console.error('갤러리 데이터 로드 실패:', response.status);
        // API 로드 실패 시 빈 배열로 설정 (하드코딩된 데이터 사용 안 함)
        setInstagramPosts([]);
        setIsInitialLoad(false);
      }
    } catch (error) {
      console.error('갤러리 데이터 로드 오류:', error);
      // 에러 발생 시 빈 배열로 설정 (하드코딩된 데이터 사용 안 함)
      setInstagramPosts([]);
      setIsInitialLoad(false);
    }
  };

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadGalleryData();
  }, []);

  // 폼 데이터 상태
  const [formData, setFormData] = useState({
    images: [] as File[],
    caption: '',
    eventDate: '',
    eventType: '기타',
    tags: ''
  });

  // 편집 폼 데이터 상태
  const [editFormData, setEditFormData] = useState({
    caption: '',
    eventDate: '',
    eventType: '기타',
    tags: ''
  });

  // 데이터 저장 (즉시 저장 + 백업) - useEffect에서 참조하므로 먼저 선언
  const savePostsToStorage = useCallback((posts: InstagramPost[]) => {
    try {
      const postsJson = JSON.stringify(posts);
      const existing = localStorage.getItem('instagramPosts');
      if (existing) {
        localStorage.setItem('instagramPosts_backup', existing);
      }
      localStorage.setItem('instagramPosts', postsJson);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      localStorage.setItem(`instagramPosts_backup_${timestamp}`, postsJson);
      console.log('💾 포스트 저장 완료:', posts.length, '개');
    } catch (error) {
      console.error('❌ 포스트 저장 실패:', error);
    }
  }, []);


  // 데이터 로드 (최적화된 버전)
  useEffect(() => {
    const loadPostsFromStorage = () => {
      try {
        // 백그라운드에서 데이터 로드
        setTimeout(async () => {
          try {
            // 백엔드에서 실제 데이터 로드 (우선순위 1)
            await loadGalleryData();
            
            // 백엔드 데이터가 없고 localStorage에 저장된 데이터가 있는 경우에만 사용 (우선순위 2)
            // 주의: localStorage는 백엔드와 동기화되지 않을 수 있으므로, 백엔드 데이터가 있으면 항상 우선
            const stored = localStorage.getItem('instagramPosts');
            if (instagramPosts.length === 0 && stored) {
              try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  setInstagramPosts(parsed);
                  setIsInitialLoad(false);
                  console.log('✅ localStorage에서 포스트 로드:', parsed.length, '개 (백엔드 데이터 없음)');
                  return;
                }
              } catch (e) {
                console.warn('⚠️ localStorage 데이터 파싱 실패:', e);
              }
            }

            // 백업에서 로드 (우선순위 3)
            if (instagramPosts.length === 0) {
              const backup = localStorage.getItem('instagramPosts_backup');
              if (backup) {
                try {
                  const parsed = JSON.parse(backup);
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    setInstagramPosts(parsed);
                    setIsInitialLoad(false);
                    localStorage.setItem('instagramPosts', backup);
                    console.log('✅ 백업에서 포스트 복원:', parsed.length, '개 (백엔드 데이터 없음)');
                    return;
                  }
                } catch (e) {
                  console.warn('⚠️ 백업 데이터 파싱 실패:', e);
                }
              }
            }
          } catch (error) {
            console.error('❌ 백그라운드 로드 실패:', error);
          }
        }, 0);
      } catch (error) {
        console.error('❌ 포스트 로드 실패:', error);
      }
    };

    loadPostsFromStorage();
  }, []);

  // 이미지 비율 감지 함수
  const getImageAspectRatio = (src: string): Promise<number> => {
    return new Promise((resolve) => {
      try {
        // 브라우저 환경 확인
        if (typeof document === 'undefined') {
          resolve(1);
          return;
        }
        
        const img = document.createElement('img');
        img.onload = () => {
          try {
            const ratio = img.naturalWidth / img.naturalHeight;
            resolve(ratio || 1);
          } catch (error) {
            console.error('이미지 비율 계산 오류:', error);
            resolve(1);
          }
        };
        img.onerror = () => {
          console.warn('이미지 로드 실패:', src);
          resolve(1);
        };
        img.src = src;
      } catch (error) {
        console.error('이미지 비율 감지 오류:', error);
        resolve(1);
      }
    });
  };

  // 이미지 비율 저장
  const saveImageAspectRatio = async (postId: number, src: string) => {
    try {
      if (!imageAspectRatios[postId] && src) {
        const ratio = await getImageAspectRatio(src);
        setImageAspectRatios(prev => ({ ...prev, [postId]: ratio }));
      }
    } catch (error) {
      console.error('이미지 비율 저장 오류:', error);
    }
  };

  // 다운로드 처리
  const handleDownload = (post: InstagramPost) => {
    if (post.multiplePhotos && post.multiplePhotos.length > 1) {
      // 복수 사진의 경우 썸네일 선택 모달 표시
      setSelectedPost(post);
      setIsDownloadModalOpen(true);
    } else {
      // 단일 사진의 경우 바로 다운로드
      downloadImage(post.src, `photo_${post.id}.jpg`);
    }
  };

  // 이미지 다운로드 함수 (바로 경로지정)
  const downloadImage = (url: string, filename: string) => {
    fetch(url)
      .then(response => response.blob())
      .then(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      })
      .catch(error => {
        console.error('다운로드 실패:', error);
        // fallback: 새 탭에서 열기
        window.open(url, '_blank');
      });
  };

  // 빠른 미리보기 열기
  const openPreview = (src: string) => {
    setPreviewSrc(src);
    setPreviewFull(false);
    setIsPreviewOpen(true);
  };

  // 댓글 수정 시작
  const startEditComment = (commentId: number, currentText: string) => {
    setEditingCommentId(commentId);
    setEditingCommentText(currentText);
  };

  // 댓글 수정 취소
  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  // 댓글 수정 완료
  const saveEditComment = async (postId: number, commentId: number) => {
    if (!editingCommentText.trim()) return;

    try {
      const response = await fetch(`${API_ENDPOINTS.BASE_URL}/gallery/${postId}/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          content: editingCommentText.trim()
        })
      });

      if (response.ok) {
        const updatedPosts = instagramPosts.map(post => {
          if (post.id === postId) {
            return {
              ...post,
              comments: post.comments.map(comment => 
                comment.id === commentId 
                  ? { ...comment, content: editingCommentText.trim() }
                  : comment
              )
            };
          }
          return post;
        });

        setInstagramPosts(updatedPosts);
        savePostsToStorage(updatedPosts);

        // selectedPost도 업데이트
        if (selectedPost && selectedPost.id === postId) {
          const updatedPost = updatedPosts.find(post => post.id === postId);
          if (updatedPost) {
            setSelectedPost(updatedPost);
          }
        }

        setEditingCommentId(null);
        setEditingCommentText('');

        toast({
          title: '댓글 수정 완료',
          description: '댓글이 수정되었습니다.',
          status: 'success',
          duration: 2000,
          isClosable: true,
        });
      } else {
        throw new Error('댓글 수정 실패');
      }
    } catch (error) {
      console.error('댓글 수정 오류:', error);
      toast({
        title: '댓글 수정 실패',
        description: '댓글 수정 중 오류가 발생했습니다.',
        status: 'error',
        duration: 2000,
        isClosable: true,
      });
    }
  };

  // 댓글 삭제
  const deleteComment = async (postId: number, commentId: number) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.BASE_URL}/gallery/${postId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const updatedPosts = instagramPosts.map(post => {
          if (post.id === postId) {
            return {
              ...post,
              comments: post.comments.filter(comment => comment.id !== commentId)
            };
          }
          return post;
        });

        setInstagramPosts(updatedPosts);
        savePostsToStorage(updatedPosts);

        // selectedPost도 업데이트
        if (selectedPost && selectedPost.id === postId) {
          const updatedPost = updatedPosts.find(post => post.id === postId);
          if (updatedPost) {
            setSelectedPost(updatedPost);
          }
        }

        toast({
          title: '댓글 삭제 완료',
          description: '댓글이 삭제되었습니다.',
          status: 'success',
          duration: 2000,
          isClosable: true,
        });
      } else {
        throw new Error('댓글 삭제 실패');
      }
    } catch (error) {
      console.error('댓글 삭제 오류:', error);
      toast({
        title: '댓글 삭제 실패',
        description: '댓글 삭제 중 오류가 발생했습니다.',
        status: 'error',
        duration: 2000,
        isClosable: true,
      });
    }
  };

  
  // 포스트 변경 시 즉시 저장 (실제 데이터가 로드된 후에만 저장)
  useEffect(() => {
    // 초기 로드가 완료된 후 변경사항만 저장
    if (!isInitialLoad && instagramPosts.length >= 0) {
      savePostsToStorage(instagramPosts);
    }
  }, [instagramPosts, savePostsToStorage, isInitialLoad]);

  // 이미지 압축 함수
  const compressImage = (file: File, maxWidth: number = 800, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = document.createElement('img');
      
      img.onload = () => {
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  // 파일 처리 함수
  const processFiles = (files: FileList | File[]): Promise<string[]> => {
    const fileArray = Array.from(files);
    
    // 파일 검증
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    for (const file of fileArray) {
      if (file.size > maxSize) {
        throw new Error(`파일 크기가 너무 큽니다: ${file.name}`);
      }
      if (!allowedTypes.includes(file.type)) {
        throw new Error(`지원하지 않는 파일 형식입니다: ${file.name}`);
      }
    }
    
    if (fileArray.length > 10) {
      throw new Error('최대 10장까지만 업로드할 수 있습니다');
    }
    
    return Promise.all(fileArray.map(file => compressImage(file)));
  };

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files);
    }
  };

  // 파일 선택 핸들러
  const handleFileSelect = async (files: FileList | File[]) => {
    try {
      const compressedImages = await processFiles(files);
      setFormData(prev => ({
        ...prev,
        images: Array.from(files)
      }));
      
      // 미리보기용으로 압축된 이미지 저장
      (window as any).compressedImages = compressedImages;
      
      toast({
        title: '파일 선택 완료',
        description: `${files.length}개의 파일이 선택되었습니다.`,
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: '파일 처리 실패',
        description: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // 업로드 핸들러
  const handleUpload = async () => {
    if (formData.images.length === 0) {
      toast({
        title: '파일 선택 필요',
        description: '업로드할 이미지를 선택해주세요.',
        status: 'warning',
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    setIsUploading(true);
    
    try {
      // FormData로 실제 파일 업로드
      const uploadData = new FormData();
      
      // 첫 번째 이미지 파일 업로드
      uploadData.append('image', formData.images[0]);
      uploadData.append('title', formData.caption);
      uploadData.append('caption', formData.caption);
      uploadData.append('eventType', formData.eventType);
      uploadData.append('eventDate', formData.eventDate);
      uploadData.append('tags', formData.tags);

      const response = await fetch(`${API_ENDPOINTS.BASE_URL}/gallery/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
          // Content-Type은 FormData가 자동으로 설정
        },
        body: uploadData
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // 업로드된 데이터를 InstagramPost 형식으로 변환
          const uploadedPost: InstagramPost = {
            id: data.data[0].id,
            type: 'photo',
            src: data.data[0].imageUrl,
            caption: data.data[0].title,
            author: {
              id: data.data[0].uploader.id,
              name: data.data[0].uploader.name,
              avatar: data.data[0].uploader.avatarUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=100&q=80'
            },
            createdAt: data.data[0].createdAt,
            eventDate: data.data[0].eventDate ? data.data[0].eventDate.split('T')[0] : data.data[0].createdAt.split('T')[0],
            eventType: data.data[0].eventType || '기타',
            likes: 0,
            likedBy: [],
            isLiked: false,
            comments: [],
            tags: data.data[0].tags.map((tag: any) => tag.name),
            location: '장소 미정',
            views: 0
          };

          // 업로드 후 전체 데이터 다시 로드
          await loadGalleryData();
          
          // 폼 초기화
          setFormData({
            images: [],
            caption: '',
            eventDate: '',
            eventType: '기타',
            tags: ''
          });
          
          setIsUploadModalOpen(false);
          
          toast({
            title: '업로드 완료',
            description: '사진이 성공적으로 업로드되었습니다.',
            status: 'success',
            duration: 2000,
            isClosable: true,
          });
        }
      } else {
        throw new Error('업로드 실패');
      }
    } catch (error) {
      console.error('업로드 오류:', error);
      toast({
        title: '업로드 실패',
        description: '사진 업로드 중 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsUploading(false);
    }
  };

  // 좋아요 토글
  const toggleLike = async (postId: number) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.BASE_URL}/gallery/${postId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // 로컬 상태 업데이트
          const updatedPosts = instagramPosts.map(post => {
            if (post.id === postId) {
              const isLiked = data.action === 'liked';
              const userId = user?.id;
              const userName = user?.name || '알 수 없음';
              
              if (isLiked) {
                // 좋아요 추가
                return {
                  ...post,
                  isLiked: true,
                  likes: post.likes + 1,
                  likedBy: [...post.likedBy, { id: userId!, name: userName }]
                };
              } else {
                // 좋아요 취소
                return {
                  ...post,
                  isLiked: false,
                  likes: post.likes - 1,
                  likedBy: post.likedBy.filter(like => like.id !== userId)
                };
              }
            }
            return post;
          });
          
          setInstagramPosts(updatedPosts);
          savePostsToStorage(updatedPosts);
          
          // selectedPost도 업데이트
          if (selectedPost && selectedPost.id === postId) {
            const updatedPost = updatedPosts.find(post => post.id === postId);
            if (updatedPost) {
              setSelectedPost(updatedPost);
            }
          }
        }
      } else {
        toast({
          title: '좋아요 처리 실패',
          status: 'error',
          duration: 2000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('좋아요 처리 오류:', error);
      toast({
        title: '좋아요 처리 중 오류가 발생했습니다.',
        status: 'error',
        duration: 2000,
        isClosable: true,
      });
    }
  };

  // 댓글 추가
  const addComment = async (postId: number) => {
    if (!newComment.trim()) return;

    try {
      const response = await fetch(`${API_ENDPOINTS.BASE_URL}/gallery/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: newComment.trim()
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // 로컬 상태 업데이트
          const newCommentObj: Comment = {
            id: data.data.id,
            author: {
              id: data.data.user.id,
              name: data.data.user.name,
              avatar: data.data.user.avatarUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=100&q=80'
            },
            content: data.data.content,
            createdAt: data.data.createdAt,
            likes: 0,
            isLiked: false
          };

          const updatedPosts = instagramPosts.map(post => {
            if (post.id === postId) {
              return {
                ...post,
                comments: [...post.comments, newCommentObj]
              };
            }
            return post;
          });

          setInstagramPosts(updatedPosts);
          savePostsToStorage(updatedPosts);
          setNewComment('');
          
          // selectedPost도 업데이트
          if (selectedPost && selectedPost.id === postId) {
            const updatedPost = updatedPosts.find(post => post.id === postId);
            if (updatedPost) {
              setSelectedPost(updatedPost);
            }
          }
        }
      } else {
        toast({
          title: '댓글 추가 실패',
          status: 'error',
          duration: 2000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error('댓글 추가 오류:', error);
      toast({
        title: '댓글 추가 중 오류가 발생했습니다.',
        status: 'error',
        duration: 2000,
        isClosable: true,
      });
    }
  };

  // 편집 모달 열기
  const openEditModal = (post: InstagramPost) => {
    setEditingPost(post);
    setEditFormData({
      caption: post.caption,
      eventDate: post.eventDate,
      eventType: post.eventType,
      tags: post.tags.join(', ')
    });
    setIsEditModalOpen(true);
  };

  // 편집 저장
  const handleEditSave = async () => {
    if (!editingPost) return;

    try {
      const response = await fetch(`${API_ENDPOINTS.BASE_URL}/gallery/${editingPost.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          title: editFormData.caption,
          eventDate: editFormData.eventDate,
          eventType: editFormData.eventType,
          tags: editFormData.tags.trim() ? editFormData.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : []
        })
      });

      if (response.ok) {
        // selectedPost 상태 즉시 업데이트 (상세모달에서 바로 반영)
        if (selectedPost && selectedPost.id === editingPost.id) {
          setSelectedPost(prev => prev ? {
            ...prev,
            caption: editFormData.caption,
            eventDate: editFormData.eventDate,
            eventType: editFormData.eventType,
            tags: editFormData.tags.trim() ? editFormData.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : []
          } : null);
        }

        // 수정 후 전체 데이터 다시 로드하여 백엔드와 동기화
        await loadGalleryData();
        
        setIsEditModalOpen(false);
        setEditingPost(null);
        
        toast({
          title: '수정 완료',
          description: '포스트가 성공적으로 수정되었습니다.',
          status: 'success',
          duration: 2000,
          isClosable: true,
        });
      } else {
        throw new Error('수정 실패');
      }
    } catch (error) {
      console.error('포스트 수정 오류:', error);
      toast({
        title: '수정 실패',
        description: '포스트 수정 중 오류가 발생했습니다.',
        status: 'error',
        duration: 2000,
        isClosable: true,
      });
    }
  };

  // 포스트 삭제
  const deletePost = async (postId: number) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.BASE_URL}/gallery/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        // 백엔드에서 삭제 성공 시 프론트엔드 상태 업데이트
        setInstagramPosts(prev => prev.filter(post => post.id !== postId));
        
        // 현재 모달이 이 포스트를 보고 있었다면 닫기
        if (selectedPost && selectedPost.id === postId) {
          setIsModalOpen(false);
          setSelectedPost(null);
        }
        
        toast({
          title: '삭제 완료',
          description: '포스트가 삭제되었습니다.',
          status: 'success',
          duration: 2000,
          isClosable: true,
        });
      } else {
        throw new Error('삭제 실패');
      }
    } catch (error) {
      console.error('포스트 삭제 오류:', error);
      toast({
        title: '삭제 실패',
        description: '포스트 삭제 중 오류가 발생했습니다.',
        status: 'error',
        duration: 2000,
        isClosable: true,
      });
    }
  };

  // 정렬된 포스트
  const sortedPosts = [...instagramPosts].sort((a, b) => {
    switch (sortBy) {
      case 'event':
        return new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime();
      case 'likes':
        return b.likes - a.likes;
      case 'comments':
        return b.comments.length - a.comments.length;
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  // 상대시간 포맷팅 (분/시간/일 단위)
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInMinutes < 1) return '방금 전';
    if (diffInMinutes < 60) return `${diffInMinutes}분 전`;
    if (diffInHours < 24) return `${diffInHours}시간 전`;
    if (diffInDays === 1) return '1일 전';
    if (diffInDays < 7) return `${diffInDays}일 전`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}주 전`;
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)}개월 전`;
    return `${Math.floor(diffInDays / 365)}년 전`;
  };

  // ko-KR 날짜 + 요일 포맷
  const formatKoDate = (dateString: string) => new Date(dateString).toLocaleDateString('ko-KR');
  const getWeekdayKo = (dateString: string) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return days[new Date(dateString).getDay()];
  };

  return (
    <Box minH="100vh" bg="#f7f9fb" w="100vw" minW="100vw" pt="18mm">
      {/* 상단 컨트롤 영역 - 동영상 페이지와 동일한 여백 */}
      <Box px={{ base: 1, md: 4, lg: 12 }} py={6}>
        <Flex justify="flex-end" align="center" mb={1.5}>
          <HStack spacing={3}>
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            size="sm"
            w="150px"
          >
            <option value="upload">업로드순</option>
            <option value="event">행사날짜순</option>
            <option value="likes">좋아요순</option>
            <option value="comments">댓글순</option>
          </Select>
          <IconButton
            aria-label="사진 업로드"
            icon={<AddIcon />}
            colorScheme="blue"
            bg="#004ea8"
            _hover={{ bg: "#003d7a" }}
            onClick={() => setIsUploadModalOpen(true)}
            size="sm"
          />
          </HStack>
        </Flex>
      </Box>

      {/* 포스트 그리드 */}
      {isInitialLoad ? (
        <Center py={20}>
          <VStack spacing={4}>
            <Text fontSize="lg" color="gray.500">사진을 불러오는 중...</Text>
          </VStack>
        </Center>
      ) : sortedPosts.length === 0 ? (
        <Center py={20}>
          <VStack spacing={4}>
            <Text fontSize="lg" color="gray.500">아직 업로드된 사진이 없습니다</Text>
            <Button
              colorScheme="blue"
              bg="#004ea8"
              _hover={{ bg: "#003d7a" }}
              onClick={() => setIsUploadModalOpen(true)}
            >
              첫 번째 사진 업로드하기
            </Button>
          </VStack>
        </Center>
      ) : (
        <Box px={{ base: 1, md: 4, lg: 12 }} pb={10}>
          <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={6}>
          {sortedPosts.map((post) => {
            const currentIndex = hoveredImageIndex[post.id] || 0;
            const images = post.multiplePhotos && post.multiplePhotos.length > 0 ? post.multiplePhotos : [post.src];
            const currentImage = images[currentIndex];
            const badgeBg = getEventTypeColor(post.eventType);

            return (
              <Card key={post.id} w="100%" overflow="hidden" borderRadius="lg" bg="white" shadow="md">
                <CardBody p={0}>
                  {/* 이미지 영역 */}
                  <Box
                    position="relative"
                    onMouseLeave={() => setHoveredImageIndex(prev => ({ ...prev, [post.id]: 0 }))}
                    onMouseMove={(e) => {
                      if (images.length > 1) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const width = rect.width;
                        const index = Math.floor((x / width) * images.length);
                        const safeIndex = Math.max(0, Math.min(images.length - 1, index));
                        if (safeIndex !== (hoveredImageIndex[post.id] || 0)) {
                          setHoveredImageIndex(prev => ({ ...prev, [post.id]: safeIndex }));
                        }
                      }
                    }}
                  >
                    <Box>
                      <Image
                        src={currentImage}
                        alt={post.caption}
                        w="100%"
                        h="200px"
                        objectFit="cover"
                        cursor="pointer"
                        onClick={() => {
                          setSelectedPost(post);
                          setIsModalOpen(true);
                        }}
                      />
                    </Box>
                    
                    {/* 다중 이미지 표시 */}
                    {images.length > 1 && (
                      <Box
                        position="absolute"
                        top={2}
                        right={2}
                        bg="blackAlpha.700"
                        color="white"
                        px={2}
                        py={1}
                        borderRadius="full"
                        fontSize="sm"
                        fontWeight="bold"
                      >
                        {images.length}장
                      </Box>
                    )}
                    
                    {/* 이벤트 타입 배지 */}
                    <Badge
                      position="absolute"
                      top={2}
                      left={2}
                      bg={post.eventType === '매치' ? 'blue.500' : 
                           (post.eventType === '자체' || post.eventType?.includes('ì') || post.eventType?.includes('자체')) ? 'green.500' : 
                           post.eventType === '회식' ? 'red.500' : 'gray.500'}
                      color="white"
                      variant="solid"
                      fontSize="xs"
                      fontWeight="bold"
                      px={2}
                      py={1}
                      borderRadius="md"
                    >
                      {post.eventType?.includes('ì') || post.eventType?.includes('자체') ? '자체' : post.eventType}
                    </Badge>
                  </Box>

                  {/* 포스트 정보 */}
                  <Box p={4}>
                    {/* 외부 스택 간격은 2행과 3행 사이 간격 유지용 */}
                    <VStack align="start" spacing={2} w="full">
                      {/* 1행+2행 묶음: 간격 0 */}
                      <VStack align="start" spacing={0} w="full">
                        {/* 1행: 행사일(요일 포함) / 우측 좋아요·댓글 수 */}
                        <Flex w="full" align="center">
                          <Text fontSize="sm" fontWeight="bold">
                            {`${formatKoDate(post.eventDate)} (${getWeekdayKo(post.eventDate)})`}
                          </Text>
                          <HStack spacing={4} ml="auto">
                            <HStack spacing={1}>
                              <AiFillHeart color="#e53e3e" size={16} />
                              <Text fontSize="sm" color="gray.600">{post.likes}</Text>
                            </HStack>
                            <HStack spacing={1}>
                              <ViewIcon color="gray.500" boxSize={4} />
                              <Text fontSize="sm" color="gray.600">{post.comments.length}</Text>
                            </HStack>
                          </HStack>
                        </Flex>

                        {/* 2행: 이름 (1행과 간격 0) */}
                        <Text fontSize="sm">{post.author.name}</Text>
                      </VStack>

                      {/* 3행: 업로드 날짜+요일 / 우측 상대시간 */}
                      <Flex w="full" align="center">
                        <Text fontSize="xs" color="gray.500">
                          {`업로드: ${formatKoDate(post.createdAt)} (${getWeekdayKo(post.createdAt)})`}
                        </Text>
                        <Text fontSize="xs" color="gray.500" ml="auto">
                          {formatDate(post.createdAt)}
                        </Text>
                      </Flex>
                    </VStack>
                  </Box>
                </CardBody>
              </Card>
            );
          })}
          </SimpleGrid>
        </Box>
      )}

      {/* 업로드 모달 */}
      <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>📸 사진 업로드</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4}>
              {/* 파일 선택 영역 */}
              <FormControl>
                <FormLabel>📷 사진 업로드</FormLabel>
                <Box
                  border="2px dashed"
                  borderColor={dragActive ? "blue.400" : "gray.300"}
                  borderRadius="lg"
                  p={8}
                  textAlign="center"
                  bg={dragActive ? "blue.50" : "gray.50"}
                  cursor="pointer"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <VStack spacing={2}>
                    <AttachmentIcon boxSize={8} color="gray.400" />
                    <Text color="gray.600">
                      {formData.images.length > 0 
                        ? `${formData.images.length}개 파일 선택됨` 
                        : '드래그 앤 드롭 또는 클릭하여 파일 선택'}
                    </Text>
                    <Text fontSize="sm" color="gray.500">
                      최대 10장, 10MB 이하 (JPG, PNG, GIF, WebP)
                    </Text>
                  </VStack>
                </Box>
                <Input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  display="none"
                  onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
                />
              </FormControl>

              {/* 이벤트 정보 */}
              <HStack spacing={4} w="full">
                <FormControl>
                  <FormLabel mb={0}>📅 행사 날짜</FormLabel>
                  <Input
                    type="date"
                    value={formData.eventDate}
                    onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel mb={0}>⚽ 행사 유형</FormLabel>
                  <Select
                    value={formData.eventType}
                    onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
                  >
                    <option value="매치">매치</option>
                    <option value="자체">자체</option>
                    <option value="회식">회식</option>
                    <option value="기타">기타</option>
                  </Select>
                </FormControl>
              </HStack>

              {/* 캡션 */}
              <FormControl>
                <FormLabel>💬 캡션</FormLabel>
                <Textarea
                  value={formData.caption}
                  onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
                  placeholder="사진에 대한 설명을 작성해주세요..."
                  rows={3}
                />
              </FormControl>

              {/* 태그 */}
              <FormControl>
                <FormLabel>🏷️ 태그</FormLabel>
                <Input
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="태그를 쉼표로 구분하여 입력하세요 (예: 축구, 팀워크, 승리)"
                />
              </FormControl>

              {/* 버튼 */}
              <HStack spacing={3} w="full">
                <Button
                  colorScheme="blue"
                  onClick={handleUpload}
                  isLoading={isUploading}
                  flex={1}
                >
                  업로드
                </Button>
                <Button
                  onClick={() => setIsUploadModalOpen(false)}
                  flex={1}
                >
                  취소
                </Button>
              </HStack>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* 편집 모달 */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>✏️ 포스트 편집</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel>💬 캡션</FormLabel>
                <Textarea
                  value={editFormData.caption}
                  onChange={(e) => setEditFormData({ ...editFormData, caption: e.target.value })}
                  rows={3}
                />
              </FormControl>

              <HStack spacing={4} w="full">
                <FormControl>
                  <FormLabel>📅 행사 날짜</FormLabel>
                  <Input
                    type="date"
                    value={editFormData.eventDate}
                    onChange={(e) => setEditFormData({ ...editFormData, eventDate: e.target.value })}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>⚽ 행사 유형</FormLabel>
                  <Select
                    value={editFormData.eventType}
                    onChange={(e) => setEditFormData({ ...editFormData, eventType: e.target.value })}
                  >
                    <option value="매치">매치</option>
                    <option value="자체">자체</option>
                    <option value="회식">회식</option>
                    <option value="기타">기타</option>
                  </Select>
                </FormControl>
              </HStack>

              <FormControl>
                <FormLabel>🏷️ 태그</FormLabel>
                <Input
                  value={editFormData.tags}
                  onChange={(e) => setEditFormData({ ...editFormData, tags: e.target.value })}
                  placeholder="태그를 쉼표로 구분하여 입력하세요"
                />
              </FormControl>

              <HStack spacing={3} w="full">
                <Button colorScheme="blue" onClick={handleEditSave} flex={1}>
                  저장
                </Button>
                <Button onClick={() => setIsEditModalOpen(false)} flex={1}>
                  취소
                </Button>
              </HStack>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* 상세 보기 모달 */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} size="4xl">
        <ModalOverlay />
        <ModalContent>
          <ModalCloseButton />
          <ModalBody p={0}>
            {selectedPost && (() => {
              const currentImageSrc = selectedPost.multiplePhotos && selectedPost.multiplePhotos.length > 1 
                ? selectedPost.multiplePhotos[hoveredImageIndex[selectedPost.id] || 0]
                : selectedPost.src;
              
              // 이미지 비율 감지 및 저장
              saveImageAspectRatio(selectedPost.id, currentImageSrc);
              const aspectRatio = imageAspectRatios[selectedPost.id] || 1;
              const isLandscape = aspectRatio > 1.2; // 가로 사진 판정
              
              return (
                <Flex direction={{ base: 'column', lg: isLandscape ? 'row' : 'row' }} h={isLandscape ? "60vh" : "80vh"}>
                {/* 이미지 영역 */}
                <Box flex={isLandscape ? 2 : 1} position="relative">
                  {/* 이벤트 타입 배지 (썸네일과 동일) */}
                  <Badge 
                    position="absolute" 
                    top={2} 
                    left={2} 
                    bg={selectedPost.eventType === '매치' ? 'blue.500' : 
                         (selectedPost.eventType === '자체' || selectedPost.eventType?.includes('ì') || selectedPost.eventType?.includes('자체')) ? 'green.500' : 
                         selectedPost.eventType === '회식' ? 'red.500' : 'gray.500'}
                    color="white" 
                    zIndex={1}
                    fontSize="xs"
                    fontWeight="bold"
                    px={2}
                    py={1}
                    borderRadius="md"
                  >
                    {selectedPost.eventType?.includes('ì') || selectedPost.eventType?.includes('자체') ? '자체' : selectedPost.eventType}
                  </Badge>
                  {selectedPost.multiplePhotos && selectedPost.multiplePhotos.length > 1 ? (
                    <Box position="relative" h="full">
                      <Image
                        src={selectedPost.multiplePhotos[hoveredImageIndex[selectedPost.id] || 0]}
                        alt={selectedPost.caption}
                        w="full"
                        h="full"
                        objectFit="contain"
                        bg="black"
                        cursor="zoom-in"
                        onClick={() => {
                          const idx = hoveredImageIndex[selectedPost.id] || 0;
                          const url = selectedPost.multiplePhotos![idx];
                          openPreview(url);
                        }}
                        onMouseMove={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = e.clientX - rect.left;
                          const width = rect.width;
                          const index = Math.floor((x / width) * selectedPost.multiplePhotos!.length);
                          setHoveredImageIndex(prev => ({
                            ...prev,
                            [selectedPost.id]: Math.min(index, selectedPost.multiplePhotos!.length - 1)
                          }));
                        }}
                      />
                      
                      {/* 이미지 인디케이터 */}
                      <HStack
                        position="absolute"
                        bottom={4}
                        left="50%"
                        transform="translateX(-50%)"
                        spacing={1}
                      >
                        {selectedPost.multiplePhotos.map((_, index) => (
                          <Box
                            key={index}
                            w={2}
                            h={2}
                            borderRadius="full"
                            bg={index === (hoveredImageIndex[selectedPost.id] || 0) ? "white" : "whiteAlpha.500"}
                          />
                        ))}
                      </HStack>
                    </Box>
                  ) : (
                    <Image
                      src={selectedPost.src}
                      alt={selectedPost.caption}
                      w="full"
                      h="full"
                      objectFit="contain"
                      bg="black"
                      cursor="zoom-in"
                      onClick={() => openPreview(selectedPost.src)}
                    />
                  )}
                </Box>

                {/* 정보 영역 */}
                <Box flex={isLandscape ? 1 : 1} p={6} overflowY="auto">
                  <VStack align="start" spacing={4}>
                    {/* 헤더: 1행 행사일(요일), 2행 이름 */}
                    <VStack align="start" spacing={1}>
                      <Text fontSize="sm" fontWeight="bold">
                        {`${formatKoDate(selectedPost.eventDate)} (${getWeekdayKo(selectedPost.eventDate)})`}
                      </Text>
                      <Text fontSize="sm" color="gray.800">{selectedPost.author.name}</Text>
                    </VStack>

                    {/* 캡션 */}
                    {/* 요청에 따라 캡션은 목록 썸네일에는 숨기지만 상세에서는 유지 */}
                    {selectedPost.caption && selectedPost.caption.trim() && <Text>{selectedPost.caption}</Text>}

                    {/* 태그 */}
                    {selectedPost.tags.length > 0 && (
                      <HStack spacing={2} wrap="wrap">
                        {selectedPost.tags.map((tag, index) => (
                          <Badge key={index} colorScheme="blue" variant="subtle">
                            #{tag}
                          </Badge>
                        ))}
                      </HStack>
                    )}

                    {/* 3행: 업로드 날짜+요일 (좌측), 상대시간(우측) */}
                    <Flex w="full" align="center">
                      <Text fontSize="xs" color="gray.600" fontWeight="semibold">
                        {`업로드: ${formatKoDate(selectedPost.createdAt)} (${getWeekdayKo(selectedPost.createdAt)})`}
                      </Text>
                      <Text fontSize="xs" color="gray.500" ml="auto">
                        {formatDate(selectedPost.createdAt)}
                      </Text>
                    </Flex>

                    {/* 액션 버튼: 좋아요, 다운로드, 편집/삭제 */}
                    <HStack spacing={2}>
                      <IconButton 
                        aria-label="좋아요" 
                        icon={selectedPost.isLiked ? <AiFillHeart color="#e53e3e" /> : <AiOutlineHeart />} 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => toggleLike(selectedPost.id)} 
                      />
                      <IconButton 
                        aria-label="다운로드" 
                        icon={<FiDownload />} 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => handleDownload(selectedPost)} 
                      />
                      {((user?.id && user?.id === selectedPost.author.id) || user?.role === 'SUPER_ADMIN') && (
                        <>
                          <IconButton 
                            aria-label="수정" 
                            icon={<EditIcon />} 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => openEditModal(selectedPost)} 
                          />
                          <IconButton 
                            aria-label="삭제" 
                            icon={<DeleteIcon />} 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => deletePost(selectedPost.id)} 
                          />
                        </>
                      )}
                    </HStack>

                    {/* 좋아요 및 댓글 수 */}
                    <HStack spacing={4}>
                      <Tooltip
                        label={selectedPost.likedBy.length > 0 
                          ? selectedPost.likedBy.map(like => like.name).join(', ')
                          : '아직 좋아요가 없습니다'
                        }
                        placement="top"
                        hasArrow
                      >
                        <Text fontSize="sm" fontWeight="bold" cursor="pointer">
                          좋아요 {selectedPost.likes}개
                        </Text>
                      </Tooltip>
                      <Tooltip
                        label={selectedPost.comments.length > 0 
                          ? `${selectedPost.comments.length}개의 댓글`
                          : '아직 댓글이 없습니다'
                        }
                        placement="top"
                        hasArrow
                      >
                        <Text fontSize="sm" fontWeight="bold" cursor="pointer">
                          댓글 {selectedPost.comments.length}개
                        </Text>
                      </Tooltip>
                    </HStack>

                    {/* 댓글 목록: 좌측(내용) / 우측(업로더명, 상대시간, 수정/삭제) */}
                    <VStack align="start" spacing={3} w="full">
                      {selectedPost.comments.map((comment) => (
                        <Flex key={comment.id} w="full" align="center">
                          {editingCommentId === comment.id ? (
                            <HStack spacing={2} flex={1}>
                              <Input
                                value={editingCommentText}
                                onChange={(e) => setEditingCommentText(e.target.value)}
                                size="sm"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    saveEditComment(selectedPost.id, comment.id);
                                  } else if (e.key === 'Escape') {
                                    cancelEditComment();
                                  }
                                }}
                                autoFocus
                              />
                              <IconButton
                                aria-label="저장"
                                icon={<CheckIcon />}
                                size="xs"
                                colorScheme="green"
                                onClick={() => saveEditComment(selectedPost.id, comment.id)}
                              />
                              <IconButton
                                aria-label="취소"
                                icon={<CloseIcon />}
                                size="xs"
                                variant="ghost"
                                onClick={cancelEditComment}
                              />
                            </HStack>
                          ) : (
                            <>
                              <HStack spacing={2} flex={1} minW={0}>
                                <Text fontSize="sm" noOfLines={1}>{comment.content}</Text>
                              </HStack>
                              <HStack spacing={2} ml="auto" align="center">
                                <Text fontSize="xs" color="gray.600" fontWeight="bold">{comment.author.name}</Text>
                                <Text fontSize="xs" color="gray.500">{formatDate(comment.createdAt)}</Text>
                                {((user?.id && user?.id === comment.author.id) || user?.role === 'SUPER_ADMIN') && (
                                  <HStack spacing={1}>
                                    <IconButton 
                                      aria-label="댓글 수정" 
                                      icon={<EditIcon />} 
                                      size="xs" 
                                      variant="ghost" 
                                      onClick={() => startEditComment(comment.id, comment.content)} 
                                    />
                                    <IconButton 
                                      aria-label="댓글 삭제" 
                                      icon={<DeleteIcon />} 
                                      size="xs" 
                                      variant="ghost" 
                                      onClick={() => deleteComment(selectedPost.id, comment.id)} 
                                    />
                                  </HStack>
                                )}
                              </HStack>
                            </>
                          )}
                        </Flex>
                      ))}
                    </VStack>

                    {/* 댓글 입력: 심플 디자인 */}
                    <HStack spacing={2} w="full">
                      <Input 
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)} 
                        placeholder="댓글을 입력하세요..." 
                        size="sm" 
                        bg="gray.50" 
                        borderRadius="md" 
                        onKeyDown={(e: any) => {
                          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            addComment(selectedPost.id);
                          }
                        }} 
                      />
                      <IconButton size="sm" colorScheme="blue" aria-label="등록" icon={<ArrowUpIcon />} onClick={() => addComment(selectedPost.id)} />
                    </HStack>
                  </VStack>
                </Box>
              </Flex>
              );
            })()}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* 다운로드 선택 모달 */}
      <Modal isOpen={isDownloadModalOpen} onClose={() => {
        setIsDownloadModalOpen(false);
        setSelectedDownloadImages([]);
      }} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>다운로드할 사진 선택</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedPost && selectedPost.multiplePhotos && (
              <VStack spacing={4}>
                <SimpleGrid columns={2} spacing={4}>
                  {selectedPost.multiplePhotos.map((photo, index) => (
                    <Box key={index} position="relative">
                      <Box
                        position="relative"
                        cursor="pointer"
                        onClick={() => {
                          setSelectedDownloadImages(prev => 
                            prev.includes(index) 
                              ? prev.filter(i => i !== index)
                              : [...prev, index]
                          );
                        }}
                      >
                        <Image
                          src={photo}
                          alt={`Photo ${index + 1}`}
                          w="full"
                          h="200px"
                          objectFit="cover"
                          borderRadius="md"
                          opacity={selectedDownloadImages.includes(index) ? 0.7 : 1}
                        />
                        {selectedDownloadImages.includes(index) && (
                          <Box
                            position="absolute"
                            top="50%"
                            left="50%"
                            transform="translate(-50%, -50%)"
                            bg="blue.500"
                            color="white"
                            borderRadius="full"
                            w={8}
                            h={8}
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                          >
                            ✓
                          </Box>
                        )}
                      </Box>
                      <Text fontSize="sm" textAlign="center" mt={2}>
                        사진 {index + 1}
                      </Text>
                    </Box>
                  ))}
                </SimpleGrid>
                <HStack spacing={4} w="full" justify="center">
                  <Button
                    colorScheme="blue"
                    onClick={() => {
                      selectedDownloadImages.forEach(index => {
                        const photo = selectedPost.multiplePhotos![index];
                        downloadImage(photo, `photo_${selectedPost.id}_${index + 1}.jpg`);
                      });
                      setIsDownloadModalOpen(false);
                      setSelectedDownloadImages([]);
                    }}
                    isDisabled={selectedDownloadImages.length === 0}
                  >
                    선택한 사진 다운로드 ({selectedDownloadImages.length}개)
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      selectedPost.multiplePhotos!.forEach((photo, index) => {
                        downloadImage(photo, `photo_${selectedPost.id}_${index + 1}.jpg`);
                      });
                      setIsDownloadModalOpen(false);
                      setSelectedDownloadImages([]);
                    }}
                  >
                    전체 다운로드
                  </Button>
                </HStack>
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* 미리보기(라이트박스) 모달 */}
      <Modal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} size={previewFull ? 'full' : '5xl'}>
        <ModalOverlay bg="blackAlpha.800" />
        <ModalContent bg="black">
          <ModalCloseButton color="white" />
          <ModalBody p={0}>
            {previewSrc && (
              <Flex direction="column" align="center" justify="center" w="100%" h={previewFull ? '100vh' : '80vh'} bg="black">
                <Image src={previewSrc} alt="preview" maxH="100%" maxW="100%" objectFit="contain" />
                <HStack spacing={3} position="absolute" bottom={4} right={4}>
                  <Button size="sm" onClick={() => setPreviewFull(f => !f)}>
                    {previewFull ? '창 크기 되돌리기' : '전체 화면'}
                  </Button>
                  <Button size="sm" colorScheme="blue" onClick={() => downloadImage(previewSrc, 'image.jpg')}>다운로드</Button>
                </HStack>
              </Flex>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

    </Box>
  );
}
