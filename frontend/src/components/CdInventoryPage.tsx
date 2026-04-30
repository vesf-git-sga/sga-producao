import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  Package, UploadCloud, Search, BarChart2, PieChart, 
  Layers, Clock, RefreshCw, HardDrive, Box
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Cell
} from 'recharts';

interface CdInventoryItem {
  id: number;
  import_month: string;
  sector: string;
  item_type: string;
  brand: string;
  model_or_config: string; // Estamos usando este campo para armazenar o CÓDIGO
  original_description: string;
  quantity: number;
  created_at: string;
}

interface CdInventoryPageProps {
  API_URL: string;
  addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const CATEGORY_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b', '#ef4444', '#14b8a6'];

const CdInventoryPage: React.FC<CdInventoryPageProps> = ({ API_URL, addToast }) => {
  const [inventory, setInventory] = useState<CdInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  // Filtros
  const [filterType, setFilterType] = useState<string>('');
  const [filterBrand, setFilterBrand] = useState<string>('');
  const [filterText, setFilterText] = useState<string>('');

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/cd-inventory`);
      
      if (Array.isArray(response.data.items)) {
          setInventory(response.data.items);
      } else if (Array.isArray(response.data)) {
          setInventory(response.data);
      } else {
          setInventory([]);
      }
      
    } catch (error) {
      console.error('Erro ao carregar estoque do CD', error);
      addToast('Erro ao carregar estoque do CD.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('Ao importar a planilha, os dados do mês atual serão substituídos/atualizados. Deseja continuar?')) {
        e.target.value = '';
        return;
    }

    setImporting(true);
    addToast('Lendo planilha e processando inteligência de dados...', 'info');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_URL}/cd-inventory/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      addToast(response.data.message, 'success');
      fetchInventory(); 
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Erro ao importar planilha. Verifique os nomes das colunas.', 'error');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  // --- CÁLCULOS BLINDADOS ---

  const itemTypes = useMemo(() => Array.from(new Set(inventory.map(i => i.item_type || 'OUTROS'))).sort(), [inventory]);
  const brands = useMemo(() => Array.from(new Set(inventory.map(i => i.brand || '-'))).filter(b => b !== '-').sort(), [inventory]);

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const safeType = item.item_type || 'OUTROS';
      const safeBrand = item.brand || '-';
      const safeCode = item.model_or_config || ''; // O Código está aqui
      const safeDesc = item.original_description || '';

      const matchType = filterType ? safeType === filterType : true;
      const matchBrand = filterBrand ? safeBrand === filterBrand : true;
      
      // >>> ATUALIZAÇÃO: Busca também pelo Código exato <<<
      const matchText = filterText 
        ? safeDesc.toLowerCase().includes(filterText.toLowerCase()) || 
          safeCode.toLowerCase().includes(filterText.toLowerCase())
        : true;
        
      return matchType && matchBrand && matchText;
    });
  }, [inventory, filterType, filterBrand, filterText]);

  // KPIs
  const totalItems = useMemo(() => filteredInventory.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0), [filteredInventory]);
  const totalDistinct = filteredInventory.length;
  const lastUpdated = inventory.length > 0 ? new Date(inventory[0].created_at).toLocaleString('pt-BR') : 'Sem dados';
  const importMonth = inventory.length > 0 ? inventory[0].import_month : null;

  // Gráfico 1: Volume por Tipo de Item
  const chartDataType = useMemo(() => {
    const map: Record<string, number> = {};
    filteredInventory.forEach(i => { 
        const type = i.item_type || 'OUTROS';
        map[type] = (map[type] || 0) + (Number(i.quantity) || 0); 
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredInventory]);

  // Gráfico 2: Top 10 Itens
  const chartDataModels = useMemo(() => {
    const map: Record<string, { value: number, desc: string }> = {};
    filteredInventory.forEach(i => { 
        // Agrupa pelo CÓDIGO (ex: CAB-002) para o gráfico ficar limpo
        const code = i.model_or_config && i.model_or_config !== '-' ? i.model_or_config : 'Sem Código';
        
        if (!map[code]) {
            map[code] = { value: 0, desc: i.original_description || '' };
        }
        map[code].value += (Number(i.quantity) || 0); 
    });
    
    return Object.entries(map).map(([name, data]) => ({ 
        name, 
        value: data.value,
        desc: data.desc
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10); 
  }, [filteredInventory]);

  const formatMonth = (ym: string) => {
      if (!ym) return 'Sem dados';
      const [y, m] = ym.split('-');
      const date = new Date(parseInt(y), parseInt(m) - 1);
      return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row justify-between items-end border-b border-gray-200 pb-5">
        <div>
           <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center">
               <Package className="w-8 h-8 mr-3 text-indigo-600"/> Estoque Externo (CD)
           </h1>
           <p className="text-slate-500 mt-1">
             Espelhamento da planilha mensal oficial 
             {importMonth && <span className="ml-2 font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">Base: {formatMonth(importMonth)}</span>}
           </p>
        </div>
        
        <div className="flex gap-3 mt-4 md:mt-0">
            <button onClick={fetchInventory} disabled={loading} className="text-sm font-bold text-gray-700 bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center shadow-sm transition-all active:scale-95">
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`}/> Atualizar
            </button>
            
            <input type="file" id="cdImport" className="hidden" accept=".xlsx, .csv" onChange={handleImport} disabled={importing} />
            <label htmlFor="cdImport" className={`text-sm font-bold text-white bg-indigo-600 border border-indigo-700 px-4 py-2 rounded-lg flex items-center shadow-sm cursor-pointer transition-colors ${importing ? 'opacity-70 cursor-not-allowed' : 'hover:bg-indigo-700'}`}>
                <UploadCloud className="w-4 h-4 mr-2"/> {importing ? 'Processando...' : 'Carregar Nova Planilha'}
            </label>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between border-l-4 border-indigo-500">
              <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Volume Físico Total</p>
                  <h3 className="text-3xl font-black text-gray-800 mt-1">{totalItems.toLocaleString('pt-BR')} <span className="text-sm font-medium text-gray-500">unid.</span></h3>
              </div>
              <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600"><Layers className="w-6 h-6"/></div>
          </div>
          
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between border-l-4 border-blue-500">
              <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Itens Distintos</p>
                  <h3 className="text-3xl font-black text-gray-800 mt-1">{totalDistinct} <span className="text-sm font-medium text-gray-500">lotes</span></h3>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg text-blue-600"><PieChart className="w-6 h-6"/></div>
          </div>

          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between border-l-4 border-emerald-500">
              <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Última Sincronização</p>
                  <h3 className="text-lg font-bold text-gray-800 mt-1">{lastUpdated.split(' ')[0]}</h3>
                  <p className="text-xs text-gray-500 mt-1">{lastUpdated.split(' ')[1]}</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600"><Clock className="w-6 h-6"/></div>
          </div>
      </div>

      {/* GRÁFICOS */}
      {inventory.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 h-80 flex flex-col">
                  <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase">Distribuição por Categoria</h3>
                  <div className="flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartDataType} layout="vertical" margin={{ left: 40, right: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9"/>
                              <XAxis type="number" hide />
                              <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10, fontWeight: 'bold', fill: '#475569'}} />
                              <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px'}} />
                              <Bar dataKey="value" name="Saldo" radius={[0, 4, 4, 0]} barSize={24} label={{ position: 'right', fill: '#64748b', fontSize: 11, fontWeight: 'bold' }}>
                                  {chartDataType.map((entry, index) => <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />)}
                              </Bar>
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 h-80 flex flex-col">
                  <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase">Top 10 Códigos com Maior Saldo</h3>
                  <div className="flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartDataModels} layout="vertical" margin={{ left: 10, right: 30 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9"/>
                              <XAxis type="number" hide />
                              <YAxis dataKey="name" type="category" width={150} tick={{fontSize: 9, fill: '#64748b', fontWeight: 'bold'}} />
                              <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', fontSize: '12px'}} />
                              <Bar dataKey="value" name="Saldo" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={16} label={{ position: 'right', fill: '#64748b', fontSize: 11, fontWeight: 'bold' }}/>
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
              </div>
          </div>
      )}

      {/* TABELA DE ESTOQUE COM FILTROS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row gap-4 items-center justify-between">
              
              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                  <select 
                      value={filterType} 
                      onChange={e => setFilterType(e.target.value)}
                      className="p-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                      <option value="">Todos os Tipos</option>
                      {itemTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>

                  <select 
                      value={filterBrand} 
                      onChange={e => setFilterBrand(e.target.value)}
                      className="p-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                      <option value="">Todas as Marcas</option>
                      {brands.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>

                  <div className="relative flex-1 md:w-80">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                          type="text" placeholder="Buscar por Código ou Descrição..." 
                          value={filterText}
                          onChange={e => setFilterText(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                  </div>
              </div>

              <div className="text-sm text-gray-500 font-medium whitespace-nowrap">
                  {filteredInventory.length} itens listados
              </div>
          </div>

          <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
              <table className="w-full text-sm text-left relative">
                  <thead className="bg-white text-gray-500 sticky top-0 shadow-sm z-10">
                      <tr>
                          {/* >>> ATUALIZAÇÃO NO CABEÇALHO <<< */}
                          <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs w-40">Código do Item</th>
                          <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs">Descrição Completa</th>
                          <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs text-center w-32">Marca Identificada</th>
                          <th className="px-6 py-4 font-bold uppercase tracking-wider text-xs text-right w-32">Saldo CD</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                      {loading ? (
                          <tr><td colSpan={4} className="p-10 text-center text-gray-400">Carregando estoque...</td></tr>
                      ) : filteredInventory.length === 0 ? (
                          <tr><td colSpan={4} className="p-10 text-center text-gray-400">Nenhum item encontrado com esses filtros.</td></tr>
                      ) : (
                          filteredInventory.map((item) => (
                              <tr key={item.id} className="hover:bg-indigo-50/50 transition-colors group">
                                  {/* >>> ATUALIZAÇÃO NA RENDERIZAÇÃO DA LINHA <<< */}
                                  <td className="px-6 py-4">
                                      <span className="font-mono text-sm font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
                                          {item.model_or_config || 'S/C'}
                                      </span>
                                  </td>
                                  
                                  <td className="px-6 py-4">
                                      <div className="font-bold text-gray-800 mb-1">{item.item_type || 'OUTROS'}</div>
                                      <div className="text-xs text-gray-500 leading-relaxed" title={item.original_description}>
                                          {item.original_description}
                                      </div>
                                  </td>
                                  
                                  <td className="px-6 py-4 text-center">
                                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                                          {item.brand || '-'}
                                      </span>
                                  </td>
                                  
                                  <td className="px-6 py-4 text-right font-black text-indigo-700 text-lg">
                                      {Number(item.quantity || 0).toLocaleString('pt-BR')}
                                  </td>
                              </tr>
                          ))
                      )}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
};

export default CdInventoryPage;