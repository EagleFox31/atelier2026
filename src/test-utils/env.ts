/** Assigne NODE_ENV en contournant le typage read-only de @types/node */
export function setNodeEnv(value: string): void {
  Object.defineProperty(process.env, 'NODE_ENV', {
    value,
    writable: true,
    configurable: true,
  });
}
