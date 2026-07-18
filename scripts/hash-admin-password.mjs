import { randomBytes, scrypt as scryptCallback } from 'crypto'
import { promisify } from 'util'

const password = process.argv[2]
if (!password || password.length < 12) {
  console.error('用法: node scripts/hash-admin-password.mjs "至少12位的新密码"')
  process.exit(1)
}

const scrypt = promisify(scryptCallback)
const salt = randomBytes(16).toString('base64url')
const derived = await scrypt(password.normalize('NFKC'), salt, 64)
console.log(`scrypt:${salt}:${derived.toString('base64url')}`)
