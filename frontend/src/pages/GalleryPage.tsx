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
  Tooltip,
  Divider,
  useToast
} from '@chakra-ui/react';
import { 
  useState, 
  useRef, 
  useCallback, 
  useEffect,
  useMemo
} from 'react';
import { 
  PlusSquareIcon, 
  DownloadIcon,
  DeleteIcon,
  EditIcon,
  ArrowUpIcon
} from '@chakra-ui/icons';
import { useAuthStore } from '../store/auth';

// 사진 데이터
const photoItems = [
  {
    id: 1,
    type: 'photo',
    src: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80',
    date: '2025.06.30.(월)',
    author: '정성인',
    likes: 12,
    comments: 5,
    badge: '+3',
    label: '사진',
    tags: ['경기', '팀', '축구'],
    description: '오늘 경기에서 찍은 멋진 사진들',
    eventType: '매치',
    thumbnail: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=400&q=80',
    isLiked: false,
    commentsList: [
      { id: 1, author: '김철수', text: '정말 멋진 사진이네요!', date: '2025.06.30' },
      { id: 2, author: '이영희', text: '다음 경기도 화이팅!', date: '2025.06.30' }
    ]
  },
  {
    id: 2,
    type: 'photo',
    src: 'https://images.unsplash.com/photo-1519125323398-675f0ddb6308?auto=format&fit=crop&w=400&q=80',
    date: '2025.06.29.(일)',
    author: '정성인',
    likes: 8,
    comments: 3,
    badge: '+2',
    label: '사진',
    tags: ['연습', '기술'],
    description: '기술 연습 중',
    eventType: '연습',
    thumbnail: 'https://images.unsplash.com/photo-1519125323398-675f0ddb6308?auto=format&fit=crop&w=400&q=80',
    isLiked: true,
    commentsList: [
      { id: 1, author: '박민수', text: '기술이 많이 늘었네요!', date: '2025.06.29' }
    ]
  }
];

// 유튜브 API 설정
const YT_API_KEY = 'AIzaSyC7M5KrtdL8ChfVCX0M2CZfg7GWGaExMTk';
const PLAYLIST_ID = 'PLQ5o2f7efzlZ-RDG64h4Oj_5pXt0g6q3b';

// 더미 갤러리 아이템 (초기 로딩용)
const initialGalleryItems = [...photoItems];

const filterTabs = [
  { label: '전체', value: 'all' },
  { label: '사진', value: 'photo' },
  { label: '동영상', value: 'video' }
];

const sortTabs = [
  { label: '최신순', value: 'latest' },
  { label: '오래된순', value: 'oldest' },
  { label: '좋아요순', value: 'likes' },
  { label: '댓글순', value: 'comments' }
];

const eventTypes = [
  { label: '매치', value: 'match' },
  { label: '자체', value: 'practice' },
  { label: '회식', value: 'dinner' },
  { label: '기타', value: 'other' }
];

// 파일을 base64로 변환하는 함수 (간단한 방식)
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('파일 읽기에 실패했습니다.'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('파일 읽기 오류가 발생했습니다.'));
    };
    
    reader.readAsDataURL(file);
  });
};

export default function GalleryPage() {
  const { user } = useAuthStore();
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('latest');
  
  // 개발용: localStorage 리셋 함수 (콘솔에서 사용 가능)
  (window as any).resetGalleryData = () => {
    localStorage.removeItem('galleryItems');
    window.location.reload();
  };
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [items, setItems] = useState(initialGalleryItems);
  const [youtubeVideos, setYoutubeVideos] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [downloadItem, setDownloadItem] = useState<any>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<number[]>([]);
  const [uploadEventType, setUploadEventType] = useState('');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [editingCommentIndex, setEditingCommentIndex] = useState<number | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [isAddPhotoModalOpen, setIsAddPhotoModalOpen] = useState(false);
  const [addPhotoFiles, setAddPhotoFiles] = useState<File[]>([]);
  const [addPhotoEventType, setAddPhotoEventType] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addPhotoFileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  // localStorage 정리 함수
  const cleanupStorage = () => {
    try {
      const savedItems = localStorage.getItem('galleryItems');
      if (savedItems) {
        const parsedItems = JSON.parse(savedItems);
        const photoItems = parsedItems.filter((item: any) => item.type === 'photo');
        const videoItems = parsedItems.filter((item: any) => item.type === 'video');
        
        // 최신 사진 20개만 유지
        const recentPhotos = photoItems.slice(0, 20);
        const cleanedItems = [...recentPhotos, ...videoItems];
        
        localStorage.setItem('galleryItems', JSON.stringify(cleanedItems));
        setItems(cleanedItems);
        
        toast({
          title: '정리 완료',
          description: '저장소가 정리되었습니다. 최신 사진 20개만 유지됩니다.',
          status: 'success',
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('저장소 정리 오류:', error);
    }
  };

  // localStorage에서 데이터 로드
  useEffect(() => {
    const savedItems = localStorage.getItem('galleryItems');
    if (savedItems) {
      try {
        const parsedItems = JSON.parse(savedItems);
        
        // 저장소 용량 체크
        const dataSize = savedItems.length;
        const maxSize = 4 * 1024 * 1024; // 4MB
        
        if (dataSize > maxSize) {
          // 용량 초과 시 자동 정리
          cleanupStorage();
        } else {
          setItems(parsedItems);
        }
      } catch (error) {
        console.error('localStorage 데이터 파싱 오류:', error);
        // 오류 발생 시 초기 데이터로 설정
        setItems(initialGalleryItems);
      }
    } else {
      // 저장된 데이터가 없으면 초기 데이터로 설정
      setItems(initialGalleryItems);
    }
  }, []);

  // 유튜브 재생목록에서 영상 가져오기
  useEffect(() => {
    // 항상 YouTube 영상을 가져와서 최신 상태 유지
      fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${PLAYLIST_ID}&key=${YT_API_KEY}`)
        .then(res => res.json())
        .then((data: { items?: { snippet: { resourceId: { videoId: string }, title: string, publishedAt: string } }[] }) => {
          if (data.items && data.items.length > 0) {
            const videoItems = data.items
              .filter(item => {
                // 삭제된 영상 필터링
                const title = item.snippet.title.toLowerCase();
                return !title.includes('deleted video') && 
                       !title.includes('private video') && 
                       !title.includes('unavailable') &&
                       item.snippet.title.trim() !== '';
              })
              .map((item, index) => {
                const publishedDate = new Date(item.snippet.publishedAt);
                const formattedDate = publishedDate.toLocaleDateString('ko-KR', { 
                  year: 'numeric', 
                  month: '2-digit', 
                  day: '2-digit', 
                  weekday: 'short' 
                });
                
                // 제목에서 매치/자체 정보 추출
                const title = item.snippet.title;
                let eventBadge = null;
                let eventType = '매치';
                
                if (title.includes('매치') || title.includes('match')) {
                  eventBadge = '매치';
                  eventType = '매치';
                } else if (title.includes('자체') || title.includes('연습') || title.includes('practice')) {
                  eventBadge = '자체';
                  eventType = '연습';
                }
                
                return {
                  id: `video_${index + 1}`,
                  type: 'video',
                  videoId: item.snippet.resourceId.videoId,
                  title: item.snippet.title,
                  date: formattedDate,
                  author: 'tony jung',
                  likes: Math.floor(Math.random() * 30) + 10,
                  comments: Math.floor(Math.random() * 15) + 3,
                  badge: eventBadge,
                  label: '동영상',
                  tags: ['경기', '하이라이트'],
                  description: item.snippet.title,
                  eventType: eventType,
                  thumbnail: `https://img.youtube.com/vi/${item.snippet.resourceId.videoId}/maxresdefault.jpg`,
                  isLiked: Math.random() > 0.5,
                  commentsList: [
                    {
                      id: 1,
                      author: ['김철수', '이영희', '박민수', '최지영', '정현우'][Math.floor(Math.random() * 5)],
                      text: ['정말 멋진 경기였어요!', '다음 경기도 기대됩니다!', '팀워크가 정말 좋았어요!', '기술이 많이 늘었네요!', '정말 열정적인 경기였어요!'][Math.floor(Math.random() * 5)],
                      date: formattedDate
                    }
                  ]
                };
              });
            
            setYoutubeVideos(videoItems);
            // 기존 사진과 YouTube 영상 합치기
            setItems(prev => {
              const currentPhotos = prev.filter(item => item.type === 'photo');
              const combinedItems = [...currentPhotos, ...videoItems];
              // localStorage에 저장
              localStorage.setItem('galleryItems', JSON.stringify(combinedItems));
              return combinedItems;
            });
          }
        })
        .catch((error) => {
          console.error('유튜브 API 오류:', error);
        });
  }, []);

  // 필터/정렬/검색 적용
  useEffect(() => {
    // 현재 items 상태를 사용 (localStorage를 다시 읽지 않음)
    let allItems = items;
    
    let filteredItems = allItems.filter(item => {
      // 타입 필터
      if (filter === 'all') return true;
      if (filter === 'photo' && item.type === 'photo') return true;
      if (filter === 'video' && item.type === 'video') return true;
      return false;
    });

    // 검색 필터
    if (search) {
      filteredItems = filteredItems.filter(item => 
        item.date.includes(search) || 
        item.author.includes(search) || 
        item.description.includes(search) ||
        item.tags.some(tag => tag.includes(search))
      );
    }

    // 태그 필터
    if (selectedTags.length > 0) {
      filteredItems = filteredItems.filter(item =>
        selectedTags.some(tag => item.tags.includes(tag))
      );
    }

    // 정렬
    if (sort === 'latest') {
      filteredItems = [...filteredItems].sort((a, b) => b.date.localeCompare(a.date));
    } else if (sort === 'oldest') {
      filteredItems = [...filteredItems].sort((a, b) => a.date.localeCompare(b.date));
    } else if (sort === 'likes') {
      filteredItems = [...filteredItems].sort((a, b) => b.likes - a.likes);
    } else if (sort === 'comments') {
      filteredItems = [...filteredItems].sort((a, b) => b.comments - a.comments);
    }

    setItems(filteredItems);
  }, [filter, sort, search, selectedTags, youtubeVideos]);

  // 좋아요 토글
  const toggleLike = useCallback((itemId: number) => {
    setItems(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, likes: item.isLiked ? item.likes - 1 : item.likes + 1, isLiked: !item.isLiked }
        : item
    ));
  }, []);

  // 댓글 추가
  const addComment = useCallback((itemId: number) => {
    if (!commentText.trim() || !user) return;
    
    const newComment = {
      id: Date.now(),
      author: user.name,
      text: commentText,
      date: new Date().toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }).replace('.', '.').replace('.', '.')
    };

    const updatedItems = items.map(item => 
      item.id === itemId 
        ? { ...item, comments: item.comments + 1, commentsList: [...item.commentsList, newComment] }
        : item
    );
    setItems(updatedItems);
    localStorage.setItem('galleryItems', JSON.stringify(updatedItems));
    
    // selectedItem도 즉시 업데이트
    if (selectedItem && selectedItem.id === itemId) {
      setSelectedItem({
        ...selectedItem,
        comments: selectedItem.comments + 1,
        commentsList: [...selectedItem.commentsList, newComment]
      });
    }
    
    setCommentText('');
    
    toast({
      title: '댓글 추가',
      description: '댓글이 추가되었습니다.',
      status: 'success',
      duration: 2000,
    });
  }, [commentText, user, toast]);

  // 댓글 수정
  const handleEditComment = useCallback((index: number) => {
    if (selectedItem && selectedItem.commentsList[index]) {
      setEditCommentText(selectedItem.commentsList[index].text);
      setEditingCommentIndex(index);
    }
  }, [selectedItem]);

  // 댓글 수정 저장
  const handleSaveEditComment = useCallback((index: number) => {
    if (!editCommentText.trim() || !selectedItem) return;

    const updatedComments = [...selectedItem.commentsList];
    updatedComments[index] = {
      ...updatedComments[index],
      text: editCommentText
    };

    setItems(prev => prev.map(item => 
      item.id === selectedItem.id 
        ? { ...item, commentsList: updatedComments }
        : item
    ));

    setSelectedItem({
      ...selectedItem,
      commentsList: updatedComments
    });

    setEditingCommentIndex(null);
    setEditCommentText('');

    toast({
      title: '댓글 수정',
      description: '댓글이 수정되었습니다.',
      status: 'success',
      duration: 2000,
    });
  }, [editCommentText, selectedItem, toast]);

  // 댓글 삭제
  const handleDeleteComment = useCallback((index: number) => {
    if (!selectedItem) return;

    const updatedComments = selectedItem.commentsList.filter((_: any, i: number) => i !== index);

    setItems(prev => prev.map(item => 
      item.id === selectedItem.id 
        ? { ...item, comments: item.comments - 1, commentsList: updatedComments }
        : item
    ));

    setSelectedItem({
      ...selectedItem,
      comments: selectedItem.comments - 1,
      commentsList: updatedComments
    });

    toast({
      title: '댓글 삭제',
      description: '댓글이 삭제되었습니다.',
      status: 'success',
      duration: 2000,
    });
  }, [selectedItem, toast]);

  // 파일 업로드 처리
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length !== files.length) {
      toast({
        title: '오류',
        description: '이미지 파일만 업로드 가능합니다. (JPG, PNG, GIF, WEBP)',
        status: 'error',
        duration: 3000,
      });
      return;
    }
    
    setUploadFiles(imageFiles);
  }, [toast]);

  // 업로드 제출
  const handleUpload = useCallback(async () => {
    if (!user) return;

    if (uploadFiles.length === 0) {
      toast({
        title: '오류',
        description: '사진 파일을 선택해주세요.',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    if (!uploadTitle) {
      toast({
        title: '오류',
        description: '날짜를 선택해주세요.',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    setIsProcessing(true);

    // localStorage 용량 체크 함수
    const checkStorageQuota = (data: string): boolean => {
      try {
        // 현재 localStorage 사용량 체크
        let currentSize = 0;
        for (let key in localStorage) {
          if (localStorage.hasOwnProperty(key)) {
            currentSize += localStorage[key].length;
          }
        }
        
        // 새 데이터 크기 + 현재 크기가 5MB를 초과하면 false (용량 증가)
        const newDataSize = data.length;
        const totalSize = currentSize + newDataSize;
        const maxSize = 5 * 1024 * 1024; // 5MB로 증가
        
        console.log(`현재 크기: ${currentSize}, 새 데이터 크기: ${newDataSize}, 총 크기: ${totalSize}, 최대 크기: ${maxSize}`);
        
        return totalSize < maxSize;
      } catch (error) {
        console.error('저장소 용량 체크 오류:', error);
        return false;
      }
    };

    // 실제 업로드 로직 시뮬레이션
    const processFiles = async () => {
      try {
        const newItems = [];
        
        for (let i = 0; i < uploadFiles.length; i++) {
          const file = uploadFiles[i];
          
          // 파일을 base64로 변환
          const base64 = await fileToBase64(file);
          
          newItems.push({
            id: Date.now() + i,
            type: 'photo',
            src: base64,
            date: uploadTitle,
            author: user.name,
            likes: 0,
            comments: 0,
            badge: null,
            label: '사진',
            tags: [],
            description: uploadTitle,
            eventType: uploadEventType ? eventTypes.find(type => type.value === uploadEventType)?.label || '기타' : '기타',
            thumbnail: base64,
            isLiked: false,
            commentsList: []
          });
        }

        const updatedItems = [...newItems, ...items];
        
        // localStorage 용량 체크
        const dataToSave = JSON.stringify(updatedItems);
        if (!checkStorageQuota(dataToSave)) {
          // 용량 초과 시 업로드 실패 처리
          setIsProcessing(false);
          
          toast({
            title: '용량 초과 오류',
            description: '저장소 용량이 부족합니다. 더 적은 수의 사진이나 더 작은 크기의 사진을 업로드해주세요.',
            status: 'error',
            duration: 5000,
          });
          
          return; // 업로드 중단
        }
        
        // 성공적으로 업로드
        setItems(updatedItems);
        localStorage.setItem('galleryItems', JSON.stringify(updatedItems));
        
        setIsProcessing(false);
        setIsUploadModalOpen(false);
        
        // 폼 초기화
        setUploadEventType('');
        setUploadTitle('');
        setUploadFiles([]);

        toast({
          title: '성공',
          description: `${uploadFiles.length}장의 사진 업로드가 완료되었습니다.`,
          status: 'success',
          duration: 3000,
        });
      } catch (error) {
        console.error('업로드 오류:', error);
        setIsProcessing(false);
        
        // 구체적인 오류 메시지 제공
        let errorMessage = '업로드 중 오류가 발생했습니다.';
        if (error instanceof Error) {
          if (error.message.includes('QuotaExceededError')) {
            errorMessage = '저장소 용량이 부족합니다. 더 작은 이미지나 적은 수의 이미지를 업로드해주세요.';
          } else if (error.message.includes('파일 읽기')) {
            errorMessage = '파일 읽기에 실패했습니다. 다른 이미지를 선택해주세요.';
          } else if (error.message.includes('이미지 로드')) {
            errorMessage = '이미지 로드에 실패했습니다. 다른 이미지를 선택해주세요.';
          }
        }
        
        toast({
          title: '오류',
          description: errorMessage,
          status: 'error',
          duration: 5000,
        });
      }
    };

    // 2초 후에 업로드 시작
    setTimeout(() => {
      processFiles();
    }, 2000);
  }, [uploadFiles, uploadTitle, uploadEventType, user, toast, items]);

  // 다운로드 모달 열기
  const handleDownloadModal = useCallback((item: any) => {
    if (item.type === 'photo' && item.isGroup && item.groupPhotos) {
      setDownloadItem(item);
      setSelectedPhotos([]);
      setIsDownloadModalOpen(true);
    } else {
      // 단일 사진 또는 비디오는 기존 방식으로 다운로드
      handleDirectDownload(item);
    }
  }, []);

  // 직접 다운로드 (단일 파일)
  const handleDirectDownload = useCallback((item: any) => {
    if (item.type === 'photo') {
      const link = document.createElement('a');
      link.href = item.src;
      link.download = `gallery_${item.id}.jpg`;
      link.click();
    } else if (item.type === 'video') {
      window.open(`https://www.youtube.com/watch?v=${item.videoId}`, '_blank');
    }
  }, []);

  // 선택적 다운로드 실행
  const handleSelectiveDownload = useCallback(() => {
    if (!downloadItem || selectedPhotos.length === 0) return;

    selectedPhotos.forEach((index, i) => {
      setTimeout(() => {
        const photo = downloadItem.groupPhotos[index];
        const link = document.createElement('a');
        link.href = photo.src;
        link.download = `gallery_${downloadItem.date}_${index + 1}.jpg`;
        link.click();
      }, i * 100);
    });

    setIsDownloadModalOpen(false);
    setDownloadItem(null);
    setSelectedPhotos([]);

    toast({
      title: '다운로드 시작',
      description: `${selectedPhotos.length}장의 사진을 다운로드합니다.`,
      status: 'info',
      duration: 3000,
    });
  }, [downloadItem, selectedPhotos, toast]);

  // 사진 선택 토글
  const togglePhotoSelection = useCallback((index: number) => {
    setSelectedPhotos(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else if (prev.length < 10) {
        return [...prev, index];
      }
      return prev;
    });
  }, []);

  // 사진 편집 함수
  const handleEdit = useCallback((item: any) => {
    setEditingItem({
      ...item,
      originalDate: item.date // 원본 날짜 저장
    });
    setIsEditModalOpen(true);
  }, []);

  // 사진 삭제 함수
  const handleDelete = useCallback((item: any) => {
    if (window.confirm('정말로 이 사진을 삭제하시겠습니까?')) {
      if (item.isGroup && item.groupPhotos) {
        // 그룹 사진 전체 삭제
        setItems(prev => prev.filter(prevItem => 
          !item.groupPhotos.some((groupPhoto: any) => groupPhoto.id === prevItem.id)
        ));
        toast({
          title: '삭제 완료',
          description: `${item.groupCount}장의 사진이 삭제되었습니다.`,
          status: 'success',
          duration: 3000,
        });
      } else {
        // 단일 사진 삭제
        setItems(prev => prev.filter(prevItem => prevItem.id !== item.id));
        toast({
          title: '삭제 완료',
          description: '사진이 삭제되었습니다.',
          status: 'success',
          duration: 3000,
        });
      }
      setIsDetailModalOpen(false);
    }
  }, [toast]);

  // 편집 저장 함수
  const handleSaveEdit = useCallback(() => {
    if (!editingItem) return;

    const updatedItems = items.map(item => {
      // 그룹 사진인 경우, 같은 날짜의 모든 사진을 수정
      if (editingItem.isGroup && editingItem.groupPhotos) {
        const isInGroup = editingItem.groupPhotos.some((groupPhoto: any) => groupPhoto.id === item.id);
        if (isInGroup) {
          return {
            ...item,
            description: editingItem.description,
            eventType: editingItem.eventType,
            date: editingItem.date
          };
        }
      } else if (item.id === editingItem.id) {
        // 단일 사진인 경우
        return {
          ...item,
          description: editingItem.description,
          eventType: editingItem.eventType,
          date: editingItem.date
        };
      }
      return item;
    });

    setItems(updatedItems);
    localStorage.setItem('galleryItems', JSON.stringify(updatedItems));

    // selectedItem도 업데이트
    if (selectedItem && selectedItem.id === editingItem.id) {
      setSelectedItem({
        ...selectedItem,
        description: editingItem.description,
        eventType: editingItem.eventType,
        date: editingItem.date
      });
    }

    setIsEditModalOpen(false);
    setEditingItem(null);
    
    const message = editingItem.isGroup && editingItem.groupPhotos 
      ? `${editingItem.groupPhotos.length}장의 사진 정보가 수정되었습니다.`
      : '사진 정보가 수정되었습니다.';
    
    toast({
      title: '수정 완료',
      description: message,
      status: 'success',
      duration: 3000,
    });
  }, [editingItem, toast, items, selectedItem]);

  // 사진 추가 모달 열기
  const handleAddPhoto = useCallback(() => {
    setIsAddPhotoModalOpen(true);
    setAddPhotoFiles([]);
    setAddPhotoEventType('');
  }, []);

  // 사진 추가 파일 선택
  const handleAddPhotoFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setAddPhotoFiles(files);
  }, []);

  // 사진 추가 업로드
  const handleAddPhotoUpload = useCallback(async () => {
    if (!user || !selectedItem || addPhotoFiles.length === 0) return;

    try {
      const newPhotos = [];
      
      for (let i = 0; i < addPhotoFiles.length; i++) {
        const file = addPhotoFiles[i];
        const base64 = await fileToBase64(file);
        
        newPhotos.push({
          id: Date.now() + i,
          type: 'photo',
          src: base64,
          date: selectedItem.date,
          author: user.name,
          likes: 0,
          comments: 0,
          badge: null,
          label: '사진',
          tags: [],
          description: selectedItem.date,
          eventType: addPhotoEventType || selectedItem.eventType || '기타',
          thumbnail: base64,
          isLiked: false,
          commentsList: []
        });
      }

      // 기존 아이템에 새 사진들 추가
      const updatedItems = [...newPhotos, ...items];
      setItems(updatedItems);
      localStorage.setItem('galleryItems', JSON.stringify(updatedItems));

      // selectedItem 업데이트 (그룹 사진인 경우)
      if (selectedItem.isGroup && selectedItem.groupPhotos) {
        setSelectedItem({
          ...selectedItem,
          groupPhotos: [...selectedItem.groupPhotos, ...newPhotos],
          groupCount: selectedItem.groupCount + newPhotos.length
        });
      }

      setIsAddPhotoModalOpen(false);
      setAddPhotoFiles([]);
      setAddPhotoEventType('');

      toast({
        title: '사진 추가 완료',
        description: `${addPhotoFiles.length}장의 사진이 추가되었습니다.`,
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      console.error('사진 추가 오류:', error);
      toast({
        title: '오류',
        description: '사진 추가 중 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
      });
    }
  }, [user, selectedItem, addPhotoFiles, addPhotoEventType, items, toast]);

  // 모든 태그 수집
  const allTags = Array.from(new Set([...photoItems, ...youtubeVideos].flatMap(item => item.tags)));

  // 사진 그룹화 함수
  const groupPhotosByDate = useCallback((items: any[]) => {
    const photoGroups: { [key: string]: any[] } = {};
    
    items.forEach(item => {
      if (item.type === 'photo') {
        const dateKey = item.date;
        if (!photoGroups[dateKey]) {
          photoGroups[dateKey] = [];
        }
        photoGroups[dateKey].push(item);
      }
    });
    
    return photoGroups;
  }, []);

  // 그룹화된 아이템 생성
  const groupedItems = useMemo(() => {
    const photoGroups = groupPhotosByDate(items);
    const result: any[] = [];
    
    items.forEach(item => {
      if (item.type === 'video') {
        result.push(item);
      } else if (item.type === 'photo') {
        const dateKey = item.date;
        const group = photoGroups[dateKey];
        
        // 그룹의 첫 번째 사진인 경우에만 그룹 아이템 추가
        if (group && group[0].id === item.id) {
          if (group.length === 1) {
            // 단일 사진인 경우 그대로 추가
            result.push(item);
          } else {
            // 복수 사진인 경우 그룹 아이템 추가
            result.push({
              ...item,
              isGroup: true,
              groupCount: group.length,
              groupPhotos: group
            });
          }
        }
      }
    });
    
    return result;
  }, [items, groupPhotosByDate]);

  return (
    <Box minH="100vh" bg="#f7f9fb" w="100vw" minW="100vw" pt="18mm">
      {/* 상단 컨트롤 영역 */}
      <Box px={{ base: 2, md: 8, lg: 24 }} py={6}>
        <Flex direction={{ base: 'column', md: 'row' }} gap={4} align={{ base: 'stretch', md: 'center' }} justify="space-between" mb={1.5}>
          {/* 필터 탭 */}
          <HStack spacing={2} flexWrap="wrap">
          {filterTabs.map(tab => (
                             <Button 
                 key={tab.value} 
                 size="sm" 
                 variant={filter === tab.value ? 'solid' : 'ghost'} 
                 colorScheme="blue" 
                 bg={filter === tab.value ? '#004ea8' : undefined}
                 color={filter === tab.value ? 'white' : undefined}
                 _hover={{ bg: filter === tab.value ? '#004ea8' : 'gray.100' }}
                 onClick={() => setFilter(tab.value)}
               >
                {tab.label}
              </Button>
          ))}
        </HStack>

          {/* 정렬 및 업로드 */}
        <HStack spacing={2}>
            <Select size="sm" value={sort} onChange={(e) => setSort(e.target.value)} w="100px">
          {sortTabs.map(tab => (
                <option key={tab.value} value={tab.value}>{tab.label}</option>
              ))}
            </Select>
            <Tooltip label="업로드">
              <IconButton 
                size="sm" 
                icon={<PlusSquareIcon />} 
                aria-label="업로드" 
                bg="#004ea8"
                color="white"
                _hover={{ bg: '#004ea8' }}
                onClick={() => setIsUploadModalOpen(true)}
              />
            </Tooltip>
        </HStack>
        </Flex>


      </Box>

      {/* 갤러리 그리드 */}
      <Box px={{ base: 2, md: 8, lg: 24 }} pb={10}>
        <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={6}>
          {groupedItems.map(item => (
            <Box 
              key={item.id} 
              bg="white" 
              borderRadius="2xl" 
              boxShadow="md" 
              overflow="hidden" 
              position="relative" 
              _hover={{ boxShadow: 'xl', transform: 'translateY(-2px)' }} 
              transition="all 0.2s"
              cursor="pointer"
              onClick={() => {
                setSelectedItem(item);
                setIsDetailModalOpen(true);
              }}
            >
              {/* 썸네일/라벨/뱃지 */}
              <Box position="relative">
                <Image 
                  src={item.thumbnail} 
                  alt={item.label} 
                  w="100%" 
                  h="150px" 
                  objectFit="cover" 
                />
                <Badge 
                  position="absolute" 
                  top={2} 
                  left={2} 
                  colorScheme={item.type === 'photo' ? 'blue' : 'red'} 
                  fontSize="xs" 
                  px={2} 
                  py={0.5} 
                  borderRadius="md"
                >
                  {item.label}
                </Badge>
                
                {/* 그룹 사진 표시 */}
                {item.isGroup && item.groupCount > 1 && (
                  <Badge 
                    position="absolute" 
                    top={2} 
                    right={2} 
                    colorScheme="purple" 
                    fontSize="xs" 
                    px={2} 
                    py={0.5} 
                    borderRadius="md"
                  >
                    +{item.groupCount - 1}
                  </Badge>
                )}

                

              </Box>

              {/* 정보 영역 */}
              <VStack align="stretch" spacing={0.5} px={3} py={2}>
                <Flex justify="space-between" align="center" mb={0.5}>
                  <Text fontSize="sm" color="black" fontWeight="semibold" noOfLines={1} flex={1} mr={2}>
                    {item.description || item.date}
                  </Text>
                  {(item.type === 'video' && item.badge) || (item.type === 'photo' && item.eventType) ? (
                    <Badge 
                      colorScheme={
                        item.type === 'video' 
                          ? (item.badge === '매치' ? 'blue' : 'green')
                          : (item.eventType === '매치' ? 'blue' : item.eventType === '자체' ? 'green' : 'gray')
                      } 
                      fontSize="xs" 
                      px={1.5} 
                      py={0.3}
                      borderRadius="sm"
                      flexShrink={0}
                    >
                      {item.type === 'video' ? item.badge : item.eventType}
                    </Badge>
                  ) : null}
                </Flex>
                
                {item.type === 'photo' && (
                  <Text fontSize="xs" color="gray.600">
                    {item.author}
                  </Text>
                )}
                <Text fontSize="xs" color="gray.400">
                  업로드: {item.date}
                </Text>

                <Flex justify="space-between" align="center" mt={1}>
                  <HStack spacing={1} cursor="pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLike(item.id);
                    }}
                  >
                    <Text fontSize="sm" color={item.isLiked ? 'red.500' : 'gray.400'}>♡</Text>
                    <Text fontSize="sm">{item.likes}</Text>
                  </HStack>
                  <HStack spacing={1}>
                    <Text fontSize="sm">💬</Text>
                    <Text fontSize="sm">{item.comments}</Text>
                  </HStack>
                </Flex>
              </VStack>
            </Box>
          ))}
        </SimpleGrid>
      </Box>

      {/* 업로드 모달 */}
      <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <HStack>
              <Text>📸</Text>
              <Text>사진 업로드</Text>
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4}>
              {/* 날짜 선택 */}
              <Input
                type="date"
                value={uploadTitle.includes('.') ? '' : uploadTitle}
                onChange={(e) => {
                  if (e.target.value) {
                    const date = new Date(e.target.value);
                    const formattedDate = date.toLocaleDateString('ko-KR', { 
                      year: 'numeric', 
                      month: '2-digit', 
                      day: '2-digit', 
                      weekday: 'short' 
                    });
                    setUploadTitle(formattedDate);
                  }
                }}
                placeholder="날짜 선택"
              />
              {uploadTitle && (
                <Text fontSize="sm" color="blue.600" fontWeight="medium">
                  선택된 날짜: {uploadTitle}
                </Text>
              )}

              {/* 파일 업로드 */}
              <Box w="full">
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  ref={fileInputRef}
                  display="none"
                />
                <Button
                  w="full"
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  colorScheme="blue"
                >
                  {uploadFiles.length > 0 ? `${uploadFiles.length}개 사진 선택됨` : '사진 파일 선택 (JPG, PNG, GIF, WEBP)'}
                </Button>
                {uploadFiles.length > 0 && (
                  <Text fontSize="sm" color="gray.600" mt={2}>
                    선택된 파일: {uploadFiles.map(f => f.name).join(', ')}
                  </Text>
                )}
              </Box>

              {/* 이벤트 타입 선택 */}
              <Box w="full">
                <Text fontSize="sm" color="gray.600" mb={2}>이벤트 타입 선택 (선택사항)</Text>
                <HStack spacing={2} flexWrap="wrap">
                  {eventTypes.map(type => (
                    <Button
                      key={type.value}
                      size="sm"
                      variant={uploadEventType === type.value ? 'solid' : 'outline'}
                      colorScheme="blue"
                      onClick={() => setUploadEventType(uploadEventType === type.value ? '' : type.value)}
                    >
                      {type.label}
                    </Button>
                  ))}
                </HStack>
              </Box>

              {/* 업로드 버튼 */}
              <Button
                colorScheme="blue"
                w="full"
                onClick={handleUpload}
                isLoading={isProcessing}
                loadingText="업로드 중..."
                isDisabled={!uploadTitle.trim() || uploadFiles.length === 0}
              >
                업로드
              </Button>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* 상세보기 모달 */}
      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <VStack align="start" spacing={1}>
              <Text fontSize="lg">{selectedItem?.date}</Text>
              <Text fontSize="sm" color="gray.500">작성자: {selectedItem?.author}</Text>
            </VStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {selectedItem && (
              <VStack spacing={4} align="stretch">
                {/* 미디어 표시 */}
            <Box position="relative">
                  {selectedItem.type === 'photo' ? (
                    selectedItem.isGroup && selectedItem.groupPhotos ? (
                      <VStack spacing={4}>
                        {/* 메인 사진 */}
                        <Image 
                          src={selectedItem.groupPhotos[selectedPhotoIndex].src} 
                          alt="상세 이미지" 
                          w="full" 
                          maxH="300px"
                          objectFit="contain"
                          borderRadius="lg"
                          cursor="pointer"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = selectedItem.groupPhotos[selectedPhotoIndex].src;
                            link.target = '_blank';
                            link.click();
                          }}
                          _hover={{ opacity: 0.9 }}
                        />
                        
                        {/* 썸네일 네비게이션 */}
                        {selectedItem.groupPhotos.length > 1 && (
                          <HStack spacing={2} overflowX="auto" w="full" py={2} justify="center">
                            {selectedItem.groupPhotos.map((photo: any, index: number) => (
                              <Image
                                key={photo.id}
                                src={photo.thumbnail}
                                alt={`썸네일 ${index + 1}`}
                                w="60px"
                                h="60px"
                                objectFit="cover"
                                borderRadius="md"
                                cursor="pointer"
                                border={selectedPhotoIndex === index ? "2px solid" : "1px solid"}
                                borderColor={selectedPhotoIndex === index ? "blue.500" : "gray.200"}
                                onClick={() => setSelectedPhotoIndex(index)}
                                _hover={{ opacity: 0.8 }}
                              />
                            ))}
                          </HStack>
                        )}
                      </VStack>
                    ) : (
                      <Image 
                        src={selectedItem.src} 
                        alt="상세 이미지" 
                        w="full" 
                        maxH="300px"
                        objectFit="contain"
                        borderRadius="lg"
                        cursor="pointer"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = selectedItem.src;
                          link.target = '_blank';
                          link.click();
                        }}
                        _hover={{ opacity: 0.9 }}
                      />
                    )
                  ) : (
                    <Box 
                      w="full" 
                      h="400px" 
                      bg="black" 
                      borderRadius="lg"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <iframe
                        width="100%"
                        height="100%"
                        src={`https://www.youtube.com/embed/${selectedItem.videoId}`}
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
            </Box>
                  )}
                </Box>

                <Divider />

                {/* 상호작용 */}
                <HStack spacing={4} justify="space-between">
                  <HStack spacing={4}>
                    <HStack 
                      spacing={2} 
                      cursor="pointer"
                      onClick={() => toggleLike(selectedItem.id)}
                    >
                      <Text fontSize="lg" color={selectedItem.isLiked ? 'red.500' : 'gray.400'}>♡</Text>
                      <Text fontSize="md">{selectedItem.likes}</Text>
              </HStack>
                    <HStack spacing={2}>
                      <Text fontSize="lg">💬</Text>
                      <Text fontSize="md">{selectedItem.comments}</Text>
                    </HStack>
                  </HStack>
                  
                  <HStack spacing={2}>
                    {selectedItem.type === 'photo' && (
                      <Tooltip label="다운로드">
                        <IconButton
                          size="sm"
                          icon={<DownloadIcon />}
                          aria-label="다운로드"
                          onClick={() => handleDownloadModal(selectedItem)}
                        />
                      </Tooltip>
                    )}
                    {(user?.name === selectedItem.author || user?.role === 'admin' || user?.role === 'superadmin') && (
                      <>
                        <Tooltip label="사진 추가">
                          <IconButton
                            size="sm"
                            icon={<PlusSquareIcon />}
                            aria-label="사진 추가"
                            colorScheme="purple"
                            onClick={handleAddPhoto}
                          />
                        </Tooltip>
                        <Tooltip label="수정">
                          <IconButton
                            size="sm"
                            icon={<EditIcon />}
                            aria-label="수정"
                            onClick={() => handleEdit(selectedItem)}
                          />
                        </Tooltip>
                        <Tooltip label="삭제">
                          <IconButton
                            size="sm"
                            icon={<DeleteIcon />}
                            aria-label="삭제"
                            colorScheme="red"
                            onClick={() => handleDelete(selectedItem)}
                          />
                        </Tooltip>
                      </>
                    )}
                  </HStack>
                </HStack>

                {/* 댓글 섹션 */}
                <VStack spacing={{ base: 1, md: 2 }} align="stretch">
                  <Text fontSize={{ base: "xs", md: "sm" }} fontWeight="bold" color="gray.700">
                    댓글
                  </Text>
                  
                  {/* 기존 댓글 */}
                  <VStack spacing={1} align="stretch" maxH="120px" overflowY="auto">
                    {selectedItem.commentsList.map((comment: any, index: number) => (
                      <Box key={comment.id} p={{ base: 1, md: 1.5 }} bg="gray.50" borderRadius="md">
                        {editingCommentIndex === index ? (
                          // 수정 모드
                          <VStack spacing={2} align="stretch">
                            <Input
                              value={editCommentText}
                              onChange={(e) => setEditCommentText(e.target.value)}
                              size="sm"
                              h="24px"
                            />
                            <Flex gap={2} justify="flex-end">
                              <Button
                                size="xs"
                                colorScheme="blue"
                                onClick={() => handleSaveEditComment(index)}
                                h="20px"
                              >
                                저장
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => setEditingCommentIndex(null)}
                                h="20px"
                              >
                                취소
                              </Button>
                            </Flex>
            </VStack>
                        ) : (
                          // 일반 표시 모드
                          <Flex justify="space-between" align="center">
                            <Text fontSize={{ base: "2xs", md: "xs" }} color="gray.600" flex="1">
                              {comment.text}
                            </Text>
                            <Flex align="center" gap={2} flexShrink={0}>
                              <Text fontSize={{ base: "2xs", md: "xs" }} fontWeight="medium" color="gray.700">
                                {comment.author}
                              </Text>
                              <Text fontSize={{ base: "2xs", md: "xs" }} color="gray.500">
                                {comment.date}
                              </Text>
                              {user && comment.author === user.name && (
                                <Flex gap={1}>
                                  <IconButton
                                    aria-label="댓글 수정"
                                    icon={<EditIcon />}
                                    size="xs"
                                    variant="ghost"
                                    colorScheme="blue"
                                    onClick={() => handleEditComment(index)}
                                    h="20px"
                                    w="20px"
                                  />
                                  <IconButton
                                    aria-label="댓글 삭제"
                                    icon={<DeleteIcon />}
                                    size="xs"
                                    variant="ghost"
                                    colorScheme="red"
                                    onClick={() => handleDeleteComment(index)}
                                    h="20px"
                                    w="20px"
                                  />
                                </Flex>
                              )}
                            </Flex>
                          </Flex>
                        )}
                      </Box>
                    ))}
                  </VStack>

                  {/* 댓글 입력 */}
                  {user && (
                    <Flex gap={2} direction={{ base: 'column', sm: 'row' }}>
                      <Input
                        placeholder="댓글을 입력하세요..."
                        size={{ base: "xs", md: "sm" }}
                        flex="1"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            addComment(selectedItem.id);
                          }
                        }}
                        h={{ base: "24px", md: "28px" }}
                      />
                      <IconButton
                        aria-label="댓글 작성"
                        icon={<ArrowUpIcon />}
                        size={{ base: "xs", md: "sm" }}
                        colorScheme="blue"
                        onClick={() => addComment(selectedItem.id)}
                        isDisabled={!commentText.trim()}
                        w={{ base: "100%", sm: "auto" }}
                        h={{ base: "24px", md: "28px" }}
                      />
                    </Flex>
                  )}
                </VStack>
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* 편집 모달 */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>사진 정보 수정</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {editingItem && (
              <VStack spacing={4}>
                {/* 사진 미리보기 */}
                <Image 
                  src={editingItem.src} 
                  alt="편집할 사진" 
                  w="full" 
                  maxH="200px"
                  objectFit="contain"
                  borderRadius="lg"
                />

                {/* 날짜 선택 */}
                <Box w="full">
                  <Text fontSize="sm" color="gray.600" mb={2}>날짜</Text>
                  <Input
                    type="date"
                    value={editingItem.date ? editingItem.date.split('.').slice(0, 3).join('-') : ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        const date = new Date(e.target.value);
                        const formattedDate = date.toLocaleDateString('ko-KR', { 
                          year: 'numeric', 
                          month: '2-digit', 
                          day: '2-digit', 
                          weekday: 'short' 
                        });
                        setEditingItem({
                          ...editingItem,
                          date: formattedDate,
                          description: formattedDate
                        });
                      }
                    }}
                    placeholder="날짜 선택"
                  />
                  {editingItem.date && (
                    <VStack spacing={1} mt={1}>
                      <Text fontSize="sm" color="blue.600">
                        현재 날짜: {editingItem.date}
                      </Text>
                      {editingItem.originalDate && editingItem.originalDate !== editingItem.date && (
                        <Text fontSize="sm" color="orange.600">
                          수정 날짜: {editingItem.date}
                        </Text>
                      )}
                    </VStack>
                  )}
                </Box>

                {/* 이벤트 타입 수정 */}
                <Box w="full">
                  <Text fontSize="sm" color="gray.600" mb={2}>이벤트 타입</Text>
                  <HStack spacing={2} flexWrap="wrap">
                    {eventTypes.map(type => (
                      <Button
                        key={type.value}
                        size="sm"
                        variant={editingItem.eventType === type.label ? 'solid' : 'outline'}
                        colorScheme="blue"
                        onClick={() => setEditingItem({
                          ...editingItem,
                          eventType: editingItem.eventType === type.label ? '기타' : type.label
                        })}
                      >
                        {type.label}
                      </Button>
                    ))}
                  </HStack>
                </Box>

                {/* 저장 버튼 */}
                <Button
                  colorScheme="blue"
                  w="full"
                  onClick={handleSaveEdit}
                >
                  저장
                </Button>
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* 다운로드 모달 */}
      <Modal isOpen={isDownloadModalOpen} onClose={() => setIsDownloadModalOpen(false)} size="xl">
        <ModalOverlay />
        <ModalContent maxH="90vh" display="flex" flexDirection="column">
          <ModalHeader flexShrink={0}>
            <HStack>
              <Text>📸</Text>
              <Text>사진 선택 다운로드</Text>
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6} flex="1" display="flex" minH="0">
            {downloadItem && (
                            <VStack spacing={4} h="full">
                {/* 상단 고정 영역 */}
                <HStack spacing={4} w="full" justify="space-between" bg="gray.50" p={3} borderRadius="md" flexShrink={0}>
                  <Text fontSize="sm" color="gray.600">
                    다운로드할 사진을 선택하세요 (최대 10장)
                  </Text>
                  
                  <HStack spacing={2} align="center">
                    <Text fontSize="sm" color="gray.600" fontWeight="bold">
                      선택된 사진: {selectedPhotos.length}장
                    </Text>
                    <IconButton
                      icon={<DownloadIcon />}
                      aria-label="다운로드"
                      colorScheme="blue"
                      onClick={handleSelectiveDownload}
                      isDisabled={selectedPhotos.length === 0}
                      size="sm"
                    />
                  </HStack>
                </HStack>

                {/* 스크롤 가능한 사진 영역 */}
                <Box 
                  flex="1"
                  maxH="50vh" 
                  overflowY="auto" 
                  overflowX="hidden"
                  w="full"
                  style={{ 
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#CBD5E0 #F7FAFC'
                  }}
                >
                  <SimpleGrid columns={3} spacing={4} w="full">
                    {downloadItem.groupPhotos.map((photo: any, index: number) => (
                      <Box
                        key={photo.id}
                        position="relative"
                        cursor="pointer"
                        onClick={() => togglePhotoSelection(index)}
                      >
                        <Image
                          src={photo.thumbnail}
                          alt={`사진 ${index + 1}`}
                          w="full"
                          h="120px"
                          objectFit="cover"
                          borderRadius="md"
                          border={selectedPhotos.includes(index) ? "3px solid" : "1px solid"}
                          borderColor={selectedPhotos.includes(index) ? "blue.500" : "gray.200"}
                        />
                        {selectedPhotos.includes(index) && (
                          <Box
                            position="absolute"
                            top={2}
                            right={2}
                            bg="blue.500"
                            color="white"
                            borderRadius="full"
                            w="24px"
                            h="24px"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            fontSize="sm"
                            fontWeight="bold"
                          >
                            {selectedPhotos.indexOf(index) + 1}
                          </Box>
                        )}
          </Box>
        ))}
      </SimpleGrid>
                </Box>
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* 사진 추가 모달 */}
      <Modal isOpen={isAddPhotoModalOpen} onClose={() => setIsAddPhotoModalOpen(false)} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            <HStack>
              <Text>📸</Text>
              <Text>사진 추가</Text>
            </HStack>
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4}>
              {/* 사진 파일 선택 */}
              <Box w="full">
                <Text fontSize="sm" fontWeight="bold" mb={2}>
                  사진 파일 선택
                </Text>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleAddPhotoFileSelect}
                  ref={addPhotoFileInputRef}
                />
                <Text fontSize="xs" color="gray.500" mt={1}>
                  지원 형식: JPG, PNG, GIF, WEBP
                </Text>
              </Box>

              {/* 이벤트 타입 선택 */}
              <Box w="full">
                <Text fontSize="sm" fontWeight="bold" mb={2}>
                  이벤트 타입 선택
                </Text>
                <HStack spacing={2} wrap="wrap">
                  {[
                    { value: '매치', label: '매치' },
                    { value: '자체', label: '자체' },
                    { value: '회식', label: '회식' },
                    { value: '기타', label: '기타' }
                  ].map((type) => (
                    <Button
                      key={type.value}
                      size="sm"
                      variant={addPhotoEventType === type.value ? "solid" : "outline"}
                      colorScheme={addPhotoEventType === type.value ? "blue" : "gray"}
                      onClick={() => setAddPhotoEventType(addPhotoEventType === type.value ? '' : type.value)}
                    >
                      {type.label}
                    </Button>
                  ))}
                </HStack>
              </Box>

              {/* 선택된 파일 미리보기 */}
              {addPhotoFiles.length > 0 && (
                <Box w="full">
                  <Text fontSize="sm" fontWeight="bold" mb={2}>
                    선택된 파일 ({addPhotoFiles.length}개)
                  </Text>
                  <SimpleGrid columns={3} spacing={2}>
                    {addPhotoFiles.map((file, index) => (
                      <Box key={index} p={2} border="1px solid" borderColor="gray.200" borderRadius="md">
                        <Text fontSize="xs" noOfLines={1}>
                          {file.name}
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </Text>
                      </Box>
                    ))}
                  </SimpleGrid>
                </Box>
              )}

              {/* 업로드 버튼 */}
              <Button
                colorScheme="blue"
                w="full"
                onClick={handleAddPhotoUpload}
                isDisabled={addPhotoFiles.length === 0}
                isLoading={isProcessing}
              >
                사진 추가
              </Button>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
} 