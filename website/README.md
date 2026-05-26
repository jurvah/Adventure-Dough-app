# Adventure Dough — Marketing Website

A mobile-first, single-page static website. No build step required.

## Files

- `index.html` — the entire website (HTML + CSS + JavaScript)
- `images/` — drop your photos here, then update `src` attributes in `index.html`

## Getting Started

Open `index.html` in any browser to preview locally. No server needed.

## Deploying

**Netlify (recommended — free)**
1. Go to [netlify.com](https://netlify.com) and sign in
2. Drag the entire `website/` folder onto the Netlify dashboard
3. Your site is live instantly with a free URL

**GitHub Pages**
1. Push this repo to GitHub
2. Go to Settings → Pages → Source: deploy from branch
3. Set the folder to `/website` if the option is available, or move `index.html` to the repo root

**Any static host (Vercel, Cloudflare Pages, etc.)**
Upload or deploy the `website/` folder as the root of a new static site project.

## Customizing

All design tokens (colors, fonts, spacing) are CSS custom properties at the top of the `<style>` block in `index.html`. Look for the `DESIGN TOKENS` comment section.

Every placeholder is marked with an `<!-- OWNER: ... -->` comment. Search for `OWNER:` to find everything that needs to be filled in before launch.

## Checklist Before Launch

- [ ] Fill in `<meta name="description">` with a one-sentence business description
- [ ] Fill in all Open Graph `<meta>` tags (title, description, image, URL)
- [ ] Replace `[Your tagline goes here]` in the hero section
- [ ] Replace all `[Gallery Heading]`, `[About Heading]`, `[FAQ Heading]`, `[Shop Heading]`
- [ ] Add real product photos to `images/` and update `src` attributes in the gallery
- [ ] Update the About section text with your real story
- [ ] Replace FAQ placeholder questions and answers with real ones
- [ ] Replace the Shop button `href="#"` with your actual e-commerce URL
- [ ] Add your Instagram profile URL to both the nav icon and footer icon
- [ ] Set your brand colors in the `:root` CSS custom properties
- [ ] Choose a font (Google Fonts or system font) and update `--font-sans`
