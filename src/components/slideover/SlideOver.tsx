'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { X } from 'lucide-react'

interface SlideOverProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  /** Sur mobile : bottom-sheet réductible par toucher (au lieu du plein écran). */
  mobileBottomSheet?: boolean
  /**
   * Identifie le contenu affiché (ex : slug). Un changement ré-agrandit une feuille
   * repliée — sélectionner un autre marqueur ré-ouvre le panneau en grand.
   */
  contentKey?: string | number | null
}

/** Hauteur (px) restant visible quand la feuille est repliée. */
const PEEK_PX = 120
/** Déplacement (px) du doigt au-delà duquel une transition d'état est déclenchée. */
const DRAG_THRESHOLD = 60
/** En deçà de ce déplacement, le geste est un tap (bascule) et non un glissement. */
const TAP_SLOP = 8

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

type SheetPos = 'full' | 'peek'

export default function SlideOver({
  isOpen,
  onClose,
  children,
  mobileBottomSheet,
  contentKey,
}: SlideOverProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Mode feuille (mobile) vs panneau latéral (desktop). Piloté par matchMedia :
  // les classes CSS gèrent déjà l'apparence, cet état ne pilote QUE la logique JS
  // (glissement + repli) pour éviter toute fuite du transform sur desktop.
  const [isMobile, setIsMobile] = useState(false)
  const [sheetPos, setSheetPos] = useState<SheetPos>('full')

  // Glissement vertical en cours (feuille) — px de translation ; null = au repos.
  const [dragY, setDragY] = useState<number | null>(null)
  const dragStartYRef = useRef<number | null>(null)
  const dragBaseRef = useRef(0)
  const panelHeightRef = useRef(0)
  const movedRef = useRef(false)
  const lastTouchEndRef = useRef(0)

  // Glissement horizontal (panneau plein écran mobile — chemin sans bottom-sheet).
  const [dragX, setDragX] = useState(0)
  const dragXStartRef = useRef<number | null>(null)

  const bottomSheet = !!mobileBottomSheet && isMobile

  // Détection du point de rupture mobile
  useEffect(() => {
    if (!mobileBottomSheet) return
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => {
      setIsMobile(mq.matches)
      if (!mq.matches) setSheetPos('full') // repasse en desktop → réinitialise
    }
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [mobileBottomSheet])

  // À chaque ouverture (ou changement de contenu), la feuille s'ouvre en grand.
  // Reset en phase de rendu (et non dans un effet) — pattern React recommandé
  // pour ajuster un état sur changement de prop, aligné sur les SlideOver* enfants.
  const [prevOpenKey, setPrevOpenKey] = useState<string | null>(null)
  const openKey = isOpen ? `${contentKey ?? ''}` : null
  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey)
    if (isOpen) setSheetPos('full')
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()

      // Focus trap
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    },
    [onClose],
  )

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement
      document.addEventListener('keydown', handleKeyDown)
      // Focus the close button after a short delay (animation)
      setTimeout(() => {
        panelRef.current?.querySelector<HTMLElement>('button')?.focus()
      }, 100)
      return () => document.removeEventListener('keydown', handleKeyDown)
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus()
      previousFocusRef.current = null
    }
  }, [isOpen, handleKeyDown])

  // ── Repli / dépli de la feuille ────────────────────────────────────────
  const collapse = useCallback(() => {
    setSheetPos('peek')
    // Le repli ramène en haut pour que la portion visible montre l'en-tête.
    if (panelRef.current) panelRef.current.scrollTop = 0
  }, [])
  const expand = useCallback(() => setSheetPos('full'), [])
  const toggle = useCallback(() => {
    setSheetPos((p) => {
      if (p === 'full') {
        if (panelRef.current) panelRef.current.scrollTop = 0
        return 'peek'
      }
      return 'full'
    })
  }, [])

  // ── Glissement de la poignée (feuille mobile) ──────────────────────────
  const peekTranslate = () => Math.max(0, panelHeightRef.current - PEEK_PX)

  const onHandleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!bottomSheet) return
      panelHeightRef.current = panelRef.current?.offsetHeight ?? 0
      dragStartYRef.current = e.touches[0].clientY
      dragBaseRef.current = sheetPos === 'peek' ? peekTranslate() : 0
      movedRef.current = false
      setDragY(dragBaseRef.current)
    },
    [bottomSheet, sheetPos],
  )

  const onHandleTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragStartYRef.current == null) return
    const dy = e.touches[0].clientY - dragStartYRef.current
    if (Math.abs(dy) > TAP_SLOP) movedRef.current = true
    setDragY(clamp(dragBaseRef.current + dy, 0, panelHeightRef.current))
  }, [])

  const onHandleTouchEnd = useCallback(() => {
    if (dragStartYRef.current == null) return
    lastTouchEndRef.current = Date.now()
    const dy = (dragY ?? dragBaseRef.current) - dragBaseRef.current
    const startedFull = dragBaseRef.current === 0

    if (!movedRef.current) {
      toggle() // simple tap
    } else if (startedFull) {
      if (dy > panelHeightRef.current * 0.6) onClose()
      else if (dy > DRAG_THRESHOLD) collapse()
      else expand()
    } else {
      if (dy > DRAG_THRESHOLD) onClose()
      else if (dy < -DRAG_THRESHOLD) expand()
      else collapse()
    }

    setDragY(null)
    dragStartYRef.current = null
  }, [dragY, toggle, collapse, expand, onClose])

  // Souris / clavier : bascule (le click synthétique consécutif à un touch est ignoré).
  const onHandleClick = useCallback(() => {
    if (Date.now() - lastTouchEndRef.current < 500) return
    toggle()
  }, [toggle])
  const onHandleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        toggle()
      }
    },
    [toggle],
  )

  // ── Style de translation du panneau ────────────────────────────────────
  let panelStyle: React.CSSProperties | undefined
  if (bottomSheet && isOpen) {
    if (dragY != null) {
      panelStyle = { transform: `translateY(${dragY}px)`, transition: 'none' }
    } else if (sheetPos === 'peek') {
      panelStyle = { transform: `translateY(calc(67dvh - ${PEEK_PX}px))` }
    }
  } else if (!mobileBottomSheet && dragX > 0) {
    panelStyle = { transform: `translateX(${dragX}px)`, transition: 'none' }
  }

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className={`fixed inset-0 z-[999] bg-black/20 transition-opacity duration-200 ${
            mobileBottomSheet ? 'hidden md:block' : ''
          }`}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal={isOpen}
        aria-label="Panneau de détail"
        className={[
          'fixed z-[1000] bg-white overflow-y-auto transition-all duration-[280ms] ease-[cubic-bezier(0.4,0,0.2,1)]',
          // Desktop: always side panel
          'md:top-0 md:right-0 md:h-dvh md:w-1/2 md:min-w-[420px] md:max-w-[680px] md:border-l md:border-[#DFE0E1]',
          isOpen ? 'md:translate-x-0' : 'md:translate-x-full',
          // Mobile : bottom-sheet 2/3 d'écran (dvh — tient compte de la barre du navigateur)
          mobileBottomSheet
            ? `left-0 right-0 bottom-0 h-[67dvh] rounded-t-2xl border-t border-[#DFE0E1] ${
                isOpen ? 'translate-y-0' : 'translate-y-full'
              }`
            : `top-0 right-0 h-dvh w-full ${
                isOpen ? 'translate-x-0' : 'translate-x-full'
              }`,
          // Reset mobile transforms on desktop
          mobileBottomSheet ? 'md:translate-y-0 md:rounded-none md:left-auto md:w-1/2 md:h-dvh md:border-l md:border-[#DFE0E1]' : '',
        ].join(' ')}
        style={panelStyle}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Fermer"
          className={`absolute top-3 right-4 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-white/80 hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors cursor-pointer ${
            mobileBottomSheet ? 'hidden md:flex' : ''
          }`}
        >
          <X size={20} />
        </button>

        {/* Poignée — feuille mobile : glisser pour réduire/agrandir, taper pour basculer. */}
        {mobileBottomSheet && (
          <button
            type="button"
            aria-label={sheetPos === 'peek' ? 'Agrandir le panneau' : 'Réduire le panneau'}
            aria-expanded={sheetPos === 'full'}
            className="md:hidden sticky top-0 z-10 w-full flex justify-center pt-2.5 pb-2 bg-white/95 backdrop-blur-sm rounded-t-2xl cursor-grab active:cursor-grabbing touch-none select-none"
            onTouchStart={onHandleTouchStart}
            onTouchMove={onHandleTouchMove}
            onTouchEnd={onHandleTouchEnd}
            onClick={onHandleClick}
            onKeyDown={onHandleKeyDown}
          >
            <span className="w-10 h-1.5 rounded-full bg-gray-300" aria-hidden="true" />
          </button>
        )}

        {/* Content */}
        <div
          className={`px-6 pb-6 ${mobileBottomSheet ? 'pt-1 md:pt-4' : 'pt-4'}`}
          {...(!mobileBottomSheet ? {
            onTouchStart: (e: React.TouchEvent) => {
              dragXStartRef.current = e.touches[0].clientX
            },
            onTouchMove: (e: React.TouchEvent) => {
              if (dragXStartRef.current == null) return
              const dx = e.touches[0].clientX - dragXStartRef.current
              if (dx > 0) setDragX(dx)
            },
            onTouchEnd: () => {
              if (dragX > 100) onClose()
              setDragX(0)
              dragXStartRef.current = null
            },
          } : {})}
        >
          {children}
        </div>
      </div>
    </>
  )
}
