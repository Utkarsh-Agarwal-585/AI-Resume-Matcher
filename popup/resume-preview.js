// ── Print: auto-scale to fit exactly one page ─────────────────────────────────

const LETTER_PAGE_PX = 11 * 96; // 1056 px — full letter page (@page margin: 0)

function applyPrintZoom() {
    const resume = document.getElementById("resume");
    resume.style.zoom      = "";
    resume.style.minHeight = "";

    // Measure with print-equivalent CSS so zoom is based on the actual
    // printed height, not the larger screen height (line-height 1.5 + padding).
    resume.classList.add("pre-print-measure");
    void resume.offsetHeight; // force reflow
    const printH = resume.scrollHeight;
    resume.classList.remove("pre-print-measure");

    let zoom = 1;
    if (printH > LETTER_PAGE_PX) {
        zoom = LETTER_PAGE_PX / printH;
        resume.style.zoom = zoom.toFixed(5);
    }

    // CSS zoom also scales min-height, so "min-height: 11in" at zoom 0.95
    // only occupies 10.45in of the page, leaving a blank footer gap.
    // Compensate by setting an inline min-height that counteracts the scale:
    //   zoom × (PAGE / zoom) = PAGE  →  element always fills the full page.
    resume.style.minHeight = Math.ceil(LETTER_PAGE_PX / zoom) + "px";
}

function removePrintZoom() {
    const resume = document.getElementById("resume");
    resume.style.zoom      = "";
    resume.style.minHeight = "";
}

document.getElementById("printBtn").addEventListener("click", () => {
    applyPrintZoom();
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
});

window.addEventListener("afterprint", removePrintZoom);

// ── HTML helpers ──────────────────────────────────────────────────────────────

function esc(str) {
    return (str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function linkify(html) {
    return html
        // Standard https?:// URLs
        .replace(/(https?:\/\/[^\s<>"'|,)]+)/g,
            u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`)

        // Custom pseudo-scheme: LinkedIn://username  →  https://linkedin.com/in/username
        .replace(/(?<![/"'>])\bLinkedIn:\/\/([^\s<>"'|,)]+)/gi,
            (m, user) => `<a href="https://linkedin.com/in/${user}" target="_blank" rel="noopener">${m}</a>`)

        // Custom pseudo-scheme: GitHub://username  →  https://github.com/username
        .replace(/(?<![/"'>])\bGitHub:\/\/([^\s<>"'|,)]+)/gi,
            (m, user) => `<a href="https://github.com/${user}" target="_blank" rel="noopener">${m}</a>`)

        // Bare linkedin.com/in/username  (no http prefix)
        .replace(/(?<![/"'>])((?:www\.)?linkedin\.com\/in\/[^\s<>"'|,)]+)/g,
            m => `<a href="https://${m}" target="_blank" rel="noopener">${m}</a>`)

        // Bare linkedin.com/username  (profile without /in/)
        .replace(/(?<![/"'>])((?:www\.)?linkedin\.com\/(?!in\/)[a-zA-Z0-9_-]+)/g,
            m => `<a href="https://${m}" target="_blank" rel="noopener">${m}</a>`)

        // Bare github.com/username
        .replace(/(?<![/"'>])((?:www\.)?github\.com\/[^\s<>"'|,)]+)/g,
            m => `<a href="https://${m}" target="_blank" rel="noopener">${m}</a>`)

        // Email addresses
        .replace(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g,
            e => `<a href="mailto:${e}">${e}</a>`);
}

function bullets(items) {
    if (!items?.length) return "";
    return `<ul class="section-list">${items.map(b => `<li>${linkify(esc(b))}</li>`).join("")}</ul>`;
}

// ── Section renderers ─────────────────────────────────────────────────────────

function renderExperience(experience) {
    if (!experience?.length) return "";
    const items = experience.map(job => {
        if (typeof job === "string") {
            return `<div class="exp-entry"><ul class="section-list"><li>${linkify(esc(job))}</li></ul></div>`;
        }
        const company = [job.company, job.location].filter(Boolean).map(esc).join(", ");
        return `
            <div class="exp-entry">
                <div class="exp-header">
                    <strong class="exp-company">${company}</strong>
                    <span class="exp-duration">${esc(job.duration)}</span>
                </div>
                ${job.title ? `<div class="exp-title"><em>${esc(job.title)}</em></div>` : ""}
                ${bullets(job.bullets)}
            </div>`;
    }).join("");
    return `<section class="resume-section">
        <h2 class="section-title">Experience</h2>
        ${items}
    </section>`;
}

function renderProjects(projects) {
    if (!projects?.length) return "";
    const items = projects.map(p => {
        if (typeof p === "string") {
            return `<div class="proj-entry"><ul class="section-list"><li>${linkify(esc(p))}</li></ul></div>`;
        }
        const nameNode = p.link
            ? `<a href="${esc(p.link)}" target="_blank" rel="noopener"><strong>${esc(p.name)}</strong></a>`
            : `<strong>${esc(p.name)}</strong>`;
        const label = p.year ? `${nameNode} <span class="proj-year">${esc(p.year)}</span>` : nameNode;
        return `
            <div class="proj-entry">
                <div class="proj-name">${label}</div>
                ${bullets(p.bullets)}
            </div>`;
    }).join("");
    return `<section class="resume-section">
        <h2 class="section-title">Projects</h2>
        ${items}
    </section>`;
}

function renderEducation(education) {
    if (!education?.length) return "";
    const items = education.map(e => {
        if (typeof e === "string") {
            return `<div class="edu-entry"><p>${esc(e)}</p></div>`;
        }
        return `
        <div class="edu-entry">
            <div class="edu-header">
                <strong class="edu-institution">${esc(e.institution)}</strong>
                <span class="edu-duration">${esc(e.duration)}</span>
            </div>
            <div class="edu-degree">${esc(e.degree)}${e.grade ? ` &nbsp;&mdash;&nbsp; <em>${esc(e.grade)}</em>` : ""}</div>
        </div>`;
    }).join("");
    return `<section class="resume-section">
        <h2 class="section-title">Education</h2>
        ${items}
    </section>`;
}

function renderSkills(skills) {
    if (!skills?.length) return "";
    return `<section class="resume-section">
        <h2 class="section-title">Skills</h2>
        ${skills.map(s => `<p class="skills-text">${linkify(esc(s))}</p>`).join("")}
    </section>`;
}

// ── Main render ───────────────────────────────────────────────────────────────

function renderResume(r) {
    const el = document.getElementById("resume");
    el.classList.remove("loading");

    // contactItems is an array; join with " | " and linkify each
    const contactHtml = (r.contactItems?.length ? r.contactItems : r.contact ? [r.contact] : [])
        .map(c => linkify(esc(c)))
        .join(" <span class='pipe'>|</span> ");

    el.innerHTML = `
        <header class="resume-header">
            ${r.name ? `<h1 class="resume-name">${esc(r.name)}</h1>` : ""}
            ${contactHtml ? `<p class="resume-contact">${contactHtml}</p>` : ""}
        </header>

        ${r.summary ? `
        <section class="resume-section">
            <h2 class="section-title">Summary</h2>
            <p class="summary-text">${linkify(esc(r.summary))}</p>
        </section>` : ""}

        ${renderExperience(r.experience)}
        ${renderProjects(r.projects)}
        ${renderEducation(r.education)}
        ${renderSkills(r.skills)}
    `;

    document.title = r.name ? `${r.name} — Resume` : "Rewritten Resume";
}

// ── Load data from storage ────────────────────────────────────────────────────

(async () => {
    try {
        const { rewritePreviewData } = await chrome.storage.local.get(["rewritePreviewData"]);
        if (!rewritePreviewData) {
            document.getElementById("resume").innerHTML =
                `<p class="error-msg">No resume data found. Please run the rewrite from the extension popup first.</p>`;
            return;
        }
        renderResume(rewritePreviewData);
        await chrome.storage.local.remove(["rewritePreviewData"]);
    } catch (err) {
        document.getElementById("resume").innerHTML =
            `<p class="error-msg">Error loading resume: ${esc(err.message)}</p>`;
    }
})();
