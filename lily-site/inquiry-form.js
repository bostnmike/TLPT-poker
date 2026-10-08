/* Native calendars, contact formatting, and validation. No data transmission. */
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
  const email = form.elements.namedItem('email');
  const phone = form.elements.namedItem('phone');
  const touched = new Set();
  const formatPhone = () => {
    const raw = phone.value;
    let digits = raw.replace(/\D/g, '');
    let beforeCursor = raw.slice(0, phone.selectionStart ?? raw.length).replace(/\D/g, '').length;
    if (digits.length === 11 && digits.startsWith('1')) {
      digits = digits.slice(1);
      beforeCursor = Math.max(0, beforeCursor - 1);
    }
    // Preserve invalid text so it can be corrected; never silently truncate it.
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
  const validateContact = (input, showError = false) => {
    input.setCustomValidity('');
    let message = '';
    if (input === email) {
      if (!email.value) message = 'Enter your email address so Lily can reply.';
      else if (email.validity.typeMismatch || email.validity.patternMismatch) message = 'Enter a complete email address, such as you@example.com.';
    } else if (phone.value && phone.validity.patternMismatch) {
      message = 'Enter a 10-digit phone number, including the area code.';
    }
    input.setCustomValidity(message);
    const notice = document.getElementById(input.name + '-error');
    const visible = Boolean(message && (showError || touched.has(input)));
    notice.textContent = visible ? message : '';
    notice.hidden = !visible;
    if (visible) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  };
  for (const input of [email, phone]) {
    input.addEventListener('input', () => {
      if (input === phone) formatPhone();
      validateContact(input);
    });
    input.addEventListener('change', () => {
      if (input === phone) formatPhone();
      validateContact(input);
    });
    input.addEventListener('blur', () => {
      touched.add(input);
      if (input === phone) formatPhone();
      validateContact(input, true);
    });
    input.addEventListener('invalid', () => {
      touched.add(input);
      validateContact(input, true);
    });
  }
  form.addEventListener('focusin', updateDates);
  form.addEventListener('submit', (event) => {
    updateDates();
    formatPhone();
    validateContact(email, true);
    validateContact(phone, true);
    if (!form.checkValidity()) {
      event.preventDefault();
      form.reportValidity();
    }
  });
  window.addEventListener('pageshow', () => {
    updateDates();
    formatPhone();
    validateContact(email);
    validateContact(phone);
  });
  updateDates();
  formatPhone();
  validateContact(email);
  validateContact(phone);
})();
