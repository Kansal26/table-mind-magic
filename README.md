# TableMind

**TableMind** is a next-generation, AI-powered QR ordering platform designed to transform the dine-in experience for both customers and restaurant operators. 

Instead of replacing the human element of hospitality, TableMind enhances it by bringing personalization, voice ordering, and intelligent recommendations directly to the diner's table, while providing restaurant owners with real-time operational insights and customer feedback.

## The Problem
Traditional static QR menus have merely digitized the ordering process without actually improving it. Restaurants lack granular, actionable feedback on specific dishes, and diners are forced to navigate cumbersome, static menus that offer zero personalization. 

## The Solution
TableMind bridges this gap. When a diner scans a TableMind QR code, they aren't just getting a PDF—they are getting an interactive, intelligent menu that learns their preferences, highlights allergy-safe options, and allows them to order with a single tap or via voice command.

## Key Features

### For Diners
* **Smart Personalization:** The menu adapts to the diner, remembering past favorites and dietary restrictions (e.g., highlighting allergy-safe options).
* **Voice Ordering:** A seamless, natural way to add items to the cart using voice recognition, making the ordering experience frictionless.
* **Instant Rewards Loop:** Diners can earn loyalty credits by providing quick, 10-second feedback on their meal immediately after paying.
* **Frictionless Checkout:** Pay for the meal directly from the phone and instantly view an itemized digital receipt.

### For Restaurants
* **Actionable Analytics:** Finally know exactly what's working. Gather per-dish ratings and detailed feedback rather than generic overall reviews.
* **Kitchen-Aware Suggestions:** The platform can dynamically push recommendations based on current kitchen load, helping to turn tables faster during rush hours.
* **Dynamic Coupons & Loyalty:** Easily retain customers by issuing automated discounts, loyalty points, and promotional coupons.
* **Comprehensive Dashboard:** A powerful administrative interface to manage the menu, track live orders across tables, and analyze sales trends.

## Tech Stack

TableMind is built with a modern, scalable web architecture:

* **Frontend:** React, Tailwind CSS (Mobile-first, fully responsive design)
* **Routing & State:** TanStack Router and React Query for lightning-fast client-side navigation and data fetching.
* **Backend / Database:** Supabase (PostgreSQL) with Row-Level Security (RLS) ensuring strict data isolation between different restaurants and users.
* **Authentication:** Supabase Auth (Magic Links, OTPs, and OAuth).
* **Payments & Notifications:** Integrated with modern payment gateways and Resend for transactional emails.

## Getting Started

To run the project locally:

### Prerequisites
You need Node.js and npm installed. We recommend using [nvm](https://github.com/nvm-sh/nvm).

### Installation
1. Clone the repository:
   ```sh
   git clone <repository-url>
   cd <repository-name>
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Set up your environment variables:
   * Copy the example environment file and fill in your Supabase and Resend keys.
   ```sh
   cp .env.example .env
   ```
4. Start the development server:
   ```sh
   npm run dev
   ```

## Architecture & Security Highlights
* **Topological Data Integrity:** The PostgreSQL schema relies on strict foreign key constraints and cascading deletes to ensure orphaned records (like unattached orders or menu items) never exist.
* **Granular Role-Based Access:** Employs PostgreSQL Row Level Security (RLS) to guarantee that restaurant owners can only view and mutate their own localized data.
* **Resilient Async Flows:** Incorporates retry-logic and robust error handling around external services (e.g., Supabase Auth API) to ensure smooth user experiences even during transient network failures.

---
*TableMind — Your menu, but it actually knows the customer.*
