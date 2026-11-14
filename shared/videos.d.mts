export type Video = { id: string; n: number; watchUrl: string; thumbnail: string };
export const VIDEO_LINKS: string[];
export function youtubeId(url: string): string | null;
export const VIDEOS: Video[];
