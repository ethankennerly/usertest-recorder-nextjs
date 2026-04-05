"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRecorder } from "../lib/use-recorder";
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
  const { stopRecording } = useRecorder();

  useEffect(() => {
    fetch(CONFIG_URL)
      .then((res) => res.json())
      .then((data: BuildsConfig) => setConfig(data))
      .catch(() => {});
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
      {selectedGame ? (
        <UnityPlayer
          folder={selectedGame.folder}
          buildPrefix={selectedGame.buildPrefix}
          name={selectedGame.name}
          baseUrl={config.baseUrl}
          onBack={() => setSelectedGame(null)}
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
        </>
      )}
    </main>
  );
}
