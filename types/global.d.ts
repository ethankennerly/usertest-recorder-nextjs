export {};

declare global {
  interface Window {
    __recorderTest?: {
      state: string;
      bytes: number;
      stopCount: number;
      hasFinalBlob: boolean;
      blobSize: number;
      uploadCount: number;
      uploadMethod: string | null;
      uploadContentType: string | null;
      error: string | null;
    };
    __simulateUnityQuit?: () => Promise<void> | void;
  }
}
