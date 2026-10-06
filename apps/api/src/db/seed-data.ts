// Demo data for `pnpm db:seed` (development only). Prices are integer cents.

export const demoUsers = {
  admin: {
    email: 'admin@shopkh.test',
    password: 'Admin123!',
    fullName: 'Shop Admin',
    phone: '012000000',
  },
  customers: [
    {
      email: 'dara@shopkh.test',
      password: 'Customer123!',
      fullName: 'Sok Dara',
      phone: '012345678',
    },
    {
      email: 'sophea@shopkh.test',
      password: 'Customer123!',
      fullName: 'Chan Sophea',
      phone: '098765432',
    },
  ],
} as const

export type SeedCategory = {
  slug: string
  name: string
  parent?: string
  isActive?: boolean
  sortOrder: number
}

// 5 categories: 3 parents, 1 sub-category (T-shirts), 1 inactive (Seasonal)
export const seedCategories: SeedCategory[] = [
  { slug: 'clothing', name: 'Clothing', sortOrder: 1 },
  { slug: 't-shirts', name: 'T-shirts', parent: 'clothing', sortOrder: 1 },
  { slug: 'electronics', name: 'Electronics', sortOrder: 2 },
  { slug: 'home-kitchen', name: 'Home & Kitchen', sortOrder: 3 },
  { slug: 'seasonal', name: 'Seasonal', isActive: false, sortOrder: 4 },
]

export type SeedProduct = {
  slug: string
  name: string
  category: string
  priceCents: number
  stock: number
  isActive?: boolean
  color: string
}

// 30 products: 1 inactive, 1 out of stock, 2 low stock (<= 5)
export const seedProducts: SeedProduct[] = [
  {
    slug: 'classic-white-tee',
    name: 'Classic White Tee',
    category: 't-shirts',
    priceCents: 850,
    stock: 40,
    color: '#e5e7eb',
  },
  {
    slug: 'angkor-graphic-tee',
    name: 'Angkor Graphic Tee',
    category: 't-shirts',
    priceCents: 1200,
    stock: 25,
    color: '#f59e0b',
  },
  {
    slug: 'black-crew-neck-tee',
    name: 'Black Crew Neck Tee',
    category: 't-shirts',
    priceCents: 900,
    stock: 3,
    color: '#1f2937',
  },
  {
    slug: 'striped-pocket-tee',
    name: 'Striped Pocket Tee',
    category: 't-shirts',
    priceCents: 1100,
    stock: 18,
    color: '#3b82f6',
  },
  {
    slug: 'kids-elephant-tee',
    name: 'Kids Elephant Tee',
    category: 't-shirts',
    priceCents: 700,
    stock: 30,
    color: '#a78bfa',
  },
  {
    slug: 'oversized-linen-tee',
    name: 'Oversized Linen Tee',
    category: 't-shirts',
    priceCents: 1500,
    stock: 12,
    color: '#d6d3d1',
  },
  {
    slug: 'krama-scarf',
    name: 'Krama Scarf',
    category: 'clothing',
    priceCents: 600,
    stock: 50,
    color: '#dc2626',
  },
  {
    slug: 'denim-jacket',
    name: 'Denim Jacket',
    category: 'clothing',
    priceCents: 3500,
    stock: 8,
    color: '#1e40af',
  },
  {
    slug: 'cotton-shorts',
    name: 'Cotton Shorts',
    category: 'clothing',
    priceCents: 1300,
    stock: 22,
    color: '#65a30d',
  },
  {
    slug: 'rain-poncho',
    name: 'Rain Poncho',
    category: 'clothing',
    priceCents: 450,
    stock: 0,
    color: '#0891b2',
  },
  {
    slug: 'wireless-earbuds',
    name: 'Wireless Earbuds',
    category: 'electronics',
    priceCents: 2900,
    stock: 15,
    color: '#111827',
  },
  {
    slug: 'usb-c-charger-20w',
    name: 'USB-C Charger 20W',
    category: 'electronics',
    priceCents: 1200,
    stock: 35,
    color: '#f3f4f6',
  },
  {
    slug: 'power-bank-10000',
    name: 'Power Bank 10000mAh',
    category: 'electronics',
    priceCents: 1800,
    stock: 20,
    color: '#4b5563',
  },
  {
    slug: 'bluetooth-speaker',
    name: 'Bluetooth Speaker',
    category: 'electronics',
    priceCents: 3200,
    stock: 5,
    color: '#be123c',
  },
  {
    slug: 'phone-stand',
    name: 'Aluminium Phone Stand',
    category: 'electronics',
    priceCents: 800,
    stock: 45,
    color: '#9ca3af',
  },
  {
    slug: 'usb-c-cable-1m',
    name: 'USB-C Cable 1m',
    category: 'electronics',
    priceCents: 350,
    stock: 100,
    color: '#e5e7eb',
  },
  {
    slug: 'smart-watch-lite',
    name: 'Smart Watch Lite',
    category: 'electronics',
    priceCents: 4500,
    stock: 10,
    color: '#0f172a',
  },
  {
    slug: 'wireless-mouse',
    name: 'Wireless Mouse',
    category: 'electronics',
    priceCents: 1000,
    stock: 28,
    color: '#334155',
  },
  {
    slug: 'led-desk-lamp',
    name: 'LED Desk Lamp',
    category: 'electronics',
    priceCents: 1600,
    stock: 14,
    color: '#fde68a',
  },
  {
    slug: 'rice-cooker-1-8l',
    name: 'Rice Cooker 1.8L',
    category: 'home-kitchen',
    priceCents: 3800,
    stock: 9,
    color: '#f8fafc',
  },
  {
    slug: 'stainless-wok',
    name: 'Stainless Steel Wok',
    category: 'home-kitchen',
    priceCents: 2200,
    stock: 16,
    color: '#94a3b8',
  },
  {
    slug: 'bamboo-cutting-board',
    name: 'Bamboo Cutting Board',
    category: 'home-kitchen',
    priceCents: 950,
    stock: 27,
    color: '#ca8a04',
  },
  {
    slug: 'insulated-water-bottle',
    name: 'Insulated Water Bottle',
    category: 'home-kitchen',
    priceCents: 1400,
    stock: 33,
    color: '#0d9488',
  },
  {
    slug: 'kampot-pepper-jar',
    name: 'Kampot Pepper Jar',
    category: 'home-kitchen',
    priceCents: 750,
    stock: 60,
    color: '#292524',
  },
  {
    slug: 'ceramic-mug-set',
    name: 'Ceramic Mug Set',
    category: 'home-kitchen',
    priceCents: 1700,
    stock: 11,
    color: '#fb7185',
  },
  {
    slug: 'woven-storage-basket',
    name: 'Woven Storage Basket',
    category: 'home-kitchen',
    priceCents: 1250,
    stock: 19,
    color: '#a16207',
  },
  {
    slug: 'mosquito-net',
    name: 'Mosquito Net',
    category: 'home-kitchen',
    priceCents: 1050,
    stock: 24,
    color: '#ecfccb',
  },
  {
    slug: 'old-model-fan',
    name: 'Desk Fan (Old Model)',
    category: 'home-kitchen',
    priceCents: 1900,
    stock: 7,
    isActive: false,
    color: '#64748b',
  },
  {
    slug: 'khmer-new-year-lantern',
    name: 'Khmer New Year Lantern',
    category: 'seasonal',
    priceCents: 500,
    stock: 40,
    color: '#f97316',
  },
  {
    slug: 'water-festival-flag',
    name: 'Water Festival Flag',
    category: 'seasonal',
    priceCents: 300,
    stock: 55,
    color: '#2563eb',
  },
]

/** Simple placeholder image: product name on a coloured background. */
export function placeholderSvg(name: string, color: string): string {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  const text = luminance < 0.6 ? '#ffffff' : '#111827'
  const label = name.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <rect width="800" height="800" fill="${color}"/>
  <text x="400" y="400" font-family="system-ui, sans-serif" font-size="44" font-weight="600" fill="${text}" text-anchor="middle" dominant-baseline="middle">${label}</text>
  <text x="400" y="760" font-family="system-ui, sans-serif" font-size="24" fill="${text}" opacity="0.6" text-anchor="middle">ShopKH demo</text>
</svg>
`
}
