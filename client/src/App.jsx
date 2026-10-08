import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './layouts/AdminLayout';
import AdminLogin from './pages/AdminLogin';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ExamManagement = lazy(() => import('./components/exam/ExamManagement'));
const LiveControl = lazy(() => import('./components/live/LiveControl'));
const VideoManagement = lazy(() => import('./components/video/VideoManagement'));
const RefereeList = lazy(() => import('./components/referee/RefereeList'));
const SettingsPanel = lazy(() => import('./components/settings/SettingsPanel'));
const ReportsPanel = lazy(() => import('./components/reports/ReportsPanel'));
const ResultsMatrix = lazy(() => import('./components/results/ResultsMatrix'));
const BulkScores = lazy(() => import('./components/scores/BulkScores'));
import RefereeScoringPage from './pages/RefereeScoringPage';
const StatsView = lazy(() => import('./components/stats/StatsView'));
const SubmissionTracker = lazy(() => import('./components/live/SubmissionTracker'));
const QuestionPool = lazy(() => import('./components/questions/QuestionPool'));
const VideoDistribution = lazy(() => import('./components/questions/VideoDistribution'));
import { isLoggedIn } from './services/auth';

// Oturum her gezinmede yeniden okunur — App bir kez render edildiği için
// durumu App gövdesinde tutmak girişten sonra güncellenmiyordu.
function AdminGate() {
  return isLoggedIn() ? <AdminLayout /> : <Navigate to="/emre/login" replace />;
}

function LoginGate() {
  return isLoggedIn() ? <Navigate to="/emre" replace /> : <AdminLogin />;
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="p-8 text-muted-foreground">Yükleniyor...</div>}>
      <Routes>
        {/* Hakem Puanlama — Artık Ana Sayfa (/) */}
        <Route path="/" element={<RefereeScoringPage />} />

        {/* Admin Login — Artık /emre/login altında */}
        <Route path="/emre/login" element={<LoginGate />} />

        {/* Admin Layout (Tüm Panel) — Artık /emre altında */}
        <Route path="/emre" element={<AdminGate />}>
          <Route index element={<Dashboard />} />
          <Route path="exams" element={<ExamManagement />} />
          <Route path="live" element={<LiveControl />} />
          <Route path="canli-takip" element={<SubmissionTracker />} />
          <Route path="sorular" element={<QuestionPool />} />
          <Route path="dagitim" element={<VideoDistribution />} />
          <Route path="videos" element={<VideoManagement />} />
          <Route path="referees" element={<RefereeList />} />
          <Route path="reports" element={<ReportsPanel />} />
          <Route path="settings" element={<SettingsPanel />} />
          <Route path="results-matrix" element={<ResultsMatrix />} />
          <Route path="bulk-scores" element={<BulkScores />} />
          <Route path="stats" element={<StatsView />} />
        </Route>

        {/* Catch-all for undefined routes — Redirect to main page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
