/* Native form submission. Calendars, service shortcuts, and accessible validation. */
(() => {
  const form = document.querySelector('.inquiry-form');
  if (!form) return;
  const start = form.elements.namedItem('start_date');
  const end = form.elements.namedItem('end_date');
  const email = form.elements.namedItem('email');
  const phone = form.elements.namedItem('phone');
  const service = form.elements.namedItem('service');
  const holiday = document.getElementById('holiday-warning');
  const fields = [...form.querySelectorAll('input:not([type=hidden]):not(.form-honeypot), select')];
  const touched = new Set();
  const today = () => {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  };
  const updateDates = () => {
    const minimum = today();
    start.min = minimum;
    end.min = start.value && start.value > minimum ? start.value : minimum;
    // Check every covered year, including ranges starting after Christmas.
    let includesHoliday = false;
    if (start.value && end.value && end.value >= start.value) {
      for (let year = Number(start.value.slice(0, 4)); year <= Number(end.value.slice(0, 4)); year++) {
        const prefix = String(year).padStart(4, '0');
        if (start.value <= prefix + '-12-25' && end.value >= prefix + '-12-24') {
          includesHoliday = true;
          break;
        }
      }
    }
    holiday.hidden = !includesHoliday;
  };
  const formatPhone = () => {
    const raw = phone.value;
    let digits = raw.replace(/\D/g, '');
    let beforeCursor = raw.slice(0, phone.selectionStart ?? raw.length).replace(/\D/g, '').length;
    if (digits.length === 11 && digits.startsWith('1')) {
      digits = digits.slice(1);
      beforeCursor = Math.max(0, beforeCursor - 1);
    }
    // Preserve invalid characters and excess digits for correction.
    if (/[^0-9\s()+.\-]/.test(raw) || (raw.includes('+') && !/^\s*\+1/.test(raw)) || digits.length > 10) return;
    let formatted = digits ? '(' + digits.slice(0, 3) : '';
    if (digits.length > 3) formatted += ') ' + digits.slice(3, 6);
    if (digits.length > 6) formatted += '-' + digits.slice(6);
    if (raw === formatted) return;
    phone.value = formatted;
    if (document.activeElement === phone) {
      let cursor = 0;
      let seen = 0;
      while (cursor < formatted.length && seen < beforeCursor) {
        if (/\d/.test(formatted[cursor])) seen++;
        cursor++;
      }
      phone.setSelectionRange(cursor, cursor);
    }
  };
  const missing = {
    start_date: 'Choose the first day of care.',
    end_date: 'Choose the last day of care.',
    service: 'Choose the care you need, or select “Help me decide.”',
    location: 'Enter your town or neighborhood.',
    pets: 'Tell Lily the type and number of pets.',
    name: 'Enter your name.',
    email: 'Enter your email address so Lily can reply.'
  };
  const validate = (input, showError = false) => {
    input.setCustomValidity('');
    let message = '';
    if (input.required && !input.value.trim()) message = missing[input.name] || 'Complete this field.';
    else if (input === start || input === end) {
      if (input.validity.badInput) message = 'Choose a complete date using the calendar.';
      else if (input.value && input.value < today()) message = 'Please choose today or a future date.';
      else if (input === end && start.value && input.value && input.value < start.value) message = 'Choose an end date on or after your start date.';
    } else if (input === email && (input.validity.typeMismatch || input.validity.patternMismatch)) message = 'Enter a complete email address, such as you@example.com.';
    else if (input === phone && input.value && input.validity.patternMismatch) message = 'Enter a 10-digit phone number, including the area code.';
    input.setCustomValidity(message);
    const notice = document.getElementById(input.getAttribute('id') === 'start-date' ? 'start-date-error' : input.getAttribute('id') === 'end-date' ? 'end-date-error' : input.name + '-error');
    if (!notice) return;
    const visible = Boolean(message && (showError || touched.has(input)));
    notice.textContent = visible ? message : '';
    notice.hidden = !visible;
    if (visible) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  };
  for (const input of fields) {
    for (const eventName of ['input', 'change']) input.addEventListener(eventName, () => {
      if (input === phone) formatPhone();
      if (input === start || input === end) {
        updateDates();
        validate(start);
        validate(end);
      } else validate(input);
    });
    input.addEventListener('blur', () => {
      touched.add(input);
      if (input === phone) formatPhone();
      validate(input, true);
    });
    input.addEventListener('invalid', () => {
      touched.add(input);
      validate(input, true);
    });
  }
  for (const input of [start, end]) input.addEventListener('click', () => {
    if (typeof input.showPicker === 'function') {
      try { input.showPicker(); } catch (_) { /* Native date control remains usable. */ }
    }
  });
  document.querySelectorAll('a[data-care]').forEach(link => link.addEventListener('click', event => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const value = link.dataset.care;
    if ([...service.options].some(option => option.value === value)) {
      service.value = value;
      validate(service);
    }
  }));
  form.addEventListener('focusin', updateDates);
  form.addEventListener('submit', event => {
    updateDates();
    formatPhone();
    for (const input of fields) validate(input, true);
    if (!form.checkValidity()) {
      event.preventDefault();
      form.reportValidity();
    }
  });
  const refresh = () => {
    updateDates();
    formatPhone();
    fields.forEach(input => validate(input));
    if (location.hash === '#inquiry-sent') document.getElementById('inquiry-sent').focus({ preventScroll: true });
  };
  window.addEventListener('pageshow', refresh);
  refresh();
})();
