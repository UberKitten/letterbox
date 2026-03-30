import { sanitizeEmailHtml } from "../lib/sanitize";

interface Props {
  html: string;
  themeClass: string;
}

export default function ArticleBody(props: Props) {
  return (
    <div
      class={`article-body ${props.themeClass}`}
      innerHTML={sanitizeEmailHtml(props.html)}
    />
  );
}
