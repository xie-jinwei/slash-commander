export function removeList<T>(original: T[], remove: T[]): T[] {
  const removedList = original.filter(elem => {
    return remove.indexOf(elem) < 0
  })
  return removedList
}
