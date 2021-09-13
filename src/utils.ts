export function sleep(seconds: number) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000, {}))
}

export function isTimeout(start: number, timeoutSeconds: number) {
  return Date.now() > start + timeoutSeconds * 1000
}