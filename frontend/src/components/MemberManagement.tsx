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
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  Select,
  useToast,
  Flex,
  Heading,
  Divider,
  useColorModeValue,
  Tooltip
} from '@chakra-ui/react';
import { AddIcon, EditIcon, DeleteIcon, SearchIcon, ViewIcon, RepeatIcon } from '@chakra-ui/icons';
import { updateMember, deleteMember, resetMemberPassword } from '../api/auth';
import { useAuthStore } from '../store/auth';
import { eventBus, EVENT_TYPES, emitMemberAdded, emitDataRefreshNeeded, emitLoadingStart, emitLoadingEnd, emitAlert } from '../utils/eventBus';

interface Member {
  id: number;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'DELETED';
  createdAt?: string;
}

interface MemberManagementProps {
  userList: Member[];
  onUserListChange: (users: Member[]) => void;
}

export default function MemberManagement({ userList, onUserListChange }: MemberManagementProps) {
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [originalMemberData, setOriginalMemberData] = useState<Member | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  
  const { isOpen: isEditModalOpen, onOpen: onEditModalOpen, onClose: onEditModalClose } = useDisclosure();
  const { isOpen: isViewModalOpen, onOpen: onViewModalOpen, onClose: onViewModalClose } = useDisclosure();
  const { isOpen: isDeleteModalOpen, onOpen: onDeleteModalOpen, onClose: onDeleteModalClose } = useDisclosure();
  
  const toast = useToast();
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  
  // 전역 사용자 정보 업데이트를 위한 store
  const { user, setUser } = useAuthStore();

  // editingMember 상태 보존을 위한 useEffect
  React.useEffect(() => {
    // 모달이 열릴 때 원본 데이터가 있으면 복원
    if (isEditModalOpen && originalMemberData && !editingMember) {
      console.log('원본 데이터 복원:', originalMemberData);
      setEditingMember(originalMemberData);
    }
    
    // 컴포넌트가 리렌더링되어도 editingMember 상태 유지
    if (editingMember && !isEditModalOpen) {
      // 모달이 닫혀있어도 상태는 유지
      console.log('editingMember 상태 유지:', editingMember);
    }
  }, [editingMember, isEditModalOpen, originalMemberData]);

  // 검색 필터링
  React.useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredMembers(userList);
    } else {
      const filtered = userList.filter(member =>
        member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.role?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredMembers(filtered);
    }
  }, [searchTerm, userList]);

  // 회원 정보 수정
  const handleEditMember = (member: Member) => {
    console.log('수정할 회원 정보:', member);
    
    // 원본 데이터 백업 (깊은 복사)
    const originalData = {
      id: member.id,
      name: member.name || '',
      email: member.email || '',
      role: member.role || 'MEMBER',
      status: member.status || 'ACTIVE',
      createdAt: member.createdAt
    };
    
    setOriginalMemberData(originalData);
    
    // 모든 필드를 명시적으로 복사하여 이메일 정보가 누락되지 않도록 함
    setEditingMember({
      id: member.id,
      name: member.name || '',
      email: member.email || '', // 이메일 정보 명시적 복사
      role: member.role || 'MEMBER',
      status: member.status || 'ACTIVE',
      createdAt: member.createdAt
    });
    onEditModalOpen();
  };

  // 회원 정보 저장
  const handleSaveMember = async () => {
    if (!editingMember) return;

    try {
      if (editingMember.id === 0) {
        // 새 회원 추가 - 이메일 검증 강화
        if (!editingMember.email || !editingMember.email.trim()) {
          toast({
            title: '이메일 주소 필요',
            description: '이메일 주소를 입력해주세요.',
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
          return; // 모달 유지
        }

        // 이메일 형식 검증
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(editingMember.email)) {
          toast({
            title: '이메일 형식 오류',
            description: '올바른 이메일 형식을 입력해주세요.',
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
          return; // 모달 유지
        }

        // 백엔드 API 호출
        try {
          const response = await fetch('http://localhost:4000/api/auth/register', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name: editingMember.name,
              email: editingMember.email,
              password: 'password123',
              role: editingMember.role
            })
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '회원 추가 실패');
          }
          
          const result = await response.json();
          
          // 성공 메시지
          toast({
            title: '회원 추가 완료',
            description: '새 회원이 추가되었습니다.',
            status: 'success',
            duration: 2000,
            isClosable: true,
          });
          
          // 모달 닫기 및 상태 초기화
          onEditModalClose();
          setEditingMember(null);
          setOriginalMemberData(null);
          
          // 회원 목록 새로고침 (페이지 이동 없이)
          try {
            // 새로 추가된 회원 정보를 포함하여 목록 업데이트
            const newMember = {
              id: result.id || Date.now(), // 임시 ID 생성
              name: editingMember.name,
              email: editingMember.email,
              role: editingMember.role,
              status: 'ACTIVE' as const,
              createdAt: new Date().toISOString()
            };
            
            const updatedList = [...userList, newMember];
            onUserListChange(updatedList);
            
            // 🔄 이벤트 시스템으로 다른 페이지에 동기화 알림
            emitMemberAdded(newMember);
            emitDataRefreshNeeded('members');
            emitAlert(`새 회원 "${newMember.name}"이 추가되었습니다.`, 'success');
            
            console.log('회원 목록 업데이트 완료:', updatedList.length, '명');
          } catch (error) {
            console.error('회원 목록 업데이트 실패:', error);
            // 실패 시에만 페이지 새로고침
            window.location.reload();
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '회원 추가 중 오류가 발생했습니다.';
          toast({
            title: '회원 추가 실패',
            description: errorMessage,
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
          // 모달 유지 - 사용자가 수정할 수 있도록
        }
      } else {
        // 기존 회원 정보 수정 - 직접 백엔드 API 호출
        console.log('회원 정보 수정 API 호출:', editingMember.id, {
          name: editingMember.name,
          email: editingMember.email,
          role: editingMember.role || 'MEMBER',
          status: editingMember.status || 'ACTIVE'
        });
        
        // 인증 토큰 확인
        const token = localStorage.getItem('token');
        if (!token) {
          toast({
            title: '인증 오류',
            description: '로그인이 필요합니다. 다시 로그인해주세요.',
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
          return;
        }
        
        console.log('토큰 확인:', token);
        console.log('토큰 길이:', token.length);
        
        // 직접 백엔드 API 호출
        try {
          const response = await fetch(`http://localhost:4000/api/auth/members/${editingMember.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              name: editingMember.name,
              email: editingMember.email,
              role: editingMember.role || 'MEMBER',
              status: editingMember.status || 'ACTIVE'
            })
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '회원 정보 수정 실패');
          }
          
          const result = await response.json();
          console.log('API 응답:', result);
          
          // API 응답으로 업데이트된 회원 정보로 목록 갱신
          const updatedList = userList.map(user =>
            user.id === editingMember.id ? { ...editingMember, ...result.member } : user
          );
          onUserListChange(updatedList);
          
          // 현재 로그인한 사용자의 정보가 수정된 경우 전역 상태도 업데이트
          if (user && user.id === editingMember.id) {
            setUser({
              ...user,
              name: editingMember.name,
              email: editingMember.email,
              role: editingMember.role || 'MEMBER',
              status: editingMember.status || 'ACTIVE'
            });
          }
          
          toast({
            title: '회원 정보 수정 완료',
            description: '회원 정보가 성공적으로 수정되었습니다.',
            status: 'success',
            duration: 3000,
            isClosable: true,
          });
          
          onEditModalClose();
          setEditingMember(null);
          setOriginalMemberData(null);
          // 전역 동기화 이벤트 발행
          try { window.dispatchEvent(new CustomEvent('membersChanged')); } catch {}
        } catch (error) {
          console.error('회원 정보 수정 API 오류:', error);
          const errorMessage = error instanceof Error ? error.message : '회원 정보 수정 중 오류가 발생했습니다.';
          toast({
            title: '회원 정보 수정 실패',
            description: errorMessage,
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
        }
      }
    } catch (error) {
      console.error('회원 정보 저장 오류:', error);
      toast({
        title: '회원 정보 저장 실패',
        description: '회원 정보 저장 중 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // 비밀번호 초기화
  const handleResetPassword = async (memberId: number) => {
    if (!memberId) return;
    
    // 인증 토큰 확인
    const token = localStorage.getItem('token');
    if (!token) {
      toast({
        title: '인증 오류',
        description: '로그인이 필요합니다. 다시 로그인해주세요.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    setIsResettingPassword(true);
    
    try {
      const response = await resetMemberPassword(memberId);
      
      toast({
        title: '비밀번호 초기화 완료',
        description: `새 비밀번호: ${response.newPassword}`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error('비밀번호 초기화 오류:', error);
      toast({
        title: '비밀번호 초기화 실패',
        description: '비밀번호 초기화 중 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  // 회원 삭제
  const handleDeleteMember = async () => {
    if (!selectedMember) return;

    // 인증 토큰 확인
    const token = localStorage.getItem('token');
    if (!token) {
      toast({
        title: '인증 오류',
        description: '로그인이 필요합니다. 다시 로그인해주세요.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      // API 호출로 실제 삭제
      await deleteMember(selectedMember.id);
      
      // 성공 시 로컬 상태에서도 제거
      const updatedList = userList.filter(user => user.id !== selectedMember.id);
      onUserListChange(updatedList);
      
      toast({
        title: '회원 삭제 완료',
        description: '회원이 성공적으로 삭제되었습니다.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      
      onDeleteModalClose();
      setSelectedMember(null);
      // 전역 동기화 이벤트 발행
      try { window.dispatchEvent(new CustomEvent('membersChanged')); } catch {}
    } catch (error) {
      console.error('회원 삭제 오류:', error);
      toast({
        title: '회원 삭제 실패',
        description: '회원 삭제 중 오류가 발생했습니다.',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // 회원 상태 색상
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'green';
      case 'INACTIVE': return 'yellow';
      case 'SUSPENDED': return 'red';
      case 'DELETED': return 'gray';
      default: return 'gray';
    }
  };

  // 회원 등급 색상
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'red';
      case 'ADMIN': return 'blue';
      case 'MEMBER': return 'green';
      default: return 'gray';
    }
  };

  // 회원 등급 한글명
  const getRoleName = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return '슈퍼관리자';
      case 'ADMIN': return '관리자';
      case 'MEMBER': return '회원';
      default: return '알 수 없음';
    }
  };

  return (
    <Box>
      <VStack spacing={6} align="stretch">
        {/* 헤더 */}
        <HStack justify="space-between">
          <VStack align="start" spacing={2}>
            <HStack spacing={3}>
              <Text fontSize="2xl">👥</Text>
              <Text fontSize="2xl" fontWeight="bold">회원 관리</Text>
            </HStack>
            <Text>전체 회원 정보를 관리할 수 있습니다.</Text>
          </VStack>
          <Button
            leftIcon={<AddIcon />}
            colorScheme="blue"
            bg="#004ea8"
            _hover={{ bg: "#003d7a" }}
            onClick={() => {
              setEditingMember({
                id: 0,
                name: '',
                email: '',
                role: 'MEMBER',
                status: 'ACTIVE'
              });
              onEditModalOpen();
            }}
            size="sm"
          >
            추가
          </Button>
        </HStack>

        {/* 회원 목록 테이블 */}
        <Box
          bg={bgColor}
          border="1px"
          borderColor={borderColor}
          borderRadius="lg"
          overflow="hidden"
        >
          <Table variant="simple" size="sm">
            <Thead>
              <Tr>
                <Th textAlign="center">이름</Th>
                <Th textAlign="center">이메일</Th>
                <Th textAlign="center">등급</Th>
                <Th textAlign="center">상태</Th>
                <Th textAlign="center">가입일</Th>
                <Th textAlign="center">작업</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredMembers.map((member) => (
                <Tr key={member.id}>
                  <Td textAlign="center">
                    <Text fontWeight="medium">{member.name}</Text>
                  </Td>
                  <Td textAlign="center">
                    <Text fontSize="sm" color="gray.600">
                      {member.email || '-'}
                    </Text>
                  </Td>
                  <Td textAlign="center">
                    <Badge colorScheme={getRoleColor(member.role || '')} variant="subtle">
                      {getRoleName(member.role || '')}
                    </Badge>
                  </Td>
                  <Td textAlign="center">
                    <Badge colorScheme={getStatusColor(member.status || '')} variant="subtle">
                      {member.status === 'ACTIVE' ? '활성' : 
                       member.status === 'INACTIVE' ? '비활성' :
                       member.status === 'SUSPENDED' ? '정지' :
                       member.status === 'DELETED' ? '삭제됨' : '알 수 없음'}
                    </Badge>
                  </Td>
                  <Td textAlign="center">
                    <Text fontSize="sm" color="gray.600">
                      {member.createdAt ? new Date(member.createdAt).toLocaleDateString('ko-KR') : '-'}
                    </Text>
                  </Td>
                  <Td textAlign="center">
                    <HStack spacing={2} justify="center">
                      <Tooltip 
                        label="회원 정보 보기" 
                        placement="top" 
                        hasArrow
                        bg="gray.700"
                        color="white"
                        fontSize="sm"
                      >
                        <IconButton
                          aria-label="회원 정보 보기"
                          icon={<ViewIcon />}
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedMember(member);
                            onViewModalOpen();
                          }}
                        />
                      </Tooltip>
                      <Tooltip 
                        label="회원 정보 수정" 
                        placement="top" 
                        hasArrow
                        bg="gray.700"
                        color="white"
                        fontSize="sm"
                      >
                        <IconButton
                          aria-label="회원 정보 수정"
                          icon={<EditIcon />}
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditMember(member)}
                        />
                      </Tooltip>
                      <Tooltip 
                        label="회원 삭제" 
                        placement="top" 
                        hasArrow
                        bg="red.600"
                        color="white"
                        fontSize="sm"
                      >
                        <IconButton
                          aria-label="회원 삭제"
                          icon={<DeleteIcon />}
                          size="sm"
                          variant="ghost"
                          colorScheme="red"
                          onClick={() => {
                            setSelectedMember(member);
                            onDeleteModalOpen();
                          }}
                        />
                      </Tooltip>
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </VStack>

      {/* 회원 정보 수정 모달 */}
      <Modal 
        isOpen={isEditModalOpen} 
        onClose={() => {
          // 모달 닫기 시 상태 초기화하지 않음 (데이터 보존)
          onEditModalClose();
        }} 
        size="lg"
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {editingMember?.id === 0 ? '새 회원 추가' : '회원 정보 수정'}
          </ModalHeader>
          <ModalBody>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel>이름</FormLabel>
                <Input
                  value={editingMember?.name || ''}
                  onChange={(e) => setEditingMember(prev => prev ? {...prev, name: e.target.value} : null)}
                  placeholder="회원 이름을 입력하세요"
                />
              </FormControl>
              
              <FormControl>
                <FormLabel>이메일</FormLabel>
                <Input
                  value={editingMember?.email || ''}
                  onChange={(e) => setEditingMember(prev => prev ? {...prev, email: e.target.value} : null)}
                  placeholder="이메일을 입력하세요"
                  type="email"
                />
              </FormControl>
              
              <FormControl>
                <FormLabel>등급</FormLabel>
                <Select
                  value={editingMember?.role || 'MEMBER'}
                  onChange={(e) => setEditingMember(prev => prev ? {...prev, role: e.target.value as any} : null)}
                >
                  <option value="MEMBER">회원</option>
                  <option value="ADMIN">관리자</option>
                  <option value="SUPER_ADMIN">슈퍼관리자</option>
                </Select>
              </FormControl>
              
              <FormControl>
                <FormLabel>상태</FormLabel>
                <Select
                  value={editingMember?.status || 'ACTIVE'}
                  onChange={(e) => setEditingMember(prev => prev ? {...prev, status: e.target.value as any} : null)}
                >
                  <option value="ACTIVE">활성</option>
                  <option value="INACTIVE">비활성</option>
                  <option value="SUSPENDED">정지</option>
                  <option value="DELETED">삭제됨</option>
                </Select>
              </FormControl>
              
              {/* 비밀번호 초기화 버튼 (기존 회원 수정 시에만 표시) */}
              {editingMember?.id !== 0 && (
                <FormControl>
                  <FormLabel>비밀번호 관리</FormLabel>
                  <Button
                    leftIcon={<RepeatIcon />}
                    colorScheme="orange"
                    variant="outline"
                    onClick={() => handleResetPassword(editingMember.id)}
                    isLoading={isResettingPassword}
                    loadingText="초기화 중..."
                    w="100%"
                  >
                    비밀번호 초기화
                  </Button>
                  <Text fontSize="sm" color="gray.500" mt={1}>
                    초기화된 비밀번호는 토스트 메시지로 표시됩니다.
                  </Text>
                </FormControl>
              )}
            </VStack>
          </ModalBody>
          <Box p={6} borderTop="1px" borderColor="gray.200">
            <HStack spacing={3} justify="flex-end">
              <Button 
                variant="ghost" 
                onClick={() => {
                  // 취소 시에도 상태 초기화하지 않음 (데이터 보존)
                  onEditModalClose();
                }}
              >
                취소
              </Button>
              <Button colorScheme="blue" onClick={handleSaveMember}>
                저장
              </Button>
            </HStack>
          </Box>
        </ModalContent>
      </Modal>

      {/* 회원 정보 보기 모달 */}
      <Modal isOpen={isViewModalOpen} onClose={onViewModalClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>회원 정보</ModalHeader>
          <ModalBody>
            {selectedMember && (
              <VStack spacing={4} align="stretch">
                <Box>
                  <Text fontWeight="bold" mb={2}>이름</Text>
                  <Text>{selectedMember.name}</Text>
                </Box>
                
                <Box>
                  <Text fontWeight="bold" mb={2}>이메일</Text>
                  <Text>{selectedMember.email}</Text>
                </Box>
                
                <Box>
                  <Text fontWeight="bold" mb={2}>등급</Text>
                  <Badge colorScheme={getRoleColor(selectedMember.role || '')} variant="subtle">
                    {getRoleName(selectedMember.role || '')}
                  </Badge>
                </Box>
                
                <Box>
                  <Text fontWeight="bold" mb={2}>상태</Text>
                  <Badge colorScheme={getStatusColor(selectedMember.status || '')} variant="subtle">
                    {selectedMember.status === 'ACTIVE' ? '활성' : 
                     selectedMember.status === 'INACTIVE' ? '비활성' :
                     selectedMember.status === 'SUSPENDED' ? '정지' :
                     selectedMember.status === 'DELETED' ? '삭제됨' : '알 수 없음'}
                  </Badge>
                </Box>
                
                <Box>
                  <Text fontWeight="bold" mb={2}>가입일</Text>
                  <Text>
                    {selectedMember.createdAt ? new Date(selectedMember.createdAt).toLocaleDateString('ko-KR') : '-'}
                  </Text>
                </Box>
              </VStack>
            )}
          </ModalBody>
          <Box p={6} borderTop="1px" borderColor="gray.200">
            <HStack spacing={3} justify="flex-end">
              <Button onClick={onViewModalClose}>닫기</Button>
            </HStack>
          </Box>
        </ModalContent>
      </Modal>

      {/* 회원 삭제 확인 모달 */}
      <Modal isOpen={isDeleteModalOpen} onClose={onDeleteModalClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>회원 삭제 확인</ModalHeader>
          <ModalBody>
            <Alert status="warning">
              <AlertIcon />
              <Text>
                <strong>{selectedMember?.name}</strong> 회원을 정말 삭제하시겠습니까?
                이 작업은 되돌릴 수 없습니다.
              </Text>
            </Alert>
          </ModalBody>
          <Box p={6} borderTop="1px" borderColor="gray.200">
            <HStack spacing={3} justify="flex-end">
              <Button variant="ghost" onClick={onDeleteModalClose}>
                취소
              </Button>
              <Button colorScheme="red" onClick={handleDeleteMember}>
                삭제
              </Button>
            </HStack>
          </Box>
        </ModalContent>
      </Modal>
    </Box>
  );
}
