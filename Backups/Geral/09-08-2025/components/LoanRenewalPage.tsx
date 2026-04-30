// frontend/src/components/LoanRenewalPage.tsx -> CÓDIGO FINAL E CORRIGIDO

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Info, Calendar, Repeat, CornerUpLeft } from 'lucide-react';
import { Movement } from '../App';
import axios from 'axios';

// <<< 1. A interface agora espera a refreshKey >>>
interface LoanRenewalPageProps {
  onRenewClick: (movement: Movement) => void;
  onSubstituteClick: (movement: Movement) => void;
  onReturnClick: (movement: Movement) => void;
  API_URL: string;
  refreshKey: number; // <<< AQUI
}

// <<< 2. O componente agora recebe a refreshKey como prop >>>
const LoanRenewalPage = ({ 
  onRenewClick,
  onSubstituteClick,
  onReturnClick,
  API_URL,
  refreshKey 
}: LoanRenewalPageProps) => {
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeLoans, setActiveLoans] = useState<Movement[]>([]);

  const fetchActiveLoans = useCallback(async (term: string = '') => {
    setIsLoading(true);
    setActiveLoans([]);
    try {
      const params = term ? { solicitante: term } : {};
      const response = await axios.get(`${API_URL}/asset-movements/active-loans`, { params });
      setActiveLoans(response.data);
    } catch (error) {
      console.error('Erro ao buscar empréstimos ativos:', error);
      alert('Falha ao buscar dados.');
    } finally {
      setIsLoading(false);
    }
  }, [API_URL]);

  // <<< 3. O useEffect agora "escuta" a refreshKey corretamente >>>
  useEffect(() => {
    fetchActiveLoans(searchTerm);
  }, [fetchActiveLoans, refreshKey, searchTerm]); // <<< AQUI

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchActiveLoans(searchTerm);
  };

  const getDueDateStatus = (dueDate: string | undefined) => {
    if (!dueDate) return { text: 'Sem data', color: 'text-gray-500' };
    const today = new Date();
    const returnDate = new Date(dueDate);
    today.setHours(0, 0, 0, 0);
    returnDate.setHours(0, 0, 0, 0);
    const diffTime = returnDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: `Vencido há ${Math.abs(diffDays)} dia(s)`, color: 'text-red-600 font-bold' };
    if (diffDays === 0) return { text: 'Vence Hoje', color: 'text-orange-500 font-bold' };
    if (diffDays <= 7) return { text: `Vence em ${diffDays} dia(s)`, color: 'text-yellow-600' };
    return { text: `Vence em ${diffDays} dia(s)`, color: 'text-green-600' };
  };

  return (
    <div className="space-y-8">
      {/* O seu código JSX daqui para baixo permanece exatamente o mesmo, sem alterações */}
      <h1 className="text-3xl font-extrabold text-blue-900">Empréstimos Ativos</h1>
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
        <form onSubmit={handleSearch} className="flex space-x-2">
            <input 
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrar por nome do solicitante..."
                className="flex-grow px-4 py-2 border border-gray-300 rounded-md shadow-sm"
            />
            <button type="submit" disabled={isLoading} className="bg-blue-600 text-white px-6 py-2 rounded-lg shadow-md hover:bg-blue-700 flex items-center disabled:opacity-50">
                <Search className="w-5 h-5 mr-2" />
                {isLoading ? 'Buscando...' : 'Buscar'}
            </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-md mt-8">
        <div className="overflow-x-auto">
          {isLoading ? (
            <p className="text-center text-gray-500 py-4">Buscando...</p>
          ) : activeLoans.length > 0 ? (
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3">Solicitante</th>
                  <th scope="col" className="px-6 py-3">Ativos</th>
                  <th scope="col" className="px-6 py-3">Data de Vencimento</th>
                  <th scope="col" className="px-6 py-3">Status do Prazo</th>
                  <th scope="col" className="px-6 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {activeLoans.map((loan) => {
                  const dueDateStatus = getDueDateStatus(loan.expected_return_date);
                  return (
                    <tr key={loan.id} className="bg-white border-b hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{loan.recipient_display_name}</td>
                      <td className="px-6 py-4">{loan.assets?.map(a => a.patrimonio_number || a.sku).join(', ')}</td>
                      <td className="px-6 py-4">{loan.expected_return_date ? new Date(loan.expected_return_date).toLocaleDateString('pt-BR') : 'N/A'}</td>
                      <td className={`px-6 py-4 ${dueDateStatus.color}`}>{dueDateStatus.text}</td>
                      <td className="px-6 py-4 text-center flex items-center justify-center space-x-2">
                        {loan.delivery_status === 'confirmed' && (
                            <>
                                <button onClick={() => onRenewClick(loan)} className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 flex items-center" title="Renovar Empréstimo">
                                    <Calendar className="w-4 h-4 mr-1" /> Renovar
                                </button>
                                <button onClick={() => onSubstituteClick(loan)} className="text-xs bg-orange-500 text-white px-3 py-1 rounded-lg hover:bg-orange-600 flex items-center" title="Substituir Ativo">
                                    <Repeat className="w-4 h-4 mr-1"/> Substituir
                                </button>
                                <button onClick={() => onReturnClick(loan)} className="text-xs bg-gray-500 text-white px-3 py-1 rounded-lg hover:bg-gray-600 flex items-center" title="Registrar Devolução">
                                    <CornerUpLeft className="w-4 h-4 mr-1"/> Devolver
                                </button>
                            </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
             <div className="text-center py-8 text-gray-500">
                <Info className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>Nenhum empréstimo ativo encontrado.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoanRenewalPage;