// frontend/src/components/AssetManagementPage.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, Calendar, HardDrive, Repeat, CornerUpLeft, Info } from 'lucide-react';
import DeliveryConfirmationPage from './DeliveryConfirmationPage';
import LoanRenewalPage from './LoanRenewalPage';
import { Movement } from '../App';
import axios from 'axios';

// A interface de props continua a mesma
interface AssetManagementPageProps {
  onConfirmClick: (movement: Movement) => void;
  onRenewClick: (movement: Movement) => void;
  onSubstituteClick: (movement: Movement) => void;
  onReturnClick: (movement: Movement) => void; // Adicionando a prop para devolução
  API_URL: string;
}

const AssetManagementPage = (props: AssetManagementPageProps) => {
  const [activeTab, setActiveTab] = useState<'pending_delivery' | 'active_loans' | 'in_use_assets'>('pending_delivery');
  
  // Estado e função para buscar os ativos que estão "Em Uso"
  const [inUseAssets, setInUseAssets] = useState<Movement[]>([]);
  const [inUseLoading, setInUseLoading] = useState(false);

  const fetchInUseAssets = useCallback(async () => {
    setInUseLoading(true);
    try {
      const response = await axios.get(`${props.API_URL}/asset-movements/in-use-assets`);
      setInUseAssets(response.data);
    } catch (error) {
      console.error('Erro ao buscar ativos em uso:', error);
    } finally {
      setInUseLoading(false);
    }
  }, [props.API_URL]);

  // Efeito que dispara a busca de dados quando a aba é trocada
  useEffect(() => {
    if (activeTab === 'in_use_assets') {
      fetchInUseAssets();
    }
    // A busca para as outras abas já está dentro dos seus respectivos componentes
  }, [activeTab, fetchInUseAssets]);


  const tabs = [
    { id: 'pending_delivery', label: 'Entregas Pendentes', icon: CheckCircle },
    { id: 'active_loans', label: 'Empréstimos Ativos', icon: Calendar },
    { id: 'in_use_assets', label: 'Ativos em Uso (Saídas)', icon: HardDrive },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-extrabold text-blue-900">Gerenciar Ativos Externos</h1>
      
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center ${activeTab === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
              <tab.icon className="mr-2 h-5 w-5" /> {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-6">
        {/* Aba 1: Entregas Pendentes */}
        {activeTab === 'pending_delivery' && ( 
            <DeliveryConfirmationPage 
                onConfirmClick={props.onConfirmClick} 
                API_URL={props.API_URL} 
            /> 
        )}

        {/* Aba 2: Empréstimos Ativos */}
        {activeTab === 'active_loans' && ( 
            <LoanRenewalPage 
                onRenewClick={props.onRenewClick}
                onSubstituteClick={props.onSubstituteClick}
                onReturnClick={props.onReturnClick}
                API_URL={props.API_URL}
            /> 
        )}
        
        {/* Aba 3: Ativos em Uso (Lógica de exibição implementada) */}
        {activeTab === 'in_use_assets' && (
          <div className="bg-white p-6 rounded-xl shadow-md">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Ativos com Status "Em Uso"</h3>
            <div className="overflow-x-auto">
              {inUseLoading ? <p className="text-center py-4">Carregando...</p> : 
               inUseAssets.length > 0 ? (
                <table className="w-full text-sm text-left text-gray-500">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                      <th className="px-6 py-3">Solicitante</th>
                      <th className="px-6 py-3">Ativos (Patrimônio)</th>
                      <th className="px-6 py-3">Data da Saída</th>
                      <th className="px-6 py-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inUseAssets.map((movement) => (
                      <tr key={movement.id} className="bg-white border-b hover:bg-gray-50">
                        <td className="px-6 py-4">{movement.recipient_display_name}</td>
                        <td className="px-6 py-4">{movement.assets?.map(a => a.patrimonio_number).join(', ')}</td>
                        <td className="px-6 py-4">{new Date(movement.movement_date).toLocaleDateString('pt-BR')}</td>
                        <td className="px-6 py-4 text-center flex items-center justify-center space-x-2">
                           <button onClick={() => props.onSubstituteClick(movement)} className="text-xs bg-orange-500 text-white px-3 py-1 rounded-lg hover:bg-orange-600 flex items-center" title="Substituir este ativo">
                            <Repeat className="w-4 h-4 mr-1"/> Substituir
                          </button>
                           <button onClick={() => props.onReturnClick(movement)} className="text-xs bg-gray-500 text-white px-3 py-1 rounded-lg hover:bg-gray-600 flex items-center" title="Registrar a devolução deste ativo">
                            <CornerUpLeft className="w-4 h-4 mr-1"/> Devolver
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                    <Info className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p>Nenhum ativo com status "Em Uso" encontrado.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetManagementPage;