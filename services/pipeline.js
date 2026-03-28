import { callGemini } from "./llm.js";
import { safeParse } from "../utils/parser.js";

export async function analyzeResume(apiKey, resume, jd, onStatus) {
    onStatus?.("Analysing resume against job description…");

    const prompt = `You are a strict resume analyst. Score the resume against the job description using the rubric below. Return ONLY a raw JSON object — no markdown, no explanation.

SCORING RUBRIC (follow exactly, no rounding up):
- 90-100: Resume covers ALL required skills/experience and most nice-to-haves
- 75-89:  Resume covers most required skills; 1-2 minor gaps
- 60-74:  Resume covers core skills but misses several required keywords or years of experience
- 40-59:  Resume has partial overlap; clear gaps in required technologies or experience level
- 0-39:   Resume is a poor match — major required skills or experience are absent

scoreLabel must be one of: "Strong Match" (90+), "Good Match" (75-89), "Partial Match" (60-74), "Weak Match" (<60)

Schema: {
  "score": integer (0-100, strict rubric above),
  "scoreLabel": string,
  "summary": string (2-3 sentences: match level, key strengths, key gaps),
  "strongMatches": string[] (skills/keywords present in BOTH resume and JD),
  "missingKeywords": string[] (keywords required by JD that are absent from the resume),
  "topImprovements": string[] (3-5 specific, actionable suggestions to close the gaps)
}

Resume:
${resume}

Job Description:
${jd}`;

    // temperature 0 for deterministic, rubric-anchored scoring
    const raw = await callGemini(apiKey, prompt, onStatus, 0);
    const result = safeParse(raw);
    if (!result) throw new Error("Failed to parse analysis response from Gemini.");
    return result;
}

export async function rewriteResume(apiKey, resume, jd, analysis, onStatus) {
    onStatus?.("Rewriting resume to target job description…");

    const missingList = analysis?.missingKeywords?.length
        ? analysis.missingKeywords.map((k, i) => `${i + 1}. ${k}`).join("\n")
        : "none identified";

    const improvementList = analysis?.topImprovements?.length
        ? analysis.topImprovements.map((t, i) => `${i + 1}. ${t}`).join("\n")
        : "none";

    const rewritePrompt = `You are an expert resume writer optimising a resume for a specific job.

════════════════════════════════════════
PHASE 1 — CLASSIFY MISSING KEYWORDS
════════════════════════════════════════
For each item in the "Missing Keywords" list below, decide:
  (A) INFERABLE — The candidate's existing experience strongly implies this skill, even if not named explicitly.
      Examples of valid inferences:
      • Uses Docker / Kubernetes / AWS  →  Linux operating systems, Bash/shell scripting
      • Writes Python professionally    →  pytest or similar test frameworks
      • Has CI/CD pipelines             →  shell scripting, automation tools
      • Uses AI/LLM tools               →  generative AI, prompt engineering, AI-assisted workflows
      • Builds REST APIs or microservices → network protocols, service communication
  (B) NOT PRESENT — The skill has zero connection to anything in the resume (e.g. a backend dev has no Cisco/IOS-XR experience).

════════════════════════════════════════
PHASE 2 — REWRITE RULES
════════════════════════════════════════
1. SURFACE INFERABLE SKILLS AGGRESSIVELY:
   - Add every (A) keyword into the relevant experience bullets and into the skills section.
   - Rephrase existing bullets to name the implied technology explicitly.
   - Example: "automated deployments with Kubernetes" → "automated deployments with Kubernetes on Linux, using Bash scripts and CI/CD pipelines"

2. DO NOT FABRICATE (B) SKILLS:
   - Skills with no connection to the resume must NOT be added. Silence is better than a lie.

3. MIRROR JOB DESCRIPTION LANGUAGE:
   - Rephrase bullets to use the exact terminology from the JD wherever truthful.

4. STRENGTHEN THE SUMMARY:
   - Open with a sentence that directly addresses what the JD is looking for.
   - Mention the (A) skills in the summary if they are central to the role.

5. EXPAND THE SKILLS SECTION:
   - List ALL (A) keywords here even if they only appear implicitly in the bullets above.

════════════════════════════════════════
MISSING KEYWORDS (from analysis):
${missingList}

TOP IMPROVEMENTS (from analysis):
${improvementList}
════════════════════════════════════════

Return ONLY a raw JSON object — no markdown, no explanation.
Schema:
{
  "name": string (full name from the resume, or ""),
  "contactItems": string[] (each contact detail as its own element: email, phone number, LinkedIn URL, GitHub URL, location — copy verbatim from the resume, in that order, omit any that are absent),
  "summary": string,
  "experience": [
    {
      "company":  string (company name only, e.g. "Bigbasket"),
      "location": string (city, e.g. "Bangalore"),
      "title":    string (job title, e.g. "Solution Engineer"),
      "duration": string (e.g. "Jan 2022 - Nov 2024"),
      "bullets":  string[] (achievement/responsibility bullet points — rewritten to target the JD)
    }
  ],
  "projects": [
    {
      "name":    string (project name),
      "year":    string (year or date range, or ""),
      "link":    string (URL if present in original resume, or ""),
      "bullets": string[] (description bullet points)
    }
  ],
  "education": [
    {
      "institution": string (college/university name),
      "degree":      string (degree and field, e.g. "B.Tech in Information Technology"),
      "duration":    string (e.g. "Aug 2018 - July 2022"),
      "grade":       string (CGPA / GPA / percentage, or "")
    }
  ],
  "skills": string[] (one string per skill category, e.g. "Languages: Python, JavaScript")
}
Notes:
- "name", "contactItems", "education" — copy verbatim from the original resume, do not change.
- Rewrite only "summary", "experience[].bullets", "projects[].bullets", and "skills".

Resume:
${resume}

Job Description:
${jd}`;

    const rewriteRaw = await callGemini(apiKey, rewritePrompt, onStatus, 0.3);
    const rewrite = safeParse(rewriteRaw);
    if (!rewrite) throw new Error("Failed to parse rewrite response from Gemini.");

    return { rewrite };
}

