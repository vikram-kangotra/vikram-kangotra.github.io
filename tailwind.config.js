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
}

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
          typography: {
				DEFAULT: { css: disabledCss },
				sm: { css: disabledCss },
				lg: { css: disabledCss },
				xl: { css: disabledCss },
				'2xl': { css: disabledCss },
			},
      }
  },
  plugins: [
      require('@tailwindcss/typography')
  ],
}
