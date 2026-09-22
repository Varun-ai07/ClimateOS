/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#D9C5B4',
          dark: '#BFA27E',
        },
        neutral: {
          DEFAULT: '#E7DED3',
          light: '#ECE7E2',
        },
        accent: '#735448',
        text: '#260101',
        surface: '#ECE7E2',
        ink: '#260101',
        acting: '#BFA27E',
        thinking: '#735448',
        decided: '#4A6741',
        alert: '#8B3A3A',
        idle: '#9B8B7A',
      },
      fontFamily: {
        display: ['Georgia', 'serif'],
        body: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}