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
  useToast,
  Divider,
  Textarea,
  Select,
  Tooltip
} from '@chakra-ui/react';
import { 
  useState, 
  useEffect,
  useMemo,
  useCallback
} from 'react';
import { 
  ExternalLinkIcon,
  PlusSquareIcon,
  EditIcon,
  DeleteIcon,
  ArrowUpIcon
} from '@chakra-ui/icons';
import { useAuthStore } from '../store/auth';

// YouTube API 설정
const YT_API_KEY = 'AIzaSyC7M5KrtdL8ChfVCX0M2CZfg7GWGaExMTk';
const PLAYLIST_ID = 'PLQ5o2f7efzlZ-RDG64h4Oj_5pXt0g6q3b';

export default function VideoGalleryPage() {
  const { user } = useAuthStore();
  const [sort, setSort] = useState('latest');
  const [items, setItems] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingCommentIndex, setEditingCommentIndex] = useState<number | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [newComment, setNewComment] = useState('');
  const toast = useToast();

  const saveItemsToStorage = useCallback((list: any[]) => {
    try {
      localStorage.setItem('videoItems', JSON.stringify(list));
    } catch (e) {
      console.error('동영상 저장 실패:', e);
    }
  }, []);

  // 초기 로드: localStorage 우선, 없으면 YouTube에서 생성
  useEffect(() => {
    const stored = localStorage.getItem('videoItems');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setItems(parsed);
          return;
        }
      } catch {}
    }

    fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${PLAYLIST_ID}&key=${YT_API_KEY}`)
      .then(res => res.json())
      .then((data: { items?: { snippet: { resourceId: { videoId: string }, title: string, publishedAt: string } }[] }) => {
        if (data.items && data.items.length > 0) {
          const videoItems = data.items
            .filter(item => {
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
                eventType = '자체';
              }
              
              return {
                id: `video_${index + 1}`,
                type: 'video',
                videoId: item.snippet.resourceId.videoId,
                title: item.snippet.title,
                date: formattedDate,
                author: 'tony jung',
                likes: 0,
                comments: 0,
                badge: eventBadge,
                label: '동영상',
                tags: ['경기', '하이라이트'],
                description: item.snippet.title,
                eventType: eventType,
                thumbnail: `https://img.youtube.com/vi/${item.snippet.resourceId.videoId}/maxresdefault.jpg`,
                isLiked: false,
                commentsList: []
              };
            });
          
          setItems(videoItems);
          saveItemsToStorage(videoItems);
        }
      })
      .catch((error) => {
        console.error('유튜브 API 오류:', error);
        toast({
          title: '오류',
          description: '동영상을 불러오는 중 오류가 발생했습니다.',
          status: 'error',
          duration: 3000,
        });
      });
  }, [toast, saveItemsToStorage]);

  // 정렬된 아이템들
  const sortedItems = useMemo(() => {
    let sorted = [...items];
    
    switch (sort) {
      case 'latest':
        sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        break;
      case 'oldest':
        sorted.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        break;
      case 'likes':
        sorted.sort((a, b) => b.likes - a.likes);
        break;
      case 'comments':
        sorted.sort((a, b) => b.comments - a.comments);
        break;
    }
    
    return sorted;
  }, [items, sort]);

  // 아이템 클릭 처리
  const handleItemClick = useCallback((item: any) => {
    setSelectedItem(item);
    setIsDetailModalOpen(true);
  }, []);

  // 좋아요 토글
  const handleLikeToggle = useCallback((item: any) => {
    const updatedItems = items.map(i => {
      if (i.id === item.id) {
        return {
          ...i,
          isLiked: !i.isLiked,
          likes: i.isLiked ? i.likes - 1 : i.likes + 1
        };
      }
      return i;
    });
    
    setItems(updatedItems);
    try { localStorage.setItem('videoItems', JSON.stringify(updatedItems)); } catch {}
    
    if (selectedItem && selectedItem.id === item.id) {
      setSelectedItem(updatedItems.find(i => i.id === item.id));
    }
  }, [items, selectedItem]);

  // 댓글 추가
  const handleAddComment = useCallback((text: string) => {
    if (!user || !selectedItem || !text.trim()) return;

    const newComment = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      author: user.name,
      text: text.trim(),
      createdAt: new Date().toISOString()
    };

    const updatedItems = items.map(item => {
      if (item.id === selectedItem.id) {
        return {
          ...item,
          comments: item.comments + 1,
          commentsList: [...item.commentsList, newComment]
        };
      }
      return item;
    });

    setItems(updatedItems);
    try { localStorage.setItem('videoItems', JSON.stringify(updatedItems)); } catch {}
    
    const updatedSelectedItem = updatedItems.find(item => item.id === selectedItem.id);
    setSelectedItem(updatedSelectedItem);
  }, [user, selectedItem, items]);

  // 댓글 편집
  const handleEditComment = useCallback((commentIndex: number, newText: string) => {
    if (!selectedItem || !newText.trim()) return;

    const updatedComments = [...selectedItem.commentsList];
    updatedComments[commentIndex] = {
      ...updatedComments[commentIndex],
      text: newText.trim()
    };

    const updatedItems = items.map(item => {
      if (item.id === selectedItem.id) {
        return {
          ...item,
          commentsList: updatedComments
        };
      }
      return item;
    });

    setItems(updatedItems);
    try { localStorage.setItem('videoItems', JSON.stringify(updatedItems)); } catch {}
    
    const updatedSelectedItem = updatedItems.find(item => item.id === selectedItem.id);
    setSelectedItem(updatedSelectedItem);
    setEditingCommentIndex(null);
    setEditCommentText('');
  }, [selectedItem, items]);

  // 댓글 삭제
  const handleDeleteComment = useCallback((commentIndex: number) => {
    if (!selectedItem) return;

    const updatedComments = selectedItem.commentsList.filter((_: any, index: number) => index !== commentIndex);

    const updatedItems = items.map(item => {
      if (item.id === selectedItem.id) {
        return {
          ...item,
          comments: item.comments - 1,
          commentsList: updatedComments
        };
      }
      return item;
    });

    setItems(updatedItems);
    
    const updatedSelectedItem = updatedItems.find(item => item.id === selectedItem.id);
    setSelectedItem(updatedSelectedItem);
  }, [selectedItem, items]);

  return (
    <Box minH="100vh" bg="#f7f9fb" w="100vw" minW="100vw" pt="18mm">
      {/* 상단 컨트롤 영역 */}
      <Box px={{ base: 1, md: 4, lg: 12 }} py={6}>
        <Flex direction={{ base: 'column', md: 'row' }} gap={4} align={{ base: 'stretch', md: 'center' }} justify="space-between" mb={1.5}>
          {/* 필터 탭 */}
          <HStack spacing={2} flexWrap="wrap">
            
          </HStack>

          {/* 정렬 및 업로드 */}
          <HStack spacing={2}>
            <Select size="sm" value={sort} onChange={(e) => setSort(e.target.value)} w="100px">
              <option value="latest">최신순</option>
              <option value="oldest">오래된순</option>
              <option value="likes">좋아요순</option>
              <option value="comments">댓글순</option>
            </Select>

          </HStack>
        </Flex>
      </Box>

      {/* 갤러리 그리드 */}
      <Box px={{ base: 1, md: 4, lg: 12 }} pb={10}>
        <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={6}>
          {sortedItems.map((item) => (
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
              onClick={() => handleItemClick(item)}
            >
              {/* 썸네일/라벨/뱃지 */}
              <Box position="relative">
                <Image 
                  src={item.thumbnail} 
                  alt={item.label} 
                  w="100%" 
                  h="200px" 
                  objectFit="cover" 
                />

              </Box>

              {/* 정보 영역 */}
              <VStack align="stretch" spacing={1} p={3}>
                {/* 제목과 뱃지 */}
                <Flex justify="space-between" align="center">
                  <Text fontSize="sm" color="black" fontWeight="bold" noOfLines={2} flex={1} mr={2}>
                    {item.description || item.date}
                  </Text>
                  {item.badge ? (
                    <Badge 
                      colorScheme={item.badge === '매치' ? 'blue' : 'green'} 
                      fontSize="xs" 
                      px={1.5} 
                      py={0.3}
                      borderRadius="sm"
                      flexShrink={0}
                    >
                      {item.badge}
                    </Badge>
                  ) : null}
                </Flex>
                
                {/* 작성자와 좋아요/댓글 */}
                <Flex justify="space-between" align="center">
                  <Text fontSize="xs" color="gray.500">작성자: {item.author}</Text>
                  <HStack spacing={2}>
                    <HStack 
                      spacing={1} 
                      cursor="pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLikeToggle(item);
                      }}
                    >
                      <Text fontSize="sm" color={item.isLiked ? 'red.500' : 'gray.400'}>♡</Text>
                      <Text fontSize="sm">{item.likes}</Text>
                    </HStack>
                    <HStack spacing={1}>
                      <Text fontSize="sm">💬</Text>
                      <Text fontSize="sm">{item.comments}</Text>
                    </HStack>
                  </HStack>
                </Flex>
              </VStack>
            </Box>
          ))}
        </SimpleGrid>
      </Box>

      {/* 상세 모달 */}
      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} size="3xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>동영상 상세보기</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {selectedItem && (
              <VStack spacing={4}>
                <Box position="relative" w="full">
                  <Box
                    as="iframe"
                    src={`https://www.youtube.com/embed/${selectedItem.videoId}?autoplay=1&controls=1&modestbranding=1&rel=0`}
                    w="100%"
                    h="450px"
                    borderRadius="md"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </Box>

                <VStack spacing={3} w="full">
                  {/* 1행: 왼쪽 제목, 오른쪽 업로더명/좋아요/댓글 */}
                  <Flex justify="space-between" align="center" w="full" gap={4}>
                    <Text fontSize="md" fontWeight="bold" noOfLines={2} flex={1}>{selectedItem.title}</Text>
                    <HStack spacing={4} flexShrink={0}>
                      <Text fontSize="sm" color="gray.600">{selectedItem.author}</Text>
                      <HStack spacing={1} cursor="pointer" onClick={() => handleLikeToggle(selectedItem)}>
                        <Text fontSize="lg" color={selectedItem.isLiked ? 'red.500' : 'gray.400'}>♡</Text>
                        <Text fontSize="sm">{selectedItem.likes}</Text>
                      </HStack>
                      <HStack spacing={1}>
                        <Text fontSize="lg">💬</Text>
                        <Text fontSize="sm">{selectedItem.comments}</Text>
                      </HStack>
                    </HStack>
                  </Flex>

                  <Divider />

                  <VStack spacing={2} w="full" align="stretch">
                    {selectedItem.commentsList.map((comment: any, index: number) => (
                      <Box key={comment.id}>
                        {editingCommentIndex === index ? (
                          <VStack spacing={2} align="stretch">
                            <Textarea size="sm" value={editCommentText} onChange={(e) => setEditCommentText(e.target.value)} />
                            <HStack spacing={2}>
                              <Button size="xs" onClick={() => handleEditComment(index, editCommentText)}>저장</Button>
                              <Button size="xs" variant="outline" onClick={() => { setEditingCommentIndex(null); setEditCommentText(''); }}>취소</Button>
                            </HStack>
                          </VStack>
                        ) : (
                          <Flex justify="space-between" align="center">
                            <Text fontSize="sm" noOfLines={1}>{comment.text}</Text>
                            <HStack spacing={2} align="center">
                              <Text fontSize="xs" color="gray.600">{comment.author}</Text>
                              <Text fontSize="xs" color="gray.500">{/* 상대시간 */}{(() => {
                                const d=new Date(comment.createdAt||new Date());const now=new Date();const ms=now.getTime()-d.getTime();const m=Math.floor(ms/60000);const h=Math.floor(ms/3600000);const days=Math.floor(ms/86400000);if(m<1) return '방금 전'; if(m<60) return `${m}분 전`; if(h<24) return `${h}시간 전`; if(days===1) return '1일 전'; if(days<7) return `${days}일 전`; if(days<30) return `${Math.floor(days/7)}주 전`; if(days<365) return `${Math.floor(days/30)}개월 전`; return `${Math.floor(days/365)}년 전`;})()}</Text>
                              {(user?.name === comment.author || user?.role === 'SUPER_ADMIN') && (
                                <HStack spacing={1}>
                                  <IconButton aria-label="수정" size="xs" variant="ghost" icon={<EditIcon />} onClick={() => { setEditingCommentIndex(index); setEditCommentText(comment.text); }} />
                                  <IconButton aria-label="삭제" size="xs" variant="ghost" icon={<DeleteIcon />} onClick={() => handleDeleteComment(index)} />
                                </HStack>
                              )}
                            </HStack>
                          </Flex>
                        )}
                      </Box>
                    ))}

                    {/* 입력 */}
                    <HStack spacing={2} w="full">
                      <Input 
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="댓글을 입력하세요..."
                        onKeyDown={(e: any) => { if (e.key==='Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleAddComment(newComment); setNewComment(''); } }}
                        size="sm"
                        bg="gray.50"
                        borderRadius="md"
                      />
                      <IconButton size="sm" colorScheme="blue" aria-label="등록" icon={<ArrowUpIcon />} onClick={() => { handleAddComment(newComment); setNewComment(''); }} />
                    </HStack>
                  </VStack>
                </VStack>
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
}