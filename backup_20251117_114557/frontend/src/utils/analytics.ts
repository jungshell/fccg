// Google Analytics 유틸리티
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

// Google Analytics 초기화
export const initGA = (measurementId: string) => {
  if (typeof window !== 'undefined') {
    // Google Analytics 스크립트 로드
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);

    // gtag 함수 초기화
    window.dataLayer = window.dataLayer || [];
    window.gtag = function() {
      window.dataLayer.push(arguments);
    };

    // 기본 설정
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      page_title: document.title,
      page_location: window.location.href,
    });
  }
};

// 페이지뷰 추적
export const trackPageView = (page: string, title?: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', process.env.REACT_APP_GA_MEASUREMENT_ID, {
      page_title: title || document.title,
      page_location: window.location.href,
      page_path: page,
    });
  }
};

// 이벤트 추적
export const trackEvent = (
  action: string,
  category: string,
  label?: string,
  value?: number
) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
};

// 사용자 행동 추적
export const trackUserBehavior = {
  // 로그인 추적
  login: (method: string) => {
    trackEvent('login', 'user_action', method);
  },

  // 로그아웃 추적
  logout: () => {
    trackEvent('logout', 'user_action');
  },

  // 페이지 방문 추적
  pageVisit: (page: string) => {
    trackEvent('page_view', 'navigation', page);
  },

  // 버튼 클릭 추적
  buttonClick: (buttonName: string, page: string) => {
    trackEvent('click', 'button', `${page}_${buttonName}`);
  },

  // 폼 제출 추적
  formSubmit: (formName: string, success: boolean) => {
    trackEvent('form_submit', 'form', formName, success ? 1 : 0);
  },

  // 파일 업로드 추적
  fileUpload: (fileType: string, fileSize: number) => {
    trackEvent('file_upload', 'media', fileType, fileSize);
  },

  // 검색 추적
  search: (query: string, results: number) => {
    trackEvent('search', 'search', query, results);
  },

  // 다운로드 추적
  download: (fileType: string) => {
    trackEvent('download', 'media', fileType);
  },

  // 오류 추적
  error: (errorType: string, errorMessage: string) => {
    trackEvent('error', 'system', errorType, 1);
  },

  // 성능 추적
  performance: (metric: string, value: number) => {
    trackEvent('performance', 'system', metric, value);
  },
};

// 사용자 속성 설정
export const setUserProperties = (properties: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', process.env.REACT_APP_GA_MEASUREMENT_ID, {
      custom_map: properties,
    });
  }
};

// 사용자 ID 설정
export const setUserId = (userId: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', process.env.REACT_APP_GA_MEASUREMENT_ID, {
      user_id: userId,
    });
  }
};

// 전환 추적
export const trackConversion = (conversionId: string, conversionLabel: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'conversion', {
      send_to: `${process.env.REACT_APP_GA_MEASUREMENT_ID}/${conversionId}/${conversionLabel}`,
    });
  }
};
