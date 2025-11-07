import { ChakraProvider } from '@chakra-ui/react';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import theme from './theme';
import './index.css';

// 프로덕션에서는 StrictMode 제거 (하이드레이션 문제 방지)
const isDevelopment = import.meta.env.DEV;

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
