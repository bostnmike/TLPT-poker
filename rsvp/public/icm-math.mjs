// Exact Malmuth–Harville finishing-order enumeration: at most 5! = 120 orders.
// Currency enters and leaves as integer cents; no external service is involved.
export const MAX_POOL_CENTS = 100_000_000_000;
const requireValue = (condition, message) => { if (!condition) throw Error(message); };

export function chipCount(value) {
  const text = String(value).trim();
  requireValue(/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(text), 'Enter a whole chip count, such as 125,000.');
  const chips = Number(text.replaceAll(',', ''));
  requireValue(Number.isSafeInteger(chips) && chips > 0, 'Each remaining player needs a positive whole chip count.');
  return chips;
}

export function prizeCents(value) {
  const text = String(value).trim();
  const match = text.match(/^((?:\d+|\d{1,3}(?:,\d{3})+))(?:\.(\d{1,2}))?$/);
  requireValue(match, 'Enter a dollar amount with up to two decimal places, or 0 for an unpaid place.');
  const cents = Number(match[1].replaceAll(',', '')) * 100 + Number((match[2] || '').padEnd(2, '0'));
  requireValue(Number.isSafeInteger(cents) && cents <= MAX_POOL_CENTS, 'Enter a prize of no more than $1,000,000,000.');
  return cents;
}

export function calculateIcm(stacks, payouts) {
  requireValue(Array.isArray(stacks) && stacks.length >= 2 && stacks.length <= 5, 'Choose 2 to 5 remaining players.');
  requireValue(Array.isArray(payouts) && payouts.length === stacks.length, 'Enter one original prize for each remaining place.');
  requireValue(stacks.every(stack => Number.isSafeInteger(stack) && stack > 0), 'Every chip count must be a positive whole number.');
  const totalChips = stacks.reduce((sum, stack) => sum + stack, 0);
  requireValue(Number.isSafeInteger(totalChips), 'The combined chip count is too large.');
  requireValue(payouts.every(cents => Number.isSafeInteger(cents) && cents >= 0), 'Prizes must be nonnegative amounts in cents.');
  requireValue(payouts.every((cents, place) => place === 0 || cents <= payouts[place - 1]), 'Original prizes must run from highest to lowest.');
  const totalCents = payouts.reduce((sum, cents) => sum + cents, 0);
  requireValue(Number.isSafeInteger(totalCents) && totalCents > 0 && totalCents <= MAX_POOL_CENTS, 'Enter a positive remaining prize pool of no more than $1,000,000,000.');
  const raw = stacks.map(() => 0);
  function visit(remaining, chips, probability, place) {
    for (const player of remaining) {
      const chance = remaining.length === 1 ? probability : probability * (stacks[player] / chips);
      raw[player] += chance * payouts[place];
      if (remaining.length > 1) visit(remaining.filter(index => index !== player), chips - stacks[player], chance, place + 1);
    }
  }
  visit(stacks.map((_, index) => index), totalChips, 1, 0);
  // Absorb floating-point drift, then allocate fractional pennies by largest
  // remainder. Displayed payouts always equal the entered pool exactly.
  const expectedTotal = raw.reduce((sum, value) => sum + value, 0);
  const exact = raw.map(value => value * totalCents / expectedTotal);
  const cents = exact.map(Math.floor);
  const pennies = totalCents - cents.reduce((sum, value) => sum + value, 0);
  requireValue(pennies >= 0 && pennies <= stacks.length, 'The payout calculation could not be verified. Check the inputs and try again.');
  const order = stacks.map((_, index) => index).sort((a, b) => {
    const difference = (exact[b] - cents[b]) - (exact[a] - cents[a]);
    return Math.abs(difference) > 1e-7 ? difference : stacks[b] - stacks[a] || a - b;
  });
  for (let index = 0; index < pennies; index++) cents[order[index]]++;
  return {totalChips, totalCents, equities: cents, exactCents: exact};
}
