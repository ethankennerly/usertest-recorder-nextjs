"use client";

import { useEffect, useRef } from "react";
import { Unity, useUnityContext } from "react-unity-webgl";

type UnityPlayerProps = {
  folder: string;
  buildPrefix: string;
  name: string;
  baseUrl: string;
  onBack?: () => void;
};

export function UnityPlayer({ folder, buildPrefix, name, baseUrl, onBack }: UnityPlayerProps) {
  const base = `${baseUrl}/${folder}`;
  const calledQuit = useRef(false);

  const { unityProvider, loadingProgression, isLoaded, addEventListener, removeEventListener } =
    useUnityContext({
      loaderUrl: `${base}/${buildPrefix}.loader.js`,
      dataUrl: `${base}/${buildPrefix}.data`,
      frameworkUrl: `${base}/${buildPrefix}.framework.js`,
      codeUrl: `${base}/${buildPrefix}.wasm`,
      companyName: "UserTest Recorder",
      productName: name,
      productVersion: "1.0",
      webglContextAttributes: {
        preserveDrawingBuffer: true,
      },
    });

  useEffect(() => {
    document.body.classList.add("game-playing");
    return () => {
      document.body.classList.remove("game-playing");
    };
  }, []);

  useEffect(() => {
    function handleQuit() {
      if (calledQuit.current) return;
      calledQuit.current = true;
      window.__onUnityGameQuit?.();
    }
    addEventListener("GameQuit", handleQuit);
    return () => {
      removeEventListener("GameQuit", handleQuit);
    };
  }, [addEventListener, removeEventListener]);

  const pct = Math.round(loadingProgression * 100);

  return (
    <div data-testid="unity-player" className="unity-fullscreen">
      {onBack && (
        <button
          className="unity-back-button"
          data-testid="back-button"
          onClick={onBack}
          type="button"
          aria-label={`Exit ${name}`}
        >
          ✕
        </button>
      )}
      {!isLoaded && (
        <div className="unity-loading-overlay">
          <div className="status-pill">Loading {name}... {pct}%</div>
        </div>
      )}
      <Unity
        unityProvider={unityProvider}
        style={{ width: "100%", height: "100%", flexGrow: 1 }}
      />
    </div>
  );
}
