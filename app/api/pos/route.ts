import { getDb, seedIfEmpty } from '@/lib/db';

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const bad = (message: string, status = 400) => json({ error: message }, status);

export async function GET(request: Request) {
  try {
    const db = getDb();
    await seedIfEmpty(db);
    const url = new URL(request.url),
      clientId = Number(url.searchParams.get('clientId') || 1),
      actingUserId = Number(url.searchParams.get('userId') || 0);
    const actor = actingUserId
      ? await db
          .prepare<{
            id: number;
            client_id: number;
            default_location_id: number;
            role: string;
            status: string;
          }>('SELECT id,client_id,default_location_id,role,status FROM users WHERE id=?')
          .bind(actingUserId)
          .first()
      : null;
    if (actingUserId && (!actor || actor.status !== 'Active'))
      return bad('An active user session is required', 401);
    if (actor && actor.client_id !== clientId)
      return bad('This user does not belong to the selected client', 403);
    const role = actor?.role.toLowerCase() || 'administrator',
      isAdministrator = role.includes('administrator'),
      isManager = role.includes('manager'),
      scopedLocationId = actor?.default_location_id || 0;
    const [
      clients,
      locations,
      products,
      customers,
      users,
      purchaseOrders,
      transfers,
      sales,
    ] = await Promise.all([
      isAdministrator
        ? db.prepare('SELECT * FROM clients ORDER BY id').all()
        : db.prepare('SELECT * FROM clients WHERE id=?').bind(clientId).all(),
      db
        .prepare(
          isAdministrator
            ? 'SELECT * FROM locations WHERE client_id=? ORDER BY type,name'
            : isManager
              ? "SELECT * FROM locations WHERE client_id=? AND (id=? OR type='warehouse') ORDER BY type,name"
              : 'SELECT * FROM locations WHERE client_id=? AND id=? ORDER BY name',
        )
        .bind(...(isAdministrator ? [clientId] : [clientId, scopedLocationId]))
        .all(),
      db
        .prepare(
          isAdministrator
            ? 'SELECT p.*,i.quantity AS stock,i.location_id FROM products p JOIN inventory i ON i.product_id=p.id WHERE p.client_id=? ORDER BY p.name'
            : isManager
              ? "SELECT p.*,i.quantity AS stock,i.location_id FROM products p JOIN inventory i ON i.product_id=p.id JOIN locations l ON l.id=i.location_id WHERE p.client_id=? AND (i.location_id=? OR l.type='warehouse') ORDER BY p.name"
              : 'SELECT p.*,i.quantity AS stock,i.location_id FROM products p JOIN inventory i ON i.product_id=p.id WHERE p.client_id=? AND i.location_id=? ORDER BY p.name',
        )
        .bind(...(isAdministrator ? [clientId] : [clientId, scopedLocationId]))
        .all(),
      db
        .prepare(
          'SELECT * FROM customers WHERE client_id=? ORDER BY created_at DESC',
        )
        .bind(clientId)
        .all(),
      db
        .prepare(
          isAdministrator
            ? 'SELECT * FROM users WHERE client_id=? ORDER BY name'
            : isManager
              ? 'SELECT * FROM users WHERE client_id=? AND default_location_id=? ORDER BY name'
              : 'SELECT * FROM users WHERE client_id=? AND id=?',
        )
        .bind(...(isAdministrator ? [clientId] : isManager ? [clientId, scopedLocationId] : [clientId, actingUserId]))
        .all(),
      db
        .prepare(
          isAdministrator
            ? 'SELECT po.*,l.name AS destination FROM purchase_orders po JOIN locations l ON l.id=po.destination_location_id WHERE po.client_id=? ORDER BY po.id DESC'
            : isManager
              ? 'SELECT po.*,l.name AS destination FROM purchase_orders po JOIN locations l ON l.id=po.destination_location_id WHERE po.client_id=? AND po.destination_location_id=? ORDER BY po.id DESC'
              : 'SELECT po.*,l.name AS destination FROM purchase_orders po JOIN locations l ON l.id=po.destination_location_id WHERE po.client_id=? AND 0',
        )
        .bind(...(isManager ? [clientId, scopedLocationId] : [clientId]))
        .all(),
      db
        .prepare(
          isAdministrator
            ? 'SELECT t.*,f.name AS origin,d.name AS destination,p.name AS product_name FROM stock_transfers t JOIN locations f ON f.id=t.from_location_id JOIN locations d ON d.id=t.to_location_id JOIN products p ON p.id=t.product_id WHERE t.client_id=? ORDER BY t.id DESC'
            : isManager
              ? 'SELECT t.*,f.name AS origin,d.name AS destination,p.name AS product_name FROM stock_transfers t JOIN locations f ON f.id=t.from_location_id JOIN locations d ON d.id=t.to_location_id JOIN products p ON p.id=t.product_id WHERE t.client_id=? AND (t.from_location_id=? OR t.to_location_id=?) ORDER BY t.id DESC'
              : 'SELECT t.*,f.name AS origin,d.name AS destination,p.name AS product_name FROM stock_transfers t JOIN locations f ON f.id=t.from_location_id JOIN locations d ON d.id=t.to_location_id JOIN products p ON p.id=t.product_id WHERE t.client_id=? AND 0',
        )
        .bind(...(isManager ? [clientId, scopedLocationId, scopedLocationId] : [clientId]))
        .all(),
      db
        .prepare(
          isAdministrator
            ? 'SELECT s.*,l.name AS location_name,u.name AS cashier_name,c.name AS customer_name FROM sales s JOIN locations l ON l.id=s.location_id JOIN users u ON u.id=s.user_id LEFT JOIN customers c ON c.id=s.customer_id WHERE s.client_id=? ORDER BY s.id DESC LIMIT 50'
            : 'SELECT s.*,l.name AS location_name,u.name AS cashier_name,c.name AS customer_name FROM sales s JOIN locations l ON l.id=s.location_id JOIN users u ON u.id=s.user_id LEFT JOIN customers c ON c.id=s.customer_id WHERE s.client_id=? AND s.location_id=? ORDER BY s.id DESC LIMIT 50',
        )
        .bind(...(isAdministrator ? [clientId] : [clientId, scopedLocationId]))
        .all(),
    ]);
    return json({
      clients: clients.results,
      locations: locations.results,
      products: products.results,
      customers: customers.results,
      users: users.results,
      purchaseOrders: purchaseOrders.results,
      transfers: transfers.results,
      sales: sales.results,
    });
  } catch (error) {
    return bad(
      error instanceof Error ? error.message : 'Unable to load POS data',
      500,
    );
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb();
    await seedIfEmpty(db);
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || '');
    const now = new Date().toISOString();
    const actingUserId = Number(body.userId);
    const requestedClientId = Number(body.clientId);
    const actor = await db
      .prepare<{
        id: number;
        client_id: number;
        default_location_id: number;
        role: string;
        status: string;
      }>(
        'SELECT id,client_id,default_location_id,role,status FROM users WHERE id=?',
      )
      .bind(actingUserId)
      .first();
    if (!actor || actor.status !== 'Active')
      return bad('An active user session is required', 401);
    if (requestedClientId && actor.client_id !== requestedClientId)
      return bad('This user does not belong to the selected client', 403);
    const normalizedRole = actor.role.toLowerCase();
    const isAdministrator = normalizedRole.includes('administrator');
    const isManager = normalizedRole.includes('manager');
    const cashierActions = new Set(['sale', 'customer']);
    const managerActions = new Set([
      ...cashierActions,
      'purchaseOrder',
      'transfer',
      'receiveTransfer',
      'user',
    ]);
    if (
      !isAdministrator &&
      !(isManager ? managerActions : cashierActions).has(action)
    )
      return bad(`${actor.role} users cannot perform this action`, 403);
    if (action === 'customer') {
      const clientId = Number(body.clientId),
        name = String(body.name || '').trim();
      if (!clientId || !name)
        return bad('Client and customer name are required');
      const result = await db
        .prepare(
          'INSERT INTO customers (client_id,name,email,phone,created_at) VALUES (?,?,?,?,?)',
        )
        .bind(
          clientId,
          name,
          String(body.email || ''),
          String(body.phone || ''),
          now,
        )
        .run();
      return json({ ok: true, id: result.meta.last_row_id }, 201);
    }
    if (action === 'user') {
      const clientId = Number(body.clientId),
        locationId = Number(body.defaultLocationId),
        name = String(body.name || '').trim(),
        email = String(body.email || '').trim();
      if (!clientId || !locationId || !name || !email)
        return bad('Name, email and default store are required');
      const requestedRole = String(body.role || 'Cashier');
      if (
        isManager &&
        (requestedRole.toLowerCase() !== 'cashier' ||
          locationId !== actor.default_location_id)
      )
        return bad(
          'Store managers may only create cashiers for their assigned store',
          403,
        );
      const result = await db
        .prepare(
          'INSERT INTO users (client_id,default_location_id,name,email,role,status) VALUES (?,?,?,?,?,?)',
        )
        .bind(
          clientId,
          locationId,
          name,
          email,
          requestedRole,
          'Active',
        )
        .run();
      return json({ ok: true, id: result.meta.last_row_id }, 201);
    }
    if (action === 'purchaseOrder') {
      const clientId = Number(body.clientId),
        locationId = Number(body.destinationLocationId),
        supplier = String(body.supplier || '').trim(),
        total = Number(body.total);
      if (!clientId || !locationId || !supplier || total < 0)
        return bad('Supplier, destination and valid total are required');
      if (isManager && locationId !== actor.default_location_id)
        return bad('Store managers may only order for their assigned store', 403);
      const result = await db
        .prepare(
          'INSERT INTO purchase_orders (client_id,destination_location_id,supplier,status,total,created_at) VALUES (?,?,?,?,?,?)',
        )
        .bind(clientId, locationId, supplier, 'Draft', total, now)
        .run();
      return json({ ok: true, id: result.meta.last_row_id }, 201);
    }
    if (action === 'transfer') {
      const clientId = Number(body.clientId),
        from = Number(body.fromLocationId),
        to = Number(body.toLocationId),
        productId = Number(body.productId),
        quantity = Number(body.quantity);
      if (
        !clientId ||
        !from ||
        !to ||
        !productId ||
        quantity <= 0 ||
        from === to
      )
        return bad(
          'Valid origin, destination, product and quantity are required',
        );
      if (isManager && to !== actor.default_location_id)
        return bad(
          'Store managers may only request transfers to their assigned store',
          403,
        );
      const source = await db
        .prepare<{ quantity: number }>(
          'SELECT quantity FROM inventory WHERE client_id=? AND location_id=? AND product_id=?',
        )
        .bind(clientId, from, productId)
        .first();
      if (!source || source.quantity < quantity)
        return bad('Not enough stock at the source location');
      const result = await db
        .prepare(
          'INSERT INTO stock_transfers (client_id,from_location_id,to_location_id,product_id,quantity,status,created_at) VALUES (?,?,?,?,?,?,?)',
        )
        .bind(clientId, from, to, productId, quantity, 'Dispatched', now)
        .run();
      return json({ ok: true, id: result.meta.last_row_id }, 201);
    }
    if (action === 'receiveTransfer') {
      const id = Number(body.id);
      const transfer = await db
        .prepare<{
          status: string;
          from_location_id: number;
          to_location_id: number;
          product_id: number;
          quantity: number;
        }>(
          'SELECT status,from_location_id,to_location_id,product_id,quantity FROM stock_transfers WHERE id=?',
        )
        .bind(id)
        .first();
      if (!transfer || transfer.status === 'Received')
        return bad('Transfer is unavailable or already received');
      if (isManager && transfer.to_location_id !== actor.default_location_id)
        return bad(
          'Store managers may only receive transfers for their assigned store',
          403,
        );
      await db.batch([
        db
          .prepare(
            'UPDATE inventory SET quantity=quantity-? WHERE location_id=? AND product_id=? AND quantity>=?',
          )
          .bind(
            transfer.quantity,
            transfer.from_location_id,
            transfer.product_id,
            transfer.quantity,
          ),
        db
          .prepare(
            'UPDATE inventory SET quantity=quantity+? WHERE location_id=? AND product_id=?',
          )
          .bind(
            transfer.quantity,
            transfer.to_location_id,
            transfer.product_id,
          ),
        db
          .prepare("UPDATE stock_transfers SET status='Received' WHERE id=?")
          .bind(id),
      ]);
      return json({ ok: true });
    }
    if (action === 'sale') {
      const clientId = Number(body.clientId),
        locationId = Number(body.locationId),
        userId = Number(body.userId),
        customerId = body.customerId ? Number(body.customerId) : null,
        paymentMethod = String(body.paymentMethod || 'Card'),
        cashReceived =
          body.cashReceived == null ? null : Number(body.cashReceived),
        items = Array.isArray(body.items)
          ? (body.items as { productId: number; quantity: number }[])
          : [];
      if (!clientId || !locationId || !userId || !items.length)
        return bad('Sale location, cashier and items are required');
      if (!isAdministrator && !isManager && locationId !== actor.default_location_id)
        return bad('Cashiers can only sell from their assigned default store', 403);
      const ids = items.map((i) => Number(i.productId));
      const { results: rows } = await db
        .prepare<{ id: number; price: number; stock: number }>(
          `SELECT p.id,p.price,i.quantity AS stock FROM products p JOIN inventory i ON i.product_id=p.id AND i.location_id=? WHERE p.client_id=? AND p.id IN (${ids.map(() => '?').join(',')})`,
        )
        .bind(locationId, clientId, ...ids)
        .all();
      if (rows.length !== ids.length)
        return bad('One or more products are unavailable');
      for (const item of items) {
        const row = rows.find((r) => r.id === Number(item.productId));
        if (!row || item.quantity <= 0 || row.stock < item.quantity)
          return bad(`Insufficient stock for product ${item.productId}`);
      }
      const total = items.reduce(
          (sum, item) =>
            sum +
            (rows.find((r) => r.id === Number(item.productId))?.price || 0) *
              item.quantity,
          0,
        ),
        tax = total - total / 1.15;
      if (paymentMethod === 'Cash' && (cashReceived ?? 0) < total)
        return bad('Cash received is less than the sale total');
      const receipt = `POS-${Date.now().toString(36).toUpperCase()}`;
      const sale = await db
        .prepare(
          'INSERT INTO sales (client_id,location_id,user_id,customer_id,receipt_number,payment_method,subtotal,tax,total,cash_received,change_given,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        )
        .bind(
          clientId,
          locationId,
          userId,
          customerId,
          receipt,
          paymentMethod,
          total - tax,
          tax,
          total,
          cashReceived,
          cashReceived == null ? null : cashReceived - total,
          now,
        )
        .run();
      const saleId = Number(sale.meta.last_row_id);
      const statements = [];
      for (const item of items) {
        const row = rows.find((r) => r.id === Number(item.productId))!;
        statements.push(
          db
            .prepare(
              'INSERT INTO sale_items (sale_id,product_id,quantity,unit_price) VALUES (?,?,?,?)',
            )
            .bind(saleId, item.productId, item.quantity, row.price),
          db
            .prepare(
              'UPDATE inventory SET quantity=quantity-? WHERE client_id=? AND location_id=? AND product_id=?',
            )
            .bind(item.quantity, clientId, locationId, item.productId),
        );
      }
      await db.batch(statements);
      return json(
        {
          ok: true,
          id: saleId,
          receipt,
          total,
          change: cashReceived == null ? null : cashReceived - total,
        },
        201,
      );
    }
    return bad('Unknown action');
  } catch (error) {
    return bad(error instanceof Error ? error.message : 'Posting failed', 500);
  }
}
