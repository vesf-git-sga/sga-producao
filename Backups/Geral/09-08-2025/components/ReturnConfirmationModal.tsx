// frontend/src/components/ReturnConfirmationModal.tsx -> VERSÃO FINAL CORRIGIDA

import React, { useState, useEffect, useContext } from 'react';
import { X, CheckCircle } from 'lucide-react';
import { Movement, Peripheral, AuthContext } from '../App'; // Importa o AuthContext exportado

interface ReturnConfirmationModalProps {
  movement: Movement;
  onClose: () => void;
  onConfirm: (notes: string, returnedPeripherals: Peripheral[]) => Promise<void>;
}

const ReturnConfirmationModal = ({ movement, onClose, onConfirm }: ReturnConfirmationModalProps) => {
  // ETAPA 1: Todos os Hooks são chamados incondicionalmente no topo.
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [originalPeripherals, setOriginalPeripherals] = useState<Peripheral[]>([]);
  const [checkedPeripherals, setCheckedPeripherals] = useState<{ [key: string]: boolean }>({});
  const authContext = useContext(AuthContext);

  // O useEffect também é um Hook e deve estar aqui no topo.
  useEffect(() => {
    // A lógica para buscar os periféricos da movimentação principal.
    // Isso assume que, ao abrir o modal, o objeto 'movement' já contém os periféricos.
    if (movement.peripherals && movement.peripherals.length > 0) {
      const peripherals: Peripheral[] = movement.peripherals;
      setOriginalPeripherals(peripherals);
      
      const initialChecks: { [key: string]: boolean } = {};
      peripherals.forEach(p => {
        initialChecks[p.peripheral_type] = true;
      });
      setCheckedPeripherals(initialChecks);
    }
  }, [movement]); // A dependência é o objeto 'movement'.

  // ETAPA 2: A lógica condicional que pode retornar 'null' vem DEPOIS de todos os Hooks.
  if (!authContext) {
    console.error("AuthContext não está disponível. O modal não pode ser renderizado.");
    return null; 
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const returnedPeripherals: Peripheral[] = originalPeripherals
      .filter(p => checkedPeripherals[p.peripheral_type])
      .map(p => ({ 
          peripheral_type: p.peripheral_type, 
          quantity: p.quantity,
          status: 'in' // Adiciona o status para satisfazer a tipagem do TypeScript
      }));

    await onConfirm(notes, returnedPeripherals);
    setIsLoading(false);
  };

  const handleCheckboxChange = (peripheralType: string) => {
    setCheckedPeripherals(prev => ({
      ...prev,
      [peripheralType]: !prev[peripheralType]
    }));
  };

  // ETAPA 3: A renderização do componente.
  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg relative">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold text-blue-900 mb-6">Confirmar Devolução</h2>

        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Você confirma a devolução do(s) seguinte(s) ativo(s), que está(ão) sob a responsabilidade de <strong>{movement.recipient_display_name}</strong>?
          </p>
          <ul className="list-disc list-inside bg-gray-50 p-3 border rounded-md text-sm">
            {movement.assets?.map(asset => (
              <li key={asset.id}>{asset.brand} {asset.model} (Patrimônio: {asset.patrimonio_number || 'N/A'})</li>
            ))}
          </ul>

          {/* Checklist de Acessórios */}
          {originalPeripherals.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirmar Acessórios Devolvidos:</label>
              <div className="space-y-2 bg-gray-50 p-3 border rounded-md">
                {originalPeripherals.map(p => (
                  <label key={p.peripheral_type} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!checkedPeripherals[p.peripheral_type]}
                      onChange={() => handleCheckboxChange(p.peripheral_type)}
                      className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">{p.quantity}x {p.peripheral_type}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Observações da Devolução (Opcional)</label>
            <textarea
              id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
              placeholder="Ex: Devolvido com a caixa, porém sem o mouse."
            ></textarea>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-8">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
            Cancelar
          </button>
          <button type="submit" disabled={isLoading} className="px-4 py-2 bg-green-600 text-white rounded-lg shadow-sm hover:bg-green-700 disabled:opacity-50 flex items-center">
            <CheckCircle className="w-5 h-5 mr-2"/>
            {isLoading ? 'Processando...' : 'Confirmar Devolução'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReturnConfirmationModal;