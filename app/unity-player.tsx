"use client";

import { useEffect, useRef } from "react";
import { Unity, useUnityContext } from "react-unity-webgl";
import { log } from "../lib/recorder-log";
import { exitUnity } from "../lib/unity-exit";

type UnityPlayerProps = {
  folder: string;
  buildPrefix: string;
  name: string;
  baseUrl: string;
  assetSuffix?: string;
  stopFinal: () => Promise<void>;
  onDone: () => void;
};

export function UnityPlayer({
  folder,
  buildPrefix,
  name,
  baseUrl,
  assetSuffix,
  stopFinal,
  onDone,
}: UnityPlayerProps) {
  const base = `${baseUrl}/${folder}`;
  const suffix = assetSuffix ?? "";
  const calledQuit = useRef(false);

  const { unityProvider, loadingProgression, isLoaded, addEventListener, removeEventListener, unload } =
    useUnityContext({
      loaderUrl: `${base}/${buildPrefix}.loader.js`,
      dataUrl: `${base}/${buildPrefix}.data${suffix}`,
      frameworkUrl: `${base}/${buildPrefix}.framework.js${suffix}`,
      codeUrl: `${base}/${buildPrefix}.wasm${suffix}`,
      companyName: "UserTest Recorder",
      productName: name,
      productVersion: "1.0",
      webglContextAttributes: {
        preserveDrawingBuffer: true,
      },
      cacheControl: () => "no-store",
    });

  useEffect(() => {
    log("UnityPlayer: mounted", name);
    document.body.classList.add("game-playing");

    const canvas = document.querySelector("canvas");
    const onLost = (e: Event) => {
      e.preventDefault();
      log("UnityPlayer: webglcontextlost");
    };
    const onRestored = () => {
      log("UnityPlayer: webglcontextrestored");
    };
    canvas?.addEventListener(
      "webglcontextlost", onLost,
    );
    canvas?.addEventListener(
      "webglcontextrestored", onRestored,
    );

    return () => {
      log("UnityPlayer: unmounting", name);
      document.body.classList.remove("game-playing");
      canvas?.removeEventListener(
        "webglcontextlost", onLost,
      );
      canvas?.removeEventListener(
        "webglcontextrestored", onRestored,
      );
    };
  }, [name]);

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
      <button
        className="unity-back-button"
        data-testid="back-button"
        onClick={() =>
          void exitUnity(unload, stopFinal, onDone)
        }
        type="button"
        aria-label={`Exit ${name}`}
      >
        ✕
      </button>
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
