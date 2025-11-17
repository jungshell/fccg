import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  Box,
  VStack,
  Heading,
  Text,
  Button,
  Alert,
  AlertIcon,
  useToast,
  Container
} from '@chakra-ui/react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // 에러 로깅 (실제 프로덕션에서는 Sentry 등 사용)
    this.logErrorToService(error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });
  }

  private logErrorToService(error: Error, errorInfo: ErrorInfo) {
    // 에러 정보를 서버로 전송하거나 로깅 서비스에 전송
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // localStorage에 에러 로그 저장 (임시)
    try {
      const existingLogs = JSON.parse(localStorage.getItem('errorLogs') || '[]');
      existingLogs.push(errorData);
      localStorage.setItem('errorLogs', JSON.stringify(existingLogs.slice(-10))); // 최근 10개만 유지
    } catch (e) {
      console.error('Failed to save error log:', e);
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <Container maxW="container.md" py={10}>
          <VStack spacing={6} align="center">
            <Alert status="error" borderRadius="md">
              <AlertIcon />
              <Box>
                <Heading size="md" mb={2}>오류가 발생했습니다</Heading>
                <Text fontSize="sm">
                  애플리케이션에서 예상치 못한 오류가 발생했습니다.
                </Text>
              </Box>
            </Alert>

            <Box textAlign="center">
              <Heading size="lg" color="red.500" mb={4}>
                😕 문제가 발생했습니다
              </Heading>
              <Text color="gray.600" mb={6}>
                죄송합니다. 페이지를 새로고침하거나 홈으로 돌아가서 다시 시도해주세요.
              </Text>

              <VStack spacing={3}>
                <Button
                  colorScheme="blue"
                  onClick={this.handleRetry}
                  size="lg"
                  w="200px"
                >
                  🔄 다시 시도
                </Button>
                <Button
                  variant="outline"
                  onClick={this.handleGoHome}
                  size="lg"
                  w="200px"
                >
                  🏠 홈으로 돌아가기
                </Button>
              </VStack>
            </Box>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Box
                bg="gray.50"
                p={4}
                borderRadius="md"
                w="100%"
                maxH="300px"
                overflowY="auto"
              >
                <Text fontSize="sm" fontWeight="bold" mb={2}>
                  개발자 정보 (개발 모드에서만 표시):
                </Text>
                <Text fontSize="xs" fontFamily="monospace" color="red.600">
                  {this.state.error.message}
                </Text>
                <Text fontSize="xs" fontFamily="monospace" color="gray.600" mt={2}>
                  {this.state.error.stack}
                </Text>
              </Box>
            )}
          </VStack>
        </Container>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
