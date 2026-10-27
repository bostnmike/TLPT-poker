# Test-only reference fonts

The approved Linux screenshots use DejaVu Sans for arrows missing from Arial /
Liberation Sans (including U+2197, U+25BE and U+25B6). The official Playwright image
does not include that fallback and substitutes WenQuanYi / FreeSans, changing
symbol shapes and adjacent text positions. These unchanged regular/bold fonts
restore the reference environment without changing the website or screenshots.

Source: Ubuntu 24.04 `fonts-dejavu-core` 2.37-8, upstream DejaVu 2.37.
https://archive.ubuntu.com/ubuntu/pool/main/f/fonts-dejavu/fonts-dejavu-core_2.37-8_all.deb

Package SHA-256:
`40049660c194f3b8a2541fc7369efebb10e9f94bdac836a2f38fafedd10fa73a`

Font SHA-256 checksums are locked in `../environment.json` and verified before
each CI browser phase. The included copyright/license permits redistribution.
Only the disposable test container mounts this directory, read-only. These
files are excluded from the public site by the release packager.
