'use client';
import {
  BadgeDollarSign,
  BarChart3,
  Bell,
  Boxes,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  Clock3,
  CreditCard,
  Copy,
  Eye,
  EyeOff,
  LayoutGrid,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  Minus,
  PackageCheck,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  ShoppingCart,
  ShieldCheck,
  Sparkles,
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
  barcode?: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  icon: string;
  color: string;
  stock: number;
  location_id: number;
  show_on_pos: number;
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
  destination_location_id: number;
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
type HeldSale = {
  id: number;
  location_id: number;
  user_id: number;
  customer_id?: number;
  reference: string;
  total: number;
  created_at: string;
  location_name: string;
  cashier_name: string;
  customer_name?: string;
};
type HeldSaleItem = {
  id: number;
  held_sale_id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
};
type AdjustmentLog = {
  id: number;
  action: string;
  entity: string;
  record_id?: number;
  summary: string;
  created_at: string;
  user_name: string;
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
  heldSales: HeldSale[];
  heldSaleItems: HeldSaleItem[];
  adjustmentLogs: AdjustmentLog[];
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
    [entryStage, setEntryStage] = useState<
      'splash' | 'login' | 'welcome' | 'app'
    >('splash'),
    [clientId, setClientId] = useState(1),
    [siteId, setSiteId] = useState(0),
    [userId, setUserId] = useState(0),
    [activeNav, setActiveNav] = useState('Sell'),
    [category, setCategory] = useState('All items'),
    [query, setQuery] = useState(''),
    [cart, setCart] = useState<CartLine[]>([]),
    [customerId, setCustomerId] = useState<number>(),
    [activeHoldId, setActiveHoldId] = useState<number>(),
    [menuOpen, setMenuOpen] = useState(false),
    [clientMenu, setClientMenu] = useState(false),
    [userMenu, setUserMenu] = useState(false),
    [dialog, setDialog] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const load = useCallback(
    async (id = clientId, actingUserId = 0) => {
      const r = await fetch(
          `/api/pos?clientId=${id}${actingUserId ? `&userId=${actingUserId}` : ''}`,
          { cache: 'no-store' },
        ),
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
  useEffect(() => {
    const timer = window.setTimeout(() => setEntryStage('welcome'), 2200);
    return () => window.clearTimeout(timer);
  }, []);
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
      await load(clientId, userId);
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
    isAdministrator =
      user?.role.toLowerCase().includes('administrator') ?? false,
    isManager = user?.role.toLowerCase().includes('manager') ?? false,
    isCashier = user?.role.toLowerCase() === 'cashier',
    visibleNav = isCashier
      ? navItems.filter(([label]) => label === 'Sell' || label === 'Customers')
      : isManager
        ? navItems.filter(([label]) => label !== 'Sites')
        : navItems,
    siteProducts = (data?.products || []).filter(
      (p) => p.location_id === siteId,
    ),
    categories = ['All items', ...new Set(siteProducts.map((p) => p.category))],
    normalizedQuery = query.trim().toLowerCase(),
    filtered = siteProducts.filter((p) => {
      const matchesQuery = `${p.name} ${p.sku} ${p.barcode || ''}`.toLowerCase().includes(normalizedQuery);
      return (category === 'All items' || p.category === category) && matchesQuery && (normalizedQuery.length > 0 || Boolean(p.show_on_pos));
    }),
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
  const scanOrSearch = () => {
    const value = query.trim().toLowerCase();
    if (!value) return;
    const compact = value.replace(/[\s-]/g, '');
    const match = siteProducts.find(
      (product) =>
        product.barcode?.toLowerCase() === value ||
        product.sku.toLowerCase() === value ||
        product.sku.toLowerCase().replace(/[\s-]/g, '') === compact ||
        product.name.toLowerCase() === value,
    );
    if (!match) {
      setNotice(`No exact product found for “${query.trim()}”`);
      return;
    }
    if (!match.stock) {
      setNotice(`${match.name} is out of stock at ${site?.name}`);
      return;
    }
    add(match);
    setQuery('');
    setNotice(`${match.name} scanned into the cart`);
  };
  if (entryStage === 'splash')
    return <SplashScreen onContinue={() => setEntryStage('welcome')} />;
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
  if (entryStage === 'login')
    return (
      <LoginScreen
        client={client}
        user={user}
        users={data.users}
        locations={locations}
        onChooseUser={(selected) => {
          setUserId(selected.id);
          setSiteId(selected.default_location_id);
        }}
        onSignIn={() => setEntryStage('welcome')}
      />
    );
  if (entryStage === 'welcome')
    return (
      <WelcomeScreen
        client={client}
        user={user}
        site={site}
        users={data.users}
        locations={locations}
        onChooseUser={(selected) => {
          setUserId(selected.id);
          setSiteId(selected.default_location_id);
          setActiveNav('Sell');
        }}
        onEnter={() => {
          void load(clientId, userId).then(() => setEntryStage('app'));
        }}
      />
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
        {isAdministrator && (
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
        )}
        <nav>
          {visibleNav.map(([label, Icon]) => (
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
                <small>
                  {isAdministrator
                    ? 'ADMINISTRATOR SESSION'
                    : 'CASHIER SESSION'}
                </small>
                <button onClick={() => setEntryStage('welcome')}>
                  <span>
                    <Sparkles />
                  </span>
                  <div>
                    <strong>Welcome screen</strong>
                    <small>View your profile details</small>
                  </div>
                </button>
                <button
                  className="logoff-button"
                  onClick={() => {
                    setCart([]);
                    setCustomerId(undefined);
                    setDialog(null);
                    setUserMenu(false);
                    setNotice('');
                    void load(clientId, 0).then(() => setEntryStage('login'));
                  }}
                >
                  <span>
                    <LogOut />
                  </span>
                  <div>
                    <strong>Log off</strong>
                    <small>Close this store session</small>
                  </div>
                </button>
                {isAdministrator &&
                  data.users.map((u) => (
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
                            locations.find(
                              (l) => l.id === u.default_location_id,
                            )?.name
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
            <label
              className={`site-select ${!isAdministrator ? 'site-locked' : ''}`}
            >
              <MapPin />
              <select
                value={siteId}
                disabled={!isAdministrator}
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
                    {isCashier
                      ? 'Cashier access'
                      : isManager
                        ? 'Store manager access'
                        : 'Administrator access'}{' '}
                    · Selling from {site?.name} · Completed sales post live
                  </small>
                </div>
              </div>
              <div className="search-row">
                <label className="search-box">
                  <Search />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        scanOrSearch();
                      }
                    }}
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
                  <h2>{normalizedQuery ? 'Search results' : category}</h2>
                  <p>
                    {filtered.length} {normalizedQuery ? 'matching' : 'featured'} products at {site?.name}
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
                      <small>
                        {p.category} · {p.sku}
                      </small>
                      <b>{money(p.price)}</b>
                    </span>
                    <span className="add-button">
                      <Plus />
                    </span>
                  </button>
                ))}
                {!filtered.length && <div className="catalog-empty"><Search /><strong>{normalizedQuery ? 'No matching products' : 'No featured products selected'}</strong><span>{normalizedQuery ? 'Try a product name, SKU or barcode.' : 'An administrator or store manager can select products from Inventory.'}</span></div>}
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
                <button
                  disabled={!cart.length}
                  onClick={() => setDialog('hold')}
                >
                  <WalletCards /> Hold
                </button>
                <button onClick={() => setDialog('heldSales')}>
                  <ReceiptText /> Held ({data.heldSales.length})
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
            isAdministrator={isAdministrator}
            isManager={isManager}
            onDialog={setDialog}
            onNavigate={setActiveNav}
            onDelete={async (entity, id) => {
              if (!window.confirm('Delete this record? This cannot be undone.')) return;
              await post({ action: 'adminCrud', operation: 'delete', entity, id, clientId, userId });
              setNotice('Record deleted');
            }}
            onSetVisibility={async (product, visible) => {
              await post({ action: 'setPosVisibility', productId: product.id, locationId: product.location_id, visible, clientId, userId });
              setNotice(`${product.name} ${visible ? 'added to' : 'removed from'} the sales screen`);
            }}
            onReceive={async (id) => {
              await post({ action: 'receiveTransfer', id, clientId, userId });
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
            const result = await post({ ...payload, userId });
            if (payload.action === 'sale') {
              setCart([]);
              setCustomerId(undefined);
              setActiveHoldId(undefined);
              setNotice(
                `Sale posted · ${result.receipt}${result.change != null ? ` · Change ${money(result.change)}` : ''}`,
              );
            }
            if (payload.action === 'hold') {
              setCart([]);
              setCustomerId(undefined);
              setActiveHoldId(undefined);
              setNotice(`Sale held · ${result.reference}`);
            }
          }}
          onSelectCustomer={(id) => {
            setCustomerId(id);
            setDialog(null);
          }}
          cart={cart}
          customerId={customerId}
          activeHoldId={activeHoldId}
          onRecallHold={(hold) => {
            const restored = data.heldSaleItems
              .filter((item) => item.held_sale_id === hold.id)
              .map((item) => {
                const product = siteProducts.find(
                  (candidate) => candidate.id === item.product_id,
                );
                return product ? { ...product, quantity: item.quantity } : null;
              })
              .filter((item): item is CartLine => item !== null);
            setCart(restored);
            setCustomerId(hold.customer_id);
            setActiveHoldId(hold.id);
            setDialog(null);
            setNotice(`Recalled ${hold.reference}`);
          }}
          onDeleteHold={async (id) => {
            await post({ action: 'deleteHold', id, clientId, userId });
            if (activeHoldId === id) {
              setActiveHoldId(undefined);
              setCart([]);
            }
            setNotice('Held sale released');
          }}
        />
      )}
    </main>
  );
}
function SplashScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <main className="splash-screen" onClick={onContinue}>
      <div className="splash-glow splash-glow-one" />
      <div className="splash-glow splash-glow-two" />
      <section className="splash-content">
        <div className="splash-logo">
          <BadgeDollarSign />
        </div>
        <div className="splash-name">
          POS<span>Perity</span>
        </div>
        <p>Smarter selling. Connected inventory. Prosperous business.</p>
        <div className="splash-loader">
          <i />
        </div>
      </section>
      <footer>
        <small>POWERED BY</small>
        <strong><span>Bizno</span>Tech</strong>
      </footer>
    </main>
  );
}

function LoginScreen({
  client,
  user,
  users,
  locations,
  onChooseUser,
  onSignIn,
}: {
  client?: Client;
  user?: User;
  users: User[];
  locations: Location[];
  onChooseUser: (user: User) => void;
  onSignIn: () => void;
}) {
  return (
    <main className="login-screen">
      <section className="login-brand-panel">
        <div className="welcome-brand">
          <span>
            <BadgeDollarSign />
          </span>
          POS<b>Perity</b>
        </div>
        <div className="login-brand-copy">
          <small>SMARTER BUSINESS STARTS HERE</small>
          <h1>Welcome to your connected retail workspace.</h1>
          <p>
            Sales, stock, customers and purchasing—working together across every
            location.
          </p>
        </div>
        <div className="login-datawiz">
          <small>POWERED BY</small>
          <strong><span>Bizno</span>Tech</strong>
        </div>
      </section>
      <section className="login-form-panel">
        <div className="signed-out-badge">
          <ShieldCheck /> Session securely closed
        </div>
        <div className="login-form-card">
          <small>SIGN IN TO CONTINUE</small>
          <h2>Open POSPerity</h2>
          <p>
            Select your authorized profile for <strong>{client?.name}</strong>.
          </p>
          <label>
            User profile
            <select
              value={user?.id || ''}
              onChange={(e) => {
                const selected = users.find(
                  (u) => u.id === Number(e.target.value),
                );
                if (selected) onChooseUser(selected);
              }}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.role}
                </option>
              ))}
            </select>
          </label>
          <div className="login-profile-preview">
            <span>{initials(user?.name || 'User')}</span>
            <div>
              <strong>{user?.name}</strong>
              <small>
                {
                  locations.find((l) => l.id === user?.default_location_id)
                    ?.name
                }{' '}
                · {user?.role}
              </small>
            </div>
          </div>
          <button onClick={onSignIn}>
            <span>Sign in</span>
            <LogIn />
          </button>
          <footer>
            <ShieldCheck /> Authorized company users only
          </footer>
        </div>
      </section>
    </main>
  );
}

function WelcomeScreen({
  client,
  user,
  site,
  users,
  locations,
  onChooseUser,
  onEnter,
}: {
  client?: Client;
  user?: User;
  site?: Location;
  users: User[];
  locations: Location[];
  onChooseUser: (user: User) => void;
  onEnter: () => void;
}) {
  return (
    <main className="welcome-screen">
      <div className="welcome-orb welcome-orb-one" />
      <div className="welcome-orb welcome-orb-two" />
      <header className="welcome-header">
        <div className="welcome-brand">
          <span>
            <BadgeDollarSign />
          </span>
          POS<b>Perity</b>
        </div>
        <div className="datawiz-mini">
          <small>POWERED BY</small>
          <strong><span>Bizno</span>Tech</strong>
        </div>
      </header>
      <section className="welcome-shell">
        <div className="welcome-copy">
          <div className="welcome-kicker">
            <Sparkles /> Your workspace is ready
          </div>
          <h1>
            Welcome back,
            <br />
            <span>{user?.name.split(' ')[0]}</span>.
          </h1>
          <p>
            You’re signed in to <strong>{client?.name}</strong>. Everything you
            need to run today’s sales, stock and customers is ready.
          </p>
          <div className="welcome-trust">
            <span>
              <ShieldCheck />
            </span>
            <div>
              <strong>Secure company workspace</strong>
              <small>
                Your access and activity stay within {client?.name}.
              </small>
            </div>
          </div>
        </div>
        <article className="welcome-card">
          <div className="welcome-card-top">
            <span className="welcome-avatar">
              {initials(user?.name || 'User')}
            </span>
            <div>
              <small>SIGNED IN AS</small>
              <h2>{user?.name}</h2>
              <p>{user?.email}</p>
            </div>
            <i>Active</i>
          </div>
          <div className="welcome-details">
            <div>
              <span>
                <Building2 />
              </span>
              <small>COMPANY</small>
              <strong>{client?.name}</strong>
            </div>
            <div>
              <span>
                <BriefcaseBusiness />
              </span>
              <small>ROLE</small>
              <strong>{user?.role}</strong>
            </div>
            <div>
              <span>
                <MapPin />
              </span>
              <small>DEFAULT STORE</small>
              <strong>{site?.name}</strong>
            </div>
            <div>
              <span>
                <Clock3 />
              </span>
              <small>SESSION</small>
              <strong>Live & connected</strong>
            </div>
          </div>
          <button className="enter-workspace" onClick={onEnter}>
            <span>Enter {site?.name}</span>
            <ChevronRight />
          </button>
          <div className="welcome-user-switch">
            <label>Testing as another user?</label>
            <select
              value={user?.id || ''}
              onChange={(e) => {
                const selected = users.find(
                  (u) => u.id === Number(e.target.value),
                );
                if (selected) onChooseUser(selected);
              }}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ·{' '}
                  {locations.find((l) => l.id === u.default_location_id)?.name}
                </option>
              ))}
            </select>
          </div>
        </article>
      </section>
      <footer className="welcome-footer">
        <span>© 2026 BiznoTech</span>
        <span>Secure · Connected · Ready</span>
      </footer>
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
  isAdministrator,
  isManager,
  onDialog,
  onNavigate,
  onDelete,
  onSetVisibility,
  onReceive,
}: {
  module: string;
  data: Data;
  client: Client;
  locations: Location[];
  site: Location;
  warehouse?: Location;
  isAdministrator: boolean;
  isManager: boolean;
  onDialog: (v: string) => void;
  onNavigate: (v: string) => void;
  onDelete: (entity: string, id: number) => Promise<void>;
  onSetVisibility: (product: Product, visible: boolean) => Promise<void>;
  onReceive: (id: number) => void;
}) {
  const actions: Record<string, [string, string]> = {
    Customers: ['Add customer', 'customer'],
    Users: ['Invite user', 'user'],
    'Purchase orders': ['New purchase order', 'po'],
    Distribution: ['New transfer', 'transfer'],
    Sites: ['Add site', 'create:location'],
    Inventory: ['Add product', 'create:product'],
  };
  if (module === 'Sites')
    return (
      <Page title="Sites" subtitle="Every trading location and warehouse" action={isAdministrator ? actions[module] : undefined} onDialog={onDialog}>
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
              {isAdministrator && <CrudButtons onEdit={() => onDialog(`edit:location:${l.id}`)} onDelete={() => void onDelete('location', l.id)} />}
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
          headers={['Customer', 'Contact', 'Phone', 'Status', ...(isAdministrator ? ['Manage'] : [])]}
          rows={data.customers.map((c) => [
            c.name,
            c.email || '—',
            c.phone || '—',
            'Live',
            ...(isAdministrator ? [<CrudButtons key={c.id} onEdit={() => onDialog(`edit:customer:${c.id}`)} onDelete={() => void onDelete('customer', c.id)} />] : []),
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
          headers={['User', 'Role', 'Default store', 'Status', ...(isAdministrator ? ['Manage'] : [])]}
          rows={data.users.map((u) => [
            u.name,
            u.role,
            locations.find((l) => l.id === u.default_location_id)?.name || '—',
            u.status,
            ...(isAdministrator ? [<CrudButtons key={u.id} onDuplicate={() => onDialog(`duplicate:user:${u.id}`)} onEdit={() => onDialog(`edit:user:${u.id}`)} onDelete={() => void onDelete('user', u.id)} />] : []),
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
          headers={['Order', 'Supplier', 'Destination', 'Status', 'Total', ...(isAdministrator ? ['Manage'] : [])]}
          rows={data.purchaseOrders.map((p) => [
            `PO-${String(p.id).padStart(4, '0')}`,
            p.supplier,
            p.destination,
            p.status,
            money(p.total),
            ...(isAdministrator ? [<CrudButtons key={p.id} onEdit={() => onDialog(`edit:purchaseOrder:${p.id}`)} onDelete={() => void onDelete('purchaseOrder', p.id)} />] : []),
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
      <Page title="Inventory" subtitle={`Live stock at ${site.name}`} action={isAdministrator ? actions[module] : undefined} onDialog={onDialog}>
        <Rows
          headers={['Product', 'SKU', 'Category', 'On hand', 'Value', ...((isAdministrator || isManager) ? ['Sales screen'] : []), ...(isAdministrator ? ['Manage'] : [])]}
          rows={rows.map((p) => [
            p.name,
            p.sku,
            p.category,
            String(p.stock),
            money(p.stock * p.cost),
            ...((isAdministrator || isManager) ? [<button key={`visibility-${p.id}`} className={`visibility-toggle ${p.show_on_pos ? 'is-visible' : ''}`} onClick={() => void onSetVisibility(p, !p.show_on_pos)}>{p.show_on_pos ? <Eye /> : <EyeOff />} {p.show_on_pos ? 'Displayed' : 'Hidden'}</button>] : []),
            ...(isAdministrator ? [<CrudButtons key={`${p.id}-${p.location_id}`} onEdit={() => onDialog(`edit:product:${p.id}:${p.location_id}`)} onDelete={() => void onDelete('product', p.id)} />] : []),
          ])}
        />
      </Page>
    );
  }
  if (module === 'Adjustment log') {
    return (
      <Page title="Adjustment log" subtitle="A tenant-wide record of data and stock changes">
        <div className="report-back"><button onClick={() => onNavigate('Reports')}><ChevronRight /> Back to reports</button><span>{data.adjustmentLogs.length} recent events</span></div>
        <Rows
          headers={['Date & time', 'User', 'Action', 'Area', 'Details']}
          rows={data.adjustmentLogs.map((log) => [
            new Date(log.created_at).toLocaleString(),
            log.user_name,
            log.action,
            `${log.entity}${log.record_id ? ` #${log.record_id}` : ''}`,
            log.summary,
          ])}
        />
      </Page>
    );
  }
  const revenue = data.sales.reduce((s, x) => s + Number(x.total), 0);
  return (
    <Page title="Reports" subtitle="Posted sales across this client">
      <div className="report-links">
        <button className="report-link active"><BarChart3 /><span><small>SALES REPORT</small><strong>Sales performance</strong><i>Revenue, transactions and store activity</i></span><ChevronRight /></button>
        <button className="report-link" onClick={() => onNavigate('Adjustment log')}><Clock3 /><span><small>CONTROL REPORT</small><strong>Adjustment log</strong><i>Who changed what, and when</i></span><ChevronRight /></button>
      </div>
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
function CrudButtons({ onDuplicate, onEdit, onDelete }: { onDuplicate?: () => void; onEdit: () => void; onDelete: () => void }) {
  return <div className="crud-actions">{onDuplicate && <button aria-label="Duplicate user" title="Duplicate user" onClick={onDuplicate}><Copy /></button>}<button aria-label="Edit record" title="Edit record" onClick={onEdit}><Pencil /></button><button aria-label="Delete record" title="Delete record" onClick={onDelete}><Trash2 /></button></div>;
}
function Rows({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
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
  activeHoldId,
  onRecallHold,
  onDeleteHold,
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
  activeHoldId?: number;
  onRecallHold: (hold: HeldSale) => void;
  onDeleteHold: (id: number) => Promise<void>;
}) {
  const stores = locations.filter((l) => l.type === 'store'),
    actor = data.users.find((candidate) => candidate.id === userId),
    managerCreatingUser = actor?.role.toLowerCase().includes('manager'),
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
  if (kind === 'heldSales')
    return (
      <Modal title="Held sales" onClose={onClose}>
        <div className="held-sales-list">
          {data.heldSales.length ? (
            data.heldSales.map((hold) => {
              const itemCount = data.heldSaleItems
                .filter((item) => item.held_sale_id === hold.id)
                .reduce((sum, item) => sum + item.quantity, 0);
              return (
                <article key={hold.id}>
                  <div className="held-sale-icon">
                    <WalletCards />
                  </div>
                  <div>
                    <strong>{hold.reference}</strong>
                    <small>
                      {hold.cashier_name} · {itemCount} items ·{' '}
                      {hold.customer_name || 'Walk-in'}
                    </small>
                    <span>
                      {hold.location_name} ·{' '}
                      {new Date(hold.created_at).toLocaleString()}
                    </span>
                  </div>
                  <b>{money(hold.total)}</b>
                  <div className="held-actions">
                    <button onClick={() => onRecallHold(hold)}>Recall</button>
                    <button
                      className="held-delete"
                      disabled={busy}
                      onClick={() => void onDeleteHold(hold.id)}
                    >
                      <Trash2 />
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="empty-held">
              <WalletCards />
              <strong>No held sales</strong>
              <span>Held orders will appear here until paid or released.</span>
            </div>
          )}
        </div>
      </Modal>
    );
  if (kind === 'hold')
    return (
      <Modal title="Hold this sale" onClose={onClose}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void onSubmit({
              action: 'hold',
              clientId,
              locationId: siteId,
              customerId,
              reference: String(f.get('reference') || ''),
              items: cart.map((item) => ({
                productId: item.id,
                quantity: item.quantity,
              })),
            });
          }}
        >
          <div className="hold-summary">
            <WalletCards />
            <div>
              <small>ORDER TO HOLD</small>
              <strong>
                {cart.reduce((sum, item) => sum + item.quantity, 0)} items ·{' '}
                {money(total)}
              </strong>
              <span>Inventory will not be deducted until payment.</span>
            </div>
          </div>
          <label>
            Reference or customer name
            <input
              name="reference"
              placeholder="e.g. Table 4 or Naledi"
              autoFocus
              required
            />
          </label>
          <button className="dialog-primary" disabled={busy}>
            <WalletCards />
            {busy ? 'Holding…' : 'Save held sale'}
          </button>
        </form>
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
              holdId: activeHoldId,
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
    action = '',
    entity = '',
    operation = '',
    recordId = 0;
  const parts = kind.split(':');
  if (parts[0] === 'edit' || parts[0] === 'create' || parts[0] === 'duplicate') {
    operation = parts[0] === 'edit' ? 'update' : 'create';
    entity = parts[1];
    recordId = Number(parts[2] || 0);
    action = 'adminCrud';
  }
  if (kind === 'customer' || entity === 'customer') {
    const record = data.customers.find((item) => item.id === recordId);
    title = record ? 'Edit customer' : 'Add customer';
    if (!action) action = 'customer';
    fields = (
      <>
        <label>
          Full name
          <input name="name" defaultValue={record?.name} required />
        </label>
        <label>
          Email
          <input name="email" type="email" defaultValue={record?.email} />
        </label>
        <label>
          Phone
          <input name="phone" defaultValue={record?.phone} />
        </label>
      </>
    );
  }
  if (kind === 'user' || entity === 'user') {
    const record = data.users.find((item) => item.id === recordId);
    const isDuplicate = parts[0] === 'duplicate';
    title = isDuplicate ? 'Duplicate user' : record ? 'Edit user' : 'Invite user';
    if (!action) action = 'user';
    fields = (
      <>
        <label>
          Full name
          <input name="name" defaultValue={isDuplicate && record ? `${record.name} copy` : record?.name} required />
        </label>
        <label>
          Email
          <input name="email" type="email" defaultValue={isDuplicate ? '' : record?.email} placeholder={isDuplicate ? 'Enter the new user’s email' : undefined} required />
        </label>
        <label>
          Role
          <select name="role" defaultValue={record?.role || 'Cashier'}>
            <option>Cashier</option>
            {!managerCreatingUser && <option>Store manager</option>}
            {!managerCreatingUser && <option>Client administrator</option>}
          </select>
        </label>
        <label>
          Default store
          <select name="defaultLocationId" defaultValue={record?.default_location_id}>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {record && <label>Status<select name="status" defaultValue={record.status}><option>Active</option><option>Suspended</option></select></label>}
      </>
    );
  }
  if (kind === 'po' || entity === 'purchaseOrder') {
    const record = data.purchaseOrders.find((item) => item.id === recordId);
    title = record ? 'Edit purchase order' : 'New purchase order';
    if (!action) action = 'purchaseOrder';
    fields = (
      <>
        <label>
          Supplier
          <input name="supplier" defaultValue={record?.supplier} required />
        </label>
        <label>
          Destination
          <select name="destinationLocationId" defaultValue={record?.destination_location_id}>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Order total
          <input name="total" type="number" min="0" step="0.01" defaultValue={record?.total} required />
        </label>
        {record && <label>Status<select name="status" defaultValue={record.status}><option>Draft</option><option>Submitted</option><option>Received</option><option>Cancelled</option></select></label>}
      </>
    );
  }
  if (entity === 'location') {
    const record = data.locations.find((item) => item.id === recordId);
    title = record ? 'Edit site' : 'Add site';
    fields = <><label>Site name<input name="name" defaultValue={record?.name} required /></label><label>Type<select name="type" defaultValue={record?.type || 'store'}><option value="store">Store</option><option value="warehouse">Warehouse</option></select></label><label>Address<input name="address" defaultValue={record?.address} /></label></>;
  }
  if (entity === 'product') {
    const locationId = Number(parts[3] || siteId), record = data.products.find((item) => item.id === recordId && item.location_id === locationId);
    title = record ? 'Edit product and stock' : 'Add product';
    fields = <><label>Product name<input name="name" defaultValue={record?.name} required /></label><label>SKU<input name="sku" defaultValue={record?.sku} required /></label><label>Barcode<input name="barcode" defaultValue={record?.barcode} /></label><label>Category<input name="category" defaultValue={record?.category} required /></label><label>Selling price<input name="price" type="number" min="0" step="0.01" defaultValue={record?.price} required /></label><label>Cost<input name="cost" type="number" min="0" step="0.01" defaultValue={record?.cost} required /></label><label>Location<select name="locationId" defaultValue={locationId}>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label><label>On hand<input name="stock" type="number" min="0" defaultValue={record?.stock || 0} required /></label></>;
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
        {entity && <input type="hidden" name="entity" value={entity} />}
        {operation && <input type="hidden" name="operation" value={operation} />}
        {recordId > 0 && <input type="hidden" name="id" value={recordId} />}
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
