/**
 * App Component
 * Root application with routing and auth guard.
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './stores/authStore';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import DevicesPage from './pages/DevicesPage';
import SessionsPage from './pages/SessionsPage';
import ScriptsPage from './pages/ScriptsPage';
import AIInsightsPage from './pages/AIInsightsPage';
import LogsPage from './pages/LogsPage';
import UsersPage from './pages/UsersPage';
import RemoteToolsPage from './pages/RemoteToolsPage';
import TerminalPage from './pages/TerminalPage';

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-surface-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
          <p className="text-white/50 text-sm">Loading NexusIT...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
}

export default function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <Router>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '12px',
          }
        }}
      />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<DashboardPage />} />
          <Route path="devices" element={<DevicesPage />} />
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="terminal" element={<TerminalPage />} />
          <Route path="remote-tools" element={<RemoteToolsPage />} />
          <Route path="scripts" element={<ScriptsPage />} />
          <Route path="ai-insights" element={<AIInsightsPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="users" element={<UsersPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}
