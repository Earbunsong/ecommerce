# System Flowcharts — ShopKH

Diagrams use Mermaid. They render on GitHub, in VS Code (Markdown Preview Mermaid Support extension), and at https://mermaid.live.

**Notation:** `[[double box]]` = a server step that runs inside a database transaction. Error codes (e.g. `OUT_OF_STOCK`) are listed in architecture §4.10.

| # | Flowchart |
|---|---|
| 1 | Register and Login |
| 2 | Browse and Add to Cart |
| 3 | Checkout and Order Creation |
| 4 | Online Payment |
| 5 | Order Status Lifecycle |
| 6 | Unpaid Order Expiry Job |
| 7 | Admin: Manage Product |
| 8 | Write a Review |
| 9 | Admin: Process Order |
| 10 | Customer: Cancel Order |
| 11 | Payment Page: Wait for Result |

---

## 1. Register and Login

```mermaid
flowchart TD
    A([Start]) --> B{Has account?}
    B -- No --> C[Fill register form:<br/>name, email, phone, password]
    C --> RL1{Too many attempts<br/>from this IP?}
    RL1 -- Yes --> RL2[Show error: RATE_LIMITED<br/>try again later] --> Z([End])
    RL1 -- No --> D{Input valid?}
    D -- No --> C
    D -- Yes --> E{Email already used?<br/>compared in lowercase}
    E -- Yes --> F[Show error: EMAIL_TAKEN] --> C
    E -- No --> G[[Hash password<br/>Create user role = customer<br/>Create empty cart]]
    G --> K
    B -- Yes --> H[Enter email and password]
    H --> RL3{Too many attempts<br/>from this IP?}
    RL3 -- Yes --> RL2
    RL3 -- No --> I{Email and password correct?}
    I -- No --> J[Show error: INVALID_CREDENTIALS<br/>same message for unknown email] --> H
    I -- Yes --> I2{Account active?}
    I2 -- No --> J2[Show error: ACCOUNT_DISABLED<br/>contact the shop] --> Z
    I2 -- Yes --> K[Issue JWT in httpOnly cookie]
    K --> L{Role?}
    L -- customer --> M[Redirect to Home / previous page]
    L -- admin --> N[Redirect to Admin Dashboard]
    M --> Z
    N --> Z
```

- Registering **logs the customer in immediately** (G → K); they do not type their password again.
- The password is checked **before** the active flag. Someone who does not know the password therefore cannot find out whether an account exists or is disabled.
- Emails are lowercased before saving; the unique constraint on `email` backs up check E if two registrations with the same email arrive at the same moment.

## 2. Browse and Add to Cart

```mermaid
flowchart TD
    A([Start]) --> B[Open product list<br/>active products only]
    B --> C[Search / filter / sort]
    C --> D[Open product detail]
    D --> D1{Product exists<br/>and is active?}
    D1 -- No --> D2[Show 'Product not found' 404] --> Z([End])
    D1 -- Yes --> E{Stock > 0?}
    E -- No --> F[Show 'Out of stock'<br/>Disable Add to Cart] --> Z
    E -- Yes --> G[Choose quantity, click Add to Cart]
    G --> H{Logged in?}
    H -- No --> I[Redirect to Login] --> J[Return to product after login] --> G
    H -- Yes --> K{Server check:<br/>product active AND<br/>cart qty + new qty &lt;= stock?}
    K -- No --> L[Show error: OUT_OF_STOCK<br/>only N left] --> G
    K -- Yes --> M[Add item or increase quantity]
    M --> N[Update cart badge] --> Z
```

- The browser may disable the button early, but check K always runs on the **server**; the browser's stock number can be out of date.
- Changing quantity in the cart (`PATCH /cart/items/:itemId`) runs the same check K.

## 3. Checkout and Order Creation

```mermaid
flowchart TD
    A([Start]) --> B[Open Cart]
    B --> C{Cart empty?}
    C -- Yes --> D[Show empty cart] --> Z([End])
    C -- No --> C1{Any item with an issue?<br/>inactive or insufficient_stock}
    C1 -- Yes --> C2[Highlight items<br/>Checkout button disabled<br/>until customer fixes them] --> B
    C1 -- No --> E[Click Checkout]
    E --> F{Has address?}
    F -- No --> G[Add new address] --> H
    F -- Yes --> H[Select address<br/>default preselected if there is one]
    H --> I[Select payment method:<br/>COD or Online]
    I --> J[Click Place Order<br/>button disabled while submitting]
    J --> K[[Server: BEGIN TRANSACTION]]
    K --> K1[Lock cart row<br/>SELECT ... FOR UPDATE]
    K1 --> K2{Cart still has items?}
    K2 -- No: e.g. double-click,<br/>first request already ordered --> K3[ROLLBACK, CART_EMPTY<br/>Web goes to My Orders] --> Z
    K2 -- Yes --> K4{Address belongs<br/>to this user?}
    K4 -- No --> K5[ROLLBACK, NOT_FOUND] --> H
    K4 -- Yes --> L[Load cart items with CURRENT prices from DB]
    L --> M[For each item, sorted by product_id:<br/>atomic stock decrement<br/>WHERE is_active AND stock &gt;= qty]
    M --> N{All items reserved?}
    N -- No --> O[ROLLBACK] --> P[Show error: OUT_OF_STOCK<br/>or no longer available] --> B
    N -- Yes --> Q[Calculate subtotal, shipping fee, total]
    Q --> R[Create order status = pending<br/>order_items with name and price snapshot<br/>ship_* copied from address<br/>Online: expires_at = now + ORDER_PAYMENT_TIMEOUT_MINUTES]
    R --> R1[Insert status history<br/>from = null, to = pending]
    Q -.- QN[order_number = SKH- + date in Phnom Penh<br/>+ nextval order_number_seq]
    R1 --> S{Payment method?}
    S -- COD --> S1[Create payment<br/>provider = cod, status = pending]
    S -- Online --> S2[No payment row yet<br/>created at initiate, flowchart 4]
    S1 --> T[Clear cart]
    S2 --> T
    T --> U[[COMMIT]]
    U --> V{Payment method?}
    V -- COD --> W[Show order success page] --> Z
    V -- Online --> X[Go to Payment flow] --> Z
```

## 4. Online Payment

```mermaid
flowchart TD
    A([Order created, status = pending]) --> B[Client calls initiate payment]
    B --> B1{Own order, online, pending,<br/>and expires_at &gt; now?}
    B1 -- No --> B2[Reject: ORDER_EXPIRED or<br/>INVALID_STATUS_TRANSITION] --> Z([End])
    B1 -- Yes --> B3{Order already has a<br/>pending payment?}
    B3 -- Yes --> B4[Return the SAME payment URL / QR<br/>no new payment row]
    B3 -- No: none yet, or last one<br/>failed or expired --> C[[Create payment status = pending<br/>PaymentProvider.createPayment<br/>save provider_txn_id, payment_url, qr_string]]
    C -. Unique conflict: another click<br/>created a pending payment first .-> B4
    B4 --> D
    C --> D[Show payment page / KHQR code<br/>start flowchart 11]
    D --> E{Customer pays<br/>before expires_at?}
    E -- No --> F[Expiry job cancels order<br/>See flowchart 6] --> Z
    E -- Yes --> G{How does the result arrive?}
    G -- Webhook --> H{Signature valid?}
    H -- No --> I[Reject 401, log warning] --> Z
    H -- Yes --> J
    G -- Polling job<br/>checkStatus --> J{provider_txn_id known?}
    J -- No --> J1[Return 200, log error] --> Z
    J -- Yes --> M{Result status?}
    M -- failed --> N[UPDATE payment SET failed<br/>WHERE status = pending<br/>Order stays pending,<br/>customer may retry until expiry] --> L
    M -- success --> P0[[Transaction:<br/>UPDATE payments SET success, paid_at = now<br/>WHERE provider_txn_id = ? AND status != success]]
    P0 --> P1{1 row updated?}
    P1 -- No: already processed<br/>duplicate callback --> L[Return 200 OK<br/>nothing else changes] --> Z
    P1 -- Unique index conflict:<br/>order already has another<br/>successful payment --> P2[ROLLBACK, log error with raw callback<br/>then SET orders.needs_refund = true] --> L
    P1 -- Yes --> O{UPDATE orders SET confirmed<br/>WHERE status = pending<br/>1 row updated?}
    O -- No: already cancelled/expired --> P[SET orders.needs_refund = true<br/>COMMIT payment<br/>Order stays cancelled<br/>Admin refunds manually outside system] --> L
    O -- Yes --> Q[Insert status history<br/>COMMIT] --> L
```

**Why conditional updates:** the webhook, a duplicate webhook, and the expiry job can run at the same moment. Each step only changes a row if it is still in the expected status, so PostgreSQL decides who wins and nothing is processed twice (architecture §4.5, §4.7).

**Why reuse the pending payment:** if every click on "Pay" created a new QR code, a customer could scan and pay two of them. Returning the same QR while it is still pending prevents this in almost all cases. If it still happens (for example, the customer pays a QR from a failed attempt that the gateway accepted late), the second success conflicts with the "one success per order" index; the server logs it with the raw callback, sets `orders.needs_refund = true`, returns 200 so the gateway stops retrying, and the admin refunds the extra payment from the gateway's merchant portal.

## 5. Order Status Lifecycle

```mermaid
stateDiagram-v2
    [*] --> pending: Order placed
    pending --> confirmed: Online payment success<br/>or admin confirms COD
    pending --> cancelled: Customer/admin cancels<br/>or payment timeout
    confirmed --> processing: Admin starts packing
    confirmed --> cancelled: Customer/admin cancels
    processing --> shipped: Admin hands to delivery
    shipped --> delivered: Admin marks delivered<br/>(COD payment = success)
    delivered --> [*]
    cancelled --> [*]
```

**Rules**
- Any transition not shown above is rejected by the server (`INVALID_STATUS_TRANSITION`).
- Every move to `cancelled` restores product stock (in the same transaction) and sets `cancel_reason`: `payment_timeout`, `customer_cancelled`, or `admin_cancelled`.
- Customers can cancel only from `pending` or `confirmed`. From `processing` onward, only admins can change the status, and only forward.
- Every change, including order creation (`null` → `pending`), inserts a row in `order_status_history`.
- For COD orders, the payment becomes `success` when the order becomes `delivered`.
- No transitions exist after `processing` other than `shipped` → `delivered`. Returns and failed deliveries are out of scope in V1 and handled manually by the shop.
- Refunds are out of scope: when a paid online order is cancelled, the admin refunds the customer outside the system. Every cancel of an order with a successful payment sets `orders.needs_refund = true`; admins find these orders with the `needsRefund` filter and click **Mark refund handled** after refunding. This sets `needs_refund = false` and records `refund_handled_at` and `refund_handled_by`.

## 6. Unpaid Order Expiry Job (runs every minute)

```mermaid
flowchart TD
    A([Scheduler tick]) --> B[[BEGIN TRANSACTION]]
    B --> C[SELECT one order WHERE status = pending<br/>AND payment_method = online<br/>AND expires_at &lt; now<br/>LIMIT 1 FOR UPDATE SKIP LOCKED]
    C --> D{Order found?}
    D -- No --> D1[COMMIT] --> Z([End])
    D -- Yes --> E[UPDATE orders SET cancelled,<br/>cancel_reason = payment_timeout<br/>WHERE id = ? AND status = pending]
    E --> E1{1 row updated?}
    E1 -- No: paid or cancelled<br/>in the meantime --> E3[ROLLBACK] --> B
    E1 -- Yes --> E2[Pending payments = expired<br/>Restore stock for each item<br/>Insert status history]
    E2 --> E4[[COMMIT]] --> B
```

- **One transaction per order:** the row lock from `FOR UPDATE` lasts until COMMIT, so the order stays locked while it is being cancelled. `SKIP LOCKED` makes other API instances skip it and take the next order instead.
- The loop ends when no expired order is left.
- The same cancel logic runs **lazily** when an expired pending order is read or a payment is initiated, in case the job did not run on time (architecture §4.6).

## 7. Admin: Manage Product

```mermaid
flowchart TD
    A([Admin opens Products]) --> B{Action?}
    B -- Create --> C[Fill form: name, category,<br/>description, price, initial stock, SKU]
    C --> D{Valid?<br/>price is whole cents &gt; 0<br/>stock &gt;= 0, category active<br/>SKU and slug unique}
    D -- No --> C
    D -- Yes --> E[Save product]
    E --> F[Upload images<br/>check type and size]
    F --> F1[First image becomes primary<br/>automatically]
    F1 --> G[Optionally reorder images<br/>or choose another primary] --> Z([End])
    B -- Edit --> H[Change fields] --> D
    B -- Adjust stock --> I[Enter change amount +/-<br/>and reason]
    I --> I1{stock + change &gt;= 0?<br/>atomic update}
    I1 -- No --> I2[Show error: stock<br/>cannot go below zero] --> I
    I1 -- Yes --> J[Save] --> Z
    B -- Deactivate --> K[is_active = false<br/>hidden from shop,<br/>past orders unaffected] --> Z
    B -- Reactivate --> K2[is_active = true<br/>visible in shop again] --> Z
```

**Why deactivate instead of delete:** products are referenced by past orders and reviews. Deleting them would break order history.
**Why a change amount for stock:** see architecture §6 (Admin endpoints).

## 8. Write a Review

```mermaid
flowchart TD
    A([Customer opens delivered order]) --> B[Click Review on a product<br/>button hidden if already reviewed]
    B --> G[Enter rating 1-5 and comment<br/>Submit]
    G --> P{Product active?}
    P -- No --> P1[Reject: NOT_FOUND] --> Z([End])
    P -- Yes --> C{Has delivered order<br/>containing this product?}
    C -- No --> D[Reject: NOT_ELIGIBLE_TO_REVIEW] --> Z
    C -- Yes --> E{Already reviewed?}
    E -- Yes --> F[Reject: ALREADY_REVIEWED] --> Z
    E -- No --> H[[Insert review<br/>Recalculate avg_rating and review_count<br/>from the reviews table]]
    H --> H1{Unique constraint<br/>violated?<br/>double submit}
    H1 -- Yes --> F
    H1 -- No --> H2[COMMIT, show review] --> Z
```

- The server checks C and E on submit even though the UI hides the button; the API can be called directly.
- **Recalculate, don't add:** `avg_rating` and `review_count` are computed from the `reviews` table (`AVG`, `COUNT`) in the same transaction. Updating them from a previously read value can be wrong if two reviews are saved at the same moment.
- Deactivated products cannot be reviewed, even from an old delivered order.

## 9. Admin: Process Order

```mermaid
flowchart TD
    A([Admin opens order]) --> B{Current status?}
    B -- pending COD --> C{Confirm or cancel?}
    C -- Confirm --> C1[Phone the customer if needed<br/>pending to confirmed]
    C -- Cancel --> X
    B -- pending online --> W[Wait for payment<br/>admin may cancel] --> X
    B -- confirmed --> D{Pack or cancel?}
    D -- Pack --> D1[confirmed to processing]
    D -- Cancel --> X
    B -- processing --> E[Hand to delivery<br/>processing to shipped]
    B -- shipped --> F[Delivery confirmed<br/>shipped to delivered]
    F --> F1{COD?}
    F1 -- Yes --> F2[COD payment = success<br/>paid_at = now]
    F1 -- No --> G
    F2 --> G
    C1 --> G[[Transaction:<br/>UPDATE orders SET new status<br/>WHERE status = expected<br/>Insert status history]]
    D1 --> G
    E --> G
    G --> G1{1 row updated?}
    G1 -- No --> G2[Show error: INVALID_STATUS_TRANSITION<br/>order changed, reload] --> Z([End])
    G1 -- Yes --> Z
    X[[Cancel transaction:<br/>UPDATE orders SET cancelled,<br/>cancel_reason = admin_cancelled<br/>WHERE status = expected<br/>Restore stock, pending payments = expired<br/>If a payment succeeded: needs_refund = true<br/>Insert status history]] --> X1{1 row updated?}
    X1 -- No --> G2
    X1 -- Yes --> X2{Order has a<br/>successful payment?}
    X2 -- Yes --> X3[Order appears in needsRefund filter<br/>admin refunds manually] --> Z
    X2 -- No --> Z
```

- The admin UI shows only the buttons for transitions allowed from the current status (flowchart 5). The server still validates every request.
- `delivered` and the COD payment update happen in the **same transaction**.

## 10. Customer: Cancel Order

```mermaid
flowchart TD
    A([Customer opens own order]) --> B{Status pending<br/>or confirmed?}
    B -- No --> B1[Cancel button hidden<br/>contact the shop] --> Z([End])
    B -- Yes --> C[Click Cancel, confirm in dialog]
    C --> D[[Transaction:<br/>UPDATE orders SET cancelled,<br/>cancel_reason = customer_cancelled<br/>WHERE id = ? AND user_id = me<br/>AND status IN pending, confirmed]]
    D --> E{1 row updated?}
    E -- No: e.g. admin started<br/>packing a moment ago --> E1[ROLLBACK<br/>INVALID_STATUS_TRANSITION<br/>reload order] --> Z
    E -- Yes --> F[Restore stock for each item<br/>Pending payments = expired<br/>If paid online: needs_refund = true<br/>Insert status history<br/>COMMIT]
    F --> G{Was the order paid online?}
    G -- Yes --> G1[Show: the shop will contact you<br/>about your refund] --> Z
    G -- No --> G2[Show: order cancelled] --> Z
```

## 11. Payment Page: Wait for Result

```mermaid
flowchart TD
    A([Payment page shows URL / QR<br/>and countdown to expires_at]) --> B[Every 3 seconds:<br/>GET /orders/:orderNumber]
    B --> C{Order status?}
    C -- confirmed --> D[Show 'Payment successful'<br/>go to order detail] --> Z([End])
    C -- cancelled --> E[Show 'Payment time expired'<br/>items returned to stock] --> Z
    C -- pending --> F{Latest payment failed?}
    F -- Yes --> G[Show 'Payment failed'<br/>Try again button = initiate]
    G --> A
    F -- No --> H{Countdown reached 0?}
    H -- No --> B
    H -- Yes --> H2[Show 'Checking payment...'<br/>keep polling up to 1 more minute] --> B
```

- The payment result goes from the gateway **to the server**, not to the browser, so the page asks the server until the order is decided.
- Polling stops when the customer leaves the page. When they come back to the order detail page, it shows the current status. Lazy expiry (flowchart 6) makes sure an expired order shows as cancelled.
- Polling continues for a short time after the countdown reaches 0, because a payment made just before the deadline may still be on its way.
