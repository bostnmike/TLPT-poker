import {chipCount, prizeCents, calculateIcm} from './icm-math.mjs?v=20261108-1';
import {createIcmSound} from './icm-sound.mjs?v=20261108-1';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const number = value => new Intl.NumberFormat('en-US').format(value);
const money = cents => new Intl.NumberFormat('en-US', {style:'currency', currency:'USD'}).format(cents / 100);
const places = ['1st', '2nd', '3rd', '4th', '5th'];
const steps = [
  ['Players', 'How many egos are left?', 'Choose the number of players still in the game. Include everyone who remains.'],
  ['Names', 'Who survived their own decisions?', 'Select the remaining players from this game’s confirmed lineup.'],
  ['Chips', 'Count the chips. Not the bad beats.', 'Enter each player’s actual chip count. Whole chips, please.'],
  ['Prizes', 'What were you supposed to win?', 'Enter the original payouts for the remaining places. Use 0 for an unpaid place.'],
  ['Results', 'The math has spoken.', 'Take it up with the deck. Here’s the proposed ICM chop.']
];

export function availableIcmGames(feed, admin = false) {
  return (feed?.events || []).filter(event => event.rsvpOpen === true || admin === true);
}
export function icmGamePlayers(feed, event) {
  return (feed?.players || []).filter(player => event?.rsvps?.[player.slug] === 'yes')
    .sort((a, b) => a.name.localeCompare(b.name, 'en', {sensitivity:'base'}));
}

export function initIcmWizard(doc, win) {
  const $ = selector => doc.querySelector(selector);
  const params = new URLSearchParams(win.location.search);
  let feed, games = [], event, roster = [], admin = false, loading = false;
  let step = 0, count = 0, entries = [], prizes = [], result = null;
  const sound = createIcmSound({createContext:() => {
    const Context = win.AudioContext || win.webkitAudioContext;
    if (!Context) throw Error('Audio unavailable');
    return new Context();
  }, onStatus:message => { $('#icm-sound-status').textContent = message; }});

  function problem(message, field) {
    const error = Error(message); error.field = field; throw error;
  }
  function reset() { step = 0; count = 0; entries = []; prizes = []; result = null; }
  function players() { return entries.slice(0, count).map(entry => roster.find(player => player.slug === entry?.slug)); }
  function errorMessage(error) {
    $('#icm-error').textContent = error.message;
    if (error.field) $('#' + error.field)?.focus();
  }
  function enteredChips() {
    return Array.from({length:count}, (_, index) => {
      try { return chipCount(entries[index]?.chips || ''); }
      catch (error) { problem(`${players()[index]?.name || 'Player ' + (index + 1)}: ${error.message}`, 'chips-' + index); }
    });
  }
  function enteredPrizes() {
    return Array.from({length:count}, (_, index) => {
      let cents;
      try { cents = prizeCents(prizes[index] || ''); }
      catch (error) { problem(`${places[index]} place: ${error.message}`, 'prize-' + index); }
      if (index > 0 && cents > prizeCents(prizes[index - 1])) problem('Original payouts must go from highest to lowest. Check this place.', 'prize-' + index);
      return cents;
    });
  }
  function totalPreview() {
    try {
      const values = step === 2 ? enteredChips() : enteredPrizes();
      const total = values.reduce((sum, value) => sum + value, 0);
      if (!Number.isSafeInteger(total)) throw Error('Too large');
      $('#icm-total-value').textContent = step === 2 ? number(total) : money(total);
    } catch { $('#icm-total-value').textContent = '—'; }
  }
  function render(focus = true) {
    $('#wizard').hidden = !event;
    if (!event) return;
    $('#icm-progress').innerHTML = steps.map(([label], index) => `<li ${index === step ? 'aria-current="step"' : ''} class="${index < step ? 'done' : ''}">${index + 1}. ${label}</li>`).join('');
    $('#icm-step-title').textContent = steps[step][1];
    $('#icm-step-help').textContent = steps[step][2];
    $('#icm-error').textContent = '';
    $('#icm-copy-status').textContent = '';
    $('#icm-copy-fallback').hidden = true;
    $('#icm-back').hidden = step === 0;
    $('#icm-back').textContent = step === 4 ? 'Edit prizes' : 'Back';
    $('#icm-next').hidden = step === 4;
    $('#icm-next').disabled = roster.length < 2;
    $('#icm-next').textContent = step === 3 ? 'Calculate ICM chop' : 'Continue';
    $('#icm-copy').hidden = step !== 4;
    $('#icm-replay').hidden = step !== 4;
    $('#icm-sound-status').hidden = step !== 4;
    $('#icm-sound-status').textContent = '';
    $('#icm-start-over').hidden = step !== 4;
    const fields = $('#icm-fields');
    if (step === 0) {
      fields.innerHTML = `<fieldset class="icm-counts"><legend>Players remaining</legend>${[2,3,4,5].map(value => `<label><input type="radio" name="count" value="${value}" ${count === value ? 'checked' : ''} ${roster.length < value ? 'disabled' : ''}>${value}</label>`).join('')}</fieldset>`;
      if (roster.length < 2) $('#icm-error').textContent = 'This game needs at least two confirmed players in its lineup before you can calculate a chop.';
    } else if (step === 1) {
      fields.innerHTML = `<div class="icm-inputs">${Array.from({length:count}, (_, index) => `<div><label for="player-${index}">Player ${index + 1}</label><select id="player-${index}" data-player="${index}"><option value="">Choose a player…</option>${roster.map(player => `<option value="${esc(player.slug)}" ${entries[index]?.slug === player.slug ? 'selected' : ''}>${esc(player.name)}</option>`).join('')}</select></div>`).join('')}</div>`;
      updateNameChoices();
    } else if (step === 2) {
      fields.innerHTML = `<div class="icm-inputs">${players().map((player, index) => `<label>${esc(player.name)} · chips<input id="chips-${index}" data-chips="${index}" type="text" inputmode="numeric" autocomplete="off" maxlength="30" placeholder="e.g. 125,000" value="${esc(entries[index]?.chips || '')}"></label>`).join('')}</div><div class="icm-total"><span>Total chips</span><strong id="icm-total-value" aria-live="polite">—</strong></div>`;
      totalPreview();
    } else if (step === 3) {
      const chips = enteredChips();
      fields.innerHTML = `<p class="icm-recap">${count} players · ${number(chips.reduce((sum, value) => sum + value, 0))} chips in play. Enter only prizes still to be paid.</p><div class="icm-inputs">${Array.from({length:count}, (_, index) => `<label>${places[index]} place · original payout ($)<input id="prize-${index}" data-prize="${index}" type="text" inputmode="decimal" autocomplete="off" maxlength="24" placeholder="0.00" value="${esc(prizes[index] || '')}"></label>`).join('')}</div><div class="icm-total"><span>Remaining prize pool</span><strong id="icm-total-value" aria-live="polite">—</strong></div>`;
      totalPreview();
    } else {
      const chips = enteredChips();
      fields.innerHTML = `<ul class="icm-results">${players().map((player, index) => `<li><h3>${esc(player.name)}</h3><strong>${money(result.equities[index])}</strong><p>${number(chips[index])} chips · ${(100 * chips[index] / result.totalChips).toFixed(2)}% of chips</p></li>`).join('')}</ul><div class="icm-total"><span>Total ICM payouts</span><strong>${money(result.totalCents)}</strong></div><p class="icm-recap">The full remaining prize pool, accounted for to the cent.</p>`;
    }
    if (focus) $('#icm-step-title').focus();
  }
  function updateNameChoices() {
    for (let index = 0; index < count; index++) {
      const select = $('#player-' + index);
      for (const option of select.options) option.disabled = !!option.value && entries.some((entry, other) => other < count && other !== index && entry?.slug === option.value);
    }
  }
  function chooseGame(id) {
    const selected = games.find(game => game.id === id);
    if (event?.id === selected?.id && event) return;
    reset(); event = selected; roster = icmGamePlayers(feed, event);
    $('#icm-game-title').textContent = event?.title || 'Choose a game';
    $('#icm-game-date').textContent = event ? event.date === 'Date TBD' ? 'Date to be confirmed' : new Date(event.date + 'T12:00:00Z').toLocaleDateString('en-US', {dateStyle:'long', timeZone:'America/New_York'}) : '';
    $('#change-game').hidden = !event || games.length < 2;
    $('#game-picker').hidden = !!event;
    $('#icm-game').value = event?.id || '';
    $('#icm-load-status').textContent = !event && params.get('event') ? 'That game is no longer available in this view. Choose another game or return to RSVP.' : !event && !games.length ? 'No games are available in this view. Return to RSVP to choose an open game.' : '';
    render(false);
  }
  async function load() {
    if (loading) return;
    loading = true; $('#icm-retry').hidden = true; $('#icm-load-status').textContent = 'Checking the lineup…';
    const controller = new AbortController(), timer = win.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await win.fetch('/api/public/events', {cache:'no-store', signal:controller.signal});
      if (!response.ok) throw Error('Could not load the game lineup. Check your connection and try again.');
      feed = await response.json();
      if (feed.schemaVersion !== 1 || !Array.isArray(feed.events) || !Array.isArray(feed.players)) throw Error('The game lineup could not be read. Try again.');
      if (params.has('commish')) {
        try { const me = await win.fetch('/api/me', {cache:'no-store', signal:controller.signal}); admin = me.ok && (await me.json()).role === 'admin'; } catch { admin = false; }
      }
      $('#back-to-rsvp').href = admin ? '/?commish=1&activity=lineups' : '/';
      games = availableIcmGames(feed, admin);
      $('#icm-game').innerHTML = '<option value="">Choose a game…</option>' + games.map(game => `<option value="${esc(game.id)}">${esc(game.title)} · ${esc(game.date)}</option>`).join('');
      chooseGame(params.get('event') || (games.length === 1 ? games[0].id : ''));
    } catch (error) {
      $('#icm-load-status').textContent = error.name === 'AbortError' ? 'The lineup is taking too long to load. Try again.' : error.message;
      $('#icm-retry').hidden = false;
    } finally { win.clearTimeout(timer); loading = false; }
  }
  $('#icm-form').addEventListener('submit', action => {
    action.preventDefault();
    try {
      if (step === 0) {
        if (count < 2 || count > 5 || count > roster.length) problem('Choose how many players remain.');
      } else if (step === 1) {
        for (let index = 0; index < count; index++) {
          if (!roster.some(player => player.slug === entries[index]?.slug)) problem('Choose a name for every remaining player.', 'player-' + index);
          if (entries.slice(0, index).some(entry => entry?.slug === entries[index].slug)) problem('Choose each player only once.', 'player-' + index);
        }
      } else if (step === 2) {
        const total = enteredChips().reduce((sum, chips) => sum + chips, 0);
        if (!Number.isSafeInteger(total)) problem('The combined chip count is too large. Check the stacks.', 'chips-0');
      } else if (step === 3) result = calculateIcm(enteredChips(), enteredPrizes());
      else return;
      sound.prepare(); step++; render();
      if (step === 4) void sound.play();
    } catch (error) { errorMessage(error); }
  });
  $('#icm-fields').addEventListener('change', action => {
    const input = action.target;
    if (input.name === 'count') { count = Number(input.value); }
    if (input.dataset.player !== undefined) {
      const index = Number(input.dataset.player);
      entries[index] = {slug:input.value, chips:entries[index]?.slug === input.value ? entries[index].chips : ''};
      updateNameChoices();
    }
  });
  $('#icm-fields').addEventListener('input', action => {
    const input = action.target;
    if (input.dataset.chips !== undefined) { entries[Number(input.dataset.chips)].chips = input.value; totalPreview(); }
    if (input.dataset.prize !== undefined) { prizes[Number(input.dataset.prize)] = input.value; totalPreview(); }
  });
  $('#icm-back').addEventListener('click', () => { if (step > 0) { step--; render(); } });
  $('#icm-start-over').addEventListener('click', () => { reset(); render(); });
  $('#change-game').addEventListener('click', () => { $('#game-picker').hidden = false; $('#icm-game').focus(); });
  $('#icm-game').addEventListener('change', action => chooseGame(action.target.value));
  $('#icm-retry').addEventListener('click', load);
  $('#icm-replay').addEventListener('click', () => { if (step === 4 && result) { sound.prepare(); void sound.play(); } });
  win.addEventListener('pagehide', action => { if (!action.persisted) sound.dispose(); });
  $('#icm-copy').addEventListener('click', async () => {
    if (!result || step !== 4) return;
    const chips = enteredChips();
    const text = ['TLPT ICM Chop', event.title + ' · ' + event.date, ...players().map((player, index) => `${player.name}: ${money(result.equities[index])} (${number(chips[index])} chips)`), 'Total: ' + money(result.totalCents), 'Proposed ICM payouts.'].join('\n');
    try { await win.navigator.clipboard.writeText(text); $('#icm-copy-status').textContent = 'Copied. Let the table argue with the math.'; }
    catch { $('#icm-copy-fallback').hidden = false; $('#icm-copy-text').value = text; $('#icm-copy-text').focus(); $('#icm-copy-text').select(); $('#icm-copy-status').textContent = 'Copy the selected results below.'; }
  });
  return load();
}

if (typeof window !== 'undefined') initIcmWizard(document, window);
