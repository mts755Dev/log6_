import type { DocumentBankCategory } from '../types';

export const EFFICIENCY_MEASUREMENT_TYPES = [
  'AC-to-AC (includes inverter)',
  'DC-to-DC',
  'DC-to-AC',
] as const;

export type EfficiencyMeasurementType = (typeof EFFICIENCY_MEASUREMENT_TYPES)[number];

export interface BatteryFormState {
  code: string;
  manufacturerId: string;
  totalEnergyKwh: string;
  endOfLifeCapacity: string;
  maxContinuousDischargePowerW: string;
  maxContinuousChargePowerW: string;
  depthOfDischarge: string;
  totalWarrantedKwh: string;
  roundtripEfficiencyPct: string;
  efficiencyMeasurementType: string;
  nominalVoltageV: string;
  warrantyYears: string;
  skus: string;
  agingFactor: string;
  costPrice: string;
  rrp: string;
  datasheetDocumentId: string;
  userManualDocumentId: string;
  consumerCodeLeafletDocumentId: string;
}

export interface InverterFormState {
  code: string;
  manufacturerId: string;
  microinverter: boolean;
  ratedOutputPowerW: string;
  skus: string;
  hybrid: boolean;
  phases: string;
  maxDcPowerW: string;
  ratedOutputVoltageV: string;
  ratedInputVoltageV: string;
  maxInputVoltageV: string;
  minInputVoltageV: string;
  mpptMaxInputVoltageV: string;
  mpptMinInputVoltageV: string;
  mpptCount: string;
  maxDcInputCurrentA: string;
  maxInputShortCircuitCurrentA: string;
  maxAcOutputCurrentA: string;
  efficiency: string;
  nighttimeConsumptionW: string;
  warrantyYears: string;
  additionalPartsWarrantyYears: string;
  includesInbuiltDcIsolator: boolean;
  costPrice: string;
  rrp: string;
  datasheetDocumentId: string;
  userManualDocumentId: string;
  consumerCodeLeafletDocumentId: string;
}

export interface HeatPumpFormState {
  brand: string;
  model: string;
  nominalKw: string;
  phases: string;
  outputW35Kw: string;
  copW35: string;
  outputW55Kw: string;
  copW55: string;
  scopSeasonal: string;
  erpClass: string;
  a2W35Kw: string;
  a2W35Cop: string;
  a2W55Kw: string;
  a2W55Cop: string;
  aNeg7W35Kw: string;
  aNeg7W35Cop: string;
  aNeg7W55Kw: string;
  aNeg7W55Cop: string;
  minModulationKw: string;
  maxOutputKw: string;
  ratedFlowM3h: string;
  soundPressure1mDba: string;
  soundPowerLwaDba: string;
  weightKg: string;
  dimensionsLwhMm: string;
  r290ChargeKg: string;
  imageUrl: string;
  costPrice: string;
  rrp: string;
  isActive: boolean;
  datasheetDocumentId: string;
  userManualDocumentId: string;
  consumerCodeLeafletDocumentId: string;
}

export const emptyBatteryForm = (): BatteryFormState => ({
  code: '',
  manufacturerId: '',
  totalEnergyKwh: '',
  endOfLifeCapacity: '',
  maxContinuousDischargePowerW: '',
  maxContinuousChargePowerW: '',
  depthOfDischarge: '',
  totalWarrantedKwh: '',
  roundtripEfficiencyPct: '',
  efficiencyMeasurementType: EFFICIENCY_MEASUREMENT_TYPES[0],
  nominalVoltageV: '',
  warrantyYears: '',
  skus: '',
  agingFactor: '1',
  costPrice: '',
  rrp: '',
  datasheetDocumentId: '',
  userManualDocumentId: '',
  consumerCodeLeafletDocumentId: '',
});

export const emptyInverterForm = (): InverterFormState => ({
  code: '',
  manufacturerId: '',
  microinverter: false,
  ratedOutputPowerW: '',
  skus: '',
  hybrid: false,
  phases: '1',
  maxDcPowerW: '',
  ratedOutputVoltageV: '',
  ratedInputVoltageV: '',
  maxInputVoltageV: '',
  minInputVoltageV: '',
  mpptMaxInputVoltageV: '',
  mpptMinInputVoltageV: '',
  mpptCount: '',
  maxDcInputCurrentA: '',
  maxInputShortCircuitCurrentA: '',
  maxAcOutputCurrentA: '',
  efficiency: '',
  nighttimeConsumptionW: '',
  warrantyYears: '',
  additionalPartsWarrantyYears: '',
  includesInbuiltDcIsolator: false,
  costPrice: '',
  rrp: '',
  datasheetDocumentId: '',
  userManualDocumentId: '',
  consumerCodeLeafletDocumentId: '',
});

export const emptyHeatPumpForm = (): HeatPumpFormState => ({
  brand: '',
  model: '',
  nominalKw: '',
  phases: '1',
  outputW35Kw: '',
  copW35: '',
  outputW55Kw: '',
  copW55: '',
  scopSeasonal: '',
  erpClass: '',
  a2W35Kw: '',
  a2W35Cop: '',
  a2W55Kw: '',
  a2W55Cop: '',
  aNeg7W35Kw: '',
  aNeg7W35Cop: '',
  aNeg7W55Kw: '',
  aNeg7W55Cop: '',
  minModulationKw: '',
  maxOutputKw: '',
  ratedFlowM3h: '',
  soundPressure1mDba: '',
  soundPowerLwaDba: '',
  weightKg: '',
  dimensionsLwhMm: '',
  r290ChargeKg: '',
  imageUrl: '',
  costPrice: '',
  rrp: '',
  isActive: true,
  datasheetDocumentId: '',
  userManualDocumentId: '',
  consumerCodeLeafletDocumentId: '',
});

const parseNum = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseIntOrNull = (value: string) => {
  if (!value.trim()) return null;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const nullIfEmpty = (value: string) => (value.trim() ? value.trim() : null);

export const batteryFormToDb = (form: BatteryFormState, forUpdate = false) => {
  const totalEnergy = parseNum(form.totalEnergyKwh);
  const dischargeW = parseNum(form.maxContinuousDischargePowerW);

  const payload = {
    code: nullIfEmpty(form.code),
    model: form.code.trim(),
    manufacturer_id: form.manufacturerId || null,
    total_energy_kwh: totalEnergy,
    capacity_kwh: totalEnergy,
    power_kw: dischargeW != null ? dischargeW / 1000 : null,
    end_of_life_capacity: parseNum(form.endOfLifeCapacity),
    max_continuous_discharge_power_w: dischargeW,
    max_continuous_charge_power_w: parseNum(form.maxContinuousChargePowerW),
    depth_of_discharge: parseNum(form.depthOfDischarge),
    total_warranted_kwh: parseNum(form.totalWarrantedKwh),
    roundtrip_efficiency_pct: parseNum(form.roundtripEfficiencyPct),
    efficiency: parseNum(form.roundtripEfficiencyPct),
    efficiency_measurement_type: nullIfEmpty(form.efficiencyMeasurementType),
    nominal_voltage_v: parseNum(form.nominalVoltageV),
    warranty_years: parseIntOrNull(form.warrantyYears),
    skus: nullIfEmpty(form.skus),
    aging_factor: parseNum(form.agingFactor),
    cost_price: parseNum(form.costPrice),
    rrp: parseNum(form.rrp),
    datasheet_document_id: form.datasheetDocumentId || null,
    user_manual_document_id: form.userManualDocumentId || null,
    consumer_code_leaflet_document_id: null,
  };

  return forUpdate ? payload : { ...payload, is_active: true };
};

export const inverterFormToDb = (form: InverterFormState, forUpdate = false) => {
  const ratedW = parseNum(form.ratedOutputPowerW);

  const payload = {
    code: nullIfEmpty(form.code),
    model: form.code.trim(),
    manufacturer_id: form.manufacturerId || null,
    microinverter: form.microinverter,
    hybrid: form.hybrid,
    rated_output_power_w: ratedW,
    power_kw: ratedW != null ? ratedW / 1000 : null,
    skus: nullIfEmpty(form.skus),
    phases: parseIntOrNull(form.phases),
    max_dc_power_w: parseNum(form.maxDcPowerW),
    rated_output_voltage_v: parseNum(form.ratedOutputVoltageV),
    rated_input_voltage_v: parseNum(form.ratedInputVoltageV),
    max_input_voltage: parseNum(form.maxInputVoltageV),
    min_input_voltage_v: parseNum(form.minInputVoltageV),
    mppt_max_input_voltage_v: parseNum(form.mpptMaxInputVoltageV),
    mppt_min_input_voltage_v: parseNum(form.mpptMinInputVoltageV),
    mppt_count: parseIntOrNull(form.mpptCount),
    max_dc_current: parseNum(form.maxDcInputCurrentA),
    max_input_short_circuit_current_a: parseNum(form.maxInputShortCircuitCurrentA),
    max_ac_output_current_a: parseNum(form.maxAcOutputCurrentA),
    efficiency: parseNum(form.efficiency),
    nighttime_consumption_w: parseNum(form.nighttimeConsumptionW),
    warranty_years: parseIntOrNull(form.warrantyYears),
    additional_parts_warranty_years: parseIntOrNull(form.additionalPartsWarrantyYears),
    includes_inbuilt_dc_isolator: form.includesInbuiltDcIsolator,
    cost_price: parseNum(form.costPrice),
    rrp: parseNum(form.rrp),
    datasheet_document_id: form.datasheetDocumentId || null,
    user_manual_document_id: form.userManualDocumentId || null,
    consumer_code_leaflet_document_id: null,
  };

  return forUpdate ? payload : { ...payload, is_active: true };
};

export const heatPumpFormToDb = (form: HeatPumpFormState) => ({
  brand: nullIfEmpty(form.brand),
  model: form.model.trim(),
  nominal_kw: parseNum(form.nominalKw),
  phases: parseIntOrNull(form.phases),
  output_w35_kw: parseNum(form.outputW35Kw),
  cop_w35: parseNum(form.copW35),
  output_w55_kw: parseNum(form.outputW55Kw),
  cop_w55: parseNum(form.copW55),
  scop_seasonal: parseNum(form.scopSeasonal),
  erp_class: nullIfEmpty(form.erpClass),
  a2_w35_kw: parseNum(form.a2W35Kw),
  a2_w35_cop: parseNum(form.a2W35Cop),
  a2_w55_kw: parseNum(form.a2W55Kw),
  a2_w55_cop: parseNum(form.a2W55Cop),
  a_neg7_w35_kw: parseNum(form.aNeg7W35Kw),
  a_neg7_w35_cop: parseNum(form.aNeg7W35Cop),
  a_neg7_w55_kw: parseNum(form.aNeg7W55Kw),
  a_neg7_w55_cop: parseNum(form.aNeg7W55Cop),
  min_modulation_kw: parseNum(form.minModulationKw),
  max_output_kw: parseNum(form.maxOutputKw),
  rated_flow_m3h: parseNum(form.ratedFlowM3h),
  sound_pressure_1m_dba: parseNum(form.soundPressure1mDba),
  sound_power_lwa_dba: parseNum(form.soundPowerLwaDba),
  weight_kg: parseNum(form.weightKg),
  dimensions_lwh_mm: nullIfEmpty(form.dimensionsLwhMm),
  r290_charge_kg: parseNum(form.r290ChargeKg),
  image_url: nullIfEmpty(form.imageUrl),
  cost_price: parseNum(form.costPrice),
  rrp: parseNum(form.rrp),
  is_active: form.isActive,
  datasheet_document_id: form.datasheetDocumentId || null,
  user_manual_document_id: form.userManualDocumentId || null,
  consumer_code_leaflet_document_id: null,
});

export const batteryFromDb = (b: any): BatteryFormState => ({
  code: b.code || b.model || '',
  manufacturerId: b.manufacturer_id || b.manufacturerId || '',
  totalEnergyKwh: b.total_energy_kwh?.toString() || b.capacity_kwh?.toString() || '',
  endOfLifeCapacity: b.end_of_life_capacity?.toString() || '',
  maxContinuousDischargePowerW: b.max_continuous_discharge_power_w?.toString() || '',
  maxContinuousChargePowerW: b.max_continuous_charge_power_w?.toString() || '',
  depthOfDischarge: b.depth_of_discharge?.toString() || '',
  totalWarrantedKwh: b.total_warranted_kwh?.toString() || '',
  roundtripEfficiencyPct: b.roundtrip_efficiency_pct?.toString() || b.efficiency?.toString() || '',
  efficiencyMeasurementType: b.efficiency_measurement_type || EFFICIENCY_MEASUREMENT_TYPES[0],
  nominalVoltageV: b.nominal_voltage_v?.toString() || '',
  warrantyYears: b.warranty_years?.toString() || '',
  skus: b.skus || '',
  agingFactor: b.aging_factor?.toString() || '1',
  costPrice: b.cost_price?.toString() || '',
  rrp: b.rrp?.toString() || '',
  datasheetDocumentId: b.datasheet_document_id || b.datasheetDocumentId || '',
  userManualDocumentId: b.user_manual_document_id || b.userManualDocumentId || '',
  consumerCodeLeafletDocumentId: b.consumer_code_leaflet_document_id || b.consumerCodeLeafletDocumentId || '',
});

export const inverterFromDb = (i: any): InverterFormState => ({
  code: i.code || i.model || '',
  manufacturerId: i.manufacturer_id || i.manufacturerId || '',
  microinverter: i.microinverter ?? false,
  ratedOutputPowerW: i.rated_output_power_w?.toString() || (i.power_kw != null ? (Number(i.power_kw) * 1000).toString() : ''),
  skus: i.skus || '',
  hybrid: i.hybrid ?? false,
  phases: (i.phases ?? 1).toString(),
  maxDcPowerW: i.max_dc_power_w?.toString() || '',
  ratedOutputVoltageV: i.rated_output_voltage_v?.toString() || '',
  ratedInputVoltageV: i.rated_input_voltage_v?.toString() || '',
  maxInputVoltageV: i.max_input_voltage?.toString() || '',
  minInputVoltageV: i.min_input_voltage_v?.toString() || '',
  mpptMaxInputVoltageV: i.mppt_max_input_voltage_v?.toString() || '',
  mpptMinInputVoltageV: i.mppt_min_input_voltage_v?.toString() || '',
  mpptCount: i.mppt_count?.toString() || '',
  maxDcInputCurrentA: i.max_dc_current?.toString() || '',
  maxInputShortCircuitCurrentA: i.max_input_short_circuit_current_a?.toString() || '',
  maxAcOutputCurrentA: i.max_ac_output_current_a?.toString() || '',
  efficiency: i.efficiency?.toString() || '',
  nighttimeConsumptionW: i.nighttime_consumption_w?.toString() || '',
  warrantyYears: i.warranty_years?.toString() || '',
  additionalPartsWarrantyYears: i.additional_parts_warranty_years?.toString() || '',
  includesInbuiltDcIsolator: i.includes_inbuilt_dc_isolator ?? false,
  costPrice: i.cost_price?.toString() || '',
  rrp: i.rrp?.toString() || '',
  datasheetDocumentId: i.datasheet_document_id || i.datasheetDocumentId || '',
  userManualDocumentId: i.user_manual_document_id || i.userManualDocumentId || '',
  consumerCodeLeafletDocumentId: i.consumer_code_leaflet_document_id || i.consumerCodeLeafletDocumentId || '',
});

export const heatPumpFromDb = (h: any): HeatPumpFormState => ({
  brand: h.brand || '',
  model: h.model || '',
  nominalKw: h.nominal_kw?.toString() || '',
  phases: (h.phases ?? 1).toString(),
  outputW35Kw: h.output_w35_kw?.toString() || '',
  copW35: h.cop_w35?.toString() || '',
  outputW55Kw: h.output_w55_kw?.toString() || '',
  copW55: h.cop_w55?.toString() || '',
  scopSeasonal: h.scop_seasonal?.toString() || '',
  erpClass: h.erp_class || '',
  a2W35Kw: h.a2_w35_kw?.toString() || '',
  a2W35Cop: h.a2_w35_cop?.toString() || '',
  a2W55Kw: h.a2_w55_kw?.toString() || '',
  a2W55Cop: h.a2_w55_cop?.toString() || '',
  aNeg7W35Kw: h.a_neg7_w35_kw?.toString() || '',
  aNeg7W35Cop: h.a_neg7_w35_cop?.toString() || '',
  aNeg7W55Kw: h.a_neg7_w55_kw?.toString() || '',
  aNeg7W55Cop: h.a_neg7_w55_cop?.toString() || '',
  minModulationKw: h.min_modulation_kw?.toString() || '',
  maxOutputKw: h.max_output_kw?.toString() || '',
  ratedFlowM3h: h.rated_flow_m3h?.toString() || '',
  soundPressure1mDba: h.sound_pressure_1m_dba?.toString() || '',
  soundPowerLwaDba: h.sound_power_lwa_dba?.toString() || '',
  weightKg: h.weight_kg?.toString() || '',
  dimensionsLwhMm: h.dimensions_lwh_mm || '',
  r290ChargeKg: h.r290_charge_kg?.toString() || '',
  imageUrl: h.image_url || '',
  costPrice: h.cost_price?.toString() || '',
  rrp: h.rrp?.toString() || '',
  isActive: h.is_active ?? h.isActive ?? true,
  datasheetDocumentId: h.datasheet_document_id || h.datasheetDocumentId || '',
  userManualDocumentId: h.user_manual_document_id || h.userManualDocumentId || '',
  consumerCodeLeafletDocumentId: h.consumer_code_leaflet_document_id || h.consumerCodeLeafletDocumentId || '',
});

export type DocumentOption = { value: string; label: string };

export const getDocumentOptions = (
  bankDocuments: Array<{ id: string; name: string; category: DocumentBankCategory }>,
  category: DocumentBankCategory,
): DocumentOption[] => [
  { value: '', label: 'None' },
  ...bankDocuments
    .filter((doc) => doc.category === category)
    .map((doc) => ({ value: doc.id, label: doc.name })),
];
