import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider, useApp } from './state/AppContext';
import { RewardsProvider } from './state/rewards';
import { I18nProvider } from './i18n';
import { AnnounceProvider } from './components/ui';
import { HelperProvider } from './components/HelperChat';
import Layout from './components/Layout';
import Welcome from './pages/Welcome';
import Consent from './pages/Consent';
import Home from './pages/Home';
import LessonPage, { LessonsPage } from './pages/LessonPage';
import Roadmap from './pages/Roadmap';
import BuildGraph from './pages/BuildGraph';
import { CodingGate, ProblemPage, TestList } from './pages/Tests';
import { StudentProfilePage } from './pages/Dashboard';
import { LecturerPage, StudentPage } from './pages/People';
import { LessonPlan, Settings } from './pages/Info';
import Videos from './pages/Videos';
import Exam from './pages/Exam';
import { currentId, unitById } from '../../shared/units.mjs';

function Gate() {
  const { user, loading } = useApp();
  if (loading) return <p className="container" role="status">…</p>;
  if (!user) return <Welcome />;
  if (user.role === 'student' && !user.guest && !user.consentAt) return <Consent />;
  const staff = user.role !== 'student';
  return (
    <AnnounceProvider>
      <RewardsProvider>
        <HelperProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={staff ? <Navigate to="/lecturer" replace /> : <Home />} />
              <Route path="home" element={<Home />} />
              <Route path="lessons" element={<LessonsPage />} />
              <Route path="lesson/:id" element={<LessonPage />} />
              <Route path="roadmap" element={<Roadmap />} />
              <Route path="coding" element={<CodingGate><TestList /></CodingGate>} />
              <Route path="coding/:id" element={<CodingGate><ProblemPage /></CodingGate>} />
              <Route path="build" element={<BuildGraph />} />
              <Route path="videos" element={<Videos />} />
              <Route path="exam" element={<Exam />} />
              <Route path="settings" element={<Settings />} />
              <Route path="student" element={<StudentPage />} />
              <Route path="lecturer" element={<LecturerPage />} />
              {staff && <Route path="lecturer/student/:id" element={<StudentProfilePage />} />}
              {staff && <Route path="lecturer/plan" element={<LessonPlan />} />}
              {/* old links */}
              <Route path="unit/:id" element={<LegacyUnit />} />
              <Route path="test/*" element={<Navigate to="/coding" replace />} />
              <Route path="dashboard/*" element={<Navigate to="/lecturer" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HelperProvider>
      </RewardsProvider>
    </AnnounceProvider>
  );
}

function LegacyUnit() {
  const id = window.location.hash.split('/').pop() ?? '';
  const lessonId = currentId(id);
  return <Navigate to={unitById(lessonId) ? `/lesson/${lessonId}` : '/lessons'} replace />;
}

function WithLanguage() {
  const { settings } = useApp();
  return (
    <I18nProvider lang={settings.lang}>
      <HashRouter>
        <Gate />
      </HashRouter>
    </I18nProvider>
  );
}

export default function App() {
  return (
    <AppProvider>
      <WithLanguage />
    </AppProvider>
  );
}
