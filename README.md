# File Zipper

A small, browser-only zip utility built with plain HTML, CSS, and vanilla JavaScript.

## Run locally

1. Open this folder in VS Code.
2. Open `index.html` directly, or use the **Live Server** extension and choose **Open with Live Server**.
3. Add files or a folder, choose a zip name and compression level, then select **Create zip**.

The app uses [JSZip](https://stuk.github.io/jszip/) from a CDN. Files are read locally by the browser and are never uploaded to a server.

## Project structure

```text
file-zipper/
├── index.html
├── README.md
├── assets/
├── css/
│   └── style.css
└── js/
    └── main.js
```

## Notes

- Folder selection uses the browser's directory picker where supported.
- Dragging a folder into the drop zone is supported in Chromium-based browsers through the File System Access API.
- For the best folder experience, use a current Chromium-based browser or select a folder with **Browse folders**.
