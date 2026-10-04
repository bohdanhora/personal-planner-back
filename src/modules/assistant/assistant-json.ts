const FENCE = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;

export const readJsonObject = (content: string): unknown => {
  const trimmed = content.trim();
  const unfenced = FENCE.exec(trimmed)?.[1] ?? trimmed;
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');

  if (start === -1 || end < start) {
    return undefined;
  }

  try {
    const value: unknown = JSON.parse(unfenced.slice(start, end + 1));
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : undefined;
  } catch {
    return undefined;
  }
};
