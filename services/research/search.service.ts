export type ResearchSearchMode = "web+images" | "web" | "images";

export type SearchWebItem = {
  id: string;
  title: string;
  url: string;
  displayUrl?: string;
  snippet?: string;
  siteName?: string;
};

export type SearchImageItem = {
  id: string;
  title: string;
  imageUrl: string;
  thumbnailUrl?: string;
  sourcePageUrl?: string;
  width?: number;
  height?: number;
  siteName?: string;
};

export type SearchResponse = {
  requestId: string;
  query: string;
  mode: ResearchSearchMode;
  provider?: { web?: string; images?: string };
  web: SearchWebItem[];
  images: SearchImageItem[];
  hints?: { suggestedQueries?: string[] };
};

export type ExtractResponse = {
  url: string;
  title: string;
  cleanedText: string;
  excerpt: string;
  length: number;
};

export type RehostResponse = {
  imageUrl: string;
  hostedUrl: string;
  provider: string;
};

export async function runResearchSearch(
  query: string,
  mode: ResearchSearchMode = "web+images",
): Promise<SearchResponse> {
  const response = await fetch("/api/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      mode,
      locale: "zh-CN",
      count: {
        web: 8,
        images: 16,
      },
      safeSearch: "moderate",
      timeRange: "any",
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || "research_search_failed");
  }

  return payload as SearchResponse;
}

export function pickUsableReferenceImages(items: SearchImageItem[], max: number = 8): string[] {
  return items
    .map((item) => item.imageUrl)
    .filter((url) => {
      if (typeof url !== "string") return false;
      const normalized = url.trim();
      if (!/^https?:\/\//i.test(normalized)) return false;
      if (/^https?:\/\/ibb\.co\//i.test(normalized)) return false;
      return true;
    })
    .slice(0, max);
}

export async function extractWebPage(url: string): Promise<ExtractResponse> {
  const response = await fetch("/api/extract", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || "extract_failed");
  }
  return payload as ExtractResponse;
}

export async function rehostImageUrl(imageUrl: string): Promise<RehostResponse> {
  const response = await fetch("/api/rehost-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ imageUrl }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || "rehost_failed");
  }
  return payload as RehostResponse;
}
