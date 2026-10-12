import { jsPDF } from 'jspdf';
import html2canvas from '../lib/html2canvas-patch';

export const CERTIFICATE_CANVAS_WIDTH = 1122.52;
export const CERTIFICATE_CANVAS_HEIGHT = 793.7;
// ponytail: 1.5x/0.72 keeps text readable at A4 size while avoiding multi-megabyte raster PDFs.
const CERTIFICATE_RENDER_SCALE = 1.5;
const JPEG_QUALITY = 0.72;

export type CertificatePdfOutput = {
  pdf: jsPDF;
  pdfBlob: Blob;
  imageData: string;
  previewUrl?: string;
};

async function waitForCertificateAssets(element: HTMLElement) {
  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(images.map((image) => {
    if (image.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      image.addEventListener('load', () => resolve(), { once: true });
      image.addEventListener('error', () => resolve(), { once: true });
    });
  }));

  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

export async function captureCertificate(element: HTMLElement) {
  await waitForCertificateAssets(element);

  return html2canvas(element, {
    scale: CERTIFICATE_RENDER_SCALE,
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#FFFFFF',
    imageTimeout: 15000,
    logging: false,
    width: CERTIFICATE_CANVAS_WIDTH,
    height: CERTIFICATE_CANVAS_HEIGHT,
    windowWidth: CERTIFICATE_CANVAS_WIDTH,
    windowHeight: CERTIFICATE_CANVAS_HEIGHT,
    scrollX: 0,
    scrollY: 0,
    x: 0,
    y: 0,
  });
}

export function certificateCanvasToJpeg(canvas: HTMLCanvasElement) {
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

function canvasToJpegBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not encode certificate preview'));
    }, 'image/jpeg', JPEG_QUALITY);
  });
}

export function addCertificateImageToPdf(pdf: jsPDF, imageData: string) {
  pdf.addImage(imageData, 'JPEG', 0, 0, 297, 210, undefined, 'MEDIUM');
}

export async function createCertificatePdf(canvas: HTMLCanvasElement, options: { includePreview?: boolean } = {}): Promise<CertificatePdfOutput> {
  const imageData = certificateCanvasToJpeg(canvas);
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  addCertificateImageToPdf(pdf, imageData);

  const previewBlob = options.includePreview === false ? null : await canvasToJpegBlob(canvas);
  return {
    pdf,
    pdfBlob: pdf.output('blob'),
    imageData,
    previewUrl: previewBlob ? URL.createObjectURL(previewBlob) : undefined,
  };
}
