/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ggl: {
          dark: '#07080E',
          card: '#0E111D',
          border: '#1E2538',
          gold: '#FFD700',
          yellow: '#FFC107',
          orange: '#FF5722',
          red: '#EF4444',
          accent: '#FFA000',
        },
      },
      fontFamily: {
        sans: ['var(--font-outfit)', 'Inter', 'sans-serif'],
        display: ['var(--font-bebas)', 'var(--font-anton)', 'Impact', 'sans-serif'],
        bebas: ['var(--font-bebas)', 'Impact', 'sans-serif'],
        barlow: ['var(--font-barlow)', 'sans-serif'],
      },
      boxShadow: {
        'stage-glow': '0 0 40px rgba(255, 215, 0, 0.25)',
        'orange-glow': '0 0 35px rgba(255, 87, 34, 0.3)',
        'gold-card': '0 10px 30px -10px rgba(255, 215, 0, 0.15)',
        'neon': '0 0 15px rgba(255, 215, 0, 0.6), 0 0 30px rgba(255, 87, 34, 0.4)',
      },
      backgroundImage: {
        'stage-radial': 'radial-gradient(ellipse at top, rgba(255,215,0,0.18) 0%, rgba(255,87,34,0.08) 40%, rgba(7,8,14,1) 80%)',
        'gold-gradient': 'linear-gradient(135deg, #FFE259 0%, #FFA751 100%)',
        'gold-text': 'linear-gradient(180deg, #FFF5C0 0%, #FFD700 50%, #FFA000 100%)',
        'metallic-gold': 'linear-gradient(135deg, #FFE082 0%, #FFB300 50%, #FF6F00 100%)',
        'card-gradient': 'linear-gradient(180deg, rgba(20,24,38,0.9) 0%, rgba(11,14,23,0.95) 100%)',
      },
      animation: {
        'spotlight': 'spotlight 4s ease-in-out infinite alternate',
        'pulse-glow': 'pulseGlow 2.5s ease-in-out infinite',
        'float': 'float 5s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
      },
      keyframes: {
        spotlight: {
          '0%': { transform: 'rotate(-12deg) scale(1)', opacity: '0.6' },
          '100%': { transform: 'rotate(12deg) scale(1.1)', opacity: '0.95' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.7', filter: 'drop-shadow(0 0 15px rgba(255,215,0,0.4))' },
          '50%': { opacity: '1', filter: 'drop-shadow(0 0 30px rgba(255,215,0,0.8))' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};
