// frontend/src/components/MovementQueryPage.tsx

import React from 'react';
import { FileText, PlusCircle, CheckCircle, Calendar } from 'lucide-react'; // Removido AlertTriangle
import { Movement } from '../App';

// Define as propriedades que este componente espera receber (sem onNavigate)
interface MovementQueryPageProps {
  filters: any;
  movements: Movement[];
  isReportEnabled: boolean;
  onFilterChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onFilterSubmit: () => void;
  onFilterClear: () => void;
  onGenerateReport: () => void;
  onRegisterMovementClick: () => void;
  translateMovementType: (type: string) => string;
  handleGenerateMovementReceipt: (id: number) => void;
  onConfirmDeliveryClick: (movement: Movement) => void;
  onRenewClick: (movement: Movement) => void;
}

const MovementQueryPage = ({
  filters,
  movements,
  isReportEnabled,
  onFilterChange,
  onFilterSubmit,
  onFilterClear,
  onGenerateReport,
  onRegisterMovementClick,
  translateMovementType,
  handleGenerateMovementReceipt,
  onConfirmDeliveryClick,
  onRenewClick,
}: MovementQueryPageProps) => {

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-extrabold text-blue-900">Consultar Movimentações</h1>
        <button
          onClick={onRegisterMovementClick}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-md hover:bg-blue-700 flex items-center"
        >
          <PlusCircle className="w-5 h-5 mr-2" />
          Registrar Movimentação
        </button>
      </div>

      {/* Container dos Filtros (sem alterações) */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 items-start">
          
          <div className="space-y-4 p-4 border rounded-lg h-full">
            <h3 className="font-semibold text-gray-600 border-b pb-2 mb-4">Solicitante</h3>
            <div>
              <label htmlFor="solicitante" className="block text-sm text-gray-600 mb-1">Nome</label>
              <input type="text" name="solicitante" id="solicitante" value={filters.solicitante} onChange={onFilterChange} className="block w-full border-gray-300 rounded-md shadow-sm" placeholder="Permitir opção de busca" />
            </div>
            <div>
              <label htmlFor="cpf" className="block text-sm text-gray-600 mb-1">CPF</label>
              <input type="text" name="cpf" id="cpf" value={filters.cpf} onChange={onFilterChange} className="block w-full border-gray-300 rounded-md shadow-sm" placeholder="Permitir opção de busca" />
            </div>
             <div>
              <label htmlFor="matricula" className="block text-sm text-gray-600 mb-1">Matrícula</label>
              <input type="text" name="matricula" id="matricula" value={filters.matricula} onChange={onFilterChange} className="block w-full border-gray-300 rounded-md shadow-sm" placeholder="Permitir opção de busca" />
            </div>
          </div>

          <div className="space-y-4 p-4 border rounded-lg h-full">
            <h3 className="font-semibold text-gray-600 border-b pb-2 mb-4">Ativo & Tipo</h3>
             <div>
              <label htmlFor="patrimonio" className="block text-sm font-medium text-gray-700 mb-1">Patrimônio</label>
              <input type="text" name="patrimonio" id="patrimonio" value={filters.patrimonio} onChange={onFilterChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" placeholder="Permitir opção de busca" />
            </div>
             <div className="pt-2">
              <label htmlFor="movementType" className="block text-sm font-medium text-gray-700 mb-1">Tipo de Movimentação</label>
              <select name="movementType" id="movementType" value={filters.movementType} onChange={onFilterChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                <option value="">Todos</option>
                <option value="entry">Entrada</option>
                <option value="exit">Saída</option>
                <option value="loan">Empréstimo</option>
                <option value="return">Devolução</option>
                <option value="maintenance">Manutenção</option>
              </select>
            </div>
          </div>
          
          <div className="space-y-4 p-4 border rounded-lg h-full flex flex-col justify-between">
            <h3 className="font-semibold text-gray-600 border-b pb-2 mb-4">Período</h3>
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
              <input type="date" name="startDate" id="startDate" value={filters.startDate} onChange={onFilterChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
              <input type="date" name="endDate" id="endDate" value={filters.endDate} onChange={onFilterChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
            </div>
            <div className="flex justify-end gap-3 pt-5">
              <button onClick={onFilterClear} className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg shadow-sm hover:bg-gray-300">Limpar Filtros</button>
              <button onClick={onFilterSubmit} className="bg-blue-600 text-white px-6 py-2 rounded-lg shadow-md hover:bg-blue-700">Filtrar</button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-md mt-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Histórico de Movimentações</h3>
          <button onClick={onGenerateReport} disabled={!isReportEnabled} className="bg-purple-600 text-white px-4 py-2 rounded-lg shadow-md flex items-center disabled:opacity-50 disabled:cursor-not-allowed" title={isReportEnabled ? "Gerar relatório desta consulta" : "Faça uma consulta para habilitar o relatório"}>
            <FileText className="w-5 h-5 mr-2" /> Gerar Relatório
          </button>
        </div>
        <div className="overflow-x-auto">
          {movements.length > 0 ? (
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3">Ativos (Patrimônio)</th>
                  <th scope="col" className="px-6 py-3">Tipo de Movimentação</th>
                  <th scope="col" className="px-6 py-3">Status Entrega</th>
                  <th scope="col" className="px-6 py-3">Data</th>
                  <th scope="col" className="px-6 py-3">Responsável (Operador)</th>
                  <th scope="col" className="px-6 py-3">Solicitante</th>
                  <th scope="col" className="px-6 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement: Movement) => (
                  <tr key={movement.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{movement.assets && movement.assets.length > 0 ? movement.assets.map(asset => asset.patrimonio_number || asset.sku).join(', ') : 'N/A'}</td>
                    
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 font-semibold leading-tight text-xs rounded-full ${
                        movement.movement_type === 'entry' ? 'bg-green-100 text-green-700' :
                        movement.movement_type === 'exit' ? 'bg-red-100 text-red-700' :
                        movement.movement_type === 'loan' ? 'bg-yellow-100 text-yellow-700' :
                        movement.movement_type === 'return' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {translateMovementType(movement.movement_type)}
                      </span>
                    </td>

                    {/* CÓDIGO CORRIGIDO: A célula <td> é criada sempre, mas o conteúdo <span...> só aparece se a condição for verdadeira */}
                    <td className="px-6 py-4">
                      {['exit', 'loan'].includes(movement.movement_type) && (
                        <span className={`px-2 py-1 font-semibold leading-tight text-xs rounded-full ${
                          movement.delivery_status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {movement.delivery_status === 'confirmed' ? 'Confirmada' : 'Pendente'}
                        </span>
                      )}
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">{new Date(movement.movement_date).toLocaleDateString('pt-BR')}</td>
                    <td className="px-6 py-4">{movement.responsible_full_name || movement.responsible_username}</td>
                    <td className="px-6 py-4">{movement.recipient_display_name || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button 
                        onClick={() => handleGenerateMovementReceipt(movement.id)} 
                        className="font-medium text-purple-600 hover:underline" 
                        title="Gerar Recibo PDF">
                        <FileText className="inline-block w-5 h-5" />
                      </button>
                      {['exit', 'loan'].includes(movement.movement_type) && movement.delivery_status === 'pending_confirmation' && (
                        <button
                          onClick={() => onConfirmDeliveryClick(movement)}
                          className="ml-4 font-medium text-green-600 hover:underline"
                          title="Confirmar Entrega"
                        >
                          <CheckCircle className="inline-block w-5 h-5" />
                        </button>
                      )}
                      {movement.movement_type === 'loan' && (
                        <button
                        onClick={() => onRenewClick(movement)}
                        className="ml-4 font-medium text-blue-600 hover:underline"
                        title="Renovar Empréstimo"
                        >
                        <Calendar className="inline-block w-5 h-5" />
                        </button>
                    )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-500 text-center py-4">Nenhuma movimentação encontrada. Utilize os filtros acima para iniciar uma busca.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MovementQueryPage;