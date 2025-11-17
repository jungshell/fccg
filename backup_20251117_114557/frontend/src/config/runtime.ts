declare global {
  interface Window {
    __APP_CONFIG__?: { API_BASE_URL?: string };
  }
}

let cachedBaseUrl: string | null = null;

export async function getRuntimeApiBaseUrl(): Promise<string | null> {
  if (cachedBaseUrl !== null) return cachedBaseUrl;

  // 1) window 주입값 우선
  const fromWindow = typeof window !== 'undefined' ? window.__APP_CONFIG__?.API_BASE_URL : undefined;
  if (fromWindow && fromWindow.trim()) {
    cachedBaseUrl = normalizeBaseUrl(fromWindow);
    return cachedBaseUrl;
  }

  // 2) public/app-config.json 런타임 로드
  try {
    const res = await fetch('/app-config.json', { cache: 'no-cache' });
    if (res.ok) {
      const json = (await res.json()) as { API_BASE_URL?: string };
      if (json.API_BASE_URL && json.API_BASE_URL.trim()) {
        cachedBaseUrl = normalizeBaseUrl(json.API_BASE_URL);
        return cachedBaseUrl;
      }
    }
  } catch {
    // 무시: 런타임 파일이 없을 수 있음
  }

  cachedBaseUrl = null;
  return cachedBaseUrl;
}

export function normalizeBaseUrl(value: string): string {
  const v = value.trim();
  if (v.endsWith('/')) return v.slice(0, -1);
  return v;
}

export function buildUrl(baseUrl: string, path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/')) return `${baseUrl}${path}`;
  return `${baseUrl}/${path}`;
}


