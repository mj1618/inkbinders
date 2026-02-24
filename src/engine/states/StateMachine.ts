export interface State<C> {
  name: string;
  enter?: (context: C) => void;
  update?: (context: C, dt: number) => void;
  exit?: (context: C) => void;
}

export class StateMachine<C> {
  private states = new Map<string, State<C>>();
  private currentState: State<C> | null = null;
  private previousStateName: string | null = null;
  private timeInState = 0;

  constructor(private context: C) {}

  addState(state: State<C>): void {
    this.states.set(state.name, state);
  }

  setState(name: string): void {
    const next = this.states.get(name);
    if (!next) {
      throw new Error(`StateMachine: unknown state "${name}"`);
    }

    // No-op if already in this state
    if (this.currentState && this.currentState.name === name) {
      return;
    }

    if (this.currentState) {
      this.currentState.exit?.(this.context);
      this.previousStateName = this.currentState.name;
    }

    this.currentState = next;
    this.timeInState = 0;
    this.currentState.enter?.(this.context);
  }

  update(dt: number): void {
    if (this.currentState) {
      this.timeInState += dt;
      this.currentState.update?.(this.context, dt);
    }
  }

  getCurrentState(): string {
    return this.currentState?.name ?? "";
  }

  getPreviousState(): string | null {
    return this.previousStateName;
  }

  getTimeInState(): number {
    return this.timeInState;
  }
}
