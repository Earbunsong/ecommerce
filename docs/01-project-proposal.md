# Project Proposal: ShopKH — Online Shopping Web Application

| Item | Detail |
|---|---|
| Project type | Web application (single-store e-commerce) |
| Frontend | React + TypeScript |
| Backend | Hono API (TypeScript) |
| Database | PostgreSQL |
| Prepared by | Ear Bunsong |
| Location | Phnom Penh, Cambodia |

---

## 1. Background

Online shopping in Cambodia has grown quickly, driven by smartphone use, social media selling, and mobile payment services such as ABA Mobile and Bakong KHQR. However, many small and medium shops still sell mainly through Facebook pages and Telegram chats. Orders are taken manually in messages, stock is tracked in notebooks or spreadsheets, and customers have no way to check product availability or order status without asking the seller directly.

This project proposes a web-based e-commerce application where a single store can publish its products online, and customers can browse, order, pay, and track their orders by themselves.

## 2. Problem Statement

1. **Manual order handling** — taking orders through chat is slow, error-prone, and hard to scale when message volume grows.
2. **No real-time stock information** — customers order items that are already sold out, causing cancellations and bad experience.
3. **No order tracking** — customers must message the shop to ask "where is my order?", which wastes staff time.
4. **No sales data** — the owner cannot easily see best-selling products, daily revenue, or customer history to make decisions.

## 3. Objectives

1. Build a responsive website where customers can browse, search, and filter products.
2. Provide a shopping cart and checkout process supporting Cash on Delivery and online payment.
3. Keep product stock accurate automatically, including handling of unpaid and cancelled orders.
4. Let customers track order status from placement to delivery.
5. Provide an admin dashboard to manage products, categories, orders, customers, and view sales reports.
6. Apply a clean, maintainable architecture with type-safe communication between frontend and backend.

## 4. Scope

### 4.1 In scope (Version 1)

- Customer registration, login, logout, and profile management
- Delivery address management (multiple addresses, one default)
- Product catalog with categories, search, filter (category, price), sort, and pagination
- Product detail page with multiple images and customer reviews
- Shopping cart (logged-in users)
- Checkout with shipping address selection and order summary
- Payment methods: Cash on Delivery (COD) and online payment (mock/sandbox first, real gateway such as ABA PayWay or Bakong KHQR later)
- Order history and order status tracking
- Product reviews (only by customers who received the product)
- Admin: product and category management, image upload, stock management
- Admin: order management and status updates
- Admin: customer list
- Admin: sales report (revenue by day, top products, order counts by status)

### 4.2 Out of scope (Future work)

- Multi-vendor marketplace (many sellers)
- Product variants (size, color) — V1 treats each variant as a separate product
- Coupons, discount codes, loyalty points
- Wishlist
- Guest checkout (V1 requires login)
- **Refunds** — the system does not process or record refunds. When a paid online order is cancelled, the admin refunds the customer manually outside the system (for example, through the ABA merchant portal). V1 only flags these orders and lets the admin mark them as handled (FR-22).
- **Returns, failed deliveries, and cancellation after packing** — once an order is `processing`, it can only move forward (`shipped` → `delivered`). Problems after this point are handled manually by the shop.
- Forgot/reset password and email or Telegram notifications (both need an email/messaging service). In V1, an admin can help a customer who cannot log in.
- Delivery company integration and live shipment tracking
- Mobile app (the website will be mobile-responsive instead)
- Multi-language (Khmer/English) and multi-currency (KHR) — V1 uses English and USD

**Why limit the scope:** e-commerce features can grow without end. Fixing a clear V1 scope makes it possible to finish, test, and present a complete, working system, rather than many half-finished features.

## 5. Users and Roles

| Role | Description |
|---|---|
| Guest | Visitor not logged in. Can browse and search products, see stock availability, and read reviews. Must log in to use the cart and checkout. |
| Customer | Registered user. Can manage cart, place orders, pay, track orders, manage addresses, and write reviews. |
| Admin | Store owner/staff. Can manage products, categories, stock, orders, and customers, and view reports. The first admin account is created by the database seed script; V1 has no screen for creating admins. |

## 6. Functional Requirements

### 6.1 Customer

| ID | Requirement |
|---|---|
| FR-01 | The system shall allow a guest to register with full name, email, phone, and password, and log them in immediately. Emails are case-insensitive. Passwords are 8–128 characters. Phone numbers must be Cambodian (`0XX…` or `+855…`) and are stored in the local `0XX…` form. |
| FR-02 | The system shall allow users to log in and log out. |
| FR-03 | The system shall allow customers to view and update their profile. |
| FR-04 | The system shall allow customers to add, edit, delete, and set a default delivery address. |
| FR-05 | The system shall display products with name, primary image, price, and stock availability. |
| FR-06 | The system shall allow searching products by name and filtering by category and price range. Filtering by a parent category includes its sub-categories. Products in a deactivated category are hidden. |
| FR-07 | The system shall allow sorting products by newest, price (low/high), and best rating. |
| FR-08 | The system shall display a product detail page with images, description, price, stock, and reviews. |
| FR-09 | The system shall allow customers to add products to the cart, change quantity, and remove items. |
| FR-10 | The system shall prevent adding more quantity than the available stock. The cart does not reserve stock; stock is checked again and reserved only at checkout. |
| FR-11 | The system shall allow customers to check out by choosing an address and payment method. |
| FR-12 | The system shall calculate subtotal, shipping fee, and total on the server (never trust prices sent by the browser). The shipping fee is a flat amount, and shipping is free when the subtotal reaches a threshold. Both values are configurable. |
| FR-13 | The system shall support Cash on Delivery and online payment. A COD order must be confirmed by an admin, and its payment is marked successful when the order is delivered. An online order is confirmed automatically when payment succeeds. |
| FR-14 | The system shall cancel unpaid online orders automatically after 15 minutes (configurable) and return the stock. |
| FR-15 | The system shall allow customers to view order history and the status of each order. |
| FR-16 | The system shall allow customers to cancel their own order while it is `pending` or `confirmed`. Cancelling a paid order does not refund automatically (see §4.2). |
| FR-17 | The system shall allow customers to review (rating 1–5 and comment) active products from delivered orders, once per product. |

### 6.2 Admin

| ID | Requirement |
|---|---|
| FR-18 | The system shall allow admins to create, update, deactivate, and list products. |
| FR-19 | The system shall allow admins to upload and order multiple product images. |
| FR-20 | The system shall allow admins to manage categories. |
| FR-21 | The system shall allow admins to adjust product stock. |
| FR-22 | The system shall allow admins to view, filter, and search orders, including a "needs refund" filter for cancelled orders with a successful payment. After refunding manually, the admin marks the refund as handled. |
| FR-23 | The system shall allow admins to update order status following the allowed transitions only (see flowchart 5). |
| FR-24 | The system shall record a history of every order status change (who, when, from, to). |
| FR-25 | The system shall allow admins to view and activate/deactivate customer accounts. |
| FR-26 | The system shall show a dashboard with revenue (paid orders that are not cancelled), order counts by status, top-selling products, and low-stock products (stock of 5 or fewer). Daily figures use the Asia/Phnom_Penh time zone (UTC+7). |

## 7. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | Security | Passwords are hashed (argon2 or bcrypt); never stored as plain text. |
| NFR-02 | Security | Authentication uses a JWT stored in an httpOnly, secure, SameSite=Lax cookie with a 7-day lifetime. Logout clears the cookie. |
| NFR-03 | Security | All input is validated on the server with Zod. Admin routes require the admin role. |
| NFR-04 | Data integrity | Stock can never go below zero, even when two customers buy the last item at the same time. |
| NFR-05 | Data integrity | Order items store a snapshot of product name and price at purchase time. |
| NFR-06 | Performance | Product list pages reach Largest Contentful Paint in under 2.5 seconds in a Lighthouse mobile test. |
| NFR-07 | Usability | The website is responsive on mobile, tablet, and desktop. |
| NFR-08 | Reliability | Payment callbacks are idempotent: receiving the same callback twice does not pay an order twice. |
| NFR-09 | Maintainability | Code follows a layered structure (routes → services → repositories) with TypeScript end-to-end. |
| NFR-10 | Security | Login and registration are rate-limited per IP address to slow down password guessing: 10 attempts per 15 minutes, counted separately for login and registration. |

## 8. Technology Stack and Justification

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 19, Vite, TypeScript | Most widely used UI library, large ecosystem, fast dev server with Vite. |
| Routing (web) | React Router | Standard client-side routing for React. |
| Server state | TanStack Query | Handles API caching, loading, and error states, avoiding manual fetch logic. |
| UI | Tailwind CSS + shadcn/ui | Fast to build consistent, responsive UI with accessible components. |
| Backend | Hono 4 on Node.js 22 LTS | Lightweight, fast, built on Web Standards; strong TypeScript support. |
| API typing | Hono RPC client (`hc`) | Frontend gets backend types automatically, so API mistakes are caught at compile time. |
| Validation | Zod | One schema validates requests and produces TypeScript types. |
| Database | PostgreSQL 16 | Reliable relational database with transactions, which are essential for orders and stock. |
| ORM | Drizzle ORM | Type-safe, SQL-like, lightweight, and works well with Hono. |
| File storage | Local disk (dev), S3 or Cloudinary (prod) | Product images should not be stored in the database. |
| Testing | Vitest, Playwright | Vitest for fast unit and integration tests on API and web; Playwright for end-to-end tests of the main user journey. |
| Dev environment | Docker Compose (PostgreSQL) | Same database setup on every machine. |

## 9. Development Methodology

The project starts with a **design phase** (weeks 1–4) in which the proposal, architecture, ERD, flowcharts, and UI design are prepared. Development then follows an **Agile, iterative approach** with one-week sprints (weeks 5–12). Each sprint delivers a working, testable piece of the system (for example, "authentication" or "cart"). Design documents are updated whenever implementation reveals changes.

## 10. Timeline (12 weeks)

| Week | Activity | Deliverable |
|---|---|---|
| 1 | Requirement analysis, proposal | Project proposal |
| 2 | Architecture and database design | System architecture, ERD |
| 3 | Process design, UI wireframes | System flowcharts, Figma wireframes |
| 4 | High-fidelity UI design | Figma high-fidelity screens |
| 5 | Project setup, database, test infrastructure | Running API and web, database schema, CI |
| 6 | Authentication, catalog, admin product management | Auth and product APIs |
| 7 | Addresses, cart, checkout, order rules | Cart and order APIs |
| 8 | Payments, reviews, admin orders and reports | Complete backend API |
| 9 | Frontend: layout, auth, shop pages | Customer browsing UI |
| 10 | Frontend: checkout, account, admin pages | Customer purchase UI, admin UI |
| 11 | E2E testing, security review, bug fixing | Test report |
| 12 | Deployment, documentation, presentation | Live system, final report |

Each week maps to phases in the implementation plan (`05-implementation-plan.md`). The backend weeks (5–8) are the tightest part of the plan. If they slip, week 11 (testing) is the buffer, and reviews (FR-17) are the first feature to move to Future Work. Connecting the real payment gateway happens after merchant approval, outside the 12 weeks (Phase 13).

## 11. Expected Outcomes

- A working, deployed e-commerce website for customers and admins.
- Accurate automatic stock management, including concurrency protection.
- Complete documentation: proposal, architecture, ERD, flowcharts, UI design, and user guide.
- A codebase that can be extended with the future-work features.

## 12. Risks and Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Real payment gateway approval takes long | Online payment cannot be demonstrated | Build a payment provider interface with a mock provider first; plug in the real gateway when approved. |
| Scope creep (adding features mid-project) | Project not finished on time | Follow the V1 scope strictly; record new ideas under Future Work. |
| Two customers buy the last item at the same time | Overselling | Atomic stock update inside a database transaction. |
| Unpaid orders lock stock forever | Products appear sold out | Auto-expire unpaid online orders after 15 minutes and restore stock. |
| Payment arrives after the order has already expired | Customer has paid for a cancelled order | Record the payment as successful, keep the order cancelled, and show it in the admin "needs manual refund" filter. |
| Learning curve of new tools (Hono, Drizzle) | Slower development | Start with small modules; use official documentation and examples. |

## 13. Future Work

Multi-vendor support, product variants, coupons and promotions, wishlist, guest checkout, refunds and returns, forgot/reset password, email/Telegram order notifications, Khmer language and KHR currency, delivery partner integration, and a mobile app.
