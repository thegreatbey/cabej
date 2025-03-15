/// <reference types="vite/client" />

interface Window {
  global: typeof window;
  process: {
    env: Record<string, string>;
  };
  Buffer: {
    isBuffer: (obj: any) => boolean;
    from: (data: any, encoding?: string) => any;
  };
}

// Global augmentations
declare global {
  var global: typeof window;
  var process: {
    env: Record<string, string>;
  };
  var Buffer: {
    isBuffer: (obj: any) => boolean;
    from: (data: any, encoding?: string) => any;
  };
} 