import { useState, useEffect, useRef } from 'react';
import { Flex, Text, Button, HStack, Badge, Modal, ModalOverlay, ModalContent, ModalBody, useDisclosure, Box, FormControl, FormLabel, Input, useToast, Tooltip } from '@chakra-ui/react';
import { CalendarIcon, ViewIcon, SettingsIcon, AttachmentIcon, ExternalLinkIcon } from '@chakra-ui/icons';
import { useAuthStore } from '../store/auth';
import { changePassword } from '../api/auth';
import Signup from '../pages/Signup';
import Login from '../pages/Login';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Header() {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setUser = useAuthStore((s) => s.setUser);
  const token = useAuthStore((s) => s.token);
  const [showSignup, setShowSignup] = useState(false);
  const attendance = user?.attendance ?? null;
  const voteAttendance = user?.voteAttendance ?? null;
  const navigate = useNavigate();
  const location = useLocation();
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [nameLoading, setNameLoading] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const toast = useToast();

  // 사용자 데이터 새로고침 함수
  const refreshUserData = async () => {
    if (!token) return;
    
    try {
      const { getProfile } = await import('../api/auth');
      const response = await getProfile();
      setUser(response);
      console.log('🗳️ 헤더: 사용자 데이터 새로고침 완료:', {
        voteAttendance: response.voteAttendance,
        voteDetails: response.voteDetails,
        name: response.name
      });
    } catch (error) {
      console.error('사용자 데이터 새로고침 실패:', error);
    }
  };

  // 투표 제출 이벤트 리스너
  useEffect(() => {
    const handleVoteSubmitted = () => {
      console.log('🗳️ 헤더: 투표 제출 이벤트 수신, 사용자 데이터 새로고침');
      refreshUserData();
    };

    window.addEventListener('voteSubmitted', handleVoteSubmitted);
    return () => {
      window.removeEventListener('voteSubmitted', handleVoteSubmitted);
    };
  }, [token]);

  const handleNamePillClick = () => {
    setEditName(user?.name || '');
    setIsNameModalOpen(true);
  };
  const handleNameSave = async () => {
    if (!user || !token) return;
    setNameLoading(true);
    setNameError(null);
    try {
      const updated = await import('../api/auth').then(m => m.updateProfile(editName));
      setUser(updated.user);
      setIsNameModalOpen(false);
      toast({ title: '이름이 수정되었습니다.', status: 'success', duration: 2000 });
    } catch {
      setNameError('이름 수정 실패');
    } finally {
      setNameLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!user || !token) return;
    
    if (newPassword !== confirmPassword) {
      setPasswordError('비밀번호가 일치하지 않습니다.');
      return;
    }
    
    if (newPassword.length < 6) {
      setPasswordError('비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }
    
    setPasswordLoading(true);
    setPasswordError(null);
    try {
      // 비밀번호 변경 API 호출
      const { changePassword } = await import('../api/auth');
      await changePassword(newPassword);
      
      setIsPasswordModalOpen(false);
      setNewPassword('');
      setConfirmPassword('');
      toast({ title: '비밀번호가 변경되었습니다.', status: 'success', duration: 2000 });
    } catch (error) {
      console.error('비밀번호 변경 오류:', error);
      setPasswordError('비밀번호 변경에 실패했습니다.');
    } finally {
      setPasswordLoading(false);
    }
  };

  // 애니메이션용 상태
  const [animatedAttendance, setAnimatedAttendance] = useState(0);
  const [animatedVoteAttendance, setAnimatedVoteAttendance] = useState(0);
  const animationRef = useRef<NodeJS.Timeout | null>(null);
  const voteAnimationRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 레퍼런스에 맞춰 13%로 설정
    const targetAttendance = 13;
    setAnimatedAttendance(0);
    
    // 애니메이션: 0에서 targetAttendance까지 빠르게 증가
    const duration = 700; // ms
    const frameRate = 1000 / 60; // 60fps
    const totalFrames = Math.round(duration / frameRate);
    let frame = 0;
    if (animationRef.current) clearInterval(animationRef.current);
    animationRef.current = setInterval(() => {
      frame++;
      const progress = Math.min(frame / totalFrames, 1);
      const value = Math.round(progress * targetAttendance);
      setAnimatedAttendance(value);
      if (progress === 1) {
        if (animationRef.current) clearInterval(animationRef.current);
      }
    }, frameRate);
    return () => {
      if (animationRef.current) clearInterval(animationRef.current);
    };
  }, []);

  // 투표 참여율 애니메이션
  useEffect(() => {
    // 실제 투표율 계산: voteAttendance 값 사용 (레퍼런스에 맞춰 76%로 설정)
    const targetVoteAttendance = 76;
    
    // 애니메이션: 0에서 targetVoteAttendance까지 빠르게 증가
    const duration = 700; // ms
    const frameRate = 1000 / 60; // 60fps
    const totalFrames = Math.round(duration / frameRate);
    let frame = 0;
    if (voteAnimationRef.current) clearInterval(voteAnimationRef.current);
    voteAnimationRef.current = setInterval(() => {
      frame++;
      const progress = Math.min(frame / totalFrames, 1);
      const value = Math.round(progress * targetVoteAttendance);
      setAnimatedVoteAttendance(value);
      if (progress === 1) {
        if (voteAnimationRef.current) clearInterval(voteAnimationRef.current);
      }
    }, frameRate);
    return () => {
      if (voteAnimationRef.current) clearInterval(voteAnimationRef.current);
    };
  }, [voteAttendance]);

  // gaugeGrow keyframes를 헤더에도 적용 (최초 1회)
  useEffect(() => {
    const styleId = 'header-gauge-grow-keyframes';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `@keyframes gaugeGrow { from { width: 0%; } to { width: var(--gauge-width, 100%); } }`;
      document.head.appendChild(style);
    }
  }, []);

  // 컴포넌트 마운트 시 사용자 데이터 새로고침
  useEffect(() => {
    if (user && token) {
      refreshUserData();
    }
  }, [token]); // token이 변경될 때만 실행

  // 투표 완료 이벤트 수신하여 사용자 데이터 새로고침
  useEffect(() => {
    const handleVoteSubmitted = () => {
      console.log('🔍 헤더: 투표 완료 이벤트 수신, 사용자 데이터 새로고침');
      if (user && token) {
        refreshUserData();
      }
    };

    window.addEventListener('voteSubmitted', handleVoteSubmitted);
    
    return () => {
      window.removeEventListener('voteSubmitted', handleVoteSubmitted);
    };
  }, [user, token]);

  return (
    <>
      <Flex as="nav" align="center" justify="space-between" px={{ base: 4, md: 16 }} py={4} bg="white" boxShadow="sm" w="100vw" position="fixed" top={0} left={0} right={0} zIndex={100}>
        <HStack spacing={4}>
          <Text 
            fontSize="xl" 
            fontWeight="bold" 
            cursor="pointer"
            onClick={(e) => { 
              e.preventDefault();
              e.stopPropagation();
              console.log('🔍 홈으로 이동 시도 - 현재 경로:', window.location.pathname);
              console.log('🔍 navigate 함수 타입:', typeof navigate);
              
              // React Router navigate 시도
              try {
                navigate('/');
                console.log('🔍 홈 navigate 호출 완료');
                
                // 0.5초 후에도 페이지가 안 바뀌면 강제 이동
                setTimeout(() => {
                  if (window.location.pathname !== '/') {
                    console.log('🔍 React Router 실패, 강제 이동 시도');
                    window.location.href = '/';
                  }
                }, 500);
              } catch (error) {
                console.error('🔍 홈 navigate 에러:', error);
                // 에러 발생 시 강제 이동
                window.location.href = '/';
              }
            }} 
            tabIndex={0} 
            aria-label="홈으로 이동"
            color="#004ea8"
            _hover={{ 
              color: '#00397a'
            }}
          >
            FC CHAL-GGYEO
          </Text>
        </HStack>
        <HStack spacing={4}>
          <Button 
            variant={location.pathname === '/schedule-v2' ? "outline" : "ghost"} 
            bg="transparent"
            color="#004ea8" 
            border="0.5px solid" 
            borderColor={location.pathname === '/schedule-v2' ? "#004ea8" : "transparent"} 
            _hover={{ 
              bg: location.pathname === '/schedule-v2' ? 'transparent' : 'gray.50',
              borderColor: "#004ea8"
            }} 
            leftIcon={<CalendarIcon />} 
            onClick={() => navigate('/schedule-v2')}
          >
            일정
          </Button>
                    <Button 
            variant={location.pathname === '/gallery' ? "outline" : "ghost"} 
            bg="transparent"
            color="#004ea8" 
            border="0.5px solid" 
            borderColor={location.pathname === '/gallery' ? "#004ea8" : "transparent"} 
            _hover={{ 
              bg: location.pathname === '/gallery' ? 'transparent' : 'gray.50',
              borderColor: "#004ea8"
            }}
            leftIcon={<ViewIcon />}
            onClick={() => navigate('/gallery')}
          >
            갤러리
          </Button>
          <Button 
            variant={location.pathname === '/gallery/photos' ? "outline" : "ghost"} 
            bg="transparent"
            color="#004ea8" 
            border="0.5px solid" 
            borderColor={location.pathname === '/gallery/photos' ? "#004ea8" : "transparent"} 
            _hover={{ 
              bg: location.pathname === '/gallery/photos' ? 'transparent' : 'gray.50',
              borderColor: "#004ea8"
            }}
            leftIcon={<AttachmentIcon />}
            onClick={() => navigate('/gallery/photos')}
          >
            사진
          </Button>
          <Button 
            variant={location.pathname === '/gallery/videos' ? "outline" : "ghost"} 
            bg="transparent"
            color="#004ea8" 
            border="0.5px solid" 
            borderColor={location.pathname === '/gallery/videos' ? "#004ea8" : "transparent"} 
            _hover={{ 
              bg: location.pathname === '/gallery/videos' ? 'transparent' : 'gray.50',
              borderColor: "#004ea8"
            }}
            leftIcon={<ExternalLinkIcon />}
            onClick={() => navigate('/gallery/videos')}
          >
            동영상
          </Button>
          {(user?.role === 'ADMIN' || user?.email === 'sti60val@gmail.com') && (
            <Button 
              variant={location.pathname === '/admin' ? "outline" : "ghost"} 
              bg="transparent"
              color="#004ea8" 
              border="0.5px solid" 
              borderColor={location.pathname === '/admin' ? "#004ea8" : "transparent"} 
              _hover={{ 
                bg: location.pathname === '/admin' ? 'transparent' : 'gray.50',
                borderColor: "#004ea8"
              }}
              leftIcon={<SettingsIcon />}
              onClick={(e) => { 
                e.preventDefault();
                e.stopPropagation();
                console.log('🔍 관리자로 이동 시도 - 현재 경로:', window.location.pathname);
                console.log('🔍 navigate 함수 타입:', typeof navigate);
                
                // React Router navigate 시도
                try {
                  navigate('/admin');
                  console.log('🔍 관리자 navigate 호출 완료');
                  
                  // 0.5초 후에도 페이지가 안 바뀌면 강제 이동
                  setTimeout(() => {
                    if (window.location.pathname !== '/admin') {
                      console.log('🔍 React Router 실패, 강제 이동 시도');
                      window.location.href = '/admin';
                    }
                  }, 500);
                } catch (error) {
                  console.error('🔍 관리자 navigate 에러:', error);
                  // 에러 발생 시 강제 이동
                  window.location.href = '/admin';
                }
              }}
            >
              관리자
            </Button>
          )}
        </HStack>
        <HStack spacing={4}>
          {!user ? (
            <Button size="sm" bg="#004ea8" color="white" _hover={{ bg: '#00397a' }} variant="outline" onClick={onOpen}>로그인</Button>
          ) : (
            <>
              <HStack align="center" spacing={3}>
                {/* 투표율과 참여율이 함께 표시되는 헤더만 표시 */}
                {attendance !== null && (
                  <>
                    <Tooltip 
                      label={`${user?.voteDetails?.participated || 0}/${user?.voteDetails?.total || 2} 투표 참여`}
                      placement="bottom"
                      hasArrow
                      bg="gray.800"
                      color="white"
                      fontSize="sm"
                    >
                      <Box minW="80px" textAlign="center" display="flex" flexDirection="column" alignItems="center" justifyContent="center">
                        <Tooltip 
                          label={(() => {
                            const voteDetails = user?.voteDetails;
                            if (!voteDetails) return '투표 세션 정보를 불러오는 중...';
                            
                            const sessions = voteDetails.sessions || [];
                            const participatedCount = sessions.filter((s: any) => s.userParticipated).length;
                            const totalCount = sessions.length;
                            
                            return `전체 ${totalCount}개 세션 중 ${participatedCount}개 참여\n\n세션 목록:\n${sessions.map((s: any) => 
                              `• ${new Date(s.weekStartDate).toLocaleDateString()} (${s.isActive ? '진행중' : s.isCompleted ? '완료' : '대기'}) - ${s.userParticipated ? '참여' : '미참여'}`
                            ).join('\n')}`;
                          })()}
                          placement="bottom"
                          hasArrow
                          bg="blue.600"
                          color="white"
                          fontSize="sm"
                          borderRadius="md"
                          px={3}
                          py={2}
                          whiteSpace="pre-line"
                        >
                          <Text fontSize="xs" color="gray.500" cursor="help" _hover={{ color: "blue.400" }}>
                            투표율 <span style={{ color: '#e53e3e', fontWeight: 'bold' }}>{animatedVoteAttendance}%</span>
                          </Text>
                        </Tooltip>
                        <Box w="60px" mt={1}>
                          <Box
                            h="6px"
                            bg="#e2e8f0"
                            borderRadius={4}
                            overflow="hidden"
                            position="relative"
                          >
                            <Box
                              bg="#e53e3e"
                              h="100%"
                              borderRadius={4}
                              position="absolute"
                              left={0}
                              top={0}
                              zIndex={1}
                              style={{
                                width: `${animatedVoteAttendance}%`,
                                animation: `gaugeGrow 0.7s cubic-bezier(.4,2,.6,1)`,
                                animationFillMode: 'forwards',
                                '--gauge-width': `${animatedVoteAttendance}%`,
                                transition: 'width 0.7s cubic-bezier(.4,2,.6,1)'
                              } as React.CSSProperties}
                            />
                          </Box>
                        </Box>
                      </Box>
                    </Tooltip>
                    <Tooltip 
                      label={`${user?.gameDetails?.participated || 0}/${user?.gameDetails?.total || 0} 경기 참여`}
                      placement="bottom"
                      hasArrow
                      bg="gray.800"
                      color="white"
                      fontSize="sm"
                    >
                      <Box minW="80px" textAlign="center" display="flex" flexDirection="column" alignItems="center" justifyContent="center">
                        <Text fontSize="xs" color="gray.500">참여율 <span style={{ color: '#004ea8', fontWeight: 'bold' }}>{animatedAttendance}%</span></Text>
                        <Box w="60px" mt={1}>
                          <Box
                            h="6px"
                            bg="#e2e8f0"
                            borderRadius={4}
                            overflow="hidden"
                            position="relative"
                          >
                            <Box
                              bg="#004ea8"
                              h="100%"
                              borderRadius={4}
                              position="absolute"
                              left={0}
                              top={0}
                              zIndex={1}
                              style={{
                                width: `${animatedAttendance}%`,
                                animation: `gaugeGrow 0.7s cubic-bezier(.4,2,.6,1)`,
                                animationFillMode: 'forwards',
                                '--gauge-width': `${animatedAttendance}%`,
                                transition: 'width 0.7s cubic-bezier(.4,2,.6,1)'
                              } as React.CSSProperties}
                            />
                          </Box>
                        </Box>
                      </Box>
                    </Tooltip>
                  </>
                )}
                <HStack align="center" spacing={2}>
                  <Badge bg="#004ea8" color="white" borderRadius="full" px={2} py={1}>정</Badge>
                  <Text
                    fontWeight="bold"
                    cursor="pointer"
                    _hover={{ textDecoration: 'underline', color: '#00397a' }}
                    onClick={handleNamePillClick}
                  >
                    {user.name}
                  </Text>
                </HStack>
              </HStack>
              <Button size="sm" colorScheme="gray" variant="outline" onClick={() => { logout(); navigate('/'); }}>로그아웃</Button>
            </>
          )}
        </HStack>
      </Flex>
      {/* 로그인/회원가입 모달 */}
      <Modal isOpen={isOpen} onClose={() => { setShowSignup(false); onClose(); }} isCentered size="sm">
        <ModalOverlay />
        <ModalContent
          p={0}
          borderRadius="lg"
          minH="auto"
          maxH="400px"
          height="auto"
          mx="auto"
          my="auto"
          position="relative"
        >
          <ModalBody p={0} pt={0} pb={1} px={0} display="flex" alignItems="center" justifyContent="center" height="400px" minHeight="400px">
            {showSignup ? (
              <Signup onSwitch={() => setShowSignup(false)} onClose={() => { setShowSignup(false); onClose(); }} />
            ) : (
              <Login onSwitch={() => setShowSignup(true)} onClose={() => { setShowSignup(false); onClose(); }} />
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
      {/* 이름 수정 모달 */}
      <Modal isOpen={isNameModalOpen} onClose={() => setIsNameModalOpen(false)} isCentered size="sm">
        <ModalOverlay />
        <ModalContent>
          <ModalBody p={6}>
            <FormControl mb={4}>
              <FormLabel>새 이름</FormLabel>
              <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="이름을 입력하세요" />
            </FormControl>
            {nameError && <Text color="red.500" mb={2}>{nameError}</Text>}
            <Button bg="#004ea8" color="white" _hover={{ bg: '#00397a' }} w="full" onClick={handleNameSave} isLoading={nameLoading} isDisabled={!editName.trim() || editName === user?.name} mb={3}>저장</Button>
            <Button variant="outline" colorScheme="orange" w="full" onClick={() => { setIsNameModalOpen(false); setIsPasswordModalOpen(true); }}>비밀번호 변경</Button>
          </ModalBody>
        </ModalContent>
      </Modal>
      
      {/* 비밀번호 변경 모달 */}
      <Modal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} isCentered size="sm">
        <ModalOverlay />
        <ModalContent>
          <ModalBody p={6}>
            <FormControl mb={4}>
              <FormLabel>새 비밀번호</FormLabel>
              <Input 
                type="password" 
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)} 
                placeholder="새 비밀번호를 입력하세요" 
              />
            </FormControl>
            <FormControl mb={4}>
              <FormLabel>비밀번호 확인</FormLabel>
              <Input 
                type="password" 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                placeholder="비밀번호를 다시 입력하세요" 
              />
            </FormControl>
            {passwordError && <Text color="red.500" mb={2}>{passwordError}</Text>}
            <Button bg="#004ea8" color="white" _hover={{ bg: '#00397a' }} w="full" onClick={handlePasswordChange} isLoading={passwordLoading} isDisabled={!newPassword.trim() || !confirmPassword.trim()}>비밀번호 변경</Button>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
} 