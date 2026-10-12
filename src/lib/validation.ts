import type { PropertyData } from '../types'

export type PropertyErrors = Partial<Record<keyof PropertyData, string>>

const NUMBER = /^\d+(\.\d+)?$/

/**
 * Client-side checks that mirror the backend: title and location are required.
 * Bedrooms and bathrooms must be numbers when filled in.
 */
export function validateProperty(p: PropertyData): PropertyErrors {
  const errors: PropertyErrors = {}
  if (!p.title.trim()) errors.title = 'Enter a listing title'
  if (!p.location.trim()) errors.location = 'Enter the suburb and state'
  if (p.bedrooms.trim() && !NUMBER.test(p.bedrooms.trim())) {
    errors.bedrooms = 'Use a number, like 3'
  }
  if (p.bathrooms.trim() && !NUMBER.test(p.bathrooms.trim())) {
    errors.bathrooms = 'Use a number, like 2 or 2.5'
  }
  return errors
}

export const isPropertyValid = (p: PropertyData) =>
  Object.keys(validateProperty(p)).length === 0
