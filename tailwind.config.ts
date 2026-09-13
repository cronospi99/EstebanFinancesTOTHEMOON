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
        // Todo sale de las variables de globals.css, que es donde viven los dos
        // temas. Aquí solo se les pone nombre para poder escribirlos en clases.
        ink: {
          DEFAULT: 'var(--ink)',
          raised: 'var(--ink-raised)',
          card: 'var(--ink-card)',
          hover: 'var(--ink-hover)',
        },
        /** Fondo opaco: el de las filas que se deslizan sobre un botón. */
        surface: 'var(--surface)',
        /** El panel de las bottom sheets, que va por encima de todo. */
        sheet: 'var(--sheet)',
        /** Barras fijas translúcidas, y el velo que oscurece detrás de una hoja. */
        chrome: { DEFAULT: 'var(--chrome)', soft: 'var(--chrome-soft)' },
        velo: 'var(--velo)',
        hairline: 'var(--hairline-color)',
        // Texto (iOS label hierarchy)
        label: {
          DEFAULT: 'var(--label)',
          secondary: 'var(--label-2)',
          tertiary: 'var(--label-3)',
        },
        /*
         * Rellenos, de más tenue a más marcado. Sustituyen a los `bg-white/[…]`
         * que estaban repartidos por toda la app: sobre fondo claro un blanco
         * al 5 % no se ve, y eran ciento cuarenta sitios donde el modo claro se
         * habría roto uno a uno.
         */
        fill: {
          1: 'var(--fill-1)',
          2: 'var(--fill-2)',
          3: 'var(--fill-3)',
          4: 'var(--fill-4)',
        },
        /** Anillo de "seleccionado" en los selectores de color. */
        'ring-sel': 'var(--ring-sel)',
        // Acentos — iOS system colors, con su variante para cada tema
        accent: {
          blue: 'var(--accent-blue)',
          green: 'var(--accent-green)',
          red: 'var(--accent-red)',
          orange: 'var(--accent-orange)',
          violet: 'var(--accent-violet)',
          teal: 'var(--accent-teal)',
          pink: 'var(--accent-pink)',
          indigo: 'var(--accent-indigo)',
          yellow: 'var(--accent-yellow)',
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
        card: 'var(--sombra-card)',
        sheet: 'var(--sombra-sheet)',
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
