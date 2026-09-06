import type { Config } from 'tailwindcss'

/**
 * Paleta basada en los System Colors de iOS (dark mode).
 * Son los valores exactos que Apple usa en SwiftUI, no aproximaciones.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Superficies
        ink: {
          DEFAULT: '#000000', // OLED puro — el negro que "apaga" el píxel
          raised: '#09090B',
          card: 'rgba(255,255,255,0.055)',
          hover: 'rgba(255,255,255,0.085)',
        },
        hairline: 'rgba(255,255,255,0.08)',
        // Texto (iOS label hierarchy)
        label: {
          DEFAULT: '#F5F5F7',
          secondary: '#98989F',
          tertiary: '#5C5C63',
        },
        // Acentos — iOS system colors, variante dark
        accent: {
          blue: '#0A84FF',
          green: '#30D158',
          red: '#FF453A',
          orange: '#FF9F0A',
          violet: '#BF5AF2',
          teal: '#40C8E0',
          pink: '#FF375F',
          indigo: '#5E5CE6',
          yellow: '#FFD60A',
        },
      },
      fontFamily: {
        // -apple-system primero en la cascada de respaldo entrega SF Pro real
        // en iPhone, que es más fiel que Inter al look nativo.
        sans: ['var(--font-inter)', '-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        display: '-0.028em',
        title: '-0.021em',
      },
      borderRadius: {
        // Radios "continuos" al estilo Apple: generosos, nunca cuadrados
        card: '22px',
        sheet: '32px',
        pill: '999px',
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.055) inset, 0 8px 32px -12px rgba(0,0,0,0.9)',
        sheet: '0 -8px 48px -8px rgba(0,0,0,0.85)',
        // El resplandor del botón lleva también un anillo tenue: sin él, sobre
        // negro puro, el degradado azul se recorta con un borde duro.
        glow: '0 8px 28px -6px rgba(10,132,255,0.5), 0 0 0 0.5px rgba(255,255,255,0.12) inset',
      },
      backdropBlur: { xs: '2px', sheet: '28px' },
      transitionTimingFunction: {
        // La curva de iOS. Casi todo el "feel" de Apple vive aquí.
        ios: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      keyframes: {
        'sheet-in': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'sheet-in': 'sheet-in 420ms cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [],
}

export default config
