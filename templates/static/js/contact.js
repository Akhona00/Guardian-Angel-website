
document.querySelector('.contact-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const subject = document.getElementById('subject').value.trim();
  const message = document.getElementById('message').value.trim();

  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, subject, message }),
    });
    const data = await res.json();
    if (data.success) {
      alert('Thank you for contacting us!');
      this.reset();
    } else {
      alert('Error: ' + (data.error || 'Could not send message.'));
    }
  } catch (err) {
    alert('Server error: ' + err.message);
  }
});

const data = {
  name: "Customer Name",
  _replyto: "customer@example.com",
  message: "Hello, I have a question...",
};

fetch("https://formspree.io/f/mzzgvakl", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
})
  .then((response) => {
    if (response.ok) alert("Message sent!");
    else alert("Failed to send message.");
  })
  .catch((error) => console.error(error));
