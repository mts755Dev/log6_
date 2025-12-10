import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Battery, 
  Cpu, 
  Search,
  Filter,
  ExternalLink,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Tabs } from '../../components/ui/Tabs';
import { useData } from '../../contexts/DataContext';

export function ProductsPage() {
  const { batteries, inverters, manufacturers } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('batteries');
  const [selectedManufacturer, setSelectedManufacturer] = useState<string | null>(null);

  const tabs = [
    { id: 'batteries', label: 'Batteries', icon: <Battery className="w-4 h-4" />, badge: batteries.length },
    { id: 'inverters', label: 'Inverters', icon: <Cpu className="w-4 h-4" />, badge: inverters.length },
  ];

  const filteredBatteries = batteries.filter(b => {
    const matchesSearch = 
      b.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.manufacturerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesManufacturer = !selectedManufacturer || b.manufacturerId === selectedManufacturer;
    return matchesSearch && matchesManufacturer && b.isActive;
  });

  const filteredInverters = inverters.filter(i => {
    const matchesSearch = 
      i.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.manufacturerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesManufacturer = !selectedManufacturer || i.manufacturerId === selectedManufacturer;
    return matchesSearch && matchesManufacturer && i.isActive;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Product Catalogue</h1>
        <p className="page-subtitle">Browse batteries and inverters from leading manufacturers</p>
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
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Manufacturer:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedManufacturer(null)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  !selectedManufacturer
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                All
              </button>
              {manufacturers.filter(m => m.isActive).map((mfr) => (
                <button
                  key={mfr.id}
                  onClick={() => setSelectedManufacturer(mfr.id)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    selectedManufacturer === mfr.id
                      ? 'bg-primary-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {mfr.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Products Grid */}
      {activeTab === 'batteries' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBatteries.map((battery, index) => (
            <motion.div
              key={battery.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="h-full flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm text-primary-400 font-medium">{battery.manufacturerName}</p>
                    <h3 className="text-lg font-semibold text-white">{battery.model}</h3>
                  </div>
                  <Badge variant="success">{battery.warrantyYears}yr warranty</Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 bg-slate-800/50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Capacity</p>
                    <p className="text-lg font-bold text-white">{battery.capacityKwh} kWh</p>
                  </div>
                  <div className="p-3 bg-slate-800/50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Power</p>
                    <p className="text-lg font-bold text-white">{battery.powerKw} kW</p>
                  </div>
                </div>

                <div className="space-y-2 text-sm flex-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Chemistry</span>
                    <span className="text-slate-200">{battery.chemistry}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Efficiency</span>
                    <span className="text-slate-200">{battery.efficiency}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cycle Life</span>
                    <span className="text-slate-200">{battery.cycleLife.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Dimensions</span>
                    <span className="text-slate-200 text-xs">{battery.dimensions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Weight</span>
                    <span className="text-slate-200">{battery.weight} kg</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500">RRP</p>
                    <p className="text-xl font-bold text-primary-400">£{battery.rrp.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Your Cost</p>
                    <p className="text-lg font-medium text-success-400">£{battery.costPrice.toLocaleString()}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {activeTab === 'inverters' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredInverters.map((inverter, index) => (
            <motion.div
              key={inverter.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="h-full flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm text-primary-400 font-medium">{inverter.manufacturerName}</p>
                    <h3 className="text-lg font-semibold text-white">{inverter.model}</h3>
                  </div>
                  <Badge variant="success">{inverter.warrantyYears}yr warranty</Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 bg-slate-800/50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Power</p>
                    <p className="text-lg font-bold text-white">{inverter.powerKw} kW</p>
                  </div>
                  <div className="p-3 bg-slate-800/50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Phases</p>
                    <p className="text-lg font-bold text-white">{inverter.phases} Phase</p>
                  </div>
                </div>

                <div className="space-y-2 text-sm flex-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Efficiency</span>
                    <span className="text-slate-200">{inverter.efficiency}%</span>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-1">Features</p>
                    <div className="flex flex-wrap gap-1">
                      {inverter.features.map((feature) => (
                        <span key={feature} className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-xs">
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500">RRP</p>
                    <p className="text-xl font-bold text-primary-400">£{inverter.rrp.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Your Cost</p>
                    <p className="text-lg font-medium text-success-400">£{inverter.costPrice.toLocaleString()}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {((activeTab === 'batteries' && filteredBatteries.length === 0) ||
        (activeTab === 'inverters' && filteredInverters.length === 0)) && (
        <Card className="text-center py-12">
          <Battery className="w-12 h-12 mx-auto mb-4 text-slate-700" />
          <p className="text-slate-400">No products found matching your criteria</p>
        </Card>
      )}
    </div>
  );
}

