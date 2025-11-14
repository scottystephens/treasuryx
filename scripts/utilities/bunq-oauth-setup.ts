import { config } from 'dotenv';
import { resolve } from 'path';
import crypto from 'crypto';
import fetch from 'node-fetch';

config({ path: resolve(process.cwd(), '.env.local') });

const BUNQ_API_BASE = process.env.BUNQ_ENVIRONMENT === 'production' 
  ? 'https://api.bunq.com'
  : 'https://public-api.sandbox.bunq.com';

const REDIRECT_URI = 'https://stratifi-pi.vercel.app/api/connections/bunq/callback';

// You'll need to get this from bunq mobile app:
// Profile → Settings → Security → Developers → API Keys
const API_KEY = process.env.BUNQ_API_KEY || '';

interface BunqResponse<T> {
  Response: Array<{ [key: string]: T }>;
}

/**
 * Step 1: Create Installation
 * This generates a token that allows us to register a device
 */
async function createInstallation() {
  console.log('\n📝 Step 1: Creating Installation...');
  
  // Generate RSA key pair
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  // Send installation request
  const response = await fetch(`${BUNQ_API_BASE}/v1/installation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Stratifi/1.0.0',
      'X-Bunq-Language': 'en_US',
      'X-Bunq-Region': 'en_US',
      'X-Bunq-Geolocation': '0 0 0 0 NL',
    },
    body: JSON.stringify({
      client_public_key: publicKey
    })
  });

  if (!response.ok) {
    throw new Error(`Installation failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json() as BunqResponse<any>;
  const installationToken = data.Response[1]?.Token?.token;
  const serverPublicKey = data.Response[2]?.ServerPublicKey?.server_public_key;

  console.log('✅ Installation created');
  console.log(`   Token: ${installationToken.substring(0, 20)}...`);

  return { installationToken, privateKey, serverPublicKey };
}

/**
 * Step 2: Register Device
 */
async function registerDevice(installationToken: string, apiKey: string) {
  console.log('\n📱 Step 2: Registering Device...');

  const response = await fetch(`${BUNQ_API_BASE}/v1/device-server`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Stratifi/1.0.0',
      'X-Bunq-Language': 'en_US',
      'X-Bunq-Region': 'en_US',
      'X-Bunq-Geolocation': '0 0 0 0 NL',
      'X-Bunq-Client-Authentication': installationToken,
    },
    body: JSON.stringify({
      description: 'Stratifi Banking Integration',
      secret: apiKey,
      permitted_ips: ['*']
    })
  });

  if (!response.ok) {
    throw new Error(`Device registration failed: ${response.status} ${await response.text()}`);
  }

  console.log('✅ Device registered');
}

/**
 * Sign a request body
 */
function signRequest(body: string, privateKey: string): string {
  const sign = crypto.createSign('SHA256');
  sign.update(body);
  sign.end();
  return sign.sign(privateKey, 'base64');
}

/**
 * Step 3: Create Session
 */
async function createSession(installationToken: string, apiKey: string, privateKey: string) {
  console.log('\n🔐 Step 3: Creating Session...');

  const requestBody = JSON.stringify({
    secret: apiKey
  });

  const signature = signRequest(requestBody, privateKey);

  const response = await fetch(`${BUNQ_API_BASE}/v1/session-server`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Stratifi/1.0.0',
      'X-Bunq-Language': 'en_US',
      'X-Bunq-Region': 'en_US',
      'X-Bunq-Geolocation': '0 0 0 0 NL',
      'X-Bunq-Client-Authentication': installationToken,
      'X-Bunq-Client-Signature': signature,
    },
    body: requestBody
  });

  if (!response.ok) {
    throw new Error(`Session creation failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json() as BunqResponse<any>;
  const sessionToken = data.Response[1]?.Token?.token;
  const userId = data.Response[2]?.UserPerson?.id || data.Response[2]?.UserCompany?.id;

  console.log('✅ Session created');
  console.log(`   User ID: ${userId}`);
  console.log(`   Session Token: ${sessionToken.substring(0, 20)}...`);

  return { sessionToken, userId };
}

/**
 * Step 4: Register OAuth Client
 */
async function registerOAuthClient(sessionToken: string, userId: number, privateKey: string) {
  console.log('\n🔧 Step 4: Registering OAuth Client...');

  const requestBody = JSON.stringify({
    status: 'ACTIVE',
    display_name: 'Stratifi Banking Integration',
    redirect_url: REDIRECT_URI
  });

  const signature = signRequest(requestBody, privateKey);

  const response = await fetch(`${BUNQ_API_BASE}/v1/user/${userId}/oauth-client`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Stratifi/1.0.0',
      'X-Bunq-Language': 'en_US',
      'X-Bunq-Region': 'en_US',
      'X-Bunq-Geolocation': '0 0 0 0 NL',
      'X-Bunq-Client-Authentication': sessionToken,
      'X-Bunq-Client-Signature': signature,
    },
    body: requestBody
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OAuth client registration failed: ${response.status} ${errorText}`);
  }

  const data = await response.json() as BunqResponse<any>;
  const oauthClient = data.Response[0]?.OauthClient;

  console.log('✅ OAuth Client registered!');
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📋 IMPORTANT: Save these credentials!');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Client ID:     ${oauthClient.client_id}`);
  console.log(`Client Secret: ${oauthClient.client_secret}`);
  console.log(`Redirect URI:  ${REDIRECT_URI}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  return oauthClient;
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Bunq OAuth Client Registration via API');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Environment: ${process.env.BUNQ_ENVIRONMENT || 'sandbox'}`);
  console.log(`API Base:    ${BUNQ_API_BASE}`);
  console.log(`Redirect:    ${REDIRECT_URI}`);
  console.log('═══════════════════════════════════════════════════════════');

  // Check if API key is provided
  if (!API_KEY) {
    console.log('\n❌ ERROR: BUNQ_API_KEY not found in environment variables');
    console.log('\n📱 To get your API key:');
    console.log('1. Open bunq mobile app');
    console.log('2. Profile → Settings → Security → Developers → API Keys');
    console.log('3. Create a new API key');
    console.log('4. Add to .env.local: BUNQ_API_KEY=your_api_key_here');
    console.log('\n⚠️  IMPORTANT: Keep your API key secure!');
    process.exit(1);
  }

  try {
    // Step 1: Installation
    const { installationToken, privateKey } = await createInstallation();

    // Step 2: Device registration
    await registerDevice(installationToken, API_KEY);

    // Step 3: Session creation
    const { sessionToken, userId } = await createSession(installationToken, API_KEY, privateKey);

    // Step 4: OAuth client registration
    const oauthClient = await registerOAuthClient(sessionToken, userId, privateKey);

    console.log('\n✅ SUCCESS! OAuth client registered.');
    console.log('\n📝 Next steps:');
    console.log('1. Update these environment variables in Vercel:');
    console.log(`   BUNQ_CLIENT_ID=${oauthClient.client_id}`);
    console.log(`   BUNQ_CLIENT_SECRET=${oauthClient.client_secret}`);
    console.log(`   BUNQ_REDIRECT_URI=${REDIRECT_URI}`);
    console.log('\n2. Redeploy your app');
    console.log('\n3. Test the connection at:');
    console.log('   https://stratifi-pi.vercel.app/connections/new');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();

