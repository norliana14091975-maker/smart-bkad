import crypto from 'crypto'

/** Hash password dengan scrypt: "salt:hash" (hex, keylen 64). */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}
