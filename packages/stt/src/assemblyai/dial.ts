import type { SocketFactory, SttSocket } from "../deepgram/provider";

export interface DialOptions {
  url: string;
  apiKey: string;
  connectTimeoutMs: number;
  createSocket: SocketFactory;
  /** True once the owner is closing: a socket that opens late is thrown away. */
  isClosing: () => boolean;
  onOpen: (socket: SttSocket) => void;
  onMessage: (socket: SttSocket, data: string) => void;
  /** An already-open socket errored or closed. */
  onDrop: (socket: SttSocket) => void;
}

/** Opens one socket; resolves when open, rejects if it fails or times out before opening. */
export function dialSocket(options: DialOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = options.createSocket(options.url, { Authorization: options.apiKey });
    let opened = false;
    const timeout = setTimeout(() => socket.terminate(), options.connectTimeoutMs);
    const fail = (reason: string) => {
      clearTimeout(timeout);
      if (!opened) reject(new Error(reason));
      else options.onDrop(socket);
    };
    socket.on("open", () => {
      clearTimeout(timeout);
      if (options.isClosing()) {
        socket.removeAllListeners();
        socket.on("error", () => undefined);
        socket.terminate();
        reject(new Error("AssemblyAI provider closed while connecting"));
        return;
      }
      opened = true;
      options.onOpen(socket);
      resolve();
    });
    socket.on("message", (data) => options.onMessage(socket, String(data)));
    socket.on("error", (error) => fail(`AssemblyAI socket error: ${error.message}`));
    socket.on("close", (code) => fail(`AssemblyAI socket closed (code ${code})`));
  });
}
