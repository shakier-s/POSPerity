# POSPerity

POSPerity is a responsive, multi-client point-of-sale portal developed for DataWiz Consulting. It combines store checkout, client-level products, location inventory, customer management, users and roles, purchase orders, central warehouse distribution, held sales, barcode lookup, and reporting in one application.

This document contains the functional and technical information needed to recreate the current application.

## Product identity

- Product name: **POSPerity**
- Provider: **DataWiz Consulting**
- Product statement: **Smarter selling. Connected inventory. Prosperous business.**
- Visual direction: charcoal and light grey surfaces with a warm orange accent
- Production URL: `https://posperity.yushaaallow19.chatgpt.site`

## Current implementation status

The hosted application uses an OpenAI Sites D1 database through the `DB` binding. It does **not** use the separate Railway MySQL database as its active data source. If Railway MySQL is required, create an HTTP API on Railway because Sites workers cannot open raw TCP MySQL connections.

The application currently provides a test-profile selector rather than a production username/password identity system. The Site itself is private and protected by its hosting access policy. Before public or multi-company production use, bind each authenticated identity to one application user on the server and remove profile simulation.

## Technology stack

| Layer | Technology |
| --- | --- |
| UI | React 19, TypeScript, lucide-react |
| Framework | Vinext / Next-compatible App Router |
| Build | Vite 8 and `@openai/sites-vite-plugin` |
| Runtime | Cloudflare Worker-compatible server output |
| Database | Sites D1 / SQLite |
| Schema and migrations | Drizzle ORM and Drizzle Kit |
| Styling | Tailwind base imports plus product-specific CSS |
| Package manager | pnpm |
| Hosting | OpenAI Sites |

Node.js 22.13 or newer is required.

## Repository structure

```text
.
├── .openai/hosting.json       # Sites project and DB binding
├── app/
│   ├── api/pos/route.ts       # Read and write API for all POS workflows
│   ├── charcoal.css           # Final charcoal theme overrides
│   ├── globals.css            # Main application layout and components
│   ├── live.css               # Live forms, entry screens, held sales
│   ├── layout.tsx             # Metadata and global stylesheet imports
│   └── page.tsx               # Portal, POS, modules, dialogs and session UI
├── db/schema.ts               # Relational schema
├── drizzle/                   # Immutable generated SQL migrations
├── drizzle.config.ts          # Migration generator configuration
├── lib/db.ts                  # D1 binding, demo seed and barcode backfill
├── components/ui/             # Reusable UI primitives
├── vite.config.ts             # Vinext, Sites and Cloudflare configuration
├── package.json
└── pnpm-lock.yaml
```

## Local setup

```bash
pnpm install
pnpm dev
```

Use the local URL printed by Vinext. To make a production build:

```bash
pnpm build
```

The build must produce `dist/server/index.js`. The worker entry point must export a default object with a callable `fetch(request, env, ctx)` handler.

## Hosting configuration

`.openai/hosting.json` requires the logical D1 binding:

```json
{
  "project_id": "<existing-sites-project-id>",
  "d1": "DB",
  "r2": null
}
```

For a new Sites project, omit the old `project_id`, create the new Site once, and save the returned ID. Never reuse the production project ID for an unrelated application.

## Database model

Every operational record is tenant-scoped through `client_id`. Never accept a client identifier from the browser without verifying that the acting user belongs to that client.

```text
Client
├── Locations
│   ├── one central warehouse
│   └── multiple stores
├── Products
│   └── Inventory by location
├── Customers
├── Users
│   └── default store
├── Purchase orders
├── Stock transfers
├── Sales
│   └── Sale items
├── Adjustment logs
└── Held sales
    └── Held sale items
```

### Tables

#### `clients`

- `id` integer primary key
- `name` tenant/company name
- `code` unique short code

#### `locations`

- `id`
- `client_id`
- `name`
- `type`: `store` or `warehouse`
- `address`

#### `products`

- `id`
- `client_id`
- `sku`, unique within a client
- `barcode`, nullable but populated for seeded products
- `name`
- `category`
- `price`
- `cost`
- `icon`
- `color`

Products belong to the client catalogue. They are not duplicated manually for each store.

#### `inventory`

- `client_id`
- `location_id`
- `product_id`
- `quantity`
- `reorder_level`

The `(location_id, product_id)` combination is unique. Sales deduct from the selling store. Warehouse receipts and transfers update location inventory.

#### `customers`

- `client_id`
- `name`
- `email`
- `phone`
- `created_at`

Customers are shared across the client and may be attached to sales or held sales. A sale may also remain a walk-in sale.

#### `users`

- `client_id`
- `default_location_id`
- `name`
- `email`, unique within a client
- `role`
- `status`

#### `sales` and `sale_items`

A sale stores its client, location, cashier, optional customer, receipt number, payment method, net amount, VAT, total, cash received, change and timestamp. Sale items store the product, quantity and sale-time unit price.

#### `held_sales` and `held_sale_items`

A held sale stores the client, original store, cashier, optional customer, reference, total and timestamp. Its lines store product, quantity and captured unit price. Holding does not reserve or deduct inventory.

#### `purchase_orders`

- client and destination location
- supplier
- status
- total
- creation timestamp

#### `stock_transfers`

- client
- source location
- destination location
- product
- quantity
- status
- creation timestamp

#### `adjustment_logs`

Stores the client, acting user, action, affected entity and record ID, a readable summary, and timestamp. Client administrators and store managers can open the Adjustment Log from the Reports page; results are always restricted to the active client.

## Reports and adjustment history

The **Reports** navigation item opens a reporting hub with two linked report surfaces:

- **Sales performance** shows posted revenue, transaction count, average sale, active-store count, and recent sale details.
- **Adjustment log** shows the 250 most recent tenant events with date and time, acting user, action, affected area and record, and a readable description.

The Adjustment Log is visible to client administrators and store managers. Cashiers cannot access Reports. The API enforces this access independently of the navigation interface. Log results are client-scoped; store managers can review activity for their company but cannot access another client's records.

New log entries are written for:

- client administrator create, update, and delete operations;
- customer, user, and purchase-order creation;
- stock-transfer dispatch and receipt, including the resulting inventory movement;
- sales placed on hold or released; and
- completed card and cash sales, including store inventory deductions.

Adjustment records are audit history and are not editable through the application.

## Permission model

Authorization is enforced in the API as well as the interface.

| Function | Client administrator | Store manager | Cashier |
| --- | --- | --- | --- |
| Sell and take payment | All permitted stores | Assigned store | Assigned store |
| Customers | Client-wide | Client-wide | Client-wide |
| Store inventory | All stores and warehouse | Assigned store and warehouse context | Product availability for assigned store |
| Reports | Client-wide sales and adjustment log | Assigned-store sales and client adjustment log | Not shown |
| Purchase orders | Any permitted destination | Assigned store only | No |
| Transfers | Client-wide | Requests/receipts for assigned store | No |
| Users | All client users and roles | Cashiers for assigned store | No |
| Sites/client switching | Yes | No | No |

Client administrators have tenant-scoped create, read, update and delete controls for sites, products and location stock, customers, users, and draft purchase orders. Company details may be updated but the client tenant itself cannot be created or deleted from inside its own portal. Posted sales and received transfers are immutable audit records. Deletes that would break transaction history are rejected.

Cashiers can see only **Sell** and **Customers**. Store managers see Sell, Inventory, Distribution, Customers, Users, Purchase Orders, and Reports. Client administrators see every module.

## Application entry and sessions

1. Display the animated POSPerity splash screen.
2. Show “Brought to you by DataWiz Consulting.”
3. Display the selected user's welcome card with company, email, role, default store and session state.
4. Enter the workspace at the user's default store.
5. Show a **Log off** action for every role.
6. Logging off clears the cart, selected customer, dialogs and notices, then returns to the application sign-in screen.

Application log-off is distinct from signing out of the private hosting/ChatGPT session.

## New sale workflow

1. Resolve the acting user and default/selected store.
2. Load the client catalogue joined to inventory for that store.
3. Add products through cards, text search, SKU search, or barcode scan.
4. Optionally attach a client customer.
5. Select Card or Cash.
6. For cash, require `cash_received >= total` and calculate change.
7. On the server, re-read authoritative prices and inventory.
8. Reject missing products, invalid quantities, insufficient inventory, invalid client/store access, or insufficient cash.
9. Create the sale and sale items.
10. Deduct quantities from the selling store only.
11. Return the receipt number and change.
12. Refresh inventory and reports.

VAT is included at 15%:

```text
vat = total - (total / 1.15)
net = total - vat
```

## Held-sale workflow

1. Add items and optionally attach a customer.
2. Select **Hold** and enter a reference such as a customer or table name.
3. Persist the held header and item lines without changing inventory.
4. Select **Held** to view accessible held orders.
5. Recall restores products, quantities and customer to the active cart.
6. Payment creates a normal sale and removes the held header and lines.
7. Release/delete removes an unwanted held order without affecting inventory.

Cashiers see their own holds at their store. Managers see store holds. Administrators see holds across their permitted client scope.

## Barcode workflow

The search input matches product name, SKU and barcode. When a scanner sends Enter:

1. Trim and normalize the scanned value.
2. Look for an exact barcode, SKU, normalized SKU, or exact product name.
3. Reject an unknown or out-of-stock product with visible feedback.
4. Add the exact product to the cart and clear the input.

Seeded test identifiers include:

| Product | SKU | Barcode |
| --- | --- | --- |
| Cappuccino | `CAP-001` | `6001000000017` |
| Iced Matcha | `MAT-001` | `6001000000024` |
| Chicken Wrap | `WRP-001` | `6001000000031` |
| Avo Toast | `AVO-001` | `6001000000048` |
| Berry Bowl | `BRY-001` | `6001000000055` |
| Butter Croissant | `CRO-001` | `6001000000062` |
| Banana Bread | `BAN-001` | `6001000000079` |
| Sparkling Water | `WAT-001` | `6001000000086` |
| Green Juice | `JUI-001` | `6001000000093` |
| Granola Pack | `GRA-001` | `6001000000109` |
| House Blend 250g | `HOU-001` | `6001000000116` |
| Chocolate Cookie | `COO-001` | `6001000000123` |

## Warehouse distribution

The client owns one central warehouse and multiple stores. A transfer is created from the warehouse to a store after verifying available source stock. Inventory changes when the destination receives the transfer:

```text
warehouse quantity -= transfer quantity
store quantity += transfer quantity
transfer status = Received
```

Managers can request and receive transfers only for their assigned store. Administrators operate client-wide.

## API contract

All workflows use `app/api/pos/route.ts`.

### Read

`GET /api/pos?clientId=<id>&userId=<id>` returns role-scoped clients, locations, inventory products, customers, users, purchase orders, transfers, sales, held sales, held-sale items, and adjustment logs. Adjustment logs are returned only to administrators and store managers.

### Write actions

Send JSON to `POST /api/pos` with an `action` field:

- `sale`
- `hold`
- `deleteHold`
- `customer`
- `user`
- `purchaseOrder`
- `transfer`
- `receiveTransfer`
- `adminCrud` with an allowed tenant entity and `create`, `update`, or `delete` operation

Every write includes the acting `userId` and relevant `clientId`. The server loads the user, checks active status, validates tenant membership and role, then validates the requested store and records.

## Seed data

`lib/db.ts` seeds three demonstration clients when the database is empty:

- Ubuntu Coffee Group
- Harbour Retail Co.
- Karoo Kitchen

It also creates warehouses, stores, example users, products, inventory, customers and purchase orders. `ensureProductBarcodes()` backfills test barcodes after the barcode migration.

Seed logic inserts data only when no client exists. Schema changes belong exclusively in generated Drizzle migrations.

## Creating schema migrations

Edit `db/schema.ts`, then run:

```bash
pnpm exec drizzle-kit generate
```

Inspect the generated SQL before publishing. Applied migration files and their matching `drizzle/meta` snapshots are immutable. Never edit an already-applied migration; add a new one.

## Visual system

The final palette is charcoal rather than green:

- Primary charcoal: `#35383c`
- Deep navigation: `#202225`
- Dark surface: `#2b2e32`
- Main ink: `#242629`
- Page background: `#f3f3f2`
- Brand orange: `#d9783b`
- Warm highlight: `#f09a56`

The UI is designed for desktop and tablet use. Mobile layouts collapse data tables, open the sidebar as an overlay, and present dialogs as bottom sheets.

## Rebuild checklist

- [ ] Scaffold a Vinext Sites project with shadcn and D1 support.
- [ ] Recreate the schema and generate migrations.
- [ ] Configure the `DB` D1 binding.
- [ ] Implement tenant-scoped GET and POST handlers.
- [ ] Seed representative clients, locations, users, products and inventory.
- [ ] Build splash, sign-in, welcome and log-off screens.
- [ ] Build role-aware navigation and store locking.
- [ ] Build the POS catalogue, cart, customer attachment and payment dialog.
- [ ] Revalidate prices, permissions and stock on the server.
- [ ] Implement held sales and barcode scanner Enter handling.
- [ ] Implement inventory, users, customers, purchasing, transfers and reports.
- [ ] Apply the charcoal and orange responsive theme.
- [ ] Run `pnpm build` and correct all build failures.
- [ ] Package and publish with Sites so migrations apply before the worker is released.

## Production-hardening checklist

Before accepting real payments or external client access:

- Replace test-profile selection with authenticated identity-to-user binding.
- Add passwordless/OIDC or the approved hosting identity mechanism.
- Add audit logs for sign-in, sales, refunds, voids, transfers and permission changes.
- Add till sessions, opening floats, payouts and cash-up reconciliation.
- Add refunds, returns, discounts, void approval and receipt printing.
- Add payment-provider integration and idempotency keys.
- Add stock movement ledgers and concurrency-safe inventory controls.
- Add purchase-order lines, supplier receipts and partial deliveries.
- Add user invitations, password reset/session revocation and account suspension.
- Add automated API, permission, migration and end-to-end tests.
- Add backup, retention, monitoring and incident-response procedures.

## License and ownership

Add the appropriate license and copyright terms for DataWiz Consulting before distributing or open-sourcing this repository.
