import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, Calendar, HardDrive, Repeat, CornerUpLeft, Info, Search, X, Filter, Clock, Upload } from 'lucide-react';
import DeliveryConfirmationPage from './DeliveryConfirmationPage';
import { Movement, Asset } from '../App';
import axios from 'axios';

interface AssetManagementPageProps {
  onConfirmClick: (movement: Movement) => void;
  onRenewClick: (movement: Movement) => void;
  onSubstituteClick: (movement: Movement) => void;
  onReturnClick: (movement: Movement) => void;
  onFinalizeSubstitution: (substitution: any) => void; 
  API_URL: string;
  refreshKey: number;
}

const AssetManagementPage = (props: AssetManagementPageProps) => {
  const [activeTab, setActiveTab] = useState<'pending_delivery' | 'active_loans' | 'in_use_assets' | 'pending_substitutions'>('pending_delivery');

  // Filtros
  const [filterSolicitante, setFilterSolicitante] = useState('');
  const [filterPatrimonio, setFilterPatrimonio] = useState('');
  const [filterItemType, setFilterItemType] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Estados de Dados
  const [inUseAssets, setInUseAssets] = useState<Movement[]>([]);
  const [activeLoans, setActiveLoans] = useState<Movement[]>([]);
  const [pendingSubstitutions, setPendingSubstitutions] = useState<any[]>([]); 
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = useCallback(async (filtersOverride?: any) => {
    if (activeTab === 'pending_delivery') return;

    setIsLoading(true);
    try {
      // 1. Busca de Pendências (Fluxo novo)
      if (activeTab === 'pending_substitutions') {
          const res = await axios.get(`${props.API_URL}/substitutions/pending`);
          setPendingSubstitutions(res.data);
          setIsLoading(false);
          return;
      }

      // 2. Busca Padrão (Fluxo existente)
      const params = new URLSearchParams();
      const s = filtersOverride?.solicitante ?? filterSolicitante;
      const p = filtersOverride?.patrimonio ?? filterPatrimonio;
      const t = filtersOverride?.itemType ?? filterItemType;
      const d1 = filtersOverride?.startDate ?? filterStartDate;
      const d2 = filtersOverride?.endDate ?? filterEndDate;

      if (s) params.append('solicitante', s);
      if (p) params.append('patrimonio', p);
      if (t) params.append('itemType', t);
      if (d1) params.append('startDate', d1);
      if (d2) params.append('endDate', d2);
      
      params.append('status', 'confirmed'); 

      let endpoint = '';
      if (activeTab === 'active_loans') endpoint = `${props.API_URL}/asset-movements/active-loans`;
      if (activeTab === 'in_use_assets') endpoint = `${props.API_URL}/asset-movements/in-use-assets`;

      const response = await axios.get(endpoint, { params });
      
      if (activeTab === 'active_loans') setActiveLoans(response.data);
      if (activeTab === 'in_use_assets') setInUseAssets(response.data);

    } catch (error) {
      console.error(`Erro ao buscar dados para ${activeTab}:`, error);
    } finally {
      setIsLoading(false);
    }
  }, [props.API_URL, activeTab, filterSolicitante, filterPatrimonio, filterItemType, filterStartDate, filterEndDate]);

  useEffect(() => {
    fetchData();
  }, [activeTab, props.refreshKey]); 

  const handleClearFilters = () => {
    setFilterSolicitante(''); setFilterPatrimonio(''); setFilterItemType(''); setFilterStartDate(''); setFilterEndDate('');
    fetchData({ solicitante: '', patrimonio: '', itemType: '', startDate: '', endDate: '' });
  };

  const tabs = [
    { id: 'pending_delivery', label: 'Entregas Pendentes', icon: CheckCircle },
    { id: 'active_loans', label: 'Empréstimos Ativos', icon: Calendar },
    { id: 'in_use_assets', label: 'Ativos em Uso', icon: HardDrive },
    { id: 'pending_substitutions', label: 'Substituições Pendentes', icon: Clock },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold text-blue-900">Gestão de Saídas e Empréstimos</h1>
      
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center transition-colors ${activeTab === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
              <tab.icon className="mr-2 h-5 w-5" /> {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* FILTROS */}
      {activeTab !== 'pending_delivery' && activeTab !== 'pending_substitutions' && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center mb-4 text-gray-700 font-semibold"><Filter className="w-5 h-5 mr-2" /> Filtros de Busca</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
               <input type="text" placeholder="Solicitante..." value={filterSolicitante} onChange={e => setFilterSolicitante(e.target.value)} className="p-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"/>
               <input type="text" placeholder="Patrimônio..." value={filterPatrimonio} onChange={e => setFilterPatrimonio(e.target.value)} className="p-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"/>
               <input type="text" placeholder="Tipo..." value={filterItemType} onChange={e => setFilterItemType(e.target.value)} className="p-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"/>
               <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="p-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"/>
               <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="p-2 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            <div className="flex justify-end gap-2 mt-4">
                <button onClick={handleClearFilters} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md flex items-center"> <X className="w-4 h-4 mr-2" /> Limpar </button>
                <button onClick={() => fetchData()} className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md flex items-center font-bold"> <Search className="w-4 h-4 mr-2" /> Filtrar </button>
            </div>
        </div>
      )}

      <div className="mt-4">
        {/* ENTREGAS PENDENTES (Renderizado por outro arquivo, precisa de ajuste lá se quiser padronizar) */}
        {activeTab === 'pending_delivery' && <DeliveryConfirmationPage onConfirmClick={props.onConfirmClick} API_URL={props.API_URL} refreshKey={props.refreshKey} />}

        {/* 1. TABELA SUBSTITUIÇÕES PENDENTES (PADRONIZADA OPÇÃO C) */}
        {activeTab === 'pending_substitutions' && (
                    <div className="bg-white p-6 rounded-xl shadow-md">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center"><Clock className="w-5 h-5 mr-2 text-orange-500"/> Substituições Aguardando Upload</h3>
                        {pendingSubstitutions.length > 0 ? (
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3">Data</th>
                                        <th className="px-6 py-3">Solicitante</th>
                                        <th className="px-6 py-3">Devolução (Antigo)</th>
                                        <th className="px-6 py-3">Entrega (Novo)</th>
                                        <th className="px-6 py-3 text-right">Ação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendingSubstitutions.map(item => (
                                        <tr key={item.id} className="bg-white border-b hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">{new Date(item.created_at).toLocaleDateString('pt-BR')}</td>
                                            <td className="px-6 py-4 font-bold text-gray-800">{item.recipient_name}</td>
                                            
                                            {/* Coluna Devolução Padronizada */}
                                            <td className="px-6 py-4 text-red-600 align-top">
                                                <div className="mb-2">
                                                    <div className="font-bold">{item.old_pat}</div>
                                                    <div className="text-xs text-red-400 font-medium">{item.old_model}</div>
                                                </div>
                                                {item.old_mon_pat && (
                                                    <div className="pt-1 border-t border-red-100 mt-1">
                                                        <div className="font-bold">{item.old_mon_pat}</div>
                                                        <div className="text-xs text-red-400 font-medium">{item.old_mon_model}</div>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Coluna Entrega Padronizada */}
                                            <td className="px-6 py-4 text-green-600 align-top">
                                                <div className="mb-2">
                                                    <div className="font-bold">{item.new_pat}</div>
                                                    <div className="text-xs text-green-500 font-medium">{item.new_model}</div>
                                                </div>
                                                {item.new_mon_pat && (
                                                    <div className="pt-1 border-t border-green-100 mt-1">
                                                        <div className="font-bold">{item.new_mon_pat}</div>
                                                        <div className="text-xs text-green-500 font-medium">{item.new_mon_model}</div>
                                                    </div>
                                                )}
                                            </td>

                                            <td className="px-6 py-4 text-right align-middle">
                                                <button 
                                                    onClick={() => props.onFinalizeSubstitution(item)} 
                                                    className="bg-green-600 text-white px-3 py-2 rounded shadow hover:bg-green-700 flex items-center ml-auto font-bold text-xs transition-colors"
                                                >
                                                    <Upload className="w-4 h-4 mr-2"/> Finalizar
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="text-center py-10 text-gray-500">Nenhuma substituição pendente.</div>
                        )}
                    </div>
                )}

        {/* 2. TABELA EMPRÉSTIMOS ATIVOS (PADRONIZADA OPÇÃO C) */}
        {activeTab === 'active_loans' && (
             <div className="bg-white p-6 rounded-xl shadow-md">
                 <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center"><Calendar className="w-5 h-5 mr-2 text-blue-600"/> Empréstimos Ativos</h3>
                 <div className="overflow-x-auto">
                    {activeLoans.length > 0 ? (
                        <table className="w-full text-sm text-left text-gray-500">
                             <thead className="text-xs text-gray-700 uppercase bg-gray-50"><tr><th className="px-6 py-3">Solicitante</th><th className="px-6 py-3">Ativos</th><th className="px-6 py-3">Data</th><th className="px-6 py-3">Vencimento</th><th className="px-6 py-3 text-center">Ações</th></tr></thead>
                             <tbody>
                                {activeLoans.map(m => (
                                    <tr key={m.id} className="bg-white border-b hover:bg-gray-50">
                                            <td className="px-6 py-4 align-top pt-5 font-medium">{m.recipient_display_name}</td>
                                            <td className="px-6 py-4 align-top">
                                                {/* LISTA DE ATIVOS FORMATADA */}
                                                <div className="space-y-3">
                                                    {m.assets?.map((a: Asset) => (
                                                        <div key={a.id} className="flex flex-col">
                                                            <span className="font-bold text-gray-900">{a.patrimonio_number}</span>
                                                            <span className="text-xs text-gray-500">{a.brand} {a.model}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 align-top pt-5">{new Date(m.movement_date).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 align-top pt-5"><span className={new Date(m.expected_return_date!) < new Date() ? "text-red-600 font-bold" : "text-green-600"}>{new Date(m.expected_return_date!).toLocaleDateString()}</span></td>
                                            <td className="px-6 py-4 text-center flex justify-center space-x-2 align-top pt-4">
                                                <button onClick={() => props.onRenewClick(m)} className="bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200" title="Renovar"><Calendar className="w-4 h-4"/></button>
                                                <button onClick={() => props.onSubstituteClick(m)} className="bg-orange-100 text-orange-700 px-2 py-1 rounded hover:bg-orange-200" title="Substituir"><Repeat className="w-4 h-4"/></button>
                                                <button onClick={() => props.onReturnClick(m)} className="bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200" title="Devolver"><CornerUpLeft className="w-4 h-4"/></button>
                                            </td>
                                    </tr>
                                ))}
                             </tbody>
                        </table>
                    ) : <p className="text-center py-8 text-gray-500">Nenhum empréstimo encontrado.</p>}
                 </div>
             </div>
        )}

        {/* 3. TABELA ATIVOS EM USO (PADRONIZADA OPÇÃO C) */}
        {activeTab === 'in_use_assets' && (
             <div className="bg-white p-6 rounded-xl shadow-md">
                 <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center"><HardDrive className="w-5 h-5 mr-2 text-green-600"/> Ativos em Uso</h3>
                 <div className="overflow-x-auto">
                    {inUseAssets.length > 0 ? (
                        <table className="w-full text-sm text-left text-gray-500">
                             <thead className="text-xs text-gray-700 uppercase bg-gray-50"><tr><th className="px-6 py-3">Solicitante</th><th className="px-6 py-3">Ativos</th><th className="px-6 py-3">Data</th><th className="px-6 py-3 text-center">Ações</th></tr></thead>
                             <tbody>
                                {inUseAssets.map(m => (
                                    <tr key={m.id} className="bg-white border-b hover:bg-gray-50">
                                            <td className="px-6 py-4 align-top pt-5 font-medium">{m.recipient_display_name}</td>
                                            <td className="px-6 py-4 align-top">
                                                {/* LISTA DE ATIVOS FORMATADA */}
                                                <div className="space-y-3">
                                                    {m.assets?.map((a: Asset) => (
                                                        <div key={a.id} className="flex flex-col">
                                                            <span className="font-bold text-gray-900">{a.patrimonio_number}</span>
                                                            <span className="text-xs text-gray-500">{a.brand} {a.model}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 align-top pt-5">{new Date(m.movement_date).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-center flex justify-center space-x-2 align-top pt-4">
                                                <button onClick={() => props.onSubstituteClick(m)} className="bg-orange-100 text-orange-700 px-2 py-1 rounded hover:bg-orange-200" title="Substituir"><Repeat className="w-4 h-4"/></button>
                                                <button onClick={() => props.onReturnClick(m)} className="bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200" title="Devolver"><CornerUpLeft className="w-4 h-4"/></button>
                                            </td>
                                    </tr>
                                ))}
                             </tbody>
                        </table>
                    ) : <p className="text-center py-8 text-gray-500">Nenhum ativo em uso encontrado.</p>}
                 </div>
             </div>
        )}

      </div>
    </div>
  );
};

export default AssetManagementPage;