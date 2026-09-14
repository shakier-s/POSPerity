import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const clients = sqliteTable('clients', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
});

export const locations = sqliteTable('locations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clientId: integer('client_id')
    .notNull()
    .references(() => clients.id),
  name: text('name').notNull(),
  type: text('type', { enum: ['store', 'warehouse'] }).notNull(),
  address: text('address').notNull(),
});

export const products = sqliteTable(
  'products',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    clientId: integer('client_id')
      .notNull()
      .references(() => clients.id),
    sku: text('sku').notNull(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    price: real('price').notNull(),
    cost: real('cost').notNull(),
    icon: text('icon').notNull(),
    color: text('color').notNull(),
  },
  (table) => [
    uniqueIndex('idx_products_client_sku').on(table.clientId, table.sku),
  ],
);

export const inventory = sqliteTable(
  'inventory',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    clientId: integer('client_id')
      .notNull()
      .references(() => clients.id),
    locationId: integer('location_id')
      .notNull()
      .references(() => locations.id),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    quantity: integer('quantity').notNull().default(0),
    reorderLevel: integer('reorder_level').notNull().default(5),
  },
  (table) => [
    uniqueIndex('idx_inventory_location_product').on(
      table.locationId,
      table.productId,
    ),
  ],
);

export const customers = sqliteTable('customers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clientId: integer('client_id')
    .notNull()
    .references(() => clients.id),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  createdAt: text('created_at').notNull(),
});

export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    clientId: integer('client_id')
      .notNull()
      .references(() => clients.id),
    defaultLocationId: integer('default_location_id')
      .notNull()
      .references(() => locations.id),
    name: text('name').notNull(),
    email: text('email').notNull(),
    role: text('role').notNull(),
    status: text('status').notNull().default('Active'),
  },
  (table) => [
    uniqueIndex('idx_users_client_email').on(table.clientId, table.email),
  ],
);

export const sales = sqliteTable('sales', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clientId: integer('client_id')
    .notNull()
    .references(() => clients.id),
  locationId: integer('location_id')
    .notNull()
    .references(() => locations.id),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  customerId: integer('customer_id').references(() => customers.id),
  receiptNumber: text('receipt_number').notNull().unique(),
  paymentMethod: text('payment_method').notNull(),
  subtotal: real('subtotal').notNull(),
  tax: real('tax').notNull(),
  total: real('total').notNull(),
  cashReceived: real('cash_received'),
  changeGiven: real('change_given'),
  createdAt: text('created_at').notNull(),
});

export const saleItems = sqliteTable('sale_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  saleId: integer('sale_id')
    .notNull()
    .references(() => sales.id),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  quantity: integer('quantity').notNull(),
  unitPrice: real('unit_price').notNull(),
});

export const purchaseOrders = sqliteTable('purchase_orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clientId: integer('client_id')
    .notNull()
    .references(() => clients.id),
  destinationLocationId: integer('destination_location_id')
    .notNull()
    .references(() => locations.id),
  supplier: text('supplier').notNull(),
  status: text('status').notNull().default('Draft'),
  total: real('total').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

export const stockTransfers = sqliteTable('stock_transfers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clientId: integer('client_id')
    .notNull()
    .references(() => clients.id),
  fromLocationId: integer('from_location_id')
    .notNull()
    .references(() => locations.id),
  toLocationId: integer('to_location_id')
    .notNull()
    .references(() => locations.id),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  quantity: integer('quantity').notNull(),
  status: text('status').notNull().default('Dispatched'),
  createdAt: text('created_at').notNull(),
});
