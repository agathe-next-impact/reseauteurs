import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Widgets du tableau de bord admin — modèle 3 entités (ADR-0011).
 *
 * Remplace l'ancien tableau « revendeurs par plan » (PanoramaPub : rôle
 * `fournisseur`, plans `gratuit/premium/infinite`, ARR/MRR) qui référençait
 * des valeurs d'enum aujourd'hui invalides — la requête plantait dès qu'un
 * admin ouvrait `/admin`. On affiche désormais des compteurs alignés sur le
 * modèle réel : réseauteurs / événements / réseaux / partenaires, modération,
 * comptes par rôle et distribution des badges.
 */
export default async function DashboardWidgets() {
  const payload = await getPayload({ config })

  const [
    reseauteurs,
    evenements,
    reseaux,
    partenaires,
    rzEnAttente,
    rzValides,
    rzSuspendus,
    uReseauteurs,
    uOrganisateurs,
    uAdmins,
    bBronze,
    bArgent,
    bGold,
    bPlatinum,
  ] = await Promise.all([
    payload.count({ collection: 'reseauteurs', overrideAccess: true }),
    payload.count({ collection: 'evenements', overrideAccess: true }),
    payload.count({ collection: 'reseaux', overrideAccess: true }),
    payload.count({ collection: 'partenaires', overrideAccess: true }),
    payload.count({ collection: 'reseauteurs', where: { statut: { equals: 'en_attente' } }, overrideAccess: true }),
    payload.count({ collection: 'reseauteurs', where: { statut: { equals: 'valide' } }, overrideAccess: true }),
    payload.count({ collection: 'reseauteurs', where: { statut: { equals: 'suspendu' } }, overrideAccess: true }),
    payload.count({ collection: 'users', where: { role: { equals: 'reseauteur' } }, overrideAccess: true }),
    payload.count({ collection: 'users', where: { role: { equals: 'organisateur' } }, overrideAccess: true }),
    payload.count({ collection: 'users', where: { role: { equals: 'admin' } }, overrideAccess: true }),
    payload.count({ collection: 'reseauteurs', where: { badge: { equals: 'bronze' } }, overrideAccess: true }),
    payload.count({ collection: 'reseauteurs', where: { badge: { equals: 'argent' } }, overrideAccess: true }),
    payload.count({ collection: 'reseauteurs', where: { badge: { equals: 'gold' } }, overrideAccess: true }),
    payload.count({ collection: 'reseauteurs', where: { badge: { equals: 'platinum' } }, overrideAccess: true }),
  ])

  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={titleStyle}>Vue d’ensemble</h3>
      <div style={gridStyle}>
        <StatCard label="Réseauteurs" value={reseauteurs.totalDocs} color="#035AA6" />
        <StatCard label="Événements" value={evenements.totalDocs} color="#F5E050" />
        <StatCard label="Réseaux" value={reseaux.totalDocs} color="#012A4A" />
        <StatCard label="Partenaires" value={partenaires.totalDocs} color="#3E7CA6" />
      </div>

      <h3 style={{ ...titleStyle, marginTop: 32 }}>Modération des réseauteurs</h3>
      <div style={gridStyle}>
        <StatCard label="En attente" value={rzEnAttente.totalDocs} color="#f59e0b" />
        <StatCard label="Validés" value={rzValides.totalDocs} color="#16a34a" />
        <StatCard label="Suspendus" value={rzSuspendus.totalDocs} color="#dc2626" />
      </div>

      <h3 style={{ ...titleStyle, marginTop: 32 }}>Comptes par rôle</h3>
      <div style={gridStyle}>
        <StatCard label="Réseauteurs" value={uReseauteurs.totalDocs} color="#035AA6" />
        <StatCard label="Organisateurs" value={uOrganisateurs.totalDocs} color="#012A4A" />
        <StatCard label="Admins" value={uAdmins.totalDocs} color="#6E7175" />
      </div>

      <h3 style={{ ...titleStyle, marginTop: 32 }}>Badges déclarés</h3>
      <div style={gridStyle}>
        <StatCard label="Bronze" value={bBronze.totalDocs} color="#b45309" />
        <StatCard label="Argent" value={bArgent.totalDocs} color="#6E7175" />
        <StatCard label="Gold" value={bGold.totalDocs} color="#F5E050" />
        <StatCard label="Platinum" value={bPlatinum.totalDocs} color="#035AA6" />
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{
      padding: 16,
      border: '1px solid #DFE0E1',
      borderRadius: 8,
      background: '#fff',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '0.8rem', color: '#6E7175', marginTop: 4 }}>{label}</div>
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
