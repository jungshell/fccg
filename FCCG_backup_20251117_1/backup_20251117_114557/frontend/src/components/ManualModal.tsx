import React, { useState } from 'react';
import { keyframes } from '@emotion/react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Divider,
  SimpleGrid,
  Icon,
  Flex,
  Circle,
  useColorModeValue,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel
} from '@chakra-ui/react';

type ManualModalProps = {
  isOpen: boolean;
  onClose: () => void;
  variant: 'member' | 'admin';
};

const FeatureCard = ({ emoji, title, description, color = "blue" }: { 
  emoji: string; 
  title: string; 
  description: string; 
  color?: string;
}) => (
  <Box
    bg={`${color}.50`}
    _dark={{ bg: `${color}.900`, borderColor: `${color}.700` }}
    p={2}
    rounded="md"
    border="1px"
    borderColor={`${color}.200`}
    transition="all 0.2s"
    _hover={{ transform: "translateY(-1px)", shadow: "md" }}
  >
    <HStack spacing={2} mb={1}>
      <Circle size="28px" bg={`${color}.100`} _dark={{ bg: `${color}.800` }}>
        <Text fontSize="md">{emoji}</Text>
      </Circle>
      <Text fontWeight="bold" fontSize="md" color={`${color}.700`} _dark={{ color: `${color}.300` }}>
        {title}
      </Text>
    </HStack>
    <Text fontSize="sm" color="gray.600" _dark={{ color: "gray.300" }} lineHeight="1.3">
      {description}
    </Text>
  </Box>
);

const StepCard = ({ step, emoji, title, description, color = "blue" }: {
  step: number;
  emoji: string;
  title: string;
  description: string;
  color?: string;
}) => (
  <HStack spacing={2} p={2} bg="white" _dark={{ bg: "gray.800" }} rounded="md" shadow="sm">
    <Circle size="24px" bg={`${color}.500`} color="white" fontWeight="bold" fontSize="xs">
      {step}
    </Circle>
    <Text fontSize="lg">{emoji}</Text>
    <Box flex={1}>
      <Text fontWeight="semibold" fontSize="sm" mb={0.5} lineHeight="1.2">{title}</Text>
      <Text fontSize="xs" color="gray.600" _dark={{ color: "gray.400" }} lineHeight="1.3">{description}</Text>
    </Box>
  </HStack>
);

export default function ManualModal({ isOpen, onClose, variant }: ManualModalProps) {
  const title = variant === 'member' ? 'FCGG 이용 가이드' : '관리자 운영 매뉴얼';
  const chip = variant === 'member' ? (
    <Badge colorScheme="blue" px={3} py={1} rounded="full" fontSize="xs">회원용</Badge>
  ) : null;

  // 관리자 탭 상태
  const [adminTabIndex, setAdminTabIndex] = useState(0);

  // 헤더 그라데이션 애니메이션
  const gradientMove = keyframes`
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  `;
  const fadeIn = keyframes`
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  `;

  // (요청) 풋살현황판 탭만 줄바꿈 처리

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
      <ModalContent bg="white" _dark={{ bg: 'gray.800' }} rounded="2xl" shadow="2xl">
        <ModalHeader 
          bg="gradient-to-r"
          bgGradient="linear(to-r, blue.500, purple.500)"
          color="white"
          roundedTop="2xl"
          pt={0.75}
          pb={0.25}
          px={4}
          style={{ backgroundSize: '200% 200%', animation: `${gradientMove} 12s ease infinite` }}
        >
          <HStack justify="space-between" align="center">
            <HStack spacing={3} align="center">
              <Circle size="40px" bg="whiteAlpha.200" color="white">
                <Text fontSize="xl">⚽</Text>
              </Circle>
              <VStack align="start" spacing={-2.25} style={{ animation: `${fadeIn} 400ms ease both` }}>
                <Text fontSize="xl" fontWeight="bold" mt="3">{title}</Text>
                <Text fontSize="sm" opacity={0.9} mt="-4">FC CHAL-GGYEO</Text>
              </VStack>
              {chip}
            </HStack>
          </HStack>
        </ModalHeader>
        <ModalCloseButton color="white" _hover={{ bg: "whiteAlpha.200" }} size="sm" />
        <ModalBody p={4}>
          {variant === 'member' ? (
            <VStack align="stretch" spacing={3}>
              {/* 홈 섹션 */}
              <Box>
                <HStack spacing={2} mb={2}>
                  <Circle size="32px" bg="blue.100" _dark={{ bg: "blue.800" }}>
                    <Text fontSize="lg">🏠</Text>
                  </Circle>
                  <Text fontSize="xl" fontWeight="bold" color="blue.600" _dark={{ color: "blue.300" }}>
                    홈 대시보드
                  </Text>
                </HStack>
                <SimpleGrid columns={{ base: 2, md: 4 }} spacing={2}>
                  <FeatureCard emoji="👥" title="총 멤버" description="현재 가입 인원 수" color="green" />
                  <FeatureCard emoji="⚽" title="이번주 경기" description="확정된 경기 날짜/장소" color="orange" />
                  <FeatureCard emoji="🏆" title="총 경기수" description="누적 경기 횟수" color="purple" />
                  <FeatureCard emoji="🗳️" title="다음주 투표" description="현재 활성화된 투표 기간" color="blue" />
                </SimpleGrid>
              </Box>

              {/* 일정 섹션 */}
              <Box>
                <HStack spacing={2} mb={2}>
                  <Circle size="32px" bg="green.100" _dark={{ bg: "green.800" }}>
                    <Text fontSize="lg">📅</Text>
                  </Circle>
                  <Text fontSize="xl" fontWeight="bold" color="green.600" _dark={{ color: "green.300" }}>
                    일정 관리
                  </Text>
                </HStack>
                
                <VStack spacing={2}>
                  <Box w="100%" p={2} bg="green.50" _dark={{ bg: "green.900", borderColor: "green.700" }} rounded="md" border="1px" borderColor="green.200">
                    <HStack spacing={2} mb={1.5}>
                      <Text fontSize="md">📊</Text>
                      <Text fontWeight="bold" fontSize="sm" color="green.700" _dark={{ color: "green.300" }}>이번주 일정 섹션</Text>
                    </HStack>
                    <VStack align="stretch" spacing={1.5}>
                      <StepCard step={1} emoji="📈" title="투표 결과 요약" description="지난주 투표 결과를 요일별로 표시" color="green" />
                    </VStack>
                  </Box>

                  <Box w="100%" p={2} bg="blue.50" _dark={{ bg: "blue.900", borderColor: "blue.700" }} rounded="md" border="1px" borderColor="blue.200">
                    <HStack spacing={2} mb={1.5}>
                      <Text fontSize="md">📆</Text>
                      <Text fontWeight="bold" fontSize="sm" color="blue.700" _dark={{ color: "blue.300" }}>달력</Text>
                    </HStack>
                    <VStack align="stretch" spacing={1.5}>
                      <StepCard step={1} emoji="✅" title="확정 경기만 표시" description="확정된 경기만 캘린더에 표시" color="blue" />
                      <StepCard step={2} emoji="👆" title="상세 정보 확인" description="일정 탭 시 날짜/장소/참여 인원 확인" color="blue" />
                    </VStack>
                  </Box>

                  <Box w="100%" p={2} bg="purple.50" _dark={{ bg: "purple.900", borderColor: "purple.700" }} rounded="md" border="1px" borderColor="purple.200">
                    <HStack spacing={2} mb={1.5}>
                      <Text fontSize="md">🗳️</Text>
                      <Text fontWeight="bold" fontSize="sm" color="purple.700" _dark={{ color: "purple.300" }}>다음주 일정 투표</Text>
                    </HStack>
                    <VStack align="stretch" spacing={1.5}>
                      <StepCard step={1} emoji="⏰" title="투표 기간 표시" description="현재 진행 중인 투표 기간 표시" color="purple" />
                      <StepCard step={2} emoji="🔐" title="로그인 필요" description="투표는 로그인 후 가능" color="purple" />
                      <StepCard step={3} emoji="📊" title="투표 현황" description="각 요일별 투표자 수와 참여율 확인" color="purple" />
                      <StepCard step={4} emoji="🔄" title="재투표 가능" description="이미 투표한 경우 '재투표하기' 버튼으로 수정" color="purple" />
                    </VStack>
                  </Box>
                </VStack>
              </Box>

              {/* 갤러리 섹션 */}
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={2}>
                <Box>
                  <HStack spacing={2} mb={2}>
                    <Circle size="32px" bg="pink.100" _dark={{ bg: "pink.800" }}>
                      <Text fontSize="lg">📸</Text>
                    </Circle>
                    <Text fontSize="lg" fontWeight="bold" color="pink.600" _dark={{ color: "pink.300" }}>
                      사진 갤러리
                    </Text>
                  </HStack>
                  <VStack align="stretch" spacing={1.5}>
                    <StepCard step={1} emoji="👀" title="공개 열람" description="누구나 열람 가능" color="pink" />
                    <StepCard step={2} emoji="🔍" title="상세 보기" description="카드 탭 시 큰 이미지 보기" color="pink" />
                    <StepCard step={3} emoji="🔐" title="업로드" description="로그인 후 업로드 가능" color="pink" />
                  </VStack>
                </Box>

                <Box>
                  <HStack spacing={2} mb={2}>
                    <Circle size="32px" bg="red.100" _dark={{ bg: "red.800" }}>
                      <Text fontSize="lg">🎥</Text>
                    </Circle>
                    <Text fontSize="lg" fontWeight="bold" color="red.600" _dark={{ color: "red.300" }}>
                      동영상 갤러리
                    </Text>
                  </HStack>
                  <VStack align="stretch" spacing={1.5}>
                    <StepCard step={1} emoji="📞" title="업로드 문의" description="관리자에게 문의" color="red" />
                  </VStack>
                </Box>
              </SimpleGrid>

              {/* 문의 섹션 */}
              <Box textAlign="center" p={2} bg="gray.50" _dark={{ bg: "gray.700" }} rounded="md">
                <Text fontSize="sm" color="gray.600" _dark={{ color: "gray.400" }}>
                  💬 문의사항이 있으시면 관리자에게 DM 주세요!
                </Text>
              </Box>
            </VStack>
          ) : (
            <VStack align="stretch" spacing={3}>
              <Tabs index={adminTabIndex} onChange={setAdminTabIndex} colorScheme="blue" variant="enclosed" isFitted>
                <TabList w="100%" mb={2} borderBottom="none">
                  {['대시보드','회원 관리','투표 결과','경기 관리','이번주 일정','알림 관리','활동 분석','풋살 현황판'].map((label) => (
                    <Tab 
                      key={label} 
                      fontSize="xs" 
                      py={2} 
                      px={1} 
                      bg="gray.100"
                      color="gray.700"
                      borderColor="gray.300"
                      _dark={{ bg: "gray.700", color: "gray.200", borderColor: "gray.600" }}
                      _hover={{ transform: 'scale(1.05)', bg: 'gray.200', _dark: { bg: 'gray.600' } }} 
                      _selected={{ bg: 'blue.50', fontWeight: 'bold', borderColor: 'blue.300', color: 'blue.700', _dark: { bg: 'blue.900', color: 'blue.300' } }} 
                      transition="transform 0.15s ease"
                    >
                      {label === '풋살 현황판' ? (
                        <Box as="span" whiteSpace="pre-line">풋살{'\n'}현황판</Box>
                      ) : label === '대시보드' ? (
                        <Box as="span" whiteSpace="pre-line">대시{'\n'}보드</Box>
                      ) : (
                        label
                      )}
                    </Tab>
                  ))}
                </TabList>
                <TabPanels mt={2.25} borderTop="none">
                  <TabPanel px={0}>
                    <VStack spacing={2} align="stretch">
                      <StepCard step={1} emoji="📈" title="실시간 통계" description="회원 수, 경기 수, 투표율 등 실시간 현황 확인" color="blue" />
                      <StepCard step={2} emoji="🔄" title="자동 업데이트" description="데이터 변경 시 자동으로 화면 갱신" color="blue" />
                      <StepCard step={3} emoji="📊" title="성과 지표" description="참여율, 활동도 등 주요 지표 모니터링" color="blue" />
                    </VStack>
                  </TabPanel>
                  <TabPanel px={0}>
                    <VStack spacing={2} align="stretch">
                      <StepCard step={1} emoji="➕" title="회원 등록" description="새 회원 추가 및 기본 정보 입력" color="green" />
                      <StepCard step={2} emoji="✏️" title="정보 수정" description="회원 정보 편집 및 권한 변경" color="green" />
                      <StepCard step={3} emoji="🔑" title="비밀번호 초기화" description="회원 비밀번호 재설정" color="green" />
                      <StepCard step={4} emoji="🗑️" title="회원 삭제" description="회원 계정 완전 삭제" color="green" />
                    </VStack>
                  </TabPanel>
                  <TabPanel px={0}>
                    <VStack spacing={2} align="stretch">
                      <StepCard step={1} emoji="📊" title="투표 현황" description="현재 진행 중인 투표 세션 확인" color="purple" />
                      <StepCard step={2} emoji="📈" title="결과 분석" description="요일별 득표수 및 참여율 분석" color="purple" />
                      <StepCard step={3} emoji="⏹️" title="투표 마감" description="투표 세션 수동 마감/재개" color="purple" />
                      <StepCard step={4} emoji="💾" title="결과 저장" description="투표 결과 집계 및 저장" color="purple" />
                    </VStack>
                  </TabPanel>
                  <TabPanel px={0}>
                    <VStack spacing={2} align="stretch">
                      <StepCard step={1} emoji="➕" title="경기 생성" description="새 경기 일정 추가" color="orange" />
                      <StepCard step={2} emoji="📅" title="일정 수정" description="경기 날짜, 시간, 장소 변경" color="orange" />
                      <StepCard step={3} emoji="👥" title="참가자 관리" description="경기 참가자 추가/제거" color="orange" />
                      <StepCard step={4} emoji="🗑️" title="경기 삭제" description="경기 일정 완전 삭제" color="orange" />
                    </VStack>
                  </TabPanel>
                  <TabPanel px={0}>
                    <VStack spacing={2} align="stretch">
                      <StepCard step={1} emoji="📝" title="일정 추가" description="이번주 특별 일정 등록" color="teal" />
                      <StepCard step={2} emoji="✏️" title="일정 수정" description="등록된 일정 정보 변경" color="teal" />
                      <StepCard step={3} emoji="🗑️" title="일정 삭제" description="불필요한 일정 제거" color="teal" />
                    </VStack>
                  </TabPanel>
                  <TabPanel px={0}>
                    <VStack spacing={2} align="stretch">
                      <StepCard step={1} emoji="📧" title="이메일 발송" description="회원들에게 이메일 알림 전송" color="yellow" />
                      <StepCard step={2} emoji="📱" title="SMS 발송" description="긴급 알림 SMS 전송" color="yellow" />
                      <StepCard step={3} emoji="📝" title="알림 템플릿" description="알림 메시지 템플릿 관리" color="yellow" />
                    </VStack>
                  </TabPanel>
                  <TabPanel px={0}>
                    <VStack spacing={2} align="stretch">
                      <StepCard step={1} emoji="👑" title="슈퍼 관리자 전용" description="상세한 회원 활동 통계 분석" color="red" />
                      <StepCard step={2} emoji="📊" title="참여도 분석" description="회원별 경기 참여도 및 활동 패턴" color="red" />
                      <StepCard step={3} emoji="📈" title="트렌드 분석" description="시간별, 월별 활동 트렌드" color="red" />
                    </VStack>
                  </TabPanel>
                  <TabPanel px={0}>
                    <VStack spacing={2} align="stretch">
                      <StepCard step={1} emoji="⚽" title="경기 현황" description="실시간 경기 진행 상황 관리" color="cyan" />
                      <StepCard step={2} emoji="👥" title="선수 배치" description="포지션별 선수 배치 및 교체" color="cyan" />
                      <StepCard step={3} emoji="📊" title="스코어 관리" description="경기 점수 및 결과 입력" color="cyan" />
                    </VStack>
                  </TabPanel>
                </TabPanels>
              </Tabs>

              <Box textAlign="center" p={2} bgGradient="linear(to-r, blue.50, purple.50)" _dark={{ bgGradient: "linear(to-r, blue.900, purple.900)", borderColor: "blue.700" }} rounded="md" border="1px" borderColor="blue.200">
                <Text fontSize="sm" color="blue.600" _dark={{ color: "blue.300" }} fontWeight="semibold">
                  💡 운영 팁: 수정 후 백/프론트 재시작으로 즉시 반영
                </Text>
              </Box>
            </VStack>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}


