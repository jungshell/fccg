import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Center,
  Tooltip,
  Card,
  CardBody
} from '@chakra-ui/react';
import { AiFillHeart } from 'react-icons/ai';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { AddIcon, AttachmentIcon, ArrowUpIcon, DeleteIcon, CheckIcon, CloseIcon } from '@chakra-ui/icons';
import { useAuthStore } from '../store/auth';
import { API_ENDPOINTS } from '../constants';
import { getApiBaseUrl, getApiUrl } from '../config/api';

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
  clicks: number;
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

const viewCountFormatter = new Intl.NumberFormat('ko-KR');
const formatViewCountDisplay = (value: number = 0) =>
  viewCountFormatter.format(Math.max(0, value));

const CLICK_BADGE_PRESETS = [
  {
    threshold: 500,
    emoji: '👑',
    gradient: 'linear-gradient(120deg, rgba(255,111,145,0.95), rgba(255,215,0,0.92))',
    shadow: '0 10px 25px rgba(255,170,51,0.35)'
  },
  {
    threshold: 120,
    emoji: '🔥',
    gradient: 'linear-gradient(120deg, rgba(255,94,98,0.95), rgba(255,149,0,0.9))',
    shadow: '0 8px 20px rgba(255,94,98,0.35)'
  },
  {
    threshold: 30,
    emoji: '⚡',
    gradient: 'linear-gradient(120deg, rgba(76,81,191,0.92), rgba(115,103,240,0.9))',
    shadow: '0 6px 18px rgba(76,81,191,0.3)'
  },
  {
    threshold: 0,
    emoji: '✨',
    gradient: 'linear-gradient(120deg, rgba(15,23,42,0.85), rgba(30,41,59,0.78))',
    shadow: '0 4px 12px rgba(15,23,42,0.35)'
  }
] as const;

const getClickBadgeStyle = (count: number) => {
  for (const preset of CLICK_BADGE_PRESETS) {
    if (count >= preset.threshold) {
      return preset;
    }
  }
  return CLICK_BADGE_PRESETS[CLICK_BADGE_PRESETS.length - 1];
};

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
  const [sortBy, setSortBy] = useState<'upload' | 'event' | 'likes' | 'comments'>('event');
  const [currentImageIndex, setCurrentImageIndex] = useState(0); // 상세보기 모달에서 현재 이미지 인덱스
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

  const buildGalleryUrl = useCallback((path: string = '') => getApiUrl(`${API_ENDPOINTS.GALLERY}${path}`), []);

  const getBaseApiUrl = () => getApiBaseUrl();

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

  // 그룹화 함수 (재사용 가능)
  const groupPosts = (posts: InstagramPost[]): InstagramPost[] => {
    if (!posts || posts.length === 0) return [];
    
    console.log('🔄 그룹화 시작...', posts.length, '개 아이템');
    const groupedMap = new Map<string, InstagramPost[]>();
    
    posts.forEach((item: InstagramPost) => {
      // eventDate 정규화 (YYYY-MM-DD 형식으로 통일)
      let normalizedDate = item.eventDate;
      if (normalizedDate) {
        // ISO 형식이나 다른 형식에서 날짜 부분만 추출
        const dateMatch = normalizedDate.match(/^\d{4}-\d{2}-\d{2}/);
        if (dateMatch) {
          normalizedDate = dateMatch[0];
        } else {
          // 다른 형식인 경우 Date 객체로 파싱 후 다시 포맷
          try {
            const date = new Date(normalizedDate);
            if (!isNaN(date.getTime())) {
              normalizedDate = date.toISOString().split('T')[0];
            }
          } catch (e) {
            console.warn('날짜 파싱 실패:', normalizedDate, e);
          }
        }
      }
      
      // eventType 정규화 (공백 제거)
      const normalizedEventType = (item.eventType || '기타').trim();
      
      const groupKey = `${normalizedDate}_${normalizedEventType}`;
      
      console.log('🔍 그룹화 키 생성:', {
        id: item.id,
        originalEventDate: item.eventDate,
        normalizedDate,
        originalEventType: item.eventType,
        normalizedEventType,
        groupKey
      });
      
      if (!groupedMap.has(groupKey)) {
        groupedMap.set(groupKey, []);
      }
      groupedMap.get(groupKey)!.push(item);
    });
    
    console.log('📊 그룹화 결과:', {
      총_아이템: posts.length,
      그룹_수: groupedMap.size,
      그룹별_아이템수: Array.from(groupedMap.entries()).map(([key, items]) => ({
        key,
        count: items.length
      }))
    });
    
    // 그룹화된 데이터를 단일 포스트로 변환
    const convertedPosts: InstagramPost[] = [];
    
    groupedMap.forEach((items, groupKey) => {
      if (items.length === 1) {
        // 단일 이미지인 경우
        convertedPosts.push({
          ...items[0],
          clicks: items[0].clicks ?? 0
        });
      } else {
        // 여러 이미지인 경우 - 첫 번째 아이템을 기준으로 그룹화
        const firstItem = items[0];
        const allImageUrls = items.map(item => item.src);
        
        // 좋아요와 댓글은 모든 아이템의 합산
        const totalLikes = items.reduce((sum, item) => sum + item.likes, 0);
        const allLikedBy = items.reduce((acc, item) => {
          item.likedBy.forEach(like => {
            if (!acc.find(l => l.id === like.id)) {
              acc.push(like);
            }
          });
          return acc;
        }, [] as Array<{id: number, name: string}>);
        const allComments = items.reduce((acc, item) => {
          item.comments.forEach(comment => {
            if (!acc.find(c => c.id === comment.id)) {
              acc.push(comment);
            }
          });
          return acc;
        }, [] as Comment[]);
        const allTags = items.reduce((acc, item) => {
          item.tags.forEach(tag => {
            if (!acc.includes(tag)) {
              acc.push(tag);
            }
          });
          return acc;
        }, [] as string[]);
        
        // 가장 최근 생성된 아이템의 ID 사용
        const latestItem = items.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];
        
        const totalClicks = items.reduce((sum, item) => sum + (item.clicks || 0), 0);

        convertedPosts.push({
          ...firstItem,
          id: latestItem.id, // 가장 최근 아이템의 ID 사용
          src: allImageUrls[0], // 첫 번째 이미지를 기본 이미지로
          multiplePhotos: allImageUrls, // 모든 이미지 URL 배열
          likes: totalLikes,
          likedBy: allLikedBy,
          isLiked: items.some(item => item.isLiked), // 하나라도 좋아요가 있으면 true
          comments: allComments.sort((a, b) => 
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          ),
          tags: allTags,
          createdAt: latestItem.createdAt, // 가장 최근 업로드 시간
          clicks: totalClicks
        });
      }
    });
    
    // 업로드 시간순으로 정렬 (최신순)
    convertedPosts.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    return convertedPosts;
  };

  // 갤러리 데이터 로드 함수
  const loadGalleryData = async (): Promise<boolean> => {
    console.log('🚀 loadGalleryData 함수 시작');
    try {
      const galleryUrl = await buildGalleryUrl();
      const token = localStorage.getItem('token') || localStorage.getItem('auth_token_backup') || sessionStorage.getItem('token');
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(galleryUrl, {
        headers
      });
      console.log('📡 API 응답 상태:', response.status, response.ok);

      if (response.ok) {
        const data = await response.json();
        console.log('📸 갤러리 API 응답:', data);
        
        if (data.success && data.data && data.data.items && data.data.items.length > 0) {
          // 백엔드 URL 추출
          const baseApiUrl = await getBaseApiUrl();
          let backendUrl = '';
          
          // 프로덕션 환경 확인
          if (baseApiUrl.includes('onrender.com')) {
            backendUrl = 'https://fccgfirst.onrender.com';
          } else if (baseApiUrl.includes('localhost') || baseApiUrl.includes('127.0.0.1')) {
            backendUrl = baseApiUrl.replace('/api/auth', '');
          } else {
            // 일반적인 경우: /api/auth를 제거
            backendUrl = baseApiUrl.replace('/api/auth', '');
          }
          
          // API 데이터를 InstagramPost 형식으로 변환
          const allItems = data.data.items.map((item: any) => {
            console.log('📸 아이템 처리:', item.id, item.imageUrl);
            
            // imageUrl이 상대 경로인 경우 전체 URL로 변환
            let imageUrl = item.imageUrl;
            
            // imageUrl이 없거나 유효하지 않은 경우 건너뛰기
            if (!imageUrl || typeof imageUrl !== 'string') {
              console.warn('⚠️ 유효하지 않은 이미지 URL:', item.id, imageUrl);
              return null;
            }
            
            // 상대 경로인 경우 전체 URL로 변환
            if (!imageUrl.startsWith('http') && !imageUrl.startsWith('//') && !imageUrl.startsWith('data:')) {
              imageUrl = imageUrl.startsWith('/') ? `${backendUrl}${imageUrl}` : `${backendUrl}/${imageUrl}`;
              console.log('✅ 변환된 imageUrl:', imageUrl);
            }
            
            // eventDate 정규화: YYYY-MM-DD 형식으로 통일
            let eventDate = item.eventDate;
            if (eventDate) {
              // ISO 형식이나 다른 형식에서 날짜 부분만 추출
              const dateMatch = eventDate.match(/^\d{4}-\d{2}-\d{2}/);
              if (dateMatch) {
                eventDate = dateMatch[0];
              } else {
                // 다른 형식인 경우 Date 객체로 파싱 후 다시 포맷
                try {
                  const date = new Date(eventDate);
                  if (!isNaN(date.getTime())) {
                    eventDate = date.toISOString().split('T')[0];
                  } else {
                    // 파싱 실패 시 createdAt 사용
                    eventDate = item.createdAt ? item.createdAt.split('T')[0] : new Date().toISOString().split('T')[0];
                  }
                } catch (e) {
                  // 파싱 실패 시 createdAt 사용
                  eventDate = item.createdAt ? item.createdAt.split('T')[0] : new Date().toISOString().split('T')[0];
                }
              }
            } else {
              // eventDate가 없으면 createdAt의 날짜 부분 사용
              eventDate = item.createdAt ? item.createdAt.split('T')[0] : new Date().toISOString().split('T')[0];
            }
            
            // eventType 정규화 (공백 제거)
            const eventType = (item.eventType || '기타').trim();
            
            const normalizedClickCount = typeof item.clickCount === 'number'
              ? item.clickCount
              : (item.viewCount ?? 0);

            return {
              id: item.id,
              type: 'photo',
              src: imageUrl || 'https://via.placeholder.com/400x400?text=No+Image',
              caption: item.title,
              author: {
                id: item.uploader.id,
                name: item.uploader.name,
                avatar: item.uploader.avatarUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=100&q=80'
              },
              createdAt: item.createdAt,
              eventDate: eventDate,
              eventType: eventType,
              likes: item.likesCount,
              likedBy: item.likes ? item.likes.map((like: any) => ({ id: like.user?.id || 0, name: like.user?.name || '' })).filter((like: any) => like.name) : [],
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
              clicks: normalizedClickCount
            };
          }).filter((post: any) => post !== null); // null인 항목 제거
          
          console.log('📋 변환된 아이템 수:', allItems.length);
          if (allItems.length === 0) {
            console.warn('⚠️ 변환된 아이템이 없습니다.');
            setInstagramPosts([]);
            setIsInitialLoad(false);
            return false;
          }
          
          // 같은 날짜와 이벤트 타입으로 그룹화
          const convertedPosts = groupPosts(allItems);
          
          setInstagramPosts(convertedPosts);
          setIsInitialLoad(false);
          console.log('✅ 백엔드에서 데이터 로드 성공:', convertedPosts.length, '개 (그룹화 전:', allItems.length, '개)');
          return true; // 성공적으로 로드됨을 반환
        } else {
          console.warn('⚠️ 백엔드 응답에 데이터 없음:', data);
          setInstagramPosts([]);
          setIsInitialLoad(false);
          return false;
        }
      } else {
        console.error('❌ 갤러리 데이터 로드 실패:', response.status);
        setInstagramPosts([]);
        setIsInitialLoad(false);
        return false;
      }
    } catch (error) {
      console.error('❌ 갤러리 데이터 로드 오류:', error);
      setInstagramPosts([]);
      setIsInitialLoad(false);
      return false;
    }
  };

  const incrementGalleryClick = useCallback(async (postId: number) => {
    let optimisticCount = 0;
    setInstagramPosts(prev => {
      const updated = prev.map(post => {
        if (post.id === postId) {
          optimisticCount = (post.clicks || 0) + 1;
          return { ...post, clicks: optimisticCount };
        }
        return post;
      });
      return updated;
    });
    setSelectedPost(prev => prev && prev.id === postId ? { ...prev, clicks: optimisticCount } : prev);

    try {
      const url = await buildGalleryUrl(`/${postId}/view`);
      const token = localStorage.getItem('token') || localStorage.getItem('auth_token_backup') || sessionStorage.getItem('token');
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(url, {
        method: 'POST',
        headers
      });
      if (response.ok) {
        const data = await response.json();
        const confirmed = data?.data?.clickCount ?? data?.data?.viewCount;
        if (typeof confirmed === 'number') {
          setInstagramPosts(prev => prev.map(post => post.id === postId ? { ...post, clicks: confirmed } : post));
          setSelectedPost(prev => prev && prev.id === postId ? { ...prev, clicks: confirmed } : prev);
        }
      }
    } catch (error) {
      console.error('갤러리 조회수 증가 실패:', error);
    }
  }, [buildGalleryUrl]);

  const handleOpenPost = useCallback((post: InstagramPost) => {
    setSelectedPost(post);
    setIsModalOpen(true);
    incrementGalleryClick(post.id);
  }, [incrementGalleryClick]);

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

  // 키보드 네비게이션 (상세보기 모달에서 좌우 화살표 키)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isModalOpen || !selectedPost) return;
      
      const images = selectedPost.multiplePhotos && selectedPost.multiplePhotos.length > 1 
        ? selectedPost.multiplePhotos 
        : [selectedPost.src];
      
      if (images.length <= 1) return;
      
      const currentIdx = hoveredImageIndex[selectedPost.id] || 0;
      
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const newIndex = currentIdx === 0 ? images.length - 1 : currentIdx - 1;
        setHoveredImageIndex(prev => ({ ...prev, [selectedPost.id]: newIndex }));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const newIndex = currentIdx === images.length - 1 ? 0 : currentIdx + 1;
        setHoveredImageIndex(prev => ({ ...prev, [selectedPost.id]: newIndex }));
      }
    };
    
    if (isModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isModalOpen, selectedPost, hoveredImageIndex]);
  
  // 상세보기 모달이 열릴 때 이미지 인덱스 초기화
  useEffect(() => {
    if (isModalOpen && selectedPost) {
      setHoveredImageIndex(prev => ({ ...prev, [selectedPost.id]: 0 }));
    }
  }, [isModalOpen, selectedPost]);

  // 데이터 로드 (최적화된 버전)
  useEffect(() => {
    const loadPostsFromStorage = async () => {
      try {
        // 백엔드에서 실제 데이터 로드 (우선순위 1)
        const backendLoadSuccess = await loadGalleryData();
        
        // 백엔드에서 데이터를 성공적으로 가져왔으면 localStorage 사용 안 함
        if (backendLoadSuccess) {
          console.log('✅ 백엔드 데이터 사용 중, localStorage 건너뜀');
          return;
        }
        
        // 백엔드 데이터가 없고 localStorage에 저장된 데이터가 있는 경우에만 사용 (우선순위 2)
        const stored = localStorage.getItem('instagramPosts');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              console.log('📦 localStorage에서 포스트 로드:', parsed.length, '개 (그룹화 적용)');
              // localStorage에서도 그룹화 적용
              const grouped = groupPosts(parsed);
              setInstagramPosts(grouped);
              setIsInitialLoad(false);
              console.log('✅ localStorage 그룹화 완료:', grouped.length, '개');
              return;
            }
          } catch (e) {
            console.warn('⚠️ localStorage 데이터 파싱 실패:', e);
          }
        }

        // 백업에서 로드 (우선순위 3)
        const backup = localStorage.getItem('instagramPosts_backup');
        if (backup) {
          try {
            const parsed = JSON.parse(backup);
            if (Array.isArray(parsed) && parsed.length > 0) {
              console.log('📦 백업에서 포스트 복원:', parsed.length, '개 (그룹화 적용)');
              // 백업에서도 그룹화 적용
              const grouped = groupPosts(parsed);
              setInstagramPosts(grouped);
              setIsInitialLoad(false);
              localStorage.setItem('instagramPosts', backup);
              console.log('✅ 백업 그룹화 완료:', grouped.length, '개');
              return;
            }
          } catch (e) {
            console.warn('⚠️ 백업 데이터 파싱 실패:', e);
          }
        }
        
        // 모든 데이터 소스에서 실패한 경우
        if (instagramPosts.length === 0) {
          setIsInitialLoad(false);
          console.log('⚠️ 사용 가능한 데이터 없음');
        }
      } catch (error) {
        console.error('❌ 포스트 로드 실패:', error);
        setIsInitialLoad(false);
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
      const editUrl = await buildGalleryUrl(`/${postId}/comments/${commentId}`);
      const response = await fetch(editUrl, {
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
      const deleteUrl = await buildGalleryUrl(`/${postId}/comments/${commentId}`);
      const response = await fetch(deleteUrl, {
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
    if (!user) {
      toast({
        title: '로그인 필요',
        description: '사진을 업로드하려면 로그인이 필요합니다.',
        status: 'warning',
        duration: 2000,
        isClosable: true,
      });
      return;
    }

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
      const uploadedPosts: InstagramPost[] = [];
      let successCount = 0;
      let failCount = 0;

      // 모든 이미지 파일을 순회하면서 업로드
      for (let i = 0; i < formData.images.length; i++) {
        const imageFile = formData.images[i];
        
        try {
          // FormData로 실제 파일 업로드
          const uploadData = new FormData();
          
          // 각 이미지 파일 업로드
          uploadData.append('image', imageFile);
          uploadData.append('title', formData.caption || '');
          uploadData.append('caption', formData.caption || '');
          uploadData.append('eventType', formData.eventType);
          uploadData.append('eventDate', formData.eventDate);
          uploadData.append('tags', formData.tags);

          const uploadUrl = await buildGalleryUrl('/upload');
          const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
              // Content-Type은 FormData가 자동으로 설정
            },
            body: uploadData
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data && data.data.length > 0) {
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
                clicks: data.data[0].clickCount ?? data.data[0].viewCount ?? 0
              };
              
              uploadedPosts.push(uploadedPost);
              successCount++;
            }
          } else {
            const errorText = await response.text();
            console.error(`이미지 ${i + 1} 업로드 실패:`, errorText);
            failCount++;
          }
        } catch (error) {
          console.error(`이미지 ${i + 1} 업로드 오류:`, error);
          failCount++;
        }
      }

      // 업로드 후 전체 데이터 다시 로드
      if (successCount > 0) {
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
        
        // 성공 메시지 표시
        if (failCount === 0) {
          toast({
            title: '업로드 완료',
            description: `${successCount}장의 사진이 성공적으로 업로드되었습니다.`,
            status: 'success',
            duration: 3000,
            isClosable: true,
          });
        } else {
          toast({
            title: '일부 업로드 완료',
            description: `${successCount}장 업로드 성공, ${failCount}장 업로드 실패`,
            status: 'warning',
            duration: 3000,
            isClosable: true,
          });
        }
      } else {
        // 모든 업로드 실패
        toast({
          title: '업로드 실패',
          description: '모든 사진 업로드에 실패했습니다. 다시 시도해주세요.',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
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
      const likeUrl = await buildGalleryUrl(`/${postId}/like`);
      const response = await fetch(likeUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
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
    if (!newComment.trim()) {
      toast({
        title: '댓글을 입력해주세요',
        status: 'warning',
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    const commentContent = newComment.trim();
    setNewComment(''); // 입력 필드 먼저 비우기

    try {
      // 토큰 재확인 및 복구
      const { reloadTokenFromStorage } = useAuthStore.getState();
      reloadTokenFromStorage();
      
      const token = localStorage.getItem('token') || 
                    localStorage.getItem('auth_token_backup') || 
                    sessionStorage.getItem('token');
      
      if (!token) {
        throw new Error('로그인이 필요합니다. 다시 로그인해주세요.');
      }

      const commentsUrl = await buildGalleryUrl(`/${postId}/comments`);
      console.log('댓글 등록 시도:', { postId, commentsUrl, content: commentContent, hasToken: !!token });
      
      const response = await fetch(commentsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: commentContent
        })
      });

      console.log('댓글 등록 응답:', { status: response.status, ok: response.ok });

      if (response.ok) {
        const data = await response.json();
        console.log('댓글 등록 성공:', data);
        
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
          
          // selectedPost도 업데이트
          if (selectedPost && selectedPost.id === postId) {
            const updatedPost = updatedPosts.find(post => post.id === postId);
            if (updatedPost) {
              setSelectedPost(updatedPost);
            }
          }

        toast({
            title: '댓글이 등록되었습니다',
            status: 'success',
          duration: 2000,
          isClosable: true,
        });
        } else {
          throw new Error(data.message || '댓글 등록 실패');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('댓글 등록 실패:', { status: response.status, errorData });
        throw new Error(errorData.message || `서버 오류: ${response.status}`);
      }
    } catch (error: any) {
      console.error('댓글 추가 오류:', error);
      setNewComment(commentContent); // 실패 시 입력 내용 복원
      toast({
        title: '댓글 추가 실패',
        description: error.message || '댓글 추가 중 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
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
      const updateUrl = await buildGalleryUrl(`/${editingPost.id}`);
      const response = await fetch(updateUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          title: editingPost.caption,
          caption: editingPost.caption,
          tags: editingPost.tags.join(',')
        })
      });

      if (response.ok) {
        // selectedPost 상태 즉시 업데이트 (상세모달에서 바로 반영)
        if (selectedPost && selectedPost.id === editingPost.id) {
          setSelectedPost(prev => prev ? {
            ...prev,
            caption: editingPost.caption,
            eventDate: editingPost.eventDate,
            eventType: editingPost.eventType,
            tags: editingPost.tags
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
      const deletePostUrl = await buildGalleryUrl(`/${postId}`);
      const response = await fetch(deletePostUrl, {
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
  const sortedPosts = useMemo(() => {
    if (!Array.isArray(instagramPosts) || instagramPosts.length === 0) {
      return [];
    }
    
    return [...instagramPosts].sort((a, b) => {
      if (!a || !b) return 0;
      
      switch (sortBy) {
        case 'event':
          // eventDate가 없으면 createdAt 사용
          const aDate = a.eventDate || a.createdAt || '';
          const bDate = b.eventDate || b.createdAt || '';
          const aTime = aDate ? new Date(aDate).getTime() : 0;
          const bTime = bDate ? new Date(bDate).getTime() : 0;
          return bTime - aTime;
        case 'likes':
          return (b.likes || 0) - (a.likes || 0);
        case 'comments':
          return (b.comments?.length || 0) - (a.comments?.length || 0);
        default:
          const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bCreated - aCreated;
      }
    });
  }, [instagramPosts, sortBy]);

  // 상대시간 포맷팅 (분/시간/일 단위)
  const parseDate = (value?: string | null): Date | null => {
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  };

  const formatDate = (dateString: string) => {
    const date = parseDate(dateString);
    if (!date) return '방금 전';
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
  const formatKoDate = (dateString: string, fallback: string = '날짜 미정') => {
    const date = parseDate(dateString);
    if (!date) return fallback;
    return date.toLocaleDateString('ko-KR');
  };

  const getWeekdayKo = (dateString: string) => {
    const date = parseDate(dateString);
    if (!date) return '-';
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return days[date.getDay()];
  };

  return (
    <Box minH="100vh" bg="#f7f9fb" w="100%" pt="18mm">
      {/* 상단 컨트롤 영역 - 동영상 페이지와 동일한 여백 */}
      <Box px={{ base: 2, md: 4, lg: 6 }} pt={10} pb={4} w="100%" maxW="1400px" mx="auto">
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
          {user && (
            <IconButton
              aria-label="사진 업로드"
              icon={<AddIcon />}
              colorScheme="blue"
              bg="#004ea8"
              _hover={{ bg: "#003d7a" }}
              onClick={() => setIsUploadModalOpen(true)}
              size="sm"
            />
          )}
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
            {user && (
              <Button
                colorScheme="blue"
                bg="#004ea8"
                _hover={{ bg: "#003d7a" }}
                onClick={() => setIsUploadModalOpen(true)}
              >
                첫 번째 사진 업로드하기
              </Button>
            )}
          </VStack>
        </Center>
      ) : (
        <Box px={{ base: 2, md: 4, lg: 6 }} pb={10} w="100%" maxW="1400px" mx="auto">
          <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={6}>
          {sortedPosts.map((post) => {
            const currentIndex = hoveredImageIndex[post.id] || 0;
            const images = post.multiplePhotos && post.multiplePhotos.length > 0 ? post.multiplePhotos : [post.src];
            const currentImage = images[currentIndex];
            return (
              <Card
                key={post.id}
                w="100%"
                overflow="hidden"
                borderRadius="lg"
                bg="white"
                shadow="md"
                cursor="pointer"
                role="group"
                transition="all 0.2s ease"
                _hover={{ shadow: 'xl', transform: 'translateY(-4px)' }}
                onClick={() => handleOpenPost(post)}
              >
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
                        onError={(e: any) => {
                          console.error('❌ 이미지 로드 실패:', currentImage, e);
                          e.target.style.display = 'none';
                        }}
                        onLoad={() => {
                          console.log('✅ 이미지 로드 성공:', currentImage);
                        }}
                        fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='400' height='400' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='16' fill='%23999'%3E이미지를 불러올 수 없습니다%3C/text%3E%3C/svg%3E"
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
                  <Box px={4} pt={0} pb={0}>
                    {/* 외부 스택 간격: 정성인과 업로드 사이 간격을 날짜-정성인 간격과 동일하게 */}
                      <VStack align="start" spacing={0} w="full">
                      {/* 1행+2행 묶음: 간격 최소화 */}
                      <VStack align="start" spacing={0} w="full" mt="-2">
                        {/* 1행: 행사일(요일 포함) / 우측 좋아요·댓글 수 */}
                        <Flex w="full" align="center">
                          <Text fontSize="sm" fontWeight="bold">
                            {`${formatKoDate(post.eventDate)} (${getWeekdayKo(post.eventDate)})`}
                          </Text>
                          <HStack spacing={4} ml="auto">
                            <Tooltip
                              label={`좋아요 ${post.likes}개`}
                              fontSize="10px"
                              placement="top"
                              bg="gray.800"
                              color="white"
                              borderRadius="md"
                              px={2}
                              py={1}
                            >
                              <HStack spacing={1} cursor="default">
                                <AiFillHeart color="#e53e3e" size={16} />
                                <Text fontSize="sm" color="gray.600">{post.likes}</Text>
                              </HStack>
                            </Tooltip>
                            <Tooltip
                              label={`댓글 ${post.comments.length}개`}
                              fontSize="10px"
                              placement="top"
                              bg="gray.800"
                              color="white"
                              borderRadius="md"
                              px={2}
                              py={1}
                            >
                              <HStack spacing={1} cursor="default">
                                <Text fontSize="sm">💬</Text>
                                <Text fontSize="sm" color="gray.600">{post.comments.length}</Text>
                              </HStack>
                            </Tooltip>
                            <Tooltip
                              label={`클릭 ${formatViewCountDisplay(post.clicks || 0)}회`}
                              fontSize="10px"
                              placement="top"
                              bg="gray.800"
                              color="white"
                              borderRadius="md"
                              px={2}
                              py={1}
                            >
                              <HStack spacing={1} cursor="default">
                                <Text fontSize="sm">⚡</Text>
                                <Text fontSize="sm" color="gray.600">
                                  {formatViewCountDisplay(post.clicks || 0)}
                                </Text>
                              </HStack>
                            </Tooltip>
                          </HStack>
                        </Flex>

                        {/* 2행: 이름 (1행과 간격 더 줄임 - 음수 margin 적용) */}
                        <Text fontSize="sm" mt="-3" lineHeight="1.2">{post.author.name}</Text>
                      </VStack>

                      {/* 3행: 업로드 날짜+요일 / 우측 상대시간 (정성인과 간격을 날짜-정성인 간격과 동일하게) */}
                      <Flex w="full" align="center" mt="-3" mb="0.5">
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
              const images = selectedPost.multiplePhotos && selectedPost.multiplePhotos.length > 1 
                ? selectedPost.multiplePhotos 
                : [selectedPost.src];
              const currentIdx = hoveredImageIndex[selectedPost.id] || 0;
              const currentImageSrc = images[currentIdx];
              
              // 이미지 비율 감지 및 저장
              saveImageAspectRatio(selectedPost.id, currentImageSrc);
              const aspectRatio = imageAspectRatios[selectedPost.id] || 1;
              const isLandscape = aspectRatio > 1.2; // 가로 사진 판정
              
              // 좌우 네비게이션 함수
              const goToPrevious = () => {
                if (images.length > 1) {
                  const newIndex = currentIdx === 0 ? images.length - 1 : currentIdx - 1;
                  setHoveredImageIndex(prev => ({ ...prev, [selectedPost.id]: newIndex }));
                }
              };
              
              const goToNext = () => {
                if (images.length > 1) {
                  const newIndex = currentIdx === images.length - 1 ? 0 : currentIdx + 1;
                  setHoveredImageIndex(prev => ({ ...prev, [selectedPost.id]: newIndex }));
                }
              };
              
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
                    zIndex={2}
                    fontSize="xs"
                    fontWeight="bold"
                    px={2}
                    py={1}
                    borderRadius="md"
                  >
                    {selectedPost.eventType?.includes('ì') || selectedPost.eventType?.includes('자체') ? '자체' : selectedPost.eventType}
                  </Badge>
                  
                  {/* 좌우 화살표 버튼 (여러 이미지가 있을 때만 표시) */}
                  {images.length > 1 && (
                    <>
                      <IconButton
                        aria-label="이전 이미지"
                        icon={<FiChevronLeft />}
                        position="absolute"
                        left={2}
                        top="50%"
                        transform="translateY(-50%)"
                        zIndex={2}
                        bg="blackAlpha.600"
                        color="white"
                        _hover={{ bg: "blackAlpha.800" }}
                        onClick={goToPrevious}
                        borderRadius="full"
                        size="lg"
                      />
                      <IconButton
                        aria-label="다음 이미지"
                        icon={<FiChevronRight />}
                        position="absolute"
                        right={2}
                        top="50%"
                        transform="translateY(-50%)"
                        zIndex={2}
                        bg="blackAlpha.600"
                        color="white"
                        _hover={{ bg: "blackAlpha.800" }}
                        onClick={goToNext}
                        borderRadius="full"
                        size="lg"
                      />
                    </>
                  )}
                  
                  {images.length > 1 ? (
                    <Box position="relative" h="full">
                      <Image
                        src={images[currentIdx]}
                        alt={selectedPost.caption}
                        w="full"
                        h="full"
                        objectFit="contain"
                        bg="black"
                        cursor="zoom-in"
                        onClick={() => {
                          openPreview(images[currentIdx]);
                        }}
                        onError={(e: any) => {
                          console.error('❌ 다중 이미지 로드 실패:', images[currentIdx], e);
                        }}
                        onLoad={() => {
                          console.log('✅ 다중 이미지 로드 성공:', images[currentIdx]);
                        }}
                        fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Crect width='800' height='600' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='18' fill='%23999'%3E이미지를 불러올 수 없습니다%3C/text%3E%3C/svg%3E"
                      />
                      
                      {/* 이미지 인디케이터 */}
                      <HStack
                        position="absolute"
                        bottom={4}
                        left="50%"
                        transform="translateX(-50%)"
                        spacing={1}
                        zIndex={2}
                      >
                        {images.map((_, index) => (
                          <Box
                            key={index}
                            w={2}
                            h={2}
                            borderRadius="full"
                            bg={index === currentIdx ? "white" : "whiteAlpha.500"}
                            cursor="pointer"
                            onClick={() => setHoveredImageIndex(prev => ({ ...prev, [selectedPost.id]: index }))}
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
                      onError={(e: any) => {
                        console.error('❌ 상세 이미지 로드 실패:', selectedPost.src, e);
                      }}
                      onLoad={() => {
                        console.log('✅ 상세 이미지 로드 성공:', selectedPost.src);
                      }}
                      fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Crect width='800' height='600' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='18' fill='%23999'%3E이미지를 불러올 수 없습니다%3C/text%3E%3C/svg%3E"
                    />
                  )}
                </Box>

                {/* 정보 영역 */}
                <Box flex={isLandscape ? 1 : 1} px={6} pt={4} pb={0} overflowY="auto">
                  <VStack align="start" spacing={0} w="full">
                    {/* 헤더: 1행 행사일(요일), 2행 이름 */}
                    <VStack align="start" spacing={0} w="full" mt="-2">
                      <Text fontSize="md" fontWeight="bold">
                        {`${formatKoDate(selectedPost.eventDate)} (${getWeekdayKo(selectedPost.eventDate)})`}
                      </Text>
                      <Text fontSize="sm" color="gray.800" mt="-3" lineHeight="1.2">{selectedPost.author.name}</Text>
                    </VStack>

                    {/* 캡션 */}
                    {/* 요청에 따라 캡션은 목록 썸네일에는 숨기지만 상세에서는 유지 */}
                    {selectedPost.caption && selectedPost.caption.trim() && <Text mt={2}>{selectedPost.caption}</Text>}

                    {/* 태그 */}
                    {selectedPost.tags.length > 0 && (
                      <HStack spacing={2} wrap="wrap" mt={2}>
                        {selectedPost.tags.map((tag, index) => (
                          <Badge key={index} colorScheme="blue" variant="subtle">
                            #{tag}
                          </Badge>
                        ))}
                      </HStack>
                    )}

                    {/* 3행: 업로드 날짜+요일 (좌측), 상대시간(우측) */}
                    <Flex w="full" align="center" mt="-3">
                      <Text fontSize="xs" color="gray.600" fontWeight="semibold">
                        {`업로드: ${formatKoDate(selectedPost.createdAt)} (${getWeekdayKo(selectedPost.createdAt)})`}
                      </Text>
                      <Text fontSize="xs" color="gray.500" ml="auto">
                        {formatDate(selectedPost.createdAt)}
                      </Text>
                    </Flex>

                    {/* 액션 버튼: 좋아요, 다운로드, 편집/삭제 및 좋아요/댓글 수 */}
                    <Flex w="full" justify="flex-end" align="center" mt="-1">
                      <HStack spacing={1.5}>
                        <Tooltip label="좋아요" placement="top">
                          <IconButton 
                            aria-label="좋아요" 
                            icon={selectedPost.isLiked ? <Text fontSize="xs" color="white" fontWeight="bold">♥</Text> : <Text fontSize="xs" color="white">♡</Text>} 
                            size="xs" 
                            bg={selectedPost.isLiked ? "#e53e3e" : "#004ea8"}
                            color="white"
                            _hover={{ bg: selectedPost.isLiked ? "#c53030" : "#00397a" }}
                            onClick={() => toggleLike(selectedPost.id)} 
                            h="24px"
                            minW="24px"
                          />
                        </Tooltip>
                        <Tooltip label="다운로드" placement="top">
                          <IconButton 
                            aria-label="다운로드" 
                            icon={<Text fontSize="xs" color="white">↓</Text>} 
                            size="xs" 
                            bg="#004ea8"
                            color="white"
                            _hover={{ bg: "#00397a" }}
                            onClick={() => handleDownload(selectedPost)} 
                            h="24px"
                            minW="24px"
                          />
                        </Tooltip>
                        {((user?.id && user?.id === selectedPost.author.id) || user?.role === 'SUPER_ADMIN') && (
                          <>
                            <Tooltip label="수정" placement="top">
                              <IconButton 
                                aria-label="수정" 
                                icon={<Text fontSize="xs" color="white">✎</Text>} 
                                size="xs" 
                                bg="#004ea8"
                                color="white"
                                _hover={{ bg: "#00397a" }}
                                onClick={() => openEditModal(selectedPost)} 
                                h="24px"
                                minW="24px"
                              />
                            </Tooltip>
                            <Tooltip label="삭제" placement="top">
                              <IconButton 
                                aria-label="삭제" 
                                icon={<DeleteIcon color="white" boxSize="10px" />} 
                                size="xs" 
                                bg="#004ea8"
                                color="white"
                                _hover={{ bg: "#00397a" }}
                                onClick={() => deletePost(selectedPost.id)} 
                                h="24px"
                                minW="24px"
                              />
                            </Tooltip>
                          </>
                        )}
                      </HStack>
                    </Flex>
                    <Flex w="full" justify="flex-end" mt={1} align="center" gap={1}>
                      <Text fontSize="xs" color="gray.800">
                        좋아요 {selectedPost.likes}개
                      </Text>
                      <Text fontSize="xs" color="gray.400">·</Text>
                      <Text fontSize="xs" color="gray.800">
                        댓글 {selectedPost.comments.length}개
                      </Text>
                      <Text fontSize="xs" color="gray.400">·</Text>
                      <Text fontSize="xs" color="gray.800">
                        클릭 {formatViewCountDisplay(selectedPost.clicks || 0)}회
                      </Text>
                    </Flex>

                    {/* 댓글 목록: 댓글 내용, 업로드시점, 이름, 수정/삭제 버튼을 같은 행에 표시 */}
                    <VStack align="start" spacing={0} w="full">
                      {selectedPost.comments.map((comment, index) => (
                        <Box key={comment.id} w="full" mt={index === 0 ? 0 : "-5"}>
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
                            <Flex w="full" align="flex-start" wrap="wrap" gap={1.5}>
                              {/* 댓글 내용 - 줄바꿈 가능 */}
                              <Text 
                                fontSize="xs" 
                                color="gray.600"
                                fontWeight="bold"
                                wordBreak="break-word" 
                                whiteSpace="pre-wrap"
                                flex="1"
                                minW="0"
                              >
                                {comment.content}
                              </Text>
                              {/* 업로드시점, 이름, 수정/삭제 버튼 - 같은 행에 배치 */}
                              <HStack spacing={1.5} align="center" flexShrink={0}>
                                <Text fontSize="xs" color="gray.500">{formatDate(comment.createdAt)}</Text>
                                <Text fontSize="xs" color="gray.600" fontWeight="bold">{comment.author.name}</Text>
                                {((user?.id && user?.id === comment.author.id) || user?.role === 'SUPER_ADMIN') && (
                                  <HStack spacing={0.5}>
                                    <IconButton 
                                      aria-label="댓글 수정" 
                                      icon={<Text fontSize="10px" color="#004ea8">✎</Text>} 
                                      size="xs" 
                                      bg="white"
                                      borderColor="#004ea8"
                                      borderWidth="1px"
                                      color="#004ea8"
                                      _hover={{ bg: "blue.50" }}
                                      onClick={() => startEditComment(comment.id, comment.content)} 
                                      h="20px"
                                      minW="20px"
                                      p={0}
                                    />
                                    <IconButton 
                                      aria-label="댓글 삭제" 
                                      icon={<DeleteIcon color="#004ea8" boxSize="10px" />} 
                                      size="xs" 
                                      bg="white"
                                      borderColor="#004ea8"
                                      borderWidth="1px"
                                      color="#004ea8"
                                      _hover={{ bg: "blue.50" }}
                                      onClick={() => deleteComment(selectedPost.id, comment.id)} 
                                      h="20px"
                                      minW="20px"
                                      p={0}
                                    />
                                  </HStack>
                                )}
                              </HStack>
                        </Flex>
                          )}
                        </Box>
                      ))}
                    </VStack>

                    {/* 댓글 입력: 심플 디자인 */}
                    <HStack spacing={1} w="full" mt={2} mb="0.5">
                      <Input 
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)} 
                        placeholder="댓글 입력..." 
                        size="sm" 
                        bg="gray.50" 
                        borderRadius="md" 
                        h="28px"
                        fontSize="xs"
                        px={2}
                        py={1}
                        onKeyDown={(e: any) => {
                          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            if (newComment.trim()) {
                            addComment(selectedPost.id);
                            }
                          }
                        }} 
                      />
                      <IconButton 
                        size="sm" 
                        bg="#004ea8"
                        color="white"
                        _hover={{ bg: "#00397a" }}
                        aria-label="등록" 
                        icon={<ArrowUpIcon />} 
                        h="28px"
                        minW="28px"
                        onClick={() => {
                          if (newComment.trim()) {
                            addComment(selectedPost.id);
                          }
                        }}
                        isDisabled={!newComment.trim()}
                      />
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
