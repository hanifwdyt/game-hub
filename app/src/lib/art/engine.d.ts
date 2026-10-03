export const DPR: number;
export const REDUCED: boolean;
export const LAYERS: readonly ["sky", "far", "mid", "front"];
export type Layer = (typeof LAYERS)[number];
export interface ArtSubject { id: string; theme: string }
export const P: Record<string, unknown>;
export function paint(g: ArtSubject, layer: Layer, c: CanvasRenderingContext2D, W: number, H: number, T: number): void;
export function composite(g: ArtSubject, W: number, H: number): HTMLCanvasElement;
export function art(g: ArtSubject, w: number, h: number): HTMLCanvasElement;
export function mk(w: number, h: number): HTMLCanvasElement;
export function hash(s: string): number;
export function RNG(seed: number): () => number;
export function glow(c: CanvasRenderingContext2D, x: number, y: number, r: number, col: number[], a?: number): void;
export function lg(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, st: [number, string][]): CanvasGradient;
