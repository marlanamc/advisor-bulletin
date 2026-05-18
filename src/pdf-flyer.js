import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export function isPdfFile(file) {
    if (!file) return false;
    return file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
}

export async function convertPdfFirstPageToImageFile(file, options = {}) {
    const maxWidth = options.maxWidth || 2000;
    const quality = options.quality || 0.92;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pageCount = pdf.numPages || 1;
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(maxWidth / baseViewport.width, 2.5);
    const viewport = page.getViewport({ scale: Math.max(scale, 0.5) });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
        throw new Error('Could not prepare PDF preview.');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: context, viewport }).promise;

    const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => {
            if (!result) {
                reject(new Error('Could not convert PDF to image.'));
                return;
            }
            resolve(result);
        }, 'image/jpeg', quality);
    });

    const baseName = (file.name || 'flyer').replace(/\.pdf$/i, '');
    const imageFile = new File([blob], `${baseName}-flyer.jpg`, { type: 'image/jpeg' });

    return { imageFile, pageCount, width: canvas.width, height: canvas.height };
}
