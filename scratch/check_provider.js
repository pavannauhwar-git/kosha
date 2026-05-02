import { supabase } from '../src/lib/supabase'

async function checkUserProvider() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.log('No user logged in')
    return
  }
  console.log('Provider:', user.app_metadata.provider)
  console.log('Identities:', user.identities?.map(i => i.provider))
}

checkUserProvider()
