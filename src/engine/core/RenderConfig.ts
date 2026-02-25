export type RenderMode = "sprites" | "rectangles" | "both";

export class RenderConfig {
  private static mode: RenderMode = "rectangles";

  static getMode(): RenderMode {
    return RenderConfig.mode;
  }

  static setMode(mode: RenderMode): void {
    RenderConfig.mode = mode;
  }

  static useSprites(): boolean {
    return RenderConfig.mode === "sprites" || RenderConfig.mode === "both";
  }

  static useRectangles(): boolean {
    return RenderConfig.mode === "rectangles" || RenderConfig.mode === "both";
  }
}
