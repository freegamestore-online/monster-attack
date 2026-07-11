import { useState, useRef, useEffect, useCallback } from "react";
import { GameShell, GameTopbar } from "@freegamestore/games";
import {
  GameState, PetType, Phase,
  PET_EMOJIS, PET_TIER_COLORS, SWORD_EMOJIS,
  SWORD_TIER_ORDER, PET_TIER_ORDER,
  SWORD_UPGRADE_COST, PET_UPGRADE_COST,
  GRID_COLS, GRID_ROWS, PET_COL, PET_ROW, BLOCK_HP, GUN_COST, BLOCK_COST,
} from "./types";
import {
  startWave, tickGame, buyBlock, buyGun, placeItem,
  upgradeSword, upgradePet, nextId,
} from "./lib/gameLogic";

// ── initial state ─────────────────────────────────────────────────────────────
function makeInitialState(): GameState {
  return {
    phase: "pet-select",
    coins: 15,
    wave: 0,
    waveActive: false,
    pet: null,
    blocks: [],
    guns: [],
    bullets: [],
    monsters: [],
    floatingTexts: [],
    swordTier: "wood",
    placingMode: null,
    gameOver: false,
    monstersKilled: 0,
  };
}

// ── PetSelect screen ──────────────────────────────────────────────────────────
function PetSelect({ onSelect }: { onSelect: (p: PetType) => void }) {
  const pets: PetType[] = ["cat", "dog", "bird", "fish"];
  const labels: Record<PetType, string> = { cat: "Cat", dog: "Dog", bird: "Bird", fish: "Fish" };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-4">
      <h1 className="text-4xl font-bold text-center" style={{ fontFamily: "Fraunces, serif", color: "var(--ink)" }}>
        🐾 Choose Your Pet!
      </h1>
      <p className="text-base" style={{ color: "var(--muted)" }}>Your pet needs your protection — choose wisely!</p>
      <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
        {pets.map(p => (
          <button
            key={p}
            onClick={() => onSelect(p)}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 transition-all active:scale-95 cursor-pointer"
            style={{
              background: "var(--panel)",
              borderColor: "var(--line)",
              minHeight: 110,
              fontSize: 56,
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--line)")}
          >
            <span>{PET_EMOJIS[p]}</span>
            <span className="text-base font-semibold" style={{ color: "var(--ink)", fontSize: 16 }}>{labels[p]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Game Over screen ──────────────────────────────────────────────────────────
function GameOver({ wave, killed, onRestart }: { wave: number; killed: number; onRestart: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 px-4">
      <div className="text-7xl">💀</div>
      <h1 className="text-4xl font-bold text-center" style={{ fontFamily: "Fraunces, serif", color: "var(--error)" }}>
        Your Pet Fell!
      </h1>
      <div className="flex flex-col items-center gap-1" style={{ color: "var(--muted)" }}>
        <p>Survived <strong style={{ color: "var(--ink)" }}>{wave}</strong> wave{wave !== 1 ? "s" : ""}</p>
        <p>Monsters killed: <strong style={{ color: "var(--ink)" }}>{killed}</strong></p>
      </div>
      <button
        onClick={onRestart}
        className="px-8 py-3 rounded-xl font-bold text-white text-lg transition-all active:scale-95"
        style={{ background: "var(--accent)", minHeight: 48 }}
      >
        Play Again
      </button>
    </div>
  );
}

// ── Main Game ─────────────────────────────────────────────────────────────────
const CELL = 44; // cell size in px

function GameBoard({
  state,
  onCellClick,
  canvasRef,
}: {
  state: GameState;
  onCellClick: (col: number, row: number) => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const col = Math.floor(x / CELL);
    const row = Math.floor(y / CELL);
    onCellClick(col, row);
  }, [onCellClick]);

  const handleTouch = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    if (!touch) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const col = Math.floor(x / CELL);
    const row = Math.floor(y / CELL);
    onCellClick(col, row);
  }, [onCellClick]);

  // Draw on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = GRID_COLS * CELL;
    const H = GRID_ROWS * CELL;
    ctx.clearRect(0, 0, W, H);

    // Grid background
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    ctx.fillStyle = isDark ? "#111827" : "#f0fdf4";
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
    ctx.lineWidth = 1;
    for (let c = 0; c <= GRID_COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, H); ctx.stroke();
    }
    for (let r = 0; r <= GRID_ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(W, r * CELL); ctx.stroke();
    }

    // Hover hint for placing mode
    if (state.placingMode) {
      ctx.fillStyle = "rgba(37,99,235,0.08)";
      ctx.fillRect(0, 0, W, H);
    }

    // Blocks
    for (const block of state.blocks) {
      const x = block.col * CELL;
      const y = block.row * CELL;
      const ratio = block.hp / block.maxHp;
      const r = Math.floor(139 + (1 - ratio) * 116);
      const g = Math.floor(90 * ratio);
      ctx.fillStyle = `rgb(${r},${g},50)`;
      ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
      ctx.strokeStyle = "#92400e";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, CELL - 4, CELL - 4);
      // HP pips
      for (let i = 0; i < BLOCK_HP; i++) {
        ctx.fillStyle = i < block.hp ? "#fbbf24" : "rgba(0,0,0,0.3)";
        ctx.beginPath();
        ctx.arc(x + 7 + i * 7, y + CELL - 8, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      // brick emoji
      ctx.font = `${CELL * 0.55}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🧱", x + CELL / 2, y + CELL / 2 - 4);
    }

    // Guns
    for (const gun of state.guns) {
      const x = gun.col * CELL;
      const y = gun.row * CELL;
      ctx.fillStyle = isDark ? "#1e3a5f" : "#dbeafe";
      ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
      ctx.strokeStyle = "#1d4ed8";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, CELL - 4, CELL - 4);
      ctx.font = `${CELL * 0.6}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🔫", x + CELL / 2, y + CELL / 2);
    }

    // Pet
    if (state.pet) {
      const px = PET_COL * CELL;
      const py = PET_ROW * CELL;
      // Glow
      const tierColor = PET_TIER_COLORS[state.pet.tier];
      const grd = ctx.createRadialGradient(px + CELL / 2, py + CELL / 2, 4, px + CELL / 2, py + CELL / 2, CELL * 0.8);
      grd.addColorStop(0, tierColor + "88");
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.fillRect(px - CELL * 0.3, py - CELL * 0.3, CELL * 1.6, CELL * 1.6);

      ctx.font = `${CELL * 0.7}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(PET_EMOJIS[state.pet.type], px + CELL / 2, py + CELL / 2);

      // HP bar
      const barW = CELL * 1.4;
      const barX = px + CELL / 2 - barW / 2;
      const barY = py + CELL + 2;
      ctx.fillStyle = "#374151";
      ctx.fillRect(barX, barY, barW, 5);
      ctx.fillStyle = tierColor;
      ctx.fillRect(barX, barY, barW * (state.pet.hp / state.pet.maxHp), 5);
    }

    // Bullets
    for (const bullet of state.bullets) {
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Monsters
    for (const monster of state.monsters) {
      ctx.font = `${CELL * 0.65}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(monster.emoji, monster.x, monster.y);

      // HP bar
      const barW = CELL * 1.1;
      const barX = monster.x - barW / 2;
      const barY = monster.y - CELL * 0.5;
      ctx.fillStyle = "#374151";
      ctx.fillRect(barX, barY, barW, 4);
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(barX, barY, barW * (monster.hp / monster.maxHp), 4);
    }

    // Floating texts
    for (const ft of state.floatingTexts) {
      const alpha = ft.life / ft.maxLife;
      ctx.globalAlpha = alpha;
      ctx.font = "bold 14px Manrope, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.globalAlpha = 1;
    }

  }, [state, canvasRef]);

  return (
    <div ref={containerRef} className="relative" style={{ lineHeight: 0 }}>
      <canvas
        ref={canvasRef}
        width={GRID_COLS * CELL}
        height={GRID_ROWS * CELL}
        onClick={handleClick}
        onTouchEnd={handleTouch}
        style={{
          cursor: state.placingMode ? "crosshair" : "default",
          touchAction: "none",
          display: "block",
          maxWidth: "100%",
        }}
      />
    </div>
  );
}

// ── Shop Panel ────────────────────────────────────────────────────────────────
function ShopPanel({
  state,
  onBuyBlock,
  onBuyGun,
  onUpgradeSword,
  onUpgradePet,
  onCancelPlace,
}: {
  state: GameState;
  onBuyBlock: () => void;
  onBuyGun: () => void;
  onUpgradeSword: () => void;
  onUpgradePet: () => void;
  onCancelPlace: () => void;
}) {
  const swordIdx = SWORD_TIER_ORDER.indexOf(state.swordTier);
  const nextSword = SWORD_TIER_ORDER[swordIdx + 1];
  const swordCost = SWORD_UPGRADE_COST[state.swordTier];

  const petTier = state.pet?.tier ?? "normal";
  const petIdx = PET_TIER_ORDER.indexOf(petTier);
  const nextPetTier = PET_TIER_ORDER[petIdx + 1];
  const petCost = PET_UPGRADE_COST[petTier];

  const btnBase: React.CSSProperties = {
    minHeight: 44,
    borderRadius: 10,
    fontFamily: "Manrope, sans-serif",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    border: "2px solid transparent",
    transition: "opacity 0.15s",
    padding: "6px 10px",
    width: "100%",
    textAlign: "left",
    display: "flex",
    alignItems: "center",
    gap: 6,
  };

  return (
    <div className="flex flex-col gap-2 overflow-y-auto" style={{ color: "var(--ink)" }}>
      {state.placingMode && (
        <div
          className="rounded-xl p-2 text-center text-sm font-semibold"
          style={{ background: "#dbeafe", color: "#1d4ed8", marginBottom: 2 }}
        >
          📍 Click grid to place {state.placingMode === "block" ? "🧱 Block" : "🔫 Gun"}
          <button
            onClick={onCancelPlace}
            className="ml-2 underline text-xs"
            style={{ color: "#dc2626", cursor: "pointer", background: "none", border: "none" }}
          >cancel</button>
        </div>
      )}

      <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Build</div>

      <button
        onClick={onBuyBlock}
        disabled={state.coins < BLOCK_COST || !!state.placingMode}
        style={{
          ...btnBase,
          background: state.coins >= BLOCK_COST ? "#78350f" : "var(--panel)",
          color: state.coins >= BLOCK_COST ? "#fef3c7" : "var(--muted)",
          opacity: state.coins < BLOCK_COST || !!state.placingMode ? 0.5 : 1,
        }}
      >
        🧱 <span>Block</span>
        <span className="ml-auto text-yellow-400 font-bold">{BLOCK_COST}🪙</span>
      </button>

      <button
        onClick={onBuyGun}
        disabled={state.coins < GUN_COST || !!state.placingMode}
        style={{
          ...btnBase,
          background: state.coins >= GUN_COST ? "#1e3a5f" : "var(--panel)",
          color: state.coins >= GUN_COST ? "#bfdbfe" : "var(--muted)",
          opacity: state.coins < GUN_COST || !!state.placingMode ? 0.5 : 1,
        }}
      >
        🔫 <span>Gun</span>
        <span className="ml-auto text-yellow-400 font-bold">{GUN_COST}🪙</span>
      </button>

      <div className="text-xs font-bold uppercase tracking-wider mt-1" style={{ color: "var(--muted)" }}>Sword</div>

      <div className="rounded-xl p-2 text-sm" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
        <div className="flex items-center gap-2 mb-1">
          <span style={{ fontSize: 20 }}>{SWORD_EMOJIS[state.swordTier]}</span>
          <span className="font-bold capitalize">{state.swordTier} Sword</span>
        </div>
        {nextSword && swordCost ? (
          <button
            onClick={onUpgradeSword}
            disabled={state.coins < swordCost}
            style={{
              ...btnBase,
              background: state.coins >= swordCost ? "#065f46" : "var(--panel)",
              color: state.coins >= swordCost ? "#d1fae5" : "var(--muted)",
              opacity: state.coins < swordCost ? 0.5 : 1,
              fontSize: 12,
              padding: "4px 8px",
              minHeight: 36,
            }}
          >
            ↑ {SWORD_EMOJIS[nextSword]} {nextSword}
            <span className="ml-auto text-yellow-400 font-bold">{swordCost}🪙</span>
          </button>
        ) : (
          <div className="text-xs font-bold" style={{ color: "#f59e0b" }}>✨ MAX LEVEL</div>
        )}
      </div>

      <div className="text-xs font-bold uppercase tracking-wider mt-1" style={{ color: "var(--muted)" }}>Pet</div>

      <div className="rounded-xl p-2 text-sm" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
        <div className="flex items-center gap-2 mb-1">
          <span style={{ fontSize: 20 }}>{state.pet ? PET_EMOJIS[state.pet.type] : "?"}</span>
          <span className="font-bold capitalize" style={{ color: PET_TIER_COLORS[state.pet?.tier ?? "normal"] }}>
            {state.pet?.tier ?? "normal"}
          </span>
        </div>
        {nextPetTier && petCost ? (
          <button
            onClick={onUpgradePet}
            disabled={state.coins < petCost}
            style={{
              ...btnBase,
              background: state.coins >= petCost ? "#4c1d95" : "var(--panel)",
              color: state.coins >= petCost ? "#ede9fe" : "var(--muted)",
              opacity: state.coins < petCost ? 0.5 : 1,
              fontSize: 12,
              padding: "4px 8px",
              minHeight: 36,
            }}
          >
            ↑ <span style={{ color: PET_TIER_COLORS[nextPetTier] }} className="capitalize">{nextPetTier}</span>
            <span className="ml-auto text-yellow-400 font-bold">{petCost}🪙</span>
          </button>
        ) : (
          <div className="text-xs font-bold" style={{ color: "#f59e0b" }}>✨ GOD TIER</div>
        )}
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState<GameState>(makeInitialState);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(state);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  stateRef.current = state;

  // Game loop
  useEffect(() => {
    if (state.phase !== "playing" || state.gameOver) return;

    const loop = (ts: number) => {
      const dt = Math.min((ts - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = ts;
      const cur = stateRef.current;
      if (cur.waveActive && !cur.gameOver) {
        setState(prev => tickGame(prev, dt, CELL));
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    lastTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [state.phase, state.gameOver, state.waveActive]);

  const handlePetSelect = useCallback((petType: PetType) => {
    setState(prev => ({
      ...prev,
      phase: "playing" as Phase,
      pet: {
        type: petType,
        tier: "normal",
        hp: 15,
        maxHp: 15,
      },
    }));
  }, []);

  const handleCellClick = useCallback((col: number, row: number) => {
    setState(prev => placeItem(prev, col, row));
  }, []);

  const handleStartWave = useCallback(() => {
    setState(prev => {
      if (prev.waveActive) return prev;
      return startWave(prev, CELL);
    });
  }, []);

  const handleRestart = useCallback(() => {
    setState(makeInitialState());
  }, []);

  const score = state.coins;

  return (
    <GameShell topbar={<GameTopbar title="Monster Attack" score={score} />}>
      {state.phase === "pet-select" && <PetSelect onSelect={handlePetSelect} />}

      {state.phase === "playing" && state.gameOver && (
        <GameOver wave={state.wave} killed={state.monstersKilled} onRestart={handleRestart} />
      )}

      {state.phase === "playing" && !state.gameOver && (
        <div className="flex flex-col h-full overflow-hidden" style={{ background: "var(--paper)" }}>
          {/* Top bar: coins + wave info */}
          <div
            className="flex items-center justify-between px-3 py-1 text-sm font-semibold flex-shrink-0"
            style={{ background: "var(--panel)", borderBottom: "1px solid var(--line)" }}
          >
            <span>🪙 {state.coins} coins</span>
            <span style={{ color: "var(--muted)" }}>
              {state.waveActive
                ? `⚔️ Wave ${state.wave} — ${state.monsters.length} monsters left`
                : state.wave === 0
                ? "🏠 Build your defenses!"
                : `✅ Wave ${state.wave} complete!`}
            </span>
            <span>💀 {state.monstersKilled}</span>
          </div>

          {/* Main content: board + shop */}
          <div className="flex flex-1 overflow-hidden">
            {/* Game board — scrollable if needed */}
            <div
              className="flex-1 overflow-auto flex items-start justify-center"
              style={{ minWidth: 0 }}
            >
              <GameBoard
                state={state}
                onCellClick={handleCellClick}
                canvasRef={canvasRef}
              />
            </div>

            {/* Shop sidebar */}
            <div
              className="flex-shrink-0 overflow-y-auto p-2"
              style={{
                width: 150,
                borderLeft: "1px solid var(--line)",
                background: "var(--paper)",
              }}
            >
              <ShopPanel
                state={state}
                onBuyBlock={() => setState(prev => buyBlock(prev))}
                onBuyGun={() => setState(prev => buyGun(prev))}
                onUpgradeSword={() => setState(prev => upgradeSword(prev))}
                onUpgradePet={() => setState(prev => upgradePet(prev))}
                onCancelPlace={() => setState(prev => ({ ...prev, placingMode: null, coins: prev.placingMode === "block" ? prev.coins + BLOCK_COST : prev.coins + GUN_COST }))}
              />
            </div>
          </div>

          {/* Bottom bar: Monster Attack button */}
          <div
            className="flex-shrink-0 flex items-center justify-center px-4 py-2 gap-3"
            style={{ borderTop: "1px solid var(--line)", background: "var(--panel)" }}
          >
            {!state.waveActive ? (
              <button
                onClick={handleStartWave}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white text-base transition-all active:scale-95"
                style={{
                  background: "linear-gradient(135deg, #dc2626, #7f1d1d)",
                  minHeight: 48,
                  fontFamily: "Fraunces, serif",
                  fontSize: 18,
                  boxShadow: "0 4px 15px rgba(220,38,38,0.4)",
                  letterSpacing: "0.02em",
                }}
              >
                👾 MONSTER ATTACK!
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <div
                  className="px-4 py-2 rounded-xl text-sm font-bold animate-pulse"
                  style={{ background: "#fef2f2", color: "#dc2626", border: "2px solid #dc2626" }}
                >
                  ⚔️ Wave {state.wave} in progress...
                </div>
                {state.pet && (
                  <div className="flex items-center gap-2 text-sm">
                    <span>{PET_EMOJIS[state.pet.type]}</span>
                    <div
                      className="rounded-full overflow-hidden"
                      style={{ width: 80, height: 10, background: "var(--line)" }}
                    >
                      <div
                        style={{
                          width: `${(state.pet.hp / state.pet.maxHp) * 100}%`,
                          height: "100%",
                          background: state.pet.hp > state.pet.maxHp * 0.5 ? "#22c55e" : state.pet.hp > state.pet.maxHp * 0.25 ? "#f59e0b" : "#ef4444",
                          transition: "width 0.3s",
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                      {state.pet.hp}/{state.pet.maxHp}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </GameShell>
  );
}
