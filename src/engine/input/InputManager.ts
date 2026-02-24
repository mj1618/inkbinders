import { INPUT_BUFFER_SIZE } from "@/lib/constants";

export const InputAction = {
  Left: "left",
  Right: "right",
  Up: "up",
  Down: "down",
  Jump: "jump",
  Dash: "dash",
  Attack: "attack",
  Crouch: "crouch",
  Ability1: "ability1",
  Ability2: "ability2",
  Ability3: "ability3",
  WeaponSwitch: "weaponSwitch",
} as const;

export type InputAction = (typeof InputAction)[keyof typeof InputAction];

interface BufferedInput {
  action: InputAction;
  frame: number;
}

/** Key-to-action mapping (multiple keys can map to the same action) */
const DEFAULT_KEY_MAP: Record<string, InputAction> = {
  ArrowLeft: InputAction.Left,
  a: InputAction.Left,
  ArrowRight: InputAction.Right,
  d: InputAction.Right,
  ArrowUp: InputAction.Up,
  w: InputAction.Up,
  ArrowDown: InputAction.Down,
  s: InputAction.Down,
  " ": InputAction.Jump,
  z: InputAction.Jump,
  Shift: InputAction.Dash,
  x: InputAction.Dash,
  j: InputAction.Attack,
  Enter: InputAction.Attack,
  e: InputAction.Ability1,
  "/": InputAction.Ability1,
  q: InputAction.Ability2,
  r: InputAction.Ability3,
  k: InputAction.WeaponSwitch,
};

export class InputManager {
  private keyMap: Record<string, InputAction>;
  private gameKeys: Set<string>;

  // Raw key state from events
  private keysDown = new Set<InputAction>();
  private keysJustDown = new Set<InputAction>();
  private keysJustUp = new Set<InputAction>();

  // Per-frame snapshot (stable during a fixed update tick)
  private pressed = new Set<InputAction>();
  private held = new Set<InputAction>();
  private released = new Set<InputAction>();

  // Input buffer
  private buffer: BufferedInput[] = [];
  private frameCount = 0;

  // Action remapping layer (for fog system input inversion/scramble)
  private actionRemap: Map<string, string> | null = null;

  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onBlur: () => void;
  private attached = false;

  constructor(keyMap?: Record<string, InputAction>) {
    this.keyMap = keyMap ?? { ...DEFAULT_KEY_MAP };
    this.gameKeys = new Set(Object.keys(this.keyMap));

    this.onKeyDown = (e: KeyboardEvent) => {
      if (this.gameKeys.has(e.key)) {
        e.preventDefault();
      }

      const action = this.keyMap[e.key];
      if (action && !this.keysDown.has(action)) {
        this.keysDown.add(action);
        this.keysJustDown.add(action);
      }
    };

    this.onKeyUp = (e: KeyboardEvent) => {
      const action = this.keyMap[e.key];
      if (action && this.keysDown.has(action)) {
        this.keysDown.delete(action);
        this.keysJustUp.add(action);
      }
    };

    this.onBlur = () => {
      // Release all keys on focus loss
      for (const action of this.keysDown) {
        this.keysJustUp.add(action);
      }
      this.keysDown.clear();
    };
  }

  /** Start listening for keyboard events */
  attach(): void {
    if (this.attached) return;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    this.attached = true;
  }

  /** Stop listening for keyboard events */
  detach(): void {
    if (!this.attached) return;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.attached = false;
    this.keysDown.clear();
    this.keysJustDown.clear();
    this.keysJustUp.clear();
    this.pressed.clear();
    this.held.clear();
    this.released.clear();
  }

  /**
   * Snapshot input state for the current fixed-timestep tick.
   * Must be called once per fixed update, before game logic.
   */
  update(): void {
    this.frameCount++;

    // Build per-frame snapshot
    this.pressed.clear();
    this.released.clear();

    for (const action of this.keysJustDown) {
      this.pressed.add(action);
      this.held.add(action);

      // Add to input buffer
      this.buffer.push({ action, frame: this.frameCount });
    }

    for (const action of this.keysJustUp) {
      this.released.add(action);
      this.held.delete(action);
    }

    // Clear raw event sets after snapshotting
    this.keysJustDown.clear();
    this.keysJustUp.clear();

    // Trim old buffer entries
    const cutoff = this.frameCount - INPUT_BUFFER_SIZE;
    while (this.buffer.length > 0 && this.buffer[0].frame < cutoff) {
      this.buffer.shift();
    }
  }

  /**
   * Set an action remap layer. When set, input queries resolve through
   * the remap before checking state. Pass null to clear.
   */
  setActionRemap(remap: Map<string, string> | null): void {
    this.actionRemap = remap;
  }

  /** Resolve an action through the active remap (passthrough when null) */
  private resolveAction(action: InputAction): InputAction {
    if (this.actionRemap && this.actionRemap.has(action)) {
      return this.actionRemap.get(action)! as InputAction;
    }
    return action;
  }

  /** True only on the frame the action was first pressed */
  isPressed(action: InputAction): boolean {
    return this.pressed.has(this.resolveAction(action));
  }

  /** True while the action key is held down */
  isHeld(action: InputAction): boolean {
    return this.held.has(this.resolveAction(action));
  }

  /** True only on the frame the action was released */
  isReleased(action: InputAction): boolean {
    return this.released.has(this.resolveAction(action));
  }

  /** Check if an action was pressed within the last N frames */
  hasBufferedInput(action: InputAction, withinFrames: number = INPUT_BUFFER_SIZE): boolean {
    const resolved = this.resolveAction(action);
    const cutoff = this.frameCount - withinFrames;
    return this.buffer.some((b) => b.action === resolved && b.frame >= cutoff);
  }

  /** Check and consume a buffered input (removes it so it won't trigger again) */
  consumeBufferedInput(action: InputAction, withinFrames: number = INPUT_BUFFER_SIZE): boolean {
    const resolved = this.resolveAction(action);
    const cutoff = this.frameCount - withinFrames;
    const idx = this.buffer.findIndex((b) => b.action === resolved && b.frame >= cutoff);
    if (idx === -1) return false;
    this.buffer.splice(idx, 1);
    return true;
  }

  getFrameCount(): number {
    return this.frameCount;
  }
}
