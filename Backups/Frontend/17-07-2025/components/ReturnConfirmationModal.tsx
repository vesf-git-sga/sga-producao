// frontend/src/components/ReturnConfirmationModal.tsx

import React, { useState } from 'react';
import { X, CornerUpLeft, CheckCircle } from 'lucide-react';
import { Movement } from '../App';

interface ReturnConfirmationModalProps {
  movement: Movement;
  onClose: () => void;
  onConfirm: (movementId: number, notes: string) => Promise<void>;
}

const ReturnConfirmationModal = ({ movement, onClose, onConfirm }: ReturnConfirmationModalProps) => {
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await onConfirm(movement.id, notes);
    setIsLoading(false);
    // O onClose será chamado pela função pai após o sucesso
  };

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
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Observações da Devolução (Opcional)</label>
            <textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
              placeholder="Ex: Devolvido com a caixa e todos os acessórios."
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