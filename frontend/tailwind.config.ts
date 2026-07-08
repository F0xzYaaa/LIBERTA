import type { Config } from 'tailwindcss';
import { colors, fontFamily, radius } from './src/theme/tokens';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: colors.primary,
          dark: colors.primaryDark,
        },
        accent: colors.accent,
        cream: colors.cream,
        sage: {
          gray: colors.sageGray,
          teal: colors.sageTeal,
        },
      },
      fontFamily: {
        serif: [...fontFamily.serif],
        sans: [...fontFamily.sans],
      },
      borderRadius: {
        card: radius.card,
        button: radius.button,
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(26 42 29 / 0.08), 0 1px 2px -1px rgb(26 42 29 / 0.08)',
      },
    },
  },
  plugins: [],
} satisfies Config;
