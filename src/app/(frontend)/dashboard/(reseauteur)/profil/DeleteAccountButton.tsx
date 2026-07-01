'use client'

export function DeleteAccountButton() {
  const handleDelete = () => {
    if (!window.confirm(
      'Cette action est irréversible. Votre profil et vos données seront définitivement supprimés. Confirmer ?'
    )) return

    fetch('/api/account/delete', { method: 'POST' })
      .then((r) => r.json())
      .then((data: { success?: boolean; error?: string }) => {
        if (data.success) {
          window.location.href = '/login?deleted=1'
        } else {
          alert(data.error ?? 'Erreur lors de la suppression.')
        }
      })
      .catch(() => alert('Erreur réseau. Réessayez.'))
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      className="text-xs text-red-600 hover:text-red-700 transition-colors block"
    >
      Supprimer mon compte (définitif)
    </button>
  )
}
