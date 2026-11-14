import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LESSONS } from '../../../shared/units.mjs';
import { api, type VideoItem } from '../api';
import { VIDEOS } from '../../../shared/videos.mjs';
import { useI18n } from '../i18n';

/** Videos used in lessons come first, in lesson order; the rest follow. */
const order = (v: { lessons: string[]; n: number }) => {
  const i = v.lessons.length ? LESSONS.findIndex(l => l.id === v.lessons[0]) : LESSONS.length;
  return i * 100 + v.n;
};

/**
 * Videos: every video in one place, each marked with the lessons that embed it.
 * YouTube thumbnails that link to each video. The list is in
 * shared/videos.mjs. Titles come from the server (YouTube oEmbed); if they
 * cannot be loaded, the thumbnails and links still work.
 */
export default function Videos() {
  const [videos, setVideos] = useState<VideoItem[]>(VIDEOS.map(v => ({ ...v, title: null, channel: null })));
  const [loading, setLoading] = useState(true);
  const { t, lesson } = useI18n();

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
        {[...videos].sort((a, b) => order(a) - order(b)).map(v => {
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
              <p className="video-lessons small">
                {v.lessons.length ? (
                  <>
                    {t('videos.inLessons')}{' '}
                    {v.lessons.map(id => (
                      <Link key={id} to={`/lesson/${id}`} className="chip chip-brand" title={lesson(id).title}>{id} · {lesson(id).title}</Link>
                    ))}
                  </>
                ) : (
                  <span className="muted">{t('videos.extra')}</span>
                )}
              </p>
            </li>
          );
        })}
      </ul>
      {!loading && videos.some(v => !v.title) && <p className="small muted">Some titles could not be loaded from YouTube, but the links still work.</p>}
    </div>
  );
}
