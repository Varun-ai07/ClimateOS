import { ReactNode } from 'react'

export const tokens = {
  surface: '#ECE7E2',
  ink: '#260101',
  acting: '#BFA27E',
  thinking: '#735448',
  decided: '#4A6741',
  alert: '#8B3A3A',
  idle: '#9B8B7A',
}

interface ThemeProviderProps {
  children: ReactNode
}

export default function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <div
      className="min-h-screen bg-surface text-ink antialiased"
      style={{
        '--surface': tokens.surface,
        '--ink': tokens.ink,
        '--acting': tokens.acting,
        '--thinking': tokens.thinking,
        '--decided': tokens.decided,
        '--alert': tokens.alert,
        '--idle': tokens.idle,
      } as React.CSSProperties}
    >
      {children}
    </div>
  )
}
