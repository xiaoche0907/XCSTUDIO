export function collectReferenceCandidates(
  params: Record<string, any>,
  input: {
    uploadedAttachments?: string[];
    attachments?: Array<{ type?: string }>;
    metadata?: Record<string, any>;
  },
  maxReferenceImages: number,
): {
  limitedCandidates: string[];
  sourceCount: number;
  truncated: boolean;
} {
  const candidates: string[] = [];
  const seen = new Set<string>();

  const pushCandidate = (value: unknown) => {
    if (typeof value !== 'string') return;
    const v = value.trim();
    if (!v || seen.has(v)) return;
    seen.add(v);
    candidates.push(v);
  };

  if (Array.isArray(params.referenceImages)) {
    params.referenceImages.forEach(pushCandidate);
  }

  [
    params.referenceImage,
    params.referenceImageUrl,
    params.reference_image_url,
    params.initImage,
    params.init_image,
  ].forEach(pushCandidate);

  const uploaded = input.uploadedAttachments || [];
  uploaded.forEach(pushCandidate);

  (input.metadata?.multimodalContext?.referenceImageUrls || []).forEach(pushCandidate);

  if (uploaded.length === 0) {
    (input.attachments || []).forEach((file, index) => {
      if (file?.type && file.type.startsWith('image/')) {
        pushCandidate(`ATTACHMENT_${index}`);
      }
    });
  }

  return {
    limitedCandidates: candidates.slice(0, maxReferenceImages),
    sourceCount: candidates.length,
    truncated: candidates.length > maxReferenceImages,
  };
}
