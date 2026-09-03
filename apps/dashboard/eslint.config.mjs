import nextConfig from 'eslint-config-next';
import rootConfig from '../../eslint.config.mjs';

const dashboardConfig = [...rootConfig, ...nextConfig];

export default dashboardConfig;
