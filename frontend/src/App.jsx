import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore.js';
import Layout from './components/Layout.jsx';

const LoginPage      = lazy(() => import('./pages/LoginPage.jsx'));
const DevicesPage    = lazy(() => import('./pages/DevicesPage.jsx'));
const TerminalPage   = lazy(() => import('./pages/TerminalPage.jsx'));
const LogsPage       = lazy(() => import('./pages/LogsPage.jsx'));
const RemoteToolsPage = lazy(() => import('./pages/RemoteToolsPage.jsx'));
const UsersPage      = lazy(() => import('./pages/UsersPage.jsx'));

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center h-screen bg-gray-950">
      <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function PrivateRoute({ children }) {
  const token = useAuthStore(s => s.token);
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/devices" replace />} />
          <Route path="devices" element={<DevicesPage />} />
          <Route path="terminal/:deviceId" element={<TerminalPage />} />
          <Route path="remote/:deviceId" element={<RemoteToolsPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="users" element={<UsersPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
