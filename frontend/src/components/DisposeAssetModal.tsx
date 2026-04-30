// frontend/src/components/DisposeAssetModal.tsx

import React, { useState } from 'react';
import axios from 'axios';
import { X, Trash2, Save, AlertTriangle, FileText, Download } from 'lucide-react';
import { Asset } from '../App';

interface DisposeAssetModalProps {
  asset: Asset;
  onClose: () => void;
  onSave: (assetId: number, note: string) => Promise<void>;
  API_URL: string; // Adicionado para gerar o PDF
}

const DisposeAssetModal = ({ asset, onClose, onSave, API_URL }: DisposeAssetModalProps) => {
  const [disposalNote, setDisposalNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disposalNote) {
      alert('Por favor, informe a nota de descarte (ex: para onde foi enviado, etc).');
      return;
    }
    
    // Confirmação final
    if (!window.confirm('TEM CERTEZA? O ativo sairá definitivamente do estoque.')) return;

    setIsLoading(true);
    try {
        // 1. Salva no banco (Executa a lógica de update status='disposed')
        await onSave(asset.id, disposalNote);

        // 2. Gera o Termo de Descarte (PDF)
        const response = await axios.post(`${API_URL}/reports/disposal-term`, {
            asset: asset,
            disposal_note: disposalNote,
            technician_name: 'Usuário do Sistema' // Idealmente pegar do contexto de auth
        }, { responseType: 'blob' });

        // 3. Download automático
        const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Termo_Descarte_${asset.patrimonio_number || asset.id}.pdf`);
        document.body.appendChild(link);
        link.click();
        
        // Limpeza
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        link.parentNode?.removeChild(link);

    } catch (error) {
        console.error("Erro ao processar descarte:", error);
        alert("O descarte foi registrado, mas houve erro ao gerar o PDF.");
    } finally {
        setIsLoading(false);
        onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1001] p-4">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg relative">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold text-red-700 mb-4 flex items-center"><AlertTriangle className="mr-3"/>Descartar Ativo Permanentemente</h2>
        
        <div className="space-y-4">
            <div className="bg-red-50 p-4 border border-red-200 rounded-md text-sm text-red-800">
                <p className="font-bold flex items-center"><FileText className="w-4 h-4 mr-2"/> Ação Irreversível</p>
                <p className="mt-1">Ao confirmar, o status mudará para <strong>DESCARTADO</strong> e o <strong>Termo de Destinação Final</strong> será gerado automaticamente para impressão.</p>
            </div>

            <div className="bg-gray-50 p-3 border rounded-md text-sm">
                <p><strong>Ativo:</strong> {asset.brand} {asset.model}</p>
                <p><strong>Patrimônio:</strong> {asset.patrimonio_number || 'N/A'}</p>
                <p><strong>Status Atual:</strong> {asset.status === 'retired' ? 'Baixado (Pronto para Descarte)' : asset.status}</p>
            </div>
            <div>
                <label htmlFor="note" className="block text-sm font-medium text-gray-700 mb-1">Nota de Destino (Obrigatório)</label>
                <textarea
                id="note"
                rows={3}
                value={disposalNote}
                onChange={(e) => setDisposalNote(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Ex: Enviado para a Cooperativa de Reciclagem EcoTech conforme Ofício nº 123/2026."
                required
                ></textarea>
            </div>
        </div>

        <div className="flex justify-end space-x-3 mt-8">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">
            Cancelar
          </button>
          <button type="submit" disabled={isLoading} className="px-4 py-2 bg-red-700 text-white rounded-lg shadow-sm hover:bg-red-800 disabled:opacity-50 flex items-center font-bold">
            {isLoading ? 'Processando...' : <><Trash2 className="w-5 h-5 mr-2"/> Confirmar e Gerar Termo</>}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DisposeAssetModal;