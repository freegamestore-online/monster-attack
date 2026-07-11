import { GameState } from "../types";

const SAVE_KEY = "monster-attack_save";
const SAVE_VERSION = 2;

interface SaveData {
  version: number;
  state: GameState;
}

/** Strip transient runtime-only fields before saving */
function sanitizeForSave(state: GameState): GameState {
  return {
    ...state,
    // Clear bullets/floatingTexts/slashEffects — they're mid-frame ephemera
    bullets: [],
    floatingTexts: [],
    slashEffects: [],
    // If a wave was active when we left, pause it — monsters stay but wave
    // won't auto-resume until the player presses MONSTER ATTACK again.
    // We keep the monsters so the player can see the state, but mark wave inactive.
    waveActive: false,
    swordCooldown: 0,
    placingMode: null,
  };
}

export function saveGame(state: GameState): void {
  // Don't save the pet-select screen or a finished game-over
  if (state.phase === "pet-select") return;
  try {
    const data: SaveData = {
      version: SAVE_VERSION,
      state: sanitizeForSave(state),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (data.version !== SAVE_VERSION) {
      // Version mismatch — discard old save
      localStorage.removeItem(SAVE_KEY);
      return null;
    }
    const s = data.state;
    // Basic sanity checks
    if (!s || typeof s !== "object") return null;
    if (s.phase !== "playing") return null;
    if (!s.pet) return null;
    return s;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}

export function hasSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}
