import { ChakraProvider } from '@chakra-ui/react';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import theme from './theme';
import './index.css';

// 프로덕션에서는 StrictMode 제거 (하이드레이션 문제 방지)
const isDevelopment = import.meta.env.DEV;
if (!isDevelopment) {
  // 운영 로그 노이즈를 줄이기 위해 info/debug성 콘솔 출력 비활성화
  console.log = () => undefined;
  console.info = () => undefined;
  console.debug = () => undefined;
}

const AppWrapper = () => (
  <ChakraProvider theme={theme} resetCSS={false}>
    <App />
  </ChakraProvider>
);

const RootComponent = isDevelopment ? (
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>
) : (
  <AppWrapper />
);

ReactDOM.createRoot(document.getElementById('root')!).render(RootComponent);
