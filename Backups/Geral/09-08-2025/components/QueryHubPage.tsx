// frontend/src/components/QueryHubPage.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { Users, HardDrive, BarChart, History, Search, ArrowLeft, Info, MapPin, Tag, Activity, Calendar, Repeat, CornerUpLeft } from 'lucide-react';
import { Movement, Person, Asset, Unit } from '../App';
import axios from 'axios';
import Select from 'react-select';
import { useToast } from '../App';

interface QueryHubPageProps {
  people: Person[];
  units: Unit[];
  translateMovementType: (type: string) => string;
  translateStatus: (status: string) => string;
  API_URL: string;
  onRenewClick: (movement: Movement) => void;
  onSubstituteClick: (movement: Movement) => void;
  onReturnClick: (movement: Movement) => void;
  userRole?: 'admin' | 'manager' | 'basic';
}

interface EnrichedAsset extends Asset {
  responsible_person_name?: string;
  movement_id?: number;
  expected_return_date?: string;
  asset_id?: number;
}

const QueryCard = ({ icon: Icon, title, description, onClick }: any) => (
    <button onClick={onClick} className="bg-white p-6 rounded-xl shadow-md border border-gray-200 text-center hover:shadow-lg hover:border-blue-500 hover:scale-105 transition-all duration-300 h-full flex flex-col items-center justify-center">
        <div className="bg-blue-100 p-4 rounded-full mb-4 inline-block"><Icon className="w-8 h-8 text-blue-700" /></div>
        <h3 className="text-lg font-bold text-blue-900">{title}</h3>
        <p className="text-sm text-gray-600 mt-1">{description}</p>
    </button>
);

const QueryHubPage = ({ people, units, API_URL, translateMovementType, translateStatus, onRenewClick, onSubstituteClick, onReturnClick, userRole }: QueryHubPageProps) => {
  const [currentView, setCurrentView] = useState<'hub' | 'by_person' | 'by_asset' | 'by_status' | 'list_people' | 'list_units'>('hub');
  const [isLoading, setIsLoading] = useState(false);
  const { addToast } = useToast();

  // Estados para as buscas
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  const [personMovements, setPersonMovements] = useState<Movement[]>([]);
  
  const [assetSearchTerm, setAssetSearchTerm] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<EnrichedAsset | null>(null);
  const [assetMovements, setAssetMovements] = useState<Movement[]>([]);

  const [selectedStatus, setSelectedStatus] = useState('');
  const [statusAssets, setStatusAssets] = useState<Asset[]>([]);
  const [peopleFilter, setPeopleFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [personCurrentMovements, setPersonCurrentMovements] = useState<Movement[]>([]);

  // <<< NOVA FUNÇÃO PARA BUSCAR ATIVOS ATUAIS DA PESSOA >>>
   const fetchAssetsByStatus = useCallback(async (status: string) => {
    if (!status) {
      setStatusAssets([]);
      return;
    }
    setIsLoading(true);
    try {
      // Chama a rota de ativos passando o status como parâmetro de query
      const response = await axios.get(`${API_URL}/assets`, { params: { status } });
      setStatusAssets(response.data);
    } catch (error) {
      console.error("Erro ao buscar ativos por status:", error);
      addToast('Não foi possível carregar os ativos.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [API_URL, addToast]); // Adiciona addToast às dependências

  const fetchCurrentMovementsByPerson = useCallback(async (personId: number) => {
    setIsLoading(true);
    setPersonCurrentMovements([]);
    try {
      const response = await axios.get(`${API_URL}/people/${personId}/assets-summary`);
      setPersonCurrentMovements(response.data);
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  }, [API_URL]);

  const fetchMovementsByPerson = useCallback(async (personId: number) => {
      // Esta função pode compartilhar o isLoading se quisermos
      setPersonMovements([]);
      try {
        const response = await axios.get(`${API_URL}/asset-movements/by-person/${personId}`);
        setPersonMovements(response.data);
      } catch (error) { console.error(error); }
  }, [API_URL]);

  const handleSearchAsset = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetSearchTerm) return;
    setIsLoading(true);
    setSelectedAsset(null);
    setAssetMovements([]);
    try {
      const assetRes = await axios.get(`${API_URL}/query/asset/${assetSearchTerm}`);
      const foundAsset = assetRes.data;
      setSelectedAsset(foundAsset);
      const movementsRes = await axios.get(`${API_URL}/asset-movements/by-asset/${foundAsset.id}`);
      setAssetMovements(movementsRes.data);
    } catch (error: any) {
      addToast(error.response?.data?.message || 'Ativo não encontrado.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [API_URL, assetSearchTerm, addToast]);

  // <<< useEffect ATUALIZADO PARA CHAMAR AS DUAS FUNÇÕES DE BUSCA >>>
   useEffect(() => {
    if (currentView === 'by_person' && selectedPerson) {
      fetchCurrentMovementsByPerson(selectedPerson.id);
      fetchMovementsByPerson(selectedPerson.id);
    }
  }, [currentView, selectedPerson, fetchCurrentMovementsByPerson, fetchMovementsByPerson]);
  
    useEffect(() => {
        if (currentView === 'by_status' && selectedStatus) {
          fetchAssetsByStatus(selectedStatus);
        }
      }, [selectedStatus, currentView, fetchAssetsByStatus]);

  const goBackToHub = () => {
    setCurrentView('hub');
    setSelectedPerson(null);
    setSelectedAsset(null);
    setAssetSearchTerm('');
  };

  const personOptions = people.map(p => ({ value: p.id, label: `${p.full_name} (${p.cpf})` }));
  const handlePersonSelect = (selectedOption: any) => {
    setSelectedPerson(selectedOption ? people.find(p => p.id === selectedOption.value) || null : null);
  };
  
  const renderHub = () => (
    <div className="space-y-8">
        <h1 className="text-3xl font-extrabold text-blue-900">Central de Consultas</h1>
        <p className="text-lg text-gray-600">Selecione o tipo de consulta que deseja realizar.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <QueryCard icon={Users} title="Histórico por Pessoa" description="Veja os ativos atuais e o histórico completo de um solicitante." onClick={() => setCurrentView('by_person')} />
            <QueryCard icon={HardDrive} title="Histórico por Ativo" description="Rastreie o ciclo de vida completo de um equipamento." onClick={() => setCurrentView('by_asset')} />
            <QueryCard icon={BarChart} title="Ativos por Status" description="Liste ativos que estão 'Disponíveis', 'Em Uso', etc." onClick={() => setCurrentView('by_status')} />
            <QueryCard icon={Users} title="Listar Pessoas" description="Visualize e pesquise na base de pessoas cadastradas." onClick={() => setCurrentView('list_people')} />
            <QueryCard icon={History} title="Listar Unidades" description="Visualize e pesquise na base de unidades cadastradas." onClick={() => setCurrentView('list_units')} />
        </div>
    </div>
  );

  // <<< FUNÇÃO renderQueryByPerson ATUALIZADA >>>
    const renderQueryByPerson = () => (
    <div className="space-y-6">
      <button onClick={goBackToHub} className="flex items-center text-sm text-blue-600 hover:underline font-semibold">
        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar para Central de Consultas
      </button>
      <h1 className="text-3xl font-extrabold text-blue-900">Consulta por Pessoa</h1>
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Solicitante (Nome ou CPF)</label>
        <Select
            options={personOptions}
            onChange={handlePersonSelect}
            placeholder="Digite para buscar..."
            isClearable
            noOptionsMessage={() => "Nenhum resultado encontrado"}
            filterOption={(option, inputValue) => 
                option.label.toLowerCase().includes(inputValue.toLowerCase())
            }
        />
      </div>

      {selectedPerson && (
        <>
          <div className="bg-white p-6 rounded-xl shadow-md mt-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Dossiê Rápido: Ativos Atuais de {selectedPerson.full_name}</h3>
            <div className="overflow-x-auto">
              {isLoading && personCurrentMovements.length === 0 ? <p className="text-center py-4">Buscando...</p> : 
               personCurrentMovements.length > 0 ? (
                <table className="w-full text-sm text-left text-gray-500">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                      <th className="px-6 py-3">Ativos (Patrimônio)</th>
                      <th className="px-6 py-3">Descrição</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Vencimento</th>
                      {/* <<< AJUSTE AQUI: O CABEÇALHO SÓ APARECE SE O PERFIL NÃO FOR BÁSICO >>> */}
                      {userRole !== 'basic' && <th className="px-6 py-3 text-center">Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {personCurrentMovements.map(movement => (
                      <tr key={movement.movement_id} className="bg-white border-b hover:bg-gray-50">
                        <td className="px-6 py-4 font-bold">{movement.assets?.map(a => a.patrimonio_number).join(', ')}</td>
                        <td className="px-6 py-4">{movement.assets?.map(a => `${a.item_type_name} ${a.brand}`).join(', ')}</td>
                        <td className="px-6 py-4">{translateStatus(movement.assets?.[0]?.status || '')}</td>
                        <td className="px-6 py-4">{movement.expected_return_date ? new Date(movement.expected_return_date).toLocaleDateString('pt-BR') : 'N/A'}</td>
                        
                        {/* <<< AJUSTE AQUI: A CÉLULA DE AÇÕES SÓ APARECE SE O PERFIL NÃO FOR BÁSICO >>> */}
                        {userRole !== 'basic' && (
                          <td className="px-6 py-4 text-center flex items-center justify-center space-x-2">
                            {movement.assets?.[0]?.status === 'loaned' && (
                              <button onClick={() => onRenewClick(movement)} className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 flex items-center" title="Renovar Empréstimo">
                                <Calendar className="w-4 h-4 mr-1"/> Renovar
                              </button>
                            )}
                            <button onClick={() => onSubstituteClick(movement)} className="text-xs bg-orange-500 text-white px-3 py-1 rounded-lg hover:bg-orange-600 flex items-center" title="Substituir Ativo">
                              <Repeat className="w-4 h-4 mr-1"/> Substituir
                            </button>
                            <button onClick={() => onReturnClick({ ...movement, recipient_display_name: selectedPerson.full_name })} className="text-xs bg-gray-500 text-white px-3 py-1 rounded-lg hover:bg-gray-600 flex items-center" title="Registrar Devolução">
                              <CornerUpLeft className="w-4 h-4 mr-1"/> Devolver
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
               ) : <div className="text-center py-8 text-gray-500"><Info className="w-12 h-12 mx-auto mb-2 text-gray-400" /><p>Nenhum ativo sob a responsabilidade desta pessoa no momento.</p></div>
              }
            </div>
          </div>

          {/* HISTÓRICO COMPLETO DE MOVIMENTAÇÕES */}
          <div className="bg-white p-6 rounded-xl shadow-md mt-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Histórico Completo de Movimentações</h3>
            <div className="overflow-x-auto">
                {isLoading && personMovements.length === 0 ? <p className="text-center py-4">Buscando histórico...</p> : 
                 personMovements.length > 0 ? (
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr><th className="px-6 py-3">Data</th><th className="px-6 py-3">Tipo</th><th className="px-6 py-3">Ativos (Patrimônio)</th><th className="px-6 py-3">Operador do Sistema</th></tr>
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
                 ) : <div className="text-center py-8 text-gray-500"><Info className="w-12 h-12 mx-auto mb-2 text-gray-400" /><p>Nenhuma movimentação histórica encontrada para esta pessoa.</p></div>
                }
            </div>
          </div>
        </>
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
            <h3 className="text-xl font-bold text-gray-800 mb-4">Dossiê Rápido do Ativo</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-b pb-4">
              <div className="flex items-center"><Tag className="w-5 h-5 mr-2 text-blue-500"/><span className="font-semibold text-gray-600">Patrimônio: {selectedAsset.patrimonio_number || 'N/A'}</span></div>
              <div className="col-span-2 flex items-center"><Info className="w-5 h-5 mr-2 text-blue-500"/><span className="font-semibold text-gray-600">Ativo: {selectedAsset.item_type_name} \ Marca: {selectedAsset.brand} \ Modelo: {selectedAsset.model}</span></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
              <div className="flex items-center"><Activity className="w-5 h-5 mr-2 text-blue-500"/><span className="font-semibold text-gray-600">Status: {translateStatus(selectedAsset.status)}</span></div>
              <div className="flex items-center"><MapPin className="w-5 h-5 mr-2 text-blue-500"/><span className="font-semibold text-gray-600">Localização: {selectedAsset.current_unit_name || 'N/A'}</span></div>
              <div className="flex items-center"><Users className="w-5 h-5 mr-2 text-blue-500"/><span className="font-semibold text-gray-600">Responsável: {selectedAsset.responsible_person_name || 'N/A'}</span></div>
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
 // QueryHubPage.tsx -> SUBSTITUA A FUNÇÃO EXISTENTE PELA VERSÃO ABAIXO

  const renderQueryByStatus = () => {
    const assetStatuses = ['available', 'in_use', 'loaned', 'maintenance', 'pending_retirement', 'retired', 'disposed'];
    
    // Define as colunas da tabela dinamicamente baseadas no status selecionado
    const tableHeaders = () => {
      if (['in_use', 'loaned'].includes(selectedStatus)) {
        return (
          <tr>
            <th className="px-6 py-3">Patrimônio</th>
            <th className="px-6 py-3">Tipo/Marca/Modelo</th>
            <th className="px-6 py-3">Responsável Atual</th>
            <th className="px-6 py-3">Unidade de Destino</th>
          </tr>
        );
      }
      return (
        <tr>
          <th className="px-6 py-3">Patrimônio</th>
          <th className="px-6 py-3">Tipo/Marca/Modelo</th>
          <th className="px-6 py-3">Localização Atual</th>
        </tr>
      );
    };

    const tableBody = () => (
      <tbody>
        {statusAssets.map((asset: any) => ( // Usamos 'any' para flexibilidade com os campos extras
          <tr key={asset.id} className="bg-white border-b hover:bg-gray-50">
            <td className="px-6 py-4 font-bold">{asset.patrimonio_number}</td>
            <td className="px-6 py-4">{asset.item_type_name} {asset.brand} / {asset.model}</td>
            {['in_use', 'loaned'].includes(selectedStatus) ? (
              <>
                <td className="px-6 py-4">{asset.responsible_person_name || 'N/A'}</td>
                <td className="px-6 py-4">{asset.current_unit_name || 'N/A'}</td>
              </>
            ) : (
              <td className="px-6 py-4">{asset.current_unit_name || 'N/A'}</td>
            )}
          </tr>
        ))}
      </tbody>
    );

    return (
      <div className="space-y-6">
        <button onClick={goBackToHub} className="flex items-center text-sm text-blue-600 hover:underline font-semibold">
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar para Central de Consultas
        </button>
        <h1 className="text-3xl font-extrabold text-blue-900">Consulta de Ativos por Status</h1>
        <div className="bg-white p-6 rounded-2xl shadow-lg border">
          <label className="block text-sm font-medium text-gray-700 mb-1">Selecione o Status do Ativo</label>
          <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="w-full p-2 border rounded-md">
              <option value="">Selecione...</option>
              {assetStatuses.map(s => <option key={s} value={s}>{translateStatus(s)}</option>)}
          </select>
        </div>

        {isLoading ? <p className="text-center py-4">Buscando...</p> : 
         selectedStatus && statusAssets.length === 0 ? <div className="text-center py-8 text-gray-500"><Info className="w-12 h-12 mx-auto mb-2 text-gray-400" /><p>Nenhum ativo encontrado com este status.</p></div> :
         statusAssets.length > 0 && (
          <div className="bg-white p-6 rounded-xl shadow-md">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Resultados da Busca: {translateStatus(selectedStatus)}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                  {tableHeaders()}
                </thead>
                {tableBody()}
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderListPeople = () => {
    const filtered = people.filter(p => p.full_name.toLowerCase().includes(peopleFilter.toLowerCase()) || p.cpf.includes(peopleFilter));
    
    return (
      <div className="space-y-6">
        <button onClick={goBackToHub} className="flex items-center text-sm text-blue-600 hover:underline font-semibold">
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </button>
        <h1 className="text-3xl font-extrabold text-blue-900">Listagem de Pessoas</h1>
        <div className="bg-white p-6 rounded-2xl shadow-lg border">
          <input 
            type="text" 
            value={peopleFilter} 
            onChange={(e) => setPeopleFilter(e.target.value)} 
            placeholder="Filtrar por nome ou CPF..." 
            className="w-full p-2 border rounded-md"
          />
        </div>
        <div className="bg-white p-6 rounded-xl shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th className="px-6 py-3">Nome Completo</th>
                  <th className="px-6 py-3">CPF</th>
                  <th className="px-6 py-3">Setor</th>
                  <th className="px-6 py-3">Ativos Atuais</th> {/* <<< NOVA COLUNA */}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-bold text-gray-900">{p.full_name}</td>
                    <td className="px-6 py-4">{p.cpf}</td>
                    <td className="px-6 py-4">{p.unit_name || 'N/A'}</td>
                    <td className="px-6 py-4">
                      {/* <<< LÓGICA PARA EXIBIR A TAG COM A CONTAGEM >>> */}
                      {p.current_assets_count && p.current_assets_count > 0 && (
                        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-1 rounded-full">
                          {p.current_assets_count} {p.current_assets_count > 1 ? 'Ativos' : 'Ativo'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  };

  const renderListUnits = () => {
    const filtered = units.filter(unit =>
      unit.name.toLowerCase().includes(unitFilter.toLowerCase()) ||
      (unit.code && unit.code.toLowerCase().includes(unitFilter.toLowerCase())) ||
      unit.type.toLowerCase().includes(unitFilter.toLowerCase())
    );

    return (
      <div className="space-y-6">
        <button onClick={goBackToHub} className="flex items-center text-sm text-blue-600 hover:underline font-semibold">
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </button>

        <h1 className="text-3xl font-extrabold text-blue-900">Listagem de Unidades</h1>

        <div className="bg-white p-6 rounded-2xl shadow-lg border">
          <input 
            type="text" 
            value={unitFilter} 
            onChange={(e) => setUnitFilter(e.target.value)} 
            placeholder="Filtrar por Nome, Código ou Tipo..." 
            className="w-full p-2 border rounded-md"
          />
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th className="px-6 py-3">Nome da Unidade</th>
                  <th className="px-6 py-3">Tipo</th>
                  <th className="px-6 py-3">Código/Sigla</th>
                  <th className="px-6 py-3">Total de Ativos</th> {/* <<< NOVA COLUNA */}
                </tr>
              </thead>
              <tbody>
                {filtered.map(unit => (
                  <tr key={unit.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-bold text-gray-900">{unit.name}</td>
                    <td className="px-6 py-4">{unit.type}</td>
                    <td className="px-6 py-4">{unit.code || 'N/A'}</td>
                    <td className="px-6 py-4">
                      {/* <<< LÓGICA PARA EXIBIR A TAG COM A CONTAGEM >>> */}
                      {unit.current_assets_count && unit.current_assets_count > 0 && (
                        <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded-full">
                          {unit.current_assets_count} {unit.current_assets_count > 1 ? 'Ativos' : 'Ativo'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };
  // <<< FIM - NOVAS FUNÇÕES DE RENDERIZAÇÃO >>>

  // <<< RENDERIZAÇÃO PRINCIPAL ATUALIZADA >>>
  return (
    <div>
      {currentView === 'hub' && renderHub()}
      {currentView === 'by_person' && renderQueryByPerson()}
      {currentView === 'by_asset' && renderQueryByAsset()}
      {currentView === 'by_status' && renderQueryByStatus()}
      {currentView === 'list_people' && renderListPeople()}
      {currentView === 'list_units' && renderListUnits()}
    </div>
  );
};

export default QueryHubPage;