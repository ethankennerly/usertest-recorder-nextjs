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
      uploadTarget: string | null;
      uploadKey: string | null;
      error: string | null;
      audioLevel: number;
      audioWarning: string | null;
      meterVisible: boolean;
    };
    __simulateUnityQuit?: () => Promise<void> | void;
    __simulateRemount?: () => Promise<void> | void;
  }
}
