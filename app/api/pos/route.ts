import { ensureProductBarcodes, getDb, seedIfEmpty } from '@/lib/db';

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const bad = (message: string, status = 400) => json({ error: message }, status);

const melroseCellphoneData = [
  ['MOB-VOD-500D', '6002001000013', 'Vodacom 500MB Daily', 19, 17, 80],
  ['MOB-VOD-1GB', '6002001000020', 'Vodacom 1GB Monthly', 85, 78, 65],
  ['MOB-VOD-2GB', '6002001000037', 'Vodacom 2GB Monthly', 149, 137, 44],
  ['MOB-MTN-1GB', '6002001000044', 'MTN 1GB Monthly', 89, 81, 72],
  ['MOB-MTN-3GB', '6002001000051', 'MTN 3GB Monthly', 199, 184, 36],
  ['MOB-CELLC-1GB', '6002001000068', 'Cell C 1GB Monthly', 65, 59, 51],
  ['MOB-TEL-2GB', '6002001000075', 'Telkom 2GB Monthly', 99, 90, 58],
  ['MOB-TEL-5GB', '6002001000082', 'Telkom 5GB Monthly', 199, 182, 33],
  ['MOB-RAIN-5GB', '6002001000099', 'Rain 5GB Any-Use', 250, 230, 28],
  ['MOB-AFRI-10GB', '6002001000105', 'Afrihost 10GB Mobile', 399, 368, 22],
] as const;

export async function GET(request: Request) {
  try {
    const db = getDb();
    await seedIfEmpty(db);
    await ensureProductBarcodes(db);
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
          }>(
            'SELECT id,client_id,default_location_id,role,status FROM users WHERE id=?',
          )
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
      heldSales,
      heldSaleItems,
      products,
      customers,
      users,
      purchaseOrders,
      transfers,
      sales,
      adjustmentLogs,
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
            ? 'SELECT h.*,l.name AS location_name,u.name AS cashier_name,c.name AS customer_name FROM held_sales h JOIN locations l ON l.id=h.location_id JOIN users u ON u.id=h.user_id LEFT JOIN customers c ON c.id=h.customer_id WHERE h.client_id=? ORDER BY h.id DESC'
            : isManager
              ? 'SELECT h.*,l.name AS location_name,u.name AS cashier_name,c.name AS customer_name FROM held_sales h JOIN locations l ON l.id=h.location_id JOIN users u ON u.id=h.user_id LEFT JOIN customers c ON c.id=h.customer_id WHERE h.client_id=? AND h.location_id=? ORDER BY h.id DESC'
              : 'SELECT h.*,l.name AS location_name,u.name AS cashier_name,c.name AS customer_name FROM held_sales h JOIN locations l ON l.id=h.location_id JOIN users u ON u.id=h.user_id LEFT JOIN customers c ON c.id=h.customer_id WHERE h.client_id=? AND h.location_id=? AND h.user_id=? ORDER BY h.id DESC',
        )
        .bind(
          ...(isAdministrator
            ? [clientId]
            : isManager
              ? [clientId, scopedLocationId]
              : [clientId, scopedLocationId, actingUserId]),
        )
        .all(),
      db
        .prepare(
          isAdministrator
            ? 'SELECT hi.* FROM held_sale_items hi JOIN held_sales h ON h.id=hi.held_sale_id WHERE h.client_id=?'
            : isManager
              ? 'SELECT hi.* FROM held_sale_items hi JOIN held_sales h ON h.id=hi.held_sale_id WHERE h.client_id=? AND h.location_id=?'
              : 'SELECT hi.* FROM held_sale_items hi JOIN held_sales h ON h.id=hi.held_sale_id WHERE h.client_id=? AND h.location_id=? AND h.user_id=?',
        )
        .bind(
          ...(isAdministrator
            ? [clientId]
            : isManager
              ? [clientId, scopedLocationId]
              : [clientId, scopedLocationId, actingUserId]),
        )
        .all(),
      db
        .prepare(
          isAdministrator
            ? "SELECT p.*,i.quantity AS stock,i.location_id,i.reorder_level,i.show_on_pos,COALESCE((SELECT SUM(t.quantity) FROM stock_transfers t WHERE t.client_id=p.client_id AND t.from_location_id=i.location_id AND t.product_id=p.id AND t.status!='Received'),0) AS committed_stock FROM products p JOIN inventory i ON i.product_id=p.id WHERE p.client_id=? ORDER BY p.name"
            : isManager
              ? "SELECT p.*,i.quantity AS stock,i.location_id,i.reorder_level,i.show_on_pos,COALESCE((SELECT SUM(t.quantity) FROM stock_transfers t WHERE t.client_id=p.client_id AND t.from_location_id=i.location_id AND t.product_id=p.id AND t.status!='Received'),0) AS committed_stock FROM products p JOIN inventory i ON i.product_id=p.id JOIN locations l ON l.id=i.location_id WHERE p.client_id=? AND (i.location_id=? OR l.type='warehouse') ORDER BY p.name"
              : "SELECT p.*,i.quantity AS stock,i.location_id,i.reorder_level,i.show_on_pos,COALESCE((SELECT SUM(t.quantity) FROM stock_transfers t WHERE t.client_id=p.client_id AND t.from_location_id=i.location_id AND t.product_id=p.id AND t.status!='Received'),0) AS committed_stock FROM products p JOIN inventory i ON i.product_id=p.id WHERE p.client_id=? AND i.location_id=? ORDER BY p.name",
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
        .bind(
          ...(isAdministrator
            ? [clientId]
            : isManager
              ? [clientId, scopedLocationId]
              : [clientId, actingUserId]),
        )
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
        .bind(
          ...(isManager
            ? [clientId, scopedLocationId, scopedLocationId]
            : [clientId]),
        )
        .all(),
      db
        .prepare(
          isAdministrator
            ? 'SELECT s.*,l.name AS location_name,u.name AS cashier_name,c.name AS customer_name FROM sales s JOIN locations l ON l.id=s.location_id JOIN users u ON u.id=s.user_id LEFT JOIN customers c ON c.id=s.customer_id WHERE s.client_id=? ORDER BY s.id DESC LIMIT 50'
            : 'SELECT s.*,l.name AS location_name,u.name AS cashier_name,c.name AS customer_name FROM sales s JOIN locations l ON l.id=s.location_id JOIN users u ON u.id=s.user_id LEFT JOIN customers c ON c.id=s.customer_id WHERE s.client_id=? AND s.location_id=? ORDER BY s.id DESC LIMIT 50',
        )
        .bind(...(isAdministrator ? [clientId] : [clientId, scopedLocationId]))
        .all(),
      isAdministrator || isManager
        ? db.prepare('SELECT a.*,u.name AS user_name FROM adjustment_logs a JOIN users u ON u.id=a.user_id WHERE a.client_id=? ORDER BY a.id DESC LIMIT 250').bind(clientId).all()
        : db.prepare('SELECT * FROM adjustment_logs WHERE client_id=? AND 0').bind(clientId).all(),
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
      heldSales: heldSales.results,
      heldSaleItems: heldSaleItems.results,
      adjustmentLogs: adjustmentLogs.results,
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
    await ensureProductBarcodes(db);
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
    const audit = async (actionName: string, entity: string, recordId: number | null, summary: string) => {
      await db.prepare('INSERT INTO adjustment_logs (client_id,user_id,action,entity,record_id,summary,created_at) VALUES (?,?,?,?,?,?,?)').bind(actor.client_id, actor.id, actionName, entity, recordId, summary, now).run();
    };
    const cashierActions = new Set(['sale', 'customer', 'hold', 'deleteHold']);
    const managerActions = new Set([
      ...cashierActions,
      'purchaseOrder',
      'transfer',
      'receiveTransfer',
      'user',
      'setPosVisibility',
    ]);
    if (
      !isAdministrator &&
      !(isManager ? managerActions : cashierActions).has(action)
    )
      return bad(`${actor.role} users cannot perform this action`, 403);
    if (action === 'installMelroseCellphoneDemo') {
      if (!isAdministrator) return bad('Only client administrators can install sample data', 403);
      const location = await db.prepare<{ id: number }>("SELECT id FROM locations WHERE client_id=? AND lower(name)='melrose store' AND type='store'").bind(actor.client_id).first();
      if (!location) return bad('Melrose store was not found for this client', 404);
      await db.prepare('UPDATE inventory SET show_on_pos=0 WHERE client_id=? AND location_id=?').bind(actor.client_id, location.id).run();
      for (const [sku, barcode, name, price, cost, stock] of melroseCellphoneData) {
        await db.prepare("INSERT INTO products (client_id,sku,barcode,name,category,price,cost,icon,color) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(client_id,sku) DO UPDATE SET barcode=excluded.barcode,name=excluded.name,category=excluded.category,price=excluded.price,cost=excluded.cost,icon=excluded.icon,color=excluded.color").bind(actor.client_id, sku, barcode, name, 'Cellphone data', price, cost, '📶', '#d9e3ea').run();
        const product = await db.prepare<{ id: number }>('SELECT id FROM products WHERE client_id=? AND sku=?').bind(actor.client_id, sku).first();
        if (product) await db.prepare('INSERT INTO inventory (client_id,location_id,product_id,quantity,reorder_level,show_on_pos) VALUES (?,?,?,?,?,1) ON CONFLICT(location_id,product_id) DO UPDATE SET quantity=excluded.quantity,reorder_level=excluded.reorder_level,show_on_pos=1').bind(actor.client_id, location.id, product.id, stock, 15).run();
      }
      await audit('Installed', 'Sample catalogue', location.id, `Displayed ${melroseCellphoneData.length} cellphone data products at Melrose Store; retained prior inventory as hidden items`);
      return json({ ok: true, locationId: location.id, products: melroseCellphoneData.length });
    }
    if (action === 'setPosVisibility') {
      const clientId = actor.client_id,
        locationId = Number(body.locationId),
        productId = Number(body.productId),
        visible = body.visible === true || body.visible === 1 || body.visible === '1';
      if (!locationId || !productId) return bad('Store and product are required');
      if (isManager && locationId !== actor.default_location_id)
        return bad('Store managers may only configure their assigned store', 403);
      const result = await db.prepare('UPDATE inventory SET show_on_pos=? WHERE client_id=? AND location_id=? AND product_id=?').bind(visible ? 1 : 0, clientId, locationId, productId).run();
      if (!result.meta.changes) return bad('Product inventory record not found', 404);
      await audit('Updated', 'POS product visibility', productId, `${visible ? 'Displayed' : 'Hidden'} product #${productId} on the sales screen at location #${locationId}`);
      return json({ ok: true });
    }
    if (action === 'adminCrud') {
      if (!isAdministrator)
        return bad('Only client administrators can manage these records', 403);
      const entity = String(body.entity || ''),
        operation = String(body.operation || ''),
        id = Number(body.id || 0),
        clientId = actor.client_id;
      if (!['create', 'update', 'delete'].includes(operation))
        return bad('A valid CRUD operation is required');

      if (entity === 'client') {
        if (operation !== 'update')
          return bad('Client administrators may update, but not create or delete, their company');
        const name = String(body.name || '').trim(),
          code = String(body.code || '').trim().toUpperCase();
        if (!name || !code) return bad('Company name and code are required');
        await db.prepare('UPDATE clients SET name=?,code=? WHERE id=?').bind(name, code, clientId).run();
        await audit('Updated', 'Client', clientId, `Updated company details for ${name}`);
        return json({ ok: true });
      }

      if (entity === 'location') {
        if (operation === 'delete') {
          const result = await db.prepare('DELETE FROM locations WHERE id=? AND client_id=?').bind(id, clientId).run();
          if (!result.meta.changes) return bad('Site not found', 404);
          await audit('Deleted', 'Site', id, `Deleted site record #${id}`);
          return json({ ok: true });
        }
        const name = String(body.name || '').trim(),
          type = String(body.type || 'store'),
          address = String(body.address || '').trim();
        if (!name || !['store', 'warehouse'].includes(type)) return bad('Site name and type are required');
        if (operation === 'create') {
          const result = await db.prepare('INSERT INTO locations (client_id,name,type,address) VALUES (?,?,?,?)').bind(clientId, name, type, address).run();
          await audit('Created', 'Site', Number(result.meta.last_row_id), `Created ${type} ${name}`);
          return json({ ok: true, id: result.meta.last_row_id }, 201);
        }
        await db.prepare('UPDATE locations SET name=?,type=?,address=? WHERE id=? AND client_id=?').bind(name, type, address, id, clientId).run();
        await audit('Updated', 'Site', id, `Updated ${type} ${name}`);
        return json({ ok: true });
      }

      if (entity === 'product') {
        if (operation === 'delete') {
          await db.batch([
            db.prepare('DELETE FROM inventory WHERE product_id=? AND client_id=?').bind(id, clientId),
            db.prepare('DELETE FROM products WHERE id=? AND client_id=?').bind(id, clientId),
          ]);
          await audit('Deleted', 'Product', id, `Deleted product record #${id}`);
          return json({ ok: true });
        }
        const name = String(body.name || '').trim(), sku = String(body.sku || '').trim(),
          barcode = String(body.barcode || '').trim(), category = String(body.category || '').trim(),
          price = Number(body.price), cost = Number(body.cost), locationId = Number(body.locationId),
          stock = Math.max(0, Number(body.stock || 0)), reorderLevel = Math.max(0, Number(body.reorderLevel ?? 5));
        const location = await db.prepare('SELECT id FROM locations WHERE id=? AND client_id=?').bind(locationId, clientId).first();
        if (!name || !sku || price < 0 || cost < 0 || !location) return bad('Valid product, pricing and location details are required');
        if (operation === 'update') {
          const committed = await db.prepare<{ quantity: number }>("SELECT COALESCE(SUM(quantity),0) AS quantity FROM stock_transfers WHERE client_id=? AND from_location_id=? AND product_id=? AND status!='Received'").bind(clientId, locationId, id).first();
          if (stock < Number(committed?.quantity || 0)) return bad('On-hand stock cannot be lower than stock committed to open transfers');
        }
        let productId = id;
        if (operation === 'create') {
          const result = await db.prepare('INSERT INTO products (client_id,sku,barcode,name,category,price,cost,icon,color) VALUES (?,?,?,?,?,?,?,?,?)').bind(clientId, sku, barcode || null, name, category, price, cost, 'Package', '#35383c').run();
          productId = Number(result.meta.last_row_id);
        } else {
          await db.prepare('UPDATE products SET sku=?,barcode=?,name=?,category=?,price=?,cost=? WHERE id=? AND client_id=?').bind(sku, barcode || null, name, category, price, cost, id, clientId).run();
        }
        await db.prepare('INSERT INTO inventory (client_id,location_id,product_id,quantity,reorder_level) VALUES (?,?,?,?,?) ON CONFLICT(location_id,product_id) DO UPDATE SET quantity=excluded.quantity,reorder_level=excluded.reorder_level').bind(clientId, locationId, productId, stock, reorderLevel).run();
        await audit(operation === 'create' ? 'Created' : 'Updated', 'Product', productId, `${operation === 'create' ? 'Created' : 'Updated'} ${name}; stock at location #${locationId} set to ${stock}`);
        return json({ ok: true, id: productId }, operation === 'create' ? 201 : 200);
      }

      if (entity === 'customer') {
        if (operation === 'delete') {
          await db.prepare('DELETE FROM customers WHERE id=? AND client_id=?').bind(id, clientId).run();
          await audit('Deleted', 'Customer', id, `Deleted customer record #${id}`);
          return json({ ok: true });
        }
        const name = String(body.name || '').trim(), email = String(body.email || '').trim(), phone = String(body.phone || '').trim();
        if (!name) return bad('Customer name is required');
        if (operation === 'create') {
          const result = await db.prepare('INSERT INTO customers (client_id,name,email,phone,created_at) VALUES (?,?,?,?,?)').bind(clientId, name, email, phone, now).run();
          await audit('Created', 'Customer', Number(result.meta.last_row_id), `Created customer ${name}`);
          return json({ ok: true, id: result.meta.last_row_id }, 201);
        }
        await db.prepare('UPDATE customers SET name=?,email=?,phone=? WHERE id=? AND client_id=?').bind(name, email, phone, id, clientId).run();
        await audit('Updated', 'Customer', id, `Updated customer ${name}`);
        return json({ ok: true });
      }

      if (entity === 'user') {
        if (operation === 'delete') {
          if (id === actor.id) return bad('You cannot delete your own active account');
          await db.prepare('DELETE FROM users WHERE id=? AND client_id=?').bind(id, clientId).run();
          await audit('Deleted', 'User', id, `Deleted user record #${id}`);
          return json({ ok: true });
        }
        const name = String(body.name || '').trim(), email = String(body.email || '').trim(),
          role = String(body.role || 'Cashier'), status = String(body.status || 'Active'), locationId = Number(body.defaultLocationId);
        if (!name || !email || !locationId) return bad('Name, email and default store are required');
        if (operation === 'create') {
          const result = await db.prepare('INSERT INTO users (client_id,default_location_id,name,email,role,status) VALUES (?,?,?,?,?,?)').bind(clientId, locationId, name, email, role, status).run();
          await audit('Created', 'User', Number(result.meta.last_row_id), `Created ${role} ${name}`);
          return json({ ok: true, id: result.meta.last_row_id }, 201);
        }
        await db.prepare('UPDATE users SET default_location_id=?,name=?,email=?,role=?,status=? WHERE id=? AND client_id=?').bind(locationId, name, email, role, status, id, clientId).run();
        await audit('Updated', 'User', id, `Updated ${role} ${name}; status ${status}`);
        return json({ ok: true });
      }

      if (entity === 'purchaseOrder') {
        if (operation === 'delete') {
          await db.prepare("DELETE FROM purchase_orders WHERE id=? AND client_id=? AND status='Draft'").bind(id, clientId).run();
          await audit('Deleted', 'Purchase order', id, `Deleted draft purchase order #${id}`);
          return json({ ok: true });
        }
        const supplier = String(body.supplier || '').trim(), locationId = Number(body.destinationLocationId),
          total = Number(body.total), status = String(body.status || 'Draft');
        if (!supplier || !locationId || total < 0) return bad('Supplier, destination and valid total are required');
        if (operation === 'create') {
          const result = await db.prepare('INSERT INTO purchase_orders (client_id,destination_location_id,supplier,status,total,created_at) VALUES (?,?,?,?,?,?)').bind(clientId, locationId, supplier, status, total, now).run();
          await audit('Created', 'Purchase order', Number(result.meta.last_row_id), `Created ${status} order for ${supplier}`);
          return json({ ok: true, id: result.meta.last_row_id }, 201);
        }
        await db.prepare('UPDATE purchase_orders SET destination_location_id=?,supplier=?,status=?,total=? WHERE id=? AND client_id=?').bind(locationId, supplier, status, total, id, clientId).run();
        await audit('Updated', 'Purchase order', id, `Updated order for ${supplier}; status ${status}`);
        return json({ ok: true });
      }
      return bad('This table is not available for client administration');
    }
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
      await audit('Created', 'Customer', Number(result.meta.last_row_id), `Created customer ${name}`);
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
        .bind(clientId, locationId, name, email, requestedRole, 'Active')
        .run();
      await audit('Created', 'User', Number(result.meta.last_row_id), `Created ${requestedRole} ${name}`);
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
        return bad(
          'Store managers may only order for their assigned store',
          403,
        );
      const result = await db
        .prepare(
          'INSERT INTO purchase_orders (client_id,destination_location_id,supplier,status,total,created_at) VALUES (?,?,?,?,?,?)',
        )
        .bind(clientId, locationId, supplier, 'Draft', total, now)
        .run();
      await audit('Created', 'Purchase order', Number(result.meta.last_row_id), `Created draft order for ${supplier}`);
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
      const committed = await db
        .prepare<{ quantity: number }>(
          "SELECT COALESCE(SUM(quantity),0) AS quantity FROM stock_transfers WHERE client_id=? AND from_location_id=? AND product_id=? AND status!='Received'",
        )
        .bind(clientId, from, productId)
        .first();
      if (source.quantity - Number(committed?.quantity || 0) < quantity)
        return bad('Not enough available stock after open transfers');
      const result = await db
        .prepare(
          'INSERT INTO stock_transfers (client_id,from_location_id,to_location_id,product_id,quantity,status,created_at) VALUES (?,?,?,?,?,?,?)',
        )
        .bind(clientId, from, to, productId, quantity, 'Dispatched', now)
        .run();
      await audit('Created', 'Stock transfer', Number(result.meta.last_row_id), `Dispatched ${quantity} units of product #${productId} from location #${from} to #${to}`);
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
      const sourceStock = await db
        .prepare<{ quantity: number }>(
          'SELECT quantity FROM inventory WHERE location_id=? AND product_id=?',
        )
        .bind(transfer.from_location_id, transfer.product_id)
        .first();
      if (!sourceStock || sourceStock.quantity < transfer.quantity)
        return bad('Source stock is no longer sufficient to receive this transfer');
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
      await audit('Received', 'Stock transfer', id, `Received ${transfer.quantity} units of product #${transfer.product_id}; stock moved from location #${transfer.from_location_id} to #${transfer.to_location_id}`);
      return json({ ok: true });
    }
    if (action === 'hold') {
      const clientId = Number(body.clientId),
        locationId = Number(body.locationId),
        customerId = body.customerId ? Number(body.customerId) : null,
        reference =
          String(body.reference || '').trim() || `Held by ${actor.role}`,
        items = Array.isArray(body.items)
          ? (body.items as { productId: number; quantity: number }[])
          : [];
      if (!clientId || !locationId || !items.length)
        return bad('A store and at least one item are required');
      if (!isAdministrator && locationId !== actor.default_location_id)
        return bad('You can only hold sales at your assigned store', 403);
      const ids = items.map((item) => Number(item.productId));
      const { results: rows } = await db
        .prepare<{ id: number; price: number }>(
          `SELECT id,price FROM products WHERE client_id=? AND id IN (${ids.map(() => '?').join(',')})`,
        )
        .bind(clientId, ...ids)
        .all();
      if (
        rows.length !== ids.length ||
        items.some((item) => item.quantity <= 0)
      )
        return bad('One or more held-sale items are invalid');
      const total = items.reduce(
        (sum, item) =>
          sum +
          (rows.find((row) => row.id === Number(item.productId))?.price || 0) *
            item.quantity,
        0,
      );
      const held = await db
        .prepare(
          'INSERT INTO held_sales (client_id,location_id,user_id,customer_id,reference,total,created_at) VALUES (?,?,?,?,?,?,?)',
        )
        .bind(
          clientId,
          locationId,
          actingUserId,
          customerId,
          reference,
          total,
          now,
        )
        .run();
      const heldSaleId = Number(held.meta.last_row_id);
      await db.batch(
        items.map((item) =>
          db
            .prepare(
              'INSERT INTO held_sale_items (held_sale_id,product_id,quantity,unit_price) VALUES (?,?,?,?)',
            )
            .bind(
              heldSaleId,
              item.productId,
              item.quantity,
              rows.find((row) => row.id === Number(item.productId))!.price,
            ),
        ),
      );
      await audit('Created', 'Held sale', heldSaleId, `Held sale ${reference} for ${items.length} line items`);
      return json({ ok: true, id: heldSaleId, reference, total }, 201);
    }
    if (action === 'deleteHold') {
      const id = Number(body.id);
      const hold = await db
        .prepare<{ client_id: number; location_id: number; user_id: number }>(
          'SELECT client_id,location_id,user_id FROM held_sales WHERE id=?',
        )
        .bind(id)
        .first();
      if (!hold || hold.client_id !== actor.client_id)
        return bad('Held sale not found', 404);
      if (
        (!isAdministrator && hold.location_id !== actor.default_location_id) ||
        (!isAdministrator && !isManager && hold.user_id !== actor.id)
      )
        return bad('You cannot release this held sale', 403);
      await db.batch([
        db.prepare('DELETE FROM held_sale_items WHERE held_sale_id=?').bind(id),
        db.prepare('DELETE FROM held_sales WHERE id=?').bind(id),
      ]);
      await audit('Deleted', 'Held sale', id, `Released held sale #${id}`);
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
        holdId = body.holdId ? Number(body.holdId) : null,
        items = Array.isArray(body.items)
          ? (body.items as { productId: number; quantity: number }[])
          : [];
      if (!clientId || !locationId || !userId || !items.length)
        return bad('Sale location, cashier and items are required');
      if (
        !isAdministrator &&
        !isManager &&
        locationId !== actor.default_location_id
      )
        return bad(
          'Cashiers can only sell from their assigned default store',
          403,
        );
      if (holdId) {
        const held = await db
          .prepare<{ client_id: number; location_id: number; user_id: number }>(
            'SELECT client_id,location_id,user_id FROM held_sales WHERE id=?',
          )
          .bind(holdId)
          .first();
        if (
          !held ||
          held.client_id !== clientId ||
          held.location_id !== locationId ||
          (!isAdministrator && !isManager && held.user_id !== actor.id)
        )
          return bad('The held sale is not available to this user', 403);
      }
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
      if (holdId) {
        statements.push(
          db
            .prepare('DELETE FROM held_sale_items WHERE held_sale_id=?')
            .bind(holdId),
          db.prepare('DELETE FROM held_sales WHERE id=?').bind(holdId),
        );
      }
      await db.batch(statements);
      await audit('Posted', 'Sale', saleId, `Posted ${paymentMethod} sale ${receipt}; total ${total.toFixed(2)}; inventory deducted at location #${locationId}`);
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
