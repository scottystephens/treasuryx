import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

/**
 * Register a bunq OAuth client with the correct redirect URI
 * 
 * This script helps you register an OAuth client directly with bunq's API
 * if you can't do it through the mobile app.
 * 
 * PREREQUISITES:
 * 1. You need a valid bunq API session token
 * 2. You need your bunq user ID
 * 
 * Reference: https://doc.bunq.com/basics/authentication/oauth/register-oauth-client
 */

const BUNQ_API_BASE = process.env.BUNQ_ENVIRONMENT === 'production' 
  ? 'https://api.bunq.com'
  : 'https://public-api.sandbox.bunq.com';

const REDIRECT_URI = 'https://stratifi-pi.vercel.app/api/connections/bunq/callback';

async function registerOAuthClient() {
  console.log('🔧 Bunq OAuth Client Registration');
  console.log('════════════════════════════════════════\n');
  
  console.log('⚠️  This script requires a valid bunq API session token.');
  console.log('📖 Follow these steps:\n');
  
  console.log('1. Get your bunq API key from the mobile app:');
  console.log('   Profile → Settings → Security → Developers → API Keys → Create New Key\n');
  
  console.log('2. Create an Installation and Session using the API key');
  console.log('   (This is complex - see bunq API docs)\n');
  
  console.log('3. Once you have a session token and user_id, use this curl command:\n');
  
  console.log('```bash');
  console.log(`curl -X POST ${BUNQ_API_BASE}/v1/user/{user_id}/oauth-client \\`);
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -H "X-Bunq-Client-Authentication: YOUR_SESSION_TOKEN" \\');
  console.log('  -d \'{');
  console.log('    "status": "ACTIVE",');
  console.log('    "display_name": "Stratifi Banking Integration",');
  console.log(`    "redirect_url": "${REDIRECT_URI}"`);
  console.log('  }\'');
  console.log('```\n');
  
  console.log('Replace:');
  console.log('  - {user_id} with your bunq user ID');
  console.log('  - YOUR_SESSION_TOKEN with your session token\n');
  
  console.log('4. The response will include your client_id and client_secret\n');
  
  console.log('═════════════════════════════════════════════════════════════\n');
  console.log('💡 EASIER METHOD: Use the bunq mobile app!');
  console.log('   Profile → Settings → Security → Developers → OAuth Clients');
  console.log('═════════════════════════════════════════════════════════════\n');
  
  console.log(`✅ Target redirect URI: ${REDIRECT_URI}`);
}

registerOAuthClient();

