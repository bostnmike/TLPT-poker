export const coffeeDrinks = {coffee: 'Coffee', latte: 'Latte', cappuccino: 'Cappuccino', macchiato: 'Macchiato'};
export const coffeeCaffeine = {decaf: 'DeCaf', 'high-octane': 'Regular'};

export function coffeeDescription(order) {
  const parts = [order.temperature === 'iced' ? 'Iced' : 'Hot', coffeeDrinks[order.drink], coffeeCaffeine[order.caffeine || 'high-octane']];
  if (order.drink === 'coffee') parts.push(order.milk ? 'Milk' : 'Black');
  if (order.stevia) parts.push('Stevia in the Raw');
  if (order.extraShot) parts.push('+1 espresso shot');
  return parts.join(' · ');
}
