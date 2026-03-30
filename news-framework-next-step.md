# TLPT News framework starter

Use this to move away from one giant hand-maintained news.html.

## Files
- `news_framework_shell.html` -> rename to `news.html` when ready
- `news-data-starter.json` -> rename to `news-data.json`
- `news-render-starter.js` -> rename to `news-render.js`
- `news.css` -> optional News-only stylesheet

## Weekly workflow
1. Add a new week object to the top of `news-data.json`
2. Update summary cards and article HTML in that object
3. The page auto-renders latest week + archive links

## Migration
Start by loading only the current featured week from JSON. Backfill old weeks later.
