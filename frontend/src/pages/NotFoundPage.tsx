import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="not-found-page">
      <div className="not-found-card">
        <h1>404</h1>
        <p>Route not found.</p>
        <Link className="secondary-btn" to="/dashboard">Go to dashboard</Link>
      </div>
    </div>
  )
}
