export interface ShProductRow {
  id: number;
  type: 'cylinder' | 'radiator' | 'ashp' | string;
  brand: string;
  model: string;
  data: Record<string, unknown> | string | null;
  active: boolean;
  owner_id?: string | null;
  created_at?: number;
  updated_at?: number;
}

export interface CylinderFormState {
  brand: string;
  model: string;
  litres: string;
  coil: string;
  reheat: string;
  costPrice: string;
  rrp: string;
  isActive: boolean;
}

export interface RadiatorFormState {
  brand: string;
  model: string;
  rtype: string;
  code: string;
  n: string;
  note: string;
  costPrice: string;
  rrp: string;
  isActive: boolean;
}

export const emptyCylinderForm = (): CylinderFormState => ({
  brand: '',
  model: '',
  litres: '',
  coil: '',
  reheat: '',
  costPrice: '',
  rrp: '',
  isActive: true,
});

export const emptyRadiatorForm = (): RadiatorFormState => ({
  brand: '',
  model: '',
  rtype: '',
  code: '',
  n: '',
  note: '',
  costPrice: '',
  rrp: '',
  isActive: true,
});

export const parseShData = (raw: ShProductRow['data']): Record<string, unknown> => {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return raw;
};

const nullIfEmpty = (value: string) => (value.trim() ? value.trim() : null);

const parseNum = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const cylinderFromRow = (row: ShProductRow): CylinderFormState => {
  const data = parseShData(row.data);
  return {
    brand: row.brand || '',
    model: row.model || '',
    litres: data.litres != null ? String(data.litres) : '',
    coil: data.coil != null ? String(data.coil) : '',
    reheat: data.reheat != null ? String(data.reheat) : '',
    costPrice: data.cost_price != null ? String(data.cost_price) : '',
    rrp: data.rrp != null ? String(data.rrp) : '',
    isActive: row.active ?? true,
  };
};

export const radiatorFromRow = (row: ShProductRow): RadiatorFormState => {
  const data = parseShData(row.data);
  return {
    brand: row.brand || '',
    model: row.model || '',
    rtype: data.rtype != null ? String(data.rtype) : '',
    code: data.code != null ? String(data.code) : '',
    n: data.n != null ? String(data.n) : '',
    note: data.note != null ? String(data.note) : '',
    costPrice: data.cost_price != null ? String(data.cost_price) : '',
    rrp: data.rrp != null ? String(data.rrp) : '',
    isActive: row.active ?? true,
  };
};

export const cylinderFormToRow = (form: CylinderFormState) => ({
  type: 'cylinder' as const,
  brand: form.brand.trim(),
  model: form.model.trim(),
  active: form.isActive,
  data: {
    litres: parseNum(form.litres),
    coil: nullIfEmpty(form.coil),
    reheat: nullIfEmpty(form.reheat),
    cost_price: parseNum(form.costPrice),
    rrp: parseNum(form.rrp),
  },
});

export const radiatorFormToRow = (form: RadiatorFormState) => ({
  type: 'radiator' as const,
  brand: form.brand.trim(),
  model: form.model.trim(),
  active: form.isActive,
  data: {
    rtype: nullIfEmpty(form.rtype),
    code: parseNum(form.code) ?? nullIfEmpty(form.code),
    n: parseNum(form.n),
    note: nullIfEmpty(form.note),
    cost_price: parseNum(form.costPrice),
    rrp: parseNum(form.rrp),
  },
});

/** SimpliHeat ASHP `data` keys → heat-pump form used in the admin UI. */
export interface AshpFormState {
  brand: string;
  model: string;
  nominalKw: string;
  phases: string;
  outputW35Kw: string;
  copW35: string;
  outputW55Kw: string;
  copW55: string;
  minModulationKw: string;
  maxOutputKw: string;
  ratedFlowM3h: string;
  soundPressure1mDba: string;
  weightKg: string;
  dimensionsLwhMm: string;
  r290ChargeKg: string;
  costPrice: string;
  rrp: string;
  isActive: boolean;
}

export const emptyAshpForm = (): AshpFormState => ({
  brand: '',
  model: '',
  nominalKw: '',
  phases: '1',
  outputW35Kw: '',
  copW35: '',
  outputW55Kw: '',
  copW55: '',
  minModulationKw: '',
  maxOutputKw: '',
  ratedFlowM3h: '',
  soundPressure1mDba: '',
  weightKg: '',
  dimensionsLwhMm: '',
  r290ChargeKg: '',
  costPrice: '',
  rrp: '',
  isActive: true,
});

const dataStr = (data: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    if (data[key] != null && data[key] !== '') return String(data[key]);
  }
  return '';
};

export const ashpFromRow = (row: ShProductRow): AshpFormState => {
  const data = parseShData(row.data);
  return {
    brand: row.brand || '',
    model: row.model || '',
    nominalKw: dataStr(data, 'nom', 'nominal_kw'),
    phases: dataStr(data, 'phase', 'phases') || '1',
    outputW35Kw: dataStr(data, 'kw35', 'output_w35_kw'),
    copW35: dataStr(data, 'cop35', 'cop_w35'),
    outputW55Kw: dataStr(data, 'kw55', 'output_w55_kw'),
    copW55: dataStr(data, 'cop55', 'cop_w55'),
    minModulationKw: dataStr(data, 'min55', 'min_modulation_kw'),
    maxOutputKw: dataStr(data, 'max55', 'max_output_kw'),
    ratedFlowM3h: dataStr(data, 'flow', 'rated_flow_m3h'),
    soundPressure1mDba: dataStr(data, 'dba', 'sound_pressure_1m_dba'),
    weightKg: dataStr(data, 'weight', 'weight_kg'),
    dimensionsLwhMm: dataStr(data, 'dims', 'dimensions_lwh_mm'),
    r290ChargeKg: dataStr(data, 'charge', 'r290_charge_kg'),
    costPrice: dataStr(data, 'cost_price'),
    rrp: dataStr(data, 'rrp'),
    isActive: row.active ?? true,
  };
};

export const ashpFormToRow = (form: AshpFormState) => ({
  type: 'ashp' as const,
  brand: form.brand.trim(),
  model: form.model.trim(),
  active: form.isActive,
  data: {
    nom: parseNum(form.nominalKw),
    phase: parseNum(form.phases),
    kw35: parseNum(form.outputW35Kw),
    cop35: parseNum(form.copW35),
    kw55: parseNum(form.outputW55Kw),
    cop55: parseNum(form.copW55),
    min55: parseNum(form.minModulationKw),
    max55: parseNum(form.maxOutputKw),
    flow: parseNum(form.ratedFlowM3h),
    dba: parseNum(form.soundPressure1mDba),
    weight: parseNum(form.weightKg),
    dims: nullIfEmpty(form.dimensionsLwhMm),
    charge: parseNum(form.r290ChargeKg),
    cost_price: parseNum(form.costPrice),
    rrp: parseNum(form.rrp),
  },
});

export const ashpRowToCatalogue = (row: ShProductRow) => {
  const data = parseShData(row.data);
  const nom = data.nom ?? data.nominal_kw;
  const kw35 = data.kw35 ?? data.output_w35_kw;
  const cop35 = data.cop35 ?? data.cop_w35;
  return {
    id: String(row.id),
    brand: row.brand || '',
    model: row.model || '',
    nominalKw: typeof nom === 'number' ? nom : nom != null ? Number(nom) : undefined,
    outputW35Kw: typeof kw35 === 'number' ? kw35 : kw35 != null ? Number(kw35) : undefined,
    copW35: typeof cop35 === 'number' ? cop35 : cop35 != null ? Number(cop35) : undefined,
    isActive: row.active ?? true,
  };
};
