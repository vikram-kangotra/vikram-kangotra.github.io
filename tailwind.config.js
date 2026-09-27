/** @type {import('tailwindcss').Config} */

const disabledCss = {
  'code::before': false,
  'code::after': false,
  'blockquote p:first-of-type::before': false,
  'blockquote p:last-of-type::after': false,
  pre: false,
  code: false,
  'pre code': false,
  'code::before': false,
  'code::after': false,
};

module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Light mode colors
        primary: 'rgb(23, 23, 33)', // Darker text for better contrast
        secondary: 'rgb(100, 116, 139)', // Softer gray for secondary text
        tertiary: 'rgb(255, 255, 255)', // Pure white
        quaternary: 'rgb(241, 245, 249)', // Light gray for backgrounds
        accent: 'rgb(99, 102, 241)', // Modern indigo
        // Dark mode colors - Modern and clean
        'dark-primary': 'rgb(229, 231, 235)', // Light gray for text
        'dark-secondary': 'rgb(156, 163, 175)', // Medium gray for secondary text
        'dark-tertiary': 'rgb(10, 15, 25)', // Darker blue-gray for main background
        'dark-quaternary': 'rgb(20, 25, 35)', // Slightly lighter blue-gray for cards
        'dark-accent': 'rgb(129, 140, 248)', // Brighter indigo for accents
        // Additional colors
        'light-gray': 'rgb(241, 245, 249)',
        'dark-gray': 'rgb(20, 25, 35)',
        'hover-light': 'rgb(238, 242, 255)',
        'hover-dark': 'rgb(35, 40, 50)', // Darker hover state
      },
      typography: {
        DEFAULT: {
          css: {
            ...disabledCss,
            color: 'var(--ink)',
            a: {
              color: 'var(--accent)',
              '&:hover': {
                color: 'var(--accent)',
              },
            },
            h1: { color: 'var(--ink)' },
            h2: { color: 'var(--ink)' },
            h3: { color: 'var(--ink)' },
            h4: { color: 'var(--ink)' },
            strong: { color: 'var(--ink)' },
            blockquote: { color: 'var(--ink)' },
            code: { color: 'var(--ink)' },
          },
        },
        sm: { css: disabledCss },
        lg: { css: disabledCss },
        xl: { css: disabledCss },
        '2xl': { css: disabledCss },
        invert: {
          css: {
            ...disabledCss,
            color: 'var(--ink)',
            a: {
              color: 'var(--accent)',
              '&:hover': {
                color: 'var(--accent)',
              },
            },
            h1: { color: 'var(--ink)' },
            h2: { color: 'var(--ink)' },
            h3: { color: 'var(--ink)' },
            h4: { color: 'var(--ink)' },
            strong: { color: 'var(--ink)' },
            blockquote: { color: 'var(--ink)' },
            code: { color: 'var(--ink)' },
          },
        },
      },
      animation: {
        'gradient-x': 'gradient-x 15s ease infinite',
        'gradient-y': 'gradient-y 15s ease infinite',
        'gradient-xy': 'gradient-xy 15s ease infinite',
      },
      keyframes: {
        'gradient-y': {
          '0%, 100%': {
            'background-size': '400% 400%',
            'background-position': 'center top',
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'center center',
          },
        },
        'gradient-x': {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center',
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center',
          },
        },
        'gradient-xy': {
          '0%, 100%': {
            'background-size': '400% 400%',
            'background-position': 'left center',
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center',
          },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
