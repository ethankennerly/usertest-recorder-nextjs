import { log } from "./recorder-log";

let exiting = false;

export function resetExitState(): void {
  exiting = false;
}

export async function exitUnity(
  unload: () => Promise<void> | undefined,
  stopFinal: () => Promise<void>,
  onDone: () => void,
): Promise<void> {
  if (exiting) {
    log("exitUnity: already exiting, skip");
    return;
  }
  exiting = true;
  log("exitUnity: stopping recorder");
  await stopFinal();
  log("exitUnity: unloading WebGL");
  try {
    await unload();
    log("exitUnity: unloaded ok");
  } catch (err: unknown) {
    log("exitUnity: unload error",
      err instanceof Error ? err.message : err);
  }
  log("exitUnity: closing page");
  window.close();
  log("exitUnity: close returned");
  onDone();
}
