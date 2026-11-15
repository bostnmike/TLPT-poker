export const coffeeDrinks = {coffee: 'Coffee', latte: 'Latte', cappuccino: 'Cappuccino', macchiato: 'Macchiato'};
export const coffeeCaffeine = {decaf: 'DeCaf', 'high-octane': 'Regular'};
export const steviaPacketCount = order => order?.steviaPackets ?? (order?.stevia ? 1 : 0);
export const espressoShotCount = order => order?.extraShots ?? (order?.extraShot ? 1 : 0);

export function coffeeDescription(order) {
  const parts = [order.temperature === 'iced' ? 'Iced' : 'Hot', coffeeDrinks[order.drink], coffeeCaffeine[order.caffeine || 'high-octane']];
  if (order.milk) parts.push('Oat Milk');
  else if (order.drink === 'coffee') parts.push('Black');
  const packets = steviaPacketCount(order);
  if (packets) parts.push(`Stevia in the Raw: ${packets} ${packets === 1 ? 'packet' : 'packets'}`);
  const shots = espressoShotCount(order);
  if (shots) parts.push(`+${shots} espresso ${shots === 1 ? 'shot' : 'shots'}`);
  return parts.join(' · ');
}
