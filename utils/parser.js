export function safeParse(text) {
    if (!text) return null;

    // Strategy 1: already valid JSON
    try { return JSON.parse(text); } catch {}

    // Strategy 2: strip markdown fences anywhere in the string (multiline)
    try {
        const fenced = text
            .replace(/^[\s\S]*?```(?:json)?\s*/i, "")
            .replace(/\s*```[\s\S]*$/, "")
            .trim();
        return JSON.parse(fenced);
    } catch {}

    // Strategy 3: pull out the first {...} or [...] block
    try {
        const match = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (match) return JSON.parse(match[1]);
    } catch {}

    console.error("safeParse: could not extract JSON from response:", text.slice(0, 300));
    return null;
}