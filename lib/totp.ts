import * as OTPAuth from 'otpauth'

// Generate a secret for TOTP (you should store this securely)
const SECRET = process.env.NEXT_PUBLIC_GOD_MODE_SECRET || 'JBSWY3DPEHPK3PXP'

// Create TOTP instance
export const totp = new OTPAuth.TOTP({
  issuer: 'ShellHack 2024',
  label: 'God Mode',
  algorithm: 'SHA1',
  digits: 6,
  period: 30,
  secret: SECRET
})

// Generate QR Code URL for scanning
export const getQRCodeURL = () => {
  return totp.toString()
}

// Verify a TOTP code
export const verifyTOTP = (token: string): boolean => {
  try {
    // Allow 1 step tolerance for time drift
    const delta = totp.validate({ token, window: 1 })
    return delta !== null
  } catch (error) {
    return false
  }
}

// Get current TOTP code (for testing)
export const getCurrentCode = () => {
  return totp.generate()
}