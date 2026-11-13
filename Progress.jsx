import { useEffect, useState } from 'react';
import { api } from '../lib.jsx';
import ProfileView from '../components/ProfileView.jsx';

export default function Progress() {
  const [p, setP] = useState(null);
  useEffect(() => { api('/me/profile').then(setP).catch(() => {}); }, []);
  if (!p) return <p>Loading…</p>;
  return (
    <div className="stack">
      <ProfileView p={p} self />
      <p className="small muted">This is the same view your lecturers and tutor see. Your chat questions are not part of it: they are stored without your name.</p>
    </div>
  );
}
