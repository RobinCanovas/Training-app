const c = (v) => `rgb(var(--${v}) / <alpha-value>)`;
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: c('bg'), surface: c('surface'), raised: c('raised'), line: c('line'),
        text: c('text'), muted: c('muted'), accent: c('accent'), 'accent-ink': c('accent-ink'),
        blue: c('blue'), aqua: c('aqua'), good: c('good'), warn: c('warn'), serious: c('serious'), crit: c('crit'),
      },
      fontFamily: { sans: ['Barlow', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
    },
  },
  corePlugins: { container: false },
};
