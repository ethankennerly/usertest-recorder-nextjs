"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRecorder } from "../lib/use-recorder";
import { log } from "../lib/recorder-log";
import { UnityPlayer } from "./unity-player";

type GameEntry = {
  folder: string;
  buildPrefix: string;
  name: string;
  icon?: string;
};

type BuildsConfig = {
  pageTitle: string;
  pageDescription: string;
  baseUrl: string;
  games: GameEntry[];
};

const CONFIG_URL =
  process.env.NEXT_PUBLIC_UNITY_BUILDS_CONFIG_URL ?? "/unity-builds-config.json";

export default function HomePage() {
  const [config, setConfig] = useState<BuildsConfig | null>(null);
  const [selectedGame, setSelectedGame] = useState<GameEntry | null>(null);
  const [exited, setExited] = useState(false);
  const { snapshot, stopRecording, stopFinal } = useRecorder();

  useEffect(() => {
    log("HomePage: fetching config from", CONFIG_URL);
    fetch(CONFIG_URL)
      .then((res) => res.json())
      .then((data: BuildsConfig) => {
        log("HomePage: config loaded, games:",
          data.games?.length);
        setConfig(data);
      })
      .catch((err) => {
        log("HomePage: config fetch error", err);
      });
  }, []);

  useEffect(() => {
    const onVis = () =>
      log("visibilitychange:",
        document.visibilityState);
    const onHide = () => log("pagehide fired");
    document.addEventListener(
      "visibilitychange", onVis,
    );
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener(
        "visibilitychange", onVis,
      );
      window.removeEventListener(
        "pagehide", onHide,
      );
    };
  }, []);

  useEffect(() => {
    window.__onUnityGameQuit = () => {
      void stopRecording();
    };
    return () => {
      delete window.__onUnityGameQuit;
    };
  }, [stopRecording]);

  if (!config) {
    return (
      <main className="grid">
        <p>Loading games...</p>
      </main>
    );
  }

  return (
    <main className="grid">
      {exited ? (
        <div className="card grid" data-testid="done-message">
          <h1>Recording uploaded</h1>
          <p>You may close this tab.</p>
        </div>
      ) : selectedGame ? (
        <UnityPlayer
          folder={selectedGame.folder}
          buildPrefix={selectedGame.buildPrefix}
          name={selectedGame.name}
          baseUrl={config.baseUrl}
          stopFinal={stopFinal}
          onDone={() => setExited(true)}
        />
      ) : (
        <>
          <div className="card grid">
            <h1>{config.pageTitle}</h1>
            <p data-testid="page-description">{config.pageDescription}</p>
          </div>
          <div className="game-grid">
            {config.games.map((game) => (
              <button
                key={game.folder}
                className="game-card"
                data-testid="game-button"
                onClick={() => setSelectedGame(game)}
                type="button"
              >
                {game.icon && (
                  <Image
                    className="game-card__icon"
                    src={game.icon}
                    alt={game.name}
                    width={160}
                    height={160}
                    unoptimized
                  />
                )}
                <span className="game-card__name">{game.name}</span>
              </button>
            ))}
          </div>
          {snapshot.error && (
            <p className="error-text" data-testid="recorder-error">
              {snapshot.error}
            </p>
          )}
        </>
      )}
    </main>
  );
}
