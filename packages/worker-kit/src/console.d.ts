interface Console {
  log: (...data: unknown[]) => void;
  error: (...data: unknown[]) => void;
}

declare const console: Console;
