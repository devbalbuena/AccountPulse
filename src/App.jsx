import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import AuthLayout from '@/layouts/AuthLayout'
import AppLayout from '@/layouts/AppLayout'
import ErrorBoundary from '@/components/ErrorBoundary'

// Route-level code-splitting via dynamic import()
const Login = lazy(() => import('@/pages/auth/Login'))
const Register = lazy(() => import('@/pages/auth/Register'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const AccountsIndex = lazy(() => import('@/pages/accounts/Index'))
const AccountsArchived = lazy(() => import('@/pages/accounts/Archived'))
const SubscriptionsIndex = lazy(() => import('@/pages/subscriptions/Index'))
const SubscriptionsArchived = lazy(() => import('@/pages/subscriptions/Archived'))
const Notifications = lazy(() => import('@/pages/Notifications'))
const Reports = lazy(() => import('@/pages/Reports'))
const Settings = lazy(() => import('@/pages/Settings'))
const Features = lazy(() => import('@/pages/marketing/Features'))
const Security = lazy(() => import('@/pages/marketing/Security'))
const Support = lazy(() => import('@/pages/marketing/Support'))

function PageSpinner() {
  return (
    <div
      className="flex items-center justify-center min-h-[45vh]"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <div
        className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }}
      />
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--background)' }}
      >
        <PageSpinner />
      </div>
    )
  }
  return user ? children : <Navigate to="/login" replace />
}

function GuestRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return !user ? children : <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Marketing routes */}
          <Route path="/features" element={<Features />} />
          <Route path="/security" element={<Security />} />
          <Route path="/support" element={<Support />} />

          {/* Auth routes */}
          <Route element={<AuthLayout />}>
            <Route
              path="/login"
              element={
                <GuestRoute>
                  <Login />
                </GuestRoute>
              }
            />
            <Route
              path="/register"
              element={
                <GuestRoute>
                  <Register />
                </GuestRoute>
              }
            />
          </Route>

          {/* Protected routes */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/accounts" element={<AccountsIndex />} />
            <Route path="/accounts/archived" element={<AccountsArchived />} />
            <Route path="/subscriptions" element={<SubscriptionsIndex />} />
            <Route path="/subscriptions/archived" element={<SubscriptionsArchived />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
