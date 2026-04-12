const VERBOSE =
  process.env.NEXT_PUBLIC_RECORDER_VERBOSE === "true";

export function log(...args: unknown[]) {
  if (!VERBOSE) return;
  const message = ["[recorder]", ...args]
    .map((a) =>
      typeof a === "string" ? a : String(a),
    )
    .join(" ");
  console.log(message);
  if (
    typeof navigator !== "undefined" &&
    navigator.sendBeacon
  ) {
    navigator.sendBeacon(
      "/api/recorder-log",
      new Blob(
        [JSON.stringify({ message })],
        { type: "application/json" },
      ),
    );
  }
}
