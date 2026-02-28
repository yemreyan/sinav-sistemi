import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './layouts/AdminLayout';
import AdminLogin from './pages/AdminLogin';
import Dashboard from './pages/Dashboard';
import ExamManagement from './components/exam/ExamManagement';
import LiveControl from './components/live/LiveControl';
import VideoManagement from './components/video/VideoManagement';
import RefereeList from './components/referee/RefereeList';
import SettingsPanel from './components/settings/SettingsPanel';
import ReportsPanel from './components/reports/ReportsPanel';
import ResultsMatrix from './components/results/ResultsMatrix';
import BulkScores from './components/scores/BulkScores';
import RefereeScoringPage from './pages/RefereeScoringPage';
import StatsView from './components/stats/StatsView';

function App() {
  const isAuthenticated = localStorage.getItem('adminLoggedIn') === 'true';

  return (
    <BrowserRouter>
      <Routes>
        {/* Hakem Puanlama — Auth gerektirmez, AdminLayout dışında */}
        <Route path="/hakem" element={<RefereeScoringPage />} />

        <Route
          path="/login"
          element={!isAuthenticated ? <AdminLogin /> : <Navigate to="/" replace />}
        />

        <Route
          path="/"
          element={isAuthenticated ? <AdminLayout /> : <Navigate to="/login" replace />}
        >
          <Route index element={<Dashboard />} />
          <Route path="exams" element={<ExamManagement />} />
          <Route path="live" element={<LiveControl />} />
          <Route path="videos" element={<VideoManagement />} />
          <Route path="referees" element={<RefereeList />} />
          <Route path="reports" element={<ReportsPanel />} />
          <Route path="settings" element={<SettingsPanel />} />
          <Route path="results-matrix" element={<ResultsMatrix />} />
          <Route path="bulk-scores" element={<BulkScores />} />
          <Route path="stats" element={<StatsView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
