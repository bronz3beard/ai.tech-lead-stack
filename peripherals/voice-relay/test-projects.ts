import { scanProjects } from './src/projects.js';
import 'dotenv/config';
console.log(scanProjects(process.env.PROJECT_ROOTS));
