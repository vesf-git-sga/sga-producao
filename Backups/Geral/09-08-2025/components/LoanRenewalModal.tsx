// Arquivo: frontend/src/components/LoanRenewalModal.tsx

import React, { useState } from 'react';
import { X, Calendar, Save } from 'lucide-react';
import { Movement } from '../App';

interface LoanRenewalModalProps {
  movement: Movement;
  onClose: () => void;
  onSave: (movementId: number, newDate: string, note: string) => Promise<void>;
}

const LoanRenewalModal = ({ movement, onClose, onSave }: LoanRenewalModalProps) => {
  const [newExpectedReturnDate, setNewExpectedReturnDate] = useState('');
  const [renewalNote, setRenewalNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpectedReturnDate) {
      alert('Por favor, selecione uma nova data.');
      return;
    }
    setIsLoading(true);
    await onSave(movement.id, newExpectedReturnDate, renewalNote);
    setIsLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg relative">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold text-blue-900 mb-6">Renovar Empréstimo</h2>

        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            <strong>Solicitante:</strong> {movement.recipient_display_name}<br/>
            <strong>Vencimento Atual:</strong> {movement.expected_return_date ? new Date(movement.expected_return_date).toLocaleDateString('pt-BR') : 'N/A'}
          </p>
          <div>
            <label htmlFor="newDate" className="block text-sm font-medium text-gray-700 mb-1">Nova Data de Devolução</label>
            <input
              type="date"
              id="newDate"
              value={newExpectedReturnDate}
              onChange={(e) => setNewExpectedReturnDate(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="note" className="block text-sm font-medium text-gray-700 mb-1">Motivo/Observação (Opcional)</label>
            <textarea
              id="note"
              rows={3}
              value={renewalNote}
              onChange={(e) => setRenewalNote(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
              placeholder="Ex: Renovado a pedido do gestor do setor."
            ></textarea>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-8">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
            Cancelar
          </button>
          <button type="submit" disabled={isLoading} className="px-4 py-2 bg-blue-700 text-white rounded-lg shadow-sm hover:bg-blue-800 disabled:opacity-50">
            <Save className="w-5 h-5 mr-2 inline-block"/>
            {isLoading ? 'Salvando...' : 'Salvar Renovação'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default LoanRenewalModal;