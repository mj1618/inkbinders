import { InputManager, InputAction } from "@/engine/input/InputManager";

/**
 * Programmatic input manager for headless testing.
 * Extends InputManager but never attaches DOM listeners.
 * Call press/release to simulate player input, then tick the harness
 * which calls update() to snapshot the state.
 */
export class TestInputManager extends InputManager {
  constructor() {
    super();
  }

  /** Simulate pressing an action (key down). No-op if already held. */
  press(action: InputAction): void {
    if (!this.keysDown.has(action)) {
      this.keysDown.add(action);
      this.keysJustDown.add(action);
    }
  }

  /** Simulate releasing an action (key up). No-op if not held. */
  release(action: InputAction): void {
    if (this.keysDown.has(action)) {
      this.keysDown.delete(action);
      this.keysJustUp.add(action);
    }
  }

  /** Release all currently held actions. */
  releaseAll(): void {
    for (const action of this.keysDown) {
      this.keysJustUp.add(action);
    }
    this.keysDown.clear();
  }
}
