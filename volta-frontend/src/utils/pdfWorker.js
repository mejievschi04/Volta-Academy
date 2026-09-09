import { GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

let configured = false;

export function configurePdfWorker() {
	if (configured || typeof window === 'undefined') {
		return;
	}

	GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
	configured = true;
}
