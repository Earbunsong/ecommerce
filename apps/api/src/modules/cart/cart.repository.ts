import { type Db, db } from '../../db/client.js'
import { carts } from '../../db/schema.js'

export const cartRepository = {
  /** Every customer gets one empty cart at registration (ERD §3). */
  async createForUser(userId: string, tx: Db = db) {
    const [cart] = await tx.insert(carts).values({ userId }).returning()
    return cart!
  },
}
