import { Outlet } from 'react-router-dom'

// Auth pages (Login/Register) own their full-screen layout.
// This layout is just a transparent passthrough.
export default function AuthLayout() {
  return <Outlet />
}
