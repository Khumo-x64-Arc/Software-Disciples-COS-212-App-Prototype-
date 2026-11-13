import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, LevelIcon, LEVELS, pct, useApp } from '../lib.jsx';

export default function Home() {
  const { user } = useApp();
  const [units, setUnits] = useState(null);
  useEffect(() => { api('/units').then(setUnits).catch(() => setUnits([])); }, []);
  if (!units) return <p>Loading…</p>;
  const track = (id, title, sub) => (
    <section className="track" aria-labelledby={`t-${id}`}>
      <h2 id={`t-${id}`}><span>{title}</span><span className="chip">{sub}</span></h2>
      <div className="units">
        {units.filter(u => u.track === id).map(u => {
          const lv = u.mastery.level;
          const Card = u.unlocked ? Link : 'div';
          return (
            <Card key={u.id} to={u.unlocked ? `/unit/${u.id}` : undefined} className={`unit-card ${u.unlocked ? '' : 'locked'}`} aria-label={`${u.id} ${u.title}. ${u.unlocked ? LEVELS[lv].label : 'Locked: reach 80% on the previous check'}`}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="id">{u.id}</span>
                {u.unlocked ? <span className="chip"><LevelIcon level={lv} /> {LEVELS[lv].label}</span> : <span className="badge lock">Locked</span>}
              </div>
              <b>{u.title}</b>
              <span className="small muted">{u.summary}</span>
              <span className="small" style={{ marginTop: 'auto' }}>{u.minutes} min{u.advisory ? ' · advisory' : ''}{u.mastery.best !== null ? ` · best ${pct(u.mastery.best)}` : ''}</span>
            </Card>
          );
        })}
      </div>
    </section>
  );
  const secure = units.filter(u => u.mastery.level === 'secure').length;
  return (
    <div className="stack">
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="grow">
          <h1>Hi {user.name.split(' ')[0]} 👋</h1>
          <p>Work through the two tracks in order. Each unit opens once you reach 80% on the previous unit's check. {secure ? `You're secure in ${secure} of ${units.length} units.` : 'Start with the readiness check or jump into U1.'}</p>
        </div>
        <Link to="/build" className="btn primary">Open Build a graph</Link>
      </div>
      {track('graphs', 'Graphs', 'CS2023 AL-Foundational CS Core topic 8')}
      <p className="center" aria-hidden="true" style={{ fontSize: '1.4rem', margin: 0 }}>⬇ reachability from every vertex is the closure ⬇</p>
      {track('closure', 'Transitive closure', 'CS2023 AL-Foundational KA Core topic 15a')}
      <div className="legend card soft" aria-label="Legend">
        <b>Legend:</b>{Object.entries(LEVELS).map(([k, v]) => <span key={k}><LevelIcon level={k} /> {v.label}</span>)}
      </div>
    </div>
  );
}
