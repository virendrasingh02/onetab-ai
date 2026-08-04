import axios from 'axios';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ?? '3000';

/**
 * Pre-configured client pointed at the API under test.
 *
 * Specs import this rather than mutating `axios.defaults` from a setup file —
 * Vitest gives each test file its own module registry, so a setup file and a
 * spec do not share a module instance.
 */
export const api = axios.create({
  baseURL: `http://${host}:${port}`,
  // Never reject on status — assertions inspect `res.status` directly.
  validateStatus: () => true,
});
