/* Native calendar pickers and date-range validation. No data transmission. */
(() => {
  const form = document.querySelector('.inquiry-form');
  if (!form) return;
  const next = form.elements.namedItem('_next');
  if (next && document.currentScript) {
    next.value = new URL('thank-you.html', document.currentScript.src).href;
  }
  const start = form.elements.namedItem('start_date');
  const end = form.elements.namedItem('end_date');
  const error = document.getElementById('date-error');
  const today = () => {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  };
  const updateDates = () => {
    const minimum = today();
    start.min = minimum;
    end.min = start.value && start.value > minimum ? start.value : minimum;
    const reversed = start.value && end.value && end.value < start.value;
    const past = (start.value && start.value < minimum) || (end.value && end.value < minimum);
    const message = reversed ? 'Choose an end date on or after your start date.' : past ? 'Please choose today or a future date.' : '';
    end.setCustomValidity(reversed ? message : '');
    error.textContent = message;
    error.hidden = !message;
    if (end.validity.valid || !end.value) end.removeAttribute('aria-invalid');
    else end.setAttribute('aria-invalid', 'true');
    if (start.validity.valid || !start.value) start.removeAttribute('aria-invalid');
    else start.setAttribute('aria-invalid', 'true');
  };
  for (const input of [start, end]) {
    input.addEventListener('input', updateDates);
    input.addEventListener('change', updateDates);
    input.addEventListener('click', () => {
      if (typeof input.showPicker === 'function') {
        try { input.showPicker(); } catch (_) { /* Keep the browser's normal date control. */ }
      }
    });
  }
  form.addEventListener('focusin', updateDates);
  form.addEventListener('submit', (event) => {
    updateDates();
    if (!form.checkValidity()) {
      event.preventDefault();
      form.reportValidity();
    }
  });
  window.addEventListener('pageshow', updateDates);
  updateDates();
})();
