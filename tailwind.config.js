/** @type {import('tailwindcss').Config} */
module.exports = {
  // Enables NativeWind's reset/base/utilities layers.
  presets: [require('nativewind/preset')],
  // Class-based dark mode so web can toggle a "dark" class on the root <html>
  // element (NativeWind's documented web approach). Native still resolves
  // dark: variants via the Appearance color scheme observable.
  darkMode: 'class',
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
        success: {
          500: '#22c55e',
        },
        danger: {
          500: '#ef4444',
        },
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
    },
  },
  plugins: [],
};
