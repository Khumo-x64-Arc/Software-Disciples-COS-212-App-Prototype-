import type { Graph } from './graph-core.mjs';

export type Card = { id: string; group: string; q: string[]; a: string; src: string; unit: string | null };
export type HelperContext = {
  graph?: Graph | null;
  unit?: string | null;
  problem?: { id: string; hintLevel?: number } | null;
  problemHints?: Record<string, string[]>;
  feedback?: { problem: string; failedCaseTypes?: string[]; misconception: { id: string; label: string; hint: string; pointsTo: string } } | null;
};
export type HelperAnswer = {
  reply: string;
  src: string | null;
  layer: 'empty' | 'guard' | 'graph' | 'feedback' | 'kb' | 'fallback';
  intent?: string;
  cardId?: string;
  unit?: string | null;
  highlight?: { vertices: string[]; path: string[] };
  closest?: { id: string; label: string }[];
  email?: string | null;
  suggestions: string[];
  hintLevel?: number;
  problem?: string;
};
export const QUERIES_EMAIL: string;
export const CARDS: Card[];
export function tokens(text: string): string[];
export function searchCards(message: string, limit?: number): { card: Card; score: number }[];
export function answer(message: string, ctx?: HelperContext): HelperAnswer;
export function suggestions(ctx?: HelperContext): string[];
