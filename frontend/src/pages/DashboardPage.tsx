import { useSession } from '../app/useSession'

export function DashboardPage() {
  const { email, role, signOut } = useSession()

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Dashboard</h1>
          <p style={{ marginTop: 0, color: '#475569' }}>Authenticated scaffold landing page</p>
        </div>
        <button onClick={signOut} style={{ padding: '8px 12px', borderRadius: 8 }}>
          Sign Out
        </button>
      </header>

      <section style={{ marginTop: 16, background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 10px 30px rgba(2, 6, 23, 0.08)' }}>
        <p style={{ margin: 0 }}><strong>Email:</strong> {email}</p>
        <p style={{ marginTop: 8 }}><strong>Role:</strong> {role}</p>
      </section>
    </main>
  )
}
