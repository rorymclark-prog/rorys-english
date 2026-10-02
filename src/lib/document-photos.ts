import {MAX_DOCUMENT_BYTES, validateDocumentFiles} from './documents';

export const MAX_PHOTO_BYTES = 20_000_000;
const photoTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const isPhoto = (file: File) => photoTypes.includes(file.type) || /\.hei[cf]$/i.test(file.name);
const needsConversion = (file: File) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type);

// The selected originals can exceed the transport limit. Validate again after
// preparing copies; the private service's existing size limit stays enforced.
export function validateDocumentSelection(files: File[]): string {
  if (files.length && files.length <= 6 && files.every(isPhoto)) {
    if (files.some(file => !file.size)) return 'One of these photos is empty. Please choose it again.';
    if (files.some(file => file.size > MAX_PHOTO_BYTES)) return 'Choose photos up to 20 MB each, or use Scan pages.';
    return '';
  }
  return validateDocumentFiles(files);
}

async function photoCopy(file: File, maxBytes: number): Promise<File> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  const canvas = document.createElement('canvas');
  try {
    image.src = url;
    try { await image.decode(); }
    catch { throw new Error(`Could not read ${file.name}. For an iPhone HEIC photo, export a JPEG or use Scan pages.`); }
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 60_000_000) {
      throw new Error('This photo is too large to prepare. Use Scan pages or export a smaller JPEG.');
    }
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare the photo. Use Scan pages or try another browser.');
    for (const edge of [2400, 2200, 2000, 1800, 1600]) {
      const scale = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      // White keeps handwriting readable when a PNG has transparency.
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [.9, .82, .74]) {
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (!blob) throw new Error('Could not prepare the photo. Please choose it again.');
        if (blob.size <= maxBytes) return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {type: 'image/jpeg', lastModified: file.lastModified});
      }
    }
    throw new Error('These photos need more space to stay readable. Choose fewer pages at a time, or use Scan pages in good light.');
  } finally {
    URL.revokeObjectURL(url);
    canvas.width = canvas.height = 0;
    image.src = '';
  }
}

export async function prepareDocumentFiles(files: File[]): Promise<File[]> {
  const problem = validateDocumentSelection(files);
  if (problem) throw new Error(problem);
  if (!files.every(isPhoto)) return files;
  if (files.reduce((total, file) => total + file.size, 0) <= MAX_DOCUMENT_BYTES && !files.some(needsConversion)) return files;
  let remainingBytes = MAX_DOCUMENT_BYTES - 100_000;
  const prepared: File[] = [];
  // Sequential decoding bounds memory on phones, even with six large photos.
  for (const [index, file] of files.entries()) {
    const budget = Math.floor(remainingBytes / (files.length - index));
    const copy = file.size <= budget && !needsConversion(file) ? file : await photoCopy(file, budget);
    prepared.push(copy);
    remainingBytes -= copy.size;
  }
  const invalid = validateDocumentFiles(prepared);
  if (invalid) throw new Error(invalid);
  return prepared;
}
