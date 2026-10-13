import type { EmployeeProfile } from '../lib/documentStudio';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Save, 
  Receipt,
  User,
  Building,
  Calendar,
  Briefcase,
  DollarSign,
  Plus,
  Minus,
  Users,
  Search,
  X,
  Trash2,
  Edit,
  Check
} from 'lucide-react';
import { Payslip, CompanySettings } from '../types';
import PayslipPreview from '../components/payslip/PayslipPreview';

interface PayslipBuilderProps {
  onBack: () => void;
  settings: CompanySettings;
  employees: EmployeeProfile[];
  onSaveEmployees: (employees: EmployeeProfile[]) => Promise<boolean>;
  onSavePayslip: (payslip: Payslip) => Promise<boolean>;
  editingPayslip?: Payslip | null;
  navigate: (path: string) => void;
}



export default function PayslipBuilder({
  onBack,
  settings,
  employees,
  onSaveEmployees,
  onSavePayslip,
  editingPayslip = null,
  navigate
}: PayslipBuilderProps) {
  
  // Form Fields State
  const [employeeName, setEmployeeName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [monthAndYear, setMonthAndYear] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [pan, setPan] = useState('');
  const [dateOfJoining, setDateOfJoining] = useState('');
  const [bankAccName, setBankAccName] = useState('');
  const [location, setLocation] = useState('');
  const [pfAccountNumber, setPfAccountNumber] = useState('');
  const [daysInMonth, setDaysInMonth] = useState<number>(0);
  const [uan, setUan] = useState('');
  const [effectiveWorkDays, setEffectiveWorkDays] = useState<number>(0);
  const [lop, setLop] = useState<number>(0);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');

  // Dynamic Employee Storage & Editing State
  const [editingProfile, setEditingProfile] = useState<EmployeeProfile | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);



  // Earnings Numbers
  const [basicSalary, setBasicSalary] = useState<number>(0);
  const [hra, setHra] = useState<number>(0);
  const [allowances, setAllowances] = useState<number>(0);
  const [bonus, setBonus] = useState<number>(0);

  // Deductions Numbers
  const [pf, setPf] = useState<number>(0);
  const [professionalTax, setProfessionalTax] = useState<number>(0);
  const [deductions, setDeductions] = useState<number>(0);

  // View Switching (for small screens)
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');

  // Load defaults or editing values
  useEffect(() => {
    if (editingPayslip) {
      setEmployeeName(editingPayslip.employeeName);
      setEmployeeId(editingPayslip.employeeId);
      setDesignation(editingPayslip.designation);
      setDepartment(editingPayslip.department);
      setMonthAndYear(editingPayslip.monthAndYear);
      setPaymentDate(editingPayslip.paymentDate || '');
      setBasicSalary(Number(editingPayslip.basicSalary || 0));
      setHra(Number(editingPayslip.hra || 0));
      setAllowances(Number(editingPayslip.allowances || 0));
      setBonus(Number(editingPayslip.bonus || 0));
      setPf(Number(editingPayslip.pf || 0));
      setProfessionalTax(Number(editingPayslip.professionalTax || 0));
      setDeductions(Number(editingPayslip.deductions || 0));
      setPan(editingPayslip.pan);
      setDateOfJoining(editingPayslip.dateOfJoining);
      setBankAccName(editingPayslip.bankAccName);
      setLocation(editingPayslip.location);
      setPfAccountNumber(editingPayslip.pfAccountNumber);
      setDaysInMonth(Number(editingPayslip.daysInMonth ?? 30));
      setUan(editingPayslip.uan);
      setEffectiveWorkDays(Number(editingPayslip.effectiveWorkDays ?? 30));
      setLop(Number(editingPayslip.lop ?? 0));
    } else {
      // Set to empty/0 to trigger grayed out placeholder mode!
      setEmployeeName('');
      setEmployeeId('');
      setDesignation('');
      setDepartment('');
      setPan('');
      setDateOfJoining('');
      setBankAccName('');
      setLocation('');
      setPfAccountNumber('');
      setDaysInMonth(0);
      setUan('');
      setEffectiveWorkDays(0);
      setLop(0);
      setBasicSalary(0);
      setHra(0);
      setAllowances(0);
      setBonus(0);
      setPf(0);
      setProfessionalTax(0);
      setDeductions(0);
      
      setMonthAndYear('');
    }
  }, [editingPayslip]);

  const effectiveBasic = basicSalary;
  const grossSalary = effectiveBasic + hra + allowances + bonus;
  const totalDeductions = pf + professionalTax + deductions;
  const netSalary = grossSalary - totalDeductions;

  const handleSave = async () => {
    if (!employeeName.trim() || !employeeId.trim() || !monthAndYear.trim()) {
      alert('Employee name, employee ID, and salary month are required.'); return;
    }
    const amounts = [basicSalary, hra, allowances, bonus, pf, professionalTax, deductions];
    if (amounts.some(value => !Number.isFinite(value) || value < 0) || totalDeductions > grossSalary) {
      alert('Enter valid non-negative salary amounts; deductions cannot exceed gross salary.'); return;
    }
    if (daysInMonth < 1 || daysInMonth > 31 || effectiveWorkDays < 0 || effectiveWorkDays > daysInMonth || lop < 0 || lop > daysInMonth) {
      alert('Check the days in month, effective work days, and loss of pay days.'); return;
    }
    const finalName = employeeName.trim();
    const finalId = employeeId.trim();
    const finalDesignation = designation.trim();
    const finalDepartment = department.trim();
    const finalMonthAndYear = monthAndYear.trim();
    const finalBasicSalary = basicSalary;
    const finalHra = hra || 0;
    const finalAllowances = allowances || 0;
    const finalBonus = bonus || 0;
    const finalPf = pf || 0;
    const finalPT = professionalTax || 0;
    const finalDeductions = deductions || 0;
    const finalPan = pan.trim();
    const finalDoj = dateOfJoining.trim();
    const finalBankAccName = bankAccName.trim();
    const finalLocation = location.trim();
    const finalPfAccountNumber = pfAccountNumber.trim();
    const finalUan = uan.trim();
    const finalDaysInMonth = daysInMonth;
    const finalEffectiveWorkDays = effectiveWorkDays;
    const finalLop = lop || 0;

    const finalGrossSalary = finalBasicSalary + finalHra + finalAllowances + finalBonus;
    const finalTotalDeductions = finalPf + finalPT + finalDeductions;
    const finalNetSalary = finalGrossSalary - finalTotalDeductions;

    const savedPayslip: Payslip = {
      id: editingPayslip ? editingPayslip.id : crypto.randomUUID(),
      employeeName: finalName,
      employeeId: finalId,
      designation: finalDesignation,
      department: finalDepartment,
      monthAndYear: finalMonthAndYear,
      basicSalary: finalBasicSalary,
      hra: finalHra,
      allowances: finalAllowances,
      bonus: finalBonus,
      pf: finalPf,
      professionalTax: finalPT,
      deductions: finalDeductions,
      grossSalary: finalGrossSalary,
      totalDeductions: finalTotalDeductions,
      netSalary: finalNetSalary,
      paymentDate,
      createdAt: editingPayslip ? editingPayslip.createdAt : new Date().toISOString(),
      pan: finalPan,
      dateOfJoining: finalDoj,
      bankAccName: finalBankAccName,
      location: finalLocation,
      pfAccountNumber: finalPfAccountNumber,
      daysInMonth: finalDaysInMonth,
      uan: finalUan,
      effectiveWorkDays: finalEffectiveWorkDays,
      lop: finalLop
    };

    if (!await onSavePayslip(savedPayslip)) return;
    navigate('/payslip/old');
  };

  // Temp object for real-time preview
  const currentPayslip: Payslip = {
    id: editingPayslip ? editingPayslip.id : 'temp_payslip_id',
    employeeName: employeeName,
    employeeId: employeeId,
    designation: designation,
    department: department,
    monthAndYear: monthAndYear,
    basicSalary: basicSalary,
    hra: hra || 0,
    allowances: allowances || 0,
    bonus: bonus || 0,
    deductions: deductions || 0,
    pf: pf || 0,
    professionalTax: professionalTax || 0,
    grossSalary: (basicSalary) + (hra || 0) + (allowances || 0) + (bonus || 0),
    totalDeductions: (pf || 0) + (professionalTax || 0) + (deductions || 0),
    netSalary: ((basicSalary) + (hra || 0) + (allowances || 0) + (bonus || 0)) - ((pf || 0) + (professionalTax || 0) + (deductions || 0)),
    paymentDate,
    createdAt: new Date().toISOString(),
    pan: pan,
    dateOfJoining: dateOfJoining,
    bankAccName: bankAccName,
    location: location,
    pfAccountNumber: pfAccountNumber,
    daysInMonth: daysInMonth,
    uan: uan,
    effectiveWorkDays: effectiveWorkDays,
    lop: lop || 0
  };

  return (
    <div className="space-y-6 animate-fade-in py-2" id="payslip-builder-workspace">
      
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              <Receipt className="h-6 w-6 text-teal-500" />
              <span>{editingPayslip ? 'Edit payslip' : 'Create payslip'}</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enter employee details and salary amounts, then preview and save.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* View Switchers for Mobile */}
          <div className="flex lg:hidden bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('form')}
              className={`px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider rounded-lg transition-colors ${activeTab === 'form' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-xs' : 'text-gray-500'}`}
            >
              Form
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider rounded-lg transition-colors ${activeTab === 'preview' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-xs' : 'text-gray-500'}`}
            >
              Preview
            </button>
          </div>

          <button
            onClick={handleSave}
            className="studio-button studio-button-primary text-sm"
          >
            <Save className="h-4 w-4" />
            <span>Save Payslip</span>
          </button>
        </div>
      </div>

      {/* Two Column Forms Grid */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${activeTab === 'form' ? 'grid' : 'hidden lg:grid'}`}>
        
        {/* COLUMN 1: EMPLOYEE DETAILS BLOCK */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 text-left h-full">
            
            <div className="flex items-center justify-between border-b border-gray-150 dark:border-slate-800 pb-3 mb-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Employee & Salary Month Meta
              </span>
              <button
                type="button"
                onClick={() => setShowEmployeeModal(true)}
                className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 dark:hover:bg-teal-900/40 border border-teal-250 dark:border-teal-900/50 text-teal-700 dark:text-teal-400 rounded-lg text-xxs font-extrabold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <Users className="h-3.5 w-3.5" />
                <span>Select Employee</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              
              {/* Field: Employee Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  <span>Employee Name</span>
                </label>
                <input
                  type="text"
                  required
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  placeholder="Employee name"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              {/* Grid block: ID & Role */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Employee ID</label>
                  <input
                    type="text"
                    required
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="LT-EMP-042"
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                    <span>Role / Designation</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="Senior Web Developer"
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Grid block: Dept & Month */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Building className="h-3.5 w-3.5 text-slate-400" />
                    <span>Department</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Web Development"
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Month & Year</label>
                  <input
                    type="text"
                    required
                    value={monthAndYear}
                    onChange={(e) => setMonthAndYear(e.target.value)}
                    placeholder="June 2026"
                    className="w-full px-3 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Field: Payment Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>Payment Date</span>
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white focus:outline-hidden"
                />
              </div>

              {/* Additional Employee Details */}
              <div className="border-t border-gray-100 dark:border-slate-800 pt-4 mt-2 space-y-4">
                <span className="text-xxs font-black text-slate-400 uppercase tracking-widest block">
                  Additional Employee Information
                </span>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xxs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">PAN Card</label>
                    <input
                      type="text"
                      value={pan}
                      onChange={(e) => setPan(e.target.value)}
                      placeholder="ACDPW1234F"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xxs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Date of Joining</label>
                    <input
                      type="text"
                      value={dateOfJoining}
                      onChange={(e) => setDateOfJoining(e.target.value)}
                      placeholder="15/06/2023"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xxs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Bank Acc/Name</label>
                    <input
                      type="text"
                      value={bankAccName}
                      onChange={(e) => setBankAccName(e.target.value)}
                      placeholder="98765432101/HDFC"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xxs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Location</label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Mumbai"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xxs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">PF Account No.</label>
                    <input
                      type="text"
                      value={pfAccountNumber}
                      onChange={(e) => setPfAccountNumber(e.target.value)}
                      placeholder="NA"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xxs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">UAN</label>
                    <input
                      type="text"
                      value={uan}
                      onChange={(e) => setUan(e.target.value)}
                      placeholder="NA"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xxs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Days in Mo.</label>
                    <input
                      type="number"
                      value={daysInMonth || ''}
                      onChange={(e) => setDaysInMonth(Number(e.target.value))}
                      placeholder="30"
                      className="w-full px-2 py-2 text-xs rounded-lg border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xxs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Eff. Days</label>
                    <input
                      type="number"
                      value={effectiveWorkDays || ''}
                      onChange={(e) => setEffectiveWorkDays(Number(e.target.value))}
                      placeholder="30"
                      className="w-full px-2 py-2 text-xs rounded-lg border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xxs font-extrabold text-gray-700 dark:text-gray-300 uppercase tracking-wider">LOP</label>
                    <input
                      type="number"
                      value={lop !== undefined ? lop : ''}
                      onChange={(e) => setLop(Number(e.target.value))}
                      placeholder="0"
                      className="w-full px-2 py-2 text-xs rounded-lg border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* COLUMN 2: SALARY BREAKDOWN & CALCULATION */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5 text-left h-full">
            
            <div className="flex items-center justify-between border-b border-gray-150 dark:border-slate-800 pb-3 mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Salary Breakdown & Breakup
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4">

              {/* DYNAMIC SALARY EARNINGS BLOCK */}
              <div className="border border-teal-500/15 bg-teal-500/5 rounded-2xl p-4 sm:p-5 mt-3 space-y-4">
                <span className="text-xxs font-black text-teal-600 dark:text-teal-400 uppercase tracking-wider flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  <span>Earnings (A)</span>
                </span>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xxs font-extrabold text-slate-500 uppercase">Basic Salary</label>
                    <input
                      type="number"
                      value={basicSalary || ''}
                      onChange={(e) => setBasicSalary(Math.max(0, Number(e.target.value)))}
                      placeholder="25000"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xxs font-extrabold text-slate-500 uppercase">HRA</label>
                    <input
                      type="number"
                      value={hra || ''}
                      onChange={(e) => setHra(Math.max(0, Number(e.target.value)))}
                      placeholder="0"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xxs font-extrabold text-slate-500 uppercase">Allowances</label>
                    <input
                      type="number"
                      value={allowances || ''}
                      onChange={(e) => setAllowances(Math.max(0, Number(e.target.value)))}
                      placeholder="0"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xxs font-extrabold text-slate-500 uppercase">Bonus / Incentives</label>
                    <input
                      type="number"
                      value={bonus || ''}
                      onChange={(e) => setBonus(Math.max(0, Number(e.target.value)))}
                      placeholder="0"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* DYNAMIC SALARY DEDUCTIONS BLOCK */}
              <div className="border border-rose-500/15 bg-rose-500/5 rounded-2xl p-4 sm:p-5 space-y-4">
                <span className="text-xxs font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1">
                  <Minus className="h-3.5 w-3.5" />
                  <span>Deductions (B)</span>
                </span>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xxs font-extrabold text-slate-500 uppercase">Provident Fund</label>
                    <input
                      type="number"
                      value={pf || ''}
                      onChange={(e) => setPf(Math.max(0, Number(e.target.value)))}
                      placeholder="0"
                      className="w-full px-2 py-2 text-xs rounded-lg border border-gray-200 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xxs font-extrabold text-slate-500 uppercase">Prof Tax</label>
                    <input
                      type="number"
                      value={professionalTax || ''}
                      onChange={(e) => setProfessionalTax(Math.max(0, Number(e.target.value)))}
                      placeholder="0"
                      className="w-full px-2 py-2 text-xs rounded-lg border border-gray-200 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xxs font-extrabold text-slate-500 uppercase">Other Deducts</label>
                    <input
                      type="number"
                      value={deductions || ''}
                      onChange={(e) => setDeductions(Math.max(0, Number(e.target.value)))}
                      placeholder="0"
                      className="w-full px-2 py-2 text-xs rounded-lg border border-gray-200 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Live Calculator Feedback Board */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl text-xs space-y-2.5 border border-gray-150 dark:border-slate-800">
                <div className="flex justify-between font-bold text-slate-600">
                  <span>Gross Salary (A):</span>
                  <span className="text-slate-950 font-extrabold">₹ {grossSalary.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-600">
                  <span>Total Deductions (B):</span>
                  <span className="text-rose-600 font-extrabold">₹ {totalDeductions.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-extrabold text-gray-900 dark:text-white pt-2 border-t border-dashed border-gray-200 dark:border-slate-850 text-sm">
                  <span>NET SALARY PAYABLE:</span>
                  <span className="text-teal-600 dark:text-teal-400 font-black">₹ {netSalary.toLocaleString('en-IN')}</span>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* REAL-TIME PREVIEW WORKSPACE BELOW THE FORMS */}
      <div className={`w-full overflow-x-auto p-4 sm:p-6 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-gray-150 dark:border-slate-850/80 ${activeTab === 'preview' ? 'flex' : 'hidden lg:flex'} justify-center mt-6`}>
        <div className="min-w-[800px] lg:min-w-0 w-full flex justify-center">
          <PayslipPreview 
            payslip={currentPayslip}
            settings={settings}
            showActions={false}
          />
        </div>
      </div>

      {/* Select Employee Modal */}
      {showEmployeeModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fade-in" style={{ margin: 0 }}>
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20">
              <div className="flex items-center space-x-2.5">
                <div className="h-9 w-9 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white leading-tight">
                    {editingProfile ? 'Edit Employee Profile' : 'Select Employee Profile'}
                  </h3>
                  <p className="text-xxs text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold mt-0.5">
                    {editingProfile ? 'Configure reusable details' : 'Pre-fill details or manage database instantly'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingProfile(null);
                  setShowEmployeeModal(false);
                }}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body / Switch between Grid and Editor Form */}
            {editingProfile ? (
              <div className="p-6 space-y-5 overflow-y-auto flex-1 text-left">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Full Name</label>
                    <input
                      type="text"
                      value={editingProfile.employeeName}
                      onChange={(e) => setEditingProfile({ ...editingProfile, employeeName: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white"
                      placeholder="e.g. Employee name"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Employee ID</label>
                    <input
                      type="text"
                      value={editingProfile.employeeId}
                      onChange={(e) => setEditingProfile({ ...editingProfile, employeeId: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white font-mono"
                      placeholder="e.g. LT-EMP-001"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Designation / Role</label>
                    <input
                      type="text"
                      value={editingProfile.designation}
                      onChange={(e) => setEditingProfile({ ...editingProfile, designation: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white"
                      placeholder="e.g. Manager"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Department</label>
                    <input
                      type="text"
                      value={editingProfile.department}
                      onChange={(e) => setEditingProfile({ ...editingProfile, department: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white"
                      placeholder="e.g. Management"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">PAN ID</label>
                    <input
                      type="text"
                      value={editingProfile.pan}
                      onChange={(e) => setEditingProfile({ ...editingProfile, pan: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white font-mono"
                      placeholder="e.g. AMSPW3332S"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Location</label>
                    <input
                      type="text"
                      value={editingProfile.location}
                      onChange={(e) => setEditingProfile({ ...editingProfile, location: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white"
                      placeholder="e.g. Mumbai"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Date of Joining</label>
                    <input
                      type="text"
                      value={editingProfile.dateOfJoining}
                      onChange={(e) => setEditingProfile({ ...editingProfile, dateOfJoining: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white font-mono"
                      placeholder="e.g. 01/01/2021"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Bank Acc / Bank</label>
                    <input
                      type="text"
                      value={editingProfile.bankAccName}
                      onChange={(e) => setEditingProfile({ ...editingProfile, bankAccName: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white"
                      placeholder="e.g. 50100482931/HDFC"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">PF Account No</label>
                    <input
                      type="text"
                      value={editingProfile.pfAccountNumber}
                      onChange={(e) => setEditingProfile({ ...editingProfile, pfAccountNumber: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white font-mono"
                      placeholder="e.g. NA"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">UAN</label>
                    <input
                      type="text"
                      value={editingProfile.uan}
                      onChange={(e) => setEditingProfile({ ...editingProfile, uan: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white font-mono"
                      placeholder="e.g. NA"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Basic Salary (₹)</label>
                    <input
                      type="number"
                      value={editingProfile.basicSalary || ''}
                      onChange={(e) => setEditingProfile({ ...editingProfile, basicSalary: Math.max(0, Number(e.target.value)) })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white font-mono"
                      placeholder="e.g. 80000"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">HRA (₹)</label>
                    <input
                      type="number"
                      value={editingProfile.hra || ''}
                      onChange={(e) => setEditingProfile({ ...editingProfile, hra: Math.max(0, Number(e.target.value)) })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white font-mono"
                      placeholder="e.g. 32000"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Allowances (₹)</label>
                    <input
                      type="number"
                      value={editingProfile.allowances || ''}
                      onChange={(e) => setEditingProfile({ ...editingProfile, allowances: Math.max(0, Number(e.target.value)) })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white font-mono"
                      placeholder="e.g. 15000"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Provident Fund (₹)</label>
                    <input
                      type="number"
                      value={editingProfile.pf || ''}
                      onChange={(e) => setEditingProfile({ ...editingProfile, pf: Math.max(0, Number(e.target.value)) })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white font-mono"
                      placeholder="e.g. 1800"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Professional Tax (₹)</label>
                    <input
                      type="number"
                      value={editingProfile.professionalTax || ''}
                      onChange={(e) => setEditingProfile({ ...editingProfile, professionalTax: Math.max(0, Number(e.target.value)) })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white font-mono"
                      placeholder="e.g. 200"
                    />
                  </div>
                </div>

              </div>
            ) : (
              <div className="p-6 space-y-6 overflow-y-auto flex-1 text-left">
                {/* Search Bar and Custom Control Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by name, role, department or location..."
                      value={employeeSearch}
                      onChange={(e) => setEmployeeSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-gray-250 dark:border-slate-700 bg-transparent text-gray-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProfile({
                          employeeName: '',
                          employeeId: '',
                          designation: '',
                          department: '',
                          pan: '',
                          dateOfJoining: '',
                          bankAccName: '',
                          location: '',
                          pfAccountNumber: '',
                          uan: '',
                          daysInMonth: 30,
                          effectiveWorkDays: 30,
                          lop: 0,
                          basicSalary: 0,
                          hra: 0,
                          allowances: 0,
                          pf: 0,
                          professionalTax: 0
                        });
                      }}
                      className="px-3 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xxs font-extrabold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all shrink-0 shadow-sm"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>New Profile</span>
                    </button>
                  </div>
                </div>

                {/* Profile Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {employees.filter(emp => {
                    const query = employeeSearch.toLowerCase();
                    return emp.employeeName.toLowerCase().includes(query) ||
                           emp.designation.toLowerCase().includes(query) ||
                           emp.department.toLowerCase().includes(query) ||
                           emp.location.toLowerCase().includes(query) ||
                           emp.employeeId.toLowerCase().includes(query);
                  }).map((emp, idx) => (
                    <div
                      key={idx}
                      className="group border border-gray-200 dark:border-slate-800 hover:border-teal-500/80 dark:hover:border-teal-500/80 rounded-xl p-4 bg-white dark:bg-slate-900 hover:shadow-md transition-all text-left flex flex-col justify-between"
                    >
                      {/* Clickable Select Area */}
                      <div
                        onClick={() => {
                          setEmployeeName(emp.employeeName);
                          setEmployeeId(emp.employeeId);
                          setDesignation(emp.designation);
                          setDepartment(emp.department);
                          setPan(emp.pan);
                          setDateOfJoining(emp.dateOfJoining);
                          setBankAccName(emp.bankAccName);
                          setLocation(emp.location);
                          setPfAccountNumber(emp.pfAccountNumber);
                          setUan(emp.uan);
                          setDaysInMonth(emp.daysInMonth);
                          setEffectiveWorkDays(emp.effectiveWorkDays);
                          setLop(emp.lop);
                          setBasicSalary(emp.basicSalary);
                          setHra(emp.hra);
                          setAllowances(emp.allowances);
                          setPf(emp.pf);
                          setProfessionalTax(emp.professionalTax);
                          setShowEmployeeModal(false);
                        }}
                        className="space-y-2.5 w-full cursor-pointer flex-1"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="text-sm font-black text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                              {emp.employeeName}
                            </h4>
                            <div className="flex items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                              <Briefcase className="h-3 w-3 mr-1 text-slate-400" />
                              {emp.designation} • {emp.department}
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-black text-slate-400 bg-slate-50 dark:bg-slate-950 px-2 py-0.5 rounded border border-slate-100 dark:border-slate-800/50">
                            {emp.employeeId}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-50 dark:border-slate-800/30 pt-2">
                          <div>
                            <span className="font-bold text-slate-400">PAN:</span> {emp.pan}
                          </div>
                          <div>
                            <span className="font-bold text-slate-400">Location:</span> {emp.location}
                          </div>
                          <div>
                            <span className="font-bold text-slate-400">Salary:</span> ₹{(emp.basicSalary + emp.hra + emp.allowances).toLocaleString('en-IN')}/mo
                          </div>
                          <div>
                            <span className="font-bold text-slate-400">Joined:</span> {emp.dateOfJoining}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons (Edit & Delete) */}
                      <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-slate-50 dark:border-slate-800/40 min-h-[32px]">
                        {confirmDeleteId === emp.employeeId ? (
                          <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 p-1 px-2 rounded-lg animate-fade-in">
                            <span className="text-[9px] font-black uppercase text-rose-700 dark:text-rose-400">Are you sure?</span>
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                const updated = employees.filter(item => item.employeeId !== emp.employeeId);
                                if (!await onSaveEmployees(updated)) return;
                                setConfirmDeleteId(null);
                              }}
                              className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[9px] uppercase rounded-md cursor-pointer transition-colors"
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(null);
                              }}
                              className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold text-[9px] uppercase rounded-md cursor-pointer transition-colors"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingProfile(emp);
                              }}
                              className="p-1 px-2.5 bg-slate-50 hover:bg-teal-50 dark:bg-slate-950 dark:hover:bg-teal-950/30 border border-slate-150 dark:border-slate-800 text-slate-500 hover:text-teal-600 dark:text-slate-400 dark:hover:text-teal-400 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Edit className="h-3 w-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(emp.employeeId);
                              }}
                              className="p-1 px-2.5 bg-slate-50 hover:bg-rose-50 dark:bg-slate-950 dark:hover:bg-rose-950/30 border border-slate-150 dark:border-slate-800 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Delete</span>
                            </button>
                          </>
                        )}
                      </div>

                    </div>
                  ))}
                  
                  {employees.filter(emp => {
                    const query = employeeSearch.toLowerCase();
                    return emp.employeeName.toLowerCase().includes(query) ||
                           emp.designation.toLowerCase().includes(query) ||
                           emp.department.toLowerCase().includes(query) ||
                           emp.location.toLowerCase().includes(query) ||
                           emp.employeeId.toLowerCase().includes(query);
                  }).length === 0 && (
                    <div className="col-span-1 md:col-span-2 py-8 text-center text-xs text-slate-400 font-bold uppercase tracking-wider">
                      No matching employee profiles found.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/20 text-right flex items-center justify-end gap-2.5">
              {editingProfile ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProfile(null);
                    }}
                    className="px-4 py-2 border border-gray-250 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!editingProfile.employeeName) {
                        alert("Employee Name is required!");
                        return;
                      }
                      if (!editingProfile.employeeId) {
                        alert("Employee ID is required!");
                        return;
                      }

                      // Check if we are updating an existing employee (by searching matching array ID or matching employeeId)
                      const exists = employees.some(emp => emp.employeeId.toLowerCase().trim() === editingProfile.employeeId.toLowerCase().trim());
                      
                      let updatedList: EmployeeProfile[];
                      if (exists) {
                        updatedList = employees.map(emp => 
                          emp.employeeId.toLowerCase().trim() === editingProfile.employeeId.toLowerCase().trim() ? editingProfile : emp
                        );
                      } else {
                        updatedList = [editingProfile, ...employees];
                      }

                      if (!await onSaveEmployees(updatedList)) return;
                      setEditingProfile(null);
                    }}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Check className="h-4 w-4" />
                    <span>Save Profile</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditingProfile(null);
                    setShowEmployeeModal(false);
                  }}
                  className="px-4 py-2 border border-gray-250 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
