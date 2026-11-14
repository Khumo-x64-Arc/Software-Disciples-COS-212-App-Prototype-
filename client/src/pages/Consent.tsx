import { useState } from 'react';
import { api } from '../api';
import { useApp } from '../state/AppContext';
import { useI18n } from '../i18n';

/** POPIA notice for a signed-in account that has not agreed yet (guests store no personal data). */
export default function Consent() {
  const { setUser, signOut, user } = useApp();
  const { t } = useI18n();
  const [error, setError] = useState('');
  const accept = async () => {
    try {
      const r = await api.consent();
      setUser(r.user);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <main className="container" id="main">
      <section className="card consent" aria-labelledby="consent-title">
        <h1 id="consent-title">{t('consent.title')}</h1>
        <p>{t('consent.body')}</p>
        <p className="small">Email <a href="mailto:cos212queries@cs.up.ac.za">cos212queries@cs.up.ac.za</a> to see, correct or delete your data. Data is deleted at the end of the semester.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="button-row">
          <button type="button" onClick={() => void accept()}>{t('consent.agree')}{user ? `, ${user.name.split(' ')[0]}` : ''}</button>
          <button type="button" className="secondary" onClick={() => void signOut()}>{t('consent.guest')}</button>
        </div>
      </section>
    </main>
  );
}
