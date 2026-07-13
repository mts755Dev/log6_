# heliOS - Battery Storage Quoting Platform

A professional SaaS platform for the UK battery storage market, enabling renewable installers and electricians to generate instant quotes, model customer ROI, and automate compliance paperwork.

## Features

### 🔋 Multi-Tenant SaaS Portal
- **Role-based access control** for Admin, Installer, and Umbrella Assessor roles
- Separate login portals for each user type
- Company account management
- Subscription tier management (Starter, Professional, Enterprise)

### 📊 Quoting & ROI Engine
- **Instant quote generation** with step-by-step wizard
- Real-time ROI projections including:
  - Load shifting savings
  - Export revenue
  - EV tax savings (fuel cost comparison)
- Support for Time-of-Use tariffs (Octopus Go, Intelligent Octopus, etc.)
- Editable installer pricing and margins
- 10-year financial projections with inflation adjustment

### 📄 Proposal Management
- Save proposals per customer
- Status tracking (Draft → Sent → Viewed → Accepted/Rejected)
- Customer details and system specifications
- Branded proposal generation ready for PDF export

### 🛡️ MIS-3002 Automation
- Auto-fill compliance paperwork from installer inputs
- Generate customer contract documents
- Compliant with MCS 012 (formerly MIS-3002) standards

### 🔍 Umbrella Scheme Workflow
- Installer commissioning submission
- Photo upload and checklist verification
- Assessor review and approval workflow
- Certificate generation for approved installations

### 📦 Manufacturer Product Integration
- Pre-loaded battery catalogues (Tesla, GivEnergy, SolaX, Fox ESS, Huawei)
- Pre-loaded inverter catalogues
- Product specifications including capacity, power, warranty, efficiency
- Cost price and RRP management

## Tech Stack

- **Frontend:** React 18 + TypeScript
- **Build Tool:** Vite
- **Styling:** TailwindCSS with custom design system
- **Animations:** Framer Motion
- **Charts:** Recharts
- **Icons:** Lucide React
- **Routing:** React Router v6
- **Storage:** LocalStorage (for development/demo)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd heliOS_

# Install dependencies
npm install

# Start the development server
npm run dev
```

The application will be available at `http://localhost:5173`

### Demo Accounts

The platform comes with pre-seeded demo accounts for testing:

| Role | Email | Portal URL |
|------|-------|------------|
| Admin | admin@helios.co.uk | /login/admin |
| Installer | installer@solarsolutions.co.uk | /login/installer |
| Assessor | assessor@helios.co.uk | /login/assessor |

Simply enter the email and click "Try Demo Account" to log in.

## Documentation

- **[Chatbot Architecture & Phased Delivery](docs/CHATBOT_ARCHITECTURE.md)** — Lane system, tech stack, Phase 1–5 deliverables, API pipeline, data model.
- **[AI Assistant Architecture & Flowcharts](docs/AI_ASSISTANT_ARCHITECTURE.md)** — Platform flow, RAG design, admin Document Bank → retrieval pipeline, and Mermaid diagrams.

## Project Structure

```
src/
├── components/
│   ├── layouts/         # Dashboard layout, Sidebar
│   └── ui/             # Reusable UI components (Button, Card, Input, etc.)
├── contexts/
│   ├── AuthContext.tsx  # Authentication state management
│   └── DataContext.tsx  # Data operations and state
├── pages/
│   ├── admin/          # Admin portal pages
│   ├── assessor/       # Assessor portal pages
│   ├── auth/           # Login pages
│   └── installer/      # Installer portal pages
├── services/
│   ├── seedData.ts     # Demo data initialization
│   └── storage.ts      # LocalStorage service
├── types/
│   └── index.ts        # TypeScript type definitions
└── utils/
    └── cn.ts           # Utility functions
```

## Key Pages

### Installer Portal
- **Dashboard** - Overview of quotes, stats, and quick actions
- **New Quote** - Multi-step quote creation wizard with ROI calculator
- **My Quotes** - List and manage all quotes
- **Quote Detail** - View quote details, timeline, and customer info
- **Products** - Browse battery and inverter catalogues
- **Commissions** - Track umbrella scheme submissions
- **MIS-3002** - Generate compliance documents
- **Settings** - Profile, company, notifications, and subscription

### Admin Portal
- **Dashboard** - Platform-wide statistics and analytics
- **Companies** - Manage installer companies
- **Users** - User management across all roles
- **Products** - Manage product catalogues and manufacturers

### Assessor Portal
- **Dashboard** - Pending reviews and recent activity
- **Pending Reviews** - List of submissions awaiting review
- **Review Page** - Detailed review with checklist and photo verification

## Design System

The platform uses a custom dark theme design system:

- **Colors:** Slate-based dark theme with blue primary accents
- **Typography:** DM Sans (body), Outfit (display), JetBrains Mono (code)
- **Components:** Professional, accessible UI components with hover states
- **Animations:** Subtle, purposeful animations using Framer Motion
- **No gradients** - Clean, professional aesthetic per requirements

## Data Persistence

Currently uses LocalStorage for demo purposes. The data layer is abstracted in:
- `src/services/storage.ts` - Generic storage operations
- `src/contexts/DataContext.tsx` - Data access and mutations

This makes it easy to swap to a real backend (Supabase, Firebase, custom API) by updating the service layer.

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

Proprietary - © 2025 heliOS Technologies Ltd. All rights reserved.

