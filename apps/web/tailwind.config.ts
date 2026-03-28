import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#1D9E75', light: '#E1F5EE' },
        accent: '#EF9F27',
        danger: '#D85A30',
      },
    },
  },
  plugins: [],
};
export default config;
