import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type PDFDocumentLoadingTask, type RenderTask } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function PdfPage({ document, number }: { document: PDFDocumentProxy; number: number; key?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [pageText, setPageText] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let task: RenderTask | undefined;
    void document.getPage(number).then(async page => {
      if (!active || !canvas.current) return;
      const natural = page.getViewport({ scale: 1 });
      const scale = Math.min((canvas.current.parentElement?.clientWidth ?? 800) / natural.width, 1.5);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: scale * pixelRatio });
      canvas.current.width = Math.ceil(viewport.width);
      canvas.current.height = Math.ceil(viewport.height);
      canvas.current.style.width = `${natural.width * scale}px`;
      canvas.current.style.height = `${natural.height * scale}px`;
      task = page.render({ canvas: canvas.current, viewport });
      await task.promise;
      const content = await page.getTextContent();
      if (active) setPageText(content.items.map(item => 'str' in item ? item.str : '').join(' '));
    }).catch(cause => { if (active && cause?.name !== 'RenderingCancelledException') setError(true); });
    return () => { active = false; task?.cancel(); };
  }, [document, number]);

  return <section className="student-pdf-page" aria-label={`Page ${number} of ${document.numPages}`}>
    {error ? <p role="alert">Page {number} could not be displayed.</p> : <canvas ref={canvas} role="img" aria-label={`Page ${number} of PDF`}/>}
    <span className="sr-only">{pageText}</span>
  </section>;
}

export default function PdfMaterialPreview({ blob }: { blob: Blob }) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let task: PDFDocumentLoadingTask | undefined;
    setDocument(null); setError('');
    void blob.arrayBuffer().then(buffer => {
      if (!active) return;
      task = getDocument({ data: new Uint8Array(buffer) });
      return task.promise;
    }).then(pdf => { if (active && pdf) setDocument(pdf); })
      .catch(() => { if (active) setError('This PDF could not be displayed. Ask your admin to check the file.'); });
    return () => { active = false; void task?.destroy(); };
  }, [blob]);

  if (error) return <p role="alert" className="student-material-message">{error}</p>;
  if (!document) return <p role="status" className="student-material-message">Preparing PDF preview…</p>;
  return <div className="student-pdf-viewer" aria-label="PDF pages">
    {Array.from({ length: document.numPages }, (_, index) => <PdfPage key={index} document={document} number={index + 1}/>)}
  </div>;
}
