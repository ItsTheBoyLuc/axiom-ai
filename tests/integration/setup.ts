import { loadDotEnv } from '../support/test-db';

// Workers inherit TEST_DATABASE_URL/DATABASE_URL from global-setup; this is a safety net when a
// file is run in isolation. REDIS_URL comes from .env locally or the CI service.
loadDotEnv();
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
