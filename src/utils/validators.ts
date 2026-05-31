export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/
  return phoneRegex.test(phone.replace(/\s/g, ''))
}

export const validatePassword = (password: string): boolean => {
  return password.length >= 6
}

export const validateName = (name: string): boolean => {
  return name.trim().length >= 2 && name.trim().length <= 100
}

export const validateBirthDate = (date: string): boolean => {
  const birthDate = new Date(date)
  const today = new Date()
  const age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    return age - 1 >= 13
  }
  return age >= 13
}