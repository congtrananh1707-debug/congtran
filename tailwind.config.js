/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#6C63FF', light: '#A89CFF', dark: '#4B44CC' },
        warm: { DEFAULT: '#FF8C69', light: '#FFB49A', dark: '#CC6644' },
        mint: { DEFAULT: '#4ECDC4', light: '#8EDDD8', dark: '#2EA8A0' },
        sunshine: { DEFAULT: '#FFD93D', light: '#FFE87A', dark: '#CCAC1F' },
      },
      borderRadius: { '3xl': '1.5rem', '4xl': '2rem' },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        wiggle: 'wiggle 0.3s ease-in-out',
        'bounce-in': 'bounceIn 0.4s ease-out',
        float: 'float 3s ease-in-out infinite',
      },
      keyframes: {
        wiggle: { '0%,100%': { transform: 'rotate(-5deg)' }, '50%': { transform: 'rotate(5deg)' } },
        bounceIn: { '0%': { transform: 'scale(0.5)', opacity: '0' }, '70%': { transform: 'scale(1.1)' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
      },
    },
  },
  plugins: [],
}
