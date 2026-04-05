import { RecorderHarness } from "./recorder-harness";

const unityGameTitle =
  process.env.NEXT_PUBLIC_UNITY_GAME_TITLE ?? "Mock Unity Game";

export default function RecorderPage() {
  return (
    <main className="grid">
      <div className="card grid">
        <span className="kicker">Recorder Route</span>
        <h1>{unityGameTitle}</h1>
        <p>
          This page auto-starts a browser recording session and exposes test hooks
          for Playwright.
        </p>
      </div>
      <RecorderHarness />
    </main>
  );
}
