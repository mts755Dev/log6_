import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

/** Skip compression for already-small files. */
const MIN_BYTES = 150 * 1024;

const IMAGE_MAX_EDGE = 1920;
const IMAGE_QUALITY = 0.72;

/** ~100 DPI balance of size vs readability for scanned docs. */
const PDF_RENDER_SCALE = 1.4;
const PDF_JPEG_QUALITY = 0.7;
const PDF_MAX_PAGES = 80;

export type CompressUploadResult = {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressed: boolean;
};

/**
 * Compress images and PDFs before Supabase storage upload.
 * Returns the original file when compression fails or does not reduce size.
 */
export async function compressForUpload(
  input: File | Blob,
  fileName?: string
): Promise<CompressUploadResult> {
  const name = input instanceof File ? input.name : fileName || 'upload.bin';
  const type = (input.type || guessMime(name)).toLowerCase();
  const file =
    input instanceof File
      ? input
      : new File([input], name, { type: type || 'application/octet-stream' });

  if (file.size < MIN_BYTES) {
    return unchanged(file);
  }

  // Office docs / SVG can't be usefully compressed in-browser.
  if (
    type.includes('officedocument') ||
    type === 'application/msword' ||
    type === 'image/svg+xml' ||
    /\.(docx?|xlsx?|pptx?|svg)$/i.test(name)
  ) {
    return unchanged(file);
  }

  try {
    if (type.startsWith('image/')) {
      return pickSmaller(file, await compressImage(file));
    }
    if (type === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) {
      return pickSmaller(file, await compressPdf(file));
    }
  } catch (error) {
    console.warn('compressForUpload failed, uploading original:', error);
  }

  return unchanged(file);
}

function unchanged(file: File): CompressUploadResult {
  return {
    file,
    originalSize: file.size,
    compressedSize: file.size,
    compressed: false,
  };
}

function pickSmaller(original: File, candidate: File): CompressUploadResult {
  // Keep original unless we save at least ~2%.
  if (candidate.size < original.size * 0.98) {
    return {
      file: candidate,
      originalSize: original.size,
      compressedSize: candidate.size,
      compressed: true,
    };
  }
  return unchanged(original);
}

function guessMime(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return '';
}

function replaceExtension(name: string, ext: string): string {
  const base = name.replace(/\.[^.]+$/, '') || 'upload';
  return `${base}.${ext}`;
}

async function compressImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Canvas unavailable for image compression');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Image encoding failed'))),
      'image/jpeg',
      IMAGE_QUALITY
    );
  });

  return new File([blob], replaceExtension(file.name, 'jpg'), {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

async function compressPdf(file: File): Promise<File> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pageCount = Math.min(pdf.numPages, PDF_MAX_PAGES);

  let doc: jsPDF | null = null;

  for (let pageNum = 1; pageNum <= pageCount; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable for PDF compression');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport,
      canvas,
    } as Parameters<typeof page.render>[0]).promise;

    const widthPt = viewport.width / PDF_RENDER_SCALE;
    const heightPt = viewport.height / PDF_RENDER_SCALE;
    const orientation = widthPt > heightPt ? 'l' : 'p';
    const imgData = canvas.toDataURL('image/jpeg', PDF_JPEG_QUALITY);

    if (!doc) {
      doc = new jsPDF({
        orientation,
        unit: 'pt',
        format: [widthPt, heightPt],
        compress: true,
      });
    } else {
      doc.addPage([widthPt, heightPt], orientation);
    }

    doc.addImage(imgData, 'JPEG', 0, 0, widthPt, heightPt, undefined, 'FAST');
  }

  if (!doc) throw new Error('PDF has no pages');

  const outBlob = doc.output('blob');
  return new File([outBlob], replaceExtension(file.name, 'pdf'), {
    type: 'application/pdf',
    lastModified: Date.now(),
  });
}
