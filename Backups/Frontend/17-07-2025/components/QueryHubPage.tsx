// frontend/src/components/QueryHubPage.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { Users, HardDrive, BarChart, History, Search, ArrowLeft, Info } from 'lucide-react';
import { Movement, Person, Asset, Sector } from '../App';
import axios from 'axios';
import Select from 'react-select';

interface QueryHubPageProps {
  people: Person[];
  sectors: Sector[];
  translateMovementType: (type: string) => string;
  translateStatus: (status: string) => string;
  API_URL: string;
}

// Componente para os cards de opção
const QueryCard = ({ icon: Icon, title, description, onClick }: any) => (
  <button onClick={onClick} className="bg-white p-6 rounded-xl shadow-md border border-gray-200 text-center hover:shadow-lg hover:border-blue-500 hover:scale-105 transition-all duration-300 h-full flex flex-col items-center justify-center">
    <div className="bg-blue-100 p-4 rounded-full mb-4 inline-block"><Icon className="w-8 h-8 text-blue-700" /></div>
    <h3 className="text-lg font-bold text-blue-900">{title}</h3>
    <p className="text-sm text-gray-600 mt-1">{description}</p>
  </button>
);

const QueryHubPage = ({ people, sectors, API_URL, translateMovementType, translateStatus }: QueryHubPageProps) => {
  // <<< MUDANÇA: Adicionando os novos tipos de visão ao estado >>>
  const [currentView, setCurrentView] = useState<'hub' | 'by_person' | 'by_asset' | 'by_status' | 'list_people' | 'list_sectors'>('hub');
  const [isLoading, setIsLoading] = useState(false);

  // Estados e lógicas para as buscas
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [personMovements, setPersonMovements] = useState<Movement[]>([]);
  const [assetSearchTerm, setAssetSearchTerm] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assetMovements, setAssetMovements] = useState<Movement[]>([]);

// <<< NOVOS ESTADOS E FUNÇÕES >>>
  const [selectedStatus, setSelectedStatus] = useState('');
  const [statusAssets, setStatusAssets] = useState<Asset[]>([]);
  const [peopleFilter, setPeopleFilter] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');

  const fetchAssetsByStatus = useCallback(async (status: string) => {
    if (!status) {
      setStatusAssets([]);
      return;
    }
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/assets`, { params: { status } });
      setStatusAssets(response.data);
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  }, [API_URL]);

  useEffect(() => {
    if (currentView === 'by_status') {
      fetchAssetsByStatus(selectedStatus);
    }
  }, [selectedStatus, currentView, fetchAssetsByStatus]);

  // Funções de busca (Callbacks)
  const fetchMovementsByPerson = useCallback(async (personId: number) => {
    setIsLoading(true);
    setPersonMovements([]);
    try {
      const response = await axios.get(`${API_URL}/asset-movements/by-person/${personId}`);
      setPersonMovements(response.data);
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  }, [API_URL]);

  const handleSearchAsset = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetSearchTerm) return;
    setIsLoading(true);
    setSelectedAsset(null);
    setAssetMovements([]);
    try {
      const assetRes = await axios.get(`${API_URL}/assets/by-patrimonio/${assetSearchTerm}`);
      const foundAsset = assetRes.data;
      setSelectedAsset(foundAsset);
      const movementsRes = await axios.get(`${API_URL}/asset-movements/by-asset/${foundAsset.id}`);
      setAssetMovements(movementsRes.data);
    } catch (error) {
      alert('Ativo não encontrado ou erro na busca.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [API_URL, assetSearchTerm]);

  useEffect(() => {
    if (currentView === 'by_person' && selectedPerson) {
      fetchMovementsByPerson(selectedPerson.id);
    }
  }, [currentView, selectedPerson, fetchMovementsByPerson]);

  const personOptions = people.map(p => ({ value: p.id, label: `${p.full_name} (${p.cpf})` }));
  const handlePersonSelect = (selectedOption: any) => {
    setSelectedPerson(selectedOption ? people.find(p => p.id === selectedOption.value) || null : null);
  };
  
  const goBackToHub = () => {
    setCurrentView('hub');
    // Limpa todos os estados para garantir um recomeço limpo
    setSelectedPerson(null);
    setSelectedAsset(null);
    setAssetSearchTerm('');
    setSelectedStatus('');
    setStatusAssets([]);
    setPeopleFilter('');
    setSectorFilter('');
  };

  // <<< FUNÇÃO DE RENDERIZAÇÃO DO HUB (COMPLETA) >>>
  const renderHub = () => (
    <div className="space-y-8">
      <h1 className="text-3xl font-extrabold text-blue-900">Central de Consultas</h1>
      <p className="text-lg text-gray-600">Selecione o tipo de consulta que deseja realizar.</p>
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-700 border-b pb-2">Consultas por Histórico</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <QueryCard icon={Users} title="Histórico por Pessoa" description="Veja todas as movimentações de um solicitante." onClick={() => setCurrentView('by_person')} />
          <QueryCard icon={HardDrive} title="Histórico por Ativo" description="Rastreie o ciclo de vida de um equipamento." onClick={() => setCurrentView('by_asset')} />
        </div>
      </div>
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-700 border-b pb-2">Consultas de Status e Listagens</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <QueryCard icon={BarChart} title="Ativos por Status" description="Liste ativos que estão 'Disponíveis', 'Em Uso', etc." onClick={() => setCurrentView('by_status')} />
          <QueryCard icon={Users} title="Listar Pessoas" description="Visualize e pesquise na base de pessoas cadastradas." onClick={() => setCurrentView('list_people')} />
          <QueryCard icon={History} title="Listar Setores" description="Visualize e pesquise na base de setores cadastrados." onClick={() => setCurrentView('list_sectors')} />
        </div>
      </div>
    </div>
  );

  // <<< FUNÇÃO DE RENDERIZAÇÃO DA BUSCA POR PESSOA (COMPLETA) >>>
  const renderQueryByPerson = () => (
    <div className="space-y-6">
      <button onClick={goBackToHub} className="flex items-center text-sm text-blue-600 hover:underline font-semibold">
        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar para Central de Consultas
      </button>
      <h1 className="text-3xl font-extrabold text-blue-900">Consulta por Histórico de Pessoa</h1>
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Solicitante (Nome ou CPF)</label>
        <Select options={personOptions} onChange={handlePersonSelect} placeholder="Digite para buscar..." isClearable className="basic-single" classNamePrefix="select" noOptionsMessage={() => "Nenhum resultado encontrado"} />
      </div>
      {selectedPerson && (
        <div className="bg-white p-6 rounded-xl shadow-md mt-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Histórico de Movimentações de: {selectedPerson.full_name}</h3>
          <div className="overflow-x-auto">
            {isLoading ? <p className="text-center py-4">Buscando histórico...</p> : 
             personMovements.length > 0 ? (
              <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                  <tr>
                    <th className="px-6 py-3">Data</th>
                    <th className="px-6 py-3">Tipo</th>
                    <th className="px-6 py-3">Ativos (Patrimônio)</th>
                    <th className="px-6 py-3">Operador do Sistema</th>
                  </tr>
                </thead>
                <tbody>
                  {personMovements.map(m => (
                    <tr key={m.id} className="bg-white border-b hover:bg-gray-50">
                      <td className="px-6 py-4">{new Date(m.movement_date).toLocaleDateString('pt-BR')}</td>
                      <td className="px-6 py-4">{translateMovementType(m.movement_type)}</td>
                      <td className="px-6 py-4">{m.assets?.map(a => a.patrimonio_number || a.sku).join(', ')}</td>
                      <td className="px-6 py-4">{m.responsible_full_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
             ) : <div className="text-center py-8 text-gray-500"><Info className="w-12 h-12 mx-auto mb-2 text-gray-400" /><p>Nenhuma movimentação encontrada para esta pessoa.</p></div>
            }
          </div>
        </div>
      )}
    </div>
  );
  
  // <<< FUNÇÃO DE RENDERIZAÇÃO DA BUSCA POR ATIVO (COMPLETA) >>>
  const renderQueryByAsset = () => (
    <div className="space-y-6">
      <button onClick={goBackToHub} className="flex items-center text-sm text-blue-600 hover:underline font-semibold">
        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar para Central de Consultas
      </button>
      <h1 className="text-3xl font-extrabold text-blue-900">Consulta por Histórico de Ativo</h1>
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
        <form onSubmit={handleSearchAsset} className="flex space-x-2">
          <input type="text" value={assetSearchTerm} onChange={(e) => setAssetSearchTerm(e.target.value)} placeholder="Digite o Patrimônio do ativo..." className="flex-grow px-4 py-2 border border-gray-300 rounded-md shadow-sm" />
          <button type="submit" disabled={isLoading} className="bg-blue-600 text-white px-6 py-2 rounded-lg shadow-md hover:bg-blue-700 flex items-center disabled:opacity-50">
            <Search className="w-5 h-5 mr-2" />
            {isLoading ? 'Buscando...' : 'Buscar'}
          </button>
        </form>
      </div>
      {isLoading && !selectedAsset && <p className="text-center py-4">Buscando ativo...</p>}
      {selectedAsset && (
        <>
          <div className="bg-white p-6 rounded-xl shadow-md">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Dados do Ativo</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><strong>Patrimônio:</strong><p>{selectedAsset.patrimonio_number}</p></div>
              <div><strong>Marca/Modelo:</strong><p>{selectedAsset.brand} {selectedAsset.model}</p></div>
              <div><strong>Tipo:</strong><p>{selectedAsset.item_type_name}</p></div>
              <div><strong>Status Atual:</strong><p className="font-bold">{translateStatus(selectedAsset.status)}</p></div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-md">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Histórico Cronológico do Ativo</h3>
            <div className="overflow-x-auto">
              {assetMovements.length > 0 ? (
                <table className="w-full text-sm text-left text-gray-500">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                      <th className="px-6 py-3">Data</th>
                      <th className="px-6 py-3">Tipo de Movimentação</th>
                      <th className="px-6 py-3">Responsável/Solicitante</th>
                      <th className="px-6 py-3">Operador do Sistema</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assetMovements.map(m => (
                      <tr key={m.id} className="bg-white border-b hover:bg-gray-50">
                        <td className="px-6 py-4">{new Date(m.movement_date).toLocaleString('pt-BR')}</td>
                        <td className="px-6 py-4">{translateMovementType(m.movement_type)}</td>
                        <td className="px-6 py-4">{m.recipient_display_name || 'N/A'}</td>
                        <td className="px-6 py-4">{m.responsible_full_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="text-center py-8 text-gray-500"><Info className="w-12 h-12 mx-auto mb-2 text-gray-400" /><p>Nenhuma movimentação encontrada para este ativo.</p></div>}
            </div>
          </div>
        </>
      )}
    </div>
  );

// <<< INÍCIO - NOVAS FUNÇÕES DE RENDERIZAÇÃO >>>
  const renderQueryByStatus = () => {
    const assetStatuses = ['available', 'in_use', 'loaned', 'maintenance', 'retired', 'disposed'];
    return (
    <div className="space-y-6">
      <button onClick={goBackToHub} className="flex items-center text-sm text-blue-600 hover:underline font-semibold"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</button>
      <h1 className="text-3xl font-extrabold text-blue-900">Consulta de Ativos por Status</h1>
      <div className="bg-white p-6 rounded-2xl shadow-lg border">
        <label className="block text-sm font-medium text-gray-700 mb-1">Selecione o Status do Ativo</label>
        <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="w-full p-2 border rounded-md">
            <option value="">Selecione...</option>
            {assetStatuses.map(s => <option key={s} value={s}>{translateStatus(s)}</option>)}
        </select>
      </div>
      {isLoading ? <p className="text-center py-4">Buscando...</p> : statusAssets.length > 0 && (
          <div className="bg-white p-6 rounded-xl shadow-md"><h3 className="text-lg font-semibold text-gray-800 mb-4">Resultados da Busca</h3><div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500"><thead className="text-xs text-gray-700 uppercase bg-gray-50"><tr><th className="px-6 py-3">Patrimônio</th><th className="px-6 py-3">Tipo</th><th className="px-6 py-3">Marca/Modelo</th><th className="px-6 py-3">Setor Atual</th></tr></thead>
              <tbody>{statusAssets.map(asset => (<tr key={asset.id} className="bg-white border-b hover:bg-gray-50"><td className="px-6 py-4 font-bold">{asset.patrimonio_number}</td><td className="px-6 py-4">{asset.item_type_name}</td><td className="px-6 py-4">{asset.brand} / {asset.model}</td><td className="px-6 py-4">{asset.current_sector_name || 'N/A'}</td></tr>))}</tbody>
            </table></div></div>
      )}
    </div>
  )};

  const renderListPeople = () => {
    const filtered = people.filter(p => p.full_name.toLowerCase().includes(peopleFilter.toLowerCase()) || p.cpf.includes(peopleFilter));
    return (
    <div className="space-y-6">
        <button onClick={goBackToHub} className="flex items-center text-sm text-blue-600 hover:underline font-semibold"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</button>
        <h1 className="text-3xl font-extrabold text-blue-900">Listagem de Pessoas</h1>
        <div className="bg-white p-6 rounded-2xl shadow-lg border"><input type="text" value={peopleFilter} onChange={(e) => setPeopleFilter(e.target.value)} placeholder="Filtrar por nome ou CPF..." className="w-full p-2 border rounded-md"/></div>
        <div className="bg-white p-6 rounded-xl shadow-md"><div className="overflow-x-auto"><table className="w-full text-sm text-left text-gray-500"><thead className="text-xs text-gray-700 uppercase bg-gray-50"><tr><th className="px-6 py-3">Nome Completo</th><th className="px-6 py-3">CPF</th><th className="px-6 py-3">Email</th><th className="px-6 py-3">Setor</th><th className="px-6 py-3">Telefone</th></tr></thead>
            <tbody>{filtered.map(p => (<tr key={p.id} className="bg-white border-b hover:bg-gray-50"><td className="px-6 py-4 font-bold">{p.full_name}</td><td className="px-6 py-4">{p.cpf}</td><td className="px-6 py-4">{p.email}</td><td className="px-6 py-4">{p.sector_name || 'N/A'}</td><td className="px-6 py-4">{p.contact_phone || 'N/A'}</td></tr>))}</tbody>
        </table></div></div>
    </div>
  )};

  const renderListSectors = () => {
    const filtered = sectors.filter(s => s.sector_name.toLowerCase().includes(sectorFilter.toLowerCase()) || s.secretariat.toLowerCase().includes(sectorFilter.toLowerCase()));
    return (
    <div className="space-y-6">
        <button onClick={goBackToHub} className="flex items-center text-sm text-blue-600 hover:underline font-semibold"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</button>
        <h1 className="text-3xl font-extrabold text-blue-900">Listagem de Setores</h1>
        <div className="bg-white p-6 rounded-2xl shadow-lg border"><input type="text" value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)} placeholder="Filtrar por nome do setor ou secretaria..." className="w-full p-2 border rounded-md"/></div>
        <div className="bg-white p-6 rounded-xl shadow-md"><div className="overflow-x-auto"><table className="w-full text-sm text-left text-gray-500"><thead className="text-xs text-gray-700 uppercase bg-gray-50"><tr><th className="px-6 py-3">Secretaria</th><th className="px-6 py-3">Setor</th><th className="px-6 py-3">Telefone</th></tr></thead>
            <tbody>{filtered.map(s => (<tr key={s.id} className="bg-white border-b hover:bg-gray-50"><td className="px-6 py-4 font-bold">{s.secretariat}</td><td className="px-6 py-4">{s.sector_name}</td><td className="px-6 py-4">{s.contact_phone || 'N/A'}</td></tr>))}</tbody>
        </table></div></div>
    </div>
  )};
  // <<< FIM - NOVAS FUNÇÕES DE RENDERIZAÇÃO >>>

  // <<< RENDERIZAÇÃO PRINCIPAL ATUALIZADA >>>
  return (
    <div>
      {currentView === 'hub' && renderHub()}
      {currentView === 'by_person' && renderQueryByPerson()}
      {currentView === 'by_asset' && renderQueryByAsset()}
      {currentView === 'by_status' && renderQueryByStatus()}
      {currentView === 'list_people' && renderListPeople()}
      {currentView === 'list_sectors' && renderListSectors()}
    </div>
  );
};

export default QueryHubPage;