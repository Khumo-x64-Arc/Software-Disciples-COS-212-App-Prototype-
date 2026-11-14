export type Video = { id: string; n: number; watchUrl: string; thumbnail: string; embedUrl: string; lessons: string[] };
export const VIDEO_LINKS: string[];
export function youtubeId(url: string): string | null;
export const VIDEOS: Video[];
export function lessonsFor(videoId: string): string[];
export function videoById(id: string): Video | null;
