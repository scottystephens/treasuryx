# Stratifi Deployment Guide

## 🚀 Quick Start (Local Development)

The application is already running! Open your browser to:

**http://localhost:3000**

If it's not running, start it with:
```bash
cd /Users/scottstephens/stratifi
npm run dev
```

## 📋 Available Pages

1. **Dashboard**: http://localhost:3000/dashboard
2. **Cash Management**: http://localhost:3000/cash
3. **Entity Management**: http://localhost:3000/entities
4. **Payment Management**: http://localhost:3000/payments
5. **Analytics**: http://localhost:3000/analytics

## 🛠️ Development Commands

```bash
# Install dependencies
npm install

# Run development server (with hot reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## 🌐 Deployment Options

### Option 1: Vercel (Recommended - Easiest)

Vercel is the creators of Next.js and offers the best Next.js hosting experience.

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy (from project directory)
cd /Users/scottstephens/stratifi
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - What's your project's name? stratifi
# - In which directory is your code located? ./
# - Override settings? No
```

Your app will be live at: `https://stratifi.vercel.app` (or similar)

**Vercel Benefits:**
- ✅ Zero configuration
- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ Automatic deployments from Git
- ✅ Preview deployments for branches
- ✅ Free tier available

### Option 2: Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Build the app
npm run build

# Deploy
netlify deploy --prod

# Follow prompts to link to your account
```

### Option 3: AWS (More Control)

#### Using AWS Amplify (Easy):
1. Push code to GitHub/GitLab
2. Go to AWS Amplify Console
3. Connect repository
4. Amplify auto-detects Next.js and deploys

#### Using EC2 (Advanced):
```bash
# On your EC2 instance (Ubuntu):
sudo apt update
sudo apt install nodejs npm nginx

# Clone/upload your code
cd /home/ubuntu
# ... upload stratifi folder ...

# Install dependencies
cd stratifi
npm install

# Build
npm run build

# Run with PM2 (process manager)
npm install -g pm2
pm2 start npm --name "stratifi" -- start
pm2 save
pm2 startup

# Configure Nginx as reverse proxy
sudo nano /etc/nginx/sites-available/stratifi
```

Nginx config:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Option 4: Docker

```bash
# Create Dockerfile
cat > Dockerfile << 'EOF'
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
EOF

# Build image
docker build -t stratifi .

# Run container
docker run -p 3000:3000 stratifi
```

Deploy to any cloud:
- **AWS ECS/EKS**
- **Google Cloud Run**
- **Azure Container Instances**
- **DigitalOcean App Platform**

### Option 5: Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize
railway init

# Deploy
railway up
```

## 🔧 Production Configuration

### Environment Variables

Create `.env.local` for local development or add to your hosting platform:

```bash
# Database (when you migrate from CSV)
DATABASE_URL="postgresql://user:password@host:5432/stratifi"

# Authentication (NextAuth.js)
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="your-secret-key-here"

# External APIs
PLAID_CLIENT_ID="your-plaid-client-id"
PLAID_SECRET="your-plaid-secret"

# Bank APIs
JPMORGAN_API_KEY="your-api-key"
CHASE_API_SECRET="your-secret"

# Email notifications
SENDGRID_API_KEY="your-sendgrid-key"

# Monitoring
SENTRY_DSN="your-sentry-dsn"
```

### Performance Optimizations

1. **Enable Caching**:
```typescript
// app/api/accounts/route.ts
export const revalidate = 60 // Cache for 60 seconds
```

2. **Add Redis**:
```bash
npm install redis
```

```typescript
import { createClient } from 'redis'

const redis = createClient({ url: process.env.REDIS_URL })
await redis.connect()

// Cache expensive queries
const cachedData = await redis.get('accounts')
if (cachedData) return JSON.parse(cachedData)
```

3. **Optimize Images**:
```bash
# Next.js automatically optimizes images
# Use the Image component:
import Image from 'next/image'
```

4. **Add Monitoring**:
```bash
npm install @sentry/nextjs
```

## 🗄️ Database Migration (CSV → PostgreSQL)

### 1. Set up PostgreSQL

```bash
# Install PostgreSQL
# macOS:
brew install postgresql
brew services start postgresql

# Ubuntu:
sudo apt install postgresql
sudo systemctl start postgresql
```

### 2. Create Database

```sql
CREATE DATABASE stratifi;

CREATE TABLE entities (
    entity_id VARCHAR(20) PRIMARY KEY,
    entity_name VARCHAR(255),
    legal_name VARCHAR(255),
    country VARCHAR(100),
    tax_id VARCHAR(50),
    entity_type VARCHAR(100),
    parent_entity VARCHAR(20),
    status VARCHAR(50),
    incorporation_date DATE
);

CREATE TABLE accounts (
    account_id VARCHAR(20) PRIMARY KEY,
    account_name VARCHAR(255),
    account_number VARCHAR(50),
    currency VARCHAR(3),
    balance DECIMAL(15,2),
    entity_id VARCHAR(20) REFERENCES entities(entity_id),
    bank_name VARCHAR(255),
    account_type VARCHAR(50),
    status VARCHAR(50)
);

CREATE TABLE transactions (
    transaction_id VARCHAR(20) PRIMARY KEY,
    account_id VARCHAR(20) REFERENCES accounts(account_id),
    date DATE,
    description TEXT,
    amount DECIMAL(15,2),
    currency VARCHAR(3),
    type VARCHAR(20),
    category VARCHAR(50),
    status VARCHAR(50),
    reference VARCHAR(100)
);

CREATE TABLE payments (
    payment_id VARCHAR(20) PRIMARY KEY,
    from_account VARCHAR(20) REFERENCES accounts(account_id),
    to_entity VARCHAR(255),
    amount DECIMAL(15,2),
    currency VARCHAR(3),
    scheduled_date DATE,
    status VARCHAR(50),
    approver VARCHAR(100),
    description TEXT,
    payment_type VARCHAR(50),
    priority VARCHAR(20)
);

CREATE TABLE forecasts (
    forecast_id VARCHAR(20) PRIMARY KEY,
    date DATE,
    predicted_balance DECIMAL(15,2),
    actual_balance DECIMAL(15,2),
    variance DECIMAL(15,2),
    confidence DECIMAL(3,2),
    entity_id VARCHAR(20) REFERENCES entities(entity_id),
    currency VARCHAR(3),
    category VARCHAR(50)
);
```

### 3. Import CSV Data

```bash
# Using psql
psql -U postgres -d stratifi

\copy entities FROM '/Users/scottstephens/stratifi/data/entities.csv' CSV HEADER
\copy accounts FROM '/Users/scottstephens/stratifi/data/accounts.csv' CSV HEADER
\copy transactions FROM '/Users/scottstephens/stratifi/data/transactions.csv' CSV HEADER
\copy payments FROM '/Users/scottstephens/stratifi/data/payments.csv' CSV HEADER
\copy forecasts FROM '/Users/scottstephens/stratifi/data/forecast.csv' CSV HEADER
```

### 4. Update Code to Use Database

```bash
# Install database client
npm install pg
npm install @types/pg --save-dev
```

```typescript
// lib/db.ts
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function query(text: string, params?: any[]) {
  const result = await pool.query(text, params)
  return result.rows
}

// lib/db-parser.ts (replaces csv-parser.ts)
import { query } from './db'

export async function getAccounts() {
  return await query('SELECT * FROM accounts')
}

export async function getEntities() {
  return await query('SELECT * FROM entities')
}

// ... etc
```

## 🔐 Adding Authentication

```bash
npm install next-auth
npm install @next-auth/prisma-adapter @prisma/client
```

Create `app/api/auth/[...nextauth]/route.ts`:

```typescript
import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  // Add more configuration
})

export { handler as GET, handler as POST }
```

Protect pages:

```typescript
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const session = await getServerSession()
  
  if (!session) {
    redirect('/api/auth/signin')
  }
  
  // ... rest of page
}
```

## 📊 Monitoring & Analytics

### Add Error Tracking (Sentry)

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

### Add Analytics (Google Analytics)

```typescript
// app/layout.tsx
import Script from 'next/script'

export default function RootLayout() {
  return (
    <html>
      <head>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
          `}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  )
}
```

## 🔒 Security Checklist

- [ ] Add authentication (NextAuth.js)
- [ ] Add authorization (role-based access)
- [ ] Set up HTTPS (automatic with Vercel)
- [ ] Add rate limiting
- [ ] Sanitize user inputs
- [ ] Add CSRF protection
- [ ] Set security headers
- [ ] Add SQL injection protection (use parameterized queries)
- [ ] Implement audit logging
- [ ] Add data encryption at rest

## 📈 Scaling Considerations

1. **Database Connection Pooling**: Use PgBouncer or similar
2. **Caching Layer**: Redis for frequently accessed data
3. **CDN**: CloudFront, Cloudflare for static assets
4. **Load Balancing**: Multiple Next.js instances behind ALB
5. **Database Replication**: Read replicas for analytics queries
6. **Queue System**: Bull/Redis for background jobs
7. **Microservices**: Split heavy computations (forecasting) into separate services

## 🆘 Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
npm run dev -- -p 3001
```

### Module Not Found
```bash
rm -rf node_modules package-lock.json
npm install
```

### Build Errors
```bash
# Clear Next.js cache
rm -rf .next
npm run build
```

---

**Need help? Check the Next.js documentation: https://nextjs.org/docs**

