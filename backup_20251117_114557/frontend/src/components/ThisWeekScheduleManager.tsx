import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  VStack,
  HStack,
  Text,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  FormControl,
  FormLabel,
  Input,
  Select,
  Textarea,
  useToast,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IconButton,
  Badge,
  Alert,
  AlertIcon,
  InputGroup,
  InputRightElement,
  Spinner
} from '@chakra-ui/react';
import { AddIcon, EditIcon, DeleteIcon, SearchIcon } from '@chakra-ui/icons';
import {
  createThisWeekSchedule,
  getThisWeekSchedules,
  updateThisWeekSchedule,
  deleteThisWeekSchedule,
  searchLocation,
  type ThisWeekSchedule,
  type LocationSearchResult
} from '../api/auth';

interface ThisWeekScheduleManagerProps {
  userRole: 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER';
}

export default function ThisWeekScheduleManager({ userRole }: ThisWeekScheduleManagerProps) {
  const [schedules, setSchedules] = useState<ThisWeekSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [locationSearchResults, setLocationSearchResults] = useState<LocationSearchResult[]>([]);
  const [isLocationSearching, setIsLocationSearching] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null);
  
  const { isOpen: isModalOpen, onOpen: onModalOpen, onClose: onModalClose } = useDisclosure();
  const { isOpen: isLocationModalOpen, onOpen: onLocationModalOpen, onClose: onLocationModalClose } = useDisclosure();
  
  const [formData, setFormData] = useState({
    eventType: 'MATCH' as 'MATCH' | 'SELF' | 'TRAINING' | 'MEETING' | 'OTHER',
    dateTime: '',
    location: '',
    attendees: [] as string[],
    description: '',
    maxAttendees: undefined as number | undefined
  });
  
  const [locationSearchQuery, setLocationSearchQuery] = useState('');
  const toast = useToast();

  // 권한 체크
  const hasPermission = () => {
    return userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
  };

  // 일정 목록 로드
  const loadSchedules = async () => {
    try {
      setLoading(true);
      const response = await getThisWeekSchedules();
      setSchedules(response.schedules);
    } catch (error) {
      console.error('일정 로드 오류:', error);
      toast({
        title: '일정 로드 실패',
        description: '일정을 불러오는 중 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // 장소 검색
  const handleLocationSearch = async (query: string) => {
    if (!query.trim()) return;
    
    try {
      setIsLocationSearching(true);
      const response = await searchLocation(query);
      setLocationSearchResults(response.documents);
      onLocationModalOpen();
    } catch (error) {
      console.error('장소 검색 오류:', error);
      toast({
        title: '장소 검색 실패',
        description: '장소를 검색하는 중 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsLocationSearching(false);
    }
  };

  // 일정 제출
  const handleSubmit = async () => {
    if (!formData.dateTime || !formData.location) {
      toast({
        title: '입력 오류',
        description: '일시와 장소를 입력해주세요.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      if (editingScheduleId) {
        await updateThisWeekSchedule(editingScheduleId, formData);
        toast({
          title: '일정 수정 완료',
          description: '일정이 성공적으로 수정되었습니다.',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        await createThisWeekSchedule(formData);
        toast({
          title: '일정 등록 완료',
          description: '일정이 성공적으로 등록되었습니다.',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      }
      
      onModalClose();
      resetForm();
      loadSchedules();
    } catch (error) {
      console.error('일정 제출 오류:', error);
      toast({
        title: '일정 제출 실패',
        description: '일정 제출 중 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // 일정 삭제
  const handleDelete = async (id: number) => {
    if (!confirm('정말로 이 일정을 삭제하시겠습니까?')) return;

    try {
      await deleteThisWeekSchedule(id);
      toast({
        title: '일정 삭제 완료',
        description: '일정이 성공적으로 삭제되었습니다.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      loadSchedules();
    } catch (error) {
      console.error('일정 삭제 오류:', error);
      toast({
        title: '일정 삭제 실패',
        description: '일정 삭제 중 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // 일정 수정 모달 열기
  const handleEdit = (schedule: ThisWeekSchedule) => {
    setFormData({
      eventType: schedule.eventType,
      dateTime: schedule.dateTime.slice(0, 16), // ISO 문자열을 datetime-local 형식으로 변환
      location: schedule.location,
      attendees: JSON.parse(schedule.attendees || '[]'),
      description: schedule.description || '',
      maxAttendees: schedule.maxAttendees || undefined
    });
    setEditingScheduleId(schedule.id);
    onModalOpen();
  };

  // 새 일정 추가 모달 열기
  const handleAdd = () => {
    resetForm();
    setEditingScheduleId(null);
    onModalOpen();
  };

  // 폼 초기화
  const resetForm = () => {
    setFormData({
      eventType: 'MATCH',
      dateTime: '',
      location: '',
      attendees: [],
      description: '',
      maxAttendees: undefined
    });
  };

  // 장소 선택
  const handleLocationSelect = (location: LocationSearchResult) => {
    setFormData(prev => ({
      ...prev,
      location: location.place_name
    }));
    onLocationModalClose();
  };

  // 참석자 추가
  const handleAddAttendee = () => {
    const newAttendee = prompt('참석자 이름을 입력하세요:');
    if (newAttendee && newAttendee.trim()) {
      setFormData(prev => ({
        ...prev,
        attendees: [...prev.attendees, newAttendee.trim()]
      }));
    }
  };

  // 참석자 제거
  const handleRemoveAttendee = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attendees: prev.attendees.filter((_, i) => i !== index)
    }));
  };

  // 이벤트 타입별 색상
  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'MATCH': return 'blue';
      case 'SELF': return 'green';
      case 'TRAINING': return 'orange';
      case 'MEETING': return 'purple';
      case 'OTHER': return 'gray';
      default: return 'gray';
    }
  };

  // 이벤트 타입별 한글명
  const getEventTypeName = (type: string) => {
    switch (type) {
      case 'MATCH': return '매치';
      case 'SELF': return '자체';
      case 'TRAINING': return '훈련';
      case 'MEETING': return '회의';
      case 'OTHER': return '기타';
      default: return type;
    }
  };

  useEffect(() => {
    loadSchedules();
  }, []);

  if (!hasPermission()) {
    return (
      <Alert status="warning">
        <AlertIcon />
        관리자 권한이 필요합니다.
      </Alert>
    );
  }

  return (
    <Box>
      {/* 헤더 */}
      <HStack justify="space-between" mb={4}>
        <Text fontSize="xl" fontWeight="bold">이번주 일정 수동 입력</Text>
        <Button
          leftIcon={<AddIcon />}
          colorScheme="blue"
          onClick={handleAdd}
        >
          새 일정 추가
        </Button>
      </HStack>

      {/* 일정 목록 */}
      {loading ? (
        <Box textAlign="center" py={8}>
          <Spinner size="lg" />
        </Box>
      ) : (
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>유형</Th>
              <Th>일시</Th>
              <Th>장소</Th>
              <Th>참석자</Th>
              <Th>설명</Th>
              <Th>작성자</Th>
              <Th>작업</Th>
            </Tr>
          </Thead>
          <Tbody>
            {schedules.map((schedule) => (
              <Tr key={schedule.id}>
                <Td>
                  <Badge colorScheme={getEventTypeColor(schedule.eventType)}>
                    {getEventTypeName(schedule.eventType)}
                  </Badge>
                </Td>
                <Td>
                  {new Date(schedule.dateTime).toLocaleString('ko-KR')}
                </Td>
                <Td>{schedule.location}</Td>
                <Td>
                  {JSON.parse(schedule.attendees || '[]').length}명
                  {schedule.maxAttendees && ` / ${schedule.maxAttendees}명`}
                </Td>
                <Td>{schedule.description || '-'}</Td>
                <Td>{schedule.createdByUser?.name || '-'}</Td>
                <Td>
                  <HStack spacing={2}>
                    <IconButton
                      aria-label="수정"
                      icon={<EditIcon />}
                      size="sm"
                      onClick={() => handleEdit(schedule)}
                    />
                    <IconButton
                      aria-label="삭제"
                      icon={<DeleteIcon />}
                      size="sm"
                      colorScheme="red"
                      onClick={() => handleDelete(schedule.id)}
                    />
                  </HStack>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {/* 일정 추가/수정 모달 */}
      <Modal isOpen={isModalOpen} onClose={onModalClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {editingScheduleId ? '일정 수정' : '새 일정 추가'}
          </ModalHeader>
          <ModalBody>
            <VStack spacing={4}>
              {/* 유형 */}
              <FormControl>
                <FormLabel>유형</FormLabel>
                <Select
                  value={formData.eventType}
                  onChange={(e) => setFormData(prev => ({ ...prev, eventType: e.target.value as any }))}
                >
                  <option value="MATCH">매치</option>
                  <option value="SELF">자체</option>
                  <option value="TRAINING">훈련</option>
                  <option value="MEETING">회의</option>
                  <option value="OTHER">기타</option>
                </Select>
              </FormControl>

              {/* 일시 */}
              <FormControl>
                <FormLabel>일시</FormLabel>
                <Input
                  type="datetime-local"
                  value={formData.dateTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, dateTime: e.target.value }))}
                />
              </FormControl>

              {/* 장소 */}
              <FormControl>
                <FormLabel>장소</FormLabel>
                <InputGroup>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="장소를 입력하거나 검색하세요"
                  />
                  <InputRightElement>
                    <IconButton
                      aria-label="장소 검색"
                      icon={<SearchIcon />}
                      size="sm"
                      onClick={() => handleLocationSearch(formData.location)}
                    />
                  </InputRightElement>
                </InputGroup>
              </FormControl>

              {/* 참석자 */}
              <FormControl>
                <FormLabel>참석자</FormLabel>
                <VStack spacing={2} align="stretch">
                  <Button size="sm" onClick={handleAddAttendee}>
                    참석자 추가
                  </Button>
                  {formData.attendees.map((attendee, index) => (
                    <HStack key={index}>
                      <Text flex={1}>{attendee}</Text>
                      <IconButton
                        aria-label="제거"
                        icon={<DeleteIcon />}
                        size="sm"
                        onClick={() => handleRemoveAttendee(index)}
                      />
                    </HStack>
                  ))}
                </VStack>
              </FormControl>

              {/* 최대 참석자 수 */}
              <FormControl>
                <FormLabel>최대 참석자 수 (선택사항)</FormLabel>
                <Input
                  type="number"
                  value={formData.maxAttendees || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    maxAttendees: e.target.value ? parseInt(e.target.value) : undefined 
                  }))}
                  placeholder="제한 없음"
                />
              </FormControl>

              {/* 설명 */}
              <FormControl>
                <FormLabel>설명 (선택사항)</FormLabel>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="일정에 대한 설명을 입력하세요"
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onModalClose}>
              취소
            </Button>
            <Button colorScheme="blue" onClick={handleSubmit}>
              {editingScheduleId ? '수정' : '등록'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 장소 검색 모달 */}
      <Modal isOpen={isLocationModalOpen} onClose={onLocationModalClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>장소 검색</ModalHeader>
          <ModalBody>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel>검색어</FormLabel>
                <InputGroup>
                  <Input
                    value={locationSearchQuery}
                    onChange={(e) => setLocationSearchQuery(e.target.value)}
                    placeholder="장소를 검색하세요"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleLocationSearch(locationSearchQuery);
                      }
                    }}
                  />
                  <InputRightElement>
                    {isLocationSearching ? (
                      <Spinner size="sm" />
                    ) : (
                      <IconButton
                        aria-label="검색"
                        icon={<SearchIcon />}
                        size="sm"
                        onClick={() => handleLocationSearch(locationSearchQuery)}
                      />
                    )}
                  </InputRightElement>
                </InputGroup>
              </FormControl>

              <VStack spacing={2} align="stretch" maxH="300px" overflowY="auto">
                {locationSearchResults.map((result) => (
                  <Box
                    key={result.id}
                    p={3}
                    border="1px"
                    borderColor="gray.200"
                    borderRadius="md"
                    cursor="pointer"
                    _hover={{ bg: 'gray.50' }}
                    onClick={() => handleLocationSelect(result)}
                  >
                    <Text fontWeight="bold">{result.place_name}</Text>
                    <Text fontSize="sm" color="gray.600">
                      {result.road_address_name || result.address_name}
                    </Text>
                    {result.phone && (
                      <Text fontSize="sm" color="gray.500">
                        {result.phone}
                      </Text>
                    )}
                  </Box>
                ))}
              </VStack>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onLocationModalClose}>닫기</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
