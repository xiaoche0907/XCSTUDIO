type ExtractRequest = {
  url?: string;
};

function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function pickTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!titleMatch) return "";
  return stripHtml(titleMatch[1] || "");
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body: ExtractRequest =
    typeof req.body === "string"
      ? (() => {
          try {
            return JSON.parse(req.body);
          } catch {
            return {};
          }
        })()
      : req.body || {};

  const targetUrl = String(body.url || "").trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    return res.status(400).json({ error: "url must be a valid http(s) url" });
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; XC-Studio-ResearchBot/1.0; +https://xc-studio.vercel.app)",
      },
    });
    if (!response.ok) {
      return res.status(400).json({
        error: `fetch_failed_${response.status}`,
        status: response.status,
      });
    }

    const html = await response.text();
    const title = pickTitle(html);
    const cleanedText = stripHtml(html);
    const excerpt = cleanedText.slice(0, 1200);

    return res.status(200).json({
      url: targetUrl,
      title,
      cleanedText,
      excerpt,
      length: cleanedText.length,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || "extract_failed",
    });
  }
}
