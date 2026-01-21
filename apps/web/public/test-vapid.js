// TESTE SIMPLES - Cole linha por linha no console

// Linha 1:
const key = 'BC3-DbQMB_JBg1w9Ea-7E0orSo4AfdCfKo8Qezpr4RyAKP6xxxK2iQsU8nUUvELVlK9ASfrDZ0agpQP47EwUK6LE'

// Linha 2:
console.log('Tamanho da chave:', key.length)

// Linha 3:
const padding = '='.repeat((4 - key.length % 4) % 4)

// Linha 4:
const base64 = (key + padding).replace(/-/g, '+').replace(/_/g, '/')

// Linha 5:
const rawData = window.atob(base64)

// Linha 6:
console.log('Conversão OK! Tamanho:', rawData.length)

// Linha 7:
console.log('✅ A chave está no formato válido!')
