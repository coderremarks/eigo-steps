/** Browser file helpers: downloads are generated locally (Blob URLs); nothing is uploaded. */

export function downloadFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export class FileTooLargeError extends Error {}

export function readTextFile(file: File, maxBytes: number): Promise<string> {
  if (file.size > maxBytes) {
    return Promise.reject(
      new FileTooLargeError(`${file.name} is larger than ${Math.round(maxBytes / 1000)} KB.`),
    );
  }
  return file.text();
}
