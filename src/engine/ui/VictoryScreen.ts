// VictoryScreen — typewriter ending sequence with stats display.
// Pure TypeScript, no React dependencies.

import { SaveSystem } from "@/engine/save/SaveSystem";

// ─── Types ──────────────────────────────────────────────────────────

export interface VictoryStats {
  playerName: string;
  playTimeSeconds: number;
  deaths: number;
  roomsVisited: number;
  totalRooms: number;
  abilitiesUnlocked: number;
  cardsCollected: number;
  completionPercent: number;
}

export type VictoryPhase =
  | "fade-in"       // 1s: dark overlay fades in
  | "text-sequence" // ~10s: typewriter lines appear one by one
  | "stats"         // stats fade in after text
  | "thanks"        // "Thank you for playing" message
  | "wait-for-key"; // "Press any key to return to title"

// ─── Constants ──────────────────────────────────────────────────────

const FADE_IN_DURATION = 1.0;
const CHARS_PER_SECOND = 30;
const LINE_PAUSE = 0.8;
const STATS_FADE_DURATION = 2.0;
const THANKS_FADE_DURATION = 2.0;

const BG_COLOR = "#0d0907";
const TEXT_COLOR = "#f5e6d3";
const NAME_COLOR = "#f59e0b";
const STAT_LABEL_COLOR = "#c4a882";
const STAT_VALUE_COLOR = "#f5e6d3";
const THANKS_COLOR = "#e2e8f0";
const BLINK_COLOR = "#94a3b8";

// ─── VictoryScreen Class ────────────────────────────────────────────

export class VictoryScreen {
  private phase: VictoryPhase = "fade-in";
  private phaseTimer = 0;
  private stats: VictoryStats;
  private textLines: string[];
  private visibleLines = 0;
  private charIndex = 0;
  private linePauseTimer = 0;
  private statsAlpha = 0;
  private thanksAlpha = 0;
  private fadeAlpha = 0;

  /** True when the player has pressed a key and it's time to return to title */
  done = false;

  constructor(stats: VictoryStats) {
    this.stats = stats;
    this.textLines = [
      "The corruption recedes...",
      "The Library breathes again.",
      "You have restored the Index.",
      `${stats.playerName}, Keeper of the Archive`,
    ];
  }

  update(dt: number, anyKeyDown: boolean): void {
    this.phaseTimer += dt;

    switch (this.phase) {
      case "fade-in":
        this.fadeAlpha = Math.min(1, this.phaseTimer / FADE_IN_DURATION);
        if (this.phaseTimer >= FADE_IN_DURATION) {
          this.phase = "text-sequence";
          this.phaseTimer = 0;
          this.visibleLines = 0;
          this.charIndex = 0;
          this.linePauseTimer = 0;
        }
        break;

      case "text-sequence": {
        if (this.visibleLines >= this.textLines.length) {
          // All lines complete
          this.phase = "stats";
          this.phaseTimer = 0;
          this.statsAlpha = 0;
          break;
        }

        const currentLine = this.textLines[this.visibleLines];
        if (this.charIndex < currentLine.length) {
          // Typing characters
          this.charIndex += dt * CHARS_PER_SECOND;
          if (this.charIndex >= currentLine.length) {
            this.charIndex = currentLine.length;
            this.linePauseTimer = 0;
          }
        } else {
          // Line complete, pause before next
          this.linePauseTimer += dt;
          if (this.linePauseTimer >= LINE_PAUSE) {
            this.visibleLines++;
            this.charIndex = 0;
            this.linePauseTimer = 0;
          }
        }
        break;
      }

      case "stats":
        this.statsAlpha = Math.min(1, this.phaseTimer / STATS_FADE_DURATION);
        if (this.phaseTimer >= STATS_FADE_DURATION) {
          this.phase = "thanks";
          this.phaseTimer = 0;
          this.thanksAlpha = 0;
        }
        break;

      case "thanks":
        this.thanksAlpha = Math.min(1, this.phaseTimer / THANKS_FADE_DURATION);
        if (this.phaseTimer >= THANKS_FADE_DURATION) {
          this.phase = "wait-for-key";
          this.phaseTimer = 0;
        }
        break;

      case "wait-for-key":
        if (anyKeyDown) {
          this.done = true;
        }
        break;
    }
  }

  render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // Background
    const bgAlpha = this.phase === "fade-in" ? this.fadeAlpha : 1;
    ctx.fillStyle = BG_COLOR;
    ctx.globalAlpha = bgAlpha;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;

    // Don't draw anything during fade-in except the overlay
    if (this.phase === "fade-in") {
      ctx.restore();
      return;
    }

    // ─── Story text lines ───────────────────────────────────────

    const textStartY = height * 0.2;
    const lineHeight = 44;

    for (let i = 0; i < this.textLines.length; i++) {
      let text: string;
      let alpha: number;

      if (this.phase === "text-sequence") {
        if (i < this.visibleLines) {
          text = this.textLines[i];
          alpha = 1;
        } else if (i === this.visibleLines) {
          text = this.textLines[i].substring(0, Math.floor(this.charIndex));
          alpha = 1;
        } else {
          continue;
        }
      } else {
        // All lines visible in later phases
        text = this.textLines[i];
        alpha = 1;
      }

      if (text.length === 0) continue;

      ctx.globalAlpha = alpha;
      const isNameLine = i === 3;
      ctx.fillStyle = isNameLine ? NAME_COLOR : TEXT_COLOR;
      ctx.font = isNameLine ? "bold 24px monospace" : "bold 28px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, width / 2, textStartY + i * lineHeight);
    }

    // ─── Stats block ────────────────────────────────────────────

    if (this.statsAlpha > 0) {
      ctx.globalAlpha = this.statsAlpha;
      const statsY = textStartY + this.textLines.length * lineHeight + 40;
      const statLineHeight = 24;

      const statEntries = [
        ["Play Time", SaveSystem.formatPlayTime(this.stats.playTimeSeconds)],
        ["Deaths", String(this.stats.deaths)],
        ["Rooms Visited", `${this.stats.roomsVisited}/${this.stats.totalRooms}`],
        ["Abilities", `${this.stats.abilitiesUnlocked}/4`],
        ["Cards", String(this.stats.cardsCollected)],
        ["Completion", `${this.stats.completionPercent}%`],
      ];

      ctx.font = "16px monospace";
      const labelWidth = 160;
      const blockX = width / 2 - labelWidth / 2;

      for (let i = 0; i < statEntries.length; i++) {
        const y = statsY + i * statLineHeight;
        const [label, value] = statEntries[i];

        // Label (right-aligned)
        ctx.fillStyle = STAT_LABEL_COLOR;
        ctx.textAlign = "right";
        ctx.fillText(label, blockX, y);

        // Value (left-aligned after gap)
        ctx.fillStyle = STAT_VALUE_COLOR;
        ctx.textAlign = "left";
        ctx.fillText(value, blockX + 16, y);
      }
    }

    // ─── Thank you message ──────────────────────────────────────

    if (this.thanksAlpha > 0) {
      ctx.globalAlpha = this.thanksAlpha;
      ctx.fillStyle = THANKS_COLOR;
      ctx.font = "20px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Thank you for playing Inkbinders", width / 2, height * 0.78);
    }

    // ─── Press any key prompt ───────────────────────────────────

    if (this.phase === "wait-for-key") {
      const blinkAlpha = 0.4 + 0.6 * Math.abs(Math.sin(this.phaseTimer * 2));
      ctx.globalAlpha = blinkAlpha;
      ctx.fillStyle = BLINK_COLOR;
      ctx.font = "14px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Press any key to return to title", width / 2, height * 0.92);
    }

    ctx.restore();
  }
}
