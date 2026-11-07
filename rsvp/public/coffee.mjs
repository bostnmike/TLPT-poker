import {coffeeDescription} from './coffee-menu.mjs?v=20261107-2';

const $ = selector => document.querySelector(selector);
const dialog = $('#coffee-dialog'), form = $('#coffee-form'), fields = $('#coffee-fields');
const status = $('#coffee-status'), cancel = $('#coffee-cancel');
const filter = $('#coffee-filter'), queue = $('#coffee-queue'), queueStatus = $('#coffee-queue-status');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
let context = null, saving = false, pending = null, loadingQueue = false, queueData = null;
let activeCommish = false;
let selected = {slug: '', name: '', commishEntry: new URLSearchParams(location.search).has('commish')};
filter.value = '';
let initialEvent = new URLSearchParams(location.search).get('event');

async function request(path, body) {
  const response = await fetch('/api/' + path, {
    cache: 'no-store',
    ...(body ? {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)} : {})
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Coffee orders are unavailable. Please try again.');
  return data;
}
function milkChoice() {
  const coffee = form.elements.drink.value === 'coffee';
  $('#coffee-milk-choice').hidden = !coffee;
  $('#coffee-milk-note').hidden = coffee;
}
function currentPlayer() {
  // Covers a very fast first render that completed before this module loaded.
  const picker = $('#shared-player');
  return picker && !selected.commishEntry
    ? {...selected, slug: picker.value, name: picker.selectedOptions[0]?.textContent || ''}
    : selected;
}
async function openOrder(button) {
  const player = currentPlayer();
  if (saving || !player.slug || player.commishEntry || player.preview) return;
  const target = {slug: player.slug, eventId: button.dataset.coffeeEvent, orderId: crypto.randomUUID(), version: 0};
  context = target; pending = null; form.reset(); form.hidden = false; milkChoice(); fields.disabled = true; cancel.hidden = true;
  $('#coffee-for').textContent = `${player.name} · ${button.closest('.event').querySelector('h2').textContent}`;
  status.textContent = 'Checking your order…';
  dialog.showModal();
  try {
    const {orders} = await request('coffee?' + new URLSearchParams({slug: target.slug, eventId: target.eventId}));
    if (context !== target || !dialog.open) return;
    const order = orders.find(order => order.status === 'active') || orders.at(-1);
    if (order) {
      target.orderId = order.orderId; target.version = order.version;
      form.elements.drink.value = order.drink;
      form.elements.temperature.value = order.temperature;
      form.elements.milk.value = order.milk ? 'milk' : 'black';
      form.elements.stevia.checked = order.stevia;
      form.elements.extraShot.checked = order.extraShot;
    }
    milkChoice(); fields.disabled = false; cancel.hidden = order?.status !== 'active';
    status.textContent = order?.status === 'active'
      ? 'Your order: ' + coffeeDescription(order)
      : order?.status === 'cancelled' ? 'Your order was cancelled. Send it again if you change your mind.' : 'What’s fueling your next questionable call?';
  } catch (error) {
    if (context === target) status.textContent = error.message + ' Close and reopen to retry.';
  }
}
async function saveOrder(action) {
  if (!context || saving || fields.disabled) return;
  const target = context;
  const data = {slug: target.slug, eventId: target.eventId, orderId: target.orderId, action, expectedVersion: target.version};
  if (action === 'save') data.order = {
    drink: form.elements.drink.value, temperature: form.elements.temperature.value,
    milk: form.elements.drink.value !== 'coffee' || form.elements.milk.value === 'milk',
    stevia: form.elements.stevia.checked, extraShot: form.elements.extraShot.checked
  };
  const fingerprint = JSON.stringify(data);
  // Reuse this ID after an uncertain network response, preventing duplicate alerts.
  if (pending?.fingerprint !== fingerprint) pending = {fingerprint, requestId: crypto.randomUUID()};
  saving = true; fields.disabled = true; status.textContent = 'Saving your coffee order…';
  try {
    const {order} = await request('coffee', {...data, requestId: pending.requestId});
    target.version = order.version; pending = null; cancel.hidden = order.status !== 'active';
    status.textContent = order.status === 'cancelled' ? 'Drink cancelled.' : 'Drink saved: ' + coffeeDescription(order) + '. The Commish can see it now.';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    saving = false;
    status.scrollIntoView({block: 'nearest'});
    if (context === target && dialog.open) fields.disabled = false;
  }
}
function renderQueue() {
  if (!queueData) return;
  const orders = queueData.orders.filter(order => !filter.value || order.eventId === filter.value);
  const active = orders.filter(order => order.status === 'active'), cancelled = orders.filter(order => order.status === 'cancelled');
  const cards = rows => rows.map(order => {
    const event = queueData.events.find(event => event.id === order.eventId);
    return `<article class="coffee-order"><h3>${esc(order.name)}</h3><p class="coffee-order-drink">${esc(coffeeDescription(order))}</p><p>${esc(event.title)} · ${esc(event.date)}${event.open ? '' : ' · Game closed'}</p></article>`;
  }).join('');
  queue.replaceChildren();
  queue.innerHTML = (active.length ? cards(active) : '<p>No coffee orders yet.</p>') +
    (cancelled.length ? `<details><summary>Cancelled orders (${cancelled.length})</summary>${cards(cancelled)}</details>` : '');
  queueStatus.textContent = `${active.length} ${active.length === 1 ? 'drink' : 'drinks'} ordered · Checked ${new Date().toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}`;
}
async function loadQueue() {
  if (!activeCommish || loadingQueue) return;
  loadingQueue = true; queueStatus.textContent = 'Checking coffee orders…';
  try {
    const data = await request('coffee-orders');
    if (!activeCommish) return;
    queueData = data;
    const previous = initialEvent || filter.value; initialEvent = null;
    filter.innerHTML = '<option value="">All upcoming games</option>' + data.events.map(event => `<option value="${esc(event.id)}">${esc(event.title)} · ${esc(event.date)}</option>`).join('');
    filter.value = data.events.some(event => event.id === previous) ? previous : '';
    renderQueue();
  } catch (error) {
    queueStatus.textContent = error.message + ' Refresh orders to retry.';
    queue.replaceChildren();
  } finally { loadingQueue = false; }
}
form.addEventListener('change', milkChoice);
form.addEventListener('submit', event => {event.preventDefault(); saveOrder('save');});
cancel.addEventListener('click', () => saveOrder('cancel'));
dialog.addEventListener('cancel', event => {if (saving) event.preventDefault();});
dialog.querySelector('form[method="dialog"]').addEventListener('submit', event => {if (saving) event.preventDefault();});
dialog.addEventListener('close', () => {context = null; pending = null;});
filter.addEventListener('change', renderQueue);
$('#coffee-refresh').addEventListener('click', loadQueue);
document.addEventListener('click', event => {
  const button = event.target.closest('[data-coffee-event]');
  if (button && !button.disabled) openOrder(button);
});
document.addEventListener('tlpt-player-change', ({detail}) => {
  selected = detail;
  if (context && (detail.commishEntry || detail.preview || detail.slug !== context.slug) && !saving) dialog.close();
});
document.addEventListener('tlpt-activity-change', ({detail}) => {
  activeCommish = detail.commish && !detail.preview && detail.activity === 'coffee';
  if (activeCommish) loadQueue();
});
activeCommish = $('#tab-coffee')?.getAttribute('aria-selected') === 'true';
if (activeCommish) loadQueue();
