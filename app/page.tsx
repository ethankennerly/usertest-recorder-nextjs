import Link from "next/link";

export default function HomePage() {
  return (
    <main className="grid">
      <div className="card grid">
        <span className="kicker">Recorder Integration</span>
        <h1>Next.js 16 recorder harness</h1>
        <p>
          This repo hosts a minimal browser recorder page for Playwright integration
          tests.
        </p>
        <p>
          Open the recorder route to verify auto-start recording and Unity quit
          handling.
        </p>
        <div>
          <Link className="button" href="/recorder">
            Open recorder route
          </Link>
        </div>
      </div>
    </main>
  );
}
