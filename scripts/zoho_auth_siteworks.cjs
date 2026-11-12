/**
 * 624 Siteworks Zoho OAuth Token Generator for hello@624siteworks.com
 *
 * Usage:
 *   node scripts/zoho_auth_siteworks.js <AUTH_CODE>
 *
 * Steps to get AUTH_CODE:
 * 1. Log in to https://api-console.zoho.com while signed into hello@624siteworks.com
 * 2. Select Self Client (Client ID: 1000.3GVCAWDZLVTUEG6MSQFV33B7I0XY2P or create a new Self Client)
 * 3. Scope: ZohoMail.messages.ALL,ZohoMail.accounts.READ
 * 4. Duration: 10 minutes, Scope Description: 624 Siteworks Outreach
 * 5. Click "Generate Code" and pass it to this script.
 */

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const env = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const idx = trimmed.indexOf('=');
  if (idx !== -1) {
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
});

const clientId = env.ZOHO_CLIENT_ID || '1000.3GVCAWDZLVTUEG6MSQFV33B7I0XY2P';
const clientSecret = env.ZOHO_CLIENT_SECRET || '7a8a84edc5a4c8a888126f2b31979594da544a87fb';
const authCode = process.argv[2];

if (!authCode) {
  console.log('\n❌ Missing Auth Code!');
  console.log('Usage: node scripts/zoho_auth_siteworks.js <AUTH_CODE>\n');
  console.log('How to get your 10-minute Auth Code:');
  console.log('1. Open https://api-console.zoho.com (while signed into hello@624siteworks.com)');
  console.log('2. Click Self Client (or create one) -> Client ID: ' + clientId);
  console.log('3. Enter Scopes: ZohoMail.messages.ALL,ZohoMail.accounts.READ');
  console.log('4. Click "Generate Code"');
  console.log('5. Run: node scripts/zoho_auth_siteworks.js <PASTE_CODE_HERE>\n');
  process.exit(1);
}

async function exchangeToken() {
  console.log('\n🔄 Exchanging Auth Code with Zoho OAuth API...');
  const tokenUrl = 'https://accounts.zoho.com/oauth/v2/token';
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: authCode.trim(),
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      redirect_uri: 'http://localhost'
    })
  });

  const data = await res.json();
  if (data.error || !data.access_token) {
    console.error('❌ Token Exchange Error:', data);
    process.exit(1);
  }

  const refreshToken = data.refresh_token;
  const accessToken = data.access_token;
  console.log('✔ Access Token & Refresh Token received!');

  // Fetch Account ID
  console.log('🔍 Fetching Zoho Mail Account ID for hello@624siteworks.com...');
  const accRes = await fetch('https://mail.zoho.com/api/accounts', {
    headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
  });
  const accData = await accRes.json();
  const accounts = accData.data || [];
  if (!accounts.length) {
    console.error('❌ No Zoho Mail accounts found for this token:', accData);
    process.exit(1);
  }

  console.log(`✔ Found ${accounts.length} Zoho Mail account(s):`);
  accounts.forEach((acc, i) => {
    console.log(`   [${i+1}] Email: ${acc.primaryEmailAddress || acc.mailboxAddress} | Account ID: ${acc.accountId}`);
  });

  const siteworksAcc = accounts.find(a => 
    (a.primaryEmailAddress && a.primaryEmailAddress.toLowerCase().includes('624siteworks.com')) ||
    (a.mailboxAddress && a.mailboxAddress.toLowerCase().includes('624siteworks.com'))
  ) || accounts[0];

  const targetAccountId = siteworksAcc.accountId;
  const targetEmail = siteworksAcc.primaryEmailAddress || siteworksAcc.mailboxAddress || 'hello@624siteworks.com';
  console.log(`\n🎯 Selected Target Account: ${targetEmail} (ID: ${targetAccountId})`);

  // Update .env
  let newEnv = envContent;
  if (newEnv.includes('ZOHO_REFRESH_TOKEN=')) {
    newEnv = newEnv.replace(/ZOHO_REFRESH_TOKEN\s*=.*/, `ZOHO_REFRESH_TOKEN = ${refreshToken}`);
  } else {
    newEnv += `\nZOHO_REFRESH_TOKEN = ${refreshToken}`;
  }

  if (newEnv.includes('ZOHO_ACCOUNT_ID=')) {
    newEnv = newEnv.replace(/ZOHO_ACCOUNT_ID\s*=.*/, `ZOHO_ACCOUNT_ID = ${targetAccountId}`);
  } else {
    newEnv += `\nZOHO_ACCOUNT_ID = ${targetAccountId}`;
  }

  if (newEnv.includes('ZOHO_FROM_ADDRESS=')) {
    newEnv = newEnv.replace(/ZOHO_FROM_ADDRESS\s*=.*/, `ZOHO_FROM_ADDRESS = ${targetEmail}`);
  } else {
    newEnv += `\nZOHO_FROM_ADDRESS = ${targetEmail}`;
  }

  fs.writeFileSync(envPath, newEnv, 'utf8');
  console.log('✔ Updated F:\\624 SITEWORKS\\My Sites\\624siteworks.com\\.env successfully!');

  // Test creating a draft
  console.log(`\n✉  Testing draft creation in ${targetEmail}'s Drafts folder...`);
  const draftRes = await fetch(`https://mail.zoho.com/api/accounts/${targetAccountId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fromAddress: targetEmail,
      toAddress: targetEmail,
      subject: '[VERIFICATION] Cold Outreach Draft Pipeline Connected',
      content: '<p>Your automated cold outreach pitch drafts will now save directly into this Drafts folder.</p>',
      mode: 'draft'
    })
  });

  const draftData = await draftRes.json();
  if (draftData.status && draftData.status.code === 200) {
    console.log(`🎉 SUCCESS! Verified test draft saved in "${targetEmail}" Drafts folder!`);
  } else {
    console.log('Draft response:', draftData);
  }
}

exchangeToken().catch(console.error);
