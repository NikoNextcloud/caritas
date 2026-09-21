import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // AdminLTE dark sidebar colors
        sidebar: {
          bg: '#222d32',
          hover: '#1e282c',
          active: '#1a2226',
          text: '#8aa4af',
          header: '#4b646f',
        },
        brand: {
          primary: '#3c8dbc',
          success: '#00a65a',
          warning: '#f39c12',
          danger: '#dd4b39',
          info: '#00c0ef',
        }
      }
    },
  },
  plugins: [],
}
export default config
