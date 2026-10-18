# PDF.js

Self-hosted legacy browser build of Mozilla PDF.js, version 6.4.299.
Source: https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-6.4.299.tgz
Apache-2.0 license retained in LICENSE. Only pdf.min.mjs and pdf.worker.min.mjs
are shipped. The viewer loads only the approved same-origin MTT guide.

Keep the library and worker on the same version when updating. Verify both
pages render, printing is enabled only after rendering, and the original PDF
remains downloadable. No PDF contents are sent to a third-party service.
