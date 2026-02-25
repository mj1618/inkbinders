// PlayerProgression — Tracks what the player has accomplished
// Pure data class; eventually persisted to Convex, for now in-memory only

import type { RoomId, GateAbility } from "./Room";

export interface CardDeckData {
  ownedCards: string[];
  equippedCards: string[];
}

export interface PlayerProgressionData {
  unlockedAbilities: Set<GateAbility>;
  openedGates: Set<string>;
  defeatedBosses: Set<string>;
  visitedRooms: Set<string>;
  cardDeckData: CardDeckData | null;
  currentHealth: number;
  maxHealth: number;
  currentRoomId: RoomId;
  totalPlayTime: number;
  deathCount: number;
}

export class PlayerProgression {
  data: PlayerProgressionData;

  constructor(startingRoomId: RoomId, maxHealth: number = 5) {
    this.data = {
      unlockedAbilities: new Set(),
      openedGates: new Set(),
      defeatedBosses: new Set(),
      visitedRooms: new Set(),
      cardDeckData: null,
      currentHealth: maxHealth,
      maxHealth,
      currentRoomId: startingRoomId,
      totalPlayTime: 0,
      deathCount: 0,
    };
  }

  unlockAbility(ability: GateAbility): void {
    this.data.unlockedAbilities.add(ability);
  }

  hasAbility(ability: GateAbility): boolean {
    return this.data.unlockedAbilities.has(ability);
  }

  unlockAllAbilities(): void {
    const all: GateAbility[] = ["margin-stitch", "redaction", "paste-over", "index-mark"];
    for (const a of all) this.data.unlockedAbilities.add(a);
  }

  openGate(gateId: string): void {
    this.data.openedGates.add(gateId);
  }

  isGateOpened(gateId: string): boolean {
    return this.data.openedGates.has(gateId);
  }

  defeatBoss(bossId: string): void {
    this.data.defeatedBosses.add(bossId);
  }

  isBossDefeated(bossId: string): boolean {
    return this.data.defeatedBosses.has(bossId);
  }

  visitRoom(roomId: RoomId): void {
    this.data.visitedRooms.add(roomId);
  }

  isRoomVisited(roomId: RoomId): boolean {
    return this.data.visitedRooms.has(roomId);
  }

  recordDeath(): void {
    this.data.deathCount++;
  }

  updatePlayTime(dt: number): void {
    this.data.totalPlayTime += dt;
  }

  getAbilitiesAsSet(): Set<GateAbility> {
    return this.data.unlockedAbilities;
  }

  serialize(): Record<string, unknown> {
    return {
      unlockedAbilities: Array.from(this.data.unlockedAbilities),
      openedGates: Array.from(this.data.openedGates),
      defeatedBosses: Array.from(this.data.defeatedBosses),
      visitedRooms: Array.from(this.data.visitedRooms),
      cardDeckData: this.data.cardDeckData,
      currentHealth: this.data.currentHealth,
      maxHealth: this.data.maxHealth,
      currentRoomId: this.data.currentRoomId,
      totalPlayTime: this.data.totalPlayTime,
      deathCount: this.data.deathCount,
    };
  }

  static deserialize(data: Record<string, unknown>): PlayerProgression {
    const roomId = (data.currentRoomId as string) ?? "scribe-hall";
    const maxHealth = (data.maxHealth as number) ?? 5;
    const prog = new PlayerProgression(roomId, maxHealth);

    prog.data.currentHealth = (data.currentHealth as number) ?? maxHealth;
    prog.data.totalPlayTime = (data.totalPlayTime as number) ?? 0;
    prog.data.deathCount = (data.deathCount as number) ?? 0;
    prog.data.cardDeckData = (data.cardDeckData as CardDeckData | null) ?? null;

    const abilities = data.unlockedAbilities as string[] | undefined;
    if (abilities) {
      for (const a of abilities) prog.data.unlockedAbilities.add(a as GateAbility);
    }
    const gates = data.openedGates as string[] | undefined;
    if (gates) {
      for (const g of gates) prog.data.openedGates.add(g);
    }
    const bosses = data.defeatedBosses as string[] | undefined;
    if (bosses) {
      for (const b of bosses) prog.data.defeatedBosses.add(b);
    }
    const rooms = data.visitedRooms as string[] | undefined;
    if (rooms) {
      for (const r of rooms) prog.data.visitedRooms.add(r);
    }

    return prog;
  }
}
