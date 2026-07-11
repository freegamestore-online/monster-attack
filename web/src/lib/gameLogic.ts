import {
  GameState, Monster, Block, Gun, Bullet, FloatingText, SlashEffect,
  PET_TIER_ORDER, SWORD_TIER_ORDER, SWORD_DAMAGE, SWORD_CLICK_DAMAGE, SWORD_COOLDOWN_MS,
  GRID_COLS, GRID_ROWS, PET_COL, PET_ROW, BLOCK_HP,
  PET_UPGRADE_COST, SWORD_UPGRADE_COST, BLOCK_COST, GUN_COST,
} from "../types";

let _nextId = 1;
export function nextId(): string { return String(_nextId++); }

export function cellToPixel(col: number, row: number, cellSize: number) {
  return { x: col * cellSize + cellSize / 2, y: row * cellSize + cellSize / 2 };
}

export function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

function spawnMonster(wave: number, cellSize: number): Monster {
  const side = Math.floor(Math.random() * 4);
  let x = 0, y = 0;
  const margin = -30;
  const W = GRID_COLS * cellSize;
  const H = GRID_ROWS * cellSize;
  if (side === 0) { x = Math.random() * W; y = margin; }
  else if (side === 1) { x = W - margin; y = Math.random() * H; }
  else if (side === 2) { x = Math.random() * W; y = H - margin; }
  else { x = margin; y = Math.random() * H; }

  const emojis = ["👾", "🧟", "👹", "🦇", "🕷️", "🐍", "💀", "🦑"];
  const hp = 20 + wave * 10;
  return {
    id: nextId(),
    x, y,
    hp, maxHp: hp,
    speed: 40 + wave * 3,
    damage: 1,
    attackCooldown: 1000,
    attackTimer: 0,
    emoji: emojis[Math.floor(Math.random() * emojis.length)]!,
    wave,
  };
}

export function startWave(state: GameState, cellSize: number): GameState {
  const wave = state.wave + 1;
  const count = 3 + wave * 2;
  const monsters: Monster[] = [];
  for (let i = 0; i < count; i++) {
    monsters.push(spawnMonster(wave, cellSize));
  }
  return { ...state, wave, waveActive: true, monsters: [...state.monsters, ...monsters] };
}

function addFloat(state: GameState, x: number, y: number, text: string, color: string): GameState {
  const ft: FloatingText = { id: nextId(), x, y, text, color, life: 1.2, maxLife: 1.2 };
  return { ...state, floatingTexts: [...state.floatingTexts, ft] };
}

// ── Sword click: player clicks on a monster to deal click damage ──────────────
export function swordSlash(state: GameState, clickX: number, clickY: number, cellSize: number): GameState {
  if (!state.waveActive || state.gameOver) return state;
  if (state.swordCooldown > 0) return state; // still on cooldown

  const hitRadius = cellSize * 0.7;
  let s = { ...state };

  // Find the monster closest to the click point
  let target: Monster | null = null;
  let targetDist = Infinity;
  for (const m of s.monsters) {
    const d = dist(clickX, clickY, m.x, m.y);
    if (d < hitRadius && d < targetDist) {
      targetDist = d;
      target = m;
    }
  }

  if (!target) return state; // missed — no cooldown used

  const dmg = SWORD_CLICK_DAMAGE[s.swordTier];
  const newHp = target.hp - dmg;

  // Add slash visual
  const slash: SlashEffect = {
    id: nextId(),
    x: target.x,
    y: target.y,
    life: 0.35,
    maxLife: 0.35,
  };
  s = { ...s, slashEffects: [...s.slashEffects, slash] };

  // Apply sword cooldown
  s = { ...s, swordCooldown: SWORD_COOLDOWN_MS[s.swordTier] };

  if (newHp <= 0) {
    s = { ...s, monsters: s.monsters.filter(m => m.id !== target!.id) };
    s = { ...s, coins: s.coins + 1, monstersKilled: s.monstersKilled + 1 };
    s = addFloat(s, target.x, target.y - cellSize * 0.7, `⚔️ +1🪙`, "#fbbf24");
  } else {
    s = {
      ...s,
      monsters: s.monsters.map(m =>
        m.id === target!.id ? { ...m, hp: newHp } : m
      ),
    };
    s = addFloat(s, target.x, target.y - cellSize * 0.5, `-${dmg}`, "#ef4444");
  }

  return s;
}

export function tickGame(state: GameState, dt: number, cellSize: number): GameState {
  if (!state.waveActive || state.gameOver) return state;

  let s = { ...state };
  const petX = PET_COL * cellSize + cellSize / 2;
  const petY = PET_ROW * cellSize + cellSize / 2;
  const swordDmg = SWORD_DAMAGE[s.swordTier];

  // Tick sword cooldown
  s = { ...s, swordCooldown: Math.max(0, s.swordCooldown - dt * 1000) };

  // Update floating texts
  s = {
    ...s,
    floatingTexts: s.floatingTexts
      .map(ft => ({ ...ft, life: ft.life - dt, y: ft.y - 30 * dt }))
      .filter(ft => ft.life > 0),
  };

  // Update slash effects
  s = {
    ...s,
    slashEffects: s.slashEffects
      .map(se => ({ ...se, life: se.life - dt }))
      .filter(se => se.life > 0),
  };

  // Update bullet positions
  const bulletSpeed = cellSize * 8;
  let updatedBullets: Bullet[] = [];
  let updatedMonsters = [...s.monsters];
  let coinsGained = 0;
  let kills = 0;

  for (const bullet of s.bullets) {
    const target = updatedMonsters.find(m => m.id === bullet.targetId);
    if (!target) continue;

    const nx = bullet.x + bullet.vx * dt * bulletSpeed;
    const ny = bullet.y + bullet.vy * dt * bulletSpeed;
    const d = dist(nx, ny, target.x, target.y);

    if (d < cellSize * 0.4) {
      const newHp = target.hp - 25;
      if (newHp <= 0) {
        updatedMonsters = updatedMonsters.filter(m => m.id !== target.id);
        coinsGained++;
        kills++;
        s = addFloat(s, target.x, target.y - cellSize * 0.5, "🔫 +1🪙", "#fbbf24");
      } else {
        updatedMonsters = updatedMonsters.map(m =>
          m.id === target.id ? { ...m, hp: newHp } : m
        );
      }
    } else {
      updatedBullets.push({ ...bullet, x: nx, y: ny });
    }
  }
  s = {
    ...s,
    bullets: updatedBullets,
    monsters: updatedMonsters,
    coins: s.coins + coinsGained,
    monstersKilled: s.monstersKilled + kills,
  };

  // Update gun cooldowns and fire
  let newBullets: Bullet[] = [...s.bullets];
  const updatedGuns: Gun[] = s.guns.map(gun => {
    let cooldown = gun.cooldown - dt * 1000;
    if (cooldown <= 0 && s.monsters.length > 0) {
      const gx = gun.col * cellSize + cellSize / 2;
      const gy = gun.row * cellSize + cellSize / 2;
      let nearest: Monster | null = null;
      let nearestDist = Infinity;
      for (const m of s.monsters) {
        const d = dist(gx, gy, m.x, m.y);
        if (d < nearestDist) { nearestDist = d; nearest = m; }
      }
      if (nearest && nearestDist < cellSize * 7) {
        const dx = nearest.x - gx;
        const dy = nearest.y - gy;
        const len = Math.sqrt(dx * dx + dy * dy);
        newBullets.push({
          id: nextId(),
          x: gx, y: gy,
          vx: dx / len, vy: dy / len,
          targetId: nearest.id,
        });
        cooldown = gun.cooldownMax;
      } else {
        cooldown = 0;
      }
    }
    return { ...gun, cooldown: Math.max(0, cooldown) };
  });
  s = { ...s, guns: updatedGuns, bullets: newBullets };

  // Move monsters and handle attacks
  let newMonsters: Monster[] = [];
  let newBlocks = [...s.blocks];
  let petDamaged = false;
  let pet = s.pet ? { ...s.pet } : null;

  for (let monster of s.monsters) {
    let targetX = petX;
    let targetY = petY;
    let nearestBlock: Block | null = null;
    let nearestBlockDist = Infinity;

    for (const block of newBlocks) {
      const bx = block.col * cellSize + cellSize / 2;
      const by = block.row * cellSize + cellSize / 2;
      const d = dist(monster.x, monster.y, bx, by);
      if (d < nearestBlockDist) {
        nearestBlockDist = d;
        nearestBlock = block;
      }
    }

    const petDist = dist(monster.x, monster.y, petX, petY);
    if (nearestBlock && nearestBlockDist < petDist * 0.8) {
      const bx = nearestBlock.col * cellSize + cellSize / 2;
      const by = nearestBlock.row * cellSize + cellSize / 2;
      targetX = bx;
      targetY = by;
    }

    const dx = targetX - monster.x;
    const dy = targetY - monster.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    let m = { ...monster };

    if (d > cellSize * 0.45) {
      m.x += (dx / d) * m.speed * dt;
      m.y += (dy / d) * m.speed * dt;
    }

    m.attackTimer = Math.max(0, m.attackTimer - dt * 1000);

    // Passive sword aura (very weak — clicking is the main sword mechanic)
    const distToPet = dist(m.x, m.y, petX, petY);
    if (distToPet < cellSize * 1.8) {
      m.hp -= swordDmg * dt;
    }

    if (m.hp <= 0) {
      s = addFloat(s, m.x, m.y - cellSize * 0.5, "⚔️ +1🪙", "#fbbf24");
      s = { ...s, coins: s.coins + 1, monstersKilled: s.monstersKilled + 1 };
      continue;
    }

    // Attack blocks
    if (nearestBlock && nearestBlockDist < cellSize * 0.6 && m.attackTimer === 0) {
      m.attackTimer = m.attackCooldown;
      const idx = newBlocks.findIndex(b => b.id === nearestBlock!.id);
      if (idx !== -1) {
        const block = newBlocks[idx]!;
        const newHp = block.hp - m.damage;
        if (newHp <= 0) {
          newBlocks = newBlocks.filter(b => b.id !== nearestBlock!.id);
        } else {
          newBlocks = newBlocks.map(b =>
            b.id === nearestBlock!.id ? { ...b, hp: newHp } : b
          );
        }
      }
    }

    // Attack pet directly
    if (distToPet < cellSize * 0.6 && m.attackTimer === 0 && pet) {
      m.attackTimer = m.attackCooldown;
      pet.hp -= m.damage;
      petDamaged = true;
      if (pet.hp <= 0) {
        return { ...s, pet, blocks: newBlocks, monsters: newMonsters, gameOver: true };
      }
    }

    newMonsters.push(m);
  }

  if (petDamaged && pet) {
    s = addFloat(s, petX, petY - cellSize, `-1❤️`, "#ef4444");
  }

  const waveActive = newMonsters.length > 0;

  return {
    ...s,
    monsters: newMonsters,
    blocks: newBlocks,
    pet: pet ?? s.pet,
    waveActive,
  };
}

export function buyBlock(state: GameState): GameState {
  if (state.coins < BLOCK_COST) return state;
  return { ...state, coins: state.coins - BLOCK_COST, placingMode: "block" };
}

export function buyGun(state: GameState): GameState {
  if (state.coins < GUN_COST) return state;
  return { ...state, coins: state.coins - GUN_COST, placingMode: "gun" };
}

export function placeItem(state: GameState, col: number, row: number): GameState {
  if (!state.placingMode) return state;
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return state;
  if (col === PET_COL && row === PET_ROW) return state;

  const occupied =
    state.blocks.some(b => b.col === col && b.row === row) ||
    state.guns.some(g => g.col === col && g.row === row);
  if (occupied) return state;

  if (state.placingMode === "block") {
    const block: Block = { id: nextId(), col, row, hp: BLOCK_HP, maxHp: BLOCK_HP };
    return { ...state, blocks: [...state.blocks, block], placingMode: null };
  } else if (state.placingMode === "gun") {
    const gun: Gun = { id: nextId(), col, row, cooldown: 0, cooldownMax: 1500 };
    return { ...state, guns: [...state.guns, gun], placingMode: null };
  }
  return state;
}

export function upgradeSword(state: GameState): GameState {
  const idx = SWORD_TIER_ORDER.indexOf(state.swordTier);
  if (idx === SWORD_TIER_ORDER.length - 1) return state;
  const cost = SWORD_UPGRADE_COST[state.swordTier];
  if (cost === null || state.coins < cost) return state;
  const nextTier = SWORD_TIER_ORDER[idx + 1]!;
  return { ...state, coins: state.coins - cost, swordTier: nextTier };
}

export function upgradePet(state: GameState): GameState {
  if (!state.pet) return state;
  const idx = PET_TIER_ORDER.indexOf(state.pet.tier);
  if (idx === PET_TIER_ORDER.length - 1) return state;
  const cost = PET_UPGRADE_COST[state.pet.tier];
  if (cost === null || state.coins < cost) return state;
  const nextTier = PET_TIER_ORDER[idx + 1]!;
  const newMaxHp = 10 + (idx + 2) * 5;
  return {
    ...state,
    coins: state.coins - cost,
    pet: { ...state.pet, tier: nextTier, maxHp: newMaxHp, hp: newMaxHp },
  };
}
