import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 24 * 60 * 60 * 1000,
      refetchOnWindowFocus: true,
      retry: 1,
    }
  }
})

export async function invalidateQueryFamilies(queryKeys) {
  await Promise.all(
    queryKeys.map(queryKey =>
      queryClient.invalidateQueries({ queryKey, refetchType: 'all' })
    )
  )
}
