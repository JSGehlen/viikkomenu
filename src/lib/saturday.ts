function fold(value: string): string {
  return value
    .toLocaleLowerCase("fi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function saturdayMatches(title: string, wish: string): boolean {
  const foldedWish = fold(wish.trim());
  const foldedTitle = fold(title);
  if (foldedWish.length < 3 || !foldedTitle) return false;
  return foldedWish === foldedTitle || foldedTitle.includes(foldedWish) || foldedWish.includes(foldedTitle);
}
