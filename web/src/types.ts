export type PetType = "cat" | "dog" | "bird" | "fish";
export type PetTier = "normal" | "uncommon" | "rare" | "legendary" | "mythical" | "god";
export type SwordTier = "wood" | "metal" | "silver" | "gold" | "jade" | "diamond";
export type Phase = "pet-select" | "playing";
export type PlacingMode = "block" | "gun" | null;

export interface Pet {
  type: PetType;
  tier: PetTier;
  hp: number;
  maxHp: number;
}

export interface Block {
  id: string;
  col: number;
  row: number;
  hp: number;
  maxHp: number;
}

export interface Gun {
  id: string;
  col: number;
  row: number;
  cooldown: number;
  cooldownMax: number;
}

export interface Bullet {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetId: string;
}

export interface Monster {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  attackCooldown: number;
  attackTimer: number;
  emoji: string;
  wave: number;
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

// A visual slash effect shown when the player clicks a monster
export interface SlashEffect {
  id: string;
  x: number;
  y: number;
  life: number;
  maxLife: number;
}

export interface GameState {
  phase: Phase;
  coins: number;
  wave: number;
  waveActive: boolean;
  pet: Pet | null;
  blocks: Block[];
  guns: Gun[];
  bullets: Bullet[];
  monsters: Monster[];
  floatingTexts: FloatingText[];
  slashEffects: SlashEffect[];
  swordTier: SwordTier;
  placingMode: PlacingMode;
  gameOver: boolean;
  monstersKilled: number;
  swordCooldown: number; // ms remaining before sword can swing again
}

export const PET_TIER_ORDER: PetTier[] = ["normal", "uncommon", "rare", "legendary", "mythical", "god"];
export const SWORD_TIER_ORDER: SwordTier[] = ["wood", "metal", "silver", "gold", "jade", "diamond"];

export const PET_UPGRADE_COST: Record<PetTier, number | null> = {
  normal: 5,
  uncommon: 7,
  rare: 10,
  legendary: 15,
  mythical: 20,
  god: null,
};

export const SWORD_UPGRADE_COST: Record<SwordTier, number | null> = {
  wood: 5,
  metal: 7,
  silver: 10,
  gold: 15,
  jade: 20,
  diamond: null,
};

// Click-damage per sword tier (one swing)
export const SWORD_CLICK_DAMAGE: Record<SwordTier, number> = {
  wood: 15,
  metal: 28,
  silver: 45,
  gold: 70,
  jade: 100,
  diamond: 999,
};

// Passive aura damage per second (kept low so clicking is the main mechanic)
export const SWORD_DAMAGE: Record<SwordTier, number> = {
  wood: 4,
  metal: 8,
  silver: 14,
  gold: 22,
  jade: 32,
  diamond: 50,
};

// How long between sword clicks (ms)
export const SWORD_COOLDOWN_MS: Record<SwordTier, number> = {
  wood: 700,
  metal: 600,
  silver: 500,
  gold: 400,
  jade: 300,
  diamond: 200,
};

export const PET_TIER_COLORS: Record<PetTier, string> = {
  normal: "#9ca3af",
  uncommon: "#22c55e",
  rare: "#3b82f6",
  legendary: "#f59e0b",
  mythical: "#a855f7",
  god: "#ef4444",
};

export const PET_EMOJIS: Record<PetType, string> = {
  cat: "🐱",
  dog: "🐶",
  bird: "🐦",
  fish: "🐟",
};

export const SWORD_EMOJIS: Record<SwordTier, string> = {
  wood: "🪵",
  metal: "⚔️",
  silver: "🗡️",
  gold: "✨",
  jade: "💎",
  diamond: "💠",
};

export const SWORD_COLORS: Record<SwordTier, string> = {
  wood: "#a16207",
  metal: "#6b7280",
  silver: "#e2e8f0",
  gold: "#f59e0b",
  jade: "#10b981",
  diamond: "#38bdf8",
};

export const GRID_COLS = 15;
export const GRID_ROWS = 13;
export const BLOCK_HP = 5;
export const BLOCK_COST = 3;
export const GUN_COST = 7;
export const PET_COL = 7;
export const PET_ROW = 6;
