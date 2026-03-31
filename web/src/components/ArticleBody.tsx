import { createMemo } from "solid-js";
import { sanitizeEmailHtml, darkModeTransform } from "../lib/sanitize";

interface Props {
  html: string;
  themeClass: string;
}

export default function ArticleBody(props: Props) {
  const rendered = createMemo(() => {
    const clean = sanitizeEmailHtml(props.html);
    return props.themeClass === "article-dark" ? darkModeTransform(clean) : clean;
  });

  return (
    <div
      class={`article-body ${props.themeClass}`}
      innerHTML={rendered()}
    />
  );
}
