"use client";

import { useEffect, useRef } from "react";
import { Unity, useUnityContext } from "react-unity-webgl";

type UnityPlayerProps = {
  folder: string;
  buildPrefix: string;
  name: string;
  baseUrl: string;
};

export function UnityPlayer({ folder, buildPrefix, name, baseUrl }: UnityPlayerProps) {
  const base = `${baseUrl}/${folder}`;
  const calledQuit = useRef(false);

  const { unityProvider, loadingProgression, isLoaded, addEventListener, removeEventListener } =
    useUnityContext({
      loaderUrl: `${base}/${buildPrefix}.loader.js`,
      dataUrl: `${base}/${buildPrefix}.data`,
      frameworkUrl: `${base}/${buildPrefix}.framework.js`,
      codeUrl: `${base}/${buildPrefix}.wasm`,
      webglContextAttributes: {
        preserveDrawingBuffer: true,
      },
    });

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
    <div data-testid="unity-player" className="card grid">
      <h2>{name}</h2>
      {!isLoaded && (
        <div className="status-pill">Loading... {pct}%</div>
      )}
      <Unity
        unityProvider={unityProvider}
        style={{ width: "100%", aspectRatio: "16/9" }}
      />
    </div>
  );
}
