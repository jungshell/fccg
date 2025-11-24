import { useState } from 'react';
import { Box, Button, FormControl, FormLabel, Input, Text, useToast } from '@chakra-ui/react';
import { useAuthStore } from '../store/auth';
import { updateProfile } from '../api/auth';

export default function ProfilePage() {
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.token);
  const setUser = useAuthStore(s => s.setUser);
  const [name, setName] = useState(user?.name || '');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  if (!user || !token) {
    return <Box p={8} textAlign="center">로그인이 필요합니다.</Box>;
  }

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await updateProfile({ name });
      // 백엔드 응답 형식: { success: true, message: '...', user: {...} }
      const updatedUser = response.user || response;
      setUser(updatedUser);
      toast({ title: '이름이 수정되었습니다.', status: 'success', duration: 2000 });
    } catch (error: any) {
      console.error('프로필 업데이트 오류:', error);
      const errorMessage = error?.response?.data?.message || error?.message || '이름 수정 실패';
      toast({ title: errorMessage, status: 'error', duration: 2000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box maxW="400px" mx="auto" mt={12} p={8} bg="white" borderRadius="lg" boxShadow="md">
      <Text fontWeight="bold" fontSize="xl" mb={6}>내 정보 수정</Text>
      <FormControl mb={4}>
        <FormLabel>이름</FormLabel>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="이름을 입력하세요" />
      </FormControl>
      <Button colorScheme="blue" w="full" onClick={handleSave} isLoading={loading} isDisabled={!name.trim() || name === user.name}>저장</Button>
    </Box>
  );
} 