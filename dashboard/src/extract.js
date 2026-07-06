// Client-side text extraction (B4). Runs in the browser at upload time so no
// server/edge-function is needed — the dashboard is the only thing that uploads.
// pdf.js is heavy (~600 kB), so it's loaded ONLY when a PDF is actually uploaded.

// Extract plain text from a File. .pdf via pdf.js (lazy-loaded); else read as text.
export async function extractText(file) {
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".pdf")) {
    const pdfjsLib = await import("pdfjs-dist");
    const pdfWorkerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((it) => it.str).join(" "));
    }
    return pages.join("\n").replace(/\s+\n/g, "\n").trim();
  }
  // .txt / .md / .text and anything else: read directly.
  return (await file.text()).trim();
}
