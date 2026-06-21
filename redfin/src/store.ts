import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

const STATE_FILE = path.join(os.homedir(), ".openclaw", "redfin-seen.json");

/** Map of searchName -> { propertyId -> first-seen ISO timestamp }. */
export type SeenState = Record<string, Record<string, string>>;

export async function loadSeen(): Promise<SeenState> {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as SeenState) : {};
  } catch {
    return {};
  }
}

export async function saveSeen(state: SeenState): Promise<void> {
  await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
}
