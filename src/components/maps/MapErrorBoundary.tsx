'use client'

import { Component } from 'react'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export default class MapErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full bg-gray-50 text-center p-8">
          <div>
            <p className="text-lg font-semibold text-gray-700 mb-2">
              Impossible de charger la carte
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Une erreur est survenue. Veuillez rafraichir la page.
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm cursor-pointer hover:opacity-90 transition-opacity"
            >
              Réessayer
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
