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
import type { BatteryProduct, InverterProduct, Manufacturer } from '../../types';

export function ProductsAdminPage() {
  const toast = useToast();
  const [batteries, setBatteries] = useState<BatteryProduct[]>([]);
  const [inverters, setInverters] = useState<InverterProduct[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('batteries');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  
  // Form data states
  const [batteryForm, setBatteryForm] = useState({
    model: '',
    manufacturerId: '',
    capacityKwh: '',
    powerKw: '',
    warrantyYears: '',
    costPrice: '',
    rrp: '',
    isActive: true,
  });

  const [inverterForm, setInverterForm] = useState({
    model: '',
    manufacturerId: '',
    powerKw: '',
    phases: '1',
    efficiency: '',
    costPrice: '',
    rrp: '',
    isActive: true,
  });

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
    await Promise.all([fetchManufacturers(), fetchBatteries(), fetchInverters()]);
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

  // === BATTERY CRUD ===
  const handleCreateBattery = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabaseAdmin.from('battery_products').insert([{
        model: batteryForm.model,
        manufacturer_id: batteryForm.manufacturerId,
        capacity_kwh: parseFloat(batteryForm.capacityKwh),
        power_kw: parseFloat(batteryForm.powerKw),
        warranty_years: parseInt(batteryForm.warrantyYears),
        cost_price: parseFloat(batteryForm.costPrice),
        rrp: parseFloat(batteryForm.rrp),
        is_active: batteryForm.isActive,
      }]);
      if (error) throw error;
      await fetchBatteries();
      setIsAddModalOpen(false);
      resetBatteryForm();
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
      const { error } = await supabaseAdmin.from('battery_products').update({
        model: batteryForm.model,
        manufacturer_id: batteryForm.manufacturerId,
        capacity_kwh: parseFloat(batteryForm.capacityKwh),
        power_kw: parseFloat(batteryForm.powerKw),
        warranty_years: parseInt(batteryForm.warrantyYears),
        cost_price: parseFloat(batteryForm.costPrice),
        rrp: parseFloat(batteryForm.rrp),
        is_active: batteryForm.isActive,
      }).eq('id', itemToEdit.id);
      if (error) throw error;
      await fetchBatteries();
      setIsEditModalOpen(false);
      setItemToEdit(null);
      resetBatteryForm();
      toast.success('Battery updated successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update battery');
    } finally {
      setIsLoading(false);
    }
  };

  // === INVERTER CRUD ===
  const handleCreateInverter = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabaseAdmin.from('inverter_products').insert([{
        model: inverterForm.model,
        manufacturer_id: inverterForm.manufacturerId,
        power_kw: parseFloat(inverterForm.powerKw),
        phases: parseInt(inverterForm.phases),
        efficiency: parseFloat(inverterForm.efficiency),
        cost_price: parseFloat(inverterForm.costPrice),
        rrp: parseFloat(inverterForm.rrp),
        is_active: inverterForm.isActive,
      }]);
      if (error) throw error;
      await fetchInverters();
      setIsAddModalOpen(false);
      resetInverterForm();
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
      const { error } = await supabaseAdmin.from('inverter_products').update({
        model: inverterForm.model,
        manufacturer_id: inverterForm.manufacturerId,
        power_kw: parseFloat(inverterForm.powerKw),
        phases: parseInt(inverterForm.phases),
        efficiency: parseFloat(inverterForm.efficiency),
        cost_price: parseFloat(inverterForm.costPrice),
        rrp: parseFloat(inverterForm.rrp),
        is_active: inverterForm.isActive,
      }).eq('id', itemToEdit.id);
      if (error) throw error;
      await fetchInverters();
      setIsEditModalOpen(false);
      setItemToEdit(null);
      resetInverterForm();
      toast.success('Inverter updated successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update inverter');
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
      const table = activeTab === 'batteries' ? 'battery_products' : 
                    activeTab === 'inverters' ? 'inverter_products' : 'manufacturers';
      const { error } = await supabaseAdmin.from(table).delete().eq('id', itemToDelete.id);
      if (error) throw error;
      
      if (activeTab === 'batteries') await fetchBatteries();
      else if (activeTab === 'inverters') await fetchInverters();
      else await fetchManufacturers();

      setIsDeleteModalOpen(false);
      setItemToDelete(null);
      toast.success(`${activeTab.slice(0, -1)} deleted successfully!`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete item');
    } finally {
      setIsLoading(false);
    }
  };

  // === FORM HELPERS ===
  const resetBatteryForm = () => {
    setBatteryForm({
      model: '', manufacturerId: '', capacityKwh: '', powerKw: '',
      warrantyYears: '', costPrice: '', rrp: '', isActive: true,
    });
  };

  const resetInverterForm = () => {
    setInverterForm({
      model: '', manufacturerId: '', powerKw: '', phases: '1',
      efficiency: '', costPrice: '', rrp: '', isActive: true,
    });
  };

  const resetManufacturerForm = () => {
    setManufacturerForm({
      name: '', logo: '', website: '', supportEmail: '', isActive: true,
    });
  };

  const handleAddClick = () => {
    resetBatteryForm();
    resetInverterForm();
    resetManufacturerForm();
    setIsAddModalOpen(true);
  };

  const handleEditClick = (item: any) => {
    setItemToEdit(item);
    if (activeTab === 'batteries') {
      setBatteryForm({
        model: item.model,
        manufacturerId: item.manufacturerId,
        capacityKwh: item.capacityKwh.toString(),
        powerKw: item.powerKw.toString(),
        warrantyYears: item.warrantyYears.toString(),
        costPrice: item.costPrice.toString(),
        rrp: item.rrp.toString(),
        isActive: item.isActive,
      });
    } else if (activeTab === 'inverters') {
      setInverterForm({
        model: item.model,
        manufacturerId: item.manufacturerId,
        powerKw: item.powerKw.toString(),
        phases: item.phases.toString(),
        efficiency: item.efficiency.toString(),
        costPrice: item.costPrice.toString(),
        rrp: item.rrp.toString(),
        isActive: item.isActive,
      });
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
  };

  const handleDeleteClick = (item: any) => {
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
  };

  const tabs = [
    { id: 'batteries', label: 'Batteries', icon: <Battery className="w-4 h-4" />, badge: batteries.length },
    { id: 'inverters', label: 'Inverters', icon: <Cpu className="w-4 h-4" />, badge: inverters.length },
    { id: 'manufacturers', label: 'Manufacturers', badge: manufacturers.length },
  ];

  const filteredBatteries = batteries.filter(b =>
    b.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.manufacturerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredInverters = inverters.filter(i =>
    i.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.manufacturerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const batteryColumns = [
    {
      key: 'model',
      header: 'Product',
      render: (battery: BatteryProduct) => (
        <div>
          <p className="font-medium text-white">{battery.model}</p>
          <p className="text-sm text-slate-500">{battery.manufacturerName}</p>
        </div>
      ),
    },
    {
      key: 'capacity',
      header: 'Capacity',
      render: (battery: BatteryProduct) => (
        <span className="text-slate-300">{battery.capacityKwh} kWh</span>
      ),
    },
    {
      key: 'power',
      header: 'Power',
      render: (battery: BatteryProduct) => (
        <span className="text-slate-300">{battery.powerKw} kW</span>
      ),
    },
    {
      key: 'warranty',
      header: 'Warranty',
      render: (battery: BatteryProduct) => (
        <span className="text-slate-300">{battery.warrantyYears} years</span>
      ),
    },
    {
      key: 'cost',
      header: 'Cost',
      align: 'right' as const,
      render: (battery: BatteryProduct) => (
        <span className="text-slate-300">£{battery.costPrice.toLocaleString()}</span>
      ),
    },
    {
      key: 'rrp',
      header: 'RRP',
      align: 'right' as const,
      render: (battery: BatteryProduct) => (
        <span className="text-white font-medium">£{battery.rrp.toLocaleString()}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (battery: BatteryProduct) => (
        <Badge variant={battery.isActive ? 'success' : 'slate'}>
          {battery.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (battery: BatteryProduct) => (
        <div className="flex items-center gap-1 justify-end">
          <button 
            onClick={() => handleEditClick(battery)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button 
            onClick={() => handleDeleteClick(battery)}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const inverterColumns = [
    {
      key: 'model',
      header: 'Product',
      render: (inverter: InverterProduct) => (
        <div>
          <p className="font-medium text-white">{inverter.model}</p>
          <p className="text-sm text-slate-500">{inverter.manufacturerName}</p>
        </div>
      ),
    },
    {
      key: 'power',
      header: 'Power',
      render: (inverter: InverterProduct) => (
        <span className="text-slate-300">{inverter.powerKw} kW</span>
      ),
    },
    {
      key: 'phases',
      header: 'Phases',
      render: (inverter: InverterProduct) => (
        <span className="text-slate-300">{inverter.phases} Phase</span>
      ),
    },
    {
      key: 'efficiency',
      header: 'Efficiency',
      render: (inverter: InverterProduct) => (
        <span className="text-slate-300">{inverter.efficiency}%</span>
      ),
    },
    {
      key: 'cost',
      header: 'Cost',
      align: 'right' as const,
      render: (inverter: InverterProduct) => (
        <span className="text-slate-300">£{inverter.costPrice.toLocaleString()}</span>
      ),
    },
    {
      key: 'rrp',
      header: 'RRP',
      align: 'right' as const,
      render: (inverter: InverterProduct) => (
        <span className="text-white font-medium">£{inverter.rrp.toLocaleString()}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (inverter: InverterProduct) => (
        <Badge variant={inverter.isActive ? 'success' : 'slate'}>
          {inverter.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (inverter: InverterProduct) => (
        <div className="flex items-center gap-1 justify-end">
          <button 
            onClick={() => handleEditClick(inverter)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button 
            onClick={() => handleDeleteClick(inverter)}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title">Product Catalogue</h1>
          <p className="page-subtitle">Manage batteries, inverters, and manufacturers</p>
        </div>
        <Button 
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={handleAddClick}
        >
          Add Product
        </Button>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px] max-w-md">
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} variant="pills" />
        </div>
      </Card>

      {/* Products Tables */}
      {activeTab === 'batteries' && (
        <Table
          columns={batteryColumns}
          data={filteredBatteries}
          keyExtractor={(battery) => battery.id}
          emptyMessage="No batteries found"
        />
      )}

      {activeTab === 'inverters' && (
        <Table
          columns={inverterColumns}
          data={filteredInverters}
          keyExtractor={(inverter) => inverter.id}
          emptyMessage="No inverters found"
        />
      )}

      {activeTab === 'manufacturers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {manufacturers.map((mfr, index) => (
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
                      onClick={() => handleEditClick(mfr)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteClick(mfr)}
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
                      {batteries.filter(b => b.manufacturerId === mfr.id).length + 
                       inverters.filter(i => i.manufacturerId === mfr.id).length}
                    </span>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modals - Battery */}
      {activeTab === 'batteries' && (isAddModalOpen || isEditModalOpen) && (
        <Modal
          isOpen={isAddModalOpen || isEditModalOpen}
          onClose={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); setItemToEdit(null); resetBatteryForm(); }}
          title={itemToEdit ? 'Edit Battery' : 'Add Battery'}
          size="lg"
        >
          <div className="space-y-4">
            <Select
              label="Manufacturer"
              value={batteryForm.manufacturerId}
              onChange={(e) => setBatteryForm({ ...batteryForm, manufacturerId: e.target.value })}
              options={manufacturers.map(m => ({ value: m.id, label: m.name }))}
              required
            />
            <Input label="Model" value={batteryForm.model} onChange={(e) => setBatteryForm({ ...batteryForm, model: e.target.value })} required />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Capacity (kWh)" type="number" step="0.1" value={batteryForm.capacityKwh} onChange={(e) => setBatteryForm({ ...batteryForm, capacityKwh: e.target.value })} required />
              <Input label="Power (kW)" type="number" step="0.1" value={batteryForm.powerKw} onChange={(e) => setBatteryForm({ ...batteryForm, powerKw: e.target.value })} required />
            </div>
            <Input label="Warranty (Years)" type="number" value={batteryForm.warrantyYears} onChange={(e) => setBatteryForm({ ...batteryForm, warrantyYears: e.target.value })} required />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Cost Price (£)" type="number" step="0.01" value={batteryForm.costPrice} onChange={(e) => setBatteryForm({ ...batteryForm, costPrice: e.target.value })} required />
              <Input label="RRP (£)" type="number" step="0.01" value={batteryForm.rrp} onChange={(e) => setBatteryForm({ ...batteryForm, rrp: e.target.value })} required />
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="font-medium text-white">Active</span>
                <button type="button" onClick={() => setBatteryForm({ ...batteryForm, isActive: !batteryForm.isActive })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${batteryForm.isActive ? 'bg-green-600' : 'bg-slate-700'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${batteryForm.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="secondary" onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); setItemToEdit(null); }} className="flex-1">Cancel</Button>
              <Button onClick={itemToEdit ? handleUpdateBattery : handleCreateBattery} className="flex-1" isLoading={isLoading}>{itemToEdit ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modals - Inverter */}
      {activeTab === 'inverters' && (isAddModalOpen || isEditModalOpen) && (
        <Modal
          isOpen={isAddModalOpen || isEditModalOpen}
          onClose={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); setItemToEdit(null); resetInverterForm(); }}
          title={itemToEdit ? 'Edit Inverter' : 'Add Inverter'}
          size="lg"
        >
          <div className="space-y-4">
            <Select
              label="Manufacturer"
              value={inverterForm.manufacturerId}
              onChange={(e) => setInverterForm({ ...inverterForm, manufacturerId: e.target.value })}
              options={manufacturers.map(m => ({ value: m.id, label: m.name }))}
              required
            />
            <Input label="Model" value={inverterForm.model} onChange={(e) => setInverterForm({ ...inverterForm, model: e.target.value })} required />
            <div className="grid grid-cols-3 gap-4">
              <Input label="Power (kW)" type="number" step="0.1" value={inverterForm.powerKw} onChange={(e) => setInverterForm({ ...inverterForm, powerKw: e.target.value })} required />
              <Select label="Phases" value={inverterForm.phases} onChange={(e) => setInverterForm({ ...inverterForm, phases: e.target.value })} options={[{ value: '1', label: '1 Phase' }, { value: '3', label: '3 Phase' }]} />
              <Input label="Efficiency (%)" type="number" step="0.01" value={inverterForm.efficiency} onChange={(e) => setInverterForm({ ...inverterForm, efficiency: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Cost Price (£)" type="number" step="0.01" value={inverterForm.costPrice} onChange={(e) => setInverterForm({ ...inverterForm, costPrice: e.target.value })} required />
              <Input label="RRP (£)" type="number" step="0.01" value={inverterForm.rrp} onChange={(e) => setInverterForm({ ...inverterForm, rrp: e.target.value })} required />
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="font-medium text-white">Active</span>
                <button type="button" onClick={() => setInverterForm({ ...inverterForm, isActive: !inverterForm.isActive })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${inverterForm.isActive ? 'bg-green-600' : 'bg-slate-700'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${inverterForm.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="secondary" onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); setItemToEdit(null); }} className="flex-1">Cancel</Button>
              <Button onClick={itemToEdit ? handleUpdateInverter : handleCreateInverter} className="flex-1" isLoading={isLoading}>{itemToEdit ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modals - Manufacturer */}
      {activeTab === 'manufacturers' && (isAddModalOpen || isEditModalOpen) && (
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
              <Button variant="secondary" onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); setItemToEdit(null); }} className="flex-1">Cancel</Button>
              <Button onClick={itemToEdit ? handleUpdateManufacturer : handleCreateManufacturer} className="flex-1" isLoading={isLoading}>{itemToEdit ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => { setIsDeleteModalOpen(false); setItemToDelete(null); }}
        title={`Delete ${activeTab.slice(0, -1).charAt(0).toUpperCase() + activeTab.slice(1, -1)}`}
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-white mb-1">Are you sure you want to delete this item?</p>
              <p className="text-sm text-slate-400">This action cannot be undone. {activeTab === 'batteries' || activeTab === 'inverters' ? 'Product' : 'Manufacturer'}: <span className="font-medium text-white">{itemToDelete?.model || itemToDelete?.name}</span></p>
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
