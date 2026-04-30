// frontend/src/components/DeliveryConfirmationPage.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Info, CheckCircle } from 'lucide-react';
import { Movement } from '../App';
import axios from 'axios';

interface DeliveryConfirmationPageProps {
  onConfirmClick: (movement: Movement) => void;
  API_URL: string;
  refreshKey: number;
}

const DeliveryConfirmationPage = ({ onConfirmClick, API_URL, refreshKey }: DeliveryConfirmationPageProps) => {
  const [searchType, setSearchType] = useState<'solicitante' | 'patrimonio'>('solicitante');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingMovements, setPendingMovements] = useState<Movement[]>([]);

  const fetchPendingMovements = useCallback(async (term: string = '', type: string = 'solicitante') => {
    setIsLoading(true);
    setPendingMovements([]);
    try {
      const params = term ? { [type]: term } : {};
      const response = await axios.get(`${API_URL}/asset-movements/pending-delivery`, { params });
      setPendingMovements(response.data);
    } catch (error) {
      console.error('Erro ao buscar movimentações pendentes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchPendingMovements(searchTerm, searchType);
  }, [fetchPendingMovements, refreshKey]); 

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPendingMovements(searchTerm, searchType);
  };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-extrabold text-blue-900">Confirmar Entrega de Ativos</h1>

      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
        <form onSubmit={handleSearch}>
            <div className="flex border-b mb-4">
            <button type="button" onClick={() => setSearchType('solicitante')} className={`px-4 py-2 text-sm font-medium ${searchType === 'solicitante' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                Buscar por Solicitante
            </button>
            <button type="button" onClick={() => setSearchType('patrimonio')} className={`px-4 py-2 text-sm font-medium ${searchType === 'patrimonio' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                Buscar por Patrimônio
            </button>
            </div>
            <div className="flex space-x-2">
            <input 
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchType === 'solicitante' ? 'Filtrar por nome do solicitante...' : 'Filtrar por nº de patrimônio...'}
                className="flex-grow px-4 py-2 border border-gray-300 rounded-md shadow-sm"
            />
            <button type="submit" disabled={isLoading} className="bg-blue-600 text-white px-6 py-2 rounded-lg shadow-md hover:bg-blue-700 flex items-center disabled:opacity-50">
                <Search className="w-5 h-5 mr-2" />
                {isLoading ? 'Buscando...' : 'Buscar'}
            </button>
            </div>
        </form>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-md mt-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Movimentações com Entrega Pendente</h3>
        <div className="overflow-x-auto">
          {isLoading ? (
            <p className="text-center text-gray-500 py-4">Buscando...</p>
          ) : pendingMovements.length > 0 ? (
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3">Solicitante</th>
                  <th scope="col" className="px-6 py-3">Data da Solicitação</th>
                  <th scope="col" className="px-6 py-3">Ativos</th>
                  <th scope="col" className="px-6 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pendingMovements.map((movement) => (
                  <tr key={movement.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900 align-top pt-4">{movement.recipient_display_name}</td>
                    <td className="px-6 py-4 align-top pt-4">{new Date(movement.movement_date).toLocaleDateString('pt-BR')}</td>
                    
                    {/* >>> COLUNA ATIVOS PADRONIZADA (OPÇÃO C) <<< */}
                    <td className="px-6 py-4 align-top">
                        <div className="space-y-3">
                            {movement.assets?.map((asset) => (
                                <div key={asset.id} className="flex flex-col">
                                    <span className="font-bold text-gray-900">{asset.patrimonio_number || asset.sku}</span>
                                    {/* Mostra marca/modelo apenas se existirem */}
                                    {(asset.brand || asset.model) && (
                                        <span className="text-xs text-gray-500 uppercase">{asset.brand} {asset.model}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </td>

                    <td className="px-6 py-4 text-center align-top pt-4">
                      <button onClick={() => onConfirmClick(movement)} className="bg-green-600 text-white px-3 py-1 rounded-lg shadow-md hover:bg-green-700 whitespace-nowrap text-xs flex items-center mx-auto font-bold">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Confirmar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
             <div className="text-center py-8 text-gray-500">
                <Info className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>Nenhuma movimentação pendente encontrada.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DeliveryConfirmationPage;