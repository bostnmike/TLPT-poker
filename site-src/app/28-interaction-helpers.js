function typeTextIntoElement(element, text, speed = 18) {
  if (!element) return;

  if (prefersReducedMotion()) {
    element.textContent = text;
    element.classList.add("is-typing-done");
    return;
  }

  element.textContent = "";
  element.classList.remove("is-typing-done");

  let index = 0;

  function tick() {
    element.textContent = text.slice(0, index);
    index += 1;

    if (index <= text.length) {
      window.setTimeout(tick, speed);
    } else {
      element.classList.add("is-typing-done");
    }
  }

  tick();
}

function initEventRsvpNameHover() {
  document.addEventListener("mouseover", event => {
    const seat = event.target.closest(".event-rsvp-seat-player");
    if (!seat) return;

    const row = seat.closest(".event-rsvp-avatar-row");
    const label = row?.querySelector(".event-rsvp-center-name");
    if (!label) return;

    label.textContent = seat.dataset.playerName || "";
    label.classList.add("is-visible");
  });

  document.addEventListener("mouseout", event => {
    const seat = event.target.closest(".event-rsvp-seat-player");
    if (!seat) return;

    if (seat.contains(event.relatedTarget)) return;

    const row = seat.closest(".event-rsvp-avatar-row");
    const label = row?.querySelector(".event-rsvp-center-name");
    if (!label) return;

    label.classList.remove("is-visible");
    label.textContent = "";
  });

  document.addEventListener("focusin", event => {
    const seat = event.target.closest(".event-rsvp-seat-player");
    if (!seat) return;

    const row = seat.closest(".event-rsvp-avatar-row");
    const label = row?.querySelector(".event-rsvp-center-name");
    if (!label) return;

    label.textContent = seat.dataset.playerName || "";
    label.classList.add("is-visible");
  });

  document.addEventListener("focusout", event => {
    const seat = event.target.closest(".event-rsvp-seat-player");
    if (!seat) return;

    const row = seat.closest(".event-rsvp-avatar-row");
    const label = row?.querySelector(".event-rsvp-center-name");
    if (!label) return;

    label.classList.remove("is-visible");
    label.textContent = "";
  });
}

