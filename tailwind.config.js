/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Kong premium dark palette.
        space: {
          900: '#0B0E14',  // primary background (Deep Space Blue)
          800: '#0F1320',
          700: '#161A2A',
          600: '#1E2336',
        },
        emerald: {
          // Emerald Glow accent — kept under "kong" to avoid clashing with
          // Tailwind's default `emerald`. Default still available.
        },
        kong: {
          glow: '#50FA7B',          // Emerald Glow (primary accent)
          glowSoft: '#7EFAA0',
          glowDim: '#2BB85A',
          ink: '#F8FAFC',           // Soft White (primary text)
          inkMuted: '#94A3B8',
          inkSubtle: '#64748B',
          border: 'rgba(255, 255, 255, 0.08)',
          borderStrong: 'rgba(255, 255, 255, 0.14)',
        },
      },
      fontFamily: {
        // Body text — neutral, highly legible.
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Headings — geometric, education-feeling.
        display: ['var(--font-lexend)', 'var(--font-inter)', 'ui-sans-serif', 'sans-serif'],
      },
      boxShadow: {
        // Glassmorphism shadow + faint glow.
        glass: '0 8px 32px 0 rgba(2, 6, 23, 0.45), inset 0 1px 0 0 rgba(255,255,255,0.06)',
        'glow-emerald': '0 0 24px -4px rgba(80, 250, 123, 0.45)',
        'glow-emerald-strong': '0 0 36px -2px rgba(80, 250, 123, 0.65)',
      },
      backgroundImage: {
        // Gradient mesh — used by the animated body background.
        'mesh-emerald':
          'radial-gradient(at 18% 12%, rgba(80, 250, 123, 0.18) 0px, transparent 45%),' +
          'radial-gradient(at 82% 28%, rgba(96, 165, 250, 0.16) 0px, transparent 50%),' +
          'radial-gradient(at 32% 88%, rgba(167, 139, 250, 0.14) 0px, transparent 50%),' +
          'radial-gradient(at 78% 78%, rgba(80, 250, 123, 0.12) 0px, transparent 50%)',
      },
      animation: {
        'slow-spin': 'spin 12s linear infinite',
        'mesh-drift': 'mesh-drift 24s ease-in-out infinite',
        'kong-float': 'kong-float 6s ease-in-out infinite',
        'fade-in-up': 'fade-in-up 0.35s ease-out both',
      },
      keyframes: {
        'mesh-drift': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '50%':      { transform: 'translate3d(-2%, 1.5%, 0) scale(1.08)' },
        },
        'kong-float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
        'fade-in-up': {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
