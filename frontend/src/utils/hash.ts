export const hashPassword = async (password: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
  const hashArray = Array.from(new Uint8Array(digest))
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export const utcToLocalDate = (utcDate: string | null | undefined, useUTCDate = false) => {
  if (!utcDate) return ''
  const utcDateString = `${utcDate} UTC`
  if (useUTCDate) return utcDateString
  try {
    const date = new Date(utcDateString)
    if (Number.isNaN(date.getTime())) return utcDateString
    return date.toLocaleString()
  } catch (error) {
    console.error(error)
  }
  return utcDateString
}

export const copyText = async (value: string) => {
  await navigator.clipboard.writeText(value)
}
