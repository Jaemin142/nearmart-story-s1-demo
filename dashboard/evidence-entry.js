import {submissionMode} from './version-client.js';
if (submissionMode) await import('./evidence-cplus.js');
else await import('./evidence.js');
