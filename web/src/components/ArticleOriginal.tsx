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

    // Force links to open in new tab
    doc.querySelectorAll("a").forEach((a) => {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    });

    // Resize after content loads
    setTimeout(resizeIframe, 100);
    setTimeout(resizeIframe, 500);

    // Also listen for image loads
    const images = doc.querySelectorAll("img");
    images.forEach((img) => img.addEventListener("load", resizeIframe));
  });

  function stripLightInlineStyles(doc: Document) {
    doc.querySelectorAll("[style]").forEach((el) => {
      const style = (el as HTMLElement).style;
      // Strip light backgrounds
      if (style.backgroundColor) {
        style.backgroundColor = "transparent";
      }
      if (style.background) {
        const bg = style.background;
        if (/^[#\s]*[0-9a-f]{3,8}\s*(!important)?$/i.test(bg.trim()) || /^rgb/i.test(bg.trim()) || /^white/i.test(bg.trim())) {
          style.background = "transparent";
        }
      }
      // Strip dark text colors
      if (style.color) {
        const c = style.color;
        const test = doc.createElement("span");
        test.style.color = c;
        doc.body.appendChild(test);
        const computed = doc.defaultView?.getComputedStyle(test).color || "";
        test.remove();
        const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
          const lum = Number(match[1]) * 0.299 + Number(match[2]) * 0.587 + Number(match[3]) * 0.114;
          if (lum <= 140) style.color = ""; // dark color — remove so it inherits light text
        }
      }
    });
    doc.querySelectorAll("[bgcolor]").forEach((el) => el.removeAttribute("bgcolor"));
  }

  // Reactively update dark/light theme in iframe
  createEffect(() => {
    const doc = iframeRef?.contentDocument;
    if (!doc) return;
    const style = doc.getElementById("theme-override");
    if (!style) return;
    if (props.dark) {
      style.textContent = `
        body { background: #1a1a1a !important; color: #d4d4d4 !important; }
        a { color: #60a5fa !important; }
        img { background-color: unset !important; }
      `;
      stripLightInlineStyles(doc);
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
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      title="Original email content"
    />
  );
}
