// One rule for "has this homework week opened yet?", shared by the Homework
// list, Find, Today and the week page itself. Dates are YYYY-MM-DD; `today`
// must be the Vienna date (viennaDate()), not a device-local or UTC one.
export function isHomeworkReleased(week: { availableFrom?: string }, today: string): boolean {
  return !week.availableFrom || week.availableFrom <= today;
}
