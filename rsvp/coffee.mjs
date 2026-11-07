import {liveEvent, publicPlayer, publicCoffeeOrder} from './model.mjs';

export function coffeeQueue(state, now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
  const events = state.events.filter(event =>
    liveEvent(event) && event.metadata.date !== 'Date TBD' && event.metadata.date >= today
  ).sort((a, b) => a.metadata.date.localeCompare(b.metadata.date));
  const players = new Map(state.players.map(player => [player.slug, publicPlayer(player).name]));
  const orders = events.flatMap(event =>
    Object.entries(event.coffeeOrders || {})
      .filter(([slug]) => players.has(slug))
      .flatMap(([slug, orders]) => Object.entries(orders).map(([orderId, order]) => ({eventId: event.id, slug, orderId, name: players.get(slug), ...publicCoffeeOrder(order)})))
  );
  orders.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name));
  return {
    events: events.map(event => ({id: event.id, title: event.metadata.title, date: event.metadata.date, open: event.open})),
    orders
  };
}
