import { onMount, onCleanup, createEffect } from "solid-js";

interface Props {
  html: string;
  dark: boolean;
}

export default function ArticleOriginal(props: Props) {
  let iframeRef: HTMLIFrameElement | undefined;

  function resizeIframe() {
    if (!iframeRef?.contentDocument?.body) return;
    const height = iframeRef.contentDocument.body.scrollHeight;
    iframeRef.style.height = `${height + 32}px`;
  }

  onMount(() => {
    if (!iframeRef) return;

    const doc = iframeRef.contentDocument;
    if (!doc) return;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { margin: 0; padding: 16px; font-family: sans-serif; }
            img { max-width: 100%; height: auto; }
          </style>
          <style id="theme-override"></style>
        </head>
        <body>${props.html}</body>
      </html>
    `);
    doc.close();

    // Resize after content loads
    setTimeout(resizeIframe, 100);
    setTimeout(resizeIframe, 500);

    // Also listen for image loads
    const images = doc.querySelectorAll("img");
    images.forEach((img) => img.addEventListener("load", resizeIframe));
  });

  // Reactively update dark/light theme in iframe
  createEffect(() => {
    const doc = iframeRef?.contentDocument;
    if (!doc) return;
    const style = doc.getElementById("theme-override");
    if (!style) return;
    if (props.dark) {
      style.textContent = `
        body { background: #1a1a1a; color: #d4d4d4; }
        * { color: inherit !important; background-color: transparent !important; border-color: #333 !important; }
        body { background: #1a1a1a !important; }
        a { color: #60a5fa !important; }
        img { background-color: unset !important; }
      `;
    } else {
      style.textContent = `
        body { background: #ffffff; color: #1a1a1a; }
        a { color: #2563eb; }
      `;
    }
  });

  onCleanup(() => {
    if (!iframeRef?.contentDocument) return;
    const images = iframeRef.contentDocument.querySelectorAll("img");
    images.forEach((img) => img.removeEventListener("load", resizeIframe));
  });

  return (
    <iframe
      ref={iframeRef}
      class="article-original-frame"
      sandbox="allow-same-origin"
      title="Original email content"
    />
  );
}
