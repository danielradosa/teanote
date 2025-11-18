import supabase from '../utils/supa'

export function subscribeTable<T>(
  table: string,
  userId: string,
  onUpdate: (payload: T) => void
) {
  const channel = supabase.channel(`realtime-${table}-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (payload: any) => {
        onUpdate(payload.new)
      }
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}