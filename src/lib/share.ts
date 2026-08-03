export type ShareOutcome = 'shared' | 'copied' | 'cancelled';

const CLIPBOARD_WRITE_TIMEOUT_MS = 800;

const writeToClipboard = async (text: string) => {
  let timeoutId: number | undefined;
  try {
    await Promise.race([
      navigator.clipboard.writeText(text),
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error('Clipboard write timed out.')), CLIPBOARD_WRITE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
};

export const copyText = async (text: string) => {
  try {
    if ('clipboard' in navigator) {
      await writeToClipboard(text);
      return;
    }
  } catch {
    // Fall through to the legacy copy path for embedded browsers.
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Copy is not available in this browser.');
};

export const shareOrCopy = async (input: { title: string; url: string }): Promise<ShareOutcome> => {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share(input);
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }

  await copyText(input.url);
  return 'copied';
};
