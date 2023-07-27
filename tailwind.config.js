/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
      extend: {
          colors: {
              primary: 'rgb(56, 56, 67)',
              secondary: 'rgb(114, 114, 136)',
              tertiary: 'rgb(255, 255, 255)',
              quaternary: 'rgb(51, 51, 51)',
              dark: '#0d0d0d',
          },
      }
  },
  plugins: [],
}
