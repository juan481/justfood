import type { Config } from 'tailwindcss';

// Design tokens extracted verbatim from the KDS Stitch exports
// (design-reference/kds_justfood_*/code.html, inline `tailwind.config`
// script block) — per the approved architecture plan, this is the ONE
// design system for the whole app (KDS + every back-office screen),
// not just the kitchen display. The Material 3 / Poppins tokens in
// design-reference/mi_sistema_de_dise_o_1/2/DESIGN.md are superseded
// and must not be reintroduced here.
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        command: {
          950: '#042610',
          900: '#06381a',
          800: '#0a4d25',
          700: '#0e6431',
        },
        limeaccent: '#9ff799',
        canvas: '#f4f6f1',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  // The original Stitch exports load Tailwind's CDN build with
  // ?plugins=forms,container-queries — carried forward here so ported
  // components (inline-editable price cells, filter pills) behave the same.
  // tailwindcss-animate adds the animate-in/fade-in/slide-in-from-*
  // utilities used for the site-wide fade/slide polish.
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
    require('tailwindcss-animate'),
  ],
};

export default config;
