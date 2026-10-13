import React, { useState } from 'react';
import { 
  Building2, 
  User, 
  CreditCard, 
  FileText, 
  Save, 
  CheckCircle,
  FileImage,
  Award,
  Shield,
  Palette,
  Plus,
  Trash2
} from 'lucide-react';
import { CertificatePartnerProfile, CompanySettings, Letter, LetterType } from '../types';
import { compressUploadedImage } from '../utils/imageCompression';

interface SettingsProps {
  settings: CompanySettings;
  onSaveSettings: (settings: CompanySettings) => Promise<void>;
}

export default function Settings({ settings, onSaveSettings }: SettingsProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<'user' | 'invoice' | 'certificate' | 'letter'>('user');

  // 1. Company Contact State
  const [email, setEmail] = useState(settings.email);
  const [phone, setPhone] = useState(settings.phone);

  // 2. Invoice Settings State
  const [name, setName] = useState(settings.name);
  const [tagline, setTagline] = useState(settings.tagline);
  const [address, setAddress] = useState(settings.address);
  const [website, setWebsite] = useState(settings.website);
  const [gstNumber, setGstNumber] = useState(settings.gstNumber);
  const [panNumber, setPanNumber] = useState(settings.panNumber || '');
  
  // Bank Account State
  const [bankName, setBankName] = useState(settings.bankName);
  const [accountHolder, setAccountHolder] = useState(settings.accountHolder);
  const [accountNumber, setAccountNumber] = useState(settings.accountNumber);
  const [ifscCode, setIfscCode] = useState(settings.ifscCode);
  const [upiId, setUpiId] = useState(settings.upiId || '');

  // Default Tax state
  const [defaultGstPercent, setDefaultGstPercent] = useState(settings.defaultGstPercent);
  
  // Terms & Conditions list (CompanySettings.defaultTerms is string[])
  const [defaultTermsText, setDefaultTermsText] = useState(() => {
    return (settings.defaultTerms || []).join('\n');
  });

  // 3. Certificate Settings State
  const [certTemplate, setCertTemplate] = useState<'royal' | 'emerald' | 'academic' | 'modern-blue'>(settings.certTemplate || 'royal');
  const [directorName, setDirectorName] = useState(settings.directorName);
  const [directorDesignation, setDirectorDesignation] = useState(settings.directorDesignation);
  const [defaultCertText, setDefaultCertText] = useState(settings.defaultCertText || 'The participant has demonstrated dedication, active participation and successfully completed all the hands-on sessions.');
  const [certificatePartners, setCertificatePartners] = useState<CertificatePartnerProfile[]>(settings.certificatePartners || []);

  // Asset image files (base64 string conversions)
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl);
  const [signatureUrl, setSignatureUrl] = useState(settings.signatureUrl);
  const [stampUrl, setStampUrl] = useState(settings.stampUrl);

  const [servicePresetsText, setServicePresetsText] = useState(() => (settings.invoiceServicePresets || []).map(preset => `${preset.name} | ${preset.desc}`).join('\n'));
  const [letterDefaults, setLetterDefaults] = useState(settings.letterDefaults || {});
  const [letterDefaultType, setLetterDefaultType] = useState<LetterType>('Job Offer');
  const [savedBanner, setSavedBanner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Read uploaded images and convert to Base64
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'signature' | 'stamp') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Image file is too large! Please upload a file smaller than 2MB.');
      return;
    }

    try {
      const result = await compressUploadedImage(file);
      if (type === 'logo') setLogoUrl(result);
      if (type === 'signature') setSignatureUrl(result);
      if (type === 'stamp') setStampUrl(result);
    } catch (error) {
      console.error('Failed to compress uploaded image', error);
      alert('Could not read that image. Please try another file.');
    }
  };

  const handlePartnerLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, partnerId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Image file is too large! Please upload a file smaller than 2MB.');
      return;
    }
    try {
      const result = await compressUploadedImage(file);
      setCertificatePartners((partners) => partners.map((partner) => (
        partner.id === partnerId ? { ...partner, logoUrl: result } : partner
      )));
    } catch (error) {
      console.error('Failed to compress partner logo', error);
      alert('Could not read that image. Please try another file.');
    }
  };

  const updateCertificatePartner = (id: string, patch: Partial<CertificatePartnerProfile>) => {
    setCertificatePartners((partners) => partners.map((partner) => (
      partner.id === id ? { ...partner, ...patch } : partner
    )));
  };

  const addCertificatePartner = () => {
    setCertificatePartners((partners) => [
      ...partners,
      { id: `partner_${Date.now()}`, name: 'New Institute Partner', tagline: '' }
    ]);
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setSavedBanner(false);
    setSaveError('');

    const termsArray = defaultTermsText
      .split('\n')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const updated: CompanySettings = {
      ...settings,
      name: name.trim(),
      tagline: tagline.trim(),
      address: address.trim(),
      phone: phone.trim(),
      email: email.trim(),
      website: website.trim(),
      gstNumber: gstNumber.trim(),
      panNumber: panNumber.trim(),
      logoUrl,
      signatureUrl,
      stampUrl,
      directorName: directorName.trim(),
      directorDesignation: directorDesignation.trim(),
      bankName: bankName.trim(),
      accountHolder: accountHolder.trim(),
      accountNumber: accountNumber.trim(),
      ifscCode: ifscCode.trim(),
      upiId: upiId.trim(),
      qrCodeUrl: settings.qrCodeUrl || '',
      defaultGstPercent,
      defaultTerms: termsArray,
      certTemplate: certTemplate,
      defaultCertText: defaultCertText.trim(),
      certificatePartners,
      letterDefaults,
      invoiceServicePresets: servicePresetsText.split('\n').map(line => { const [name, ...description] = line.split('|'); return { name: name.trim(), desc: description.join('|').trim() }; }).filter(preset => preset.name),
    };

    try {
      await onSaveSettings(updated);
      setSavedBanner(true);
      setTimeout(() => setSavedBanner(false), 3000);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save shared settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in py-4 max-w-4xl mx-auto animate-fade-in" id="settings-page-wrapper">
      
      {/* Header title */}
      <div className="pb-4 border-b border-gray-100 dark:border-slate-850 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <span className="text-xxs font-bold text-amber-600 uppercase tracking-widest block">Document Studio</span>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">Document settings</h1>
        </div>
        
        {savedBanner && (
          <div className="flex items-center space-x-1.5 text-xs text-emerald-600 font-bold bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/10 self-end sm:self-auto">
            <CheckCircle className="h-4 w-4" />
            <span>Settings saved for all devices.</span>
          </div>
        )}
      </div>

      {saving && <p role="status" className="text-sm text-slate-500 dark:text-slate-400">Saving settings…</p>}
      {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
      <p className="text-xs text-slate-500 dark:text-slate-400">After uploading branding images, save settings to use them on every device.</p>

      {/* Tabs Navigation */}
      <div className="flex border-b border-gray-200 dark:border-slate-800 gap-1 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('user')}
          className={`flex items-center space-x-2 px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'user'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <User className="h-4 w-4" />
          <span>Company Contact Details</span>
        </button>
        <button
          onClick={() => setActiveTab('invoice')}
          className={`flex items-center space-x-2 px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'invoice'
              ? 'border-[#0F766E] text-[#0F766E] dark:text-[#14b8a6]'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <CreditCard className="h-4 w-4" />
          <span>Invoice & Bank Settings</span>
        </button>
        <button
          onClick={() => setActiveTab('certificate')}
          className={`flex items-center space-x-2 px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'certificate'
              ? 'border-[#6D1F2A] text-[#6D1F2A] dark:text-[#f43f5e]'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Award className="h-4 w-4" />
          <span>Certificate Settings</span>
        </button>
      <button type="button" onClick={() => setActiveTab('letter')} className="min-h-11 px-5 text-xs font-bold">Letter Defaults</button>
      </div>

      <div className="space-y-6">
        
        {/* TAB 1: COMPANY CONTACT DETAILS */}
        {activeTab === 'user' && (
          <div className="space-y-6 animate-fade-in" id="user-settings-tab">
            {/* User Profile Details */}
            <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8 space-y-6 shadow-xs">
              <div className="flex items-center space-x-2 text-amber-600 border-b border-gray-50 dark:border-slate-850 pb-3">
                <User className="h-5 w-5" />
                <h3 className="font-extrabold text-gray-900 dark:text-white text-sm uppercase tracking-wider">Company Contact Details</h3>
              </div>

              <form onSubmit={handleSaveAll} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xxs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1.5">Primary Contact Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="info@lihatech.com"
                      className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-3 py-2 text-xs text-gray-900 dark:text-white outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xxs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1.5">Registered Contact Phone</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 88888 77777"
                      className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-3 py-2 text-xs text-gray-900 dark:text-white outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-3">
                  <button
                    type="submit" disabled={saving}
                    className="flex items-center space-x-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md cursor-pointer transition-all"
                  >
                    <Save className="h-4 w-4" />
                    <span>Save Contact Details</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TAB 2: INVOICE & BANK SETTINGS */}
        {activeTab === 'invoice' && (
          <form onSubmit={handleSaveAll} className="space-y-6 animate-fade-in" id="invoice-settings-tab">
            {/* Company Billing Details */}
            <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8 space-y-6 shadow-xs">
              <div className="flex items-center space-x-2 text-teal-600 border-b border-gray-50 dark:border-slate-850 pb-3">
                <Building2 className="h-5 w-5" />
                <h3 className="font-extrabold text-gray-900 dark:text-white text-sm uppercase tracking-wider">Registered Corporate Identity</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xxs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1.5">Registered Firm Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. LihaTech Solutions Pvt. Ltd."
                    className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-3 py-2 text-xs text-gray-900 dark:text-white font-semibold outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xxs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1.5">Company Tagline / Subtitle</label>
                  <input
                    type="text"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="e.g. SKILLS TO EXPERTISE"
                    className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-3 py-2 text-xs text-gray-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xxs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1.5">HQ Corporate Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Address, Building, Area, City"
                    className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-3 py-2 text-xs text-gray-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xxs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1.5">Website Domain</label>
                  <input
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="www.lihatech.com"
                    className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-3 py-2 text-xs text-gray-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xxs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1.5">GSTIN Registration</label>
                  <input
                    type="text"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value)}
                    placeholder="e.g. 27AAACL8890C1Z4"
                    className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-3 py-2 text-xs text-gray-900 dark:text-white outline-none uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xxs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1.5">PAN Number</label>
                  <input
                    type="text"
                    value={panNumber}
                    onChange={(e) => setPanNumber(e.target.value)}
                    placeholder="e.g. AAACL8890C"
                    className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-3 py-2 text-xs text-gray-900 dark:text-white outline-none uppercase font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Corporate Bank Account Details */}
            <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8 space-y-6 shadow-xs">
              <div className="flex items-center space-x-2 text-teal-600 border-b border-gray-50 dark:border-slate-850 pb-3">
                <CreditCard className="h-5 w-5" />
                <h3 className="font-extrabold text-gray-900 dark:text-white text-sm uppercase tracking-wider">Corporate Bank Account Details</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xxs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1.5">Bank Name</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. HDFC Bank Ltd"
                    className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-3 py-2 text-xs text-gray-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xxs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1.5">Account Beneficiary Name</label>
                  <input
                    type="text"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    placeholder="LihaTech Solutions Private Limited"
                    className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-3 py-2 text-xs text-gray-900 dark:text-white font-semibold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xxs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1.5">Account Number</label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="50200067891234"
                    className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-3 py-2 text-xs text-gray-900 dark:text-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xxs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1.5">IFSC Routing Code</label>
                  <input
                    type="text"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value)}
                    placeholder="HDFC0001245"
                    className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-3 py-2 text-xs text-gray-900 dark:text-white font-mono uppercase outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xxs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1.5">UPI ID (VPA)</label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="lihatech@hdfcbank"
                    className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-3 py-2 text-xs text-gray-900 dark:text-white outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Default Billing Preferences */}
            <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8 space-y-6 shadow-xs">
              <div className="flex items-center space-x-2 text-teal-600 border-b border-gray-50 dark:border-slate-850 pb-3">
                <FileText className="h-5 w-5" />
                <h3 className="font-extrabold text-gray-900 dark:text-white text-sm uppercase tracking-wider">Default Billing Preferences</h3>
              </div>

              <div>
                <label className="block text-xxs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1.5">Standard GST Tax Rate (%)</label>
                <input
                  type="number"
                  value={defaultGstPercent}
                  onChange={(e) => setDefaultGstPercent(parseFloat(e.target.value) || 0)}
                  placeholder="18"
                  className="block w-full max-w-xs rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-3 py-2 text-xs text-gray-900 dark:text-white outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block text-xxs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1.5">Default Invoice Terms & Conditions (One per line)</label>
                <textarea
                  rows={5}
                  value={defaultTermsText}
                  onChange={(e) => setDefaultTermsText(e.target.value)}
                  placeholder="1. All checks payable to LihaTech Solutions Pvt. Ltd...&#10;2. GST 18% applied..."
                  className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-3 py-2 text-xs text-gray-900 dark:text-white outline-none resize-none font-mono leading-relaxed"
                />
              </div>
            </div>

            <label className="block text-xs font-bold">Reusable service suggestions (one per line: name | description)
              <textarea rows={6} value={servicePresetsText} onChange={event => setServicePresetsText(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 bg-transparent p-3 text-sm" />
            </label>
            {/* Save Button for Invoice settings */}
            <div className="flex justify-end pt-4">
              <button
                type="submit" disabled={saving}
                className="flex items-center space-x-2 px-8 py-4 bg-[#0F766E] hover:bg-[#0D655E] text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg cursor-pointer transition-all hover:translate-y-[-1px]"
              >
                <Save className="h-4.5 w-4.5" />
                <span>Save Invoice Settings</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: CERTIFICATE SETTINGS */}
        {activeTab === 'certificate' && (
          <form onSubmit={handleSaveAll} className="space-y-6 animate-fade-in" id="certificate-settings-tab">
            
            {/* Certificate Style Presets */}
            <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8 space-y-6 shadow-xs">
              <div className="flex items-center space-x-2 text-rose-700 dark:text-rose-500 border-b border-gray-50 dark:border-slate-850 pb-3">
                <Palette className="h-5 w-5" />
                <h3 className="font-extrabold text-gray-900 dark:text-white text-sm uppercase tracking-wider">Aesthetic Theme Presets</h3>
              </div>

              <div>
                <label className="block text-xxs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-3">Select Default Design Template Preset</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { id: 'royal', name: 'Royal Gold', desc: 'Premium luxury border & crest', color: 'border-amber-400 bg-amber-50/10' },
                    { id: 'emerald', name: 'Emerald Green', desc: 'Clean green and bronze design', color: 'border-emerald-500 bg-emerald-50/10' },
                    { id: 'academic', name: 'Minimal Teal', desc: 'Clean contemporary certificate design', color: 'border-teal-700 bg-teal-50/10' },
                    { id: 'modern-blue', name: 'Cyber Modern', desc: 'Sleek abstract corporate layout', color: 'border-cyan-500 bg-cyan-50/10' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setCertTemplate(t.id as any)}
                      className={`flex flex-col items-start text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        certTemplate === t.id
                          ? `${t.color} border-current shadow-md scale-[1.02]`
                          : 'border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <span className="font-extrabold text-xs text-gray-900 dark:text-white block uppercase mb-1">{t.name}</span>
                      <span className="text-gray-400 dark:text-slate-400 text-[10px] leading-snug">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Partner Institute Profiles */}
            <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8 space-y-6 shadow-xs">
              <div className="flex items-center justify-between gap-3 border-b border-gray-50 dark:border-slate-850 pb-3">
                <div className="flex items-center space-x-2 text-[#078EDB] dark:text-[#45D8F5]">
                  <Building2 className="h-5 w-5" />
                  <div>
                    <h3 className="font-extrabold text-gray-900 dark:text-white text-sm uppercase tracking-wider">Partner Institute Profiles</h3>
                    <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-1 normal-case tracking-normal">Save institute logos once, then reuse them for single or bulk certificates.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addCertificatePartner}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#078EDB] hover:bg-[#062B4B] text-white text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Partner
                </button>
              </div>

              {certificatePartners.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 dark:border-slate-800 p-5 text-center text-xs text-gray-500">
                  No partner profiles yet. Add one when an institute needs its logo on a certificate.
                </div>
              ) : (
                <div className="space-y-4">
                  {certificatePartners.map((partner) => (
                    <div key={partner.id} className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-4 items-center rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 p-4">
                      <div className="h-20 w-28 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 flex items-center justify-center overflow-hidden">
                        {partner.logoUrl ? (
                          <img src={partner.logoUrl} alt={`${partner.name} logo`} className="max-h-16 max-w-[104px] object-contain" />
                        ) : (
                          <FileImage className="h-6 w-6 text-gray-400 dark:text-slate-400" />
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          value={partner.name}
                          onChange={(e) => updateCertificatePartner(partner.id, { name: e.target.value })}
                          placeholder="Institute name"
                          className="rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-gray-900 dark:text-white outline-none"
                        />
                        <input
                          value={partner.tagline || ''}
                          onChange={(e) => updateCertificatePartner(partner.id, { tagline: e.target.value })}
                          placeholder="Department or tagline (optional)"
                          className="rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-gray-900 dark:text-white outline-none"
                        />
                        <input
                          value={partner.website || ''}
                          onChange={(e) => updateCertificatePartner(partner.id, { website: e.target.value })}
                          placeholder="Website (optional)"
                          className="rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-gray-900 dark:text-white outline-none sm:col-span-2"
                        />
                      </div>
                      <div className="flex md:flex-col gap-2">
                        <label className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#078EDB] hover:bg-[#062B4B] text-white text-[10px] font-bold cursor-pointer transition-colors">
                          <FileImage className="h-3.5 w-3.5" />
                          Logo
                          <input type="file" accept="image/*" onChange={(e) => handlePartnerLogoUpload(e, partner.id)} className="hidden" />
                        </label>
                        <button
                          type="button"
                          onClick={() => setCertificatePartners((partners) => partners.filter((item) => item.id !== partner.id))}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-[10px] font-bold cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Certificate Signatory Details */}
            <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8 space-y-6 shadow-xs">
              <div className="flex items-center space-x-2 text-rose-700 dark:text-rose-500 border-b border-gray-50 dark:border-slate-850 pb-3">
                <User className="h-5 w-5" />
                <h3 className="font-extrabold text-gray-900 dark:text-white text-sm uppercase tracking-wider">Signatory & Issuer Details</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xxs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1.5">Authorized Signatory Name</label>
                  <input
                    type="text"
                    value={directorName}
                    onChange={(e) => setDirectorName(e.target.value)}
                    placeholder="e.g. Director|Business Operations"
                    className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-3 py-2 text-xs text-gray-900 dark:text-white font-semibold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xxs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1.5">Signatory Designation</label>
                  <input
                    type="text"
                    value={directorDesignation}
                    onChange={(e) => setDirectorDesignation(e.target.value)}
                    placeholder="e.g. Director, LihaTech"
                    className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-3 py-2 text-xs text-gray-900 dark:text-white outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Certificate Custom Body Content for Editing Later */}
            <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8 space-y-6 shadow-xs">
              <div className="flex items-center space-x-2 text-rose-700 dark:text-rose-500 border-b border-gray-50 dark:border-slate-850 pb-3">
                <FileText className="h-5 w-5" />
                <h3 className="font-extrabold text-gray-900 dark:text-white text-sm uppercase tracking-wider">Default Certificate Body Text</h3>
              </div>

              <div>
                <label className="block text-xxs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1.5">Customize default bottom paragraph content</label>
                <textarea
                  rows={3}
                  value={defaultCertText}
                  onChange={(e) => setDefaultCertText(e.target.value)}
                  placeholder="The participant has demonstrated dedication, active participation and successfully completed all the hands-on sessions."
                  className="block w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-3 py-2.5 text-xs text-gray-900 dark:text-white outline-none resize-none font-semibold leading-relaxed"
                />
                <span className="text-[10px] text-gray-400 dark:text-slate-400 italic mt-1 block">This paragraph appears on the lower third of generated certificates. Editing this acts as a default preset for future designs.</span>
              </div>
            </div>

            {/* Official Assets Loader Row (Images) */}
            <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8 space-y-6 shadow-xs">
              <div className="flex items-center space-x-2 text-rose-700 dark:text-rose-500 border-b border-gray-50 dark:border-slate-850 pb-3">
                <FileImage className="h-5 w-5" />
                <h3 className="font-extrabold text-gray-900 dark:text-white text-sm uppercase tracking-wider">Official Certification Graphical Assets</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Logo */}
                <div className="space-y-2">
                  <label className="block text-xxs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">Header Brand Logo</label>
                  <div className="border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50 dark:bg-slate-950/40 text-center flex flex-col items-center justify-between h-40">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="max-h-20 max-w-full object-contain mb-2" />
                    ) : (
                      <div className="p-3 bg-gray-100 rounded-full text-gray-400 dark:text-slate-400 mb-2">
                        <FileImage className="h-6 w-6" />
                      </div>
                    )}
                    <label className="px-3 py-1.5 bg-[#B8894D] hover:bg-[#A3743C] text-white text-xxs font-bold rounded-lg cursor-pointer transition-colors shadow-xs">
                      <span>Browse Logo</span>
                      <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'logo')} className="hidden" />
                    </label>
                  </div>
                </div>

                {/* Stamp */}
                <div className="space-y-2">
                  <label className="block text-xxs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">Official Authority Stamp</label>
                  <div className="border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50 dark:bg-slate-950/40 text-center flex flex-col items-center justify-between h-40">
                    {stampUrl ? (
                      <img src={stampUrl} alt="Stamp" className="max-h-20 max-w-full object-contain mb-2" />
                    ) : (
                      <div className="p-3 bg-gray-100 rounded-full text-gray-400 dark:text-slate-400 mb-2">
                        <FileImage className="h-6 w-6" />
                      </div>
                    )}
                    <label className="px-3 py-1.5 bg-[#B8894D] hover:bg-[#A3743C] text-white text-xxs font-bold rounded-lg cursor-pointer transition-colors shadow-xs">
                      <span>Browse Stamp</span>
                      <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'stamp')} className="hidden" />
                    </label>
                  </div>
                </div>

                {/* Signature */}
                <div className="space-y-2">
                  <label className="block text-xxs font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider">Director Signature PNG</label>
                  <div className="border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50 dark:bg-slate-950/40 text-center flex flex-col items-center justify-between h-40">
                    {signatureUrl ? (
                      <img src={signatureUrl} alt="Signature" className="max-h-20 max-w-full object-contain mb-2" />
                    ) : (
                      <div className="p-3 bg-gray-100 rounded-full text-gray-400 dark:text-slate-400 mb-2">
                        <FileImage className="h-6 w-6" />
                      </div>
                    )}
                    <label className="px-3 py-1.5 bg-[#B8894D] hover:bg-[#A3743C] text-white text-xxs font-bold rounded-lg cursor-pointer transition-colors shadow-xs">
                      <span>Browse Signature</span>
                      <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'signature')} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button for Certificate settings */}
            <div className="flex justify-end pt-4">
              <button
                type="submit" disabled={saving}
                className="flex items-center space-x-2 px-8 py-4 bg-[#6D1F2A] hover:bg-[#5A1922] text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl shadow-lg cursor-pointer transition-all hover:translate-y-[-1px]"
              >
                <Save className="h-4.5 w-4.5" />
                <span>Save Certificate Settings</span>
              </button>
            </div>
          </form>
        )}

        {activeTab === 'letter' && <form onSubmit={handleSaveAll} className="space-y-5">
          <h3 className="font-bold">Shared letter defaults</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Defaults apply to new letters. Existing letters keep their saved details.</p>
          <label className="block text-sm">Letter type
            <select value={letterDefaultType} onChange={event => setLetterDefaultType(event.target.value as LetterType)} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-transparent px-3">
              {(['Internship Offer','Job Offer','Experience Certificate','Relieving Letter'] as LetterType[]).map(type => <option key={type}>{type}</option>)}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries({ designation: 'Designation', department: 'Department', location: 'Location', stipend: 'Compensation', duration: 'Duration', skillCategory: 'Skill category', reportingTo: 'Reports to', probation: 'Probation', workingDays: 'Working days', workingHours: 'Working hours', noticePeriod: 'Notice period', authorizedSignatory: 'Authorized signatory', reportingInstructions: 'Reporting instructions', conductStatement: 'Conduct statement' }).map(([field, label]) =>
              <label key={field} className="block text-sm">{label}
                <input value={String(letterDefaults[letterDefaultType]?.[field as keyof Letter] ?? '')} onChange={event => setLetterDefaults(current => ({ ...current, [letterDefaultType]: { ...current[letterDefaultType], [field]: event.target.value } }))} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-transparent px-3" />
              </label>)}
          </div>
          <button type="submit" disabled={saving} className="min-h-11 rounded-lg bg-sky-700 px-5 text-sm font-bold text-white disabled:opacity-50">Save Letter Defaults</button>
        </form>}
      </div>

    </div>
  );
}
