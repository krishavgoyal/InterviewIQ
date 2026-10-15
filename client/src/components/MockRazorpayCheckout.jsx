import { useState } from "react";
import {
  FaArrowRight,
  FaBuildingColumns,
  FaChevronRight,
  FaCreditCard,
  FaEllipsisVertical,
  FaLock,
  FaMobileScreenButton,
  FaRegClock,
  FaWallet,
  FaXmark,
} from "react-icons/fa6";
import {
  SiGooglepay,
  SiMastercard,
  SiPaytm,
  SiPhonepe,
  SiRazorpay,
  SiVisa,
} from "react-icons/si";
import axios from "axios";
import { ServerUrl } from "../config/api";

const paymentMethods = [
  { id: "recommended", label: "Recommended", icon: FaArrowRight },
  { id: "upi", label: "UPI", icon: FaMobileScreenButton, marks: [SiGooglepay, SiPhonepe, SiPaytm] },
  { id: "card", label: "Cards", icon: FaCreditCard, marks: [SiVisa, SiMastercard] },
  { id: "netbanking", label: "Netbanking", icon: FaBuildingColumns },
  { id: "wallet", label: "Wallet", icon: FaWallet, marks: [SiPaytm, SiPhonepe] },
  { id: "paylater", label: "Pay Later", icon: FaRegClock },
];

const banks = ["HDFC Bank", "ICICI Bank", "State Bank of India"];

function PaymentMarks({ marks = [] }) {
  return (
    <div className="flex items-center gap-1.5 text-[13px]">
      {marks.map((Mark, index) => (
        <Mark
          key={index}
          className={index === 0 ? "text-[#1662ad]" : index === 1 ? "text-[#7947bf]" : "text-[#19aaf8]"}
        />
      ))}
    </div>
  );
}

function DemoQrCode() {
  return (
    <svg viewBox="0 0 105 105" className="h-30 w-30 bg-white p-1" aria-label="Demo UPI QR code" role="img">
      <rect width="105" height="105" fill="white" />
      <g fill="#15191f">
        <path d="M3 3h30v30H3zM8 8h20v20H8zM13 13h10v10H13zM72 3h30v30H72zM77 8h20v20H77zM82 13h10v10H82zM3 72h30v30H3zM8 77h20v20H8zM13 82h10v10H13z" />
        <path d="M39 4h5v5h-5zm10 0h5v10h-5zm10 0h5v5h-5zm-20 10h10v5H39zm15 0h5v10h-5zm10 0h5v5h-5zM39 29h5v10h-5zm10 0h10v5H49zm15 0h5v10h-5zM39 44h5v5h-5zm10 0h5v10h-5zm10 0h10v5H59zm15 0h5v10h-5zm10 0h10v5H84zM4 39h5v10H4zm10 0h10v5H14zm15 0h5v15h-5zM4 54h10v5H4zm15 0h5v10h-5zm10 0h10v5H29zM39 59h10v5H39zm15 0h5v15h-5zm10 0h5v5h-5zm10 0h10v10H74zm15 0h5v5h-5zM39 74h5v10h-5zm10 0h10v5H49zm15 0h5v10h-5zm-35 15h10v5H29zm15 0h5v10h-5zm10 0h10v5H54zm15 0h5v10h-5zm10 0h15v5H79z" />
      </g>
    </svg>
  );
}

function MockRazorpayCheckout({ order, plan, onClose, onSuccess }) {
  const [method, setMethod] = useState("recommended");
  const [upiId, setUpiId] = useState("");
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvv: "" });
  const [bank, setBank] = useState("");
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);

  const amount = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format((order.amount || 0) / 100);
  const activeMethod = paymentMethods.find((item) => item.id === method);

  const setPaymentMethod = (nextMethod) => {
    setMethod(nextMethod);
    setError("");
  };

  const validate = () => {
    if (method === "upi" && !/^.+@.+$/.test(upiId.trim())) return "Enter a dummy UPI ID in the format name@upi.";
    if (method === "recommended" && upiId && !/^.+@.+$/.test(upiId.trim())) return "Enter a dummy UPI ID in the format name@upi.";
    if (method === "card") {
      if (card.number.replace(/\D/g, "").length < 12 || !card.name.trim() || !card.expiry.trim() || card.cvv.length < 3) return "Enter dummy values in each card field to continue.";
    }
    if (method === "netbanking" && !bank) return "Choose a bank to continue.";
    return "";
  };

  const handleDemoPayment = async (event) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) return setError(validationError);
    setError("");
    setProcessing(true);
    try {
      const response = await axios.post(`${ServerUrl}/api/payment/verify`, {
        razorpay_order_id: order.id,
        razorpay_payment_id: `pay_demo_${Date.now()}`,
        razorpay_signature: "demo",
      }, { withCredentials: true });
      onSuccess(response.data.user);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Demo payment could not be completed. Please try again.");
      setProcessing(false);
    }
  };

  const paymentContent = () => {
    if (method === "recommended") return <><p className="text-xs font-medium text-slate-500">UPI QR</p><div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center"><div className="rounded-md border border-slate-200 p-2"><DemoQrCode /></div><div><p className="text-[10px] font-medium tracking-wide text-slate-400">SCAN WITH ANY APP</p><PaymentMarks marks={[SiGooglepay, SiPhonepe, SiPaytm]} /><p className="mt-2 text-[11px] text-slate-500">Scan this demo QR to simulate a UPI payment.</p></div></div><p className="mt-6 text-[11px] font-medium text-slate-400">OR PAY USING UPI ID / NUMBER</p><input value={upiId} onChange={(event) => setUpiId(event.target.value)} placeholder="name@upi" className="mt-2 w-full rounded-md border border-slate-200 px-3 py-3 text-sm outline-none transition focus:border-[#56a9d4] focus:ring-2 focus:ring-sky-100" /></>;
    if (method === "upi") return <><p className="text-sm font-semibold">Pay with UPI</p><p className="mt-1 text-xs text-slate-500">Use a dummy UPI ID to complete this test payment.</p><input value={upiId} onChange={(event) => setUpiId(event.target.value)} placeholder="interviewiq@upi" className="mt-5 w-full rounded-md border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#56a9d4] focus:ring-2 focus:ring-sky-100" /></>;
    if (method === "card") return <div className="space-y-3"><p className="text-sm font-semibold">Add a new card</p><input value={card.number} onChange={(event) => setCard({ ...card, number: event.target.value })} placeholder="Card number" inputMode="numeric" className="w-full rounded-md border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#56a9d4]" /><input value={card.name} onChange={(event) => setCard({ ...card, name: event.target.value })} placeholder="Name on card" className="w-full rounded-md border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#56a9d4]" /><div className="grid grid-cols-2 gap-3"><input value={card.expiry} onChange={(event) => setCard({ ...card, expiry: event.target.value })} placeholder="MM / YY" className="rounded-md border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#56a9d4]" /><input value={card.cvv} onChange={(event) => setCard({ ...card, cvv: event.target.value })} placeholder="CVV" inputMode="numeric" className="rounded-md border border-slate-200 px-3 py-3 text-sm outline-none focus:border-[#56a9d4]" /></div></div>;
    if (method === "netbanking") return <div><p className="text-sm font-semibold">Choose your bank</p><div className="mt-4 space-y-2">{banks.map((bankName) => <label key={bankName} className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-3 text-sm ${bank === bankName ? "border-[#56a9d4] bg-sky-50" : "border-slate-200"}`}><input type="radio" name="bank" value={bankName} checked={bank === bankName} onChange={(event) => setBank(event.target.value)} />{bankName}</label>)}</div></div>;
    const Icon = activeMethod.icon;
    return <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-center"><Icon className="mx-auto text-2xl text-[#56a9d4]" /><p className="mt-3 text-sm font-semibold">{activeMethod.label} test payment</p><p className="mt-1 text-xs leading-relaxed text-slate-500">Continue to simulate this payment method. No real money or account details are involved.</p></div>;
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#20242b]/90 p-3 font-sans sm:p-6" role="dialog" aria-modal="true" aria-label="Razorpay test checkout">
      <form onSubmit={handleDemoPayment} className="grid max-h-[96vh] w-full max-w-245 overflow-y-auto rounded-3xl border border-white/10 bg-white shadow-[0_30px_90px_rgba(0,0,0,0.48)] md:max-h-130 md:grid-cols-[31%_69%] md:overflow-hidden">
        <aside className="relative min-h-62 overflow-hidden bg-[#56a9d4] p-5 text-white md:min-h-130 md:p-6">
          <div className="relative z-10 flex items-center gap-2 text-sm font-medium"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#3c9dcc] shadow-sm"><SiRazorpay size={18} /></div><span className="max-w-40 truncate">InterviewIQ.AI</span></div>
          <p className="relative z-10 mt-1 text-[10px] font-semibold text-emerald-50">✓ Razorpay Trusted Business</p>
          <div className="relative z-10 mt-5 rounded-lg bg-white p-3 text-slate-700 shadow-sm"><p className="text-[11px] text-slate-500">Price Summary</p><p className="mt-1 text-xl font-bold">{amount}</p><p className="mt-1 text-[10px] text-slate-400">{plan.credits} interview credits</p></div>
          <button type="button" className="relative z-10 mt-3 flex w-full items-center justify-between rounded-lg bg-white/95 px-3 py-3 text-left text-[11px] font-medium text-slate-600 shadow-sm"><span>Using +91 98563 21472</span><FaChevronRight className="text-slate-400" /></button>
          <div className="absolute -bottom-20 -left-8 h-52 w-120 rotate-[-20deg] rounded-[50%] bg-[#4297c4] opacity-90" /><div className="absolute bottom-5 left-5 flex items-center gap-1 text-[10px] text-white/90"><FaLock size={9} /> Secured by <span className="font-bold italic">Razorpay</span></div>
        </aside>

        <section className="bg-white text-slate-700"><header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 md:px-6"><p className="text-sm font-semibold text-slate-600">Payment Options</p><div className="flex items-center gap-4 text-slate-400"><FaEllipsisVertical /><button type="button" onClick={onClose} disabled={processing} aria-label="Close checkout" className="transition hover:text-slate-700 disabled:opacity-50"><FaXmark size={18} /></button></div></header>
          <div className="grid min-h-108 sm:grid-cols-[36%_64%]"><nav className="border-b border-slate-100 bg-[#f8fafc] py-2 sm:border-b-0 sm:border-r"><div className="flex overflow-x-auto sm:block">{paymentMethods.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => setPaymentMethod(item.id)} className={`flex min-w-30 items-center justify-between gap-2 px-4 py-3 text-left text-xs transition sm:w-full ${method === item.id ? "bg-[#eef6fe] font-semibold text-slate-700" : "text-slate-600 hover:bg-slate-100"}`}><span className="flex items-center gap-2"><Icon className={method === item.id ? "text-[#4d9fd0]" : "text-slate-400"} />{item.label}</span><PaymentMarks marks={item.marks} /></button>; })}</div></nav>
            <main className="p-5 md:p-6">{paymentContent()}{error && <p className="mt-4 text-xs text-red-600">{error}</p>}<button disabled={processing} className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-linear-to-b from-[#252d32] to-[#070a0c] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70"><FaLock size={11} />{processing ? "Processing test payment..." : `Verify and Pay ${amount}`}</button><p className="mt-3 text-center text-[10px] text-slate-400">This is a local test checkout. No payment is collected.</p></main>
          </div>
        </section>
      </form>
    </div>
  );
}

export default MockRazorpayCheckout;
