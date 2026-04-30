// frontend/src/components/ApprovalActionModal.tsx

import React, { useState } from 'react';
import { X, Check, X as XIcon } from 'lucide-react';

interface ApprovalActionModalProps {
  action: 'approve' | 'reject';
  requestId: number;
  onClose: () => void;
  onConfirm: (requestId: number, reason?: string) => void;
}

const ApprovalActionModal = ({ action, requestId, onClose, onConfirm }: ApprovalActionModalProps) => {
  const [reason, setReason] = useState('');

  const isRejecting = action === 'reject';

  const handleConfirm = () => {
    if (isRejecting && !reason) {
      alert('O motivo da rejeição é obrigatório.');
      return;
    }
    onConfirm(requestId, reason);
  };
  
  const title = isRejecting ? 'Rejeitar Solicitação de Baixa' : 'Aprovar Solicitação de Baixa';
  const confirmText = isRejecting ? 'Confirmar Rejeição' : 'Confirmar Aprovação';
  const Icon = isRejecting ? XIcon : Check;
  const buttonColor = isRejecting ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700';

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md relative">
        <h2 className="text-2xl font-bold text-blue-900 mb-6">{title}</h2>
        <p className="text-gray-600 mb-4">Você tem certeza que deseja {isRejecting ? 'rejeitar' : 'aprovar'} esta solicitação?</p>
        
        {isRejecting && (
          <div>
            <label htmlFor="rejection_reason" className="block text-sm font-medium text-gray-700 mb-1">Motivo da Rejeição (Obrigatório)</label>
            <textarea
              id="rejection_reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
              required
            />
          </div>
        )}

        <div className="flex justify-end space-x-3 mt-8">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancelar</button>
          <button onClick={handleConfirm} className={`px-4 py-2 text-white rounded-lg shadow-sm ${buttonColor} flex items-center`}>
            <Icon className="w-5 h-5 mr-2"/> {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApprovalActionModal;