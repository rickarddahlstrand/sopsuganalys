export const MANAD_NAMN = {
  1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr',
  5: 'Maj', 6: 'Jun', 7: 'Jul', 8: 'Aug',
  9: 'Sep', 10: 'Okt', 11: 'Nov', 12: 'Dec',
}

export const MANAD_ORDNING = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

export function monthName(num) {
  return MANAD_NAMN[num] || String(num)
}

export function sortByMonth(arr, key = 'monthNum') {
  return [...arr].sort((a, b) => a[key] - b[key])
}

export function sortBySortKey(arr, key = 'sortKey') {
  return [...arr].sort((a, b) => a[key] - b[key])
}
