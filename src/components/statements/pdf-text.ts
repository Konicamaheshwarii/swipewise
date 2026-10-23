// Browser-only: reads a statement PDF on the user's device with pdf.js. Nothing here touches the network:
// the file and password stay in memory and are never logged or uploaded.
import type { TextItemPos } from "@/lib/statement-parser";

type PdfJs = typeof import("pdfjs-dist");

let lib: Promise<PdfJs> | null = null;

/** Loads pdf.js on first use (keeps it out of server and initial bundles) and starts its worker. */
function pdfjs(): Promise<PdfJs> {
  lib ??= import("pdfjs-dist").then((mod) => {
    if (!mod.GlobalWorkerOptions.workerPort) {
      mod.GlobalWorkerOptions.workerPort = new Worker(new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), { type: "module" });
    }
    return mod;
  });
  return lib;
}

export type ReadResult =
  | { ok: true; pages: TextItemPos[][] }
  | { ok: false; reason: "password" | "wrong-password" | "unreadable" | "no-text"; message?: string };

const MAX_PAGES = 40;

let queue: Promise<unknown> = Promise.resolve();

/**
 * Text with positions for every page, or why it couldn't be read. Pass `password` for protected statements.
 * Reads run one at a time (overlapping loads on the shared worker can fail, and it keeps memory low).
 */
export function readPdf(file: File, password?: string): Promise<ReadResult> {
  const run = queue.then(() => read(file, password));
  queue = run.catch(() => undefined);
  return run;
}

async function read(file: File, password?: string): Promise<ReadResult> {
  const mod = await pdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = mod.getDocument({ data, password: password || undefined, stopAtErrors: false });
  let doc: Awaited<typeof task.promise>;
  try {
    doc = await task.promise;
  } catch (e) {
    const err = e as { name?: string; code?: number };
    if (err?.name === "PasswordException") {
      return { ok: false, reason: err.code === mod.PasswordResponses.INCORRECT_PASSWORD ? "wrong-password" : "password" };
    }
    // Only the error type, never the file or password.
    console.warn("Statement PDF could not be opened:", err?.name ?? "unknown error");
    return { ok: false, reason: "unreadable", message: "This doesn't look like a valid PDF." };
  }
  try {
    const pages: TextItemPos[][] = [];
    for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const items: TextItemPos[] = [];
      for (const it of content.items) {
        if (!("str" in it) || !it.str) continue;
        const [a, b, , d, x, y] = it.transform as number[];
        items.push({ str: it.str, x, y, w: it.width, h: it.height || Math.hypot(b, d) || Math.abs(a) || 8 });
      }
      pages.push(items);
      page.cleanup();
    }
    if (!pages.some((p) => p.length > 5)) {
      return { ok: false, reason: "no-text", message: "No text found. Scanned statements (images) can't be read yet." };
    }
    return { ok: true, pages };
  } finally {
    await task.destroy();
  }
}
