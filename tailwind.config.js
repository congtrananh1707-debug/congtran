/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      animation: {
        'slow-spin': 'spin 12s linear infinite',
      },
    },
  },
  plugins: [],
};
