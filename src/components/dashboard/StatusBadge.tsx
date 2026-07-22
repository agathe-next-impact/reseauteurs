const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  publiee: { label: 'Publiee', bg: '#d1fae5', color: '#065f46' },
  suspendue: { label: 'Suspendue', bg: '#E9E9EA', color: '#3F4247' },
}

export default function StatusBadge({ statut }: { statut: string }) {
  const cfg = STATUS_CONFIG[statut] || STATUS_CONFIG['publiee']
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: 20,
        fontSize: '0.85rem',
        fontWeight: 600,
        background: cfg.bg,
        color: cfg.color,
      }}
    >
      {cfg.label}
    </span>
  )
}
