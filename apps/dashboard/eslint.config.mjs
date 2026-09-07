import nextConfig from 'eslint-config-next';
import rootConfig from '../../eslint.config.mjs';

const dashboardConfig = [
  ...rootConfig,
  ...nextConfig,
  {
    rules: {
      'react/no-unescaped-entities': 'warn',
    },
  },
];

export default dashboardConfig;
