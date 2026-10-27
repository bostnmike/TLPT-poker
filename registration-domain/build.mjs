import {mkdir, writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {pathToFileURL, fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";

// Render from the same templates/content hashes even when generated root HTML
// has not yet been committed by the main site's build. No file mutations.
export function canonicalSource() {
  return execFileSync('python3', [fileURLToPath(new URL('../scripts/build-site-shell.py', import.meta.url)), '--page', 'register.html'], {encoding:'utf8'});
}

export function registrationPage(source) {
  const returnField = /(<input\b[^>]*\bname="_next"[^>]*\bvalue=")[^"]*(")/;
  if (!source.includes('<head>') || !returnField.test(source) ||
      !source.includes('action="https://formsubmit.co/blanchettemr@gmail.com"') ||
      !source.includes('content="noindex,nofollow,noarchive"')) {
    throw new Error("Unexpected registration source; refusing to publish");
  }
  return source.replace("<head>", '<head>\n  <base href="https://tlpt.org/" />')
    .replace(returnField, '$1https://register.tlpt.org/?submitted=1$2')
    .replaceAll('href="#', 'href="https://register.tlpt.org/#');
}

export async function build(output) {
  const source = canonicalSource();
  const html = registrationPage(source);
  await mkdir(output, {recursive:true});
  await Promise.all(Object.entries({
    "index.html":html,
    "register.html":html,
    "robots.txt":"User-agent: *\nDisallow: /\n",
    "CNAME":"register.tlpt.org\n",
    ".nojekyll":"",
  }).map(([name, content]) => writeFile(resolve(output, name), content)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv[2]) throw new Error("Pass an empty output directory");
  await build(resolve(process.argv[2]));
}
