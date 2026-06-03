const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');

const m = env.match(/^(SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SERVICE_KEY|SERVICE_ROLE_KEY)=(.*)$/m);

if (!m) {
  console.log('NO SERVICE KEY FOUND');
  process.exit(0);
}

const keyName = m[1];
const value = m[2].trim().replace(/^['"]|['"]$/g, '');

console.log('KEY NAME:', keyName);
console.log('PREFIX:', value.slice(0, 12));
console.log('LENGTH:', value.length);

if (value.startsWith('eyJ')) {
  console.log('TYPE: legacy JWT service_role/anon style');
} else if (value.startsWith('sb_secret_')) {
  console.log('TYPE: new Supabase secret key style');
} else if (value.startsWith('sb_publishable_')) {
  console.log('TYPE: publishable key - KHÔNG dùng cho migration');
} else {
  console.log('TYPE: unknown - có thể bạn copy nhầm key');
}
