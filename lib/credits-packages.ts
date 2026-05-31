export interface CreditPackage {
  id:          'small' | 'medium' | 'large'
  credits:     number
  priceUsd:    number
  label:       string
  description: string
  priceId:     string
  popular?:    boolean
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id:          'small',
    credits:     100,
    priceUsd:    5,
    label:       '100 credits',
    description: 'Good for a few campaigns or Maya sessions',
    priceId:     process.env.STRIPE_CREDITS_SMALL_PRICE_ID!,
  },
  {
    id:          'medium',
    credits:     350,
    priceUsd:    15,
    label:       '350 credits',
    description: 'Same as a monthly Growth allocation',
    priceId:     process.env.STRIPE_CREDITS_MEDIUM_PRICE_ID!,
    popular:     true,
  },
  {
    id:          'large',
    credits:     1000,
    priceUsd:    40,
    label:       '1,000 credits',
    description: 'Same as a monthly ProAgent allocation',
    priceId:     process.env.STRIPE_CREDITS_LARGE_PRICE_ID!,
  },
]

export const CREDIT_VALUE_USD = 0.04
