import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { FiMic, FiMicOff, FiMessageCircle, FiSend, FiX } from "react-icons/fi";

import {
  buildCustomerChatContext,
  detectChatLanguage,
  formatChatMarkdown,
  getCustomerChatReply,
  getFullMenuText,
  getProfessionalWelcome,
  getSuggestedQuestions
} from "../utils/customerChatbot";

import {

  createSpeechRecognizer,

  extractNameFromSpeech,

  extractEmailFromSpeech,

  extractPhoneFromSpeech,

  extractRatingFromSpeech,

  findItemsInSpeech,
  guestEmailFromPhone,
  isStopVoiceCommand,
  isYesVoiceCommand,
  isNoVoiceCommand,
  isValidEmail,
  isVoiceSupported,
  looksLikeNonNameIntent,
  normalizeSpeech,
  speakText,
  stopSpeaking,
  statusVoiceLine,
  buildMenuSpeechText,
  voiceMessages
} from "../utils/customerVoiceAssistant";

import { playChatbotQueryChime, playChatbotReplyChime, unlockWebAudio } from "../utils/sounds";

import CustomerLoyaltyCard from "./CustomerLoyaltyCard";
import { LOYALTY_ENABLED } from "../config/features";

import "../CustomerChatbot.css";



function ChatMessage({ role, text }) {

  return (

    <div className={`customer-chat-msg ${role}`}>

      <div

        className="customer-chat-bubble"

        dangerouslySetInnerHTML={{ __html: formatChatMarkdown(text) }}

      />

    </div>

  );

}



export default function CustomerChatbot({

  restaurant,

  table,

  items,

  cartRows,

  total,

  trackingOrder,

  invoiceData,

  storedOrderId,

  reviewSubmitted,

  categories,

  loyalty,

  loyaltyPhone,

  loyaltyLoading,

  onLoyaltyPhoneSubmit,

  onLoyaltyRedeem,

  loyaltyRedeeming,

  showLoyalty,

  hasCartBar,

  showPayInvoiceBtn,

  invoiceModalOpen,

  reviewOpen,

  checkoutOpen,

  serviceOpen,

  onOpenCheckout,

  onOpenInvoice,

  onOpenReview,

  onOpenService,

  onSendServiceRequest,

  onAddToCart,

  onVoicePlaceOrder,

  onSubmitVoiceReview,

  canSubmitReview

}) {

  const [open, setOpen] = useState(false);

  const [loyaltyOpen, setLoyaltyOpen] = useState(false);

  const [input, setInput] = useState("");

  const [typing, setTyping] = useState(false);

  const [messages, setMessages] = useState([]);

  const [language, setLanguage] = useState(null);

  const [voiceMode, setVoiceMode] = useState(false);

  const [listening, setListening] = useState(false);

  const [orderDraft, setOrderDraft] = useState({ step: null, name: "", phone: "", email: "" });

  const [voicePending, setVoicePending] = useState(null);

  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  const [reviewDraft, setReviewDraft] = useState({ step: null, rating: 5, comment: "" });

  const bodyRef = useRef(null);

  const greetedRef = useRef(false);

  const welcomeSpokenRef = useRef({ en: false, hi: false });

  const recognitionRef = useRef(null);

  const voiceSessionRef = useRef(false);

  const prevStatusRef = useRef("");

  const prevPaymentRef = useRef("");

  const reviewAnnouncedRef = useRef(false);

  const thankYouAnnouncedRef = useRef(false);

  const prevInvoiceIdRef = useRef(null);



  const ctx = useMemo(

    () =>

      buildCustomerChatContext({

        restaurant,

        table,

        items,

        cartRows,

        total,

        trackingOrder,

        invoiceData,

        storedOrderId,

        reviewSubmitted,

        categories,

        loyalty

      }),

    [restaurant, table, items, cartRows, total, trackingOrder, invoiceData, storedOrderId, reviewSubmitted, categories, loyalty]

  );



  const suggestions = useMemo(() => getSuggestedQuestions(ctx), [ctx]);

  const voiceOk = isVoiceSupported();

  const msgs = useMemo(() => voiceMessages(language || "en"), [language]);



  const scrollToBottom = useCallback(() => {

    const el = bodyRef.current;

    if (!el) return;

    el.scrollTop = el.scrollHeight;

  }, []);



  useEffect(() => {

    scrollToBottom();

  }, [messages, typing, open, scrollToBottom]);



  useEffect(() => {

    if (!open) {
      greetedRef.current = false;
      return;
    }

    if (greetedRef.current) return;

    const name = restaurant?.name || "our restaurant";

    setMessages([

      {

        id: "welcome",

        role: "bot",

        text: `Welcome to **${name}**! Tap **English** or **हिंदी** above to hear your welcome message and start voice. You can also type below.`

      }

    ]);

    greetedRef.current = true;

  }, [open, restaurant?.name]);



  const pushBot = useCallback((text, speak = false, langOverride) => {
    const activeLang = langOverride || language;
    setMessages((prev) => [...prev, { id: `b-${Date.now()}`, role: "bot", text }]);
    if (speak && activeLang) {
      void speakText(text, activeLang).then(() => {
        if (voiceMode) startListeningRef.current?.();
      });
    }
  }, [language, voiceMode]);



  const pushUser = useCallback((text) => {

    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", text }]);

  }, []);



  const runAction = useCallback(

    async (action) => {

      if (!action?.type) return;

      if (action.type === "openCheckout") onOpenCheckout?.();

      if (action.type === "openInvoice") onOpenInvoice?.();

      if (action.type === "openReview") onOpenReview?.();

      if (action.type === "openService") onOpenService?.();

      if (action.type === "sendService" && action.payload) {

        await onSendServiceRequest?.(action.payload);

      }

    },

    [onOpenCheckout, onOpenInvoice, onOpenReview, onOpenService, onSendServiceRequest]

  );



  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop?.();
    } catch (_e) {
      /* ignore */
    }
    recognitionRef.current = null;
    setListening(false);
    stopSpeaking();
  }, []);



  const startListening = useCallback(() => {

    if (!voiceOk || !language || listening) return;

    stopListening();

    const recognition = createSpeechRecognizer({

      lang: language,

      onResult: (transcript) => {

        setListening(false);

        void handleVoiceInputRef.current?.(transcript);

      },

      onError: () => setListening(false),

      onEnd: () => setListening(false)

    });

    if (!recognition) return;

    recognitionRef.current = recognition;

    setListening(true);

    try {

      recognition.start();

    } catch (_e) {

      setListening(false);

    }

  }, [voiceOk, language, listening, stopListening]);



  const startListeningRef = useRef(startListening);

  startListeningRef.current = startListening;

  const handleVoiceInputRef = useRef(null);



  const enableVoice = useCallback(

    (lang) => {

      void (async () => {

        if (listening) stopListening();

        stopSpeaking();

        setLanguage(lang);

        setVoiceMode(true);

        voiceSessionRef.current = true;

        const name = restaurant?.name || (lang === "hi" ? "हमारे रेस्तरां" : "our restaurant");

        const welcome = getProfessionalWelcome(name, lang);

        const shouldSpeakWelcome = !welcomeSpokenRef.current[lang];

        welcomeSpokenRef.current[lang] = true;

        if (!shouldSpeakWelcome) return;

        setMessages((prev) => [

          ...prev,

          { id: `b-voice-${Date.now()}`, role: "bot", text: welcome }

        ]);

        await unlockWebAudio();

        await speakText(welcome, lang);

        startListeningRef.current?.();

      })();

    },

    [restaurant?.name, listening, stopListening]

  );



  const completeVoiceOrder = useCallback(

    async (draft) => {

      const name = draft.name.trim();

      const phone = draft.phone.replace(/\D/g, "");

      const email = draft.email?.trim() || guestEmailFromPhone(phone);

      if (name.length < 2 || phone.length < 10 || !isValidEmail(email)) {

        pushBot(msgs.notUnderstood, true);

        return;

      }

      try {

        await onVoicePlaceOrder?.({ name, phone, email });

        setOrderDraft({ step: null, name: "", phone: "", email: "" });

        pushBot(msgs.orderPlaced, true);

      } catch (_e) {

        pushBot(language === "hi" ? "Order nahi ho paya. Staff se madad lijiye." : "Could not place order. Please ask staff for help.", true);

      }

    },

    [language, msgs, onVoicePlaceOrder, pushBot]

  );



  const handleVoiceIntent = useCallback(
    async (text, langOverride) => {
      const lang = langOverride || language || "en";
      const m = voiceMessages(lang);
      const q = normalizeSpeech(text);

      if (isStopVoiceCommand(text)) {
        stopListening();
        setVoicePending(null);
        setAwaitingConfirm(false);
        setReviewDraft({ step: null, rating: 5, comment: "" });
        pushBot(lang === "hi" ? "ठीक है, मैं रुक गया।" : "Okay, I've stopped.", false);
        return;
      }

      const botSay = (sayText) => {
        void speakText(sayText, lang).then(() => {
          if (voiceMode) startListeningRef.current?.();
        });
      };

      if (awaitingConfirm && voicePending) {
        if (isYesVoiceCommand(text)) {
          if (voicePending.type === "addItem") {
            const { item, qty } = voicePending;
            onAddToCart?.(item.id, qty);
            const projectedTotal = Number(total || 0) + Number(item.price) * qty;
            const msg = m.addedConfirmed(item.name, qty, projectedTotal);
            pushBot(msg, false);
            botSay(msg);
          } else if (voicePending.type === "addItems") {
            let projectedTotal = Number(total || 0);
            for (const { item, qty } of voicePending.items) {
              onAddToCart?.(item.id, qty);
              projectedTotal += Number(item.price) * qty;
            }
            const names = voicePending.items.map((h) => h.item.name).join(", ");
            const msg = m.addedMultipleConfirmed(names, projectedTotal);
            pushBot(msg, false);
            botSay(msg);
          } else if (voicePending.type === "placeOrder") {
            setOrderDraft({ step: "name", name: "", phone: "", email: "" });
            pushBot(m.askName, false);
            botSay(m.askName);
          }
          setVoicePending(null);
          setAwaitingConfirm(false);
          return;
        }

        if (isNoVoiceCommand(text)) {
          const pendingType = voicePending.type;
          setVoicePending(null);
          setAwaitingConfirm(false);
          const msg =
            pendingType === "addItem" || pendingType === "addItems" ? m.retryAddItem : m.retryOrder;
          pushBot(msg, false);
          botSay(msg);
          return;
        }

        pushBot(m.confirmUnclear, false);
        botSay(m.confirmUnclear);
        return;
      }

      if (reviewDraft.step === "rating") {
        const rating = extractRatingFromSpeech(text);
        if (rating < 1 || rating > 5) {
          pushBot(m.couldNotHearRating, false);
          botSay(m.couldNotHearRating);
          return;
        }
        setReviewDraft({ step: "comment", rating, comment: "" });
        pushBot(m.askReviewComment, false);
        botSay(m.askReviewComment);
        return;
      }

      if (reviewDraft.step === "comment") {
        const comment = String(text || "").trim();
        const rating = reviewDraft.rating;
        const ok = await onSubmitVoiceReview?.({ rating, comment });
        setReviewDraft({ step: null, rating: 5, comment: "" });
        if (ok) {
          pushBot(m.reviewThanks, false);
          botSay(m.reviewThanks);
        }
        return;
      }



      if (orderDraft.step === "confirm") {
        if (isYesVoiceCommand(text)) {
          const draft = { ...orderDraft, step: null };
          setOrderDraft({ step: null, name: "", phone: "", email: "" });
          await completeVoiceOrder(draft);
          return;
        }
        if (isNoVoiceCommand(text)) {
          setOrderDraft({ step: "name", name: "", phone: "", email: "" });
          pushBot(m.retryOrderDetails, false);
          botSay(m.retryOrderDetails);
          return;
        }
        pushBot(m.confirmUnclear, false);
        botSay(m.confirmUnclear);
        return;
      }

      if (orderDraft.step === "name") {

        const name = extractNameFromSpeech(text, lang);

        if (name.length < 2 || looksLikeNonNameIntent(q)) {

          pushBot(m.couldNotHearName, false);
          botSay(m.couldNotHearName);

          return;

        }

        const next = { ...orderDraft, name, step: "phone" };

        setOrderDraft(next);

        pushBot(m.askPhone, false);
        botSay(m.askPhone);

        return;

      }

      if (orderDraft.step === "phone") {

        const phone = extractPhoneFromSpeech(text);

        if (phone.length < 10) {

          pushBot(m.couldNotHearPhone, false);
          botSay(m.couldNotHearPhone);

          return;

        }

        const next = { ...orderDraft, phone, step: "email" };

        setOrderDraft(next);

        pushBot(m.askEmail, false);
        botSay(m.askEmail);

        return;

      }

      if (orderDraft.step === "email") {

        const email = extractEmailFromSpeech(text);

        if (!isValidEmail(email)) {

          pushBot(m.couldNotHearEmail, false);
          botSay(m.couldNotHearEmail);

          return;

        }

        const next = { ...orderDraft, email, step: "confirm" };

        setOrderDraft(next);

        const confirmMsg = m.confirmOrderDetails(next.name, next.phone, email);

        pushBot(confirmMsg, false);

        botSay(confirmMsg);

        return;

      }



      if (!orderDraft.step) {

      if (/(hello|hi|hey|hii|helo|namaste|namaskar|pranam|नमस्ते|नमस्कार|प्रणाम|स्वागत|हेलो|हाय|हैलो)/i.test(q)) {
        const name = restaurant?.name || (lang === "hi" ? "हमारे रेस्तरां" : "our restaurant");
        pushBot(m.welcome(name), false);
        botSay(m.welcome(name));
        return;
      }

      if (/(menu|price|prices|khana|daam|kya hai|kya milega|dish list|मेनू|मूल्य|दाम|दिखाइए|दिखाओ|खाना|व्यंजन|कीमत)/i.test(q)) {
        const menuText = getFullMenuText(ctx, lang);
        const speechText =
          lang === "hi"
            ? m.menuVoicePrompt(ctx.items.length)
            : buildMenuSpeechText(ctx, lang);
        pushBot(menuText, false);
        void speakText(speechText, lang, { skipPolish: lang !== "hi" }).then(() => {
          if (voiceMode) startListeningRef.current?.();
        });
        return;
      }



      const itemHits = findItemsInSpeech(text, ctx.items);

      if (itemHits.length >= 1) {

        if (itemHits.length === 1) {
          const { item, qty } = itemHits[0];
          setVoicePending({ type: "addItem", item, qty });
        } else {
          setVoicePending({ type: "addItems", items: itemHits });
        }

        setAwaitingConfirm(true);

        const confirmMsg =
          itemHits.length === 1
            ? m.confirmAdd(itemHits[0].item.name, itemHits[0].qty)
            : m.confirmAddMultiple(itemHits);

        pushBot(confirmMsg, false);
        botSay(confirmMsg);

        return;

      }



      if (/(place order|order karo|order kar|confirm order|submit order|ऑर्डर|आर्डर|करना है|मंगाओ|चाहिए)/i.test(q)) {

        if (!cartRows.length) {

          pushBot(m.emptyCart, false);
          botSay(m.emptyCart);

          return;

        }

        setVoicePending({ type: "placeOrder" });

        setAwaitingConfirm(true);

        const confirmMsg = m.confirmOrder(cartRows, total);

        pushBot(confirmMsg, false);

        botSay(confirmMsg);

        return;

      }



      if (/(order status|status|mera order|track order)/i.test(q)) {

        const { text: reply } = getCustomerChatReply(text, ctx, lang);
        pushBot(reply, false);
        botSay(reply);
        return;
      }

      if (/(invoice|bill|pay|payment|receipt|बिल|भुगतान)/i.test(q)) {
        if (invoiceData?.paymentStatus === "Unpaid") {
          pushBot(m.payInvoice, false);
          botSay(m.payInvoice);
          onOpenInvoice?.();
        } else if (invoiceData) {
          pushBot(m.invoicePaid, false);
          botSay(m.invoicePaid);
        } else {
          const fallback = getCustomerChatReply(text, ctx, lang).text;
          pushBot(fallback, false);
          botSay(fallback);
        }
        return;
      }

      if (/(review|rating|feedback|रिव्यू|समीक्षा|रेटिंग)/i.test(q)) {
        if (reviewSubmitted) {
          pushBot(m.reviewThanks, false);
          botSay(m.reviewThanks);
          return;
        }
        if (canSubmitReview) {
          setReviewDraft({ step: "rating", rating: 5, comment: "" });
          pushBot(m.askReviewRating, false);
          botSay(m.askReviewRating);
          return;
        }
        const waitMsg =
          language === "hi"
            ? "समीक्षा तब उपलब्ध होगी जब ऑर्डर की स्थिति Completed हो जाए।"
            : "Review will be available once your order status is **Completed**.";
        pushBot(waitMsg, false);
        botSay(waitMsg);
        return;
      }

      if (/(thank|dhanyavad|shukriya|धन्यवाद|शुक्रिया)/i.test(q)) {
        pushBot(m.thankYou, false);
        botSay(m.thankYou);
        return;
      }

      const { text: reply, action } = getCustomerChatReply(text, ctx, lang);
      pushBot(reply, false);
      botSay(reply);

      if (action) await runAction(action);

      }

    },

    [language, orderDraft, reviewDraft, awaitingConfirm, voicePending, restaurant?.name, ctx, cartRows, total, invoiceData, reviewSubmitted, canSubmitReview, voiceMode, pushBot, onAddToCart, completeVoiceOrder, onOpenInvoice, onOpenReview, onSubmitVoiceReview, runAction, stopListening]

  );



  handleVoiceInputRef.current = async (transcript) => {

    const trimmed = String(transcript || "").trim();

    if (!trimmed) return;

    pushUser(trimmed);

    void unlockWebAudio().then(() => playChatbotQueryChime());

    setTyping(true);

    await new Promise((r) => window.setTimeout(r, 280));

    setTyping(false);

    await handleVoiceIntent(trimmed);

    void unlockWebAudio().then(() => playChatbotReplyChime());

  };



  const replyTo = useCallback(
    async (query) => {
      const trimmed = String(query || "").trim();
      if (!trimmed) return;

      setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", text: trimmed }]);
      setInput("");
      setTyping(true);
      void unlockWebAudio().then(() => playChatbotQueryChime());

      await new Promise((r) => window.setTimeout(r, 380));
      setTyping(false);

      if (isStopVoiceCommand(trimmed)) {
        stopListening();
        const stopLang = language || (detectChatLanguage(trimmed) === "hi" ? "hi" : "en");
        setMessages((prev) => [
          ...prev,
          {
            id: `b-${Date.now()}`,
            role: "bot",
            text: stopLang === "hi" ? "ठीक है, मैं रुक गया।" : "Okay, I've stopped."
          }
        ]);
        return;
      }

      const isHindi = detectChatLanguage(trimmed) === "hi";
      const itemHits = findItemsInSpeech(trimmed, ctx.items);
      const activeLang = isHindi ? "hi" : language || "en";

      if (isHindi) {
        if (!language) setLanguage("hi");
        if (!voiceSessionRef.current) {
          setVoiceMode(true);
          voiceSessionRef.current = true;
        }
      }

      if (voiceMode || language || isHindi || itemHits.length) {
        await handleVoiceIntent(trimmed, activeLang);
        void unlockWebAudio().then(() => playChatbotReplyChime());
        return;
      }

      const { text, action } = getCustomerChatReply(trimmed, ctx, activeLang);
      setMessages((prev) => [...prev, { id: `b-${Date.now()}`, role: "bot", text }]);
      void unlockWebAudio().then(() => playChatbotReplyChime());

      if (action) {
        await runAction(action);
      }
    },
    [ctx, runAction, language, voiceMode, handleVoiceIntent, stopListening]
  );



  useEffect(() => {

    if (!language) return;

    const invoiceId = invoiceData?.id;

    if (!invoiceId || invoiceId === prevInvoiceIdRef.current) return;

    prevInvoiceIdRef.current = invoiceId;

    pushBot(msgs.invoiceReady, true);

  }, [invoiceData?.id, language, msgs, pushBot]);



  useEffect(() => {

    if (!language) return;

    const status = trackingOrder?.status;

    if (!status || status === prevStatusRef.current) return;

    prevStatusRef.current = status;

    const tag = statusVoiceLine(status, language);

    const line = msgs.status(status, tag);

    pushBot(`**${language === "hi" ? "Order update" : "Order update"}:** ${line}`, true);



    if (status === "Served" && invoiceData?.paymentStatus === "Unpaid") {

      window.setTimeout(() => pushBot(msgs.payInvoice, true), 1200);

    }

    if (
      (status === "Completed") &&
      canSubmitReview &&
      !reviewSubmitted &&
      !reviewAnnouncedRef.current
    ) {
      reviewAnnouncedRef.current = true;
      window.setTimeout(() => pushBot(msgs.reviewPrompt, true), 1200);
    }

  }, [trackingOrder?.status, language, invoiceData?.paymentStatus, canSubmitReview, reviewSubmitted, msgs, pushBot]);



  useEffect(() => {

    if (!language) return;

    const pay = invoiceData?.paymentStatus;

    if (!pay || pay === prevPaymentRef.current) return;

    prevPaymentRef.current = pay;

    if (pay === "Paid" && trackingOrder?.status !== "Completed") {

      pushBot(msgs.invoicePaid, true);

    }

  }, [invoiceData?.paymentStatus, language, trackingOrder?.status, msgs, pushBot]);



  useEffect(() => {

    if (!language || !reviewSubmitted || thankYouAnnouncedRef.current) return;

    thankYouAnnouncedRef.current = true;

    pushBot(msgs.thankYou, true);

  }, [reviewSubmitted, language, msgs, pushBot]);



  useEffect(() => () => stopListening(), [stopListening]);

  useEffect(() => {
    if (!window.speechSynthesis) return;
    const load = () => window.speechSynthesis.getVoices();
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);



  const handleSubmit = (e) => {

    e.preventDefault();

    void replyTo(input);

  };



  const toggleOpen = () => {

    void unlockWebAudio();

    setOpen((v) => {

      if (!v) setLoyaltyOpen(false);

      return !v;

    });

  };



  const handleLoyaltyOpenChange = (next) => {

    setLoyaltyOpen(next);

    if (next) setOpen(false);

  };



  const toggleMic = () => {

    void unlockWebAudio();

    if (!language) {

      pushBot(msgs.pickLanguage, false);

      return;

    }

    if (listening) {

      stopListening();

      return;

    }

    if (!voiceMode) setVoiceMode(true);

    void speakText(msgs.listening, language).then(() => startListening());

  };



  const hideFloating = invoiceModalOpen || reviewOpen || checkoutOpen || serviceOpen;



  if (hideFloating) return null;



  return (

    <div

      className={`customer-floating-root ${hasCartBar ? "has-cart-bar" : ""} ${showPayInvoiceBtn ? "has-pay-invoice" : ""}`}

    >

      {LOYALTY_ENABLED && showLoyalty ? (

        <CustomerLoyaltyCard

          loyalty={loyalty}

          loading={loyaltyLoading}

          phone={loyaltyPhone}

          onPhoneSubmit={onLoyaltyPhoneSubmit}

          onRedeem={onLoyaltyRedeem}

          redeeming={loyaltyRedeeming}

          open={loyaltyOpen}

          onOpenChange={handleLoyaltyOpenChange}

        />

      ) : null}



      {open ? (

        <section className="customer-chat-panel" aria-label="Restaurant assistant chat">

          <header className="customer-chat-head">

            <div>

              <strong>Ask me anything</strong>

              <span>{restaurant?.name || "Menu assistant"}</span>

            </div>

            <button type="button" className="customer-chat-close" onClick={() => setOpen(false)} aria-label="Close chat">

              <FiX />

            </button>

          </header>



          {voiceOk ? (

            <div className="customer-voice-bar">

              <div className="customer-voice-lang" role="group" aria-label="Voice language">

                <button

                  type="button"

                  className={`customer-voice-lang-btn ${language === "en" ? "active" : ""}`}

                  onClick={() => enableVoice("en")}

                >

                  English

                </button>

                <button

                  type="button"

                  className={`customer-voice-lang-btn ${language === "hi" ? "active" : ""}`}

                  onClick={() => enableVoice("hi")}

                >

                  हिंदी

                </button>

              </div>

              <button

                type="button"

                className={`customer-voice-mic-btn ${listening ? "listening" : ""} ${voiceMode ? "active" : ""}`}

                onClick={toggleMic}

                aria-label={listening ? "Stop listening" : "Start voice"}

              >

                {listening ? <FiMicOff /> : <FiMic />}

                <span>{listening ? (language === "hi" ? "Sun raha hoon…" : "Listening…") : language === "hi" ? "बोलिए" : "Tap to speak"}</span>

              </button>

            </div>

          ) : null}



          <div className="customer-chat-body" ref={bodyRef}>

            {messages.map((msg) => (

              <ChatMessage key={msg.id} role={msg.role} text={msg.text} />

            ))}

            {typing ? (

              <div className="customer-chat-msg bot">

                <div className="customer-chat-bubble customer-chat-typing">

                  <span />

                  <span />

                  <span />

                </div>

              </div>

            ) : null}

          </div>



          <div className="customer-chat-suggestions">

            {suggestions.map((chip) => (

              <button key={chip} type="button" className="customer-chat-chip" onClick={() => void replyTo(chip)}>

                {chip}

              </button>

            ))}

          </div>



          <form className="customer-chat-form" onSubmit={handleSubmit}>

            <input

              type="text"

              value={input}

              onChange={(e) => setInput(e.target.value)}

              placeholder="Ask about menu, order, bill…"

              autoComplete="off"

              aria-label="Chat message"

            />

            <button type="submit" disabled={!input.trim() || typing} aria-label="Send message">

              <FiSend />

            </button>

          </form>

        </section>

      ) : null}



      <button

        type="button"

        className={`customer-chat-fab ${open ? "open" : ""}`}

        onClick={toggleOpen}

        aria-label={open ? "Close assistant" : "Open assistant"}

        aria-expanded={open}

      >

        {open ? <FiX /> : <FiMessageCircle />}

        {!open ? <span className="customer-chat-fab-pulse" aria-hidden /> : null}

      </button>

    </div>

  );

}


