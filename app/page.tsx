'use client';
import {
  BadgeDollarSign,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  CreditCard,
  LayoutGrid,
  MapPin,
  Menu,
  Minus,
  PackageCheck,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  ShoppingCart,
  Store,
  Tag,
  Trash2,
  Truck,
  UserCog,
  Users,
  Warehouse,
  WalletCards,
  X,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';
type Client = { id: number; name: string; code: string };
type Location = {
  id: number;
  client_id: number;
  name: string;
  type: 'store' | 'warehouse';
  address: string;
};
type Product = {
  id: number;
  sku: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  icon: string;
  color: string;
  stock: number;
  location_id: number;
};
type Customer = { id: number; name: string; email: string; phone: string };
type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  default_location_id: number;
};
type PO = {
  id: number;
  supplier: string;
  status: string;
  total: number;
  destination: string;
};
type Transfer = {
  id: number;
  origin: string;
  destination: string;
  product_name: string;
  quantity: number;
  status: string;
};
type Sale = {
  id: number;
  receipt_number: string;
  total: number;
  payment_method: string;
  location_name: string;
  cashier_name: string;
  customer_name?: string;
};
type Data = {
  clients: Client[];
  locations: Location[];
  products: Product[];
  customers: Customer[];
  users: User[];
  purchaseOrders: PO[];
  transfers: Transfer[];
  sales: Sale[];
};
type CartLine = Product & { quantity: number };
const navItems = [
  ['Sell', ShoppingBag],
  ['Sites', Building2],
  ['Inventory', Boxes],
  ['Distribution', Warehouse],
  ['Customers', Users],
  ['Users', UserCog],
  ['Purchase orders', Truck],
  ['Reports', BarChart3],
] as const;
const money = (v: number) => `R ${Number(v || 0).toFixed(2)}`;
const initials = (n: string) =>
  n
    .split(' ')
    .map((x) => x[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
export default function Home() {
  const [data, setData] = useState<Data | null>(null),
    [clientId, setClientId] = useState(1),
    [siteId, setSiteId] = useState(0),
    [userId, setUserId] = useState(0),
    [activeNav, setActiveNav] = useState('Sell'),
    [category, setCategory] = useState('All items'),
    [query, setQuery] = useState(''),
    [cart, setCart] = useState<CartLine[]>([]),
    [customerId, setCustomerId] = useState<number>(),
    [menuOpen, setMenuOpen] = useState(false),
    [clientMenu, setClientMenu] = useState(false),
    [userMenu, setUserMenu] = useState(false),
    [dialog, setDialog] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const load = useCallback(
    async (id = clientId) => {
      const r = await fetch(`/api/pos?clientId=${id}`, { cache: 'no-store' }),
        body = await r.json();
      if (!r.ok) throw new Error(body.error || 'Could not load data');
      setData(body);
      const stores = body.locations.filter((l: Location) => l.type === 'store');
      setSiteId((x) =>
        stores.some((s: Location) => s.id === x)
          ? x
          : body.users[0]?.default_location_id || stores[0]?.id || 0,
      );
      setUserId((x) =>
        body.users.some((u: User) => u.id === x) ? x : body.users[0]?.id || 0,
      );
    },
    [clientId],
  );
  useEffect(() => {
    load().catch((e) => setNotice(e.message));
  }, [load]);
  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    setNotice('');
    try {
      const r = await fetch('/api/pos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
        result = await r.json();
      if (!r.ok) throw new Error(result.error || 'Posting failed');
      await load();
      setDialog(null);
      return result;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Posting failed');
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const clients = data?.clients || [],
    locations = data?.locations || [],
    stores = locations.filter((l) => l.type === 'store'),
    warehouse = locations.find((l) => l.type === 'warehouse'),
    client = clients.find((c) => c.id === clientId),
    site = stores.find((s) => s.id === siteId),
    user = data?.users.find((u) => u.id === userId),
    siteProducts = (data?.products || []).filter(
      (p) => p.location_id === siteId,
    ),
    categories = ['All items', ...new Set(siteProducts.map((p) => p.category))],
    filtered = siteProducts.filter(
      (p) =>
        (category === 'All items' || p.category === category) &&
        p.name.toLowerCase().includes(query.toLowerCase()),
    ),
    subtotal = cart.reduce((s, l) => s + l.price * l.quantity, 0),
    tax = subtotal - subtotal / 1.15;
  const add = (p: Product) =>
    setCart((c) => {
      const f = c.find((x) => x.id === p.id);
      if (f && f.quantity >= p.stock) return c;
      return f
        ? c.map((x) => (x.id === p.id ? { ...x, quantity: x.quantity + 1 } : x))
        : [...c, { ...p, quantity: 1 }];
    });
  const change = (id: number, n: number) =>
    setCart((c) =>
      c
        .map((x) =>
          x.id === id
            ? { ...x, quantity: Math.min(x.stock, x.quantity + n) }
            : x,
        )
        .filter((x) => x.quantity > 0),
    );
  if (!data)
    return (
      <main className="loading-screen">
        <span className="brand-mark">
          <BadgeDollarSign />
        </span>
        <strong>Opening POSPerity…</strong>
        <small>{notice || 'Connecting to live records'}</small>
      </main>
    );
  return (
    <main className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <button className="sidebar-close" onClick={() => setMenuOpen(false)}>
          <X />
        </button>
        <div className="brand">
          <span className="brand-mark">
            <BadgeDollarSign />
          </span>
          <span>
            POS<span>Perity</span>
          </span>
        </div>
        <div className="client-switcher">
          <button onClick={() => setClientMenu(!clientMenu)}>
            <span className="client-logo">{client?.code}</span>
            <span>
              <small>CLIENT PORTAL</small>
              <strong>{client?.name}</strong>
            </span>
            <ChevronDown />
          </button>
          {clientMenu && (
            <div className="client-menu">
              {clients.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setClientId(c.id);
                    setCart([]);
                    setClientMenu(false);
                  }}
                >
                  <span>{c.code}</span>
                  <div>
                    <strong>{c.name}</strong>
                    <small>Open live workspace</small>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <nav>
          {navItems.map(([label, Icon]) => (
            <button
              key={label}
              className={activeNav === label ? 'nav-active' : ''}
              onClick={() => {
                setActiveNav(label);
                setMenuOpen(false);
              }}
            >
              <Icon />
              <span>{label}</span>
              {label === 'Purchase orders' && (
                <span className="nav-badge">{data.purchaseOrders.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="store-card">
            <span>
              <Store />
            </span>
            <div>
              <strong>{site?.name}</strong>
              <small>Live inventory register</small>
            </div>
          </div>
          <div className="profile-wrap">
            <button className="profile" onClick={() => setUserMenu(!userMenu)}>
              <span className="avatar">{initials(user?.name || 'User')}</span>
              <span>
                <strong>{user?.name}</strong>
                <small>{user?.role}</small>
              </span>
              <ChevronDown />
            </button>
            {userMenu && (
              <div className="user-session-menu">
                <small>SIMULATE USER LOGIN</small>
                {data.users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      setUserId(u.id);
                      setSiteId(u.default_location_id);
                      setUserMenu(false);
                      setCart([]);
                    }}
                  >
                    <span>{initials(u.name)}</span>
                    <div>
                      <strong>{u.name}</strong>
                      <small>
                        {
                          locations.find((l) => l.id === u.default_location_id)
                            ?.name
                        }
                      </small>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div className="title-wrap">
            <button className="menu-button" onClick={() => setMenuOpen(true)}>
              <Menu />
            </button>
            <div>
              <p>{client?.name} · Live workspace</p>
              <h1>{activeNav === 'Sell' ? 'New sale' : activeNav}</h1>
            </div>
          </div>
          <div className="top-actions">
            <label className="site-select">
              <MapPin />
              <select
                value={siteId}
                onChange={(e) => {
                  setSiteId(Number(e.target.value));
                  setCart([]);
                }}
              >
                {stores.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <ChevronDown />
            </label>
            <button>
              <Bell />
            </button>
            <span className="register-status">
              <i /> Backend connected
            </span>
          </div>
        </header>
        {notice && (
          <div className="global-notice">
            <span>{notice}</span>
            <button onClick={() => setNotice('')}>
              <X />
            </button>
          </div>
        )}
        {activeNav === 'Sell' ? (
          <div className="pos-layout">
            <section className="catalog">
              <div className="context-banner">
                <span>
                  <Building2 />
                </span>
                <div>
                  <strong>{client?.name}</strong>
                  <small>
                    Selling from {site?.name} · Completed sales post live
                  </small>
                </div>
              </div>
              <div className="search-row">
                <label className="search-box">
                  <Search />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search products or scan barcode"
                  />
                  <kbd>⌘ K</kbd>
                </label>
                <button className="scan-button">
                  <LayoutGrid /> Quick keys
                </button>
              </div>
              <div className="category-tabs">
                {categories.map((c) => (
                  <button
                    key={c}
                    className={category === c ? 'active' : ''}
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="catalog-heading">
                <div>
                  <h2>{category}</h2>
                  <p>
                    {filtered.length} live products at {site?.name}
                  </p>
                </div>
                <button>
                  <Tag /> Price lookup
                </button>
              </div>
              <div className="product-grid">
                {filtered.map((p) => (
                  <button
                    className="product-card"
                    key={p.id}
                    disabled={!p.stock}
                    onClick={() => add(p)}
                  >
                    <span
                      className="product-visual"
                      style={{ background: p.color }}
                    >
                      <span>{p.icon}</span>
                      <i className={p.stock < 10 ? 'stock-low' : ''}>
                        {p.stock} at site
                      </i>
                    </span>
                    <span className="product-meta">
                      <strong>{p.name}</strong>
                      <small>{p.category}</small>
                      <b>{money(p.price)}</b>
                    </span>
                    <span className="add-button">
                      <Plus />
                    </span>
                  </button>
                ))}
              </div>
            </section>
            <aside className="cart-panel">
              <div className="cart-header">
                <div>
                  <h2>Current order</h2>
                  <span>{cart.reduce((s, l) => s + l.quantity, 0)} items</span>
                </div>
                <button onClick={() => setCart([])}>
                  <Trash2 />
                </button>
              </div>
              <button
                className="customer-button"
                onClick={() => setDialog('selectCustomer')}
              >
                <span>
                  <CircleUserRound />
                </span>
                <div>
                  <strong>
                    {data.customers.find((c) => c.id === customerId)?.name ||
                      'Walk-in customer'}
                  </strong>
                  <small>
                    {customerId
                      ? 'Attached to sale'
                      : 'Select optional customer'}
                  </small>
                </div>
                <Plus />
              </button>
              <div className="cart-lines">
                {!cart.length ? (
                  <div className="empty-cart">
                    <ShoppingCart />
                    <strong>Your cart is empty</strong>
                    <span>Select a product to begin</span>
                  </div>
                ) : (
                  cart.map((l) => (
                    <div className="cart-line" key={l.id}>
                      <span
                        className="line-icon"
                        style={{ background: l.color }}
                      >
                        {l.icon}
                      </span>
                      <div className="line-details">
                        <strong>{l.name}</strong>
                        <small>{money(l.price)} each</small>
                        <div className="quantity">
                          <button onClick={() => change(l.id, -1)}>
                            <Minus />
                          </button>
                          <b>{l.quantity}</b>
                          <button onClick={() => change(l.id, 1)}>
                            <Plus />
                          </button>
                        </div>
                      </div>
                      <b className="line-total">
                        {money(l.price * l.quantity)}
                      </b>
                    </div>
                  ))
                )}
              </div>
              <div className="totals">
                <p>
                  <span>Net</span>
                  <b>{money(subtotal - tax)}</b>
                </p>
                <p>
                  <span>VAT included</span>
                  <span>{money(tax)}</span>
                </p>
                <p className="grand-total">
                  <span>Total</span>
                  <strong>{money(subtotal)}</strong>
                </p>
              </div>
              <button
                className="pay-button"
                disabled={!cart.length || busy}
                onClick={() => setDialog('payment')}
              >
                <span>
                  <CreditCard /> Pay
                </span>
                <strong>{money(subtotal)}</strong>
              </button>
              <div className="payment-shortcuts">
                <button onClick={() => setNotice('Order held on this device')}>
                  <WalletCards /> Hold
                </button>
                <button>
                  <ReceiptText /> Discount
                </button>
                <button onClick={() => setDialog('cash')}>
                  <BadgeDollarSign /> Cash
                </button>
              </div>
            </aside>
          </div>
        ) : (
          <Module
            module={activeNav}
            data={data}
            client={client!}
            locations={locations}
            site={site!}
            warehouse={warehouse}
            onDialog={setDialog}
            onReceive={async (id) => {
              await post({ action: 'receiveTransfer', id });
              setNotice('Transfer received and inventory updated');
            }}
          />
        )}
      </section>
      {dialog && (
        <Dialog
          kind={dialog}
          busy={busy}
          data={data}
          clientId={clientId}
          siteId={siteId}
          userId={userId}
          locations={locations}
          warehouse={warehouse}
          total={subtotal}
          onClose={() => setDialog(null)}
          onSubmit={async (payload) => {
            const result = await post(payload);
            if (payload.action === 'sale') {
              setCart([]);
              setCustomerId(undefined);
              setNotice(
                `Sale posted · ${result.receipt}${result.change != null ? ` · Change ${money(result.change)}` : ''}`,
              );
            }
          }}
          onSelectCustomer={(id) => {
            setCustomerId(id);
            setDialog(null);
          }}
          cart={cart}
          customerId={customerId}
        />
      )}
    </main>
  );
}
function Module({
  module,
  data,
  client,
  locations,
  site,
  warehouse,
  onDialog,
  onReceive,
}: {
  module: string;
  data: Data;
  client: Client;
  locations: Location[];
  site: Location;
  warehouse?: Location;
  onDialog: (v: string) => void;
  onReceive: (id: number) => void;
}) {
  const actions: Record<string, [string, string]> = {
    Customers: ['Add customer', 'customer'],
    Users: ['Invite user', 'user'],
    'Purchase orders': ['New purchase order', 'po'],
    Distribution: ['New transfer', 'transfer'],
  };
  if (module === 'Sites')
    return (
      <Page title="Sites" subtitle="Every trading location and warehouse">
        <div className="site-grid">
          {locations.map((l) => (
            <article
              key={l.id}
              className={l.id === site.id ? 'active-site-card' : ''}
            >
              <div>
                <span>
                  {l.type === 'warehouse' ? <Warehouse /> : <Store />}
                </span>
                <i>
                  {l.type === 'warehouse'
                    ? 'Central inventory'
                    : l.id === site.id
                      ? 'Current site'
                      : 'Online'}
                </i>
              </div>
              <h3>{l.name}</h3>
              <p>{l.address}</p>
              <dl>
                <div>
                  <dt>Type</dt>
                  <dd>{l.type}</dd>
                </div>
                <div>
                  <dt>Records</dt>
                  <dd>Live</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </Page>
    );
  if (module === 'Customers')
    return (
      <Page
        title="Customers"
        subtitle={`Profiles shared across ${client.name}`}
        action={actions[module]}
        onDialog={onDialog}
      >
        <Rows
          headers={['Customer', 'Contact', 'Phone', 'Status']}
          rows={data.customers.map((c) => [
            c.name,
            c.email || '—',
            c.phone || '—',
            'Live',
          ])}
        />
      </Page>
    );
  if (module === 'Users')
    return (
      <Page
        title="Users"
        subtitle="Roles and default login stores"
        action={actions[module]}
        onDialog={onDialog}
      >
        <Rows
          headers={['User', 'Role', 'Default store', 'Status']}
          rows={data.users.map((u) => [
            u.name,
            u.role,
            locations.find((l) => l.id === u.default_location_id)?.name || '—',
            u.status,
          ])}
        />
      </Page>
    );
  if (module === 'Purchase orders')
    return (
      <Page
        title="Purchase orders"
        subtitle="Purchase centrally or directly for a store"
        action={actions[module]}
        onDialog={onDialog}
      >
        <Rows
          headers={['Order', 'Supplier', 'Destination', 'Status', 'Total']}
          rows={data.purchaseOrders.map((p) => [
            `PO-${String(p.id).padStart(4, '0')}`,
            p.supplier,
            p.destination,
            p.status,
            money(p.total),
          ])}
        />
      </Page>
    );
  if (module === 'Distribution')
    return (
      <Page
        title="Warehouse distribution"
        subtitle={`${warehouse?.name || 'Central warehouse'} → stores`}
        action={actions[module]}
        onDialog={onDialog}
      >
        <div className="warehouse-hero">
          <span>
            <Warehouse />
          </span>
          <div>
            <small>CENTRAL WAREHOUSE</small>
            <strong>{warehouse?.name}</strong>
            <p>{warehouse?.address}</p>
          </div>
        </div>
        <section className="transfer-card">
          <header>
            <div>
              <h3>Live transfers</h3>
              <span>Receiving updates both locations</span>
            </div>
          </header>
          {data.transfers.length ? (
            data.transfers.map((t) => (
              <article key={t.id}>
                <span className="transfer-id">
                  TR-{String(t.id).padStart(4, '0')}
                </span>
                <span>
                  <strong>{t.destination}</strong>
                  <small>{t.product_name}</small>
                </span>
                <span>
                  <strong>{t.quantity} units</strong>
                  <small>From {t.origin}</small>
                </span>
                <b>{t.status}</b>
                {t.status !== 'Received' ? (
                  <button onClick={() => onReceive(t.id)}>
                    Receive <ChevronRight />
                  </button>
                ) : (
                  <span>Completed</span>
                )}
              </article>
            ))
          ) : (
            <Empty text="No transfers yet" />
          )}
        </section>
      </Page>
    );
  if (module === 'Inventory') {
    const rows = data.products.filter((p) => p.location_id === site.id);
    return (
      <Page title="Inventory" subtitle={`Live stock at ${site.name}`}>
        <Rows
          headers={['Product', 'SKU', 'Category', 'On hand', 'Value']}
          rows={rows.map((p) => [
            p.name,
            p.sku,
            p.category,
            String(p.stock),
            money(p.stock * p.cost),
          ])}
        />
      </Page>
    );
  }
  const revenue = data.sales.reduce((s, x) => s + Number(x.total), 0);
  return (
    <Page title="Reports" subtitle="Posted sales across this client">
      <div className="stat-grid">
        <div className="stat-card">
          <span>Posted revenue</span>
          <strong>{money(revenue)}</strong>
          <small>{data.sales.length} transactions</small>
        </div>
        <div className="stat-card">
          <span>Average sale</span>
          <strong>
            {money(data.sales.length ? revenue / data.sales.length : 0)}
          </strong>
          <small>All payments</small>
        </div>
        <div className="stat-card">
          <span>Active stores</span>
          <strong>{locations.filter((l) => l.type === 'store').length}</strong>
          <small>Client-wide</small>
        </div>
      </div>
      <Rows
        headers={[
          'Receipt',
          'Store',
          'Cashier',
          'Customer',
          'Payment',
          'Total',
        ]}
        rows={data.sales.map((s) => [
          s.receipt_number,
          s.location_name,
          s.cashier_name,
          s.customer_name || 'Walk-in',
          s.payment_method,
          money(s.total),
        ])}
      />
    </Page>
  );
}
function Page({
  title,
  subtitle,
  action,
  onDialog,
  children,
}: {
  title: string;
  subtitle: string;
  action?: [string, string];
  onDialog?: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="module-page">
      <div className="module-intro">
        <div>
          <p>LIVE BACKEND</p>
          <h2>{title}</h2>
          <span>{subtitle}</span>
        </div>
        {action && (
          <button onClick={() => onDialog?.(action[1])}>
            <Plus />
            {action[0]}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
function Rows({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <section className="live-table">
      <header>
        {headers.map((h) => (
          <span key={h}>{h}</span>
        ))}
      </header>
      {rows.length ? (
        rows.map((r, i) => (
          <article key={i}>
            {r.map((v, j) => (
              <span key={j} data-label={headers[j]}>
                {v}
              </span>
            ))}
          </article>
        ))
      ) : (
        <Empty text="No records yet" />
      )}
    </section>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty-live">
      <Boxes />
      <strong>{text}</strong>
      <span>Create the first record to test live posting.</span>
    </div>
  );
}
function Dialog({
  kind,
  busy,
  data,
  clientId,
  siteId,
  userId,
  locations,
  warehouse,
  total,
  onClose,
  onSubmit,
  onSelectCustomer,
  cart,
  customerId,
}: {
  kind: string;
  busy: boolean;
  data: Data;
  clientId: number;
  siteId: number;
  userId: number;
  locations: Location[];
  warehouse?: Location;
  total: number;
  onClose: () => void;
  onSubmit: (p: Record<string, unknown>) => Promise<void>;
  onSelectCustomer: (id: number | undefined) => void;
  cart: CartLine[];
  customerId?: number;
}) {
  const stores = locations.filter((l) => l.type === 'store'),
    warehouseProducts = data.products.filter(
      (p) => p.location_id === warehouse?.id,
    );
  if (kind === 'selectCustomer')
    return (
      <Modal title="Select customer" onClose={onClose}>
        <div className="choice-list">
          <button onClick={() => onSelectCustomer(undefined)}>
            <strong>Walk-in customer</strong>
            <small>No customer attached</small>
          </button>
          {data.customers.map((c) => (
            <button key={c.id} onClick={() => onSelectCustomer(c.id)}>
              <strong>{c.name}</strong>
              <small>{c.email || c.phone}</small>
            </button>
          ))}
        </div>
      </Modal>
    );
  if (kind === 'payment' || kind === 'cash')
    return (
      <Modal title="Complete sale" onClose={onClose}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget),
              method = String(f.get('paymentMethod'));
            void onSubmit({
              action: 'sale',
              clientId,
              locationId: siteId,
              userId,
              customerId,
              paymentMethod: method,
              cashReceived:
                method === 'Cash' ? Number(f.get('cashReceived')) : null,
              items: cart.map((x) => ({
                productId: x.id,
                quantity: x.quantity,
              })),
            });
          }}
        >
          <div className="payment-total">
            <small>AMOUNT DUE</small>
            <strong>{money(total)}</strong>
          </div>
          <label>
            Payment method
            <select
              name="paymentMethod"
              defaultValue={kind === 'cash' ? 'Cash' : 'Card'}
            >
              <option>Card</option>
              <option>Cash</option>
            </select>
          </label>
          <label>
            Cash received
            <input
              name="cashReceived"
              type="number"
              min={total}
              step="0.01"
              defaultValue={kind === 'cash' ? total : ''}
            />
            <small>Required for cash only</small>
          </label>
          <button className="dialog-primary" disabled={busy}>
            <PackageCheck />
            {busy ? 'Posting…' : 'Post sale & update stock'}
          </button>
        </form>
      </Modal>
    );
  let title = '',
    fields: React.ReactNode,
    action = '';
  if (kind === 'customer') {
    title = 'Add customer';
    action = 'customer';
    fields = (
      <>
        <label>
          Full name
          <input name="name" required />
        </label>
        <label>
          Email
          <input name="email" type="email" />
        </label>
        <label>
          Phone
          <input name="phone" />
        </label>
      </>
    );
  }
  if (kind === 'user') {
    title = 'Invite user';
    action = 'user';
    fields = (
      <>
        <label>
          Full name
          <input name="name" required />
        </label>
        <label>
          Email
          <input name="email" type="email" required />
        </label>
        <label>
          Role
          <select name="role">
            <option>Cashier</option>
            <option>Store manager</option>
            <option>Client administrator</option>
          </select>
        </label>
        <label>
          Default store
          <select name="defaultLocationId">
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </>
    );
  }
  if (kind === 'po') {
    title = 'New purchase order';
    action = 'purchaseOrder';
    fields = (
      <>
        <label>
          Supplier
          <input name="supplier" required />
        </label>
        <label>
          Destination
          <select name="destinationLocationId">
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Order total
          <input name="total" type="number" min="0" step="0.01" required />
        </label>
      </>
    );
  }
  if (kind === 'transfer') {
    title = 'New stock transfer';
    action = 'transfer';
    fields = (
      <>
        <input type="hidden" name="fromLocationId" value={warehouse?.id} />
        <label>
          From
          <input value={warehouse?.name || ''} disabled />
        </label>
        <label>
          Destination
          <select name="toLocationId">
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Product
          <select name="productId">
            {warehouseProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.stock} available
              </option>
            ))}
          </select>
        </label>
        <label>
          Quantity
          <input name="quantity" type="number" min="1" required />
        </label>
      </>
    );
  }
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void onSubmit(Object.fromEntries(new FormData(e.currentTarget).entries()));
  };
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit}>
        <input type="hidden" name="action" value={action} />
        <input type="hidden" name="clientId" value={clientId} />
        {fields}
        <button className="dialog-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save live record'}
        </button>
      </form>
    </Modal>
  );
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className="live-dialog" role="dialog" aria-modal="true">
        <header>
          <div>
            <small>POSPERITY LIVE</small>
            <h2>{title}</h2>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
