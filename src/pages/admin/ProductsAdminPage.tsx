import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Package, 
  Search,
  Plus,
  Edit,
  Trash2,
  Battery,
  Cpu,
  Flame,
  Droplets,
  Heater,
  XCircle,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Tabs } from '../../components/ui/Tabs';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import type { BatteryProduct, InverterProduct, HeatPumpProduct, Manufacturer, DocumentBankCategory } from '../../types';
import { DOCUMENT_BANK_CATEGORIES } from '../../types';
import {
  batteryFormToDb,
  batteryFromDb,
  emptyBatteryForm,
  emptyHeatPumpForm,
  emptyInverterForm,
  getDocumentOptions,
  inverterFormToDb,
  inverterFromDb,
  type BatteryFormState,
  type HeatPumpFormState,
  type InverterFormState,
} from '../../lib/productSpecs';
import {
  BatteryProductFields,
  CylinderProductFields,
  HeatPumpProductFields,
  InverterProductFields,
  RadiatorProductFields,
} from '../../components/admin/products/ProductSpecFormFields';
import {
  ashpFormToRow,
  ashpFromRow,
  ashpRowToCatalogue,
  cylinderFormToRow,
  cylinderFromRow,
  emptyCylinderForm,
  emptyRadiatorForm,
  parseShData,
  radiatorFormToRow,
  radiatorFromRow,
  type CylinderFormState,
  type RadiatorFormState,
  type ShProductRow,
} from '../../lib/shProducts';
import { tagDocumentsProductType } from '../../lib/documentProductLinks';

interface BankDocument {
  id: string;
  name: string;
  category: DocumentBankCategory;
}

export function ProductsAdminPage() {
  const toast = useToast();
  const [batteries, setBatteries] = useState<BatteryProduct[]>([]);
  const [inverters, setInverters] = useState<InverterProduct[]>([]);
  const [heatPumps, setHeatPumps] = useState<HeatPumpProduct[]>([]);
  const [cylinders, setCylinders] = useState<ShProductRow[]>([]);
  const [radiators, setRadiators] = useState<ShProductRow[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [bankDocuments, setBankDocuments] = useState<BankDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageTab, setPageTab] = useState<'products' | 'manufacturers'>('products');
  const [listFilter, setListFilter] = useState<'all' | 'batteries' | 'inverters' | 'heat_pumps' | 'cylinders' | 'radiators'>('all');
  const [modalProductType, setModalProductType] = useState<'batteries' | 'inverters' | 'heat_pumps' | 'cylinders' | 'radiators'>('batteries');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  
  const [batteryForm, setBatteryForm] = useState<BatteryFormState>(emptyBatteryForm());
  const [inverterForm, setInverterForm] = useState<InverterFormState>(emptyInverterForm());
  const [heatPumpForm, setHeatPumpForm] = useState<HeatPumpFormState>(emptyHeatPumpForm());
  const [cylinderForm, setCylinderForm] = useState<CylinderFormState>(emptyCylinderForm());
  const [radiatorForm, setRadiatorForm] = useState<RadiatorFormState>(emptyRadiatorForm());

  const [manufacturerForm, setManufacturerForm] = useState({
    name: '',
    logo: '',
    website: '',
    supportEmail: '',
    isActive: true,
  });

  // Fetch all data
  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    await Promise.all([
      fetchManufacturers(),
      fetchBatteries(),
      fetchInverters(),
      fetchShProducts(),
      fetchBankDocuments(),
    ]);
  };

  const fetchBankDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, name, category')
        .in('category', [...DOCUMENT_BANK_CATEGORIES])
        .order('name');

      if (error) throw error;

      setBankDocuments((data || []) as BankDocument[]);
    } catch (error: any) {
      console.error('Error fetching bank documents:', error);
    }
  };

  const getDocumentOptionsFor = (category: DocumentBankCategory) =>
    getDocumentOptions(bankDocuments, category);

  const handleDocumentUploaded = (doc: {
    id: string;
    name: string;
    category: DocumentBankCategory;
  }) => {
    setBankDocuments((prev) => {
      if (prev.some((existing) => existing.id === doc.id)) return prev;
      return [...prev, doc].sort((a, b) => a.name.localeCompare(b.name));
    });
  };

  const loadProductForEdit = async (table: string, id: string) => {
    // sh_products is RLS-restricted; admin client is required to read SimpliHeat catalogue rows.
    const client = table === 'sh_products' ? supabaseAdmin : supabase;
    const { data, error } = await client.from(table).select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  };

  const fetchManufacturers = async () => {
    try {
      const { data, error } = await supabase
        .from('manufacturers')
        .select('*')
        .order('name');

      if (error) throw error;

      const mapped: Manufacturer[] = (data || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        logo: m.logo,
        website: m.website,
        supportEmail: m.support_email,
        isActive: m.is_active,
      }));

      setManufacturers(mapped);
    } catch (error: any) {
      console.error('Error fetching manufacturers:', error);
      toast.error('Failed to load manufacturers');
    }
  };

  const fetchBatteries = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('battery_products')
        .select(`
          *,
          manufacturers (id, name)
        `)
        .order('model');

      if (error) throw error;

      const mapped: BatteryProduct[] = (data || []).map((b: any) => ({
        id: b.id,
        model: b.model,
        manufacturerId: b.manufacturer_id,
        manufacturerName: b.manufacturers?.name || '',
        capacityKwh: b.capacity_kwh,
        powerKw: b.power_kw,
        chemistry: b.chemistry || 'LFP',
        cycleLife: b.cycle_life || 6000,
        efficiency: b.efficiency || 95,
        dimensions: b.dimensions || { width: 0, height: 0, depth: 0 },
        weight: b.weight || 0,
        warrantyYears: b.warranty_years,
        costPrice: b.cost_price,
        rrp: b.rrp,
        datasheetDocumentId: b.datasheet_document_id || '',
        userManualDocumentId: b.user_manual_document_id || '',
        consumerCodeLeafletDocumentId: b.consumer_code_leaflet_document_id || '',
        isActive: b.is_active,
      }));

      setBatteries(mapped);
    } catch (error: any) {
      console.error('Error fetching batteries:', error);
      toast.error('Failed to load batteries');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInverters = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('inverter_products')
        .select(`
          *,
          manufacturers (id, name)
        `)
        .order('model');

      if (error) throw error;

      const mapped: InverterProduct[] = (data || []).map((i: any) => ({
        id: i.id,
        model: i.model,
        manufacturerId: i.manufacturer_id,
        manufacturerName: i.manufacturers?.name || '',
        powerKw: i.power_kw,
        type: i.type || 'hybrid',
        phases: i.phases,
        mpptCount: i.mppt_count || 2,
        maxInputVoltage: i.max_input_voltage || 600,
        maxDcCurrent: i.max_dc_current,
        efficiency: i.efficiency,
        warrantyYears: i.warranty_years || 10,
        features: i.features || [],
        costPrice: i.cost_price,
        rrp: i.rrp,
        datasheetDocumentId: i.datasheet_document_id || '',
        userManualDocumentId: i.user_manual_document_id || '',
        consumerCodeLeafletDocumentId: i.consumer_code_leaflet_document_id || '',
        isActive: i.is_active,
      }));

      setInverters(mapped);
    } catch (error: any) {
      console.error('Error fetching inverters:', error);
      toast.error('Failed to load inverters');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchShProducts = async () => {
    try {
      // Centralized SimpliHeat catalogue (ashp / cylinder / radiator). RLS blocks the anon client.
      const { data, error } = await supabaseAdmin
        .from('sh_products')
        .select('*')
        .in('type', ['ashp', 'cylinder', 'radiator'])
        .order('brand');

      if (error) throw error;

      const rows = (data || []) as ShProductRow[];
      const ashps = rows.filter((r) => r.type === 'ashp');
      setHeatPumps(
        ashps.map((row) => {
          const mapped = ashpRowToCatalogue(row);
          return {
            id: mapped.id,
            brand: mapped.brand,
            model: mapped.model,
            nominalKw: mapped.nominalKw,
            outputW35Kw: mapped.outputW35Kw,
            copW35: mapped.copW35,
            isActive: mapped.isActive,
          } satisfies HeatPumpProduct;
        })
      );
      setCylinders(rows.filter((r) => r.type === 'cylinder'));
      setRadiators(rows.filter((r) => r.type === 'radiator'));
    } catch (error: any) {
      console.error('Error fetching SimpliHeat products:', error);
      toast.error('Failed to load heat pumps, cylinders, and radiators');
    }
  };

  // === BATTERY CRUD ===
  const handleCreateBattery = async () => {
    if (!batteryForm.code.trim()) {
      toast.error('Code is required');
      return;
    }
    try {
      setIsLoading(true);
      const { error } = await supabaseAdmin.from('battery_products').insert([batteryFormToDb(batteryForm)]);
      if (error) throw error;
      await tagDocumentsProductType(
        [
          batteryForm.datasheetDocumentId,
          batteryForm.userManualDocumentId,
        ],
        'battery'
      );
      await fetchBatteries();
      setIsAddModalOpen(false);
      setBatteryForm(emptyBatteryForm());
      toast.success('Battery added successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to add battery');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateBattery = async () => {
    if (!itemToEdit) return;
    try {
      setIsLoading(true);
      const { error } = await supabaseAdmin
        .from('battery_products')
        .update(batteryFormToDb(batteryForm, true))
        .eq('id', itemToEdit.id);
      if (error) throw error;
      await tagDocumentsProductType(
        [
          batteryForm.datasheetDocumentId,
          batteryForm.userManualDocumentId,
        ],
        'battery'
      );
      await fetchBatteries();
      setIsEditModalOpen(false);
      setItemToEdit(null);
      setBatteryForm(emptyBatteryForm());
      toast.success('Battery updated successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update battery');
    } finally {
      setIsLoading(false);
    }
  };

  // === INVERTER CRUD ===
  const handleCreateInverter = async () => {
    if (!inverterForm.code.trim()) {
      toast.error('Code is required');
      return;
    }
    try {
      setIsLoading(true);
      const { error } = await supabaseAdmin.from('inverter_products').insert([inverterFormToDb(inverterForm)]);
      if (error) throw error;
      await tagDocumentsProductType(
        [
          inverterForm.datasheetDocumentId,
          inverterForm.userManualDocumentId,
        ],
        'inverter'
      );
      await fetchInverters();
      setIsAddModalOpen(false);
      setInverterForm(emptyInverterForm());
      toast.success('Inverter added successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to add inverter');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateInverter = async () => {
    if (!itemToEdit) return;
    try {
      setIsLoading(true);
      const { error } = await supabaseAdmin
        .from('inverter_products')
        .update(inverterFormToDb(inverterForm, true))
        .eq('id', itemToEdit.id);
      if (error) throw error;
      await tagDocumentsProductType(
        [
          inverterForm.datasheetDocumentId,
          inverterForm.userManualDocumentId,
        ],
        'inverter'
      );
      await fetchInverters();
      setIsEditModalOpen(false);
      setItemToEdit(null);
      setInverterForm(emptyInverterForm());
      toast.success('Inverter updated successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update inverter');
    } finally {
      setIsLoading(false);
    }
  };

  // === HEAT PUMP CRUD (sh_products type=ashp) ===
  const heatPumpFormToAshpPayload = (form: HeatPumpFormState) =>
    ashpFormToRow({
      brand: form.brand,
      model: form.model,
      nominalKw: form.nominalKw,
      phases: form.phases,
      outputW35Kw: form.outputW35Kw,
      copW35: form.copW35,
      outputW55Kw: form.outputW55Kw,
      copW55: form.copW55,
      minModulationKw: form.minModulationKw,
      maxOutputKw: form.maxOutputKw,
      ratedFlowM3h: form.ratedFlowM3h,
      soundPressure1mDba: form.soundPressure1mDba,
      weightKg: form.weightKg,
      dimensionsLwhMm: form.dimensionsLwhMm,
      r290ChargeKg: form.r290ChargeKg,
      costPrice: form.costPrice,
      rrp: form.rrp,
      isActive: form.isActive,
    });

  const handleCreateHeatPump = async () => {
    if (!heatPumpForm.brand.trim() || !heatPumpForm.model.trim()) {
      toast.error('Brand and model are required');
      return;
    }
    try {
      setIsLoading(true);
      const { error } = await supabaseAdmin.from('sh_products').insert([heatPumpFormToAshpPayload(heatPumpForm)]);
      if (error) throw error;
      await tagDocumentsProductType(
        [
          heatPumpForm.datasheetDocumentId,
          heatPumpForm.userManualDocumentId,
        ],
        'heat_pump'
      );
      await fetchShProducts();
      setIsAddModalOpen(false);
      setHeatPumpForm(emptyHeatPumpForm());
      toast.success('Heat pump added successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to add heat pump');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateHeatPump = async () => {
    if (!itemToEdit) return;
    try {
      setIsLoading(true);
      const { error } = await supabaseAdmin
        .from('sh_products')
        .update(heatPumpFormToAshpPayload(heatPumpForm))
        .eq('id', itemToEdit.id);
      if (error) throw error;
      await tagDocumentsProductType(
        [
          heatPumpForm.datasheetDocumentId,
          heatPumpForm.userManualDocumentId,
        ],
        'heat_pump'
      );
      await fetchShProducts();
      setIsEditModalOpen(false);
      setItemToEdit(null);
      setHeatPumpForm(emptyHeatPumpForm());
      toast.success('Heat pump updated successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update heat pump');
    } finally {
      setIsLoading(false);
    }
  };

  // === CYLINDER / RADIATOR (sh_products) ===
  const handleCreateCylinder = async () => {
    if (!cylinderForm.brand.trim() || !cylinderForm.model.trim()) {
      toast.error('Brand and model are required');
      return;
    }
    try {
      setIsLoading(true);
      const { error } = await supabaseAdmin.from('sh_products').insert([cylinderFormToRow(cylinderForm)]);
      if (error) throw error;
      await fetchShProducts();
      setIsAddModalOpen(false);
      setCylinderForm(emptyCylinderForm());
      toast.success('Cylinder added successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to add cylinder');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateCylinder = async () => {
    if (!itemToEdit) return;
    try {
      setIsLoading(true);
      const { error } = await supabaseAdmin
        .from('sh_products')
        .update(cylinderFormToRow(cylinderForm))
        .eq('id', itemToEdit.id);
      if (error) throw error;
      await fetchShProducts();
      setIsEditModalOpen(false);
      setItemToEdit(null);
      setCylinderForm(emptyCylinderForm());
      toast.success('Cylinder updated successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update cylinder');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRadiator = async () => {
    if (!radiatorForm.brand.trim() || !radiatorForm.model.trim()) {
      toast.error('Brand and model are required');
      return;
    }
    try {
      setIsLoading(true);
      const { error } = await supabaseAdmin.from('sh_products').insert([radiatorFormToRow(radiatorForm)]);
      if (error) throw error;
      await fetchShProducts();
      setIsAddModalOpen(false);
      setRadiatorForm(emptyRadiatorForm());
      toast.success('Radiator added successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to add radiator');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateRadiator = async () => {
    if (!itemToEdit) return;
    try {
      setIsLoading(true);
      const { error } = await supabaseAdmin
        .from('sh_products')
        .update(radiatorFormToRow(radiatorForm))
        .eq('id', itemToEdit.id);
      if (error) throw error;
      await fetchShProducts();
      setIsEditModalOpen(false);
      setItemToEdit(null);
      setRadiatorForm(emptyRadiatorForm());
      toast.success('Radiator updated successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update radiator');
    } finally {
      setIsLoading(false);
    }
  };

  // === MANUFACTURER CRUD ===
  const handleCreateManufacturer = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabaseAdmin.from('manufacturers').insert([{
        name: manufacturerForm.name,
        logo: manufacturerForm.logo || null,
        website: manufacturerForm.website || null,
        support_email: manufacturerForm.supportEmail || null,
        is_active: manufacturerForm.isActive,
      }]);
      if (error) throw error;
      await fetchManufacturers();
      setIsAddModalOpen(false);
      resetManufacturerForm();
      toast.success('Manufacturer added successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to add manufacturer');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateManufacturer = async () => {
    if (!itemToEdit) return;
    try {
      setIsLoading(true);
      const { error } = await supabaseAdmin.from('manufacturers').update({
        name: manufacturerForm.name,
        logo: manufacturerForm.logo || null,
        website: manufacturerForm.website || null,
        support_email: manufacturerForm.supportEmail || null,
        is_active: manufacturerForm.isActive,
      }).eq('id', itemToEdit.id);
      if (error) throw error;
      await fetchManufacturers();
      setIsEditModalOpen(false);
      setItemToEdit(null);
      resetManufacturerForm();
      toast.success('Manufacturer updated successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update manufacturer');
    } finally {
      setIsLoading(false);
    }
  };

  // === DELETE (Universal) ===
  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      setIsLoading(true);
      const table =
        itemToDelete.productType === 'batteries' ? 'battery_products'
        : itemToDelete.productType === 'inverters' ? 'inverter_products'
        : itemToDelete.productType === 'heat_pumps' ||
          itemToDelete.productType === 'cylinders' ||
          itemToDelete.productType === 'radiators'
          ? 'sh_products'
        : 'manufacturers';
      const { error } = await supabaseAdmin.from(table).delete().eq('id', itemToDelete.id);
      if (error) throw error;

      if (itemToDelete.productType === 'batteries') await fetchBatteries();
      else if (itemToDelete.productType === 'inverters') await fetchInverters();
      else if (
        itemToDelete.productType === 'heat_pumps' ||
        itemToDelete.productType === 'cylinders' ||
        itemToDelete.productType === 'radiators'
      ) await fetchShProducts();
      else await fetchManufacturers();

      setIsDeleteModalOpen(false);
      setItemToDelete(null);
      toast.success('Deleted successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete item');
    } finally {
      setIsLoading(false);
    }
  };

  const resetBatteryForm = () => setBatteryForm(emptyBatteryForm());
  const resetInverterForm = () => setInverterForm(emptyInverterForm());
  const resetHeatPumpForm = () => setHeatPumpForm(emptyHeatPumpForm());
  const resetCylinderForm = () => setCylinderForm(emptyCylinderForm());
  const resetRadiatorForm = () => setRadiatorForm(emptyRadiatorForm());

  const resetManufacturerForm = () => {
    setManufacturerForm({
      name: '', logo: '', website: '', supportEmail: '', isActive: true,
    });
  };

  const handleAddClick = () => {
    if (pageTab === 'manufacturers') {
      resetManufacturerForm();
      setIsAddModalOpen(true);
      return;
    }
    resetBatteryForm();
    resetInverterForm();
    resetHeatPumpForm();
    resetCylinderForm();
    resetRadiatorForm();
    setModalProductType('batteries');
    setIsAddModalOpen(true);
  };

  const handleEditClick = async (item: any) => {
    setItemToEdit(item);
    try {
      setIsLoading(true);
      if (item.productType === 'batteries') {
        const data = await loadProductForEdit('battery_products', item.id);
        setBatteryForm(batteryFromDb(data));
        setModalProductType('batteries');
      } else if (item.productType === 'inverters') {
        const data = await loadProductForEdit('inverter_products', item.id);
        setInverterForm(inverterFromDb(data));
        setModalProductType('inverters');
      } else if (item.productType === 'heat_pumps') {
        const data = await loadProductForEdit('sh_products', item.id);
        const ashp = ashpFromRow(data as ShProductRow);
        setHeatPumpForm({
          ...emptyHeatPumpForm(),
          brand: ashp.brand,
          model: ashp.model,
          nominalKw: ashp.nominalKw,
          phases: ashp.phases,
          outputW35Kw: ashp.outputW35Kw,
          copW35: ashp.copW35,
          outputW55Kw: ashp.outputW55Kw,
          copW55: ashp.copW55,
          minModulationKw: ashp.minModulationKw,
          maxOutputKw: ashp.maxOutputKw,
          ratedFlowM3h: ashp.ratedFlowM3h,
          soundPressure1mDba: ashp.soundPressure1mDba,
          weightKg: ashp.weightKg,
          dimensionsLwhMm: ashp.dimensionsLwhMm,
          r290ChargeKg: ashp.r290ChargeKg,
          costPrice: ashp.costPrice,
          rrp: ashp.rrp,
          isActive: ashp.isActive,
        });
        setModalProductType('heat_pumps');
      } else if (item.productType === 'cylinders') {
        const data = await loadProductForEdit('sh_products', item.id);
        setCylinderForm(cylinderFromRow(data as ShProductRow));
        setModalProductType('cylinders');
      } else if (item.productType === 'radiators') {
        const data = await loadProductForEdit('sh_products', item.id);
        setRadiatorForm(radiatorFromRow(data as ShProductRow));
        setModalProductType('radiators');
      } else {
        setManufacturerForm({
          name: item.name,
          logo: item.logo || '',
          website: item.website || '',
          supportEmail: item.supportEmail || '',
          isActive: item.isActive,
        });
      }
      setIsEditModalOpen(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load product');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (item: any) => {
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
  };

  const pageTabs = [
    {
      id: 'products',
      label: 'Products',
      badge: batteries.length + inverters.length + heatPumps.length + cylinders.length + radiators.length,
    },
    { id: 'manufacturers', label: 'Manufacturers', badge: manufacturers.length },
  ];

  const productTypeTabs = [
    { id: 'batteries', label: 'Batteries', icon: <Battery className="w-4 h-4" /> },
    { id: 'inverters', label: 'Inverters', icon: <Cpu className="w-4 h-4" /> },
    { id: 'heat_pumps', label: 'Heat Pumps', icon: <Flame className="w-4 h-4" /> },
    { id: 'cylinders', label: 'Cylinders', icon: <Droplets className="w-4 h-4" /> },
    { id: 'radiators', label: 'Radiators', icon: <Heater className="w-4 h-4" /> },
  ];

  type CatalogueRow = {
    id: string;
    productType: 'batteries' | 'inverters' | 'heat_pumps' | 'cylinders' | 'radiators';
    name: string;
    brand: string;
    detail: string;
    isActive: boolean;
  };

  const catalogueRows: CatalogueRow[] = [
    ...batteries.map((b) => ({
      id: b.id,
      productType: 'batteries' as const,
      name: b.model,
      brand: b.manufacturerName,
      detail: `${b.capacityKwh ?? '—'} kWh · ${b.powerKw ?? '—'} kW`,
      isActive: b.isActive,
    })),
    ...inverters.map((i) => ({
      id: i.id,
      productType: 'inverters' as const,
      name: i.model,
      brand: i.manufacturerName,
      detail: `${i.powerKw ?? '—'} kW · ${i.phases ?? '—'} ph · ${i.efficiency ?? '—'}%`,
      isActive: i.isActive,
    })),
    ...heatPumps.map((h) => ({
      id: h.id,
      productType: 'heat_pumps' as const,
      name: h.model,
      brand: h.brand || h.manufacturerName || '',
      detail: `Nominal ${h.nominalKw ?? '—'} kW · W35 ${h.outputW35Kw ?? '—'} / ${h.copW35 ?? '—'}`,
      isActive: h.isActive,
    })),
    ...cylinders.map((c) => {
      const data = parseShData(c.data);
      return {
        id: String(c.id),
        productType: 'cylinders' as const,
        name: c.model,
        brand: c.brand,
        detail: `${data.litres ?? '—'} L · coil ${data.coil ?? '—'} · ${data.reheat ?? '—'}`,
        isActive: c.active,
      };
    }),
    ...radiators.map((r) => {
      const data = parseShData(r.data);
      return {
        id: String(r.id),
        productType: 'radiators' as const,
        name: r.model,
        brand: r.brand,
        detail: `${data.rtype ?? '—'} · n=${data.n ?? '—'}`,
        isActive: r.active,
      };
    }),
  ];

  const productTypeLabel = (type: CatalogueRow['productType']) =>
    type === 'batteries' ? 'Battery'
    : type === 'inverters' ? 'Inverter'
    : type === 'heat_pumps' ? 'Heat Pump'
    : type === 'cylinders' ? 'Cylinder'
    : 'Radiator';

  const platformLabel = (type: CatalogueRow['productType']) =>
    type === 'batteries' || type === 'inverters' ? 'Helios' : 'SimpliHeat';

  const filteredCatalogue = catalogueRows.filter((row) => {
    if (listFilter !== 'all' && row.productType !== listFilter) return false;
    const q = searchTerm.toLowerCase();
    const platform = platformLabel(row.productType).toLowerCase();
    return (
      row.name.toLowerCase().includes(q) ||
      row.brand.toLowerCase().includes(q) ||
      row.detail.toLowerCase().includes(q) ||
      platform.includes(q)
    );
  });

  const closeProductModal = () => {
    setIsAddModalOpen(false);
    setIsEditModalOpen(false);
    setItemToEdit(null);
    resetBatteryForm();
    resetInverterForm();
    resetHeatPumpForm();
    resetCylinderForm();
    resetRadiatorForm();
  };

  const catalogueColumns = [
    {
      key: 'product',
      header: 'Product',
      render: (row: CatalogueRow) => (
        <div>
          <p className="font-medium text-white">{row.name}</p>
          <p className="text-sm text-slate-500">{row.brand || '—'}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row: CatalogueRow) => (
        <Badge variant="slate">{productTypeLabel(row.productType)}</Badge>
      ),
    },
    {
      key: 'platform',
      header: 'Platform',
      render: (row: CatalogueRow) => {
        const platform = platformLabel(row.productType);
        return (
          <Badge variant={platform === 'Helios' ? 'warning' : 'primary'}>
            {platform}
          </Badge>
        );
      },
    },
    {
      key: 'detail',
      header: 'Specs',
      render: (row: CatalogueRow) => (
        <span className="text-slate-300 text-sm">{row.detail}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: CatalogueRow) => (
        <Badge variant={row.isActive ? 'success' : 'slate'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (row: CatalogueRow) => (
        <div className="flex items-center gap-1 justify-end">
          <button
            onClick={() => handleEditClick(row)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteClick(row)}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const handleSaveProduct = () => {
    if (itemToEdit) {
      if (modalProductType === 'batteries') return handleUpdateBattery();
      if (modalProductType === 'inverters') return handleUpdateInverter();
      if (modalProductType === 'heat_pumps') return handleUpdateHeatPump();
      if (modalProductType === 'cylinders') return handleUpdateCylinder();
      return handleUpdateRadiator();
    }
    if (modalProductType === 'batteries') return handleCreateBattery();
    if (modalProductType === 'inverters') return handleCreateInverter();
    if (modalProductType === 'heat_pumps') return handleCreateHeatPump();
    if (modalProductType === 'cylinders') return handleCreateCylinder();
    return handleCreateRadiator();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">Product Catalogue</h1>
          <p className="page-subtitle">Manage batteries, inverters, heat pumps, cylinders, radiators, and manufacturers</p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={handleAddClick}>
          {pageTab === 'manufacturers' ? 'Add Manufacturer' : 'Add Product'}
        </Button>
      </div>

      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px] max-w-md">
            <Input
              placeholder={pageTab === 'manufacturers' ? 'Search manufacturers...' : 'Search products...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          {pageTab === 'products' && (
            <select
              value={listFilter}
              onChange={(e) => setListFilter(e.target.value as typeof listFilter)}
              className="input w-auto min-w-[160px]"
            >
              <option value="all">All types</option>
              <option value="batteries">Batteries</option>
              <option value="inverters">Inverters</option>
              <option value="heat_pumps">Heat Pumps</option>
              <option value="cylinders">Cylinders</option>
              <option value="radiators">Radiators</option>
            </select>
          )}
          <Tabs
            tabs={pageTabs}
            activeTab={pageTab}
            onChange={(id) => {
              setPageTab(id as 'products' | 'manufacturers');
              setSearchTerm('');
            }}
            variant="pills"
          />
        </div>
      </Card>

      {pageTab === 'products' && (
        <Table
          columns={catalogueColumns}
          data={filteredCatalogue}
          keyExtractor={(row) => `${row.productType}-${row.id}`}
          emptyMessage="No products found"
        />
      )}

      {pageTab === 'manufacturers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {manufacturers
            .filter((m) => m.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .map((mfr, index) => (
            <motion.div
              key={mfr.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center">
                      {mfr.logo ? (
                        <img src={mfr.logo} alt={mfr.name} className="w-8 h-8 object-contain" />
                      ) : (
                        <Package className="w-6 h-6 text-slate-500" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{mfr.name}</h3>
                      <Badge variant={mfr.isActive ? 'success' : 'slate'}>
                        {mfr.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEditClick({ ...mfr, productType: 'manufacturers' })}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick({ ...mfr, productType: 'manufacturers' })}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="text-sm space-y-2">
                  {mfr.website && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Website</span>
                      <a href={mfr.website} target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:text-primary-300">
                        Visit
                      </a>
                    </div>
                  )}
                  {mfr.supportEmail && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Support</span>
                      <span className="text-slate-300">{mfr.supportEmail}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Products</span>
                    <span className="text-slate-300">
                      {batteries.filter((b) => b.manufacturerId === mfr.id).length +
                        inverters.filter((i) => i.manufacturerId === mfr.id).length}
                    </span>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {pageTab === 'products' && (isAddModalOpen || isEditModalOpen) && (
        <Modal
          isOpen={isAddModalOpen || isEditModalOpen}
          onClose={closeProductModal}
          title={
            itemToEdit
              ? `Edit ${productTypeLabel(modalProductType)}`
              : 'Add Product'
          }
          size="xl"
        >
          {!itemToEdit && (
            <div className="mb-6">
              <Tabs
                tabs={productTypeTabs}
                activeTab={modalProductType}
                onChange={(id) => setModalProductType(id as typeof modalProductType)}
                variant="pills"
              />
            </div>
          )}

          {modalProductType === 'batteries' && (
            <BatteryProductFields
              form={batteryForm}
              setForm={setBatteryForm}
              manufacturers={manufacturers}
              getDocumentOptionsFor={getDocumentOptionsFor}
              onDocumentUploaded={handleDocumentUploaded}
            />
          )}
          {modalProductType === 'inverters' && (
            <InverterProductFields
              form={inverterForm}
              setForm={setInverterForm}
              manufacturers={manufacturers}
              getDocumentOptionsFor={getDocumentOptionsFor}
              onDocumentUploaded={handleDocumentUploaded}
            />
          )}
          {modalProductType === 'heat_pumps' && (
            <HeatPumpProductFields
              form={heatPumpForm}
              setForm={setHeatPumpForm}
              getDocumentOptionsFor={getDocumentOptionsFor}
              onDocumentUploaded={handleDocumentUploaded}
            />
          )}
          {modalProductType === 'cylinders' && (
            <CylinderProductFields form={cylinderForm} setForm={setCylinderForm} />
          )}
          {modalProductType === 'radiators' && (
            <RadiatorProductFields form={radiatorForm} setForm={setRadiatorForm} />
          )}

          <div className="flex gap-3 mt-6">
            <Button variant="secondary" onClick={closeProductModal} className="flex-1">Cancel</Button>
            <Button onClick={handleSaveProduct} className="flex-1" isLoading={isLoading}>
              {itemToEdit ? 'Update' : 'Save'}
            </Button>
          </div>
        </Modal>
      )}

      {pageTab === 'manufacturers' && (isAddModalOpen || isEditModalOpen) && (
        <Modal
          isOpen={isAddModalOpen || isEditModalOpen}
          onClose={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); setItemToEdit(null); resetManufacturerForm(); }}
          title={itemToEdit ? 'Edit Manufacturer' : 'Add Manufacturer'}
          size="md"
        >
          <div className="space-y-4">
            <Input label="Name" value={manufacturerForm.name} onChange={(e) => setManufacturerForm({ ...manufacturerForm, name: e.target.value })} required />
            <Input label="Logo URL" value={manufacturerForm.logo} onChange={(e) => setManufacturerForm({ ...manufacturerForm, logo: e.target.value })} placeholder="https://..." />
            <Input label="Website" value={manufacturerForm.website} onChange={(e) => setManufacturerForm({ ...manufacturerForm, website: e.target.value })} placeholder="https://..." />
            <Input label="Support Email" type="email" value={manufacturerForm.supportEmail} onChange={(e) => setManufacturerForm({ ...manufacturerForm, supportEmail: e.target.value })} placeholder="support@company.com" />
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="font-medium text-white">Active</span>
                <button type="button" onClick={() => setManufacturerForm({ ...manufacturerForm, isActive: !manufacturerForm.isActive })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${manufacturerForm.isActive ? 'bg-green-600' : 'bg-slate-700'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${manufacturerForm.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="secondary" onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); setItemToEdit(null); resetManufacturerForm(); }} className="flex-1">Cancel</Button>
              <Button onClick={itemToEdit ? handleUpdateManufacturer : handleCreateManufacturer} className="flex-1" isLoading={isLoading}>{itemToEdit ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </Modal>
      )}

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => { setIsDeleteModalOpen(false); setItemToDelete(null); }}
        title="Delete item"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-white mb-1">Are you sure you want to delete this item?</p>
              <p className="text-sm text-slate-400">This action cannot be undone. Item: <span className="font-medium text-white">{itemToDelete?.name || itemToDelete?.model}</span></p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { setIsDeleteModalOpen(false); setItemToDelete(null); }} className="flex-1" disabled={isLoading}>Cancel</Button>
            <Button onClick={confirmDelete} className="flex-1 bg-red-600 hover:bg-red-700 text-white" isLoading={isLoading}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
