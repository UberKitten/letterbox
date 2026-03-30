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

  // Force all links to open in new tab
  div.querySelectorAll("a").forEach((a) => {
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
  });

  return div.innerHTML;
}
