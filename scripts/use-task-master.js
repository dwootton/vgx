#!/usr/bin/env node

/**
 * use-task-master.js
 * Directly uses task-master-ai package functionality
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Get the task-master-ai path
const taskMasterPath = require.resolve('task-master-ai');
const taskMasterDir = taskMasterPath.substring(0, taskMasterPath.indexOf('index.js'));

// Import the task-master binary
const binPath = `${taskMasterDir}bin/task-master.js`;

// Execute with the current arguments
process.argv[1] = binPath;
import(binPath); 