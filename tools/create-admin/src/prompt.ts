const CTRL_C = "\u0003";
const CTRL_D = "\u0004";
const BACKSPACE = "\u007f";
const BACKSPACE_ALT = "\b";

/** Reads a line from the TTY without echoing it. Rejects when stdin is not a TTY. */
export function readHidden(prompt: string): Promise<string> {
  const { stdin, stdout } = process;
  if (!stdin.isTTY) return Promise.reject(new Error("No TTY: set RECAP_ADMIN_PASSWORD instead."));
  return new Promise((resolve, reject) => {
    let value = "";
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const finish = (error?: Error) => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") return finish();
        if (char === CTRL_C || char === CTRL_D) return finish(new Error("Đã hủy."));
        if (char === BACKSPACE || char === BACKSPACE_ALT) value = value.slice(0, -1);
        else value += char;
      }
    };
    stdin.on("data", onData);
  });
}
