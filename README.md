# TreasuryX

A modern, AI-powered treasury management platform for enterprise cash visibility, entity management, and payment operations.

## Features

- **Real-time Cash Visibility** - Unified view of cash across all accounts, entities, and currencies
- **Entity Management** - Manage legal entities and banking relationships
- **Payment Operations** - Track and approve payments with full audit trails
- **AI-Powered Forecasting** - ML-driven cash flow predictions and anomaly detection
- **Interactive Analytics** - Built-in dashboards and reporting

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Data**: CSV files (easily replaceable with database connections)
- **Architecture**: API-first, modular design ready for production scaling

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
treasuryx/
├── app/                 # Next.js app directory
│   ├── api/            # API routes
│   ├── dashboard/      # Dashboard pages
│   ├── cash/           # Cash management module
│   ├── entities/       # Entity management module
│   └── payments/       # Payment management module
├── components/         # Reusable React components
├── lib/               # Utility functions and data access
└── data/              # Mock CSV data files
```

## Scaling to Production

This prototype is designed with production scalability in mind:

- **API Layer**: Replace CSV readers with database queries
- **Authentication**: Add NextAuth.js or similar
- **Database**: Connect to PostgreSQL, MySQL, or cloud database
- **Caching**: Add Redis for performance
- **Real-time**: Integrate WebSocket connections for live updates
- **Multi-tenancy**: Add tenant isolation in data layer
- **External APIs**: Connect to bank APIs and ERP systems

## License

MIT

