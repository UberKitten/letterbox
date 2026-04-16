export async function summarizeEmail(
  apiKey: string,
  model: string,
  subject: string,
  bodyText: string,
): Promise<string> {
  // gpt-4.1 family has 1M token context (~4M chars); gpt-4o family has 128K (~500K chars).
  // Leave headroom for system prompt + output.
  const maxChars = model.startsWith("gpt-4.1") ? 2_000_000 : 400_000;
  const trimmed =
    bodyText.length > maxChars ? bodyText.slice(0, maxChars) + "\n[...truncated]" : bodyText;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You summarize email newsletters concisely. Give a brief summary (2-4 sentences) of the key points. Be direct and informative. Do not use markdown formatting.",
        },
        {
          role: "user",
          content: `Subject: ${subject}\n\n${trimmed}`,
        },
      ],
      max_tokens: 300,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as any)?.error?.message || `OpenAI API error ${res.status}`;
    throw new Error(msg);
  }

  const data: any = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "No summary generated.";
}

// Extract readable text from HTML (strip tags)
export function htmlToText(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}
