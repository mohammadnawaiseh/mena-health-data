# MENA Health Data

Open health intelligence for the Middle East & North Africa, by Dr. Mohammad Al Nawayseh.

A static website: no server, no build step. Open `index.html` through any web host.

## Publish on GitHub Pages

1. Sign in at github.com and create a new **public** repository, for example `mena-health-data`.
2. On the repository page choose **Add file → Upload files**, drag in everything from this folder
   (`index.html`, `assets/`, `data/`, `.nojekyll`, `README.md`) and press **Commit changes**.
3. Go to **Settings → Pages**. Under "Build and deployment" set **Source: Deploy from a branch**,
   **Branch: main**, folder **/ (root)**, then **Save**.
4. After a minute or two the site is live at `https://<your-username>.github.io/mena-health-data/`.
5. Optional custom domain: buy a domain, enter it under **Settings → Pages → Custom domain**,
   and add the DNS records GitHub shows you.

## Before you announce it

- In `index.html`, search for `about-linkedin` and replace the link with your own LinkedIn profile URL.
- Check the wording of the About section.
- Check WHO's terms of use for the way you plan to use the site.

## What is live and what is a saved copy

- Live in each visitor's browser: open clinical-trial counts and the trial search (ClinicalTrials.gov),
  and the newest studies per country and topic (PubMed).
- Saved copies in `data/`: World Bank and WHO indicators (10 Nov 2026) and the OpenAlex research
  counts (11 Nov 2026). To update them, replace the CSV files with new ones in the same format.

## Sources

World Bank World Development Indicators (CC BY 4.0), WHO Global Health Observatory and Global Health
Estimates, ClinicalTrials.gov, PubMed (US National Library of Medicine), OpenAlex, Natural Earth.
