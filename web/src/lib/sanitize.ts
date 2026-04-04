import DOMPurify from "dompurify";

export function sanitizeEmailHtml(html: string): string {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      // Text
      "p", "br", "h1", "h2", "h3", "h4", "h5", "h6",
      "ul", "ol", "li", "a", "img", "blockquote", "pre", "code",
      "em", "strong", "b", "i", "u", "s", "strike", "mark",
      "sup", "sub", "small", "big", "abbr", "cite",
      // Structure & layout (needed for newsletter formatting)
      "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "colgroup", "col",
      "div", "span", "section", "article", "header", "footer", "nav", "aside", "main",
      "hr", "figure", "figcaption", "picture", "source",
      "dl", "dt", "dd", "details", "summary",
      // Media
      "video", "audio",
      // Center (common in email HTML)
      "center",
    ],
    ALLOWED_ATTR: [
      "href", "src", "alt", "title", "class",
      // Table layout
      "colspan", "rowspan", "width", "height", "cellpadding", "cellspacing", "border", "align", "valign", "bgcolor",
      // Styles — needed to preserve newsletter layouts
      "style",
      // Links
      "target", "rel",
    ],
    ALLOW_DATA_ATTR: false,
    // Strip scripts, forms, iframes — actual threats
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "textarea", "select", "button"],
  });

  // Post-process: remove tracking pixels (1x1 images)
  const div = document.createElement("div");
  div.innerHTML = clean;

  div.querySelectorAll("img").forEach((img) => {
    const w = img.getAttribute("width");
    const h = img.getAttribute("height");
    if ((w === "1" || w === "0") && (h === "1" || h === "0")) {
      img.remove();
    }
  });

  // Clamp fixed pixel widths on tables/cells to max-width: 100% so they reflow
  div.querySelectorAll("table, td, th").forEach((el) => {
    const w = el.getAttribute("width");
    if (w && /^\d+$/.test(w) && parseInt(w) > 100) {
      el.setAttribute("width", "100%");
      (el as HTMLElement).style.maxWidth = `${w}px`;
    }
  });

  // Strip position: fixed/absolute from email content — breaks out of the reader
  div.querySelectorAll("[style]").forEach((el) => {
    const style = (el as HTMLElement).style;
    if (style.position === "fixed" || style.position === "absolute") {
      style.position = "";
    }
  });

  // Force all links to open in new tab
  div.querySelectorAll("a").forEach((a) => {
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
  });

  return div.innerHTML;
}

// Check if a CSS color value is "light" (would be invisible on dark background)
function isLightColor(color: string): boolean {
  const el = document.createElement("div");
  el.style.color = color;
  document.body.appendChild(el);
  const computed = getComputedStyle(el).color;
  document.body.removeChild(el);

  const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return false;
  const [, r, g, b] = match.map(Number);
  // Perceived luminance — values above ~140 are "light"
  const luminance = r * 0.299 + g * 0.587 + b * 0.114;
  return luminance > 140;
}

// Strip inline light colors/backgrounds for dark mode rendering
export function darkModeTransform(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;

  div.querySelectorAll("[style]").forEach((el) => {
    const style = (el as HTMLElement).style;
    // Strip light background colors
    if (style.backgroundColor) {
      if (isLightColor(style.backgroundColor)) {
        style.backgroundColor = "transparent";
      }
    }
    if (style.background) {
      // background shorthand — strip if it's just a light color
      const bg = style.background;
      if (/^#[0-9a-f]{3,8}$/i.test(bg.trim()) || /^rgb/i.test(bg.trim())) {
        if (isLightColor(bg)) {
          style.background = "transparent";
        }
      }
    }
    // Strip dark text colors (they'd be invisible on dark bg)
    if (style.color && !isLightColor(style.color)) {
      style.color = "";
    }
  });

  // Strip bgcolor HTML attributes
  div.querySelectorAll("[bgcolor]").forEach((el) => {
    const bgcolor = el.getAttribute("bgcolor") || "";
    if (isLightColor(bgcolor)) {
      el.removeAttribute("bgcolor");
    }
  });

  return div.innerHTML;
}
