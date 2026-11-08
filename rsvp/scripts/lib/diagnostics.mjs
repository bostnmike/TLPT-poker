// Shared by Node harnesses and their test-only Worker wrapper. Never log input
// bodies, SQL parameters, environment contents or complete credential values.
export function sanitized(value) {
  return String(value ?? '')
    .replace(/\b(authorization|cookie|set-cookie)\s*[:=][^\r\n]*/gi, '$1: [redacted]')
    .replace(/((?:"|')?(?:key|token|password|secret|api[_-]?key|api[_-]?token|adminHash|linkHash)(?:"|')?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;}]+)/gi, '$1[redacted]')
    .replace(/(#key=)[^&\s"'<>]+/gi, '$1[redacted]')
    .replace(/\b[a-f0-9]{64}\b/gi, '[redacted]')
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[redacted]@');
}

export function diagnosticDb(database, report = message => console.error(message)) {
  const originals = new WeakMap();
  function guarded(label, invoke) {
    const failed = error => { report(`[harness ${label}] ${sanitized(error?.message || error)}`); throw error; };
    try {
      const value = invoke();
      return value && typeof value.then === 'function' ? value.catch(failed) : value;
    } catch (error) { return failed(error); }
  }
  function statement(value) {
    const proxy = new Proxy(value, {get(target, property) {
      const member = Reflect.get(target, property, target);
      if (property === 'bind') return (...args) => statement(guarded('D1.bind', () => member.apply(target, args)));
      return typeof member === 'function' ? (...args) => guarded('D1.' + String(property), () => member.apply(target, args)) : member;
    }});
    originals.set(proxy, value); return proxy;
  }
  return new Proxy(database, {get(target, property) {
    const member = Reflect.get(target, property, target);
    if (property === 'prepare') return sql => statement(guarded('D1.prepare', () => member.call(target, sql)));
    if (property === 'batch') return statements => guarded('D1.batch', () => member.call(target, statements.map(value => originals.get(value) || value)));
    return typeof member === 'function' ? (...args) => guarded('D1.' + String(property), () => member.apply(target, args)) : member;
  }});
}
