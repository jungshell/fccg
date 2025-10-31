import React, { createContext, useContext, useEffect, useState } from 'react';

interface AccessibilityContextType {
  isHighContrast: boolean;
  toggleHighContrast: () => void;
  isReducedMotion: boolean;
  toggleReducedMotion: () => void;
  focusVisible: boolean;
  setFocusVisible: (visible: boolean) => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};

interface AccessibilityProviderProps {
  children: React.ReactNode;
}

export const AccessibilityProvider: React.FC<AccessibilityProviderProps> = ({ children }) => {
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);

  // 사용자 설정 로드
  useEffect(() => {
    const savedHighContrast = localStorage.getItem('highContrast') === 'true';
    const savedReducedMotion = localStorage.getItem('reducedMotion') === 'true';
    
    setIsHighContrast(savedHighContrast);
    setIsReducedMotion(savedReducedMotion);
  }, []);

  // 고대비 모드 토글
  const toggleHighContrast = () => {
    const newValue = !isHighContrast;
    setIsHighContrast(newValue);
    localStorage.setItem('highContrast', newValue.toString());
    
    // CSS 변수 적용
    if (newValue) {
      document.documentElement.style.setProperty('--chakra-colors-gray-100', '#000000');
      document.documentElement.style.setProperty('--chakra-colors-gray-800', '#ffffff');
    } else {
      document.documentElement.style.removeProperty('--chakra-colors-gray-100');
      document.documentElement.style.removeProperty('--chakra-colors-gray-800');
    }
  };

  // 모션 감소 모드 토글
  const toggleReducedMotion = () => {
    const newValue = !isReducedMotion;
    setIsReducedMotion(newValue);
    localStorage.setItem('reducedMotion', newValue.toString());
    
    // CSS 적용
    if (newValue) {
      document.documentElement.style.setProperty('--chakra-transition-duration-fast', '0s');
      document.documentElement.style.setProperty('--chakra-transition-duration-normal', '0s');
      document.documentElement.style.setProperty('--chakra-transition-duration-slow', '0s');
    } else {
      document.documentElement.style.removeProperty('--chakra-transition-duration-fast');
      document.documentElement.style.removeProperty('--chakra-transition-duration-normal');
      document.documentElement.style.removeProperty('--chakra-transition-duration-slow');
    }
  };

  // 키보드 포커스 감지
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setFocusVisible(true);
      }
    };

    const handleMouseDown = () => {
      setFocusVisible(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  // 스크린 리더를 위한 스킵 링크
  useEffect(() => {
    const skipLink = document.createElement('a');
    skipLink.href = '#main-content';
    skipLink.textContent = '메인 콘텐츠로 건너뛰기';
    skipLink.style.cssText = `
      position: absolute;
      top: -40px;
      left: 6px;
      z-index: 10000;
      padding: 8px 16px;
      background: #004ea8;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-weight: bold;
    `;
    skipLink.addEventListener('focus', () => {
      skipLink.style.top = '6px';
    });
    skipLink.addEventListener('blur', () => {
      skipLink.style.top = '-40px';
    });

    document.body.insertBefore(skipLink, document.body.firstChild);

    return () => {
      if (skipLink.parentNode) {
        skipLink.parentNode.removeChild(skipLink);
      }
    };
  }, []);

  const value: AccessibilityContextType = {
    isHighContrast,
    toggleHighContrast,
    isReducedMotion,
    toggleReducedMotion,
    focusVisible,
    setFocusVisible,
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
};

// 접근성 훅들
export const useKeyboardNavigation = () => {
  const [currentFocusIndex, setCurrentFocusIndex] = useState(0);

  const handleKeyDown = (e: React.KeyboardEvent, items: any[], onSelect?: (item: any) => void) => {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault();
        setCurrentFocusIndex((prev) => (prev + 1) % items.length);
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault();
        setCurrentFocusIndex((prev) => (prev - 1 + items.length) % items.length);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (onSelect && items[currentFocusIndex]) {
          onSelect(items[currentFocusIndex]);
        }
        break;
    }
  };

  return { currentFocusIndex, handleKeyDown, setCurrentFocusIndex };
};

// ARIA 라벨 유틸리티
export const getAriaLabel = (element: string, action?: string, context?: string) => {
  let label = element;
  if (action) label += ` ${action}`;
  if (context) label += ` (${context})`;
  return label;
};

// 포커스 관리 유틸리티
export const focusManager = {
  trap: (containerRef: React.RefObject<HTMLElement>) => {
    const container = containerRef.current;
    if (!container) return;

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);
    return () => container.removeEventListener('keydown', handleTabKey);
  },
};
