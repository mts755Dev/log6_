import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import {
  ArrowLeft,
  ArrowRight,
  User,
  Home,
  Zap,
  Battery,
  Calculator,
  FileText,
  Check,
  Plus,
  Trash2,
  Car,
  Sun,
  PoundSterling,
  TrendingUp,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import type { Quote, QuoteLineItem, ROIProjection, CustomerInfo, TariffInfo } from '../../types';

const steps = [
  { id: 'customer', title: 'Customer Info', icon: <User className="w-5 h-5" /> },
  { id: 'property', title: 'Property & Energy', icon: <Home className="w-5 h-5" /> },
  { id: 'tariff', title: 'Tariff Details', icon: <Zap className="w-5 h-5" /> },
  { id: 'products', title: 'Products', icon: <Battery className="w-5 h-5" /> },
  { id: 'pricing', title: 'Pricing & ROI', icon: <Calculator className="w-5 h-5" /> },
  { id: 'review', title: 'Review', icon: <FileText className="w-5 h-5" /> },
];

export function NewQuotePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { batteries, inverters, createQuote } = useData();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [customer, setCustomer] = useState<CustomerInfo>({
    name: '',
    email: '',
    phone: '',
    address: '',
    postcode: '',
    propertyType: 'house',
    existingSolar: false,
    solarCapacityKwp: 0,
    annualConsumptionKwh: 4000,
    currentTariff: '',
    hasEv: false,
    evMileagePerYear: 0,
  });

  const [tariff, setTariff] = useState<TariffInfo>({
    importRate: 0.28,
    exportRate: 0.15,
    standingCharge: 0.50,
    hasTimeOfUse: false,
    peakRate: 0.35,
    offPeakRate: 0.10,
    peakHoursStart: '16:00',
    peakHoursEnd: '19:00',
  });

  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [installationCost, setInstallationCost] = useState(1200);
  const [margin, setMargin] = useState(25);
  const [notes, setNotes] = useState('');

  // Calculated values
  const calculations = useMemo(() => {
    const productCost = lineItems.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
    const productPrice = lineItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const subtotal = productPrice + installationCost;
    const vatRate = customer.existingSolar ? 0 : 0; // 0% VAT on battery storage
    const vatAmount = subtotal * vatRate;
    const total = subtotal + vatAmount;
    const totalCost = productCost + (installationCost * 0.6); // Assume 60% of install is cost
    const profit = total - totalCost;
    const marginPercentage = total > 0 ? (profit / total) * 100 : 0;

    // ROI Calculations
    const batteryCapacity = lineItems
      .filter(item => item.type === 'battery')
      .reduce((sum, item) => {
        const battery = batteries.find(b => b.id === item.productId);
        return sum + (battery?.capacityKwh || 0) * item.quantity;
      }, 0);

    // Annual savings calculations
    let annualSavings = 0;
    let loadShiftSavings = 0;
    let exportRevenue = 0;
    let evTaxSavings = 0;

    if (batteryCapacity > 0) {
      // Load shifting savings (charging at off-peak, using at peak)
      if (tariff.hasTimeOfUse) {
        const dailyCycles = 1;
        const usableCapacity = batteryCapacity * 0.9; // 90% depth of discharge
        const rateDifference = (tariff.peakRate || 0.35) - (tariff.offPeakRate || 0.10);
        loadShiftSavings = usableCapacity * dailyCycles * 365 * rateDifference * 0.8; // 80% efficiency
      } else {
        // Standard tariff - save by using stored solar
        loadShiftSavings = batteryCapacity * 0.8 * 365 * tariff.importRate * 0.5;
      }

      // Export revenue (if solar exists)
      if (customer.existingSolar && customer.solarCapacityKwp) {
        const annualGeneration = customer.solarCapacityKwp * 900; // ~900 kWh per kWp in UK
        const batteryStoredExport = Math.min(annualGeneration * 0.4, batteryCapacity * 365);
        const selfConsumedIncrease = batteryStoredExport * 0.7;
        exportRevenue = selfConsumedIncrease * (tariff.importRate - tariff.exportRate);
      }

      // EV tax savings (charging at home vs petrol)
      if (customer.hasEv && customer.evMileagePerYear) {
        // Assume 0.3 kWh/mile for EV, 15p/mile for petrol
        const evCostPerMile = 0.3 * (tariff.hasTimeOfUse ? (tariff.offPeakRate || 0.10) : tariff.importRate);
        const petrolCostPerMile = 0.15;
        evTaxSavings = customer.evMileagePerYear * (petrolCostPerMile - evCostPerMile);
      }

      annualSavings = loadShiftSavings + exportRevenue + evTaxSavings;
    }

    const paybackYears = annualSavings > 0 ? total / annualSavings : 0;

    // Generate 10-year ROI projections
    const roiProjections: ROIProjection[] = Array.from({ length: 10 }, (_, i) => {
      const year = i + 1;
      const inflationFactor = Math.pow(1.03, year - 1); // 3% annual inflation
      return {
        year,
        savings: Math.round((loadShiftSavings + exportRevenue) * inflationFactor),
        cumulativeSavings: Math.round((loadShiftSavings + exportRevenue) * inflationFactor * year),
        evTaxSavings: Math.round(evTaxSavings * inflationFactor),
        exportRevenue: Math.round(exportRevenue * inflationFactor),
        loadShiftSavings: Math.round(loadShiftSavings * inflationFactor),
      };
    });

    return {
      productCost,
      productPrice,
      subtotal,
      vatRate,
      vatAmount,
      total,
      totalCost,
      profit,
      marginPercentage,
      annualSavings: Math.round(annualSavings),
      paybackYears: Math.round(paybackYears * 10) / 10,
      batteryCapacity,
      roiProjections,
      loadShiftSavings: Math.round(loadShiftSavings),
      exportRevenue: Math.round(exportRevenue),
      evTaxSavings: Math.round(evTaxSavings),
    };
  }, [lineItems, installationCost, batteries, tariff, customer]);

  // Add product to line items
  const addProduct = (type: 'battery' | 'inverter', productId: string) => {
    const product = type === 'battery' 
      ? batteries.find(b => b.id === productId)
      : inverters.find(i => i.id === productId);
    
    if (!product) return;

    setLineItems([...lineItems, {
      id: uuidv4(),
      type,
      productId,
      description: `${product.manufacturerName} ${product.model}`,
      quantity: 1,
      unitPrice: product.rrp,
      costPrice: product.costPrice,
    }]);
  };

  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  const updateLineItem = (id: string, updates: Partial<QuoteLineItem>) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  // Navigation
  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  // Submit quote
  const handleSubmit = async (status: 'draft' | 'sent') => {
    if (!user) return;
    setIsSubmitting(true);

    try {
      // Add installation line item if not present
      const finalLineItems = [...lineItems];
      if (!finalLineItems.some(item => item.type === 'installation')) {
        finalLineItems.push({
          id: uuidv4(),
          type: 'installation',
          description: 'Professional Installation & Commissioning',
          quantity: 1,
          unitPrice: installationCost,
          costPrice: installationCost * 0.6,
        });
      }

      const quoteData: Omit<Quote, 'id' | 'createdAt' | 'updatedAt'> = {
        companyId: user.companyId,
        installerId: user.id,
        installerName: user.name,
        reference: `QT-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
        status,
        installationType: 'residential',
        customer,
        tariff,
        lineItems: finalLineItems,
        subtotal: calculations.subtotal,
        vatRate: calculations.vatRate,
        vatAmount: calculations.vatAmount,
        total: calculations.total,
        deposit: Math.round(calculations.total * 0.25),
        margin: calculations.profit,
        marginPercentage: calculations.marginPercentage,
        roiProjections: calculations.roiProjections,
        paybackYears: calculations.paybackYears,
        annualSavings: calculations.annualSavings,
        notes,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const newQuote = createQuote(quoteData);
      navigate(`/installer/quotes/${newQuote.id}`);
    } catch (error) {
      console.error('Error creating quote:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-800 rounded-lg transition-colors shrink-0">
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        <div className="min-w-0">
          <h1 className="page-title text-lg sm:text-2xl">Create New Quote</h1>
          <p className="page-subtitle text-xs sm:text-sm">Step {currentStep + 1} of {steps.length}: {steps[currentStep].title}</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="mb-6 sm:mb-8 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex items-center justify-between min-w-max sm:min-w-0">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => index < currentStep && setCurrentStep(index)}
                className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all ${
                  index === currentStep
                    ? 'bg-primary-600 text-white'
                    : index < currentStep
                    ? 'bg-success-600/20 text-success-400 cursor-pointer hover:bg-success-600/30'
                    : 'bg-slate-800/50 text-slate-500'
                }`}
              >
                {index < currentStep ? <Check className="w-4 h-4" /> : <span className="[&>svg]:w-4 [&>svg]:h-4">{step.icon}</span>}
                <span className="hidden lg:inline text-sm font-medium">{step.title}</span>
              </button>
              {index < steps.length - 1 && (
                <div className={`w-4 sm:w-8 lg:w-16 h-0.5 mx-1 sm:mx-2 ${
                  index < currentStep ? 'bg-success-500' : 'bg-slate-700'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Form Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {/* Step 1: Customer Info */}
          {currentStep === 0 && (
            <Card>
              <h2 className="section-title flex items-center gap-2">
                <User className="w-5 h-5 text-primary-400" />
                Customer Information
              </h2>
              <div className="form-grid">
                <Input
                  label="Full Name"
                  value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  placeholder="John Smith"
                  required
                />
                <Input
                  label="Email Address"
                  type="email"
                  value={customer.email}
                  onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                  placeholder="john@example.com"
                  required
                />
                <Input
                  label="Phone Number"
                  value={customer.phone}
                  onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                  placeholder="07700 900123"
                  required
                />
                <Select
                  label="Property Type"
                  value={customer.propertyType}
                  onChange={(e) => setCustomer({ ...customer, propertyType: e.target.value as CustomerInfo['propertyType'] })}
                  options={[
                    { value: 'house', label: 'House' },
                    { value: 'flat', label: 'Flat' },
                    { value: 'bungalow', label: 'Bungalow' },
                    { value: 'commercial', label: 'Commercial' },
                  ]}
                />
                <div className="md:col-span-2">
                  <Input
                    label="Address"
                    value={customer.address}
                    onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                    placeholder="123 High Street, Bristol"
                    required
                  />
                </div>
                <Input
                  label="Postcode"
                  value={customer.postcode}
                  onChange={(e) => setCustomer({ ...customer, postcode: e.target.value })}
                  placeholder="BS1 4AB"
                  required
                />
              </div>
            </Card>
          )}

          {/* Step 2: Property & Energy */}
          {currentStep === 1 && (
            <Card>
              <h2 className="section-title flex items-center gap-2">
                <Home className="w-5 h-5 text-primary-400" />
                Property & Energy Details
              </h2>
              <div className="space-y-6">
                <div className="form-grid">
                  <Input
                    label="Annual Electricity Consumption (kWh)"
                    type="number"
                    value={customer.annualConsumptionKwh}
                    onChange={(e) => setCustomer({ ...customer, annualConsumptionKwh: Number(e.target.value) })}
                    hint="Average UK household uses 3,500-4,500 kWh"
                  />
                  <Input
                    label="Current Tariff Name"
                    value={customer.currentTariff}
                    onChange={(e) => setCustomer({ ...customer, currentTariff: e.target.value })}
                    placeholder="e.g., Octopus Go, British Gas Fixed"
                  />
                </div>

                {/* Solar Section */}
                <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customer.existingSolar}
                      onChange={(e) => setCustomer({ ...customer, existingSolar: e.target.checked })}
                      className="w-5 h-5 rounded border-slate-600 bg-slate-900 text-primary-600 focus:ring-primary-500/50"
                    />
                    <div className="flex items-center gap-2">
                      <Sun className="w-5 h-5 text-warning-400" />
                      <span className="font-medium text-white">Customer has existing solar panels</span>
                    </div>
                  </label>
                  
                  {customer.existingSolar && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4"
                    >
                      <Input
                        label="Solar System Size (kWp)"
                        type="number"
                        step="0.1"
                        value={customer.solarCapacityKwp || ''}
                        onChange={(e) => setCustomer({ ...customer, solarCapacityKwp: Number(e.target.value) })}
                        placeholder="e.g., 4.5"
                      />
                    </motion.div>
                  )}
                </div>

                {/* EV Section */}
                <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customer.hasEv}
                      onChange={(e) => setCustomer({ ...customer, hasEv: e.target.checked })}
                      className="w-5 h-5 rounded border-slate-600 bg-slate-900 text-primary-600 focus:ring-primary-500/50"
                    />
                    <div className="flex items-center gap-2">
                      <Car className="w-5 h-5 text-success-400" />
                      <span className="font-medium text-white">Customer has an electric vehicle</span>
                    </div>
                  </label>
                  
                  {customer.hasEv && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4"
                    >
                      <Input
                        label="Annual EV Mileage"
                        type="number"
                        value={customer.evMileagePerYear || ''}
                        onChange={(e) => setCustomer({ ...customer, evMileagePerYear: Number(e.target.value) })}
                        placeholder="e.g., 8000"
                        hint="Used to calculate fuel savings vs petrol"
                      />
                    </motion.div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Step 3: Tariff Details */}
          {currentStep === 2 && (
            <Card>
              <h2 className="section-title flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary-400" />
                Tariff Details
              </h2>
              <div className="space-y-6">
                <div className="form-grid">
                  <Input
                    label="Import Rate (£/kWh)"
                    type="number"
                    step="0.01"
                    value={tariff.importRate}
                    onChange={(e) => setTariff({ ...tariff, importRate: Number(e.target.value) })}
                    leftIcon={<PoundSterling className="w-4 h-4" />}
                  />
                  <Input
                    label="Export Rate (£/kWh)"
                    type="number"
                    step="0.01"
                    value={tariff.exportRate}
                    onChange={(e) => setTariff({ ...tariff, exportRate: Number(e.target.value) })}
                    leftIcon={<PoundSterling className="w-4 h-4" />}
                  />
                  <Input
                    label="Standing Charge (£/day)"
                    type="number"
                    step="0.01"
                    value={tariff.standingCharge}
                    onChange={(e) => setTariff({ ...tariff, standingCharge: Number(e.target.value) })}
                    leftIcon={<PoundSterling className="w-4 h-4" />}
                  />
                </div>

                {/* Time of Use */}
                <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tariff.hasTimeOfUse}
                      onChange={(e) => setTariff({ ...tariff, hasTimeOfUse: e.target.checked })}
                      className="w-5 h-5 rounded border-slate-600 bg-slate-900 text-primary-600 focus:ring-primary-500/50"
                    />
                    <div>
                      <span className="font-medium text-white">Time-of-Use Tariff</span>
                      <p className="text-sm text-slate-500">e.g., Octopus Go, Intelligent Octopus</p>
                    </div>
                  </label>
                  
                  {tariff.hasTimeOfUse && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4"
                    >
                      <Input
                        label="Peak Rate (£/kWh)"
                        type="number"
                        step="0.01"
                        value={tariff.peakRate || ''}
                        onChange={(e) => setTariff({ ...tariff, peakRate: Number(e.target.value) })}
                      />
                      <Input
                        label="Off-Peak Rate (£/kWh)"
                        type="number"
                        step="0.01"
                        value={tariff.offPeakRate || ''}
                        onChange={(e) => setTariff({ ...tariff, offPeakRate: Number(e.target.value) })}
                      />
                      <Input
                        label="Peak Start"
                        type="time"
                        value={tariff.peakHoursStart || ''}
                        onChange={(e) => setTariff({ ...tariff, peakHoursStart: e.target.value })}
                      />
                      <Input
                        label="Peak End"
                        type="time"
                        value={tariff.peakHoursEnd || ''}
                        onChange={(e) => setTariff({ ...tariff, peakHoursEnd: e.target.value })}
                      />
                    </motion.div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Step 4: Products */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <Card>
                <h2 className="section-title flex items-center gap-2">
                  <Battery className="w-5 h-5 text-primary-400" />
                  Select Products
                </h2>
                
                {/* Battery Selection */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-slate-300 mb-3">Batteries</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {batteries.filter(b => b.isActive).map((battery) => (
                      <button
                        key={battery.id}
                        onClick={() => addProduct('battery', battery.id)}
                        className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl hover:border-primary-500/50 hover:bg-slate-800/50 transition-all text-left group"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-white">{battery.model}</p>
                            <p className="text-sm text-slate-500">{battery.manufacturerName}</p>
                          </div>
                          <Plus className="w-5 h-5 text-slate-600 group-hover:text-primary-400 transition-colors" />
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                          <span>{battery.capacityKwh} kWh</span>
                          <span>{battery.powerKw} kW</span>
                          <span className="text-primary-400">£{battery.rrp.toLocaleString()}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Inverter Selection */}
                <div>
                  <h3 className="text-sm font-medium text-slate-300 mb-3">Inverters</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {inverters.filter(i => i.isActive).map((inverter) => (
                      <button
                        key={inverter.id}
                        onClick={() => addProduct('inverter', inverter.id)}
                        className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl hover:border-primary-500/50 hover:bg-slate-800/50 transition-all text-left group"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-white">{inverter.model}</p>
                            <p className="text-sm text-slate-500">{inverter.manufacturerName}</p>
                          </div>
                          <Plus className="w-5 h-5 text-slate-600 group-hover:text-primary-400 transition-colors" />
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                          <span>{inverter.powerKw} kW</span>
                          <span>{inverter.phases}ph</span>
                          <span className="text-primary-400">£{inverter.rrp.toLocaleString()}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Selected Products */}
              {lineItems.length > 0 && (
                <Card>
                  <h3 className="section-title">Selected Products</h3>
                  <div className="space-y-3">
                    {lineItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-4 p-3 bg-slate-800/30 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-white">{item.description}</p>
                          <p className="text-sm text-slate-500 capitalize">{item.type}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(item.id, { quantity: Number(e.target.value) })}
                            className="w-20"
                          />
                          <Input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => updateLineItem(item.id, { unitPrice: Number(e.target.value) })}
                            className="w-28"
                            leftIcon={<PoundSterling className="w-3 h-3" />}
                          />
                          <button
                            onClick={() => removeLineItem(item.id)}
                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* Step 5: Pricing & ROI */}
          {currentStep === 4 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <h2 className="section-title flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-primary-400" />
                  Pricing
                </h2>
                <div className="space-y-4">
                  <Input
                    label="Installation Cost (£)"
                    type="number"
                    value={installationCost}
                    onChange={(e) => setInstallationCost(Number(e.target.value))}
                    leftIcon={<PoundSterling className="w-4 h-4" />}
                  />

                  <div className="pt-4 border-t border-slate-700 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Products</span>
                      <span className="text-white">£{calculations.productPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Installation</span>
                      <span className="text-white">£{installationCost.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Subtotal</span>
                      <span className="text-white">£{calculations.subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">VAT (0%)</span>
                      <span className="text-white">£0</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold pt-3 border-t border-slate-700">
                      <span className="text-white">Total</span>
                      <span className="text-primary-400">£{calculations.total.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-700">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-slate-400">Your Margin</span>
                      <span className="text-success-400">
                        £{calculations.profit.toLocaleString()} ({calculations.marginPercentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <h2 className="section-title flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-success-400" />
                  ROI Projection
                </h2>
                <div className="space-y-4">
                  <div className="p-4 bg-success-500/10 border border-success-500/30 rounded-xl">
                    <p className="text-sm text-success-400 mb-1">Estimated Annual Savings</p>
                    <p className="text-3xl font-bold text-white">£{calculations.annualSavings.toLocaleString()}</p>
                  </div>

                  <div className="p-4 bg-primary-500/10 border border-primary-500/30 rounded-xl">
                    <p className="text-sm text-primary-400 mb-1">Payback Period</p>
                    <p className="text-3xl font-bold text-white">{calculations.paybackYears} years</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Load Shift Savings</span>
                      <span className="text-white">£{calculations.loadShiftSavings}/year</span>
                    </div>
                    {customer.existingSolar && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Export Revenue</span>
                        <span className="text-white">£{calculations.exportRevenue}/year</span>
                      </div>
                    )}
                    {customer.hasEv && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">EV Fuel Savings</span>
                        <span className="text-white">£{calculations.evTaxSavings}/year</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-700">
                    <p className="text-xs text-slate-500">
                      * Projections based on current energy prices with 3% annual inflation. 
                      Actual savings may vary based on usage patterns.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Step 6: Review */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <Card>
                <h2 className="section-title">Quote Summary</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Customer Details */}
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-3">Customer</h3>
                    <div className="space-y-2">
                      <p className="text-white">{customer.name}</p>
                      <p className="text-slate-400 text-sm">{customer.email}</p>
                      <p className="text-slate-400 text-sm">{customer.phone}</p>
                      <p className="text-slate-400 text-sm">{customer.address}</p>
                      <p className="text-slate-400 text-sm">{customer.postcode}</p>
                    </div>
                  </div>

                  {/* System Details */}
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-3">System</h3>
                    <div className="space-y-2">
                      <p className="text-white">{calculations.batteryCapacity} kWh Battery</p>
                      {customer.existingSolar && (
                        <p className="text-slate-400 text-sm">Existing Solar: {customer.solarCapacityKwp} kWp</p>
                      )}
                      {customer.hasEv && (
                        <p className="text-slate-400 text-sm">EV: {customer.evMileagePerYear?.toLocaleString()} miles/year</p>
                      )}
                      <p className="text-slate-400 text-sm">Consumption: {customer.annualConsumptionKwh.toLocaleString()} kWh/year</p>
                    </div>
                  </div>
                </div>

                {/* Line Items */}
                <div className="mt-6 pt-6 border-t border-slate-700">
                  <h3 className="text-sm font-medium text-slate-400 mb-3">Products & Services</h3>
                  <div className="space-y-2">
                    {lineItems.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-slate-300">{item.quantity}x {item.description}</span>
                        <span className="text-white">£{(item.unitPrice * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">Installation & Commissioning</span>
                      <span className="text-white">£{installationCost.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Totals */}
                <div className="mt-6 pt-6 border-t border-slate-700">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-2xl font-bold text-white">£{calculations.total.toLocaleString()}</p>
                      <p className="text-sm text-slate-500">Total (0% VAT on battery storage)</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-medium text-success-400">£{calculations.annualSavings}/year savings</p>
                      <p className="text-sm text-slate-500">{calculations.paybackYears} year payback</p>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="mt-6">
                  <Input
                    label="Notes (visible to customer)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional notes or special conditions..."
                  />
                </div>
              </Card>

              {/* Actions */}
              <Card className="!p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-400">
                    Ready to proceed? Save as draft or send directly to customer.
                  </p>
                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      onClick={() => handleSubmit('draft')}
                      isLoading={isSubmitting}
                    >
                      Save Draft
                    </Button>
                    <Button
                      onClick={() => handleSubmit('sent')}
                      isLoading={isSubmitting}
                    >
                      Send to Customer
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-8">
        <Button
          variant="secondary"
          onClick={prevStep}
          disabled={currentStep === 0}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
        >
          Previous
        </Button>
        {currentStep < steps.length - 1 && (
          <Button
            onClick={nextStep}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Next Step
          </Button>
        )}
      </div>
    </div>
  );
}

