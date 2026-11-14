import { useEffect, useState } from 'react';
import { api, type VideoItem } from '../api';
import { VIDEOS } from '../../../shared/videos.mjs';
import { useT } from '../i18n';

/**
 * Videos: YouTube thumbnails that link to each video. The list is in
 * shared/videos.mjs. Titles come from the server (YouTube oEmbed); if they
 * cannot be loaded, the thumbnails and links still work.
 */
export default function Videos() {
  const [videos, setVideos] = useState<VideoItem[]>(VIDEOS.map(v => ({ ...v, title: null, channel: null })));
  const [loading, setLoading] = useState(true);
  const t = useT();

  useEffect(() => {
    api
      .videos()
      .then(r => setVideos(r.videos))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="page-title">{t('videos.title')}</h1>
      <p className="muted">{t('videos.intro')}</p>
      <ul className="video-grid" aria-busy={loading}>
        {videos.map(v => {
          const title = v.title || `Video ${v.n}`;
          return (
            <li key={v.id} className="video-card">
              <a href={v.watchUrl} target="_blank" rel="noopener noreferrer" className="video-link">
                <span className="video-thumb">
                  <img src={v.thumbnail} alt="" loading="lazy" width={480} height={360} onError={e => (e.currentTarget.style.visibility = 'hidden')} />
                  <span className="video-play" aria-hidden>▶</span>
                </span>
                <span className="video-text">
                  <strong className="video-title">{title}</strong>
                  {v.channel && <span className="small muted">{v.channel}</span>}
                  <span className="small video-open">{t('videos.watch')} <span aria-hidden>↗</span><span className="sr-only"> (opens in a new tab)</span></span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      {!loading && videos.some(v => !v.title) && <p className="small muted">Some titles could not be loaded from YouTube, but the links still work.</p>}
    </div>
  );
}
