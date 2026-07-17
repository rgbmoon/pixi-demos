/** Форматирует денежную сумму для HUD: разряды через запятую, два знака после точки. */
export const formatAmount = (value: number): string =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
