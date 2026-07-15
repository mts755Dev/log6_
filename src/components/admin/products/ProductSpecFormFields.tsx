import { useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { Button } from '../../ui/Button';
import { useToast } from '../../../contexts/ToastContext';
import { supabase } from '../../../lib/supabase';
import { compressForUpload } from '../../../lib/compressUpload';
import { uploadToDocumentBank } from '../../../lib/documentBankUpload';
import type { DocumentAppliesTo } from '../../../lib/documentProductLinks';
import type { DocumentBankCategory } from '../../../types';
import {
  EFFICIENCY_MEASUREMENT_TYPES,
  type BatteryFormState,
  type DocumentOption,
  type HeatPumpFormState,
  type InverterFormState,
} from '../../../lib/productSpecs';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-sm font-semibold text-slate-300 border-b border-slate-700 pb-2 mt-2">
      {children}
    </h4>
  );
}

function YesNoSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Select
      label={label}
      value={value ? 'yes' : 'no'}
      onChange={(e) => onChange(e.target.value === 'yes')}
      options={[
        { value: 'no', label: 'No' },
        { value: 'yes', label: 'Yes' },
      ]}
    />
  );
}

function DocumentFields<T extends {
  datasheetDocumentId: string;
  userManualDocumentId: string;
}>({
  form,
  setForm,
  getOptions,
  onDocumentUploaded,
  productType,
}: {
  form: T;
  setForm: (next: T) => void;
  getOptions: (category: DocumentBankCategory) => DocumentOption[];
  onDocumentUploaded?: (doc: { id: string; name: string; category: DocumentBankCategory }) => void;
  productType?: DocumentAppliesTo;
}) {
  const toast = useToast();
  const [uploadingCategory, setUploadingCategory] = useState<DocumentBankCategory | null>(null);
  const datasheetInputRef = useRef<HTMLInputElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);

  const fieldForCategory = (category: DocumentBankCategory): keyof T => {
    if (category === 'product_datasheet') return 'datasheetDocumentId';
    return 'userManualDocumentId';
  };

  const handleUpload = async (category: DocumentBankCategory, file: File | undefined) => {
    if (!file) return;
    try {
      setUploadingCategory(category);
      const uploaded = await uploadToDocumentBank({
        file,
        category,
        productType: productType || null,
      });
      onDocumentUploaded?.(uploaded);
      setForm({ ...form, [fieldForCategory(category)]: uploaded.id } as T);
      toast.success(`${uploaded.name} uploaded to Document Bank`);
    } catch (error: any) {
      console.error('Document upload failed:', error);
      toast.error(error.message || 'Failed to upload document');
    } finally {
      setUploadingCategory(null);
    }
  };

  const rows: Array<{
    category: DocumentBankCategory;
    label: string;
    value: string;
    inputRef: React.RefObject<HTMLInputElement>;
  }> = [
    {
      category: 'product_datasheet',
      label: 'Product Datasheet',
      value: form.datasheetDocumentId,
      inputRef: datasheetInputRef,
    },
    {
      category: 'user_manual',
      label: 'User Manual',
      value: form.userManualDocumentId,
      inputRef: manualInputRef,
    },
  ];

  return (
    <div className="border-t border-slate-700 pt-4 space-y-4">
      <div>
        <SectionTitle>Documents from Document Bank</SectionTitle>
        <p className="text-xs text-slate-500 mt-1">
          Datasheets and manuals for this product. Consumer code leaflets are General documents and attach automatically when a quote is saved.
        </p>
      </div>

      {rows.map((row) => (
        <div key={row.category} className="space-y-2">
          <Select
            label={row.label}
            value={row.value}
            onChange={(e) =>
              setForm({ ...form, [fieldForCategory(row.category)]: e.target.value } as T)
            }
            options={getOptions(row.category)}
          />
          <div className="flex items-center gap-2">
            <input
              ref={row.inputRef}
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                void handleUpload(row.category, file);
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={
                uploadingCategory === row.category ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )
              }
              disabled={uploadingCategory !== null}
              onClick={() => row.inputRef.current?.click()}
            >
              {uploadingCategory === row.category ? 'Uploading…' : 'Upload new'}
            </Button>
            <span className="text-xs text-slate-500">Adds to Document Bank and selects it here</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function BatteryProductFields({
  form,
  setForm,
  manufacturers,
  getDocumentOptionsFor,
  onDocumentUploaded,
}: {
  form: BatteryFormState;
  setForm: (form: BatteryFormState) => void;
  manufacturers: Array<{ id: string; name: string }>;
  getDocumentOptionsFor: (category: DocumentBankCategory) => DocumentOption[];
  onDocumentUploaded?: (doc: { id: string; name: string; category: DocumentBankCategory }) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
        <Select
          label="Manufacturer"
          value={form.manufacturerId}
          onChange={(e) => setForm({ ...form, manufacturerId: e.target.value })}
          options={manufacturers.map((m) => ({ value: m.id, label: m.name }))}
          required
        />
        <Input label="Total Energy" type="number" step="0.01" value={form.totalEnergyKwh} onChange={(e) => setForm({ ...form, totalEnergyKwh: e.target.value })} hint="kWh" required />

        <Input label="End of Life Capacity" type="number" step="0.0001" value={form.endOfLifeCapacity} onChange={(e) => setForm({ ...form, endOfLifeCapacity: e.target.value })} hint="0–1" />
        <Input label="Max Continuous Discharge Power" type="number" value={form.maxContinuousDischargePowerW} onChange={(e) => setForm({ ...form, maxContinuousDischargePowerW: e.target.value })} hint="Watts" />
        <Input label="Max Continuous Charge Power" type="number" value={form.maxContinuousChargePowerW} onChange={(e) => setForm({ ...form, maxContinuousChargePowerW: e.target.value })} hint="Watts" />

        <Input label="Depth of Discharge" type="number" step="0.0001" value={form.depthOfDischarge} onChange={(e) => setForm({ ...form, depthOfDischarge: e.target.value })} hint="0–1" />
        <Input label="Total Warranted kWh" type="number" value={form.totalWarrantedKwh} onChange={(e) => setForm({ ...form, totalWarrantedKwh: e.target.value })} hint="1 cycle/day" />
        <Input label="Roundtrip Efficiency" type="number" step="0.01" value={form.roundtripEfficiencyPct} onChange={(e) => setForm({ ...form, roundtripEfficiencyPct: e.target.value })} hint="%" />

        <Select
          label="Efficiency measurement type"
          value={form.efficiencyMeasurementType}
          onChange={(e) => setForm({ ...form, efficiencyMeasurementType: e.target.value })}
          options={EFFICIENCY_MEASUREMENT_TYPES.map((t) => ({ value: t, label: t }))}
        />
        <Input label="Nominal Voltage" type="number" value={form.nominalVoltageV} onChange={(e) => setForm({ ...form, nominalVoltageV: e.target.value })} hint="V" />
        <Input label="Product Warranty" type="number" value={form.warrantyYears} onChange={(e) => setForm({ ...form, warrantyYears: e.target.value })} hint="years" />

        <Input label="SKUs" value={form.skus} onChange={(e) => setForm({ ...form, skus: e.target.value })} hint="csv" />
        <Input label="Aging Factor" type="number" step="0.0001" value={form.agingFactor} onChange={(e) => setForm({ ...form, agingFactor: e.target.value })} hint="0–1" />
        <Input label="Cost Price" type="number" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} hint="£" />
        <Input label="RRP" type="number" step="0.01" value={form.rrp} onChange={(e) => setForm({ ...form, rrp: e.target.value })} hint="£" />
      </div>

      <DocumentFields
        form={form}
        setForm={setForm}
        getOptions={getDocumentOptionsFor}
        onDocumentUploaded={onDocumentUploaded}
        productType="battery"
      />
    </div>
  );
}

export function InverterProductFields({
  form,
  setForm,
  manufacturers,
  getDocumentOptionsFor,
  onDocumentUploaded,
}: {
  form: InverterFormState;
  setForm: (form: InverterFormState) => void;
  manufacturers: Array<{ id: string; name: string }>;
  getDocumentOptionsFor: (category: DocumentBankCategory) => DocumentOption[];
  onDocumentUploaded?: (doc: { id: string; name: string; category: DocumentBankCategory }) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Matches inverter screenshot field order exactly */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Input label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
        <Select
          label="Manufacturer"
          value={form.manufacturerId}
          onChange={(e) => setForm({ ...form, manufacturerId: e.target.value })}
          options={manufacturers.map((m) => ({ value: m.id, label: m.name }))}
          required
        />
        <YesNoSelect label="Microinverter" value={form.microinverter} onChange={(microinverter) => setForm({ ...form, microinverter })} />
        <Input label="Rated Output Power" type="number" value={form.ratedOutputPowerW} onChange={(e) => setForm({ ...form, ratedOutputPowerW: e.target.value })} hint="Watts" required />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input label="Maximum DC Power" type="number" value={form.maxDcPowerW} onChange={(e) => setForm({ ...form, maxDcPowerW: e.target.value })} hint="Watts" />
        <Input label="Rated Output Voltage" type="number" value={form.ratedOutputVoltageV} onChange={(e) => setForm({ ...form, ratedOutputVoltageV: e.target.value })} hint="V" />
        <Input label="Rated Input Voltage" type="number" value={form.ratedInputVoltageV} onChange={(e) => setForm({ ...form, ratedInputVoltageV: e.target.value })} hint="V" />

        <Input label="Maximum Input Voltage" type="number" value={form.maxInputVoltageV} onChange={(e) => setForm({ ...form, maxInputVoltageV: e.target.value })} hint="V" />
        <Input label="Minimum Input Voltage" type="number" value={form.minInputVoltageV} onChange={(e) => setForm({ ...form, minInputVoltageV: e.target.value })} hint="V" />
        <Input label="MPPT Maximum Input Voltage" type="number" value={form.mpptMaxInputVoltageV} onChange={(e) => setForm({ ...form, mpptMaxInputVoltageV: e.target.value })} hint="V" />

        <Input label="MPPT Minimum Input Voltage" type="number" value={form.mpptMinInputVoltageV} onChange={(e) => setForm({ ...form, mpptMinInputVoltageV: e.target.value })} hint="V" />
        <Input label="Maximum DC Input Current" type="number" step="0.1" value={form.maxDcInputCurrentA} onChange={(e) => setForm({ ...form, maxDcInputCurrentA: e.target.value })} hint="A" />
        <Input label="Maximum Input Short Circuit Current" type="number" step="0.1" value={form.maxInputShortCircuitCurrentA} onChange={(e) => setForm({ ...form, maxInputShortCircuitCurrentA: e.target.value })} hint="A" />

        <Input label="Number of MPPTs" type="number" value={form.mpptCount} onChange={(e) => setForm({ ...form, mpptCount: e.target.value })} />
        <Input label="Efficiency" type="number" step="0.01" value={form.efficiency} onChange={(e) => setForm({ ...form, efficiency: e.target.value })} hint="%" />
        <Input label="Night-time Consumption" type="number" value={form.nighttimeConsumptionW} onChange={(e) => setForm({ ...form, nighttimeConsumptionW: e.target.value })} hint="Watts" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Input label="Product Warranty" type="number" value={form.warrantyYears} onChange={(e) => setForm({ ...form, warrantyYears: e.target.value })} hint="years" />
        <Input label="Additional Parts Warranty" type="number" value={form.additionalPartsWarrantyYears} onChange={(e) => setForm({ ...form, additionalPartsWarrantyYears: e.target.value })} hint="years" />
        <Input label="SKUs" value={form.skus} onChange={(e) => setForm({ ...form, skus: e.target.value })} hint="csv" />
        <YesNoSelect label="Hybrid" value={form.hybrid} onChange={(hybrid) => setForm({ ...form, hybrid })} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Select
          label="Phase Type"
          value={form.phases}
          onChange={(e) => setForm({ ...form, phases: e.target.value })}
          options={[
            { value: '1', label: 'Single Phase' },
            { value: '3', label: 'Three Phase' },
          ]}
        />
        <Input label="Maximum AC Output Current" type="number" step="0.1" value={form.maxAcOutputCurrentA} onChange={(e) => setForm({ ...form, maxAcOutputCurrentA: e.target.value })} hint="A" />
        <YesNoSelect
          label="Includes inbuilt DC Isolator"
          value={form.includesInbuiltDcIsolator}
          onChange={(includesInbuiltDcIsolator) => setForm({ ...form, includesInbuiltDcIsolator })}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Cost Price" type="number" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} hint="£" />
        <Input label="RRP" type="number" step="0.01" value={form.rrp} onChange={(e) => setForm({ ...form, rrp: e.target.value })} hint="£" />
      </div>

      <DocumentFields
        form={form}
        setForm={setForm}
        getOptions={getDocumentOptionsFor}
        onDocumentUploaded={onDocumentUploaded}
        productType="inverter"
      />
    </div>
  );
}

export function HeatPumpProductFields({
  form,
  setForm,
  getDocumentOptionsFor,
  onDocumentUploaded,
}: {
  form: HeatPumpFormState;
  setForm: (form: HeatPumpFormState) => void;
  getDocumentOptionsFor: (category: DocumentBankCategory) => DocumentOption[];
  onDocumentUploaded?: (doc: { id: string; name: string; category: DocumentBankCategory }) => void;
}) {
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoFileName, setPhotoFileName] = useState('');
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setPhotoUploading(true);
      setPhotoFileName(file.name);
      const { file: uploadFile } = await compressForUpload(file);
      const ext = uploadFile.name.split('.').pop() || 'jpg';
      const path = `product-photos/heat-pumps/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('documents').upload(path, uploadFile, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path);
      setForm({ ...form, imageUrl: publicUrl });
      setPhotoFileName(uploadFile.name);
    } catch (err) {
      console.error('Heat pump photo upload failed:', err);
      setPhotoFileName('');
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = () => {
    setForm({ ...form, imageUrl: '' });
    setPhotoFileName('');
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        W35 / W55 are the A7 ratings (EN 14511). Add the A2 &amp; A-7 grid below so the design derates at the cold outdoor temperature.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
        <Input label="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required />
        <Input label="Nominal kW" type="number" step="0.01" value={form.nominalKw} onChange={(e) => setForm({ ...form, nominalKw: e.target.value })} />
        <Select
          label="Phase"
          value={form.phases}
          onChange={(e) => setForm({ ...form, phases: e.target.value })}
          options={[{ value: '1', label: '1' }, { value: '3', label: '3' }]}
        />
        <Input label="Output @ W35 (kW)" type="number" step="0.01" value={form.outputW35Kw} onChange={(e) => setForm({ ...form, outputW35Kw: e.target.value })} />
        <Input label="COP @ W35" type="number" step="0.01" value={form.copW35} onChange={(e) => setForm({ ...form, copW35: e.target.value })} />
        <Input label="Output @ W55 (kW)" type="number" step="0.01" value={form.outputW55Kw} onChange={(e) => setForm({ ...form, outputW55Kw: e.target.value })} />
        <Input label="COP @ W55" type="number" step="0.01" value={form.copW55} onChange={(e) => setForm({ ...form, copW55: e.target.value })} />
        <Input label="SCOP (seasonal)" type="number" step="0.01" value={form.scopSeasonal} onChange={(e) => setForm({ ...form, scopSeasonal: e.target.value })} />
        <Input label="ErP class (e.g. A+++)" value={form.erpClass} onChange={(e) => setForm({ ...form, erpClass: e.target.value })} />
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-300">
          Low-temperature performance — capacity (kW) &amp; COP at outdoor A2 &amp; A-7 (A7 = the W35 / W55 fields above)
        </p>
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/60 text-slate-400 text-left">
                <th className="p-2" />
                <th className="p-2 text-center" colSpan={2}>W35 FLOW</th>
                <th className="p-2 text-center" colSpan={2}>W55 FLOW</th>
              </tr>
              <tr className="bg-slate-800/40 text-slate-500 text-left text-xs">
                <th className="p-2" />
                <th className="p-2">KW</th>
                <th className="p-2">COP</th>
                <th className="p-2">KW</th>
                <th className="p-2">COP</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-700">
                <td className="p-2 text-slate-300 whitespace-nowrap font-medium">A2 °C</td>
                <td className="p-2"><Input value={form.a2W35Kw} onChange={(e) => setForm({ ...form, a2W35Kw: e.target.value })} type="number" step="0.01" /></td>
                <td className="p-2"><Input value={form.a2W35Cop} onChange={(e) => setForm({ ...form, a2W35Cop: e.target.value })} type="number" step="0.01" /></td>
                <td className="p-2"><Input value={form.a2W55Kw} onChange={(e) => setForm({ ...form, a2W55Kw: e.target.value })} type="number" step="0.01" /></td>
                <td className="p-2"><Input value={form.a2W55Cop} onChange={(e) => setForm({ ...form, a2W55Cop: e.target.value })} type="number" step="0.01" /></td>
              </tr>
              <tr className="border-t border-slate-700">
                <td className="p-2 text-slate-300 whitespace-nowrap font-medium">A-7 °C</td>
                <td className="p-2"><Input value={form.aNeg7W35Kw} onChange={(e) => setForm({ ...form, aNeg7W35Kw: e.target.value })} type="number" step="0.01" /></td>
                <td className="p-2"><Input value={form.aNeg7W35Cop} onChange={(e) => setForm({ ...form, aNeg7W35Cop: e.target.value })} type="number" step="0.01" /></td>
                <td className="p-2"><Input value={form.aNeg7W55Kw} onChange={(e) => setForm({ ...form, aNeg7W55Kw: e.target.value })} type="number" step="0.01" /></td>
                <td className="p-2"><Input value={form.aNeg7W55Cop} onChange={(e) => setForm({ ...form, aNeg7W55Cop: e.target.value })} type="number" step="0.01" /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-slate-400">
          Fill from the datasheet / MCS to size the design at the cold outdoor temperature. Leave blank to use the A7 ratings only.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input label="Min mod. (kW)" type="number" step="0.01" value={form.minModulationKw} onChange={(e) => setForm({ ...form, minModulationKw: e.target.value })} />
        <Input label="Max output (kW)" type="number" step="0.01" value={form.maxOutputKw} onChange={(e) => setForm({ ...form, maxOutputKw: e.target.value })} />
        <Input label="Rated flow (m³/h)" type="number" step="0.01" value={form.ratedFlowM3h} onChange={(e) => setForm({ ...form, ratedFlowM3h: e.target.value })} />
        <Input label="Sound press. @1m dB(A)" type="number" step="0.1" value={form.soundPressure1mDba} onChange={(e) => setForm({ ...form, soundPressure1mDba: e.target.value })} />
        <Input label="Sound power L_wA dB(A)" type="number" step="0.1" value={form.soundPowerLwaDba} onChange={(e) => setForm({ ...form, soundPowerLwaDba: e.target.value })} />
        <Input label="Weight (kg)" type="number" step="0.1" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} />
        <Input label="Dims L×W×H (mm)" value={form.dimensionsLwhMm} onChange={(e) => setForm({ ...form, dimensionsLwhMm: e.target.value })} />
        <Input label="R290 charge (kg)" type="number" step="0.01" value={form.r290ChargeKg} onChange={(e) => setForm({ ...form, r290ChargeKg: e.target.value })} />
        <Input label="Cost Price" type="number" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} hint="£" />
        <Input label="RRP" type="number" step="0.01" value={form.rrp} onChange={(e) => setForm({ ...form, rrp: e.target.value })} hint="£" />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-300">Product photo (optional)</label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoSelect}
            className="block text-sm text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-slate-700 file:text-white hover:file:bg-slate-600"
          />
          <Button type="button" variant="secondary" size="sm" onClick={handleRemovePhoto} disabled={!form.imageUrl && !photoFileName}>
            Remove photo
          </Button>
        </div>
        {photoUploading && <p className="text-xs text-slate-500">Uploading photo…</p>}
        {(photoFileName || form.imageUrl) && !photoUploading && (
          <p className="text-xs text-slate-500">
            {photoFileName || 'Photo uploaded'}
            {form.imageUrl && (
              <>
                {' · '}
                <a href={form.imageUrl} target="_blank" rel="noreferrer" className="text-primary-400 hover:underline">
                  View
                </a>
              </>
            )}
          </p>
        )}
        <p className="text-xs text-slate-500">Appears on the client proposal under &quot;Proposed plant&quot;.</p>
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-primary-500 focus:ring-primary-500"
        />
        <span className="text-sm text-white">Active (offered in the designer)</span>
      </label>

      <DocumentFields
        form={form}
        setForm={setForm}
        getOptions={getDocumentOptionsFor}
        onDocumentUploaded={onDocumentUploaded}
        productType="heat_pump"
      />
    </div>
  );
}

export function CylinderProductFields({
  form,
  setForm,
}: {
  form: import('../../../lib/shProducts').CylinderFormState;
  setForm: (form: import('../../../lib/shProducts').CylinderFormState) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} required />
        <Input label="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required />
        <Input label="Capacity" type="number" step="1" value={form.litres} onChange={(e) => setForm({ ...form, litres: e.target.value })} hint="litres" required />
        <Input label="Coil area" value={form.coil} onChange={(e) => setForm({ ...form, coil: e.target.value })} hint="e.g. 2.6 m²" />
        <Input label="Reheat time" value={form.reheat} onChange={(e) => setForm({ ...form, reheat: e.target.value })} hint="e.g. ~38 min" />
        <Input label="Cost Price" type="number" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} hint="£" />
        <Input label="RRP" type="number" step="0.01" value={form.rrp} onChange={(e) => setForm({ ...form, rrp: e.target.value })} hint="£" />
      </div>
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-primary-500 focus:ring-primary-500"
        />
        <span className="text-sm text-white">Active</span>
      </label>
    </div>
  );
}

export function RadiatorProductFields({
  form,
  setForm,
}: {
  form: import('../../../lib/shProducts').RadiatorFormState;
  setForm: (form: import('../../../lib/shProducts').RadiatorFormState) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} required />
        <Input label="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required />
        <Input label="Radiator type" value={form.rtype} onChange={(e) => setForm({ ...form, rtype: e.target.value })} hint="e.g. K2 (Type 22)" />
        <Input label="Type code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} hint="e.g. 11, 21, 22" />
        <Input label="n-factor" type="number" step="0.01" value={form.n} onChange={(e) => setForm({ ...form, n: e.target.value })} hint="EN 442 exponent" />
        <Input label="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        <Input label="Cost Price" type="number" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} hint="£" />
        <Input label="RRP" type="number" step="0.01" value={form.rrp} onChange={(e) => setForm({ ...form, rrp: e.target.value })} hint="£" />
      </div>
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-primary-500 focus:ring-primary-500"
        />
        <span className="text-sm text-white">Active</span>
      </label>
    </div>
  );
}
