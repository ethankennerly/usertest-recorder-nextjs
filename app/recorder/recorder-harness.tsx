"use client";

import {
  type AudioWarning,
  METER_MAX_DB,
  METER_MIN_DB,
  QUIET_THRESHOLD,
  useRecorder,
} from "../../lib/use-recorder";

function AudioMeter({
  level,
  warning,
  visible,
}: {
  level: number;
  warning: AudioWarning;
  visible: boolean;
}) {
  const clampedDb = Math.max(METER_MIN_DB, Math.min(METER_MAX_DB, level));
  const pct =
    ((clampedDb - METER_MIN_DB) / (METER_MAX_DB - METER_MIN_DB)) * 100;
  const thresholdPct =
    ((QUIET_THRESHOLD - METER_MIN_DB) / (METER_MAX_DB - METER_MIN_DB)) * 100;
  const emoji = warning ? "🔇" : "🎙️";

  return (
    <div
      className={`audio-meter ${visible ? "audio-meter--visible" : ""}`}
      data-testid="audio-meter"
      data-warning={warning}
      role="meter"
      aria-valuenow={level}
      aria-valuemin={METER_MIN_DB}
      aria-valuemax={METER_MAX_DB}
      aria-label="Microphone audio level"
    >
      <span className="audio-meter__icon" aria-hidden="true">
        {emoji}
      </span>
      <div className="audio-meter__track">
        <div
          className="audio-meter__threshold"
          style={{ left: `${thresholdPct}%` }}
        />
        <div
          className={`audio-meter__fill ${
            warning === "silent"
              ? "audio-meter__fill--silent"
              : warning === "quiet"
                ? "audio-meter__fill--quiet"
                : "audio-meter__fill--ok"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function RecorderHarness() {
  const { snapshot, stopRecording } = useRecorder();

  return (
    <section className="card grid">
      <div className="grid">
        <span className="kicker">Integration Harness</span>
        <div className="status-pill" data-testid="recorder-state">
          Recorder state: {snapshot.state}
        </div>
        <p>
          The recorder starts on page load and stops when the test triggers the
          Unity quit bridge.
        </p>
      </div>
      <ul className="metric-list">
        <li>
          <span className="metric-label">Recorded bytes</span>
          <span className="metric-value" data-testid="recorded-bytes">
            {snapshot.bytes}
          </span>
        </li>
        <li>
          <span className="metric-label">Final blob ready</span>
          <span className="metric-value" data-testid="blob-ready">
            {snapshot.hasFinalBlob ? "yes" : "no"}
          </span>
        </li>
        <li>
          <span className="metric-label">Final blob size</span>
          <span className="metric-value" data-testid="blob-size">
            {snapshot.blobSize}
          </span>
        </li>
        <li>
          <span className="metric-label">Stop count</span>
          <span className="metric-value" data-testid="stop-count">
            {snapshot.stopCount}
          </span>
        </li>
        <li>
          <span className="metric-label">Upload count</span>
          <span className="metric-value" data-testid="upload-count">
            {snapshot.uploadCount}
          </span>
        </li>
        <li>
          <span className="metric-label">Upload target</span>
          <span className="metric-value" data-testid="upload-target">
            {snapshot.uploadTarget ?? "pending"}
          </span>
        </li>
      </ul>
      {snapshot.state === "recording" ? (
        <AudioMeter
          level={snapshot.audioLevel}
          warning={snapshot.audioWarning}
          visible={snapshot.meterVisible}
        />
      ) : null}
      {snapshot.error ? <p className="error-text">{snapshot.error}</p> : null}
      <div>
        <button
          className="button"
          onClick={() => void stopRecording()}
          type="button"
        >
          Simulate Unity Quit
        </button>
      </div>
    </section>
  );
}
