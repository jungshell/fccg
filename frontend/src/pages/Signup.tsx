import { useState } from 'react';
import type { FC } from 'react';
import { Box, Button, FormLabel, Input, Heading, VStack, useToast, ModalCloseButton, FormControl } from '@chakra-ui/react';
import { useAuthStore } from '../store/auth';
import { register } from '../api/auth';
import { useNavigate } from 'react-router-dom';

interface SignupProps {
  onSwitch?: () => void;
  onClose?: () => void;
}

const Signup: FC<SignupProps> = ({ onSwitch, onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const setUser = useAuthStore((s) => s.setUser);
  const setToken = useAuthStore((s) => s.setToken);
  const toast = useToast();
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // 필수 필드 검증
    if (!email || !password || !name) {
      toast({ 
        title: '회원가입 실패', 
        description: '필수 항목을 모두 입력해주세요.', 
        status: 'error', 
        duration: 3000, 
        isClosable: true 
      });
      return;
    }
    
    setLoading(true);
    try {
      const registerData = { email, password, name, phone };
      console.log('🔍 회원가입 데이터 전송:', { 
        email, 
        password: password ? '***' : undefined, 
        name, 
        phone,
        hasEmail: !!email,
        hasPassword: !!password,
        hasName: !!name
      });
      
      const result = await register(registerData);
      console.log('✅ 회원가입 응답:', result);
      const user = result.user;
      const token = result.token;
      
      if (user) {
        setUser(user);
        if (token) {
          setToken(token);
        }
        toast({ title: '회원가입 성공', status: 'success', duration: 2000, isClosable: true });
        if (onClose) onClose();
        navigate('/');
      } else {
        throw new Error('회원가입 응답에 사용자 정보가 없습니다.');
      }
    } catch (err: unknown) {
      console.error('❌ 회원가입 오류:', err);
      let errorMsg = '오류 발생';
      
      if (err && typeof err === 'object' && 'response' in err) {
        const fetchError = err as { response?: { data?: { error?: string; message?: string }; status?: number }; message?: string };
        
        // 타임아웃 또는 네트워크 오류
        if (fetchError.response?.status === 0 || fetchError.response?.status === 408) {
          errorMsg = fetchError.message || '네트워크 연결을 확인해주세요.';
        } else if (fetchError.response?.status === 400) {
          errorMsg = fetchError.response.data?.error || fetchError.response.data?.message || '입력 정보를 확인해주세요.';
        } else if (fetchError.response?.status === 409) {
          errorMsg = '이미 존재하는 이메일입니다.';
        } else if (fetchError.response?.status === 404) {
          errorMsg = '회원가입 서비스를 찾을 수 없습니다. 잠시 후 다시 시도해주세요.';
        } else if (fetchError.response?.status === 500) {
          errorMsg = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        } else if (fetchError.response?.data?.error) {
          errorMsg = fetchError.response.data.error;
        } else if (fetchError.response?.data?.message) {
          errorMsg = fetchError.response.data.message;
        } else if (fetchError.message) {
          errorMsg = fetchError.message;
        }
      } else if (err && typeof err === 'object' && 'message' in err) {
        errorMsg = (err as { message: string }).message;
      }
      
      toast({ 
        title: '회원가입 실패', 
        description: errorMsg, 
        status: 'error', 
        duration: 5000, 
        isClosable: true 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box bgGradient="linear(to-br, #004ea8, #1f2937)" borderRadius="xl" p={0} px={8} py={8} minHeight="320px" alignSelf="center" position="relative">
      {onSwitch && (
        <ModalCloseButton
          color="white"
          position="absolute"
          top="1rem"
          right="1rem"
          zIndex={100}
          size="lg"
          bg="rgba(0,0,0,0.25)"
          _hover={{ bg: 'rgba(0,0,0,0.35)' }}
          _focus={{ boxShadow: 'none' }}
          borderRadius="full"
          m={0}
          transform="none"
          onClick={onSwitch}
        />
      )}
      <Box bg="white" borderRadius="xl" p={8} boxShadow="lg" w="full" maxW="sm" minW={320}>
        <Heading mb={6} color="#004ea8" fontFamily="Pretendard, Inter, sans-serif" fontWeight="bold" textAlign="center">회원가입</Heading>
        <form onSubmit={handleSignup}>
          <VStack spacing={4}>
            <FormControl id="email" isRequired>
              <FormLabel>이메일</FormLabel>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="이메일을 입력하세요" rounded="lg" bg="gray.50" _dark={{ bg: '#374151' }} />
            </FormControl>
            <FormControl id="password" isRequired>
              <FormLabel>비밀번호</FormLabel>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="비밀번호를 입력하세요" rounded="lg" bg="gray.50" _dark={{ bg: '#374151' }} />
            </FormControl>
            <FormControl id="name" isRequired>
              <FormLabel>이름</FormLabel>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="이름을 입력하세요" rounded="lg" bg="gray.50" _dark={{ bg: '#374151' }} />
            </FormControl>
            <FormControl id="phone">
              <FormLabel>휴대폰 번호</FormLabel>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="휴대폰 번호 (선택)" rounded="lg" bg="gray.50" _dark={{ bg: '#374151' }} />
            </FormControl>
            <Button type="submit" colorScheme="blue" bg="#004ea8" _hover={{ bg: '#00397a' }} w="full" rounded="lg" isLoading={loading} fontWeight="bold">회원가입</Button>
            {onSwitch && (
              <Button
                variant="outline"
                color="#004ea8"
                borderColor="#004ea8"
                borderWidth={1}
                borderStyle="solid"
                rounded="lg"
                w="full"
                mt={2}
                fontWeight="bold"
                bg="white"
                _hover={{ bg: '#e6f0fa' }}
                onClick={onSwitch}
              >
                이미 계정이 있으신가요? 로그인
              </Button>
            )}
          </VStack>
        </form>
      </Box>
    </Box>
  );
};

export default Signup; 