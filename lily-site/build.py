"""Emit the root route while retaining a portable, buildless microsite."""
from pathlib import Path
SITE = Path(__file__).resolve().parent
html = (SITE / "index.html").read_text()
for asset in ("styles.css", "inquiry-form.css", "favicon.svg", "companions.svg", "questionnaire.html", "site-nav.js", "inquiry-form.js"):
    html = html.replace(f'"./{asset}', f'"lily-site/{asset}')
(SITE.parent / "lily.html").write_text(html)
print("Built lily.html from portable lily-site/index.html")
