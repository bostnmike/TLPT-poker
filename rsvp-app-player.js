(() => {
  const trigger = document.getElementById("rsvp-setup-play");
  const template = document.getElementById("rsvp-setup-embed");
  if (!trigger || !template) return;

  trigger.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const frame = template.content.querySelector("iframe")?.cloneNode(true);
    if (!frame) return;

    event.preventDefault();
    const source = new URL(frame.src);
    source.searchParams.set("autoplay", "1");
    frame.src = source.href;
    trigger.replaceWith(frame);
    frame.focus();
  });
})();
