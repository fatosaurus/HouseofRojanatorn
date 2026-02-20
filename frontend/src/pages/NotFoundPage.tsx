import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <div>
        <h1>404</h1>
        <p>Route not found.</p>
        <Link to="/dashboard">Go to dashboard</Link>
      </div>
    </div>
  )
}
