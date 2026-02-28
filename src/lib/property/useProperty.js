import { useContext } from 'react'
import { PropertyContext } from './propertyContext.js'

export function useProperty() {
  const ctx = useContext(PropertyContext)
  if (!ctx) throw new Error('useProperty must be used within PropertyProvider')
  return ctx
}
