// Videos: YouTube links shown on the Videos page and inside their lessons.
// To add a video, paste its share link into this list; the title and channel
// are looked up from YouTube when the page opens. To show a video inside a
// lesson, add its id to that lesson's `videos` list in units.mjs.
import { LESSONS } from './units.mjs';

export const VIDEO_LINKS = [
  'https://youtu.be/-VgHk7UMPP4?si=WdyhSqflkW-BGMiV',
  'https://youtu.be/4jyESQDrpls?si=BdGiaHP-mraFvc99',
  'https://youtu.be/sioNsVeSbQo?si=Z_0mtk9igyYzP_bb',
  'https://youtu.be/zaBhtODEL0w?si=Z38jHQB3_IDIVDI3',
];

/** The 11-character video id from youtu.be, watch?v=, embed/ or shorts/ links. */
export function youtubeId(url) {
  const m = /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/.exec(String(url));
  return m ? m[1] : null;
}

export const VIDEOS = VIDEO_LINKS.map((url, i) => {
  const id = youtubeId(url);
  return {
    id,
    n: i + 1,
    watchUrl: `https://www.youtube.com/watch?v=${id}`,
    thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
    lessons: lessonsFor(id),
  };
}).filter(v => v.id);

/** The lessons that show a video, in lesson order. */
export function lessonsFor(videoId) {
  return LESSONS.filter(l => (l.videos ?? []).includes(videoId)).map(l => l.id);
}

export const videoById = id => VIDEOS.find(v => v.id === id) ?? null;
