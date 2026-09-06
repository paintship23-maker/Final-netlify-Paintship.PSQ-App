import React, { useMemo, useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { C } from "./shared.jsx";

const GST_RATE = 18;
const fmt = n => (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const fmt2 = n => (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

function numberToWords(n) {
  const below20 = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten",
    "Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function recurse(num) {
    if (num < 20) return below20[num];
    if (num < 100) return tens[Math.floor(num/10)] + (num%10?" "+below20[num%10]:"");
    if (num < 1000) return below20[Math.floor(num/100)]+" Hundred" + (num%100?" "+recurse(num%100):"");
    if (num < 100000) return recurse(Math.floor(num/1000))+" Thousand" + (num%1000?" "+recurse(num%1000):"");
    if (num < 10000000) return recurse(Math.floor(num/100000))+" Lakh" + (num%100000?" "+recurse(num%100000):"");
    return recurse(Math.floor(num/10000000))+" Crore" + (num%10000000?" "+recurse(num%10000000):"");
  }
  const num = Math.floor(n);
  if (num === 0) return "Zero";
  return recurse(num) + " Rupees Only";
}

const DEFAULT_STAGES = [
  { id: "stage1", pct: 20, label: "Stage 1: Advance / Booking Invoice (20%)", shortLabel: "Stage 1: Advance", desc: "Booking & Material", invoiceTitle: "STAGE 1: ADVANCE INVOICE", type: "advance" },
  { id: "stage2", pct: 50, label: "Stage 2: Running / Mid-Project Invoice (50%)", shortLabel: "Stage 2: Running", desc: "Surface Prep & Primer Complete", invoiceTitle: "STAGE 2: PROGRESS INVOICE", type: "running" },
  { id: "stage3", pct: 30, label: "Stage 3: Final Completion & Handover Invoice (Balance Outstanding)", shortLabel: "Stage 3: Final", desc: "Project Handover", invoiceTitle: "FINAL COMPLETION & HANDOVER INVOICE", type: "final" },
];

const PAYMENT_STATUS_OPTIONS = ["UNPAID", "PARTIALLY PAID", "PAID"];

const inputBaseStyle = {
  border: "1px solid #CBD5E1",
  borderRadius: 4,
  padding: "3px 6px",
  fontSize: 11,
  outline: "none",
  background: "#fff",
  color: "#0F172A",
  fontWeight: 600,
  boxSizing: "border-box",
  width: "100%",
};

const editableFieldStyle = {
  ...inputBaseStyle,
  border: "1px dashed #94A3B8",
  background: "#F8FAFC",
  cursor: "text",
};

export default function InvoiceModal({ project, totals, onClose }) {
  const [selectedStageIdx, setSelectedStageIdx] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState("UNPAID");
  const [previouslyReceived, setPreviouslyReceived] = useState(0);
  const [isCustomStage, setIsCustomStage] = useState(false);
  const [customPercentage, setCustomPercentage] = useState(0);
  const [customAmount, setCustomAmount] = useState(0);

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split("T")[0];
  });
  const [placeOfSupply, setPlaceOfSupply] = useState(project?.customer?.location || project?.customer?.pincode || "Maharashtra");
  const [customerBillingAddress, setCustomerBillingAddress] = useState("");
  const [customerShippingAddress, setCustomerShippingAddress] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyGSTIN, setCompanyGSTIN] = useState("27AAACA1234A1Z5");
  const [companyPAN, setCompanyPAN] = useState("AAACA1234A");
  const [bankName, setBankName] = useState("HDFC Bank Ltd");
  const [bankAccount, setBankAccount] = useState("50200084920192");
  const [bankIFSC, setBankIFSC] = useState("HDFC0001234");
  const [bankBranch, setBankBranch] = useState("Mumbai - Fort");
  const [upiId, setUpiId] = useState("paintship@upi");
  const [companyName, setCompanyName] = useState("PaintShip Services");
  const [authorizedSignatory, setAuthorizedSignatory] = useState("");
  const [digitalStamp, setDigitalStamp] = useState(false);

  // Dynamic line items
  const [lineItems, setLineItems] = useState([]);
  const [useManualItems, setUseManualItems] = useState(false);

  // Dynamic discounts / charges
  const [reductions, setReductions] = useState([]);
  const [extraCharges, setExtraCharges] = useState([]);

  // Tax/GST editable fields
  const [taxPct, setTaxPct] = useState(GST_RATE);
  const [taxEnabled, setTaxEnabled] = useState(true);

  // UPI QR toggle
  const [showQrCode, setShowQrCode] = useState(true);

  // ---- Derived data from project totals (auto mode) ----
  const autoData = useMemo(() => {
    const grandTotal = Number(totals?.grandTotal) || 0;
    const grandArea = Number(totals?.grandArea) || 0;
    const subtotal = Number(totals?.combinedSubtotal) || 0;
    const additionalCharges = Number(totals?.additionalCharges) || 0;
    const discountAmount = Number(totals?.discountAmount) || 0;
    const gstAmount = Number(totals?.gstAmount) || 0;
    const gstPct = Number(totals?.gstPct) || GST_RATE;

    const sections = [
      { label: "Interior", area: totals?.interior?.area || 0, total: totals?.interior?.total || 0, material: 0, labour: 0 },
      { label: "Exterior", area: totals?.exterior?.area || 0, total: totals?.exterior?.total || 0, material: totals?.exterior?.material || 0, labour: totals?.exterior?.labour || 0 },
      { label: "Polish / Enamel", area: totals?.polish?.area || 0, total: totals?.polish?.total || 0, material: 0, labour: 0 },
      { label: "Door & Window", area: totals?.doorwindow?.area || 0, total: totals?.doorwindow?.total || 0, material: 0, labour: 0 },
      { label: "Wallpaper", area: totals?.wallpaper?.area || 0, total: totals?.wallpaper?.total || 0, material: 0, labour: 0 },
      { label: "Texture", area: totals?.texture?.area || 0, total: totals?.texture?.total || 0, material: 0, labour: 0 },
    ].filter(s => s.total > 0 || s.area > 0);

    const itemRows = [];
    let srCounter = 0;
    sections.forEach((section) => {
      const sectionTotal = section.total || 0;
      const sectionArea = section.area || 0;
      if (section.material && section.labour) {
        srCounter++;
        itemRows.push({ sr: srCounter, item: `${section.label} - Material`, area: sectionArea, rate: sectionArea > 0 ? (section.material / sectionArea) : 0, taxableValue: section.material });
        srCounter++;
        itemRows.push({ sr: srCounter, item: `${section.label} - Labour`, area: sectionArea, rate: sectionArea > 0 ? (section.labour / sectionArea) : 0, taxableValue: section.labour });
      } else {
        srCounter++;
        itemRows.push({ sr: srCounter, item: section.label, area: sectionArea, rate: sectionTotal > 0 && sectionArea > 0 ? (sectionTotal / sectionArea) : 0, taxableValue: sectionTotal });
      }
    });

    return { grandTotal, grandArea, subtotal, additionalCharges, discountAmount, gstAmount, gstPct, sections, itemRows };
  }, [totals]);

  // ---- Active item rows (manual or auto) ----
  const activeItems = useManualItems ? lineItems : autoData.itemRows.map((r, i) => ({ ...r, sr: i + 1 }));

  const addLineItem = useCallback(() => {
    setLineItems(prev => [...prev, { id: Date.now() + Math.random(), description: "", area: 0, rate: 0, qty: 1 }]);
  }, []);

  const removeLineItem = useCallback((id) => {
    setLineItems(prev => prev.filter(r => r.id !== id));
  }, []);

  const updateLineItem = useCallback((id, field, value) => {
    setLineItems(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }, []);

  // ---- Reductions (discounts) ----
  const addReduction = useCallback(() => {
    setReductions(prev => [...prev, { id: Date.now() + Math.random(), label: "", amount: 0 }]);
  }, []);

  const removeReduction = useCallback((id) => {
    setReductions(prev => prev.filter(r => r.id !== id));
  }, []);

  const updateReduction = useCallback((id, field, value) => {
    setReductions(prev => prev.map(r => r.id === id ? { ...r, [field]: field === "amount" ? (parseFloat(value) || 0) : value } : r));
  }, []);

  // ---- Extra charges ----
  const addExtraCharge = useCallback(() => {
    setExtraCharges(prev => [...prev, { id: Date.now() + Math.random(), label: "", amount: 0 }]);
  }, []);

  const removeExtraCharge = useCallback((id) => {
    setExtraCharges(prev => prev.filter(r => r.id !== id));
  }, []);

  const updateExtraCharge = useCallback((id, field, value) => {
    setExtraCharges(prev => prev.map(r => r.id === id ? { ...r, [field]: field === "amount" ? (parseFloat(value) || 0) : value } : r));
  }, []);

  // ---- Calculations ----
  const calc = useMemo(() => {
    const itemsSubtotal = activeItems.reduce((s, r) => {
      if (useManualItems) {
        const qty = Number(r.qty) || 1;
        const rate = Number(r.rate) || 0;
        return s + qty * rate;
      }
      return s + (Number(r.taxableValue) || 0);
    }, 0);

    const totalReductions = reductions.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const totalExtraCharges = extraCharges.reduce((s, r) => s + (Number(r.amount) || 0), 0);

    const afterReductions = Math.max(0, itemsSubtotal - totalReductions);
    const afterCharges = afterReductions + totalExtraCharges;

    const gstBase = taxEnabled ? (afterCharges * (Number(taxPct) || 0) / 100) : 0;
    const grandTotal = afterCharges + gstBase;

    return { itemsSubtotal, totalReductions, totalExtraCharges, afterReductions, afterCharges, gstBase, grandTotal };
  }, [activeItems, reductions, extraCharges, taxEnabled, taxPct, useManualItems]);

  const data = useMemo(() => {
    const companyState = "Maharashtra";
    const isIGST = placeOfSupply && placeOfSupply.trim().toLowerCase() !== companyState.toLowerCase();
    const effectiveGst = isIGST ? "IGST" : "GST";

    const baseInvoiceNo = invoiceNumber || `INV-${String(project?.id || "").slice(-6).toUpperCase()}`;
    const stageSuffix = isCustomStage ? `-CUSTOM` : `-S${selectedStageIdx + 1}`;
    const finalInvoiceNo = baseInvoiceNo.endsWith(stageSuffix) ? baseInvoiceNo : `${baseInvoiceNo}${stageSuffix}`;

    const invoiceDateObj = new Date(invoiceDate);
    const formattedDate = invoiceDateObj.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
    const dueDateObj = new Date(dueDate);
    const formattedDueDate = dueDateObj.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });

    let stages = DEFAULT_STAGES.map((s) => ({ ...s, amount: (calc.grandTotal * s.pct) / 100 }));

    if (isCustomStage) {
      const customPct = customPercentage > 0 ? customPercentage : 0;
      const customAmt = customAmount > 0 ? customAmount : 0;
      const actualAmount = customAmt > 0 ? customAmt : (calc.grandTotal * customPct) / 100;
      stages.push({
        id: "custom", pct: customPct,
        label: customAmt > 0 ? `Custom Amount: ₹${fmt(customAmt)}` : `Custom Percentage: ${customPct}%`,
        shortLabel: customAmt > 0 ? "Custom Amount" : "Custom Percentage",
        desc: "Custom stage as specified", invoiceTitle: "CUSTOM STAGE INVOICE", type: "custom", amount: actualAmount,
      });
    }

    const stagesBeforeCurrent = isCustomStage ? [] : stages.slice(0, selectedStageIdx).map(s => s.amount);
    const cumulativePaidFromStages = stagesBeforeCurrent.reduce((a, b) => a + b, 0);
    const totalPreviouslyReceived = (Number(previouslyReceived) || 0) + cumulativePaidFromStages;
    const currentStageAmount = isCustomStage ? stages[stages.length - 1].amount : (stages[selectedStageIdx]?.amount || 0);
    const remainingBalance = calc.grandTotal - totalPreviouslyReceived - currentStageAmount;

    return {
      grandTotal: calc.grandTotal, grandArea: autoData.grandArea,
      invoiceNo: finalInvoiceNo, date: formattedDate, dueDate: formattedDueDate,
      placeOfSupply, stages, totalPreviouslyReceived, currentStageAmount,
      remainingBalance, cumulativePaidFromStages,
      isIGST, effectiveGst,
    };
  }, [project, calc, autoData.grandArea, selectedStageIdx, isCustomStage, customPercentage, customAmount, invoiceNumber, invoiceDate, dueDate, placeOfSupply, previouslyReceived]);

  const currentStage = data.stages.find((_, idx) =>
    isCustomStage ? idx === data.stages.length - 1 : idx === selectedStageIdx
  ) || data.stages[0];

  const invoiceTitle = currentStage?.invoiceTitle || data.stages[0]?.invoiceTitle;
  const amountDue = data.currentStageAmount;
  const balanceRemaining = data.remainingBalance;
  const amountInWords = numberToWords(amountDue);

  const cust = project?.customer || {};
  const scope = project?.scope || "—";
  const projectType = project?.projectType === "fresh" ? "Fresh Painting" : project?.projectType === "repaint" ? "Re-Painting" : "—";
  const category = project?.projectCategory || project?.category || "—";

  const handleStageChange = useCallback((val) => {
    if (val === "custom") { setIsCustomStage(true); setSelectedStageIdx(0); }
    else { setIsCustomStage(false); setSelectedStageIdx(Number(val)); }
  }, []);

  const handleCustomPercentage = useCallback((val) => {
    const v = parseFloat(val) || 0;
    setCustomPercentage(v > 100 ? 100 : v);
    if (v > 0) setCustomAmount(0);
  }, []);

  const handleCustomAmount = useCallback((val) => {
    const v = parseFloat(val) || 0;
    setCustomAmount(v);
    if (v > 0) setCustomPercentage(0);
  }, []);

  const handlePreviouslyReceived = useCallback((val) => {
    setPreviouslyReceived(parseFloat(val) || 0);
  }, []);

  const handlePaymentStatusSet = useCallback(() => {
    const v = Number(previouslyReceived) || 0;
    if (v >= data.grandTotal) setPaymentStatus("PAID");
    else if (v > 0) setPaymentStatus("PARTIALLY PAID");
    else setPaymentStatus("UNPAID");
  }, [previouslyReceived, data.grandTotal]);

  const companyLogo = "/PaintShip B W Logo.png";
  const companyAddr = companyAddress || "123 Corporate Plaza, MG Road, Mumbai - 400001, Maharashtra";

  const upiString = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=Paintship`;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", overflowY:"auto", padding:"16px 12px" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.white, borderRadius:14, maxWidth:960, width:"100%", margin:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
        {/* Modal header bar */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", borderBottom:`1px solid ${C.border}` }} className="no-print">
          <div style={{ fontSize:13, fontWeight:700, color:C.navy }}>Invoice & Payment Schedule</div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:18, color:"#bbb", cursor:"pointer" }}>✕</button>
        </div>

        {/* ============ CORPORATE INVOICE BODY ============ */}
        <div id="invoice-print-area" style={{
          width: "210mm",
          minHeight: "297mm",
          maxHeight: "297mm",
          boxSizing: "border-box",
          padding: "24px 32px",
          background: "#fff",
          border: "1px solid #E2E8F0",
          overflow: "hidden",
          margin: "0 auto",
          color: "#0F172A",
          fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          fontSize: "11px",
          lineHeight: 1.35,
        }}>

          {/* === A. TOP HEADER: Logo (square) + Company name below | Divider | Invoice Metadata (Right) === */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1px 1fr", gap: "16px", paddingBottom: "14px", marginBottom: "14px", borderBottom: "1px solid #E2E8F0" }}>
            {/* Left: Company Logo (square) + Name/Address below */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "8px" }}>
                <div style={{ width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #E2E8F0", borderRadius: 8, background: "#fff", padding: 4, flexShrink: 0 }}>
                  <img src={companyLogo} alt="PaintShip" crossOrigin="anonymous" onError={(e) => { e.target.src = '/PaintShip B Logo.png'; }} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#0F1E3C", lineHeight: 1.2 }}>{companyName}</div>
                  <div style={{ fontSize: 10, color: "#64748B", fontWeight: 500, letterSpacing: "0.02em", lineHeight: 1.4, textTransform: "uppercase" }}>Head Office / Operations</div>
                </div>
              </div>
              {/* Horizontal divider */}
              <hr style={{ border: "none", borderTop: "1px solid #D1D5DB", margin: "4px 0", width: "100%" }} />
              {/* Head office address block */}
              <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.5 }}>
                <div>{companyAddr}</div>
                <div style={{ marginTop: "4px", fontSize: 10, color: "#64748B" }}>GSTIN: {companyGSTIN} | PAN: {companyPAN}</div>
              </div>
            </div>

            {/* Middle: Vertical Divider */}
            <div style={{ borderRight: "1px solid #D1D5DB", margin: "0 16px", height: "100%" }} />

            {/* Right: Invoice Metadata — editable fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "flex-end" }}>
              <div style={{ background: "#EFF6FF", color: "#1E40AF", padding: "4px 12px", borderRadius: "16px", fontSize: 11, fontWeight: 600, display: "inline-block" }}>{currentStage.shortLabel}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%", maxWidth: "280px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "#64748B", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>Invoice No</span>
                  <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder={data.invoiceNo} style={{ ...editableFieldStyle, maxWidth: 160, textAlign: "right" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "#64748B", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>Invoice Date</span>
                  <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} style={{ ...editableFieldStyle, maxWidth: 160 }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "#64748B", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>Due Date</span>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ ...editableFieldStyle, maxWidth: 160 }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "#64748B", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>Place</span>
                  <input type="text" value={placeOfSupply} onChange={e => setPlaceOfSupply(e.target.value)} placeholder="Location" style={{ ...editableFieldStyle, maxWidth: 160, textAlign: "right" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "#64748B", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>Tax</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button onClick={() => setTaxEnabled(!taxEnabled)} style={{ border: `1px solid ${taxEnabled ? "#0F1E3C" : "#CBD5E1"}`, borderRadius: 4, padding: "2px 6px", fontSize: 9, fontWeight: 700, cursor: "pointer", background: taxEnabled ? "#0F1E3C" : "#F1F5F9", color: taxEnabled ? "#fff" : "#64748B" }}>{taxEnabled ? "GST ON" : "GST OFF"}</button>
                    {taxEnabled && (
                      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#0F172A" }}>{data.effectiveGst} @</span>
                        <input type="number" min="0" max="100" value={taxPct} onChange={e => setTaxPct(parseFloat(e.target.value) || 0)} style={{ ...editableFieldStyle, width: 48, textAlign: "center" }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#0F172A" }}>%</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* === B. BILLING METADATA BLOCK === */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div style={{ border: "1px solid #E2E8F0", borderRadius: "8px", padding: "10px 12px", background: "#FAFBFC" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#0F1E3C", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>Billed To / Billing Address</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#0F172A" }}>{cust.name || "Valued Client"}</div>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5, marginTop: "4px" }}>{(customerBillingAddress || cust.address || "Site Address As Per Job Details")}</div>
              <div style={{ fontSize: 12, color: "#475569", marginTop: "4px" }}>{(cust.location || cust.pincode) ? `${cust.location || ""} ${cust.pincode ? `— ${cust.pincode}` : ""}` : ""}</div>
              <div style={{ fontSize: 12, color: "#475569", marginTop: "4px" }}>{cust.mobile ? `Mob: ${cust.mobile}` : ""}</div>
            </div>
            <div style={{ border: "1px solid #E2E8F0", borderRadius: "8px", padding: "10px 12px", background: "#FAFBFC" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#0F1E3C", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>Shipping / Site Address</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#0F172A" }}>Project Site</div>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5, marginTop: "4px" }}>{(customerShippingAddress || cust.address || "Site Address As Per Job Details")}</div>
              <div style={{ fontSize: 12, color: "#475569", marginTop: "4px" }}>{(cust.location || cust.pincode) ? `${cust.location || ""} ${cust.pincode ? `— ${cust.pincode}` : ""}` : ""}</div>
              <div style={{ fontSize: 12, color: "#475569", marginTop: "4px" }}>{cust.mobile ? `Mob: ${cust.mobile}` : ""}</div>
            </div>
          </div>

          {/* Project Details Strip */}
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginBottom: "16px", fontSize: "11px", color: "#475569" }}>
            <span><b style={{ color: "#0F1E3C" }}>Category:</b> {category}</span>
            <span><b style={{ color: "#0F1E3C" }}>Type:</b> {projectType}</span>
            <span><b style={{ color: "#0F1E3C" }}>Scope:</b> {scope}</span>
            <span><b style={{ color: "#0F1E3C" }}>Total Area:</b> {fmt2(data.grandArea)} sq ft</span>
            <span><b style={{ color: "#0F1E3C" }}>Stage:</b> {currentStage.shortLabel}</span>
          </div>

          {/* === C. ITEMIZED COST TABLE === */}
          <div style={{ marginBottom: "16px", overflowX: "auto", pageBreakInside: "avoid" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#fff", textTransform: "uppercase", letterSpacing: "0.04em", padding: "6px 10px", background: "#0F1E3C", flex: 1 }}>Itemized Cost Breakdown</div>
              <button onClick={() => setUseManualItems(!useManualItems)} className="no-print" style={{ border: "1px solid #0F1E3C", borderRadius: 0, padding: "6px 10px", fontSize: 9, fontWeight: 700, cursor: "pointer", background: useManualItems ? "#0F1E3C" : "#fff", color: useManualItems ? "#fff" : "#0F1E3C", whiteSpace: "nowrap" }}>{useManualItems ? "Auto Mode" : "Manual Mode"}</button>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", border: "1px solid #0F1E3C", pageBreakInside: "avoid" }}>
              <thead>
                <tr style={{ background: "#F8FAFC" }}>
                  {["#", "Item / Scope", "Qty", "Area (sq ft)", "Rate (₹)", "Amount (₹)"].map(h => (
                    <th key={h} style={{ padding: "6px 8px", textAlign: (h === "Item / Scope" || h === "#") ? (h === "#" ? "center" : "left") : "right", fontSize: 9, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.03em", borderBottom: "1px solid #0F1E3C", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                  {useManualItems && <th style={{ padding: "6px 8px", textAlign: "center", fontSize: 9, fontWeight: 600, color: "#64748B", textTransform: "uppercase", borderBottom: "1px solid #0F1E3C" }} className="no-print">—</th>}
                </tr>
              </thead>
              <tbody>
                {activeItems.length === 0 && (
                  <tr><td colSpan={useManualItems ? 7 : 6} style={{ padding: "16px", textAlign: "center", color: "#64748B", border: "1px solid #0F1E3C" }}>No items. {useManualItems ? "Click \"Add Line Item\" to add one." : "No scope data available."}</td></tr>
                )}
                {activeItems.map((r, i) => (
                  <tr key={useManualItems ? r.id : i} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 ? "#FAFBFC" : "#fff" }}>
                    <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 500, color: "#64748B", border: "1px solid #F1F5F9" }}>{r.sr || i + 1}</td>
                    <td style={{ padding: "6px 8px", fontWeight: 500, color: "#0F172A", border: "1px solid #F1F5F9" }}>
                      {useManualItems ? (
                        <input type="text" value={r.description || ""} onChange={e => updateLineItem(r.id, "description", e.target.value)} placeholder="Item description" style={{ ...editableFieldStyle, minWidth: 120 }} />
                      ) : (
                        <span style={{ whiteSpace: "nowrap" }}>{r.item}</span>
                      )}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "#334155", border: "1px solid #F1F5F9" }}>
                      {useManualItems ? (
                        <input type="number" min="1" value={r.qty || 1} onChange={e => updateLineItem(r.id, "qty", e.target.value)} style={{ ...editableFieldStyle, width: 50, textAlign: "right" }} />
                      ) : (
                        <span>1</span>
                      )}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "#334155", border: "1px solid #F1F5F9" }}>
                      {useManualItems ? (
                        <input type="number" min="0" value={r.area || 0} onChange={e => updateLineItem(r.id, "area", e.target.value)} style={{ ...editableFieldStyle, width: 60, textAlign: "right" }} />
                      ) : (
                        fmt2(r.area)
                      )}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "#334155", border: "1px solid #F1F5F9" }}>
                      {useManualItems ? (
                        <input type="number" min="0" value={r.rate || 0} onChange={e => updateLineItem(r.id, "rate", e.target.value)} style={{ ...editableFieldStyle, width: 70, textAlign: "right" }} />
                      ) : (
                        fmt(r.rate)
                      )}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, color: "#0F172A", border: "1px solid #F1F5F9" }}>
                      {useManualItems ? fmt((Number(r.qty) || 1) * (Number(r.rate) || 0)) : fmt(r.taxableValue)}
                    </td>
                    {useManualItems && (
                      <td style={{ padding: "6px 8px", textAlign: "center", border: "1px solid #F1F5F9" }} className="no-print">
                        <button onClick={() => removeLineItem(r.id)} style={{ border: "none", background: "none", color: "#DC2626", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>✕</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {useManualItems && (
              <button onClick={addLineItem} className="no-print" style={{ marginTop: 6, border: "1px dashed #94A3B8", borderRadius: 4, padding: "4px 12px", fontSize: 10, fontWeight: 700, cursor: "pointer", background: "#F8FAFC", color: "#0F1E3C" }}>+ Add Line Item</button>
            )}
          </div>

          {/* === D. FINANCIAL SUMMARY === */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px", pageBreakInside: "avoid" }}>
            {/* Left: Financial Summary with dynamic reductions/charges */}
            <div style={{ border: "1px solid #E2E8F0", borderRadius: "8px", padding: "10px 12px", background: "#FAFBFC" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#0F1E3C", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px" }}>Financial Summary</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "#475569" }}>Subtotal</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "#0F172A" }}>₹{fmt(calc.itemsSubtotal)}</span>
                </div>

                {/* Dynamic reductions */}
                {reductions.map((r) => (
                  <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
                      <span style={{ fontSize: 12, color: "#DC2626" }}>−</span>
                      <input type="text" value={r.label} onChange={e => updateReduction(r.id, "label", e.target.value)} placeholder="Discount / Reduction" style={{ ...editableFieldStyle, flex: 1 }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 12, color: "#475569" }}>₹</span>
                      <input type="number" min="0" value={r.amount} onChange={e => updateReduction(r.id, "amount", e.target.value)} style={{ ...editableFieldStyle, width: 70, textAlign: "right" }} />
                      <button onClick={() => removeReduction(r.id)} className="no-print" style={{ border: "none", background: "none", color: "#DC2626", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>✕</button>
                    </div>
                  </div>
                ))}

                {/* Dynamic extra charges */}
                {extraCharges.map((r) => (
                  <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
                      <span style={{ fontSize: 12, color: "#16A34A" }}>+</span>
                      <input type="text" value={r.label} onChange={e => updateExtraCharge(r.id, "label", e.target.value)} placeholder="Extra Charge" style={{ ...editableFieldStyle, flex: 1 }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 12, color: "#475569" }}>₹</span>
                      <input type="number" min="0" value={r.amount} onChange={e => updateExtraCharge(r.id, "amount", e.target.value)} style={{ ...editableFieldStyle, width: 70, textAlign: "right" }} />
                      <button onClick={() => removeExtraCharge(r.id)} className="no-print" style={{ border: "none", background: "none", color: "#DC2626", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>✕</button>
                    </div>
                  </div>
                ))}

                {calc.totalReductions > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #F1F5F9", paddingTop: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#DC2626" }}>Total Reductions</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#DC2626" }}>− ₹{fmt(calc.totalReductions)}</span>
                  </div>
                )}
                {calc.totalExtraCharges > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #F1F5F9", paddingTop: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#16A34A" }}>Total Extra Charges</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#16A34A" }}>+ ₹{fmt(calc.totalExtraCharges)}</span>
                  </div>
                )}

                {/* Add buttons (no-print) */}
                <div className="no-print" style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <button onClick={addReduction} style={{ border: "1px dashed #DC2626", borderRadius: 4, padding: "3px 8px", fontSize: 9, fontWeight: 700, cursor: "pointer", background: "#FEF2F2", color: "#DC2626" }}>+ Add Discount</button>
                  <button onClick={addExtraCharge} style={{ border: "1px dashed #16A34A", borderRadius: 4, padding: "3px 8px", fontSize: 9, fontWeight: 700, cursor: "pointer", background: "#F0FDF4", color: "#16A34A" }}>+ Add Charge</button>
                </div>

                <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "6px", display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>Taxable Amount</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>₹{fmt(calc.afterCharges)}</span>
                </div>
                {taxEnabled && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "#475569" }}>{data.effectiveGst} (@{taxPct}%)</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "#0F172A" }}>₹{fmt(calc.gstBase)}</span>
                  </div>
                )}
                {data.isIGST && taxEnabled && (
                  <div style={{ fontSize: 11, color: "#64748B", fontStyle: "italic" }}>Integrated GST (Inter-State)</div>
                )}
              </div>
              <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "12px", marginTop: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Grand Total</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "#0F1E3C" }}>₹{fmt(calc.grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Right: Multi-Stage Payment Ledger */}
            <div style={{ border: "1px solid #0F1E3C", borderRadius: "8px", padding: "10px 12px", background: "#FAFBFC" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#fff", textTransform: "uppercase", letterSpacing: "0.04em", padding: "5px 8px", background: "#0F1E3C", display: "inline-block", marginBottom: "8px" }}>Multi-Stage Payment Ledger</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "#475569" }}>Total Project Quotation</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>₹{fmt(data.grandTotal)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "#475569" }}>Amount Previously Received</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>₹{fmt(data.totalPreviouslyReceived)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "#475569" }}>Current Stage Invoice Due</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0F1E3C" }}>₹{fmt(amountDue)}</span>
                </div>
                <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "10px", display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#DC2626" }}>Remaining Balance</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#DC2626" }}>₹{fmt(Math.max(0, balanceRemaining))}</span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                {data.stages.map((s, i) => {
                  const isActive = !isCustomStage && i === selectedStageIdx;
                  const isCustom = isCustomStage && i === data.stages.length - 1;
                  return (
                    <div key={s.id} style={{
                      padding: "10px 8px",
                      border: `1.5px solid ${isActive || isCustom ? "#0F1E3C" : "#E2E8F0"}`,
                      borderRadius: "6px",
                      background: isActive || isCustom ? "#F0F9FF" : "#fff",
                      textAlign: "center",
                      cursor: !isCustom ? "pointer" : "default"
                    }} onClick={() => { if (!isCustom) setSelectedStageIdx(i); }}>
                      <div style={{ fontSize: 8, fontWeight: 700, color: "#0F1E3C", textTransform: "uppercase", letterSpacing: "0.03em" }}>{s.shortLabel}</div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#0F172A", marginTop: "4px" }}>₹{fmt(s.amount)}</div>
                      <div style={{ fontSize: 9, color: "#64748B" }}>{s.pct}%</div>
                      {(isActive || isCustom) && <div style={{ fontSize: 8, fontWeight: 700, color: "#1E40AF", marginTop: "4px", background: "#EFF6FF", display: "inline-block", padding: "2px 6px", borderRadius: "8px" }}>ACTIVE</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Amount in Words */}
          <div style={{ marginBottom: "14px", padding: "8px 12px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "6px", pageBreakInside: "avoid" }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "3px" }}>Total Amount in Words (INR)</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{amountInWords}</div>
          </div>

          {/* === E. FOOTER: Bank Details | UPI QR (toggleable) | Signatory === */}
          <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "12px", display: "grid", gridTemplateColumns: showQrCode ? "1.2fr 1fr 1fr" : "1fr 1fr", gap: "16px", alignItems: "flex-end", pageBreakInside: "avoid" }}>
            {/* Bank Details (Left) */}
            <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.6 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#0F1E3C", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "10px" }}>Bank Details</div>
              <div><span style={{ color: "#64748B", marginRight: "6px" }}>Bank</span><span style={{ color: "#0F172A", fontWeight: 600 }}>{bankName}</span></div>
              <div><span style={{ color: "#64748B", marginRight: "6px" }}>A/C</span><span style={{ color: "#0F172A", fontWeight: 600 }}>{bankAccount}</span></div>
              <div><span style={{ color: "#64748B", marginRight: "6px" }}>IFSC</span><span style={{ color: "#0F172A", fontWeight: 600 }}>{bankIFSC}</span></div>
              <div><span style={{ color: "#64748B", marginRight: "6px" }}>Branch</span><span style={{ color: "#0F172A", fontWeight: 600 }}>{bankBranch}</span></div>
            </div>

            {/* UPI QR Code (Center) — only when toggle is ON */}
            {showQrCode && (
              <div style={{ textAlign: "center", padding: "12px", background: "#fff", border: "1px solid #E2E8F0", borderRadius: "8px" }}>
                <div style={{ width: 80, height: 80, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", borderRadius: "4px" }}>
                  <QRCodeSVG value={upiString} size={80} level="M" includeMargin={false} />
                </div>
                <div style={{ fontSize: 9, fontWeight: 600, color: "#64748B", letterSpacing: "0.04em", textTransform: "uppercase" }}>SCAN TO PAY VIA UPI</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#0F1E3C", marginTop: "2px" }}>{upiId}</div>
              </div>
            )}

            {/* Authorized Signatory / Digital Stamp (Right) */}
            <div style={{ textAlign: "right" }}>
              {digitalStamp && (
                <div style={{ display: "inline-block", padding: "4px 10px", background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: "12px", fontSize: 9, fontWeight: 700, color: "#15803D", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>✓ Digital Stamp</div>
              )}
              <div style={{ borderTop: "1px solid #0F172A", paddingTop: "8px", marginTop: digitalStamp ? "0" : "24px" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#0F1E3C" }}>Authorized Signatory</div>
                <div style={{ fontSize: 11, color: "#475569", marginTop: "2px" }}>{authorizedSignatory || "Authorized Signatory"}</div>
                <div style={{ fontSize: 10, color: "#64748B", marginTop: "2px" }}>{companyName}</div>
                <div style={{ fontSize: 9, color: "#94A3B8", marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Project Director</div>
              </div>
            </div>
          </div>

          {/* Terms */}
          <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: "10px", marginTop: "12px", fontSize: 9, color: "#64748B", lineHeight: 1.4, pageBreakInside: "avoid" }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: "#0F1E3C", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "4px" }}>Terms & Conditions</div>
            <div>Payment due as per the staged schedule above. Work commences upon receipt of advance payment. Any additional scope will be billed separately. This is a computer-generated invoice and does not require a signature.</div>
          </div>
        </div>

        {/* ============ INVOICE CONFIG PANEL (Team Controls) ============ */}
        <div className="no-print" style={{ borderTop:`1px solid ${C.border}`, padding:"18px 24px", background:"#FAFBFC" }}>
          <div style={{ fontSize:12, fontWeight:800, color:C.navy, marginBottom:"14px", letterSpacing:"0.02em" }}>⚙ Invoice Config Panel — Team Controls</div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:"12px", marginBottom:"14px" }}>
            {/* Stage Selection */}
            <div>
              <label style={{ fontSize:9, fontWeight:700, color:"#64748B", letterSpacing:"0.05em", textTransform:"uppercase", display:"block", marginBottom:"4px" }}>Payment Stage</label>
              <select value={isCustomStage ? "custom" : String(selectedStageIdx)} onChange={e => handleStageChange(e.target.value)} style={{ width:"100%", border:`1.5px solid ${C.border}`, borderRadius:8, padding:"8px 10px", fontSize:13, outline:"none", background:"#FAFAFA", color:"#1E293B", fontWeight:600, boxSizing:"border-box" }}>
                {DEFAULT_STAGES.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
                <option value="custom">Custom Stage</option>
              </select>
            </div>

            {/* Invoice Number Input */}
            <div>
              <label style={{ fontSize:9, fontWeight:700, color:"#64748B", letterSpacing:"0.05em", textTransform:"uppercase", display:"block", marginBottom:"4px" }}>Invoice Number <span style={{ color:"#64748B", fontWeight:400, fontSize:8 }}>(auto-generated, editable)</span></label>
              <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder={data.invoiceNo} style={{ width:"100%", border:`1.5px solid ${C.border}`, borderRadius:8, padding:"8px 10px", fontSize:13, outline:"none", background:"#FAFAFA", color:"#1E293B", fontWeight:600, boxSizing:"border-box" }} />
            </div>

            {/* Invoice Date */}
            <div>
              <label style={{ fontSize:9, fontWeight:700, color:"#64748B", letterSpacing:"0.05em", textTransform:"uppercase", display:"block", marginBottom:"4px" }}>Invoice Date</label>
              <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} style={{ width:"100%", border:`1.5px solid ${C.border}`, borderRadius:8, padding:"8px 10px", fontSize:13, outline:"none", background:"#FAFAFA", color:"#1E293B", boxSizing:"border-box" }} />
            </div>

            {/* Payment Due Date */}
            <div>
              <label style={{ fontSize:9, fontWeight:700, color:"#64748B", letterSpacing:"0.05em", textTransform:"uppercase", display:"block", marginBottom:"4px" }}>Payment Due Date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ width:"100%", border:`1.5px solid ${C.border}`, borderRadius:8, padding:"8px 10px", fontSize:13, outline:"none", background:"#FAFAFA", color:"#1E293B", boxSizing:"border-box" }} />
            </div>

            {/* Place of Supply */}
            <div>
              <label style={{ fontSize:9, fontWeight:700, color:"#64748B", letterSpacing:"0.05em", textTransform:"uppercase", display:"block", marginBottom:"4px" }}>Place of Supply</label>
              <input type="text" value={placeOfSupply} onChange={e => setPlaceOfSupply(e.target.value)} style={{ width:"100%", border:`1.5px solid ${C.border}`, borderRadius:8, padding:"8px 10px", fontSize:13, outline:"none", background:"#FAFAFA", color:"#1E293B", fontWeight:600, boxSizing:"border-box" }} />
            </div>

            {/* Payment Status */}
            <div>
              <label style={{ fontSize:9, fontWeight:700, color:"#64748B", letterSpacing:"0.05em", textTransform:"uppercase", display:"block", marginBottom:"4px" }}>Payment Status</label>
              <div style={{ display:"flex", gap:"4px" }}>
                {PAYMENT_STATUS_OPTIONS.map(status => (
                  <button key={status} onClick={() => setPaymentStatus(status)} style={{ flex:1, padding:"6px 4px", border:`1.5px solid ${paymentStatus === status ? C.navy : C.border}`, borderRadius:6, fontSize:9, fontWeight:700, cursor:"pointer", background: paymentStatus === status ? C.navy : "#FAFAFA", color: paymentStatus === status ? "#fff" : "#1E293B", transition:"all 0.15s" }}>{status}</button>
                ))}
              </div>
            </div>

            {/* UPI QR Toggle */}
            <div>
              <label style={{ fontSize:9, fontWeight:700, color:"#64748B", letterSpacing:"0.05em", textTransform:"uppercase", display:"block", marginBottom:"4px" }}>Show / Hide Payment QR Code</label>
              <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                <button onClick={() => setShowQrCode(!showQrCode)} style={{ width:48, height:26, borderRadius:13, border:"none", background: showQrCode ? "#0F1E3C" : "#CBD5E1", cursor:"pointer", position:"relative", transition:"background 0.2s" }}>
                  <span style={{ position:"absolute", top:3, left: showQrCode ? 25 : 3, width:20, height:20, borderRadius:"50%", background:"#fff", transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }} />
                </button>
                <span style={{ fontSize:11, fontWeight:600, color: showQrCode ? "#0F1E3C" : "#64748B" }}>{showQrCode ? "QR Visible" : "QR Hidden"}</span>
              </div>
            </div>
          </div>

          {/* Custom Stage Inputs */}
          {isCustomStage && (
            <div style={{ background:"#F8FAFC", border:`1px solid ${C.border}`, borderRadius:8, padding:"12px 16px", marginBottom:"12px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:C.navy, marginBottom:"8px" }}>Custom Stage Configuration</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
                <div>
                  <label style={{ fontSize:9, color:"#64748B", marginBottom:"3px", display:"block" }}>Percentage (%)</label>
                  <input type="number" min="0" max="100" value={customPercentage} onChange={e => handleCustomPercentage(e.target.value)} style={{ width:"100%", border:`1.5px solid ${C.border}`, borderRadius:6, padding:"6px 8px", fontSize:13, outline:"none", background:"#FAFAFA", boxSizing:"border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize:9, color:"#64748B", marginBottom:"3px", display:"block" }}>Amount (₹)</label>
                  <input type="number" min="0" value={customAmount} onChange={e => handleCustomAmount(e.target.value)} style={{ width:"100%", border:`1.5px solid ${C.border}`, borderRadius:6, padding:"6px 8px", fontSize:13, outline:"none", background:"#FAFAFA", boxSizing:"border-box" }} />
                </div>
              </div>
            </div>
          )}

          {/* Previously Received Amount & Status */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", marginBottom:"12px" }}>
            <div>
              <label style={{ fontSize:9, fontWeight:700, color:"#64748B", letterSpacing:"0.05em", textTransform:"uppercase", display:"block", marginBottom:"4px" }}>Amount Previously Received</label>
              <input type="number" min="0" value={previouslyReceived} onChange={e => handlePreviouslyReceived(e.target.value)} style={{ width:"100%", border:`1.5px solid ${C.border}`, borderRadius:8, padding:"8px 10px", fontSize:13, outline:"none", background:"#FAFAFA", color:"#1E293B", fontWeight:600, boxSizing:"border-box" }} />
            </div>
            <div style={{ display:"flex", alignItems:"flex-end" }}>
              <button onClick={handlePaymentStatusSet} style={{ width:"100%", padding:"8px 16px", background:C.navy, color:"#fff", border:"none", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer" }}>Update Payment Status</button>
            </div>
          </div>

          {/* Company & Bank Details Config */}
          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:"12px" }}>
            <div style={{ fontSize:10, fontWeight:700, color:C.navy, marginBottom:"8px", letterSpacing:"0.03em" }}>Company & Bank Configuration</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:"10px" }}>
              <div>
                <label style={{ fontSize:8, color:"#64748B", marginBottom:"2px", display:"block" }}>Company Name</label>
                <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="PaintShip Services" style={{ width:"100%", border:`1px solid ${C.border}`, borderRadius:6, padding:"5px 8px", fontSize:11, outline:"none", background:"#FAFAFA", boxSizing:"border-box" }} />
              </div>
              <div>
                <label style={{ fontSize:8, color:"#64748B", marginBottom:"2px", display:"block" }}>Company Address</label>
                <input type="text" value={companyAddress} onChange={e => setCompanyAddress(e.target.value)} placeholder={companyAddr} style={{ width:"100%", border:`1px solid ${C.border}`, borderRadius:6, padding:"5px 8px", fontSize:11, outline:"none", background:"#FAFAFA", boxSizing:"border-box" }} />
              </div>
              <div>
                <label style={{ fontSize:8, color:"#64748B", marginBottom:"2px", display:"block" }}>GSTIN</label>
                <input type="text" value={companyGSTIN} onChange={e => setCompanyGSTIN(e.target.value)} style={{ width:"100%", border:`1px solid ${C.border}`, borderRadius:6, padding:"5px 8px", fontSize:11, outline:"none", background:"#FAFAFA", boxSizing:"border-box" }} />
              </div>
              <div>
                <label style={{ fontSize:8, color:"#64748B", marginBottom:"2px", display:"block" }}>PAN</label>
                <input type="text" value={companyPAN} onChange={e => setCompanyPAN(e.target.value)} style={{ width:"100%", border:`1px solid ${C.border}`, borderRadius:6, padding:"5px 8px", fontSize:11, outline:"none", background:"#FAFAFA", boxSizing:"border-box" }} />
              </div>
              <div>
                <label style={{ fontSize:8, color:"#64748B", marginBottom:"2px", display:"block" }}>Bank Name</label>
                <input type="text" value={bankName} onChange={e => setBankName(e.target.value)} style={{ width:"100%", border:`1px solid ${C.border}`, borderRadius:6, padding:"5px 8px", fontSize:11, outline:"none", background:"#FAFAFA", boxSizing:"border-box" }} />
              </div>
              <div>
                <label style={{ fontSize:8, color:"#64748B", marginBottom:"2px", display:"block" }}>A/C Number</label>
                <input type="text" value={bankAccount} onChange={e => setBankAccount(e.target.value)} style={{ width:"100%", border:`1px solid ${C.border}`, borderRadius:6, padding:"5px 8px", fontSize:11, outline:"none", background:"#FAFAFA", boxSizing:"border-box" }} />
              </div>
              <div>
                <label style={{ fontSize:8, color:"#64748B", marginBottom:"2px", display:"block" }}>IFSC Code</label>
                <input type="text" value={bankIFSC} onChange={e => setBankIFSC(e.target.value)} style={{ width:"100%", border:`1px solid ${C.border}`, borderRadius:6, padding:"5px 8px", fontSize:11, outline:"none", background:"#FAFAFA", boxSizing:"border-box" }} />
              </div>
              <div>
                <label style={{ fontSize:8, color:"#64748B", marginBottom:"2px", display:"block" }}>UPI ID</label>
                <input type="text" value={upiId} onChange={e => setUpiId(e.target.value)} style={{ width:"100%", border:`1px solid ${C.border}`, borderRadius:6, padding:"5px 8px", fontSize:11, outline:"none", background:"#FAFAFA", boxSizing:"border-box" }} />
              </div>
              <div>
                <label style={{ fontSize:8, color:"#64748B", marginBottom:"2px", display:"block" }}>Authorized Signatory</label>
                <input type="text" value={authorizedSignatory} onChange={e => setAuthorizedSignatory(e.target.value)} placeholder="Name" style={{ width:"100%", border:`1px solid ${C.border}`, borderRadius:6, padding:"5px 8px", fontSize:11, outline:"none", background:"#FAFAFA", boxSizing:"border-box" }} />
              </div>
              <div style={{ display:"flex", alignItems:"flex-end" }}>
                <label style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:11, color:"#1E293B", cursor:"pointer" }}>
                  <input type="checkbox" checked={digitalStamp} onChange={e => setDigitalStamp(e.target.checked)} /> Digital Stamp Applied
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="no-print" style={{ borderTop:`1px solid ${C.border}`, padding:"14px 24px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
            <span style={{ fontSize:10, color:"#64748B" }}>Status: <b style={{ color: paymentStatus==="PAID" ? C.green : paymentStatus==="PARTIALLY PAID" ? C.orange : C.red }}>{paymentStatus}</b></span>
            <span style={{ fontSize:10, color:"#64748B" }}>Stage: <b style={{ color:C.navy }}>{currentStage.shortLabel}</b></span>
          </div>
          <div style={{ display:"flex", gap:"8px" }}>
            <button onClick={onClose} style={{ padding:"10px 18px", background:"#F0F4F8", color:C.navy, border:"none", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer" }}>Close</button>
            <button onClick={() => window.print()} style={{ padding:"10px 20px", background:C.navy, color:"#fff", border:"none", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>🖨 Print / Download PDF</button>
          </div>
        </div>
      </div>
    </div>
  );
}
