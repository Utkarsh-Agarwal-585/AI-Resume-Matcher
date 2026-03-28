import { preprocessText } from "../utils/preprocess.js";
import { analyzeResume, rewriteResume } from "../services/pipeline.js";
import * as pdfjsLib from "../libs/pdf.min.mjs";

// Module-level state shared between the analyze and rewrite steps
let lastAnalysis = null;
let lastJD = null;
let lastResume = null;
let selectedFormat = "pdf"; // "txt" | "pdf" | "doc"

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("libs/pdf.worker.min.mjs");

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
}

function showStatus(msg) {
    const bar = document.getElementById("statusBar");
    const txt = document.getElementById("statusText");
    bar.classList.remove("hidden");
    txt.textContent = msg;
}

function hideStatus() {
    document.getElementById("statusBar").classList.add("hidden");
}

function showError(msg) {
    const el = document.getElementById("errorMsg");
    el.textContent = msg;
    el.classList.remove("hidden");
}

function hideError() {
    document.getElementById("errorMsg").classList.add("hidden");
}

function setFieldStatus(id, msg, type) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.className = "field-status " + (type || "");
}

// ── PDF / txt drag-and-drop ───────────────────────────────────────────────────

async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = await Promise.all(
        Array.from({ length: pdf.numPages }, (_, i) =>
            pdf.getPage(i + 1).then(p => p.getTextContent()).then(tc =>
                tc.items.map(item => item.str).join(" ")
            )
        )
    );
    return pages.join("\n");
}

const dropZone = document.getElementById("dropZone");

dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));

dropZone.addEventListener("drop", async (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (!file) return;

    const label = document.getElementById("dropLabel");
    label.textContent = "Reading…";

    try {
        let text = "";
        if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
            text = await extractTextFromPDF(file);
        } else {
            text = await file.text();
        }
        document.getElementById("resumeInput").value = text;
        label.textContent = `✓ ${file.name}`;
        setFieldStatus("resumeStatus", "File loaded — click Save Resume to store it.", "info");
    } catch (err) {
        label.textContent = "Drop PDF or .txt here";
        setFieldStatus("resumeStatus", "Error reading file: " + err.message, "error");
    }
});

// ── Pre-fill from storage ─────────────────────────────────────────────────────

(async () => {
    const { resume, apiKey } = await chrome.storage.local.get(["resume", "apiKey"]);
    if (resume) {
        document.getElementById("resumeInput").value = resume;
        setFieldStatus("resumeStatus", "✓ Resume loaded from storage", "success");
    }
    if (apiKey) {
        document.getElementById("apiKey").value = apiKey;
        setFieldStatus("keyStatus", "✓ API key loaded from storage", "success");
    }
})();

// ── Save resume ───────────────────────────────────────────────────────────────

document.getElementById("saveResume").onclick = async () => {
    const resume = document.getElementById("resumeInput").value.trim();
    if (!resume) {
        setFieldStatus("resumeStatus", "Paste your resume text first.", "error");
        return;
    }
    await chrome.storage.local.set({ resume });
    setFieldStatus("resumeStatus", "✓ Resume saved", "success");
};

// ── Save API key ──────────────────────────────────────────────────────────────

document.getElementById("saveKey").onclick = async () => {
    const apiKey = document.getElementById("apiKey").value.trim();
    if (!apiKey) {
        setFieldStatus("keyStatus", "Enter your Gemini API key first.", "error");
        return;
    }
    await chrome.storage.local.set({ apiKey });
    setFieldStatus("keyStatus", "✓ API key saved", "success");
};

// ── Extract JD from active tab ────────────────────────────────────────────────

async function extractJDFromTab(tabId) {
    const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
            const selectors = [
                ".jobs-description__content",
                "#job-details",
                ".description",
            ];
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el) return el.innerText;
            }
            return "";
        },
    });
    return result?.result ?? "";
}

// ── Render analysis results ───────────────────────────────────────────────────

function scoreColor(score) {
    if (score >= 85) return "#38a169";
    if (score >= 70) return "#d69e2e";
    if (score >= 50) return "#dd6b20";
    return "#e53e3e";
}

function renderTags(containerId, items, type) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";
    if (!items?.length) {
        container.innerHTML = `<span class="tag-empty">None identified</span>`;
        return;
    }
    items.forEach(item => {
        const tag = document.createElement("span");
        tag.className = `tag tag-${type}`;
        tag.textContent = item;
        container.appendChild(tag);
    });
}

function renderAnalysis(analysis) {
    const card = document.getElementById("resultCard");
    card.classList.remove("hidden");

    const score = analysis.score ?? 0;
    const color = scoreColor(score);

    const circle = document.getElementById("scoreCircle");
    circle.style.borderColor = color;
    circle.style.color = color;
    document.getElementById("scoreValue").textContent = score;
    document.getElementById("scoreLabel").textContent = analysis.scoreLabel ?? "";
    document.getElementById("scoreLabel").style.color = color;
    document.getElementById("scoreSummary").textContent = analysis.summary ?? "";

    renderTags("strongMatchesTags", analysis.strongMatches, "match");
    renderTags("missingKeywordsTags", analysis.missingKeywords, "missing");

    const ul = document.getElementById("improvementsList");
    ul.innerHTML = "";
    (analysis.topImprovements ?? []).forEach(item => {
        const li = document.createElement("li");
        li.textContent = item;
        ul.appendChild(li);
    });

    if (!analysis.topImprovements?.length) {
        ul.innerHTML = `<li class="tag-empty">No major improvements identified.</li>`;
    }
}

// ── Analyze button ────────────────────────────────────────────────────────────

document.getElementById("analyze").onclick = async () => {
    const btn = document.getElementById("analyze");
    btn.disabled = true;
    hideError();
    document.getElementById("resultCard").classList.add("hidden");

    try {
        const tab = await getActiveTab();

        if (!tab?.url?.includes("linkedin.com")) {
            showError("Please open a LinkedIn job posting first.");
            return;
        }
        if (tab.status !== "complete") {
            showError("Page is still loading — please wait and try again.");
            return;
        }

        showStatus("Reading job description…");
        const rawJD = await extractJDFromTab(tab.id);
        if (!rawJD) {
            showError("No job description found on this page.");
            hideStatus();
            return;
        }

        const jd = preprocessText(rawJD);
        const { resume, apiKey } = await chrome.storage.local.get(["resume", "apiKey"]);

        if (!resume) { showError("Resume not saved yet. Paste and save it first."); hideStatus(); return; }
        if (!apiKey) { showError("API key not saved yet. Enter and save it first."); hideStatus(); return; }

        const processedResume = preprocessText(resume);
        const analysis = await analyzeResume(apiKey, processedResume, jd,
            (msg) => showStatus(msg));

        hideStatus();
        renderAnalysis(analysis);

        // Store for rewrite step
        lastAnalysis = analysis;
        lastJD = jd;
        lastResume = processedResume;

    } catch (err) {
        hideStatus();
        showError("Error: " + err.message);
    } finally {
        btn.disabled = false;
    }
};

// ── Format picker ─────────────────────────────────────────────────────────────

const hintMessages = {
    txt: "Downloads a plain-text version of your rewritten resume.",
    pdf: "Opens a print-ready resume in a new tab — use Ctrl+P to save as PDF.",
    doc: "Downloads a Word-compatible .doc file you can edit in Word or Google Docs.",
};

document.querySelectorAll(".fp-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".fp-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        selectedFormat = btn.dataset.fmt;
        document.getElementById("rewriteHint").textContent = hintMessages[selectedFormat];
    });
});

// ── Rewrite & download ────────────────────────────────────────────────────────

function buildResumeText(r) {
    const lines = [];
    if (r.name) lines.push(r.name, "=".repeat(r.name.length), "");

    // contactItems array (new schema) or legacy contact string
    const contactLine = r.contactItems?.length
        ? r.contactItems.join(" | ")
        : r.contact || "";
    if (contactLine) lines.push(contactLine, "");

    if (r.summary) lines.push("SUMMARY", "=======", r.summary, "");

    if (r.experience?.length) {
        lines.push("EXPERIENCE", "==========");
        r.experience.forEach(job => {
            if (typeof job === "string") {
                lines.push("• " + job);
            } else {
                const header = [job.company, job.location].filter(Boolean).join(", ");
                const meta   = [job.title, job.duration].filter(Boolean).join(" | ");
                lines.push(header + (meta ? "  —  " + meta : ""));
                (job.bullets || []).forEach(b => lines.push("  • " + b));
                lines.push("");
            }
        });
        lines.push("");
    }

    if (r.projects?.length) {
        lines.push("PROJECTS", "========");
        r.projects.forEach(p => {
            if (typeof p === "string") {
                lines.push("• " + p);
            } else {
                const header = [p.name, p.year].filter(Boolean).join(" · ");
                lines.push(header + (p.link ? "  " + p.link : ""));
                (p.bullets || []).forEach(b => lines.push("  • " + b));
                lines.push("");
            }
        });
        lines.push("");
    }

    if (r.education?.length) {
        lines.push("EDUCATION", "=========");
        r.education.forEach(e => {
            if (typeof e === "string") {
                lines.push("• " + e);
            } else {
                lines.push([e.institution, e.duration].filter(Boolean).join("  —  "));
                const degLine = [e.degree, e.grade].filter(Boolean).join("  |  ");
                if (degLine) lines.push("  " + degLine);
                lines.push("");
            }
        });
        lines.push("");
    }

    if (r.skills?.length) {
        lines.push("SKILLS", "======");
        r.skills.forEach(s => lines.push(s));
    }
    return lines.join("\n");
}

function normaliseContactItem(raw) {
    // Convert non-standard pseudo-schemes to proper URLs so links work in Word/PDF
    return (raw || "")
        .replace(/\bLinkedIn:\/\/([^\s]+)/gi, "https://linkedin.com/in/$1")
        .replace(/\bGitHub:\/\/([^\s]+)/gi,   "https://github.com/$1");
}

function buildDocHTML(r) {
    const x = s => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const contactLine = r.contactItems?.length
        ? r.contactItems.map(c => x(normaliseContactItem(c))).join(" | ")
        : x(normaliseContactItem(r.contact || ""));

    const expHtml = (r.experience || []).map(job => {
        if (typeof job === "string") return `<li>${x(job)}</li>`;
        const header = [job.company, job.location].filter(Boolean).map(x).join(", ");
        const title  = x(job.title || "");
        const dur    = x(job.duration || "");
        return `
            <div style="margin-bottom:10pt">
                <table width="100%" style="border:none;border-collapse:collapse">
                    <tr>
                        <td style="font-weight:bold;font-size:11pt">${header}</td>
                        <td align="right" style="font-size:9pt;color:#555;white-space:nowrap">${dur}</td>
                    </tr>
                </table>
                ${title ? `<div style="font-style:italic;font-size:10pt;margin-bottom:3pt">${title}</div>` : ""}
                <ul style="margin:3pt 0;padding-left:14pt">
                    ${(job.bullets || []).map(b => `<li>${x(b)}</li>`).join("")}
                </ul>
            </div>`;
    }).join("");

    const projHtml = (r.projects || []).map(p => {
        if (typeof p === "string") return `<li>${x(p)}</li>`;
        const nameLink = p.link
            ? `<a href="${x(p.link)}">${x(p.name)}</a>`
            : x(p.name || "");
        const label = p.year ? `${nameLink} &nbsp;·&nbsp; ${x(p.year)}` : nameLink;
        return `
            <div style="margin-bottom:8pt">
                <div style="font-weight:bold;font-size:11pt;margin-bottom:3pt">${label}</div>
                <ul style="margin:3pt 0;padding-left:14pt">
                    ${(p.bullets || []).map(b => `<li>${x(b)}</li>`).join("")}
                </ul>
            </div>`;
    }).join("");

    const eduHtml = (r.education || []).map(e => {
        if (typeof e === "string") return `<li>${x(e)}</li>`;
        return `
            <div style="margin-bottom:8pt">
                <table width="100%" style="border:none;border-collapse:collapse">
                    <tr>
                        <td style="font-weight:bold;font-size:11pt">${x(e.institution)}</td>
                        <td align="right" style="font-size:9pt;color:#555;white-space:nowrap">${x(e.duration)}</td>
                    </tr>
                </table>
                <div style="font-size:10pt">${x(e.degree)}${e.grade ? ` &mdash; ${x(e.grade)}` : ""}</div>
            </div>`;
    }).join("");

    const skillsHtml = (r.skills || []).map(s => `<p style="margin:2pt 0">${x(s)}</p>`).join("");

    return `<html xmlns:o='urn:schemas-microsoft-com:office:office'
     xmlns:w='urn:schemas-microsoft-com:office:word'
     xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>Resume</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>90</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
<style>
  body{font-family:Calibri,Arial,sans-serif;margin:1in;font-size:10.5pt;color:#1a202c;line-height:1.4}
  h1{font-size:20pt;color:#1a202c;margin:0 0 2pt;text-align:center}
  .contact{font-size:9.5pt;color:#4a5568;margin:0 0 12pt;text-align:center}
  h2{font-size:10pt;color:#1a202c;text-transform:uppercase;letter-spacing:1pt;margin:12pt 0 5pt;
     border-bottom:1pt solid #2d3748;padding-bottom:2pt}
  p{margin:4pt 0}
  ul{margin:3pt 0;padding-left:14pt}
  li{margin:2pt 0}
  a{color:#2b4acb}
</style>
</head><body>
${r.name ? `<h1>${x(r.name)}</h1>` : ""}
${contactLine ? `<p class="contact">${contactLine}</p>` : ""}
${r.summary ? `<h2>Summary</h2><p>${x(r.summary)}</p>` : ""}
${expHtml  ? `<h2>Experience</h2>${expHtml}`   : ""}
${projHtml ? `<h2>Projects</h2>${projHtml}`     : ""}
${eduHtml  ? `<h2>Education</h2>${eduHtml}`     : ""}
${skillsHtml ? `<h2>Skills</h2>${skillsHtml}`  : ""}
</body></html>`;
}

async function autoDownload(content, filename, mimeType = "text/plain") {
    // Anchor-click downloads don't work in Chrome extension popups.
    // chrome.downloads.download() with a blob URL is the correct approach.
    const blob = new Blob([content], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    try {
        await chrome.downloads.download({ url, filename, saveAs: false });
    } finally {
        // Delay revoke to give the download manager time to pick up the URL
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
}

async function openPreviewTab(rewrite) {
    await chrome.storage.local.set({ rewritePreviewData: rewrite });
    await chrome.tabs.create({ url: chrome.runtime.getURL("popup/resume-preview.html") });
}

const REWRITE_BTN_INNER = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Rewrite My Resume`;

// ── Score improvement banner ──────────────────────────────────────────────────

function showScoreImprovement(before, after, newMissing) {
    const banner = document.getElementById("scoreImprovement");
    const delta  = after - before;
    const color  = delta > 0 ? "#38a169" : delta < 0 ? "#e53e3e" : "#718096";

    document.getElementById("siBefore").textContent = before;
    document.getElementById("siAfter").textContent  = after;
    document.getElementById("siAfter").style.color  = scoreColor(after);

    const deltaEl = document.getElementById("siDelta");
    deltaEl.textContent = delta > 0 ? `+${delta}` : `${delta}`;
    deltaEl.style.color = color;
    deltaEl.className   = "si-delta " + (delta > 0 ? "positive" : delta < 0 ? "negative" : "neutral");

    const missingEl = document.getElementById("siNewMissing");
    if (newMissing?.length) {
        missingEl.textContent = `Still missing: ${newMissing.slice(0, 5).join(", ")}${newMissing.length > 5 ? ` +${newMissing.length - 5} more` : ""}`;
        missingEl.classList.remove("hidden");
    } else {
        missingEl.classList.add("hidden");
    }

    banner.classList.remove("hidden");
}

// ── Rewrite button ────────────────────────────────────────────────────────────

document.getElementById("rewriteBtn").onclick = async () => {
    const btn = document.getElementById("rewriteBtn");

    if (!lastJD || !lastResume) {
        showError("Please run Analyze first.");
        return;
    }

    btn.disabled = true;
    btn.textContent = "Rewriting…";
    hideError();
    document.getElementById("scoreImprovement").classList.add("hidden");

    try {
        const { apiKey } = await chrome.storage.local.get(["apiKey"]);
        if (!apiKey) { showError("API key not saved yet."); return; }

        // Step 1: rewrite
        const { rewrite } = await rewriteResume(apiKey, lastResume, lastJD, lastAnalysis,
            (msg) => showStatus(msg));

        // Step 2: trigger download / preview
        if (selectedFormat === "txt") {
            await autoDownload(buildResumeText(rewrite), "rewritten-resume.txt", "text/plain");
        } else if (selectedFormat === "doc") {
            await autoDownload(buildDocHTML(rewrite), "rewritten-resume.doc", "application/msword");
        } else {
            await openPreviewTab(rewrite);
        }

        // Step 3: re-analyze the rewritten content and show before/after score
        try {
            showStatus("Checking score improvement…");
            const rewrittenText = preprocessText(buildResumeText(rewrite));
            const newAnalysis   = await analyzeResume(apiKey, rewrittenText, lastJD,
                (msg) => showStatus(msg));
            hideStatus();
            showScoreImprovement(lastAnalysis.score, newAnalysis.score, newAnalysis.missingKeywords);
        } catch {
            // Re-analysis is best-effort; don't fail the whole rewrite if it errors
            hideStatus();
        }

        btn.textContent = selectedFormat === "pdf" ? "✓ Opened in new tab!" : "✓ Downloaded!";
        btn.classList.add("btn-rewrite-done");
        setTimeout(() => {
            btn.innerHTML = REWRITE_BTN_INNER;
            btn.classList.remove("btn-rewrite-done");
            btn.disabled = false;
        }, 3000);

    } catch (err) {
        hideStatus();
        showError("Rewrite error: " + err.message);
        btn.innerHTML = REWRITE_BTN_INNER;
        btn.disabled = false;
    }
};
