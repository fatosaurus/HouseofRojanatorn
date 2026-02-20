import { Navigate, Route, Routes } from 'react-router-dom'
import { SessionProvider } from './app/SessionContext'
import { useSession } from './app/useSession'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'

function ProtectedRoutes() {
  const { isAuthenticated } = useSession()

  if (!isAuthenticated) {
    return <Navigate replace to="/" />
  }

  return (
    <Routes>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

function PublicRoutes() {
  const { isAuthenticated } = useSession()

  if (isAuthenticated) {
    return <Navigate replace to="/dashboard" />
  }

  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  )
}

function AppContent() {
  const { isAuthenticated } = useSession()
  return isAuthenticated ? <ProtectedRoutes /> : <PublicRoutes />
}

function App() {
  return (
    <SessionProvider>
      <AppContent />
    </SessionProvider>
  )
}

export default App
