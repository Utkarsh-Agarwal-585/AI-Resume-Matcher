const MODEL = "gemini-2.5-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models/";
const MAX_RETRIES = 3;

function parseRetryAfterMs(errorMessage) {
    // Gemini 429 errors include "Please retry in 14.48s"
    const match = errorMessage.match(/retry in ([\d.]+)s/i);
    return match ? Math.ceil(parseFloat(match[1]) * 1000) + 2000 : null;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function callGemini(apiKey, prompt, onWaiting, temperature = 0.2) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const response = await fetch(`${API_BASE}${MODEL}:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [{ text: prompt }],
                }],
                generationConfig: {
                    temperature,
                    topP: 0.8,
                    responseMimeType: "application/json",
                },
            }),
        });

        if (response.status === 429) {
            const errBody = await response.json().catch(() => ({}));
            const errMsg  = errBody?.error?.message || "";

            if (attempt === MAX_RETRIES) {
                throw new Error(`Rate limit hit after ${MAX_RETRIES} retries. ${errMsg}`);
            }

            const waitMs  = parseRetryAfterMs(errMsg) ?? (2 ** attempt) * 8000;
            const waitSec = Math.ceil(waitMs / 1000);
            onWaiting?.(`Rate limited — waiting ${waitSec}s (retry ${attempt + 1}/${MAX_RETRIES})…`);
            await sleep(waitMs);
            continue;
        }

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(`Gemini API ${response.status}: ${err?.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }
}
