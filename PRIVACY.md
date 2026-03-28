# Privacy Policy — AI Resume Matcher


_Last updated: March 2026_


## Overview


AI Resume Matcher is a Chrome extension that analyses your resume against LinkedIn job descriptions using Google's Gemini AI. This policy explains what data is used and how.


## Data We Do NOT Collect


We do not collect, store, transmit, or share any personal data. Specifically:


- We do **not** collect your name, email, or any personally identifiable information
- We do **not** store your resume on any server
- We do **not** track your browsing history or activity
- We do **not** use analytics or advertising trackers


## Data Stored Locally on Your Device


The following is stored **only on your device** using Chrome's local storage (`chrome.storage.local`) and never leaves it:


- **Your resume text** — saved locally so you don't have to re-enter it each time
- **Your Gemini API key** — stored locally and used only to call Google's Gemini API directly from your browser


## Third-Party Services


The extension communicates with one external service:


- **Google Gemini API** (`generativelanguage.googleapis.com`) — your resume text and the job description are sent to this API to generate the match score and rewritten resume. This is done using your own API key. Please refer to [Google's Privacy Policy](https://policies.google.com/privacy) for how Google handles this data.


No other external servers, services, or third parties are contacted.


## Permissions Used
- **activeTab** — to read the current tab's URL and extract the job description from a LinkedIn page
- **scripting** — to extract job description text from the active LinkedIn tab
- **storage** — to save your resume and API key locally on your device
- **downloads** — to download your rewritten resume to your device


## Changes to This Policy


If this policy changes, the updated version will be posted in this repository with a new date.


## Contact


For questions, open an issue at: https://github.com/Utkarsh-Agarwal-585/ai-resume-matcher/issues
