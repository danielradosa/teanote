import supabase from '@/utils/supa'

export function subscribeTable<T>(
  table: string,
  userId: string,
  onUpdate: (payload: T) => void
) {
  const channel = supabase.channel(`realtime-${table}-${userId}`)
    .on(
      'postgres_changes' as never,
      { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
      (payload: { new: T }) => {
        onUpdate(payload.new)
      }
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}
