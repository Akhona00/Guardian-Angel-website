// shop.js - Frontend cart management and Stripe integration
class ShopManager {
  constructor(stripePublicKey) {
    this.stripe = stripePublicKey ? Stripe(stripePublicKey) : null;
    this.cart = [];
    this.isCheckingOut = false;
    this.sessionId = this.getOrCreateSessionId();
    this.apiUrl = "/api";

    this.initializeEventListeners();
    this.loadCart();
  }

  getOrCreateSessionId() {
    let sessionId = sessionStorage.getItem("shop_session_id");
    if (!sessionId) {
      sessionId =
        "session_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
      sessionStorage.setItem("shop_session_id", sessionId);
    }
    return sessionId;
  }

  initializeEventListeners() {
    document.querySelector(".cart-button")?.addEventListener("click", (e) => {
      e.preventDefault();
      this.showCart();
    });

    document.querySelector(".close-cart")?.addEventListener("click", () => {
      this.hideCart();
    });

    document.querySelector(".cart-modal")?.addEventListener("click", (e) => {
      if (e.target.classList.contains("cart-modal")) {
        this.hideCart();
      }
    });

    this.setupProductButtons();
  }

  setupProductButtons() {
    document.querySelectorAll(".add-to-cart").forEach((button) => {
      button.addEventListener("click", async (e) => {
        const productItem = e.target.closest(".product-item");
        const productId = productItem.dataset.productId;
        const productName = productItem.querySelector("h2").textContent;
        const productPrice = parseFloat(
          productItem
            .querySelector(".product-price")
            .textContent.replace("R", "")
        );

        if (productId) {
          await this.addToCartAPI(productId, 1);
        } else {
          this.addToCart(productName, productPrice);
        }
      });
    });
  }

  async addToCartAPI(productId, quantity = 1) {
    try {
      const response = await fetch(`${this.apiUrl}/cart/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: this.sessionId,
          productId,
          quantity,
        }),
      });

      if (response.ok) {
        await this.loadCart();
        this.showNotification("Item added to cart!");
      } else {
        throw new Error("Failed to add item to cart");
      }
    } catch (error) {
      console.error("Error adding to cart:", error);
      this.showNotification("Error adding item to cart", "error");
    }
  }

  async loadCart() {
    try {
      const response = await fetch(`${this.apiUrl}/cart/${this.sessionId}`);
      if (response.ok) {
        const cartData = await response.json();
        this.cart = cartData.items.map((item) => ({
          ...item,
          price: parseFloat(item.price),
        }));
        this.updateCartDisplay();
      }
    } catch (error) {
      console.error("Error loading cart:", error);
    }
  }

  async removeFromCart(productId) {
    try {
      const response = await fetch(`${this.apiUrl}/cart/remove`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: this.sessionId,
          productId,
        }),
      });

      if (response.ok) {
        await this.loadCart();
      } else {
        throw new Error("Failed to remove item");
      }
    } catch (error) {
      console.error("Error removing from cart:", error);
      this.showNotification("Error removing item from cart", "error");
    }
  }

  async updateQuantity(productId, quantity) {
    try {
      const response = await fetch(`${this.apiUrl}/cart/update`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: this.sessionId,
          productId,
          quantity,
        }),
      });

      if (response.ok) {
        await this.loadCart();
      } else {
        throw new Error("Failed to update quantity");
      }
    } catch (error) {
      console.error("Error updating quantity:", error);
      this.showNotification("Error updating quantity", "error");
    }
  }

  updateCartDisplay() {
    const cartItems = document.querySelector(".cart-items");
    const cartTotal = document.querySelector(".cart-total");
    const cartCount = document.querySelector(".cart-count");
    const checkoutForm = document.querySelector(".checkout-form");

    if (!cartItems) return;
    cartItems.innerHTML = "";

    let total = 0,
      itemCount = 0;

    this.cart.forEach((item) => {
      const price = parseFloat(item.price);
      const itemTotal = price * item.quantity;
      total += itemTotal;
      itemCount += item.quantity;

      const cartItem = document.createElement("div");
      cartItem.className = "cart-item";
      cartItem.innerHTML = `
        <h3>${item.name}</h3>
        <p>R${price.toFixed(2)} each</p>
        <div class="quantity-controls">
          <button class="quantity-btn" data-action="decrease" data-product-id="${
            item.product_id
          }">-</button>
          <span class="quantity">${item.quantity}</span>
          <button class="quantity-btn" data-action="increase" data-product-id="${
            item.product_id
          }">+</button>
        </div>
        <p>Subtotal: R${itemTotal.toFixed(2)}</p>
        <button class="remove-item" data-product-id="${
          item.product_id
        }">Remove</button>
      `;
      cartItems.appendChild(cartItem);
    });

    cartTotal &&
      (cartTotal.innerHTML = `<strong>Total: R${total.toFixed(2)}</strong>`);
    cartCount &&
      ((cartCount.textContent = itemCount),
      (cartCount.style.display = itemCount > 0 ? "inline" : "none"));
    checkoutForm &&
      (checkoutForm.style.display = this.cart.length > 0 ? "block" : "none");

    this.setupCartItemButtons();
  }

  setupCartItemButtons() {
    document.querySelectorAll(".remove-item").forEach((button) => {
      button.addEventListener("click", (e) => {
        const productId = e.target.dataset.productId;
        this.removeFromCart(productId);
      });
    });

    document.querySelectorAll(".quantity-btn").forEach((button) => {
      button.addEventListener("click", (e) => {
        const action = e.target.dataset.action;
        const productId = e.target.dataset.productId;
        const quantitySpan = e.target.parentNode.querySelector(".quantity");
        let currentQuantity = parseInt(quantitySpan.textContent);
        if (action === "increase") {
          currentQuantity += 1;
        } else if (action === "decrease" && currentQuantity > 1) {
          currentQuantity -= 1;
        } else if (action === "decrease" && currentQuantity === 1) {
          this.removeFromCart(productId);
          return;
        }
        this.updateQuantity(productId, currentQuantity);
      });
    });
  }

  showCart() {
    const cartModal = document.querySelector(".cart-modal");
    if (cartModal) {
      cartModal.style.display = "flex";
      setTimeout(() => cartModal.classList.add("active"), 10);
    }
  }

  hideCart() {
    const cartModal = document.querySelector(".cart-modal");
    if (cartModal) {
      cartModal.classList.remove("active");
      setTimeout(() => (cartModal.style.display = "none"), 300);
    }
  }

  showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  }
}

class AdvancedShopManager extends ShopManager {
  constructor(stripePublicKey) {
    super(stripePublicKey);
    this.elements = this.stripe ? this.stripe.elements() : null;
    this.cardElement = null;
    this.cardMounted = false;

    if (this.stripe) {
      this.setupStripeElements();
    }
  }

  setupStripeElements() {
    if (!this.elements) {
      console.error("Stripe Elements not initialized");
      return;
    }
    const style = {
      base: {
        fontSize: "16px",
        color: "#32325d",
        fontFamily: '"Poppins", sans-serif',
        "::placeholder": { color: "#aab7c4" },
      },
      invalid: { color: "#fa755a", iconColor: "#fa755a" },
    };

    try {
      this.cardElement = this.elements.create("card", { style });
      this.setupCheckoutForm();
    } catch (error) {
      console.error("Error creating Stripe card element:", error);
    }
  }

  setupCheckoutForm() {
    const form = document.getElementById("payment-form");
    if (!form) {
      console.error("Payment form not found");
      return;
    }

    const cardElementContainer = document.getElementById("card-element");
    if (this.cardElement && cardElementContainer) {
      try {
        this.cardElement.mount(cardElementContainer);
        this.cardMounted = true;
        this.cardElement.on("change", (event) => {
          const displayError = document.getElementById("card-errors");
          if (displayError) {
            displayError.textContent = event.error ? event.error.message : "";
          }
        });
      } catch (error) {
        console.error("Error mounting Stripe card element:", error);
        this.cardMounted = false;
      }
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await this.handleFormSubmit();
    });
  }

  async handleFormSubmit() {
    if (this.isCheckingOut) return;
    const submitButton = document.querySelector(".checkout-button-stripe");
    const cardErrors = document.getElementById("card-errors");
    try {
      this.isCheckingOut = true;
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML =
          '<i class="fas fa-spinner fa-spin"></i> Processing...';
      }
      if (!this.cardMounted || !this.cardElement)
        throw new Error(
          "Payment form is not properly initialized. Please refresh the page."
        );

      const customerEmail = document.getElementById("customer-email").value;
      const customerName = document.getElementById("customer-name").value;

      if (!customerEmail || !customerEmail.includes("@"))
        throw new Error("Please enter a valid email address");
      if (!customerName || customerName.trim() === "")
        throw new Error("Please enter your full name");

      // Step 1: Create PaymentIntent from backend
      const intentResponse = await fetch(
        `${this.apiUrl}/create-payment-intent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: this.sessionId,
            customerEmail,
          }),
        }
      );
      if (!intentResponse.ok)
        throw new Error("Could not create payment intent");

      const { clientSecret, paymentIntentId } = await intentResponse.json();
      // Step 2: Confirm card payment using Stripe.js
      const result = await this.stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: this.cardElement,
          billing_details: { name: customerName, email: customerEmail },
        },
      });

      if (result.error) {
        throw new Error(result.error.message || "Payment failed");
      }
      if (result.paymentIntent.status === "succeeded") {
        // Step 3: Confirm payment with backend
        const confirmResponse = await fetch(`${this.apiUrl}/confirm-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentIntentId,
            sessionId: this.sessionId,
          }),
        });
        const confirmData = await confirmResponse.json();
        if (confirmData.success) {
          this.showOrderConfirmation(confirmData.payment);
          await this.loadCart();
        } else {
          throw new Error("Order confirmation failed");
        }
      } else {
        throw new Error("Payment not completed.");
      }
    } catch (error) {
      cardErrors && (cardErrors.textContent = error.message);
      this.showNotification(error.message, "error");
    } finally {
      this.isCheckingOut = false;
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-lock"></i> Complete Payment';
      }
    }
  }

  showOrderConfirmation(payment) {
    const modal = document.createElement("div");
    modal.className = "order-confirmation-modal";
    const totalAmount = (payment.amount / 100).toFixed(2);
    const itemsList = payment.items
      .map(
        (item) => `
      <div class="order-item">
        <h4>${item.name}</h4>
        <p>${item.quantity} × R${item.price} = R${item.item_total}</p>
      </div>
    `
      )
      .join("");
    modal.innerHTML = `
      <div class="order-content">
        <h2>Order Confirmation</h2>
        <p>Order ID: ${payment.payment_intent_id}</p>
        <div class="order-items">${itemsList}</div>
        <div class="order-total">
          <strong>Total: R${totalAmount}</strong>
        </div>
        <button class="close-order">Close</button>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector(".close-order").addEventListener("click", () => {
      modal.remove();
    });
  }
}

// Initialize the shop manager when DOM is loaded
document.addEventListener("DOMContentLoaded", async () => {
  const STRIPE_PUBLIC_KEY = "pk_test_qblFNYngBkEdjEZ16jxxoWSM";
  try {
    window.shopManager = new AdvancedShopManager(STRIPE_PUBLIC_KEY);
    console.log("Shop manager initialized successfully");
    await loadProducts();
  } catch (error) {
    console.error("Failed to initialize shop manager:", error);
    window.shopManager = new ShopManager(STRIPE_PUBLIC_KEY);
  }
});

async function loadProducts() {
  const productList = document.getElementById("productList");
  const loading = document.querySelector(".loading");
  const errorMessage = document.querySelector(".error-message");
  try {
    if (loading) loading.style.display = "block";
    if (errorMessage) errorMessage.style.display = "none";
    const response = await fetch("/api/products");
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const products = await response.json();
    if (products && products.length > 0) {
      productList.innerHTML = products
        .map(
          (product) => `
        <div class="product-item" data-product-id="${product.id}">
          <div class="product-icon"><i class="fas fa-${getProductIcon(
            product.name
          )}"></i></div>
          <h2>${escapeHtml(product.name)}</h2>
          <p class="product-description">${escapeHtml(
            product.description || ""
          )}</p>
          <p class="product-price">R${parseFloat(product.price).toFixed(2)}</p>
          <button class="add-to-cart">Add to Cart</button>
        </div>
      `
        )
        .join("");
      if (window.shopManager) {
        window.shopManager.setupProductButtons();
      }
    }
  } catch (error) {
    console.error("Error loading products:", error);
    if (errorMessage) {
      errorMessage.style.display = "block";
      errorMessage.querySelector(
        "p"
      ).textContent = `Error loading products: ${error.message}`;
    }
  } finally {
    if (loading) loading.style.display = "none";
  }
}

function getProductIcon(productName) {
  const icons = {
    Design: "paint-brush",
    "Professional Sound Hire": "music",
    "AI & Machine Learning": "robot",
    "Cyber Security": "shield-alt",
    Photography: "camera",
    "Placement & Project Management": "tasks",
    "Technical Support Services": "headset",
    Videography: "video",
    "Domain & Hosting": "globe",
    Marketing: "bullhorn",
    Development: "code",
    "Email Services": "envelope",
  };
  return icons[productName] || "shopping-cart";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { ShopManager, AdvancedShopManager };
}
