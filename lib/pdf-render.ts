/**
 * 客户端 PDF→PNG 渲染。用 pdfjs-dist 在浏览器 canvas 上绘制每一页,
 * 然后导出 data URL,准备上传给服务端做 vision 摘要。
 *
 * Worker 文件由 postinstall 复制到 /public/pdf.worker.min.mjs。
 *
 * 设计取舍:
 *  - 限制 maxPages = 5: 简历/PPT 关键内容通常前几页;同时控制 vision token 成本
 *  - pageWidthPx = 1200: 足够清晰识别小字和图表,文件体积约 100-300KB/页
 */

export type RenderedPage = {
  dataUrl: string;
  pageNumber: number;
};

let workerConfigured = false;

async function loadPdfJs() {
  // 仅在客户端执行(浏览器有 DOMMatrix / canvas)
  if (typeof window === "undefined") {
    throw new Error("renderPdfToImages must be called from the browser");
  }
  const pdfjs = await import("pdfjs-dist");
  if (!workerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    workerConfigured = true;
  }
  return pdfjs;
}

export async function renderPdfToImages(
  file: File,
  opts: { maxPages?: number; pageWidthPx?: number } = {},
): Promise<RenderedPage[]> {
  const { maxPages = 5, pageWidthPx = 1200 } = opts;
  const pdfjs = await loadPdfJs();

  const buf = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: buf });
  const doc = await loadingTask.promise;
  const numPages = Math.min(doc.numPages, maxPages);
  const results: RenderedPage[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await doc.getPage(i);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(pageWidthPx / baseViewport.width, 3);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");

    await page.render({ canvasContext: ctx, canvas, viewport }).promise;
    results.push({
      dataUrl: canvas.toDataURL("image/png"),
      pageNumber: i,
    });
  }

  await doc.cleanup();
  await doc.destroy();
  return results;
}
