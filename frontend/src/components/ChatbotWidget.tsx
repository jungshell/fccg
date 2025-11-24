import { useEffect, useRef, useState } from 'react';
import {
  Box,
  IconButton,
  Textarea,
  Button,
  VStack,
  HStack,
  Text,
  useColorModeValue,
  Spinner,
  Collapse
} from '@chakra-ui/react';
import { ChatIcon, CloseIcon } from '@chakra-ui/icons';
import { askChatbot } from '../api/auth';

type Message = {
  from: 'bot' | 'user';
  text: string;
};

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      from: 'bot',
      text: '안녕하세요! 홈페이지 이용법이나 일정/투표 관련 질문을 도와드릴게요.'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const bg = useColorModeValue('white', 'gray.800');
  const buttonColor = useColorModeValue('purple.600', 'purple.300');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setInput('');
    }
  }, [isOpen]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [...prev, { from: 'user', text: trimmed }]);
    setInput('');
    setLoading(true);

    try {
      const response = await askChatbot(trimmed);
      const answer =
        response?.answer ||
        '답변을 준비하는 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.';
      setMessages((prev) => [...prev, { from: 'bot', text: answer }]);
    } catch (error) {
      console.error('챗봇 호출 오류:', error);
      setMessages((prev) => [
        ...prev,
        { from: 'bot', text: '서버와 통신 중 오류가 발생했어요. 네트워크를 확인해주세요.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if ((e.nativeEvent as any).isComposing) return;
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box position="fixed" bottom={{ base: 4, md: 6 }} right={{ base: 4, md: 6 }} zIndex={20}>
      <IconButton
        aria-label="챗봇 열기"
        icon={isOpen ? <CloseIcon /> : <ChatIcon />}
        colorScheme="purple"
        borderRadius="full"
        size="lg"
        boxShadow="0 4px 12px rgba(0,0,0,0.2)"
        onClick={() => setIsOpen((prev) => !prev)}
      />
      <Collapse in={isOpen} animateOpacity unmountOnExit>
        <Box
          mt={3}
          w={{ base: '80vw', md: '360px' }}
          maxW="360px"
          bg={bg}
          borderRadius="xl"
          boxShadow="2xl"
          p={4}
        >
          <Text fontWeight="bold" mb={3}>
            FC CHAL-GGYO 도우미
          </Text>
          <VStack
            spacing={3}
            align="stretch"
            maxH="320px"
            overflowY="auto"
            pr={1}
            mb={3}
            sx={{
              '&::-webkit-scrollbar': {
                width: '4px'
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(0,0,0,0.2)',
                borderRadius: 'full'
              }
            }}
          >
            {messages.map((msg, idx) => (
              <Box
                key={`${msg.from}-${idx}`}
                alignSelf={msg.from === 'user' ? 'flex-end' : 'flex-start'}
                bg={msg.from === 'user' ? 'purple.500' : 'gray.100'}
                color={msg.from === 'user' ? 'white' : 'gray.800'}
                px={3}
                py={2}
                borderRadius="lg"
                maxW="80%"
                whiteSpace="pre-line"
                fontSize="sm"
              >
                {msg.text}
              </Box>
            ))}
            <div ref={messagesEndRef} />
            {loading && (
              <HStack spacing={2} color="gray.500" fontSize="sm">
                <Spinner size="sm" />
                <Text>답변을 준비 중입니다...</Text>
              </HStack>
            )}
          </VStack>
          <Textarea
            placeholder="질문을 입력하세요"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            size="sm"
            resize="none"
            rows={3}
            mb={2}
          />
          <Button
            w="full"
            colorScheme="purple"
            bg={buttonColor}
            onClick={handleSend}
            isDisabled={loading || !input.trim()}
          >
            보내기
          </Button>
        </Box>
      </Collapse>
    </Box>
  );
}

