import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const code = fs.readFileSync('src/lib/supabase.js', 'utf8')
const urlMatch = code.match(/supabaseUrl\s*=\s*['"]([^'"]+)['"]/)
const keyMatch = code.match(/supabaseAnonKey\s*=\s*['"]([^'"]+)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  async function test() {
    console.log('Testing notifications...')
    const { data: notifs, error: notifErr } = await supabase.from('notifications').select('*').limit(1)
    console.log('Notifications Result:', notifs, notifErr)
    
    // Check if we can insert a fake one just to test RLS
    // Actually we need a user ID for that, which we don't have here since we are anon.
    // If it says "Empty" or "RLS error", we know.
  }
  test()
} else {
  console.log('Could not parse supabase.js')
}
