export interface INotifier {
  // Calls `handler` with the payload of every NOTIFY on `channel` (another connection than the pool's, so it
  // works with more than one API instance). Returns the function that stops listening.
  subscribe(channel: string, handler: (payload: string) => void): Promise<() => void>;
}
