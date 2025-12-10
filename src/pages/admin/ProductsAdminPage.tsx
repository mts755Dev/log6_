import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Package, 
  Search,
  Plus,
  Edit,
  Trash2,
  Battery,
  Cpu,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Tabs } from '../../components/ui/Tabs';
import { Table } from '../../components/ui/Table';
import { useData } from '../../contexts/DataContext';
import type { BatteryProduct, InverterProduct } from '../../types';

export function ProductsAdminPage() {
  const { batteries, inverters, manufacturers } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('batteries');

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
      render: () => (
        <div className="flex items-center gap-1 justify-end">
          <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <Edit className="w-4 h-4" />
          </button>
          <button className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
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
      render: () => (
        <div className="flex items-center gap-1 justify-end">
          <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <Edit className="w-4 h-4" />
          </button>
          <button className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
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
        <Button leftIcon={<Plus className="w-4 h-4" />}>
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
                  <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                    <Edit className="w-4 h-4" />
                  </button>
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
    </div>
  );
}

