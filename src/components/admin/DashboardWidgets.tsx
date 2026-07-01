import { getPayload } from 'payload'
import config from '@payload-config'

export default async function DashboardWidgets() {
  const payload = await getPayload({ config })

  // --- Stats fournisseurs par plan ---
  const [gratuitCount, premiumCount, infiniteCount] = await Promise.all([
    payload.count({ collection: 'users', where: { plan: { equals: 'gratuit' }, role: { equals: 'fournisseur' } }, overrideAccess: true }),
    payload.count({ collection: 'users', where: { plan: { equals: 'premium' }, role: { equals: 'fournisseur' } }, overrideAccess: true }),
    payload.count({ collection: 'users', where: { plan: { equals: 'infinite' }, role: { equals: 'fournisseur' } }, overrideAccess: true }),
  ])

  // ARR calc — Premium 99 EUR/an, Infinite 219 EUR/an
  const arr = premiumCount.totalDocs * 99 + infiniteCount.totalDocs * 219
  const mrr = arr / 12

  // --- Abonnements ---
  const now = new Date().toISOString()
  const { docs: subscribers } = await payload.find({
    collection: 'users',
    where: {
      plan: { not_equals: 'gratuit' },
      role: { equals: 'fournisseur' },
    },
    select: { nomSociete: true, email: true, plan: true, planExpiresAt: true },
    depth: 0,
    limit: 0,
    overrideAccess: true,
  })

  const actifs = subscribers.filter((u) => u.planExpiresAt && u.planExpiresAt > now)
  const expires = subscribers.filter((u) => u.planExpiresAt && u.planExpiresAt <= now)

  return (
    <div style={{ marginTop: 24 }}>
      {/* Stats & Revenue */}
      <h3 style={titleStyle}>Statistiques revendeurs</h3>
      <div style={gridStyle}>
        <StatCard label="Gratuit" value={gratuitCount.totalDocs} color="#9ca3af" />
        <StatCard label="Premium" value={premiumCount.totalDocs} color="#1e40af" />
        <StatCard label="Infinite" value={infiniteCount.totalDocs} color="#1d4ed8" />
        <StatCard label="MRR" value={`${mrr.toFixed(0)} EUR`} color="#16a34a" />
        <StatCard label="ARR" value={`${arr.toFixed(0)} EUR`} color="#16a34a" />
      </div>

      {/* Abonnements */}
      <h3 style={{ ...titleStyle, marginTop: 32 }}>
        Abonnements ({subscribers.length})
      </h3>
      <div style={gridStyle}>
        <StatCard label="Actifs" value={actifs.length} color="#16a34a" />
        <StatCard label="Expires" value={expires.length} color="#dc2626" />
      </div>
      {subscribers.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginTop: 12 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              <th style={thStyle}>Société</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Plan</th>
              <th style={thStyle}>Expiration</th>
              <th style={thStyle}>Statut</th>
            </tr>
          </thead>
          <tbody>
            {subscribers.slice(0, 30).map((u) => {
              const isExpired = u.planExpiresAt && u.planExpiresAt <= now
              return (
                <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={tdStyle}>{u.nomSociete}</td>
                  <td style={tdStyle}>{u.email}</td>
                  <td style={tdStyle}>{u.plan}</td>
                  <td style={tdStyle}>
                    {u.planExpiresAt ? new Date(u.planExpiresAt).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: isExpired ? '#fef2f2' : '#d1fae5',
                      color: isExpired ? '#dc2626' : '#065f46',
                    }}>
                      {isExpired ? 'Expire' : 'Actif'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{
      padding: 16,
      border: '1px solid #e5e7eb',
      borderRadius: 8,
      background: '#fff',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 4 }}>{label}</div>
    </div>
  )
}

const titleStyle: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: 600,
  marginBottom: 12,
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
  gap: 12,
}

const ficheCardStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 12,
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  marginBottom: 8,
  background: '#fff',
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  fontWeight: 600,
}

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
}
