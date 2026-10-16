const SITE = "https://tlpt.org";
const REGISTRATION = "https://register.tlpt.org";
const PRIVATE_HEADERS = {
  "Cache-Control":"no-store",
  "X-Robots-Tag":"noindex, nofollow, noarchive",
  "Referrer-Policy":"strict-origin-when-cross-origin",
  "X-Content-Type-Options":"nosniff",
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (!["GET", "HEAD"].includes(request.method)) {
      return new Response("Method not allowed", {status:405, headers:{...PRIVATE_HEADERS, Allow:"GET, HEAD"}});
    }
    if (url.pathname === "/robots.txt") {
      return new Response(request.method === "HEAD" ? null : "User-agent: *\nDisallow: /\n", {
        headers:{...PRIVATE_HEADERS, "Content-Type":"text/plain; charset=utf-8"},
      });
    }
    if (!["/", "/register.html"].includes(url.pathname)) {
      // Existing site links and assets stay on their canonical origin.
      return new Response(null, {status:302, headers:{...PRIVATE_HEADERS, Location:SITE + url.pathname + url.search}});
    }
    try {
      // Only fetch the public form. Never forward visitor cookies or contact
      // details to the main site; submissions still go directly to FormSubmit.
      const upstream = await fetch(SITE + "/register.html", {redirect:"manual"});
      if (!upstream.ok) throw new Error("Registration source unavailable");
      let html = await upstream.text();
      const returnField = /(<input\b[^>]*\bname="_next"[^>]*\bvalue=")[^"]*(")/;
      if (!html.includes('<form') || !html.includes('<head>') || !returnField.test(html)) {
        throw new Error("Unexpected registration source");
      }
      html = html.replace("<head>", `<head>\n  <base href="${SITE}/" />`)
        .replace(returnField, `$1${REGISTRATION}/?submitted=1$2`)
        .replaceAll('href="#', `href="${REGISTRATION}/#`);
      return new Response(request.method === "HEAD" ? null : html, {
        headers:{...PRIVATE_HEADERS, "Content-Type":"text/html; charset=utf-8"},
      });
    } catch {
      return new Response(request.method === "HEAD" ? null : "Registration is temporarily unavailable. Please try again shortly.", {
        status:503, headers:{...PRIVATE_HEADERS, "Content-Type":"text/plain; charset=utf-8"},
      });
    }
  },
};
