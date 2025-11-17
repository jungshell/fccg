import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  IconButton,
  HStack,
  VStack,
  Text,
  Alert,
  AlertIcon,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  Select,
  useToast
} from '@chakra-ui/react';
import { AddIcon, EditIcon, DeleteIcon } from '@chakra-ui/icons';

interface ThisWeekSchedule {
  id: number;
  date: string;
  event: string;
  description?: string;
  createdById: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: number;
    name: string;
  };
}

interface ThisWeekScheduleManagementProps {
  schedules: ThisWeekSchedule[];
  onSchedulesChange: (schedules: ThisWeekSchedule[]) => void;
}

export default function ThisWeekScheduleManagement({ schedules, onSchedulesChange }: ThisWeekScheduleManagementProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [editingSchedule, setEditingSchedule] = useState<ThisWeekSchedule | null>(null);
  const [formData, setFormData] = useState({
    date: '',
    event: '',
    description: ''
  });
  const toast = useToast();

  const handleAddSchedule = () => {
    setEditingSchedule(null);
    setFormData({
      date: '',
      event: '',
      description: ''
    });
    onOpen();
  };

  const handleEditSchedule = (schedule: ThisWeekSchedule) => {
    setEditingSchedule(schedule);
    setFormData({
      date: schedule.date,
      event: schedule.event,
      description: schedule.description || ''
    });
    onOpen();
  };

  const handleDeleteSchedule = (id: number) => {
    const updatedSchedules = schedules.filter(schedule => schedule.id !== id);
    onSchedulesChange(updatedSchedules);
    toast({
      title: '일정 삭제 완료',
      description: '일정이 삭제되었습니다.',
      status: 'success',
      duration: 2000,
      isClosable: true,
    });
  };

  const handleSubmit = () => {
    if (!formData.date || !formData.event) {
      toast({
        title: '입력 오류',
        description: '날짜와 일정을 모두 입력해주세요.',
        status: 'error',
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    if (editingSchedule) {
      // 일정 수정
      const updatedSchedules = schedules.map(schedule =>
        schedule.id === editingSchedule.id
          ? { ...schedule, ...formData }
          : schedule
      );
      onSchedulesChange(updatedSchedules);
      toast({
        title: '일정 수정 완료',
        description: '일정 정보가 수정되었습니다.',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    } else {
      // 새 일정 추가
      const newSchedule: ThisWeekSchedule = {
        id: Math.max(...schedules.map(s => s.id), 0) + 1,
        ...formData,
        createdById: 1, // 현재 사용자 ID
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: { id: 1, name: '정성인' }
      };
      onSchedulesChange([...schedules, newSchedule]);
      toast({
        title: '일정 추가 완료',
        description: '새 일정이 추가되었습니다.',
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
    }

    onClose();
  };

  const getDayOfWeek = (dateString: string) => {
    const date = new Date(dateString);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return days[date.getDay()];
  };

  return (
    <>
      <VStack spacing={6} align="stretch">
        <HStack justify="space-between">
          <VStack align="start" spacing={2}>
            <Text fontSize="2xl" fontWeight="bold">이번주 일정</Text>
            <Text>이번주 일정을 관리할 수 있습니다.</Text>
          </VStack>
          <Button 
            colorScheme="blue" 
            leftIcon={<AddIcon />}
            onClick={handleAddSchedule}
          >
            + 일정 추가
          </Button>
        </HStack>
        
        <Card>
          <CardBody>
            {schedules.length === 0 ? (
              <Alert status="info">
                <AlertIcon />
                등록된 일정이 없습니다.
              </Alert>
            ) : (
              <Table variant="simple">
                <Thead>
                  <Tr>
                    <Th>날짜</Th>
                    <Th>요일</Th>
                    <Th>일정</Th>
                    <Th>설명</Th>
                    <Th>생성자</Th>
                    <Th>작업</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {schedules.map((schedule) => (
                    <Tr key={schedule.id}>
                      <Td>{new Date(schedule.date).toLocaleDateString('ko-KR')}</Td>
                      <Td>
                        <Badge colorScheme="blue">
                          {getDayOfWeek(schedule.date)}
                        </Badge>
                      </Td>
                      <Td>{schedule.event}</Td>
                      <Td>{schedule.description || '-'}</Td>
                      <Td>{schedule.createdBy?.name || '알 수 없음'}</Td>
                      <Td>
                        <HStack spacing={2}>
                          <IconButton
                            aria-label="일정 수정"
                            icon={<EditIcon />}
                            size="sm"
                            colorScheme="blue"
                            onClick={() => handleEditSchedule(schedule)}
                          />
                          <IconButton
                            aria-label="일정 삭제"
                            icon={<DeleteIcon />}
                            size="sm"
                            colorScheme="red"
                            onClick={() => handleDeleteSchedule(schedule.id)}
                          />
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </VStack>

      {/* 일정 추가/수정 모달 */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {editingSchedule ? '일정 수정' : '일정 추가'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel>날짜</FormLabel>
                <Input
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  type="date"
                />
              </FormControl>
              
              <FormControl>
                <FormLabel>일정</FormLabel>
                <Input
                  value={formData.event}
                  onChange={(e) => setFormData({ ...formData, event: e.target.value })}
                  placeholder="일정 내용"
                />
              </FormControl>
              
              <FormControl>
                <FormLabel>설명</FormLabel>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="일정 설명 (선택사항)"
                />
              </FormControl>
              
              <HStack spacing={3} w="100%">
                <Button colorScheme="blue" onClick={handleSubmit} flex={1}>
                  {editingSchedule ? '수정' : '추가'}
                </Button>
                <Button onClick={onClose} flex={1}>
                  취소
                </Button>
              </HStack>
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
