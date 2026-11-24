const adjectives = [
  'amber', 'brisk', 'calm', 'clear', 'cool', 'crisp', 'fair', 'fast',
  'glad', 'gold', 'green', 'happy', 'kind', 'light', 'lucky', 'mild',
  'neat', 'nova', 'plain', 'quick', 'quiet', 'rapid', 'rosy', 'shiny',
  'silver', 'slim', 'soft', 'sunny', 'swift', 'tidy', 'warm', 'wild',
]

const nouns = [
  'apple', 'birch', 'brook', 'cedar', 'cloud', 'coral', 'creek', 'daisy',
  'ember', 'fern', 'field', 'flint', 'frost', 'hazel', 'heron', 'honey',
  'lake', 'maple', 'meadow', 'mist', 'moss', 'otter', 'pebble', 'pine',
  'pond', 'quartz', 'raven', 'river', 'robin', 'stone', 'storm', 'willow',
]

const suffix = 'abcdefghjkmnpqrstuvwxyz23456789'

const pick = <T>(items: readonly T[]): T => {
  const index = crypto.getRandomValues(new Uint8Array(1))[0] % items.length
  return items[index]
}

export const readableName = () => {
  const tail = `${pick(suffix.split(''))}${pick(suffix.split(''))}`
  return `${pick(adjectives)}-${pick(nouns)}-${tail}`
}
