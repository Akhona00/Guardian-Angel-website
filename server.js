// server.js
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const stripe = require("stripe")(
  process.env.STRIPE_SECRET_KEY || ""
);
const path = require("path");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("templates")); // Serve static files from templates directory


// Database connection
const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "guardian_angel_studio",
  password: process.env.DB_PASSWORD || "Asom*123postgres",
  port: process.env.DB_PORT || 5432,
});

// Initialize database
async function initializeDatabase() {
  try {
    // Create tables if they don't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    pool.query("SELECT NOW()", (err, res) => {
      if (err) console.error("Database connection error:", err);
      else console.log("Database connected at:", res.rows[0].now);
    });

    await pool.query(`
      CREATE TABLE IF NOT EXISTS carts (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id SERIAL PRIMARY KEY,
        cart_id INTEGER REFERENCES carts(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(cart_id, product_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      ALTER TABLE payments
        ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
        ADD COLUMN IF NOT EXISTS items JSONB
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
        session_id VARCHAR(255) NOT NULL,
        amount INTEGER NOT NULL,
        currency VARCHAR(3) NOT NULL,
        status VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert sample products if none exist
    const { rows } = await pool.query("SELECT COUNT(*) FROM products");
    if (parseInt(rows[0].count) === 0) {
      const products = [
        ["Design", "Professional design services for your business", 2000.0],
        [
          "Professional Sound Hire",
          "High-quality audio equipment rental",
          2000.0,
        ],
        ["AI & Machine Learning", "Custom AI solutions and consulting", 2500.0],
        [
          "Cyber Security",
          "Comprehensive security assessment and protection",
          7000.0,
        ],
        ["Photography", "Professional photography services", 2000.0],
        [
          "Placement & Project Management",
          "Expert project management services",
          2500.0,
        ],
        [
          "Technical Support Services",
          "24/7 technical support and maintenance",
          1500.0,
        ],
        ["Videography", "Professional video production services", 2000.0],
        ["Domain & Hosting", "Web hosting and domain registration", 3000.0],
        ["Marketing", "Digital marketing and brand promotion", 1000.0],
        ["Development", "Custom software development solutions", 5000.0],
        ["Email Services", "Professional email hosting and management", 500.0],
      ];

      for (const [name, description, price] of products) {
        await pool.query(
          "INSERT INTO products (name, description, price) VALUES ($1, $2, $3)",
          [name, description, price]
        );
      }
    }
  } catch (err) {
    console.error("Error initializing database:", err);
  }
}

// Helper function to get or create cart
async function getOrCreateCart(sessionId) {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM carts WHERE session_id = $1",
      [sessionId]
    );

    if (rows.length === 0) {
      const { rows: newCart } = await pool.query(
        "INSERT INTO carts (session_id) VALUES ($1) RETURNING *",
        [sessionId]
      );
      return newCart[0];
    }

    return rows[0];
  } catch (err) {
    throw err;
  }
}

// API Routes

// Get all products
app.get("/api/products", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM products");
    // Convert price to number
    const products = rows.map(row => ({
      ...row,
      price: parseFloat(row.price)
    }));
    res.json(products);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add item to cart
app.post("/api/cart/add", async (req, res) => {
  try {
    const { sessionId, productId, quantity = 1 } = req.body;

    if (!sessionId || !productId) {
      return res
        .status(400)
        .json({ error: "Session ID and Product ID are required" });
    }

    // Verify product exists
    const { rows: productRows } = await pool.query(
      "SELECT * FROM products WHERE id = $1",
      [productId]
    );
    if (productRows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Get or create cart
    const cart = await getOrCreateCart(sessionId);

    // Add or update cart item
    await pool.query(
      `INSERT INTO cart_items (cart_id, product_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (cart_id, product_id)
       DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity`,
      [cart.id, productId, quantity]
    );

    res.json({ success: true, message: "Item added to cart" });
  } catch (err) {
    console.error("Error adding to cart:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get cart contents
app.get("/api/cart/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    const { rows } = await pool.query(
      `SELECT ci.id, ci.quantity, p.id as product_id, p.name, p.price, p.description
       FROM cart_items ci
       JOIN carts c ON ci.cart_id = c.id
       JOIN products p ON ci.product_id = p.id
       WHERE c.session_id = $1`,
      [sessionId]
    );

    // Convert price to number
    const items = rows.map(row => ({
      ...row,
      price: parseFloat(row.price)
    }));

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    res.json({
      items,
      total: total.toFixed(2),
      count: items.reduce((sum, item) => sum + item.quantity, 0)
    });
  } catch (err) {
    console.error("Error fetching cart:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update cart item quantity
app.put("/api/cart/update", async (req, res) => {
  try {
    const { sessionId, productId, quantity } = req.body;

    if (!sessionId || !productId || quantity < 0) {
      return res.status(400).json({ error: "Invalid parameters" });
    }

    if (quantity === 0) {
      // Remove item from cart
      await pool.query(
        `DELETE FROM cart_items 
         WHERE cart_id = (SELECT id FROM carts WHERE session_id = $1) 
         AND product_id = $2`,
        [sessionId, productId]
      );
    } else {
      // Update quantity
      await pool.query(
        `UPDATE cart_items 
         SET quantity = $3
         WHERE cart_id = (SELECT id FROM carts WHERE session_id = $1) 
         AND product_id = $2`,
        [sessionId, productId, quantity]
      );
    }

    res.json({ success: true, message: "Cart updated" });
  } catch (err) {
    console.error("Error updating cart:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Remove item from cart
app.delete("/api/cart/remove", async (req, res) => {
  try {
    const { sessionId, productId } = req.body;

    await pool.query(
      `DELETE FROM cart_items 
       WHERE cart_id = (SELECT id FROM carts WHERE session_id = $1) 
       AND product_id = $2`,
      [sessionId, productId]
    );

    res.json({ success: true, message: "Item removed from cart" });
  } catch (err) {
    console.error("Error removing from cart:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create payment intent
app.post("/api/create-payment-intent", async (req, res) => {
  try {
    const { sessionId, customerEmail } = req.body;

    // Validate input
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
    }

    // Get cart contents
    const { rows } = await pool.query(
      `SELECT ci.quantity, p.id as product_id, p.name, p.price
       FROM cart_items ci
       JOIN carts c ON ci.cart_id = c.id
       JOIN products p ON ci.product_id = p.id
       WHERE c.session_id = $1`,
      [sessionId]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    const total = rows.reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0);
    const amountInCents = Math.round(total * 100);

    // Create payment intent with proper metadata
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'zar',
      description: 'Guardian Angel Studio Purchase',
      metadata: {
        session_id: sessionId,
        customer_email: customerEmail
      },
      receipt_email: customerEmail,
      automatic_payment_methods: {
        enabled: true // Important for modern Stripe integration
      }
    });

    console.log('Created PaymentIntent:', paymentIntent.id);
    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (err) {
    console.error('Error creating payment intent:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/confirm-payment", async (req, res) => {
  try {
    const { paymentIntentId, sessionId } = req.body;

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Get cart items from database
    const { rows: cartItems } = await pool.query(
      `
      SELECT 
        p.id AS product_id,
        p.name,
        p.price,
        ci.quantity,
        (p.price * ci.quantity) AS item_total
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      JOIN carts c ON ci.cart_id = c.id
      WHERE c.session_id = $1
    `,
      [sessionId]
    );

    // Record payment with items
    const {
      rows: [payment],
    } = await pool.query(
      `
      INSERT INTO payments (
        payment_intent_id,
        session_id,
        amount,
        currency,
        status,
        customer_email,
        items
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
      [
        paymentIntent.id,
        sessionId,
        paymentIntent.amount,
        paymentIntent.currency,
        paymentIntent.status,
        paymentIntent.metadata?.customer_email || null,
        JSON.stringify(cartItems),
      ]
    );

    // Clear the cart
    await pool.query(
      `
      DELETE FROM cart_items 
      WHERE cart_id = (SELECT id FROM carts WHERE session_id = $1)
    `,
      [sessionId]
    );

    res.json({
      success: true,
      payment: {
        ...payment,
        items: cartItems, // Include items in response for immediate confirmation
      },
    });
  } catch (err) {
    console.error("Error in confirm-payment:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/orders/:paymentIntentId", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT 
        id,
        payment_intent_id,
        amount,
        currency,
        status,
        customer_email,
        items,
        created_at
      FROM payments
      WHERE payment_intent_id = $1
    `,
      [req.params.paymentIntentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = {
      ...rows[0],
      // Convert amount from cents to currency
      amount: rows[0].amount / 100,
      // Parse JSON items if needed
      items:
        typeof rows[0].items === "string"
          ? JSON.parse(rows[0].items)
          : rows[0].items,
    };

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Static file routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "templates", "index.html"));
});

app.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, "templates", "about.html"));
});

app.get("/services", (req, res) => {
  res.sendFile(path.join(__dirname, "templates", "services.html"));
});

app.get("/contact", (req, res) => {
  res.sendFile(path.join(__dirname, "templates", "contact.html"));
});

app.get("/shop", (req, res) => {
  res.sendFile(path.join(__dirname, "templates", "shop.html"));
});

//-------------------------------Contacts--------------------//
// --- Contact Form API ---//

app.post("/api/contact", async (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: "All fields are required." });
  }
  try {
    // Insert contact into database
    await pool.query(
      "INSERT INTO contacts (name, email, subject, message) VALUES ($1, $2, $3, $4)",
      [name, email, subject, message]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Error saving contact:", err);
    return res.status(500).json({ error: "Failed to save contact." });
  }
  try {
    const formspreeURL = "https://formspree.io/f/mzzgvakl"; // Replace with your Formspree form ID

    const response = await fetch(formspreeURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        _replyto: email,
        message,
      }),
    });

    if (response.ok) {
      res.json({ success: "Message sent successfully." });
    } else {
      const errorText = await response.text();
      res.status(500).json({ error: `Formspree error: ${errorText}` });
    }
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message." });
  }
});

// Initialize database and start server
initializeDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });
