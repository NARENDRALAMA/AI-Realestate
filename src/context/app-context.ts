import { createContext } from 'react'
import type { AppState } from './app-state'

export const AppContext = createContext<AppState | null>(null)
