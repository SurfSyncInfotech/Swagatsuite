import { useMemo, useState } from "react";
import { FaWhatsapp } from "react-icons/fa6";
import { FaStar, FaQuoteLeft } from "react-icons/fa";
import {
  FiPhoneCall,
  FiPlus,
  FiMinus,
  FiX,
  FiMenu,
  FiGrid,
  FiActivity,
  FiSliders,
  FiUsers,
  FiHash,
  FiTrendingUp,
  FiArrowUpRight,
  FiMail,
  FiFacebook,
  FiInstagram
} from "react-icons/fi";
import { API_BASE_URL } from "./config/api";
import "./App.css";
const logo = "/swagatsuite.png";

const features = [
  {
    title: "Table QR Ordering",
    text: "Guests scan and order instantly with a premium mobile-first menu experience.",
    icon: FiGrid
  },
  {
    title: "Live Status Visibility",
    text: "Real-time order flow from placed to ready improves trust and reduces table calls.",
    icon: FiActivity
  },
  {
    title: "Smart Menu Controls",
    text: "Update pricing, availability, categories, and item visuals in seconds.",
    icon: FiSliders
  },
  {
    title: "Kitchen + Admin Sync",
    text: "Operational control with centralized order actions and role-ready dashboards.",
    icon: FiUsers
  },
  {
    title: "Table-Wise Management",
    text: "Unique QR tokens per table with secure ordering context for each guest session.",
    icon: FiHash
  },
  {
    title: "Growth Analytics",
    text: "Track order velocity, revenue trends, and plan insights to scale with confidence.",
    icon: FiTrendingUp
  }
];

const pricing = [
  {
    plan: "Starter",
    price: "INR 999/mo",
    description: "Best for boutique cafes and compact dining spaces launching digital ordering.",
    points: ["QR menus + live order tracking", "Menu management and table setup", "Email support"]
  },
  {
    plan: "Pro",
    price: "INR 2499/mo",
    description: "Perfect for high-traffic restaurants needing premium service speed and control.",
    points: ["Everything in Starter", "Advanced analytics and plan insights", "Priority support + scaling tools"],
    highlight: true
  },
  {
    plan: "Enterprise",
    price: "Custom",
    description: "For multi-outlet brands requiring dedicated onboarding and custom integrations.",
    points: ["Multi-branch workflow", "Custom API integrations", "Dedicated account manager"]
  }
];

const testimonials = [
  {
    restaurant: "Bukhara - New Delhi",
    rating: 5,
    text: "Swagat Suite reduced our table wait-to-order time significantly. Guests order faster and service feels premium."
  },
  {
    restaurant: "Masque - Mumbai",
    rating: 5,
    text: "Live status visibility improved trust. Customers now enjoy transparent updates without follow-up calls."
  },
  {
    restaurant: "Karavalli - Bengaluru",
    rating: 5,
    text: "Menu operations are smooth and instant. Daily updates happen in minutes with zero confusion."
  },
  {
    restaurant: "Oh! Calcutta - Kolkata",
    rating: 4,
    text: "The QR flow is elegant and efficient. It adds a modern touch while keeping hospitality personal."
  },
  {
    restaurant: "Avartana - Chennai",
    rating: 5,
    text: "Kitchen and admin coordination became seamless. We improved consistency across high-volume hours."
  },
  {
    restaurant: "The Bombay Canteen - Mumbai",
    rating: 5,
    text: "Swagat Suite combines style with operational depth. Guest engagement and order conversion both improved."
  }
];

const faqs = [
  {
    q: "How quickly can my restaurant go live on Swagat Suite?",
    a: "Most restaurants are live in less than 30 minutes with menu setup and table QR generation."
  },
  {
    q: "Can we use our own logo and branding?",
    a: "Yes, Swagat Suite supports your restaurant logo, menu visuals, and brand style for guest-facing screens."
  },
  {
    q: "Do guests need to install any app?",
    a: "No app is required. Guests place orders directly in the browser after scanning your table QR code."
  },
  {
    q: "Does Swagat Suite support status updates for guests?",
    a: "Yes, customers see live status updates from placed to ready, with optional alert sounds."
  }
];

const indiaRestaurants = [
  "Bukhara - New Delhi",
  "Indian Accent - New Delhi",
  "Masque - Mumbai",
  "The Bombay Canteen - Mumbai",
  "Avartana - Chennai",
  "Peshawri - Mumbai",
  "Karavalli - Bengaluru",
  "Dum Pukht - Lucknow",
  "Oh! Calcutta - Kolkata",
  "Amethyst - Chennai",
  "SodaBottleOpenerWala - Pune",
  "Toscano - Bengaluru"
];

function App() {
  const phoneDigits = "919429694356";
  const [faqOpen, setFaqOpen] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isContactSubmitting, setIsContactSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    restaurantName: "",
    phone: "",
    email: ""
  });
  const [contactForm, setContactForm] = useState({
    name: "",
    restaurantName: "",
    phone: "",
    email: ""
  });

  const carouselRows = useMemo(() => [...indiaRestaurants, ...indiaRestaurants], []);

  const openLeadModal = () => {
    setIsNavOpen(false);
    setIsModalOpen(true);
  };
  const closeLeadModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
  };

  const submitLeadPayload = async (payload) => {
    if (!payload.name || !payload.restaurantName || !payload.phone || !payload.email) {
      window.alert("Please fill all fields.");
      return false;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Submission failed.");
      window.alert("Thank you. Our team will contact you shortly.");
      return true;
    } catch (error) {
      window.alert(error.message || "Could not submit form.");
      return false;
    }
  };

  const submitLead = async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      restaurantName: form.restaurantName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      source: "landing_page_cta"
    };

    setIsSubmitting(true);
    const ok = await submitLeadPayload(payload);
    if (ok) {
      setForm({ name: "", restaurantName: "", phone: "", email: "" });
      setIsModalOpen(false);
    }
    setIsSubmitting(false);
  };

  const submitContactLead = async (e) => {
    e.preventDefault();
    const payload = {
      name: contactForm.name.trim(),
      restaurantName: contactForm.restaurantName.trim(),
      phone: contactForm.phone.trim(),
      email: contactForm.email.trim(),
      source: "landing_page_contact_section"
    };

    setIsContactSubmitting(true);
    const ok = await submitLeadPayload(payload);
    if (ok) {
      setContactForm({ name: "", restaurantName: "", phone: "", email: "" });
    }
    setIsContactSubmitting(false);
  };

  return (
    <div className={`landing-root ${isModalOpen ? "modal-active" : ""}`}>
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-grid" aria-hidden />

      <header className="top-nav">
        <div className="brand">
          <img src={logo} alt="Swagat Suite logo" className="brand-img" />
        </div>
        <button
          type="button"
          className="menu-toggle"
          aria-label={isNavOpen ? "Close menu" : "Open menu"}
          aria-expanded={isNavOpen}
          aria-controls="main-nav"
          onClick={() => setIsNavOpen((v) => !v)}
        >
          {isNavOpen ? <FiX /> : <FiMenu />}
        </button>
        <nav id="main-nav" className={`nav-links ${isNavOpen ? "open" : ""}`} aria-label="Main">
          <a href="#features" onClick={() => setIsNavOpen(false)}>Features</a>
          <a href="#pricing" onClick={() => setIsNavOpen(false)}>Pricing</a>
          <a href="#faqs" onClick={() => setIsNavOpen(false)}>FAQs</a>
          <a href="#contact" onClick={() => setIsNavOpen(false)}>Contact</a>
        </nav>
        <button type="button" className="cta-btn nav-cta" onClick={openLeadModal}>
          Book Demo <FiArrowUpRight aria-hidden />
        </button>
      </header>

      <main>
        <section className="hero section" id="home">
          <span className="badge">Luxury SaaS for hospitality teams</span>
          <h1>
            Transform Restaurant Operations
            <br />
            With Swagat Suite
          </h1>
          <span className="hero-rule" aria-hidden />
          <p>
            A premium QR-ordering platform for modern restaurants — from elegant guest ordering to kitchen
            visibility and superadmin control.
          </p>
          <div className="hero-actions">
            <button type="button" className="cta-btn" onClick={openLeadModal}>
              Start Free Trial
            </button>
            <button type="button" className="ghost-btn" onClick={openLeadModal}>
              Talk To Sales
            </button>
          </div>
          <a href="#features" className="scroll-explore" aria-label="Scroll to explore more sections">
            <span>Scroll to explore</span>
            <span className="scroll-mouse">
              <span className="scroll-wheel" />
            </span>
          </a>
        </section>

        <section className="stats section">
          <article className="reveal" style={{ "--reveal-delay": "0s" }}><h3>95%</h3><p>faster table-side ordering flow</p></article>
          <article className="reveal" style={{ "--reveal-delay": "0.08s" }}><h3>30%</h3><p>average increase in order value</p></article>
          <article className="reveal" style={{ "--reveal-delay": "0.16s" }}><h3>24/7</h3><p>always-on digital menu channel</p></article>
          <article className="reveal" style={{ "--reveal-delay": "0.24s" }}><h3>5X</h3><p>premium guest experience rating</p></article>
        </section>

        <section className="section" id="features">
          <div className="section-head reveal">
            <span className="eyebrow">The Experience</span>
            <h2>Everything needed for a premium digital restaurant</h2>
            <p>From guest delight to kitchen speed and owner visibility.</p>
          </div>
          <div className="feature-grid">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <article
                  key={feature.title}
                  className="feature-card reveal"
                  style={{ "--reveal-delay": `${i * 0.08}s` }}
                >
                  <span className="feature-icon" aria-hidden>
                    <Icon />
                  </span>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="section pricing" id="pricing">
          <div className="section-head reveal">
            <span className="eyebrow">Membership</span>
            <h2>Pricing plans built for growth</h2>
            <p>Choose the right plan for your service scale and business goals.</p>
          </div>
          <div className="pricing-grid">
            {pricing.map((item, i) => (
              <article
                key={item.plan}
                className={`price-card reveal ${item.highlight ? "highlight" : ""}`}
                style={{ "--reveal-delay": `${i * 0.1}s` }}
              >
                {item.highlight ? <span className="price-badge">Most Booked</span> : null}
                <h3>{item.plan}</h3>
                <strong>{item.price}</strong>
                <p className="price-desc">{item.description}</p>
                <ul>
                  {item.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
                <button type="button" className="ghost-btn plan-btn" onClick={openLeadModal}>
                  Get {item.plan}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="section testimonials">
          <div className="section-head reveal">
            <span className="eyebrow">Guest Reviews</span>
            <h2>Loved by modern restaurant teams</h2>
            <p>What leading restaurants in India say about Swagat Suite.</p>
          </div>
          <div className="testimonials-carousel" aria-label="Restaurant testimonial carousel">
            <div className="testimonials-track">
              {[...testimonials, ...testimonials].map((item, idx) => (
                <article key={`${item.restaurant}-${idx}`} className="testimonial-slide">
                  <FaQuoteLeft className="testimonial-quote-mark" aria-hidden />
                  <div className="testimonial-stars" aria-label={`${item.rating} out of 5`}>
                    {Array.from({ length: item.rating }).map((_, starIdx) => (
                      <FaStar key={`star-${item.restaurant}-${idx}-${starIdx}`} />
                    ))}
                  </div>
                  <p>{item.text}</p>
                  <h4>{item.restaurant}</h4>
                </article>
              ))}
            </div>
            <div className="restro-carousel" aria-label="Indian restaurants carousel">
              <span className="restro-label">On the reservation board tonight</span>
              <div className="restro-track">
                {carouselRows.map((name, idx) => (
                  <div key={`${name}-${idx}`} className="restro-chip">
                    {name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section faq" id="faqs">
          <div className="section-head reveal">
            <span className="eyebrow">Good To Know</span>
            <h2>Frequently asked questions</h2>
            <p>Clear answers before you onboard your property on Swagat Suite.</p>
          </div>
          <div className="faq-list">
            {faqs.map((item, idx) => {
              const open = faqOpen === idx;
              return (
                <article key={item.q} className={`faq-item ${open ? "open" : ""}`}>
                  <button type="button" className="faq-toggle" onClick={() => setFaqOpen(open ? -1 : idx)}>
                    <span>{item.q}</span>
                    <span className="faq-icon">{open ? <FiMinus /> : <FiPlus />}</span>
                  </button>
                  <div className="faq-answer-wrap">
                    <p>{item.a}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="section contact-section" id="contact">
          <div className="section-head reveal">
            <span className="eyebrow">Reach Us</span>
            <h2>Contact our team</h2>
            <p>Share your details and get a quick walkthrough for your restaurant.</p>
          </div>
          <div className="contact-grid">
            <article className="contact-card contact-info-card">
              <h3>Connect with SurfSync Infotech</h3>
              <p>Our team helps you launch Swagat Suite smoothly across your restaurant operations.</p>
              <div className="contact-points">
                <p><FiMail aria-hidden /><strong>Email:</strong> <a href="mailto:hello@surfsyncinfotech.com">hello@surfsyncinfotech.com</a></p>
                <p><FiPhoneCall aria-hidden /><strong>Phone:</strong> <a href={`tel:+${phoneDigits}`}>+91 94296 94356</a></p>
                <p><FiFacebook aria-hidden /><strong>Facebook:</strong> <a href="https://www.facebook.com/people/SurfSync-Infotech-Pvt-Ltd/61579342474194/" target="_blank" rel="noreferrer">SurfSync Infotech Pvt Ltd</a></p>
                <p><FiInstagram aria-hidden /><strong>Instagram:</strong> <a href="https://www.instagram.com/surfsync_infotech?igsh=dTRja3Y0Y2J4dWcw" target="_blank" rel="noreferrer">@surfsync_infotech</a></p>
              </div>
            </article>
            <article className="contact-card">
              <h3>Request a call back</h3>
              <form onSubmit={submitContactLead} className="lead-form">
                <label>
                  Name
                  <input value={contactForm.name} onChange={(e) => setContactForm((p) => ({ ...p, name: e.target.value }))} required />
                </label>
                <label>
                  Restaurant Name
                  <input value={contactForm.restaurantName} onChange={(e) => setContactForm((p) => ({ ...p, restaurantName: e.target.value }))} required />
                </label>
                <label>
                  Phone Number
                  <input value={contactForm.phone} onChange={(e) => setContactForm((p) => ({ ...p, phone: e.target.value }))} required />
                </label>
                <label>
                  Email ID
                  <input type="email" value={contactForm.email} onChange={(e) => setContactForm((p) => ({ ...p, email: e.target.value }))} required />
                </label>
                <button type="submit" className="cta-btn" disabled={isContactSubmitting}>
                  {isContactSubmitting ? "Submitting..." : "Submit"}
                </button>
              </form>
            </article>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <img src={logo} alt="Swagat Suite" />
            <div>
              <strong>Swagat Suite</strong>
              <p>Premium QR Ordering & Restaurant Operations SaaS</p>
            </div>
          </div>
          <div className="footer-links">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#faqs">FAQs</a>
            <button type="button" className="link-btn" onClick={openLeadModal}>Book Demo</button>
          </div>
        </div>
        <p className="footer-copy">Copyright {new Date().getFullYear()} Swagat Suite - Crafted for modern hospitality in India.</p>
      </footer>

      <div className="floating-actions" aria-label="Quick contact actions">
        <a className="floating-btn whatsapp" href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer" aria-label="WhatsApp">
          <FaWhatsapp />
        </a>
        <a className="floating-btn call" href={`tel:+${phoneDigits}`} aria-label="Call">
          <FiPhoneCall />
        </a>
      </div>

      {isModalOpen ? (
        <div className="lead-modal-backdrop" onClick={closeLeadModal}>
          <div className="lead-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="lead-modal-close" onClick={closeLeadModal} aria-label="Close form">
              <FiX />
            </button>
            <h3>Book your Swagat Suite demo</h3>
            <p>Share your details and our team will connect with you shortly.</p>
            <form onSubmit={submitLead} className="lead-form">
              <label>
                Name
                <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
              </label>
              <label>
                Restaurant Name
                <input value={form.restaurantName} onChange={(e) => setForm((p) => ({ ...p, restaurantName: e.target.value }))} required />
              </label>
              <label>
                Phone Number
                <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} required />
              </label>
              <label>
                Email ID
                <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required />
              </label>
              <button type="submit" className="cta-btn" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;

