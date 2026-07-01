export default {
  plugins: {
    '@tailwindcss/postcss': {},
    'postcss-preset-env': {
      stage: 2,
      features: {
        'oklab-function': { preserve: true },
        'color-functional-notation': { preserve: true },
        'logical-properties-and-values': false,
        'cascade-layers': false,
      },
      autoprefixer: { grid: false },
    },
  },
}
