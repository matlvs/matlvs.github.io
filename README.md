# Personal research website

Static site (plain HTML + CSS, no build step) for GitHub Pages.

## Files
- `index.html` – home page
- `research.html` – research interests
- `publications.html` – publications
- `cv.html` – CV
- `style.css` – shared styling

## Publish on GitHub Pages
1. Create a repository named `<your-username>.github.io` on GitHub.
2. Upload all files from this folder to the root of the repository (or `git push` them).
3. In the repository, go to **Settings → Pages**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`.
4. After a minute the site is live at `https://<your-username>.github.io`.

## Things to personalise
- **Photo:** add `photo.jpg` and replace the `<div class="portrait">ML</div>` in `index.html` with
  `<img class="portrait" src="photo.jpg" alt="Mathieu Le Verge-Serandour">`.
- **CV PDF:** compile your LaTeX CV and add it as `cv.pdf` (the CV page links to it).
- **Paper links:** in `publications.html`, turn a title into a link with
  `<a class="pub-title" href="https://doi.org/...">Title</a>`.
- **Google Scholar:** uncomment the button in `index.html`.
