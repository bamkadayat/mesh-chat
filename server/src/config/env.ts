export type ServerConfig = {
  port: number;
  clientOrigin: string;
};

const DEFAULT_PORT = 3001;
const DEFAULT_CLIENT_ORIGIN = 'http://localhost:5173';

/** Takes the environment as an argument so it can be tested without touching process.env. */
export function readServerConfig(env: NodeJS.ProcessEnv): ServerConfig {
  const port = Number(env.PORT ?? DEFAULT_PORT);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`PORT must be a positive integer, received "${env.PORT ?? ''}"`);
  }

  return { port, clientOrigin: env.CLIENT_ORIGIN ?? DEFAULT_CLIENT_ORIGIN };
}
