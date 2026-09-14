import { env } from 'cloudflare:workers';

export type DB = {
  prepare(sql: string): {
    bind(...values: unknown[]): DBStatement;
    all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
    first<T = Record<string, unknown>>(): Promise<T | null>;
    run(): Promise<{ meta: { last_row_id?: number; changes?: number } }>;
  };
  batch<T = unknown>(statements: DBStatement[]): Promise<T[]>;
};
type DBStatement = ReturnType<DB['prepare']>;

export function getDb(): DB {
  return (env as unknown as { DB: DB }).DB;
}

export async function seedIfEmpty(db: DB) {
  const existing = await db.prepare('SELECT id FROM clients LIMIT 1').first();
  if (existing) return;
  const now = new Date().toISOString();
  await db.batch([
    db
      .prepare('INSERT INTO clients (id,name,code) VALUES (1,?,?)')
      .bind('Ubuntu Coffee Group', 'UC'),
    db
      .prepare('INSERT INTO clients (id,name,code) VALUES (2,?,?)')
      .bind('Harbour Retail Co.', 'HR'),
    db
      .prepare('INSERT INTO clients (id,name,code) VALUES (3,?,?)')
      .bind('Karoo Kitchen', 'KK'),
    db
      .prepare(
        "INSERT INTO locations (id,client_id,name,type,address) VALUES (1,1,?,'warehouse',?),(2,1,?,'store',?),(3,1,?,'store',?),(4,1,?,'store',?),(5,2,?,'warehouse',?),(6,2,?,'store',?),(7,2,?,'store',?),(8,3,?,'warehouse',?),(9,3,?,'store',?),(10,3,?,'store',?)",
      )
      .bind(
        'Ubuntu Distribution Centre',
        '12 Commerce Park, Johannesburg',
        'Rosebank Café',
        'Rosebank, Johannesburg',
        'Sandton Kiosk',
        'Sandton, Johannesburg',
        'Melrose Store',
        'Melrose, Johannesburg',
        'Harbour Distribution Centre',
        'Paarden Eiland, Cape Town',
        'V&A Waterfront',
        'Cape Town',
        'Sea Point Market',
        'Cape Town',
        'Karoo Distribution Centre',
        'Stellenbosch, Western Cape',
        'Stellenbosch',
        'Western Cape',
        'Paarl',
        'Western Cape',
      ),
    db
      .prepare(
        "INSERT INTO users (id,client_id,default_location_id,name,email,role,status) VALUES (1,1,2,?,?,?,'Active'),(2,1,3,?,?,?,'Active'),(3,1,4,?,?,?,'Active'),(4,2,6,?,?,?,'Active'),(5,3,9,?,?,?,'Active')",
      )
      .bind(
        'Thando Mokoena',
        'thando@ubuntu.co.za',
        'Client administrator',
        'Lerato Nkosi',
        'lerato@ubuntu.co.za',
        'Store manager',
        'Sipho Dlamini',
        'sipho@ubuntu.co.za',
        'Cashier',
        'Aisha Daniels',
        'aisha@harbour.co.za',
        'Client administrator',
        'Pieter Smit',
        'pieter@karoo.co.za',
        'Client administrator',
      ),
  ]);
  const productData = [
    ['CAP-001', 'Cappuccino', 'Beverages', 42, 16, '☕', '#e8d7c0'],
    ['MAT-001', 'Iced Matcha', 'Beverages', 48, 19, '🍵', '#dce8c7'],
    ['WRP-001', 'Chicken Wrap', 'Fresh food', 72, 38, '🌯', '#f0dfbd'],
    ['AVO-001', 'Avo Toast', 'Fresh food', 68, 31, '🥑', '#d6e6c4'],
    ['BRY-001', 'Berry Bowl', 'Fresh food', 64, 29, '🥣', '#edd1d9'],
    ['CRO-001', 'Butter Croissant', 'Bakery', 36, 15, '🥐', '#f1dfb9'],
    ['BAN-001', 'Banana Bread', 'Bakery', 38, 17, '🍞', '#e9d2ac'],
    ['WAT-001', 'Sparkling Water', 'Cold drinks', 24, 9, '💧', '#d3e6e8'],
    ['JUI-001', 'Green Juice', 'Cold drinks', 52, 22, '🥤', '#d6e7ca'],
    ['GRA-001', 'Granola Pack', 'Retail', 89, 52, '🥜', '#e8ddca'],
    ['HOU-001', 'House Blend 250g', 'Retail', 145, 83, '🫘', '#ded0c3'],
    ['COO-001', 'Chocolate Cookie', 'Bakery', 28, 11, '🍪', '#ead5c8'],
  ] as const;
  const statements: DBStatement[] = [];
  for (const clientId of [1, 2, 3])
    for (const p of productData)
      statements.push(
        db
          .prepare(
            'INSERT INTO products (client_id,sku,name,category,price,cost,icon,color) VALUES (?,?,?,?,?,?,?,?)',
          )
          .bind(clientId, ...p),
      );
  await db.batch(statements);
  const { results: allProducts } = await db
    .prepare<{ id: number; client_id: number }>(
      'SELECT id,client_id FROM products',
    )
    .all();
  const { results: allLocations } = await db
    .prepare<{ id: number; client_id: number; type: string }>(
      'SELECT id,client_id,type FROM locations',
    )
    .all();
  const inv: DBStatement[] = [];
  for (const location of allLocations)
    for (const product of allProducts.filter(
      (p) => p.client_id === location.client_id,
    ))
      inv.push(
        db
          .prepare(
            'INSERT INTO inventory (client_id,location_id,product_id,quantity,reorder_level) VALUES (?,?,?,?,?)',
          )
          .bind(
            location.client_id,
            location.id,
            product.id,
            location.type === 'warehouse' ? 120 : 12 + (product.id % 17),
            6,
          ),
      );
  await db.batch(inv);
  await db.batch([
    db
      .prepare(
        'INSERT INTO customers (client_id,name,email,phone,created_at) VALUES (1,?,?,?,?),(1,?,?,?,?),(2,?,?,?,?)',
      )
      .bind(
        'Naledi Khumalo',
        'naledi@example.com',
        '082 555 0101',
        now,
        'James Williams',
        'james@example.com',
        '083 555 0132',
        now,
        'Amara Jacobs',
        'amara@example.com',
        '084 555 0148',
        now,
      ),
    db
      .prepare(
        "INSERT INTO purchase_orders (client_id,destination_location_id,supplier,status,total,created_at) VALUES (1,1,?,'In transit',14820,?),(1,2,?,'Ready',6850,?)",
      )
      .bind('Cape Coffee Co.', now, 'Fresh Foods SA', now),
  ]);
}
