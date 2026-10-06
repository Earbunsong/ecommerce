import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await api.health.$get()
      if (!res.ok) throw new Error(`Health check failed: ${res.status}`)
      return res.json()
    },
  })
}
