type KakaoLinkParams = {
  title: string;
  description: string;
  imageUrl: string;
  url: string;
};

declare global {
  interface Window {
    Kakao?: {
      init: (key: string) => void;
      isInitialized: () => boolean;
      Link: {
        sendDefault: (payload: Record<string, unknown>) => void;
      };
    };
  }
}

let kakaoSdkPromise: Promise<void> | null = null;

const KAKAO_SDK_SRC = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.5/kakao.min.js';

export async function loadKakaoSdk(appKey: string): Promise<void> {
  if (typeof window === 'undefined') return;

  if (window.Kakao?.isInitialized?.()) {
    return;
  }

  if (kakaoSdkPromise) {
    await kakaoSdkPromise;
    return;
  }

  kakaoSdkPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById('kakao-sdk') as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        try {
          if (window.Kakao && !window.Kakao.isInitialized()) {
            window.Kakao.init(appKey);
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      existingScript.addEventListener('error', reject);
      return;
    }

    const script = document.createElement('script');
    script.id = 'kakao-sdk';
    script.src = KAKAO_SDK_SRC;
    script.async = true;
    script.onload = () => {
      try {
        if (window.Kakao && !window.Kakao.isInitialized()) {
          window.Kakao.init(appKey);
        }
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });

  await kakaoSdkPromise;
}

export async function shareKakaoFeed(appKey: string, params: KakaoLinkParams) {
  await loadKakaoSdk(appKey);

  if (!window.Kakao || !window.Kakao.Link) {
    throw new Error('Kakao SDK not available');
  }

  window.Kakao.Link.sendDefault({
    objectType: 'feed',
    content: {
      title: params.title,
      description: params.description,
      imageUrl: params.imageUrl,
      link: {
        webUrl: params.url,
        mobileWebUrl: params.url,
      },
    },
    buttons: [
      {
        title: '투표 확인하기',
        link: {
          webUrl: params.url,
          mobileWebUrl: params.url,
        },
      },
    ],
  });
}
