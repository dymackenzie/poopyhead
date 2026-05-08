const AI_NAMES = [
  'Caleb', 'Marco', 'Matthew', 'Connor', 'Evan',
  'Curtis', 'Boen', 'Ben', 'Zach', 'Shane',
  'Nathan', 'Ethan', 'Josh', 'Sam', 'Jeremy',
];

export function pickAIName(usedNames: string[] = []): string {
  const available = AI_NAMES.filter(n => !usedNames.includes(n));
  const pool = available.length > 0 ? available : AI_NAMES;
  return pool[Math.floor(Math.random() * pool.length)];
}
