# Exchange Rates Feature

## Overview

Production-ready currency exchange rate system that provides real-time USD to major currency conversions for the top 20 most liquid currencies in the world.

## Features

### ✅ Core Functionality
- **Daily Updates**: Automated cron job runs at 00:00 UTC daily
- **Top 20 Currencies**: EUR, JPY, GBP, AUD, CAD, CHF, CNY, SEK, NZD, MXN, SGD, HKD, NOK, KRW, TRY, INR, BRL, ZAR, RUB, DKK
- **Open Source Data**: Uses Frankfurter.app (European Central Bank data)
- **No API Key Required**: Completely free and open source
- **Database Storage**: PostgreSQL with optimized indexes
- **Fallback Mode**: Works without database using static fallback data

### 🎨 User Interface
- **Real-time Search**: Filter currencies by code or name
- **Sortable Table**: Click column headers to sort
- **Currency Calculator**: Convert USD to any currency in real-time
- **Export to CSV**: Download current rates
- **Manual Update**: Force update button for immediate refresh
- **Responsive Design**: Works on all screen sizes

### 🔧 Technical Implementation

#### Database Schema
```sql
CREATE TABLE exchange_rates (
  id SERIAL PRIMARY KEY,
  currency_code VARCHAR(3) NOT NULL,
  currency_name VARCHAR(100) NOT NULL,
  rate DECIMAL(18, 8) NOT NULL,
  date DATE NOT NULL,
  source VARCHAR(100) NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL,
  CONSTRAINT unique_currency_date UNIQUE (currency_code, date)
);
```

#### API Endpoints

**GET /api/exchange-rates**
- Returns latest exchange rates
- Optional `?date=YYYY-MM-DD` parameter
- Optional `?currency=EUR&days=30` for history
- Fallback to static data if DB unavailable

**POST /api/exchange-rates/update**
- Fetches latest rates from Frankfurter.app
- Updates database
- Protected by CRON_SECRET (optional)
- Returns success/failure status

#### Cron Job Configuration
```json
{
  "crons": [{
    "path": "/api/exchange-rates/update",
    "schedule": "0 0 * * *"
  }]
}
```

## Setup Instructions

### 1. Database Setup

Run the SQL migration:
```bash
psql $DATABASE_URL -f scripts/create-exchange-rates-table.sql
```

### 2. Environment Variables

**Optional (for production):**
```env
DATABASE_URL=postgresql://user:password@host:port/database
CRON_SECRET=your-secret-key-here
```

**Note**: The system works without DATABASE_URL using fallback data.

### 3. Initial Data Load

Manually trigger the first update:
```bash
curl -X POST https://your-domain.vercel.app/api/exchange-rates/update \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Or visit the Exchange Rates page and click "Update".

## Data Source

**Frankfurter.app**
- Open source, free, no API key
- Uses European Central Bank (ECB) data
- Updated daily
- Supports 30+ currencies
- API Docs: https://www.frankfurter.app/docs/

## Production Checklist

- [x] Database schema created
- [x] API endpoints implemented with error handling
- [x] Cron job configured (vercel.json)
- [x] Fallback data for high availability
- [x] UI with search, sort, export
- [x] Currency calculator
- [x] Mobile responsive
- [x] TypeScript types
- [x] Loading states
- [x] Error messages
- [x] Logging

## Monitoring

### Check Cron Job Logs
1. Go to Vercel Dashboard
2. Select your project
3. Go to "Cron Jobs" tab
4. View execution logs

### Manual Testing
```bash
# Test data fetch
curl https://your-domain.vercel.app/api/exchange-rates

# Test manual update (requires CRON_SECRET if set)
curl -X POST https://your-domain.vercel.app/api/exchange-rates/update \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Troubleshooting

### Cron Not Running
- Check Vercel project settings > Cron Jobs
- Verify vercel.json is in project root
- Check deployment logs

### Database Errors
- Verify DATABASE_URL is set correctly
- Ensure table exists
- Check connection from local: `psql $DATABASE_URL -c "SELECT * FROM exchange_rates LIMIT 1;"`

### API Returns Fallback Data
- Check if DATABASE_URL is set
- Verify database connection
- Check API logs for error messages

## Future Enhancements

- [ ] Historical charts (line graphs)
- [ ] Price alerts
- [ ] Compare multiple currencies
- [ ] Custom currency pairs
- [ ] WebSocket for real-time updates
- [ ] Mobile app integration

## License

Open source - uses free data from Frankfurter.app

